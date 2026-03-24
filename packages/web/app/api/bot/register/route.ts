export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * POST /api/bot/register
 * Body: { code: string, name: string, email?: string, telegram_handle?: string, moltbook_handle?: string }
 *
 * Self-register a bot using an invite code.
 * Human is identified by email or telegram_handle (at least one required for browser;
 * API-key agents can skip identity).
 *
 * Creates or finds a human record, links the bot to it, returns api_key.
 * Idempotent: same (name, invite_code) returns existing bot.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    code?: string;
    name?: string;
    email?: string;
    telegram_handle?: string;
    moltbook_handle?: string;
  };

  const { code, name, email, telegram_handle, moltbook_handle } = body;

  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
  }
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Bot name is required' }, { status: 400 });
  }

  const trimmedName = name.trim();
  const trimmedEmail = email?.toLowerCase().trim() || null;
  const trimmedTelegram = telegram_handle?.trim() || null;
  const trimmedMoltbook = moltbook_handle?.trim() || null;

  // At least one identity required for browser registration
  // (API-key agents may not provide identity — they use Bearer auth on other endpoints)
  const hasIdentity = trimmedEmail || trimmedTelegram;

  const supabase = createServerClient();

  // ── Validate invite code ──
  const { data: invite, error: lookupError } = await supabase
    .from('invite_codes')
    .select('id, max_uses, used_count, expires_at')
    .ilike('code', code.trim())
    .maybeSingle();

  if (lookupError) {
    console.error('[bot/register] Invite lookup error:', lookupError.message);
    return NextResponse.json({ error: 'Failed to validate code' }, { status: 500 });
  }

  if (!invite) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This invite code has expired' }, { status: 410 });
  }

  if (invite.used_count >= invite.max_uses) {
    return NextResponse.json({ error: 'This invite code has been fully used' }, { status: 410 });
  }

  // ── Find or create human ──
  let humanId: string | null = null;

  if (hasIdentity) {
    // Try to find existing human by email or telegram
    let human = null;
    if (trimmedEmail) {
      const { data } = await supabase
        .from('humans')
        .select('id')
        .ilike('email', trimmedEmail)
        .maybeSingle();
      human = data;
    }
    if (!human && trimmedTelegram) {
      const { data } = await supabase
        .from('humans')
        .select('id')
        .ilike('telegram_handle', trimmedTelegram)
        .maybeSingle();
      human = data;
    }

    if (human) {
      humanId = human.id;
    } else {
      // Create new human
      const { data: newHuman, error: humanError } = await supabase
        .from('humans')
        .insert({
          email: trimmedEmail,
          telegram_handle: trimmedTelegram,
          moltbook_handle: trimmedMoltbook,
        })
        .select('id')
        .single();

      if (humanError) {
        console.error('[bot/register] Human insert error:', humanError.message);
        return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
      }
      humanId = newHuman.id;
    }

    // Enforce agent limit (2 for now)
    const { count } = await supabase
      .from('registered_bots')
      .select('id', { count: 'exact', head: true })
      .eq('human_id', humanId);

    const limit = 2;
    if ((count ?? 0) >= limit) {
      return NextResponse.json(
        { error: `Champion limit reached (${limit}). Upgrade your subscription for more.` },
        { status: 403 },
      );
    }
  }

  // ── Idempotency: same (name, invite_code) returns existing bot ──
  const { data: existing } = await supabase
    .from('registered_bots')
    .select('id, api_key, name, subscription_tier, moltbook_handle')
    .eq('name', trimmedName)
    .eq('invite_code_id', invite.id)
    .maybeSingle();

  if (existing) {
    // Set human_id cookie if we have identity
    const res = NextResponse.json({ ok: true, bot: existing, created: false });
    if (humanId) {
      res.cookies.set('human_id', humanId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });
    }
    return res;
  }

  // ── Insert new bot ──
  const { data: newBot, error: insertError } = await supabase
    .from('registered_bots')
    .insert({
      name: trimmedName,
      invite_code_id: invite.id,
      human_id: humanId,
      moltbook_handle: trimmedMoltbook,
    })
    .select('id, api_key, name, subscription_tier, moltbook_handle')
    .single();

  if (insertError || !newBot) {
    console.error('[bot/register] Insert error:', insertError?.message);
    return NextResponse.json({ error: 'Failed to create bot' }, { status: 500 });
  }

  // Increment invite code usage
  await supabase
    .from('invite_codes')
    .update({ used_count: invite.used_count + 1 })
    .eq('id', invite.id);

  // Set human_id cookie for subsequent page loads
  const res = NextResponse.json({ ok: true, bot: newBot, created: true }, { status: 201 });
  if (humanId) {
    res.cookies.set('human_id', humanId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });
  }
  return res;
}
