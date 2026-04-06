# ORCA — Phase PRD
## Geopolitical Shock Navigator: Data Architecture
### Fused Augur + ORCA Design

**Purpose:** Build the data layer for a geopolitical shock navigator that combines Augur's signal taxonomy and regime model with ORCA's causal reasoning and historical analogue infrastructure.

**Storage architecture confirmed:**
- SQLite/Postgres — structured facts, time series, XBRL
- LanceDB — embeddings for articles, filings, analogues, causal narrative blocks
- FalkorDBLite — entity graph, events, causal links, analogue similarity projections

---

## Phase 1: Foundation — Schema + Storage Engines

### 1.1 Infrastructure setup

**Directory structure:**
```
orcadata/
  phase1/
    schema/           ← SQL migration files
    vectors/          ← LanceDB data
    graph/            ← FalkorDBLite data
    seeds/            ← historical seed data
  phase2/
  phase3/
```

**Storage engine initialization:**
- Initialize LanceDB with schema: `article_chunks`, `filing_chunks`, `analogue_summaries`, `causal_chain_blocks`
- Initialize FalkorDBLite with schema: `entity_master`, `event_master`, `event_entity_role`, `causal_link`, `analogue_similarity`
- SQLite database: `orca_facts.db` for `raw_oil_ohlcv_daily`, `market_metric_daily`, `volatility_snapshot`, `raw_news_articles`

### 1.2 Core tables

**SQLite: `orca_facts.db`**

```sql
-- Raw article archive (Spidey output)
CREATE TABLE raw_news_articles (
    article_id    TEXT PRIMARY KEY,
    source        TEXT,
    title         TEXT,
    content       TEXT,
    url           TEXT NOT NULL,
    published_at  DATETIME,
    scraped_at    DATETIME NOT NULL,
    language      TEXT DEFAULT 'en',
    query_used    TEXT,
    sector_id     INT
);

-- Daily OHLCV for oil benchmarks
CREATE TABLE raw_oil_ohlcv_daily (
    instrument_id TEXT NOT NULL,  -- BRENT, WTI
    date          DATE NOT NULL,
    open          REAL,
    high          REAL,
    low           REAL,
    close         REAL,
    volume        REAL,
    adjusted_close REAL,
    PRIMARY KEY (instrument_id, date)
);

-- Daily derived market metrics
CREATE TABLE market_metric_daily (
    instrument_id TEXT NOT NULL,
    date           DATE NOT NULL,
    metric_name    TEXT NOT NULL,  -- daily_return, realized_vol, liquidity_ratio
    value          REAL NOT NULL,
    PRIMARY KEY (instrument_id, date, metric_name)
);

-- Volatility regime snapshots
CREATE TABLE volatility_snapshot (
    instrument_id  TEXT NOT NULL,
    window_end      DATE NOT NULL,
    estimator       TEXT NOT NULL,  -- yang_zhang, close_close, garch
    sigma_annual    REAL NOT NULL,
    percentile_rank REAL,           -- vs 1970-2000 historical range
    regime          TEXT,           -- LOW_VOL, NORMAL_VOL, HIGH_VOL, CRISIS
    z_score         REAL,           -- standard deviations from historical mean
    PRIMARY KEY (instrument_id, window_end, estimator)
);

-- XBRL structured facts from SEC filings
CREATE TABLE raw_sec_filing_facts (
    filing_id     TEXT NOT NULL,
    concept        TEXT NOT NULL,   -- US-GAAP concept id
    value          REAL,
    unit           TEXT,
    context_ref    TEXT,
    period_end     DATE,
    entity_id      TEXT,
    PRIMARY KEY (filing_id, concept, context_ref, unit_ref);
);
```

**FalkorDBLite: Graph schema**

