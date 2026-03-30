# Event Simulation Loop — Build Spec
**Version:** 1.0
**Date:** 2026-03-30
**Goal:** Ship. Revenue. Real money.

---

## Core Assumption

**We are not building a research tool.**

This runs on live market data. When a risk officer at a DeFi protocol pulls up a scenario, they are making real decisions with real money based on output. The simulation must be fast enough to matter and accurate enough to trust.

---

## The Full Simulation Loop (Step by Step)

```
[1. DATA INGESTION]          Real-time feeds
         ↓
[2. SIGNAL DETECTION]        Threshold events fire
         ↓
[3. ARCHETYPE DECISION]      LLM agents reason
         ↓
[4. CLEARING ENGINE]          Match orders, run auctions
         ↓
[5. CASCADE PROPAGATION]     Agents trigger agents
         ↓
[6. STATE UPDATE]            New prices, positions, risks
         ↓
[7. OUTPUT / DASHBOARD]      Human reads results
         ↓
[BACK TO 1]                  Loop at 1-second tick
```

---

## Step 1: Data Ingestion

**What it does:** Connects to live market feeds, normalizes schema, maintains connection.

**Feeds:**

| Source | Data | API | Cost |
|--------|------|-----|------|
| Polymarket | Orderbook, trades, prices | WebSocket `wss://ws-subscriptions-clob.polymarket.com` | Free |
| Hyperliquid | L2 orderbook, trades, funding, liquidations | WebSocket `wss://ws.hyperliquid.com` | Free |
| GMX | Oracle prices, positions, funding | REST `https://gmx-api-*.ondigitalocean.app` | Free |

**What we normalize to:**

```typescript
interface NormalizedTrade {
  exchange: "polymarket" | "hyperliquid" | "gmx"
  market: string              // e.g., "BTC-PERP"
  price: number
  volume: number
  side: "buy" | "sell"
  timestamp: number           // Unix ms
}

interface NormalizedOrderbook {
  exchange: "polymarket" | "hyperliquid" | "gmx"
  market: string
  bids: [price: number, size: number][]
  asks: [price: number, size: number][]
  timestamp: number
}

interface NormalizedFunding {
  exchange: "hyperliquid" | "gmx"
  market: string
  rate_annualized: number
  timestamp: number
}

interface NormalizedLiquidation {
  exchange: "hyperliquid" | "gmx"
  market: string
  side: "long" | "short"
  size: number
  price: number
  timestamp: number
}
```

**What we build:**
- `FeedManager` class — manages WebSocket connections, auto-reconnect, heartbeat
- Per-feed adapters: `PolymarketAdapter`, `HyperliquidAdapter`, `GMXAdapter`
- Normalization layer: converts exchange-specific schema to `Normalized*` types
- Buffer: aggregates events into 1-second ticks for simulation engine

**What's plug-and-play:**
- All three exchanges have documented WebSocket APIs with free public access
- No auth required for market data

**What we build:** Normalization adapters (~200 lines each), reconnection logic.

---

## Step 2: Signal Detection

**What it does:** Monitors normalized feed data, fires events when thresholds are crossed.

**Built-in signals:**

| Signal | Source | Threshold | Fire Condition |
|--------|--------|-----------|----------------|
| RSI_OVERSOLD | Price | 30 | RSI(14) crosses below 30 |
| RSI_OVERBOUGHT | Price | 70 | RSI(14) crosses above 70 |
| FUNDING_SPIKE | Funding rate | +0.01% / hr | Funding rate increases 3x in 5min |
| LIQUIDATION_CASCADE | Liquidations | $50K / 5min | Liquidations exceed threshold |
| VOLUME_SPIKE | Volume | 3x ADV | Volume > 3x average in 5min |
| OI_SPIKE | Open Interest | +10% / 1hr | OI changes by >10% |
| ORDERBOOK_IMBALANCE | Orderbook | < -0.25 or > 0.25 | Bid-ask depth imbalance crosses threshold |
| SPREAD_WIDEN | Orderbook | 2x rolling avg | Spread exceeds 2x 1hr average |

**Signal output:**

