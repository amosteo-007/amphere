# AMP Design Log — 2026-03-28

**Session:** Spark + Amos  
**Branch:** AMPb1  
**Status:** Architecture finalized, calibration framework in progress

---

## 🎯 The Vision

**AMP (Aurescent Master Plan)** — Behavioral intelligence for financial decision-making.

Turns natural language concerns into multi-agent market simulations:

```
CFO asks: "What if Hormuz closes for 60 days?"

↓

Layer 1: Statistical Analysis (Market-wide price/volatility shocks)
Layer 2: LLM Swarm Simulation (Counterparty behavioral cascades) ← THIS REPO
Layer 3: Portfolio Impact (Personalized P&L, cashflow, risk metrics)
```

**Differentiation:** Not just "what happens to asset classes" but "how do specific actors behave based on empirically-derived behavioral profiles?"

---

## 🧬 The Seven Archetypes (from 75 Tournament Runs)

| Model | Archetype | Rescind Rate | Strategic Signature |
|-------|-----------|--------------|---------------------|
| **Anthropic** | Front-Loading Dominator | 8.7% | 85% S1 budget, $61 opening bid, low rescind |
| **OpenAI** | Mid-Market Optimizer | 8.7% | 66% S2 budget, -0.18 price sensitivity |
| **Google** | Late-Stage Scavenger | 23.0% | 42% S3 budget, balanced S1, high rescind |
| **DeepSeek** | Conservative Front-Loader | 15.2% | 79% S1, 35% skip, moderate rescind |
| **Kimi** | Boom-or-Bust Gambler | 33.0% | 89% S1, 49% skip, highest rescind, 8.7% win rate |
| **Groq** | Floor-Bidding Contrarian | ? | $10 floor bids, 0.45 bid variance |
| **Mistral** | Passive Accumulator | 0.0% | $22 s1p1, zero rescind, 77% budget util |

**Source:** 75 Aurasct tournament runs across 7 models, 3 phases.

---

## 🏗️ Architecture Evolution

### **Initial Design: Multi-Agent (7 LLM Calls)**

```
Each agent = independent LLM call
Pros: Behavioral diversity, conflict modeling
Cons: Non-reproducible, costly, overfitting to extremes
```

### **Revised Design: Single LLM, Regression-Based**

```
Calibration: 70-210 LLM calls (one-time)
  ↓
Fit behavioral regression per archetype
  ↓
Simulation: Deterministic functions (free, reproducible)
  ↓
Optional: Monte Carlo for uncertainty bands
```

**Why:** Reproducibility + statistical rigor + lower ongoing cost.

---

## 📊 Calibration Framework

### **The Problem**

Raw LLM outputs vary even with temp=0:
- Prompt phrasing sensitivity
- Context noise
- Model drift over time

**Result:** Can't run counterfactuals if baseline isn't stable.

### **The Solution**

**Phase 1: Tournament Data → Baseline Coefficients (FREE)**
```
Extract per-model metrics:
- s1p1_bid_avg → assertiveness
- budget_s1_pct → risk_tolerance
- rescind_rate → adaptability/consistency
- skip_rate → selectivity
- win_rate → competitive_effectiveness

Output: Baseline behavioral coefficients (no LLM calls)
```

**Phase 2: Calibration Scenarios → Refined Coefficients (~$0.20)**
```
Generate 10-20 diverse scenarios per archetype:
- Vary event type, severity, role, market state
- Run LLM (temp=0, fixed seed)
- Fit regression: decision = f(archetype_traits, scenario_params)

Output: Refined coefficients with R², std_error
```

**Phase 3: Validation → Ship or Iterate**
```
Hold out 5 scenarios (not used in calibration)
Predict decisions using regression model
Compare to actual LLM output

If R² > 0.7 → Ship ✅
If R² < 0.7 → Add 10 more scenarios, re-fit
```

**Phase 4: Deploy → Unlimited Reproducible Simulations**
```
Any new scenario → regression(coefficients, scenario_params)
$0 marginal cost, fully reproducible
Optional: Monte Carlo for uncertainty bands
```

---

## 🧠 Strategic Sophistication (Critical Insight)

### **The Rescind Reality Check**

| Archetype | Rescind Rate | How They Use It |
|-----------|--------------|-----------------|
| Mistral | 0.0% | Never rescinds — treats as pure loss |
| Anthropic | 8.7% | Rare, surgical — cleanup only |
| OpenAI | 8.7% | Same — conservative |
| DeepSeek | 15.2% | Moderate, reactive |
| Google | 23.0% | Frequent — unclear if strategic |
| Kimi | 33.0% | Most frequent — panic, not strategy |

**Key Finding:** Nobody in the tournament is doing **information warfare** (phantom holdings play).

### **Why Models Can't Execute Information Warfare**

1. **No theory of mind over 2-period horizons**
   - Phantom deception requires 3-step chain: "If I rescind now → opponents see inflated holdings → they overbid → I redeploy in S3"
   - LLMs in single-turn decisions can't execute across periods

