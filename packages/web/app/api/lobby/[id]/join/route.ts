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
 * POST /api/lobby/:id/join
 * Authorization: Bearer <api_key>
 *
 * Join an open lobby. When the last slot fills, auto-creates the tournament.
 * The :id can be the lobby UUID or the short code.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createServerClient();

  const apiKey = extractApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: 'Authorization: Bearer <api_key> required' }, { status: 401 });
  }

  const { data: bot } = await supabase
    .from('registered_bots')
    .select('id')
    .eq('api_key', apiKey)
    .maybeSingle();

  if (!bot) {
    return NextResponse.json({ error: 'Invalid api_key' }, { status: 401 });
  }

  // Look up lobby by UUID or code
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  let query = supabase
    .from('lobbies')
    .select('id, code, agent_slots, opponents, joined_bots, status, expires_at');

  if (isUuid) {
    query = query.eq('id', id);
  } else {
    query = query.ilike('code', id);
  }

  const { data: lobby, error: lookupError } = await query.maybeSingle();

  if (lookupError || !lobby) {
    return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
  }

  if (lobby.status !== 'open') {
    return NextResponse.json({ error: `Lobby is ${lobby.status}` }, { status: 410 });
  }

  if (new Date(lobby.expires_at) < new Date()) {
    await supabase.from('lobbies').update({ status: 'expired' }).eq('id', lobby.id);
    return NextResponse.json({ error: 'Lobby has expired' }, { status: 410 });
  }

  const joinedBots = (lobby.joined_bots ?? []) as string[];

  if (joinedBots.includes(bot.id)) {
    return NextResponse.json({
      ok: true,
      message: 'Already joined',
      slot: joinedBots.indexOf(bot.id) + 1,
      slots: { total: lobby.agent_slots, filled: joinedBots.length, remaining: lobby.agent_slots - joinedBots.length },
    });
  }

  if (joinedBots.length >= lobby.agent_slots) {
    return NextResponse.json({ error: 'Lobby is full' }, { status: 409 });
  }

  // Add bot to lobby
  const updatedBots = [...joinedBots, bot.id];
  const isFull = updatedBots.length >= lobby.agent_slots;

  await supabase
    .from('lobbies')
    .update({
      joined_bots: updatedBots,
      ...(isFull ? { status: 'started' } : {}),
    })
    .eq('id', lobby.id);

  // If full, create the tournament
  if (isFull) {
    const opponents = (lobby.opponents ?? []) as { provider: string }[];
    const personas = shuffle(PERSONA_POOL);

    const agents = [
      ...updatedBots.map((botId: string, i: number) => ({
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

    const { data: tournament, error: tError } = await supabase
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

    if (tError || !tournament) {
      return NextResponse.json({ error: tError?.message ?? 'Failed to create tournament' }, { status: 500 });
    }

    // Link tournament to lobby
    await supabase
      .from('lobbies')
      .update({ tournament_id: tournament.id })
      .eq('id', lobby.id);

    return NextResponse.json({
      ok: true,
      slot: updatedBots.length,
      tournament_id: tournament.id,
      message: 'Lobby full — tournament started!',
    }, { status: 201 });
  }

  return NextResponse.json({
    ok: true,
    slot: updatedBots.length,
    slots: {
      total: lobby.agent_slots,
      filled: updatedBots.length,
      remaining: lobby.agent_slots - updatedBots.length,
    },
  });
}

function extractApiKey(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}
