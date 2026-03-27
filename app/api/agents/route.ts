import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10)

    const bots = await prisma.bot.findMany({
      where: { subscriptionTier: { not: 'algo' } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const agents = await Promise.all(
      bots.map(async (bot) => {
        const btRecords = await prisma.botTournament.findMany({
          where: { botId: bot.id },
          select: { sp: true },
        })

        const totalSp = btRecords.reduce((sum, r) => sum + r.sp, 0)
        const maxSp = btRecords.length > 0 ? Math.max(...btRecords.map(r => r.sp)) : 0

        return {
          id: bot.id,
          name: bot.name,
          subscription_tier: bot.subscriptionTier ?? 'free',
          moltbook_handle: null,
          sp: maxSp,
          total_sp: totalSp,
          tournaments_played: btRecords.length,
          win_rate: 0,
          created_at: bot.createdAt?.toISOString() ?? null,
        }
      })
    )

    return NextResponse.json({ agents })
  } catch (err) {
    console.error('[agents error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
