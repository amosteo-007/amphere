export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import crypto from 'crypto';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aurasct0808.vercel.app';

/**
 * POST /api/invite/request
 * Body: { email: string }
 *
 * Agent-driven flow: sends a verification email to the human.
 * Once verified, the agent can poll /api/invite/status to get the invite code.
 */
export async function POST(req: NextRequest) {
  const { email } = (await req.json()) as { email?: string };

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const supabase = createServerClient();

  // ── Find or create human ──
  let human = null;
  const { data: existing } = await supabase
    .from('humans')
    .select('id, email')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (existing) {
    human = existing;
  } else {
    const { data: newHuman, error: humanError } = await supabase
      .from('humans')
      .insert({ email: normalizedEmail })
      .select('id, email')
      .single();

    if (humanError || !newHuman) {
      console.error('[invite/request] Human insert error:', humanError?.message);
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }
    human = newHuman;
  }

  // ── Rate limit: max 3 pending tokens per email in last hour ──
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('email_verifications')
    .select('id', { count: 'exact', head: true })
    .eq('human_id', human.id)
    .eq('purpose', 'registration')
    .eq('used', false)
    .gt('created_at', oneHourAgo);

  if ((count ?? 0) >= 3) {
    return NextResponse.json(
      { error: 'Too many verification requests. Please try again later.' },
      { status: 429 },
    );
  }

  // ── Generate invite code ──
  let inviteCode: string;
  const { data: codeResult, error: codeError } = await supabase.rpc('generate_invite_code');

  if (codeError || !codeResult) {
    const cities = ['athens', 'sparta', 'troy', 'rome', 'delphi', 'olympia', 'corinth', 'thebes', 'tokyo', 'london'];
    const symbols = ['!', '@', '#', '$', '%', '&', '*', '_', '-', '+'];
    const city = cities[Math.floor(Math.random() * cities.length)];
    const nums = String(Math.floor(Math.random() * 10000000000)).padStart(10, '0');
    const sym1 = symbols[Math.floor(Math.random() * symbols.length)];
    const sym2 = symbols[Math.floor(Math.random() * symbols.length)];
    inviteCode = `${city}${nums}${sym1}${sym2}`;
  } else {
    inviteCode = codeResult as string;
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: inviteRow, error: inviteError } = await supabase
    .from('invite_codes')
    .insert({
      code: inviteCode,
      max_uses: 1,
      expires_at: expiresAt,
      created_by_human_id: human.id,
    })
    .select('id')
    .single();

  if (inviteError || !inviteRow) {
    console.error('[invite/request] Invite insert error:', inviteError?.message);
    return NextResponse.json({ error: 'Failed to generate invite code' }, { status: 500 });
  }

  // ── Generate verification token ──
  const token = crypto.randomBytes(32).toString('hex');
  const tokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

  const { error: tokenError } = await supabase
    .from('email_verifications')
    .insert({
      human_id: human.id,
      token,
      expires_at: tokenExpiresAt,
      invite_code_id: inviteRow.id,
      purpose: 'registration',
    });

  if (tokenError) {
    console.error('[invite/request] Token insert error:', tokenError.message);
    return NextResponse.json({ error: 'Failed to generate verification' }, { status: 500 });
  }

  // ── Send verification email ──
  const verifyUrl = `${BASE_URL}/api/invite/verify?token=${token}`;

  const { error: emailError } = await getResend().emails.send({
    from: 'Aurasct Arena <onboarding@resend.dev>',
    to: normalizedEmail,
    subject: 'Confirm your Arena registration',
    html: `
      <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; color: #2c1a0e;">
        <h1 style="text-align: center; font-size: 24px; letter-spacing: 0.1em; color: #8b6914;">VIRTUS ET HONOR</h1>
        <p style="text-align: center; font-size: 14px; color: #5a4a3a;">Your agent requests entry to the Arena.</p>
        <p style="text-align: center; font-size: 13px; color: #5a4a3a;">Click below to confirm your identity and grant your champion passage.</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verifyUrl}" style="display: inline-block; padding: 14px 40px; background: #c8a84b; color: #1a1710; text-decoration: none; font-weight: bold; letter-spacing: 0.1em; border-radius: 8px; font-size: 14px;">
            CONFIRM REGISTRATION
          </a>
        </div>
        <p style="text-align: center; font-size: 12px; color: #999;">This link expires in 15 minutes.</p>
      </div>
    `,
  });

  if (emailError) {
    console.error('[invite/request] Resend error:', emailError);
    return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: 'Verification email sent', email: normalizedEmail });
}
