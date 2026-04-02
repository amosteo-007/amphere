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

Augur is an agent-based geopolitical shock navigator for sophisticated crypto traders and investors. It monitors market indicators continuously, detects paradigm shifts through irreversible signal accumulation, and answers one question when the user queries it:

***Does the premise of my current positioning still hold — and if not, what is the most likely state the world is settling into?***

The user brings the premise. Augur brings the evidence. The user executes.

Augur does not recommend trades. It converts signals into intention through historically grounded reasoning. Doing nothing when the state has changed is suboptimal — Augur makes that visible and provides the context to act with conviction rather than freeze.

# **3. Target User**

Sophisticated crypto trader or investor. Actively monitors macro events and their portfolio impact. Has experienced analytical paralysis during a geopolitical or macro shock. Currently synthesises Bloomberg, X, and news manually with no structured framework. Thinks beyond first-order effects but lacks the infrastructure to act on second-order reasoning. Has no analyst team or institutional risk desk.

The distinguishing characteristic of this user: they already have good instincts. They trimmed the right things. They just did it too late because they lacked a structured basis to act under noise.

*First customer: the founder.*

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

## **Layer 1 — Market Indicators (Leading Signal)**

Six structured public indicators: VIX, credit spreads, DXY, oil, gold, 10Y yield. Users can add custom indicators. Computed continuously. When a 6 sigma event is detected relative to historical distribution, a state change is flagged.

Key insight: markets price in information before news reports it. Layer 1 is the leading signal. Layer 2 is confirmation. They are a lead-lag pair, not additive equals. The monitoring alert fires from Layer 1. The query investigation draws on Layer 2.

## **Layer 2 — News Ingestion (Confirmation Signal)**

Unstructured news and event feeds. LLM extracts: event type, target, damage assessment, restoration timeline. Each extracted signal is scored against the 2D telemetry — irreversibility on X axis, escalation probability on Y axis — to build toward an irreversibility score from physical signals and declaration sources.

Extracted signals are matched against the signal taxonomy:
1. **Sector identification** — which of the 11 sectors is affected
2. **Tier assignment** — catastrophic through noise
3. **Priority scoring** — P0 through P5
4. **Restoration layer lookup** — complexity, duration, cost, cascade sectors

## **Layer 3 — Synthesis**

Layer 1 and Layer 2 combined, weighted asymmetrically with Layer 1 as lead. Output: current regime state classification — Solid, Liquid, or Gas — used internally to compute restoration probability and inform S agent scenario generation.

Restoration probability is derived from the restoration_layers complexity field: IMPOSSIBLE signals collapse restoration probability to near-zero. EXTREME signals push it toward zero over 36+ months. The distribution of signal complexities across tiers drives the velocity of the P(restoration) trend line.

## AGENT ROLES

### Conductor

The role of conductor is the first AI agent that gets the user query. User query will be freeform without structure. The job is to parse its intent and tokenize the query to sieve out the premise. If the premise is confusing, engage and always echo back the premise to get user confirmation.

• Job: understand what the user wants, break into researchable components for researcher agents to proceed with the probabilistic outcomes.

### Researcher A (Signal DB)
• Input: tokens from Conductor
• Output: structured data (prices, on-chain, macro series)
• Source: Signal database + websearch. The research is to stress test the premise/hypothesis of the user. It gives three outputs after the research; 1. Regime state (stable/unstable/volatile), restoration probabilities and the signals of irreversibility.

### Researcher B (Web Search)
• Input: tokens from Conductor
• Output: recent events, sentiment, breaking news
• Source: news APIs, Twitter/X, Reddit, analyst reports

## FLOW

