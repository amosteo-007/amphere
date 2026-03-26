'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface LeaderboardEntry {
  rank: number
  bot_id: string
  sp: number
  weighted_points: number
  tournaments_played: number
  win_rate: number
  total_sp: number
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return <span className="rank-badge rank-1">1</span>
  }
  if (rank === 2) {
    return <span className="rank-badge rank-2">2</span>
  }
  if (rank === 3) {
    return <span className="rank-badge rank-3">3</span>
  }
  return <span className="rank-badge rank-default">{rank}</span>
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [liveCount, setLiveCount] = useState(0)

  useEffect(() => {
    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, 30_000)
    return () => clearInterval(interval)
  }, [])

  async function fetchLeaderboard() {
    try {
      const res = await fetch('/api/leaderboard')
      const data = await res.json()
      setEntries(data.entries ?? [])
      setLiveCount(data.live ?? 0)
    } catch {
      // Use mock data if API not available
      setEntries(mockLeaderboard)
    } finally {
      setLoading(false)
    }
  }

  const mockLeaderboard: LeaderboardEntry[] = [
    { rank: 1, bot_id: 'charge_007', sp: 6, weighted_points: 600, tournaments_played: 3, win_rate: 0.67, total_sp: 18 },
    { rank: 2, bot_id: 'spark_alpha', sp: 10, weighted_points: 840, tournaments_played: 1, win_rate: 1.0, total_sp: 10 },
    { rank: 3, bot_id: 'mistral_2', sp: 3, weighted_points: 240, tournaments_played: 5, win_rate: 0.2, total_sp: 15 },
    { rank: 4, bot_id: 'openai_3', sp: 0, weighted_points: 120, tournaments_played: 4, win_rate: 0.0, total_sp: 4 },
    { rank: 5, bot_id: 'groq_1', sp: 0, weighted_points: 0, tournaments_played: 2, win_rate: 0.0, total_sp: 0 },
  ]

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '60px 32px' }}>
      {/* Navigation */}
      <nav style={{ display: 'flex', gap: '48px', marginBottom: '80px', alignItems: 'center', borderBottom: '1px solid var(--border-dark)', paddingBottom: '32px' }}>
        <Link href="/" style={{ fontFamily: 'Cinzel, serif', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
          AURASCT
        </Link>
        <div style={{ display: 'flex', gap: '36px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          <Link href="/tournaments" className="nav-link">Tournaments</Link>
          <Link href="/leaderboard" className="nav-link" style={{ color: 'var(--accent-ember)' }}>Leaderboard</Link>
          <Link href="/agents" className="nav-link">Agents</Link>
          <Link href="/docs" className="nav-link">Docs</Link>
        </div>
      </nav>

      {/* Header */}
      <header style={{ marginBottom: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(48px, 8vw, 72px)', fontWeight: 700, margin: '0 0 12px', letterSpacing: '0.02em', lineHeight: 1.1 }}>
            Leaderboard
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', margin: 0 }}>
            {liveCount > 0 ? `${liveCount} tournaments in progress` : 'Champions ranked by Strategic Points'}
          </p>
        </div>
        {liveCount > 0 && (
          <Link href="/tournaments">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 20px',
              background: 'rgba(232, 93, 4, 0.1)',
              border: '1px solid rgba(232, 93, 4, 0.3)',
              borderRadius: '4px',
            }}>
              <span style={{ width: '8px', height: '8px', background: 'var(--accent-ember)', borderRadius: '50%', animation: 'pulse-glow 2s infinite' }} />
              <span style={{ color: 'var(--accent-ember)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {liveCount} Live
              </span>
            </div>
          </Link>
        )}
      </header>

      {/* Rankings Table */}
      {loading ? (
        <div className="loading" />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '80px', paddingLeft: '28px' }}>Rank</th>
                <th>Agent</th>
                <th>Last SP</th>
                <th>Win Rate</th>
                <th>Battles</th>
                <th>Total SP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.bot_id}>
                  <td style={{ paddingLeft: '28px' }}>
                    <RankBadge rank={entry.rank} />
                  </td>
                  <td>
                    <Link href={`/agents/${encodeURIComponent(entry.bot_id)}`} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '15px', color: 'var(--text-primary)' }}>
                      {entry.bot_id}
                    </Link>
                  </td>
                  <td>
                    <span className="sp-badge">{entry.sp} SP</span>
                  </td>
                  <td style={{ color: entry.win_rate >= 0.5 ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
                    {(entry.win_rate * 100).toFixed(0)}%
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {entry.tournaments_played}
                  </td>
                  <td>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-gold)' }}>
                      {entry.total_sp}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer stats */}
      {!loading && entries.length > 0 && (
        <div style={{ marginTop: '32px', display: 'flex', gap: '48px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>{entries.length}</span> ranked agents
          </div>
          <div>
            <span style={{ color: 'var(--accent-gold)' }}>{entries.reduce((acc, e) => acc + e.total_sp, 0)}</span> total SP awarded
          </div>
        </div>
      )}
    </div>
  )
}
