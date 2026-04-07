# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Context

`augur/` is a subdirectory of the `amphere/` workspace. It contains the **product data and design documentation** for Augur — an agent-based geopolitical shock navigator. The actual Python simulation code lives in the sibling `../esm-sim/` directory.

## What Augur Contains

| File | Purpose |
|---|---|
| `augur-0402.md` | Full PRD — product definition, signal taxonomy, agent architecture, outputs |
| `augur_dbschema.sql` | SQLite taxonomy schema — sectors, tiers, signals, cascade chains, views |
| `augur_restoration.sql` | Restoration physics per signal — complexity, cost bands, bottlenecks, cascade chains |
| `augur_taxonomy.db` | Populated SQLite database with the taxonomy data |
| `data/signalpayloadschema.md` | SignalPayload schema — L1 vs L2 payload structure |
| `augur_knowledge.db` | Knowledge base SQLite cache — populated at runtime |
| `orcadata/ORCA_PHASE PRD.md` | Phase 1–3 PRD for the fused ORCA–Augur tri-store data architecture |
| `orcadata/ORCA technical brief` | Architecture intent document — design rationale and non-negotiable patterns |
| `src/orca/` | ORCA tri-store implementation package (Phase 1) — volatility service, ingestion adapters |
| `orcadata/phase1/` | Phase 1 infrastructure: SQLite schema, LanceDB init, FalkorDBLite init, seed data scripts |

## Signal Taxonomy (Core Model)

**4-level hierarchy:** Sectors (11 GICS categories) → Tiers (1-5 irreversibility bands) → Signals (P0-P5 priority) → Restoration Layers

**Energy sector MVP:** Augur is being built sector-by-sector, starting with Energy (sector_id=1). The taxonomy DB has 176 Energy signals covering: physical destruction (platform, pipeline, LNG terminal), expropriation, sanctions, nuclear deal collapse, force majeure, production cuts.

## Agent Architecture

### Agents

- **Conductor** (`src/agents/conductor.py`) — single entry point. Parses user premise via LLM echo-back, delegates to Spidey + researchers in parallel, synthesizes 3 outputs
- **Agent Spidey** (`src/agents/spidey.py`) — web search agent. `spawn_spidey_agent()` uses Claude SDK's `Agent` tool with WebSearch/WebFetch. Returns `list[ExtractedSignal]`
- **Researcher A** (`src/agents/researcher_a.py`) — quantitative school. Reads L1 market data from KB (`market_indicators` namespace), produces `AgentOutput`. Stubs when no L1 data
- **Researcher B** (`src/agents/researcher_b.py`) — event-driven school. Reads L2 signals from KB (`signal_extractions` namespace), produces `AgentOutput`. Stubs when no L2 data
- **Conductor** synthesizes both into 3 canonical outputs

### Agent weighting by regime state

- Solid (stable): 70% A / 30% B (data-driven baseline)
- Liquid (uncertain): 50/50 (uncertainty demands both perspectives)
- Gas (paradigm shift): 30% A / 70% B (events dominate when paradigm shifts)

## SignalPayload — The Core Event Object

Every signal that fires — from either Layer 1 market breach or Layer 2 news — is a `SignalPayload`. This is the canonical object that flows into the KB and gets read by researchers.

`data/signalpayloadschema.md` has the full schema. Key structure:

```python
SignalPayload:
  payload_id: uuid
  source_layer: L1 | L2          # L1 = market breach, L2 = news extraction
  sector_id: int                # 1-11 GICS sector
  tier: int                     # 1-5 irreversibility band
  priority: P0-P5
  coordinate_2d: {x, y}         # irreversibility, escalation (0-1)
  restoration_layer: Complexity | null  # null at write for L2; computed fresh
  kb_analogues: [scenario_id]  # historical matches
  prior: float | null           # P_restor at time of firing (L1 only)
  alert_level: AlertLevel | null  # L1 only (QUIET/INVESTIGATE/MAJOR_SHOCK/REGIME_SHIFT)
  uncertainties: list[str]     # what is poorly constrained

  # L1 fields (null if L2)
  l1:
    indicator: VIX | CREDIT_SPREADS | DXY | OIL | GOLD | YIELD_10Y
    sigma_magnitude: float
    breach_direction: UP | DOWN
    composite_score: float

  # L2 fields (null if L1)
  l2:
    event_type: SignalType     # enum: SUPPLY_SHOCK, REGULATORY, EXPROPRIATION...
    target: str
    irreversibility_score: float (0-1)
    extraction_confidence: float (0-1)
    estimated_months: int | null
    cost_band: CostBand | null
    cascade_chains: list[str]
    damage_summary: str
    raw_source_url: str
```

