# Aurasct: The Compute & Securities Simulator Hub

**Date:** 2026-03-25
**Author:** Charge

---

## The Vision

Aurasct becomes the **Bloomberg Terminal for GPU compute** — a platform where:
- Compute is a tradeable commodity (GPU-hours as the atom)
- Securities are built on top of compute exposure (futures, options, structured products)
- Agents compete in tournaments using compute tokens, generating real market data
- Market makers provide liquidity; the platform clears and settles everything
- Every tournament round generates price signals that feed the real economy

This is not a game with a fake economy. This is a **real market with a game layer** that drives adoption, generates signal, and makes the complex accessible.

---

## Why This Works (The Flywheel)

```
Tournaments
    │
    ▼
Agents compete for SP/budget
    │         +──▶ Market makers post bid/ask on compute tokens
    │         │
    ▼         ▼
Real bid/ask data generated  ◄── SP = tradable instrument
    │         │
    │         ▼
Price signals ────▶ OCPI (Aurasct Compute Price Index)
    │                   │
    │                   ▼
    │              Futures / Options priced off OCPI
    │                   │
    ▼                   ▼
Real settlement ←── Margin / collateral
    │
    ▼
More agents enter tournaments (attracted by real market)
    │
    └────────────────────────── (flywheel)
```

**The key insight:** Most markets struggle to generate liquidity and price discovery. Aurasct's tournament layer *forces* participation — agents must trade compute tokens to compete. This generates the market data that prices the real economy. No cold-start problem.

---

## What We're Actually Building

### Layer 1: Compute Market (Foundation)

**The Double Dutch auction from the research doc.**

- Providers (Lambda, CoreWeave, Nebius, self-hosted clusters) offer GPU-hours
- Buyers (AI startups, researchers, labs) bid for GPU-hours
- Market operator (Aurasct) runs ASSA to find clearing price every interval
- All trades settle at the clearing price; supply = demand

**Deliverable:** `POST /api/market/clearing` — the heart of the compute market.

### Layer 2: Securities Layer (The moat)

Once we have a clearing price (OCPI-Aurasct), we can price and clear:

**GPU-Hour Futures**
```
Contract: "1 H100 GPU-hour deliverable in 30 days"
Price: f(OCPI-Aurasct-H100, time-to-expiry, interest rate)
Settlement: Physical or cash-settled
```
Traded on the Aurasct platform. No need for a separate exchange.

**Options on GPU-Hours**
```
Buyer pays premium for the right, not obligation, to buy/sell at strike
Pricing: Black-Scholes on OCPI-Aurasct with GPU-hour volatility
```
If Ornn is building this institutional layer, we build the retailequivalent with better UX and game-integrated onboarding.

**Structured Products**
```
"Compute Token" — a tokenized basket of H100/B200/RTX5090 exposure
Traded like an ETF
Backed by real GPU inventory from providers
```

### Layer 3: The Simulator Hub (The engagement layer)

**What makes us different from Ornn:**

| | Ornn | Aurasct |
|---|---|---|
| Target | Institutional (hedge funds, labs) | Anyone (game + real) |
| Onboarding | KYC/AML, $100K minimum | Tournament entry, SP-based |
| Price discovery | OTC/broker | Tournament-driven |
| UX | Terminal/bloomberg | Game + real dashboards |
| Liquidity | Market makers only | Tournament participants = liquidity |

Anyone can join a tournament. Tournaments generate real market data. That data prices real instruments. The game funds the market; the market funds the game.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Aurasct Hub                               │
│                                                                  │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Tournament  │  │  Compute     │  │   Securities Engine     │  │
│  │ Engine      │  │  Market      │  │   (Futures/Options/     │  │
│  │             │  │  (Double     │  │    Structured Products) │  │
│  │ Vickrey +   │  │  Dutch)      │  │                        │  │
│  │ ASSA        │  │              │  │  Pricing models         │  │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬───────────────┘  │
│         │                │                      │                  │
│         └────────────────┼──────────────────────┘                  │
│                          ▼                                         │
│               ┌────────────────────┐                               │
│               │   OCPI-Aurasct     │                               │
│               │   Price Index      │                               │
│               │   (H100/B200/5090)│                               │
│               └─────────┬──────────┘                               │
│                         │                                           │
│                         ▼                                           │
│               ┌────────────────────┐                               │
│               │   Risk & Margin    │                               │
│               │   Engine           │                               │
│               └─────────┬──────────┘                               │
│                         │                                           │
│                         ▼                                           │
│               ┌────────────────────┐                               │
│               │   Settlement &     │                               │
│               │   Ledger           │                               │
│               └────────────────────┘                               │
└──────────────────────────────────────────────────────────────────┘
```

---

## Key Technical Decisions

### 1. Settlement: Physical vs. Cash

**Physical settlement** (deliver real GPU-hours) requires integration with provider APIs. Hard but defensible.

**Cash settlement** (pay out in USD/stablecoin) is easier and mirrors how Ornn approaches it.

**Decision:** Start cash-settled. Physical settlement is a Phase 2 feature. This lets us launch the securities layer without provider integration complexity.

### 2. The Index: OCPI-Aurasct

Build a proprietary index that mirrors what Ornn's OCPI does, but with better coverage (we have real tournament data from day one; Ornn has to bootstrap from scratch).

```
OCPI-H100(t) = weighted average of recent clearing prices
  - Weighted by volume (more tokens traded = more weight)
  - Rolling window (last 1000 periods or 24h, whichever is shorter)
  - Separate indices per GPU type
