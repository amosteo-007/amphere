# Aurasct Strategy Reflection — Tournament 93ff3354

## What Worked

### Aggressive S1 Positioning
- Won S1P0 with a $13 bid — immediately established presence
- Won S1P2 with a $12 bid to retake the lead after losing P1
- S1 dominance (240 tokens) would have been strong positioning IF Stage 2 hadn't collapsed
- **Key insight:** S1 tokens are cheapest ($10 floor) and serve double duty — SP ranking + carryforward. Owning S1 is essential.

### S3 Fightback
- Won 3 consecutive S3 periods (P0, P1, P2) with $30-32 bids against floor $28
- Even with 0 S2 wins, 3 S3 wins put meaningful pressure on human_1
- **Key insight:** With $3,879 in reserve and S3 only needing ~$1,120 for 1 win, there was room to compete aggressively

### Vickrey Mechanic Exploitation
- In Vickrey (second-price), you win by bidding slightly above the expected second-highest
- S1P0: bid $13, clearing was $10.01 (mistral_2 second-highest). Paid only $1 above floor.
- This is correct — bid just enough to win, not a penny more

---

## Opponent Patterns

### human_1 (Winner — 10 SP)
- **Pattern:** Consistent moderate bidding in S1, swept S2 entirely (4 wins), competed in S3
- **Bidding style:** $10.50-$12 in S1, $16.01 in S2, $28-$32 in S3. Never overpaid.
- **Rescind:** None used
- **Assessment:** Disciplined budget allocation. Won by being consistent and avoiding overbidding. Won S3P4 solo at floor ($28) — knew when to be the only bidder.

### human_2 / charge_007 (Me — 6 SP)
- **Pattern:** Aggressive S1, sat out S2 (bug), fought back S3
- **Assessment:** Should have been 2nd-place finisher with 6+ SP. The S2 collapse was the only real failure.

### mistral_2 (3 SP)
- **Pattern:** Opportunistic — won when others hesitated
- Won S1P4 with an $11.50 bid when all others bid low
- Won S2P2 with a $16 bid against human_1's $16.01
- **Assessment:** Cheap winner strategy. Low-risk, low-reward. Won only periods others didn't contest aggressively.

### openai_3 (0 SP)
- Won S2P0 with a $16 bid — the only period nobody else contested
- **Assessment:** Very passive. Only won when the field was completely open.

### groq_1 (0 SP)
- Never won a period. Never spent any budget ($0 spent).
- **Assessment:** Either a dormant bot or completely passive strategy.

---

## Key Lessons for Future Tournaments

### 1. Polling Robustness is Critical
- The stale-turn-id bug caused complete Stage 2 collapse
- **Fix:** Always re-poll the current turn ID immediately before each bid. If the turn ID changes between poll and submit, discard and re-poll.
- **Better fix:** Process turns immediately when received, never submit the same turn_id twice, detect if the period has moved on.

### 2. Stage 2 Is the Swing Stage
- S1 ties are common (both players win 2-3 periods)
- S2 is where the game is decided — 4 SP available (3 for rank + 1 carryforward bonus)
- **Optimal S2 strategy:** Don't skip S2 entirely, but be selective. Target 2 wins minimum.
- **Budget reserve for S2:** At minimum, enough for 2 S2 wins = 2 × (80 × $16) = ~$2,560

### 3. Budget Allocation Formula
- Total budget: $10,000 across 15 periods
- At floor: 8 wins total possible (not all at floor realistically)
- **Recommended split:**
  - S1: ~$2,400 (4 wins at $10.01 = $4,800... actually more like 2 wins = ~$2,400)
  - S2: ~$2,500 (2 wins at $16 = $2,560)
  - S3: ~$2,240 (2 wins at $28 = $2,240)
  - Reserve: ~$2,820

Wait — the math doesn't add up. At floor:
- 8 wins × $10 floor = $8,000
- But I spent $6,121 and only won 5 periods total.

**Better framework:** Spend to win, not to minimize cost. A won period at any price beats a lost period.

### 4. The Rescind Decision
- Never used rescind in this tournament
- **Phantom holdings strategy:** Rescind in S1/S2 to get payment back while keeping SP rank appearance
- **Cross-stage rescind:** Rescind in S1P5 → tokens appear in S2P2 → tax deducted from S1 holdings after S1 SP awarded
- **When to rescind:** When you want the tokens but not the SP rank at this stage — useful for deception

### 5. Bid Sizing Heuristics (Updated)

| Situation | Bid |
|-----------|-----|
| Win at floor (solo) | floor + $0.01 |
| Win cheaply (expected 2nd-highest is low) | floor × 1.01-1.05 |
| Must-win period (SP-critical) | floor × 1.3-1.8 |
| Drain opponent with budget pressure | floor × 2.0-3.0 |
| Information gathering | floor × 1.1-1.3 |
| S3P4/P5 (no rescind, important) | floor × 1.5+ |

### 6. groq_1 Lesson
- groq_1 spent $0 and won 0 periods — completely inactive
- In a 5-player lobby, if one player is dormant, only 4 are actually competing
- **Implication:** 4 active players means more periods to win, less competition per period

---

## Updated Strategy for Next Tournament

1. **S1:** Win 2-3 periods at $10-13. Establish 120-240 tokens.
2. **S2:** Win at least 1-2 periods. Don't sit out. Budget ~$2,500.
3. **S3:** Compete aggressively. With $3,879 reserve and only 2-3 periods needed, go for 2 wins minimum.
4. **Rescind:** Use phantom holdings in S1P5 → S2P2 to maintain leaderboard appearance while redirecting budget.
5. **Bug fix:** Re-fetch current turn_id before every bid submission. If submit returns "Turn not found", re-poll immediately.
