'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { THEME, type ProviderKey } from '@/lib/game-theme';
import { useGameState } from '@/lib/hooks/useGameState';
import SetupPhase from './components/SetupPhase';
import GamePhase from './components/GamePhase';
import PostGame from './components/PostGame';

type GamePhaseState = 'setup' | 'waiting' | 'playing' | 'postgame';

export default function PlayPage() {
  const [phase, setPhase] = useState<GamePhaseState>('setup');
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleStart(opponents: { provider: ProviderKey; registered_bot_id?: string }[]) {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opponents }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to create tournament');
        setLoading(false);
        return;
      }

      const { tournament_id } = await res.json();
      setTournamentId(tournament_id);
      setPhase('waiting');

      // Wait a moment for the worker to claim the tournament, then transition
      setTimeout(() => setPhase('playing'), 3000);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: THEME.bg }}>
      <div className="max-w-6xl mx-auto px-4 py-12">
        {phase === 'setup' && (
          <>
            <SetupPhase onStart={handleStart} loading={loading} />
            {error && (
              <p className="text-center text-sm mt-4" style={{ color: THEME.danger }}>{error}</p>
            )}
          </>
        )}

        {phase === 'waiting' && (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-8 h-8 border-2 rounded-full animate-spin mb-4" style={{ borderColor: THEME.bgDark, borderTopColor: THEME.gold }} />
            <h2 className="text-xl font-bold mb-2" style={{ fontFamily: '"Playfair Display", serif', color: THEME.ink }}>
              Starting Tournament
            </h2>
            <p className="text-sm" style={{ color: THEME.inkLight, fontFamily: '"IBM Plex Sans", sans-serif' }}>
              Worker is claiming the tournament...
            </p>
            <p className="text-xs mt-2" style={{ color: THEME.inkLight, fontFamily: '"DM Mono", monospace' }}>
              {tournamentId?.slice(0, 8)}
            </p>
          </div>
        )}

        {phase === 'playing' && tournamentId && (
          <GamePhase
            tournamentId={tournamentId}
            onComplete={() => setPhase('postgame')}
          />
        )}

        {phase === 'postgame' && tournamentId && (
          <PostGameWrapper
            tournamentId={tournamentId}
            onPlayAgain={() => {
              setPhase('setup');
              setTournamentId(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

/** Wrapper that fetches game data for PostGame */
function PostGameWrapper({ tournamentId, onPlayAgain }: { tournamentId: string; onPlayAgain: () => void }) {
  const { periodResults, agents, leaderboard, loading } = useGameState(tournamentId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: THEME.bgDark, borderTopColor: THEME.gold }} />
      </div>
    );
  }

  return (
    <PostGame
      tournamentId={tournamentId}
      periodResults={periodResults}
      agents={agents}
      leaderboard={leaderboard ?? []}
      onPlayAgain={onPlayAgain}
    />
  );
}
