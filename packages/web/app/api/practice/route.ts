export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createServerClient as createSupabaseAuth } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * POST /api/practice
 *
 * Spin up a 5-period practice tournament for the authenticated user's bot
 * vs 3 LLM bots. Standard+ tier required.
 *
 * Body: { registered_bot_id: string, persona?: string }
 *
 * Creates a condensed tournament (1 stage, 5 periods) in Supabase and
 * returns the tournament id. The pollWorker picks it up automatically.
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

  const supabase = createServerClient();

  // Check tier — Standard ($9.90) or Plus ($39) required for practice
  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('tier')
    .eq('user_id', user.id)
    .maybeSingle();

  const tier = sub?.tier ?? 'free';
  if (tier === 'free') {
    return NextResponse.json(
      { error: 'Practice mode requires Standard or Plus subscription' },
      { status: 403 },
    );
  }

  const { registered_bot_id, persona = 'momentum' } = await req.json() as {
    registered_bot_id?: string;
    persona?: string;
  };

  if (!registered_bot_id) {
    return NextResponse.json({ error: 'registered_bot_id required' }, { status: 400 });
  }

  // Verify bot ownership
  const { data: bot } = await supabase
    .from('registered_bots')
    .select('id, api_key, name')
    .eq('id', registered_bot_id)
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }

  // Build a condensed practice config (1 stage, 5 periods)
  const config = {
    name: 'Practice Round',
    budget_per_bot: 10000,
    stages: [
      {
        base_token_supply: 500,
        floor_price: 1,
        points_per_token: 1,
        num_periods: 5,
        period_duration_seconds: 30,
        max_bids_per_period: 1,
        clearing_strategy: 'vickrey',
      },
    ],
    sp_awards: [3, 2, 1, 0],
    bonus_sp: 1,
    rescind_reveal_delay: 2,
  };

  const agents = [
    // External bot (player)
    {
      bot_id: `player_${bot.id.slice(0, 8)}`,
      provider: 'external',
      model: 'external',
      persona_name: 'player',
      persona_prompt: '',
      registered_bot_id: bot.id,
    },
    // LLM opponents
    { bot_id: 'llm_1', provider: 'anthropic', model: 'claude-haiku-4-5-20251001', persona_name: 'momentum', persona_prompt: '' },
    { bot_id: 'llm_2', provider: 'anthropic', model: 'claude-haiku-4-5-20251001', persona_name: 'value', persona_prompt: '' },
    { bot_id: 'llm_3', provider: 'anthropic', model: 'claude-haiku-4-5-20251001', persona_name: 'market_maker', persona_prompt: '' },
  ];

  const { data: tournament, error } = await supabase
    .from('tournaments')
    .insert({ status: 'pending', auction_type: 'cascade-vickrey', is_test: false, config, agents })
    .select('id')
    .single();

  if (error || !tournament) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create tournament' }, { status: 500 });
  }

  return NextResponse.json({ tournament_id: tournament.id }, { status: 201 });
}
