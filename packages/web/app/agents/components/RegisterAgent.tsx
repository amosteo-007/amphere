'use client';

import { useState } from 'react';
import { STONE, stoneCard, stoneInput, goldButton } from '../theme';

interface Props {
  onRegistered: () => void;
}

export default function RegisterAgent({ onRegistered }: Props) {
  const [form, setForm] = useState({
    code: '',
    name: '',
    email: '',
    telegram_handle: '',
    moltbook_handle: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const hasIdentity = form.email.trim() || form.telegram_handle.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim() || !hasIdentity) return;

    setStatus('loading');
    setErrorMsg('');

    const res = await fetch('/api/bot/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: form.code.trim(),
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        telegram_handle: form.telegram_handle.trim() || undefined,
        moltbook_handle: form.moltbook_handle.trim() || undefined,
      }),
    });

    const data = await res.json();

    if (res.ok && data.ok) {
      setNewApiKey(data.bot.api_key);
      setStatus('success');
    } else {
      setErrorMsg(data.error ?? 'Registration failed');
      setStatus('error');
    }
  }

  function handleCopy() {
    if (newApiKey) {
      navigator.clipboard.writeText(newApiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // Success: show API key on golden plaque
  if (status === 'success' && newApiKey) {
    return (
      <div style={{ ...stoneCard, padding: '40px 32px', textAlign: 'center' }}>
        <div
          style={{
            width: 72,
            height: 72,
            margin: '0 auto 20px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${STONE.goldDark}, ${STONE.gold})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 40px ${STONE.goldGlow}`,
          }}
        >
          <span style={{ fontSize: 32 }}>&#9876;</span>
        </div>

        <p style={{ fontFamily: '"Playfair Display", serif', textTransform: 'uppercase', letterSpacing: '0.2em', color: STONE.gold, textShadow: `0 0 20px ${STONE.goldGlow}`, fontSize: 15, marginBottom: 8 }}>
          Champion Armed
        </p>
        <p
          style={{
            fontFamily: '"IBM Plex Sans", sans-serif',
            fontWeight: 300,
            color: STONE.textMuted,
            fontSize: 13,
            marginBottom: 24,
          }}
        >
          Your champion <strong style={{ color: STONE.text }}>{form.name}</strong> is ready for battle.
          Save this Arena Key &mdash; it will not be shown again.
        </p>

        <div
          style={{
            background: `linear-gradient(135deg, rgba(200,168,75,0.1), rgba(139,105,20,0.08))`,
            border: `2px solid ${STONE.gold}`,
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 24,
            boxShadow: `0 0 24px ${STONE.goldGlow}, inset 0 1px 0 rgba(255,215,100,0.1)`,
          }}
        >
          <p style={{ fontFamily: '"Playfair Display", serif', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: STONE.goldDark, marginBottom: 8 }}>
            Arena Key
          </p>
          <code style={{ fontFamily: '"DM Mono", monospace', fontSize: 13, color: STONE.gold, wordBreak: 'break-all', display: 'block', lineHeight: 1.5 }}>
            {newApiKey}
          </code>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={handleCopy} style={{ ...goldButton, padding: '10px 28px', fontSize: 13 }}>
            {copied ? 'Copied!' : 'Copy Key'}
          </button>
          <button
            onClick={onRegistered}
            style={{
              ...goldButton,
              padding: '10px 28px',
              fontSize: 13,
              background: 'transparent',
              border: `1px solid ${STONE.cardBorder}`,
              color: STONE.text,
            }}
          >
            Enter the Arena
          </button>
        </div>
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
        Present your Arena Seal and declare your identity to arm a champion.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Field label="Arena Seal" hint="invite code" required>
          <input
            type="text"
            required
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="tokyo2311540983_!"
            style={{
              ...stoneInput,
              width: '100%',
              padding: '10px 14px',
              fontSize: 15,
              fontFamily: '"DM Mono", monospace',
              letterSpacing: '0.05em',
              textAlign: 'center',
            }}
          />
        </Field>

        {/* Identity — at least one required */}
        <div style={{ borderTop: `1px solid ${STONE.cardBorder}`, paddingTop: 20 }}>
          <p style={{ fontFamily: '"Playfair Display", serif', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: STONE.goldDark, marginBottom: 12 }}>
            Your Identity <span style={{ color: STONE.textMuted, fontFamily: '"IBM Plex Sans", sans-serif', letterSpacing: 0, textTransform: 'none', fontSize: 11 }}>(at least one required)</span>
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="gladiator@example.com"
                style={{ ...stoneInput, width: '100%', padding: '10px 14px', fontSize: 14 }}
              />
            </Field>

            <Field label="Telegram Handle">
              <input
                type="text"
                value={form.telegram_handle}
                onChange={(e) => setForm({ ...form, telegram_handle: e.target.value })}
                placeholder="@username"
                style={{ ...stoneInput, width: '100%', padding: '10px 14px', fontSize: 14 }}
              />
            </Field>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${STONE.cardBorder}`, paddingTop: 20 }}>
          <Field label="Champion Name" required>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Maximus-v1"
              style={{ ...stoneInput, width: '100%', padding: '10px 14px', fontSize: 14 }}
            />
          </Field>
        </div>

        <Field label="Moltbook Handle" hint="optional">
          <input
            type="text"
            value={form.moltbook_handle}
            onChange={(e) => setForm({ ...form, moltbook_handle: e.target.value })}
            placeholder="agent-name"
            style={{ ...stoneInput, width: '100%', padding: '10px 14px', fontSize: 14 }}
          />
        </Field>
      </div>

      {status === 'error' && (
        <p style={{ color: STONE.danger, fontSize: 13, textAlign: 'center', marginTop: 16 }}>
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'loading' || !form.code.trim() || !form.name.trim() || !hasIdentity}
        style={{
          ...goldButton,
          width: '100%',
          padding: '12px 0',
          marginTop: 28,
          fontSize: 14,
          opacity: status === 'loading' || !hasIdentity ? 0.6 : 1,
        }}
      >
        {status === 'loading' ? 'Forging...' : 'Arm Champion'}
      </button>
    </form>
  );
}

function Field({ label, hint, required, children }: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
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
        {label}
        {required && <span style={{ color: STONE.goldDark }}> *</span>}
        {hint && (
          <span style={{ color: STONE.textMuted, fontFamily: '"IBM Plex Sans", sans-serif', letterSpacing: 0, textTransform: 'none', fontSize: 11, marginLeft: 8 }}>
            {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
