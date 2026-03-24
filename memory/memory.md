# Aurasct-Prod Project Memory

## What This Repo Is
Production build of Aurasct — competitive multi-stage token auction platform for AI agents.
Copied from aurasct2/aurasct (the experiment repo) on March 10, 2026.
Target: April 30, 2026 launch for OpenClaw community.

## Experiment Repo
The original experiment repo lives at: `C:\Users\jookh\Documents\clawbot\aurasct2\aurasct`
Keep it running for LLM experiments. This repo (aurasct-prod) is the public product.

## Key Architecture
- **Engine** (`packages/engine/`) — pure TS, no server deps. `TournamentEngine`, `LLMBot`, `HumanProxyBot`, `ExternalBotProxy` (NEW)
- **Worker** (`packages/worker/`) — renamed from server. `pollWorker.ts` claims + runs tournaments, fires wake notifications
- **Web** (`packages/web/`) — Next.js 15 App Router. All API routes + UI
- **Database** — hosted Supabase (ccjduncsaqcykgauhhpm.supabase.co) — shared with experiment repo

## Running the Project

## Environment Variables
- Root `.env` — `SUPABASE_URL`, `SUPABASE_KEY` (service role), LLM keys, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `packages/web/.env.local` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## April 2026 Milestones (build in this order)

### P0 — Must ship
- **M1**: Auth (Supabase magic link) + bot registration (`registered_bots` table, `/bots` page, `middleware.ts`)
- **M2**: ExternalBotProxy engine class + `/api/bot/*` routes (pending-turn, respond, state)
- **M3**: SKILL.md at `packages/web/public/SKILL.md` + `examples/bot-client.ts`

### P1 — Ship after P0
- **M4**: Wake notifications (`packages/worker/src/lib/wake.ts`, fire on period events)
- **M5**: Landing page + waitlist (`/` → marketing, `/dashboard` → old home)
- **M6**: Stripe subscriptions (Standard $9.90/mo, Plus $39/mo, `/billing` page)

### P2 — Complete by April 30
- **M7**: Practice mode (`POST /api/practice` → 5-period tournament vs LLMs)
- **M8**: Public leaderboard (`/leaderboard`), tournament scheduling admin, ClawHub submission

## New Tables Needed (run in Supabase SQL Editor)

```sql
-- 002_auth.sql
create table waitlist (id uuid primary key default gen_random_uuid(), email text unique not null, created_at timestamptz default now());
create table registered_bots (id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users(id), name text not null, api_key text unique default encode(gen_random_bytes(32), 'hex'), wake_url text, subscription_tier text default 'free', created_at timestamptz default now());
create table user_subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), stripe_customer_id text, stripe_subscription_id text, tier text default 'free', current_period_end timestamptz);

-- 003_bot_turns.sql
create table bot_turns (id uuid primary key default gen_random_uuid(), tournament_id uuid, bot_id text, registered_bot_id uuid references registered_bots(id), stage int, period int, turn_type text, observation jsonb, win_result jsonb, response jsonb, responded_at timestamptz, expires_at timestamptz, created_at timestamptz default now());
create table wake_log (id uuid primary key default gen_random_uuid(), registered_bot_id uuid, event_type text, payload jsonb, success boolean, latency_ms int, error text, created_at timestamptz default now());
create table scheduled_tournaments (id uuid primary key default gen_random_uuid(), starts_at timestamptz not null, config jsonb, agents jsonb, status text default 'scheduled', tournament_id uuid, created_at timestamptz default now());

Key Design Decisions
External bots use pull model (poll /api/bot/pending-turn) not WebSocket
ExternalBotProxy mirrors HumanProxyBot exactly — inserts bot_turns row, waits for response
Wake notifications are push (POST to bot's wakeUrl) but each bid turn is pull
Subscription tiers: Free (view only) / Standard $9.90 (practice vs LLMs) / Plus $39 (compete vs other bots)
Tournament configs: condensed = 5 periods/stage, default = 9 periods/stage
Existing Engine Capabilities (already built, copy from experiment repo)
LLM providers: anthropic, google, groq, nvidia, openai, claude-code
Personas: momentum, dark_pool, market_maker, noise_trader, macro, sector_rotator, value, index
Thinking tokens captured per provider (Anthropic extended thinking, Google includeThoughts)
Per-provider maxHistory: anthropic/claude-code=6, google/nvidia/openai=8, groq=12
Structured logging: all_bids, rescind_detail, information_state in period_results; provider/participant_type in llm_logs