import {
  TournamentConfig,
  TournamentPhase,
  BotState,
  TokenHolding,
  PendingRescind,
  RescindSupplyEntry,
  PeriodResult,
  LeaderboardEntry,
  PrivateRescindInfo,
} from '../models/types.js';

/**
 * In-memory state store for a single tournament.
 * Manages bot budgets, holdings, rescinds, and period history.
 */
export class TournamentStore {
  private config: TournamentConfig;
  private phase: TournamentPhase = 'not_started';
  private currentStage: number = -1;
  private currentPeriod: number = -1;
  private bots: Map<string, BotState> = new Map();
  private periodResults: PeriodResult[] = [];
  private pendingRescinds: PendingRescind[] = [];
  private rescindSupplyQueue: RescindSupplyEntry[] = [];

  constructor(config: TournamentConfig, botIds: string[]) {
    this.config = config;
    for (const id of botIds) {
      this.bots.set(id, {
        bot_id: id,
        remaining_budget: config.budget_per_bot,
        holdings: [],
        weighted_points: 0,
        tokens_per_stage: new Array(config.stages.length).fill(0),
        sp: 0,
        private_info: [],
      });
    }
  }

  // ─── Phase & Position ─────────────────────────────────────────────────

  getPhase(): TournamentPhase { return this.phase; }
  setPhase(p: TournamentPhase): void { this.phase = p; }
  getCurrentStage(): number { return this.currentStage; }
  setCurrentStage(s: number): void { this.currentStage = s; }
  getCurrentPeriod(): number { return this.currentPeriod; }
  setCurrentPeriod(p: number): void { this.currentPeriod = p; }

  // ─── Bot State ────────────────────────────────────────────────────────

  getBot(id: string): BotState | undefined { return this.bots.get(id); }
  getAllBots(): BotState[] { return [...this.bots.values()]; }
  getBotIds(): string[] { return [...this.bots.keys()]; }

  deductBudget(botId: string, amount: number): void {
    const bot = this.bots.get(botId);
    if (!bot) throw new Error(`Unknown bot: ${botId}`);
    bot.remaining_budget -= amount;
  }

  refundBudget(botId: string, amount: number): void {
    const bot = this.bots.get(botId);
    if (!bot) throw new Error(`Unknown bot: ${botId}`);
    bot.remaining_budget += amount;
  }

  addHolding(botId: string, holding: TokenHolding): void {
    const bot = this.bots.get(botId);
    if (!bot) throw new Error(`Unknown bot: ${botId}`);
    bot.holdings.push(holding);
    bot.tokens_per_stage[holding.stage] += holding.quantity;
    bot.weighted_points += holding.quantity * holding.points_per_token;
  }

  removeHolding(botId: string, stage: number, period: number): TokenHolding | undefined {
    const bot = this.bots.get(botId);
    if (!bot) return undefined;
    const idx = bot.holdings.findIndex((h) => h.stage === stage && h.period === period);
    if (idx === -1) return undefined;
    const holding = bot.holdings.splice(idx, 1)[0];
    bot.tokens_per_stage[holding.stage] -= holding.quantity;
    bot.weighted_points -= holding.quantity * holding.points_per_token;
    return holding;
  }

  /**
   * Deduct a token tax from the bot's existing holdings (most recent first).
   * Updates tokens_per_stage and weighted_points accordingly.
   */
  deductTokenTax(botId: string, quantity: number): void {
    const bot = this.bots.get(botId);
    if (!bot) throw new Error(`Unknown bot: ${botId}`);
    let remaining = quantity;
    for (let i = bot.holdings.length - 1; i >= 0 && remaining > 0; i--) {
      const h = bot.holdings[i];
      const deduct = Math.min(h.quantity, remaining);
      h.quantity -= deduct;
      bot.tokens_per_stage[h.stage] -= deduct;
      bot.weighted_points -= deduct * h.points_per_token;
      remaining -= deduct;
    }
    bot.holdings = bot.holdings.filter((h) => h.quantity > 0);
  }

  awardSP(botId: string, sp: number): void {
    const bot = this.bots.get(botId);
    if (!bot) throw new Error(`Unknown bot: ${botId}`);
    bot.sp += sp;
  }

  addPrivateInfo(botId: string, info: PrivateRescindInfo): void {
    const bot = this.bots.get(botId);
    if (!bot) throw new Error(`Unknown bot: ${botId}`);
    bot.private_info.push(info);
  }

