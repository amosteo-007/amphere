import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  // createBrowserClient throws during SSR if env vars are missing.
  // 'use client' components only call this inside useEffect/handlers — never during SSR render.
  if (typeof window === 'undefined') return null as any;
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
