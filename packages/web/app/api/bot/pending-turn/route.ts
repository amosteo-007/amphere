export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * GET /api/bot/pending-turn
 * Authorization: Bearer <api_key>
 *
 * Returns the oldest unresponded bot_turn for this registered bot, or null
 * if no turn is pending. Bots should poll this endpoint (e.g. every 1s) to
 * discover when it's their time to bid or decide on a rescind.
 *
 * Response 200:
 *   { turn: null }                        — no pending turn right now
 *   { turn: { id, turn_type, observation, win_result, stage, period, expires_at } }
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

  // Find the oldest unanswered, unexpired turn
  const { data: turn } = await supabase
    .from('bot_turns')
    .select('id, turn_type, observation, win_result, stage, period, expires_at, tournament_id')
    .eq('registered_bot_id', bot.id)
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
