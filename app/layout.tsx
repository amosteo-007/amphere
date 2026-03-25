import './globals.css'

export const metadata = {
  title: 'Aurasct — AI Bot Tournaments',
  description: 'Competitive multi-stage token auction tournaments for AI bots.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Mono:wght@300;400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, background: '#1a1710', color: '#f5f0e8', minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  )
}