```python
# Entity node
{
    "entity_id": str,          # canonical ID
    "name": str,               # Iran, Saudi Aramco, Chevron
    "aliases": list[str],
    "ticker": str | null,      # CVX, XOM
    "cik": str | null,
    "lei": str | null,
    "entity_type": str,        # NATION, IOC, NOC, REGULATOR, etc.
    "sector": str,             # ENERGY, etc.
    "country": str,            # ISO code
    "tags": list[str]
}

# Event node
{
    "event_id": str,           # canonical event ID
    "title": str,
    "event_type": str,         # EXPROPRIATION, SUPPLY_SHOCK, SANCTIONS, etc.
    "start_date": DATE,
    "end_date": DATE | null,
    "geography": str,          # country/region affected
    "severity": float,         # 0-1 impact scale
    "event_status": str,       # ACTIVE, RESOLVED, ONGOING
    -- Augur signal fields embedded --
    "irreversibility": float,
    "complexity": str,         # TRIVIAL, LOW, MEDIUM, HIGH, IMPOSSIBLE
    "cost_band": str,          # <$10M, $10M-$100M, $100M-$1B, >$1B
    "tier": int,               -- 1-5
    "priority": str,           -- P0-P5
    "restoration_months": int | null,
    -- ORCA fields --
    "analogue_id": str | null,  -- links to analogue_case for causal chain
}

# event_entity_role edge
{
    "event_id": str,
    "entity_id": str,
    "role_type": str,          -- INITIATOR, TARGET, PRODUCER, REGULATOR, IMPACTED
    "description": str         -- "initiated sanctions against Iran"
}

# causal_link edge
{
    "causal_link_id": str,
    "source_event_id": str,
    "target_event_id": str,
    "mechanism": str,          -- SUPPLY_SHIFT, PRICE_SPIKE, REGULATORY, etc.
    "direction": str,          -- UPSTREAM, DOWNSTREAM, LATERAL
    "confidence": float,       -- 0-1
    "strength": float,         -- 0-1 magnitude
    "time_lag_days": int,
    "evidence_source": str,    -- article_id, filing_id, or manual
}

# analogue_similarity edge
{
    "analogue_id_a": str,
    "analogue_id_b": str,
    "similarity_score": float, -- 0-1
    "similarity_method": str,  -- SEMANTIC_VECTOR, CAUSAL_PROFILE, REGIME_MATCH
    "last_computed_at": DATETIME,
}
```

**LanceDB: Embedding schema**

```python
# article_chunks
{
    "chunk_id": str,
    "article_id": str,
    "chunk_text": str,
    "chunk_index": int,
    "embedding": list[float],
    "published_at": datetime,
    "source": str,
    "geography": str,          -- extracted geography tags
    "sector": str,
}

# filing_chunks
{
    "chunk_id": str,
    "filing_id": str,
    "chunk_text": str,
    "chunk_index": int,
    "embedding": list[float],
    "fiscal_period_end": date,
    "entity_id": str,
}

# analogue_summaries
{
    "analogue_id": str,
    "summary_text": str,       -- narrative 5W1H summary
    "embedding": list[float],
    "tags": list[str],         -- shock_type, geography, severity
    "severity": float,
    "duration_days": int,
    "structural_flags": list[str],
    -- restoration outcomes --
    "restoration_cost_actual": float | null,
    "restoration_months_actual": int | null,
    "fully_restored": bool,
}

# causal_chain_blocks
{
    "chain_block_id": str,
    "source_event_id": str,
    "target_event_id": str,
    "narrative_text": str,     -- "Sanctions on Iran reduced oil output by 2.3mb/d"
    "embedding": list[float],
    "mechanism": str,
    "confidence": float,
    "time_lag_days": int,
}
```

### 1.3 Seed data

- [ ] Import 3 historical energy events from Augur into `event_master` + `entity_master`:
  - `iran_oil_shock_2025` — EXPROPRIATION, IMPOSSIBLE, irrev=0.92, Iran as entity
  - `russia_gas_pipeline_2022` — PIPELINE_SHUTDOWN, HIGH, irrev=0.90, Russia + EU as entities
  - `opec_production_cut_2024` — PRODUCTION_CUT, MEDIUM, irrev=0.65, OPEC+ entities
- [ ] Link entities to events via `event_entity_role`
- [ ] Create initial `causal_link` entries for known chains (e.g., sanctions → production cut → price spike)
- [ ] Load historical oil price series (BRENT, WTI) into `raw_oil_ohlcv_daily` for 1970–2025
- [ ] Compute `volatility_snapshot` for all historical windows (Yang-Zhang estimator)
- [ ] Populate `analogue_summaries` for the 3 seed events with known restoration outcomes

### 1.4 Data ingestion adapters (boundary layer)

- [ ] `SpideyOutputAdapter` — writes Spidey's `ExtractedSignal` list to `raw_news_articles` + graph `event_master` + LanceDB `article_chunks`
- [ ] `MarketDataAdapter` — fetches daily OHLCV, computes `market_metric_daily`, writes to SQLite
- [ ] `SecFilingAdapter` — parses XBRL, writes to SQLite `raw_sec_filing_facts`, chunks to LanceDB
- [ ] `EntityCanonicalizer` — resolves free-text target strings to `entity_master` IDs

### 1.5 Acceptance criteria Phase 1

- [ ] All 3 storage engines initialize and accept writes
- [ ] Seed data queryable via each engine's native API
- [ ] Cross-engine query: find event → entity → causal links → downstream events
- [ ] No TTL-based cache_entries used for permanent data

---

## Phase 2: Intelligence — Causal + Analogue Layer

### 2.1 Causal reasoning engine

**Purpose:** Build, traverse, and query causal chains from initiating events to downstream effects.