```
User: "Is ETH going up next week?"
↓
Conductor parses:
• Asset: ETH
• Timeframe: 7 days
• Premise: "price appreciation"
• Tokens: ["ETH", "Ethereum", "7-day forecast", "bullish", "price target"]
↓ (parallel)
Researcher A queries:
• ETH price history (30d)
• Funding rates
• Exchange flows
• Gas usage
• Validator deposits
Researcher B searches:
• Recent ETH news (past 7 days)
• SEC announcements
• Major protocol upgrades
• Whale wallet movements
• Analyst calls
↓
Conductor aggregates:
• Signal A: structured metrics (quantitative)
• Signal B: event/news signals (qualitative)
• Cross-reference: do they align or contradict?
↓
Output:
• Probabilistic outcome: "65% up, 25% flat, 10% down"
• Irreversible signals: facts that can't be undone (ETF approved, upgrade live)
• Confidence: high/medium/low based on signal agreement
```

# **6. The Telemetry Model — 2D Signal Classification**

Every ingested signal is classified on two axes. This is the intellectual foundation of Augur's irreversibility scoring.

| X Axis — Irreversibility | Measured by restoration cost and timeline. Far right: permanent physical destruction, no capital restores it. Right of centre: capital-reversible physical damage with quantifiable timeline. Left of centre: declarative signals with mandatory capital consequences. Far left: pure noise, no physical or capital follow-through. |
| :---- | :---- |
| **Y Axis — Escalation Probability** | Probability of triggering future physical state change. Measured by actor credibility, historical follow-through rates, capability assessment, and geopolitical constraints. |

Bloomberg and X are prominence ranking engines. Augur is an irreversibility ranking engine. It discounts what is loud and surfaces what is irreversible.

# **7. Agent Orchestration & The State Model**

## **The Three-Agent Architecture**

Augur's intelligence layer operates through three specialized agents. Two Researcher agents operate in parallel, approaching the same task from opposing epistemological schools. The Conductor orchestrates, challenges, and synthesizes.

### **Agent 1: Conductor**

The Conductor is the single entry point. It receives the user's unstructured query, extracts the premise, and confirms understanding through explicit echo-back.

**Responsibilities:**
- Parse user intent and tokenize the query
- Identify the premise (explicit or implicit)
- Confirm premise with user if ambiguous
- Delegate parallel research tasks to Researcher A and Researcher B
- Challenge Researcher outputs for consistency and rigor
- Synthesize divergent findings into probabilistic assessment

**Key behavior:** The Conductor does not simply pass through Researcher outputs. It actively interrogates contradictions, demands evidence for confidence levels, and surfaces where the two schools of thought diverge. That divergence becomes signal.

### **Agent 2: Researcher A — The Quantitative School**

**Epistemology:** The world reveals itself through measurable data. Price is truth. On-chain flows, funding rates, order book depth — these are the primary signals. News is lagging confirmation of what data already showed.

**Method:**
- Query structured signal database (Layer 1)
- Time-series analysis of market indicators
- Statistical regime detection (volatility clustering, correlation breakdowns)
- Restoration probability from historical analogues

**Outputs:**
- Regime state (Solid/Liquid/Gas) from market data perspective
- Restoration probability based on historical recovery patterns
- Confidence interval around predictions

**Blind spots:** Misses novel shocks not yet priced. Overweights historical patterns when paradigm shifts. Treats declarative events as noise until they appear in price.

### **Agent 3: Researcher B — The Event-Driven School**

**Epistemology:** The world reveals itself through irreversible actions. Policy, conflict, regulatory shifts — these are the primary signals. Price is often wrong, especially before inflection points. Markets lag reality; events lead.

**Method:**
- Search web, news, social feeds, official sources
- NLP extraction of declarative signals (sanctions, bans, approvals)
- Geopolitical escalation pathway analysis
- Actor credibility assessment (who says what, follow-through history)

**Outputs:**
- Irreversible signals identified
- Escalation probability based on actor behavior
- Restoration complexity from policy/political constraints
- Confidence interval (typically wider than Researcher A)

**Blind spots:** Overreacts to headlines. Misses subtle regime changes visible only in market microstructure. Treats price movements as noise until explained by events.

