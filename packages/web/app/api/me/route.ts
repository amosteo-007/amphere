export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServerClient as createSupabase } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// GET /api/me — returns authenticated user + subscription tier + registered bots
export async function GET() {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
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

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabase();

  const [subResult, botsResult, waitlistResult, redemptionResult] = await Promise.all([
    supabase
      .from('user_subscriptions')
      .select('tier, current_period_end, stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('registered_bots')
      .select('id, name, api_key, wake_url, subscription_tier, moltbook_handle, created_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('waitlist')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('user_invite_redemptions')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const tier = subResult.data?.tier ?? 'free';
  const botLimit = tier === 'free' ? 2 : 5;

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    tier,
    subscription: subResult.data ?? null,
    bots: botsResult.data ?? [],
    waitlist_status: waitlistResult.data?.status ?? null,
    has_redeemed_invite: !!redemptionResult.data,
    bot_limit: botLimit,
  });
}
