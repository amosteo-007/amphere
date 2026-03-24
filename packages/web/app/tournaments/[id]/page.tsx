export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createAnonServerClient } from '@/lib/supabase/server';
import type { TournamentRow, PeriodResultRow } from '@/lib/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    pending: 'text-yellow-400',
    running: 'text-blue-400 animate-pulse',
    completed: 'text-green-400',
    failed: 'text-red-400',
    cancelled: 'text-gray-500',
  };
  return map[status] ?? 'text-gray-400';
}

export default async function TournamentPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = createAnonServerClient();

  const [tourneyRes, periodsRes] = await Promise.all([
    supabase
      .from('tournaments')
      .select('id, status, auction_type, is_test, config, agents, leaderboard, error, created_at, started_at, completed_at')
      .eq('id', id)
      .single(),
    supabase
      .from('period_results')
      .select('id, tournament_id, absolute_period, stage, period, tokens_available, clearing_price, winner_bot_id, tokens_won, total_paid, rescinded, num_bidders, created_at')
      .eq('tournament_id', id)
      .order('absolute_period', { ascending: true }),
  ]);

  if (tourneyRes.error || !tourneyRes.data) notFound();

  const tournament = tourneyRes.data as TournamentRow;
  const periods = (periodsRes.data ?? []) as PeriodResultRow[];

  const leaderboard = tournament.leaderboard ?? [];
  const stageGroups = periods.reduce((acc, p) => {
    if (!acc[p.stage]) acc[p.stage] = [];
    acc[p.stage].push(p);
    return acc;
  }, {} as Record<number, PeriodResultRow[]>);

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/tournaments" className="text-gray-500 hover:text-white text-sm">← Tournaments</Link>
          <span className="text-gray-700">/</span>
          <span className="font-mono text-sm text-gray-400">{id.slice(0, 8)}…</span>
          <span className={`text-sm font-medium ${statusColor(tournament.status)}`}>
            {tournament.status}
          </span>
        </div>

        {/* Agents */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tournament.agents.map((a) => (
            <span key={a.bot_id} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs">
              {a.bot_id}
              <span className="text-gray-500 ml-1">({a.provider})</span>
            </span>
          ))}
        </div>

        {/* Error */}
        {tournament.error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
            Error: {tournament.error}
          </div>
        )}

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Final Leaderboard</h2>
            <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left px-4 py-2">#</th>
                    <th className="text-left px-4 py-2">Bot</th>
                    <th className="text-right px-4 py-2">SP</th>
                    <th className="text-right px-4 py-2">Wtd Pts</th>
                    <th className="text-right px-4 py-2">Wins</th>
                    <th className="text-right px-4 py-2">Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((e, i) => (
                    <tr key={e.bot_id} className={`border-b border-gray-800/50 ${i === 0 ? 'text-yellow-300' : ''}`}>
                      <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                      <td className="px-4 py-2 font-mono">{e.bot_id}</td>
                      <td className="px-4 py-2 text-right font-bold">{e.sp}</td>
                      <td className="px-4 py-2 text-right">{e.weighted_points?.toFixed(0) ?? '—'}</td>
                      <td className="px-4 py-2 text-right">{e.periods_won ?? '—'}</td>
                      <td className="px-4 py-2 text-right">${e.spent?.toLocaleString() ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Period results by stage */}
        {Object.entries(stageGroups).map(([stage, stagePeriods]) => (
          <section key={stage} className="mb-6">
            <h2 className="text-base font-semibold text-gray-400 mb-2">Stage {Number(stage) + 1}</h2>
            <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800 text-xs">
                    <th className="text-left px-3 py-2">Period</th>
                    <th className="text-right px-3 py-2">Supply</th>
                    <th className="text-right px-3 py-2">Clear $</th>
                    <th className="text-left px-3 py-2">Winner</th>
                    <th className="text-right px-3 py-2">Bidders</th>
                    <th className="text-left px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {stagePeriods.map((p) => (
                    <tr key={p.id} className="border-b border-gray-800/50">
                      <td className="px-3 py-1.5 text-gray-400">P{p.period + 1}</td>
                      <td className="px-3 py-1.5 text-right">{p.tokens_available.toFixed(0)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">${p.clearing_price.toFixed(2)}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">
                        {p.winner_bot_id === 'none' ? <span className="text-gray-600">—</span> : p.winner_bot_id}
                      </td>
                      <td className="px-3 py-1.5 text-right">{p.num_bidders}</td>
                      <td className="px-3 py-1.5">
                        {p.rescinded && <span className="text-xs text-orange-400">rescind</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        {periods.length === 0 && tournament.status === 'pending' && (
          <p className="text-gray-500 text-center py-16">Waiting for worker to start…</p>
        )}
        {periods.length === 0 && tournament.status === 'running' && (
          <p className="text-blue-400 text-center py-16 animate-pulse">Tournament running…</p>
        )}
      </div>
    </main>
  );
}
