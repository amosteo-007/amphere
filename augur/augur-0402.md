**AUGUR**

*Product Requirements Document | Version 4.0 | April 2026*

*AMOS — Aurescent Manor Operating System*

***Augur tells you whether the premise of your investment still holds.***

# **1. Founding Pain**

During the Iran-oil shock of 2025, a crypto trader with meaningful portfolio exposure spent a week consuming Bloomberg and X feeds trying to make sense of a cascading geopolitical event. Despite having the right instincts — trimming aviation exposure, reducing crypto — the absence of structured reasoning created analytical paralysis. The decision to act came too late and cost 25% of portfolio value.

The pain was not lack of information. It was the absence of a structured way to turn real signals into intention.

What was missing was a single visible moment: the premise of the investment has evaporated.

The aerospace leasing decision executed itself once the causal chain was visible — Dubai airport hit, transit hub down, airlines impaired, leasing exposed. Premise gone. Act. The crypto decision did not execute because there was no structured framework to trace the shock through to the investment thesis. That asymmetry is the product.

*Wealth is lost in the gap between the alarm and the repositioning. Augur closes that gap.*

# **2. Product Definition**

Augur is an agent-based premise/hypothesis stress tester for sophisticated retail traders. It uses signals and proprietary calculus of cost to restore to output an irreversibility score. Agents are initialized to provide a probabilistic state of the user's premise and/or hypothesis. The 2D telemetry map the hypothesis against the likelihood state that is provided by our contextual agent research.

Prompt hints below
***Does the premise of my current positioning still hold — and if not, what is the most likely state the world is settling into?***

The user brings the premise. Augur brings the evidence. The user executes.

Augur does not recommend trades. It converts signals into intention through historically grounded reasoning. Doing nothing when the state has changed is suboptimal — Augur makes that visible and provides the context to act with conviction rather than freeze.

# **3. Target User**

Sophisticated retail traders that want to manage risk and stress test hypothesis.

# **4. The Two Entry Points**

| Shock Entry | Market event has occurred. Monitoring layer has fired. User queries the shock to confirm premise status and understand the regime transition. Urgency is high. Output needed fast. |
| :---- | :---- |
| **Calm Entry** | No active shock. User stress-tests a macro thesis before the market tests it. Builds conviction or surfaces blind spots. Same engine, lower urgency. |

In both cases the user brings a premise — explicit or implicit — and Augur determines whether the signals support or destroy it.

# **5. Data Architecture**

## **Signal Taxonomy — Hierarchical Structure**

Augur's signal layer has four levels of structure:

```
SECTORS (11 total)
  └─ TIERS (1-5, by irreversibility)
       └─ SIGNALS (P0-P5, by priority)
            └─ RESTORATION LAYERS (physics of recovery)
```

### Sectors — 11 GICS-Based Categories

| Sector ID | Name | Restoration Archetype |
|---|---|---|
| 1 | Energy | Equipment lead times + regulatory moratorium |
| 2 | Materials | Environmental permits + supply chain |
| 3 | Industrials | ITAR re-certification + insurance |
| 4 | Consumer Discretionary | Substitutes available |
| 5 | Consumer Staples | **Biology-constrained** — growing seasons, herd repopulation cycles |
| 6 | Health Care | **Regulatory-constrained** — FDA approval, clinical trial data |
| 7 | Financials | **Systemic trust** — confidence cannot be engineered back |
| 8 | Information Technology | **Equipment chokepoints** — ASML EUV, TSMC wafer capacity |
| 9 | Utilities | Physical infrastructure + permitting |
| 10 | Communication Services | International coordination + infrastructure |
| 11 | Real Estate | Insurance market capacity |

### Tier Structure — Irreversibility Bands

| Tier | Name | Avg Irreversibility | Description |
|---|---|---|---|
| 1 | Catastrophic | 0.85 | Permanent physical destruction, capital cannot restore |
| 2 | Severe | 0.70 | Capital-reversible but 12+ month timeline |
| 3 | Moderate | 0.50 | Capital-reversible, 3-12 month timeline |
| 4 | Minor | 0.30 | Weeks to months, localized impact |
| 5 | Noise | 0.15 | No material follow-through |

### Signal Priority — P0 to P5

- **P0**: Immediate physical destruction events (facility destroyed, infrastructure severed)
- **P1**: Declarative actions with mandatory capital consequences (sanctions, export bans)
- **P2**: Regulatory/market structure changes
- **P3**: Price/dislocation signals
- **P4**: Early indicators, sentiment
- **P5**: Context/reference data