```typescript
interface Signal {
  id: string
  type: SignalType
  market: string
  value: number
  threshold: number
  direction: "above" | "below"
  timestamp: number
  confidence: number  // 0-1, based on how far past threshold
}
```

**What we build:**
- `SignalDetector` class — runs on each tick, computes all indicators
- Indicator library: RSI, MACD, Bollinger Bands, ATR (use `pandas-ta` or `tulipy`)
- Threshold registry: configurable per-market thresholds
- Signal aggregator: groups simultaneous signals into `Event`

**What's plug-and-play:**
- `pandas` (free), `numpy` (free), `tulipy` (free) for indicators
- Threshold configuration is just config, no code

**What we build:** `SignalDetector` (~300 lines), threshold config schema.

---

## Step 3: Archetype Decision

**What it does:** When an event fires, each active archetype reasons about what to do.

**Archetypes (from tournament data):**

```typescript
interface Archetype {
  id: string
  name: string
  description: string
  system_prompt: string
  params: {
    spend_rate_by_stage: [number, number, number]  // early/mid/late
    reaction_latency_ms: number
    rescind_propensity: number       // 0-1
    position_awareness: number      // 0-1, does rank affect behavior?
    threshold_sensitivity: number   // how extreme does signal need to be?
  }
  scale_factor: number               // 1 agent call = N market participants
}

const ARCHETYPES: Archetype[] = [
  {
    id: "aggressive_frontloader",
    name: "Aggressive Front-loader",
    system_prompt: "You are an aggressive momentum trader...",
    params: { spend_rate_by_stage: [0.7, 0.2, 0.1], reaction_latency_ms: 200, ... },
    scale_factor: 15
  },
  {
    id: "conservative_hoarder",
    name: "Conservative Hoarder",
    system_prompt: "You are a patient value investor...",
    params: { spend_rate_by_stage: [0.2, 0.3, 0.5], reaction_latency_ms: 2000, ... },
    scale_factor: 25
  },
  {
    id: "adaptive_counter",
    name: "Adaptive Counter",
    system_prompt: "You are an adaptive counter-trader...",
    params: { spend_rate_by_stage: [0.4, 0.4, 0.2], reaction_latency_ms: 800, ... },
    scale_factor: 20
  },
  {
    id: "opportunistic_cheapwinner",
    name: "Opportunistic Cheap-Winner",
    system_prompt: "You are an opportunistic trader...",
    params: { spend_rate_by_stage: [0.5, 0.3, 0.2], reaction_latency_ms: 500, ... },
    scale_factor: 30
  },
  {
    id: "dormant",
    name: "Dormant",
    system_prompt: "You are a sidelined participant...",
    params: { spend_rate_by_stage: [0.1, 0.1, 0.1], reaction_latency_ms: 99999, ... },
    scale_factor: 10
  }
]
```

**LLM prompt (per decision):**

```
SYSTEM: {archetype.system_prompt}

USER:
## MARKET STATE
- Market: {market}
- Price: ${price} ({change_24h})
- Orderbook Imbalance: {obi} (negative = sell pressure)
- Funding Rate: {funding_rate}% annualized
- RSI(14): {rsi}
- Liquidations (5min): ${liquidation_vol}

## YOUR STATE
- Position: {position_size} @ ${entry_price}
- Unrealized P&L: ${unrealized_pnl}
- Liquidation Price: ${liq_price}
- Budget Remaining: ${budget}
- Current Rank: {rank} of {total}

## RECENT CASCADE
{history_summary}

## SIGNAL THAT WOKE YOU
{signal_description}

What do you do? Return JSON:
{
  "action": "HOLD | BUY | SELL | PARTIAL_EXIT | FULL_EXIT | RESCIND",
  "size": number,       // fraction of position or budget
  "reasoning": string  // 1-2 sentences
}
```

**What we build:**
- `ArchetypeEngine` class — manages LLM calls per archetype
- Prompt templating with market state injection
- Response parsing (JSON extraction from LLM output)
- Caching: if same market state hash recurs within 5s, reuse prior decision
- Async batching: fire all archetype LLM calls concurrently, aggregate results

