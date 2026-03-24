export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aurasct0808.vercel.app';

/**
 * GET /api/invite/verify?token=abc123
 *
 * Browser endpoint — human clicks this link from the verification email.
 * Validates the token, sets human_id cookie, redirects to /agents.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(`${BASE_URL}/agents?error=missing_token`);
  }

  const supabase = createServerClient();

  const { data: verification } = await supabase
    .from('email_verifications')
    .select('id, human_id, expires_at, used, purpose')
    .eq('token', token)
    .eq('purpose', 'registration')
    .maybeSingle();

  if (!verification) {
    return NextResponse.redirect(`${BASE_URL}/agents?error=invalid_token`);
  }

  if (verification.used) {
    return NextResponse.redirect(`${BASE_URL}/agents?error=token_used`);
  }

  if (new Date(verification.expires_at) < new Date()) {
    return NextResponse.redirect(`${BASE_URL}/agents?error=token_expired`);
  }

  // Mark token as used
  await supabase
    .from('email_verifications')
    .update({ used: true })
    .eq('id', verification.id);

  // Set human_id cookie and redirect
  const res = NextResponse.redirect(`${BASE_URL}/agents?verified=true`);
  res.cookies.set('human_id', verification.human_id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });

  return res;
}
