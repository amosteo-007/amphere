'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ScheduledTournament {
  id: string;
  starts_at: string;
  status: string;
  tournament_id: string | null;
  agents: any[] | null;
}

export default function AdminSchedulePage() {
  const [scheduled, setScheduled] = useState<ScheduledTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [startsAt, setStartsAt] = useState('');
  const [numLLMs, setNumLLMs] = useState(4);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const supabase = createClient();

  useEffect(() => {
    loadScheduled();
  }, []);

  async function loadScheduled() {
    setLoading(true);
    const { data } = await supabase
      .from('scheduled_tournaments')
      .select('id, starts_at, status, tournament_id, agents')
      .order('starts_at', { ascending: true })
      .limit(20);
    setScheduled(data ?? []);
    setLoading(false);
  }

  async function createScheduled(e: React.FormEvent) {
    e.preventDefault();
    if (!startsAt) return;
    setCreating(true);
    setError('');

    // Build LLM agents
    const personas = ['momentum', 'value', 'market_maker', 'noise_trader', 'macro', 'sector_rotator'];
    const agents = Array.from({ length: numLLMs }, (_, i) => ({
      bot_id: `llm_${i + 1}`,
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      persona_name: personas[i % personas.length],
      persona_prompt: '',
    }));

    const { error } = await supabase.from('scheduled_tournaments').insert({
      starts_at: new Date(startsAt).toISOString(),
      agents,
      config: null, // null = use default config in worker
    });

    if (error) {
      setError(error.message);
    } else {
      setStartsAt('');
      await loadScheduled();
    }
    setCreating(false);
  }

  async function cancelScheduled(id: string) {
    if (!confirm('Cancel this scheduled tournament?')) return;
    await supabase.from('scheduled_tournaments').update({ status: 'cancelled' }).eq('id', id);
    setScheduled((prev) => prev.map((s) => s.id === id ? { ...s, status: 'cancelled' } : s));
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Admin — Schedule Tournaments</h1>
        <p className="text-gray-400 mb-8">
          Tournaments scheduled here are auto-promoted to <code className="text-green-400">pending</code>
          {' '}at their start time by the worker.
        </p>

        {/* Create form */}
        <form onSubmit={createScheduled} className="bg-gray-900 rounded-xl p-6 space-y-4 mb-8">
          <h2 className="font-semibold">Schedule new tournament</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Start time</label>
              <input
                type="datetime-local"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white
                           focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">LLM agents</label>
              <input
                type="number"
                min={2}
                max={6}
                value={numLLMs}
                onChange={(e) => setNumLLMs(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white
                           focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm
                       font-medium transition-colors"
          >
            {creating ? 'Scheduling…' : 'Schedule'}
          </button>
        </form>

        {/* List */}
        {loading ? (
          <p className="text-gray-500">Loading…</p>
        ) : scheduled.length === 0 ? (
          <p className="text-gray-500">No scheduled tournaments.</p>
        ) : (
          <div className="space-y-2">
            {scheduled.map((s) => (
              <div key={s.id} className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  s.status === 'scheduled' ? 'bg-yellow-500/20 text-yellow-300' :
                  s.status === 'promoted' ? 'bg-green-500/20 text-green-300' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {s.status}
                </span>
                <span className="text-sm">{new Date(s.starts_at).toLocaleString()}</span>
                <span className="text-xs text-gray-500">{(s.agents ?? []).length} agents</span>
                {s.tournament_id && (
                  <a href={`/tournaments/${s.tournament_id}`} className="text-xs text-indigo-400 hover:underline">
                    view →
                  </a>
                )}
                {s.status === 'scheduled' && (
                  <button
                    onClick={() => cancelScheduled(s.id)}
                    className="ml-auto text-xs text-gray-500 hover:text-red-400 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