  // ─── Period Results ───────────────────────────────────────────────────

  addPeriodResult(result: PeriodResult): void { this.periodResults.push(result); }
  getPeriodResults(): PeriodResult[] { return [...this.periodResults]; }

  /** Get public-facing period results (rescinds hidden until revealed). */
  getPublicPeriodResults(currentAbsolutePeriod: number): PeriodResult[] {
    return this.periodResults.map((pr) => {
      // Check if rescind has been revealed
      if (pr.rescinded !== null) return pr;
      // Check if any pending rescind for this period should be revealed
      const pending = this.pendingRescinds.find(
        (r) => r.stage === pr.stage && r.period === pr.period,
      );
      if (pending && pending.reveal_at_absolute_period <= currentAbsolutePeriod) {
        return { ...pr, rescinded: true };
      }
      return pr;
    });
  }

  // ─── Rescind Management ───────────────────────────────────────────────

  addPendingRescind(rescind: PendingRescind): void {
    this.pendingRescinds.push(rescind);
  }

  getPendingRescinds(): PendingRescind[] { return [...this.pendingRescinds]; }

  addRescindSupply(entry: RescindSupplyEntry): void {
    this.rescindSupplyQueue.push(entry);
  }

  /**
   * Reveal rescinds whose reveal period has arrived.
   * Returns newly revealed rescinds and updates period results.
   */
  revealRescinds(currentAbsolutePeriod: number): PendingRescind[] {
    const toReveal: PendingRescind[] = [];
    const remaining: PendingRescind[] = [];

    for (const r of this.pendingRescinds) {
      if (r.reveal_at_absolute_period <= currentAbsolutePeriod) {
        toReveal.push(r);
        // Apply the deferred rescind tax now that the rescind is public
        this.deductTokenTax(r.bot_id, r.tax_tokens);
        // Update the period result
        const pr = this.periodResults.find(
          (p) => p.stage === r.stage && p.period === r.period,
        );
        if (pr) pr.rescinded = true;
      } else {
        remaining.push(r);
      }
    }

    this.pendingRescinds = remaining;
    return toReveal;
  }

  getRescindSupplyForPeriod(absolutePeriod: number): number {
    return this.rescindSupplyQueue
      .filter((e) => e.target_absolute_period === absolutePeriod)
      .reduce((sum, e) => sum + e.tokens, 0);
  }

  // ─── Leaderboard ──────────────────────────────────────────────────────

  getLeaderboard(): LeaderboardEntry[] {
    // Build phantom additions from unrevealed rescinds.
    // During the secrecy window, show the rescinder as if they still hold the won tokens.
    const phantomByBot = new Map<string, { perStage: number[]; points: number }>();
    for (const r of this.pendingRescinds) {
      const p = phantomByBot.get(r.bot_id) ?? {
        perStage: new Array(this.config.stages.length).fill(0),
        points: 0,
      };
      p.perStage[r.phantom_stage] += r.phantom_quantity;
      p.points += r.phantom_quantity * r.phantom_points_per_token;
      phantomByBot.set(r.bot_id, p);
    }

    return this.getAllBots()
      .map((bot) => {
        const ph = phantomByBot.get(bot.bot_id);
        return {
          bot_id: bot.bot_id,
          tokens_per_stage: ph
            ? bot.tokens_per_stage.map((t, i) => t + (ph.perStage[i] ?? 0))
            : [...bot.tokens_per_stage],
          weighted_points: bot.weighted_points + (ph?.points ?? 0),
          sp: bot.sp,
        };
      })
      .sort((a, b) => {
        if (b.sp !== a.sp) return b.sp - a.sp;
        if (b.weighted_points !== a.weighted_points) return b.weighted_points - a.weighted_points;
        return a.bot_id.localeCompare(b.bot_id);
      });
  }

  getStageRanking(stage: number): { bot_id: string; tokens: number }[] {
    return this.getAllBots()
      .map((bot) => ({
        bot_id: bot.bot_id,
        // Cumulative: tokens from stage 0 through current stage all count
        tokens: bot.tokens_per_stage.slice(0, stage + 1).reduce((sum, t) => sum + t, 0),
      }))
      .filter((e) => e.tokens > 0)
      .sort((a, b) => {
        if (b.tokens !== a.tokens) return b.tokens - a.tokens;
        return a.bot_id.localeCompare(b.bot_id);
      });
  }
}
