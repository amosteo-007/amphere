/**
 * Tournament Runner
 *
 * Manages the active tournament loop.
 * Advances periods, resolves auctions, and emits Socket.IO events.
 *
 * Flow:
 * 1. POST /api/play creates tournament in DB → calls startTournament()
 * 2. startTournament() returns ActiveRunner immediately, loop runs in background
 * 3. Runner loop: collectBids() → resolveCurrentPeriod() → emit period_result
 * 4. On completion: finalizeTournament() → emit tournament_complete
 *
 * Socket.IO events emitted:
 *   period_result       → broadcast to tournament room (tournament:<id>)
 *   tournament_complete → broadcast to tournament room
 *   turn_notification   → sent to individual bot room (bot:<id>)
 */

import { prisma } from './db'
import { STAGE_CONFIGS, resolvePeriod, calculateWeightedPoints } from './auction-engine'
import { getIO } from './socket-server'

const HUMAN_BID_TIMEOUT_MS = 60_000 // 60 seconds for human to submit bid
const POST_RESOLUTION_DELAY_MS = 3_000 // 3 seconds between periods

interface ActiveRunner {
  stop: () => void
}

const activeRunners = new Map<string, ActiveRunner>()

/**
 * Start the tournament loop in the background.
 * Returns immediately with an ActiveRunner that can stop the loop.
 */
export function startTournament(tournamentId: string): ActiveRunner {
  const existing = activeRunners.get(tournamentId)
  if (existing) existing.stop()

  let stopped = false
  const stop = () => { stopped = true }
  const runner: ActiveRunner = { stop }
  activeRunners.set(tournamentId, runner)

  // Fire-and-forget: loop runs in background
  runTournamentLoop(tournamentId, () => stopped).catch(err => {
    console.error(`[runner] Fatal error in tournament ${tournamentId}:`, err)
  }).finally(() => {
    activeRunners.delete(tournamentId)
  })

  return runner
}

async function runTournamentLoop(tournamentId: string, isStopped: () => boolean) {
  let currentStage = 0
  let currentPeriod = 0

  while (!isStopped()) {
    const stageConfig = STAGE_CONFIGS[currentStage]
    const absolutePeriod = currentStage * 5 + currentPeriod

    // Collect bids for this period (polls DB + generates algo/LLM bids)
    const { bids, rescindBotIds } = await collectBids(tournamentId, currentStage, currentPeriod, isStopped)
    if (isStopped()) break

    // Resolve auction and persist results
    const result = await resolveCurrentPeriod(
      tournamentId,
      currentStage,
      currentPeriod,
      absolutePeriod,
      bids,
      stageConfig,
      rescindBotIds
    )
    if (isStopped()) break

    // Emit live update to all watchers
    emitPeriodResult(tournamentId, result)

    currentPeriod++
    if (currentPeriod >= 5) {
      currentPeriod = 0
      currentStage++
    }

    if (currentStage >= 3) {
      await finalizeTournament(tournamentId)
      break
    }

    // Wait before next period
    await sleep(POST_RESOLUTION_DELAY_MS)
  }
}

interface CollectedBids {
  bids: Map<string, number>
  rescindBotIds: Set<string>
}

async function collectBids(
  tournamentId: string,
  stage: number,
  period: number,
  isStopped: () => boolean
): Promise<CollectedBids> {
  const bids = new Map<string, number>()
  const rescindBotIds = new Set<string>()

  // Find which bots are human (non-algo) — we must wait for their bids
  const allBotTournaments = await prisma.botTournament.findMany({
    where: { tournamentId },
    include: { bot: true },
  })
  const humanBotIds = new Set(
    allBotTournaments
      .filter(bt => !bt.bot.apiKey.startsWith('algo-'))
      .map(bt => bt.botId)
  )

  const pollInterval = 1_000
  let waited = 0

  // Wait for all human bots to submit bids (or timeout)
  while (waited < HUMAN_BID_TIMEOUT_MS && !isStopped()) {
    const botBids = await prisma.bid.findMany({
      where: { tournamentId, stage, period },
    })

    for (const bid of botBids) {
      if (bid.bidType === 'bid' && bid.pricePerToken >= STAGE_CONFIGS[stage].floorPrice) {
        bids.set(bid.botId, bid.pricePerToken)
      } else if (bid.bidType === 'rescind') {
        rescindBotIds.add(bid.botId)
      } else if (bid.bidType === 'skip') {
        // Mark as responded even if skipping
        bids.set(bid.botId, -1) // sentinel: will be filtered before auction
      }
    }

    // Check if all human bots have responded
    const allHumansResponded = [...humanBotIds].every(id => bids.has(id))
    if (allHumansResponded) break

    await sleep(pollInterval)
    waited += pollInterval
  }

  // Remove skip sentinels
  for (const [botId, price] of bids) {
    if (price < 0) bids.delete(botId)
  }

  // Now generate algo/LLM bids (after human bids are in)
  const algoBids = await generateAlgoBids(tournamentId, stage, period, bids)
  for (const [botId, bid] of algoBids) {
    if (!bids.has(botId)) bids.set(botId, bid)
  }

  return { bids, rescindBotIds }
}

