'use client';

import { useState } from 'react';
import { THEME } from '@/lib/game-theme';
import { useTimer } from '@/lib/hooks/useTimer';
import type { HumanTurnRow } from '@/lib/types';

interface RescindOverlayProps {
  turn: HumanTurnRow;
  tournamentId: string;
  onSubmitted: () => void;
}

export default function RescindOverlay({ turn, tournamentId, onSubmitted }: RescindOverlayProps) {
  const ctx = turn.context;
  const tokensWon = ctx.tokens_won ?? 0;
  const totalPaid = ctx.total_paid ?? 0;
  const clearingPrice = ctx.clearing_price_last ?? 0;
  const floorPrice = ctx.floor_price ?? 0;
  const rescindTax = ctx.rescind_tax_tokens ?? 0;
  const canAfford = ctx.can_afford_rescind_tax !== false;
  const remainingBudget = ctx.remaining_budget ?? 0;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { secondsLeft } = useTimer(turn.expires_at);

  async function submit(rescind: boolean) {
    setSubmitting(true);
    setError('');
    const res = await fetch(`/api/tournaments/${tournamentId}/human-bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turn_id: turn.id, rescind }),
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
      style={{ background: THEME.bgCard, borderColor: THEME.gold }}
    >
      <div className="flex items-center justify-between mb-4">
        <span
          className="text-sm font-bold"
          style={{ fontFamily: '"Playfair Display", serif', color: THEME.ink }}
        >
          You Won the Auction
        </span>
        <span
          className="text-sm font-medium px-2 py-0.5 rounded"
          style={{ fontFamily: '"DM Mono", monospace', color: THEME.ink, background: THEME.bgDark }}
        >
          {secondsLeft}s
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5 text-sm" style={{ fontFamily: '"DM Mono", monospace' }}>
        <div>
          <span style={{ color: THEME.inkLight }}>Tokens Won</span>
          <div style={{ color: THEME.ink }}>{tokensWon}</div>
        </div>
        <div>
          <span style={{ color: THEME.inkLight }}>Clearing Price</span>
          <div style={{ color: THEME.ink }}>${clearingPrice.toFixed(2)}</div>
        </div>
        <div>
          <span style={{ color: THEME.inkLight }}>Total Paid</span>
          <div style={{ color: THEME.ink }}>${totalPaid.toLocaleString()}</div>
        </div>
        <div>
          <span style={{ color: THEME.inkLight }}>Budget After</span>
          <div style={{ color: THEME.ink }}>${remainingBudget.toLocaleString()}</div>
        </div>
      </div>

      {/* Rescind info */}
      <div
        className="rounded-lg p-3 mb-4 text-xs border"
        style={{ background: THEME.bg, borderColor: THEME.bgDark, color: THEME.inkLight, fontFamily: '"IBM Plex Sans", sans-serif' }}
      >
        <p className="mb-1">
          <strong style={{ color: THEME.ink }}>Rescind:</strong> Return {tokensWon} tokens, get ${totalPaid.toLocaleString()} refunded.
        </p>
        <p className="mb-1">Tax: {rescindTax} tokens deducted from your holdings at reveal (2 periods later).</p>
        {!canAfford && (
          <p style={{ color: THEME.danger }}>You don't hold enough tokens to cover the rescind tax.</p>
        )}
      </div>

      {error && <p className="text-xs mb-3" style={{ color: THEME.danger }}>{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={() => submit(false)}
          disabled={submitting}
          className="flex-1 py-3 rounded-lg font-medium text-sm transition-colors"
          style={{ background: THEME.gold, color: THEME.ink, fontFamily: '"Playfair Display", serif' }}
        >
          Keep Tokens
        </button>
        <button
          onClick={() => submit(true)}
          disabled={submitting || !canAfford}
          className="flex-1 py-3 rounded-lg font-medium text-sm transition-colors border disabled:opacity-40"
          style={{ borderColor: THEME.danger, color: THEME.danger, fontFamily: '"Playfair Display", serif' }}
        >
          Rescind & Return
        </button>
      </div>
    </div>
  );
}
