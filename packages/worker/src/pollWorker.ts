/**
 * Aurasct-Prod Polling Worker
 *
 * Long-running process that:
 *   1. Polls Supabase every 3s for pending tournaments (atomic claim via SKIP LOCKED)
 *   2. Builds bots from agents config — LLMBot, HumanProxyBot, or ExternalBotProxy
 *   3. Runs TournamentEngine with per-period Supabase writes (drives Realtime)
 *   4. Fires wake notifications to registered bots at tournament start + each period
 *   5. Writes LLM logs and final leaderboard on completion
 *
 * Start: pnpm --filter @aurasct/worker dev
 *
 * Requires .env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY, GOOGLE_API_KEY, GROQ_API_KEY, etc. (as needed)
 */

import {
  TournamentEngine,
  createDefaultTournamentConfig,
  createTestTournamentConfig,
  LLMBot,
  HumanProxyBot,
  ExternalBotProxy,
  createBot,
} from '@aurasct/engine';
import type { LLMProvider, BotAgent, BotArchetype, BotObservation, PeriodResult, TournamentResult } from '@aurasct/engine';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { notifyTournamentBots } from './wake.js';
import { runScheduler } from './jobs/tournamentScheduler.js';

// ─── Supabase (service role — bypasses RLS) ──────────────────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const POLL_INTERVAL_MS = 3000;

// ─── Agent config shape (matches tournaments.agents jsonb) ───────────────────

interface AgentConfig {
  bot_id: string;
  provider: string;
  model: string;
  persona_name: string;
  persona_prompt: string;
  registered_bot_id?: string; // set for external bots
}

// ─── Cancellation signal ──────────────────────────────────────────────────────

class CancellationError extends Error {
  constructor() {
    super('Tournament cancelled');
    this.name = 'CancellationError';
  }
}

// ─── Claim one pending tournament atomically ──────────────────────────────────

async function claimPendingTournament(): Promise<any | null> {
  const { data, error } = await supabase.rpc('claim_pending_tournament');

  if (error) {
    if (error.message.includes('does not exist')) {
      console.error('[Worker] claim_pending_tournament() function not found — run 001_core.sql first');
    } else {
      console.error('[Worker] Claim error:', error.message);
    }
    return null;
  }

  if (Array.isArray(data) && data.length > 0) return data[0];
  if (data && !Array.isArray(data)) return data;
  return null;
}

// ─── Wrap bots with real-time status updates ─────────────────────────────────

function wrapBotWithStatus(bot: BotAgent, tournamentId: string, sb: SupabaseClient): BotAgent {
  const originalDecideBids = bot.decideBids.bind(bot);
  const originalDecideRescind = bot.decideRescind?.bind(bot);

  return {
    ...bot,
    bot_id: bot.bot_id,
    decideBids: async (obs: BotObservation) => {
      const start = Date.now();
      // Insert 'thinking' status
      await sb.from('bot_bid_status').upsert({
        tournament_id: tournamentId,
        absolute_period: obs.absolute_period,
        bot_id: bot.bot_id,
        status: 'thinking',
      }, { onConflict: 'tournament_id,absolute_period,bot_id' });

      try {
        const result = await originalDecideBids(obs);
        await sb.from('bot_bid_status').upsert({
          tournament_id: tournamentId,
          absolute_period: obs.absolute_period,
          bot_id: bot.bot_id,
          status: 'done',
          latency_ms: Date.now() - start,
        }, { onConflict: 'tournament_id,absolute_period,bot_id' });
        return result;
      } catch (e) {
        await sb.from('bot_bid_status').upsert({
          tournament_id: tournamentId,
          absolute_period: obs.absolute_period,
          bot_id: bot.bot_id,
          status: 'error',
          latency_ms: Date.now() - start,
        }, { onConflict: 'tournament_id,absolute_period,bot_id' });
        throw e;
      }
    },
    decideRescind: originalDecideRescind,
  } as BotAgent;
}

// ─── Run one tournament ───────────────────────────────────────────────────────

