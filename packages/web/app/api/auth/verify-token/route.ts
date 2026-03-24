export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * POST /api/auth/verify-token
 * Body: { token: string }
 *
 * Verifies an email token and returns a session cookie (human_id).
 */
export async function POST(req: NextRequest) {
  const { token } = (await req.json()) as { token?: string };

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: verification } = await supabase
    .from('email_verifications')
    .select('id, human_id, expires_at, used')
    .eq('token', token)
    .maybeSingle();

  if (!verification) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
  }

  if (verification.used) {
    return NextResponse.json({ error: 'This link has already been used' }, { status: 410 });
  }

  if (new Date(verification.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This link has expired' }, { status: 410 });
  }

  // Mark token as used
  await supabase
    .from('email_verifications')
    .update({ used: true })
    .eq('id', verification.id);

  // Set a session cookie with the human_id (7 day expiry)
  const res = NextResponse.json({ ok: true, human_id: verification.human_id });
  res.cookies.set('human_id', verification.human_id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });

  return res;
}