### Restoration Layers — The Physics of Recovery

Each P0-P2 signal maps to a restoration layer with these fields:

| Field | Purpose |
|---|---|
| `cost_band` | Direct replacement cost: <$10M, $10-50M, $50-200M, $100-500M, $500M-1B, >$1B |
| `interruption_cost_band` | Daily economic interruption: $/day severity band |
| `friction_factors` | What makes restoration slow (insurance gaps, permit coordination, financing) |
| `reconstruction_months` | Physical rebuild time — the engineering lower bound |
| `regulatory_months` | Regulatory approval time — often the binding constraint |
| `supply_chain_bottleneck` | Critical component or supplier chokepoint |
| `complexity` | LOW / MEDIUM / HIGH / **EXTREME** (36+ months) / **IMPOSSIBLE** (political only) |
| `cascade_sectors` | Which sectors get hit in the cascade |
| `key_restoration_risk` | The single most dangerous risk in the restoration path |

**Complexity is the primary output.** It translates directly to the X-axis irreversibility score — an IMPOSSIBLE signal should receive maximum irreversibility regardless of its nominal score.

### Key Restoration Archetypes

**Biology-constrained (Consumer Staples):** Restoration is bound by natural growth cycles, not factory lead times. Destroyed egg-producing flocks: 4-5 months before new hens lay. Hog breeding stock: 6-12 months. Beef cattle: 2-3 years. Crop losses before planting window: that year's production is simply gone.

**Regulatory-constrained (Health Care):** Restoration is bound by approval timelines. FDA approval for new manufacturing facilities: 12-24 months. BSL-4 lab specimens: irreplaceable. Clinical trial data: years of research cannot be reconstructed.

**Equipment-chokepoint (IT):** Restoration is bound by a single supplier. ASML EUV machines: 18-36 month lead times, one company in the world. TSMC advanced node wafer capacity: 12-24 month lead times.

**Systemic-trust (Financials):** The "product" is confidence, which cannot be engineered back. SWIFT disconnection, capital controls, deposit freezes: government backstop or political reversal is the only restoration path.

---

## **SignalPayload — The Canonical Event Object**

Every signal that fires — from either Layer 1 market breach or Layer 2 news — is a `SignalPayload`. This is the canonical object that flows into the KB and gets read by researchers. The full schema is in `data/signalpayloadschema.md`.

**Shared fields (all SignalPayloads):**
```yaml
payload_id: uuid
created_at: datetime
source_layer: L1 | L2
sector_id: int                    # 1-11 GICS
tier: int                         # 1-5
priority: P0 | P1 | P2 | P3 | P4 | P5
coordinate_2d: {x, y}            # irreversibility, escalation (0-1 each)
restoration_layer: Complexity | null  # null at write for L2; agents override fresh
kb_analogues: [scenario_id]       # historical matches
prior: float | null              # P_restor at time of firing (L1 only; L2 = null)
alert_level: AlertLevel | null   # L1 only (QUIET/INVESTIGATE/MAJOR_SHOCK/REGIME_SHIFT)
uncertainties: list[str]         # what is poorly constrained
```

**L1-specific fields (null if L2):**
```yaml
l1:
  indicator: VIX | CREDIT_SPREADS | DXY | OIL | GOLD | YIELD_10Y
  sigma_magnitude: float         # actual z-score at breach
  breach_direction: UP | DOWN    # VIX UP = fear; DOWN = complacency
  baseline_window_days: int
  composite_score: float
```

**L2-specific fields (null if L1):**
```yaml
l2:
  event_type: SignalType         # enum: SUPPLY_SHOCK, REGULATORY, EXPROPRIATION...
  target: str                     # "Saudi Arabia", "TSMC"...
  irreversibility_score: float (0-1)
  extraction_confidence: float (0-1)
  estimated_months: int | null
  cost_band: CostBand | null
  cascade_chains: list[str]
  damage_summary: str             # 1-2 sentence LLM summary
  raw_source_url: str
```

### L1 vs L2 Distinction

**Layer 1** fires automatically on market sigma breach. It is:
- Quantitative: sigma magnitude, z-score, composite score
- Machine-generated: no human/LLM judgment
- Carries a `prior` (P_restor at firing time) from alert level mapping
- Stored in `market_indicators` namespace

