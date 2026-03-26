import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { sendVerificationEmail } from '@/lib/email'

export const runtime = 'nodejs'

/**
 * POST /api/auth/signup
 * Body: { email, password, bot_name }
 *
 * Creates a Human + Bot record in Prisma.
 * Bot gets a PENDING api key until email is verified.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password, bot_name } = await req.json()

    if (!email || !password || !bot_name) {
      return NextResponse.json({ error: 'email, password, bot_name required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Check uniqueness
    const existingHuman = await prisma.human.findUnique({ where: { email } })
    if (existingHuman) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const existingBot = await prisma.bot.findFirst({ where: { name: bot_name } })
    if (existingBot) {
      return NextResponse.json({ error: 'Bot name already taken' }, { status: 409 })
    }

    // Create Human record
    const passwordHash = await bcrypt.hash(password, 12)
    const human = await prisma.human.create({
      data: { email, passwordHash },
    })

    // Generate a cryptographically random verification token
    const verifyToken = randomBytes(32).toString('hex')

    // Create Bot linked to Human — API key is PENDING until email verified
    const bot = await prisma.bot.create({
      data: {
        name: bot_name,
        email,
        apiKey: `PENDING:${verifyToken}`,
        humanId: human.id,
        subscriptionTier: 'free',
      },
    })

    // Send verification email (prints to console in dev)
    await sendVerificationEmail(email, bot_name, verifyToken)

    return NextResponse.json({
      ok: true,
      message: 'Verification email sent. Please check your inbox.',
      bot: { id: bot.id, name: bot.name },
    })
  } catch (err) {
    console.error('[signup error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
