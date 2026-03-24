import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  BotAgent,
  BotObservation,
  BotBidDecision,
  BotRescindDecision,
  PeriodResult,
} from '../models/types.js';

interface HumanProxyOptions {
  bot_id: string;
  tournamentId: string;
  supabaseUrl: string;
  supabaseKey: string;
  /** How long to wait for the human's input before auto-skipping (ms). Default: 60000 */
  timeoutMs?: number;
}

const POLL_INTERVAL_MS = 500;

/**
 * A bot that routes decisions through Supabase so a human can bid in real time
 * via the web UI. For each period:
 *
 *   1. Inserts a row into `human_turns` with the current context (tokens, floor, budget, etc.)
 *   2. Polls that row every 500 ms until `response` is populated or the deadline passes
 *   3. Resolves with the human's choice, or skips/keeps on timeout
 *
 * Bots NEVER see the human's bid price — only clearing prices are in observations,
 * which is the same sealed-bid privacy guarantee applied to all participants.
 */
export class HumanProxyBot implements BotAgent {
  readonly bot_id: string;
  private tournamentId: string;
  private supabase: SupabaseClient;
  private timeoutMs: number;

  constructor(options: HumanProxyOptions) {
    this.bot_id = options.bot_id;
    this.tournamentId = options.tournamentId;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.supabase = createClient(options.supabaseUrl, options.supabaseKey);
  }

  async decideBids(obs: BotObservation): Promise<BotBidDecision> {
    const lastPeriod = obs.history.at(-1);

    const { data: turn, error } = await this.supabase
      .from('human_turns')
      .insert({
        tournament_id: this.tournamentId,
        bot_id: this.bot_id,
        stage: obs.stage,
        period: obs.period,
        decision_type: 'bid',
        context: {
          tokens_available: obs.tokens_available,
          floor_price: obs.floor_price,
          remaining_budget: obs.remaining_budget,
          points_per_token: obs.points_per_token,
          clearing_price_last: lastPeriod?.clearing_price ?? null,
          stages_remaining: obs.stages_remaining,
          periods_in_stage: obs.periods_in_stage,
          sp: obs.sp,
          weighted_points: obs.weighted_points,
          tokens_per_stage: obs.tokens_per_stage,
          leaderboard: obs.leaderboard,
        },
        observation: obs,
        expires_at: new Date(Date.now() + this.timeoutMs).toISOString(),
      })
      .select()
      .single();

    if (error || !turn) {
      console.error(`[HumanProxy] Failed to insert human_turns row:`, error?.message);
      return { bids: [] };
    }

    console.log(
      `[HumanProxy] Waiting for human bid — S${obs.stage + 1}P${obs.period + 1}` +
      ` (turn ${turn.id.slice(0, 8)}, ${this.timeoutMs / 1000}s)`,
    );

    const deadline = Date.now() + this.timeoutMs;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      const { data } = await this.supabase
        .from('human_turns')
        .select('response')
        .eq('id', turn.id)
        .single();

      if (data?.response) {
        const resp = data.response as { price_per_token?: number; skipped?: boolean };
        if (resp.skipped || typeof resp.price_per_token !== 'number') {
          console.log(`[HumanProxy] Human skipped S${obs.stage + 1}P${obs.period + 1}`);
          return { bids: [] };
        }
        console.log(`[HumanProxy] Human bid $${resp.price_per_token.toFixed(2)}`);
        return { bids: [{ price_per_token: resp.price_per_token }] };
      }
    }

    // Timeout — mark as skipped and move on
    console.log(`[HumanProxy] Timeout — auto-skipping S${obs.stage + 1}P${obs.period + 1}`);
    await this.supabase
      .from('human_turns')
      .update({ response: { skipped: true } })
      .eq('id', turn.id);
    return { bids: [] };
  }

  async decideRescind(obs: BotObservation, winResult: PeriodResult): Promise<BotRescindDecision> {
    const alloc = winResult.allocations[0];
    if (!alloc) return { rescind: false };

    const { data: turn, error } = await this.supabase
      .from('human_turns')
      .insert({
        tournament_id: this.tournamentId,
        bot_id: this.bot_id,
        stage: obs.stage,
        period: obs.period,
        decision_type: 'rescind',
        context: {
          tokens_available: winResult.tokens_available,
          floor_price: obs.floor_price,
          remaining_budget: obs.remaining_budget,
          points_per_token: obs.points_per_token,
          clearing_price_last: winResult.clearing_price,
          tokens_won: alloc.tokens_won,
          total_paid: alloc.total_paid,
          stages_remaining: obs.stages_remaining,
          sp: obs.sp,
          rescind_tax_tokens: obs.rescind_tax_tokens,
          can_afford_rescind_tax: obs.can_afford_rescind_tax,
        },
        observation: obs,
        win_result: winResult,
        expires_at: new Date(Date.now() + this.timeoutMs).toISOString(),
      })
      .select()
      .single();

    if (error || !turn) {
      console.error(`[HumanProxy] Failed to insert rescind human_turns row:`, error?.message);
      return { rescind: false };
    }

    console.log(
      `[HumanProxy] Waiting for human rescind decision — S${obs.stage + 1}P${obs.period + 1}` +
      ` (${alloc.tokens_won.toFixed(0)} tokens @ $${winResult.clearing_price.toFixed(2)})`,
    );

    const deadline = Date.now() + this.timeoutMs;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      const { data } = await this.supabase
        .from('human_turns')
        .select('response')
        .eq('id', turn.id)
        .single();

      if (data?.response) {
        const resp = data.response as { rescind?: boolean; skipped?: boolean };
        const rescind = resp.rescind === true;
        console.log(`[HumanProxy] Human chose: ${rescind ? 'RESCIND' : 'KEEP'}`);
        return { rescind };
      }
    }

    // Timeout — keep tokens by default
    console.log(`[HumanProxy] Timeout — keeping tokens (no rescind)`);
    await this.supabase
      .from('human_turns')
      .update({ response: { rescind: false, skipped: true } })
      .eq('id', turn.id);
    return { rescind: false };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
