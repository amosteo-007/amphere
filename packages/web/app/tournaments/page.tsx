export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { createAnonServerClient } from '@/lib/supabase/server';
import type { TournamentRow } from '@/lib/types';

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending:   'bg-yellow-500/20 text-yellow-300',
    running:   'bg-blue-500/20 text-blue-300 animate-pulse',
    completed: 'bg-green-500/20 text-green-300',
    failed:    'bg-red-500/20 text-red-300',
    cancelled: 'bg-gray-500/20 text-gray-400',
  };
  return map[status] ?? 'bg-gray-700 text-gray-300';
}

export default async function TournamentsPage() {
  const supabase = createAnonServerClient();
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, status, auction_type, is_test, agents, leaderboard, created_at, completed_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const rows = (tournaments ?? []) as TournamentRow[];

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="text-gray-500 hover:text-white text-sm">← Home</Link>
            <h1 className="text-3xl font-bold mt-2">Tournaments</h1>
          </div>
          <Link href="/leaderboard" className="text-indigo-400 hover:underline text-sm">
            Leaderboard →
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="text-gray-500 text-center py-20">No tournaments yet.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((t) => {
              const winner = t.leaderboard?.[0];
              return (
                <Link
                  key={t.id}
                  href={`/tournaments/${t.id}`}
                  className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3
                             hover:border-indigo-500/40 transition-colors"
                >
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusBadge(t.status)}`}>
                    {t.status}
                  </span>
                  <span className="text-xs text-gray-500">{t.agents.length} bots</span>
                  {winner ? (
                    <span className="text-xs text-green-400">
                      🏆 {winner.bot_id} · {winner.sp} SP
                    </span>
                  ) : (
                    <span className="text-xs text-gray-600">no winner yet</span>
                  )}
                  <span className="ml-auto text-xs text-gray-600 font-mono">{t.id.slice(0, 8)}</span>
                  <span className="text-xs text-gray-600">
                    {new Date(t.created_at).toLocaleDateString()}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
