export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * GET /api/bot/pending-multi-turn
 * Authorization: Bearer <api_key>
 *
 * Returns the oldest unresponded human_turn for a multiplayer tournament
 * where this registered bot is one of the human players.
 *
 * Unlike /api/bot/pending-human-turn (which only checks agents[0] with bot_id='you'),
 * this endpoint dynamically finds which bot_id belongs to the calling bot
 * across any agent slot in multi-cascade-vickrey tournaments.
 */
export async function GET(req: NextRequest) {
  const apiKey = extractApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: 'Authorization: Bearer <api_key> required' }, { status: 401 });
  }

  const supabase = createServerClient();

  // Resolve api_key → registered_bot_id
  const { data: bot, error: botError } = await supabase
    .from('registered_bots')
    .select('id')
    .eq('api_key', apiKey)
    .maybeSingle();

  if (botError || !bot) {
    return NextResponse.json({ error: 'Invalid api_key' }, { status: 401 });
  }

  // Find multiplayer tournaments this bot is enrolled in
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, agents')
    .in('status', ['pending', 'running'])
    .eq('auction_type', 'multi-cascade-vickrey');

  if (!tournaments || tournaments.length === 0) {
    return NextResponse.json({ turn: null });
  }

  // For each tournament, find the agent whose registered_bot_id matches this bot
  // Then use that agent's bot_id to query human_turns
  type AgentEntry = { bot_id: string; provider?: string; registered_bot_id?: string };

  for (const t of tournaments) {
    const agents = (t.agents ?? []) as AgentEntry[];
    const myAgent = agents.find(
      (a) => a.provider === 'human' && a.registered_bot_id === bot.id,
    );

    if (!myAgent) continue;

    const { data: turn } = await supabase
      .from('human_turns')
      .select('id, decision_type, observation, win_result, context, stage, period, expires_at, tournament_id')
      .eq('tournament_id', t.id)
      .eq('bot_id', myAgent.bot_id)
      .is('response', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (turn) {
      return NextResponse.json({ turn });
    }
  }

  return NextResponse.json({ turn: null });
}

function extractApiKey(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}
