import {
  ClearingStrategy,
  ClearingStrategyType,
  Bid,
  PeriodClearingResult,
} from '../models/types.js';

/**
 * Discriminatory (Pay-As-Bid) Auction — PLACEHOLDER
 * Each winner pays their own bid price.
 */
export class DiscriminatoryStrategy implements ClearingStrategy {
  readonly type: ClearingStrategyType = 'discriminatory';

  clear(_bids: Bid[], _supply: number, floorPrice: number): PeriodClearingResult {
    throw new Error(
      'DiscriminatoryStrategy not yet implemented. ' +
      'Each winner should pay their own bid price, sorted highest-first, ' +
      'until supply exhausted. Pro-rata at the marginal price.',
    );
  }
}

/**
 * Dutch (Descending Price) Auction — PLACEHOLDER
 * Price descends from a ceiling; first to accept wins.
 */
export class DutchStrategy implements ClearingStrategy {
  readonly type: ClearingStrategyType = 'dutch';

  clear(_bids: Bid[], _supply: number, floorPrice: number): PeriodClearingResult {
    throw new Error(
      'DutchStrategy not yet implemented. ' +
      'Requires real-time descending clock. In sealed-bid simulation, ' +
      'treat bid as the price at which the bidder would accept.',
    );
  }
}

/**
 * Sealed First-Price Auction — PLACEHOLDER
 * Highest bid wins, pays own bid price.
 */
export class SealedFirstPriceStrategy implements ClearingStrategy {
  readonly type: ClearingStrategyType = 'sealed_first';

  clear(_bids: Bid[], _supply: number, floorPrice: number): PeriodClearingResult {
    throw new Error(
      'SealedFirstPriceStrategy not yet implemented. ' +
      'Identical to Vickrey but winner pays first price (own bid) instead of second.',
    );
  }
}
