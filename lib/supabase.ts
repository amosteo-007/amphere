/**
 * Supabase Auth Helper
 *
 * Handles: email/password signup, session management, JWT verification.
 * All server-side auth uses the SERVICE_ROLE key (never exposed to client).
 */

import type { NextRequest } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Server-side client (service role — bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Client-side client (anon key — respects RLS)
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Create a new user account + bot record.
 * Called from /api/bot/register after email verification.
 */
export async function createUserWithBot(email: string, password: string, botName: string) {
  // 1. Create Supabase auth user
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm in dev; use email confirm in prod
    user_metadata: { bot_name: botName },
  })

  if (authError) throw authError

  // 2. Create bot record in public.bots
  const { data: bot, error: botError } = await supabaseAdmin
    .from('bots')
    .insert({
      id: authUser.user.id,          // sync with auth.users.id
      name: botName,
      email,
      subscription_tier: 'free',
    })
    .select()
    .single()

  if (botError) throw botError

  return { authUser, bot }
}

/**
 * Verify JWT and return the authenticated bot (or null).
 */
export async function getBotFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')

  if (!token) return null

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null

  // Fetch bot profile
  const { data: bot } = await supabaseAdmin
    .from('bots')
    .select('*')
    .eq('id', user.id)
    .single()

  return bot ?? null
}
