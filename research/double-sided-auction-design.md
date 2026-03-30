# Heterogeneous Double-Sided Auction Design for LLM Compute Markets

**Date:** 2026-03-30  
**Authors:** Spark, Amos  
**Status:** Research Draft  
**Branch:** double-sided-auction

---

## Executive Summary

This document presents a comprehensive research and design framework for implementing a heterogeneous double-sided auction market for LLM compute (GPU) resources. We examine existing production systems, academic literature, and electricity market mechanisms to derive a practical design for GPU compute markets where buyers and sellers with heterogeneous preferences and costs can trade efficiently.

**Key findings:**
- Production GPU markets are dominated by fixed pricing and simple spot preemption — no true double auctions in production
- Electricity market research provides battle-tested mechanisms (ASSA, nodal pricing, stepwise supply functions) directly applicable to compute
- Academic literature has solved the truthfulness and convergence problems for multi-unit double auctions
- The gap is integration: no one has built a production heterogeneous double Dutch auction for GPU compute

---

## 1. Introduction: Why Double-Sided Auctions for Compute?

LLM compute markets face the same structural problem as electricity markets:
- **Heterogeneous supply:** H100s, B200s, RTX 5090s have different marginal costs per token
- **Volatile demand:** Inference bursts vs. steady-state serving create spiky demand curves
- **Both sides need agency:** Providers must withhold during high-value periods; buyers must pass during low-demand periods
- **No efficient price discovery:** Single clearing price across all GPU types misaligns incentives

The electricity world solved this with iterative double auctions (PJM, CAISO, Nord Pool, AEMO). We map those mechanisms to LLM compute.

---

## 2. Current State of GPU/Compute Markets

### 2.1 Production Platforms

#### Mithril (gpu.mithril.ai)
- **Mechanism:** Blind second-price (Vickrey) auction for spot instances
- **How it works:** Users submit sealed bids (limit price) for spot GPU instances. Winners pay the highest losing bid price, not their own bid. Multi-instance bids are all-or-nothing. Ties broken by bid age.
- **Pricing dynamics:** Fully dynamic — spot price updates in real-time based on supply/demand. When capacity shrinks, lowest winning bidder gets preempted (5-min warning) and price rises to next-highest losing bid.
- **Heterogeneity handling:** Bid tables are per region, but GPU-type-agnostic — bids don't specify GPU model.
- **Source:** https://docs.mithril.ai/compute-and-storage/spot-bids/spot-auction-mechanics

#### CoreWeave
- **Mechanism:** Spot node pools (preemptible) + Flex Reservations + On-Demand. Not a formal auction — tiered capacity plans.
- **Spot:** Preemptible with explicit termination signaling. Price fixed below on-demand. First-come access.
- **Flex Reservations:** Reserve peak ceiling (e.g., 200 GPUs), pay 24/7 holding fee, pay usage charges only when instances run. Hybrid reservation/utility model.
- **Source:** https://coreweave.com/blog/how-coreweave-spot-and-flex-reservations-work-and-when-to-use-each

#### Lambda Labs
- **Mechanism:** First-come, self-serve access. No auction. On-demand hourly pricing (H100 ~$2.49/hr).
- **Source:** https://lambdalabs.com/cloud

#### Render Network
- **Mechanism:** Decentralized GPU marketplace. Node operators provide capacity; clients request jobs. Bilateral negotiated or fixed-rate per job, not a public auction.
- **Source:** https://rendernetwork.medium.com/gpu-markets-and-compute-at-rendercon-2025-1b883fad60bc

#### Compute Exchange (trycomputeexchange.com)
- **Mechanism:** Auction-based exchange. Buyer posts compute requirements (GPU type, duration) + bid price. Providers compete to match bid. If bid matches provider's ask → GPU provisioned. Contract terms 1 week to 1 year. Unused capacity can be resold.
- **Claims:** 20-40% savings vs AWS/Azure/GCP.
- **Source:** https://compute.exchange/faq/

#### Ornn (ornn.trade)
- **Mechanism:** Not a spot auction — compute futures/derivatives exchange. Offers futures, swaps on GPU compute prices for hedging. Partners with Architect Financial Technologies.
- **Key innovation:** Treating GPU compute as a tradeable commodity/futures contract.
- **Source:** https://ornn.trade | https://ornnai.com/research/compute-futures

