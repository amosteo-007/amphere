import { SeededRandom } from '../utils/random.js';
import {
  BotAgent,
  BotObservation,
  BotBidDecision,
  BotRescindDecision,
  PeriodResult,
} from '../models/types.js';

// ─── Base Class ─────────────────────────────────────────────────────────────────

abstract class StochasticBot implements BotAgent {
  readonly bot_id: string;
  protected rng: SeededRandom;

  constructor(id: string, seed: number) {
    this.bot_id = id;
    this.rng = new SeededRandom(seed);
  }

  abstract decideBids(obs: BotObservation): Promise<BotBidDecision>;
  abstract decideRescind(obs: BotObservation, winResult: PeriodResult): Promise<BotRescindDecision>;

  /** Clamp bid to floor and budget. Returns null if can't afford floor. */
  protected clampBid(price: number, obs: BotObservation): number | null {
    const p = Math.max(price, obs.floor_price);
    const totalCost = p * obs.tokens_available;
    if (totalCost > obs.remaining_budget) {
      const maxPrice = obs.remaining_budget / obs.tokens_available;
      if (maxPrice < obs.floor_price) return null;
      return maxPrice;
    }
    return p;
  }

  /** Average clearing price in current stage from history. */
  protected avgStagePrice(obs: BotObservation): number {
    const stagePrices = obs.history
      .filter((h) => h.stage === obs.stage && h.clearing_price > 0 && h.allocations.length > 0)
      .map((h) => h.clearing_price);
    if (stagePrices.length === 0) return obs.floor_price;
    return stagePrices.reduce((a, b) => a + b, 0) / stagePrices.length;
  }
}

// ─── Archetype 1: Aggressive Early Bird ─────────────────────────────────────────

export class AggressiveEarlyBird extends StochasticBot {
  private stageWeights: number[];
  private markup: number;

  constructor(id: string, seed: number, budget: number = 10_000) {
    super(id, seed);
    this.stageWeights = [
      this.rng.range(0.35, 0.50),
      this.rng.range(0.25, 0.40),
    ];
    this.stageWeights.push(1 - this.stageWeights[0] - this.stageWeights[1]);
    this.markup = this.rng.range(2.0, 5.0);
  }

  async decideBids(obs: BotObservation): Promise<BotBidDecision> {
    const stageWeight = this.stageWeights[obs.stage] ?? 0.2;
    const stageBudget = obs.remaining_budget * stageWeight;
    const maxForPeriod = stageBudget / Math.max(1, obs.periods_in_stage - obs.period);
    const maxPrice = maxForPeriod / obs.tokens_available;

    const price = obs.floor_price + this.markup + this.rng.gaussian(0, 0.5);
    const clamped = this.clampBid(Math.min(price, maxPrice), obs);
    if (!clamped) return { bids: [] };
    return { bids: [{ price_per_token: clamped }] };
  }

  async decideRescind(): Promise<BotRescindDecision> {
    return { rescind: this.rng.chance(0.1) };
  }
}

// ─── Archetype 2: Patient Sniper ────────────────────────────────────────────────

export class PatientSniper extends StochasticBot {
  private targetStage: number;
  private earlyBidProb: number;
  private aggressiveness: number;

  constructor(id: string, seed: number) {
    super(id, seed);
    this.targetStage = this.rng.chance(0.7) ? 2 : 1;
    this.earlyBidProb = this.rng.range(0.05, 0.2);
    this.aggressiveness = this.rng.range(2.0, 6.0);
  }

  async decideBids(obs: BotObservation): Promise<BotBidDecision> {
    if (obs.stage < this.targetStage) {
      if (!this.rng.chance(this.earlyBidProb)) return { bids: [] };
      const lowBid = obs.floor_price + this.rng.range(0.1, 0.5);
      const clamped = this.clampBid(lowBid, obs);
      if (!clamped) return { bids: [] };
      return { bids: [{ price_per_token: clamped }] };
    }
    const noise = this.rng.gaussian(0, 1.0);
    const price = obs.floor_price + this.aggressiveness + noise;
    const clamped = this.clampBid(price, obs);
    if (!clamped) return { bids: [] };
    return { bids: [{ price_per_token: clamped }] };
  }

  async decideRescind(): Promise<BotRescindDecision> {
    return { rescind: false };
  }
}

// ─── Archetype 3: Adaptive Tracker ──────────────────────────────────────────────

export class AdaptiveTracker extends StochasticBot {
  private trackingMultiplier: number;
  private coldStartMarkup: number;
  private rescindThreshold: number;
  private budgetConservatism: number;

  constructor(id: string, seed: number) {
    super(id, seed);
    this.trackingMultiplier = this.rng.range(1.01, 1.10);
    this.coldStartMarkup = this.rng.range(0.5, 2.0);
    this.rescindThreshold = this.rng.range(1.10, 1.30);
    this.budgetConservatism = this.rng.range(0.2, 0.5);
  }

  async decideBids(obs: BotObservation): Promise<BotBidDecision> {
    const stagesLeft = obs.stages_remaining + 1;
    const reservePerStage = (obs.remaining_budget * this.budgetConservatism) / stagesLeft;
    const availableNow = obs.remaining_budget - reservePerStage * obs.stages_remaining;
    const maxAffordable = availableNow / obs.tokens_available;

    if (maxAffordable < obs.floor_price) return { bids: [] };

    let price: number;
    const avgPrice = this.avgStagePrice(obs);

    if (obs.period === 0 && obs.history.filter((h) => h.stage === obs.stage).length === 0) {
      price = obs.floor_price + this.coldStartMarkup + this.rng.gaussian(0, 0.3);
    } else {
      price = avgPrice * this.trackingMultiplier + this.rng.gaussian(0, 0.5);
    }

    const clamped = this.clampBid(Math.min(price, maxAffordable), obs);
    if (!clamped) return { bids: [] };
    return { bids: [{ price_per_token: clamped }] };
  }

