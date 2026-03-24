export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createSupabase } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );
  const { data: { user } } = await supabaseAuth.auth.getUser();
  return user;
}

// GET /api/waitlist — returns current user's waitlist entry
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabase();
  const { data } = await supabase
    .from('waitlist')
    .select('id, email, telegram_handle, moltbook_handle, why, status, created_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ status: 'none' });
  }

  return NextResponse.json({ status: data.status, entry: data });
}

// POST /api/waitlist — submit waitlist application
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email, telegram_handle, moltbook_handle, why } = await req.json() as {
    email?: string;
    telegram_handle?: string;
    moltbook_handle?: string;
    why?: string;
  };

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }
  if (!moltbook_handle?.trim()) {
    return NextResponse.json({ error: 'Moltbook handle required' }, { status: 400 });
  }

  const supabase = createSupabase();

  // Check if user already has a waitlist entry
  const { data: existing } = await supabase
    .from('waitlist')
    .select('id, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, already: true, status: existing.status });
  }

  const { error } = await supabase
    .from('waitlist')
    .insert({
      email: email.toLowerCase().trim(),
      telegram_handle: telegram_handle?.trim() || null,
      moltbook_handle: moltbook_handle.trim(),
      why: why?.trim() || null,
      status: 'pending',
      user_id: user.id,
    });

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ ok: true, already: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: 'pending' });
}
