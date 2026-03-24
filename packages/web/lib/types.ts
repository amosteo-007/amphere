// Shared TypeScript types mirroring the Supabase schema.

export type TournamentStatus = 'pending' | 'running' | 'cancelling' | 'cancelled' | 'completed' | 'failed';

export interface TournamentRow {
  id: string;
  status: TournamentStatus;
  auction_type: string;
  is_test: boolean;
  config: TournamentConfig | null;
  agents: AgentConfig[];
  leaderboard: LeaderboardEntry[] | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface RescindDetail {
  rescind_type: 'cross_stage' | 'within_stage';
  original_win_stage: number;
  original_win_period: number;
  tokens_rescinded: number;
  revelation_stage: number;
  revelation_period: number;
  tax_amount_tokens: number;
  tax_deduction_stage: number;
  phantom_sp_benefit: boolean;
}

export interface PeriodResultRow {
  id: string;
  tournament_id: string;
  absolute_period: number;
  stage: number;
  period: number;
  tokens_available: number;
  clearing_price: number;
  winner_bot_id: string;
  tokens_won: number;
  total_paid: number;
  rescinded: boolean;
  num_bidders: number;
  all_bids: { bot_id: string; bid: number | null }[] | null;
  rescind_detail: RescindDetail | null;
  created_at: string;
}

export interface AgentConfig {
  bot_id: string;
  provider: string;
  model: string;
  persona_name: string;
  persona_prompt: string;
  registered_bot_id?: string; // set for external bots
}

export interface LeaderboardEntry {
  bot_id: string;
  sp: number;
  weighted_points: number;
  tokens_per_stage: number[];
  spent: number;
  remaining: number;
  periods_won: number;
  rescinds: number;
}

export interface TournamentConfig {
  name: string;
  budget_per_bot: number;
  stages: StageConfig[];
  sp_awards: number[];
  bonus_sp: number;
  rescind_reveal_delay: number;
}

export interface StageConfig {
  base_token_supply: number;
  floor_price: number;
  points_per_token: number;
  num_periods: number;
  clearing_strategy: string;
  max_bids_per_period: number;
  period_duration_seconds: number;
}

export interface HumanTurnRow {
  id: string;
  tournament_id: string;
  bot_id: string;
  stage: number;
  period: number;
  decision_type: 'bid' | 'rescind';
  context: Record<string, any>;
  response: Record<string, any> | null;
  expires_at: string;
}
