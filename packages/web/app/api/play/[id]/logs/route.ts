export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createServerClient as createSupabaseAuth } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * GET /api/play/:id/logs?bot_id=...&period=...
 *
 * Returns LLM thinking logs for a specific bot in a tournament.
 * User must have participated in this tournament.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tournamentId } = await params;
  const { searchParams } = req.nextUrl;
  const botId = searchParams.get('bot_id');

  if (!botId) {
    return NextResponse.json({ error: 'bot_id required' }, { status: 400 });
  }

  // Auth check
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

  const supabase = createServerClient();

  // In dev mode, skip auth check
  if (process.env.NODE_ENV !== 'development') {
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Verify tournament has a human agent (user participated)
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('agents')
    .eq('id', tournamentId)
    .single();

  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  const hasHuman = (tournament.agents as any[])?.some(
    (a) => a.provider === 'human',
  );
  if (!hasHuman) {
    return NextResponse.json({ error: 'Not a single-player tournament' }, { status: 403 });
  }

  // Fetch logs — llm_logs stores one row per period/decision
  let query = supabase
    .from('llm_logs')
    .select('bot_id, provider, model, stage, period, decision_type, observation_summary, prompt, thinking, raw_response, parsed_decision, latency_ms, error')
    .eq('tournament_id', tournamentId)
    .eq('bot_id', botId)
    .order('stage', { ascending: true })
    .order('period', { ascending: true });

  // Optionally filter by period
  const periodParam = searchParams.get('period');
  if (periodParam !== null) {
    const p = parseInt(periodParam, 10);
    query = query.eq('period', p);
  }

  const { data: logs, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!logs || logs.length === 0) {
    return NextResponse.json({ bot_id: botId, periods: [] });
  }

  return NextResponse.json({
    bot_id: logs[0].bot_id,
    provider: logs[0].provider,
    model: logs[0].model,
    periods: logs,
  });
}
