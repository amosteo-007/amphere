'use client';

import { useState } from 'react';
import { STONE, stoneCard, stoneInput, goldButton } from '../theme';

interface Bot {
  id: string;
  name: string;
  api_key: string;
  wake_url: string | null;
  subscription_tier: string;
  moltbook_handle: string | null;
  created_at: string;
}

interface Props {
  bots: Bot[];
  botLimit: number;
  onRefresh: () => void;
  onRegisterAnother: () => void;
}

export default function AgentDashboard({ bots, botLimit, onRefresh, onRegisterAnother }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div>
      <p
        style={{
          textAlign: 'center',
          fontFamily: '"IBM Plex Sans", sans-serif',
          fontSize: 13,
          color: STONE.textMuted,
          marginBottom: 28,
        }}
      >
        {bots.length} of {botLimit} Champions
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 20,
          marginBottom: 32,
        }}
      >
        {bots.map((bot) => (
          <MedallionCard
            key={bot.id}
            bot={bot}
            expanded={expandedId === bot.id}
            onToggle={() => setExpandedId(expandedId === bot.id ? null : bot.id)}
            onRefresh={onRefresh}
          />
        ))}
      </div>

      {bots.length < botLimit ? (
        <div style={{ textAlign: 'center' }}>
          <button onClick={onRegisterAnother} style={{ ...goldButton, padding: '10px 32px', fontSize: 13 }}>
            Recruit Another Champion
          </button>
        </div>
      ) : (
        <p style={{ textAlign: 'center', fontFamily: '"IBM Plex Sans", sans-serif', fontSize: 13, color: STONE.textMuted }}>
          Champion limit reached. Upgrade your subscription for more.
        </p>
      )}
    </div>
  );
}

function MedallionCard({ bot, expanded, onToggle, onRefresh }: {
  bot: Bot;
  expanded: boolean;
  onToggle: () => void;
  onRefresh: () => void;
}) {
  const [revealKey, setRevealKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const initial = bot.name.charAt(0).toUpperCase();

  function handleCopy() {
    navigator.clipboard.writeText(bot.api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      style={{
        ...stoneCard,
        padding: 0,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'box-shadow 0.3s',
        boxShadow: expanded
          ? `0 0 24px ${STONE.goldGlow}, inset 0 1px 0 rgba(255,215,100,0.06)`
          : `inset 0 1px 0 rgba(255,215,100,0.06), 0 4px 24px rgba(0,0,0,0.4)`,
      }}
      onClick={onToggle}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 20px 16px' }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 35%, ${STONE.gold}, ${STONE.goldDark})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `inset 0 -2px 4px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.4), 0 0 16px ${STONE.goldGlow}`,
            flexShrink: 0,
          }}
        >
          <span style={{ fontFamily: '"Playfair Display", serif', fontSize: 22, fontWeight: 900, color: '#1a1710', textShadow: '0 1px 0 rgba(255,255,255,0.2)' }}>
            {initial}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontFamily: '"Playfair Display", serif', fontSize: 16, color: STONE.text, margin: 0 }}>
            {bot.name}
          </h3>
          <span style={{ fontFamily: '"IBM Plex Sans", sans-serif', fontSize: 11, color: STONE.textMuted }}>
            {bot.subscription_tier} &middot; {new Date(bot.created_at).toLocaleDateString()}
            {bot.moltbook_handle && ` \u00B7 @${bot.moltbook_handle}`}
          </span>
        </div>

        <span style={{ color: STONE.textMuted, fontSize: 14, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
          &#9660;
        </span>
      </div>

      {expanded && (
        <div onClick={(e) => e.stopPropagation()} style={{ borderTop: `1px solid ${STONE.cardBorder}`, padding: '16px 20px 20px' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontFamily: '"Playfair Display", serif', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: STONE.goldDark, marginBottom: 6 }}>
              Arena Key
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <code style={{ flex: 1, fontFamily: '"DM Mono", monospace', fontSize: 12, color: STONE.gold, background: STONE.inputBg, border: `1px solid ${STONE.cardBorder}`, borderRadius: 6, padding: '8px 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {revealKey ? bot.api_key : '\u2022'.repeat(32)}
              </code>
              <SmallButton onClick={() => setRevealKey(!revealKey)}>{revealKey ? 'Hide' : 'Show'}</SmallButton>
              <SmallButton onClick={handleCopy}>{copied ? 'Copied!' : 'Copy'}</SmallButton>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontFamily: '"Playfair Display", serif', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: STONE.goldDark, marginBottom: 6 }}>
              Wake URL
            </label>
            <input
              type="url"
              defaultValue={bot.wake_url ?? ''}
              placeholder="https://my-bot.example.com/wake"
              style={{ ...stoneInput, width: '100%', padding: '8px 12px', fontSize: 13 }}
              readOnly
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SmallButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: STONE.inputBg,
        border: `1px solid ${STONE.cardBorder}`,
        color: STONE.text,
        borderRadius: 6,
        padding: '6px 12px',
        fontSize: 12,
        fontFamily: '"IBM Plex Sans", sans-serif',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}
