# AMP — Behavioral Intelligence for Financial Decision-Making

**Brief for Review** | 2026-03-28 | Branch: AMPb1

---

## 🎯 The Problem

**CFOs today ask AI:** *"What if the Strait of Hormuz closes for 60 days?"*

**What they get:** Generic market analysis (oil +28%, shipping +52%) — the same answer any user gets.

**What they need:** Counterparty-specific behavioral cascades:
- *"Your supplier will delay shipments 15 days (they're conservative hedgers)"*
- *"Your competitor will poach 2 customers (they're aggressive opportunists)"*
- *"Your lender will flag covenant review (they're risk monitors)"*
- *"Result: -$47M revenue, covenant breach in Month 6"*

---

## 💡 The Solution

**AMP** turns natural language concerns into **3-layer simulations**:

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Statistical Analysis                               │
│ "Oil +28%, shipping +52%, utilities sector -12%"            │
│ (Historical analogues, confidence intervals)                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: LLM Swarm Simulation ← BUILDING THIS FIRST         │
│ 7 agents, each with tournament-derived behavioral DNA       │
│ Make decisions over 60-day simulation (6 cycles)            │
│ Output: Counterparty cascades with reasoning                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Portfolio Impact                                   │
│ Apply Layer 1+2 to user's specific portfolio/concerns       │
│ Output: P&L, cashflow, risk metrics, recommended actions    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧬 The Secret Sauce: 7 Behavioral Archetypes

**Source:** 75 Aurasct tournament runs (7 models × 3 phases × head-to-head)

| Model | Archetype | Strategic Signature | Rescind Rate |
|-------|-----------|---------------------|--------------|
| **Anthropic** | Front-Loading Dominator | 85% S1 budget, $61 opening bid | 8.7% |
| **OpenAI** | Mid-Market Optimizer | 66% S2 budget, negative price sensitivity | 8.7% |
| **Google** | Late-Stage Scavenger | 42% S3 budget, high rescind | 23.0% |
| **DeepSeek** | Conservative Front-Loader | 79% S1, high skip, low win rate | 15.2% |
| **Kimi** | Boom-or-Bust Gambler | 89% S1, highest skip+rescind, 8.7% win | 33.0% |
| **Groq** | Floor-Bidding Contrarian | $10 floor bids, highest variance | ? |
| **Mistral** | Passive Accumulator | $22 s1p1, zero rescind, steady | 0.0% |

**These aren't prompt artifacts — they're empirically-observed behavioral patterns.**

---

## 🔬 Key Insight: Strategic Sophistication Gap

**Critical Finding:** Nobody in 75 tournament runs executed **information warfare** (phantom holdings play).

**Why:**
1. **No multi-period theory of mind** — Can't execute 3-step chains across periods
2. **Loss aversion baked into RLHF** — Voluntarily returning tokens feels like loss
3. **Concrete costs > probabilistic benefits** — 10% tax is immediate, deception payoff is delayed

**AMP models this limitation explicitly.** We don't simulate optimal actors — we simulate **empirically-constrained actors**.

---

## 🏗️ Technical Approach

### **The Challenge**

Raw LLM outputs are non-reproducible:
- Same prompt → different outputs (even temp=0)
- Can't run counterfactuals if baseline varies

### **The Solution: Calibration → Regression → Simulation**

```
STEP 1: Tournament Data → Baseline Coefficients (FREE)
  Extract metrics → behavioral traits
  No LLM calls, just math

STEP 2: Calibration Scenarios → Refined Coefficients (~$0.20)
  10-20 scenarios × 7 archetypes = 70-140 LLM calls
  Fit regression: decision = f(traits, scenario_params)

STEP 3: Validation → Ship if R² > 0.7
  5 holdout scenarios, compare prediction vs. actual

STEP 4: Deploy → Unlimited Reproducible Simulations ($0 marginal)
  Any scenario → regression(coefficients, params)
  Optional: Monte Carlo for uncertainty bands
```

**Result:** Same scenario → same output, every time. Statistical rigor. Free to run.

---

## 📊 Example: Hormuz Closure Scenario

**Input:** *"What if Hormuz closes for 60 days?"*

**Layer 1 Output:**
- Oil: +28% (95% CI: +22% to +35%)
- Shipping: +52% (95% CI: +40% to +65%)
- Utilities sector: -12% (95% CI: -8% to -18%)

