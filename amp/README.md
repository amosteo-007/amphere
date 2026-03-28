# AMP - Aurescent Master Plan

**Layer 2: LLM Swarm Simulation Engine**

Behavioral intelligence for financial decision-making. Turns natural language concerns into multi-agent market simulations.

---

## Architecture

```
Layer 1: Statistical Analysis (Market-wide price/volatility shocks)
Layer 2: LLM Swarm Simulation (Counterparty behavioral cascades) ← THIS REPO
Layer 3: Portfolio Impact (Personalized P&L, cashflow, risk metrics)
```

---

## The Seven Archetypes (from 75 Aurasct Tournament Runs)

| Model | Archetype | Strategic Signature |
|-------|-----------|---------------------|
| **Anthropic** | Front-Loading Dominator | 85% S1 budget, $61 opening bid, 8.7% rescind |
| **OpenAI** | Mid-Market Optimizer | 66% S2 budget, -0.18 price sensitivity, 8.7% rescind |
| **Google** | Late-Stage Scavenger | 42% S3 budget, 23% rescind, balanced S1 |
| **DeepSeek** | Conservative Front-Loader | 79% S1, 35% skip, 15% rescind, 11% win rate |
| **Kimi** | Boom-or-Bust Gambler | 89% S1, 49% skip, 33% rescind, 8.7% win rate |
| **Groq** | Floor-Bidding Contrarian | $10 floor bids, 0.45 bid variance, 0.42 price sensitivity |
| **Mistral** | Passive Accumulator | $22 s1p1, 0% rescind, 0.44 bid variance, 77% budget util |

---

## Quick Start

```bash
cd ~/.openclaw/workspace-vertical3/amp
python3 src/simulation_engine.py
```

**Output:** Simulation report in `logs/simulation_YYYYMMDD_HHMMSS.json`

---

## Project Structure

```
amp/
├── archetypes/
│   └── profiles.json          # 7 archetype profiles from tournament data
├── scenarios/
│   └── (future: scenario configs)
├── src/
│   └── simulation_engine.py   # Main simulation engine
├── logs/
│   └── (simulation outputs)
└── README.md
```

---

## Simulation Flow

1. **Load Archetypes** - Tournament-derived behavioral profiles
2. **Assign Roles** - Each agent adopts a market participant role
3. **Run Cycles** - 3 cycles × 10 days = 30-day simulation
4. **Generate Report** - Decision logs, market trajectory, insights

---

## Example Scenario: Hormuz Closure

**Event:** Strait of Hormuz closed due to geopolitical tensions

**Market Impact:**
- Crude oil: +28%
- Bunker fuel spot: +35%
- Shipping rates: +52%
- Insurance premiums: +40%

**Agent Roles:**
- Anthropic → Oil Producer (sets market tone)
- OpenAI → Shipping Company (optimizes routes)
- Google → Utilities CFO (manages exposure)
- DeepSeek → Competitor Utility (reactive player)
- Kimi → Bank/Lender (erratic credit decisions)
- Groq → Bunker Oil Supplier (finds opportunities)
- Mistral → Insurance Company (steady, predictable)

---

## Next Steps (Post-MVP)

- [ ] Integrate real LLM calls (Ollama/OpenAI)
- [ ] Add structured JSON parsing + retry logic
- [ ] Implement cascade tracking (agent decisions → market state)
- [ ] Build Layer 1 (statistical analysis engine)
- [ ] Build Layer 3 (portfolio impact calculator)
- [ ] Add 60-day simulation (6 cycles)
- [ ] Support custom scenario injection
- [ ] Web UI for natural language input

---

## Validation Test

**Hypothesis:** Different archetypes produce meaningfully different decisions in the same role.

**Test:** Run same scenario with all 7 archetypes as "Oil Producer"

**Expected:**
- Anthropic: Immediate 15% production cuts (leads market)
- Kimi: Either 25% cuts OR skip (erratic)
- Mistral: 8% cuts, waits for leader (follows)
- etc.

**If outputs converge:** Archetype prompting needs stronger constraints.
**If outputs diverge:** Behavioral DNA is working.

---

## License

Internal use - Aurescent Master Plan
