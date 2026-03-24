'use client';

import { useState } from 'react';
import { THEME } from '@/lib/game-theme';
import { useTimer } from '@/lib/hooks/useTimer';
import type { HumanTurnRow } from '@/lib/types';

interface BidInputProps {
  turn: HumanTurnRow;
  tournamentId: string;
  onSubmitted: () => void;
}

export default function BidInput({ turn, tournamentId, onSubmitted }: BidInputProps) {
  const ctx = turn.context;
  const floorPrice = ctx.floor_price ?? 0;
  const tokensAvailable = ctx.tokens_available ?? 0;
  const remainingBudget = ctx.remaining_budget ?? 0;
  const maxBid = tokensAvailable > 0 ? Math.floor((remainingBudget / tokensAvailable) * 100) / 100 : 0;
  const pointsPerToken = ctx.points_per_token ?? 1;
  const sp = ctx.sp ?? 0;
  const tokensPerStage: number[] = ctx.tokens_per_stage ?? [0, 0, 0];
  const weightedPoints = ctx.weighted_points ?? 0;

  const [bid, setBid] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { secondsLeft } = useTimer(turn.expires_at);

  const bidNum = parseFloat(bid);
  const canAfford = maxBid >= floorPrice;
  const isValid = canAfford && !isNaN(bidNum) && bidNum >= floorPrice && bidNum <= maxBid;
  const totalCost = isValid ? (bidNum * tokensAvailable) : 0;

  async function submit(action: 'bid' | 'skip') {
    setSubmitting(true);
    setError('');
    const body: Record<string, unknown> = { turn_id: turn.id };
    if (action === 'skip') {
      body.skip = true;
    } else {
      body.price_per_token = bidNum;
    }

    const res = await fetch(`/api/tournaments/${tournamentId}/human-bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      onSubmitted();
    } else {
      const data = await res.json();
      setError(data.error ?? 'Failed to submit');
      setSubmitting(false);
    }
  }

  return (
    <div
      className="rounded-xl border p-6 max-w-lg mx-auto"
      style={{ background: THEME.bgCard, borderColor: THEME.bgDark }}
    >
      {/* Timer */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs" style={{ fontFamily: '"DM Mono", monospace', color: THEME.inkLight }}>
          Your turn to bid
        </span>
        <span
          className="text-sm font-medium px-2 py-0.5 rounded"
          style={{
            fontFamily: '"DM Mono", monospace',
            color: secondsLeft <= 10 ? THEME.danger : THEME.ink,
            background: secondsLeft <= 10 ? '#8b3a3a20' : THEME.bgDark,
          }}
        >
          {secondsLeft}s
        </span>
      </div>

      {/* Context */}
      <div className="grid grid-cols-2 gap-3 mb-4 text-sm" style={{ fontFamily: '"DM Mono", monospace' }}>
        <div>
          <span style={{ color: THEME.inkLight }}>Tokens</span>
          <div style={{ color: THEME.ink }}>{tokensAvailable}</div>
        </div>
        <div>
          <span style={{ color: THEME.inkLight }}>Floor</span>
          <div style={{ color: THEME.ink }}>${floorPrice.toFixed(2)}</div>
        </div>
        <div>
          <span style={{ color: THEME.inkLight }}>Budget</span>
          <div style={{ color: THEME.ink }}>${remainingBudget.toLocaleString()}</div>
        </div>
        <div>
          <span style={{ color: THEME.inkLight }}>Multiplier</span>
          <div style={{ color: THEME.ink }}>{pointsPerToken}x</div>
        </div>
      </div>

      {/* Your real stats (private — not visible to opponents) */}
      <div
        className="flex items-center gap-4 mb-5 px-3 py-2 rounded-lg text-xs"
        style={{ background: `${THEME.gold}10`, fontFamily: '"DM Mono", monospace' }}
      >
        <div>
          <span style={{ color: THEME.inkLight }}>Your SP </span>
          <span className="font-bold" style={{ color: THEME.ink }}>{sp}</span>
        </div>
        <div>
          <span style={{ color: THEME.inkLight }}>Tokens </span>
          <span style={{ color: THEME.ink }}>
            {tokensPerStage.map((t, i) => Math.round(t)).join('/')}
          </span>
        </div>
        <div>
          <span style={{ color: THEME.inkLight }}>Pts </span>
          <span style={{ color: THEME.ink }}>{Math.round(weightedPoints)}</span>
        </div>
      </div>

      {/* Bid input */}
      <div className="mb-3">
        {canAfford ? (
          <>
            <label className="block text-xs mb-1" style={{ color: THEME.inkLight, fontFamily: '"IBM Plex Sans", sans-serif' }}>
              Price per token ($)
            </label>
            <input
              type="number"
              step="0.01"
              min={floorPrice}
              max={maxBid}
              value={bid}
              onChange={(e) => setBid(e.target.value)}
              placeholder={`${floorPrice.toFixed(2)} – ${maxBid.toFixed(2)}`}
              className="w-full px-4 py-3 rounded-lg border text-lg focus:outline-none focus:ring-2"
              style={{
                fontFamily: '"DM Mono", monospace',
                background: THEME.bg,
                borderColor: THEME.bgDark,
                color: THEME.ink,
              }}
            />
            {bid && !isValid && (
              <p className="text-xs mt-1" style={{ color: THEME.danger }}>
                Bid must be between ${floorPrice.toFixed(2)} and ${maxBid.toFixed(2)}
              </p>
            )}
            {isValid && (
              <p className="text-xs mt-1" style={{ color: THEME.inkLight }}>
                Total cost: ${totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm py-3 text-center" style={{ color: THEME.danger, fontFamily: '"IBM Plex Sans", sans-serif' }}>
            Budget too low to bid at floor price (${floorPrice.toFixed(2)}/tok × {tokensAvailable} tok = ${(floorPrice * tokensAvailable).toLocaleString()} &gt; ${remainingBudget.toLocaleString()} budget)
          </p>
        )}
      </div>

      {error && <p className="text-xs mb-3" style={{ color: THEME.danger }}>{error}</p>}

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => submit('bid')}
          disabled={!isValid || submitting}
          className="flex-1 py-3 rounded-lg font-medium text-sm transition-colors disabled:opacity-40"
          style={{ background: THEME.gold, color: THEME.ink, fontFamily: '"Playfair Display", serif' }}
        >
          {submitting ? 'Submitting...' : 'Place Bid'}
        </button>
        <button
          onClick={() => submit('skip')}
          disabled={submitting}
          className="px-4 py-3 rounded-lg text-sm transition-colors border"
          style={{ borderColor: THEME.bgDark, color: THEME.inkLight, fontFamily: '"IBM Plex Sans", sans-serif' }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
