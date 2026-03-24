import {
  TournamentConfig,
  TournamentResult,
  BotAgent,
  BotObservation,
  PeriodContext,
  PeriodResult,
  PeriodAllocation,
  Bid,
  TokenHolding,
  PendingRescind,
  RescindSupplyEntry,
  LeaderboardEntry,
  BotSummary,
  PrivateRescindInfo,
  ActivePhantom,
  RevelationEvent,
  InformationState,
} from '../models/types.js';
import { TournamentStore } from '../store/tournamentStore.js';
import { getStrategy } from '../strategies/factory.js';

const RESCIND_REVEAL_DELAY = 2;
const RESCIND_TAX_RATE = 0.10;

/**
 * TournamentEngine runs a complete multi-stage auction tournament synchronously.
 *
 * Flow per period:
 *   1. Reveal due rescinds
 *   2. Compute supply (base + rescind extras)
 *   3. Build observation for each bot
 *   4. Collect bids from all bots
 *   5. Validate bids (floor, budget)
 *   6. Run clearing strategy
 *   7. Apply allocations
 *   8. Ask winner about rescind
 *   9. Process rescind (delayed revelation)
 *   10. Record period result
 */
export class TournamentEngine {
  private store: TournamentStore;
  private bots: Map<string, BotAgent>;
  private config: TournamentConfig;

  constructor(config: TournamentConfig, agents: BotAgent[]) {
    this.config = config;
    this.bots = new Map();

    const botIds: string[] = [];
    for (const agent of agents) {
      if (this.bots.has(agent.bot_id)) {
        throw new Error(`Duplicate bot_id: ${agent.bot_id}`);
      }
      this.bots.set(agent.bot_id, agent);
      botIds.push(agent.bot_id);
    }

    this.store = new TournamentStore(config, botIds);
  }

