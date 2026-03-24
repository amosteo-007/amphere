'use client';

import { useMemo } from 'react';
import { THEME, getProviderColor } from '@/lib/game-theme';
import type { PeriodResultRow, AgentConfig } from '@/lib/types';

interface LeaderboardProps {
  periodResults: PeriodResultRow[];
  agents: AgentConfig[];
  humanBotId?: string;
}

interface LeaderboardRow {
  bot_id: string;
  provider: string;
  sp: number;
  weighted_points: number;
  tokens_per_stage: number[];
}

const STAGE_MULTIPLIERS = [1.0, 1.5, 3.0];
const SP_AWARDS = [3, 2, 1];
const PERIODS_PER_STAGE = 5;

export default function Leaderboard({ periodResults, agents, humanBotId = 'you' }: LeaderboardProps) {
  const rows = useMemo(() => {
    if (periodResults.length === 0) {
      return agents.map((a) => ({
        bot_id: a.bot_id,
        provider: a.provider,
        sp: 0,
        weighted_points: 0,
        tokens_per_stage: [0, 0, 0],
      }));
    }

    return buildLeaderboard(periodResults, agents);
  }, [periodResults, agents]);

  const sorted = [...rows].sort((a, b) => b.sp - a.sp || b.weighted_points - a.weighted_points);

  return (
    <div>
      <h3 className="text-sm font-bold mb-3" style={{ fontFamily: '"Playfair Display", serif', color: THEME.ink }}>
        Leaderboard
      </h3>
      <div className="space-y-1">
        {sorted.map((row, i) => {
          const isHuman = row.bot_id === humanBotId;
          const color = getProviderColor(row.provider);
          const tokensStr = row.tokens_per_stage.map((t) => Math.round(t)).join('/');
          return (
            <div
              key={row.bot_id}
              className="flex items-center gap-2 text-xs px-2 py-1.5 rounded"
              style={{
                fontFamily: '"DM Mono", monospace',
                color: THEME.ink,
                background: isHuman ? `${THEME.gold}18` : 'transparent',
                borderLeft: isHuman ? `3px solid ${THEME.gold}` : '3px solid transparent',
              }}
            >
              <span className="w-4 text-right" style={{ color: THEME.inkLight }}>{i + 1}</span>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="flex-1 truncate" title={row.bot_id}>
                {isHuman ? 'You' : row.bot_id}
              </span>
              <span className="text-xs" style={{ color: THEME.inkLight }} title="Tokens S1/S2/S3">
                {tokensStr}
              </span>
              <span className="font-medium">{row.sp} SP</span>
              <span style={{ color: THEME.inkLight }}>{Math.round(row.weighted_points)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Build leaderboard from period_results by counting token wins per bot per stage,
 * computing weighted points, and awarding SP at completed stage boundaries.
 */
function buildLeaderboard(periodResults: PeriodResultRow[], agents: AgentConfig[]): LeaderboardRow[] {
  // Track tokens per stage per bot
  const tokensMap = new Map<string, number[]>();
  agents.forEach((a) => tokensMap.set(a.bot_id, [0, 0, 0]));

  for (const pr of periodResults) {
    if (pr.winner_bot_id && pr.winner_bot_id !== 'none' && pr.rescinded !== true) {
      const tokens = tokensMap.get(pr.winner_bot_id);
      if (tokens && pr.stage >= 0 && pr.stage < 3) {
        tokens[pr.stage] += pr.tokens_won;
      }
    }

    // Deduct rescind tax from the rescinder's holdings (latest stage first, matching engine)
    if (pr.rescinded === true && pr.rescind_detail && pr.winner_bot_id) {
      let tax = pr.rescind_detail.tax_amount_tokens;
      const tokens = tokensMap.get(pr.winner_bot_id);
      if (tokens && tax > 0) {
        for (let s = 2; s >= 0 && tax > 0; s--) {
          const deduct = Math.min(tokens[s], tax);
          tokens[s] -= deduct;
          tax -= deduct;
        }
      }
    }
  }

  // Compute SP from completed stages
  const spMap = new Map<string, number>();
  agents.forEach((a) => spMap.set(a.bot_id, 0));

  for (let stage = 0; stage < 3; stage++) {
    const stageComplete = periodResults.filter((pr) => pr.stage === stage).length >= PERIODS_PER_STAGE;
    if (!stageComplete) continue;

    const ranked = [...tokensMap.entries()]
      .map(([botId, tokens]) => ({ botId, tokens: tokens[stage] }))
      .sort((a, b) => b.tokens - a.tokens)
      .filter((r) => r.tokens > 0);

    ranked.forEach((r, i) => {
      if (i < SP_AWARDS.length) {
        spMap.set(r.botId, (spMap.get(r.botId) ?? 0) + SP_AWARDS[i]);
      }
    });
  }

  return agents.map((a) => {
    const tokens = tokensMap.get(a.bot_id) ?? [0, 0, 0];
    const wp = tokens.reduce((sum, t, i) => sum + t * (STAGE_MULTIPLIERS[i] ?? 1), 0);
    return {
      bot_id: a.bot_id,
      provider: a.provider,
      sp: spMap.get(a.bot_id) ?? 0,
      weighted_points: wp,
      tokens_per_stage: tokens,
    };
  });
}
