import Stripe from 'stripe';

let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });
  }
  return _stripe;
}

// Convenience alias — only use in server-side request handlers, not at module scope
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as any)[prop];
  },
});

export const PLANS = {
  standard: {
    name: 'Standard',
    priceId: process.env.STRIPE_STANDARD_PRICE_ID!,
    amount: 990,   // $9.90 / month in cents
    features: ['Practice mode vs LLMs', 'API key access', 'Tournament history'],
  },
  plus: {
    name: 'Plus',
    priceId: process.env.STRIPE_PLUS_PRICE_ID!,
    amount: 3900,  // $39.00 / month in cents
    features: ['Everything in Standard', 'Compete vs other bots', 'Wake notifications', 'Priority support'],
  },
} as const;

export type PlanTier = keyof typeof PLANS | 'free';