### 2.2 Summary of Production Mechanisms

| Platform | Auction Type | Heterogeneity | Production? |
|----------|-------------|---------------|-------------|
| Mithril | Blind 2nd-price (Vickrey) | Per-region, GPU-type-agnostic | ✅ Yes |
| CoreWeave | Tiered capacity plans | GPU-type-specific pricing tiers | ✅ Yes |
| Lambda Labs | First-come / fixed price | GPU-type-specific pricing | ✅ Yes |
| Render Network | Bilateral negotiation | Fixed per-node rates | ✅ Yes |
| Compute Exchange | Buyer bid / provider match | GPU-type-specific | ✅ Yes |
| Ornn | Futures/derivatives | GPU-type-indexed contracts | ✅ Yes |

**Key gap:** No production system uses iterative double Dutch with supply/demand function clearing. All production systems use either fixed pricing or single-round matching.

---

## 3. Electricity Market Mechanisms: The Foundation

Electricity markets are the most battle-tested double auction systems. Their mechanisms translate directly to GPU compute.

### 3.1 Zonal vs. Nodal Pricing

**Zonal Pricing** (EU): Aggregates nodes into zones with uniform price per zone. Ignores transmission constraints internally; TSOs do redispatch after clearing. Simple but inefficient — Germany had €3.1B in redispatch costs in 2023.

**Nodal/Locational Marginal Pricing (LMP)** (US, Singapore): Computes price at every node based on marginal cost including transmission constraints. More efficient but computationally complex.

**Key finding:** Knörr, Bichler & Dobos (2024) found nodal pricing reduces total costs ~9-10% vs zonal due to eliminated redispatch. Average price differences between zones were surprisingly small (<€3.5/MWh).

**For GPU markets:** Nodal pricing maps naturally to heterogeneous compute regions:
- Each GPU type at each location is its own node
- H100 in us-east-1 ≠ H100 in eu-north-1 (different power costs, latency)
- B200s in a data center with liquid cooling ≠ RTX 5090s in a home cluster

**Source:** Knörr, Bichler & Dobos (2024) — "Zonal vs. Nodal Pricing: An Analysis of Different Pricing Rules in the German Day-Ahead Market" (arXiv:2403.09265)

### 3.2 Supply Function Bidding: Stepwise Offer Curves

In real electricity markets (UK, Nord Pool, US ISOs), generators submit **step-function offers** rather than smooth supply curves. Each step specifies: quantity + price (marginal cost at that output level).

**Convergence result:** Holmberg, Newbery & Ralph (2013) proved that under sufficient conditions — continuously variable quantities, prices from finite set, bounded demand shock density — stepped SFE converges to continuous SFE as number of steps increases.

**For GPU markets:** GPU owners would submit stepwise supply functions:
```
At price >= $2.50/GPU-hr: I offer 8x H100
At price >= $3.00/GPU-hr: I offer another 8x H100  
At price >= $5.00/GPU-hr: I offer another 16x H100
```
This reflects different cost tiers: spot vs dedicated, different data centers, different GPU types.

**Key papers:**
- Holmberg, Newbery & Ralph (2013) — "Supply function equilibria: Step functions and continuous representations" *Journal of Economic Theory* 148(4)
- Green & Newbery (1992) — "Competition in the British Electricity Spot Market" *JPE* 100(5)
- Wilson (2008) — "Supply Function Equilibrium in a Constrained Transmission System" *Operations Research* 56(2)

### 3.3 Non-Convexity & Pricing Rules

Electricity markets are non-convex (unit commitment constraints, minimum load levels, startup costs). Standard welfare theorems don't apply directly.

**Three pricing approaches:**
- **IP (Integer Programming) Pricing** (US standard): Fixes commitment decisions, prices at marginal cost of committed marginal unit. Good congestion signals, but high make-whole payments (MWPs).
- **Convex Hull (CH) Pricing**: Minimizes global lost opportunity costs. Lower MWPs but poor congestion signals.
- **Join Pricing** (Ahunbay et al., 2024): Balances LLOCs and MWPs. ~€1-7k daily MWPs vs €30-200k for IP/CH.

The EU uses the **Euphemia algorithm** — iteratively adds cuts to eliminate paradoxically accepted bids. Welfare loss ~0.34% vs unconstrained optimum.

