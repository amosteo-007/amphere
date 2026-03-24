'use client';

import { THEME } from '@/lib/game-theme';
import { useTimer } from '@/lib/hooks/useTimer';

interface TimerProps {
  expiresAt: string;
  label?: string;
}

export default function Timer({ expiresAt, label = 'Time remaining' }: TimerProps) {
  const { secondsLeft } = useTimer(expiresAt);
  const urgent = secondsLeft <= 10;
  const pct = Math.min(100, (secondsLeft / 60) * 100);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs" style={{ color: THEME.inkLight, fontFamily: '"IBM Plex Sans", sans-serif' }}>
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: THEME.bgDark }}>
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${pct}%`,
            background: urgent ? THEME.danger : THEME.gold,
          }}
        />
      </div>
      <span
        className="text-sm font-medium min-w-[3ch] text-right"
        style={{
          fontFamily: '"DM Mono", monospace',
          color: urgent ? THEME.danger : THEME.ink,
        }}
      >
        {secondsLeft}s
      </span>
    </div>
  );
}
