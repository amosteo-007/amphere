export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * GET /api/invite/status?email=user@example.com
 *
 * Agent polls this endpoint to check if the human has verified their email.
 * Once verified, returns the invite code.
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email');

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const supabase = createServerClient();

  // Find human by email
  const { data: human } = await supabase
    .from('humans')
    .select('id')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (!human) {
    return NextResponse.json({ status: 'not_found' });
  }

  // Find most recent registration verification for this human
  const { data: verification } = await supabase
    .from('email_verifications')
    .select('id, used, invite_code_id')
    .eq('human_id', human.id)
    .eq('purpose', 'registration')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!verification) {
    return NextResponse.json({ status: 'not_found' });
  }

  if (!verification.used) {
    return NextResponse.json({ status: 'pending' });
  }

  // Verified — look up the invite code
  if (!verification.invite_code_id) {
    return NextResponse.json({ status: 'error', error: 'No invite code linked' }, { status: 500 });
  }

  const { data: inviteCode } = await supabase
    .from('invite_codes')
    .select('code')
    .eq('id', verification.invite_code_id)
    .single();

  if (!inviteCode) {
    return NextResponse.json({ status: 'error', error: 'Invite code not found' }, { status: 500 });
  }

  return NextResponse.json({ status: 'verified', invite_code: inviteCode.code });
}
