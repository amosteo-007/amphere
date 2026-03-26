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
  all_bids: { botId: string; bid: number | null }[]
}

interface LeaderboardEntry {
  bot_id: string
  tokens_per_stage: [number, number, number]
  sp: number
  weighted_points: number
  periods_won: number
  spent: number
  remaining: number
  rescinds: number
}

interface TournamentState {
  id: string
  status: 'pending' | 'running' | 'completed'
  started_at: string | null
  completed_at: string | null
  current_stage: number
  current_period: number
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
  const cumulative = s1 + s2 + s3
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '2fr 60px 1fr 70px 60px 80px',
      gap: '8px',
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid #2a2518',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: isWinner ? '#c9a84c' : '#5a6978',
          display: 'inline-block',
        }} />
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '14px' }}>
          {entry.bot_id}
        </span>
      </div>
      <SpBadge sp={entry.sp} />
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <TokenChip value={s1} color={STAGE_COLORS[0]} label="S1" />
        <TokenChip value={s2} color={STAGE_COLORS[1]} label="S2" />
        <TokenChip value={s3} color={STAGE_COLORS[2]} label="S3" />
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: '#f5f0e8', marginLeft: '4px' }}>
          = {cumulative}
        </span>
      </div>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: '#8a7e60', textAlign: 'right' }}>
        {entry.weighted_points.toFixed(0)} WP
      </div>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: '#8a7e60', textAlign: 'right' }}>
        {entry.periods_won}W
      </div>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: '#8a7e60', textAlign: 'right' }}>
        ${entry.remaining.toFixed(0)}
      </div>
    </div>
  )
}

function TokenChip({ value, color, label }: { value: number; color: string; label: string }) {
  if (value === 0) {
    return (
      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#3d3525', minWidth: '32px', textAlign: 'center' }}>
        —
      </span>
    )
  }
  return (
    <span style={{
      fontFamily: 'DM Mono, monospace',
      fontSize: '11px',
      color,
      background: `${color}15`,
      borderRadius: '3px',
      padding: '1px 4px',
      minWidth: '32px',
      textAlign: 'center',
      display: 'inline-block',
    }}>
      {value}
    </span>
  )
}


// Assign a consistent color to each bot across the chart
const BOT_COLORS = ['#c9a84c', '#4a9eff', '#9b7aff', '#ff7a4a', '#4aff7a', '#ff4a9b', '#4affff', '#ffff4a']