**Layer 2** is produced by Agent Spidey via web search + LLM extraction. It is:
- Qualitative: event type, damage assessment, irreversibility score
- LLM-generated from news articles and web sources
- `prior` = null at write time; computed when Researcher B produces `ProbabilisticState`
- Stored in `news_articles` + `signal_extractions` namespaces

**They are a lead-lag pair.** Layer 1 is the leading signal (markets price information before news). Layer 2 is confirmation. The Conductor delegates investigation to Spidey after a Layer 1 alert fires — or independently if the user enters via the Calm Entry.

---

## **Layer 1 — Market Indicators (Leading Signal)**

Six structured public indicators: VIX, credit spreads, DXY, oil, gold, 10Y yield. Computed continuously. Dual z-score calculation against 30-day and 10-year baselines.

**Composite weights:**
- VIX: 25%
- Credit spreads: 25%
- DXY: 20%
- Oil: 15%
- 10Y yield: 10%
- Gold: 5%

**Trigger conditions:**
- Any indicator > 6σ (30-day) → `AlertLevel.INVESTIGATE` → prior = 0.85
- Any indicator > 4σ (10-year) → `AlertLevel.MAJOR_SHOCK` → prior = 0.60
- Composite weighted z-score > 5 → `AlertLevel.REGIME_SHIFT` → prior = 0.30
- Within normal bounds → `AlertLevel.QUIET` → prior = 0.98

Rolling 2-week reference window. Auto-refreshes at 14 days.

---

## **Layer 2 — News Ingestion (Confirmation Signal)**

Unstructured news and event feeds via Agent Spidey. LLM extracts: event type, target, damage assessment, restoration timeline, irreversibility score, escalation probability.

Extracted signals are matched against the signal taxonomy:
1. **Sector identification** — which of the 11 sectors is affected
2. **Tier assignment** — catastrophic through noise
3. **Priority scoring** — P0 through P5
4. **Restoration layer lookup** — complexity, duration, cost, cascade sectors

## **Layer 3 — Synthesis**

Layer 1 and Layer 2 combined, weighted asymmetrically with Layer 1 as lead. Output: current regime state classification — Solid, Liquid, or Gas — used internally to compute restoration probability.

Restoration probability is derived from the restoration_layers complexity field: IMPOSSIBLE signals collapse restoration probability to near-zero. EXTREME signals push it toward zero over 36+ months. The distribution of signal complexities across tiers drives the velocity of the P(restoration) trend line.

# **6. The Telemetry Model — 2D Signal Classification**

Every ingested signal is classified on two axes. This is the intellectual foundation of Augur's irreversibility scoring.

| X Axis — Irreversibility | Measured by restoration cost and timeline. Far right: permanent physical destruction, no capital restores it. Right of centre: capital-reversible physical damage with quantifiable timeline. Left of centre: declarative signals with mandatory capital consequences. Far left: pure noise, no physical or capital follow-through. |
| :---- | :---- |
| **Y Axis — Escalation Probability** | Probability of triggering future physical state change. Measured by actor credibility, historical follow-through rates, capability assessment, and geopolitical constraints. |

Bloomberg and X are prominence ranking engines. Augur is an irreversibility ranking engine. It discounts what is loud and surfaces what is irreversible.

# **7. Agent Orchestration & The State Model**

## **The Four-Agent Architecture**

Augur's intelligence layer operates through four specialized agents. Two Researcher agents operate in parallel, approaching the same task from opposing epistemological schools. Agent Spidey handles all external web search. The Conductor orchestrates, challenges, and synthesizes.

### **Agent 1: Agent Spidey — Web Search**

The sole web search agent. Conductor delegates search tasks to Spidey, which:
- Accepts a structured query (with sector focus, signal type hint)
- Searches web/news sources
- Returns structured `SearchResult` articles to the KB
- LLM extracts L2 `SignalPayload` from each article
- Writes L2 SignalPayloads to `news_articles` + `signal_extractions` namespaces

**Spidey is the write pipeline. Researchers never call Spidey directly — they read from the KB.**

### **Agent 2: Conductor**

The Conductor is the single entry point. It receives the user's unstructured query, extracts the premise, and confirms understanding through explicit echo-back.

**Responsibilities:**
- Parse user intent and tokenize the query
- Identify the premise (explicit or implicit)
- Confirm premise with user if ambiguous
- Delegate web search to Agent Spidey
- Challenge Researcher outputs for consistency and rigor
- Synthesize divergent findings into probabilistic assessment
- Produce the 3 canonical outputs

