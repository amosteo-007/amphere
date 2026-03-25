import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * POST /api/lobby/{code}/join
 * Join a lobby by its 5-character code.
 */
export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const apiKey = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!apiKey) return NextResponse.json({ error: 'Authorization required' }, { status: 401 })

    const bot = await prisma.bot.findUnique({ where: { apiKey } })
    if (!bot) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

    const lobby = await prisma.lobby.findUnique({ where: { code: params.code } })

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

    // Increment filled slots
    const updatedLobby = await prisma.lobby.update({
      where: { id: lobby.id },
      data: { filledSlots: { increment: 1 } },
    })

    // If lobby is now full, create the tournament
    let tournamentId: string | null = null
    if (updatedLobby.filledSlots >= updatedLobby.agentSlots) {
      const tournament = await createTournament(lobby, updatedLobby)
      tournamentId = tournament.id
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
      message: tournamentId ? 'Lobby full — tournament started!' : undefined,
    })
  } catch (err) {
    console.error('[lobby/join error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function createTournament(lobby: any, updatedLobby: any) {
  // Create tournament
  const tournament = await prisma.tournament.create({
    data: {
      status: 'pending',
      startedAt: new Date(),
    },
  })

  // Create stage records
  for (let s = 0; s < 3; s++) {
    await prisma.stage.create({
      data: {
        tournamentId: tournament.id,
        stageNumber: s,
        floorPrice: s === 0 ? 10 : s === 1 ? 15 : 28,
        tokensPerPeriod: s === 0 ? 120 : s === 1 ? 80 : 40,
        multiplier: s === 0 ? 1.0 : s === 1 ? 1.5 : 3.0,
      },
    })
  }

  // Get the bots that joined (we need to track them)
  // For now, just create the tournament — bot assignment happens via BotTournament

  return tournament
}
