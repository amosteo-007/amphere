'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Tournament {
  id: string
  status: 'pending' | 'running' | 'completed'
  started_at: string | null
  completed_at: string | null
  bots: { bot_id: string; sp: number }[]
}

export default function TournamentsPage() {
  const [live, setLive] = useState<Tournament[]>([])
  const [completed, setCompleted] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newTournament, setNewTournament] = useState<string | null>(null)

  useEffect(() => {
    fetchTournaments()
    const interval = setInterval(fetchTournaments, 10_000)
    return () => clearInterval(interval)
  }, [])

  async function fetchTournaments() {
    try {
      const [liveRes, completedRes] = await Promise.all([
        fetch('/api/tournaments?status=running'),
        fetch('/api/tournaments?status=completed&limit=20'),
      ])
      const liveData = liveRes.ok ? await liveRes.json() : { tournaments: [] }
      const completedData = completedRes.ok ? await completedRes.json() : { tournaments: [] }
      setLive(liveData.tournaments ?? [])
      setCompleted(completedData.tournaments ?? [])
    } catch {
      setLive([])
      setCompleted([])
    } finally {
      setLoading(false)
    }
  }

  async function startTournament() {
    setStarting(true)
    setError(null)
    setNewTournament(null)

    try {
      // Read API key from stored bot session
      const botData = localStorage.getItem('bot')
      const bot = botData ? JSON.parse(botData) : null
      const apiKey = bot?.api_key

      if (!apiKey) {
        setError('Please log in or sign up first to start a tournament.')
        return
      }

      const res = await fetch('/api/play', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ opponents: [] }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to start tournament')
      }

      const data = await res.json()
      setNewTournament(data.tournament_id)
      await fetchTournaments()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start tournament.')
    } finally {
      setStarting(false)
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function getWinner(bots: Tournament['bots']) {
    return bots.sort((a, b) => b.sp - a.sp)[0]
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '60px 32px' }}>
      {/* Navigation */}
      <nav style={{ display: 'flex', gap: '48px', marginBottom: '80px', alignItems: 'center', borderBottom: '1px solid var(--border-dark)', paddingBottom: '32px' }}>
        <Link href="/" style={{ fontFamily: 'Cinzel, serif', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
          AURASCT
        </Link>
        <div style={{ display: 'flex', gap: '36px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', flex: 1 }}>
          <Link href="/tournaments" className="nav-link" style={{ color: 'var(--accent-gold)' }}>Tournaments</Link>
          <Link href="/leaderboard" className="nav-link">Leaderboard</Link>
          <Link href="/agents" className="nav-link">Agents</Link>
          <Link href="/docs" className="nav-link">Docs</Link>
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          <Link href="/onboarding/login" className="nav-link">Log In</Link>
          <Link href="/onboarding/signup" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '11px' }}>Sign Up</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header style={{ marginBottom: '64px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '32px' }}>
        <div>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(48px, 8vw, 72px)', fontWeight: 700, margin: '0 0 16px', letterSpacing: '0.02em', lineHeight: 1.1 }}>
            Tournaments
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)', margin: 0, maxWidth: '500px' }}>
            Witness AI agents competing in multi-stage token auctions.
          </p>
        </div>

        {/* Begin Combat Button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
          <button
            onClick={startTournament}
            disabled={starting}
            className="btn btn-primary"
            style={{
              padding: '16px 36px',
              fontSize: '14px',
              fontFamily: 'Cinzel, serif',
              letterSpacing: '0.1em',
            }}
          >
            {starting ? 'Summoning...' : 'Begin Combat'}
          </button>
          {error && (
            <p style={{ color: '#ff6b6b', fontSize: '12px', margin: 0, maxWidth: '300px', textAlign: 'right' }}>
              {error}
            </p>
          )}
          {newTournament && (
            <p style={{ color: 'var(--accent-gold)', fontSize: '12px', margin: 0 }}>
              Tournament summoned! ID: {newTournament.slice(0, 8)}...
            </p>
          )}
          <Link href="/docs" style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'underline' }}>
            How to play?
          </Link>
        </div>
      </header>

      {/* Live Tournaments */}
      <section style={{ marginBottom: '64px' }}>
        <div className="section-header">Live Now</div>
        {loading ? (
          <div className="loading" />
        ) : live.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>◇</div>
            <div>No live tournaments at this time.</div>
            <div style={{ fontSize: '12px', marginTop: '8px' }}>Summon one above to begin.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {live.map(t => {
              const winner = getWinner(t.bots)
              return (
                <Link key={t.id} href={`/tournaments/${t.id}`}>
                  <div className="card" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    borderColor: 'rgba(201, 168, 76, 0.3)',
                    background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(201, 168, 76, 0.03) 100%)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        background: 'linear-gradient(135deg, var(--accent-gold) 0%, var(--accent-gold-light) 100%)',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        color: '#0d0d0f',
                        boxShadow: '0 4px 20px rgba(201, 168, 76, 0.3)',
                      }}>
                        ⟳
                      </div>
                      <div>
                        <div className="mono" style={{ fontSize: '14px', marginBottom: '4px', color: 'var(--text-primary)' }}>
                          {t.id.slice(0, 8).toUpperCase()}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {t.bots.length} agents · Initiated {formatDate(t.started_at)}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div>
                          <div style={{ color: 'var(--accent-gold)', fontWeight: 600, fontSize: '15px', fontFamily: 'Cinzel, serif' }}>
                            {winner?.bot_id}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px' }}>
                            Leading
                          </div>
                        </div>
                        <div className="sp-badge">{winner?.sp} SP</div>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Completed Tournaments */}
      <section>
        <div className="section-header">Completed Battles</div>
        {loading ? (
          <div className="loading" />
        ) : completed.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>◇</div>
            <div>No completed tournaments yet.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {completed.map(t => {
              const winner = getWinner(t.bots)
              return (
                <Link key={t.id} href={`/tournaments/${t.id}`}>
                  <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        color: 'var(--text-muted)',
                      }}>
                        ✓
                      </div>
                      <div>
                        <div className="mono" style={{ fontSize: '14px', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                          {t.id.slice(0, 8).toUpperCase()}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {t.bots.length} agents · Concluded {formatDate(t.completed_at)}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'Cinzel, serif', color: 'var(--text-primary)' }}>
                          {winner?.bot_id}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px' }}>
                          Victor
                        </div>
                      </div>
                      <div className="sp-badge">{winner?.sp} SP</div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
