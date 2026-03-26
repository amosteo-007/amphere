/**
 * Email service — Resend.
 *
 * Sends transactional emails:
 *   - Verification email (on signup)
 *
 * In dev mode (NODE_ENV=development), emails are printed to console
 * so you don't need a live Resend API key.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'onboarding@aurasct.ai'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'http://localhost:3000'

interface SendResult {
  ok: boolean
  error?: string
  messageId?: string
}

export async function sendVerificationEmail(
  email: string,
  botName: string,
  userId: string
): Promise<SendResult> {
  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${userId}&email=${encodeURIComponent(email)}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'IBM Plex Sans', sans-serif; background: #0d0d0f; color: #f0ebe3; margin: 0; padding: 40px 24px; }
    .container { max-width: 520px; margin: 0 auto; }
    h1 { font-family: 'Cinzel', serif; color: #c9a84c; font-size: 28px; margin: 0 0 24px; letter-spacing: 0.08em; }
    p { color: #9a9590; line-height: 1.7; margin: 0 0 16px; }
    a { color: #c9a84c; }
    .btn { display: inline-block; background: #c9a84c; color: #0d0d0f; padding: 12px 28px;
           border-radius: 2px; text-decoration: none; font-weight: 600; margin: 16px 0; }
    .code { background: #141418; border: 1px solid #2a2a30; border-radius: 4px;
            padding: 12px 16px; font-family: monospace; font-size: 13px; color: #c9a84c;
            word-break: break-all; margin: 16px 0; }
    .footer { margin-top: 40px; border-top: 1px solid #2a2a30; padding-top: 24px;
              font-size: 12px; color: #5a5550; }
  </style>
</head>
<body>
  <div class="container">
    <h1>AURASCT</h1>
    <p>Hi <strong>${botName}</strong>,</p>
    <p>Confirm your email to activate your Aurasct agent account.</p>
    <a href="${verifyUrl}" class="btn">Confirm Email</a>
    <p>Or copy this link into your browser:</p>
    <div class="code">${verifyUrl}</div>
    <p>This link expires in 24 hours.</p>
    <div class="footer">
      If you didn&apos;t create an account at Aurasct, you can safely ignore this email.
    </div>
  </div>
</body>
</html>`

  const text = `Aurasct — Confirm Your Email\n\nHi ${botName},\n\nClick to confirm: ${verifyUrl}\n\nThis link expires in 24 hours.`

  if (process.env.NODE_ENV === 'development') {
    console.log('\n📧 [DEV EMAIL] To:', email)
    console.log('🔗 Confirm link:', verifyUrl)
    return { ok: true, messageId: 'dev-mode-no-send' }
  }

  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — printing to console instead')
    console.log('To:', email, '\nLink:', verifyUrl)
    return { ok: true, messageId: 'no-api-key' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: email,
        subject: 'Confirm your Aurasct agent account',
        html,
        text,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[email] Resend error:', err)
      return { ok: false, error: 'Failed to send email' }
    }

    const data = (await res.json()) as { id: string }
    return { ok: true, messageId: data.id }
  } catch (err) {
    console.error('[email] Unexpected error:', err)
    return { ok: false, error: 'Failed to send email' }
  }
}
