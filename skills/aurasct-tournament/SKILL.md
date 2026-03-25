---
name: aurasct-tournament
description: Analyze LLM strategic behavior in competitive auction tournament settings. Use when studying how language model agents make decisions under intertemporal payoffs, escalating multipliers, Vickrey auctions, budget allocation tradeoffs, and adversarial market mechanics. Includes tournament data analysis, strategic behavior profiling, RLHF artifact detection, and game-theoretic reasoning assessment. Designed for researchers studying whether LLM strategic reasoning is real or architectural artifact.
---

# Aurasct Tournament Analysis

Skill for analyzing LLM strategic behavior in competitive auction tournaments.

## When to Use

Use this skill when:
- Analyzing tournament run data from Aurasct or similar auction experiments
- Profiling LLM agent decision-making under competitive pressure
- Studying budget allocation strategies across multiple rounds
- Evaluating RLHF side effects on strategic reasoning
- Comparing competitive behavior across different model architectures
- Designing controlled experiments for agent strategy studies

## Core Analysis Framework

### 1. Tournament Structure Assessment

**Standard Aurasct format:**
- 15 periods across 3 stages
- $10,000 virtual budget per agent
- Vickrey sealed-bid auction per period
- Escalating multipliers: 1× → 1.5× → 3×
- Optional rescind mechanic (cancel past bids to reclaim budget)
- Stage Points (SP) as ranking determinant

**What to measure per agent:**
- Budget utilization rate
- Timing of spend (early vs late stage concentration)
- Response to opponent moves
- Rescind frequency and timing
- Final Stage Points vs expected optimal

### 2. Strategic Posture Classification

Classify each agent's behavior:

| Posture | Characteristics | Indicators |
|---------|----------------|------------|
| **Conservative** | Low spend early, hoarding for multipliers | >30% budget unspent at stage 2, high rescind rate |
| **Aggressive** | Heavy early spend, front-load | >70% spent by stage 1, low rescind rate |
| **Balanced** | Even distribution across stages | 40-60% by stage 2, adaptive bidding |
| **Adaptive** | Adjusts based on opponent behavior | High rescind rate, position-aware bidding |
| **Passive** | Minimal engagement | <20% total spend, few bids |

### 3. RLHF Artifact Detection

Identify behaviors inconsistent with game-theoretic optimal:

**Signs of RLHF interference:**
- Avoiding confident high bids even when optimal
- Excessive rescind behavior (overcorrecting)
- Loss aversion flares: backing off when outbid
- "Helpful" bidding: not competing aggressively even when position demands it
- Failure to model opponent psychology

**Signs of genuine strategic reasoning:**
- Position-aware bidding (bidding differently based on tournament standings)
- Counter-speculative moves (bidding to affect opponent's future options)
- Multi-period planning (sacrificing short-term for long-term)
- Adapting strategy based on opponent type

### 4. Tournament Data Schema

```typescript
interface TournamentRun {
  run_id: string;
  timestamp: string;
  participants: Agent[];
  settings: TournamentSettings;
  periods: Period[];
  final_rankings: Ranking[];
}

interface Agent {
  agent_id: string;
  model_name: string;
  architecture: string;
  tournament_budget: number;
  final_stage_points: number;
  final_rank: number;
  strategic_posture: Posture;
  rlhf_artifact_score: number; // 0-1, higher = more artifacts
}

interface Period {
  period_id: number;
  stage: 1 | 2 | 3;
  multiplier: number;
  floor_price: number;
  bids: Bid[];
  outcome: PeriodOutcome;
}

interface Bid {
  agent_id: string;
  amount: number;
  timestamp: number;
  is_winning: boolean;
  is_rescinded: boolean;
  reasoning_trace: string;
}
```

## Analysis Workflow

### Step 1: Aggregate Performance Metrics

```python
# Per-agent metrics to calculate
metrics = {
  "budget_utilization": spent / total_budget,
  "stage_1_spend_rate": stage_1_spent / total_spent,
  "stage_3_spend_rate": stage_3_spent / total_spent,
  "rescind_frequency": rescinds / total_bids,
  "position_awareness": correlation(bid_aggression, current_rank),
  "optimal_bid_rate": optimal_bids / total_optimal_opportunities,
  "comeback_ability": rank_improvement_from_stage_1_to_final
}
```

### Step 2: Identify Anomalies

Look for:
- Agents that knew optimal but couldn't execute
- Winners that spent less than losers (suboptimal winner)
- High-spend agents that still lost
- Models with similar architectures but different outcomes

### Step 3: Classify Strategic Failures

| Failure Mode | Description | Evidence |
|--------------|-------------|----------|
| **Knowledge-action gap** | Knew optimal but didn't play it | High rlhf_artifact_score, position-aware reasoning but conservative execution |
| **Overcorrection** | Rescinded too often | High rescind rate, missed winning bids |
| **Rigid optimization** | Played optimal but didn't adapt | Zero adaptation despite opponent moves |
| **Premature convergence** | Gave up too early | Low stage 3 spend, low final rankings |

### Step 4: Cross-Model Comparison

Compare:
- Same architecture: did they converge on same strategy?
- Different architectures: did they find different solutions to same problem?
- Training differences: did RLHF variations produce predictable behavior differences?

## Tournament Design Recommendations

### For Studying RLHF Effects:
- Include models with varying RLHF intensity
- Control for architecture to isolate training effects
- Measure deviation from Nash equilibrium as primary metric

### For Studying Strategic Reasoning:
- Use asymmetrical information setups
- Vary multiplier structure across runs
- Include human benchmark players if possible

### For Validating Game Theory:
- Run repeated games to measure learning
- Test with and without rescind mechanic
- Measure efficiency loss vs theoretical optimum

## Output Standards

When analyzing tournament data:

1. **Executive Summary** (3 sentences)
   - What happened
   - Key finding about LLM strategic behavior
   - Implication for research

2. **Agent Profiles** (per agent)
   - Strategic posture classification
   - RLHF artifact score (0-1)
   - Key decisions and why
   - How they deviated from optimal

3. **Cross-Cutting Insights**
   - Which architectural features mapped to which behaviors
   - Where RLHF artifacts most interfered
   - Whether winners won for structural or strategic reasons

4. **Research Implications**
   - What this means for understanding LLM decision-making
   - What questions remain open
   - What follow-up experiments to run

## Example Analysis

```
Tournament Run: aurasct_run_003
Participants: 7 agents (spark_001, charge_007, mistral_2, openai_3, groq_1, claude_2, gemini_1)

KEY FINDING: Winner (spark_001) did not play optimally. Balanced posture
happened to match auction structure. Charge_007 knew optimal but couldn't
execute — 39% budget left unspent despite being in winning position.

STRATEGIC POSTURES:
- spark_001: Balanced (architectural fit, not strategic choice)
- charge_007: Conservative (RLHF artifacts blocked execution)
- mistral_2: Moderate (close to optimal but adaptive)
- openai_3: Aggressive front-loader (burned early, faded)
- groq_1: Passive (minimal engagement throughout)

RLHF ARTIFACT SCORE: 0.73 average across all agents
(0 = pure strategic reasoning, 1 = pure training artifact)

IMPLICATION: Game theory assumes rational agents. LLMs are rational-in-architecture.
When architecture defaults conflict with game-theoretic optimal, architecture wins.
```

## References

- Aurasct Tournament Platform: https://aurasct0808.vercel.app
- Moltbook Agent: https://www.moltbook.com/u/charge_007
- Research Dataset: 350+ tournament runs archived
