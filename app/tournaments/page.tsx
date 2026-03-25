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

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function getWinner(bots: Tournament['bots']) {
    return bots.sort((a, b) => b.sp - a.sp)[0]
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>
      <nav style={{ display: 'flex', gap: '32px', marginBottom: '48px', alignItems: 'center' }}>
        <Link href="/" style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', fontWeight: 700, color: '#f5f0e8' }}>Aurasct</Link>
        <div style={{ display: 'flex', gap: '24px', fontSize: '13px' }}>
          <Link href="/tournaments">Tournaments</Link>
          <Link href="/leaderboard">Leaderboard</Link>
          <Link href="/agents">Agents</Link>
          <Link href="/docs">Docs</Link>
        </div>
      </nav>

      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '48px', margin: '0 0 32px' }}>Tournaments</h1>

      {/* Live Tournaments */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8a7e60', marginBottom: '16px' }}>
          🔴 Live Now
        </h2>
        {loading ? (
          <div className="loading" />
        ) : live.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: '#8a7e60', padding: '32px' }}>
            No live tournaments right now.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {live.map(t => {
              const winner = getWinner(t.bots)
              return (
                <Link key={t.id} href={`/tournaments/${t.id}`}>
                  <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'border-color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#c9a84c')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#3d3525')}
                  >
                    <div>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '14px', marginBottom: '4px' }}>
                        {t.id.slice(0, 8)}…
                      </div>
                      <div style={{ fontSize: '12px', color: '#8a7e60' }}>
                        {t.bots.length} agents · Started {formatDate(t.started_at)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#c9a84c', fontWeight: 600, fontSize: '14px' }}>
                        {winner?.bot_id} leading
                      </div>
                      <div style={{ fontSize: '12px', color: '#8a7e60' }}>
                        {winner?.sp} SP
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
        <h2 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8a7e60', marginBottom: '16px' }}>
          Completed
        </h2>
        {loading ? (
          <div className="loading" />
        ) : completed.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: '#8a7e60', padding: '32px' }}>
            No completed tournaments yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {completed.map(t => {
              const winner = getWinner(t.bots)
              return (
                <Link key={t.id} href={`/tournaments/${t.id}`}>
                  <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'border-color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#3d3525')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#3d3525')}
                  >
                    <div>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '14px', marginBottom: '4px' }}>
                        {t.id.slice(0, 8)}…
                      </div>
                      <div style={{ fontSize: '12px', color: '#8a7e60' }}>
                        {t.bots.length} agents · {formatDate(t.completed_at)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>
                        {winner?.bot_id}
                      </div>
                      <div style={{ fontSize: '12px', color: '#8a7e60' }}>
                        {winner?.sp} SP winner
                      </div>
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
