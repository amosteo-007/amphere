'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const LLM_PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
      { id: 'qwen-2.5-32b', name: 'Qwen 2.5 32B' },
    ],
  },
]

const OPPONENT_TYPES = [
  { id: 'llm', label: 'LLM Agent', description: 'AI opponent powered by a language model' },
  { id: 'algo', label: 'Algo Bot', description: 'Simple rule-based opponent' },
]

interface OpponentSlot {
  type: 'llm' | 'algo'
  provider?: string
  model?: string
}

export default function NewTournamentPage() {
  const router = useRouter()
  const [champions, setChampions] = useState<{ id: string; name: string; api_key: string }[]>([])
  const [selectedChampion, setSelectedChampion] = useState<string | null>(null)
  const [opponents, setOpponents] = useState<OpponentSlot[]>([
    { type: 'algo' },
    { type: 'algo' },
    { type: 'algo' },
    { type: 'algo' },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load champions from localStorage (client-only)
  useEffect(() => {
    const bot = localStorage.getItem('bot')
    if (bot) {
      const botData = JSON.parse(bot)
      setSelectedChampion(botData.id)
    }
  }, [])

  function updateOpponent(index: number, patch: Partial<OpponentSlot>) {
    setOpponents(prev => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const bot = JSON.parse(localStorage.getItem('bot') || '{}')
      const apiKey = bot.api_key || selectedChampion

      if (!apiKey) {
        setError('Please log in first')
        return
      }

      const opponentConfigs = opponents.map(opp => ({
        type: opp.type,
        provider: opp.provider,
        model: opp.model,
      }))

      const res = await fetch('/api/play', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ opponents: opponentConfigs }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create tournament')
        return
      }

      router.push(`/tournaments/${data.tournament_id}`)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
      {/* Header */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '48px' }}>
        <Link href="/tournaments" className="nav-link" style={{ color: 'var(--text-muted)' }}>
          ← Back
        </Link>
        <span style={{ color: 'var(--border-dark)' }}>|</span>
        <span style={{ fontFamily: 'Cinzel, serif', fontSize: '18px', color: 'var(--accent-gold)', letterSpacing: '0.05em' }}>
          AURASCT
        </span>
      </nav>

      <h1 style={{
        fontFamily: 'Cinzel, serif',
        fontSize: 'clamp(28px, 4vw, 40px)',
        margin: '0 0 8px',
        color: 'var(--text-primary)',
      }}>
        New Tournament
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 40px' }}>
        Configure your opponents and begin a new tournament
      </p>

      <form onSubmit={handleSubmit}>
        {/* Your Champion */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <p className="data-label" style={{ marginBottom: '16px' }}>Your Champion</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 16px' }}>
            You will play as the <strong style={{ color: 'var(--accent-gold)' }}>human_1</strong> slot.
          </p>
          <div style={{
            padding: '12px 16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--accent-gold)',
            borderRadius: '2px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              background: 'var(--accent-gold)',
              borderRadius: '50%',
            }} />
            <span style={{ color: 'var(--text-primary)', fontFamily: 'Cinzel, serif', fontSize: '14px' }}>
              human_1
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: 'auto' }}>
              Your account
            </span>
          </div>
        </div>

        {/* Opponents */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <p className="data-label" style={{ marginBottom: '20px' }}>Opponents</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {opponents.map((opp, i) => (
              <div key={i} style={{
                padding: '16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-dark)',
                borderRadius: '4px',
              }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{
                    fontFamily: 'Cinzel, serif',
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                    width: '80px',
                  }}>
                    Slot {i + 2}
                  </span>

                  {/* Opponent type selector */}
                  <select
                    value={opp.type}
                    onChange={e => updateOpponent(i, { type: e.target.value as 'llm' | 'algo', provider: undefined, model: undefined })}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-dark)',
                      borderRadius: '2px',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    {OPPONENT_TYPES.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>

                  {opp.type === 'llm' && (
                    <>
                      {/* Provider selector */}
                      <select
                        value={opp.provider || ''}
                        onChange={e => updateOpponent(i, { provider: e.target.value, model: undefined })}
                        required
                        style={{
                          padding: '8px 12px',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-dark)',
                          borderRadius: '2px',
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="">Provider</option>
                        {LLM_PROVIDERS.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>

                      {/* Model selector */}
                      <select
                        value={opp.model || ''}
                        onChange={e => updateOpponent(i, { model: e.target.value })}
                        required
                        disabled={!opp.provider}
                        style={{
                          padding: '8px 12px',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-dark)',
                          borderRadius: '2px',
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                          cursor: 'pointer',
                          opacity: opp.provider ? 1 : 0.5,
                        }}
                      >
                        <option value="">Model</option>
                        {opp.provider && LLM_PROVIDERS
                          .find(p => p.id === opp.provider)
                          ?.models.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                      </select>
                    </>
                  )}

                  {opp.type === 'algo' && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                      Random bidding algo
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(220, 50, 50, 0.1)',
            border: '1px solid rgba(220, 50, 50, 0.3)',
            borderRadius: '2px',
            color: '#dc3232',
            fontSize: '13px',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ flex: 1, padding: '16px' }}
          >
            {loading ? 'Starting Tournament…' : 'Begin Tournament'}
          </button>
          <Link href="/tournaments" className="btn btn-secondary" style={{ padding: '16px 24px' }}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
