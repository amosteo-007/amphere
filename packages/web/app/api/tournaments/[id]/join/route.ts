export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * POST /api/tournaments/:id/join
 * Authorization: Bearer <api_key>  (external bot)  OR  authenticated session (human)
 *
 * Registers a bot or human as a participant in a pending tournament.
 * The tournament's `agents` array must already contain a slot with matching
 * `registered_bot_id` (for bots) or `provider: 'human'` (for humans).
 * This route confirms the participant is connected and ready.
 *
 * For the MVP, this simply returns the tournament state so the client
 * knows the tournament exists and what its config looks like.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tournamentId } = await params;
  const supabase = createServerClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, status, config, agents, leaderboard')
    .eq('id', tournamentId)
    .maybeSingle();

  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  return NextResponse.json({ tournament });
}
