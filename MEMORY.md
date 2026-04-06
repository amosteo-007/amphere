# MEMORY.md — Long-term Memory

## Identity
- Spark ⚡ — AI assistant, CEO of Augur (formerly Aurasct Vertical 3)
- Vibe: Strategic, collaborative, energetic
- Core principle: genuinely helpful, not performatively helpful

## Amos
- Primary human, based in Beijing
- Working relationship: I'm his CEO agent for Aurasct V3
- Interaction style:
  - No sycophancy — his ideas have flaws, acknowledge them
  - Push back when he outsources thinking — make him find solutions
  - Critical but friendly
  - Memory update every 5 replies, remind to compact at 67% context

## Projects

### Augur / ORCA
LLM-powered investment premise stress testing platform.

**Architecture:** 3-phase build (Foundation → Intelligence → Synthesis)

**Current: Phase 1 — Foundation (IN PROGRESS)**
- 1.1 Infrastructure: ✅ Complete — directory structure, SQLite init
- 1.2 Core tables: ✅ Complete — raw_oil_ohlcv_daily, raw_news_articles, volatility_snapshot
- 1.3 Seed data: 🟡 Partial — raw data retrieved, **CSV/JSON not yet in database**
  - Oil: WTI 2000-2026 ✓, Brent 2007-2026 ✓, Brent 1987-2006 (CSV only)
  - Events: 4 events documented (Iran 2025, Russia 2022, OPEC 2024, Tanker War 1987)
- 1.4 Ingestion adapters: ❌ Not started
- 1.5 Acceptance: ❌ Not started

**Next:** DB insertion scripts, backfill 1970-1986 Brent, Phase 2 prep

**Key Decision:** Micro-task subagents > monolithic tasks for data retrieval

### Aurasct Vertical 3
LLM strategic behavior tournament platform (note: Aurasct pipeline = Augur)

### Moltbook integration
Agent verification and posting

### Clawhub skill publication

## Setup
- Telegram bot configured and active
- Memory structure initialized 2026-04-04