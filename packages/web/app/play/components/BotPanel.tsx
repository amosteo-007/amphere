'use client';

import { useState } from 'react';
import { THEME, getProviderColor, getProviderDisplay } from '@/lib/game-theme';
import type { AgentConfig } from '@/lib/types';

const PERSONA_DESCRIPTIONS: Record<string, string> = {
  momentum: 'Aggressive early accumulator — wins SP fast and forces opponents to overspend.',
  dark_pool: 'Deceptive strategist — makes opponents\' pricing models wrong at critical moments.',
  market_maker: 'Precision bidder — calibrates bids to actual competitive pressure each period.',
  noise_trader: 'Chaos agent — unpredictability taxes every rational opponent\'s model.',
  macro: 'Budget optimizer — treats every dollar as a future weapon for stage transitions.',
  sector_rotator: 'Stage boundary specialist — optimizes SP-to-budget ratio at transitions.',
  value: 'Late-game dominator — hoards budget for Stage 3 high-multiplier tokens.',
  index: 'Steady accumulator — consistent presence across stages beats high-variance plays.',
};

interface BotPanelProps {
  agents: AgentConfig[];
  tournamentId: string;
  humanBotId?: string;
  selectedPeriod?: number;
  showLogs?: boolean;
}

interface LogEntry {
  stage: number;
  period: number;
  decision_type: string;
  observation_summary?: string;
  thinking?: string;
  prompt?: string;
  raw_response?: string;
  parsed_decision?: any;
  latency_ms?: number;
  error?: string;
}

interface LogResponse {
  bot_id: string;
  provider?: string;
  model?: string;
  periods: LogEntry[];
}

