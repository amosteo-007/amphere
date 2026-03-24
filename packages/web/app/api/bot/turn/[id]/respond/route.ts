export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * POST /api/bot/turn/:id/respond
 * Authorization: Bearer <api_key>
 *
 * Submit a bid or rescind decision for a pending bot_turn.
 *
 * Body for bid turn:
 *   { price_per_token: number }   — submit a bid at this price
 *   { skipped: true }             — pass on this period
 *
 * Body for rescind turn:
 *   { rescind: boolean }          — true = rescind, false = keep
 *   { skipped: true }             — same as { rescind: false }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: turnId } = await params;
  const apiKey = extractApiKey(req);

  if (!apiKey) {
    return NextResponse.json({ error: 'Authorization: Bearer <api_key> required' }, { status: 401 });
  }

  const supabase = createServerClient();

  // Verify api_key
  const { data: bot, error: botError } = await supabase
    .from('registered_bots')
    .select('id')
    .eq('api_key', apiKey)
    .maybeSingle();

  if (botError || !bot) {
    return NextResponse.json({ error: 'Invalid api_key' }, { status: 401 });
  }

  // Fetch the turn and verify ownership + open state
  const { data: turn } = await supabase
    .from('bot_turns')
    .select('id, registered_bot_id, turn_type, response, expires_at')
    .eq('id', turnId)
    .maybeSingle();

  if (!turn) {
    return NextResponse.json({ error: 'Turn not found' }, { status: 404 });
  }
  if (turn.registered_bot_id !== bot.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (turn.response !== null) {
    return NextResponse.json({ error: 'Turn already answered' }, { status: 409 });
  }
  if (new Date(turn.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Turn has expired' }, { status: 410 });
  }

  const body = await req.json() as {
    price_per_token?: number;
    rescind?: boolean;
    skipped?: boolean;
  };

  // Build response payload
  let response: Record<string, unknown>;

  if (body.skipped) {
    response = { skipped: true };
  } else if (turn.turn_type === 'bid') {
    if (typeof body.price_per_token !== 'number' || body.price_per_token < 0) {
      return NextResponse.json(
        { error: 'price_per_token (number >= 0) required for bid turns' },
        { status: 400 },
      );
    }
    response = { price_per_token: body.price_per_token };
  } else {
    // rescind turn
    if (typeof body.rescind !== 'boolean') {
      return NextResponse.json(
        { error: 'rescind (boolean) required for rescind turns' },
        { status: 400 },
      );
    }
    response = { rescind: body.rescind };
  }

  const { error: updateError } = await supabase
    .from('bot_turns')
    .update({ response, responded_at: new Date().toISOString() })
    .eq('id', turnId)
    .is('response', null); // guard against race conditions

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function extractApiKey(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}
