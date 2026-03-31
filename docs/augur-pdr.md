# Demo PRD — Augur: Probabilistic Macro Risk Terminal

> **Augur** /ˈɔːɡər/ — from Latin *augur*: one who interprets omens, a diviner, a prophet.
> An augur reads signs and speaks truth before the outcome is known.

---

## 1. Concept & Vision

**Augur** is a probabilistic macro risk terminal that replaces the PM's mental model of "what if I'm wrong" with a structured, multi-agent debate — followed by a deterministic simulation of what that uncertainty actually costs the portfolio.

The experience starts with a single macro hypothesis ("PPI underwhelms"), not a dashboard. The user types their view. Augur shows them the range of outcomes their view implies, weighted by competing worldviews, translated into CVaR and Monte Carlo distributions.

This is not a Bloomberg killer. It is the tool a macro PM opens when they wake up at 3am wondering if they're wrong about the trade.

---

## 2. Product Name

**Primary: Augur** (aw-gur)
> Latin *augur* — one who divines by reading signs. Prophet. Forecaster.
> Hook: *"The PM who argues with Augur never gets blindsided alone."*

**Secondary candidates:**
- **Autonomic** — the system runs portfolio risk self-governance, no human in the loop
- **Aucent** — [AU] + [cent, as in center/decision/century] — audio-homonym with "occur"
- **Aulys** — [AU] + [ulysses, as in the journey through uncertainty] — proprietary, ownable

---

## 3. Target User — Ideal Customer Profile (ICP)

### Primary: Multi-Asset Macro PM at a Hedge Fund
- Manages $50M–$2B AUM
- Runs gross exposure 100–300% across asset classes (rates, equity, FX, credit, commodities)
- Thinks in scenario distributions, not point estimates
- Currently runs "what if" in a spreadsheet or in their head
- Pain: being the only risk check on their own thesis

### Secondary: CIO at a Family Office
- Manages generational wealth across equity, fixed income, alternatives
- Less technical, wants to understand tail risk in plain terms
- Pain: trusting a single analyst's view; no systematic way to stress-test the portfolio

### Tertiary: Macro Research Analyst
- Produces the scenario analysis the PM uses
- Pain: scenario models take days to build; wants faster turnaround

---

## 4. The Three-Panel UX

### Panel 1 — Macro Hypothesis Input
A single text field. No configuration. No dropdown. Just:

> *"What macro event are you stress-testing?"*

Examples:
- PPI report comes in underwhelming
- Fed holds rates higher for longer
- China hard lands
- EUR/USD breaks parity
- Oil spikes on OPEC surprise

User types → hits Enter → council runs in < 3 seconds.

---

### Panel 2 — The Council (Left)

**4 worldview agents, each with:**

| Agent | Worldview | Confidence | Thesis |
|-------|-----------|-----------|--------|
| **Inflation Hawk** | Rates rise, equities fall | 0.30 | Soft PPI = demand death → disinflation → Fed cuts → but wait, it's stagflation |
| **Growth Bull** | Fed pivots, risk-on | 0.25 | Soft PPI → rate cuts → relief rally in risk assets |
| **Macro Skeptic** | Data is noise | 0.25 | PPI is one print; regime doesn't change |
| **Momentum Agent** | Trend continuation | 0.20 | Already priced in; markets forward-discount |

Each agent card shows:
- Agent name + confidence weight (animated bar)
- One-line thesis
- Expandable reasoning trace ("Because PPI < consensus means...")
- Historical accuracy score (shown in expert mode)

**The critical UX moment:** User sees disagreement. They realize their view isn't unanimous. Augur has done something no dashboard does — it *challenged the user*.

---

### Panel 3 — Portfolio Impact (Right)

**One number to rule them all: CVaR 95%**

Below it:
- Max Drawdown (worst case)
- Expected Return (probability-weighted median)
- Scenario Breakdown (horizontal bar chart):
  - Mild slowdown (45%): -5% portfolio
  - Recession (25%): -14% portfolio
  - No change (20%): -1% portfolio
  - Relief rally (10%): +4% portfolio

---

### Panel 4 — Agent Trade Simulation (Collapsed by Default)

For technical users or when the buyer asks "but can it trade?":

```
Agent: LiquidityAvoider
  → EXITS BTC on Day 3 (jump detected)
  → Reduces equity exposure by 40% on Day 5

Agent: TrendFollower
  → Holds core position, trims 20% on regime shift signal

Agent: MeanReversion
  → Stays FLAT — vol regime guard triggered

Monte Carlo (10,000 paths, 30-day horizon):
  [Fan chart — probability cone of portfolio value]
  Median outcome: -2.1%
  5th percentile: -14.1%
  95th percentile: +4.3%
```

---

## 5. Core Risk Components

### 5.1 Council Worldview Engine
- **LLM-free default worldviews**: 4 pre-configured agents with fixed priors and scenario mappings
- **LLM-powered debate mode** (Phase 2): Ollama nemotron-3-super agent generates novel theses per scenario
- **Confidence calibration**: Historical accuracy weights computed from backtests
- **Bayesian update**: After scenario resolves, agent confidence weights update based on outcome

### 5.2 Statistics Pipeline (from esm-sim)
- Log return computation
- 20-day rolling volatility with regime classification (low/high)
- SMA overlays (20d, 50d)
- Jump detection via z-score
- Regime-aware signal processing

