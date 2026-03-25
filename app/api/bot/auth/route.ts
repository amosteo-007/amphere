import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * POST /api/bot/auth
 * Body: { api_key: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { api_key } = await req.json()

    if (!api_key) {
      return NextResponse.json({ error: 'api_key required' }, { status: 400 })
    }

    const bot = await prisma.bot.findUnique({ where: { apiKey: api_key } })

    if (!bot) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    return NextResponse.json({
      ok: true,
      bot: {
        id: bot.id,
        name: bot.name,
        subscription_tier: bot.subscriptionTier,
        wake_url: bot.wakeUrl,
      },
    })
  } catch (err) {
    console.error('[auth error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
