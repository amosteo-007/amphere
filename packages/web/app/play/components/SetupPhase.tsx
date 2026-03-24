'use client';

import { useEffect, useState } from 'react';
import { PROVIDERS, PROVIDER_KEYS, FREE_TIER_PROVIDERS, THEME, type ProviderKey } from '@/lib/game-theme';
import { createClient } from '@/lib/supabase/client';

interface OpponentSlot {
  provider: ProviderKey;
  registered_bot_id?: string;
  bot_name?: string;
}

interface SetupPhaseProps {
  onStart: (opponents: { provider: ProviderKey; registered_bot_id?: string }[]) => void;
  loading: boolean;
}

interface RegisteredBot {
  id: string;
  name: string;
}

export default function SetupPhase({ onStart, loading }: SetupPhaseProps) {
  const [slots, setSlots] = useState<OpponentSlot[]>([
    { provider: 'anthropic' },
    { provider: 'google' },
    { provider: 'groq' },
    { provider: 'deepseek' },
  ]);
  const [registeredBots, setRegisteredBots] = useState<RegisteredBot[]>([]);
  const [botsLoaded, setBotsLoaded] = useState(false);
  const [showBotPicker, setShowBotPicker] = useState(false);
  const [userTier, setUserTier] = useState<string>('free');

  // Fetch registered bots and user tier on mount
  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setBotsLoaded(true); return; }

      const { data } = await supabase
        .from('registered_bots')
        .select('id, name')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true });

      setRegisteredBots(data ?? []);
      setBotsLoaded(true);

      // Fetch tier
      fetch('/api/me').then((r) => r.json()).then((me) => {
        if (me.tier) setUserTier(me.tier);
      }).catch(() => {});
    }
    loadData();
  }, []);

  const isFreeTier = userTier === 'free';

  function isProviderLocked(key: ProviderKey): boolean {
    if (!isFreeTier) return false;
    if (key === 'external') return false;
    return !FREE_TIER_PROVIDERS.includes(key);
  }

  function addSlot(provider: ProviderKey) {
    if (slots.length >= 9) return;
    if (provider === 'external') {
      setShowBotPicker(true);
      return;
    }
    setSlots([...slots, { provider }]);
  }

  function addExternalBot(bot: RegisteredBot) {
    if (slots.length >= 9) return;
    setSlots([...slots, { provider: 'external', registered_bot_id: bot.id, bot_name: bot.name }]);
    setShowBotPicker(false);
  }

  function removeSlot(index: number) {
    if (slots.length <= 4) return;
    setSlots(slots.filter((_, i) => i !== index));
  }

  function handleStart() {
    onStart(slots.map((s) => ({
      provider: s.provider,
      ...(s.registered_bot_id ? { registered_bot_id: s.registered_bot_id } : {}),
    })));
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1
        className="text-3xl font-bold text-center mb-2"
        style={{ fontFamily: '"Playfair Display", serif', color: THEME.ink }}
      >
        Assemble Your Opponents
      </h1>
      <p className="text-center text-sm mb-8" style={{ color: THEME.inkLight, fontFamily: '"IBM Plex Sans", sans-serif' }}>
        Select 4–9 opponents to compete against. You + opponents = 5–10 total bidders.
      </p>

      {/* Current opponents */}
      <div className="space-y-2 mb-6">
        {/* Human player (fixed) */}
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg border"
          style={{ background: THEME.bgCard, borderColor: THEME.gold }}
        >
          <span className="w-3 h-3 rounded-full" style={{ background: THEME.gold }} />
          <span className="font-medium text-sm" style={{ fontFamily: '"IBM Plex Sans", sans-serif', color: THEME.ink }}>
            You
          </span>
          <span className="ml-auto text-xs" style={{ color: THEME.inkLight, fontFamily: '"DM Mono", monospace' }}>
            Human
          </span>
        </div>

        {slots.map((slot, i) => {
          const info = PROVIDERS[slot.provider];
          const displayName = slot.provider === 'external' && slot.bot_name
            ? `OpenClaw — ${slot.bot_name}`
            : info.display;
          return (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border"
              style={{ background: THEME.bgCard, borderColor: THEME.bgDark }}
            >
              <span className="w-3 h-3 rounded-full" style={{ background: info.color }} />
              <span className="font-medium text-sm" style={{ fontFamily: '"IBM Plex Sans", sans-serif', color: THEME.ink }}>
                {displayName}
              </span>
              <span className="text-xs" style={{ color: THEME.inkLight, fontFamily: '"DM Mono", monospace' }}>
                {slot.provider === 'external' ? 'external bot' : info.model}
              </span>
              <button
                onClick={() => removeSlot(i)}
                disabled={slots.length <= 4}
                className="ml-auto text-xs px-2 py-1 rounded transition-colors disabled:opacity-30"
                style={{ color: THEME.danger }}
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>

      {/* Add opponent */}
      {slots.length < 9 && (
        <div className="mb-8">
          <p className="text-xs mb-2" style={{ color: THEME.inkLight, fontFamily: '"IBM Plex Sans", sans-serif' }}>
            Add opponent ({slots.length}/9):
          </p>
          <div className="flex flex-wrap gap-2">
            {PROVIDER_KEYS.map((key) => {
              const info = PROVIDERS[key];
              // Hide external if no registered bots
              if (key === 'external' && botsLoaded && registeredBots.length === 0) return null;
              const locked = isProviderLocked(key);
              return (
                <button
                  key={key}
                  onClick={() => !locked && addSlot(key)}
                  disabled={locked}
                  title={locked ? 'Upgrade subscription to unlock' : undefined}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: THEME.bgCard,
                    borderColor: locked ? THEME.bgDark : info.color,
                    color: THEME.ink,
                    fontFamily: '"IBM Plex Sans", sans-serif',
                  }}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: locked ? THEME.bgDark : info.color }} />
                  {info.display}
                  {locked && <span style={{ fontSize: 10, color: THEME.inkLight }}>&#128274;</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bot picker modal */}
      {showBotPicker && (
        <div className="mb-6 p-4 rounded-lg border" style={{ background: THEME.bgCard, borderColor: PROVIDERS.external.color }}>
          <p className="text-sm font-medium mb-3" style={{ color: THEME.ink, fontFamily: '"IBM Plex Sans", sans-serif' }}>
            Select a registered bot:
          </p>
          {registeredBots.length === 0 ? (
            <p className="text-xs" style={{ color: THEME.inkLight }}>
              No bots registered. Go to <a href="/agents" className="underline">/agents</a> to create one.
            </p>
          ) : (
            <div className="space-y-2">
              {registeredBots.map((bot) => (
                <button
                  key={bot.id}
                  onClick={() => addExternalBot(bot)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-sm transition-colors hover:opacity-80"
                  style={{ background: THEME.bg, borderColor: THEME.bgDark, color: THEME.ink, fontFamily: '"IBM Plex Sans", sans-serif' }}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: PROVIDERS.external.color }} />
                  {bot.name}
                  <span className="ml-auto text-xs" style={{ color: THEME.inkLight, fontFamily: '"DM Mono", monospace' }}>
                    {bot.id.slice(0, 8)}
                  </span>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowBotPicker(false)}
            className="mt-3 text-xs px-3 py-1 rounded"
            style={{ color: THEME.inkLight }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Begin */}
      <button
        onClick={handleStart}
        disabled={loading || slots.length < 4}
        className="w-full py-3 rounded-lg font-semibold text-sm transition-all disabled:opacity-50"
        style={{
          background: THEME.gold,
          color: THEME.ink,
          fontFamily: '"Playfair Display", serif',
          fontSize: '16px',
        }}
      >
        {loading ? 'Creating Tournament...' : `Begin Auction (${slots.length + 1} bidders)`}
      </button>
    </div>
  );
}
