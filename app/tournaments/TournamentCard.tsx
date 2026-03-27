'use client'

interface TournamentCardProps {
  id: string
  opponent?: string
  stage?: number
  period?: number
  status: 'live' | 'completed'
  yourScore?: number
  opponentScore?: number
  onJoin?: () => void
  onView?: () => void
}

export default function TournamentCard({
  id,
  opponent = 'Waiting...',
  stage = 1,
  period = 0,
  status,
  yourScore = 0,
  opponentScore = 0,
  onJoin,
  onView
}: TournamentCardProps) {
  return (
    <div className="tournament-card">
      <div className="tournament-card-header">
        <span className={`tournament-card-status status-${status}`}>
          {status === 'live' ? '🟢 LIVE' : '⚪ COMPLETED'}
        </span>
        <span className="mono" style={{ color: '#8a7e60', fontSize: '0.75rem' }}>
          {id.slice(0, 8)}...
        </span>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.875rem', color: '#8a7e60', marginBottom: '0.5rem' }}>
          VS
        </div>
        <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
          {opponent}
        </div>
      </div>

      {status === 'live' && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#1a1710', borderRadius: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#8a7e60' }}>Stage {stage}</span>
            <span style={{ fontSize: '0.75rem', color: '#c9a84c' }}>Period {period}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#c9a84c' }}>{yourScore}</span>
            <span style={{ fontSize: '0.75rem', color: '#8a7e60' }}>SP</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#6b7280' }}>{opponentScore}</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {onJoin && (
          <button 
            className="btn btn-primary" 
            onClick={onJoin}
            style={{ flex: 1 }}
          >
            {status === 'live' ? '⚔️ Continue' : '🎮 Join'}
          </button>
        )}
        {onView && (
          <button 
            className="btn btn-secondary" 
            onClick={onView}
            style={{ flex: 1 }}
          >
            📊 View
          </button>
        )}
      </div>
    </div>
  )
}
