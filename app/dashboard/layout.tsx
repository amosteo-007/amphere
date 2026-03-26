'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('session_token')
    if (!token) {
      router.push('/onboarding/login')
    }
  }, [router])

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Simple header */}
      <header style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-dark)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <a href="/dashboard" style={{ textDecoration: 'none' }}>
          <span style={{
            fontFamily: 'Cinzel, serif',
            fontSize: '16px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--accent-gold)',
          }}>
            AURASCT
          </span>
        </a>
        <nav style={{ display: 'flex', gap: '24px' }}>
          <a href="/dashboard" className="nav-link">Dashboard</a>
          <a href="/tournaments" className="nav-link">Tournaments</a>
          <a href="/leaderboard" className="nav-link">Leaderboard</a>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  )
}
