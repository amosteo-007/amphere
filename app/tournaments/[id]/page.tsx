'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { io, Socket } from 'socket.io-client'

interface PeriodLog {
  stage: number
  period: number
  absolute_period: number
  clearing_price: number
  winner_bot_id: string | null
  tokens_available: number
  rescinded: boolean
  num_bidders: number
}

interface LeaderboardEntry {
  bot_id: string
  tokens_per_stage: [number, number, number]
  sp: number
  weighted_points: number
  periods_won: number
  spent: number
  remaining: number
}

interface TournamentState {
  id: string
  status: 'pending' | 'running' | 'completed'
  started_at: string | null
  completed_at: string | null
  leaderboard: LeaderboardEntry[]
}

const STAGE_NAMES = ['Stage 1 — Floor $10', 'Stage 2 — Floor $15', 'Stage 3 — Floor $28']
const STAGE_COLORS = ['#4a9eff', '#9b7aff', '#ff7a4a']

function SpBadge({ sp }: { sp: number }) {
  return (
    <span style={{
      background: sp >= 8 ? '#c9a84c' : sp >= 5 ? '#8a7e60' : '#3d3525',
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

function BotRow({ entry, isWinner }: { entry: LeaderboardEntry; isWinner: boolean }) {
  const [s1, s2, s3] = entry.tokens_per_stage
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 80px 80px 80px 100px',
      gap: '12px',
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid #2a2518',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: entry.bot_id.startsWith('human') ? '#c9a84c' : '#5a6978',
          display: 'inline-block',
        }} />
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '14px' }}>
          {entry.bot_id}
        </span>
      </div>
      <SpBadge sp={entry.sp} />
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <TokenBar value={s1} color={STAGE_COLORS[0]} max={240} />
        <TokenBar value={s2} color={STAGE_COLORS[1]} max={240} />
        <TokenBar value={s3} color={STAGE_COLORS[2]} max={240} />
      </div>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', color: '#8a7e60', textAlign: 'right' }}>
        {entry.weighted_points.toFixed(0)} WP
      </div>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', color: '#8a7e60', textAlign: 'right' }}>
        {entry.periods_won} wins
      </div>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', color: '#8a7e60', textAlign: 'right' }}>
        ${entry.remaining.toFixed(0)}
      </div>
    </div>
  )
}

function TokenBar({ value, color, max }: { value: number; color: string; max: number }) {
  const width = Math.min(100, (value / max) * 100)
  return (
    <div style={{ width: '18px', height: '8px', background: '#2a2518', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ width: `${width}%`, height: '100%', background: color }} />
    </div>
  )
}

