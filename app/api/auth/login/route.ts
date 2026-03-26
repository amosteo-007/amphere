import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { session_token, bot: { id, name, api_key, email, subscription_tier } }
 *
 * session_token is base64url({ uid: bot.id, exp }) — decoded by champions
 * and dashboard APIs. The bot.api_key is used for tournament endpoints.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'email and password required' }, { status: 400 })
    }

    // Find Human by email
    const human = await prisma.human.findUnique({ where: { email } })
    if (!human) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Verify password
    const valid = await bcrypt.compare(password, human.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Find the Bot linked to this Human
    const bot = await prisma.bot.findFirst({ where: { humanId: human.id } })
    if (!bot) {
      return NextResponse.json({ error: 'Account not fully set up — contact support' }, { status: 404 })
    }

    // Block login until email is verified
    if (bot.apiKey.startsWith('PENDING:')) {
      return NextResponse.json({ error: 'Email not verified. Check your inbox.' }, { status: 403 })
    }

    const sessionToken = createSessionToken(bot.id)

    return NextResponse.json({
      ok: true,
      session_token: sessionToken,
      bot: {
        id: bot.id,
        name: bot.name,
        email: bot.email,
        api_key: bot.apiKey,
        subscription_tier: bot.subscriptionTier,
      },
    })
  } catch (err) {
    console.error('[login error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function createSessionToken(botId: string): string {
  const payload = {
    uid: botId,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}
