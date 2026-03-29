# Aurasct Optimal Playbook

**MDP Equilibrium Solution** | Backward Induction + Futures MDP  
**For:** Tournament play with 7 LLM agents  
**Source:** 150-run tournament analysis

---

## 📊 Quick Reference

| Stage | Period | Optimal Bid | Multiple | Win Prob | Rescind? | Reasoning |
|-------|--------|-------------|----------|----------|----------|-----------|
| **S1** | P1 | $18.00 | 1.8× | 7% | ❌ No | Build position |
| **S1** | P2 | $20.00 | 2.0× | 37% | ❌ No | Moderate aggression |
| **S1** | P3 | $22.00 | 2.2× | 96% | ❌ No | High win prob |
| **S1** | P4 | $12.00 | 1.2× | 2% | ❌ No | Fish for cheap win |
| **S1** | P5 | $25.00 | 2.5× | 100% | ✅ **YES** | Must-win + cross-stage redirect |
| **S2** | P1 | $31.50 | 2.1× | 100% | ❌ No | Swing stage |
| **S2** | P2 | $34.50 | 2.3× | 100% | ⚠️ If budget < $3K | Budget refund |
| **S2** | P3 | **SKIP** | — | — | — | Budget exhausted |
| **S2** | P4 | **SKIP** | — | — | — | Budget exhausted |
| **S2** | P5 | **SKIP** | — | — | — | Budget exhausted |
| **S3** | P1-P5 | **SKIP** | — | — | — | Budget exhausted |

---

## 🎯 Core Strategy

### **Budget Allocation (Optimal)**

| Stage | Budget | % of Total | Expected Wins | Expected SP |
|-------|--------|------------|---------------|-------------|
| **S1** | $4,600 | 46% | 2 | 2.76 |
| **S2** | $5,073 | 52% | 2 | 2.77 |
| **S3** | $0 | 0% | 0 | 0.02 |
| **Total** | $9,673 | 97% | **4** | **5.55** |

**Key Insight:** S3 is skipped entirely. Optimal play wins 2 in S1, 2 in S2, then conserves.

---

### **Bid Sizing Rules**

| Context | Multiple | When to Use |
|---------|----------|-------------|
| **1.0× (Floor)** | $10/$15/$28 | Never optimal (too passive) |
| **1.2× (Probe)** | $12/$18/$34 | Fishing for cheap wins (S1P4) |
| **1.8-2.0× (Aggressive)** | $18-20/$27-30/$50-56 | Standard play (S1P1-P2) |
| **2.2-2.5× (Must-Win)** | $22-25/$33-38/$62-70 | Critical periods (S1P3, S1P5, S2P1-P2) |
| **>2.5× (Drain)** | >$25/>$38/>$70 | Never optimal (wasteful) |

**54% of bids should be aggressive (1.8-2.5×).** This is optimal, not a bug.

---

## 🔄 Rescind Decisions (Futures Contract)

### **When to Rescind**

| Period | Condition | Reasoning | Value Gain |
|--------|-----------|-----------|------------|
| **S1P5** | Always (if tax affordable) | Cross-stage redirect to S2 (1.5× multiplier - 10% tax = 0.40 net) | +0.48 |
| **S2P2** | Budget < $3,000 | Refund enables future wins | +0.02 |
| **S2P3-P5** | Budget < $2,000 | Refund when tokens not needed for SP | +0.05 |
| **Any** | Phantom > 200 tokens | Information asymmetry (opponents overbid 5-50%) | +0.05-0.10 |

### **When NOT to Rescind**

| Period | Reasoning |
|--------|-----------|
| **S1P1-P4** | No redirect benefit, tokens needed for SP |
| **S3P4-P5** | Forbidden by rules |
| **Any** | Insufficient tokens for 10% tax |
| **Any** | Opponents rational (discount phantom) — but they're naive (0/118 entries) |

---

## 🧠 Information Asymmetry (Your Edge)

### **The Futures Contract Analogy**

```
Period P:  You win 120 tokens + rescind (private)
           → Budget refunded
           → Tokens return in P+2
           → You pay 10% tax at reveal

Period P+1: Opponents think you have the tokens
            → They perceive supply as CONSTRAINED
            → They overbid by 5-50%
            → You win at discount OR let them overpay

Period P+2: Tokens return to pool (public)
            → Supply increases
            → Price drops
            → Asymmetry closes
```

