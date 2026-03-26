import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { STAGE_CONFIGS } from '@/lib/auction-engine'

export const runtime = 'nodejs'

/**
 * GET /api/bot/pending-human-turn
 * Returns the current turn for solo play (single bot vs LLM opponents).
 * Includes full leaderboard, auction history, and the bot's own position.
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
            bots: { include: { bot: true } },
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
    const absolutePeriod = currentStage * 5 + currentPeriod

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

    // Build full leaderboard from BotTournament records + period logs
    const leaderboard = buildLeaderboard(tournament.bots, tournament.periodLogs)

    // Build auction history
    const history = tournament.periodLogs.map(pl => ({
      stage: pl.stage,
      period: pl.period,
      absolute_period: pl.absolutePeriod,
      allBids: JSON.parse(pl.allBids),
      winnerBotId: pl.winnerBotId,
      clearingPrice: pl.clearingPrice,
      allocations: JSON.parse(pl.allocations),
    }))

    // Bot's own token breakdown
    const tokensPerStage = JSON.parse(bt.tokensPerStage) as [number, number, number]
    const cumulativeTokens = tokensPerStage.reduce((a, b) => a + b, 0)
    const weightedPoints =
      tokensPerStage[0] * STAGE_CONFIGS[0].multiplier +
      tokensPerStage[1] * STAGE_CONFIGS[1].multiplier +
      tokensPerStage[2] * STAGE_CONFIGS[2].multiplier

    // Build private rescind info from period logs
    const privateRescindInfo = tournament.periodLogs
      .filter(pl => pl.rescindDetail)
      .map(pl => {
        const detail = JSON.parse(pl.rescindDetail!) as {
          botId: string; tokensReturned: number; taxTokens: number; revealAt: number
        }
        // Only show this bot's own rescinds
        if (detail.botId !== bot.id) return null
        return {
          period: pl.absolutePeriod,
          tokens: detail.tokensReturned,
          tax_tokens: detail.taxTokens,
          reveal_at: detail.revealAt,
          revealed: detail.revealAt <= absolutePeriod,
        }
      })
      .filter(Boolean)

    const turnId = `${tournament.id}-${currentStage}-${currentPeriod}`

    const turn = {
      id: turnId,
      decision_type: 'bid' as const,
      stage: currentStage,
      period: currentPeriod,
      absolute_period: absolutePeriod,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      tournament_id: tournament.id,

      // Your position
      you: {
        sp: bt.sp,
        tokens_per_stage: tokensPerStage,
        cumulative_tokens: cumulativeTokens,
        weighted_points: weightedPoints,
        remaining_budget: bt.budgetRemaining,
        budget_spent: bt.budgetSpent,
        periods_won: bt.periodsWon,
        rescinds_used: bt.rescindsUsed,
      },

      // Current period info
      observation: {
        stage: currentStage,
        period: currentPeriod,
        absolute_period: absolutePeriod,
        floor_price: stageConfig.floorPrice,
        tokens_available: stageConfig.tokensPerPeriod,
        points_per_token: stageConfig.multiplier,
        periods_in_stage: 5,
        stages_remaining: 2 - currentStage,
        periods_remaining: (2 - currentStage) * 5 + (4 - currentPeriod),
      },

      // All participants
      leaderboard,

      // Auction history (most recent first)
      history,

      // Your private rescind info
      private_rescind_info: privateRescindInfo,

      // Last clearing price for quick reference
      last_clearing_price: tournament.periodLogs[0]?.clearingPrice ?? null,
    }

    return NextResponse.json({ turn })
  } catch (err) {
    console.error('[pending-human-turn error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function buildLeaderboard(
  bots: { botId: string; botSlot: string; sp: number; budgetRemaining: number; budgetSpent: number; periodsWon: number; rescindsUsed: number; weightedPoints: number; tokensPerStage: string; bot: { name: string } }[],
  periodLogs: { stage: number; allocations: string }[]
) {
  // Rebuild token counts from period logs (source of truth)
  const tokenMap = new Map<string, [number, number, number]>()
  for (const bt of bots) {
    tokenMap.set(bt.botId, [0, 0, 0])
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

  return bots.map(bt => {
    const tokens = tokenMap.get(bt.botId) ?? [0, 0, 0]
    const [s1, s2, s3] = tokens
    const cumulative = s1 + s2 + s3
    const wp =
      s1 * STAGE_CONFIGS[0].multiplier +
      s2 * STAGE_CONFIGS[1].multiplier +
      s3 * STAGE_CONFIGS[2].multiplier

    return {
      bot_id: bt.botSlot,
      bot_name: bt.bot.name,
      sp: bt.sp,
      tokens_per_stage: tokens,
      cumulative_tokens: cumulative,
      weighted_points: wp,
      periods_won: bt.periodsWon,
      budget_remaining: bt.budgetRemaining,
      rescinds_used: bt.rescindsUsed,
    }
  }).sort((a, b) => b.sp - a.sp || b.weighted_points - a.weighted_points)
}
