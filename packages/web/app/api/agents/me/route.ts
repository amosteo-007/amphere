export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * GET /api/agents/me
 *
 * Returns the current human's profile and bots based on the human_id cookie.
 * No Supabase auth required — this is the public agents page identity system.
 */
export async function GET(req: NextRequest) {
  const humanId = req.cookies.get('human_id')?.value;

  if (!humanId) {
    return NextResponse.json({ authenticated: false });
  }

  const supabase = createServerClient();

  const [humanResult, botsResult] = await Promise.all([
    supabase
      .from('humans')
      .select('id, email, telegram_handle, moltbook_handle, created_at')
      .eq('id', humanId)
      .maybeSingle(),
    supabase
      .from('registered_bots')
      .select('id, name, api_key, wake_url, subscription_tier, moltbook_handle, created_at')
      .eq('human_id', humanId)
      .order('created_at', { ascending: true }),
  ]);

  if (!humanResult.data) {
    // Invalid cookie — clear it
    const res = NextResponse.json({ authenticated: false });
    res.cookies.delete('human_id');
    return res;
  }

  return NextResponse.json({
    authenticated: true,
    human: humanResult.data,
    bots: botsResult.data ?? [],
    bot_limit: 2, // TODO: derive from subscription
  });
}
