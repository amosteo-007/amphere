/**
 * Aurasct Auto-Player — Autonomous Tournament Runner
 *
 * Creates a tournament, then plays as the human by polling for turns
 * and submitting bids/rescind decisions automatically.
 *
 * Usage:
 *   AURASCT_BASE_URL=https://your-vercel-url npx tsx examples/auto-player.ts
 *
 * Environment:
 *   AURASCT_BASE_URL  — web server URL (default: http://localhost:3031)
 *   SUPABASE_URL      — Supabase project URL
 *   SUPABASE_ANON_KEY — Supabase anon key (for reading human_turns)
 */

declare const process: { env: Record<string, string | undefined>; exit(code?: number): never };

const BASE_URL = process.env.AURASCT_BASE_URL ?? 'http://localhost:3031';
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const POLL_INTERVAL_MS = 2000;

// ─── Strategy ─────────────────────────────────────────────────────────────────

interface HumanTurn {
  id: string;
  tournament_id: string;
  bot_id: string;
  decision_type: 'bid' | 'rescind';
  observation: any;
  win_result?: any;
  response: any;
  expires_at: string;
  created_at: string;
}

function decideBid(obs: any): number | null {
  const { floor_price, remaining_budget, points_per_token, stages_remaining, period, periods_in_stage, tokens_available } = obs;

  // Don't spend more than 20% of budget per period
  const maxBid = remaining_budget * 0.20 / (tokens_available || 1);

  // Value scales with points multiplier
  const baseValue = floor_price * (1 + points_per_token * 0.5);

  // Urgency: bid more as stage ends
  const periodFraction = period / periods_in_stage;
  const urgency = 1 + periodFraction * 0.3;

  // Fewer stages left = spend more freely
  const stageScarcity = stages_remaining === 0 ? 1.2 : 1.0;

  const targetBid = baseValue * urgency * stageScarcity;
  const finalBid = Math.min(targetBid, maxBid, remaining_budget / (tokens_available || 1));

  if (finalBid < floor_price) return null;
  return Math.round(finalBid * 100) / 100;
}

function decideRescind(obs: any, winResult: any): boolean {
  if (!obs.can_afford_rescind_tax) return false;
  if (obs.stages_remaining === 0) return false;

  const alloc = winResult?.allocations?.[0];
  if (!alloc) return false;

  const budgetFractionSpent = alloc.total_paid / (obs.remaining_budget + alloc.total_paid);
  return budgetFractionSpent > 0.15;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function createTournament(opponents: { provider: string; registered_bot_id?: string }[]): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ opponents }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Failed to create tournament: ${data.error ?? res.statusText}`);
  }

  const { tournament_id } = await res.json();
  return tournament_id;
}

async function submitHumanBid(
  tournamentId: string,
  turnId: string,
  payload: { price_per_token?: number; rescind?: boolean; skip?: boolean },
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/tournaments/${tournamentId}/human-bid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ turn_id: turnId, ...payload }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Failed to submit bid: ${data.error ?? res.statusText}`);
  }
}

async function supabaseQuery(table: string, params: Record<string, string>): Promise<any[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!res.ok) throw new Error(`Supabase query failed: ${res.statusText}`);
  return res.json();
}

async function getPendingHumanTurn(tournamentId: string): Promise<HumanTurn | null> {
  const rows = await supabaseQuery('human_turns', {
    tournament_id: `eq.${tournamentId}`,
    bot_id: 'eq.you',
    response: 'is.null',
    order: 'created_at.desc',
    limit: '1',
    select: '*',
  });

  if (!rows || rows.length === 0) return null;
  const turn = rows[0] as HumanTurn;

  if (new Date(turn.expires_at) < new Date()) return null;
  return turn;
}

async function getTournamentStatus(tournamentId: string): Promise<string> {
  const rows = await supabaseQuery('tournaments', {
    id: `eq.${tournamentId}`,
    select: 'status',
  });
  return rows?.[0]?.status ?? 'unknown';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY (or NEXT_PUBLIC_ variants)');
    process.exit(1);
  }

  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Supabase: ${SUPABASE_URL}`);

  // Configure opponents — adjust as needed
  const opponents = [
    { provider: 'anthropic' },
    { provider: 'google' },
    { provider: 'groq' },
    { provider: 'deepseek' },
    // Add { provider: 'external', registered_bot_id: '...' } for your OpenClaw bot
  ];

  console.log(`\nCreating tournament with ${opponents.length} opponents...`);
  const tournamentId = await createTournament(opponents);
  console.log(`Tournament created: ${tournamentId}`);

  console.log('Waiting for worker to claim tournament...');
  await new Promise<void>((r) => setTimeout(r, 5000));

  let turnsPlayed = 0;

  while (true) {
    try {
      // Check tournament status
      const status = await getTournamentStatus(tournamentId);

      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        console.log(`\nTournament ${status}! Played ${turnsPlayed} turns.`);
        break;
      }

      // Poll for human turn
      const turn = await getPendingHumanTurn(tournamentId);

      if (turn) {
        const obs = turn.observation;
        console.log(`\nS${obs.stage + 1}P${obs.period + 1} — ${turn.decision_type} turn`);
        console.log(`  Budget: $${obs.remaining_budget?.toFixed(0)} | Tokens: ${obs.tokens_per_stage} | SP: ${obs.sp}`);

        if (turn.decision_type === 'bid') {
          const price = decideBid(obs);
          if (price === null) {
            console.log('  → Skipping (cannot afford)');
            await submitHumanBid(tournamentId, turn.id, { skip: true });
          } else {
            console.log(`  → Bidding $${price.toFixed(2)}/token`);
            await submitHumanBid(tournamentId, turn.id, { price_per_token: price });
          }
        } else if (turn.decision_type === 'rescind') {
          const shouldRescind = decideRescind(obs, turn.win_result);
          console.log(`  → ${shouldRescind ? 'RESCINDING' : 'Keeping tokens'}`);
          await submitHumanBid(tournamentId, turn.id, { rescind: shouldRescind });
        }

        turnsPlayed++;
      }
    } catch (err: any) {
      console.error('Error:', err.message);
    }

    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