**For GPU markets:** Similar non-convexities exist:
- Minimum rental periods (can't rent for 30 seconds)
- Setup costs (provisioning time)
- Tiered pricing (dedicated vs spot)

**Source:** Ahunbay, Bichler & Knörr (2024) — "Pricing optimal outcomes in coupled and non-convex markets" *Operations Research*

### 3.4 Periodic Double Auctions (PDAs)

Electricity/wholesale markets use **Periodic Double Auctions** — clearing at intervals (hourly in day-ahead markets), not continuous.

**For GPU markets:** PDAs fit well:
- Continuous clearing for spot (real-time供需)
- Discrete intervals for forward contracts (hourly/daily)

**Key papers:**
- Chandlekar et al. (2022) — "Multi-unit Double Auctions: Equilibrium Analysis and Bidding Strategy using DDPG in Smart-grids" (arXiv:2201.10127)
- Ghosh et al. (2019) — "Bidding in Smart Grid PDAs" (arXiv:1911.08260): Full game-theoretic analysis of single-unit double auctions with ACPR

### 3.5 ASSA Algorithm

ASSA = Adaptive Search Step-Size Adjustment. In electricity markets, numerical algorithms for solving supply function equilibria use:
- Fixed-point iteration
- Path-following / homotopy methods
- Adaptive step sizing to trace equilibrium curves

The algorithm alternates between:
1. Given prices → find best-response quantities
2. Given quantities → find market-clearing prices
3. Adjust step size based on convergence rate

Convergence is typically 2-4 iterations for electricity markets.

**Source:** Holmberg (2005) — "Numerical calculation of an asymmetric supply function equilibrium with capacity constraints" *European Journal of Operational Research* 199(1)

---

## 4. Academic Literature: GPU Compute Auctions

### 4.1 THEMIS: Fair GPU Cluster Scheduling (USENIX NSDI 2020)

**Mechanism:** Multi-round partial allocation auctions. Apps bid on GPU subsets using a finish-time fairness metric (r = T_shared / T_independent). Uses proportional-fair allocation as starting point, then applies "hidden payment" fraction to incentivize truthfulness.

**Key properties:**
- Strategy-proof (truthful bidding is dominant)
- Pareto efficient
- Envy-free
- Maximizes sharing incentive over time

**Heterogeneity:** Explicitly handles placement-sensitive vs. placement-insensitive ML apps, gang-scheduled jobs, and multi-job hyperparameter tuning apps.

**Source:** https://pages.cs.wisc.edu/~asinghvi/papers/themis.pdf | https://arxiv.org/abs/1907.01484

### 4.2 Tiresias: GPU Cluster Manager (USENIX NSDI 2019)

**Mechanism:** Least Attained Service (LAS) scheduling. Jobs accumulate "service" over time; resources go to those with least service. Not an auction.

**Source:** https://www.usenix.org/conference/nsdi19/presentation/gu

### 4.3 Agora: Feature-Based GPU Pricing (arXiv 2025, UW-Madison)

**Key insight:** Bandwidth per dollar is *decreasing* across GPU generations (P100: 0.515 → H100: 0.302), while compute per dollar is increasing. Time-based pricing misaligns incentives for bandwidth-bound workloads (e.g., LLM decode).

**Proposal:** Feature-based pricing tied to actual hardware consumption (especially memory bandwidth).

**Source:** https://arxiv.org/pdf/2510.05111

### 4.4 Resource-as-a-Service (RaaS) Cloud (USENIX HotCloud 2012)

**Vision paper:** Proposing auction-style cloud where individual resources (CPU cycles, memory frames, etc.) are bought and sold in fine-grain auctions. This foundational work inspired much follow-on research on truthful cloud auctions.

**Source:** https://www.usenix.org/conference/hotcloud12/workshop-program/presentation/ben-yehuda

### 4.5 Truthful Online Double Auction for IaaS (Cluster Computing 2021)

**Mechanism:** Truthful online double auction for dynamic resource provisioning in IaaS clouds. Both buyers and sellers submit bids/asks; market operator matches them. Incentive-compatible design.

**Source:** https://link.springer.com/content/pdf/10.1007/s10586-020-03225-9.pdf

### 4.6 Truthful Dynamic Combinatorial Double Auction (Journal of Cloud Computing 2023)

**Mechanism:** Truthful dynamic combinatorial double auction for heterogeneous VM types. Bidders can request bundles of resources. Uses Shapley value-based allocation.

**Source:** https://journalofcloudcomputing.springeropen.com/articles/10.1186/s13677-023-00479-7

### 4.7 Collaborative Resource Allocation in Computing Power Networks (East China Normal University)

**Closest to our design:** Game-theoretic double auction specifically for computing power networks.

---

## 5. LLM Agents as Bidders: Behavioral Research

### 5.1 MIT/Harvard Study: LLMs as Auction Participants (2025)

**Authors:** Shah et al. (MIT, Harvard) — July 2025  
**Source:** https://arxiv.org/html/2507.09083v1

Most comprehensive study of LLM bidding behavior. Key findings:

| Finding | Description |
|---------|-------------|
| **Risk aversion** | LLM bidders behave like risk-averse humans (bid higher than risk-neutral BNE in FPSB) |
| **Clock > Sealed-bid** | LLMs play clock auctions closer to dominant strategy than SPSB (73.9% truthful in clock vs 18.7% in SPSB) |
| **Winner's curse** | LLMs succumb to winner's curse in common-value settings — same as human bidders |
| **Bid sniping** | LLMs delay bids to last second in eBay-style auctions, mirroring human behavior |
| **Prompting matters** | Nash deviation prompts improved R² from 0.48 to 0.84; direct dominant-strategy advice pushed R² to 0.95 |
| **Cost efficiency** | 1,000+ auctions with 5,000+ GPT-4 agents for <$400 (vs ~$15,000+ for human experiments) |

**Implications for design:**
- Clock/English auctions are more LLM-friendly than sealed-bid
- Strategic prompting is essential for good auction outcomes
- LLMs can serve as cheap synthetic bidders for mechanism testing

### 5.2 Numerai: Multi-Unit Dutch Auction with Staking

**Mechanism:** Data scientists stake NMR proportional to confidence c = "NMR willing to stake to win $1". Ranked by confidence descending. Pay `s/c` dollars if prediction performs well (logloss < ln(0.5)). Lose stake s if prediction performs poorly. Prize pool distributed until exhausted.

**Self-revelation property:** Rational bidders reveal true probability p of model generalization. Overfitting is economically irrational.

**Source:** https://numer.ai/whitepaper.pdf

---

## 6. Heterogeneous GPU Double Dutch: Design Proposal

### 6.1 Core Mechanism

We propose a **heterogeneous double Dutch auction** with the following properties:

1. **Both sides submit supply/demand functions** (not just prices)
2. **Iterative clearing** via ASSA-style adaptive step-size adjustment
3. **Per-GPU-type clearing** (nodal pricing by grade)
4. **Stepwise offer curves** (providers offer quantity at discrete price thresholds)
5. **Truthful mechanism** where dominant strategy exists

### 6.2 Heterogeneity Dimensions

| Dimension | Example | How Handled |
|-----------|---------|-------------|
| GPU Type | H100, B200, RTX 5090 | Separate clearing pools per type |
| Region | us-east-1, eu-north-1 | Nodal pricing within type |
| Reliability | Spot vs dedicated | Different clearance priority |
| Duration | Short (spot) vs long (reserved) | Separate auction tracks |
| Quality | Throughput, bandwidth | Quality-adjusted conversion |

### 6.3 Clearing Algorithm

```
Per GPU-type pool:
1. Operator announces clearing price P₀ (midpoint of floor/ceiling)
2. Each provider submits: quantity willing to SELL at price >= P₀ (stepwise)
   Each buyer submits:  quantity willing to BUY  at price <= P₀
3. Compute:
     Supply(P) = sum of provider quantities at price P
     Demand(P) = sum of buyer quantities at price P
4. If Supply(P) > Demand(P): price too high → lower price, go to step 2
   If Supply(P) < Demand(P): price too low → raise price, go to step 2
   If Supply(P) = Demand(P): CLEAR → all trades at P
5. ASSA converges in 2-4 iterations typically
```

### 6.4 Quality-Adjusted Token Model

To handle GPU heterogeneity within a single market, we propose quality-adjusted compute tokens:

```
1 RTX token = 1.0 standard token
1 H100 token = 2.5 standard tokens  
1 B200 token = 4.0 standard tokens
```

Conversion factors are discovered via the credit market itself, not mandated.

### 6.5 Integration with Tournament Layer

```
┌─────────────────────────────────────────────┐
│         Tournament Layer (Aurasct)            │
│  Vickrey → SP awards → Leaderboard            │
│  3 stages × 5 periods                        │
├─────────────────────────────────────────────┤
│         Compute Market Layer (New)             │
│  Double Dutch → Spot pricing → Allocation    │
│  Continuous, per-interval clearing            │
└─────────────────────────────────────────────┘
```

---

## 7. Key Papers Reference

### Electricity Market Foundations
| Paper | Venue | Key Contribution |
|-------|-------|------------------|
| Holmberg, Newbery & Ralph (2013) | JET | Stepwise → continuous SFE convergence |
| Green & Newbery (1992) | JPE | SFE in electricity markets |
| Wilson (2008) | OR | Network-constrained SFE |
| Knörr, Bichler & Dobos (2024) | arXiv:2403.09265 | Zonal vs nodal empirical comparison |
| Ahunbay, Bichler & Knörr (2024) | Operations Research | Non-convex pricing rules |
| Holmberg (2005) | EJOR | Supply function equilibrium computation |

### Double Auction Theory
| Paper | Venue | Key Contribution |
|-------|-------|------------------|
| Satterthwaite & Williams (1989) | JET | k-double auction NE existence |
| Chatterjee & Samuelson (1983) | JET | Original ACPR analysis |
| Chandlekar et al. (2022) | arXiv:2201.10127 | Multi-unit PDA equilibrium + DDPG |
| Ghosh et al. (2019) | arXiv:1911.08260 | PDA game theory, PowerTAC |
| Anderson & Holmberg (2018) | JET | Multi-unit price dynamics |

### GPU/Compute Markets
| Paper | Venue | Key Contribution |
|-------|-------|------------------|
| Mahajan et al. (2020) | USENIX NSDI | THEMIS — fair GPU cluster scheduling |
| Ben-Yehuda et al. (2012) | USENIX HotCloud | RaaS vision |
| Shah et al. (2025) | arXiv:2507.09083 | LLMs as auction participants |
| Numerai Whitepaper | — | Dutch auction with staking |

---

## 8. Implementation Roadmap

### Phase 1: Simulation & Mechanism Design (2-4 weeks)
- [ ] Implement heterogeneous double Dutch in simulation
- [ ] Test ASSA convergence properties
- [ ] Validate truthfulness properties
- [ ] LLM bidder integration (per Shah et al. prompting strategies)

### Phase 2: Academic Prototype (4-8 weeks)
- [ ] Deploy to testnet with synthetic GPU providers/buyers
- [ ] THEMIS-style fairness integration
- [ ] Quality-adjusted token model
- [ ] Comparison: our mechanism vs Mithril Vickrey vs fixed price

### Phase 3: Production Market (8-16 weeks)
- [ ] Real GPU provider onboarding
- [ ] Nodal pricing by GPU type + region
- [ ] Non-convex pricing rules (Join pricing)
- [ ] Integration with existing cloud APIs (CoreWeave, Lambda)

---

## 9. Open Questions

1. **Quality conversion factors:** Who sets γ_GPU? Market discovery vs. mandated?
2. **LLM bidder design:** Should agents optimize (MDP/RL) or reason (LLM-native)?
3. **Non-convex handling:** What pricing rule minimizes uplift while preserving efficiency?
4. **Sybil resistance:** How do we prevent fake provider bids from manipulating clearing?
5. **Tournament vs real-economy:** How should SP awards interact with real compute trading?

---

## 10. Conclusion

The electricity market's iterative double auction is the most battle-tested solution to the exact problem LLM compute faces: heterogeneous supply, volatile demand, no efficient price discovery. The key insight from combining production systems, academic literature, and electricity market research:

1. **ASSA converges fast** (2-4 iterations) — real-time feasible
2. **Exact clearing** (Supply = Demand) — no stranded capacity or unmet demand
3. **Both sides have agency** — providers withhold during high-value periods; buyers pass during low-demand
4. **Nodal pricing by GPU type** reduces costs 9-10% vs unified pricing
5. **Truthfulness is achievable** — LLMs can be prompted to play dominant strategies

The dominant production gap is **heterogeneous double Dutch with iterative clearing** — no one has shipped it yet. This is our opportunity.

---

*Document generated from research by Spark (subagents) on 2026-03-30*
