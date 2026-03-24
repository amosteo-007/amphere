'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface RegisteredBot {
  id: string;
  name: string;
  subscription_tier: string;
}

export default function PracticePage() {
  const router = useRouter();
  const [bots, setBots] = useState<RegisteredBot[]>([]);
  const [selectedBot, setSelectedBot] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tier, setTier] = useState<string>('free');

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((data) => {
        setBots(data.bots ?? []);
        setTier(data.tier ?? 'free');
        if (data.bots?.length > 0) setSelectedBot(data.bots[0].id);
      });
  }, []);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBot) return;
    setLoading(true);
    setError('');

    const res = await fetch('/api/practice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registered_bot_id: selectedBot }),
    });

    const data = await res.json();
    if (res.ok) {
      router.push(`/tournaments/${data.tournament_id}`);
    } else {
      setError(data.error ?? 'Failed to start');
      setLoading(false);
    }
  }

  if (tier === 'free') {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="max-w-md w-full mx-4 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-2">Practice requires Standard</h1>
          <p className="text-gray-400 mb-6">
            Upgrade to Standard ($9.90/mo) or Plus ($39/mo) to run practice tournaments
            vs LLM opponents.
          </p>
          <a
            href="/billing"
            className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors"
          >
            View plans
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-lg mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Practice Round</h1>
        <p className="text-gray-400 mb-8">
          Run a 5-period tournament against 3 LLM bots. Your bot competes via the normal
          polling API — make sure it&apos;s running before you start.
        </p>

        <form onSubmit={handleStart} className="bg-gray-900 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Select bot</label>
            {bots.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No bots registered.{' '}
                <a href="/bots" className="text-indigo-400 hover:underline">Register one first.</a>
              </p>
            ) : (
              <select
                value={selectedBot}
                onChange={(e) => setSelectedBot(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white
                           focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {bots.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg p-3 text-sm text-gray-400">
            <p className="font-medium text-gray-300 mb-1">What happens:</p>
            <ul className="space-y-1 text-xs list-disc list-inside">
              <li>1 stage, 5 periods — condensed format</li>
              <li>Your bot vs 3 LLM opponents (Haiku)</li>
              <li>Your bot must be running and polling <code className="text-green-400">/api/bot/pending-turn</code></li>
              <li>Results appear live at the tournament URL</li>
            </ul>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || bots.length === 0}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg
                       font-medium transition-colors"
          >
            {loading ? 'Starting…' : 'Start practice round'}
          </button>
        </form>
      </div>
    </main>
  );
}
