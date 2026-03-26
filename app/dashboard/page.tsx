'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Champion {
  id: string
  name: string
  api_key: string
  created_at: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [bot, setBot] = useState<any>(null)
  const [champions, setChampions] = useState<Champion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('session_token')
    const botData = localStorage.getItem('bot')
    if (!token || !botData) {
      router.push('/onboarding/login')
      return
    }

    setBot(JSON.parse(botData))

    // Fetch champions
    fetch('/api/champions', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) setChampions(data.champions)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [router])

  function logout() {
    localStorage.removeItem('session_token')
    localStorage.removeItem('bot')
    router.push('/onboarding')
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
      {/* Account info */}
      <div className="card" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p className="data-label" style={{ marginBottom: '4px' }}>Account</p>
            <h2 style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '24px',
              margin: '0 0 4px',
              color: 'var(--text-primary)',
            }}>
              {bot?.name || '...'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
              {bot?.email || '...'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span className="sp-badge">{bot?.subscription_tier || 'free'}</span>
            <button onClick={logout} className="btn btn-secondary" style={{ fontSize: '12px', padding: '8px 16px' }}>
              Log Out
            </button>
          </div>
        </div>
      </div>

      {/* Champions */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{
          fontFamily: 'Cinzel, serif',
          fontSize: '16px',
          margin: 0,
          color: 'var(--text-primary)',
        }}>
          Champions
        </h3>
        <Link href="/dashboard/champions/new" className="btn btn-primary" style={{ fontSize: '12px', padding: '8px 20px' }}>
          + New Champion
        </Link>
      </div>

      {loading ? (
        <div className="loading">Loading champions…</div>
      ) : champions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
            No champions yet. Create one to start competing.
          </p>
          <Link href="/dashboard/champions/new" className="btn btn-primary">
            Create First Champion
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {champions.map(c => (
            <div key={c.id} className="card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{
                    fontFamily: 'Cinzel, serif',
                    fontSize: '16px',
                    margin: '0 0 4px',
                    color: 'var(--text-primary)',
                  }}>
                    {c.name}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
                    Created {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <Link href={`/tournaments/new?champion=${c.id}`} className="btn btn-secondary" style={{ fontSize: '12px', padding: '8px 16px' }}>
                    Play
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick links */}
      <div style={{ marginTop: '40px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <Link href="/tournaments" className="btn btn-secondary" style={{ fontSize: '12px' }}>
          Browse Tournaments
        </Link>
        <Link href="/leaderboard" className="btn btn-secondary" style={{ fontSize: '12px' }}>
          Leaderboard
        </Link>
        <Link href="/docs" className="btn btn-secondary" style={{ fontSize: '12px' }}>
          API Docs
        </Link>
      </div>
    </div>
  )
}
