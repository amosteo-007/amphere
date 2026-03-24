'use client';

import { useCallback, useEffect } from 'react';
import { THEME, getProviderDisplay, getProviderColor } from '@/lib/game-theme';
import { useGameState } from '@/lib/hooks/useGameState';
import type { BotBidStatus } from '@/lib/hooks/useGameState';
import BidInput from './BidInput';
import RescindOverlay from './RescindOverlay';
import PriceChart from './PriceChart';
import Leaderboard from './Leaderboard';

interface GamePhaseProps {
  tournamentId: string;
  onComplete: () => void;
}

export default function GamePhase({ tournamentId, onComplete }: GamePhaseProps) {
  const { status, currentTurn, periodResults, agents, leaderboard, botStatuses, loading, clearTurn } = useGameState(tournamentId);

  const handleBidSubmitted = useCallback(() => {
    clearTurn();
  }, [clearTurn]);

  // Determine current period from results
  const lastResult = periodResults.at(-1);
  const currentStage = lastResult ? lastResult.stage + 1 : 1;
  const currentPeriod = lastResult ? lastResult.period + 2 : 1;
  const totalPeriods = periodResults.length;

  // Tournament complete — use useEffect to avoid setState-during-render
  const isFinished = status === 'completed' || status === 'failed' || status === 'cancelled';
  useEffect(() => {
    if (isFinished) onComplete();
  }, [isFinished, onComplete]);

  if (isFinished) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: THEME.bgDark, borderTopColor: THEME.gold }} />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: '"Playfair Display", serif', color: THEME.ink }}>
            Stage {currentStage} · Period {currentPeriod}
          </h2>
          <p className="text-xs" style={{ fontFamily: '"DM Mono", monospace', color: THEME.inkLight }}>
            {tournamentId.slice(0, 8)} · {totalPeriods}/15 periods complete
          </p>
        </div>
        <div className="flex gap-1">
          {agents.map((a) => (
            <span
              key={a.bot_id}
              className="w-2.5 h-2.5 rounded-full"
              title={`${a.bot_id} (${getProviderDisplay(a.provider)})`}
              style={{ background: a.provider === 'human' ? THEME.gold : THEME.inkLight }}
            />
          ))}
        </div>
      </div>

      {/* Two-row layout: top = chart + leaderboard, bottom = bid panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 mb-6">
        {/* Price Chart */}
        <div
          className="rounded-xl border p-4 min-h-[300px]"
          style={{ background: THEME.bgCard, borderColor: THEME.bgDark }}
        >
          {periodResults.length > 0 ? (
            <PriceChart periodResults={periodResults} humanBotId="you" />
          ) : (
            <div className="flex items-center justify-center h-full min-h-[260px]">
              <p className="text-sm" style={{ color: THEME.inkLight, fontFamily: '"IBM Plex Sans", sans-serif' }}>
                Waiting for first period...
              </p>
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div
          className="rounded-xl border p-4 min-h-[300px]"
          style={{ background: THEME.bgCard, borderColor: THEME.bgDark }}
        >
          <Leaderboard periodResults={periodResults} agents={agents} humanBotId="you" />
        </div>
      </div>

      {/* Bottom row: decision panel */}
      {currentTurn && currentTurn.decision_type === 'bid' && !currentTurn.response && (
        <BidInput turn={currentTurn} tournamentId={tournamentId} onSubmitted={handleBidSubmitted} />
      )}

      {currentTurn && currentTurn.decision_type === 'rescind' && !currentTurn.response && (
        <RescindOverlay turn={currentTurn} tournamentId={tournamentId} onSubmitted={handleBidSubmitted} />
      )}

      {!currentTurn && status === 'running' && (
        <WaitingState periodResults={periodResults} agents={agents} botStatuses={botStatuses} />
      )}

      {status === 'pending' && (
        <div className="text-center py-8">
          <div className="w-6 h-6 border-2 rounded-full animate-spin mx-auto mb-3" style={{ borderColor: THEME.bgDark, borderTopColor: THEME.gold }} />
          <p className="text-sm" style={{ color: THEME.inkLight, fontFamily: '"IBM Plex Sans", sans-serif' }}>
            Waiting for tournament to start...
          </p>
        </div>
      )}
    </div>
  );
}

/** Waiting state between human bid submission and next period result — shows live per-bot status */
function WaitingState({ periodResults, agents, botStatuses }: { periodResults: any[]; agents: any[]; botStatuses: Record<string, BotBidStatus> }) {
  const nonHumanAgents = agents.filter((a) => a.provider !== 'human');
  const allDone = nonHumanAgents.length > 0 && nonHumanAgents.every((a) => {
    const s = botStatuses[a.bot_id];
    return s && (s.status === 'done' || s.status === 'error' || s.status === 'timeout');
  });

  return (
    <div
      className="rounded-xl border p-6 max-w-lg mx-auto"
      style={{ background: THEME.bgCard, borderColor: THEME.bgDark }}
    >
      <p className="text-sm font-medium mb-4 text-center" style={{ fontFamily: '"Playfair Display", serif', color: THEME.ink }}>
        {allDone ? 'Clearing bids...' : 'Bots are deliberating...'}
      </p>
      <div className="space-y-2 mb-3">
        {nonHumanAgents.map((a) => {
          const s = botStatuses[a.bot_id];
          const isDone = s?.status === 'done';
          const isError = s?.status === 'error' || s?.status === 'timeout';
          const color = getProviderColor(a.provider);

          return (
            <div key={a.bot_id} className="flex items-center gap-3 text-xs" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${!isDone && !isError ? 'animate-pulse' : ''}`}
                style={{ background: isDone ? THEME.success : isError ? THEME.danger : color }}
              />
              <span className="w-24 truncate" style={{ color: THEME.ink }}>{getProviderDisplay(a.provider)}</span>
              <span style={{ color: THEME.inkLight, fontFamily: '"DM Mono", monospace' }}>
                {isDone && s.latency_ms != null
                  ? `done \u2713  (${(s.latency_ms / 1000).toFixed(1)}s)`
                  : isError
                  ? `${s?.status} \u2717`
                  : 'thinking...'}
              </span>
            </div>
          );
        })}
        {/* Human status */}
        <div className="flex items-center gap-3 text-xs" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: THEME.gold }} />
          <span className="w-24 truncate" style={{ color: THEME.ink }}>You</span>
          <span style={{ color: THEME.inkLight, fontFamily: '"DM Mono", monospace' }}>submitted &#x2713;</span>
        </div>
      </div>
      <p className="text-xs text-center" style={{ fontFamily: '"DM Mono", monospace', color: THEME.inkLight }}>
        {allDone ? 'Processing results...' : 'Waiting for all bids to clear...'}
      </p>
    </div>
  );
}
