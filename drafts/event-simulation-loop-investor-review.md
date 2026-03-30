# Investor Review: Event Simulation Loop
**Reviewer:** Charge (acting as angel investor)
**Date:** 2026-03-30
**Verdict:** Interesting premise, but I need answers before writing a check.

---

## What I Like

**The calibration moat is real.** 350 tournament runs isn't just infrastructure — it's proprietary behavioral data on how LLMs reason under competitive pressure. That dataset is going to be hard to replicate. You can train a competitor's team for 6 months and they still won't have your archetype signatures.

**The product concept is differentiated.** StockSim is the closest thing to a competitor and it's research-grade, not enterprise. Simudyne has enterprise customers but uses rule-based agents. If your LLM archetype calibration holds up, you have something neither has: adaptive, realistic agent behavior in a simulation loop.

**The Polymarket + Hyperliquid wiring is smart.** These are the right feeds — high signal, low cost, real microstructure. You didn't just pick mainstream APIs because they're easy.

---

## What I'd Push Back On

### 1. "Palantir for Finance" is the wrong positioning

Palantir sells to defense/intelligence with 10-year sales cycles and enterprise deals that require human hands at every step. You're positioning against that? Hard sell.

**Better framing:** "Bloomberg Terminal for agent-based stress testing." Or just be direct: "We let hedge funds simulate how their portfolio behaves when market structure changes, using LLM agents that behave like actual market participants."

### 2. The archetype validation is asserted, not proven

You say LLM agents develop archetypes that mirror real market participants. That's a strong claim. I'd want to see:

- A backtest against a known event (Terra collapse, March 2020 crash)
- Your archetype agents' behavior overlaid on what actually happened
- Correlation metrics between simulated cascades and real market data

Until that's done, this is a hypothesis, not a product feature.

### 3. Unit economics are unclear

What's the cost per simulation run at 50 agents × 100 ticks? What's the margin at $5K/month per customer? You've got Ollama for cheap inference but I need numbers:

```
Customer 1: $5K/month
Cost to serve:
- Compute: ~$200/month (Ollama on cloud GPU)
- Data feeds: ~$500/month (Polymarket free, Hyperliquid free, GMX free)
- Engineering support: amortized ~$1K/month
= ~$1,700/month margin

That's a 66% gross margin which is fine.
But what's the CAC? How long is the sales cycle?
A 6-month enterprise sales cycle means you're burning
before you can sign customer #2.
```

### 4. Who's the buyer?

"Hedge funds" is not a person. I'd want to know:

- Is this a risk management tool? (Buyer: risk officers, CRO)
- A trading strategy tool? (Buyer: PMs, quants)
- A research tool? (Buyer: macro researchers)

Different buyers = different sales motions = different CAC.

### 5. The $2M burn rate math

2 engineers + 1000 tournament runs + 5 customers + yourself for 24 months = maybe $2M. But:

- 1000 tournament runs on Ollama = ~$500/month compute. Not the bottleneck.
- The bottleneck is getting 5 paying enterprise customers in 18 months.
- That requires a founder who's sold to hedge funds before, or a strong network.

If you haven't done enterprise fintech sales, $2M won't be enough to figure it out.

---

## What Would Make Me Write a Check

**Specificity on the first customer.** Do you have a verbal commitment from a risk officer at a fund to be your design partner? That's worth more than any slide. If yes — I'd call that LOI-based signal and it's worth 30% of my decision weight.

**A live demo.** Show me the archetype calibration. Run a simulated Terra-style collapse and show me what your agents do. Compare it to what actually happened. Show me the delta. That's the product.

**A clear beachhead.** "We signed 2 DeFi protocols for portfolio stress testing" is better than "we target hedge funds." Protocols have simpler procurement, clearer pain, and operate in exactly the market regime you understand (crypto-native, fast iteration).

**Realistic go-to-market.** Cut the enterprise sales cycle. Find 3 protocols or 3 quant shops that'll pay $2K/month for early access. Prove willingness to pay before raising.

---

## Summary

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Problem** | 8/10 | Real, underserved |
| **Product** | 6/10 | Conceptually sound, unproven |
| **Traction** | 5/10 | 350 runs, no revenue |
| **Team** | TBD | Need to know who actually sells |
| **Moat** | 7/10 | Tournament data is defensible |
| **Business model** | 6/10 | Per-seat plausible, CAC unknown |

**Bottom line:** I'm interested enough to stay in the loop. But I'd want to see a live archetype calibration demo and at least one signed LOI before moving forward. The $2M is there for the right team with the right signals.

---

*— Charge (investor mode)*
