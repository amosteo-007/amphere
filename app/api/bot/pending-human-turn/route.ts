import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { STAGE_CONFIGS } from '@/lib/auction-engine'

export const runtime = 'nodejs'

/**
 * GET /api/bot/pending-human-turn
 * Returns the current turn for solo play (single bot vs LLM opponents).
 */
export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!apiKey) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }

    const bot = await prisma.bot.findUnique({ where: { apiKey } })
    if (!bot) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    // Find active tournament for this bot (most recent running tournament)
    const botTournament = await prisma.botTournament.findFirst({
      where: { botId: bot.id },
      include: {
        tournament: {
          include: {
            bots: true,
            periodLogs: { orderBy: { absolutePeriod: 'desc' }, take: 15 },
          },
        },
      },
      orderBy: { tournament: { startedAt: 'desc' } },
    })

    if (!botTournament || botTournament.tournament.status !== 'running') {
      return NextResponse.json({ turn: null })
    }

    const { tournament, ...bt } = botTournament
    const currentStage = tournament.currentStage
    const currentPeriod = tournament.currentPeriod
    const stageConfig = STAGE_CONFIGS[currentStage]

    // Check if there's a pending bid for this bot at current stage/period
    const pendingBid = await prisma.bid.findFirst({
      where: {
        botId: bot.id,
        tournamentId: tournament.id,
        stage: currentStage,
        period: currentPeriod,
      },
    })

    // If bid already submitted, no pending turn
    if (pendingBid) {
      return NextResponse.json({ turn: null })
    }

    // Build observation
    const leaderboard = buildLeaderboard(tournament.bots, tournament.periodLogs)
    const history = tournament.periodLogs.map(pl => ({
      stage: pl.stage,
      period: pl.period,
      allBids: JSON.parse(pl.allBids),
      winnerBotId: pl.winnerBotId,
      clearingPrice: pl.clearingPrice,
      allocations: JSON.parse(pl.allocations),
    }))

    const tokensPerStage = JSON.parse(bt.tokensPerStage) as [number, number, number]
    const weightedPoints =
      tokensPerStage[0] * STAGE_CONFIGS[0].multiplier +
      tokensPerStage[1] * STAGE_CONFIGS[1].multiplier +
      tokensPerStage[2] * STAGE_CONFIGS[2].multiplier

    const turnId = `${tournament.id}-${currentStage}-${currentPeriod}`

    const turn = {
      id: turnId,
      decision_type: 'bid' as const,
      stage: currentStage,
      period: currentPeriod,
      expires_at: new Date(Date.now() + 30_000).toISOString(),
      observation: {
        sp: bt.sp,
        stage: currentStage,
        period: currentPeriod,
        absolute_period: currentStage * 5 + currentPeriod,
        history,
        floor_price: stageConfig.floorPrice,
        leaderboard,
        weighted_points: weightedPoints,
        periods_in_stage: 5,
        points_per_token: stageConfig.multiplier,
        remaining_budget: bt.budgetRemaining,
        stages_remaining: 2 - currentStage,
        tokens_available: stageConfig.tokensPerPeriod,
        tokens_per_stage: tokensPerStage,
        private_rescind_info: [] as any[],
      },
      win_result: null,
      context: {
        sp: bt.sp,
        floor_price: stageConfig.floorPrice,
        leaderboard,
        weighted_points: weightedPoints,
        periods_in_stage: 5,
        points_per_token: stageConfig.multiplier,
        remaining_budget: bt.budgetRemaining,
        stages_remaining: 2 - currentStage,
        tokens_available: stageConfig.tokensPerPeriod,
        tokens_per_stage: tokensPerStage,
        clearing_price_last: tournament.periodLogs[0]?.clearingPrice ?? null,
      },
      tournament_id: tournament.id,
    }

    return NextResponse.json({ turn })
  } catch (err) {
    console.error('[pending-human-turn error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function buildLeaderboard(
  bots: { id: string; botSlot: string | null; sp: number }[],
  periodLogs: { stage: number; allocations: string }[]
) {
  const tokenMap = new Map<string, [number, number, number]>()

  for (const bot of bots) {
    tokenMap.set(bot.id, [0, 0, 0])
  }

  for (const log of periodLogs) {
    const alloc = JSON.parse(log.allocations) as { botId: string; tokensWon: number }[]
    for (const a of alloc) {
      const current = tokenMap.get(a.botId) ?? [0, 0, 0]
      const [s1, s2, s3] = current
      if (log.stage === 0) tokenMap.set(a.botId, [s1 + a.tokensWon, s2, s3])
      else if (log.stage === 1) tokenMap.set(a.botId, [s1, s2 + a.tokensWon, s3])
      else if (log.stage === 2) tokenMap.set(a.botId, [s1, s2, s3 + a.tokensWon])
    }
  }

  return Array.from(tokenMap.entries()).map(([botId, tokensPerStage]) => {
    const bot = bots.find(b => b.id === botId)
    const [s1, s2, s3] = tokensPerStage
    const weightedPoints =
      s1 * STAGE_CONFIGS[0].multiplier +
      s2 * STAGE_CONFIGS[1].multiplier +
      s3 * STAGE_CONFIGS[2].multiplier
    return {
      bot_id: bot?.botSlot ?? botId,
      tokens_per_stage: tokensPerStage,
      weighted_points: weightedPoints,
      sp: bot?.sp ?? 0,
    }
  })
}
