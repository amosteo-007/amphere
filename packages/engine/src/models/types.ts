import Decimal from 'decimal.js';

// ─── ID Generation ──────────────────────────────────────────────────────────────

let _idCounter = 0;

export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${++_idCounter}`;
}

export function resetIdCounter(): void {
  _idCounter = 0;
}

// ─── Tournament Configuration ───────────────────────────────────────────────────

export interface TournamentConfig {
  /** Human-readable tournament name. */
  name: string;

  /** Budget each bot starts with (shared across all stages). */
  budget_per_bot: number;

  /** Stage configurations. Typically 3 stages. */
  stages: StageConfig[];

  /** SP awards per stage rank. Index 0 = 1st place, etc. */
  sp_awards: number[];

  /** Bonus SP for overall weighted points leader. */
  bonus_sp: number;

  /** Number of periods delay before a rescind is publicly revealed. */
  rescind_reveal_delay: number;
}

export interface StageConfig {
  /** Total tokens available in this stage (base, before rescinds). */
  base_token_supply: number;

  /** Minimum bid price per token. */
  floor_price: number;

  /** Weighted points per token acquired in this stage. */
  points_per_token: number;

  /** Number of bidding periods in this stage. */
  num_periods: number;

  /** Duration of each bidding period in seconds (real-time mode). */
  period_duration_seconds: number;

  /** Max bids a bot can submit per period. */
  max_bids_per_period: number;

  /** The clearing strategy to use for this stage. */
  clearing_strategy: ClearingStrategyType;
}

// ─── Clearing Strategy Types ────────────────────────────────────────────────────

export type ClearingStrategyType =
  | 'vickrey'
  | 'uniform_price'
  | 'discriminatory'
  | 'dutch'
  | 'sealed_first';

// ─── Clearing Strategy Interface ────────────────────────────────────────────────

export interface Bid {
  bot_id: string;
  price_per_token: number;
  submission_order: number;
}

export interface PeriodAllocation {
  bot_id: string;
  tokens_won: number;
  price_paid_per_token: number;
  total_paid: number;
}

export interface PeriodClearingResult {
  clearing_price: number;
  allocations: PeriodAllocation[];
  demand_curve: { price: number; cumulative_quantity: number }[];
}

export interface ClearingStrategy {
  readonly type: ClearingStrategyType;
  clear(bids: Bid[], supply: number, floorPrice: number): PeriodClearingResult;
}

// ─── Tournament State ───────────────────────────────────────────────────────────

export type TournamentPhase =
  | 'not_started'
  | 'stage_active'
  | 'stage_transition'
  | 'completed';

export interface BotState {
  bot_id: string;
  remaining_budget: number;
  holdings: TokenHolding[];
  weighted_points: number;
  tokens_per_stage: number[];
  sp: number;
  private_info: PrivateRescindInfo[];
}

export interface TokenHolding {
  stage: number;
  period: number;
  quantity: number;
  price_paid_per_token: number;
  points_per_token: number;
}

export interface PrivateRescindInfo {
  target_stage: number;
  target_period: number;
  tokens: number;
  reveal_at_absolute_period: number;
}

export interface PendingRescind {
  bot_id: string;
  stage: number;
  period: number;
  tokens: number;
  reveal_at_absolute_period: number;
  target_absolute_period: number;
  /** Won tokens to show in the apparent leaderboard during the secrecy window. */
  phantom_quantity: number;
  /** Stage those phantom tokens appear in. */
  phantom_stage: number;
  /** Points multiplier for phantom weighted_points display. */
  phantom_points_per_token: number;
  /** Rescind tax deferred until reveal (not deducted at decision time). */
  tax_tokens: number;
}

export interface RescindSupplyEntry {
  target_absolute_period: number;
  tokens: number;
  source_bot_id: string;
}

// ─── Rescind Detail (per-period analytics) ──────────────────────────────────────

export interface RescindDetail {
  rescind_type: 'cross_stage' | 'within_stage';
  original_win_stage: number;
  original_win_period: number;
  tokens_rescinded: number;
  revelation_stage: number;
  revelation_period: number;
  tax_amount_tokens: number;
  tax_deduction_stage: number;
  /** Whether the phantom gave rescinder a better apparent rank at stage boundary. */
  phantom_sp_benefit: boolean;
  /** Rank the rescinder appeared to have at stage end (with phantom tokens). */
  sp_rank_at_boundary_with_phantom: number | null;
  /** Rank rescinder actually had at stage end (real holdings, no phantom). */
  sp_rank_at_boundary_without_phantom: number | null;
  /** Whether the rescinder won again in the target revelation period. */
  reacquisition_completed: boolean;
  reacquisition_period: number | null;
  reacquisition_price: number | null;
  /** Net weighted-point gain from rescind + cross-stage reacquisition. */
  promotion_profit_weighted_pts: number | null;
}

// ─── Information State (omniscient per-period snapshot) ─────────────────────────

export interface ActivePhantom {
  /** Bot holding the phantom (they rescinded in a recent period). */
  holder: string;
  /** Stage the phantom tokens appear in on the leaderboard. */
  stage: number;
  /** Extra tokens showing on the leaderboard vs actual holdings. */
  delta: number;
  /** Periods remaining until this phantom is publicly revealed. */
  reveals_in: number;
}

export interface RevelationEvent {
  /** Bot whose rescind was just made public this period. */
  agent: string;
  /** Phantom tokens removed from leaderboard display. */
  phantom_resolved: number;
  /** Token tax deducted from their actual holdings. */
  tax_deducted: number;
}

export interface InformationState {
  /** True token holdings of the period winner (excludes phantom). */
  own_true_holdings: number[] | null;
  /** Leaderboard-visible holdings of the winner (includes any active phantom). */
  own_displayed_holdings: number[] | null;
  /** Per-stage difference: displayed − true (non-zero when winner has active phantom). */
  own_phantom_delta: number[] | null;
  /** Leaderboard-visible holdings for each non-winner bot. */
  opponents_displayed: Record<string, number[]>;
  /** Actual true holdings for each non-winner bot. */
  opponents_true: Record<string, number[]>;
  /** Active phantoms from opponents' unrevealed rescinds. */
  active_phantoms: ActivePhantom[];
  /** Rescinds revealed at the start of this period. */
  revelation_events_this_period: RevelationEvent[];
}

// ─── Period Context & Result ────────────────────────────────────────────────────

export interface PeriodContext {
  stage: number;
  period: number;
  absolute_period: number;
  tokens_available: number;
  floor_price: number;
  points_per_token: number;
}

export interface PeriodResult {
  stage: number;
  period: number;
  absolute_period: number;
  tokens_available: number;
  clearing_price: number;
  allocations: PeriodAllocation[];
  winner_bot_id: string | null;
  rescinded: boolean | null; // null = not yet revealed
  num_bidders: number;
  all_bids: { bot_id: string; bid: number | null }[];
  rescind_detail: RescindDetail | null;
  information_state: InformationState | null;
}

// ─── Bot Agent Interface ────────────────────────────────────────────────────────

export interface BotObservation {
  /** Current stage (0-indexed). */
  stage: number;
  /** Current period within stage (0-indexed). */
  period: number;
  /** Absolute period across all stages. */
  absolute_period: number;
  /** Total periods in this stage. */
  periods_in_stage: number;
  /** Remaining stages after this one. */
  stages_remaining: number;

  /** Tokens auctioned this period. */
  tokens_available: number;
  /** Minimum bid price. */
  floor_price: number;
  /** Points multiplier for this stage. */
  points_per_token: number;

  /** Your remaining budget. */
  remaining_budget: number;
  /** Your current SP. */
  sp: number;
  /** Your weighted points total. */
  weighted_points: number;
  /** Your tokens per stage. */
  tokens_per_stage: number[];

  /** Full period history (public info only). */
  history: PeriodResult[];

  /** Leaderboard: all bots' public state. */
  leaderboard: LeaderboardEntry[];

  /** Private rescind info only you know about. */
  private_rescind_info: PrivateRescindInfo[];

  /** Token tax required to rescind this period's win (only set during rescind decision). */
  rescind_tax_tokens?: number;
  /** Whether you currently hold enough tokens (excluding the just-won batch) to pay the tax. */
  can_afford_rescind_tax?: boolean;
}

export interface LeaderboardEntry {
  bot_id: string;
  tokens_per_stage: number[];
  weighted_points: number;
  sp: number;
}

export interface BotBidDecision {
  bids: { price_per_token: number }[];
}

export interface BotRescindDecision {
  rescind: boolean;
}

export interface BotAgent {
  readonly bot_id: string;
  decideBids(observation: BotObservation): Promise<BotBidDecision>;
  decideRescind(observation: BotObservation, winResult: PeriodResult): Promise<BotRescindDecision>;
}

// ─── Result Types ───────────────────────────────────────────────────────────────

export interface TournamentResult {
  config: TournamentConfig;
  final_leaderboard: LeaderboardEntry[];
  winner_bot_id: string;
  all_period_results: PeriodResult[];
  bot_summaries: Map<string, BotSummary>;
}

export interface BotSummary {
  bot_id: string;
  total_sp: number;
  weighted_points: number;
  tokens_per_stage: number[];
  budget_spent: number;
  budget_remaining: number;
  periods_won: number;
  rescinds_made: number;
  avg_price_paid: number;
  capital_efficiency: number;
}
