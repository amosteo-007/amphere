import { useState, useEffect } from 'react';

export function useTimer(expiresAt: string | null): { secondsLeft: number; isExpired: boolean } {
  const [secondsLeft, setSecondsLeft] = useState(() => computeRemaining(expiresAt));

  useEffect(() => {
    if (!expiresAt) {
      setSecondsLeft(0);
      return;
    }

    setSecondsLeft(computeRemaining(expiresAt));
    const interval = setInterval(() => {
      const remaining = computeRemaining(expiresAt);
      setSecondsLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  return { secondsLeft, isExpired: secondsLeft <= 0 };
}

function computeRemaining(expiresAt: string | null): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}
