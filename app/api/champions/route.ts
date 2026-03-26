import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { randomBytes } from 'crypto'

export const runtime = 'nodejs'

/**
 * GET /api/champions — List champions for the authenticated human
 * Header: Authorization: Bearer <session_token>
 *
 * POST /api/champions — Create a new champion
 * Header: Authorization: Bearer <session_token>
 * Body: { name: string }
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
  }

  try {
    // Decode session token to get bot ID
    const payload = JSON.parse(Buffer.from(token, 'base64url').toString())
    const botId = payload.uid

    if (!botId || payload.exp < Date.now()) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // Get human's champions via their bot
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      include: { human: { include: { champions: true } } },
    })

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    const champions = bot.human?.champions ?? []

    return NextResponse.json({
      ok: true,
      champions: champions.map(c => ({
        id: c.id,
        name: c.name,
        api_key: c.apiKey,
        created_at: c.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    console.error('[champions GET error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
  }

  try {
    // Decode session token to get bot ID
    const payload = JSON.parse(Buffer.from(token, 'base64url').toString())
    const botId = payload.uid

    if (!botId || payload.exp < Date.now()) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const { name } = await req.json()

    if (!name || name.length < 2 || name.length > 48) {
      return NextResponse.json({ error: 'Champion name must be 2-48 characters' }, { status: 400 })
    }

    // Get the human's bot
    const bot = await prisma.bot.findUnique({ where: { id: botId } })
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    // Check name uniqueness
    const existing = await prisma.champion.findUnique({ where: { name } })
    if (existing) {
      return NextResponse.json({ error: 'Champion name already taken' }, { status: 409 })
    }

    // Generate champion API key
    const apiKey = randomBytes(32).toString('hex')

    // Create champion linked to this bot
    const champion = await prisma.champion.create({
      data: {
        name,
        apiKey,
        humanId: bot.humanId ?? undefined,
        botId: bot.id,
      },
    })

    return NextResponse.json({
      ok: true,
      champion: {
        id: champion.id,
        name: champion.name,
        api_key: champion.apiKey,
        created_at: champion.createdAt.toISOString(),
      },
    }, { status: 201 })
  } catch (err) {
    console.error('[champions POST error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
