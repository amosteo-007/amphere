import { SupabaseClient } from '@supabase/supabase-js';

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
 * Logs every attempt to wake_log regardless of outcome.
 */
export async function sendWake(
  supabase: SupabaseClient,
  registeredBotId: string,
  wakeUrl: string,
  payload: WakePayload,
): Promise<void> {
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

  if (!success) {
    console.warn(`[Wake] ${registeredBotId} → ${wakeUrl} failed: ${error}`);
  }
}

/**
 * Look up all registered bots participating in a tournament (by registered_bot_id
 * in the agents array) and fire wake notifications to those with a wake_url set.
 */
export async function notifyTournamentBots(
  supabase: SupabaseClient,
  tournament: { id: string; agents: any[] },
  payload: Omit<WakePayload, 'tournament_id'>,
): Promise<void> {
  const registeredBotIds: string[] = tournament.agents
    .map((a: any) => a.registered_bot_id)
    .filter(Boolean);

  if (registeredBotIds.length === 0) return;

  const { data: bots } = await supabase
    .from('registered_bots')
    .select('id, wake_url')
    .in('id', registeredBotIds)
    .not('wake_url', 'is', null);

  if (!bots || bots.length === 0) return;

  await Promise.allSettled(
    bots.map((bot: { id: string; wake_url: string }) =>
      sendWake(supabase, bot.id, bot.wake_url, {
        tournament_id: tournament.id,
        ...payload,
      }),
    ),
  );
}
