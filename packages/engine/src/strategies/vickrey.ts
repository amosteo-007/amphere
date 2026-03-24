import {
  ClearingStrategy,
  ClearingStrategyType,
  Bid,
  PeriodClearingResult,
  PeriodAllocation,
} from '../models/types.js';

/**
 * Vickrey (Second-Price) Auction Strategy
 *
 * Single-winner: highest bidder wins ALL tokens, pays the second-highest bid.
 * If only one bidder, pays floor price.
 * Ties broken by submission_order (lower = earlier = wins).
 */
export class VickreyStrategy implements ClearingStrategy {
  readonly type: ClearingStrategyType = 'vickrey';

  clear(bids: Bid[], supply: number, floorPrice: number): PeriodClearingResult {
    // Filter valid bids (at or above floor)
    const validBids = bids
      .filter((b) => b.price_per_token >= floorPrice)
      .sort((a, b) => {
        if (b.price_per_token !== a.price_per_token)
          return b.price_per_token - a.price_per_token;
        return a.submission_order - b.submission_order; // earlier wins ties
      });

    if (validBids.length === 0) {
      return {
        clearing_price: floorPrice,
        allocations: [],
        demand_curve: [],
      };
    }

    const winner = validBids[0];
    const secondPrice =
      validBids.length > 1 ? validBids[1].price_per_token : floorPrice;

    const clearingPrice = Math.max(secondPrice, floorPrice);
    const totalPaid = clearingPrice * supply;

    const allocations: PeriodAllocation[] = [
      {
        bot_id: winner.bot_id,
        tokens_won: supply,
        price_paid_per_token: clearingPrice,
        total_paid: totalPaid,
      },
    ];

    // Build demand curve
    let cumulative = 0;
    const demand_curve = validBids.map((b) => {
      cumulative += supply; // each bidder wants all tokens
      return { price: b.price_per_token, cumulative_quantity: cumulative };
    });

    return { clearing_price: clearingPrice, allocations, demand_curve };
  }
}
