export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createServerClient as createSupabaseAuth } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { PROVIDERS, FREE_TIER_PROVIDERS, type ProviderKey } from '@/lib/game-theme';

const PERSONA_POOL = [
  'momentum', 'dark_pool', 'market_maker', 'noise_trader',
  'macro', 'sector_rotator', 'value', 'index',
];

const ALGO_ARCHETYPES = [
  'aggressive_early', 'patient_sniper', 'adaptive_tracker',
  'balanced_spreader', 'info_exploiter', 'chaos_agent',
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * POST /api/play
 * Body: { opponents: [{ provider: ProviderKey }], human_bot_id?: string }
 *
 * Creates a single-player tournament with the human + selected LLM opponents.
 * Minimum 4 opponents (5 total), maximum 9 opponents (10 total).
 *
 * Auth: cookie-based (browser) OR Bearer API key (OpenClaw agent).
 * When using API key auth, human_bot_id links the human slot to the registered bot.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerClient();

  // Try API key auth first (for OpenClaw agents on Codespace)
  const apiKey = extractApiKey(req);
  let apiKeyBotId: string | null = null;

  if (apiKey) {
    const { data: bot } = await supabase
      .from('registered_bots')
      .select('id')
      .eq('api_key', apiKey)
      .maybeSingle();

    if (!bot) {
      return NextResponse.json({ error: 'Invalid api_key' }, { status: 401 });
    }
    apiKeyBotId = bot.id;
  }

  // Fall back to cookie auth if no API key
  if (!apiKeyBotId) {
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

    // In dev/test mode, skip auth + invite checks
    if (process.env.NODE_ENV !== 'development' && process.env.AUTH_BYPASS !== 'true') {
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Verify invite code
      const { data: redemption } = await supabase
        .from('user_invite_redemptions')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!redemption) {
        return NextResponse.json({ error: 'Invite code required' }, { status: 403 });
      }
    }
  }

  const body = await req.json() as { opponents?: { provider: string; registered_bot_id?: string }[]; human_bot_id?: string };
  const opponents = body.opponents;
  const humanBotId = body.human_bot_id ?? apiKeyBotId;

  if (!Array.isArray(opponents) || opponents.length < 4 || opponents.length > 9) {
    return NextResponse.json(
      { error: 'Select 4-9 opponents (5-10 total players)' },
      { status: 400 },
    );
  }

  // Validate providers
  const validKeys = Object.keys(PROVIDERS);
  for (const opp of opponents) {
    if (!validKeys.includes(opp.provider)) {
      return NextResponse.json({ error: `Invalid provider: ${opp.provider}` }, { status: 400 });
    }
    if (opp.provider === 'external' && !opp.registered_bot_id) {
      return NextResponse.json({ error: 'External bots require registered_bot_id' }, { status: 400 });
    }
  }

  // Tier gating: free-tier users can only use FREE_TIER_PROVIDERS
  if (!apiKeyBotId) {
    // Only enforce for browser users (API key users manage their own tier)
    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('tier')
      .limit(1)
      .maybeSingle();

    const tier = sub?.tier ?? 'free';
    if (tier === 'free') {
      for (const opp of opponents) {
        if (opp.provider !== 'external' && !FREE_TIER_PROVIDERS.includes(opp.provider as ProviderKey)) {
          return NextResponse.json(
            { error: `Provider "${opp.provider}" requires a paid subscription` },
            { status: 403 },
          );
        }
      }
    }
  }

  // Validate human_bot_id if provided
  if (humanBotId) {
    const { data: humanBot } = await supabase
      .from('registered_bots')
      .select('id')
      .eq('id', humanBotId)
      .maybeSingle();

    if (!humanBot) {
      return NextResponse.json({ error: `Human bot not found: ${humanBotId}` }, { status: 400 });
    }
  }

  // Validate external bot registrations exist
  const externalOpps = opponents.filter((o) => o.provider === 'external' && o.registered_bot_id);
  if (externalOpps.length > 0) {
    const { data: bots } = await supabase
      .from('registered_bots')
      .select('id, name')
      .in('id', externalOpps.map((o) => o.registered_bot_id!));

    const foundIds = new Set((bots ?? []).map((b) => b.id));
    for (const opp of externalOpps) {
      if (!foundIds.has(opp.registered_bot_id!)) {
        return NextResponse.json({ error: `Bot not found: ${opp.registered_bot_id}` }, { status: 400 });
      }
    }
  }

  // Assign random personas (cycle if more opponents than personas)
  const personas = shuffle(PERSONA_POOL);

  // Build agents array
  const agents = [
    {
      bot_id: 'you',
      provider: 'human',
      model: 'human',
      persona_name: 'player',
      persona_prompt: '',
      ...(humanBotId ? { registered_bot_id: humanBotId } : {}),
    },
    ...opponents.map((opp, i) => {
      const info = PROVIDERS[opp.provider as ProviderKey];

      if (opp.provider === 'external') {
        return {
          bot_id: `openclaw_${i + 1}`,
          provider: 'external',
          model: 'external',
          persona_name: 'external',
          persona_prompt: '',
          registered_bot_id: opp.registered_bot_id,
        };
      }

      return {
        bot_id: `${info.display.toLowerCase()}_${i + 1}`,
        provider: info.provider,
        model: info.model,
        persona_name: opp.provider === 'algo'
          ? ALGO_ARCHETYPES[i % ALGO_ARCHETYPES.length]
          : 'base',
        persona_prompt: '',
      };
    }),
  ];

  // Condensed config: 3 stages × 5 periods
  const config = {
    name: 'Single Player',
    budget_per_bot: 10000,
    stages: [
      { base_token_supply: 600, floor_price: 10, points_per_token: 1.0, num_periods: 5, period_duration_seconds: 60, max_bids_per_period: 1, clearing_strategy: 'vickrey' },
      { base_token_supply: 400, floor_price: 15, points_per_token: 1.5, num_periods: 5, period_duration_seconds: 60, max_bids_per_period: 1, clearing_strategy: 'vickrey' },
      { base_token_supply: 200, floor_price: 28, points_per_token: 3.0, num_periods: 5, period_duration_seconds: 60, max_bids_per_period: 1, clearing_strategy: 'vickrey' },
    ],
    sp_awards: [3, 2, 1],
    bonus_sp: 1,
    rescind_reveal_delay: 2,
  };

  const { data: tournament, error } = await supabase
    .from('tournaments')
    .insert({
      status: 'pending',
      auction_type: 'cascade-vickrey',
      is_test: false,
      config,
      agents,
    })
    .select('id')
    .single();

  if (error || !tournament) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create tournament' }, { status: 500 });
  }

  return NextResponse.json({ tournament_id: tournament.id }, { status: 201 });
}

function extractApiKey(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}