2. **Loss aversion baked into RLHF**
   - Winning tokens then voluntarily returning them triggers loss-aversion signal
   - Models trained on human preference data that penalizes "wasteful" actions

3. **Tax framing dominates deception framing**
   - 10% tax is concrete and immediate
   - Phantom benefit is probabilistic and delayed
   - All architectures weigh concrete costs more heavily

### **Implication for AMP**

The archetypes aren't just "different risk profiles" — they're **empirically-observed behavioral limitations**:

```json
{
  "strategic_sophistication": {
    "multi_period_planning": 0.65,
    "information_warfare": 0.20,
    "loss_aversion": 0.30,
    "opponent_modeling": 0.55
  }
}
```

**This is AMP's edge:** We model actual behavior (with blind spots), not optimal behavior.

---

## 📝 Scratchpad Experiment (Open Question)

### **Hypothesis**

Adding a scratchpad (cross-period memory) could enable multi-period reasoning that was previously impossible.

### **Predictions**

| Outcome | Interpretation |
|---------|----------------|
| Rescind rate increases (strategic) | Limitation was memory, not RLHF |
| Rescind rate stays same | Limitation is deeper — loss aversion in weights |
| Only some archetypes benefit | Archetype differences are real, not prompt artifacts |

### **Test Design**

```
Format: 10 tournaments, scratchpad enabled for all agents
Models: Same 7 archetypes
Measure:
- Rescind rate per model (vs. baseline)
- Rescind reasoning (strategic vs. panic)
- S3 budget utilization (did phantom play work?)
- Win rate change (did strategic rescind improve outcomes?)
```

**Status:** Awaiting results from Amos's scratchpad-enabled tournaments.

---

## 📁 Project Structure

```
amp/
├── archetypes/
│   └── profiles.json          # 7 archetype profiles + behavioral models
├── scenarios/
│   └── (future: scenario configs)
├── src/
│   ├── simulation_engine.py   # Main simulation engine (MVP)
│   ├── calibrator.py          # (TODO: Fit regression models)
│   └── parser.py              # (TODO: Parse tournament logs)
├── docs/
│   └── DESIGN_LOG_2026-03-28.md  # This file
├── logs/
│   └── (simulation outputs)
└── README.md
```

---

## ✅ Decisions Made

| Decision | Rationale |
|----------|-----------|
| **Regression-based simulation** (not raw LLM) | Reproducibility, statistical rigor, lower ongoing cost |
| **70-210 calibration calls** (not 700+) | Efficient experimental design, 80% rigor for <5% cost |
| **Strategic sophistication as dimension** | Captures systematic blind spots (e.g., no information warfare) |
| **Tournament data → baseline coefficients** | Free starting point, validate with minimal LLM calls |
| **Single LLM, archetype-constrained** | Simpler, reproducible, still tests core hypothesis |

---

## ❓ Open Questions

1. **Scratchpad impact:** Does cross-period memory enable strategic rescind? (Awaiting data)
2. **Calibration scenarios:** What 10-20 scenarios best cover the behavioral space?
3. **Layer 1 integration:** How do we combine statistical baseline (Layer 1) with behavioral simulation (Layer 2)?
4. **Layer 3 output format:** What's the right abstraction for portfolio impact? (P&L, cashflow, risk metrics?)
5. **Validation benchmark:** What's the minimum R² to ship? (Proposed: 0.7)

---

## 🚀 Next Steps

| Priority | Task | Owner | Est. Effort |
|----------|------|-------|-------------|
| **P0** | Parse tournament JSONL → baseline coefficients | Spark | 2-3 hrs |
| **P0** | Generate 10 calibration scenarios per archetype | Spark | 1-2 hrs |
| **P0** | Run calibration (70 LLM calls, temp=0) | Spark | 30 mins |
| **P0** | Fit regression models, validate R² | Spark | 2-3 hrs |
| **P1** | Refactor simulation engine to use regression | Spark | 3-4 hrs |
| **P1** | Add strategic sophistication metrics | Spark | 1-2 hrs |
| **P1** | Integrate scratchpad tournament results | Amos → Spark | TBD |
| **P2** | Build Layer 1 (statistical baseline) | Spark | 4-6 hrs |
| **P2** | Build Layer 3 (portfolio impact) | Spark | 4-6 hrs |
| **P2** | Add Monte Carlo uncertainty quantification | Spark | 2-3 hrs |

---

## 📎 References

- **Branch:** https://github.com/amosteo-007/amphere/tree/AMPb1
- **Tournament Data:** 75 Aurasct runs (7 models × 3 phases)
- **Docs Source:** https://www.aurasct.xyz/docs (The Laws of Engagement)
- **AMP Repo:** https://github.com/amosteo-007/aurescent-master-plan

---

**Checkpoint:** Architecture finalized. Ready to build calibration framework.