  /**
   * Run the entire tournament. Returns the final result.
   * If onPeriodResult is provided, it is awaited after each period completes —
   * allowing callers to stream results to Supabase in real time.
   */
  async run(onPeriodResult?: (pr: PeriodResult) => Promise<void>): Promise<TournamentResult> {
    this.store.setPhase('stage_active');

    let absolutePeriod = 0;

    for (let stageIdx = 0; stageIdx < this.config.stages.length; stageIdx++) {
      const stageConfig = this.config.stages[stageIdx];
      this.store.setCurrentStage(stageIdx);

      const baseSupplyPerPeriod = stageConfig.base_token_supply / stageConfig.num_periods;

      for (let periodIdx = 0; periodIdx < stageConfig.num_periods; periodIdx++) {
        this.store.setCurrentPeriod(periodIdx);

        // 1. Reveal rescinds that are now public
        const revealedThisPeriod = this.store.revealRescinds(absolutePeriod);

        // 2. Compute supply
        const rescindExtra = this.store.getRescindSupplyForPeriod(absolutePeriod);
        const tokensAvailable = baseSupplyPerPeriod + rescindExtra;
        const floorPrice = stageConfig.floor_price;

        const periodContext: PeriodContext = {
          stage: stageIdx,
          period: periodIdx,
          absolute_period: absolutePeriod,
          tokens_available: tokensAvailable,
          floor_price: floorPrice,
          points_per_token: stageConfig.points_per_token,
        };

        // 3. Collect bids from all bots (parallel — all agents decide simultaneously)
        const allBids: Bid[] = [];
        const submittedBid = new Map<string, number | null>();
        for (const [botId] of this.bots) submittedBid.set(botId, null);

        const botEntries = [...this.bots.entries()];
        const settled = await Promise.allSettled(
          botEntries.map(([botId, agent]) => {
            const obs = this.buildObservation(botId, periodContext);
            return agent.decideBids(obs)
              .then(d => ({ botId, decision: d }))
              .catch(() => ({ botId, decision: { bids: [] as { price_per_token: number }[] } }));
          }),
        );

        let submissionOrder = 0;
        for (const r of settled) {
          if (r.status !== 'fulfilled') continue;
          const { botId, decision } = r.value;
          // Track the highest submitted price before floor/budget filtering
          if (decision.bids.length > 0) {
            submittedBid.set(botId, Math.max(...decision.bids.map(b => b.price_per_token)));
          }
          for (const bid of decision.bids.slice(0, stageConfig.max_bids_per_period)) {
            if (bid.price_per_token < floorPrice) continue;
            const totalCost = bid.price_per_token * tokensAvailable;
            const botState = this.store.getBot(botId)!;
            if (totalCost > botState.remaining_budget) continue;

            allBids.push({
              bot_id: botId,
              price_per_token: bid.price_per_token,
              submission_order: submissionOrder++,
            });
          }
        }

        // 4. Run clearing
        const strategy = getStrategy(stageConfig.clearing_strategy);
        const clearingResult = strategy.clear(allBids, tokensAvailable, floorPrice);

        // 5. Apply allocations
        for (const alloc of clearingResult.allocations) {
          this.store.deductBudget(alloc.bot_id, alloc.total_paid);
          this.store.addHolding(alloc.bot_id, {
            stage: stageIdx,
            period: periodIdx,
            quantity: alloc.tokens_won,
            price_paid_per_token: alloc.price_paid_per_token,
            points_per_token: stageConfig.points_per_token,
          });
        }

        // 6. Build period result (before rescind)
        const winnerBotId = clearingResult.allocations.length > 0
          ? clearingResult.allocations[0].bot_id
          : null;

        const periodResult: PeriodResult = {
          stage: stageIdx,
          period: periodIdx,
          absolute_period: absolutePeriod,
          tokens_available: tokensAvailable,
          clearing_price: clearingResult.clearing_price,
          allocations: clearingResult.allocations,
          winner_bot_id: winnerBotId,
          rescinded: null,
          num_bidders: allBids.length,
          all_bids: [...submittedBid.entries()].map(([bot_id, bid]) => ({ bot_id, bid })),
          rescind_detail: null,
          information_state: null,
        };

        // 7. Rescind decision (Vickrey: single winner)
        if (winnerBotId && clearingResult.allocations.length > 0) {
          const canRescind = this.canRescind(stageIdx, periodIdx, absolutePeriod);

          if (canRescind) {
            const alloc = clearingResult.allocations[0];

            // Compute rescind tax = 10% of tokens_available (rounded up)
            const rescindTax = Math.ceil(tokensAvailable * RESCIND_TAX_RATE);

            // Tax is paid from holdings EXCLUDING the just-won batch (which gets returned)
            const botStateNow = this.store.getBot(winnerBotId)!;
            const tokensOwnedExcludingWin = botStateNow.holdings
              .filter((h) => !(h.stage === stageIdx && h.period === periodIdx))
              .reduce((s, h) => s + h.quantity, 0);
            const canAffordRescindTax = tokensOwnedExcludingWin >= rescindTax;

            const agent = this.bots.get(winnerBotId)!;
            const obs = this.buildObservation(winnerBotId, periodContext);
            const rescindObs: BotObservation = {
              ...obs,
              rescind_tax_tokens: rescindTax,
              can_afford_rescind_tax: canAffordRescindTax,
            };

            let rescindDecision;
            try {
              rescindDecision = await agent.decideRescind(rescindObs, periodResult);
            } catch {
              rescindDecision = { rescind: false };
            }

            if (rescindDecision.rescind && !canAffordRescindTax) {
              // Bot wanted to rescind but cannot afford the tax — force keep
              console.warn(
                `[Engine] ${winnerBotId} cannot rescind: needs ${rescindTax} tokens for tax, has ${tokensOwnedExcludingWin}`,
              );
              periodResult.rescinded = false;
            } else if (rescindDecision.rescind) {
              // Process rescind with tax
              const totalRescindedTokens = alloc.tokens_won + rescindTax;

              this.store.removeHolding(winnerBotId, stageIdx, periodIdx);
              this.store.refundBudget(winnerBotId, alloc.total_paid);
              // Tax is deferred — deducted at reveal time (not now)

              // Calculate target period (2 periods later)
              const targetAbsolute = absolutePeriod + RESCIND_REVEAL_DELAY;
              const targetStagePeriod = this.absoluteToStagePeriod(targetAbsolute);

              this.store.addPendingRescind({
                bot_id: winnerBotId,
                stage: stageIdx,
                period: periodIdx,
                tokens: totalRescindedTokens,
                reveal_at_absolute_period: absolutePeriod + RESCIND_REVEAL_DELAY,
                target_absolute_period: targetAbsolute,
                phantom_quantity: alloc.tokens_won,
                phantom_stage: stageIdx,
                phantom_points_per_token: stageConfig.points_per_token,
                tax_tokens: rescindTax,
              });

              this.store.addRescindSupply({
                target_absolute_period: targetAbsolute,
                tokens: totalRescindedTokens,
                source_bot_id: winnerBotId,
              });

              this.store.addPrivateInfo(winnerBotId, {
                target_stage: targetStagePeriod.stage,
                target_period: targetStagePeriod.period,
                tokens: totalRescindedTokens,
                reveal_at_absolute_period: absolutePeriod + RESCIND_REVEAL_DELAY,
              });

              // Mark rescinded (hidden from others for 2 periods)
              periodResult.rescinded = null;
              periodResult.rescind_detail = {
                rescind_type: targetStagePeriod.stage !== stageIdx ? 'cross_stage' : 'within_stage',
                original_win_stage: stageIdx,
                original_win_period: periodIdx,
                tokens_rescinded: alloc.tokens_won,
                revelation_stage: targetStagePeriod.stage,
                revelation_period: targetStagePeriod.period,
                tax_amount_tokens: rescindTax,
                tax_deduction_stage: targetStagePeriod.stage,
                // computed post-hoc in runTournament.ts:
                phantom_sp_benefit: false,
                sp_rank_at_boundary_with_phantom: null,
                sp_rank_at_boundary_without_phantom: null,
                reacquisition_completed: false,
                reacquisition_period: null,
                reacquisition_price: null,
                promotion_profit_weighted_pts: null,
              };
            } else {
              periodResult.rescinded = false;
            }
          } else {
            periodResult.rescinded = false;
          }
        }

        periodResult.information_state = this.buildInformationState(
          winnerBotId, absolutePeriod, revealedThisPeriod,
        );

        this.store.addPeriodResult(periodResult);
        if (onPeriodResult) await onPeriodResult(periodResult);
        absolutePeriod++;
      }

      // Stage end — award SP
      this.store.setPhase('stage_transition');
      this.awardStageSP(stageIdx);
      this.store.setPhase('stage_active');
    }

    // Tournament end — award bonus SP
    this.store.setPhase('completed');
    this.awardBonusSP();

    return this.buildFinalResult();
  }

