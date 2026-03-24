import { createServerClient } from './supabase/server';

export interface WakePayload {
  event_type: 'turn_ready' | 'tournament_start' | 'period_start';
  tournament_id: string;
  bot_id?: string;
  turn_id?: string;
  stage?: number;
  period?: number;
}

/**
 * Fire a wake notification to a registered bot's wakeUrl.
 * Logs the attempt to wake_log regardless of outcome.
 */
export async function sendWake(registeredBotId: string, wakeUrl: string, payload: WakePayload): Promise<void> {
  const supabase = createServerClient();
  const start = Date.now();
  let success = false;
  let error: string | undefined;

  try {
    const res = await fetch(wakeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    success = res.ok;
    if (!res.ok) error = `HTTP ${res.status}`;
  } catch (err: any) {
    error = err.message ?? 'unknown error';
  }

  const latency_ms = Date.now() - start;

  await supabase.from('wake_log').insert({
    registered_bot_id: registeredBotId,
    event_type: payload.event_type,
    payload,
    success,
    latency_ms,
    error: error ?? null,
  });
}
