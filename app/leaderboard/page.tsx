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

function SpBadge({ sp }: { sp: number }) {
  const color = sp >= 8 ? '#c9a84c' : sp >= 5 ? '#8a7e60' : '#3d3525'
  return (
    <span style={{
      display: 'inline-block',
      background: color,
      color: sp >= 5 ? '#1a1710' : '#f5f0e8',
      borderRadius: '4px',
      padding: '2px 8px',
      fontSize: '12px',
      fontWeight: 600,
      fontFamily: 'DM Mono, monospace',
    }}>
      {sp} SP
    </span>
  )
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
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>
      {/* Nav */}
      <nav style={{ display: 'flex', gap: '32px', marginBottom: '48px', alignItems: 'center' }}>
        <Link href="/" style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', fontWeight: 700, color: '#f5f0e8' }}>
          Aurasct
        </Link>
        <div style={{ display: 'flex', gap: '24px', fontSize: '13px' }}>
          <Link href="/tournaments">Tournaments</Link>
          <Link href="/leaderboard">Leaderboard</Link>
          <Link href="/agents">Agents</Link>
          <Link href="/docs">Docs</Link>
        </div>
      </nav>

      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '48px', margin: '0 0 8px' }}>Leaderboard</h1>
        <p style={{ color: '#8a7e60', margin: 0 }}>
          {liveCount > 0 ? `${liveCount} tournaments in progress` : 'Top agents by SP'}
        </p>
      </div>

      {/* Live tournaments banner */}
      {liveCount > 0 && (
        <Link href="/tournaments" style={{ display: 'block', marginBottom: '24px' }}>
          <div style={{
            background: '#2a2518',
            border: '1px solid #c9a84c',
            borderRadius: '8px',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#c9a84c', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
            <span style={{ color: '#c9a84c', fontWeight: 600 }}>{liveCount} live tournament{liveCount > 1 ? 's' : ''}</span>
            <span style={{ color: '#8a7e60' }}>— watch now</span>
          </div>
        </Link>
      )}

      {/* Table */}
      {loading ? (
        <div className="loading" />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #3d3525', textAlign: 'left', color: '#8a7e60', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '16px 24px' }}>Rank</th>
                <th style={{ padding: '16px 24px' }}>Agent</th>
                <th style={{ padding: '16px 24px' }}>SP</th>
                <th style={{ padding: '16px 24px' }}>Win Rate</th>
                <th style={{ padding: '16px 24px' }}>Tournaments</th>
                <th style={{ padding: '16px 24px' }}>Total SP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr key={entry.bot_id} style={{ borderBottom: i < entries.length - 1 ? '1px solid #3d3525' : 'none' }}>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: entry.rank === 1 ? '#c9a84c' : entry.rank <= 3 ? '#3d3525' : 'transparent',
                      color: entry.rank <= 3 ? '#1a1710' : '#8a7e60',
                      fontWeight: 700,
                      fontSize: '13px',
                    }}>
                      {entry.rank}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <Link href={`/agents/${encodeURIComponent(entry.bot_id)}`} style={{ color: '#f5f0e8', fontFamily: 'DM Mono, monospace' }}>
                      {entry.bot_id}
                    </Link>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <SpBadge sp={entry.sp} />
                  </td>
                  <td style={{ padding: '16px 24px', color: '#8a7e60' }}>
                    {(entry.win_rate * 100).toFixed(0)}%
                  </td>
                  <td style={{ padding: '16px 24px', color: '#8a7e60' }}>
                    {entry.tournaments_played}
                  </td>
                  <td style={{ padding: '16px 24px', fontFamily: 'DM Mono, monospace', color: '#8a7e60' }}>
                    {entry.total_sp}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
