# User Questions → Simulation Engine: Design Doc
**Version:** 1.0
**Date:** 2026-03-31
**Authors:** Spark (user workflow), Charge (statistical methods)

---

## Overview

This document covers two things:
1. **User-to-Simulation mapping** — how PORT and GMM questions become calibrated simulations
2. **Data requirements** — what datasets we need and where they come from
3. **Roadmap** — crypto → equities → fixed income

---

## Part 1: From User Question to Simulation

### The Core Workflow

```
USER QUESTION (natural language)
    ↓
[INTENT CLASSIFIER] — What type of stress test?
    ↓
[HYPOTHESIS EXTRACTOR] — What event? What market? What portfolio?
    ↓
[PARAMETER CONFIGURATOR] — Event magnitude, timing, archetype mix
    ↓
[SIGNAL INJECTOR] — Feed event into simulation engine
    ↓
[CASCADE RUNNER] — N Monte Carlo runs
    ↓
[OUTPUT AGGREGATOR] — P&L distribution, risk metrics
    ↓
USER READS RESULTS
```

---

### Step 1: Intent Classification

**What it does:** Parses the user's question into one of 4 simulation archetypes.

**The 4 question types:**

| Intent | Example Question | What happens |
|--------|-----------------|-------------|
| **PORT_STRESS** | "What happens to my BTC perp positions if liquidations cascade?" | Load positions, inject liquidation cascade, measure P&L |
| **MARKET_REGIME** | "What happens when funding rates spike during a bull market?" | Load archetype distribution for bull regime, run cascade |
| **CROSS_ASSET** | "How does a SOL perp crash affect my ETH delta-neutral position?" | Load correlated asset model, run cross-asset cascade |
| **BLACK_SWAN** | "What if BTC drops 30% in an hour?" | Load historical event parameters, scale to magnitude, run cascade |

**Implementation:**

```python
INTENT_PATTERNS = {
    "PORT_STRESS": [
        r"my position",
        r"portfolio",
        r"if.*(drop|crash|plunge|liquidat)",
        r"what happens to.*btc|eth|sol"
    ],
    "MARKET_REGIME": [
        r"if funding.*spike",
        r"during.*(bull|bear) market",
        r"what happens when.*funding"
    ],
    "CROSS_ASSET": [
        r"affect.*eth",
        r"sol.*impact",
        r"cross.*asset",
        r"correlat"
    ],
    "BLACK_SWAN": [
        r"drop.*30%",
        r"what if.*crash",
        r"black swan",
        r"tail risk"
    ]
}

def classify_intent(question: str) -> str:
    for intent, patterns in INTENT_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, question, re.IGNORECASE):
                return intent
    return "PORT_STRESS"  # default
```

---

### Step 2: Hypothesis Extraction

**What it does:** Pulls the specific parameters from the question.

**Parameters to extract:**

```python
@dataclass
class HypothesisParams:
    # Market context
    primary_market: str          # "BTC-PERP", "ETH-PERP"
    secondary_markets: list[str] # ["SOL-PERP"]
    
    # Event type
    event_type: EventType        # LIQUIDATION_CASCADE, FUNDING_SPIKE, 
                                 # PRICE_SHOCK, VOLUME_SPIKE, OI_SPIKE
    event_magnitude: float      # e.g., 0.10 for 10%, -0.30 for 30% drop
    event_duration_sec: float   # How fast the event unfolds
    
    # Portfolio context
    user_positions: list[Position]  # From PORT
    user_portfolio_value: float
    
    # Simulation parameters
    num_mc_runs: int            # Default: 500
    cascade_depth: int           # Default: 5
    time_horizon_min: int        # How far to simulate: 60 = 1 hour
```

**Extraction rules:**

```
"if BTC drops 30%" 
    → event_type: PRICE_SHOCK
    → event_magnitude: -0.30
    → primary_market: "BTC-PERP"

"my BTC-PERP position" + "liquidations cascade"
    → event_type: LIQUIDATION_CASCADE
    → primary_market: "BTC-PERP"
    → user_positions: load from PORT

"What if SOL perp crash affects my ETH delta-neutral"
    → event_type: PRICE_SHOCK
    → primary_market: "SOL-PERP"
    → secondary_markets: ["ETH-PERP"]
    → event_magnitude: infer from historical SOL crash data
```

---

### Step 3: Parameter Configuration

**What it does:** Maps extracted parameters to archetype configs and signal thresholds.

**Configuration schema:**

```python
@dataclass
class SimulationConfig:
    # Event configuration
    event: HypothesisParams
    
    # Market parameters (from calibration)
    market_params: MarketParams
    #   - Kyle's lambda (price impact coefficient)
    #   - volatility σ
    #   - orderbook depth
    #   - liquidity recovery half-life
    
    # Archetype configuration
    archetypes: list[ArchetypeConfig]
    #   - Which archetypes to activate
    #   - Scale factors (1 archetype = N agents)
    #   - Latency distributions
    
    # Simulation parameters
    num_runs: int               # 500 Monte Carlo runs
    time_step_sec: int          # 1 second ticks
    cascade_max_depth: int       # 5 steps max
```

**Archetype activation by event type:**

```python
ARCHETYPE_ACTIVATION = {
    EventType.LIQUIDATION_CASCADE: {
        "aggressive_frontloader": {"scale": 15, "latency_ms": 200},
        "conservative_hoarder": {"scale": 25, "latency_ms": 2000},
        "adaptive_counter": {"scale": 20, "latency_ms": 800},
    },
    EventType.FUNDING_SPIKE: {
        "conservative_hoarder": {"scale": 30, "latency_ms": 1500},
        "adaptive_counter": {"scale": 20, "latency_ms": 500},
        "opportunistic_cheapwinner": {"scale": 25, "latency_ms": 300},
    },
    EventType.PRICE_SHOCK: {
        "aggressive_frontloader": {"scale": 20, "latency_ms": 100},
        "opportunistic_cheapwinner": {"scale": 30, "latency_ms": 200},
    }
}
```

---

