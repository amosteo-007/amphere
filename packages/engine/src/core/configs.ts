import { TournamentConfig, StageConfig } from '../models/types.js';

/**
 * Default 3-stage tournament: 9 periods/stage, 27 total.
 */
export function createDefaultTournamentConfig(
  overrides?: Partial<TournamentConfig>,
): TournamentConfig {
  const stages: StageConfig[] = [
    {
      base_token_supply: 900,
      floor_price: 10.0,
      points_per_token: 1.0,
      num_periods: 9,
      period_duration_seconds: 60,
      max_bids_per_period: 1,
      clearing_strategy: 'vickrey',
    },
    {
      base_token_supply: 600,
      floor_price: 15.0,
      points_per_token: 1.5,
      num_periods: 9,
      period_duration_seconds: 60,
      max_bids_per_period: 1,
      clearing_strategy: 'vickrey',
    },
    {
      base_token_supply: 300,
      floor_price: 31.0,
      points_per_token: 2.5,
      num_periods: 9,
      period_duration_seconds: 60,
      max_bids_per_period: 1,
      clearing_strategy: 'vickrey',
    },
  ];

  return {
    name: 'Default Tournament',
    budget_per_bot: 10_000,
    stages,
    sp_awards: [3, 2, 1],
    bonus_sp: 1,
    rescind_reveal_delay: 2,
    ...overrides,
  };
}

/**
 * Condensed 3-stage tournament: 5 periods/stage, 15 total.
 * Steeper floor escalation ($10→$15→$28) with 3.0× Stage 3 multiplier.
 * Budget coverage ~55%: bots can win ~8 of 15 periods at floor.
 */
export function createCondensedTournamentConfig(
  overrides?: Partial<TournamentConfig>,
): TournamentConfig {
  const stages: StageConfig[] = [
    {
      base_token_supply: 600,
      floor_price: 10.0,
      points_per_token: 1.0,
      num_periods: 5,
      period_duration_seconds: 60,
      max_bids_per_period: 1,
      clearing_strategy: 'vickrey',
    },
    {
      base_token_supply: 400,
      floor_price: 15.0,
      points_per_token: 1.5,
      num_periods: 5,
      period_duration_seconds: 60,
      max_bids_per_period: 1,
      clearing_strategy: 'vickrey',
    },
    {
      base_token_supply: 200,
      floor_price: 28.0,
      points_per_token: 3.0,
      num_periods: 5,
      period_duration_seconds: 60,
      max_bids_per_period: 1,
      clearing_strategy: 'vickrey',
    },
  ];
  return {
    name: 'Condensed Tournament',
    budget_per_bot: 10_000,
    stages,
    sp_awards: [3, 2, 1],
    bonus_sp: 1,
    rescind_reveal_delay: 2,
    ...overrides,
  };
}

/**
 * Test config: 2 periods/stage derived from condensed config, for fast iterations.
 */
export function createTestTournamentConfig(
  overrides?: Partial<TournamentConfig>,
): TournamentConfig {
  const condensed = createCondensedTournamentConfig(overrides);
  return {
    ...condensed,
    name: 'Test Tournament',
    stages: condensed.stages.map((s) => ({
      ...s,
      num_periods: 2,
      base_token_supply: Math.round(s.base_token_supply / 5 * 2),
    })),
  };
}
