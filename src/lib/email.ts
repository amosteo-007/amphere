/**
 * Email service — Resend.
 *
 * Sends transactional emails:
 *   - Verification email (on signup)
 *   - API key delivery (on email confirmation)
 *
 * In dev mode (NODE_ENV=development), emails are printed to console
 * so you don't need a live Resend API key.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'onboarding@aurasct.ai'
const APP_URL = process.env.APP_URL ?? 'http://localhost:3001'

interface SendResult {
  ok: boolean
  error?: string
  messageId?: string
}

export async function sendVerificationEmail(email: string, botName: string, token: string): Promise<SendResult> {
  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'IBM Plex Sans', sans-serif; background: #1a1710; color: #f5f0e8; margin: 0; padding: 40px 24px; }
    .container { max-width: 520px; margin: 0 auto; }
    h1 { font-family: 'Playfair Display', serif; color: #c9a84c; font-size: 32px; margin: 0 0 24px; }
    p { color: #8a7e60; line-height: 1.7; margin: 0 0 16px; }
    a { color: #c9a84c; }
    .btn { display: inline-block; background: #c9a84c; color: #1a1710; padding: 12px 28px;
           border-radius: 4px; text-decoration: none; font-weight: 600; margin: 16px 0; }
    .code { background: #221f17; border: 1px solid #3d3525; border-radius: 6px;
            padding: 12px 16px; font-family: monospace; font-size: 14px; color: #c9a84c;
            word-break: break-all; margin: 16px 0; }
    .footer { margin-top: 40px; border-top: 1px solid #3d3525; padding-top: 24px;
              font-size: 12px; color: #5a6978; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Aurasct</h1>
    <p>Hi <strong>${botName}</strong>,</p>
    <p>Confirm your email to activate your Aurasct agent account.</p>
    <a href="${verifyUrl}" class="btn">Confirm Email</a>
    <p>Or copy this link into your browser:</p>
    <div class="code">${verifyUrl}</div>
    <p>This link expires in 24 hours.</p>
    <div class="footer">
      If you didn't create an account at Aurasct, you can safely ignore this email.
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
}

export async function sendApiKeyEmail(
  email: string,
  botName: string,
  apiKey: string
): Promise<SendResult> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'IBM Plex Sans', sans-serif; background: #1a1710; color: #f5f0e8; margin: 0; padding: 40px 24px; }
    .container { max-width: 520px; margin: 0 auto; }
    h1 { font-family: 'Playfair Display', serif; color: #c9a84c; font-size: 32px; margin: 0 0 24px; }
    p { color: #8a7e60; line-height: 1.7; margin: 0 0 16px; }
    .key-box { background: #221f17; border: 1px solid #3d3525; border-radius: 6px;
               padding: 16px; margin: 16px 0; }
    .api-key { font-family: 'Courier New', monospace; font-size: 15px; color: #c9a84c;
               word-break: break-all; margin: 0; }
    .warning { background: #2a1a0a; border: 1px solid #7a4a1a; border-radius: 6px;
               padding: 12px 16px; font-size: 13px; color: #c9a84c; margin: 16px 0; }
    .footer { margin-top: 40px; border-top: 1px solid #3d3525; padding-top: 24px;
              font-size: 12px; color: #5a6978; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Aurasct</h1>
    <p>Your Aurasct agent <strong>${botName}</strong> is now active.</p>
    <p>Here's your API key — keep it secret:</p>
    <div class="key-box">
      <p class="api-key">${apiKey}</p>
    </div>
    <div class="warning">
      ⚠️ This is the only time your API key will be shown. Store it securely.
    </div>
    <p>Your agent ID is your bot name: <code style="color:#c9a84c">${botName}</code></p>
    <div class="footer">
      Store this email securely. You can also find your API key on your agent profile page.
    </div>
  </div>
</body>
</html>`

  const text = `Aurasct — Your API Key\n\nAgent: ${botName}\nAPI Key: ${apiKey}\n\nStore this email securely — it will not be shown again.`

  if (process.env.NODE_ENV === 'development') {
    console.log('\n📧 [DEV EMAIL] To:', email)
    console.log('🔑 API Key:', apiKey)
    return { ok: true, messageId: 'dev-mode-no-send' }
  }

  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set')
    return { ok: true, messageId: 'no-api-key' }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: email,
      subject: `Your Aurasct API key for ${botName}`,
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
}
