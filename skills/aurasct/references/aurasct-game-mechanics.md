# Aurasct Game Mechanics

## Tournament Structure

**3 stages × 5 periods = 15 periods total**

| | Stage 1 | Stage 2 | Stage 3 |
|---|---|---|---|
| Tokens per period | 120 | 80 | 40 |
| Floor price | $10.00 | $15.00 | $28.00 |
| Points multiplier | 1.0× | 1.5× | 3.0× |

---

## Budget

Each bot starts with **$10,000** shared across all stages — no reset between stages.

At floor prices, you can afford roughly **8 wins** across the entire tournament.

---

## Auction Mechanic

Each period is a **Vickrey (second-price) auction**:

- Highest bid wins all tokens for that period
- Winner pays the **second-highest bid** (not their own)
- Solo winner pays the floor price
- Bids below floor are rejected
- Total cost = `clearing_price × tokens_this_period`

---

## Stage Points (SP)

**SP is the final ranking metric.**

After each stage, participants are ranked by **cumulative token count** (tokens held from stage 0 through the current stage):

- 1st place: **3 SP**
- 2nd place: **2 SP**
- 3rd place: **1 SP**

After all 3 stages: **+1 bonus SP** to the participant with the highest total weighted points (tokens × multiplier, summed across all stages).

**Maximum SP: 10**

### Token Carryforward

Tokens won in earlier stages count toward later stage rankings.

**Example:** 120 tokens won in Stage 1 count toward both Stage 1 and Stage 2 rankings. If you win nothing in Stage 2, your Stage 1 tokens still contribute to your Stage 2 rank.

---

## Rescind Mechanic

After winning a period, you decide: **keep** or **rescind**.

### Keep
- Pay full clearing_price × tokens
- Gain actual token holdings

### Rescind
- Full payment is refunded immediately
- **Tax:** `ceil(tokens_available × 10%)` tokens deducted from your holdings **2 periods later** (at public reveal)
- For 2 periods after rescind, only you know — opponents see **phantom holdings** (you appear to still hold the tokens on the leaderboard)
- Phantom holdings do **not** count toward SP — only actual holdings at stage-end determine rank

### Cross-Stage Rescind

Rescinding in S1P5 adds tokens to the S2P2 auction pool. Tax is deducted from S1 holdings at reveal — after S1 SP is already awarded.

### Restrictions

**Rescind is forbidden:**
- In S3P4 and S3P5
- If your current holdings are fewer than the tax amount

---

## Observation Fields

| Field | Type | Description |
|-------|------|-------------|
| `stage` | int | Current stage (0-indexed) |
| `period` | int | Current period within stage (0-indexed) |
| `tokens_available` | float | Tokens up for auction this period |
| `floor_price` | float | Minimum bid price per token |
| `points_per_token` | float | Weighted points multiplier for this stage |
| `remaining_budget` | float | Your remaining budget |
| `sp` | int | Your current Stage Points |
| `weighted_points` | float | Your total weighted token points |
| `tokens_per_stage` | float[] | Your token counts per stage |
| `leaderboard` | array | All bots' public state |
| `history` | array | Past period results (clearing prices, winners) |
| `private_rescind_info` | array | Your private rescind schedule (hidden from others) |

---

## Strategic Considerations

### Budget Allocation
- Early stages: More tokens, lower prices
- Late stages: Fewer tokens, higher prices, higher multipliers
- Conservation is key — 8 wins max at floor prices

### Bidding Strategy
- Vickrey auction encourages honest bidding (you pay second-highest, not your bid)
- Reading `history` reveals opponent behavior patterns
- Phantom holdings create bluffing opportunities

### Rescind Timing
- Use rescind when you overpaid or need budget for later stages
- Phantom period lets you maintain apparent strength while shedding tax burden
- Cross-stage rescind can disrupt opponent expectations

### SP Maximization
- Consistency across stages > single big win
- Bonus SP for highest weighted points rewards late-stage aggression
- Token carryforward means early wins compound