**What's plug-and-play:**
- Ollama (`ollama.com`) — free, self-hosted, fast enough
- Model: `llama3.3:70b` or `qwen2.5:72b` on a cloud GPU (~$2/hr on AWS)

**What we build:** `ArchetypeEngine` (~400 lines), prompt templates, response parser.

**Cost benchmark:**
- 1 archetype decision: ~800ms Ollama inference on A100
- 5 archetypes × 1 decision = 5 × 800ms = 4 seconds per event tick
- With caching: most ticks hit cache, LLM rarely fires
- Cost: ~$0.001 per decision (self-hosted) vs $0.50+ (OpenAI)

---

## Step 4: Clearing Engine

**What it does:** Takes archetype actions, applies them to the market state, resolves orders.

**For this version:** We use a simplified clearing model since we're simulating, not actually trading.

```typescript
interface Order {
  id: string
  agent_id: string
  archetype: string
  market: string
  side: "buy" | "sell"
  size: number
  type: "market" | "limit"
  price: number | null  // null for market orders
  timestamp: number
}

interface ClearedOrder {
  order: Order
  filled_price: number
  filled_size: number
  slippage: number  // vs mid-price at submission
  status: "filled" | "partial" | "cancelled"
}

function clearOrders(orders: Order[], orderbook: NormalizedOrderbook): ClearedOrder[] {
  // For market orders: walk the book until size is filled
  // For limit orders: check if price crosses spread
  // Calculate slippage = (filled_price - mid_price) / mid_price
  // Return fills with size, price, slippage
}
```

**For Vickrey (tournament) mode:**
- Second-price: winner pays second-highest bid + $0.01
- Rescind: mark bid as cancelled, return funds to agent budget

**What we build:**
- `ClearingEngine` class (~200 lines)
- `OrderBook` class — maintains bid/ask queues
- Slippage calculator using current orderbook state

**What's plug-and-play:** Nothing — this is custom logic for the simulation.

---

## Step 5: Cascade Propagation

**What it does:** Agent decisions produce market moves, which trigger new signals, which wake new agents.

**Cascade graph:**

```typescript
interface CascadeNode {
  step: number
  depth: number                    // 0 = initial event, 1 = first-order effects, etc.
  trigger_signal: Signal
  responding_archetypes: ArchetypeAction[]
  market_delta: {
    price_change_pct: number
    volume_change_pct: number
    new_rsi: number
    new_funding: number
  }
  triggered_signals: Signal[]      // signals that fired as a result
  child_nodes: CascadeNode[]
}

function propagate(decision: ArchetypeAction, state: MarketState): CascadeNode {
  // Apply archetype action to market state
  // Compute resulting price/volume/indicator changes
  // Run signal detector on new state → new signals
  // Recurse: for each new signal, wake relevant archetypes
  // Stop when: depth > MAX_CASCADE_DEPTH (5) or no new signals
}
```

**Cascade limits:**
- Max depth: 5 (configurable)
- Max nodes per cascade: 50 (prevent infinite loops)
- Auto-terminate if signal repeats within 3 steps

**What we build:**
- `CascadeEngine` class (~300 lines)
- DAG structure for cascade tree
- Cycle detection (prevent infinite loops)

**What's plug-and-play:** Nothing — cascade logic is custom.

---

## Step 6: State Update

**What it does:** Maintains simulation state across ticks, tracks portfolio impact.

```typescript
interface SimulationState {
  tick: number
  timestamp: number
  markets: Map<string, MarketState>
  agents: Map<string, AgentState>
  positions: Map<string, Position>
  cascade_tree: CascadeNode[]
  metrics: {
    portfolio_pnl: number
    portfolio_value: number
    unrealized_pnl: number
    realized_pnl: number
    max_drawdown: number
    var_95: number  // Value at Risk, 95th percentile
  }
}

interface MarketState {
  market: string
  price: number
  price_history: number[]  // rolling 100
  rsi: number
  macd: { value: number, signal: number, histogram: number }
  funding_rate: number
  volume_24h: number
  orderbook_imbalance: number
  liquidations_5min: number
}

interface AgentState {
  id: string
  archetype: string
  budget: number
  spent: number
  stage_points: number
  rank: number
}

interface Position {
  agent_id: string
  market: string
  side: "long" | "short"
  size: number
  entry_price: number
  current_price: number
  unrealized_pnl: number
  liquidation_price: number | null
}
```