- [ ] `causal_link` CRUD — write new causal assertions (from Spidey extraction, analyst input, or derived from analogues)
- [ ] Chain traversal query: given an initiating event, what are all downstream effects?
  - `traverse_causal_chain(event_id, direction=DOWNSTREAM, max_hops=5)` → list of `(event, mechanism, time_lag_days, confidence)`
- [ ] Backward traversal: given a downstream effect, what could have caused it?
  - `find_culprit_events(event_id)` → ranked list of initiating events
- [ ] Causal strength aggregation: compute total shock magnitude as weighted sum of causal link strengths along chain
- [ ] Time lag ordering: sort causal chain by `time_lag_days` to produce a cascade timeline

### 2.2 Entity identity resolution

- [ ] `entity_master` CRUD
- [ ] Alias resolution: given "Iran" or "Tehran" or "IRAN" → canonical `entity_id`
- [ ] Entity role queries: find all events where entity is INITIATOR, TARGET, PRODUCER
- [ ] Cross-entity causal links: find events where Entity A → affects → Entity B

### 2.3 Analogue matching

**Analogue similarity computation:**
- [ ] `compute_analogue_similarity(analogue_id_a, analogue_id_b)` — composite score:
  - Semantic similarity: cosine similarity of `analogue_summaries.embedding`
  - Causal profile similarity: Jaccard similarity of causal chain structure
  - Regime match: both events' `volatility_snapshot` percentile ranks within same regime band
  - Formula: `0.4 * semantic + 0.3 * causal + 0.3 * regime`
- [ ] Batch similarity computation: run pairwise similarity for all seed analogues
- [ ] Write results to `analogue_similarity` graph edges

**Analogue retrieval:**
- [ ] `find_similar_analogues(event_or_analogue_id, top_k=5)` → ranked analogue list
- [ ] Filter by: geography, event_type, severity range, regime
- [ ] Return: analogue summary + similarity score + restoration outcome (if resolved)

### 2.4 LanceDB semantic search

- [ ] `search_article_chunks(query_text, top_k=10, geography_filter=None)` → chunk results with article metadata
- [ ] `search_analogue_summaries(query_text, top_k=5)` → analogue summaries ranked by embedding similarity
- [ ] `search_causal_chain_blocks(query_text, top_k=5)` → causal narrative blocks relevant to query

### 2.5 Augur signal taxonomy integration

- [ ] `signals` table from `augur_taxonomy.db` imported as FalkorDBLite node property or SQLite side table
- [ ] Map `event_master.event_type` → Augur `SignalType` enum
- [ ] Map `event_master.complexity` → Augur `Complexity` enum
- [ ] Map `event_master.irreversibility` → Augur `float` (0-1)
- [ ] `get_signals_by_tier(tier)` → list of signal definitions for that tier

### 2.6 Acceptance criteria Phase 2

- [ ] Given an initiating event, traverse full causal chain to terminal effects
- [ ] Given an analogue query ("events similar to Iran expropriation"), retrieve ranked analogues with known restoration outcomes
- [ ] Semantic search over article chunks returns relevant passages
- [ ] Entity resolution: free-text target → canonical entity ID

---

## Phase 3: Synthesis — Restoration Calculus + Agent Integration

### 3.1 Restoration trajectory model

**Purpose:** Replace Augur's static complexity-tier → cost lookup with a data-driven probabilistic restoration model.

**Inputs to restoration trajectory:**
- `initiating_event_id` — the root cause event
- `causal_chain` — list of `(event_id, mechanism, time_lag_days, strength)` from Phase 2 traversal
- `volatility_snapshot` — current sigma z-score and regime
- `analogue_summaries` — historical analogues with known restoration outcomes, weighted by similarity
- `market_metric_daily` — price recovery series from historical analogues

**Model:**
```python
@dataclass
class RestorationTrajectory:
    event_id: str
    expected_months: float           # weighted analogue average
    expected_cost: float              # in USD, analogue-weighted
    confidence_interval_months: (float, float)
    confidence_interval_cost: (float, float)
    probability_restored_by_month: dict[int, float]  # month → P(restored)
    regime_state: RegimeState         # SOLID / LIQUID / GAS
    causal_chain_depth: int
    key_uncertainties: list[str]
```

- [ ] `compute_restoration_trajectory(event_id)` → `RestorationTrajectory`
  - Query causal chain depth and strength
  - Query top-k similar analogues (Phase 2)
  - Weight analogue outcomes by similarity score
  - Compute expected restoration months and cost as weighted mean
  - Compute confidence intervals from outcome variance
  - Build `probability_restored_by_month` curve from analogue recovery time series
- [ ] `determine_regime_state(z_score, causal_chain_depth)` → RegimeState
  - z_score > 2.5 AND causal_chain_depth > 3 → GAS
  - z_score > 1.5 OR causal_chain_depth > 2 → LIQUID
  - else → SOLID