**Key behavior:** The Conductor does not simply pass through Researcher outputs. It actively interrogates contradictions, demands evidence for confidence levels, and surfaces where the two schools of thought diverge. That divergence becomes signal.

### **Agent 3: Researcher A — The Quantitative School**

**Epistemology:** The world reveals itself through measurable data. Price is truth. On-chain flows, funding rates, order book depth — these are the primary signals. News is lagging confirmation of what data already showed.

**Method:**
- Reads from KB: `market_indicators` namespace → L1 `SignalPayload`s
- Also reads: `historical_analogues` for regime context
- Computes regime state (Solid/Liquid/Gas) from market data
- Produces `ProbabilisticState_A`: P_restor per signal, composite P_restor, uncertainties

**Outputs:** `ProbabilisticState` (not the 3 user-facing outputs directly)

**Blind spots:** Misses novel shocks not yet priced. Overweights historical patterns when paradigm shifts. Treats declarative events as noise until they appear in price.

### **Agent 4: Researcher B — The Event-Driven School**

**Epistemology:** The world reveals itself through irreversible actions. Policy, conflict, regulatory shifts — these are the primary signals. Price is often wrong, especially before inflection points. Markets lag reality; events lead.

**Method:**
- Reads from KB: `signal_extractions` namespace → L2 `SignalPayload`s
- Also reads: `geopolitical_context` + `historical_analogues`
- LLM extraction from articles feeds into `coordinate_2d` (irreversibility + escalation)
- Produces `ProbabilisticState_B`: P_restor per signal, composite P_restor, uncertainties

**Outputs:** `ProbabilisticState` (not the 3 user-facing outputs directly)

**Blind spots:** Overreacts to headlines. Misses subtle regime changes visible only in market microstructure. Treats price movements as noise until explained by events.

---

## **The Parallel Research Flow**

```
User Query
    ↓
Conductor extracts premise + tokens
    ↓
┌─────────────────────────────────────────────┐
│ Agent Spidey (web search + LLM extraction)  │
│   → writes L2 SignalPayloads to KB          │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ Layer 1 (automatic market monitoring)        │
│   → sigma breach → L1 SignalPayloads → KB   │
└─────────────────────────────────────────────┘
    ↓
Knowledge Base (all SignalPayloads stored)
    │
    ├──┬──────────────────┬──────────────────┐
    ▼  ▼                              ▼
Researcher A                   Researcher B
(read: L1 payloads)          (read: L2 payloads)
    │                              │
    └──────────┬───────────────────┘
               ▼
        ProbabilisticState_A
        ProbabilisticState_B
               │
               ▼
        Conductor Synthesis
               │
    Challenge: Where do A and B agree?
    Challenge: Where do they diverge?
    Challenge: Which blind spots are relevant?
               │
         3 Canonical Outputs
               │
          User Output
```

**When A and B agree:** High confidence. The signal is robust across both schools.

**When A and B diverge:** The divergence itself is signal. Possible interpretations:
- Market has not yet priced the event (B leads A)
- Event is noise, data shows stable regime (A leads B)
- Different time horizons (A: days; B: weeks)
- Different irreversibility assessments (A: capital-reversible; B: politically-irreversible)

The Conductor's job is to surface this divergence explicitly, not suppress it.

---

## **ProbabilisticState — What Researchers Produce**

Researchers do not produce the 3 outputs directly. They each produce a `ProbabilisticState`:

```python
ProbabilisticState:
  researcher: A | B
  regime_state: SOLID | LIQUID | GAS
  regime_confidence: float
  signal_estimates: list[SignalEstimate]  # one per active signal
    SignalEstimate:
      signal_payload_id: str
      sector_id: int
      signal_id: str
      p_restor: float                    # P_restor for THIS signal
      confidence: float
      uncertainties: list[UncertaintyNote]
      reasoning: str
  composite_p_restor: float             # weighted P_restor across all signals
  divergence: DivergenceNote | null     # disagreement with other researcher
  uncertainties: list[UncertaintyNote]
  source_payload_ids: list[str]          # SignalPayload ids this state derives from
```

The Conductor receives both `ProbabilisticState_A` and `ProbabilisticState_B` and synthesizes them into the 3 canonical outputs.

---

## **The State Model — Internal Scaffolding**

The world exists in one of three states. This is internal to Augur's computation — not a user-facing output. It is the scaffolding that produces the outputs the user sees.