export default function TournamentLivePage() {
  const { id } = useParams()
  const [state, setState] = useState<TournamentState | null>(null)
  const [periodLogs, setPeriodLogs] = useState<PeriodLog[]>([])
  const [loading, setLoading] = useState(true)
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    if (!id) return

    // Fetch initial state
    fetchTournament()

    // Connect Socket.IO for live updates
    const s = io({ path: '/api/socketio' })
    setSocket(s)

    s.on('connect', () => {
      s.emit('join_tournament', id)
    })

    s.on('period_result', (result: PeriodLog) => {
      setPeriodLogs(prev => [result, ...prev].slice(0, 15))
      // Refetch full state to update leaderboard after each period
      fetchTournament()
    })

    s.on('tournament_complete', () => {
      fetchTournament()
    })

    // Poll as fallback
    const poll = setInterval(fetchTournament, 5_000)

    return () => {
      s.emit('leave_tournament', id)
      s.disconnect()
      clearInterval(poll)
    }
  }, [id])

  async function fetchTournament() {
    try {
      // Use the tournament ID directly for the API
      const res = await fetch(`/api/tournaments/${id}`)
      if (res.ok) {
        const data = await res.json()
        setState(data.tournament)
        setPeriodLogs(data.period_logs ?? [])
      }
    } catch {
      // graceful fail
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>
        <div className="loading" />
      </div>
    )
  }

  if (!state) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>
        <h1>Tournament not found</h1>
        <Link href="/tournaments">← Back to Tournaments</Link>
      </div>
    )
  }

  const currentPeriod = periodLogs[0]
  const currentStageName = currentPeriod ? STAGE_NAMES[currentPeriod.stage] : 'Waiting...'

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>
      {/* Nav */}
      <nav style={{ display: 'flex', gap: '32px', marginBottom: '32px', alignItems: 'center' }}>
        <Link href="/" style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', fontWeight: 700, color: '#f5f0e8' }}>Aurasct</Link>
        <div style={{ display: 'flex', gap: '24px', fontSize: '13px' }}>
          <Link href="/tournaments">Tournaments</Link>
          <Link href="/leaderboard">Leaderboard</Link>
          <Link href="/agents">Agents</Link>
          <Link href="/docs">Docs</Link>
        </div>
      </nav>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          {state.status === 'running' && (
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#c9a84c', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
          )}
          <span style={{
            background: state.status === 'completed' ? '#2a3a2a' : state.status === 'running' ? '#2a2a1a' : '#1a1a2a',
            color: state.status === 'completed' ? '#7acc7a' : state.status === 'running' ? '#c9a84c' : '#8a7e60',
            borderRadius: '4px', padding: '2px 8px', fontSize: '12px', fontWeight: 600,
          }}>
            {state.status.toUpperCase()}
          </span>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', color: '#8a7e60' }}>
            {currentStageName}
          </span>
        </div>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '36px', margin: '8px 0 0' }}>
          Tournament {state.id.slice(0, 8)}
        </h1>
      </div>

      {/* Live Period Feed */}
      {state.status === 'running' && currentPeriod && (
        <div className="card" style={{ marginBottom: '24px', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#8a7e60', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Latest Result
              </div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '20px' }}>
                {currentPeriod.winner_bot_id ?? 'No winner'}
                <span style={{ color: '#8a7e60', fontSize: '14px', marginLeft: '12px' }}>
                  cleared at ${currentPeriod.clearing_price.toFixed(2)}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#8a7e60', marginTop: '4px' }}>
                {currentPeriod.num_bidders} bidders · {currentPeriod.tokens_available} tokens
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', color: STAGE_COLORS[currentPeriod.stage] }}>
                S{currentPeriod.stage + 1}P{currentPeriod.period + 1}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>Leaderboard</h2>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '11px', color: '#8a7e60' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: STAGE_COLORS[0], display: 'inline-block' }} /> S1
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: STAGE_COLORS[1], display: 'inline-block' }} /> S2
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: STAGE_COLORS[2], display: 'inline-block' }} /> S3
            </span>
          </div>
        </div>

        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 80px 80px 80px 100px',
          gap: '12px',
          fontSize: '11px',
          color: '#8a7e60',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          paddingBottom: '8px',
          borderBottom: '1px solid #3d3525',
        }}>
          <div>Agent</div>
          <div>SP</div>
          <div style={{ paddingLeft: '0' }}>Tokens</div>
          <div style={{ textAlign: 'right' }}>WP</div>
          <div style={{ textAlign: 'right' }}>Wins</div>
          <div style={{ textAlign: 'right' }}>Budget</div>
        </div>

        {state.leaderboard
          .sort((a, b) => b.sp - a.sp || b.weighted_points - a.weighted_points)
          .map((entry, i) => (
            <BotRow key={entry.bot_id} entry={entry} isWinner={i === 0} />
          ))}
      </div>

      {/* Period History */}
      {periodLogs.length > 0 && (
        <div className="card">
          <h2 style={{ margin: '0 0 16px', fontSize: '18px' }}>Period History</h2>
          <div style={{ display: 'grid', gap: '8px' }}>
            {[...periodLogs].reverse().map((log, i) => (
              <div key={`${log.stage}-${log.period}`} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '10px 14px',
                background: '#1a1710',
                borderRadius: '6px',
                fontSize: '13px',
                opacity: i === 0 && state.status === 'running' ? 1 : 0.7,
                border: i === 0 && state.status === 'running' ? '1px solid #c9a84c' : '1px solid transparent',
              }}>
                <span style={{
                  fontFamily: 'Playfair Display, serif',
                  fontSize: '14px',
                  color: STAGE_COLORS[log.stage],
                  minWidth: '40px',
                }}>
                  S{log.stage + 1}P{log.period + 1}
                </span>
                <span style={{ color: log.winner_bot_id ? '#f5f0e8' : '#8a7e60', flex: 1 }}>
                  {log.winner_bot_id ?? 'No winner'}
                </span>
                <span style={{ fontFamily: 'DM Mono, monospace', color: '#8a7e60' }}>
                  @ ${log.clearing_price.toFixed(2)}
                </span>
                <span style={{ color: '#8a7e60' }}>
                  {log.num_bidders} bidders
                </span>
              </div>
            ))}
          </div>
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