- [ ] `compute_p_restor(trajectory, month)` → float — P(restored by month t)
- [ ] Store trajectory snapshots for tracking restoration progress over time

### 3.2 Agent integration

**Researcher A (quantitative school):**
- [ ] Reads `volatility_snapshot` for sigma regime determination
- [ ] Reads `market_metric_daily` for return series and realized volatility
- [ ] Produces `ProbabilisticState` with market-driven `composite_p_restor`
- [ ] Emits `DivergenceNote` if market signals disagree with graph causal data

**Researcher B (event-driven school):**
- [ ] Reads `event_master` via graph traversal for active causal chains
- [ ] Reads `analogue_summaries` for historical restoration outcomes
- [ ] Produces `ProbabilisticState` with causal-chain-informed `composite_p_restor`
- [ ] Emits `DivergenceNote` if causal depth exceeds historical analogue range

**Conductor synthesis:**
- [ ] Reads both `ProbabilisticState` outputs
- [ ] Applies regime-weighted blend (SOLID: 70A/30B, LIQUID: 50/50, GAS: 30A/70B)
- [ ] Produces 3 outputs:
  - **Output 1:** Restoration Trend Line — time series of `P_restor(t)` from trajectory
  - **Output 2:** Signal Stack — ranked list of events in causal chain by irreversibility + cost
  - **Output 3:** Next State Prediction — regime state + next likely causal event + estimated time lag

### 3.3 Knowledge base adapters (read/write boundaries)

- [ ] `KnowledgeBase.read(namespace, key)` — unified read across all 3 engines
  - `market_indicators` → SQLite `volatility_snapshot`
  - `signal_extractions` → FalkorDBLite `event_master`
  - `historical_analogues` → LanceDB `analogue_summaries` + FalkorDBLite `analogue_similarity`
  - `geopolitical_context` → FalkorDBLite `entity_master`
  - `news_articles` → SQLite `raw_news_articles`
  - `causal_chains` → FalkorDBLite `causal_link`

- [ ] `KnowledgeBase.write(namespace, payload)` — unified write
  - Routes to correct engine based on namespace
  - Spidey output → SQLite `raw_news_articles` + LanceDB `article_chunks` + FalkorDBLite `event_master`
  - Market data → SQLite `market_metric_daily` + `volatility_snapshot`
  - Analyst causal assertion → FalkorDBLite `causal_link`

### 3.4 ORCA–Augur legacy bridge

- [ ] `augur_restoration.sql` restoration physics migrated as SQLite side table with FK to event_master
- [ ] Augur taxonomy signals imported as read-only reference table
- [ ] Legacy `cache_entries` TTL-based KV deprecated for permanent data; retained only for ephemeral live indicators (if needed)

### 3.5 Full pipeline test

- [ ] End-to-end test: query "Is my offshore drilling thesis still valid?" → Conductor output
  - Spidey searches web → article chunks in LanceDB + graph events
  - Researcher A reads volatility snapshot → market regime
  - Researcher B reads causal chains + analogues → restoration trajectory
  - Conductor synthesizes → 3 outputs
- [ ] Verify: analogue retrieval < 500ms for top-5 similarity
- [ ] Verify: causal chain traversal < 200ms for depth-5 chain

### 3.6 Acceptance criteria Phase 3

- [ ] Restoration trajectory computed from causal chain + analogue data + market sigma
- [ ] Agent pipeline end-to-end produces all 3 Conductor outputs
- [ ] KnowledgeBase.read/write unified across all 3 storage engines
- [ ] Phase 1 seed events queryable via all 3 engine APIs
- [ ] No legacy TTL-based cache_entries used for permanent data

---

## Dependency order

```
Phase 1 ──────────────────────────────────────────────────────► Phase 2 ──────────────────────────────────────────────────────► Phase 3
  │                                                                        │                                                                        │
  ├─ Storage engine init                                                   ├─ Causal chain traversal + aggregation                                  ├─ Restoration trajectory model
  ├─ Core tables (SQLite)                                                 ├─ Entity resolution                                                    ├─ Agent A/B integration
  ├─ Graph schema (FalkorDBLite)                                          ├─ Analogue similarity computation                                      ├─ Conductor synthesis
  ├─ LanceDB schema                                                        ├─ Semantic search                                                      ├─ ORCA–Augur legacy bridge
  ├─ Seed data                                                             └─ Signal taxonomy mapping                                              └─ Full pipeline test
  └─ Ingestion adapters
```

---

## Out of scope (future phases)

- SEC XBRL filing ingestion (Phase 1 seeds only, full XBRL parser in future)
- Multi-sector expansion beyond Energy
- Real-time market data feed integration (Polygon, Bloomberg)
- FalkorDBLite cluster mode / distributed graph
- LanceDB ANN index tuning
- User-facing UI / dashboard
