import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { randomBytes } from 'crypto'

export const runtime = 'nodejs'

/**
 * POST /api/lobby/create
 * Body: { agent_slots: number, opponents: [{provider: string}] }
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!apiKey) return NextResponse.json({ error: 'Authorization required' }, { status: 401 })

    const bot = await prisma.bot.findUnique({ where: { apiKey } })
    if (!bot) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

    const { agent_slots, opponents } = await req.json()

    if (!agent_slots || agent_slots < 2) {
      return NextResponse.json({ error: 'agent_slots must be >= 2' }, { status: 400 })
    }

    // Generate 5-character lobby code
    const code = randomBytes(3).toString('base64url').slice(0, 5).toUpperCase()

    const lobby = await prisma.lobby.create({
      data: {
        code,
        agentSlots: agent_slots,
        filledSlots: 1, // creator occupies 1 slot
        opponents: JSON.stringify(opponents ?? []),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
      },
    })

    // Create bot-tournament record as placeholder (will be updated when tournament starts)
    // Actually, we don't create the tournament yet — just the lobby

    return NextResponse.json({
      ok: true,
      lobby: {
        id: lobby.id,
        code: lobby.code,
        slots: {
          total: lobby.agentSlots,
          filled: lobby.filledSlots,
          remaining: lobby.agentSlots - lobby.filledSlots,
        },
        expires_at: lobby.expiresAt.toISOString(),
      },
    })
  } catch (err) {
    console.error('[lobby/create error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
