# Two-Sided Compute Auction - Design System & UX Spec

## Overview
A **true two-sided market** where:
- **SUPPLY SIDE**: Cloud providers (AWS, GCP, Azure) offer compute with descending ask prices
- **DEMAND SIDE**: Buyers submit ascending bid prices
- **CLEARING**: Trade occurs when bid ≥ ask, at the crossing price

## Core UX Concept: "The Convergence"

Visual metaphor: Two opposing forces (supply vs demand) moving toward equilibrium.

```
     ASK (Supply)                    BID (Demand)
        ↓                               ↑
   $20 ────────────────────────────────── $8
   $18 ───╲──────────────────────────╱── $10
   $16 ─────╲──────────────────────╱──── $12
   $14 ───────╲──────────────────╱────── $14 ← TRADE!
   $12 ─────────╲──────────────╱──────── $16
   $10 ───────────╲──────────╱────────── $18
    $8 ─────────────╲──────╱──────────── $20
        └─────────────────────────────┘
              TIME →
```

## Design Tokens

### Colors (Dark Theme)
```css
/* Background */
--bg-primary: #0a0f1a;
--bg-secondary: #111827;
--bg-tertiary: #1f2937;
--bg-elevated: #374151;

/* Text */
--text-primary: #f9fafb;
--text-secondary: #9ca3af;
--text-muted: #6b7280;

/* Accents */
--ask-color: #f87171;      /* Red - supply descending */
--bid-color: #34d399;      /* Green - demand ascending */
--trade-color: #fbbf24;    /* Amber - match/clearing */
--neutral: #60a5fa;        /* Blue - general UI */

/* Gradients */
--ask-gradient: linear-gradient(180deg, #ef4444, #dc2626);
--bid-gradient: linear-gradient(180deg, #10b981, #059669);
--convergence-glow: radial-gradient(circle, rgba(251, 191, 36, 0.3), transparent 70%);
```

### Typography
```css
--font-display: 'Inter', sans-serif;
--font-mono: 'JetBrains Mono', monospace;
--font-numeric: 'IBM Plex Mono', monospace;  /* For prices */

/* Scale */
--text-xs: 0.75rem;
--text-sm: 0.875rem;
--text-base: 1rem;
--text-lg: 1.125rem;
--text-xl: 1.25rem;
--text-2xl: 1.5rem;
--text-3xl: 2rem;
```

### Spacing & Motion
```css
/* Spacing */
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-6: 1.5rem;
--space-8: 2rem;
--space-12: 3rem;

/* Radius */
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-full: 9999px;

/* Animation */
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
--duration-fast: 150ms;
--duration-normal: 300ms;
--duration-slow: 500ms;
```

## Key Components

### 1. Convergence Clock (Hero Component)

The centerpiece - visualizes the two-sided price movement.

```
┌─────────────────────────────────────────────────┐
│  SUPPLY                      DEMAND             │
│  ───────                     ──────             │
│                                                 │
│  ┌──────┐                  ┌──────┐            │
│  │ $18  │  ╲            ╱  │ $10  │            │
│  └──────┘   ╲          ╱   └──────┘            │
│              ╲        ╱                         │
│  ┌──────┐     ╲      ╱     ┌──────┐            │
│  │ $16  │      ╲    ╱      │ $12  │            │
│  └──────┘       ╲  ╱       └──────┘            │
│                  ╲╱                             │
│              ╔═══════╗                          │
│              ║ $14.5 ║ ← CURRENT SPREAD        │
│              ╚═══════╝                          │
│                                                 │
│  [=================>]    [<=================]   │
│   Period 8/20              Period 8/20         │
└─────────────────────────────────────────────────┘
```

**Visual Details:**
- Left side (Ask): Red gradient bar descending
- Right side (Bid): Green gradient bar ascending
- Center: Current spread with glow effect when narrow
- Timeline: Shows position in auction

### 2. Order Book Display

Live view of pending bids and asks.

```
┌──────────────────────────────────────────────┐
│           ORDER BOOK                          │
├──────────────────┬───────────────────────────┤
│ ASKS (Supply)    │ BIDS (Demand)             │
├──────────────────┼───────────────────────────┤
│ $20.00  500u  ▼ │ ▲  $8.00   200u          │
│ $18.50  300u  ▼ │ ▲  $10.50  150u          │
│ $17.00  400u  ▼ │ ▲  $12.00  300u          │
│ $16.00  250u  ▼ │ ▲  $13.50  100u          │
│                  │                           │
│ ════════════════╪════════════════════════ │
│                  │                           │
│                  │ ▲  $14.00  200u ← BEST │
├──────────────────┴───────────────────────────┤
│ SPREAD: $2.00 │ MATCHES READY: 3           │
└──────────────────────────────────────────────┘
```

### 3. Participant Cards

Profile cards for each bidder/supplier.