**What we build:**
- `StateManager` class (~200 lines)
- In-memory state store (fast reads/writes)
- Snapshot every cascade step for replay
- Metrics computation: P&L, drawdown, VaR

**What's plug-and-play:** Nothing — this is our core data model.

---

## Step 7: Output / Dashboard

**What it does:** Human reads simulation results. Web UI.

**Dashboard pages:**

1. **Scenario Runner** — Select event type, market, magnitude. Run simulation. See cascade.
2. **Portfolio Impact** — Upload portfolio. See P&L at each cascade step.
3. **Archetype Behavior** — See what each archetype did, reasoning traces, decision distribution.
4. **Historical Backtest** — Replay Luna/FTX/May2022. Compare simulated vs actual.
5. **Settings** — Configure thresholds, archetype params, feed connections.

**Charts:**
- Cascade timeline: which signals fired when, which archetypes responded
- Price chart with cascade markers
- Portfolio P&L waterfall
- Archetype action distribution (pie chart)

**Tech stack:**
- Frontend: Next.js + Tailwind + Recharts
- Backend: FastAPI (Python) or Node.js
- WebSocket: Socket.io for real-time dashboard updates
- Deploy: Docker on AWS/Azure

**What's plug-and-play:**
- Next.js (free, MIT)
- Recharts (free, MIT)
- Tailwind (free, MIT)
- Socket.io (free, MIT)

**What we build:** Dashboard UI (~800 lines), WebSocket integration.

---

## What We Build vs What's Open Source

| Component | Build/Buy | Effort |
|-----------|-----------|--------|
| Feed adapters (Polymarket, Hyperliquid, GMX) | Build | ~2 days each |
| Normalization layer | Build | ~1 day |
| Signal detector + indicators | Build | ~3 days |
| LLM archetype engine + Ollama | Buy (Ollama free) | ~4 days |
| Clearing engine | Build | ~3 days |
| Cascade engine | Build | ~4 days |
| State manager | Build | ~2 days |
| Dashboard UI | Build | ~5 days |
| WebSocket / real-time | Buy (Socket.io) | ~1 day |
| Docker deployment | Buy (Docker, AWS) | ~2 days |

**Total engineering: ~3-4 weeks for one engineer**

---

## Hard Dependencies Before We Start

1. **Ollama installed** on a machine with GPU (A100 or H100)
2. **Hyperliquid WebSocket** tested and connected
3. **Polymarket WebSocket** tested and connected
4. **Archetype prompts** written and validated (3-5 examples each)
5. **Backtest data** downloaded from Hyperliquid S3 for one historical event

---

## Immediate Next Steps (This Week)

1. Wire Hyperliquid WebSocket → normalize → log to console
2. Wire Polymarket WebSocket → normalize → log to console
3. Implement RSI and orderbook imbalance signal detector
4. Write archetype prompts for 3 archetypes (aggressive, conservative, adaptive)
5. Connect Ollama → run archetype decision on live signal
6. Build clearing engine (simplified: market orders only)
7. Build cascade engine (depth=3 max)
8. Dashboard: scenario runner + cascade timeline

---

## Tech Stack Summary

```
FEEDS
├── Polymarket WebSocket (free)
├── Hyperliquid WebSocket (free)
└── GMX REST (free)

COMPUTE
├── Ollama + Llama 3.3 (self-hosted GPU, ~$2/hr)
├── Python / asyncio (simulation engine)
└── NumPy + Pandas (indicators)

STATE
├── In-memory (simulation tick)
└── PostgreSQL (historical runs)

FRONTEND
├── Next.js + Tailwind + Recharts
└── Socket.io (real-time)

DEPLOY
├── Docker
└── AWS (1x A100 instance: ~$2-3/hr)
```

---

*Let's ship.*