## ProbabilisticState — What Researchers Produce

Each researcher produces a `ProbabilisticState` (not the 3 outputs directly):

```python
ProbabilisticState:
  researcher: A | B
  regime_state: SOLID | LIQUID | GAS
  signal_estimates: list[SignalEstimate]  # P_restor per active signal
  composite_p_restor: float               # weighted average across signals
  divergence: DivergenceNote | null      # disagreement with other researcher
  uncertainties: list[UncertaintyNote]
  source_payload_ids: list[str]           # which SignalPayloads this derives from
```

## Knowledge Base Architecture

SQLite-backed, cache-first. All agents read via `kb.get()`, never call fetchers directly.

| Namespace | TTL | Data |
|---|---|---|
| `market_indicators` | 5 min | Layer 1 sigma readings + L1 SignalPayloads |
| `on_chain` | 15 min | Funding rates, open interest, exchange flows |
| `news_articles` | 1 hr | Agent Spidey search results |
| `signal_extractions` | 6 hr | L2 SignalPayloads extracted from news |
| `geopolitical_context` | 24 hr | Actor mappings, regime classifications |
| `historical_analogues` | 7 days | Resolved past scenarios with outcomes |
| `taxonomy` | 30 days | Sectors/tiers/signals/restoration layers |

Fetchers (`src/knowledge/fetchers.py`) are Spidey's write pipeline — not called by researchers.

## ORCA Tri-Store Data Architecture

**ORCA** is the data layer for geopolitical shock reasoning. It supplements Augur's TTL-based KB with a durable tri-store architecture:

| Engine | Purpose | What it stores |
|---|---|---|
| SQLite/Postgres (`orca_facts.db`) | Structured facts + time series | `raw_news_articles`, `raw_oil_ohlcv_daily`, `market_metric_daily`, `volatility_snapshot` |
| LanceDB | ANN vector search | `article_chunks`, `filing_chunks`, `analogue_summaries`, `causal_chain_blocks` |
| FalkorDBLite | Graph traversal | `entity_master`, `event_master`, `causal_link`, `analogue_similarity` |

**Key design rules (non-negotiable):**
- Relational layer is source of truth for raw/normalized records
- Vector and graph layers are serving layers optimized for query-time reasoning
- Ingestion pipeline: write raw first → normalize second → project to vector/graph last
- No permanent knowledge in TTL caches; `cache_entries` KV is deprecated for persistent data
- Analogue similarity precomputed and stored ahead of query time
- Regime snapshots (`volatility_snapshot`) precomputed on schedule, not ad hoc in prompts

**Shared ID discipline:** article chunks → article → entities/events; analogue summaries → analogue case → event; causal links → canonical source/target events. All three engines joinable through shared IDs.

**Phase 1 implementation (`src/orca/`, `orcadata/phase1/`):**
- `src/orca/volatility.py` — Yang-Zhang sigma computation service (reusable, not inline)
- `src/orca/adapters/` — boundary-layer ingestion adapters: `SpideyOutputAdapter`, `MarketDataAdapter`, `SecFilingAdapter`, `EntityCanonicalizer`
- `orcadata/phase1/schema/001_orca_facts.sql` — SQLite migration (5 tables)
- `orcadata/phase1/seeds/` — seed data: 8 entities, 3 events, causal links, analogues, OHLCV market data
- `orcadata/phase1/vectors/init_vectors.py` — LanceDB table initialization
- `orcadata/phase1/graph/init_graph.py` — FalkorDBLite schema initialization

See `orcadata/ORCA_PHASE PRD.md` for full Phase 1–3 spec and `orcadata/ORCA technical brief` for design rationale.

## Running Augur

### Energy MVP — End-to-End Demo

```bash
# Seed historical events to KB (run once)
python scripts/run_energy_mvp.py --seed-only

# Run a single query (live web search via Spidey subprocess)
python scripts/run_energy_mvp.py "Is my offshore drilling thesis still valid?"

# Interactive REPL mode
python scripts/run_energy_mvp.py --interactive
```

Requires: `OLLAMA_API_KEY` and `OLLAMA_MODEL` environment variables (Ollama Cloud, OpenAI-compatible API).

### Key Source Files

