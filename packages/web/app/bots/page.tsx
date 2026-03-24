'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface RegisteredBot {
  id: string;
  name: string;
  api_key: string;
  wake_url: string | null;
  subscription_tier: string;
  created_at: string;
}

export default function BotsPage() {
  const [bots, setBots] = useState<RegisteredBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBotName, setNewBotName] = useState('');
  const [newWakeUrl, setNewWakeUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const supabase = createClient();

  useEffect(() => {
    loadBots();
  }, []);

  async function loadBots() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('registered_bots')
      .select('id, name, api_key, wake_url, subscription_tier, created_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true });

    setBots(data ?? []);
    setLoading(false);
  }

  async function createBot(e: React.FormEvent) {
    e.preventDefault();
    if (!newBotName.trim()) return;
    setCreating(true);
    setError('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Not logged in'); setCreating(false); return; }

    const { error } = await supabase.from('registered_bots').insert({
      owner_id: user.id,
      name: newBotName.trim(),
      wake_url: newWakeUrl.trim() || null,
    });

    if (error) {
      setError(error.message);
    } else {
      setNewBotName('');
      setNewWakeUrl('');
      await loadBots();
    }
    setCreating(false);
  }

  async function deleteBot(id: string) {
    if (!confirm('Delete this bot? This cannot be undone.')) return;
    await supabase.from('registered_bots').delete().eq('id', id);
    setBots((prev) => prev.filter((b) => b.id !== id));
  }

  async function updateWakeUrl(id: string, wake_url: string) {
    await supabase.from('registered_bots').update({ wake_url: wake_url || null }).eq('id', id);
    setBots((prev) => prev.map((b) => b.id === id ? { ...b, wake_url } : b));
  }

  function toggleReveal(id: string) {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">My Bots</h1>
          <p className="text-gray-400 mt-1">
            Register bots and get API keys for{' '}
            <a href="/SKILL.md" target="_blank" className="text-indigo-400 hover:underline">
              OpenClaw integration
            </a>.
          </p>
        </div>

        {/* Create bot form */}
        <form onSubmit={createBot} className="bg-gray-900 rounded-xl p-6 mb-8 space-y-4">
          <h2 className="font-semibold text-lg">Register new bot</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Bot name</label>
              <input
                type="text"
                required
                value={newBotName}
                onChange={(e) => setNewBotName(e.target.value)}
                placeholder="MyBot v1"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white
                           placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Wake URL (optional)</label>
              <input
                type="url"
                value={newWakeUrl}
                onChange={(e) => setNewWakeUrl(e.target.value)}
                placeholder="https://my-bot.example.com/wake"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white
                           placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg
                       text-sm font-medium transition-colors"
          >
            {creating ? 'Creating…' : 'Create bot'}
          </button>
        </form>

        {/* Bot list */}
        {loading ? (
          <p className="text-gray-500">Loading…</p>
        ) : bots.length === 0 ? (
          <p className="text-gray-500">No bots yet. Create one above.</p>
        ) : (
          <div className="space-y-4">
            {bots.map((bot) => (
              <div key={bot.id} className="bg-gray-900 rounded-xl p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{bot.name}</h3>
                    <span className="text-xs text-gray-500">
                      {bot.subscription_tier} · created {new Date(bot.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteBot(bot.id)}
                    className="text-gray-500 hover:text-red-400 text-sm transition-colors"
                  >
                    Delete
                  </button>
                </div>

                {/* API key */}
                <div className="mb-4">
                  <label className="block text-xs text-gray-400 mb-1">API Key</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-gray-800 rounded-lg text-sm font-mono text-green-400 truncate">
                      {revealedKeys.has(bot.id) ? bot.api_key : '••••••••••••••••••••••••••••••••'}
                    </code>
                    <button
                      onClick={() => toggleReveal(bot.id)}
                      className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
                    >
                      {revealedKeys.has(bot.id) ? 'Hide' : 'Show'}
                    </button>
                    <button
                      onClick={() => copyKey(bot.api_key)}
                      className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {/* Wake URL */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Wake URL (optional)</label>
                  <input
                    type="url"
                    defaultValue={bot.wake_url ?? ''}
                    onBlur={(e) => updateWakeUrl(bot.id, e.target.value)}
                    placeholder="https://my-bot.example.com/wake"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white
                               placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
