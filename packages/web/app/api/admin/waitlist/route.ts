export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createSupabase } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

async function getAuthUserEmail(): Promise<string | null> {
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
  return user?.email?.toLowerCase() ?? null;
}

function isAdmin(email: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email);
}

// GET /api/admin/waitlist — list all waitlist entries
export async function GET() {
  const email = await getAuthUserEmail();
  if (!isAdmin(email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = createSupabase();
  const { data, error } = await supabase
    .from('waitlist')
    .select('id, email, telegram_handle, moltbook_handle, why, status, created_at, user_id')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, entries: data ?? [] });
}

// POST /api/admin/waitlist — approve or deny
// Body: { waitlist_id: string, action: 'approve' | 'deny' }
export async function POST(req: NextRequest) {
  const email = await getAuthUserEmail();
  if (!isAdmin(email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { waitlist_id, action } = (await req.json()) as {
    waitlist_id?: string;
    action?: 'approve' | 'deny';
  };

  if (!waitlist_id || !action || !['approve', 'deny'].includes(action)) {
    return NextResponse.json({ error: 'waitlist_id and action (approve|deny) required' }, { status: 400 });
  }

  const supabase = createSupabase();

  if (action === 'deny') {
    const { error } = await supabase
      .from('waitlist')
      .update({ status: 'denied' })
      .eq('id', waitlist_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'denied' });
  }

  // Approve: set status, generate invite code, insert into invite_codes
  const { error: updateError } = await supabase
    .from('waitlist')
    .update({ status: 'approved' })
    .eq('id', waitlist_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Generate invite code via DB function
  const { data: codeResult, error: codeError } = await supabase.rpc('generate_invite_code');

  if (codeError || !codeResult) {
    // Fallback: generate in JS
    const cities = ['athens', 'sparta', 'troy', 'rome', 'delphi', 'olympia', 'corinth', 'thebes', 'tokyo', 'london'];
    const symbols = ['!', '@', '#', '$', '%', '&', '*', '_', '-', '+'];
    const city = cities[Math.floor(Math.random() * cities.length)];
    const nums = String(Math.floor(Math.random() * 10000000000)).padStart(10, '0');
    const sym1 = symbols[Math.floor(Math.random() * symbols.length)];
    const sym2 = symbols[Math.floor(Math.random() * symbols.length)];
    var inviteCode = `${city}${nums}${sym1}${sym2}`;
  } else {
    var inviteCode = codeResult as string;
  }

  // Insert invite code (single-use, 7-day expiry)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error: insertError } = await supabase
    .from('invite_codes')
    .insert({
      code: inviteCode,
      max_uses: 1,
      expires_at: expiresAt,
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, action: 'approved', invite_code: inviteCode, expires_at: expiresAt });
}