  // ─── Observation Builder ──────────────────────────────────────────────

  private buildObservation(botId: string, ctx: PeriodContext): BotObservation {
    const bot = this.store.getBot(botId)!;
    const stageConfig = this.config.stages[ctx.stage];

    return {
      stage: ctx.stage,
      period: ctx.period,
      absolute_period: ctx.absolute_period,
      periods_in_stage: stageConfig.num_periods,
      stages_remaining: this.config.stages.length - ctx.stage - 1,
      tokens_available: ctx.tokens_available,
      floor_price: ctx.floor_price,
      points_per_token: ctx.points_per_token,
      remaining_budget: bot.remaining_budget,
      sp: bot.sp,
      weighted_points: bot.weighted_points,
      tokens_per_stage: [...bot.tokens_per_stage],
      history: this.store.getPublicPeriodResults(ctx.absolute_period),
      leaderboard: this.store.getLeaderboard(),
      private_rescind_info: [...bot.private_info],
    };
  }

  // ─── Rescind Eligibility ──────────────────────────────────────────────

  private canRescind(stage: number, period: number, absolutePeriod: number): boolean {
    const totalPeriods = this.config.stages.reduce((s, c) => s + c.num_periods, 0);
    // Cannot rescind in last 2 periods of tournament
    return absolutePeriod + RESCIND_REVEAL_DELAY < totalPeriods;
  }

  // ─── SP Awards ────────────────────────────────────────────────────────

  private awardStageSP(stage: number): void {
    const ranking = this.store.getStageRanking(stage);
    for (let i = 0; i < ranking.length && i < this.config.sp_awards.length; i++) {
      this.store.awardSP(ranking[i].bot_id, this.config.sp_awards[i]);
    }
  }

  private awardBonusSP(): void {
    const leaderboard = this.store.getLeaderboard();
    if (leaderboard.length > 0) {
      // Award bonus to highest weighted points
      const sorted = [...leaderboard].sort(
        (a, b) => b.weighted_points - a.weighted_points,
      );
      this.store.awardSP(sorted[0].bot_id, this.config.bonus_sp);
    }
  }

  // ─── Final Result ─────────────────────────────────────────────────────