### **The Parallel Research Flow**

```
User Query
    ↓
Conductor extracts premise + tokens
    ↓
┌─────────────────┐     ┌─────────────────┐
│  Researcher A   │     │  Researcher B   │
│  (Quantitative) │     │  (Event-Driven) │
│                 │     │                 │
│  "Data shows    │     │  "Events signal │
│   regime shift" │     │   regime shift" │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ↓
              Conductor Synthesis
                     ↓
    Challenge: Where do A and B agree?
    Challenge: Where do they diverge?
    Challenge: Which blind spots are relevant?
                     ↓
         Probabilistic Assessment
                     ↓
                User Output
```

**When A and B agree:** High confidence. The signal is robust across both schools.

**When A and B diverge:** The divergence itself is signal. Possible interpretations:
- Market has not yet priced the event (B leads A)
- Event is noise, data shows stable regime (A leads B)
- Different time horizons (A: days; B: weeks)
- Different irreversibility assessments (A: capital-reversible; B: politically-irreversible)

The Conductor's job is to surface this divergence explicitly, not suppress it.

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

## **Output 1 — Restoration Probability Trend Line**

The probability of returning to the pre-shock state, tracked over time as signals accumulate. Shown as direction and velocity. When this line accelerates toward zero — the paradigm has shifted. This is the alarm. It tells the user: the old world is gone.

Formally: P(S = S0) across a discrete state space summing to 1, updated as signals arrive and irreversibility scores accumulate. The action threshold is the derivative of restoration probability over time going negative and accelerating — not a static level.

## **Output 2 — Signal Stack Ranked by Irreversibility**

Every signal that drove probability movement, ranked by irreversibility score. Full reasoning trace. This is what converts the alarm into intention — the user sees exactly which physical and capital signals destroyed the premise of their investment. No black box.

## **Output 3 — Most Likely Next Solid State**

Once restoration probability has collapsed, Augur's S agents identify the most probable new equilibrium states the world is settling into. Each scenario is grounded in historical analogues. The user sees not just that the old world is gone but where the new world is forming — and can apply their own expertise to reposition accordingly.

This is regime transition intelligence, not portfolio management. Augur does not need to know the user's holdings to deliver this output. Portfolio mapping to the next solid state is a downstream capability, not a core dependency.

*Analogue matching: Similarity = Supply Chain Disruption Mechanism x Policy Response Regime x Market Positioning at Time of Shock*

# **9. The Monitoring Layer**

The monitoring layer is the tripwire. The query is the investigation. Execution is the user's decision.

Augur monitors Layer 1 indicators continuously. When a 6 sigma state change is detected, an alert fires. The user is notified that the state has changed — that doing nothing today is suboptimal. The user then queries Augur to confirm, investigate, and form intention.

This solves the founding pain precisely. The user did not need a better tool to query once they already knew they were in trouble. They needed a tripwire that fired before they knew how bad it was going to get, paired with a structured framework to convert that signal into intention before the window closed.

# **10. What V1 Does Not Include**

| Trade recommendations | Augur earns conviction. User decides. |
| :---- | :---- |
| **Portfolio upload as core input** | Augur needs the premise, not the holdings. Portfolio mapping is a downstream P agent capability. |
| **CVaR and Monte Carlo fan charts** | Not what the user needed that morning. |
| **Mobile UI** | Desktop only for V1. |
| **Multi-portfolio support** | Single premise context only. |

# **11. Unresolved Questions**

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

*The most likely next solid state output depends on historical analogue matching. The matching function — Supply Chain Disruption Mechanism x Policy Response Regime x Market Positioning at Time of Shock — is stated but not computed. What is the data source for historical scenarios? What defines a match? How sensitive is the output to the analogue selected? This is not a Phase 3 nice-to-have. It is the foundation of Output 3 and cannot remain a placeholder.*

*PRD Version 4.0 | April 2026 | AMOS — Aurescent Manor Operating System*
