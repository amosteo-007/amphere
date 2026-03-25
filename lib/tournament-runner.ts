/**
 * Tournament Runner
 *
 * This module manages the active tournament loop.
 * It advances periods, resolves auctions, and emits WebSocket events.
 *
 * In production this runs as a background job (e.g., BullMQ, Inngest, or cron).
 * Here we implement it as an in-process runner for simplicity.
 */

import { prisma } from './db'
import { STAGE_CONFIGS, resolvePeriod, calculateWeightedPoints } from './auction-engine'

const PERIOD_INTERVAL_MS = 15_000 // 15 seconds per period
const RESOLUTION_DELAY_MS = 3_000 // 3 seconds after all bids received

interface TournamentRunner {
  tournamentId: string
  stop: () => void
}

interface ActiveRunner {
  stop: () => void
}

const activeRunners = new Map<string, ActiveRunner>()

export async function startTournament(tournamentId: string): Promise<ActiveRunner> {
  // Cancel any existing runner for this tournament
  const existing = activeRunners.get(tournamentId)
  if (existing) existing.stop()

  const runner = runTournamentLoop(tournamentId)
  activeRunners.set(tournamentId, runner)
  return runner
}

async function runTournamentLoop(tournamentId: string): Promise<ActiveRunner> {
  let currentStage = 0
  let currentPeriod = 0
  let resolved = false
  let timeoutId: NodeJS.Timeout | null = null

  const stop = () => {
    if (timeoutId) clearTimeout(timeoutId)
    resolved = true
  }

  while (!resolved) {
    // Wait for all bots to submit bids OR period timeout
    const stageConfig = STAGE_CONFIGS[currentStage]
    const absolutePeriod = currentStage * 5 + currentPeriod

    // Collect bids for this period
    const bids = await collectBids(tournamentId, currentStage, currentPeriod)

    if (bids.size === 0 && currentStage === 0 && currentPeriod === 0) {
      // No bids at start — run the period anyway
    }

    // Resolve period
    const result = await resolveCurrentPeriod(
      tournamentId,
      currentStage,
      currentPeriod,
      absolutePeriod,
      bids,
      stageConfig
    )

    // Emit WebSocket event
    emitPeriodResult(tournamentId, result)

    // Advance
    currentPeriod++
    if (currentPeriod >= 5) {
      currentPeriod = 0
      currentStage++
    }

    if (currentStage >= 3) {
      // Tournament complete
      await finalizeTournament(tournamentId)
      resolved = true
      break
    }

    // Schedule next period
    await sleep(PERIOD_INTERVAL_MS)
  }

  return { stop }
}

async function collectBids(
  tournamentId: string,
  stage: number,
  period: number
): Promise<Map<string, number>> {
  const bids = new Map<string, number>()

  // Poll for all bot bids for this stage/period
  const maxWait = PERIOD_INTERVAL_MS - RESOLUTION_DELAY_MS
  const pollInterval = 500
  let waited = 0

  while (waited < maxWait) {
    const botBids = await prisma.bid.findMany({
      where: { tournamentId, stage, period },
    })

    for (const bid of botBids) {
      if (bid.bidType === 'bid' && bid.pricePerToken >= STAGE_CONFIGS[stage].floorPrice) {
        bids.set(bid.botId, bid.pricePerToken)
      }
    }

    // Also include algo bot decisions (generated on-the-fly)
    const algoBids = await generateAlgoBids(tournamentId, stage, period, bids)
    for (const [botId, bid] of algoBids) {
      if (!bids.has(botId)) bids.set(botId, bid)
    }

    if (bids.size >= 2) break // At least 2 bots have bid

    await sleep(pollInterval)
    waited += pollInterval
  }

  return bids
}

