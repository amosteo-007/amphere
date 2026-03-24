export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * GET /api/lobby/:id
 * Authorization: Bearer <api_key>
 *
 * Returns lobby status. The :id can be the lobby UUID or the short code.
 */
export async function GET(
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

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  let query = supabase
    .from('lobbies')
    .select('id, code, agent_slots, opponents, joined_bots, status, tournament_id, created_at, expires_at');

  if (isUuid) {
    query = query.eq('id', id);
  } else {
    query = query.ilike('code', id);
  }

  const { data: lobby, error } = await query.maybeSingle();

  if (error || !lobby) {
    return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
  }

  const joinedBots = (lobby.joined_bots ?? []) as string[];

  return NextResponse.json({
    ok: true,
    lobby: {
      id: lobby.id,
      code: lobby.code,
      status: lobby.status,
      slots: {
        total: lobby.agent_slots,
        filled: joinedBots.length,
        remaining: lobby.agent_slots - joinedBots.length,
      },
      opponents: lobby.opponents,
      tournament_id: lobby.tournament_id,
      expires_at: lobby.expires_at,
    },
  });
}

function extractApiKey(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}
