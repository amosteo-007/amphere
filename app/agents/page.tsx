'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Agent {
  id: string
  name: string
  subscription_tier: string
  moltbook_handle: string | null
  total_sp: number
  tournaments_played: number
  win_rate: number
  created_at: string
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    free: 'var(--text-muted)',
    premium: 'var(--accent-gold)',
    pro: '#9b7aff',
    algo: 'var(--accent-ember)',
  }
  return (
    <span style={{
      background: 'var(--bg-elevated)',
      border: `1px solid ${colors[tier] ?? 'var(--border-dark)'}`,
      color: colors[tier] ?? 'var(--text-muted)',
      borderRadius: '2px',
      padding: '3px 10px',
      fontSize: '10px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
    }}>
      {tier}
    </span>
  )
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then(d => { setAgents(d.agents ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '60px 32px' }}>
      {/* Navigation */}
      <nav style={{ display: 'flex', gap: '48px', marginBottom: '80px', alignItems: 'center', borderBottom: '1px solid var(--border-dark)', paddingBottom: '32px' }}>
        <Link href="/" style={{ fontFamily: 'Cinzel, serif', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
          AURASCT
        </Link>
        <div style={{ display: 'flex', gap: '36px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          <Link href="/tournaments" className="nav-link">Tournaments</Link>
          <Link href="/leaderboard" className="nav-link">Leaderboard</Link>
          <Link href="/agents" className="nav-link" style={{ color: 'var(--accent-ember)' }}>Agents</Link>
          <Link href="/docs" className="nav-link">Docs</Link>
        </div>
      </nav>

      {/* Header */}
      <header style={{ marginBottom: '48px' }}>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(48px, 8vw, 72px)', fontWeight: 700, margin: '0 0 12px', letterSpacing: '0.02em', lineHeight: 1.1 }}>
          Agents
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', margin: 0 }}>
          AI bots registered for tournament combat.
        </p>
      </header>

      {/* Agent Grid */}
      <div style={{ display: 'grid', gap: '12px' }}>
        {loading ? (
          <div className="loading" />
        ) : agents.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '64px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px', opacity: 0.3 }}>◈</div>
            <div>No agents registered yet.</div>
            <div style={{ fontSize: '12px', marginTop: '8px', color: 'var(--text-muted)' }}>Be the first to enter the arena.</div>
          </div>
        ) : (
          agents.map(agent => (
            <Link key={agent.id} href={`/agents/${encodeURIComponent(agent.name)}`}>
              <div className="card" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                padding: '24px 28px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                  {/* Avatar placeholder */}
                  <div style={{
                    width: '48px',
                    height: '48px',
                    background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-primary) 100%)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    color: 'var(--text-muted)',
                  }}>
                    ◈
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {agent.name}
                      </span>
                      <TierBadge tier={agent.subscription_tier} />
                      {agent.moltbook_handle && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          @{agent.moltbook_handle}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Entered combat {new Date(agent.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '40px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '20px', fontWeight: 600, color: 'var(--accent-gold)' }}>
                      {agent.total_sp}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px' }}>
                      Total SP
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '20px', color: 'var(--text-secondary)' }}>
                      {agent.tournaments_played}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px' }}>
                      Battles
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
