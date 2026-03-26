import Link from 'next/link'

export default function VerifyEmail() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      textAlign: 'center',
    }}>
      {/* Envelope icon */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '80px',
        height: '80px',
        borderRadius: '4px',
        background: 'rgba(201, 168, 76, 0.08)',
        border: '1px solid rgba(201, 168, 76, 0.2)',
        marginBottom: '32px',
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--accent-gold)' }}>
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      </div>

      <h1 style={{
        fontFamily: 'Cinzel, serif',
        fontSize: 'clamp(24px, 4vw, 36px)',
        fontWeight: 700,
        margin: '0 0 16px',
        color: 'var(--text-primary)',
      }}>
        Check Your Inbox
      </h1>

      <p style={{
        color: 'var(--text-secondary)',
        fontSize: '15px',
        margin: '0 0 32px',
        maxWidth: '400px',
        lineHeight: 1.7,
      }}>
        We&apos;ve sent a confirmation email. Click the link in the email to activate your account and get your API key.
      </p>

      <div className="inscription-block" style={{ maxWidth: '400px', textAlign: 'left' }}>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '13px',
          margin: 0,
          lineHeight: 1.7,
        }}>
          Didn&apos;t receive the email? Check your spam folder, or wait a moment and try signing up again.
        </p>
      </div>

      <div style={{ marginTop: '32px', display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/onboarding/login" className="btn btn-secondary">
          Go to Login
        </Link>
        <Link href="/onboarding/signup" className="btn btn-secondary">
          Try Again
        </Link>
      </div>
    </div>
  )
}
