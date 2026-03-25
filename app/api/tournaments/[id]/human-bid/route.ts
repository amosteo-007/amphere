import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { STAGE_CONFIGS } from '@/lib/auction-engine'

export const runtime = 'nodejs'

/**
 * POST /api/tournaments/{id}/human-bid
 * Body: { turn_id, price_per_token } | { turn_id, skip: true } | { turn_id, rescind: bool }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const apiKey = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!apiKey) return NextResponse.json({ error: 'Authorization required' }, { status: 401 })

    const bot = await prisma.bot.findUnique({ where: { apiKey } })
    if (!bot) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

    const body = await req.json()
    const { turn_id, price_per_token, skip, rescind } = body

    if (!turn_id) return NextResponse.json({ error: 'turn_id required' }, { status: 400 })

    const tournament = await prisma.tournament.findFirst({
      where: { id: params.id, status: 'running' },
      include: { bots: { where: { botId: bot.id } } },
    })

    if (!tournament) return NextResponse.json({ error: 'Tournament not found or not running' }, { status: 404 })
    if (tournament.bots.length === 0) return NextResponse.json({ error: 'Bot not in tournament' }, { status: 403 })

    const bt = tournament.bots[0]
    const stageConfig = STAGE_CONFIGS[tournament.currentStage]

    // Check if bid already exists for this turn
    const existingBid = await prisma.bid.findFirst({
      where: { turnId: turn_id, botId: bot.id },
    })
    if (existingBid) return NextResponse.json({ error: 'Bid already submitted for this turn' }, { status: 409 })

    if (skip === true) {
      await prisma.bid.create({
        data: {
          botId: bot.id,
          tournamentId: tournament.id,
          turnId: turn_id,
          stage: tournament.currentStage,
          period: tournament.currentPeriod,
          pricePerToken: 0,
          bidType: 'skip',
        },
      })
      return NextResponse.json({ ok: true, message: 'Skipped' })
    }

    if (typeof rescind === 'boolean') {
      // Rescind decision
      if (rescind) {
        // Check legality
        const tokensPerStage = JSON.parse(bt.tokensPerStage) as [number, number, number]
        const held = tokensPerStage.reduce((a, b) => a + b, 0)
        const tax = Math.ceil(stageConfig.tokensPerPeriod * 0.1)
        if (tournament.currentStage === 2 && tournament.currentPeriod >= 4) {
          return NextResponse.json({ error: 'Rescind forbidden in S3P4 and S3P5' }, { status: 400 })
        }
        if (held < tax) {
          return NextResponse.json({ error: `Insufficient tokens for rescind tax (need ${tax})` }, { status: 400 })
        }
      }

      await prisma.bid.create({
        data: {
          botId: bot.id,
          tournamentId: tournament.id,
          turnId: turn_id,
          stage: tournament.currentStage,
          period: tournament.currentPeriod,
          pricePerToken: 0,
          bidType: 'rescind',
          rescind,
        },
      })

      // If rescind=true, refund tokens (simplified — real impl needs phantom holdings tracking)
      return NextResponse.json({ ok: true })
    }

    if (!price_per_token) {
      return NextResponse.json({ error: 'price_per_token, skip, or rescind required' }, { status: 400 })
    }

    if (price_per_token < stageConfig.floorPrice) {
      return NextResponse.json({ error: 'Bid below floor price' }, { status: 400 })
    }

    const totalCost = price_per_token * stageConfig.tokensPerPeriod
    if (totalCost > bt.budgetRemaining) {
      return NextResponse.json({ error: 'Insufficient budget' }, { status: 400 })
    }

    await prisma.bid.create({
      data: {
        botId: bot.id,
        tournamentId: tournament.id,
        turnId: turn_id,
        stage: tournament.currentStage,
        period: tournament.currentPeriod,
        pricePerToken: price_per_token,
        bidType: 'bid',
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[human-bid error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
