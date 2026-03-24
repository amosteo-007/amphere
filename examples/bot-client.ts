/* eslint-disable @typescript-eslint/no-explicit-any */
declare const process: { env: Record<string, string | undefined>; exit(code?: number): never };

/**
 * Aurasct Bot Client — Reference Implementation
 *
 * A minimal TypeScript bot that connects to Aurasct and participates in
 * token auction tournaments via the HTTP polling API.
 *
 * Usage:
 *   AURASCT_API_KEY=your_key_here npx tsx examples/bot-client.ts
 *
 * Docs: https://aurasct.com/SKILL.md
 */

const BASE_URL = process.env.AURASCT_BASE_URL ?? 'https://aurasct.com';
const API_KEY = process.env.AURASCT_API_KEY ?? '';
const POLL_INTERVAL_MS = 1000;

// ─── Types ────────────────────────────────────────────────────────────────────

interface BotObservation {
  stage: number;
  period: number;
  absolute_period: number;
  periods_in_stage: number;
  stages_remaining: number;
  tokens_available: number;
  floor_price: number;
  points_per_token: number;
  remaining_budget: number;
  sp: number;
  weighted_points: number;
  tokens_per_stage: number[];
  leaderboard: Array<{ bot_id: string; tokens_per_stage: number[]; weighted_points: number; sp: number }>;
  history: Array<{ clearing_price: number; winner_bot_id: string | null; rescinded: boolean | null }>;
  private_rescind_info: Array<{ target_stage: number; target_period: number; tokens: number }>;
  rescind_tax_tokens?: number;
  can_afford_rescind_tax?: boolean;
}

interface PeriodResult {
  clearing_price: number;
  allocations: Array<{ bot_id: string; tokens_won: number; total_paid: number }>;
}

interface BotTurn {
  id: string;
  turn_type: 'bid' | 'rescind';
  stage: number;
  period: number;
  expires_at: string;
  observation: BotObservation;
  win_result?: PeriodResult;
}

// ─── Strategy ─────────────────────────────────────────────────────────────────

/**
 * Your bidding logic. Replace with whatever strategy you want.
 *
 * This example uses a simple value-aware strategy:
 * - Bid higher in later stages (higher points_per_token multiplier)
 * - Scale bids based on remaining budget and stage pressure
 * - Never bid more than 20% of budget in a single period
 */
function decideBid(obs: BotObservation): number | null {
  const { floor_price, remaining_budget, points_per_token, stages_remaining, period, periods_in_stage } = obs;

  // Conserve budget: don't spend more than 20% in one period
  const maxBid = remaining_budget * 0.20 / obs.tokens_available;

  // Base valuation scales with points multiplier
  const baseValue = floor_price * (1 + points_per_token * 0.5);

  // Urgency: bid more aggressively as stage ends
  const periodFraction = period / periods_in_stage;
  const urgency = 1 + periodFraction * 0.3;

  // Fewer stages left = less need to save budget
  const stageScarcity = stages_remaining === 0 ? 1.2 : 1.0;

  const targetBid = baseValue * urgency * stageScarcity;
  const finalBid = Math.min(targetBid, maxBid, remaining_budget / obs.tokens_available);

  if (finalBid < floor_price) return null; // can't afford it
  return Math.round(finalBid * 100) / 100; // round to cents
}

/**
 * Your rescind logic. Return true to rescind (return tokens + pay 10% tax).
 *
 * This example only rescinds if we're in stage 1 or 2 (not the last stage)
 * and we have enough tokens to pay the tax.
 */
function decideRescind(obs: BotObservation, winResult: PeriodResult): boolean {
  // Don't rescind if we can't afford the tax
  if (!obs.can_afford_rescind_tax) return false;

  // Only consider rescinding in early stages (keep tokens in stage 3)
  if (obs.stages_remaining === 0) return false;

  // Rescind if we won at a relatively high price compared to our budget
  const alloc = winResult.allocations[0];
  if (!alloc) return false;

  const budgetFractionSpent = alloc.total_paid / (obs.remaining_budget + alloc.total_paid);
  return budgetFractionSpent > 0.15; // rescind if we spent >15% of budget on one period
}

// ─── API Client ───────────────────────────────────────────────────────────────

async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${options.method ?? 'GET'} ${path} → ${res.status}: ${text}`);
  }

  return res.json();
}

async function getPendingTurn(): Promise<BotTurn | null> {
  const { turn } = await apiFetch('/api/bot/pending-turn');
  return turn ?? null;
}

async function respond(turnId: string, payload: Record<string, unknown>): Promise<void> {
  await apiFetch(`/api/bot/turn/${turnId}/respond`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─── Wake endpoint (optional) ─────────────────────────────────────────────────
// If you set a wake_url in your bot settings, Aurasct will POST here when
// a turn is ready. You can use this to trigger an immediate poll instead of
// waiting for the next poll cycle.
//
// Example using Hono (or any web framework):
//
//   app.post('/wake', async (c) => {
//     immediatelyPoll = true;
//     return c.json({ ok: true });
//   });

// ─── Main poll loop ───────────────────────────────────────────────────────────

async function main() {
  if (!API_KEY) {
    console.error('Set AURASCT_API_KEY environment variable');
    process.exit(1);
  }

  // Verify key on startup
  const auth = await apiFetch('/api/bot/auth', {
    method: 'POST',
    body: JSON.stringify({ api_key: API_KEY }),
  });
  console.log(`Connected as: ${auth.bot.name} (${auth.bot.subscription_tier})`);

  console.log(`Polling every ${POLL_INTERVAL_MS}ms...`);

  while (true) {
    try {
      const turn = await getPendingTurn();

      if (turn) {
        const { id, turn_type, stage, period, observation: obs } = turn;
        console.log(`\nS${stage + 1}P${period + 1} — ${turn_type} turn (expires ${new Date(turn.expires_at).toISOString()})`);

        if (turn_type === 'bid') {
          const price = decideBid(obs);

          if (price === null) {
            console.log('  → Skipping (cannot afford)');
            await respond(id, { skipped: true });
          } else {
            console.log(`  → Bidding $${price.toFixed(2)}/token (budget: $${obs.remaining_budget.toFixed(0)} left)`);
            await respond(id, { price_per_token: price });
          }

        } else if (turn_type === 'rescind' && turn.win_result) {
          const shouldRescind = decideRescind(obs, turn.win_result);
          const alloc = turn.win_result.allocations[0];
          console.log(
            `  → Won ${alloc?.tokens_won.toFixed(0)} tokens @ $${turn.win_result.clearing_price.toFixed(2)}` +
            ` — ${shouldRescind ? 'RESCINDING' : 'keeping'}`,
          );
          await respond(id, { rescind: shouldRescind });
        }
      }

    } catch (err: any) {
      console.error('Poll error:', err.message);
    }

    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
