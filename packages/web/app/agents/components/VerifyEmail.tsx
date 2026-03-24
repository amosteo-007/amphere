'use client';

import { useState } from 'react';
import { STONE, stoneCard, stoneInput, goldButton } from '../theme';

interface Props {
  onBack: () => void;
}

export default function VerifyEmail({ onBack }: Props) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('loading');
    setErrorMsg('');

    const res = await fetch('/api/auth/send-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });

    const data = await res.json();

    if (res.ok && data.ok) {
      setStatus('sent');
    } else {
      setErrorMsg(data.error ?? 'Failed to send verification email');
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div style={{ ...stoneCard, padding: '40px 32px', textAlign: 'center' }}>
        <div
          style={{
            width: 64,
            height: 64,
            margin: '0 auto 20px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${STONE.goldDark}, ${STONE.gold})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 32px ${STONE.goldGlow}`,
          }}
        >
          <span style={{ fontSize: 28 }}>&#9993;</span>
        </div>

        <p
          style={{
            fontFamily: '"Playfair Display", serif',
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            color: STONE.gold,
            textShadow: `0 0 20px ${STONE.goldGlow}`,
            fontSize: 14,
            marginBottom: 12,
          }}
        >
          Message Dispatched
        </p>
        <p
          style={{
            fontFamily: '"IBM Plex Sans", sans-serif',
            fontWeight: 300,
            color: STONE.textMuted,
            fontSize: 14,
            lineHeight: 1.6,
            maxWidth: 360,
            margin: '0 auto 24px',
          }}
        >
          A verification link has been sent to <strong style={{ color: STONE.text }}>{email}</strong>.
          Click the link to return to the Arena. The link expires in 15 minutes.
        </p>

        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: `1px solid ${STONE.cardBorder}`,
            color: STONE.text,
            borderRadius: 8,
            padding: '8px 24px',
            fontFamily: '"IBM Plex Sans", sans-serif',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ ...stoneCard, padding: 32 }}>
      <p
        style={{
          fontFamily: '"IBM Plex Sans", sans-serif',
          fontWeight: 300,
          color: STONE.textMuted,
          fontSize: 14,
          textAlign: 'center',
          marginBottom: 28,
          lineHeight: 1.6,
        }}
      >
        Enter the email you used to register your champion.
        We will send a verification link to prove your identity.
      </p>

      <div style={{ marginBottom: 24 }}>
        <label
          style={{
            display: 'block',
            fontFamily: '"Playfair Display", serif',
            fontSize: 11,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: STONE.gold,
            marginBottom: 6,
          }}
        >
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="gladiator@example.com"
          style={{ ...stoneInput, width: '100%', padding: '10px 14px', fontSize: 14 }}
        />
      </div>

      {status === 'error' && (
        <p style={{ color: STONE.danger, fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
          {errorMsg}
        </p>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'transparent',
            border: `1px solid ${STONE.cardBorder}`,
            color: STONE.text,
            borderRadius: 8,
            padding: '12px 20px',
            fontFamily: '"IBM Plex Sans", sans-serif',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Back
        </button>
        <button
          type="submit"
          disabled={status === 'loading' || !email.trim()}
          style={{
            ...goldButton,
            flex: 1,
            padding: '12px 0',
            fontSize: 14,
            opacity: status === 'loading' ? 0.6 : 1,
          }}
        >
          {status === 'loading' ? 'Sending...' : 'Send Verification'}
        </button>
      </div>
    </form>
  );
}
