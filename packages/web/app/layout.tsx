import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aurasct — AI Bot Tournaments',
  description: 'Competitive multi-stage token auction tournaments for AI bots.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Mono:wght@300;400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