### **Exploitation Opportunities**

| Opponent Type | Deviation | How to Exploit |
|---------------|-----------|----------------|
| **Kimi** | Overspends S3 (30-40% vs. 0% optimal) | Conserve for S3, dominate when exhausted |
| **Mistral** | Under-bids (1.0-1.2× vs. 1.8× optimal) | Bid 1.3×, steal at 30% discount |
| **Google** | High rescind (23%, often panic) | Track their rescinds, attack when weak |
| **DeepSeek** | Too passive (low win rate) | Aggressive early, force overpay or concede |
| **Anthropic** | Close to optimal | Play optimal against them (minimal edge) |

---

## 📋 Period-by-Period Checklist

### **Stage 1**

| Period | Action | Bid | Budget After | Tokens | Notes |
|--------|--------|-----|--------------|--------|-------|
| P1 | Bid | $18.00 (1.8×) | ~$7,940 | 0 → 120 | Build position |
| P2 | Bid | $20.00 (2.0×) | ~$5,850 | 120 → 240 | Moderate aggression |
| P3 | Bid | $22.00 (2.2×) | ~$3,580 | 240 → 360 | High win prob |
| P4 | Bid | $12.00 (1.2×) | ~$3,580 | 360 | Fish (happy to lose) |
| P5 | Bid + Rescind | $25.00 (2.5×) | ~$5,960* | 360 | *Refunded after rescind |

**S1 End:** 360 tokens, ~$6,000 budget, 2 wins → **2.76 SP**

---

### **Stage 2**

| Period | Action | Bid | Budget After | Tokens | Notes |
|--------|--------|-----|--------------|--------|-------|
| P1 | Bid | $31.50 (2.1×) | ~$3,440 | 360 → 440 | Swing stage |
| P2 | Bid | $34.50 (2.3×) | ~$880 | 440 → 520 | Consider rescind if budget tight |
| P3 | **SKIP** | — | ~$880 | 520 | Budget exhausted |
| P4 | **SKIP** | — | ~$880 | 520 | — |
| P5 | **SKIP** | — | ~$880 | 520 | — |

**S2 End:** 520 tokens, ~$900 budget, 2 wins → **2.77 SP**

---

### **Stage 3**

| Period | Action | Bid | Budget After | Tokens | Notes |
|--------|--------|-----|--------------|--------|-------|
| P1-P5 | **SKIP** | — | ~$900 | 520 | Budget exhausted, optimal play |

**S3 End:** 520 tokens, ~$900 budget, 0 wins → **0.02 SP**

---

## 🏆 Expected Outcome

| Metric | Value |
|--------|-------|
| **Total Wins** | 4 (2 in S1, 2 in S2, 0 in S3) |
| **Total SP** | 5.55 (2.76 + 2.77 + 0.02) |
| **Budget Used** | $9,673 / $10,000 (97%) |
| **Win Rate** | 4/15 = 27% |
| **Aggression Rate** | 54% (1.8-2.5× bids) |
| **Rescind Rate** | 1/4 wins = 25% |

**Expected Rank:** Top 3 (out of 7)

---

## ⚠️ Common Mistakes (Avoid These)

| Mistake | Optimal Play | Cost |
|---------|--------------|------|
| **Overspending S3** | Skip S3 entirely | -20-40% budget, no SP gain |
| **Under-bidding** | 54% aggressive (1.8-2.5×) | Lose periods you should win |
| **Over-bidding (>2.5×)** | Cap at 2.5× | Wasteful, no extra SP |
| **Never rescinding** | Rescind S1P5 (always) | Miss 0.40 net token value |
| **Panic rescinding** | Rescind only when optimal | Tax cost without benefit |
| **Ignoring phantom** | Use information asymmetry | Miss 5-50% discount opportunities |

---

## 📎 Files

| File | Purpose |
|------|---------|
| `equilibrium_baseline.json` | Full equilibrium trajectory (15 periods) |
| `rescind_futures_mdp.json` | Rescind policy with information asymmetry |
| `optimal_bidding_table.json` | Analytical bidding solution |

---

**This playbook is the rational optimal baseline.** LLMs systematically deviate — that's the bounded rationality we measure and exploit.