export default function BotPanel({ agents, tournamentId, humanBotId = 'you', selectedPeriod, showLogs = false }: BotPanelProps) {
  const [selectedBot, setSelectedBot] = useState<string | null>(null);
  const [logData, setLogData] = useState<LogResponse | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [expandedPeriod, setExpandedPeriod] = useState<number | null>(null);

  const llmAgents = agents.filter((a) => a.provider !== 'human');

  async function loadLogs(botId: string) {
    setSelectedBot(botId);
    setLoadingLogs(true);
    setLogData(null);
    setExpandedPeriod(null);

    try {
      const res = await fetch(`/api/play/${tournamentId}/logs?bot_id=${botId}`);
      if (res.ok) {
        const data: LogResponse = await res.json();
        setLogData(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingLogs(false);
    }
  }

  const filteredPeriods = logData?.periods?.filter((entry) => {
    if (selectedPeriod === undefined) return true;
    // Map absolute period to stage/period — absolute_period = stage * 5 + period
    const absP = entry.stage * 5 + entry.period;
    return absP === selectedPeriod;
  }) ?? [];

  return (
    <div>
      <h3 className="text-sm font-bold mb-3" style={{ fontFamily: '"Playfair Display", serif', color: THEME.ink }}>
        Opponents
      </h3>
      <div className="space-y-1 mb-4">
        {llmAgents.map((a) => {
          const color = getProviderColor(a.provider);
          const isSelected = selectedBot === a.bot_id;
          return (
            <div
              key={a.bot_id}
              className="px-3 py-2 rounded-lg border cursor-pointer transition-colors"
              style={{
                background: isSelected ? `${color}10` : THEME.bgCard,
                borderColor: isSelected ? color : THEME.bgDark,
              }}
              onClick={() => showLogs && loadLogs(a.bot_id)}
              title={showLogs ? 'Click to view thinking logs' : PERSONA_DESCRIPTIONS[a.persona_name] ?? ''}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-xs font-medium" style={{ fontFamily: '"IBM Plex Sans", sans-serif', color: THEME.ink }}>
                  {getProviderDisplay(a.provider)}
                </span>
                <span className="text-xs" style={{ color: THEME.inkLight, fontFamily: '"DM Mono", monospace' }}>
                  {a.persona_name}
                </span>
                {showLogs && (
                  <span className="ml-auto text-xs" style={{ color: THEME.inkLight }}>
                    trace
                  </span>
                )}
              </div>
              {!showLogs && (
                <p className="text-xs mt-1" style={{ color: THEME.inkLight, fontFamily: '"IBM Plex Sans", sans-serif' }}>
                  {PERSONA_DESCRIPTIONS[a.persona_name] ?? 'Unknown strategy'}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Log timeline viewer */}
      {showLogs && selectedBot && (
        <div
          className="rounded-lg border p-3 text-xs overflow-auto max-h-[600px]"
          style={{ background: THEME.bg, borderColor: THEME.bgDark }}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="font-medium" style={{ fontFamily: '"DM Mono", monospace', color: THEME.ink }}>
                {selectedBot}
              </span>
              {logData?.model && (
                <span className="ml-2" style={{ color: THEME.inkLight }}>
                  {logData.model}
                </span>
              )}
            </div>
            <button
              onClick={() => { setSelectedBot(null); setLogData(null); }}
              className="text-xs px-1" style={{ color: THEME.inkLight }}
            >
              Close
            </button>
          </div>

          {loadingLogs && <p style={{ color: THEME.inkLight }}>Loading logs...</p>}

          {!loadingLogs && filteredPeriods.length === 0 && (
            <p style={{ color: THEME.inkLight }}>No logs available{selectedPeriod !== undefined ? ' for this period' : ''}.</p>
          )}

          {!loadingLogs && filteredPeriods.length > 0 && (
            <div className="space-y-1" style={{ fontFamily: '"DM Mono", monospace' }}>
              {filteredPeriods.map((entry, idx) => {
                const key = `${entry.stage}-${entry.period}-${entry.decision_type}-${idx}`;
                const isExpanded = expandedPeriod === idx;
                const hasError = !!entry.error;

                return (
                  <div key={key}>
                    {/* Period header row — click to expand */}
                    <button
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors"
                      style={{
                        background: isExpanded ? `${THEME.gold}10` : 'transparent',
                        color: THEME.ink,
                      }}
                      onClick={() => setExpandedPeriod(isExpanded ? null : idx)}
                    >
                      <span className="font-medium" style={{ minWidth: 48 }}>
                        S{entry.stage + 1}P{entry.period + 1}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px]"
                        style={{
                          background: entry.decision_type === 'rescind' ? `${THEME.danger}20` : `${THEME.gold}20`,
                          color: entry.decision_type === 'rescind' ? THEME.danger : THEME.ink,
                        }}
                      >
                        {entry.decision_type}
                      </span>
                      {entry.parsed_decision && (
                        <span style={{ color: THEME.inkLight }}>
                          {formatDecision(entry.parsed_decision, entry.decision_type)}
                        </span>
                      )}
                      {hasError && (
                        <span style={{ color: THEME.danger }}>error</span>
                      )}
                      <span className="ml-auto" style={{ color: THEME.inkLight }}>
                        {entry.latency_ms ? `${(entry.latency_ms / 1000).toFixed(1)}s` : '—'}
                      </span>
                      <span style={{ color: THEME.inkLight }}>{isExpanded ? '▼' : '▶'}</span>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="ml-4 mt-1 mb-2 space-y-2">
                        {entry.error && (
                          <LogSection label="Error" style={{ color: THEME.danger }}>
                            {entry.error}
                          </LogSection>
                        )}
                        {entry.observation_summary && (
                          <LogSection label="Observation">
                            {entry.observation_summary}
                          </LogSection>
                        )}
                        {entry.thinking && (
                          <LogSection label="Thinking">
                            {entry.thinking}
                          </LogSection>
                        )}
                        {entry.parsed_decision && (
                          <LogSection label="Decision">
                            {JSON.stringify(entry.parsed_decision, null, 2)}
                          </LogSection>
                        )}
                        {entry.raw_response && (
                          <LogSection label="Raw Response">
                            {entry.raw_response}
                          </LogSection>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LogSection({ label, children, style }: { label: string; children: string; style?: React.CSSProperties }) {
  return (
    <div>
      <div className="text-[10px] mb-0.5" style={{ color: THEME.inkLight }}>{label}</div>
      <pre
        className="whitespace-pre-wrap text-xs p-2 rounded max-h-[300px] overflow-auto"
        style={{ background: THEME.bgCard, color: THEME.ink, ...style }}
      >
        {children}
      </pre>
    </div>
  );
}

function formatDecision(parsed: any, decisionType: string): string {
  if (decisionType === 'rescind') {
    return parsed.rescind ? 'RESCIND' : 'KEEP';
  }
  if (parsed.bid !== undefined && parsed.bid !== null) {
    return `$${Number(parsed.bid).toFixed(2)}`;
  }
  if (parsed.skip) return 'SKIP';
  return '';
}
