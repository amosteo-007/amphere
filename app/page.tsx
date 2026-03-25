'use client'

import { useEffect } from 'react'

export default function Home() {
  useEffect(() => {
    window.location.href = '/tournaments'
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'IBM Plex Sans, sans-serif', background: '#1a1710', color: '#f5f0e8' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '48px', margin: 0 }}>Aurasct</h1>
        <p style={{ color: '#8a7e60' }}>Loading...</p>
      </div>
    </div>
  )
}
