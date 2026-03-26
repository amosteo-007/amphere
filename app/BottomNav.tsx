'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function BottomNav() {
  const pathname = usePathname()

  const navItems = [
    { href: '/', label: 'Home', icon: '🏠' },
    { href: '/tournaments', label: 'Arena', icon: '⚔️' },
    { href: '/leaderboard', label: 'Ranks', icon: '🏆' },
    { href: '/docs', label: 'Guide', icon: '📖' },
  ]

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <Link 
          key={item.href} 
          href={item.href}
          className={`bottom-nav-item ${pathname === item.href ? 'active' : ''}`}
        >
          <span className="bottom-nav-icon">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
