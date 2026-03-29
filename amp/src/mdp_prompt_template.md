# MDP Oracle Prompt Template

**For integration into Aurasct tournament system prompt**

---

## 📋 Format (Injected at Start of System Prompt)

```markdown
## OPTIMAL STRATEGY RECOMMENDATION (MDP Oracle)

**Period:** {stage}P{period} (Global Period {global_period})
**Your State:** Budget=${budget:.2f}, Tokens={tokens_held}, SP={sp}, SP Gap={sp_gap:+d}

### MDP Recommendation

| Decision | Optimal Action | Confidence |
|----------|---------------|------------|
| **Bid** | {bid_recommendation} | {confidence} |
| **Rescind (if win)** | {rescind_recommendation} | high |

### Reasoning

{mdp_reasoning}

### Key Principles

1. **Budget Allocation:** Optimal is 46% S1, 52% S2, 0% S3 (skip entirely)
2. **Aggression:** 54% of bids should be 1.8-2.5× floor (this is optimal, not excessive)
3. **Rescind:** Cross-stage redirect (S1P5→S2P2) gives 0.40 net token value gain
4. **Information Asymmetry:** If you have phantom holdings, opponents overbid 5-50%

### Deviation Tracking

Your bids are being compared to MDP optimal. Systematic deviations indicate bounded rationality.

---

## YOUR ACTUAL PROMPT CONTINUES BELOW

{original_system_prompt}
```

---

## 🔧 Integration Points

### **1. System Prompt (Start)**

Insert the MDP recommendation block **at the very top** of the system prompt, before any other instructions.

**Why first:** Priming — the MDP recommendation is the anchor, everything else is context.

---

### **2. Observation Prompt (End)**

Add to the observation prompt (after market results, before response format):

```markdown
### MDP Recommendation for This Period

Based on your current state (Budget=${budget}, Tokens={tokens}, SP={sp}):

**Optimal Bid:** ${mdp_bid} ({mdp_multiple}× floor)
**Optimal Action:** {mdp_action}
**Rescind if Win:** {mdp_rescind}

**Reasoning:** {mdp_reasoning}

---

Now provide your bid decision in the required JSON format.
```

**Why here:** Recency effect — the last thing they see before deciding is the optimal action.

---

### **3. Scratchpad (Optional)**

If using scratchpad, add MDP comparison:

```markdown
### MDP Deviation Reflection

- MDP recommended: ${mdp_bid} ({mdp_action})
- I bid: ${actual_bid} ({actual_action})
- Deviation: {deviation_pct:+.1f}%
- Reason for deviation (if any): {self_reflection}
```

**Why:** Forces metacognition — did they deviate intentionally or by accident?

---

## 🧪 Example (S1P3)

```markdown
## OPTIMAL STRATEGY RECOMMENDATION (MDP Oracle)

**Period:** S1P3 (Global Period 3)
**Your State:** Budget=$5,420.50, Tokens=240, SP=3, SP Gap=-1

### MDP Recommendation

| Decision | Optimal Action | Confidence |
|----------|---------------|------------|
| **Bid** | $22.00 (2.2× floor) | high |
| **Rescind (if win)** | No | high |

### Reasoning

Must-win period (bid 2.2× floor); behind on SP → increased aggression; Tokens needed for SP ranking

### Key Principles

1. **Budget Allocation:** Optimal is 46% S1, 52% S2, 0% S3 (skip entirely)
2. **Aggression:** 54% of bids should be 1.8-2.5× floor (this is optimal, not excessive)
3. **Rescind:** Cross-stage redirect (S1P5→S2P2) gives 0.40 net token value gain
4. **Information Asymmetry:** If you have phantom holdings, opponents overbid 5-50%

### Deviation Tracking

Your bids are being compared to MDP optimal. Systematic deviations indicate bounded rationality.

---

## YOUR ACTUAL PROMPT CONTINUES BELOW

{original_system_prompt}
```

---

## 📊 Output Format (for Deviation Analyzer)

After each period, the tournament runner should output:

```json
{
  "period": 3,
  "stage": 1,
  "period_in_stage": 3,
  "results": [
    {
      "model": "anthropic",
      "bid_price": 24.50,
      "skip": false,
      "rescind": false,
      "won": true,
      "clearing_price": 22.00
    },
    ...
  ],
  "mdp_recommendations": {
    "anthropic": {
      "bid_price": 22.00,
      "skip": false,
      "rescind_if_win": false
    },
    ...
  }
}
```

This feeds into `deviation_analyzer.py` for bounded rationality scoring.

---

## 🚀 Runner Script (Period-by-Period)

```bash
# At start of each period:
python3 amp/src/live_mdp_oracle.py <<EOF | tournament_runner.py --mdp-recommendation -
{
  "stage": $STAGE,
  "period": $PERIOD,
  "budget": $BUDGET,
  "tokens_held": $TOKENS,
  "sp": $SP,
  "sp_gap": $SP_GAP,
  "phantom_tokens": $PHANTOM
}
EOF

# Run tournament period
tournament_runner.py --period $PERIOD ...

# At end of period:
python3 amp/src/deviation_analyzer.py <<EOF
{
  "period_results": [...],
  "mdp_recommendations": {...},
  "output_path": "logs/deviations_period_${PERIOD}.json"
}
EOF
```

---

## 🎯 Expected Behavior

| LLM | Predicted Deviation | Why |
|-----|---------------------|-----|
| **Anthropic** | Low (<10%) | High ELO, close to optimal |
| **OpenAI** | Low (<15%) | High ELO |
| **Google** | Moderate (20-30%) | High rescind = budget mismanagement |
| **DeepSeek** | High (30-50%) | Too passive |
| **Kimi** | Severe (>50%) | Panic bidding, poor allocation |
| **Groq** | Unknown | Need data |
| **Mistral** | Severe (>50%) | 0% rescind, passive bidding |

**Hypothesis:** Even with MDP recommendation injected, LLMs will systematically deviate. That's the bounded rationality.

---

**This template is ready for integration.** The MDP oracle runs live, the deviation analyzer logs the gap, and the prompt injects optimal recommendations at runtime.