async function runTournament(tournament: any): Promise<void> {
  const tournamentId: string = tournament.id;
  const agents: AgentConfig[] = tournament.agents ?? [];
  const isTest: boolean = tournament.is_test;

  console.log(
    `\n[Worker] ▶ ${tournamentId.slice(0, 8)} (${isTest ? 'TEST' : 'FULL'}, ${agents.length} agents)`,
  );
  agents.forEach((a) => {
    const tag = a.registered_bot_id ? `external:${a.registered_bot_id.slice(0, 8)}` : `${a.provider}/${a.model}`;
    console.log(`  → ${a.bot_id}: ${tag} [${a.persona_name}]`);
  });

  try {
    const config = tournament.config ?? (isTest ? createTestTournamentConfig() : createDefaultTournamentConfig());

    // Detect single-player mode (has a human player)
    const isSinglePlayer = agents.some((a) => a.provider === 'human');

    // Build bot instances
    const bots: BotAgent[] = agents.map((a, i) => {
      if (a.provider === 'external' && a.registered_bot_id) {
        return new ExternalBotProxy({
          bot_id: a.bot_id,
          registered_bot_id: a.registered_bot_id,
          tournamentId,
          supabaseUrl: process.env.SUPABASE_URL!,
          supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          timeoutMs: 30_000,
        });
      }

      if (a.provider === 'algo') {
        return createBot((a.persona_name || 'balanced_spreader') as BotArchetype, a.bot_id, Date.now() + i);
      }

      if (a.provider === 'human') {
        return new HumanProxyBot({
          bot_id: a.bot_id,
          tournamentId,
          supabaseUrl: process.env.SUPABASE_URL!,
          supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          timeoutMs: 300_000,  // 5 min — agents need time to reason + submit
        });
      }

      return new LLMBot({
        bot_id: a.bot_id,
        provider: a.provider as LLMProvider,
        model: a.model,
        persona: a.persona_name || undefined,
        personaPrompt: a.persona_prompt || undefined,
        saveLogs: false,
        timeoutMs: isSinglePlayer ? 30_000 : undefined,
        disableThinking: isSinglePlayer,
      });
    });

    // Wrap non-human bots with status writer for real-time frontend updates
    const wrappedBots = bots.map((bot) => {
      if (bot instanceof HumanProxyBot) return bot; // Don't wrap human
      return wrapBotWithStatus(bot, tournamentId, supabase);
    });

    // Wake all registered bots: tournament is starting
    await notifyTournamentBots(supabase, tournament, { event_type: 'tournament_start' });

    // ── Per-period callback ──────────────────────────────────────────────────
    const onPeriodResult = async (pr: PeriodResult): Promise<void> => {
      const winner = pr.allocations[0];
      const row = {
        tournament_id: tournamentId,
        absolute_period: pr.absolute_period,
        stage: pr.stage,
        period: pr.period,
        tokens_available: pr.tokens_available,
        clearing_price: pr.clearing_price,
        winner_bot_id: pr.winner_bot_id ?? 'none',
        tokens_won: winner?.tokens_won ?? 0,
        total_paid: winner?.total_paid ?? 0,
        rescinded: pr.rescinded === true,
        num_bidders: pr.num_bidders,
        all_bids: pr.all_bids ?? null,
        rescind_detail: pr.rescind_detail ?? null,
        information_state: pr.information_state ?? null,
      };

      const { error } = await supabase.from('period_results').insert(row);
      if (error) {
        console.error(`[Worker] period_results insert S${pr.stage + 1}P${pr.period + 1}:`, error.message);
      } else {
        const r = pr.rescinded === true ? ' [R]' : '';
        console.log(`  S${pr.stage + 1}P${pr.period + 1} | $${pr.clearing_price.toFixed(2)} | ${pr.winner_bot_id ?? 'none'}${r}`);
      }

      // Wake registered bots: next period is coming
      await notifyTournamentBots(supabase, tournament, {
        event_type: 'period_start',
        stage: pr.stage,
        period: pr.period + 1,
      });

      // Cancellation check
      const { data: statusRow } = await supabase
        .from('tournaments')
        .select('status')
        .eq('id', tournamentId)
        .single();
      if (statusRow?.status === 'cancelling') throw new CancellationError();
    };

    // ── Run engine ───────────────────────────────────────────────────────────
    const t0 = Date.now();
    const result: TournamentResult = await new TournamentEngine(config, bots).run(onPeriodResult);
    console.log(`[Worker] Engine done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    // ── Patch rescinded periods (reveal all rescinds now that tournament is over) ──
    const rescindedPeriods = result.all_period_results.filter(
      (pr) => pr.rescinded === true || (pr.rescinded === null && pr.rescind_detail != null),
    );
    if (rescindedPeriods.length > 0) {
      await supabase
        .from('period_results')
        .update({ rescinded: true })
        .eq('tournament_id', tournamentId)
        .in('absolute_period', rescindedPeriods.map((pr) => pr.absolute_period));
      console.log(`[Worker] ${rescindedPeriods.length} rescinded period(s) patched`);
    }

    // ── Write LLM logs ───────────────────────────────────────────────────────
    const logRows: any[] = [];
    for (const bot of bots) {
      if (!(bot instanceof LLMBot)) continue;
      const agentCfg = agents.find((a) => a.bot_id === bot.bot_id);
      for (const log of (bot as any).getLogs?.() ?? []) {
        logRows.push({
          tournament_id: tournamentId,
          bot_id: bot.bot_id,
          model: agentCfg?.model ?? 'unknown',
          persona: agentCfg?.persona_name ?? 'unknown',
          provider: agentCfg?.provider ?? null,
          participant_type: 'llm',
          stage: log.stage,
          period: log.period,
          decision_type: log.type,
          observation_summary: log.observation_summary,
          prompt: log.prompt?.slice(0, 10000) ?? null,
          thinking: log.thinking?.slice(0, 20000) ?? null,
          raw_response: log.raw_response?.slice(0, 10000) ?? null,
          parsed_decision: log.parsed_decision,
          latency_ms: log.latency_ms,
          error: log.error ?? null,
        });
      }
    }
    for (let i = 0; i < logRows.length; i += 50) {
      const { error } = await supabase.from('llm_logs').insert(logRows.slice(i, i + 50));
      if (error) console.error(`[Worker] llm_logs chunk error:`, error.message);
    }
    if (logRows.length > 0) console.log(`[Worker] ${logRows.length} LLM log entries written`);

    // ── Post-tournament reflections (LLM bots only, skip algo) ──────────────
    const reflectionPromises = bots
      .filter((bot): bot is LLMBot => bot instanceof LLMBot)
      .map(async (bot) => {
        const agentCfg = agents.find((a) => a.bot_id === bot.bot_id);
        if (!agentCfg || agentCfg.provider === 'algo') return;

        const summary = result.bot_summaries.get(bot.bot_id);
        const rank = result.final_leaderboard.findIndex((e) => e.bot_id === bot.bot_id) + 1;
        const entry = result.final_leaderboard.find((e) => e.bot_id === bot.bot_id);

        // Build period-by-period log
        const periodLog = result.all_period_results.map((pr) => {
          const bid = pr.all_bids.find((b) => b.bot_id === bot.bot_id);
          const isWinner = pr.winner_bot_id === bot.bot_id;
          const bidStr = bid?.bid != null ? `$${bid.bid.toFixed(2)}` : 'skip';
          const resultStr = isWinner
            ? `WON (clearing: $${pr.clearing_price.toFixed(2)}${pr.rescinded === true ? ', rescind: YES' : ', rescind: NO'})`
            : `lost (winner: ${pr.winner_bot_id ?? 'none'}, clearing: $${pr.clearing_price.toFixed(2)})`;
          return `  S${pr.stage + 1}P${pr.period + 1}: bid ${bidStr} → ${resultStr}`;
        }).join('\n');

        const reflectionPrompt = `You just competed in a token auction tournament as agent "${bot.bot_id}".

FINAL RESULT: ${rank === 1 ? 'first' : rank === 2 ? 'second' : rank === 3 ? 'third' : `#${rank}`} place (out of ${result.final_leaderboard.length}) — ${entry?.sp ?? 0} SP, ${Math.round(entry?.weighted_points ?? 0)} weighted points.
Budget: spent $${Math.round(summary?.budget_spent ?? 0)} of $${result.config.budget_per_bot}. Remaining: $${Math.round(summary?.budget_remaining ?? 0)}.
Tokens per stage: S1=${entry?.tokens_per_stage[0] ?? 0}, S2=${entry?.tokens_per_stage[1] ?? 0}, S3=${entry?.tokens_per_stage[2] ?? 0}
Rescinds made: ${summary?.rescinds_made ?? 0}

PERIOD-BY-PERIOD LOG:
${periodLog}

Reflect on your strategy. What worked? What failed? What would you do differently in future tournaments?`;

        const t0 = Date.now();
        try {
          const { text, token_count } = await bot.generateReflection(reflectionPrompt);
          const latency = Date.now() - t0;
          await supabase.from('learning_logs').insert({
            tournament_id: tournamentId,
            bot_id: bot.bot_id,
            provider: agentCfg.provider,
            model: agentCfg.model,
            persona: agentCfg.persona_name || null,
            rank,
            sp: entry?.sp ?? 0,
            weighted_points: Math.round(entry?.weighted_points ?? 0),
            prompt: reflectionPrompt,
            reflection: text,
            token_count,
            latency_ms: latency,
          });
          console.log(`  ${bot.bot_id} reflection: ${(latency / 1000).toFixed(1)}s, ${token_count} tokens`);
        } catch (e: any) {
          const latency = Date.now() - t0;
          await supabase.from('learning_logs').insert({
            tournament_id: tournamentId,
            bot_id: bot.bot_id,
            provider: agentCfg.provider,
            model: agentCfg.model,
            persona: agentCfg.persona_name || null,
            rank,
            sp: entry?.sp ?? 0,
            weighted_points: Math.round(entry?.weighted_points ?? 0),
            prompt: reflectionPrompt,
            reflection: '',
            error: e.message?.slice(0, 500),
            latency_ms: latency,
          });
          console.error(`  ⚠️  ${bot.bot_id} reflection failed: ${e.message}`);
        }
      });

    await Promise.all(reflectionPromises);
    console.log(`[Worker] Reflections done`);

    // ── Build leaderboard + mark completed ───────────────────────────────────
    const leaderboard = result.final_leaderboard.map((e) => {
      const s = result.bot_summaries.get(e.bot_id);
      return {
        bot_id: e.bot_id,
        tokens_per_stage: e.tokens_per_stage,
        weighted_points: Math.round(e.weighted_points * 10) / 10,
        sp: e.sp,
        spent: s ? Math.round(s.budget_spent) : 0,
        remaining: s ? Math.round(s.budget_remaining) : 0,
        periods_won: s?.periods_won ?? 0,
        rescinds: s?.rescinds_made ?? 0,
      };
    });

    await supabase
      .from('tournaments')
      .update({ status: 'completed', leaderboard, completed_at: new Date().toISOString() })
      .eq('id', tournamentId);

    console.log(`[Worker] ✅ ${tournamentId.slice(0, 8)} completed — winner: ${result.winner_bot_id}`);

  } catch (err: any) {
    if (err instanceof CancellationError) {
      console.log(`[Worker] ⛔ ${tournamentId.slice(0, 8)} cancelled`);
      await supabase
        .from('tournaments')
        .update({ status: 'cancelled', completed_at: new Date().toISOString() })
        .eq('id', tournamentId);
    } else {
      console.error(`[Worker] ❌ ${tournamentId.slice(0, 8)} FAILED:`, err.message);
      await supabase
        .from('tournaments')
        .update({ status: 'failed', error: err.message?.slice(0, 500), completed_at: new Date().toISOString() })
        .eq('id', tournamentId);
    }
  }
}

// ─── Main poll loop ───────────────────────────────────────────────────────────

async function pollLoop(): Promise<void> {
  console.log(`[PollWorker] Starting — polling every ${POLL_INTERVAL_MS}ms`);
  console.log(`[PollWorker] Supabase: ${process.env.SUPABASE_URL}`);

  while (true) {
    try {
      await runScheduler(supabase);
      const tournament = await claimPendingTournament();
      if (tournament) {
        await runTournament(tournament);
      }
    } catch (err: any) {
      console.error('[PollWorker] Unhandled error:', err.message);
    }
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

pollLoop();
