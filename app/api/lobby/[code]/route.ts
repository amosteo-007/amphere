import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { STAGE_CONFIGS } from '@/lib/auction-engine'
import { startTournament } from '@/lib/tournament-runner'
import { emitTournamentCreated } from '@/lib/socket-server'

export const runtime = 'nodejs'

/**
 * POST /api/lobby/{code}
 * Join a lobby by its 5-character code.
 * When lobby fills, creates tournament with all joined bots and starts it.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    const apiKey = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!apiKey) return NextResponse.json({ error: 'Authorization required' }, { status: 401 })

    const bot = await prisma.bot.findUnique({ where: { apiKey } })
    if (!bot) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

    const lobby = await prisma.lobby.findUnique({ where: { code } })

    if (!lobby) {
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 })
    }

    if (lobby.status !== 'waiting') {
      return NextResponse.json({ error: 'Lobby is no longer accepting players' }, { status: 410 })
    }

    if (lobby.filledSlots >= lobby.agentSlots) {
      return NextResponse.json({ error: 'Lobby is full' }, { status: 410 })
    }

    if (lobby.expiresAt < new Date()) {
      await prisma.lobby.update({ where: { id: lobby.id }, data: { status: 'expired' } })
      return NextResponse.json({ error: 'Lobby expired' }, { status: 410 })
    }

    // Check if bot already joined
    const joinedBotIds = JSON.parse(lobby.joinedBotIds) as string[]
    if (joinedBotIds.includes(bot.id)) {
      return NextResponse.json({ error: 'You already joined this lobby' }, { status: 409 })
    }

    // Add bot and increment filled slots
    joinedBotIds.push(bot.id)
    const updatedLobby = await prisma.lobby.update({
      where: { id: lobby.id },
      data: {
        filledSlots: { increment: 1 },
        joinedBotIds: JSON.stringify(joinedBotIds),
      },
    })

    // If lobby is now full, create and start the tournament
    let tournamentId: string | null = null
    if (updatedLobby.filledSlots >= updatedLobby.agentSlots) {
      tournamentId = await createAndStartTournament(updatedLobby, joinedBotIds)
      await prisma.lobby.update({
        where: { id: lobby.id },
        data: { status: 'started', tournamentId },
      })
    }

    return NextResponse.json({
      ok: true,
      slot: updatedLobby.filledSlots,
      slots: {
        total: updatedLobby.agentSlots,
        filled: updatedLobby.filledSlots,
        remaining: updatedLobby.agentSlots - updatedLobby.filledSlots,
      },
      tournament_id: tournamentId ?? undefined,
      message: tournamentId ? 'Lobby full — tournament started!' : `Waiting for ${updatedLobby.agentSlots - updatedLobby.filledSlots} more player(s)...`,
    })
  } catch (err) {
    console.error('[lobby/join error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/lobby/{code}
 * Check lobby status (for polling).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    const lobby = await prisma.lobby.findUnique({ where: { code } })

    if (!lobby) {
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 })
    }

    return NextResponse.json({
      lobby: {
        id: lobby.id,
        code: lobby.code,
        status: lobby.status,
        slots: {
          total: lobby.agentSlots,
          filled: lobby.filledSlots,
          remaining: lobby.agentSlots - lobby.filledSlots,
        },
        tournament_id: lobby.tournamentId ?? undefined,
        expires_at: lobby.expiresAt.toISOString(),
      },
    })
  } catch (err) {
    console.error('[lobby/status error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function createAndStartTournament(lobby: { id: string; code: string; opponents: string }, botIds: string[]): Promise<string> {
  console.log(`[lobby] Creating tournament for lobby ${lobby.code} with ${botIds.length} humans`)

  // Create tournament
  const tournament = await prisma.tournament.create({
    data: {
      lobbyCode: lobby.code,
      status: 'running',
      startedAt: new Date(),
    },
  })

  console.log(`[lobby] Tournament ${tournament.id} created`)

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

  // Create BotTournament records for each joined bot
  for (let i = 0; i < botIds.length; i++) {
    const slotName = `player_${i + 1}`
    await prisma.botTournament.create({
      data: {
        botId: botIds[i],
        tournamentId: tournament.id,
        botSlot: slotName,
        budgetRemaining: 10_000,
        tokensPerStage: '[0,0,0]',
      },
    })
    console.log(`[lobby] Added human ${slotName} (${botIds[i]})`)
  }

  // Add algo opponents if configured
  const opponents = JSON.parse(lobby.opponents) as { provider?: string; model?: string }[]
  console.log(`[lobby] Adding ${opponents.length} algo/LLM opponents`)

  for (let i = 0; i < opponents.length; i++) {
    const opp = opponents[i]
    const provider = opp.provider ?? 'algo'
    const model = opp.model ?? 'algo'
    const algoApiKey = `algo-${provider}-${model}-${tournament.id}-${i}`
    const shortId = tournament.id.slice(0, 6)
    const algoBot = await prisma.bot.upsert({
      where: { apiKey: algoApiKey },
      update: {},
      create: {
        name: `${provider.toUpperCase()}_${i + 1}_${shortId}`,
        apiKey: algoApiKey,
        subscriptionTier: 'algo',
      },
    })
    await prisma.botTournament.create({
      data: {
        botId: algoBot.id,
        tournamentId: tournament.id,
        botSlot: `algo_${i + 1}`,
        budgetRemaining: 10_000,
        tokensPerStage: '[0,0,0]',
      },
    })
    console.log(`[lobby] Added algo opponent algo_${i + 1} (${algoBot.id})`)
  }

  // Start the tournament runner
  console.log(`[lobby] Starting tournament runner for ${tournament.id}`)
  startTournament(tournament.id)
  emitTournamentCreated(tournament.id)

  return tournament.id
}