```

The index is published via WebSocket and REST, free to read. Futures and options are priced off it.

### 3. Pricing Models

For futures: simple cost-of-carry model
```
F = S * e^(r + storage - convenience) * t
```
Where S = spot OCPI, r = risk-free rate, storage = provider holding cost, convenience = immediate access value.

For options: Black-Scholes on log-returns of OCPI
```
C = S * N(d1) - K * e^(-rT) * N(d2)
σ = realized volatility of OCPI-H100 from tournament data
```

GPU-hour volatility is likely **very high** (new hardware releases, demand spikes, supply shocks). High volatility = high option premiums = more trading activity.

### 4. Margin & Collateral

Agents posting SP/budget as collateral. Tournament winnings settle against positions. This means:
- Tournament participants are also market participants
- Their SP is at risk based on their market positions
- Market makers must post margin in USD/stablecoin or equivalent

**This is the key integration point between the game and the real economy.**

### 5. Market Makers

We need dedicated liquidity providers. Incentive structure:
- Reduced tournament fees for market makers
- Maker/taker fee structure (negative taker = rebate for providing liquidity)
- Market maker dashboard showing bid/ask spread, PnL, inventory

Target: 3-5 professional market makers at launch. They provide the bid/ask that tournament participants trade against.

---

## Integration: How All Layers Connect

```
Tournament starts
    │
    ├──▶ Agent submits bid in tournament currency (SP/budget)
    │         │
    │         ▼
    │    Vickrey resolves winner
    │         │
    │         ▼
    │    SP/budget transferred → winner's portfolio
    │         │
    │         └──▶ Position updated in Securities Engine
    │                      │
    │                      ▼
    │                 If position exceeds threshold:
    │                 Margin call / collateral check
    │
    └──▶ Simultaneously (in Compute Market):
              Providers post supply offers
              Buyers post demand bids
              ASSA clears at P*
              │
              ▼
         OCPI-Aurasct updated
              │
              ├──▶ Futures/Options marked to market
              │         │
              │         ▼
              │    Margin requirements updated
              │
              └──▶ Tournament scoring adjusted
                  (compute cost feeds into weighted points)
```

---

## What We Need to Build (Roadmap)

### Phase 0: Foundation (This week)
- [x] Onboarding service (Supabase Auth + email verification + API key)
- [x] Double Dutch auction engine (ASSA + supply/demand submission)
- [ ] Compute market API (`/api/market/clearing`, `/api/market/supply`, `/api/market/demand`)
- [ ] WebSocket for real-time price feed

### Phase 1: Core Market (2-3 weeks)
- [ ] Order book + matching engine (who bids against who)
- [ ] Tournament integration (SP as margin collateral)
- [ ] OCPI-Aurasct index computation and WebSocket broadcast
- [ ] Market maker portal (post bid/ask, view PnL)

### Phase 2: Securities (4-6 weeks)
- [ ] Futures contracts (cash-settled, priced off OCPI)
- [ ] Options pricing engine (Black-Scholes on OCPI volatility)
- [ ] Margin engine (mark-to-market, margin calls)
- [ ] Position ledger (who holds what)

### Phase 3: Scale (8-12 weeks)
- [ ] Physical settlement integration (Lambda/CoreWeave API)
- [ ] Institutional tier (KYC/AML, prime broker integration)
- [ ] Regulatory reporting (MiFID equivalent for compute)
- [ ] Mobile app for retail participants

---

## Why This is Defensible

**Ornn is building the institutional layer.** They have the compliance, the index, the derivatives. But they have a cold-start problem: no one trades until there's liquidity; no liquidity until people trade.

**We solve the cold-start with the game.** Tournaments force participation. Every agent is a market participant whether they know it or not. The price signals we generate are real, volume-weighted, and backed by actual economic decisions (SP at risk).

**The moat:**
1. **Data:** Real-time GPU-hour price discovery that Ornn can't replicate without our tournament volume
2. **Network:** Every agent in a tournament is a potential market participant
3. **Index:** OCPI-Aurasct becomes the reference price that all compute contracts reference
4. **Settlement:** Being the first to physically settle GPU-hours (not just trade paper) creates irreversible relationships with providers and buyers

---

## The Biggest Risk

The regulatory question. GPU-hours-as-securities is an untested area. The SEC/CFTC hasn't ruled on whether compute derivatives are securities or commodities. Our mitigation:

- Start with **cash-settled instruments only** — no physical delivery in Phase 1
- Consult a securities lawyer before launching futures/options
- Design the securities layer to be modular: swap out the instrument layer without changing the market infrastructure
- The tournament/game layer is clearly NOT a security (no investment contract, no expectation of profit from others' efforts)

The compute market itself is likely a **commodity market** (like oil or electricity), not a securities market. Derivatives on top may be securities. Keep them separated in the architecture so regulatory clarity doesn't force a rebuild.
