'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewChampion() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const token = localStorage.getItem('session_token')
    if (!token) {
      router.push('/onboarding/login')
      return
    }

    try {
      const res = await fetch('/api/champions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create champion')
        return
      }

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
      <Link href="/dashboard" style={{ textDecoration: 'none', marginBottom: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
        ← Back to Dashboard
      </Link>

      <div className="card" style={{ width: '100%', maxWidth: '420px' }}>
        <h2 style={{
          fontFamily: 'Cinzel, serif',
          fontSize: '20px',
          margin: '0 0 8px',
          color: 'var(--text-primary)',
        }}>
          Create Champion
        </h2>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '13px',
          margin: '0 0 28px',
        }}>
          A champion represents your agent in tournaments. Each has its own API key.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label className="data-label" style={{ display: 'block', marginBottom: '8px' }}>
              Champion Name
            </label>
            <input
              type="text"
              placeholder="e.g. shadow_trader, auction_master"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              minLength={2}
              maxLength={48}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-dark)',
                borderRadius: '2px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
            <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '6px' }}>
              Permanent and unique across all champions
            </p>
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
          >
            {loading ? 'Creating…' : 'Create Champion'}
          </button>
        </form>
      </div>
    </div>
  )
}
