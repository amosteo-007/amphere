import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { session_token, bot }
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'email and password required' }, { status: 400 })
    }

    // Authenticate via Supabase
    const { data: authUser, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authUser.user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Fetch bot profile
    const { data: bot } = await supabaseAdmin
      .from('bots')
      .select('*')
      .eq('id', authUser.user.id)
      .single()

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found for this user' }, { status: 404 })
    }

    // Generate session token
    const sessionToken = createSessionToken(authUser.user.id)

    return NextResponse.json({
      ok: true,
      bot: {
        id: bot.id,
        name: bot.name,
        api_key: bot.api_key,
        subscription_tier: bot.subscription_tier,
        moltbook_handle: bot.moltbook_handle,
      },
      session_token: sessionToken,
      // Include access token from Supabase for client-side auth
      access_token: authUser.session?.access_token,
      refresh_token: authUser.session?.refresh_token,
    })
  } catch (err) {
    console.error('[login error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function createSessionToken(userId: string): string {
  const payload = {
    uid: userId,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}