async function generateAlgoBids(
  tournamentId: string,
  stage: number,
  period: number,
  _existingBids: Map<string, number>
): Promise<Map<string, number>> {
  const algoBids = new Map<string, number>()

  const algoBots = await prisma.botTournament.findMany({
    where: { tournamentId },
    include: { bot: true },
  })

  const stageConfig = STAGE_CONFIGS[stage]

  const periodLogs = await prisma.periodLog.findMany({
    where: { tournamentId },
    orderBy: { absolutePeriod: 'asc' },
  })

  const leaderboard = buildLeaderboard(algoBots, periodLogs)

  const history = periodLogs.slice(-5).map(pl => ({
    stage: pl.stage,
    period: pl.period,
    allBids: JSON.parse(pl.allBids) as { botId: string; bid: number | null }[],
    clearingPrice: pl.clearingPrice,
    winnerBotId: pl.winnerBotId,
  }))

  for (const bt of algoBots) {
    if (bt.bot.subscriptionTier === 'algo' || bt.bot.apiKey.startsWith('algo-')) {
      const tokensHeld = getTokensHeldForBot(bt.botId, stage, periodLogs)

      const context = {
        stage,
        period,
        floorPrice: stageConfig.floorPrice,
        tokensAvailable: stageConfig.tokensPerPeriod,
        remainingBudget: bt.budgetRemaining,
        tokensHeld,
        weightedPoints: bt.weightedPoints,
        leaderboard,
        history,
      }

      // LLM opponent: apiKey format algo-<provider>-<model>-<tournamentId>
      // Pure algo: apiKey format algo-algo-<tournamentId>-<i>
      const parts = bt.bot.apiKey.split('-')
      const isLLM = parts.length >= 4 && parts[1] !== 'algo'

      if (isLLM) {
        try {
          const { getLLMBid } = await import('./llm-bidding')
          const bid = await getLLMBid(bt.bot.apiKey, context)
          if (bid !== null) {
            algoBids.set(bt.botId, bid)
          }
        } catch (err) {
          console.error('[generateAlgoBids] LLM bid error:', err)
          const bid = algoStrategyBid(bt.botSlot, stageConfig.floorPrice, stage, period, bt.budgetRemaining, tokensHeld, bt.sp)
          if (bid !== null) algoBids.set(bt.botId, bid)
        }
      } else {
        // Pure algo bot: use differentiated strategy based on slot
        const bid = algoStrategyBid(bt.botSlot, stageConfig.floorPrice, stage, period, bt.budgetRemaining, tokensHeld, bt.sp)
        if (bid !== null) algoBids.set(bt.botId, bid)
      }
    }
  }

  return algoBids
}

/**
 * Differentiated algo strategies keyed by bot slot name.
 * Each strategy has distinct personality affecting bid sizing, skip rate, and stage preference.
 */
