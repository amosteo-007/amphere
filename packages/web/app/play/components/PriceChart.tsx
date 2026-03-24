'use client';

import { useMemo } from 'react';
import { THEME } from '@/lib/game-theme';
import type { PeriodResultRow } from '@/lib/types';

interface PriceChartProps {
  periodResults: PeriodResultRow[];
  humanBotId?: string;
  selectedPeriod?: number;
  onPeriodSelect?: (absolutePeriod: number) => void;
}

const CHART_W = 600;
const CHART_H = 240;
const PAD = { top: 30, right: 20, bottom: 30, left: 50 };
const INNER_W = CHART_W - PAD.left - PAD.right;
const INNER_H = CHART_H - PAD.top - PAD.bottom;

// Stage configs for floor price lines
const STAGE_FLOORS = [10, 15, 28];
const PERIODS_PER_STAGE = 5;

export default function PriceChart({ periodResults, humanBotId = 'you', selectedPeriod, onPeriodSelect }: PriceChartProps) {
  const { minY, maxY, points, humanBids, stageLines } = useMemo(() => {
    if (periodResults.length === 0) {
      return { minY: 0, maxY: 50, points: [], humanBids: [], stageLines: [] };
    }

    // Gather clearing prices and human bids
    const pts = periodResults.map((pr) => ({
      x: pr.absolute_period,
      y: pr.clearing_price,
      winner: pr.winner_bot_id,
      stage: pr.stage,
    }));

    const hBids = periodResults.map((pr) => {
      const allBids = (pr as any).all_bids as { bot_id: string; bid: number }[] | undefined;
      const humanBid = allBids?.find((b) => b.bot_id === humanBotId);
      return {
        x: pr.absolute_period,
        y: humanBid?.bid ?? null,
        won: pr.winner_bot_id === humanBotId,
      };
    });

    const allPrices = [
      ...pts.map((p) => p.y),
      ...hBids.filter((b) => b.y !== null).map((b) => b.y!),
      ...STAGE_FLOORS,
    ];
    const mn = Math.max(0, Math.min(...allPrices) - 5);
    const mx = Math.max(...allPrices) + 10;

    // Stage boundary lines at period 5 and 10
    const sl = [5, 10].filter((p) => p <= Math.max(...pts.map((p) => p.x)) + 1);

    return { minY: mn, maxY: mx, points: pts, humanBids: hBids, stageLines: sl };
  }, [periodResults, humanBotId]);

  function xPos(period: number): number {
    return PAD.left + (period / 14) * INNER_W;
  }

  function yPos(price: number): number {
    return PAD.top + INNER_H - ((price - minY) / (maxY - minY)) * INNER_H;
  }

  // Clearing price polyline
  const clearingLine = points.map((p) => `${xPos(p.x)},${yPos(p.y)}`).join(' ');

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full"
        style={{ minWidth: 400, maxHeight: 280 }}
      >
        {/* Background */}
        <rect x={PAD.left} y={PAD.top} width={INNER_W} height={INNER_H} fill={THEME.bgCard} rx={4} />

        {/* Y-axis grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const price = minY + frac * (maxY - minY);
          const y = yPos(price);
          return (
            <g key={frac}>
              <line x1={PAD.left} y1={y} x2={PAD.left + INNER_W} y2={y} stroke={THEME.bgDark} strokeWidth={0.5} />
              <text x={PAD.left - 4} y={y + 3} textAnchor="end" fontSize={9} fill={THEME.inkLight} fontFamily="DM Mono">
                ${price.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Stage boundary vertical lines */}
        {stageLines.map((p) => (
          <line
            key={p}
            x1={xPos(p) - (INNER_W / 14) * 0.5}
            y1={PAD.top}
            x2={xPos(p) - (INNER_W / 14) * 0.5}
            y2={PAD.top + INNER_H}
            stroke={THEME.bgDark}
            strokeWidth={1}
            strokeDasharray="4,3"
          />
        ))}

        {/* Floor price lines per stage */}
        {STAGE_FLOORS.map((floor, stageIdx) => {
          const startX = xPos(stageIdx * PERIODS_PER_STAGE);
          const endX = xPos(Math.min(14, (stageIdx + 1) * PERIODS_PER_STAGE - 1));
          const y = yPos(floor);
          return (
            <line
              key={stageIdx}
              x1={startX}
              y1={y}
              x2={endX}
              y2={y}
              stroke={THEME.danger}
              strokeWidth={0.5}
              strokeDasharray="2,2"
              opacity={0.5}
            />
          );
        })}

        {/* Stage labels */}
        {[0, 1, 2].map((s) => (
          <text
            key={s}
            x={xPos(s * PERIODS_PER_STAGE + 2)}
            y={PAD.top - 8}
            textAnchor="middle"
            fontSize={10}
            fill={THEME.inkLight}
            fontFamily="Playfair Display"
          >
            Stage {s + 1}
          </text>
        ))}

        {/* Clearing price line */}
        {points.length > 1 && (
          <polyline
            points={clearingLine}
            fill="none"
            stroke={THEME.ink}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        )}

        {/* Clearing price dots */}
        {points.map((p) => (
          <circle
            key={p.x}
            cx={xPos(p.x)}
            cy={yPos(p.y)}
            r={3}
            fill={THEME.ink}
            className="cursor-pointer"
            onClick={() => onPeriodSelect?.(p.x)}
          />
        ))}

        {/* Human bid markers */}
        {humanBids.map((b) => {
          if (b.y === null) return null;
          return (
            <circle
              key={`h-${b.x}`}
              cx={xPos(b.x)}
              cy={yPos(b.y)}
              r={4}
              fill={b.won ? THEME.gold : 'none'}
              stroke={THEME.gold}
              strokeWidth={1.5}
              className="cursor-pointer"
              onClick={() => onPeriodSelect?.(b.x)}
            />
          );
        })}

        {/* X-axis period labels */}
        {Array.from({ length: 15 }, (_, i) => (
          <text
            key={i}
            x={xPos(i)}
            y={PAD.top + INNER_H + 16}
            textAnchor="middle"
            fontSize={8}
            fill={selectedPeriod === i ? THEME.ink : THEME.inkLight}
            fontFamily="DM Mono"
            fontWeight={selectedPeriod === i ? 'bold' : 'normal'}
          >
            {i + 1}
          </text>
        ))}

        {/* Legend */}
        <circle cx={PAD.left + 10} cy={CHART_H - 8} r={3} fill={THEME.ink} />
        <text x={PAD.left + 18} y={CHART_H - 5} fontSize={8} fill={THEME.inkLight} fontFamily="DM Mono">Clear</text>
        <circle cx={PAD.left + 60} cy={CHART_H - 8} r={3} fill={THEME.gold} />
        <text x={PAD.left + 68} y={CHART_H - 5} fontSize={8} fill={THEME.inkLight} fontFamily="DM Mono">Your bid (won)</text>
        <circle cx={PAD.left + 145} cy={CHART_H - 8} r={3} fill="none" stroke={THEME.gold} strokeWidth={1.5} />
        <text x={PAD.left + 153} y={CHART_H - 5} fontSize={8} fill={THEME.inkLight} fontFamily="DM Mono">Your bid (lost)</text>
      </svg>
    </div>
  );
}
