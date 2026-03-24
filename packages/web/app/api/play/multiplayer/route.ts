export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { PROVIDERS, type ProviderKey } from '@/lib/game-theme';

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
 * POST /api/play/multiplayer
 * Authorization: Bearer <api_key>
 *
 * Creates a multiplayer tournament where multiple registered bots act as human players.
 * Each human bot polls /api/bot/pending-multi-turn with their own API key to get turns.
 *
 * Body: {
 *   human_bots: string[]           — array of registered_bot_id for each human player
 *   opponents?: { provider: string }[]  — LLM/algo opponents (optional, defaults to 3x algo)
 * }
 *
 * Total players (human_bots.length + opponents.length) must be 2–10.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerClient();

  // API key auth only (Telegram bot flow)
  const apiKey = extractApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: 'Authorization: Bearer <api_key> required' }, { status: 401 });
  }

  const { data: callerBot } = await supabase
    .from('registered_bots')
    .select('id')
    .eq('api_key', apiKey)
    .maybeSingle();

  if (!callerBot) {
    return NextResponse.json({ error: 'Invalid api_key' }, { status: 401 });
  }

  const body = await req.json() as {
    human_bots?: string[];
    opponents?: { provider: string }[];
  };

  const humanBotIds: string[] = body.human_bots ?? [];
  const opponents: { provider: string }[] = body.opponents ?? [
    { provider: 'algo' }, { provider: 'algo' }, { provider: 'algo' },
  ];

  if (humanBotIds.length < 1) {
    return NextResponse.json({ error: 'At least 1 human_bot required' }, { status: 400 });
  }

  const totalPlayers = humanBotIds.length + opponents.length;
  if (totalPlayers < 2 || totalPlayers > 10) {
    return NextResponse.json(
      { error: `Total players must be 2–10 (got ${totalPlayers})` },
      { status: 400 },
    );
  }

  // Validate all human_bot IDs exist
  const { data: humanBots } = await supabase
    .from('registered_bots')
    .select('id')
    .in('id', humanBotIds);

  const foundIds = new Set((humanBots ?? []).map((b) => b.id));
  for (const id of humanBotIds) {
    if (!foundIds.has(id)) {
      return NextResponse.json({ error: `Registered bot not found: ${id}` }, { status: 400 });
    }
  }

  // Validate opponent providers
  const validKeys = Object.keys(PROVIDERS);
  for (const opp of opponents) {
    if (!validKeys.includes(opp.provider)) {
      return NextResponse.json({ error: `Invalid provider: ${opp.provider}` }, { status: 400 });
    }
  }

  const personas = shuffle(PERSONA_POOL);

  // Build agents: human slots first, then LLM/algo opponents
  const agents = [
    ...humanBotIds.map((botId, i) => ({
      bot_id: `human_${i + 1}`,
      provider: 'human',
      model: 'human',
      persona_name: 'player',
      persona_prompt: '',
      registered_bot_id: botId,
    })),
    ...opponents.map((opp, i) => {
      const info = PROVIDERS[opp.provider as ProviderKey];
      return {
        bot_id: `${info.display.toLowerCase()}_${i + 1}`,
        provider: info.provider,
        model: info.model,
        persona_name: opp.provider === 'algo'
          ? ALGO_ARCHETYPES[i % ALGO_ARCHETYPES.length]
          : (personas[i % personas.length] ?? 'base'),
        persona_prompt: '',
      };
    }),
  ];

  const config = {
    name: 'Multiplayer',
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
      auction_type: 'multi-cascade-vickrey',
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