function algoStrategyBid(
  botSlot: string,
  floor: number,
  stage: number,
  period: number,
  budget: number,
  _tokensHeld: number,
  sp: number
): number | null {
  const round = (n: number) => Math.round(n * 100) / 100

  // Determine strategy from slot name
  const strategy = getStrategy(botSlot)

  // Budget safety: skip if can't afford floor cost
  const cost = floor * STAGE_CONFIGS[stage].tokensPerPeriod
  if (budget < cost) return null

  switch (strategy) {
    case 'aggressive': {
      // Bids high, rarely skips. Dominates early, risks running out of budget.
      const skipChance = 0.05
      if (Math.random() < skipChance) return null
      // Higher in S1/S2 to secure early SP, pulls back in S3 if budget low
      const budgetRatio = budget / 10_000
      const mult = budgetRatio > 0.4
        ? 1.2 + Math.random() * 0.6  // 1.2-1.8× floor
        : 1.0 + Math.random() * 0.15 // conservative when low
      return round(floor * mult)
    }

    case 'conservative': {
      // Bids just above floor, skips often. Preserves budget for S3.
      const skipChance = stage === 0 ? 0.4 : stage === 1 ? 0.3 : 0.1
      if (Math.random() < skipChance) return null
      const mult = 1.0 + Math.random() * 0.08 // 1.0-1.08× floor
      return round(floor * mult)
    }

    case 'sniper': {
      // Skips most periods, then bids very high on select ones.
      // Targets late periods in each stage and all of S3.
      const isLateInStage = period >= 3
      const isS3 = stage === 2
      if (!isLateInStage && !isS3) {
        // Early periods: 70% skip
        if (Math.random() < 0.7) return null
        return round(floor * (1.0 + Math.random() * 0.05))
      }
      // Late periods / S3: aggressive
      if (Math.random() < 0.05) return null
      const mult = 1.3 + Math.random() * 0.8 // 1.3-2.1× floor
      return round(floor * mult)
    }

    case 'adaptive': {
      // Adjusts based on current position. Bids harder when behind, coasts when ahead.
      const behind = sp === 0 && stage > 0
      const periodsLeft = (2 - stage) * 5 + (4 - period)

      if (behind && periodsLeft <= 5) {
        // Desperate: bid aggressively
        if (Math.random() < 0.05) return null
        return round(floor * (1.4 + Math.random() * 0.6))
      }
      if (sp >= 6) {
        // Comfortable lead: coast
        if (Math.random() < 0.35) return null
        return round(floor * (1.0 + Math.random() * 0.1))
      }
      // Middle ground
      if (Math.random() < 0.15) return null
      return round(floor * (1.05 + Math.random() * 0.25))
    }

    default: {
      // Balanced fallback
      if (Math.random() < 0.15) return null
      if (Math.random() < 0.7) return round(floor * (1.0 + Math.random() * 0.1))
      return round(floor * (1.3 + Math.random() * 0.5))
    }
  }
}

function getStrategy(botSlot: string): 'aggressive' | 'conservative' | 'sniper' | 'adaptive' | 'balanced' {
  // Map slot names to strategies for deterministic personality
  const slot = botSlot.toLowerCase()
  if (slot.includes('openai') || slot.includes('player_2')) return 'aggressive'
  if (slot.includes('groq') || slot.includes('player_3')) return 'conservative'
  if (slot.includes('mistral') || slot.includes('player_4')) return 'sniper'
  if (slot.includes('anthropic') || slot.includes('player_5')) return 'adaptive'
  if (slot.includes('algo')) return 'aggressive'
  return 'balanced'
}

function buildLeaderboard(
  botTournaments: { botId: string; botSlot: string; bot: { name: string }; tokensPerStage: string; weightedPoints: number; sp: number }[],
  periodLogs: { stage: number; allocations: string }[]
): { botId: string; botSlot: string; tokensPerStage: number[]; weightedPoints: number }[] {
  const tokenMap = new Map<string, [number, number, number]>()

  for (const bt of botTournaments) {
    tokenMap.set(bt.botId, [0, 0, 0])
  }

  for (const log of periodLogs) {
    const alloc = JSON.parse(log.allocations) as { botId: string; tokensWon: number }[]
    for (const a of alloc) {
      const [s1, s2, s3] = tokenMap.get(a.botId) ?? [0, 0, 0]
      if (log.stage === 0) tokenMap.set(a.botId, [s1 + a.tokensWon, s2, s3])
      else if (log.stage === 1) tokenMap.set(a.botId, [s1, s2 + a.tokensWon, s3])
      else if (log.stage === 2) tokenMap.set(a.botId, [s1, s2, s3 + a.tokensWon])
    }
  }

  return botTournaments.map(bt => ({
    botId: bt.botId,
    botSlot: bt.botSlot ?? bt.bot.name,
    tokensPerStage: tokenMap.get(bt.botId) ?? [0, 0, 0],
    weightedPoints: bt.weightedPoints,
  }))
}

function getTokensHeldForBot(
  botId: string,
  upToStage: number,
  periodLogs: { stage: number; allocations: string }[]
): number {
  let tokens = 0
  for (const log of periodLogs) {
    if (log.stage > upToStage) break
    const alloc = JSON.parse(log.allocations) as { botId: string; tokensWon: number }[]
    for (const a of alloc) {
      if (a.botId === botId) tokens += a.tokensWon
    }
  }
  return tokens
}

