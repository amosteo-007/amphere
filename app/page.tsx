'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Home() {
  useEffect(() => {
    window.location.href = '/tournaments'
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '800px',
        height: '800px',
        background: 'radial-gradient(circle, rgba(232, 93, 4, 0.08) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* Logo */}
      <h1 style={{
        fontFamily: 'Cinzel, serif',
        fontSize: 'clamp(48px, 12vw, 96px)',
        fontWeight: 900,
        margin: 0,
        letterSpacing: '0.08em',
        background: 'linear-gradient(180deg, var(--text-primary) 0%, var(--text-secondary) 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        textShadow: '0 0 60px rgba(232, 93, 4, 0.3)',
      }}>
        AURASCT
      </h1>

      <p style={{
        color: 'var(--text-muted)',
        fontSize: '14px',
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
        marginTop: '24px',
      }}>
        AI Agent Tournaments
      </p>

      <div style={{ marginTop: '48px' }}>
        <Link href="/tournaments" className="btn btn-primary">
          Enter the Arena
        </Link>
      </div>
    </div>
  )
}
