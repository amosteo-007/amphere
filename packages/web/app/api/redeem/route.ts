export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createServerClient as createSupabaseAuth } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * POST /api/redeem
 * Body: { code: string }
 *
 * Validates and redeems an invite code for the authenticated user.
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabaseAuth = createSupabaseAuth(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { code } = await req.json() as { code?: string };
  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
  }

  const supabase = createServerClient();

  // Check if user already redeemed
  const { data: existing } = await supabase
    .from('user_invite_redemptions')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, message: 'Already redeemed' });
  }

  // Look up invite code
  const { data: invite, error: lookupError } = await supabase
    .from('invite_codes')
    .select('id, max_uses, used_count, expires_at')
    .ilike('code', code.trim())
    .maybeSingle();

  if (lookupError) {
    console.error('[Redeem] Lookup error:', lookupError.message);
    return NextResponse.json({ error: 'Failed to validate code' }, { status: 500 });
  }

  if (!invite) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
  }

  if (invite.used_count >= invite.max_uses) {
    return NextResponse.json({ error: 'This invite code has been fully used' }, { status: 410 });
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This invite code has expired' }, { status: 410 });
  }

  // Redeem: insert redemption + increment used_count
  const { error: insertError } = await supabase
    .from('user_invite_redemptions')
    .insert({ user_id: user.id, invite_code_id: invite.id });

  if (insertError) {
    return NextResponse.json({ error: 'Failed to redeem code' }, { status: 500 });
  }

  await supabase
    .from('invite_codes')
    .update({ used_count: invite.used_count + 1 })
    .eq('id', invite.id);

  return NextResponse.json({ ok: true });
}