async function generateAlgoBids(
  tournamentId: string,
  stage: number,
  period: number,
  humanBids: Map<string, number>
): Promise<Map<string, number>> {
  const algoBids = new Map<string, number>()

  const algoBots = await prisma.botTournament.findMany({
    where: { tournamentId },
    include: { bot: true },
  })

  const stageConfig = STAGE_CONFIGS[stage]

  for (const bt of algoBots) {
    if (bt.bot.subscriptionTier === 'algo' || bt.bot.apiKey.startsWith('algo-')) {
      // Simple algo: bid floor + small random
      const floor = stageConfig.floorPrice
      const bid = Math.random() < 0.7
        ? floor * (1 + Math.random() * 0.1) // 70% chance: bid just above floor
        : floor * (1.3 + Math.random() * 0.5) // 30% chance: aggressive
      algoBids.set(bt.botId, Math.round(bid * 100) / 100)
    }
  }

  return algoBids
}

async function resolveCurrentPeriod(
  tournamentId: string,
  stage: number,
  period: number,
  absolutePeriod: number,
  bids: Map<string, number>,
  stageConfig: { floorPrice: number; tokensPerPeriod: number; stageNumber: number; multiplier: number }
) {
  // Get current token holdings
  const botTournaments = await prisma.botTournament.findMany({
    where: { tournamentId },
    include: { bot: true },
  })

  const tokensHeld = new Map<string, number>()
  const paidThisStage = new Map<string, number>()
  const tokensPerStageMap = new Map<string, [number, number, number]>()

  for (const bt of botTournaments) {
    tokensHeld.set(bt.botId, 0)
    paidThisStage.set(bt.botId, 0)
    tokensPerStageMap.set(bt.botId, [0, 0, 0])
  }

  // Get previous period logs for this tournament to rebuild state
  const prevLogs = await prisma.periodLog.findMany({
    where: { tournamentId, absolutePeriod: { lt: absolutePeriod } },
    orderBy: { absolutePeriod: 'asc' },
  })

  for (const log of prevLogs) {
    const alloc = JSON.parse(log.allocations) as any[]
    for (const a of alloc) {
      const held = tokensHeld.get(a.botId) ?? 0
      tokensHeld.set(a.botId, held + a.tokensWon)
      const [s1, s2, s3] = tokensPerStageMap.get(a.botId) ?? [0, 0, 0]
      if (log.stage === 0) tokensPerStageMap.set(a.botId, [s1 + a.tokensWon, s2, s3])
      if (log.stage === 1) tokensPerStageMap.set(a.botId, [s1, s2 + a.tokensWon, s3])
      if (log.stage === 2) tokensPerStageMap.set(a.botId, [s1, s2, s3 + a.tokensWon])
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

  // Update tournament current position
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      currentStage: stage,
      currentPeriod: period,
    },
  })

  // Update BotTournament records
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
            tokensHeld: { increment: alloc.tokensWon },
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
  // Award SP for each stage
  const botTournaments = await prisma.botTournament.findMany({
    where: { tournamentId },
    include: { bot: true },
  })

  for (let stage = 0; stage < 3; stage++) {
    // Rank by tokens at end of this stage
    const ranked = [...botTournaments]
      .filter(bt => {
        const tokens = JSON.parse(bt.tokensPerStage) as [number, number, number]
        return tokens[stage] > 0
      })
      .sort((a, b) => {
        const ta = JSON.parse(a.tokensPerStage) as [number, number, number]
        const tb = JSON.parse(b.tokensPerStage) as [number, number, number]
        return tb[stage] - ta[stage]
      })

    const spAwards = [3, 2, 1]
    for (let i = 0; i < Math.min(3, ranked.length); i++) {
      await prisma.botTournament.update({
        where: { id: ranked[i].id },
        data: { sp: { increment: spAwards[i] } },
      })
    }
  }

  // Award bonus SP for weighted points
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
    data: {
      status: 'completed',
      completedAt: new Date(),
    },
  })

  // Emit completion event
  emitTournamentComplete(tournamentId)
}

function emitPeriodResult(tournamentId: string, result: any) {
  // Will be connected to Socket.IO in server.ts
  const io = (global as any).__socketIO
  if (io) {
    io.to(`tournament:${tournamentId}`).emit('period_result', result)
  }
}

function emitTournamentComplete(tournamentId: string) {
  const io = (global as any).__socketIO
  if (io) {
    io.to(`tournament:${tournamentId}`).emit('tournament_complete', { tournamentId })
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
