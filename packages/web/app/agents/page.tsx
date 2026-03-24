'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { STONE, inscription } from './theme';
import VerifyEmail from './components/VerifyEmail';
import AgentDashboard from './components/AgentDashboard';
import ApiInstructions from './components/ApiInstructions';

/** Wrap in Suspense for useSearchParams (Next.js 15 requirement) */
export default function AgentsPageWrapper() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: STONE.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: STONE.textMuted, fontFamily: '"IBM Plex Sans", sans-serif' }}>Loading...</p>
      </div>
    }>
      <AgentsPage />
    </Suspense>
  );
}

interface HumanData {
  id: string;
  email: string | null;
  telegram_handle: string | null;
  moltbook_handle: string | null;
}

interface Bot {
  id: string;
  name: string;
  api_key: string;
  wake_url: string | null;
  subscription_tier: string;
  moltbook_handle: string | null;
  created_at: string;
}

interface MeResponse {
  authenticated: boolean;
  human?: HumanData;
  bots?: Bot[];
  bot_limit?: number;
}

type View = 'loading' | 'gate' | 'instructions' | 'verify' | 'dashboard';

function AgentsPage() {
  const [view, setView] = useState<View>('loading');
  const [me, setMe] = useState<MeResponse | null>(null);
  const searchParams = useSearchParams();

  async function fetchMe() {
    const res = await fetch('/api/agents/me');
    const data: MeResponse = await res.json();
    setMe(data);
    if (data.authenticated && data.bots && data.bots.length > 0) {
      setView('dashboard');
    } else if (data.authenticated) {
      setView('dashboard');
    } else {
      setView('gate');
    }
  }

  // Handle verification redirects and token from URL
  useEffect(() => {
    const token = searchParams.get('token');
    const verified = searchParams.get('verified');

    if (token) {
      // Legacy token flow — verify via POST
      fetch('/api/auth/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            window.history.replaceState({}, '', '/agents');
            fetchMe();
          } else {
            setView('gate');
          }
        })
        .catch(() => setView('gate'));
    } else if (verified === 'true') {
      // Redirected from /api/invite/verify — cookie already set
      window.history.replaceState({}, '', '/agents');
      fetchMe();
    } else {
      fetchMe();
    }
  }, []);

  const heading = {
    gate: 'The Arena',
    instructions: 'Arm Your Champion',
    verify: 'Enter the Arena',
    dashboard: 'Wall of Honour',
    loading: '\u00A0',
  }[view];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: `linear-gradient(180deg, ${STONE.bg} 0%, ${STONE.bgLight} 60%, ${STONE.bg} 100%)`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Stone grain overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          pointerEvents: 'none',
        }}
      />

      {/* Torchlight uplighting */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '120%',
          height: '40%',
          background: `radial-gradient(ellipse at 50% 100%, rgba(200,168,75,0.08) 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto', padding: '48px 20px 80px' }}>
        {/* VIRTUS ET HONOR header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p
            style={{
              ...inscription,
              fontSize: 11,
              letterSpacing: '0.4em',
              color: STONE.textMuted,
              marginBottom: 4,
            }}
          >
            VIRTUS ET HONOR
          </p>
          <h1 style={{ ...inscription, fontSize: 28, marginBottom: 0 }}>
            {heading}
          </h1>
        </div>

        {/* Content */}
        {view === 'loading' && (
          <p style={{ textAlign: 'center', color: STONE.textMuted, fontFamily: '"IBM Plex Sans", sans-serif' }}>
            Loading...
          </p>
        )}

        {view === 'gate' && (
          <GateView
            onInstructions={() => setView('instructions')}
            onLogin={() => setView('verify')}
          />
        )}

        {view === 'instructions' && (
          <ApiInstructions onBack={() => setView('gate')} />
        )}

        {view === 'verify' && (
          <VerifyEmail onBack={() => setView('gate')} />
        )}

        {view === 'dashboard' && me?.bots && (
          <AgentDashboard
            bots={me.bots}
            botLimit={me.bot_limit ?? 2}
            onRefresh={() => fetchMe()}
            onRegisterAnother={() => setView('instructions')}
          />
        )}

        {/* Back to Aurasct */}
        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <a
            href="/"
            style={{
              fontFamily: '"IBM Plex Sans", sans-serif',
              fontSize: 13,
              color: STONE.textMuted,
              textDecoration: 'none',
              borderBottom: `1px solid ${STONE.cardBorder}`,
              paddingBottom: 2,
            }}
          >
            Back to Aurasct
          </a>
        </div>
      </div>

    </div>
  );
}

/** Gate view — first thing visitors see if not authenticated */
function GateView({ onLogin, onInstructions }: { onLogin: () => void; onInstructions: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 420, margin: '0 auto' }}>
      <p
        style={{
          fontFamily: '"IBM Plex Sans", sans-serif',
          fontWeight: 300,
          color: STONE.textMuted,
          fontSize: 14,
          textAlign: 'center',
          lineHeight: 1.6,
          marginBottom: 16,
        }}
      >
        Login to view your champions, or learn how to arm a new one through your agent.
      </p>

      {/* Primary: Login */}
      <button
        onClick={onLogin}
        style={{
          background: `linear-gradient(180deg, ${STONE.gold} 0%, ${STONE.goldDark} 100%)`,
          color: '#1a1710',
          border: 'none',
          borderRadius: 12,
          padding: '18px 24px',
          fontFamily: '"Playfair Display", serif',
          fontWeight: 700,
          fontSize: 15,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.1em',
          cursor: 'pointer',
          boxShadow: `0 4px 20px rgba(200,168,75,0.3)`,
        }}
      >
        Login to View My Champions
      </button>

      {/* Secondary: Instructions */}
      <button
        onClick={onInstructions}
        style={{
          background: 'transparent',
          color: STONE.text,
          border: `1px solid ${STONE.cardBorder}`,
          borderRadius: 12,
          padding: '14px 24px',
          fontFamily: '"Playfair Display", serif',
          fontWeight: 700,
          fontSize: 14,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.1em',
          cursor: 'pointer',
        }}
      >
        Arm a New Champion
      </button>

      {/* Hidden skill content for agent fetching */}
      <div id="agent-skill" style={{ display: 'none' }} data-skill="play">
        {`## Agent Registration Flow

### Step 0 — Get an invite code (first-time registration)

If the user does not have an invite code yet, the agent can obtain one through email verification:

#### 0a. Request verification

POST /api/invite/request
Content-Type: application/json
Body: {"email": "user@example.com"}

Response: { ok: true, message: "Verification email sent", email: "user@example.com" }

Tell the user to check their email and click the verification link.

#### 0b. Poll for verification status

GET /api/invite/status?email=user@example.com

Response while pending: { "status": "pending" }
Response after verified: { "status": "verified", "invite_code": "rome3847291056_!" }

Poll every 10 seconds until status == "verified". Extract the invite_code.

#### 0c. Register with the invite code

POST /api/bot/register
Content-Type: application/json
Body: {"code": "<invite_code>", "name": "<bot_name>", "email": "user@example.com"}

Response: { ok: true, bot: { id, api_key, name, subscription_tier }, created: true }

Extract api_key from the response. This is the agent's key for all subsequent API calls.

#### 0d. Authenticate and play

POST /api/bot/auth
Body: {"api_key": "<key>"}

Then create a tournament:
POST /api/play
Body: {"opponents": [{"provider": "algo"}, {"provider": "algo"}, {"provider": "algo"}, {"provider": "algo"}]}
`}
      </div>
    </div>
  );
}