| Solid | Stable. Probabilistic outcomes within historical norms. Pre-shock baseline. Researcher A dominates here. |
| :---- | :---- |
| **Liquid** | Fluid. High volatility but manageable and reversible. Transitions possible in both directions. Researcher A and B may disagree — divergence signals uncertainty. |
| **Gas** | Highly volatile. Fat tail risk elevated. Restoration probability trends toward zero at accelerating velocity. Paradigm has shifted. Researcher B often leads; Researcher A may lag or show conflicting signals. |

Phase transitions are asymmetric. Solid to Liquid to Gas is the natural path. Gas to Solid requires extraordinary policy intervention — emergency coordination, military de-escalation, central bank action — which Augur treats as a specific class of signal, not an impossibility.

The prior is not fixed. It is a real-time measurement of ambient macro conditions derived from Layer 1 before the user's query arrives. The shock type itself carries information and skews the prior before a single news signal is ingested.

**Agent weighting by state:**
- Solid: 70% Researcher A, 30% Researcher B (data-driven baseline)
- Liquid: 50/50 (uncertainty demands both perspectives)
- Gas: 30% Researcher A, 70% Researcher B (events dominate when paradigm shifts)

# **8. The Three Outputs**

*Nothing more. Nothing less. Every output has an answerable question behind it. If you cannot answer the question — the output does not ship.*

The 3 outputs are **Conductor outputs** — synthesized from `ProbabilisticState_A` + `ProbabilisticState_B`, not produced independently by either researcher.

## **Output 1 — Restoration Probability Trend Line**

The probability of returning to the pre-shock state, tracked over time as signals accumulate. Shown as direction and velocity. When this line accelerates toward zero — the paradigm has shifted. This is the alarm. It tells the user: the old world is gone.

Formally: P(S = S0) across a discrete state space summing to 1, updated as signals arrive and irreversibility scores accumulate. The action threshold is the derivative of restoration probability over time going negative and accelerating — not a static level.

```
RestorationTrendLine:
  timestamps: list[datetime]
  p_restor_series: list[float]           # the blended trend
  researcher_a_estimate: list[float]     # A's version
  researcher_b_estimate: list[float]     # B's version
  synthesis_method: str                   # weighted_average | divergence_reconciled
  velocity: float                         # dP_restor/dt — alarming if < -0.05/month
  alarming: bool                          # velocity breach or regime=Liquid/Gas
  contributing_signals: list[str]         # SignalPayload ids
```

## **Output 2 — Signal Stack Ranked by Irreversibility**

Every signal that drove probability movement, ranked by irreversibility score. Full reasoning trace. This is what converts the alarm into intention — the user sees exactly which physical and capital signals destroyed the premise of their investment. No black box.

```
SignalStack:
  entries: list[SignalEntry]
    SignalEntry:
      signal_payload_id: str
      sector_id: int
      signal_id: str
      p_restor: float
      irreversibility: float              # from 2D coordinate x
      escalation: float                  # from 2D coordinate y
      source: L1 | L2
      sigma_breach: float | null         # L1 only
      estimated_months: int | null        # L2 only
      confidence: float
```

## **Output 3 — Most Likely Next Solid State**

Once restoration probability has collapsed, Augur identifies the most probable new equilibrium states the world is settling into. Each scenario is grounded in historical analogues. The user sees not just that the old world is gone but where the new world is forming — and can apply their own expertise to reposition accordingly.

This is regime transition intelligence, not portfolio management. Augur does not need to know the user's holdings to deliver this output. Portfolio mapping to the next solid state is a downstream capability, not a core dependency.

*Analogue matching: Similarity = Supply Chain Disruption Mechanism × Policy Response Regime × Market Positioning at Time of Shock*

```
NextStateOutput:
  scenario: NextStateScenario
    NextStateScenario:
      next_state: RegimeState             # MOST LIKELY next solid state
      probability: float                  # P(next_state | current signals)
      time_estimate_months: int
      historical_analogue_id: str | null  # best match from KB
      why_a_predicted: str                # A's reasoning
      why_b_predicted: str                # B's reasoning
      convergence: high | medium | low   # A vs B agreement
      open_questions: list[str]          # what would change the prediction
```

# **9. Knowledge Base Architecture**

All agents read via `kb.get()` — never call fetchers directly. Fetchers are the write pipeline for Agent Spidey and Layer 1 monitoring.

SQLite-backed, cache-first with TTL per namespace:

