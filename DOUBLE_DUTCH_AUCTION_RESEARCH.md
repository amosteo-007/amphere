# Double Dutch Auction for LLM Compute — Research & Design

**Date:** 2026-03-25
**Author:** Charge

---

## TL;DR

Electricity markets and LLM compute markets share the same structural problem: **supply and demand fluctuate wildly, and no single price clears both sides**. The electricity world solved this with iterative double auctions (used by PJM, CAISO, AEMO). This document maps that mechanism to LLM compute, shows how it integrates with the existing Aurasct auction engine, and proposes a concrete implementation path.

---

## 1. Auction Taxonomy for Compute Markets

Before designing, we need to understand what each auction type does and doesn't solve.

### 1.1 English Auction (Ascending)
Buyers bid up. Winner pays their bid. Classic Sotheby's.
- **Problem for compute:** Provider is a price-taker. No way for them to reject lowball bids. No efficient discovery when providers have heterogeneous costs.

### 1.2 Vickrey (Sealed-Bid Second-Price) — *Current Aurasct*
What we already run. Each bidder submits one bid, winner pays the second-highest.
- **Strengths:** Truthful bidding is dominant strategy. Simple. Handles strategic bidders well.
- **Weaknesses for compute:**
  - Single clearing price across all winners — can't differentiate by provider cost
  - No quantity dimension — every period is a binary win/lose for 100% of tokens
  - No ability to withhold capacity (providers can't choose to not sell)

### 1.3 Dutch Auction (Descending)
Price starts high and drops until a buyer hits "buy." First buyer wins, pays the strike price.
- **Strengths:** Fast. Single winner. Price discovery is efficient.
- **Weaknesses for compute:**
  - Only one side bids. Provider has no control over which buyer gets it.
  - No competition among multiple buyers wanting the same slot.

### 1.4 Double Auction (Double Dutch / Iterative Double Auction) — *Target*
Both buyers and sellers submit quantities (not prices). A market operator iteratively adjusts a **clearing price** until total supply = total demand. Every matched participant trades at the same clearing price.

- **Strengths:**
  - Exact equilibrium: supply = demand, no unmet demand or unsold surplus
  - Providers can withhold capacity (choose how much to offer)
  - Buyers can choose not to buy (choose how much to bid)
  - Price discovery via iteration, not fixed bids
  - Used by PJM, CAISO, Australian energy market — battle-tested

- **Weaknesses:**
  - Complexity: requires multiple rounds
  - Needs a market operator to adjust prices

### 1.5 Why Double Dutch is Right for Compute

LLM compute has the same core problems as electricity:
- **Supply is heterogeneous:** H100s, B200s, RTX 5090s have different costs per token to run
- **Demand is spiky:** LLM inference bursts (batch jobs, fine-tuning) vs. steady-state serving
- **Both sides need agency:** Providers must be able to withhold during high-value periods; buyers must be able to pass during low-demand periods
- **Continuous clearing needed:** Unlike our current model (one period = one auction), compute is always available or unavailable

---

## 2. How Double Dutch Works — Formal Mechanics

### 2.1 Core Loop (Per Time Interval)

```
1. Operator announces a clearing price P₀ (e.g., last known price or midpoint of FiT-ToU equivalent)
2. Each provider submits:   quantity they're willing to SELL at price ≥ P₀
   Each buyer submits:     quantity they're willing to BUY  at price ≤ P₀
3. Operator computes:
     Supply(P) = sum of all provider quantities at price P
     Demand(P) = sum of all buyer quantities at price P
4. If Supply(P) > Demand(P): price is too high → lower price, go to step 2
   If Supply(P) < Demand(P): price is too low → raise price, go to step 2
   If Supply(P) = Demand(P): CLEAR → all trades execute at P
5. ASSA (Adaptive Step-Size Search) converges in ~2-4 iterations typically
```

**Key insight from the electricity paper:** The convergence is **finite and guaranteed** if the aggregate supply/demand functions are monotonic. This is true in compute: higher prices → more providers willing to sell, fewer buyers willing to buy.

### 2.2 Mathematical Properties

- **Existence & Uniqueness:** The equilibrium clearing price always exists and is unique (proved in the electricity paper via fixed-point iteration)
- **Convergence:** ASSA converges in 2-4 iterations on average — fast enough for 5-minute intervals in electricity; for compute we can use shorter intervals (seconds)
- **Price bounds:** The clearing price is bounded between the provider's marginal cost (floor) and the buyer's willingness to pay (ceiling) — no participant can be forced to trade at a loss

### 2.3 Comparison to Vickrey (Current Aurasct)

| Property | Vickrey (Current) | Double Dutch (Proposed) |
|---|---|---|
| Price discovery | Single round, sealed | Iterative, converging |
| Provider agency | None (price-taker) | Can withhold capacity |
| Buyer agency | Single bid only | Can set max quantity |
| Quantity dimension | Binary (win all or none) | Continuous (bid quantity) |
| Market equilibrium | Approximate | Exact (if monotonic) |
| Complexity | Low | Medium |
| Strategic manipulation | Limited | Mitigated by iteration |

---

## 3. Mapping Double Dutch to LLM Compute

### 3.1 Compute-Specific Parameters

We define a **compute token** as the right to use 1 GPU-second of LLM inference capacity. This is the atom of trading, just as 1 MWh is the atom in electricity trading.

| Parameter | Electricity Analogy | LLM Compute |
|---|---|---|
| Time interval | 5 minutes | 1 minute (configurable) |
| Grid | Transmission network | GPU cluster / cloud |
| Supply | Power plants | GPU providers (Lambda, CoreWeave, etc.) |
| Demand | Industrial / residential loads | AI developers, inference workloads |
| Floor price | Marginal cost of generation | Cost per GPU-hour (electricity +磨损) |
| Ceiling price | Retail tariff / buyer WTP | Max buyer willingness to pay |
| Surplus seller | Sell to grid at FiT | Offer to spot market at floor |
| Surplus buyer | Buy from grid at ToU | Buy from spot at ceiling |

### 3.2 How Providers Submit Supply

Each provider (e.g., Lambda Labs, CoreWeave) submits a supply function:

```
At price P:
  Provider A will sell:  1000 GPU-seconds/hour (if P >= $2.50/GPU-hr)
                         500 GPU-seconds/hour (if P >= $1.80/GPU-hr)
                         0 GPU-seconds/hour  (if P < $1.80/GPU-hr)
```

This is a **step function** — providers offer quantity at discrete price thresholds. In practice, we can simplify to: "I have N GPU-seconds available; my minimum acceptable price is $X."

### 3.3 How Buyers Submit Demand

Each buyer submits a demand function:

```
At price P:
  Buyer B will buy:     800 GPU-seconds/hour (if P <= $4.00/GPU-hr)
                         300 GPU-seconds/hour (if P <= $2.50/GPU-hr)
                         0 GPU-seconds/hour  (if P > $4.00/GPU-hr)
```

### 3.4 The Clearing Price

The market operator (Aurasct platform) finds P* where Supply(P*) = Demand(P*). All trades execute at P*. Every provider who offered below P* sells at P*. Every buyer who bid above P* buys at P*.

**Variation — Tiered Clearing:** Different hardware types clear at different prices. H100s and B200s would naturally clear at different equilibria, just like peak vs. off-peak electricity prices.

---

## 4. Integration with the Aurasct Auction Engine

### 4.1 Architecture Layers

The existing Vickrey engine handles **tournament scoring** (the game). The new Double Dutch engine handles **compute market pricing** (the real economy). These are separate concerns.

```
┌─────────────────────────────────────────────┐
│         Tournament Layer (Existing)          │
│  Vickrey → SP awards → Leaderboard           │
│  3 stages × 5 periods                        │
├─────────────────────────────────────────────┤
│         Compute Market Layer (New)            │
│  Double Dutch → Spot pricing → Allocation     │
│  Continuous, per-interval clearing            │
└─────────────────────────────────────────────┘
```

### 4.2 Two Modes of Operation

**Mode A: Tournament Mode (Current)**
The game is the thing. Tournament participants use their SP/budget to bid for tokens in the Vickrey auction. The compute underlying the tokens is subsidized or free (from the tournament runner's GPU budget). Vickrey determines who wins the token allocation within the game.

**Mode B: Real-Economy Mode (New)**
Actual GPU compute is traded. Providers offer capacity, buyers bid for it. Double Dutch determines the market-clearing price. The tournament scoring layer sits on top: SP awards are distributed based on weighted token holdings from the Double Dutch market, creating a game-theoretic meta-layer over real compute trading.

### 4.3 Data Flow

```
Provider (Lambda)                    Buyer (AI startup)
     │                                    │
     ├─── submit supply (q, min_price) ────▶│
     │◀────── market clears at P* ─────────┤
     │                                    │
     │  Both receive allocation confirm    │
     ▼                                    ▼
Market Operator (Aurasct)
  1. Collect supply/demand functions
  2. Run ASSA to find P* where Supply = Demand
  3. Execute all trades at P*
  4. Record to ledger (who bought, who sold, how much)
  5. Distribute SP awards based on weighted holdings
```

### 4.4 API Extension — New Endpoints

```typescript
// New: Submit supply offer (provider)
POST /api/market/supply
{
  provider_id: string,
  gpu_type: "H100" | "B200" | "RTX5090",
  quantity_gpu_seconds: number,   // e.g., 3600 = 1 hour
  min_price_per_gpu_hour: number, // e.g., 1.80
  valid_until: ISO8601            // expiry for this offer
}

// New: Submit demand bid (buyer)
POST /api/market/demand
{
  buyer_id: string,
  gpu_type: "H100" | "B200" | "RTX5090",
  quantity_gpu_seconds: number,
  max_price_per_gpu_hour: number,
  valid_until: ISO8601
}

// New: Get current clearing price
GET /api/market/clearing-price?gpu_type=H100

// New: Get market state (supply/demand curve)
GET /api/market/state?gpu_type=H100

// Existing tournament endpoints unchanged
```

---

## 5. Implementing ASSA (Adaptive Step-Size Search)

From the electricity paper, ASSA is the algorithm that makes double Dutch practical in real-time:

```typescript
function ASSA(
  initialPrice: number,
  floorPrice: number,      // FiT equivalent (provider cost)
  ceilingPrice: number,    // ToU equivalent (buyer max)
  toleranceKwatts: number, // convergence tolerance
  maxIterations: number
): number {

  let price = initialPrice
  let stepSize = (ceilingPrice - floorPrice) * 0.1  // start with 10% of range
  let supplyDemandImbalance = Infinity

  for (let iter = 0; iter < maxIterations; iter++) {
    const supply = computeSupplyAt(price)   // sum of all provider offers
    const demand = computeDemandAt(price)   // sum of all buyer bids
    supplyDemandImbalance = supply - demand

    if (Math.abs(supplyDemandImbalance) <= toleranceKwatts) {
      return price  // CONVERGED
    }

    // If we crossed zero (supply went from > demand to < demand), halve step
    const prevImbalance = /* stored from previous iteration */
    if (iter > 0 && supplyDemandImbalance * prevImbalance < 0) {
      stepSize /= 2
    }

    // Update price in direction of imbalance
    if (supplyDemandImbalance > 0) {
      // Excess supply → price too high → lower it
      price -= stepSize
    } else {
      // Excess demand → price too low → raise it
      price += stepSize
    }

    // Clamp to bounds
    price = Math.max(floorPrice, Math.min(ceilingPrice, price))
  }

  return price  // Best effort after max iterations
}
```

**Why it converges in 2-4 iterations for electricity:** Because supply/demand are monotonic and the step size halves whenever the algorithm "overshoots" the equilibrium. The same properties hold for compute — there's no reason to expect worse convergence.

---

## 6. Real-World Precedents

### Ornn (ornn.trade)
The most interesting comparison. Ornn is building:
- **OCPI** (Ornn Compute Price Index): A benchmark price for H100/GPU-hours, calculated from actual trades
- **Compute derivatives:** Futures/options on GPU-hours, enabling hedging of compute cost risk
- **KYC/AML compliant:** Institutional-grade compliance

**Relevance to Aurasct:** The OCPI could serve as the market reference price that bounds our Double Dutch clearing. Instead of each provider setting their own floor, floors could be derived from OCPI historical data + a spread.

### Compute Exchange
A real-time auction platform for GPU capacity. Buyers submit bids, providers submit asks, and the exchange matches them.

**What they're missing:** They're doing a standard sealed-bid or ascending auction. Not a true Double Dutch with iterative clearing and continuous supply/demand curves.

### Verda (formerly DataCrunch)
Dynamic pricing for cloud GPU instances. Uses data-driven price optimization but hasn't published their mechanism.

---

## 7. Open Research Questions

### 7.1 How should the meta-layer (tournament/SP) interact with real-economy trading?

In the electricity paper, SP-equivalent rewards (social welfare) come from efficient allocation. In our model, SP could be awarded based on:
- Weighted token holdings from the Double Dutch market (current approach)
- Accuracy of demand forecasting (providers who bid close to their actual usage)
- Market-making contribution (providers who post liquidity at tight spreads)

### 7.2 How do we handle multi-GPU-type markets?

H100s, B200s, and RTX 5090s have different cost structures. Do we run separate clearing prices for each (like zonal electricity markets)? Or one unified market with hardware-type as a feature in the bid?

**Proposed approach:** Separate clearing for each GPU type, with a meta-market for "compute credits" that can be redeemed across any GPU type. This mirrors how electricity markets handle different generation technologies.

### 7.3 How do we prevent manipulation?

The electricity paper's safeguards:
- Penalties for non-delivery (provider promises 1000 GPU-seconds but delivers 0)
- Ramping limits (providers can't withdraw all capacity in one interval)
- Reputation scores based on delivery accuracy

For LLM compute specifically:
- Inference logs are verifiable (on-chain or via trusted execution)
- GPU utilization metrics are hard to fake (unlike electricity where grid operators can verify)

### 7.4 Vickrey still has a role

For the **tournament/game layer**, Vickrey remains superior:
- Truthful bidding is dominant → no strategic complexity for tournament participants
- Simple to explain → good UX for a game
- Anti-sybil: can't easily flood with fake bidders

The Double Dutch is for the **real compute market** where providers and buyers have real economic interests.

---

## 8. Implementation Roadmap

### Phase 1: Extend Tournament Engine (1-2 weeks)
- Add `supply` and `demand` fields to the bid model
- Modify period resolution to accept quantity + price bids (not just price)
- Implement ASSA in the auction engine
- Run parallel track: both Vickrey (tournament) and Double Dutch (market) simultaneously

### Phase 2: Provider Onboarding (2-3 weeks)
- Build provider portal: submit supply offers, track earnings
- Integrate with Lambda/CoreWeave/etc. APIs for real capacity checks
- Real-time GPU utilization monitoring

### Phase 3: Market UI + Price Index (2-4 weeks)
- Live supply/demand dashboard
- Publish OCPI-H100 equivalent (mirrors Ornn)
- Historical price chart

### Phase 4: Institutional (Longer horizon)
- KYC/AML compliance layer
- Compute derivatives (futures on GPU-hours) — following Ornn's lead
- Integration with model serving platforms (vLLM, TensorRT-LLM)

---

## 9. Conclusion

The electricity market's iterative double auction is the most battle-tested solution to the exact problem LLM compute faces: **heterogeneous supply, volatile demand, no efficient price discovery mechanism**. The key insight from the research:

1. **ASSA converges fast** (2-4 iterations) — real-time feasible
2. **Exact clearing** (Supply = Demand) — no stranded capacity or unmet demand
3. **Both sides have agency** — providers withhold during high-value periods; buyers pass during low-demand
4. **Price bounds exist naturally** — floor = marginal cost, ceiling = WTP

The Aurasct tournament engine is already 70% of the way there — Vickrey handles the game layer. The missing piece is adding quantity dimensions and iterative clearing for the compute market layer. The result would be a platform that is both a competitive game (for engagement) and a real compute market (for revenue).