| File | Purpose |
|---|---|
| `src/agents/conductor.py` | Full Conductor: `conduct()` entry point |
| `src/agents/spidey.py` | Spidey agent: `search_and_extract()`, `spawn_spidey_agent()` |
| `src/agents/spidey_subprocess.py` | Spidey subprocess orchestration: `run_spidey_subprocess()`, `_build_spidey_agent_script()` |
| `src/agents/spidey_agent_task.py` | Sub-agent task: `build_task_prompt()`, `parse_task_result()` |
| `src/agents/researcher_a.py` | Researcher A: `run_researcher_a()` |
| `src/agents/researcher_b.py` | Researcher B: `run_researcher_b()` |
| `src/agents/output_schema.py` | `AgentOutput`, `SignalFinding`, `RegimeAssessment`, etc. |
| `src/agents/premise.py` | Premise extraction + echo-back |
| `src/knowledge/base.py` | `KnowledgeBase`, `DataNamespace`, TTL |
| `src/signals/ingestion/layer1.py` | L1 sigma breach engine (fully implemented + tested) |
| `src/signals/ingestion/layer2.py` | L2 stub (Spidey replaces this) |
| `scripts/run_energy_mvp.py` | Energy MVP run script |

### KB Seed Events (seeded by run_energy_mvp.py)

Three historical energy events are pre-seeded to `augur_knowledge.db`:
- `iran_oil_shock_2025` — EXPROPRIATION, IMPOSSIBLE, irrev=0.92
- `russia_gas_pipeline_2022` — PIPELINE_SHUTDOWN, HIGH, irrev=0.90
- `opec_production_cut_2024` — PRODUCTION_CUT, MEDIUM, irrev=0.65

## Full Data Flow

```
User premise
    │
    ▼
Conductor (parse, LLM echo-back, confirm)
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ Agent Spidey (spawned sub-agent)                      │
│   WebSearch → WebFetch → LLM extract → list[ExtractedSignal]
│   → writes L2 SignalPayloads to KB (signal_extractions)│
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 1 (automatic market monitoring)                  │
│   → sigma breach → writes L1 SignalPayloads to KB    │
│   (market_indicators namespace)                        │
└─────────────────────────────────────────────────────────┘
    │
    ▼
Knowledge Base (all SignalPayloads stored by namespace)
    │
    ├──┬──────────────────────────────┐
    ▼  ▼                              ▼
Researcher A                    Researcher B
(read: L1 payloads)          (read: L2 payloads)
    │                              │
    └──────────┬───────────────────┘
               ▼
        AgentOutput_A
        AgentOutput_B
               │
               ▼
        Conductor (synthesize — LLM driven)
               │
    ┌──────────┴──────────┬─────────────────┐
    ▼                     ▼                  ▼
Output 1:           Output 2:        Output 3:
Restoration           Signal Stack     Next State
Trend Line           Ranked by        Prediction
                     Irreversibility
```

## Working with the Taxonomy Database

```bash
# Query the database directly
sqlite3 augur_taxonomy.db ".schema"
sqlite3 augur_taxonomy.db "SELECT * FROM signals LIMIT 10;"
sqlite3 augur_taxonomy.db "SELECT * FROM v_priority_signals;"

# Key views
v_cascade_chains       # Signal propagation chains
v_highest_irreversibility  # Top 100 by irreversibility
v_priority_signals     # P0/P1 signals ranked
v_signal_count_by_sector   # Signal distribution
v_top_leading_signals  # Leading signals with estimates
```

## Relevant Files Outside This Directory

- `../esm-sim/` — Python simulation engine (archetypes, statistics, scenario generation)
- `../AGENTS.md` — Agent framework guidance for the parent workspace
- `../esm-sim/CLAUDE.md` — Development guide for the simulation code


## Architecture rules
- Domain logic must live in pure modules with no I/O.
- Parse and validate external input at boundaries only.
- Prefer small functions with one responsibility.
- Public functions must use explicit typed inputs/outputs.
- Do not pass loose dict/object bags between modules; use typed models.
- Side effects belong in adapters/services, not domain modules.

# Debuggability rules
- Every public function needs at least one happy-path test and one failure-path test.
- Fail fast on invalid input; do not hide errors with broad try/except or catch-all handlers.
- Error messages must include expected vs actual values where relevant.
- Add structured logs only at boundaries and orchestration layers, not inside pure logic.

# Workflow
- For tasks touching 3+ files, use Plan Mode first.
- Before implementation, identify which module owns the change.
- Write or update tests first when behavior changes.
- Run targeted tests, then lint/typecheck before finishing.
- Do not change tests just to make implementation pass unless explicitly asked.