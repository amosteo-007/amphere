'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { PLANS } from '@/lib/stripe';

interface MeData {
  tier: string;
  subscription: { current_period_end: string | null } | null;
}

export default function BillingPage() {
  const [me, setMe] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetch('/api/me').then((r) => r.json()).then((d) => { setMe(d); setLoading(false); });
  }, []);

  async function startCheckout(tier: 'standard' | 'plus') {
    setCheckoutLoading(tier);
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setCheckoutLoading(null);
  }

  async function openPortal() {
    setPortalLoading(true);
    const res = await fetch('/api/billing/portal', { method: 'POST' });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setPortalLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  const currentTier = me?.tier ?? 'free';
  const periodEnd = me?.subscription?.current_period_end;

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Billing</h1>
        <p className="text-gray-400 mb-8">
          Current plan: <span className="text-white font-medium capitalize">{currentTier}</span>
          {periodEnd && (
            <span className="text-gray-500 ml-2">
              · renews {new Date(periodEnd).toLocaleDateString()}
            </span>
          )}
        </p>

        {currentTier !== 'free' && (
          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="mb-8 px-4 py-2 border border-gray-700 hover:border-gray-500 rounded-lg text-sm
                       transition-colors disabled:opacity-50"
          >
            {portalLoading ? 'Opening…' : 'Manage subscription →'}
          </button>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(Object.entries(PLANS) as [keyof typeof PLANS, typeof PLANS[keyof typeof PLANS]][]).map(([tier, plan]) => {
            const isCurrentTier = currentTier === tier;
            const isUpgrade = currentTier === 'free' || (currentTier === 'standard' && tier === 'plus');

            return (
              <div
                key={tier}
                className={`rounded-xl border p-6 ${
                  isCurrentTier ? 'border-indigo-500 bg-indigo-500/5' : 'border-gray-800 bg-gray-900'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold">{plan.name}</h2>
                    <p className="text-2xl font-bold mt-1">
                      ${(plan.amount / 100).toFixed(2)}
                      <span className="text-sm font-normal text-gray-400">/mo</span>
                    </p>
                  </div>
                  {isCurrentTier && (
                    <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30
                                     px-2 py-0.5 rounded-full">
                      Current
                    </span>
                  )}
                </div>

                <ul className="space-y-1.5 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-green-400 mt-0.5">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {!isCurrentTier && isUpgrade && (
                  <button
                    onClick={() => startCheckout(tier)}
                    disabled={checkoutLoading !== null}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg
                               text-sm font-medium transition-colors"
                  >
                    {checkoutLoading === tier ? 'Redirecting…' : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
