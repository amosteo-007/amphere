export const THEME = {
  bg: '#f5f0e6',
  bgCard: '#faf7f0',
  bgDark: '#ede5d0',
  ink: '#2c1a0e',
  inkLight: '#5a4a3a',
  gold: '#c8a84b',
  gold2: '#f0d080',
  danger: '#8b3a3a',
  success: '#3a6b3a',
} as const;

/** Display name → engine provider mapping + brand colors */
export const PROVIDERS = {
  anthropic: { display: 'Anthropic', model: 'claude-haiku-4-5-20251001',    color: '#378ADD', provider: 'anthropic' as const },
  google:    { display: 'Google',    model: 'gemini-3.1-flash-lite-preview',        color: '#D85A30', provider: 'google' as const },
  groq:      { display: 'Groq',      model: 'llama-3.3-70b-versatile',      color: '#EF9F27', provider: 'groq' as const },
  deepseek:  { display: 'DeepSeek',  model: 'deepseek-chat',               color: '#1D9E75', provider: 'deepseek' as const },
  openai:    { display: 'OpenAI',    model: 'gpt-5-mini-2025-08-07',                  color: '#7F77DD', provider: 'openai' as const },
  mistral:   { display: 'Mistral',   model: 'mistral-small-latest',         color: '#D4537E', provider: 'mistral' as const },
  kimi:      { display: 'Kimi',      model: 'kimi-k2-turbo-preview',                 color: '#6B5CE7', provider: 'kimi' as const },
  algo:      { display: 'Algorithm', model: 'deterministic',              color: '#888888', provider: 'algo' as const },
  external:  { display: 'OpenClaw',  model: 'external',                  color: '#2D9CDB', provider: 'external' as const },
} as const;

export type ProviderKey = keyof typeof PROVIDERS;
export const PROVIDER_KEYS = Object.keys(PROVIDERS) as ProviderKey[];

/** Free-tier users can only select these providers as opponents */
export const FREE_TIER_PROVIDERS: ProviderKey[] = ['algo', 'deepseek', 'openai', 'anthropic', 'mistral'];

export const HUMAN_COLOR = '#c8a84b';

/** Map engine provider name to display color (for leaderboard/chart) */
export function getProviderColor(engineProvider: string): string {
  for (const p of Object.values(PROVIDERS)) {
    if (p.provider === engineProvider) return p.color;
  }
  if (engineProvider === 'human') return HUMAN_COLOR;
  return '#999';
}

export function getProviderDisplay(engineProvider: string): string {
  for (const [key, p] of Object.entries(PROVIDERS)) {
    if (p.provider === engineProvider) return p.display;
  }
  if (engineProvider === 'human') return 'You';
  return engineProvider;
}
