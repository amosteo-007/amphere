import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  BotAgent,
  BotObservation,
  BotBidDecision,
  BotRescindDecision,
  PeriodResult,
} from '../models/types.js';

interface ExternalBotProxyOptions {
  /** Engine-level participant id (e.g. "momentum_bot_1"). */
  bot_id: string;
  /** UUID of the registered_bots row — used as the link to the real bot owner. */
  registered_bot_id: string;
  tournamentId: string;
  supabaseUrl: string;
  supabaseKey: string;
  /** How long to wait for the external bot to respond before auto-skipping (ms). Default: 30000 */
  timeoutMs?: number;
}

const POLL_INTERVAL_MS = 500;

/**
 * A bot that routes decisions through Supabase so an external process can bid
 * via the HTTP polling API (/api/bot/pending-turn + /api/bot/turn/:id/respond).
 *
 * Mirrors HumanProxyBot exactly, using `bot_turns` instead of `human_turns`:
 *
 *   1. Inserts a row into `bot_turns` with the current observation / win_result
 *   2. Optionally fires a wake notification to the bot's registered wakeUrl
 *   3. Polls that row every 500 ms until `response` is filled or deadline passes
 *   4. Resolves with the bot's choice, or skips / keeps on timeout
 */
export class ExternalBotProxy implements BotAgent {
  readonly bot_id: string;
  private registeredBotId: string;
  private tournamentId: string;
  private supabase: SupabaseClient;
  private timeoutMs: number;

  constructor(options: ExternalBotProxyOptions) {
    this.bot_id = options.bot_id;
    this.registeredBotId = options.registered_bot_id;
    this.tournamentId = options.tournamentId;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.supabase = createClient(options.supabaseUrl, options.supabaseKey);
  }

  async decideBids(obs: BotObservation): Promise<BotBidDecision> {
    const { data: turn, error } = await this.supabase
      .from('bot_turns')
      .insert({
        tournament_id: this.tournamentId,
        bot_id: this.bot_id,
        registered_bot_id: this.registeredBotId,
        stage: obs.stage,
        period: obs.period,
        turn_type: 'bid',
        observation: obs,
        expires_at: new Date(Date.now() + this.timeoutMs).toISOString(),
      })
      .select()
      .single();

    if (error || !turn) {
      console.error(`[ExternalBot:${this.bot_id}] Failed to insert bot_turns row:`, error?.message);
      return { bids: [] };
    }

    console.log(
      `[ExternalBot:${this.bot_id}] Waiting for bid — S${obs.stage + 1}P${obs.period + 1}` +
      ` (turn ${turn.id.slice(0, 8)}, ${this.timeoutMs / 1000}s)`,
    );

    const result = await this.pollForResponse(turn.id);

    if (!result || result.skipped) {
      console.log(`[ExternalBot:${this.bot_id}] Skipped S${obs.stage + 1}P${obs.period + 1}`);
      return { bids: [] };
    }

    if (typeof result.price_per_token === 'number') {
      console.log(`[ExternalBot:${this.bot_id}] Bid $${result.price_per_token.toFixed(2)}`);
      return { bids: [{ price_per_token: result.price_per_token }] };
    }

    return { bids: [] };
  }

  async decideRescind(obs: BotObservation, winResult: PeriodResult): Promise<BotRescindDecision> {
    const alloc = winResult.allocations[0];
    if (!alloc) return { rescind: false };

    const { data: turn, error } = await this.supabase
      .from('bot_turns')
      .insert({
        tournament_id: this.tournamentId,
        bot_id: this.bot_id,
        registered_bot_id: this.registeredBotId,
        stage: obs.stage,
        period: obs.period,
        turn_type: 'rescind',
        observation: obs,
        win_result: winResult,
        expires_at: new Date(Date.now() + this.timeoutMs).toISOString(),
      })
      .select()
      .single();

    if (error || !turn) {
      console.error(`[ExternalBot:${this.bot_id}] Failed to insert rescind bot_turns row:`, error?.message);
      return { rescind: false };
    }

    console.log(
      `[ExternalBot:${this.bot_id}] Waiting for rescind — S${obs.stage + 1}P${obs.period + 1}` +
      ` (${alloc.tokens_won.toFixed(0)} tokens @ $${winResult.clearing_price.toFixed(2)})`,
    );

    const result = await this.pollForResponse(turn.id);

    if (!result || result.skipped) {
      console.log(`[ExternalBot:${this.bot_id}] Rescind decision skipped — keeping tokens`);
      return { rescind: false };
    }

    const rescind = result.rescind === true;
    console.log(`[ExternalBot:${this.bot_id}] Rescind decision: ${rescind ? 'RESCIND' : 'KEEP'}`);
    return { rescind };
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private async pollForResponse(turnId: string): Promise<Record<string, unknown> | null> {
    const deadline = Date.now() + this.timeoutMs;

    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);

      const { data } = await this.supabase
        .from('bot_turns')
        .select('response')
        .eq('id', turnId)
        .single();

      if (data?.response) {
        return data.response as Record<string, unknown>;
      }
    }

    // Timeout — mark as skipped so the turn is closed
    console.log(`[ExternalBot:${this.bot_id}] Timeout on turn ${turnId.slice(0, 8)}`);
    await this.supabase
      .from('bot_turns')
      .update({ response: { skipped: true }, responded_at: new Date().toISOString() })
      .eq('id', turnId);

    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
