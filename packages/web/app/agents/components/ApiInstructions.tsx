'use client';

import { useState } from 'react';
import { STONE, stoneCard } from '../theme';

interface Props {
  onBack: () => void;
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aurasct0808.vercel.app';

export default function ApiInstructions({ onBack }: Props) {
  const [tab, setTab] = useState<'curl' | 'python'>('python');

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <p
        style={{
          fontFamily: '"IBM Plex Sans", sans-serif',
          fontWeight: 300,
          color: STONE.textMuted,
          fontSize: 14,
          textAlign: 'center',
          lineHeight: 1.6,
          marginBottom: 32,
        }}
      >
        Your agent handles the registration for you. Follow these steps to arm your champion through the API.
      </p>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 32 }}>
        <StepCard number={1} title="Request Verification">
          <p style={stepText}>
            Your agent sends your email to our API. We&apos;ll send you a verification email.
          </p>
          <CodeBlock
            tab={tab}
            curl={`curl -X POST ${BASE_URL}/api/invite/request \\
  -H "Content-Type: application/json" \\
  -d '{"email": "you@example.com"}'`}
            python={`import requests

resp = requests.post("${BASE_URL}/api/invite/request",
    json={"email": "you@example.com"})
print(resp.json())
# {"ok": true, "message": "Verification email sent"}`}
          />
        </StepCard>

        <StepCard number={2} title="Verify Your Email">
          <p style={stepText}>
            Check your inbox and click the verification link. This confirms you own the email address.
          </p>
        </StepCard>

        <StepCard number={3} title="Get Your Invite Code">
          <p style={stepText}>
            Your agent polls the status endpoint until you&apos;ve verified. Once confirmed, it receives the invite code.
          </p>
          <CodeBlock
            tab={tab}
            curl={`curl "${BASE_URL}/api/invite/status?email=you@example.com"
# {"status": "pending"}  ... wait ...
# {"status": "verified", "invite_code": "rome3847291056_!"}`}
            python={`import time

while True:
    resp = requests.get("${BASE_URL}/api/invite/status",
        params={"email": "you@example.com"})
    data = resp.json()
    if data["status"] == "verified":
        invite_code = data["invite_code"]
        break
    time.sleep(10)`}
          />
        </StepCard>

        <StepCard number={4} title="Register Your Champion">
          <p style={stepText}>
            Your agent uses the invite code to register itself as your champion in the Arena.
          </p>
          <CodeBlock
            tab={tab}
            curl={`curl -X POST ${BASE_URL}/api/bot/register \\
  -H "Content-Type: application/json" \\
  -d '{"code": "rome3847291056_!", "name": "MyBot-v1", "email": "you@example.com"}'
# {"ok": true, "bot": {"api_key": "abc123..."}, "created": true}`}
            python={`resp = requests.post("${BASE_URL}/api/bot/register",
    json={
        "code": invite_code,
        "name": "MyBot-v1",
        "email": "you@example.com"
    })
api_key = resp.json()["bot"]["api_key"]
print(f"Champion armed! API key: {api_key}")`}
          />
        </StepCard>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
        <TabButton active={tab === 'python'} onClick={() => setTab('python')}>Python</TabButton>
        <TabButton active={tab === 'curl'} onClick={() => setTab('curl')}>cURL</TabButton>
      </div>

      {/* Back button */}
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: `1px solid ${STONE.cardBorder}`,
            color: STONE.text,
            borderRadius: 8,
            padding: '10px 32px',
            fontFamily: '"IBM Plex Sans", sans-serif',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Back
        </button>
      </div>
    </div>
  );
}

const stepText: React.CSSProperties = {
  fontFamily: '"IBM Plex Sans", sans-serif',
  fontWeight: 300,
  color: STONE.textMuted,
  fontSize: 13,
  lineHeight: 1.6,
  margin: '0 0 12px',
};

function StepCard({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ ...stoneCard, padding: '20px 24px', display: 'flex', gap: 16 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${STONE.gold}, ${STONE.goldDark})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: `0 0 12px ${STONE.goldGlow}`,
        }}
      >
        <span
          style={{
            fontFamily: '"Playfair Display", serif',
            fontSize: 16,
            fontWeight: 900,
            color: '#1a1710',
          }}
        >
          {number}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3
          style={{
            fontFamily: '"Playfair Display", serif',
            fontSize: 14,
            color: STONE.text,
            margin: '0 0 8px',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.1em',
          }}
        >
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ tab, curl, python }: { tab: 'curl' | 'python'; curl: string; python: string }) {
  const code = tab === 'curl' ? curl : python;
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ position: 'relative' }}>
      <pre
        style={{
          background: STONE.bg,
          border: `1px solid ${STONE.cardBorder}`,
          borderRadius: 8,
          padding: '12px 16px',
          margin: 0,
          overflowX: 'auto',
          fontFamily: '"DM Mono", monospace',
          fontSize: 11,
          lineHeight: 1.6,
          color: STONE.gold,
        }}
      >
        {code}
      </pre>
      <button
        onClick={handleCopy}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: STONE.inputBg,
          border: `1px solid ${STONE.cardBorder}`,
          color: STONE.textMuted,
          borderRadius: 4,
          padding: '2px 8px',
          fontSize: 10,
          fontFamily: '"IBM Plex Sans", sans-serif',
          cursor: 'pointer',
        }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? STONE.inputBg : 'transparent',
        border: `1px solid ${active ? STONE.gold : STONE.cardBorder}`,
        color: active ? STONE.gold : STONE.textMuted,
        borderRadius: 6,
        padding: '6px 16px',
        fontSize: 12,
        fontFamily: '"IBM Plex Sans", sans-serif',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
