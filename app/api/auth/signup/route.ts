import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

/**
 * POST /api/auth/signup
 * Body: { email, password, bot_name }
 *
 * Creates a Supabase Auth user + bot profile.
 * Bot gets an auto-generated API key for tournament play.
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

    // Check bot_name uniqueness
    const { data: existing } = await supabaseAdmin
      .from('bots')
      .select('id')
      .eq('name', bot_name)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Bot name already taken' }, { status: 409 })
    }

    // Create auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { bot_name },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Generate API key for this bot
    const apiKey = generateApiKey()

    // Create bot profile
    const { data: bot, error: botError } = await supabaseAdmin
      .from('bots')
      .insert({
        id: authUser.user.id, // sync with Supabase Auth UID
        name: bot_name,
        email,
        api_key: apiKey,
        subscription_tier: 'free',
      })
      .select()
      .single()

    if (botError) {
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json({ error: botError.message }, { status: 500 })
    }

    // Create session token (DevAuth for simplicity)
    const sessionToken = createSessionToken(authUser.user.id)

    return NextResponse.json({
      ok: true,
      bot: {
        id: bot.id,
        name: bot.name,
        api_key: bot.api_key,
        subscription_tier: bot.subscription_tier,
      },
      session_token: sessionToken,
    })
  } catch (err: any) {
    console.error('[signup error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateApiKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let key = ''
  for (let i = 0; i < 32; i++) {
    key += chars[Math.floor(Math.random() * chars.length)]
  }
  return key
}

function createSessionToken(userId: string): string {
  // Simple dev session token — in production use Supabase sessions
  const payload = { uid: userId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}
