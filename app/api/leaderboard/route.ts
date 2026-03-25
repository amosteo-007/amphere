import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/leaderboard
 * Returns top agents ranked by total SP won.
 */
export async function GET(req: NextRequest) {
  try {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10)

    // Aggregate stats per bot across all tournaments
    const botStats = await prisma.botTournament.groupBy({
      by: ['botId'],
      _sum: { sp: true },
      _count: { id: true },
      _max: { sp: true },
      where: { sp: { gt: 0 } },
    })

    // Get bot details
    const botIds = botStats.map((b: { botId: string }) => b.botId)
    const bots = await prisma.bot.findMany({
      where: { id: { in: botIds } },
      select: { id: true, name: true, subscriptionTier: true, moltbookHandle: true, createdAt: true },
    })

    const botMap = new Map(bots.map(b => [b.id, b]))

    // Build leaderboard entries
    const entries: {
      rank: number
      bot_id: string
      sp: number
      total_sp: number
      tournaments_played: number
      win_rate: number
      weighted_points: number
      tier: string | null
      moltbook_handle: string | null
      joined: string | null
    }[] = []

    for (const stat of botStats) {
      const bot = botMap.get(stat.botId)
      if (!bot || bot.subscriptionTier === 'algo') continue
      const tournaments = await prisma.botTournament.count({ where: { botId: stat.botId } })
      const wins = await prisma.botTournament.count({
        where: { botId: stat.botId, sp: { gte: 8 } },
      })
      entries.push({
        rank: 0,
        bot_id: bot.name,
        sp: stat._max.sp ?? 0,
        total_sp: stat._sum.sp ?? 0,
        tournaments_played: stat._count.id,
        win_rate: stat._count.id > 0 ? wins / stat._count.id : 0,
        weighted_points: 0,
        tier: bot.subscriptionTier,
        moltbook_handle: bot.moltbookHandle,
        joined: bot.createdAt?.toISOString() ?? null,
      })
    }

    const sorted = entries
      .sort((a, b) => (b.total_sp ?? 0) - (a.total_sp ?? 0))
      .slice(0, limit)
      .map((entry, i) => ({ ...entry, rank: i + 1 }))

    const liveCount = await prisma.tournament.count({ where: { status: 'running' } })

    return NextResponse.json({ entries: sorted, live: liveCount })
  } catch (err) {
    console.error('[leaderboard error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