### 5.3 Simulation Engine (from esm-sim)
- Chronological stepping through enriched market data
- Shock injection: price_drop, vol_spike, liquidation events on arbitrary dates
- Per-agent trade log with PnL attribution
- Max drawdown and CVaR computation

### 5.4 Monte Carlo Module
- 10,000 paths × configurable horizon (default 30 days)
- Fan chart visualization (probability cone)
- CVaR 95% and CVaR 99% outputs
- Regime persistence assumption (high vol stays high vol with probability p)

### 5.5 Portfolio Schema
- Multi-asset: equity, fixed income, FX, commodities, crypto
- Gross/net exposure display
- Concentration limits with alert thresholds
- Liquidity classification (liquid, semi-liquid, illiquid)

---

## 6. Demo Flow

### The 5-Minute Demo Script

**0:00 — Hook**
> "What's the macro trade you've been thinking about most? Type it in."

User types: `PPI underwhelming`

**0:30 — Council Appears**
4 agent cards animate in sequentially with confidence bars and one-line theses.
> "Three of four agents see downside risk here. One thinks it's already priced in."

**1:30 — Portfolio Impact**
CVaR 95% appears with a single pulse. Scenario bars draw left to right.
> "Under the aggregated view, your portfolio has a 25% chance of losing more than 13%. This is your worst 5% of outcomes."

**2:30 — The Tail**
Click the CVaR bar → expands to show which position is driving the tail.
> "It's your BTC and EM equity exposure that's creating this tail. Your rates hedges aren't offsetting the correlation."

**3:00 — The Simulation**
Expand Panel 4.
> "Here's how each agent archetype would actually navigate this scenario. LiquidityAvoider exits BTC before the drop. TrendFollower trims but holds. MeanReversion sits it out entirely."

**3:30 — Monte Carlo Fan Chart**
Fan chart animates in.
> "We ran 10,000 simulated paths over 30 days. This is your probability cone. The fat tail is real — but the median is manageable."

**4:00 — Follow-up**
> "What if you're wrong and PPI comes in hot? Ask me."

User types: `PPI comes in strong`
Council reweights in real-time. Portfolio impact updates. The tool is now in conversation mode.

**4:30 — Close**
> "This is what Augur does. It stress-tests your thesis before the market does it for you."

---

## 7. What NOT to Build for the Demo

| Excluded | Why |
|----------|-----|
| Historical backtester UI | Everyone has this. Not differentiated. |
| Long list of configurable agents | Cognitive load before value. |
| Parameter configuration panel | User should see value in <3 seconds of hitting Enter. |
| Live trade execution in demo | Simulation only. Execution is a follow-on conversation. |
| Multi-portfolio upload | Single portfolio context only for demo. |
| Mobile/tablet UI | Desktop only for demo. |

---

## 8. Build Order

### Phase 1 (Demo — 3 weeks)
- [ ] Static council: 4 hardcoded worldview agents with confidence weights
- [ ] Single portfolio context (BTC + ETH default from esm-sim)
- [ ] Three-panel UI (input → council → impact)
- [ ] CVaR and scenario bar chart
- [ ] Deterministic simulation engine wired to council output
- [ ] Shock injection: price_drop scenario mapped to simulation
- [ ] Fan chart (Monte Carlo, 1,000 paths)

### Phase 2 (Conversation — 4 weeks)
- [ ] Ollama LLM council: agents generate novel theses per user query
- [ ] Debate protocol: agents critique each other's theses
- [ ] Bayesian confidence update after scenario outcomes
- [ ] Multi-asset portfolio support (extend schema)
- [ ] Historical accuracy scoring per agent

### Phase 3 (Productization — 6 weeks)
- [ ] User-defined portfolios (upload or connect via API)
- [ ] Multi-scenario simultaneous run ("run all scenarios I care about")
- [ ] Exportable scenario reports (PDF, one-pager)
- [ ] Alerting: notify when scenario probability crosses threshold
- [ ] Slack/email integration for daily risk digest

---

## 9. Success Metrics for Demo

| Metric | Target |
|--------|--------|
| Time from user input → CVaR display | < 3 seconds |
| User asks a follow-up question | > 60% of demos |
| User mentions CVaR or scenario in follow-up | > 40% of demos |
| Demo → scheduling a technical deep-dive | > 30% of demos |
| Agent trade simulation expands (power user) | > 20% of demos |

---

## 10. Technical Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js + Tailwind CSS (deploy to Vercel) |
| State management | Zustand |
| Backend / simulation | Python + pandas + numpy |
| LLM (Phase 2) | Ollama + nemotron-3-super |
| Data | Yahoo Finance v8 JSON API (no API key) |
| Deployment | Docker container for Python simulation layer |
| Cache | SQLite for simulation results |

---

## 11. Open Questions

1. **Pricing model**: Per-query (like an AI tool) or seat-based (like Bloomberg)?
2. **Multi-user**: PM + analyst both in the same session, or separate workspaces?
3. **Data freshness**: Real-time data for demo vs. delayed acceptable?
4. **LLM vs. rule-based council**: YC partner recommendation: rule-based for demo, LLM for product. Agree?

---

*PRD Version 1.0 — Demo Ready — March 31, 2026*
