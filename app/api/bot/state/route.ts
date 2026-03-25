import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/bot/state?tournament_id=xxx
 * Returns current tournament state including leaderboard.
 */
export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get('authorization')?.replace('Bearer ', '')
    const tournamentId = req.nextUrl.searchParams.get('tournament_id')

    if (!apiKey) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }

    const bot = await prisma.bot.findUnique({ where: { apiKey } })
    if (!bot) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    if (!tournamentId) {
      return NextResponse.json({ error: 'tournament_id required' }, { status: 400 })
    }

    const botTournament = await prisma.botTournament.findFirst({
      where: { botId: bot.id, tournamentId },
      include: {
        tournament: {
          include: {
            bots: true,
            periodLogs: { orderBy: { absolutePeriod: 'desc' } },
          },
        },
      },
    })

    if (!botTournament) {
      return NextResponse.json({ error: 'Not in this tournament' }, { status: 404 })
    }

    const { tournament, ...bt } = botTournament

    // Build leaderboard
    const leaderboard = buildLeaderboard(tournament.bots, tournament.periodLogs)

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        status: tournament.status,
        started_at: tournament.startedAt?.toISOString() ?? null,
        completed_at: tournament.completedAt?.toISOString() ?? null,
        leaderboard,
      },
      recent_periods: tournament.periodLogs.slice(0, 5).map(pl => ({
        stage: pl.stage,
        period: pl.period,
        absolute_period: pl.absolutePeriod,
        clearing_price: pl.clearingPrice,
        winner_bot_id: pl.winnerBotId,
        tokens_available: pl.tokensAvailable,
        rescinded: !!pl.rescindDetail,
        num_bidders: pl.numBidders,
      })),
    })
  } catch (err) {
    console.error('[state error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function buildLeaderboard(bots: any[], periodLogs: any[]) {
  const tokenMap = new Map<string, [number, number, number]>()

  for (const bot of bots) {
    tokenMap.set(bot.id, [0, 0, 0])
  }

  for (const log of periodLogs) {
    const alloc = JSON.parse(log.allocations) as any[]
    for (const a of alloc) {
      const current = tokenMap.get(a.botId) ?? [0, 0, 0]
      const [s1, s2, s3] = current
      if (log.stage === 0) tokenMap.set(a.botId, [s1 + a.tokensWon, s2, s3])
      if (log.stage === 1) tokenMap.set(a.botId, [s1, s2 + a.tokensWon, s3])
      if (log.stage === 2) tokenMap.set(a.botId, [s1, s2, s3 + a.tokensWon])
    }
  }

  return Array.from(tokenMap.entries()).map(([botId, tokensPerStage]) => {
    const bot = bots.find((b: any) => b.id === botId)
    return {
      bot_id: bot?.botSlot ?? botId,
      tokens_per_stage: tokensPerStage,
      sp: bot?.sp ?? 0,
      weighted_points: bot?.weightedPoints ?? 0,
      periods_won: bot?.periodsWon ?? 0,
      spent: bot?.budgetSpent ?? 0,
      remaining: bot?.budgetRemaining ?? 10000,
      rescinds: bot?.rescindsUsed ?? 0,
    }
  })
}
