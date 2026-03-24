export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * POST /api/bot/auth
 * Body: { api_key: string }
 *
 * Validates the api_key against registered_bots. Returns the bot profile.
 * The api_key itself is used as a bearer token in subsequent requests —
 * include it as `Authorization: Bearer <api_key>` on all /api/bot/* calls.
 */
export async function POST(req: NextRequest) {
  const { api_key } = await req.json() as { api_key?: string };

  if (!api_key || typeof api_key !== 'string') {
    return NextResponse.json({ error: 'api_key required' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: bot, error } = await supabase
    .from('registered_bots')
    .select('id, name, subscription_tier, wake_url')
    .eq('api_key', api_key)
    .maybeSingle();

  if (error || !bot) {
    return NextResponse.json({ error: 'Invalid api_key' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    bot: {
      id: bot.id,
      name: bot.name,
      subscription_tier: bot.subscription_tier,
      wake_url: bot.wake_url,
    },
  });
}