### Step 4: Signal Injection

**What it does:** Converts the event hypothesis into a simulation signal.

```python
def inject_event(config: SimulationConfig) -> Signal:
    """Convert hypothesis to a Signal the cascade engine can process."""
    
    if config.event.event_type == EventType.LIQUIDATION_CASCADE:
        # Calculate liquidation size from event_magnitude and market depth
        liq_size = estimate_liquidation_volume(
            market=config.event.primary_market,
            price_move_pct=config.event.event_magnitude,
            orderbook_depth=config.market_params.orderbook_depth
        )
        return Signal(
            type=SignalType.LIQUIDATION_CASCADE,
            market=config.event.primary_market,
            value=liq_size,
            trigger_price_change=config.event.event_magnitude,
            timestamp=0  # T=0 of simulation
        )
    
    elif config.event.event_type == EventType.PRICE_SHOCK:
        return Signal(
            type=SignalType.PRICE_SHOCK,
            market=config.event.primary_market,
            value=config.event.event_magnitude,  # e.g. -0.30
            trigger_price_change=config.event.event_magnitude,
            timestamp=0
        )
    
    elif config.event.event_type == EventType.FUNDING_SPIKE:
        return Signal(
            type=SignalType.FUNDING_SPIKE,
            market=config.event.primary_market,
            value=config.event.event_magnitude,
            trigger_funding_change=config.event.event_magnitude,
            timestamp=0
        )
```

---

### Step 5: Cascade Running

**What it does:** Runs N Monte Carlo simulations and collects outcomes.

```python
async def run_simulation(config: SimulationConfig) -> SimulationResult:
    """Run N Monte Carlo cascade simulations."""
    
    outcomes = []
    
    for run_id in range(config.num_runs):
        # Initialize market state (from real data snapshot)
        state = await load_market_state(config.event.primary_market)
        
        # Inject event at T=0
        signal = inject_event(config)
        cascade_tree = [signal]
        
        step = 0
        while step < config.cascade_max_depth:
            # Detect which archetypes respond to current signals
            responding = get_responding_archetypes(
                signals=cascade_tree[-1],
                archetypes=config.archetypes,
                state=state
            )
            
            # For each responding archetype, run LLM decision
            archetype_decisions = []
            for archetype in responding:
                decision = await archetype.decide(
                    market_state=state,
                    signal=cascade_tree[-1],
                    archetype_params=archetype.params
                )
                # Scale by archetype count
                archetype_decisions.append({
                    "archetype": archetype,
                    "scaled_action": scale_by_archetype_count(
                        decision, archetype.scale_factor
                    )
                })
            
            # Aggregate decisions → market impact
            market_delta = compute_market_delta(
                decisions=archetype_decisions,
                market_params=config.market_params
            )
            
            # Update state
            state = apply_delta(state, market_delta)
            
            # Check for new signals (cascade trigger)
            new_signals = detect_signals(state)
            if not new_signals:
                break
            
            cascade_tree.extend(new_signals)
            step += 1
        
        # Record outcome for this run
        outcomes.append({
            "run_id": run_id,
            "cascade_tree": cascade_tree,
            "final_state": state,
            "portfolio_pnl": compute_portfolio_pnl(
                state, config.event.user_positions
            ),
            "max_drawdown": compute_max_drawdown(state)
        })
    
    return aggregate_outcomes(outcomes)
```

---

### Step 6: Output Aggregation

**What it does:** Turns N Monte Carlo runs into a distribution + risk metrics.

```python
@dataclass
class SimulationResult:
    # Distribution summary
    pnl_mean: float
    pnl_median: float
    pnl_std: float
    pnl_percentile_5: float
    pnl_percentile_95: float
    pnl_percentile_1: float   # Tail
    pnl_percentile_99: float  # Tail
    
    # Risk metrics
    var_95: float             # Value at Risk, 95th percentile
    var_99: float             # Value at Risk, 99th percentile
    cvar_95: float            # Conditional VaR (Expected Shortfall)
    cvar_99: float
    max_drawdown_pct: float
    
    # Cascade stats
    avg_cascade_depth: float
    cascade_depth_distribution: dict[int, float]
    
    # Archetype behavior summary
    archetype_action_counts: dict[str, int]  # Which archetypes fired most
    archetype_exit_rates: dict[str, float]   # % of archetype positions exited
    
    # Per-step breakdown
    step_by_step_pnl: list[dict]  # P&L at each cascade step

def aggregate_outcomes(outcomes: list) -> SimulationResult:
    pnls = [o["portfolio_pnl"] for o in outcomes]
    drawdowns = [o["max_drawdown"] for o in outcomes]
    
    return SimulationResult(
        pnl_mean=np.mean(pnls),
        pnl_median=np.median(pnls),
        pnl_std=np.std(pnls),
        pnl_percentile_5=np.percentile(pnls, 5),
        pnl_percentile_95=np.percentile(pnls, 95),
        pnl_percentile_1=np.percentile(pnls, 1),
        pnl_percentile_99=np.percentile(pnls, 99),
        var_95=np.percentile(pnls, 5),
        var_99=np.percentile(pnls, 1),
        cvar_95=np.mean([p for p in pnls if p <= np.percentile(pnls, 5)]),
        cvar_99=np.mean([p for p in pnls if p <= np.percentile(pnls, 1)]),
        max_drawdown_pct=max(drawdowns),
        avg_cascade_depth=np.mean([len(o["cascade_tree"]) for o in outcomes]),
        cascade_depth_distribution=compute_depth_histogram(outcomes),
        archetype_action_counts=aggregate_archetype_actions(outcomes),
        archetype_exit_rates=aggregate_exit_rates(outcomes),
        step_by_step_pnl=compute_step_pnl(outcomes)
    )
```

---

## Part 2: Data Requirements

### Real-Time Data Feeds

| Source | Data | Latency | Cost | Use |
|--------|------|---------|------|-----|
| Hyperliquid | L2 orderbook, trades, funding, liquidations | ~50ms | Free | Primary price feed, signal detection |
| Polymarket | Orderbook, trades, belief markets | ~100ms | Free | Belief signals, event triggers |
| GMX | Oracle prices, positions, funding | ~1s | Free | Liquidation confirmation |

