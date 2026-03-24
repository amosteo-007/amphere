import Decimal from 'decimal.js';
import {
  ClearingStrategy,
  ClearingStrategyType,
  Bid,
  PeriodClearingResult,
  PeriodAllocation,
} from '../models/types.js';

/**
 * Uniform Price Auction Strategy
 *
 * Multi-winner: all winners pay the same clearing price.
 * Bids above clearing get full fill. Bids at clearing get pro-rata.
 */
export class UniformPriceStrategy implements ClearingStrategy {
  readonly type: ClearingStrategyType = 'uniform_price';

  clear(bids: Bid[], supply: number, floorPrice: number): PeriodClearingResult {
    const validBids = bids
      .filter((b) => b.price_per_token >= floorPrice)
      .sort((a, b) => b.price_per_token - a.price_per_token);

    if (validBids.length === 0) {
      return {
        clearing_price: floorPrice,
        allocations: [],
        demand_curve: [],
      };
    }

    // Each bid demands: amount / price tokens (for simplicity in tournament, each bid demands all supply)
    // For the tournament context, treat each bid as wanting `supply` tokens
    // In the CCA context, bids have amount_allocated and we compute quantity = amount / price
    // Here we use a simpler model: each bidder bids a price, wins proportional share

    // Build cumulative demand
    let cumulative = 0;
    const demand_curve: { price: number; cumulative_quantity: number }[] = [];
    const bidQuantities = validBids.map((b) => {
      const qty = supply; // each wants all
      cumulative += qty;
      demand_curve.push({ price: b.price_per_token, cumulative_quantity: cumulative });
      return { ...b, quantity: qty };
    });

    // Find clearing price
    let clearingPrice = floorPrice;
    cumulative = 0;
    for (const bq of bidQuantities) {
      cumulative += bq.quantity;
      if (cumulative >= supply) {
        clearingPrice = bq.price_per_token;
        break;
      }
    }

    // Under-subscription
    const totalDemand = validBids.length * supply;
    if (totalDemand <= supply) {
      clearingPrice = floorPrice;
      const allocations: PeriodAllocation[] = validBids.map((b) => ({
        bot_id: b.bot_id,
        tokens_won: supply / validBids.length,
        price_paid_per_token: floorPrice,
        total_paid: (supply / validBids.length) * floorPrice,
      }));
      return { clearing_price: floorPrice, allocations, demand_curve };
    }

    // Allocate: above clearing = full, at clearing = pro-rata
    const allocations: PeriodAllocation[] = [];
    let allocated = 0;

    const aboveClearing = validBids.filter((b) => b.price_per_token > clearingPrice);
    const atClearing = validBids.filter((b) => b.price_per_token === clearingPrice);

    for (const b of aboveClearing) {
      const tokens = supply / validBids.length; // simplified equal share above
      allocations.push({
        bot_id: b.bot_id,
        tokens_won: tokens,
        price_paid_per_token: clearingPrice,
        total_paid: tokens * clearingPrice,
      });
      allocated += tokens;
    }

    if (atClearing.length > 0 && allocated < supply) {
      const remaining = supply - allocated;
      const perBidder = remaining / atClearing.length;
      for (const b of atClearing) {
        allocations.push({
          bot_id: b.bot_id,
          tokens_won: perBidder,
          price_paid_per_token: clearingPrice,
          total_paid: perBidder * clearingPrice,
        });
      }
    }

    return { clearing_price: clearingPrice, allocations, demand_curve };
  }
}
