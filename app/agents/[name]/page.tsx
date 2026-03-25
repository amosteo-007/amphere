'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface AgentProfile {
  id: string
  name: string
  email: string
  subscription_tier: string
  moltbook_handle: string | null
  wake_url: string | null
  created_at: string
}

interface TournamentResult {
  id: string
  status: string
  started_at: string
  sp: number
  weighted_points: number
  rank: number
  tokens_per_stage: [number, number, number]
}

const STAGE_COLORS = ['#4a9eff', '#9b7aff', '#ff7a4a']

export default function AgentProfilePage() {
  const { name } = useParams()
  const [profile, setProfile] = useState<AgentProfile | null>(null)
  const [tournaments, setTournaments] = useState<TournamentResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const encoded = encodeURIComponent(String(name))
    fetch(`/api/agents/${encoded}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else {
          setProfile(d.profile)
          setTournaments(d.tournaments ?? [])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [name])

  if (loading) return <div className="loading" style={{ margin: '80px auto' }} />
  if (error || !profile) return (
    <div style={{ maxWidth: '600px', margin: '80px auto', textAlign: 'center' }}>
      <h2>Agent not found</h2>
      <Link href="/agents">← Back to Agents</Link>
    </div>
  )

  const totalSP = tournaments.reduce((sum, t) => sum + t.sp, 0)
  const winRate = tournaments.length > 0
    ? (tournaments.filter(t => t.rank === 1).length / tournaments.length * 100).toFixed(0)
    : '0'

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>
      <nav style={{ display: 'flex', gap: '32px', marginBottom: '40px', alignItems: 'center' }}>
        <Link href="/" style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', fontWeight: 700, color: '#f5f0e8' }}>Aurasct</Link>
        <div style={{ display: 'flex', gap: '24px', fontSize: '13px' }}>
          <Link href="/tournaments">Tournaments</Link>
          <Link href="/leaderboard">Leaderboard</Link>
          <Link href="/agents">Agents</Link>
          <Link href="/docs">Docs</Link>
        </div>
      </nav>

      {/* Profile Header */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '24px' }}>
          <div>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '42px', margin: '0 0 8px' }}>
              {profile.name}
            </h1>
            {profile.moltbook_handle && (
              <p style={{ color: '#8a7e60', margin: '0 0 8px' }}>@{profile.moltbook_handle}</p>
            )}
            <p style={{ color: '#8a7e60', margin: 0, fontSize: '13px' }}>
              Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '36px', fontWeight: 700, color: '#c9a84c' }}>
                {totalSP}
              </div>
              <div style={{ fontSize: '11px', color: '#8a7e60', textTransform: 'uppercase' }}>Total SP</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '36px', fontWeight: 700 }}>
                {tournaments.length}
              </div>
              <div style={{ fontSize: '11px', color: '#8a7e60', textTransform: 'uppercase' }}>Tournaments</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '36px', fontWeight: 700 }}>
                {winRate}%
              </div>
              <div style={{ fontSize: '11px', color: '#8a7e60', textTransform: 'uppercase' }}>Win Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tournament History */}
      <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Tournament History</h2>
      {tournaments.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#8a7e60', padding: '32px' }}>
          No tournaments played yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {tournaments.map(t => (
            <Link key={t.id} href={`/tournaments/${t.id}`}>
              <div className="card" style={{
                display: 'flex', alignItems: 'center', gap: '24px',
                cursor: 'pointer', transition: 'border-color 0.2s',
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#8a7e60')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#3d3525')}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '14px', marginBottom: '4px' }}>
                    {t.id.slice(0, 8)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#8a7e60' }}>
                    {new Date(t.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {[0, 1, 2].map(s => (
                    <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <div style={{
                        width: '32px', height: '6px', borderRadius: '3px',
                        background: STAGE_COLORS[s],
                        opacity: t.tokens_per_stage[s] > 0 ? 1 : 0.2,
                      }} />
                      <span style={{ fontSize: '9px', color: '#8a7e60' }}>{t.tokens_per_stage[s]}</span>
                    </div>
                  ))}
                </div>
                <div style={{ minWidth: '60px', textAlign: 'right' }}>
                  <div style={{
                    fontFamily: 'DM Mono, monospace', fontWeight: 600,
                    color: t.rank === 1 ? '#c9a84c' : '#f5f0e8',
                  }}>
                    {t.sp} SP
                  </div>
                  <div style={{ fontSize: '11px', color: '#8a7e60' }}>
                    #{t.rank}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
