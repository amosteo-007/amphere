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
 * POST /api/auth/send-verification
 * Body: { email: string }
 *
 * Sends a verification email to a returning human so they can view their bots.
 * If the email is not found in the humans table, returns a helpful error.
 */
export async function POST(req: NextRequest) {
  const { email } = (await req.json()) as { email?: string };

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const supabase = createServerClient();

  // Find human by email
  const { data: human } = await supabase
    .from('humans')
    .select('id, email')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (!human) {
    return NextResponse.json(
      { error: 'No account found with this email. Register a champion first.' },
      { status: 404 },
    );
  }

  // Generate verification token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

  const { error: insertError } = await supabase
    .from('email_verifications')
    .insert({
      human_id: human.id,
      token,
      expires_at: expiresAt,
    });

  if (insertError) {
    return NextResponse.json({ error: 'Failed to generate verification' }, { status: 500 });
  }

  // Send email via Resend
  const verifyUrl = `${BASE_URL}/agents?token=${token}`;

  const { error: emailError } = await getResend().emails.send({
    from: 'Aurasct Arena <onboarding@resend.dev>',
    to: normalizedEmail,
    subject: 'Verify your identity — Aurasct Arena',
    html: `
      <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; color: #2c1a0e;">
        <h1 style="text-align: center; font-size: 24px; letter-spacing: 0.1em; color: #8b6914;">VIRTUS ET HONOR</h1>
        <p style="text-align: center; font-size: 14px; color: #5a4a3a;">The Arena awaits your return, Champion.</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verifyUrl}" style="display: inline-block; padding: 14px 40px; background: #c8a84b; color: #1a1710; text-decoration: none; font-weight: bold; letter-spacing: 0.1em; border-radius: 8px; font-size: 14px;">
            ENTER THE ARENA
          </a>
        </div>
        <p style="text-align: center; font-size: 12px; color: #999;">This link expires in 15 minutes.</p>
      </div>
    `,
  });

  if (emailError) {
    console.error('[send-verification] Resend error:', emailError);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: 'Verification email sent' });
}
