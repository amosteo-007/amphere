'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';

interface WaitlistEntry {
  id: string;
  email: string;
  telegram_handle: string | null;
  moltbook_handle: string | null;
  why: string | null;
  status: string;
  created_at: string;
}

export default function AdminInvitesPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(true);
  const [generatedCodes, setGeneratedCodes] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'denied' | 'all'>('pending');

  useEffect(() => { loadEntries(); }, []);

  async function loadEntries() {
    setLoading(true);
    const res = await fetch('/api/admin/waitlist');
    if (res.status === 403) {
      setAuthorized(false);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setEntries(data.entries ?? []);
    setLoading(false);
  }

  async function handleAction(id: string, action: 'approve' | 'deny') {
    setProcessing(id);
    const res = await fetch('/api/admin/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waitlist_id: id, action }),
    });
    const data = await res.json();
    if (data.ok && data.invite_code) {
      setGeneratedCodes((prev) => ({ ...prev, [id]: data.invite_code }));
    }
    await loadEntries();
    setProcessing(null);
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
  }

  if (!authorized) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
        <p style={{ color: '#888', fontSize: 18 }}>Unauthorized — admin access required.</p>
      </div>
    );
  }

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.status === filter);

  return (
    <div style={{ minHeight: '100vh', background: '#111', color: '#ddd', fontFamily: '"IBM Plex Sans", sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Waitlist Review</h1>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
          {entries.filter((e) => e.status === 'pending').length} pending applications
        </p>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['pending', 'approved', 'denied', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                border: filter === f ? '1px solid #c8a84b' : '1px solid #333',
                background: filter === f ? 'rgba(200,168,75,0.1)' : 'transparent',
                color: filter === f ? '#c8a84b' : '#888',
                fontSize: 13,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {f} ({f === 'all' ? entries.length : entries.filter((e) => e.status === f).length})
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: '#666' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: '#666' }}>No {filter} entries.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((entry) => (
              <div
                key={entry.id}
                style={{
                  background: '#1a1a1a',
                  border: '1px solid #2a2a2a',
                  borderRadius: 10,
                  padding: 20,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{entry.email}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {new Date(entry.created_at).toLocaleString()}
                      {entry.telegram_handle && ` · TG: ${entry.telegram_handle}`}
                      {entry.moltbook_handle && ` · MB: ${entry.moltbook_handle}`}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 10px',
                      borderRadius: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      background:
                        entry.status === 'pending' ? 'rgba(200,168,75,0.15)' :
                        entry.status === 'approved' ? 'rgba(58,107,58,0.2)' : 'rgba(139,58,58,0.2)',
                      color:
                        entry.status === 'pending' ? '#c8a84b' :
                        entry.status === 'approved' ? '#6b9b6b' : '#9b6b6b',
                    }}
                  >
                    {entry.status}
                  </span>
                </div>

                {entry.why && (
                  <p style={{ fontSize: 13, color: '#aaa', margin: '0 0 12px', lineHeight: 1.5, fontStyle: 'italic' }}>
                    &ldquo;{entry.why}&rdquo;
                  </p>
                )}

                {/* Generated invite code */}
                {generatedCodes[entry.id] && (
                  <div
                    style={{
                      background: 'rgba(200,168,75,0.08)',
                      border: '1px solid rgba(200,168,75,0.2)',
                      borderRadius: 8,
                      padding: '10px 14px',
                      marginBottom: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <code style={{ fontFamily: '"DM Mono", monospace', color: '#c8a84b', flex: 1, fontSize: 14 }}>
                      {generatedCodes[entry.id]}
                    </code>
                    <button
                      onClick={() => copyCode(generatedCodes[entry.id])}
                      style={{
                        background: '#c8a84b',
                        color: '#111',
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Copy
                    </button>
                  </div>
                )}

                {/* Action buttons */}
                {entry.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleAction(entry.id, 'approve')}
                      disabled={processing === entry.id}
                      style={{
                        background: 'rgba(58,107,58,0.3)',
                        border: '1px solid rgba(58,107,58,0.5)',
                        color: '#6b9b6b',
                        borderRadius: 6,
                        padding: '6px 20px',
                        fontSize: 13,
                        cursor: 'pointer',
                        opacity: processing === entry.id ? 0.5 : 1,
                      }}
                    >
                      Approve & Generate Code
                    </button>
                    <button
                      onClick={() => handleAction(entry.id, 'deny')}
                      disabled={processing === entry.id}
                      style={{
                        background: 'transparent',
                        border: '1px solid #333',
                        color: '#888',
                        borderRadius: 6,
                        padding: '6px 20px',
                        fontSize: 13,
                        cursor: 'pointer',
                        opacity: processing === entry.id ? 0.5 : 1,
                      }}
                    >
                      Deny
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
