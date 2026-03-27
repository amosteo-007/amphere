import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { STAGE_CONFIGS } from '@/lib/auction-engine'
import { startTournament } from '@/lib/tournament-runner'
import { emitTournamentCreated } from '@/lib/socket-server'

export const runtime = 'nodejs'

/**
 * POST /api/play
 * Create a solo tournament (bot vs opponents).
 * Body: {
 *   championId?: string,        // champion to use (defaults to user's first champion)
 *   opponents?: [{
 *     type: 'llm' | 'algo' | 'human',
 *     provider?: string,        // 'anthropic' | 'openai' | 'groq' (for LLM)
 *     model?: string,          // e.g. 'claude-sonnet-4-20250514' (for LLM)
 *   }]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!apiKey) return NextResponse.json({ error: 'Authorization required' }, { status: 401 })

    const bot = await prisma.bot.findUnique({ where: { apiKey } })
    if (!bot) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    let { championId, opponents = [], num_opponents } = body

    // Shorthand: num_opponents=3 creates 3 algo opponents
    if ((!opponents || opponents.length === 0) && num_opponents && num_opponents > 0) {
      opponents = Array.from({ length: Math.min(num_opponents, 9) }, () => ({ type: 'algo' }))
    }

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

    // Build opponent configs with defaults
    const numOpponents = Math.max(1, opponents.length)
    const slotNames = ['human_1', 'openai_3', 'groq_1', 'mistral_2', 'anthropic_4'].slice(0, 1 + numOpponents)

    // Player in human_1 slot
    await prisma.botTournament.create({
      data: {
        botId: bot.id,
        tournamentId: tournament.id,
        botSlot: 'human_1',
        budgetRemaining: 10_000,
        tokensPerStage: '[0,0,0]',
      },
    })

    // Opponent bots
    for (let i = 0; i < numOpponents; i++) {
      const opp = opponents[i] || { type: 'algo' }
      const slotName = slotNames[i + 1] ?? `player_${i + 2}`

      const shortId = tournament.id.slice(0, 6)

      if (opp.type === 'llm' && opp.provider && opp.model) {
        // LLM opponent: encode provider+model in apiKey for tournament-runner to detect
        // Format: algo-<provider>-<model>-<tournamentId>
        const llmApiKey = `algo-${opp.provider}-${opp.model}-${tournament.id}`
        const llmBot = await prisma.bot.upsert({
          where: { apiKey: llmApiKey },
          update: {},
          create: {
            name: `${opp.provider.toUpperCase()}_${opp.model.split('-')[0]}_${shortId}`,
            apiKey: llmApiKey,
            subscriptionTier: 'algo',
          },
        })

        await prisma.botTournament.create({
          data: {
            botId: llmBot.id,
            tournamentId: tournament.id,
            botSlot: slotName,
            budgetRemaining: 10_000,
            tokensPerStage: '[0,0,0]',
          },
        })
      } else if (opp.type === 'human') {
        // Placeholder for human opponent (future: real human matchmaking)
        const humanBot = await prisma.bot.upsert({
          where: { apiKey: `human-${tournament.id}-${i}` },
          update: {},
          create: {
            name: `Human_${shortId}_${i + 2}`,
            apiKey: `human-${tournament.id}-${i}`,
            subscriptionTier: 'free',
          },
        })

        await prisma.botTournament.create({
          data: {
            botId: humanBot.id,
            tournamentId: tournament.id,
            botSlot: slotName,
            budgetRemaining: 10_000,
            tokensPerStage: '[0,0,0]',
          },
        })
      } else {
        // Algo opponent (simple random)
        const algoBot = await prisma.bot.upsert({
          where: { apiKey: `algo-algo-${tournament.id}-${i}` },
          update: {},
          create: {
            name: `ALGO_${shortId}_${i + 2}`,
            apiKey: `algo-algo-${tournament.id}-${i}`,
            subscriptionTier: 'algo',
          },
        })

        await prisma.botTournament.create({
          data: {
            botId: algoBot.id,
            tournamentId: tournament.id,
            botSlot: slotName,
            budgetRemaining: 10_000,
            tokensPerStage: '[0,0,0]',
          },
        })
      }
    }

    // Start the tournament runner (non-blocking — loop runs in background)
    startTournament(tournament.id)
    // Notify all connected clients that a tournament has started
    emitTournamentCreated(tournament.id)

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
