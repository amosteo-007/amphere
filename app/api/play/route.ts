import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { STAGE_CONFIGS } from '@/lib/auction-engine'

export const runtime = 'nodejs'

/**
 * POST /api/play
 * Create a solo tournament (bot vs algo opponents).
 * Body: { opponents: [{provider: string}] }
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!apiKey) return NextResponse.json({ error: 'Authorization required' }, { status: 401 })

    const bot = await prisma.bot.findUnique({ where: { apiKey } })
    if (!bot) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

    const { opponents } = await req.json().catch(() => ({ opponents: [] }))

    // Create tournament
    const tournament = await prisma.tournament.create({
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    })

    // Create stages
    for (const cfg of STAGE_CONFIGS) {
      await prisma.stage.create({
        data: {
          tournamentId: tournament.id,
          stageNumber: cfg.stageNumber,
          floorPrice: cfg.floorPrice,
          tokensPerPeriod: cfg.tokensPerPeriod,
          multiplier: cfg.multiplier,
        },
      })
    }

    // Assign bot + algo opponents to slots
    const slotNames = ['human_1', 'openai_3', 'groq_1', 'mistral_2', 'anthropic_4'].slice(0, 1 + (opponents?.length ?? 4))

    const algoProviders = opponents?.map((o: any) => o.provider) ?? ['algo', 'algo', 'algo', 'algo']

    // Bot in human_1 slot
    await prisma.botTournament.create({
      data: {
        botId: bot.id,
        tournamentId: tournament.id,
        botSlot: 'human_1',
        budgetRemaining: 10_000,
        tokensPerStage: '[0,0,0]',
      },
    })

    // Algo bots
    for (let i = 0; i < Math.min(algoProviders.length, 4); i++) {
      // Create a placeholder algo bot (not persisted as a real Bot)
      // We store algo bots directly in BotTournament with a special flag
      // For now: create a stub bot record
      const algoBot = await prisma.bot.upsert({
        where: { apiKey: `algo-${algoProviders[i]}-${tournament.id}` },
        update: {},
        create: {
          name: `${algoProviders[i].toUpperCase()}_${i + 2}`,
          apiKey: `algo-${algoProviders[i]}-${tournament.id}`,
          subscriptionTier: 'algo',
        },
      })

      await prisma.botTournament.create({
        data: {
          botId: algoBot.id,
          tournamentId: tournament.id,
          botSlot: slotNames[i + 1],
          budgetRemaining: 10_000,
          tokensPerStage: '[0,0,0]',
        },
      })
    }

    return NextResponse.json({
      ok: true,
      tournament_id: tournament.id,
      message: 'Tournament started!',
    })
  } catch (err) {
    console.error('[play error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