```
┌─────────────────────────────────────┐
│  ┌────┐                             │
│  │ AI │  llm_agent                  │
│  └────┘  ━━━━━━━━━━━━ $5,000       │
│          Agent Type: Strategic       │
│                                      │
│  Last Action: BID $14.00            │
│  Strategy: "Competition heating up"  │
│                                      │
│  [View Scratchpad] [Adjust Bid]    │
└─────────────────────────────────────┘
```

### 4. Trade Execution Animation

When a match occurs:

1. **Approach**: Bid and ask lines accelerate toward center
2. **Flash**: Golden glow at intersection point
3. **Ripple**: Expanding ring from trade point
4. **Settle**: Price locks, particles settle into "TRADE" badge

```
Frame 1:      Frame 5:      Frame 10:     Frame 15:
  $14          $14✦          ✨$14.50✨      [TRADE]
   ↕             ↕               ↕         $14.50
  $15           $15             $15      
```

### 5. Market Depth Visualization

Area chart showing cumulative supply vs demand.

```
Price
  │    ╱╲
  │   ╱  ╲
  │  ╱    ╲     Supply (red area)
  │ ╱      ╲
  │╱   XX   ╲
  │   XXXX   ╲  ← Crossing point
  │  XXXXXX   ╲
  │ XXXXXXXX   ╲ Demand (green area)
  └──────────────
     Quantity
```

## UX Flow: Two-Sided Auction

### Phase 1: Registration (T-30s)
```
1. Suppliers set: Initial ask price, quantity, min ask
2. Buyers set: Initial bid price, quantity, max bid
3. System calculates: Price decay/advance rates
```

### Phase 2: Active Trading (T-0 to T-end)
```
1. Prices update each period:
   - Ask decreases by (initial_ask - min_ask) / periods
   - Bid increases by (max_bid - initial_bid) / periods
   
2. Agents can:
   - ACCEPT current price (immediate match)
   - ADJUST their price (jump to new level)
   - WITHDRAW (exit auction)
   
3. System checks: If any bid ≥ any ask → TRADE
   - Match highest bid with lowest ask first
   - Clear at average of the two prices
   - Both parties pay/receive clearing price
```

### Phase 3: Settlement
```
1. Unmatched orders expire
2. Partial fills possible (if quantities differ)
3. Results posted to all participants
4. New auction prep begins
```

## Interaction Patterns

### For LLM Agent
```
┌─────────────────────────────────────────────┐
│ AGENT DECISION INTERFACE                    │
├─────────────────────────────────────────────┤
│                                             │
│ MARKET STATE:                               │
│  Best Ask: $15.00 (AWS, 500 units)         │
│  Best Bid: $12.50 (You, 200 units)         │
│  Spread: $2.50                              │
│  Period: 8/20                               │
│                                             │
│ PREDICTION:                                 │
│  • Ask will reach $14.00 in 2 periods      │
│  • Bid may reach $14.00 in 3 periods       │
│  • Suggested action: ADJUST to $13.75      │
│                                             │
│ ┌─────────────────────────────────────────┐  │
│ │ SCRATCHPAD:                             │  │
│ │ Period 6: "Waiting for spread to      │  │
│ │            narrow. Competition from      │  │
│ │            GCP aggressive."             │  │
│ │ Period 7: "Azure just dropped ask.      │  │
│ │            Market moving fast."         │  │
│ └─────────────────────────────────────────┘  │
│                                             │
│ [ADJUST BID] [ACCEPT NOW] [WITHDRAW]       │
└─────────────────────────────────────────────┘
```

### For MDP Scripts
Each script sees:
- Full order book (all bids/asks)
- Their own position in the book
- Historical clearing prices
- Current spread

Decision: "Should I adjust my ask/bid, accept now, or wait?"

## Responsive Behavior

### Desktop (1200px+)
- Full convergence clock visible
- Side-by-side order book
- Full participant cards

### Tablet (768px)
- Stacked layout
- Convergence clock compact
- Collapsible order book

### Mobile (< 768px)
- Single column
- Tabbed navigation (Supply/Demand)
- Simplified charts

## Accessibility

- Color not sole indicator (icons + labels)
- Price differences announced via aria-live
- Keyboard navigation for all actions
- Reduced motion option for animations
- High contrast mode support

## Animation Principles

1. **Bidirectional Movement**: Supply down, demand up (opposing directions)
2. **Speed = Urgency**: Faster movement as auction progresses
3. **Glow = Opportunity**: Golden glow when spread is narrow
4. **Pulse = Activity**: Participant activity pulses
5. **Settle = Satisfaction**: Smooth settle on trade completion

## Next Steps for Implementation

1. Build ConvergenceClock component
2. Create OrderBook with real-time updates
3. Implement TradeAnimation
4. Add MarketDepth chart
5. Wire up LLM agent decision interface
6. Create MDP script decision hooks