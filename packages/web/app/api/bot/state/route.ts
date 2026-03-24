export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * GET /api/bot/state
 * Authorization: Bearer <api_key>
 * Query: ?tournament_id=<uuid>  (optional — defaults to most recent active tournament)
 *
 * Returns the current public state of the tournament the bot is enrolled in.
 * Useful for bots that want more context than what fits in a single observation.
 */
export async function GET(req: NextRequest) {
  const apiKey = extractApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: 'Authorization: Bearer <api_key> required' }, { status: 401 });
  }

  const supabase = createServerClient();

  const { data: bot, error: botError } = await supabase
    .from('registered_bots')
    .select('id')
    .eq('api_key', apiKey)
    .maybeSingle();

  if (botError || !bot) {
    return NextResponse.json({ error: 'Invalid api_key' }, { status: 401 });
  }

  const tournamentId = req.nextUrl.searchParams.get('tournament_id');

  // Find the tournament this bot is currently in
  let tournamentQuery = supabase
    .from('tournaments')
    .select('id, status, config, leaderboard, agents, started_at, completed_at')
    .in('status', ['running', 'pending', 'completed']);

  if (tournamentId) {
    tournamentQuery = tournamentQuery.eq('id', tournamentId);
  } else {
    // Look for a tournament whose agents array references this registered_bot_id
    tournamentQuery = tournamentQuery.contains('agents', JSON.stringify([{ registered_bot_id: bot.id }]));
  }

  const { data: tournament } = await tournamentQuery
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tournament) {
    return NextResponse.json({ tournament: null });
  }

  // Fetch the latest period results (last 5)
  const { data: recentPeriods } = await supabase
    .from('period_results')
    .select('stage, period, absolute_period, clearing_price, winner_bot_id, tokens_available, rescinded, num_bidders')
    .eq('tournament_id', tournament.id)
    .order('absolute_period', { ascending: false })
    .limit(5);

  return NextResponse.json({
    tournament: {
      id: tournament.id,
      status: tournament.status,
      leaderboard: tournament.leaderboard,
      started_at: tournament.started_at,
      completed_at: tournament.completed_at,
    },
    recent_periods: (recentPeriods ?? []).reverse(),
  });
}

function extractApiKey(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}
