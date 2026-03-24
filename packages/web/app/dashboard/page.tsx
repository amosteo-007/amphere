export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import type { TournamentRow } from '@/lib/types';

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
    running: 'bg-blue-500/20 text-blue-300 border border-blue-500/40 animate-pulse',
    completed: 'bg-green-500/20 text-green-300 border border-green-500/40',
    failed: 'bg-red-500/20 text-red-300 border border-red-500/40',
    cancelled: 'bg-gray-500/20 text-gray-400 border border-gray-500/40',
  };
  return map[status] ?? 'bg-gray-700 text-gray-300';
}

export default async function Dashboard() {
  const supabase = createServerClient();
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, status, auction_type, is_test, agents, leaderboard, error, created_at, started_at, completed_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const rows = (tournaments ?? []) as TournamentRow[];

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-gray-400 mt-1">Tournament history</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/bots"
              className="px-4 py-2 border border-gray-700 hover:border-gray-500 rounded-lg text-sm transition-colors"
            >
              My Bots
            </Link>
            <Link
              href="/practice"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
            >
              Practice
            </Link>
          </div>
        </div>

        {/* Tournament list */}
        {rows.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg">No tournaments yet.</p>
            <p className="text-sm mt-2">
              <Link href="/practice" className="text-indigo-400 hover:underline">Start a practice round</Link>
              {' '}to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((t) => {
              const winner = t.leaderboard?.[0];
              const created = new Date(t.created_at).toLocaleString();
              return (
                <Link
                  key={t.id}
                  href={`/tournaments/${t.id}`}
                  className="block bg-gray-900 border border-gray-800 rounded-lg p-4
                             hover:border-indigo-500/40 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusBadge(t.status)}`}>
                      {t.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">{t.is_test ? 'TEST' : 'FULL'}</span>
                    <span className="text-xs text-gray-500">{t.agents.length} agents</span>
                    {winner && (
                      <span className="text-xs text-green-400">
                        Winner: {winner.bot_id} ({winner.sp} SP)
                      </span>
                    )}
                    <span className="ml-auto text-xs text-gray-600">{created}</span>
                    <span className="text-xs text-gray-600 font-mono">{t.id.slice(0, 8)}…</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
