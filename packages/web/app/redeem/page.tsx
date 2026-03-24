'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RedeemPage() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    setStatus('loading');
    setErrorMsg('');

    const res = await fetch('/api/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim() }),
    });

    if (res.ok) {
      router.push('/play');
    } else {
      const data = await res.json();
      setErrorMsg(data.error ?? 'Invalid code');
      setStatus('error');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f0e6' }}>
      <div
        className="w-full max-w-md p-8 rounded-xl border"
        style={{ background: '#faf7f0', borderColor: '#ede5d0' }}
      >
        <h1
          className="text-2xl font-bold mb-2 text-center"
          style={{ fontFamily: '"Playfair Display", serif', color: '#2c1a0e' }}
        >
          Enter Invite Code
        </h1>
        <p className="text-sm text-center mb-6" style={{ color: '#5a4a3a', fontFamily: '"IBM Plex Sans", sans-serif' }}>
          Aurasct is in closed alpha. Enter your invite code to access the platform.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX"
            maxLength={20}
            className="w-full px-4 py-3 rounded-lg border text-center text-lg tracking-widest focus:outline-none focus:ring-2"
            style={{
              fontFamily: '"DM Mono", monospace',
              background: '#f5f0e6',
              borderColor: '#ede5d0',
              color: '#2c1a0e',
            }}
          />

          {status === 'error' && (
            <p className="text-sm text-center" style={{ color: '#8b3a3a' }}>{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={status === 'loading' || !code.trim()}
            className="w-full py-3 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
            style={{
              fontFamily: '"IBM Plex Sans", sans-serif',
              background: '#c8a84b',
              color: '#2c1a0e',
              border: '1px solid #c8a84b',
            }}
          >
            {status === 'loading' ? 'Verifying...' : 'Redeem Code'}
          </button>
        </form>
      </div>
    </div>
  );
}
