export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * GET /api/bot/pending-human-turn
 * Authorization: Bearer <api_key>
 *
 * Returns the oldest unresponded human_turn for a tournament where this
 * registered bot is linked as the human player (via agents[0].registered_bot_id).
 *
 * Response 200:
 *   { turn: null }
 *   { turn: { id, decision_type, observation, win_result, context, stage, period, expires_at, tournament_id } }
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

  // Find running tournaments where this bot is the human player
  // The human agent entry is agents[0] with provider='human' and registered_bot_id set
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id')
    .in('status', ['pending', 'running'])
    .not('agents', 'is', null);

  if (!tournaments || tournaments.length === 0) {
    return NextResponse.json({ turn: null });
  }

  // Filter to tournaments where agents[0].registered_bot_id matches this bot
  // We need to check the JSONB agents array — query each candidate
  const tournamentIds: string[] = [];
  for (const t of tournaments) {
    const { data: tourney } = await supabase
      .from('tournaments')
      .select('agents')
      .eq('id', t.id)
      .single();

    if (tourney?.agents) {
      const agents = tourney.agents as Array<{ registered_bot_id?: string; provider?: string }>;
      const humanAgent = agents.find((a) => a.provider === 'human');
      if (humanAgent?.registered_bot_id === bot.id) {
        tournamentIds.push(t.id);
      }
    }
  }

  if (tournamentIds.length === 0) {
    return NextResponse.json({ turn: null });
  }

  // Find the oldest unanswered, unexpired human turn across matching tournaments
  const { data: turn } = await supabase
    .from('human_turns')
    .select('id, decision_type, observation, win_result, context, stage, period, expires_at, tournament_id')
    .in('tournament_id', tournamentIds)
    .eq('bot_id', 'you')
    .is('response', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!turn) {
    return NextResponse.json({ turn: null });
  }

  return NextResponse.json({ turn });
}

function extractApiKey(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}
