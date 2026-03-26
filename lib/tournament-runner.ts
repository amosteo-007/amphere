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

const PERIOD_INTERVAL_MS = 15_000 // 15 seconds per period
const RESOLUTION_DELAY_MS = 3_000 // 3 seconds before closing bids

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
    const bids = await collectBids(tournamentId, currentStage, currentPeriod, isStopped)
    if (isStopped()) break

    // Resolve auction and persist results
    const result = await resolveCurrentPeriod(
      tournamentId,
      currentStage,
      currentPeriod,
      absolutePeriod,
      bids,
      stageConfig
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
    await sleep(PERIOD_INTERVAL_MS)
  }
}

async function collectBids(
  tournamentId: string,
  stage: number,
  period: number,
  isStopped: () => boolean
): Promise<Map<string, number>> {
  const bids = new Map<string, number>()

  const maxWait = PERIOD_INTERVAL_MS - RESOLUTION_DELAY_MS
  const pollInterval = 500
  let waited = 0

  while (waited < maxWait && !isStopped()) {
    const botBids = await prisma.bid.findMany({
      where: { tournamentId, stage, period },
    })

    for (const bid of botBids) {
      if (bid.bidType === 'bid' && bid.pricePerToken >= STAGE_CONFIGS[stage].floorPrice) {
        bids.set(bid.botId, bid.pricePerToken)
      }
    }

    // Generate algo/LLM bids for non-human opponents
    const algoBids = await generateAlgoBids(tournamentId, stage, period, bids)
    for (const [botId, bid] of algoBids) {
      if (!bids.has(botId)) bids.set(botId, bid)
    }

    if (bids.size >= 2) break

    await sleep(pollInterval)
    waited += pollInterval
  }

  return bids
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

      // LLM opponent: apiKey encoded as algo-<provider>-<model>-<tournamentId>
      if (bt.bot.apiKey.startsWith('algo-') && bt.bot.apiKey.split('-').length >= 4) {
        try {
          const { getLLMBid } = await import('./llm-bidding')
          const bid = await getLLMBid(bt.bot.apiKey, context)
          if (bid !== null) {
            algoBids.set(bt.botId, bid)
          }
        } catch (err) {
          console.error('[generateAlgoBids] LLM bid error:', err)
          const bid = fallbackAlgoBid(stageConfig.floorPrice)
          if (bid !== null) algoBids.set(bt.botId, bid)
        }
      } else {
        // Pure algo bot: simple probabilistic bid
        const bid = fallbackAlgoBid(stageConfig.floorPrice)
        if (bid !== null) algoBids.set(bt.botId, bid)
      }
    }
  }

  return algoBids
}

function fallbackAlgoBid(floor: number): number | null {
  const rand = Math.random()
  if (rand < 0.15) return null // skip
  if (rand < 0.85) return Math.round(floor * (1 + Math.random() * 0.1) * 100) / 100
  return Math.round(floor * (1.3 + Math.random() * 0.5) * 100) / 100
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
  stageConfig: { floorPrice: number; tokensPerPeriod: number; stageNumber: number; multiplier: number }
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

  const pendingRescinds = new Map<string, { period: number; tokens: number; taxTokens: number }[]>()

  const result = resolvePeriod(
    stageConfig,
    period,
    absolutePeriod,
    bids,
    tokensHeld,
    pendingRescinds,
    paidThisStage
  )

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
      rescindDetail: result.rescindDetail ? JSON.stringify(result.rescindDetail) : null,
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

        await prisma.botTournament.update({
          where: { id: bt.id },
          data: {
            tokensPerStage: JSON.stringify(tokens),
            budgetRemaining: { decrement: alloc.totalPaid },
            budgetSpent: { increment: alloc.totalPaid },
            periodsWon: { increment: 1 },
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
  for (let stage = 0; stage < 3; stage++) {
    const ranked = [...botTournaments]
      .map(bt => {
        const tokens = JSON.parse(bt.tokensPerStage) as [number, number, number]
        return { bt, stageTokens: tokens[stage] }
      })
      .filter(x => x.stageTokens > 0)
      .sort((a, b) => b.stageTokens - a.stageTokens)

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