async function resolveCurrentPeriod(
  tournamentId: string,
  stage: number,
  period: number,
  absolutePeriod: number,
  bids: Map<string, number>,
  stageConfig: { floorPrice: number; tokensPerPeriod: number; stageNumber: number; multiplier: number },
  rescindBotIds: Set<string>
) {
  const botTournaments = await prisma.botTournament.findMany({
    where: { tournamentId },
    include: { bot: true },
  })

  const tokensHeld = new Map<string, number>()
  const paidThisStage = new Map<string, number>()

  for (const bt of botTournaments) {
    tokensHeld.set(bt.botId, 0)
    paidThisStage.set(bt.botId, 0)
  }

  // Rebuild token holdings from period logs
  const prevLogs = await prisma.periodLog.findMany({
    where: { tournamentId, absolutePeriod: { lt: absolutePeriod } },
    orderBy: { absolutePeriod: 'asc' },
  })

  for (const log of prevLogs) {
    const alloc = JSON.parse(log.allocations) as { botId: string; tokensWon: number; totalPaid: number }[]
    for (const a of alloc) {
      tokensHeld.set(a.botId, (tokensHeld.get(a.botId) ?? 0) + a.tokensWon)
      if (log.stage === stage) {
        paidThisStage.set(a.botId, (paidThisStage.get(a.botId) ?? 0) + a.totalPaid)
      }
    }
  }

  // Load pending rescinds from previous period logs
  const pendingRescinds = new Map<string, { period: number; tokens: number; taxTokens: number }[]>()
  for (const log of prevLogs) {
    if (log.rescindDetail) {
      const detail = JSON.parse(log.rescindDetail) as { botId: string; tokensReturned: number; taxTokens: number; revealAt: number }
      if (detail.revealAt > absolutePeriod) {
        // Still pending — hasn't revealed yet
        const existing = pendingRescinds.get(detail.botId) ?? []
        existing.push({ period: detail.revealAt, tokens: detail.tokensReturned, taxTokens: detail.taxTokens })
        pendingRescinds.set(detail.botId, existing)
      }
    }
  }

  // Process rescinds that reveal this period: deduct tokens + tax from holdings
  for (const [botId, rescinds] of pendingRescinds.entries()) {
    const revealing = rescinds.filter(r => r.period <= absolutePeriod)
    for (const r of revealing) {
      const held = tokensHeld.get(botId) ?? 0
      // Deduct the rescinded tokens (already removed from budget) + tax
      tokensHeld.set(botId, Math.max(0, held - r.tokens - r.taxTokens))
    }
  }

  const result = resolvePeriod(
    stageConfig,
    period,
    absolutePeriod,
    bids,
    tokensHeld,
    pendingRescinds,
    paidThisStage
  )

  // Process new rescind requests for this period's winner
  let rescindDetail: { botId: string; tokensReturned: number; taxTokens: number; revealAt: number } | null = null
  if (result.winnerBotId && rescindBotIds.has(result.winnerBotId)) {
    const taxTokens = Math.ceil(stageConfig.tokensPerPeriod * 0.1)
    rescindDetail = {
      botId: result.winnerBotId,
      tokensReturned: stageConfig.tokensPerPeriod,
      taxTokens,
      revealAt: absolutePeriod + 2, // Phantom: visible for 2 periods before reveal
    }
    // Note: tokens remain in tokensHeld (phantom) — they won't be deducted until revealAt
    // Budget refund happens now (minus tax cost handled at reveal)
  }

  // Persist period log
  await prisma.periodLog.create({
    data: {
      tournamentId,
      stage,
      period,
      absolutePeriod,
      clearingPrice: result.clearingPrice,
      winnerBotId: result.winnerBotId,
      tokensAvailable: result.tokensAvailable,
      numBidders: result.numBidders,
      allBids: JSON.stringify(result.allBids),
      allocations: JSON.stringify(result.allocations),
      rescindDetail: rescindDetail ? JSON.stringify(rescindDetail) : null,
    },
  })

  // Advance tournament position
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { currentStage: stage, currentPeriod: period },
  })

  // Update winner's BotTournament record
  if (result.winnerBotId) {
    const alloc = result.allocations.find(a => a.botId === result.winnerBotId)
    if (alloc) {
      const bt = botTournaments.find(b => b.botId === result.winnerBotId)
      if (bt) {
        const tokens = JSON.parse(bt.tokensPerStage) as [number, number, number]
        tokens[stage] += alloc.tokensWon

        // If rescinded: tokens still show (phantom) but budget is refunded
        const budgetChange = rescindDetail && rescindDetail.botId === result.winnerBotId
          ? 0 // Rescind: no net budget change (refunded)
          : alloc.totalPaid

        await prisma.botTournament.update({
          where: { id: bt.id },
          data: {
            tokensPerStage: JSON.stringify(tokens),
            ...(budgetChange > 0 ? {
              budgetRemaining: { decrement: budgetChange },
              budgetSpent: { increment: budgetChange },
            } : {}),
            periodsWon: { increment: 1 },
            weightedPoints:
              tokens[0] * 1.0 + tokens[1] * 1.5 + tokens[2] * 3.0,
          },
        })
      }
    }
  }

  // Process rescind reveals: deduct phantom tokens + tax from BotTournament
  for (const [botId, rescinds] of pendingRescinds.entries()) {
    const revealing = rescinds.filter(r => r.period === absolutePeriod)
    for (const r of revealing) {
      const bt = botTournaments.find(b => b.botId === botId)
      if (bt) {
        const tokens = JSON.parse(bt.tokensPerStage) as [number, number, number]
        // Deduct rescinded tokens + tax from the stage they were won in
        tokens[stage] = Math.max(0, tokens[stage] - r.tokens - r.taxTokens)

        await prisma.botTournament.update({
          where: { id: bt.id },
          data: {
            tokensPerStage: JSON.stringify(tokens),
            weightedPoints:
              tokens[0] * 1.0 + tokens[1] * 1.5 + tokens[2] * 3.0,
          },
        })
      }
    }
  }

  return result
}

