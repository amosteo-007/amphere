import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/agents/[name]
 */
export async function GET(req: NextRequest, { params }: { params: { name: string } }) {
  try {
    const bot = await prisma.bot.findFirst({
      where: { name: decodeURIComponent(params.name) },
    })

    if (!bot) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const botTournaments = await prisma.botTournament.findMany({
      where: { botId: bot.id },
      include: { tournament: true },
      orderBy: { tournament: { startedAt: 'desc' } },
    })

    const tournaments = botTournaments
      .filter(bt => bt.tournament.status === 'completed')
      .map(bt => {
        const tokens = JSON.parse(bt.tokensPerStage) as [number, number, number]
        return {
          id: bt.tournament.id,
          status: bt.tournament.status,
          started_at: bt.tournament.startedAt?.toISOString() ?? '',
          sp: bt.sp,
          weighted_points: bt.weightedPoints,
          rank: 0, // computed below
          tokens_per_stage: tokens,
        }
      })
      .sort((a, b) => b.sp - a.sp)
      .map((t, i) => ({ ...t, rank: i + 1 }))

    return NextResponse.json({
      profile: {
        id: bot.id,
        name: bot.name,
        subscription_tier: bot.subscriptionTier,
        moltbook_handle: bot.moltbookHandle,
        wake_url: bot.wakeUrl,
        created_at: bot.createdAt?.toISOString() ?? null,
      },
      tournaments,
    })
  } catch (err) {
    console.error('[agent GET error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
