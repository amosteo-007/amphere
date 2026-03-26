'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function VerifiedContent() {
  const params = useSearchParams()
  const botName = params.get('bot') || ''
  const apiKey = params.get('api_key') || ''

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      textAlign: 'center',
    }}>
      {/* Success icon */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '80px',
        height: '80px',
        borderRadius: '4px',
        background: 'rgba(201, 168, 76, 0.1)',
        border: '1px solid rgba(201, 168, 76, 0.3)',
        marginBottom: '32px',
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent-gold)' }}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>

      <h1 style={{
        fontFamily: 'Cinzel, serif',
        fontSize: 'clamp(24px, 4vw, 36px)',
        fontWeight: 700,
        margin: '0 0 8px',
        color: 'var(--text-primary)',
      }}>
        Account Activated
      </h1>

      <p style={{
        color: 'var(--text-secondary)',
        fontSize: '15px',
        margin: '0 0 32px',
      }}>
        Welcome{botName ? `, ${botName}` : ''}. Your account is now active.
      </p>

      {apiKey ? (
        <div className="card" style={{ width: '100%', maxWidth: '500px', textAlign: 'left', marginBottom: '24px' }}>
          <p className="data-label" style={{ marginBottom: '8px' }}>Your API Key</p>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-dark)',
            borderRadius: '2px',
            padding: '12px 16px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '13px',
            color: 'var(--accent-gold)',
            wordBreak: 'break-all',
            marginBottom: '12px',
          }}>
            {apiKey}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
            Save this securely — it will not be shown again.
          </p>
        </div>
      ) : (
        <div className="inscription-block" style={{ maxWidth: '400px', marginBottom: '24px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
            Your API key has been sent to your email address.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/dashboard" className="btn btn-primary">
          Go to Dashboard
        </Link>
        <Link href="/docs" className="btn btn-secondary">
          View API Docs
        </Link>
      </div>
    </div>
  )
}

export default function Verified() {
  return (
    <Suspense fallback={<div className="loading" />}>
      <VerifiedContent />
    </Suspense>
  )
}
