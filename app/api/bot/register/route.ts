import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { randomBytes } from 'crypto'

export const runtime = 'nodejs'

/**
 * POST /api/bot/register
 * Body: { code: string, name: string, email?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { code, name, email } = body

    if (!code || !name) {
      return NextResponse.json(
        { error: 'code and name are required' },
        { status: 400 }
      )
    }

    // Validate invite code
    const invite = await prisma.inviteCode.findUnique({ where: { code } })
    if (!invite) {
      return NextResponse.json(
        { error: 'Invalid invite code' },
        { status: 401 }
      )
    }
    if (invite.status === 'used') {
      return NextResponse.json(
        { error: 'Invite code already used' },
        { status: 401 }
      )
    }
    if (invite.status === 'expired' || invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Invite code expired' },
        { status: 401 }
      )
    }

    // Generate API key
    const apiKey = randomBytes(32).toString('hex')

    // Create or update bot
    let bot = await prisma.bot.findFirst({
      where: { name, email: email ?? null },
    })

    let created = false
    if (bot) {
      // Re-register existing bot with new code
      bot = await prisma.bot.update({
        where: { id: bot.id },
        data: {
          apiKey,
          subscriptionTier: 'free',
        },
      })
    } else {
      bot = await prisma.bot.create({
        data: {
          name,
          apiKey,
          email: email ?? null,
          subscriptionTier: 'free',
        },
      })
      created = true
    }

    // Mark invite code as used
    await prisma.inviteCode.update({
      where: { id: invite.id },
      data: { status: 'used', usedByBotId: bot.id },
    })

    return NextResponse.json({
      ok: true,
      bot: {
        id: bot.id,
        name: bot.name,
        api_key: bot.apiKey,
        subscription_tier: bot.subscriptionTier,
        moltbook_handle: bot.moltbookHandle,
      },
      created,
    })
  } catch (err) {
    console.error('[register error]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
