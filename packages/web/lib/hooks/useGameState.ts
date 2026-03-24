import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { TournamentStatus, PeriodResultRow, AgentConfig, LeaderboardEntry, HumanTurnRow } from '@/lib/types';

export interface BotBidStatus {
  bot_id: string;
  status: 'thinking' | 'done' | 'error' | 'timeout';
  latency_ms?: number;
}

export interface GameState {
  status: TournamentStatus | null;
  currentTurn: HumanTurnRow | null;
  periodResults: PeriodResultRow[];
  agents: AgentConfig[];
  leaderboard: LeaderboardEntry[] | null;
  botStatuses: Record<string, BotBidStatus>;
  loading: boolean;
  clearTurn: () => void;
}

export function useGameState(tournamentId: string): GameState {
  const [status, setStatus] = useState<TournamentStatus | null>(null);
  const [currentTurn, setCurrentTurn] = useState<HumanTurnRow | null>(null);
  const [periodResults, setPeriodResults] = useState<PeriodResultRow[]>([]);
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [botStatuses, setBotStatuses] = useState<Record<string, BotBidStatus>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Create client inside useEffect so it always runs in the browser
    const supabase = createClient();
    if (!supabase) return;

    // Hydrate from existing data
    async function hydrate() {
      const [tourneyRes, periodsRes, turnsRes] = await Promise.all([
        supabase.from('tournaments')
          .select('status, agents, leaderboard')
          .eq('id', tournamentId)
          .single(),
        supabase.from('period_results')
          .select('*')
          .eq('tournament_id', tournamentId)
          .order('absolute_period', { ascending: true }),
        supabase.from('human_turns')
          .select('*')
          .eq('tournament_id', tournamentId)
          .eq('bot_id', 'you')
          .is('response', null)
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      console.log('[GameState] hydrate:', {
        tournament: tourneyRes.data?.status,
        tourneyError: tourneyRes.error?.message,
        periods: periodsRes.data?.length,
        periodsError: periodsRes.error?.message,
        turns: turnsRes.data?.length,
        turnsError: turnsRes.error?.message,
      });

      if (tourneyRes.data) {
        setStatus(tourneyRes.data.status as TournamentStatus);
        setAgents(tourneyRes.data.agents ?? []);
        setLeaderboard(tourneyRes.data.leaderboard ?? null);
      }
      if (periodsRes.data) {
        setPeriodResults(periodsRes.data as PeriodResultRow[]);
      }
      if (turnsRes.data && turnsRes.data.length > 0) {
        const turn = turnsRes.data[0] as HumanTurnRow;
        console.log('[GameState] found turn:', turn.id, turn.decision_type, 'expires:', turn.expires_at);
        if (new Date(turn.expires_at) > new Date()) {
          setCurrentTurn(turn);
        } else {
          console.log('[GameState] turn expired, skipping');
        }
      }
      setLoading(false);
    }

    hydrate();

    // Subscribe to Realtime channels
    const channel = supabase
      .channel(`game-${tournamentId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'period_results', filter: `tournament_id=eq.${tournamentId}` },
        (payload) => {
          setPeriodResults((prev) => {
            const row = payload.new as PeriodResultRow;
            if (prev.some((p) => p.id === row.id)) return prev;
            return [...prev, row];
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'human_turns', filter: `tournament_id=eq.${tournamentId}` },
        (payload) => {
          console.log('[GameState] Realtime human_turns INSERT:', payload.new);
          const turn = payload.new as HumanTurnRow;
          if (turn.bot_id === 'you' && !turn.response) {
            setCurrentTurn(turn);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bot_bid_status', filter: `tournament_id=eq.${tournamentId}` },
        (payload) => {
          const row = payload.new as any;
          if (row.bot_id) {
            setBotStatuses((prev) => ({
              ...prev,
              [row.bot_id]: { bot_id: row.bot_id, status: row.status, latency_ms: row.latency_ms },
            }));
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tournaments', filter: `id=eq.${tournamentId}` },
        (payload) => {
          const updated = payload.new as any;
          if (updated.status) setStatus(updated.status as TournamentStatus);
          if (updated.leaderboard) setLeaderboard(updated.leaderboard);
        },
      )
      .subscribe((status) => {
        console.log('[GameState] Realtime subscription status:', status);
      });

    // Polling fallback: every 3s (faster than 15s for better responsiveness)
    const fallback = setInterval(async () => {
      const { data, error } = await supabase
        .from('human_turns')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('bot_id', 'you')
        .is('response', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.log('[GameState] poll human_turns error:', error.message);
      }

      if (data && data.length > 0) {
        const turn = data[0] as HumanTurnRow;
        console.log('[GameState] poll found turn:', turn.id);
        if (new Date(turn.expires_at) > new Date()) {
          setCurrentTurn(turn);
        }
      }

      // Also check tournament status
      const { data: t } = await supabase
        .from('tournaments')
        .select('status, leaderboard')
        .eq('id', tournamentId)
        .single();
      if (t) {
        setStatus(t.status as TournamentStatus);
        if (t.leaderboard) setLeaderboard(t.leaderboard);
      }
    }, 3000);

    return () => {
      channel.unsubscribe();
      clearInterval(fallback);
    };
  }, [tournamentId]);

  const clearTurn = () => setCurrentTurn(null);
  return { status, currentTurn, periodResults, agents, leaderboard, botStatuses, loading, clearTurn };
}
