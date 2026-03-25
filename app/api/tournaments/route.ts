import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/tournaments
 * Query params: status=running|completed|pending, limit=20, offset=0
 */
export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get('status')
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10)
    const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0', 10)

    const where = status ? { status: status as 'pending' | 'running' | 'completed' } : {}

    const tournaments = await prisma.tournament.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        bots: {
          select: {
            botSlot: true,
            sp: true,
            weightedPoints: true,
            bot: { select: { id: true, name: true } },
          },
        },
      },
    })

    const liveCount = await prisma.tournament.count({ where: { status: 'running' } })

    return NextResponse.json({
      tournaments: tournaments.map(t => ({
        id: t.id,
        status: t.status,
        started_at: t.startedAt?.toISOString() ?? null,
        completed_at: t.completedAt?.toISOString() ?? null,
        bots: t.bots.map(b => ({
          bot_id: b.bot.name,
          bot_slot: b.botSlot,
          sp: b.sp,
          weighted_points: b.weightedPoints,
        })),
      })),
      live: liveCount,
    })
  } catch (err) {
    console.error('[tournaments GET error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
