import { ClearingStrategy, ClearingStrategyType } from '../models/types.js';
import { VickreyStrategy } from './vickrey.js';
import { UniformPriceStrategy } from './uniformPrice.js';
import { DiscriminatoryStrategy, DutchStrategy, SealedFirstPriceStrategy } from './placeholders.js';

const registry: Record<ClearingStrategyType, () => ClearingStrategy> = {
  vickrey: () => new VickreyStrategy(),
  uniform_price: () => new UniformPriceStrategy(),
  discriminatory: () => new DiscriminatoryStrategy(),
  dutch: () => new DutchStrategy(),
  sealed_first: () => new SealedFirstPriceStrategy(),
};

export function getStrategy(type: ClearingStrategyType): ClearingStrategy {
  const factory = registry[type];
  if (!factory) throw new Error(`Unknown clearing strategy: ${type}`);
  return factory();
}

export function isImplemented(type: ClearingStrategyType): boolean {
  try {
    const s = getStrategy(type);
    s.clear([], 100, 10);
    return true;
  } catch {
    return false;
  }
}
