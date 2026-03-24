/**
 * Tournament Scheduler Job
 *
 * Runs periodically (every 60s) and promotes `scheduled_tournaments` rows
 * whose `starts_at` has passed into real `tournaments` rows with status='pending'.
 * The pollWorker then picks them up automatically within 3s.
 *
 * Called from the main poll loop or run standalone.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export async function runScheduler(supabase: SupabaseClient): Promise<void> {
  const now = new Date().toISOString();

  // Fetch all scheduled tournaments whose start time has passed
  const { data: due, error } = await supabase
    .from('scheduled_tournaments')
    .select('id, config, agents')
    .eq('status', 'scheduled')
    .lte('starts_at', now);

  if (error) {
    console.error('[Scheduler] Query error:', error.message);
    return;
  }

  if (!due || due.length === 0) return;

  console.log(`[Scheduler] Promoting ${due.length} scheduled tournament(s)`);

  for (const st of due) {
    try {
      // Create the real tournament row
      const { data: tournament, error: insertError } = await supabase
        .from('tournaments')
        .insert({
          status: 'pending',
          auction_type: 'cascade-vickrey',
          is_test: false,
          config: st.config,
          agents: st.agents ?? [],
        })
        .select('id')
        .single();

      if (insertError || !tournament) {
        console.error(`[Scheduler] Failed to promote ${st.id}:`, insertError?.message);
        continue;
      }

      // Mark the scheduled_tournament as promoted
      await supabase
        .from('scheduled_tournaments')
        .update({ status: 'promoted', tournament_id: tournament.id })
        .eq('id', st.id);

      console.log(`[Scheduler] Promoted ${st.id} → tournament ${tournament.id}`);
    } catch (err: any) {
      console.error(`[Scheduler] Error promoting ${st.id}:`, err.message);
    }
  }
}
