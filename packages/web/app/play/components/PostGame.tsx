'use client';

import { useMemo, useState } from 'react';
import { THEME, getProviderColor, getProviderDisplay } from '@/lib/game-theme';
import type { PeriodResultRow, AgentConfig, LeaderboardEntry } from '@/lib/types';
import PriceChart from './PriceChart';
import BotPanel from './BotPanel';

interface PostGameProps {
  tournamentId: string;
  periodResults: PeriodResultRow[];
  agents: AgentConfig[];
  leaderboard: LeaderboardEntry[];
  onPlayAgain: () => void;
}

export default function PostGame({ tournamentId, periodResults, agents, leaderboard, onPlayAgain }: PostGameProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<number | undefined>(undefined);

  const stats = useMemo(() => computeStats(periodResults, 'you'), [periodResults]);

  const sortedLeaderboard = [...leaderboard].sort(
    (a, b) => b.sp - a.sp || b.weighted_points - a.weighted_points,
  );

  const humanRank = sortedLeaderboard.findIndex((e) => e.bot_id === 'you') + 1;

  return (
    <div>
      {/* Result header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: '"Playfair Display", serif', color: THEME.ink }}>
          Tournament Complete
        </h1>
        <p className="text-lg" style={{ fontFamily: '"DM Mono", monospace', color: THEME.gold }}>
          You finished #{humanRank} of {sortedLeaderboard.length}
        </p>
      </div>

      {/* Final leaderboard */}
      <div
        className="rounded-xl border p-5 mb-6"
        style={{ background: THEME.bgCard, borderColor: THEME.bgDark }}
      >
        <h2 className="text-sm font-bold mb-3" style={{ fontFamily: '"Playfair Display", serif', color: THEME.ink }}>
          Final Standings
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ fontFamily: '"DM Mono", monospace' }}>
            <thead>
              <tr style={{ color: THEME.inkLight }}>
                <th className="text-left py-1 px-2">#</th>
                <th className="text-left py-1 px-2">Bot</th>
                <th className="text-right py-1 px-2">SP</th>
                <th className="text-right py-1 px-2">Wtd Pts</th>
                <th className="text-right py-1 px-2">Wins</th>
                <th className="text-right py-1 px-2">Spent</th>
                <th className="text-right py-1 px-2">Rescinds</th>
              </tr>
            </thead>
            <tbody>
              {sortedLeaderboard.map((entry, i) => {
                const isHuman = entry.bot_id === 'you';
                const agent = agents.find((a) => a.bot_id === entry.bot_id);
                const color = getProviderColor(agent?.provider ?? 'unknown');
                return (
                  <tr
                    key={entry.bot_id}
                    style={{
                      color: THEME.ink,
                      background: isHuman ? `${THEME.gold}15` : 'transparent',
                    }}
                  >
                    <td className="py-1.5 px-2" style={{ color: THEME.inkLight }}>{i + 1}</td>
                    <td className="py-1.5 px-2">
                      <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: color }} />
                      {isHuman ? 'You' : entry.bot_id}
                    </td>
                    <td className="text-right py-1.5 px-2 font-bold">{entry.sp}</td>
                    <td className="text-right py-1.5 px-2">{(entry.weighted_points ?? 0).toFixed(0)}</td>
                    <td className="text-right py-1.5 px-2">{entry.periods_won ?? 0}</td>
                    <td className="text-right py-1.5 px-2">${(entry.spent ?? 0).toLocaleString()}</td>
                    <td className="text-right py-1.5 px-2">{entry.rescinds ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats summary */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
      >
        {[
          { label: 'Win Rate', value: `${(stats.winRate * 100).toFixed(0)}%` },
          { label: 'Avg Bid', value: `$${stats.avgBid.toFixed(2)}` },
          { label: 'Most Tokens (1 period)', value: stats.maxTokensWon.toFixed(0) },
          { label: 'Highest Clear', value: `$${stats.highestClearing.toFixed(2)}` },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border p-3"
            style={{ background: THEME.bgCard, borderColor: THEME.bgDark }}
          >
            <div className="text-xs mb-1" style={{ color: THEME.inkLight, fontFamily: '"IBM Plex Sans", sans-serif' }}>
              {s.label}
            </div>
            <div className="text-lg font-bold" style={{ color: THEME.ink, fontFamily: '"DM Mono", monospace' }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Price chart */}
      <div
        className="rounded-xl border p-4 mb-4"
        style={{ background: THEME.bgCard, borderColor: THEME.bgDark }}
      >
        <PriceChart
          periodResults={periodResults}
          humanBotId="you"
          selectedPeriod={selectedPeriod}
          onPeriodSelect={setSelectedPeriod}
        />
      </div>

      {/* Period scroll */}
      <div className="overflow-x-auto mb-6">
        <div className="flex gap-2 pb-2" style={{ minWidth: 'max-content' }}>
          {periodResults.map((pr) => {
            const isSelected = selectedPeriod === pr.absolute_period;
            const allBids = (pr as any).all_bids as { bot_id: string; bid: number }[] | undefined;
            const humanBid = allBids?.find((b) => b.bot_id === 'you');
            return (
              <button
                key={pr.id}
                onClick={() => setSelectedPeriod(pr.absolute_period)}
                className="flex-shrink-0 rounded-lg border p-2 text-xs transition-colors"
                style={{
                  fontFamily: '"DM Mono", monospace',
                  background: isSelected ? `${THEME.gold}15` : THEME.bgCard,
                  borderColor: isSelected ? THEME.gold : THEME.bgDark,
                  color: THEME.ink,
                  minWidth: 100,
                }}
              >
                <div className="font-medium">S{pr.stage + 1}P{pr.period + 1}</div>
                <div style={{ color: THEME.inkLight }}>${(pr.clearing_price ?? 0).toFixed(2)}</div>
                <div style={{ color: pr.winner_bot_id === 'you' ? THEME.success : THEME.inkLight }}>
                  {pr.winner_bot_id === 'you' ? 'WON' : pr.winner_bot_id}
                </div>
                {humanBid && humanBid.bid != null && (
                  <div style={{ color: THEME.gold }}>Bid: ${humanBid.bid.toFixed(2)}</div>
                )}
                {pr.rescinded && (
                  <div style={{ color: THEME.danger }}>rescinded</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bot panel with logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div
          className="rounded-xl border p-4"
          style={{ background: THEME.bgCard, borderColor: THEME.bgDark }}
        >
          <BotPanel
            agents={agents}
            tournamentId={tournamentId}
            selectedPeriod={selectedPeriod}
            showLogs
          />
        </div>

        {/* Selected period detail */}
        {selectedPeriod !== undefined && (
          <div
            className="rounded-xl border p-4"
            style={{ background: THEME.bgCard, borderColor: THEME.bgDark }}
          >
            <PeriodDetail
              periodResult={periodResults.find((p) => p.absolute_period === selectedPeriod)}
              agents={agents}
            />
          </div>
        )}
      </div>

      {/* Play again */}
      <div className="text-center">
        <button
          onClick={onPlayAgain}
          className="px-8 py-3 rounded-lg font-semibold text-sm transition-colors"
          style={{ background: THEME.gold, color: THEME.ink, fontFamily: '"Playfair Display", serif' }}
        >
          Play Again
        </button>
      </div>
    </div>
  );
}

function PeriodDetail({ periodResult, agents }: { periodResult?: PeriodResultRow; agents: AgentConfig[] }) {
  if (!periodResult) return null;

  const allBids = (periodResult as any).all_bids as { bot_id: string; bid: number }[] | undefined;
  const sortedBids = allBids ? [...allBids].sort((a, b) => b.bid - a.bid) : [];

  return (
    <div>
      <h3 className="text-sm font-bold mb-3" style={{ fontFamily: '"Playfair Display", serif', color: THEME.ink }}>
        Period {periodResult.absolute_period + 1} Detail
      </h3>
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs" style={{ fontFamily: '"DM Mono", monospace' }}>
        <div>
          <span style={{ color: THEME.inkLight }}>Tokens: </span>
          <span style={{ color: THEME.ink }}>{periodResult.tokens_available}</span>
        </div>
        <div>
          <span style={{ color: THEME.inkLight }}>Clearing: </span>
          <span style={{ color: THEME.ink }}>${(periodResult.clearing_price ?? 0).toFixed(2)}</span>
        </div>
        <div>
          <span style={{ color: THEME.inkLight }}>Winner: </span>
          <span style={{ color: THEME.ink }}>{periodResult.winner_bot_id === 'you' ? 'You' : periodResult.winner_bot_id}</span>
        </div>
        <div>
          <span style={{ color: THEME.inkLight }}>Bidders: </span>
          <span style={{ color: THEME.ink }}>{periodResult.num_bidders}</span>
        </div>
      </div>

      {sortedBids.length > 0 && (
        <div>
          <div className="text-xs mb-1" style={{ color: THEME.inkLight, fontFamily: '"IBM Plex Sans", sans-serif' }}>
            All Bids:
          </div>
          <div className="space-y-1">
            {sortedBids.map((b) => {
              const agent = agents.find((a) => a.bot_id === b.bot_id);
              const color = getProviderColor(agent?.provider ?? 'unknown');
              const isWinner = b.bot_id === periodResult.winner_bot_id;
              return (
                <div
                  key={b.bot_id}
                  className="flex items-center gap-2 text-xs px-2 py-1 rounded"
                  style={{
                    fontFamily: '"DM Mono", monospace',
                    background: isWinner ? `${THEME.gold}10` : 'transparent',
                    color: THEME.ink,
                  }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="flex-1">{b.bot_id === 'you' ? 'You' : b.bot_id}</span>
                  <span className="font-medium">${b.bid != null ? b.bid.toFixed(2) : '—'}</span>
                  {isWinner && <span style={{ color: THEME.gold }}>winner</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function computeStats(periodResults: PeriodResultRow[], humanBotId: string) {
  let totalBids = 0;
  let totalBidAmount = 0;
  let wins = 0;
  let maxTokensWon = 0;
  let highestClearing = 0;

  for (const pr of periodResults) {
    highestClearing = Math.max(highestClearing, pr.clearing_price ?? 0);
    if (pr.winner_bot_id === humanBotId) {
      wins++;
      maxTokensWon = Math.max(maxTokensWon, pr.tokens_won ?? 0);
    }
    const allBids = (pr as any).all_bids as { bot_id: string; bid: number | null }[] | undefined;
    const humanBid = allBids?.find((b) => b.bot_id === humanBotId);
    if (humanBid && humanBid.bid != null) {
      totalBids++;
      totalBidAmount += humanBid.bid;
    }
  }

  return {
    winRate: totalBids > 0 ? wins / totalBids : 0,
    avgBid: totalBids > 0 ? totalBidAmount / totalBids : 0,
    maxTokensWon,
    highestClearing,
  };
}
