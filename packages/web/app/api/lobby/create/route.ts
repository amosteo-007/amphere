export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { PROVIDERS, type ProviderKey } from '@/lib/game-theme';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/**
 * POST /api/lobby/create
 * Authorization: Bearer <api_key>
 *
 * Creates a multiplayer lobby. The creator auto-joins as slot 1.
 *
 * Body: {
 *   agent_slots: number          — how many agent/human slots (1–5)
 *   opponents?: { provider: string }[]  — LLM/algo fillers (defaults to 3x algo)
 * }
 */
export async function POST(req: NextRequest) {
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

  const body = await req.json() as {
    agent_slots?: number;
    opponents?: { provider: string }[];
  };

  const agentSlots = body.agent_slots ?? 2;
  const opponents = body.opponents ?? [
    { provider: 'algo' }, { provider: 'algo' }, { provider: 'algo' },
  ];

  if (agentSlots < 1 || agentSlots > 5) {
    return NextResponse.json({ error: 'agent_slots must be 1–5' }, { status: 400 });
  }

  const total = agentSlots + opponents.length;
  if (total < 2 || total > 10) {
    return NextResponse.json({ error: `Total players must be 2–10 (got ${total})` }, { status: 400 });
  }

  // Validate opponent providers
  const validKeys = Object.keys(PROVIDERS);
  for (const opp of opponents) {
    if (!validKeys.includes(opp.provider)) {
      return NextResponse.json({ error: `Invalid provider: ${opp.provider}` }, { status: 400 });
    }
  }

  const code = generateCode();

  const { data: lobby, error } = await supabase
    .from('lobbies')
    .insert({
      code,
      creator_bot_id: bot.id,
      agent_slots: agentSlots,
      opponents,
      joined_bots: [bot.id],  // creator auto-joins
    })
    .select('id, code, agent_slots, joined_bots, status, expires_at')
    .single();

  if (error || !lobby) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create lobby' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    lobby: {
      id: lobby.id,
      code: lobby.code,
      slots: {
        total: agentSlots,
        filled: 1,
        remaining: agentSlots - 1,
      },
      expires_at: lobby.expires_at,
    },
  }, { status: 201 });
}

function extractApiKey(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}
