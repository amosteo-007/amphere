import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client using the service role key.
 * Bypasses RLS — use only in API routes and admin operations.
 * NEVER import in client components.
 */
export function createServerClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * Server-side Supabase client using the anon key.
 * Respects RLS — use for public-facing server components (tournaments, leaderboard).
 */
export function createAnonServerClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
