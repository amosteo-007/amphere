export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createSupabase } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { stripe, PLANS, PlanTier } from '@/lib/stripe';
import { cookies } from 'next/headers';

// POST /api/billing/checkout
// Body: { tier: 'standard' | 'plus' }
// Creates a Stripe checkout session and returns the URL to redirect to.
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { tier } = await req.json() as { tier?: PlanTier };
  if (!tier || !(tier in PLANS)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const plan = PLANS[tier as keyof typeof PLANS];
  const supabase = createSupabase();

  // Get or create Stripe customer
  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('stripe_customer_id, tier')
    .eq('user_id', user.id)
    .maybeSingle();

  let customerId = sub?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;

    await supabase.from('user_subscriptions').upsert({
      user_id: user.id,
      stripe_customer_id: customerId,
      tier: 'free',
    });
  }

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: `${origin}/billing?success=1`,
    cancel_url: `${origin}/billing`,
    metadata: { user_id: user.id, tier },
  });

  return NextResponse.json({ url: session.url });
}