  async decideRescind(obs: BotObservation, winResult: PeriodResult): Promise<BotRescindDecision> {
    const overpay = winResult.clearing_price / obs.floor_price;
    if (overpay > this.rescindThreshold) return { rescind: this.rng.chance(0.6) };
    return { rescind: false };
  }
}

// ─── Archetype 4: Balanced Spreader ─────────────────────────────────────────────

export class BalancedSpreader extends StochasticBot {
  private intensityAdjust: number;

  constructor(id: string, seed: number) {
    super(id, seed);
    this.intensityAdjust = this.rng.range(1.0, 2.5);
  }

  async decideBids(obs: BotObservation): Promise<BotBidDecision> {
    const totalStages = obs.stages_remaining + obs.stage + 1;
    const budgetPerStage = obs.remaining_budget / Math.max(1, obs.stages_remaining + 1);
    const budgetPerPeriod = budgetPerStage / Math.max(1, obs.periods_in_stage - obs.period);
    let maxPrice = budgetPerPeriod / obs.tokens_available;

    // Adjust intensity based on rank
    const myRank = obs.leaderboard.findIndex((e) => e.bot_id === obs.leaderboard.find(
      (l) => l.bot_id === this.bot_id,
    )?.bot_id);
    if (myRank > 1) maxPrice *= this.intensityAdjust; // bid harder when behind

    const avgPrice = this.avgStagePrice(obs);
    const price = avgPrice > obs.floor_price
      ? avgPrice + this.rng.range(0.2, 1.5)
      : obs.floor_price + this.rng.range(0.5, 2.0);

    const clamped = this.clampBid(Math.min(price, maxPrice), obs);
    if (!clamped) return { bids: [] };
    return { bids: [{ price_per_token: clamped }] };
  }

  async decideRescind(obs: BotObservation, winResult: PeriodResult): Promise<BotRescindDecision> {
    return { rescind: this.rng.chance(0.15) };
  }
}

// ─── Archetype 5: Information Exploiter ─────────────────────────────────────────

export class InformationExploiter extends StochasticBot {
  private rescindFrequency: number;
  private exploitDiscount: number;

  constructor(id: string, seed: number) {
    super(id, seed);
    this.rescindFrequency = this.rng.range(0.3, 0.6);
    this.exploitDiscount = this.rng.range(0.7, 0.95);
  }

  async decideBids(obs: BotObservation): Promise<BotBidDecision> {
    // Check if we have private info about extra supply coming
    const hasPrivateInfo = obs.private_rescind_info.length > 0;

    let price: number;
    if (hasPrivateInfo) {
      // Bid lower knowing supply is coming
      price = obs.floor_price + this.rng.range(0.1, 1.0);
    } else {
      const avgPrice = this.avgStagePrice(obs);
      price = avgPrice * this.exploitDiscount + this.rng.gaussian(0, 0.5);
      price = Math.max(price, obs.floor_price + 0.5);
    }

    const clamped = this.clampBid(price, obs);
    if (!clamped) return { bids: [] };
    return { bids: [{ price_per_token: clamped }] };
  }

  async decideRescind(): Promise<BotRescindDecision> {
    return { rescind: this.rng.chance(this.rescindFrequency) };
  }
}

// ─── Archetype 6: Chaos Agent ───────────────────────────────────────────────────

export class ChaosAgent extends StochasticBot {
  private bidProb: number;
  private maxMarkup: number;
  private rescindProb: number;

  constructor(id: string, seed: number) {
    super(id, seed);
    this.bidProb = this.rng.range(0.3, 0.8);
    this.maxMarkup = this.rng.range(3.0, 8.0);
    this.rescindProb = this.rng.range(0.2, 0.5);
  }

  async decideBids(obs: BotObservation): Promise<BotBidDecision> {
    if (!this.rng.chance(this.bidProb)) return { bids: [] };
    const price = obs.floor_price + this.rng.range(0.1, this.maxMarkup);
    const clamped = this.clampBid(price, obs);
    if (!clamped) return { bids: [] };
    return { bids: [{ price_per_token: clamped }] };
  }

  async decideRescind(): Promise<BotRescindDecision> {
    return { rescind: this.rng.chance(this.rescindProb) };
  }
}

// ─── Bot Factory ────────────────────────────────────────────────────────────────

export type BotArchetype =
  | 'aggressive_early'
  | 'patient_sniper'
  | 'adaptive_tracker'
  | 'balanced_spreader'
  | 'info_exploiter'
  | 'chaos_agent';

export const ALL_ARCHETYPES: BotArchetype[] = [
  'aggressive_early',
  'patient_sniper',
  'adaptive_tracker',
  'balanced_spreader',
  'info_exploiter',
  'chaos_agent',
];

export function createBot(
  archetype: BotArchetype,
  id: string,
  seed: number,
  budget: number = 10_000,
): BotAgent {
  switch (archetype) {
    case 'aggressive_early': return new AggressiveEarlyBird(id, seed, budget);
    case 'patient_sniper': return new PatientSniper(id, seed);
    case 'adaptive_tracker': return new AdaptiveTracker(id, seed);
    case 'balanced_spreader': return new BalancedSpreader(id, seed);
    case 'info_exploiter': return new InformationExploiter(id, seed);
    case 'chaos_agent': return new ChaosAgent(id, seed);
    default: return new BalancedSpreader(id, seed); // fallback
  }
}
