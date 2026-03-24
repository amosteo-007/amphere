export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * POST /api/tournaments/:id/human-bid
 * Body: { turn_id: string, price_per_token?: number, rescind?: boolean, skip?: boolean }
 *
 * Auth: cookie-based (browser) OR Bearer API key (OpenClaw agent).
 *
 * Fills in the `response` column on a pending human_turns row so the pollWorker
 * picks it up within 500 ms and continues the engine.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const { turn_id, price_per_token, rescind, skip } = body as {
    turn_id?: string;
    price_per_token?: number;
    rescind?: boolean;
    skip?: boolean;
  };

  if (!turn_id) {
    return NextResponse.json({ error: 'turn_id is required' }, { status: 400 });
  }

  const supabase = createServerClient();

  // If Bearer API key is provided, verify it matches the tournament's human agent
  let callerBotId: string | null = null;
  const apiKey = extractApiKey(req);
  if (apiKey) {
    const { data: bot } = await supabase
      .from('registered_bots')
      .select('id')
      .eq('api_key', apiKey)
      .maybeSingle();

    if (!bot) {
      return NextResponse.json({ error: 'Invalid api_key' }, { status: 401 });
    }

    // Verify this bot is a human player in this tournament
    const { data: tourney } = await supabase
      .from('tournaments')
      .select('agents')
      .eq('id', id)
      .single();

    if (!tourney?.agents) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const agents = tourney.agents as Array<{ bot_id?: string; registered_bot_id?: string; provider?: string }>;
    const myAgent = agents.find((a) => a.provider === 'human' && a.registered_bot_id === bot.id);
    if (!myAgent) {
      return NextResponse.json({ error: 'Not authorized for this tournament' }, { status: 403 });
    }

    callerBotId = myAgent.bot_id ?? null;
  }

  const { data: turn, error: fetchError } = await supabase
    .from('human_turns')
    .select('id, bot_id, decision_type, response, expires_at')
    .eq('id', turn_id)
    .eq('tournament_id', id)
    .single();

  if (fetchError || !turn) {
    return NextResponse.json({ error: 'Turn not found' }, { status: 404 });
  }

  // Verify this turn belongs to the calling bot (prevents cross-agent bid submission)
  if (callerBotId && turn.bot_id !== callerBotId) {
    return NextResponse.json({ error: 'This turn belongs to a different player' }, { status: 403 });
  }

  if (turn.response !== null) {
    return NextResponse.json({ error: 'Turn already answered' }, { status: 409 });
  }
  if (new Date(turn.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Turn has expired' }, { status: 410 });
  }

  let response: Record<string, unknown>;
  if (skip) {
    response = { skipped: true };
  } else if (turn.decision_type === 'bid') {
    if (typeof price_per_token !== 'number') {
      return NextResponse.json({ error: 'price_per_token required for bid' }, { status: 400 });
    }
    response = { price_per_token };
  } else {
    if (typeof rescind !== 'boolean') {
      return NextResponse.json({ error: 'rescind (boolean) required for rescind decision' }, { status: 400 });
    }
    response = { rescind };
  }

  const { data: updated, error: updateError } = await supabase
    .from('human_turns')
    .update({ response })
    .eq('id', turn_id)
    .is('response', null)
    .select('id');

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'Turn was already answered (possible timeout race)' }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}

function extractApiKey(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}