**Real-time schema:**

```python
# Continuous tick buffer (1-second resolution)
@dataclass
class TickData:
    timestamp: int  # Unix seconds
    market: str
    price: float
    volume: float
    bid_depth_10: float   # Sum of top 10 bid sizes
    ask_depth_10: float   # Sum of top 10 ask sizes
    funding_rate: float
    liquidations_5min: float
```

---

### Historical Data

**Hyperliquid S3 (for calibration)**

```
s3://hyperliquid-archive/market_data/[date]/[hour]/l2Book/[coin].lz4
s3://hyperliquid-archive/asset_ctxs/[date].csv.lz4
s3://hl-mainnet-node-data/node_fills_by_block
s3://hl-mainnet-node-data/node_trades
```

**What to download for calibration:**

| Dataset | Coverage | File Size | Use |
|---------|----------|-----------|-----|
| L2 orderbook snapshots | 90 days | ~50 GB | Calibrate Kyle's lambda, orderbook depth |
| Trade fills | 90 days | ~20 GB | Calibrate volatility, volume dynamics |
| Asset context (funding, OI) | 90 days | ~5 GB | Calibrate funding rate regimes |
| Liquidations | From fills data | Derived | Calibrate liquidation cascade dynamics |

**Download script:**

```python
import boto3
import lz4.block

def download_l2_for_date(date: str, coin: str, hour: int):
    """Download and decompress L2 orderbook snapshot."""
    s3 = boto3.client("s3")
    key = f"market_data/{date}/{hour:02d}/l2Book/{coin}.lz4"
    
    # Download
    obj = s3.get_object(Bucket="hyperliquid-archive", Key=key)
    compressed = obj["Body"].read()
    
    # Decompress
    decompressed = lz4.block.decompress(compressed)
    
    # Parse binary format (documented in Hyperliquid API)
    return parse_l2_snapshot(decompressed)
```

---

### Static Historical Event Catalog

For calibration, we need a catalog of known market events with parameters:

```python
@dataclass
class HistoricalEvent:
    event_id: str
    date: str
    event_type: EventType
    primary_market: str
    magnitude: float        # e.g. -0.40 for 40% drawdown
    duration_sec: int       # How fast it unfolded
    cascade_depth: int      # How many cascade steps observed
    sources: list[str]     # Bloomberg, CoinMarketCap, etc.

HISTORICAL_EVENTS = [
    # Crypto-specific
    HistoricalEvent("luna_2022", "2022-05-11", EventType.PRICE_SHOCK, 
                    "UST-PERP", -99.97, 3600, 12),
    HistoricalEvent("ftx_2022", "2022-11-11", EventType.LIQUIDATION_CASCADE,
                    "BTC-PERP", -25.0, 7200, 8),
    HistoricalEvent("mars_2024", "2024-03-14", EventType.FUNDING_SPIKE,
                    "ETH-PERP", +0.15, 1800, 4),  # Funding spiked to 15% annualized
    
    # Macro-adjacent (available via Polymarket resolution)
    HistoricalEvent("cpimiss_2025", "2025-01-15", EventType.MACRO_ANNOUNCEMENT,
                    "BTC-PERP", -3.2, 300, 3),
    
    # More to be added...
]
```

**Sources for event catalog:**
- CoinGecko / CoinMarketCap for price charts
- Hyperliquid liquidations API for cascade data
- Polymarket for belief resolution (confidence of event)
- Twitter/X for timing and narrative

---

## Part 3: Roadmap — Crypto → Equities → Fixed Income

### Phase 1: Crypto Native (Months 1-3)

**Target markets:**
- BTC-PERP, ETH-PERP, SOL-PERP (Hyperliquid)
- UST-PERP, ARB-PERP (if liquid enough)

**Data:**
- Hyperliquid WebSocket (real-time)
- Hyperliquid S3 (historical) — L2 + fills
- Polymarket WebSocket (belief signals)

**Calibration targets:**
- Kyle's lambda per market
- Orderbook replenishment rate
- Liquidation cascade timing
- Archetype parameter fine-tuning

**Deliverable:** MVP product — a risk officer at a DeFi protocol can run a BTC crash simulation against their Hyperliquid positions in under 5 minutes.

---

### Phase 2: Equities (Months 4-8)

**Target markets:**
- Tokenized equities via Hyperliquid HIP-3 (AAPL, TSLA, NVDA perps)
- Spot equity data from Polygon.io or similar

**What's different:**