  private buildFinalResult(): TournamentResult {
    const finalLeaderboard = this.store.getLeaderboard();
    const botSummaries = new Map<string, BotSummary>();

    for (const bot of this.store.getAllBots()) {
      const budgetSpent = this.config.budget_per_bot - bot.remaining_budget;
      const periodsWon = this.store.getPeriodResults().filter(
        (pr) => pr.winner_bot_id === bot.bot_id && pr.rescinded !== true,
      ).length;
      const rescindsMade = this.store.getPeriodResults().filter(
        (pr) => pr.winner_bot_id === bot.bot_id && pr.rescinded === true,
      ).length;

      const totalPaid = bot.holdings.reduce(
        (s, h) => s + h.quantity * h.price_paid_per_token, 0,
      );

      botSummaries.set(bot.bot_id, {
        bot_id: bot.bot_id,
        total_sp: bot.sp,
        weighted_points: bot.weighted_points,
        tokens_per_stage: [...bot.tokens_per_stage],
        budget_spent: budgetSpent,
        budget_remaining: bot.remaining_budget,
        periods_won: periodsWon,
        rescinds_made: rescindsMade,
        avg_price_paid: totalPaid > 0 && periodsWon > 0
          ? totalPaid / bot.holdings.reduce((s, h) => s + h.quantity, 0)
          : 0,
        capital_efficiency: budgetSpent > 0
          ? bot.weighted_points / budgetSpent
          : 0,
      });
    }

    return {
      config: this.config,
      final_leaderboard: finalLeaderboard,
      winner_bot_id: finalLeaderboard.length > 0 ? finalLeaderboard[0].bot_id : '',
      all_period_results: this.store.getPeriodResults(),
      bot_summaries: botSummaries,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private absoluteToStagePeriod(absolutePeriod: number): { stage: number; period: number } {
    let remaining = absolutePeriod;
    for (let s = 0; s < this.config.stages.length; s++) {
      const numPeriods = this.config.stages[s].num_periods;
      if (remaining < numPeriods) {
        return { stage: s, period: remaining };
      }
      remaining -= numPeriods;
    }
    const lastStage = this.config.stages.length - 1;
    return { stage: lastStage, period: this.config.stages[lastStage].num_periods - 1 };
  }

  // ─── Information State Builder ────────────────────────────────────────

  /**
   * Omniscient snapshot of the true vs displayed state at end of each period.
   * "own" = the period winner (if any). active_phantoms excludes own's phantoms
   * since own already knows about them via private_info.
   */
  private buildInformationState(
    winnerBotId: string | null,
    absolutePeriod: number,
    revealedThisPeriod: PendingRescind[],
  ): InformationState {
    const leaderboard = this.store.getLeaderboard();
    const leaderboardMap = new Map(leaderboard.map(e => [e.bot_id, e]));

    // own = winner
    let ownTrueHoldings: number[] | null = null;
    let ownDisplayedHoldings: number[] | null = null;
    let ownPhantomDelta: number[] | null = null;

    if (winnerBotId) {
      const ownState = this.store.getBot(winnerBotId)!;
      const ownEntry = leaderboardMap.get(winnerBotId);
      ownTrueHoldings = [...ownState.tokens_per_stage];
      ownDisplayedHoldings = ownEntry
        ? [...ownEntry.tokens_per_stage]
        : [...ownState.tokens_per_stage];
      ownPhantomDelta = ownDisplayedHoldings.map((d, i) => d - ownTrueHoldings![i]);
    }

    // opponents: all bots except the winner
    const opponentsDisplayed: Record<string, number[]> = {};
    const opponentsTrue: Record<string, number[]> = {};
    for (const [botId] of this.bots) {
      if (botId === winnerBotId) continue;
      const botState = this.store.getBot(botId)!;
      const botEntry = leaderboardMap.get(botId);
      opponentsTrue[botId] = [...botState.tokens_per_stage];
      opponentsDisplayed[botId] = botEntry
        ? [...botEntry.tokens_per_stage]
        : [...botState.tokens_per_stage];
    }

    // active phantoms from opponents' unrevealed rescinds (own's phantom is
    // already captured in own_phantom_delta and known via private_info)
    const activePhantoms: ActivePhantom[] = this.store.getPendingRescinds()
      .filter(r => r.bot_id !== winnerBotId)
      .map(r => ({
        holder: r.bot_id,
        stage: r.phantom_stage,
        delta: r.phantom_quantity,
        reveals_in: r.reveal_at_absolute_period - absolutePeriod,
      }));

    // revelation events: rescinds publicly revealed at the start of this period
    const revelationEvents: RevelationEvent[] = revealedThisPeriod.map(r => ({
      agent: r.bot_id,
      phantom_resolved: r.phantom_quantity,
      tax_deducted: r.tax_tokens,
    }));

    return {
      own_true_holdings: ownTrueHoldings,
      own_displayed_holdings: ownDisplayedHoldings,
      own_phantom_delta: ownPhantomDelta,
      opponents_displayed: opponentsDisplayed,
      opponents_true: opponentsTrue,
      active_phantoms: activePhantoms,
      revelation_events_this_period: revelationEvents,
    };
  }

  getStore(): TournamentStore { return this.store; }
}
