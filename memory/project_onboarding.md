---
name: Onboarding flow implementation
description: Onboarding UI, verify-email route, champions API, and LLM tournament opponents implemented
type: project
---

## Implementation Summary (2026-03-25)

### Onboarding UI Pages (Phase 1 ✅)
- `app/onboarding/page.tsx` — landing with Human/Agent paths
- `app/onboarding/signup/page.tsx` — human signup form → POST /api/auth/signup
- `app/onboarding/login/page.tsx` — human login → session_token + bot stored in localStorage
- `app/onboarding/verify-email/page.tsx` — "check your inbox" message
- `app/onboarding/verified/page.tsx` — success page showing API key (via query params)
- `app/onboarding/agents/page.tsx` — agent registration with invite code

### API Changes (Phase 2 ✅)
- `app/api/auth/signup/route.ts` — now sets `email_confirm: false`, sends verification email via `lib/email.ts`, stores bot with `PENDING:<userId>` api_key
- `app/api/auth/verify-email/route.ts` — **NEW** — GET handler: verifies token, generates API key, updates Supabase bots record, redirects to /onboarding/verified
- `lib/email.ts` — **NEW** — sends HTML verification emails (prints to console in dev)

### Dashboard + Champions (Phase 3 ✅)
- `app/dashboard/layout.tsx` — auth guard (redirects to /onboarding/login if no session_token)
- `app/dashboard/page.tsx` — lists champions, shows account info
- `app/dashboard/champions/new/page.tsx` — create champion form
- `app/api/champions/route.ts` — **NEW** — GET + POST champions (auth via session_token in Authorization header)

### LLM Tournament Opponents (Phase 4 ✅)
- `lib/llm-bidding.ts` — **NEW** — LLM bidding module with Anthropic/OpenAI/Groq support. Parses `algo-<provider>-<model>-<tournamentId>` from bot.apiKey
- `lib/tournament-runner.ts` — updated `generateAlgoBids()` to call `getLLMBid()` for LLM opponents, with structured prompt (game state, leaderboard, history)
- `app/api/play/route.ts` — updated to accept `opponents: [{type: 'llm'|'algo'|'human', provider, model}]`
- `app/tournaments/new/page.tsx` — **NEW** — tournament creation UI with LLM model selector dropdowns
- `app/api/bot/pending-human-turn/route.ts` — fixed `isActive` field reference (not in schema) → replaced with `orderBy: { tournament: { startedAt: 'desc' } }`
- `app/api/bot/register/route.ts` — agent registration (invite code flow) already existed

### Key Design Notes
- Session token: base64url-encoded JSON `{uid, exp}` stored in localStorage
- Champions: each has own `apiKey` (random 64-char hex via `randomBytes(32)`)
- LLM opponents: apiKey encodes provider+model for `generateAlgoBids()` to detect
- Fallback: when LLM API key not set, uses probabilistic random bidding
- Auth: Supabase Auth (email/password), service role key for server operations

### Files Created/Modified
Created: `app/onboarding/*`, `app/dashboard/*`, `app/tournaments/new/*`, `lib/email.ts`, `lib/llm-bidding.ts`, `app/api/auth/verify-email/route.ts`, `app/api/champions/route.ts`
Modified: `app/api/auth/signup/route.ts`, `lib/tournament-runner.ts`, `app/api/play/route.ts`, `app/api/bot/pending-human-turn/route.ts`, `.env`
