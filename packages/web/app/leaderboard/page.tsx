export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { createAnonServerClient } from '@/lib/supabase/server';

interface LeaderboardRow {
  bot_id: string;
  total_sp: number;
  tournaments: number;
  avg_sp: number;
  total_wins: number;
  avg_spent: number;
}

export default async function LeaderboardPage() {
  const supabase = createAnonServerClient();

  // Aggregate SP across all completed tournaments
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('leaderboard')
    .eq('status', 'completed')
    .not('leaderboard', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(100);

  // Aggregate by bot_id across all tournaments
  const botStats = new Map<string, { sp: number; wins: number; spent: number; count: number }>();

  for (const t of tournaments ?? []) {
    const lb = t.leaderboard as any[];
    if (!Array.isArray(lb)) continue;
    lb.forEach((entry, idx) => {
      const prev = botStats.get(entry.bot_id) ?? { sp: 0, wins: 0, spent: 0, count: 0 };
      botStats.set(entry.bot_id, {
        sp: prev.sp + (entry.sp ?? 0),
        wins: prev.wins + (entry.periods_won ?? 0),
        spent: prev.spent + (entry.spent ?? 0),
        count: prev.count + 1,
      });
    });
  }

  const rows: LeaderboardRow[] = [...botStats.entries()]
    .map(([bot_id, s]) => ({
      bot_id,
      total_sp: s.sp,
      tournaments: s.count,
      avg_sp: Math.round((s.sp / s.count) * 10) / 10,
      total_wins: s.wins,
      avg_spent: Math.round(s.spent / s.count),
    }))
    .sort((a, b) => b.total_sp - a.total_sp)
    .slice(0, 50);

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="text-gray-500 hover:text-white text-sm">← Home</Link>
            <h1 className="text-3xl font-bold mt-2">Leaderboard</h1>
            <p className="text-gray-400 text-sm mt-1">Cumulative SP across all tournaments</p>
          </div>
          <Link href="/tournaments" className="text-indigo-400 hover:underline text-sm">
            All tournaments →
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="text-gray-500 text-center py-20">No completed tournaments yet.</p>
        ) : (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800 text-xs">
                  <th className="text-left px-4 py-3">#</th>
                  <th className="text-left px-4 py-3">Bot</th>
                  <th className="text-right px-4 py-3">Total SP</th>
                  <th className="text-right px-4 py-3">Avg SP</th>
                  <th className="text-right px-4 py-3">Tournaments</th>
                  <th className="text-right px-4 py-3">Period Wins</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.bot_id} className={`border-b border-gray-800/50 ${i === 0 ? 'text-yellow-300' : i < 3 ? 'text-gray-200' : 'text-gray-400'}`}>
                    <td className="px-4 py-2.5 text-gray-500 font-mono">{i + 1}</td>
                    <td className="px-4 py-2.5 font-mono">{row.bot_id}</td>
                    <td className="px-4 py-2.5 text-right font-bold">{row.total_sp}</td>
                    <td className="px-4 py-2.5 text-right">{row.avg_sp}</td>
                    <td className="px-4 py-2.5 text-right">{row.tournaments}</td>
                    <td className="px-4 py-2.5 text-right">{row.total_wins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