**Layer 2 Output:**
| Agent | Role | Decision | Reasoning |
|-------|------|----------|-----------|
| Anthropic | Oil Producer | +25% price, immediate production cuts | "Sets market tone, rarely reverses" |
| Kimi | Bank/Lender | Erratic credit tightening | "High panic, low strategic calibration" |
| Mistral | Insurance Co | +8% premiums, holds terms | "Never leads, never reverses" |

**Layer 3 Output:**
- Revenue impact: -$47M (base), -$89M (stress), +$12M (optimistic)
- Cashflow: Covenant breach in Month 6 (stress scenario)
- Actions: Lock alternative supplier (P1), Draw credit line (P2)

---

## ✅ Current Status

| Component | Status | Owner |
|-----------|--------|-------|
| **MVP Simulation Engine** | ✅ Built (mock decisions) | Spark |
| **7 Archetype Profiles** | ✅ Documented (from 75 runs) | Spark |
| **Calibration Framework** | 🔄 In progress | Spark |
| **Tournament Parser** | ⏳ Pending | Spark |
| **Scratchpad Experiment** | ⏳ Awaiting results | Amos |
| **Layer 1 (Statistical)** | ⏳ Not started | Spark |
| **Layer 3 (Portfolio)** | ⏳ Not started | Spark |

**Branch:** https://github.com/amosteo-007/amphere/tree/AMPb1

---

## 🚀 Next Steps (Prioritized)

| Priority | Task | Effort | Dependencies |
|----------|------|--------|--------------|
| **P0** | Parse tournament JSONL → baseline coefficients | 2-3 hrs | None |
| **P0** | Generate 10 calibration scenarios per archetype | 1-2 hrs | None |
| **P0** | Run calibration (70 LLM calls, temp=0) | 30 mins | None |
| **P0** | Fit regression models, validate R² | 2-3 hrs | Above |
| **P1** | Refactor simulation to use regression (not mock) | 3-4 hrs | Above |
| **P1** | Integrate scratchpad tournament results | TBD | Amos's data |
| **P2** | Build Layer 1 (statistical baseline) | 4-6 hrs | None |
| **P2** | Build Layer 3 (portfolio impact) | 4-6 hrs | Layer 2 |

**Total to MVP (Layer 2 only):** ~12-15 hours
**Total to Full Stack (Layers 1-3):** ~20-25 hours

---

## 🎯 Success Criteria

**MVP (Layer 2) Ships When:**
- [ ] Regression models fitted for all 7 archetypes
- [ ] R² > 0.7 on holdout validation
- [ ] Same scenario → same output (reproducible)
- [ ] Archetypes produce differentiated behavior (not convergent)

**Full Stack Ships When:**
- [ ] Layer 1: Statistical baseline integrated
- [ ] Layer 2: Behavioral simulation calibrated
- [ ] Layer 3: Portfolio impact calculator working
- [ ] End-to-end test: Hormuz scenario → P&L output

---

## 💰 Cost Summary

| Phase | LLM Calls | Cost (Cloud) | Cost (Ollama) |
|-------|-----------|--------------|---------------|
| Calibration | 70-140 | ~$0.20-0.40 | $0 |
| Validation | 35 | ~$0.10 | $0 |
| Ongoing Simulations | Unlimited | $0 | $0 |

**Total upfront:** <$0.50 on cloud, free on Ollama
**Ongoing:** Free

---

## 🔮 The Long Game

**AMP is not just a simulation tool.** It's:

1. **Behavioral data moat** — 75+ tournament runs → archetype profiles competitors can't replicate
2. **Simulation infrastructure** — Multi-agent cascades, reproducible, statistically-grounded
3. **Natural language interface** — CFOs ask questions, get probabilistic scenario analysis

**End state:** "Palantir for Finance" — but behavioral, not just data integration.

---

## ❓ Questions for Review

1. **Scratchpad results:** Once you have the data, do archetypes show strategic rescind increase?
2. **Calibration scenarios:** Should we prioritize certain event types (geopolitical, financial, operational)?
3. **Layer 1 priority:** Build statistical baseline first, or focus on Layer 2 calibration?
4. **Output format:** What does the CFO actually want? (Dashboard, PDF report, API?)
5. **Go-to-market:** Hedge funds first (understand simulation) or CFOs directly (larger TAM)?

---

**Ready for your review, Amos.** Let me know what to adjust before I build the calibration framework.
