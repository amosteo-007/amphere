import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/tournaments/[id]
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        bots: {
          include: { bot: true },
          orderBy: { sp: 'desc' },
        },
        periodLogs: {
          orderBy: { absolutePeriod: 'desc' },
          take: 15,
        },
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    // Build leaderboard
    const leaderboard = tournament.bots.map(bt => {
      const tokens = JSON.parse(bt.tokensPerStage) as [number, number, number]
      return {
        bot_id: bt.bot.name,
        tokens_per_stage: tokens,
        sp: bt.sp,
        weighted_points: bt.weightedPoints,
        periods_won: bt.periodsWon,
        spent: bt.budgetSpent,
        remaining: bt.budgetRemaining,
        rescinds: bt.rescindsUsed,
      }
    })

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        status: tournament.status,
        started_at: tournament.startedAt?.toISOString() ?? null,
        completed_at: tournament.completedAt?.toISOString() ?? null,
        current_stage: tournament.currentStage,
        current_period: tournament.currentPeriod,
        leaderboard,
      },
      period_logs: tournament.periodLogs.map(pl => ({
        stage: pl.stage,
        period: pl.period,
        absolute_period: pl.absolutePeriod,
        clearing_price: pl.clearingPrice,
        winner_bot_id: pl.winnerBotId,
        tokens_available: pl.tokensAvailable,
        rescinded: !!pl.rescindDetail,
        num_bidders: pl.numBidders,
        allocations: JSON.parse(pl.allocations),
        all_bids: JSON.parse(pl.allBids),
      })),
    })
  } catch (err) {
    console.error('[tournament GET error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