| Dimension | Crypto | Equities |
|-----------|--------|----------|
| Market hours | 24/7 | Exchange hours (but crypto doesn't sleep) |
| Settlement | Real-time | T+2 |
| Volatility | Higher | Lower |
| Correlations | High within crypto | Cross-asset (equity-bond) |
| Data source | Hyperliquid native | Polygon.io, Alpaca |
| Archetypes | Crypto-native behaviors | Need new archetype calibrations |

**New archetypes for equities:**
```
conservative_long_investor: buys on dips, holds for quarters
momentum_trader: follows trends, exits on MA crossover
 earnings_calendar_trader: trades around earnings announcements
 sector_rotation_trader: rotates based on macro regime
```

**Data additions:**
```
- Polygon.io: historical OHLCV, earnings calendars
- Alpaca: real-time equity quotes
- FRED: macro indicators (CPI, NFP, Fed decisions)
```

---

### Phase 3: Fixed Income (Months 9-12)

**Target markets:**
- US Treasuries (via Chainlink Data Streams or Band Protocol)
- Corporate bonds (via Bloomberg or proprietary feed)
- Municipal bonds (via EMMA)

**What's different:**

| Dimension | Equities | Fixed Income |
|-----------|----------|--------------|
| Price drivers | Earnings, growth | Interest rates, credit spread |
| Volatility | σ-based | Duration-based |
| Liquidity | Orderbook | Quote-driven (less frequent) |
| Key signals | RSI, MACD | Yield curve slope, credit spread, Fed Funds |
| Regime indicators | Bull/Bear | Risk-on/risk-off |

**New archetypes for fixed income:**
```
duration_extender: adds duration when rates are falling
credit_spread_narrower: buys credit when spreads are tightening
fly_arbitrageur: trades the yield curve shape
flight_to_quality_buyer: buys treasuries when risk assets sell off
```

**Data additions:**
```
- FRED (Federal Reserve Economic Data): yield curve, credit spreads
- EMMA (Municipal Securities Rulemaking Board): muni data
- Bloomberg (via API): corporate bond prices and credit spreads
- Chainlink Data Streams: real-time RWA prices
```

---

### Phase 4: Cross-Asset Integration (Month 12+)

**The real product:**

```
Macro Event (Fed announcement)
    ↓
Crypto market responds (BTC drops 5%)
    ↓
Equity perps respond (HIP-3 AAPL drops 3%)
    ↓
Fixed income responds (Treasuries rally, credit spreads widen)
    ↓
User's cross-asset portfolio P&L computed at each step
```

**This is where the product defensibility lives.** Competitors will have single-asset simulations. We have the cascade engine that propagates across asset classes.

---

## Summary: Data Sources by Phase

| Phase | Data Source | Type | Cost |
|-------|-------------|------|------|
| 1 | Hyperliquid WS + S3 | Real-time + historical | Free + AWS egress |
| 1 | Polymarket WS | Real-time | Free |
| 2 | Polygon.io | Real-time + historical | ~$200/mo |
| 2 | Alpaca | Real-time | Free tier |
| 2 | FRED | Historical | Free |
| 3 | EMMA | Real-time | Free |
| 3 | Chainlink Data Streams | Real-time | Gas + credits |
| 3 | Bloomberg | Real-time | $25K+/mo |

---

*Note: Charge's statistical methods section follows below.*

---

# Statistical Methods for LLM Archetype Calibration
## ESL Technical Reference — Charge 🔋

---

## 1. Price Dynamics

### 1.1 Realized Volatility & Volatility Regime Detection

**What it does:**
Estimates true price volatility from tick data, separates regimes (low/high volatility states), and provides the volatility input that drives archetype position-sizing and margin behavior.

**What data it needs:**
- High-frequency trade data: `{timestamp, price, size, side}` at 100ms–1s resolution minimum
- Required history: 30–90 days for stable regime parameters, 5 days minimum for online updating

**How it maps to archetype behavior:**
- High-volatility regime → archetypes reduce position size, widen stop-losses, increase cash buffer
- Low-volatility regime → archetypes can deploy more capital, tighten spreads
- Volatility regime transitions trigger archetype state machine transitions (e.g., `TREND_follower::LOW_VOL → TREND_follower::HIGH_VOL`)

**Implementation:**

```python
import numpy as np
import pandas as pd
from dataclasses import dataclass

@dataclass
class VolatilityRegime:
    """Two-state Markov volatility model."""
    low_vol: float      # annualized, e.g., 0.40 (40%)
    high_vol: float     # annualized, e.g., 1.20 (120%)
    prob_high: float    # current probability of being in high-vol regime
    p11: float          # transition prob: low→low (persistence of low vol)
    p22: float          # transition prob: high→high (persistence of high vol)

def compute_realized_vol(trades: pd.DataFrame, freq: str = '1min') -> pd.Series:
    """
    trades: DataFrame with columns [timestamp, price, size, side]
    Returns: Realized volatility per bucket (log-return variance, annualized).
    """
    trades = trades.set_index('timestamp')
    resampled = trades['price'].resample(freq).last()
    log_returns = np.log(resampled / resampled.shift(1)).dropna()
    rv = (log_returns ** 2).resample('1D').sum()
    annualization = {'1min': np.sqrt(525600), '5min': np.sqrt(105120),
                     '1hour': np.sqrt(8760), '1day': np.sqrt(365)}[freq]
    return np.sqrt(rv) * annualization

def fit_volatility_regime(rv: pd.Series) -> VolatilityRegime:
    """Fit a two-state HMM to realized volatility series."""
    from sklearn.hmm import GaussianHMM
    X = rv.dropna().values.reshape(-1, 1)
    model = GaussianHMM(n_components=2, covariance_type='full', n_iter=1000, random_state=42)
    model.fit(X)
    means = model.means_.flatten()
    high_idx = np.argmax(means)
    low_idx = 1 - high_idx
    return VolatilityRegime(
        low_vol=float(np.sqrt(np.exp(means[low_idx]))),
        high_vol=float(np.sqrt(np.exp(means[high_idx]))),
        prob_high=float(model.predict_proba(X[-1:])[0][high_idx]),
        p11=float(model.transmat_[low_idx, low_idx]),
        p22=float(model.transmat_[high_idx, high_idx]),
    )
```

---

### 1.2 Jump Detection & Characterization

**What it does:**
Identifies discontinuous price jumps (news, liquidations, oracle failures) vs. continuous Brownian motion. Separating jumps is critical because archetype responses to jumps differ categorically from normal drift.

**What data it needs:**
- Same high-frequency trade data as realized volatility
- Baseline: 5-minute mid-price for jump testing

**How it maps to archetype behavior:**
- **Jump detection** → triggers archetype `ON_JUMP` event; market-maker archetypes widen spreads instantly; trend-follower archetypes might flip direction
- **Jump size characterization** → determines whether event is "noise" (1σ) or "tail" (>3σ) requiring full portfolio unwind

**Implementation:**

```python
from scipy import stats
from dataclasses import dataclass

@dataclass
class JumpEvent:
    timestamp: pd.Timestamp
    asset: str
    size_sigmas: float          # jump magnitude in local vol units
    is_up: bool
    half_life_ticks: int        # mean reversion speed after jump
    confidence: float            # test p-value

def detect_jumps(trades: pd.DataFrame,
                 price_col: str = 'price',
                 thresh: float = 5.0) -> list[JumpEvent]:
    """
    Bipower variation jump test (Barndorff-Nielsen & Shephard 2006).
    H0: no jump. Reject if |J_t| / σ_t > thresh.
    """
    trades = trades.set_index('timestamp')
    p = trades[price_col].resample('1min').last()
    dp = np.log(p / p.shift(1)).dropna()
    qv = (dp ** 2).sum()
    n = len(dp)
    bipower = (np.abs(dp.iloc[:n-1]) * np.abs(dp.iloc[1:])).sum() * np.pi / 2
    j = np.sqrt(np.maximum(qv - bipower, 0))
    T = len(dp)
    iv = bipower / T

    results = []
    local_vol = dp.rolling(20).std()
    z_scores = dp / local_vol

    for idx, (ts, z) in enumerate(z_scores.items()):
        if abs(z) > thresh:
            results.append(JumpEvent(
                timestamp=ts,
                asset=trades.get('symbol', 'UNKNOWN'),
                size_sigmas=float(z),
                is_up=z > 0,
                half_life_ticks=_estimate_half_life(dp, idx),
                confidence=float(2 * (1 - stats.norm.cdf(abs(z)))),
            ))
    return results

def _estimate_half_life(returns: pd.Series, jump_idx: int, window: int = 60) -> int:
    """Estimate how many ticks for price to half-revert after jump."""
    post_jump = returns.iloc[jump_idx:jump_idx + window]
    if len(post_jump) < 5:
        return window
    y = post_jump.iloc[1:].values
    X = np.column_stack([np.ones(len(y)), post_jump.iloc[:-1].values])
    try:
        beta = np.linalg.lstsq(X, y, rcond=None)[0]
        phi = beta[1]
        if phi < 0:
            return int(np.log(2) / np.log(1 / phi)) if phi < 1 else window
    except:
        pass
    return window
```

---

### 1.3 Cross-Asset Correlation Dynamics (DCC-GARCH)

**What it does:**
Estimates time-varying correlations between BTC, ETH, SOL perpetual returns. DCC (Dynamic Conditional Correlation) captures correlation regime shifts during market stress — critical for portfolio contagion modeling.

**What data it needs:**
- Synchronized minute-bar OHLCV for all three assets
- Training window: 60 days minimum

**How it maps to archetype behavior:**
- Correlation spike → cross-asset contagion risk; momentum archetypes rotate from solo positions to hedges
- Correlation breakdown (BTC up, SOL down) → divergence regime where stat-arb archetypes activate
- DCC parameters feed into archetype covariance matrix for mean-variance optimization

**Implementation:**

```python
from statsmodels.stats.moment_helpers import cov2corr
from dataclasses import dataclass

@dataclass
class DCCParams:
    alpha: float      # shock contribution to conditional correlation
    beta: float       # persistence of conditional correlation
    Q_bar: np.ndarray # unconditional correlation matrix (3x3)
    current_Q: np.ndarray  # time-t conditional correlation matrix

def fit_dcc_garch(returns_df: pd.DataFrame) -> DCCParams:
    """
    Engle (2002) DCC-GARCH fit for 3-asset returns.
    Step 1: Fit univariate GARCH(1,1) to each series.
    Step 2: Extract standardized residuals.
    Step 3: Fit DCC dynamics to standardized residuals.
    """
    n = len(returns_df.columns)
    assets = returns_df.columns.tolist()
    from arch import arch_model

    std_resids = pd.DataFrame(index=returns_df.index, columns=assets)

    for asset in assets:
        am = arch_model(returns_df[asset] * 100, vol='Garch', p=1, q=1, dist='t')
        res = am.fit(disp='off', show_warning=False)
        std_resids[asset] = res.resid / res.conditional_volatility

    std_resids = std_resids.astype(float)
    Q_bar = std_resids.iloc[:500].cov().values
    Q_t = Q_bar.copy()

    def dcc_loglik(alpha, beta, eps):
        T, n = eps.shape
        Q_t = Q_bar.copy()
        ll = 0.0
        for t in range(1, T):
            e_tm1 = eps.iloc[t - 1].values
            Q_t = (1 - alpha - beta) * Q_bar + \
                  alpha * np.outer(e_tm1, e_tm1) + beta * Q_t
            Q_t_corr = cov2corr(Q_t)
            e_t = eps.iloc[t].values
            try:
                inv_Q = np.linalg.inv(Q_t_corr)
                ll_t = -0.5 * (e_t @ inv_Q @ e_t - np.log(np.linalg.det(Q_t_corr)))
                ll += ll_t
            except:
                pass
        return -ll

    from scipy.optimize import minimize
    result = minimize(
        lambda x: dcc_loglik(x[0], x[1], std_resids),
        x0=[0.05, 0.93],
        bounds=[(0.001, 0.3), (0.5, 0.999)],
        method='L-BFGS-B'
    )
    alpha, beta = result.x

    return DCCParams(
        alpha=float(alpha),
        beta=float(beta),
        Q_bar=Q_bar,
        current_Q=Q_bar,
    )

def update_dcc(params: DCCParams,
               std_resids_tm1: np.ndarray,
               new_std_resid: np.ndarray) -> np.ndarray:
    """Online update of DCC conditional correlation matrix."""
    Q_new = (1 - params.alpha - params.beta) * params.Q_bar + \
            params.alpha * np.outer(std_resids_tm1, std_resids_tm1) + \
            params.beta * params.current_Q
    return cov2corr(Q_new)
```

---

## 2. Orderbook Dynamics

### 2.1 Order Flow Imbalance (OFI) & Market Depth

**What it does:**
Quantifies directional pressure in the limit order book. OFI is net order flow (volume of buys minus sells) at each price level, aggregated over time. It predicts short-term price movement better than raw trade flow.

**What data it needs:**
- L2 orderbook snapshots: `{timestamp, bids: [(price, size)], asks: [(price, size)]}`
- Frequency: every 100ms–1s for real-time, daily aggregates for calibration
- Depth: top 20 levels minimum

**How it maps to archetype behavior:**
- Persistent positive OFI → supports `MOMENTUM` archetype bias (price likely to continue up)
- OFI reversal → triggers `MEAN_REVERTER` archetype entry signal
- OFI magnitude relative to book depth → determines whether archetype can execute without slippage

**Implementation:**

```python
from dataclasses import dataclass
import numpy as np
import pandas as pd

@dataclass
class OFIResult:
    net_ofi: float           # cumulative net order flow imbalance
    bid_depth_change: float  # change in aggregate bid depth
    ask_depth_change: float  # change in aggregate ask depth
    midprice_change: float   # price impact (log)
    timestamp: pd.Timestamp

def compute_ofi(book_snapshots: list[dict], levels: int = 20) -> pd.DataFrame:
    """
    Compute order flow imbalance from a list of L2 book snapshots.
    Returns DataFrame with OFI per snapshot.
    """
    records = []
    prev_bids, prev_asks = None, None

    for snap in book_snapshots:
        ts = pd.Timestamp(snap['timestamp'])
        bids = sorted(snap['bids'], key=lambda x: -x[0])[:levels]  # best bids first
        asks = sorted(snap['asks'], key=lambda x: x[0])[:levels]   # best asks first

        bid_vol = sum(size for _, size in bids)
        ask_vol = sum(size for _, size in asks)

        bid_depth = sum(size * (100 - i) for i, (_, size) in enumerate(bids))  # depth-weighted
        ask_depth = sum(size * (100 - i) for i, (_, size) in enumerate(asks))

        if prev_bids is not None:
            delta_bid = sum(size for _, size in bids) - sum(size for _, size in prev_bids)
            delta_ask = sum(size for _, size in asks) - sum(size for _, size in prev_asks)
            ofi = delta_bid - delta_ask  # positive = buy pressure

            bid_depth_chg = sum(size * (100-i) for i, (_, size) in enumerate(bids)) - \
                            sum(size * (100-i) for i, (_, size) in enumerate(prev_bids))
            ask_depth_chg = sum(size * (100-i) for i, (_, size) in enumerate(asks)) - \
                            sum(size * (100-i) for i, (_, size) in enumerate(prev_asks))

            mid = (bids[0][0] + asks[0][0]) / 2 if bids and asks else 0
            prev_mid = (prev_bids[0][0] + prev_asks[0][0]) / 2 if prev_bids and prev_asks else 0

            records.append(OFIResult(
                net_ofi=ofi,
                bid_depth_change=bid_depth_chg,
                ask_depth_change=ask_depth_chg,
                midprice_change=np.log(mid / prev_mid) if prev_mid > 0 else 0,
                timestamp=ts
            ))

        prev_bids, prev_asks = bids, asks

    return pd.DataFrame(records)

def calibrate_kyle_lambda(ofi: pd.DataFrame, returns: pd.DataFrame) -> float:
    """
    Estimate Kyle's lambda: price impact coefficient.
    Regress midprice returns on OFI.
    ΔP = λ * OFI + ε
    Kyle's lambda = cov(ΔP, OFI) / var(OFI)
    """
    price_change = returns.set_index('timestamp')['log_return']
    ofi_indexed = ofi.set_index('timestamp')
    aligned = ofi_indexed.join(price_change, how='inner').dropna()

    ofi_val = aligned['net_ofi'].values
    ret_val = aligned['midprice_change'].values

    lambda_kyle = np.cov(ofi_val, ret_val)[0, 1] / np.var(ofi_val)
    return float(lambda_kyle)
```

---

### 2.2 Liquidity Regimes & Book Depth Statistics

**What it does:**
Characterizes liquidity regimes (normal, stressed, Illiquid) based on bid-ask spread, depth, and resilience. Different regimes require different archetype behavior — in stressed liquidity, even "correct" trades suffer massive slippage.

**What data it needs:**
- L2 snapshots at 1-second resolution
- Minimum 30 days to capture regime distribution
- Computed spreads: `{timestamp, bid, ask, spread_bps, depth_10}`

**How it maps to archetype behavior:**
- **Normal regime** → archetypes deploy full position sizes, tight stops
- **Stressed regime** → archetypes reduce size 50–70%, widen stops, prefer market orders over limit orders
- **Illiquid regime** → archetypes exit only what necessary, prefer queue position over aggressive trading

**Implementation:**

```python
from dataclasses import dataclass

@dataclass
class LiquidityRegime:
    name: str           # 'normal' | 'stressed' | 'illiquid'
    spread_bps: float   # e.g., 5.0 = 5 basis points
    depth_pct: float   # % of normal depth remaining
    resilience: float  # 0-1, how fast book replenishes after large order

LIQUIDITY_REGIME_THRESHOLDS = {
    'normal':   {'spread_max': 15,   'depth_min': 0.70},
    'stressed': {'spread_max': 50,   'depth_min': 0.30},
    'illiquid': {'spread_max': 999,  'depth_min': 0.00},
}

def classify_liquidity_regime(spread_bps: float, depth_ratio: float) -> str:
    """Determine current liquidity regime from spread and depth."""
    if spread_bps <= LIQUIDITY_REGIME_THRESHOLDS['normal']['spread_max'] and \
       depth_ratio >= LIQUIDITY_REGIME_THRESHOLDS['normal']['depth_min']:
        return 'normal'
    elif spread_bps <= LIQUIDITY_REGIME_THRESHOLDS['stressed']['spread_max'] and \
         depth_ratio >= LIQUIDITY_REGIME_THRESHOLDS['stressed']['depth_min']:
        return 'stressed'
    else:
        return 'illiquid'

def estimate_resilience(book_before: dict, book_after: dict, 
                        shock_size: float, time_steps: int) -> float:
    """
    Estimate orderbook resilience: how fast does depth recover after a large trade?
    resilience = 1 - (depth_deficit / shock_size), averaged over recovery window
    """
    depth_before = sum(size for _, size in book_before['bids'][:10])
    depth_after = sum(size for _, size in book_after['bids'][:10])
    deficit = max(0, shock_size - (depth_before - depth_after))
    resilience = max(0, 1 - deficit / shock_size)
    return float(resilience)
```

---

## 3. Archetype Calibration

### 3.1 Behavioral Distribution Fitting

**What it does:**
For each archetype, fits a probability distribution to observed behavioral parameters (spend rate, latency, rescind propensity) across tournament runs. The fitted distributions allow Monte Carlo sampling of archetype behavior.

**What data it needs:**
- Tournament run logs: `{agent_id, archetype, period, bid_amount, latency_ms, rescind, outcome}`
- Minimum: 50 tournament runs per archetype for stable fit
- Parameters to fit per archetype: `spend_rate`, `reaction_latency`, `rescind_propensity`

**How it maps to archetype behavior:**
- The fitted distributions encode the *range* of possible behaviors per archetype, not just the mean
- Monte Carlo sampling from distributions → ensemble of plausible archetype behaviors → P&L distribution
- Distributional fit quality (Anderson-Darling test) tells us if the archetype is "stable" or "noisy"

**Implementation:**

```python
from scipy import stats
from dataclasses import dataclass
from typing import Callable

@dataclass
class ArchetypeDistribution:
    archetype: str
    spend_rate_dist: Callable  # Beta distribution
    latency_dist: Callable     # Log-normal distribution
    rescind_dist: Callable     # Beta distribution (0-1)
    fit_quality_spend: float  # Anderson-Darling p-value
    fit_quality_latency: float
    fit_quality_rescind: float

def fit_archetype_distributions(tournament_logs: pd.DataFrame,
                                archetype: str) -> ArchetypeDistribution:
    """
    Fit Beta distributions to spend_rate, latency, rescind_propensity
    from tournament logs for a given archetype.
    """
    subset = tournament_logs[tournament_logs['archetype'] == archetype]

    # Spend rate: Beta distribution (bounded 0-1)
    spend_data = subset['spend_rate'].dropna().values
    # Method of moments fit for Beta
    spend_mean, spend_var = np.mean(spend_data), np.var(spend_data)
    alpha_s = spend_mean * (spend_mean * (1 - spend_mean) / spend_var - 1)
    beta_s = (1 - spend_mean) * (spend_mean * (1 - spend_mean) / spend_var - 1)
    spend_dist = stats.beta(alpha_s, beta_s)
    ad_spend = stats.anderson(spend_data, dist='norm').statistic

    # Latency: Log-normal (positive, right-skewed)
    lat_data = subset['reaction_latency_ms'].dropna().values
    lat_logmean = np.log(lat_data).mean()
    lat_logstd = np.log(lat_data).std()
    latency_dist = stats.lognorm(scale=np.exp(lat_logmean), s=lat_logstd)
    ad_lat = stats.anderson(np.log(lat_data), dist='norm').statistic

    # Rescind propensity: Beta distribution (bounded 0-1)
    resc_data = subset['rescind_propensity'].dropna().values
    resc_mean, resc_var = np.mean(resc_data), np.var(resc_data)
    alpha_r = resc_mean * (resc_mean * (1 - resc_mean) / resc_var - 1)
    beta_r = (1 - resc_mean) * (resc_mean * (1 - resc_mean) / resc_var - 1)
    rescind_dist = stats.beta(alpha_r, beta_r)
    ad_resc = stats.anderson(resc_data, dist='norm').statistic

    return ArchetypeDistribution(
        archetype=archetype,
        spend_rate_dist=spend_dist,
        latency_dist=latency_dist,
        rescind_dist=rescind_dist,
        fit_quality_spend=float(ad_spend),
        fit_quality_latency=float(ad_lat),
        fit_quality_rescind=float(ad_resc),
    )

def sample_archetype_behavior(dist: ArchetypeDistribution, n: int = 1) -> dict:
    """Sample one behavioral configuration from archetype distributions."""
    return {
        'spend_rate': float(dist.spend_rate_dist.rvs()),
        'latency_ms': float(dist.latency_dist.rvs()),
        'rescind_propensity': float(dist.rescind_dist.rvs()),
    }
```

---

### 3.2 Regime-Conditional Archetype Performance

**What it does:**
Measures how each archetype performs under different market regimes (trending up, trending down, mean-reverting, high volatility). This is the primary calibration output — it tells us which archetype fires when, and with what probability, in each regime.

**What data it needs:**
- Labeled regime assignments for each period of each tournament run
- Tournament outcome data: `{archetype, period, regime, action, pnl, final_rank}`
- Minimum: 200+ labeled periods per archetype per regime

**Implementation:**

```python
from collections import defaultdict

REGIMES = ['TRENDING_UP', 'TRENDING_DOWN', 'MEAN_REVERTING', 'HIGH_VOL']

@dataclass
class RegimeBehavior:
    regime: str
    archetype: str
    mean_action: str          # e.g. 'BUY', 'SELL', 'HOLD'
    action_distribution: dict  # {action: probability}
    mean_pnl: float
    pnl_std: float
    win_rate: float            # fraction of periods with positive PnL
    sample_size: int

def compute_regime_behavior(tournament_logs: pd.DataFrame,
                           archetype: str,
                           regime: str) -> RegimeBehavior:
    """Compute behavioral statistics for archetype in a given regime."""
    subset = tournament_logs[
        (tournament_logs['archetype'] == archetype) &
        (tournament_logs['regime'] == regime)
    ]

    if len(subset) < 10:
        return None  # insufficient data

    actions = subset['action'].value_counts(normalize=True).to_dict()
    mean_pnl = subset['pnl'].mean()
    pnl_std = subset['pnl'].std()
    win_rate = (subset['pnl'] > 0).mean()

    return RegimeBehavior(
        regime=regime,
        archetype=archetype,
        mean_action=max(actions, key=actions.get),
        action_distribution=actions,
        mean_pnl=float(mean_pnl),
        pnl_std=float(pnl_std),
        win_rate=float(win_rate),
        sample_size=len(subset),
    )

def build_regime_matrix(tournament_logs: pd.DataFrame) -> dict:
    """
    Build full regime × archetype behavior matrix.
    Output: {archetype: {regime: RegimeBehavior}}
    """
    archetypes = tournament_logs['archetype'].unique()
    regime_matrix = {}

    for archetype in archetypes:
        regime_matrix[archetype] = {}
        for regime in REGIMES:
            behavior = compute_regime_behavior(tournament_logs, archetype, regime)
            if behavior:
                regime_matrix[archetype][regime] = behavior

    return regime_matrix
```

---

### 3.3 Cascade Intensity Modeling (Poisson Processes)

**What it does:**
Models how events propagate through the market as a Poisson counting process. The cascade intensity λ is the average number of secondary signals triggered per unit time following a primary event. Different event types have different λ — liquidation cascades have high λ, simple price shocks have moderate λ.

**What data it needs:**
- Labeled cascade trees from tournament runs: `{event_id, depth, signals_triggered, time_to_next_signal}`
- Minimum: 100+ labeled cascades per event type

**Implementation:**

```python
from scipy.stats import expon

@dataclass
class CascadeParams:
    event_type: str
    intensity_per_minute: float   # λ: expected secondary signals per minute
    mean_inter_arrival_sec: float # mean time between cascade steps
    spread: float                 # standard deviation of inter-arrival times

def fit_cascade_poisson(cascade_trees: list[dict]) -> CascadeParams:
    """
    Fit Poisson process to cascade inter-arrival times.
    H0: inter-arrival times ~ Exponential(λ)
    """
    all_inter_arrivals = []

    for tree in cascade_trees:
        timestamps = sorted([step['timestamp'] for step in tree['steps']])
        inter_arrivals = np.diff(timestamps)  # in seconds
        all_inter_arrivals.extend(inter_arrivals.tolist())

    inter_arrivals = np.array(all_inter_arrivals) / 60.0  # convert to minutes

    # MLE for exponential: λ = 1 / sample_mean
    lambda_mle = 1.0 / np.mean(inter_arrivals)
    spread = np.std(inter_arrivals)

    return CascadeParams(
        event_type=tree.get('event_type', 'UNKNOWN'),
        intensity_per_minute=float(lambda_mle),
        mean_inter_arrival_sec=float(np.mean(inter_arrivals) * 60),
        spread=float(spread),
    )

def sample_cascade_timing(params: CascadeParams, max_depth: int = 5) -> list[float]:
    """
    Sample cascade step timestamps from fitted Poisson process.
    Returns list of relative timestamps (seconds) for each cascade step.
    """
    timestamps = [0.0]
    current_time = 0.0

    for _ in range(max_depth - 1):
        # Sample inter-arrival time from exponential distribution
        inter_arrival = expon.rvs(scale=params.mean_inter_arrival_sec)
        current_time += inter_arrival
        timestamps.append(current_time)

    return timestamps
```

---

## 4. Risk Metrics

### 4.1 Value at Risk (VaR) & Expected Shortfall (CVaR)

**What it does:**
Standard risk metrics computed from the P&L distribution of Monte Carlo simulation runs.

**Implementation:**

```python
def compute_var_cvar(pnl_distribution: np.ndarray,
                     confidence: float = 0.95) -> tuple[float, float]:
    """
    Compute VaR and CVaR (Expected Shortfall) from simulation P&L distribution.
    VaR: the loss at the confidence-th percentile
    CVaR: the expected loss given that we are in the tail
    """
    var = np.percentile(pnl_distribution, (1 - confidence) * 100)
    cvar = pnl_distribution[pnl_distribution <= var].mean()
    return float(var), float(cvar)
```

### 4.2 Maximum Drawdown Distribution

**What it does:**
For each Monte Carlo run, computes the maximum peak-to-trough drawdown. Reports the distribution across runs — not just the mean, but the tail behavior.

**Implementation:**

```python
def compute_max_drawdown(pnl_series: np.ndarray) -> float:
    """Compute maximum drawdown from a P&L series."""
    cumulative = np.cumsum(pnl_series)
    running_max = np.maximum.accumulate(cumulative)
    drawdown = running_max - cumulative
    return float(np.max(drawdown))

def compute_drawdown_stats(all_runs: list[list[float]]) -> dict:
    """
    Compute drawdown statistics across all Monte Carlo runs.
    Returns: {mean, median, p5, p95} of max drawdowns
    """
    max_drawdowns = [compute_max_drawdown(np.array(run)) for run in all_runs]
    return {
        'mean': float(np.mean(max_drawdowns)),
        'median': float(np.median(max_drawdowns)),
        'p5': float(np.percentile(max_drawdowns, 5)),
        'p95': float(np.percentile(max_drawdowns, 95)),
    }
```

---

## 5. Calibration Pipeline Summary

### 5.1 Data Flow

```
Hyperliquid S3 (L2 + fills)
        ↓
[Preprocessing] → Clean, deduplicate, synchronize timestamps
        ↓
[Calibration Jobs] → Run in parallel:
  - compute_realized_vol + fit_volatility_regime
  - detect_jumps
  - fit_dcc_garch
  - compute_ofi + calibrate_kyle_lambda
  - fit_archetype_distributions
  - build_regime_matrix
  - fit_cascade_poisson
        ↓
[Parameter Store] → PostgreSQL / JSON
  - VolatilityRegime
  - DCCParams
  - KyleLambda
  - ArchetypeDistribution per archetype
  - RegimeBehavior matrix
  - CascadeParams per event type
        ↓
[Simulation Engine] ← Query parameters at runtime
```

### 5.2 Calibration Frequency

| Parameter | Update Frequency | Method |
|-----------|-----------------|--------|
| Volatility regime | Daily | Rolling 30-day HMM |
| DCC correlations | Daily | Rolling 60-day DCC |
| Kyle's lambda | Weekly | Rolling 14-day OFI regression |
| Archetype distributions | Monthly | All available tournament runs |
| Regime behavior matrix | Monthly | All available tournament runs |
| Cascade intensity | Monthly | All available tournament runs |

---

*End of Charge's Statistical Methods Section*