function BidChart({ periodLogs, leaderboard }: { periodLogs: PeriodLog[]; leaderboard: LeaderboardEntry[] }) {
  // Sort chronologically
  const sorted = [...periodLogs].sort((a, b) => a.absolute_period - b.absolute_period)
  if (sorted.length === 0) return null

  // Collect all bot IDs that ever bid
  const botIds = new Set<string>()
  for (const log of sorted) {
    for (const b of (log.all_bids ?? [])) {
      botIds.add(b.botId)
    }
  }
  const bots = Array.from(botIds)

  // Assign colors: match leaderboard order for consistency
  const colorMap = new Map<string, string>()
  const sortedLeaderboard = [...leaderboard].sort((a, b) => b.sp - a.sp || b.weighted_points - a.weighted_points)
  sortedLeaderboard.forEach((entry, i) => {
    // Find the botId that maps to this bot_id slot name
    for (const bot of bots) {
      // Match by checking if any period log's all_bids has this botId winning
      // or just use order
      if (!colorMap.has(bot)) {
        colorMap.set(bot, BOT_COLORS[i % BOT_COLORS.length])
      }
    }
  })
  // Fallback: assign remaining
  bots.forEach((bot, i) => {
    if (!colorMap.has(bot)) colorMap.set(bot, BOT_COLORS[i % BOT_COLORS.length])
  })

  // Chart dimensions
  const W = 800, H = 220, PAD_L = 50, PAD_R = 20, PAD_T = 20, PAD_B = 40
  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_T - PAD_B

  // Find max bid for y-axis scale
  let maxBid = 0
  for (const log of sorted) {
    for (const b of (log.all_bids ?? [])) {
      if (b.bid !== null && b.bid > maxBid) maxBid = b.bid
    }
    if (log.clearing_price > maxBid) maxBid = log.clearing_price
  }
  maxBid = Math.ceil(maxBid * 1.15) // 15% headroom
  if (maxBid === 0) maxBid = 50

  const xScale = (ap: number) => PAD_L + (ap / 14) * chartW
  const yScale = (bid: number) => PAD_T + chartH - (bid / maxBid) * chartH

  // Stage background bands
  const stageBands = [
    { start: 0, end: 4, color: `${STAGE_COLORS[0]}08` },
    { start: 5, end: 9, color: `${STAGE_COLORS[1]}08` },
    { start: 10, end: 14, color: `${STAGE_COLORS[2]}08` },
  ]

  // Build per-bot line data: array of {ap, bid} per bot
  const botLines = new Map<string, { ap: number; bid: number }[]>()
  for (const bot of bots) botLines.set(bot, [])
  for (const log of sorted) {
    for (const b of (log.all_bids ?? [])) {
      if (b.bid !== null) {
        botLines.get(b.botId)?.push({ ap: log.absolute_period, bid: b.bid })
      }
    }
  }

  // Clearing price line
  const clearingPoints = sorted.map(log => ({ ap: log.absolute_period, price: log.clearing_price }))

  // Y-axis ticks
  const yTicks: number[] = []
  const tickStep = maxBid <= 30 ? 5 : maxBid <= 60 ? 10 : maxBid <= 120 ? 20 : 50
  for (let v = 0; v <= maxBid; v += tickStep) yTicks.push(v)

  // Build a botId → display name map from all_bids botIds to leaderboard bot_ids
  // Since we can't directly map, show abbreviated botId
  const displayName = (botId: string) => {
    // Try to find matching leaderboard entry by checking period logs
    const entry = leaderboard.find(e => e.bot_id === botId)
    if (entry) return entry.bot_id
    return botId.length > 10 ? botId.slice(0, 8) + '..' : botId
  }

  return (
    <div className="card" style={{ marginBottom: '24px', padding: '20px 24px' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: '18px' }}>Bid History</h2>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {/* Stage bands */}
        {stageBands.map((band, i) => (
          <rect
            key={i}
            x={xScale(band.start) - chartW / 30}
            y={PAD_T}
            width={(band.end - band.start + 1) / 15 * chartW}
            height={chartH}
            fill={band.color}
          />
        ))}

        {/* Grid lines */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={PAD_L} y1={yScale(v)} x2={W - PAD_R} y2={yScale(v)} stroke="#2a2518" strokeWidth={1} />
            <text x={PAD_L - 8} y={yScale(v) + 4} textAnchor="end" fill="#8a7e60" fontSize="10" fontFamily="DM Mono, monospace">
              ${v}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {Array.from({ length: 15 }, (_, i) => {
          const stage = Math.floor(i / 5)
          const period = i % 5
          return (
            <text
              key={i}
              x={xScale(i)}
              y={H - 8}
              textAnchor="middle"
              fill={STAGE_COLORS[stage]}
              fontSize="9"
              fontFamily="DM Mono, monospace"
            >
              {period + 1}
            </text>
          )
        })}

        {/* Stage labels on x-axis */}
        {[0, 1, 2].map(s => (
          <text
            key={s}
            x={xScale(s * 5 + 2)}
            y={H}
            textAnchor="middle"
            fill={STAGE_COLORS[s]}
            fontSize="10"
            fontFamily="DM Mono, monospace"
            opacity={0.6}
          >
            S{s + 1}
          </text>
        ))}

        {/* Clearing price line */}
        {clearingPoints.length > 1 && (
          <polyline
            points={clearingPoints.map(p => `${xScale(p.ap)},${yScale(p.price)}`).join(' ')}
            fill="none"
            stroke="#8a7e60"
            strokeWidth={1.5}
            strokeDasharray="4,4"
            opacity={0.6}
          />
        )}

        {/* Bot bid lines + dots */}
        {bots.map(botId => {
          const points = botLines.get(botId) ?? []
          const color = colorMap.get(botId) ?? '#888'
          return (
            <g key={botId}>
              {points.length > 1 && (
                <polyline
                  points={points.map(p => `${xScale(p.ap)},${yScale(p.bid)}`).join(' ')}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  opacity={0.8}
                />
              )}
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={xScale(p.ap)}
                  cy={yScale(p.bid)}
                  r={3.5}
                  fill={color}
                  stroke="#0d0d0f"
                  strokeWidth={1}
                />
              ))}
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '12px', fontSize: '11px' }}>
        {bots.map(botId => (
          <span key={botId} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: colorMap.get(botId), display: 'inline-block' }} />
            <span style={{ color: '#8a7e60', fontFamily: 'DM Mono, monospace' }}>{displayName(botId)}</span>
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '16px', height: '0', borderTop: '2px dashed #8a7e60', display: 'inline-block' }} />
          <span style={{ color: '#8a7e60', fontFamily: 'DM Mono, monospace' }}>Clearing</span>
        </span>
      </div>
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
  const currentStageName = state.current_stage !== undefined
    ? `${STAGE_NAMES[state.current_stage]} · Period ${(state.current_period ?? 0) + 1}`
    : currentPeriod ? STAGE_NAMES[currentPeriod.stage] : 'Waiting...'

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
          gridTemplateColumns: '2fr 60px 1fr 70px 60px 80px',
          gap: '8px',
          fontSize: '11px',
          color: '#8a7e60',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          paddingBottom: '8px',
          borderBottom: '1px solid #3d3525',
        }}>
          <div>Agent</div>
          <div>SP</div>
          <div>Tokens (S1 / S2 / S3)</div>
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

      {/* Bid Chart — visible during and after tournament */}
      {periodLogs.length > 0 && (
        <BidChart periodLogs={periodLogs} leaderboard={state.leaderboard} />
      )}

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
