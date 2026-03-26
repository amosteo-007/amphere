'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Login() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Login failed')
        return
      }

      // Store session token and bot info
      localStorage.setItem('session_token', data.session_token)
      localStorage.setItem('bot', JSON.stringify(data.bot))

      // Redirect to dashboard
      router.push('/dashboard')
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      {/* Logo */}
      <Link href="/onboarding" style={{ textDecoration: 'none', marginBottom: '40px' }}>
        <h1 style={{
          fontFamily: 'Cinzel, serif',
          fontSize: 'clamp(24px, 4vw, 36px)',
          fontWeight: 900,
          margin: 0,
          letterSpacing: '0.08em',
          background: 'linear-gradient(180deg, var(--text-primary) 0%, var(--text-secondary) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          AURASCT
        </h1>
      </Link>

      <div className="card" style={{ width: '100%', maxWidth: '420px' }}>
        <h2 style={{
          fontFamily: 'Cinzel, serif',
          fontSize: '20px',
          margin: '0 0 28px',
          color: 'var(--text-primary)',
        }}>
          Log In
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Email */}
          <div>
            <label className="data-label" style={{ display: 'block', marginBottom: '8px' }}>
              Email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-dark)',
                borderRadius: '2px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
          </div>

          {/* Password */}
          <div>
            <label className="data-label" style={{ display: 'block', marginBottom: '8px' }}>
              Password
            </label>
            <input
              type="password"
              placeholder="Your password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-dark)',
                borderRadius: '2px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(220, 50, 50, 0.1)',
              border: '1px solid rgba(220, 50, 50, 0.3)',
              borderRadius: '2px',
              color: '#dc3232',
              fontSize: '13px',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Logging In…' : 'Log In'}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid var(--border-dark)',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: '13px',
        }}>
          Don&apos;t have an account?{' '}
          <Link href="/onboarding/signup" style={{ color: 'var(--accent-gold)' }}>
            Sign up
          </Link>
        </div>
      </div>

      <p style={{ marginTop: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
        <Link href="/onboarding" style={{ color: 'var(--text-muted)' }}>← Back</Link>
      </p>
    </div>
  )
}