async function finalizeTournament(tournamentId: string) {
  const botTournaments = await prisma.botTournament.findMany({
    where: { tournamentId },
    include: { bot: true },
  })

  // Award stage SP (1st=3, 2nd=2, 3rd=1) for each stage
  // Uses cumulative tokens (carryforward from all prior stages)
  for (let stage = 0; stage < 3; stage++) {
    const ranked = [...botTournaments]
      .map(bt => {
        const tokens = JSON.parse(bt.tokensPerStage) as [number, number, number]
        // Cumulative: sum all stages up to and including current
        const cumulative = tokens.slice(0, stage + 1).reduce((a, b) => a + b, 0)
        return { bt, cumulative }
      })
      .filter(x => x.cumulative > 0)
      .sort((a, b) => b.cumulative - a.cumulative)

    const spAwards = [3, 2, 1]
    for (let i = 0; i < Math.min(3, ranked.length); i++) {
      await prisma.botTournament.update({
        where: { id: ranked[i].bt.id },
        data: { sp: { increment: spAwards[i] } },
      })
    }
  }

  // Award bonus SP to highest cumulative weighted points
  const wpScores = calculateWeightedPoints(
    new Map(botTournaments.map(bt => [bt.botId, JSON.parse(bt.tokensPerStage) as [number, number, number]]))
  )

  let maxWP = 0
  let winnerId: string | null = null
  for (const [botId, wp] of wpScores.entries()) {
    if (wp > maxWP) {
      maxWP = wp
      winnerId = botId
    }
  }
  if (winnerId) {
    const bt = botTournaments.find(b => b.botId === winnerId)
    if (bt) {
      await prisma.botTournament.update({
        where: { id: bt.id },
        data: { sp: { increment: 1 } },
      })
    }
  }

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: 'completed', completedAt: new Date() },
  })

  emitTournamentComplete(tournamentId)
}

function emitPeriodResult(tournamentId: string, result: unknown) {
  try {
    const io = getIO()
    io.to(`tournament:${tournamentId}`).emit('period_result', result)
  } catch {
    // Socket.IO not initialized — no-op in test environments
  }
}

function emitTournamentComplete(tournamentId: string) {
  try {
    const io = getIO()
    io.to(`tournament:${tournamentId}`).emit('tournament_complete', { tournamentId })
  } catch {
    // Socket.IO not initialized — no-op in test environments
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function stopTournament(tournamentId: string) {
  const runner = activeRunners.get(tournamentId)
  if (runner) {
    runner.stop()
    activeRunners.delete(tournamentId)
  }
}
