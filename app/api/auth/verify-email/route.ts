import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/auth/verify-email?token=<human.id>&email=<email>
 *
 * Confirms email, generates real API key, redirects to /onboarding/verified.
 * The verification link is sent by sendVerificationEmail() in lib/email.ts.
 * In dev the link is printed to console — no Resend key needed.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  if (!token || !email) {
    return NextResponse.json({ error: 'Missing token or email' }, { status: 400 })
  }

  try {
    const decodedEmail = decodeURIComponent(email)

    // Find the pending bot by email
    const bot = await prisma.bot.findFirst({ where: { email: decodedEmail } })

    if (!bot) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Verify the token matches (apiKey = 'PENDING:<human.id>')
    if (bot.apiKey !== `PENDING:${token}`) {
      return NextResponse.json({ error: 'Invalid or expired verification link' }, { status: 400 })
    }

    // Issue real API key
    const apiKey = randomBytes(32).toString('hex')

    await prisma.bot.update({
      where: { id: bot.id },
      data: { apiKey },
    })

    // Redirect to verified page — shows the API key to the user once
    const redirectUrl = new URL('/onboarding/verified', req.url)
    redirectUrl.searchParams.set('bot', bot.name)
    redirectUrl.searchParams.set('api_key', apiKey)

    return NextResponse.redirect(redirectUrl.toString())
  } catch (err) {
    console.error('[verify-email error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