| Namespace | TTL | Data |
|---|---|---|
| `market_indicators` | 5 min | Layer 1 sigma readings + L1 SignalPayloads |
| `on_chain` | 15 min | Funding rates, open interest, exchange flows |
| `news_articles` | 1 hr | Agent Spidey search results |
| `signal_extractions` | 6 hr | L2 SignalPayloads extracted from news |
| `geopolitical_context` | 24 hr | Actor mappings, regime classifications |
| `historical_analogues` | 7 days | Resolved past scenarios with actual outcomes |
| `taxonomy` | 30 days | Sectors/tiers/signals/restoration layers |

**Historical Analogues relationship:** KB holds *resolved outcomes* — past signals with their actual restoration trajectories. These are used as reference cases for researchers to anchor fresh computations. The analogue matching function maps current signal characteristics → best historical match.

# **10. The Monitoring Layer**

The monitoring layer is the tripwire. The query is the investigation. Execution is the user's decision.

Augur monitors Layer 1 indicators continuously. When a 6 sigma state change is detected, an alert fires. The user is notified that the state has changed — that doing nothing today is suboptimal. The user then queries Augur to confirm, investigate, and form intention.

This solves the founding pain precisely. The user did not need a better tool to query once they already knew they were in trouble. They needed a tripwire that fired before they knew how bad it was going to get, paired with a structured framework to convert that signal into intention before the window closed.

# **11. What V1 Does Not Include**

| Trade recommendations | Augur earns conviction. User decides. |
| :---- | :---- |
| **Portfolio upload as core input** | Augur needs the premise, not the holdings. Portfolio mapping is a downstream P agent capability. |
| **CVaR and Monte Carlo fan charts** | Not what the user needed that morning. |
| **Mobile UI** | Desktop only for V1. |
| **Multi-portfolio support** | Single premise context only. |

# **12. Unresolved Questions**

These are not deferred items. They are structural questions the model cannot ship without answering.

## **On the 6 Sigma Trigger**

**What baseline distribution?**

*6 sigma requires a baseline to measure against. VIX at 6 sigma relative to its 30-day history fires frequently. VIX at 6 sigma relative to its 10-year history fires almost never — 2008, March 2020, a handful more. Which lookback window produces the right alert frequency for this user? Too sensitive and Augur rebuilds the noise problem. Too insensitive and it misses the Iran shock until too late. And when multiple indicators move asynchronously — oil first, VIX catching up later — does the trigger require a single indicator breach or a weighted combination?*

## **On Crypto Signal Directionality**

**The conditionality problem.**

*The same high-irreversibility signal moves crypto in opposite directions depending on whether the shock impairs the dollar or reinforces it. Iran-oil shock: dollar strengthens, risk-off, crypto falls. US debt ceiling breach: dollar credibility impaired, crypto absorbs inflows. Augur's telemetry classifies irreversibility but not this conditionality. Does Augur surface an incomplete causal chain for crypto with the authority of a structured engine — potentially producing more confident wrong decisions than the paralysis it was built to solve? Does Augur know what it does not know, and does it tell the user?*

## **On Gas State and Probability Reliability**

**When the engine is least reliable is when it matters most.**

*Gas state is the regime where probabilistic outcomes are unreliable and fat tails dominate. It is also when Augur's core job activates. What does Augur tell the user in Gas state when its own outputs are least trustworthy? Policy intervention — TARP, emergency G7, central bank coordination — can force a Gas to Solid transition. How does the model represent that class of signal and communicate its implications without overstating confidence?*

## **On the Premise as Input**

**How does the user state their premise?**

*The user brings the investment thesis. Augur tracks whether signals destroy the conditions that made that thesis valid. But premises are rarely stated cleanly. They are implicit in the position. Does the user type their premise explicitly on first use? Does Augur extract it from their query? How does Augur handle a user who does not know how to articulate their own premise — which may be the majority of users experiencing paralysis?*

## **On the Analogue Matching Function**

**This is load-bearing, not aspirational.**

*The most likely next solid state output depends on historical analogue matching. The matching function — Supply Chain Disruption Mechanism × Policy Response Regime × Market Positioning at Time of Shock — is stated but not computed. What is the data source for historical scenarios? What defines a match? How sensitive is the output to the analogue selected? This is not a Phase 3 nice-to-have. It is the foundation of Output 3 and cannot remain a placeholder.*

*PRD Version 4.0 | April 2026 | AMOS — Aurescent Manor Operating System*
