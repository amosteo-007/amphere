export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServerClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

// POST /api/billing/webhook
// Stripe webhook handler — updates user_subscriptions on payment events.
// Excluded from middleware auth check.
export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event: Stripe.Event;
  const rawBody = await req.text();

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createServerClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const tier = session.metadata?.tier;
      const subscriptionId = session.subscription as string;

      if (userId && tier && subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await supabase.from('user_subscriptions').upsert({
          user_id: userId,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscriptionId,
          tier,
          current_period_end: new Date((subscription.items.data[0]?.current_period_end ?? subscription.billing_cycle_anchor) * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        });

        // Sync tier to all registered bots owned by this user
        await supabase
          .from('registered_bots')
          .update({ subscription_tier: tier })
          .eq('owner_id', userId);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const tier = sub.metadata?.tier ?? (sub.items.data[0]?.price.metadata?.tier as string | undefined);

      if (customerId) {
        const updates: Record<string, unknown> = {
          current_period_end: new Date((sub.items.data[0]?.current_period_end ?? sub.billing_cycle_anchor) * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (tier) updates.tier = tier;

        const { data: updatedSub } = await supabase
          .from('user_subscriptions')
          .update(updates)
          .eq('stripe_customer_id', customerId)
          .select('user_id')
          .maybeSingle();

        if (updatedSub?.user_id && tier) {
          await supabase
            .from('registered_bots')
            .update({ subscription_tier: tier })
            .eq('owner_id', updatedSub.user_id);
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const { data: updatedSub } = await supabase
        .from('user_subscriptions')
        .update({ tier: 'free', stripe_subscription_id: null, updated_at: new Date().toISOString() })
        .eq('stripe_customer_id', sub.customer as string)
        .select('user_id')
        .maybeSingle();

      if (updatedSub?.user_id) {
        await supabase
          .from('registered_bots')
          .update({ subscription_tier: 'free' })
          .eq('owner_id', updatedSub.user_id);
      }
      break;
    }

    default:
      // Ignore other events
      break;
  }

  return NextResponse.json({ received: true });
}
