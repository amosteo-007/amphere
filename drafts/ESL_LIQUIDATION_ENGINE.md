# ESL Liquidation Engine — Technical Reference
## Charge 🔋 | Quantitative Finance Section

---

## 1. Almgren-Chriss Optimal Execution Framework

### 1.1 Core Intuition

Every seller faces the same tension:

- **Market impact cost**: Selling too fast moves the price against you — each trade "reveals your hand" to the market.
- **Timing risk**: Selling too slow exposes you to price uncertainty — the asset might keep falling while you wait.

Almgren & Chriss (2000) formalized this as a mean-variance optimization over an execution trajectory.

---

### 1.2 Classical AC Formulation

**Setup:**
- Total position to liquidate: $X$ (units, e.g., tokens)
- Horizon: $[0, T]$, discretized into $N$ time steps $\Delta t = T/N$
- Execution rate at step $i$: $v_i$ (units per $\Delta t$)
- Price process (no control): $S_t$ (log-Brownian with drift $\mu$ and volatility $\sigma$)
- Permanent impact slope: $\eta$ (price impact per unit of cumulative order flow)
- Temporary impact coefficient: $\gamma$ (immediate impact per unit of instantaneous flow)

**Permanent price impact** — your trades shift the fair value permanently:
$$P_k = S_k - \eta \cdot \sum_{i=1}^{k} v_i$$

**Temporary impact** — immediate execution friction at step $k$:
$$\text{temp\_impact}_k = \gamma \cdot \frac{v_k}{\text{ADV}_k}$$

**Optimization objective** — minimize expected cost + risk penalty:
$$
\min_{\{v_i\}} \quad \mathbb{E}\left[\sum_{k=1}^{N} P_k \cdot v_k\right] + \lambda \cdot \text{Var}\left(\sum_{k=1}^{N} P_k \cdot v_k\right)
$$

The closed-form solution for the optimal execution trajectory is:

$$
v_i^* = \frac{X}{N} + \frac{\lambda \sigma^2 X}{\gamma} \cdot \frac{\sinh(\kappa(T - t_i))}{\sinh(\kappa T)} \cdot \Delta t
$$

where:
$$\kappa = \sqrt{\frac{\lambda \sigma^2}{\gamma}}$$

The first term is the **uniform baseline** (VWAP-ish). The second term is a **risk-adjusted push** — high $\lambda$ (risk aversion) or high $\sigma$ (volatility) pushes execution toward the front.

---

### 1.3 Crypto Liquidation Extension

Crypto adds three layers the classical model doesn't cover:

**A. Leverage amplification**

A leveraged position of size $X$ with leverage $L$ means the *liquidation decision* is binary — you're either holding $X$ or you're forced out at the margin price $P_{\text{liq}}$. The AC framework operates *after* the decision to liquidate is made; leverage only scales the urgency.

**B. Cascading stop-losses**

When $P$ crosses $P_{\text{liq}}$ for one trader, their forced sell moves the price, potentially triggering the next trader's stop. This creates a **cascade multiplier**. We model this as:

$$\text{cascade\_fraction}(P, \text{drift}) = \text{OCR}(P) \cdot \left(1 + \alpha \cdot \text{open\_interest\_concentration}\right)$$

where $\alpha$ is calibrated from historical cascade events on the specific venue.

**C. Volatile orderbook**

In crypto, the orderbook is thin and asymmetric — more sell walls than buy walls during drops. We augment the temporary impact term:

```
gamma_eff = gamma_base * (1 + psi * orderbook_imbalance)

where:
  psi     = impact of book imbalance on spread (calibrated per asset)
  orderbook_imbalance = (bid_depth - ask_depth) / (bid_depth + ask_depth)
                         (negative = sell-side thin)
```

---

### 1.4 Python Implementation

```python
"""
Almgren-Chriss Optimal Execution with Crypto Extensions
"""
import numpy as np
from dataclasses import dataclass
from typing import Optional

@dataclass
class ACConfig:
    """Configuration for AC execution model."""
    X: float              # Total position size (units)
    T: float              # Execution horizon (seconds)
    N: int                # Number of discrete time steps
    sigma: float          # Annualized volatility (decimal)
    mu: float             # Annualized drift (decimal, negative for shorts)
    eta: float            # Permanent impact coefficient (price per unit)
    gamma: float          # Temporary impact coefficient (price per unit / sqrt volume)
    gamma_book: float     # Orderbook imbalance multiplier (psi)
    lam: float            # Risk aversion parameter (lambda)
    L: float              # Leverage (for urgency scaling)
    liq_price: Optional[float] = None  # Liquidation price (if leveraged)

    @property
    def dt(self) -> float:
        return self.T / self.N

    @property
    def kappa(self) -> float:
        """Optimal execution rate decay constant."""
        return np.sqrt(self.lam * self.sigma**2 / self.gamma)


def ac_optimal_trajectory(cfg: ACConfig) -> np.ndarray:
    """
    Compute Almgren-Chriss optimal execution trajectory.
    
    Returns:
        v: array of shape (N,) — units to execute at each step
    
    Mathematical reference:
        v_i* = (X/N) + (λ·σ²·X/γ) · [sinh(κ(T-t_i)) / sinh(κT)] · Δt
        
    The uniform baseline dominates when λ→0 (risk-neutral).
    Front-loading push dominates when λ·σ² is large.
    """
    X = cfg.X
    N = cfg.N
    dt = cfg.dt
    kappa = cfg.kappa
    T = cfg.T

    t = np.linspace(0, T, N)
    baseline = X / N
    risk_push = (cfg.lam * cfg.sigma**2 * X / cfg.gamma) * np.sinh(kappa * (T - t)) / np.sinh(kappa * T) * dt

    v = baseline + risk_push

    # Ensure non-negative and sum-to-X
    v = np.maximum(v, 0.0)
    v = v / v.sum() * X  # Normalize to exact total

    return v


def crypto_adjusted_impact(
    cfg: ACConfig,
    orderbook_imbalance: float,
    cascade_risk: float
) -> np.ndarray:
    """
    Augment AC trajectory with crypto-specific frictions.
    
    Args:
        orderbook_imbalance: ∈ [-1, 1]. Negative = thin ask side.
        cascade_risk:        ∈ [0, 1]. Estimated cascade pressure.
    
    Returns:
        v_adj: adjusted execution trajectory
    
    Effect:
        - Thin book (negative imbalance) → increase early execution
          to get out before cascade hits
        - High cascade_risk → front-load aggressively
    """
    v_base = ac_optimal_trajectory(cfg)

    # Crypto urgency multiplier
    # When book is thin: want to execute NOW before cascade
    book_urgency = 1.0 + cfg.gamma_book * (-orderbook_imbalance)  # thin ask → urgency up
    cascade_urgency = 1.0 + cascade_risk  # 0-1 scaling of additional front-loading

    combined_urgency = book_urgency * cascade_urgency

    # Front-load: push execution earlier
    t = np.linspace(0, cfg.T, cfg.N)
    urgency_profile = np.exp(-0.5 * (1 - combined_urgency) * t / cfg.T)

    v_adj = v_base * (1 + 0.3 * (combined_urgency - 1) * urgency_profile)
    v_adj = np.maximum(v_adj, 0.0)
    v_adj = v_adj / v_adj.sum() * cfg.X

    return v_adj


def compute_expected_cost(cfg: ACConfig, v: np.ndarray, S0: float) -> dict:
    """
    Compute E[cost] and Var(cost) for a given trajectory.
    
    E[cost] = Σ P_k · v_k  (where P_k includes permanent impact)
    Var(cost) = σ² · Σ (Σ_{j≤k} v_j)² · (Δt)
    
    Returns dict with point estimates.
    """
    dt = cfg.dt
    sigma = cfg.sigma
    eta = cfg.eta
    N = cfg.N

    # Cumulative execution
    cum_exec = np.cumsum(v)

    # Permanent impact price path
    P = S0 - eta * cum_exec

    # Temporary impact per step (assume book depth ∝ ADV)
    adv_fraction = v / (cfg.X / cfg.N)  # normalized to均匀
    temp_impact = cfg.gamma * adv_fraction * np.sqrt(dt) * sigma * S0

    # Expected cost: E[Σ P_k · v_k]
    expected_cost = np.sum((P - temp_impact / 2) * v)  # mid minus half spread

    # Variance of cost
    variance_cost = sigma**2 * np.sum(cum_exec**2) * dt * S0**2

    return {
        "expected_cost": expected_cost,
        "expected_cost_bps": expected_cost / (S0 * cfg.X) * 10_000,
        "variance_cost": variance_cost,
        "std_cost_bps": np.sqrt(variance_cost) / (S0 * cfg.X) * 10_000,
        "sharpe_like": expected_cost / np.sqrt(variance_cost) if variance_cost > 0 else 0,
    }
```

---

## 2. Global Liquidation Engine

### 2.1 The Liquidation Urgency Function

Agents must decide **when** to flip from "hold" to "liquidate". This is governed by a **liquidation urgency function** $U_t$ that maps market state to a binary decision threshold.

**State variables at time $t$:**
- $P_t$ — current price
- $P_{\text{liq}}$ — agent's liquidation price
- $\sigma_t$ — realized volatility (rolling window)
- $\text{OCR}_t$ — open interest / market cap ratio
- $\text{RP}_t$ — risk premium (agent's internal cost of holding)

**Urgency score:**
$$
U_t = \underbrace{\frac{P_{\text{liq}} - P_t}{P_t}}_{\text{distance to liquidation (\%)}} 
      \cdot \underbrace{\frac{1}{\text{RP}_t}}_{\text{holding cost weight}}
      \cdot \underbrace{e^{\beta \cdot \text{vol\_regime}}}_{\text{vol regime multiplier}}
$$

**Decision rule:**
$$
\text{action}_t = 
\begin{cases} 
\text{HOLD} & \text{if } U_t < \theta_{\text{hold}} \\
\text{LIQUIDATE} & \text{if } U_t \geq \theta_{\text{hold}} \\
\end{cases}
$$

where $\theta_{\text{hold}}$ is the agent's urgency threshold, archetype-dependent.

---

### 2.2 Volatility Regime Detection

Volatility regimes determine how fast an agent should liquidate *after* deciding to liquidate.

```python
def detect_vol_regime(
    returns: np.ndarray,
    lookback_short: int = 20,
    lookback_long: int = 60,
) -> tuple[str, float]:
    """
    Classify market into vol regime using short vs long volatility ratio.
    
    Returns:
        regime: 'low' | 'normal' | 'elevated' | 'crisis'
        vol_ratio: σ_short / σ_long (crisis indicator when >> 1.0)
    """
    var_short = np.mean(returns[-lookback_short:]**2)
    var_long  = np.mean(returns[-lookback_long:]**2)
    vol_ratio = np.sqrt(var_short / var_long) if var_long > 0 else 1.0

    if vol_ratio > 3.0:
        regime = "crisis"
    elif vol_ratio > 2.0:
        regime = "elevated"
    elif vol_ratio > 1.5:
        regime = "normal"
    else:
        regime = "low"

    return regime, vol_ratio


# Regime → AC risk aversion scalar
VOL_REGIME_LAM_SCALAR = {
    "low":      0.5,   # Can afford to go slow
    "normal":   1.0,   # Baseline
    "elevated": 2.5,   # Speed up materially
    "crisis":   8.0,   # Liquidate as fast as possible, accept high impact
}
```

---

### 2.3 Full Liquidation Decision Engine

```python
@dataclass
class LiquidationEngine:
    """
    Global liquidation decision engine.
    Combines urgency scoring, vol regime detection, and archetype config
    to decide IF and HOW to liquidate.
    """
    archetype: str              # conservative_hoarder | balanced_allocator | aggressive_frontloader
    liq_price: float           # Agent's personal liquidation price
    position_value: float      # Current mark-to-market position value
    holding_cost_bps: float     # Annualized cost of holding (funding, carry)
    urgency_threshold: float   # Threshold above which liquidation begins

    def compute_urgency(
        self,
        current_price: float,
        realized_vol: float,
        regime: str,
        regime_vol_scalar: float,
    ) -> float:
        """
        U_t = (P_liq - P) / P  *  1/RP  *  exp(beta * regime)
        """
        dist_to_liq = (self.liq_price - current_price) / current_price

        holding_cost_scalar = 1.0 / (1.0 + self.holding_cost_bps / 10000)

        beta = 0.3
        regime_multiplier = np.exp(beta * {"crisis": 3, "elevated": 2, "normal": 1, "low": 0}[regime])

        urgency = dist_to_liq * holding_cost_scalar * regime_multiplier * regime_vol_scalar

        return urgency

    def should_liquidate(self, urgency: float) -> bool:
        return urgency >= self.urgency_threshold

    def execution_speed_multiplier(self, archetype: str, regime: str) -> float:
        """
        Returns a scalar on how aggressively to execute once liquidation starts.
        Maps archetype + vol regime to speed.
        """
        base_speeds = {
            "conservative_hoarder": 0.3,   # Slow TWAP even when liquidating
            "balanced_allocator":  1.0,   # Standard AC
            "aggressive_frontloader": 2.5, # Front-load aggressively
        }
        regime_speeds = {
            "low":      0.5,
            "normal":   1.0,
            "elevated": 2.0,
            "crisis":   4.0,
        }
        return base_speeds[archetype] * regime_speeds[regime]
```

---

## 3. Reverse Engineering the Liquidation Waterfall

### 3.1 Conceptual Model

On Hyperliquid (and most perpetuals exchanges), when price drops:

```
P falls → crosses stop-loss #1 → forced sell of Trader A
               ↓
         P drops further → crosses stop-loss #2 → forced sell of Trader B
               ↓
         P drops further → margin call cascade → engine starts liquidating
                            largest positions first
               ↓
         Deep book exhausted → price spiral → cascading into long liquidations
```

This is the **liquidation waterfall**. We reverse-engineer it from observable data.

---

### 3.2 Data Requirements from Hyperliquid

| Data Feed | Frequency | Purpose |
|-----------|-----------|---------|
| `liquidations` (websocket) | Real-time | Every forced liquidation event |
| `book` L2 snapshot | ~100ms | Depth histogram, book imbalance |
| `trades` | Tick | Execution price/volume for liquidation fills |
| `open_interest` | Hourly | Total open interest (normalizes cascade size) |
| `funding_rate` | 1h | Proxy for leverage sentiment |
| `vwap_30m` | 30min | Benchmark for liquidation fill quality |

---

### 3.3 Waterfall Reconstruction

```python
@dataclass
class LiquidationWaterfall:
    """
    Reconstructs the liquidation waterfall from Hyperliquid data.
    Given a price trajectory, estimates:
    - Cumulative % of open interest liquidated at each price level
    - Cascade intensity at each level
    - Remaining buy-side depth after each liquidation wave
    """
    avg_leverage: float         # Calibrated from funding + OI
    margin_requirement_bps: float  # e.g., 100 bps = 1% margin requirement
    liquidation_engine_fee: float  # Maker/taker of liquidation engine
    cascade_alpha: float       # Amplification factor per wave

    def estimate_liquidation_fraction(
        self,
        price_traj: np.ndarray,    # P_t over time
        open_interest: float,      # Total OI at start
        book_depth_traj: np.ndarray, # Available bid depth at each step
    ) -> dict:
        """
        For a given price trajectory, estimate:
        - cumulative_liquidated_pct: fraction of OI absorbed by liquidations
        - liquidation_rate: d(cumulative)/dP — intensity at each price level
        
        Key insight: liquidations cluster near support/resistance because
        stop-losses concentrate there. We use historical clustering
        of liquidation events to build a PDF of liquidation density vs price.
        """
        results = {
            "cumulative_pct": [],
            "liquidations_per_level": [],
            "remaining_depth": [],
            "cascade_pressure": [],
        }

        cumulative = 0.0
        remaining_depth = book_depth_traj[0] if len(book_depth_traj) > 0 else float('inf')

        for i, price in enumerate(price_traj):
            # Liquidation rate: exponential in distance below last peak
            # (stop losses are typically set at round numbers or recent lows)
            price_drop_pct = (price_traj[0] - price) / price_traj[0]

            # Liquidation density model (data-driven calibration)
            # In practice: fit this to historical Hyperliquid liquidation data
            liq_density = (
                self.avg_leverage
                * self.margin_requirement_bps
                * np.exp(-price_drop_pct / (self.margin_requirement_bps / 100))
                * self.cascade_alpha ** (i / 10)
            )

            # How much can the book absorb?
            absorbed = min(liq_density * open_interest, remaining_depth)
            remaining_depth = max(0, remaining_depth - absorbed)

            cumulative += absorbed
            cascade_pressure = absorbed / remaining_depth if remaining_depth > 0 else float('inf')

            results["cumulative_pct"].append(cumulative / open_interest)
            results["liquidations_per_level"].append(absorbed)
            results["remaining_depth"].append(remaining_depth)
            results["cascade_pressure"].append(cascade_pressure)

        return results

    def calibrate_from_history(
        self,
        liquidation_events: list[dict],
        price_at_event: list[float],
        open_interest_at_event: list[float],
    ) -> "LiquidationWaterfall":
        """
        Fit cascade_alpha and avg_leverage from historical data.
        
        Data shape (from Hyperliquid websocket):
            liquidation_events[i] = {
                'size': float,         # USD value liquidated
                'side': 'sell',        # always sell (longs getting liquidated)
                'price': float,        # fill price
                'timestamp': int,
            }
        
        Procedure:
            1. Cluster events by price level (50-price buckets)
            2. Fit cascade_alpha via maximum likelihood
            3. Compute avg_leverage = mean(size / margin) across events
        """
        import scipy.optimize as opt

        # Bucket events by price
        buckets = {}
        for size, px, oi in zip(liquidation_events, price_at_event, open_interest_at_event):
            bucket = round(px / 50) * 50
            if bucket not in buckets:
                buckets[bucket] = []
            buckets[bucket].append((size, oi))

        # Likelihood: cascade model should reproduce bucket sizes
        def neg_log_likelihood(params):
            alpha, lev = params
            self.cascade_alpha = alpha
            self.avg_leverage = lev
            total_ll = 0.0
            for bucket, events in buckets.items():
                predicted = self._predict_bucket_liquidation(bucket)
                actual = sum(e[0] for e in events)
                total_ll += (actual - predicted)**2
            return total_ll

        result = opt.minimize(neg_log_likelihood, x0=[1.2, 5.0],
                              bounds=[(1.0, 3.0), (2.0, 50.0)])
        self.cascade_alpha, self.avg_leverage = result.x
        return self

    def _predict_bucket_liquidation(self, bucket_price: float) -> float:
        """Predict total liquidation volume in a price bucket."""
        # Simplified: proportional to OI concentration in that bucket
        return self.avg_leverage * self.margin_requirement_bps
```

---

## 4. Quantitative Liquidation Cascade Model

### 4.1 When the Open Market Fails

During a cascade, the orderbook looks like this:

```
Bid depth:   [ 50K | 30K | 20K | 10K | 5K ]  ← thin, evaporating
Ask wall:    [ 5M | ... ]                     ←massive, from stop-losses
```

Liquidating $1M$ of long positions cannot be absorbed at reasonable prices. The exchange's **liquidation engine** must find counterparties. This is the "distressed auction."

---

### 4.2 Distressed Auction Mechanism

Hyperliquid's liquidation engine (per their docs):

1. Takes over the position at the **bankruptcy price** ($P_{\text{bankrupt}} = entry \pm \text{margin}$)
2. Executes a **Dutch auction** — starts at $P_{\text{bankrupt}}$ and lowers price until filled
3. The ** liquidation fee** (typically 9.5% on Hyperliquid) is the max price slippage tolerated

**Our model of the distressed auction:**

```python
@dataclass
class DistressedAuction:
    """
    Models the counterparty search and price discovery process
    for large liquidations that cannot clear in the open market.
    """
    position_size: float       # USD value to liquidate
    side: str                  # 'sell' (longs liquidated) or 'buy' (shorts liquidated)
    bankruptcy_price: float
    max_slippage_bps: float    # Max acceptable slippage (e.g., 950 bps = 9.5%)
    counterparty_search_cost: float  # Time/opportunity cost of finding counterparty

    def simulate_auction(
        self,
        book_depth: np.ndarray,   # Available bids at each price level (USD)
        volatility: float,         # Current realized vol
        time_remaining: float,     # Seconds before forced liquidation
    ) -> dict:
        """
        Dutch auction: start at bankruptcy, lower price until filled.
        
        In practice, large positions are auctioned off-chain to:
        - Other perpetual funds (basis trades)
        - Market makers (at a discount)
        - Backstop liquidity providers
        
        Returns:
            cleared: bool
            clearing_price: float
            time_to_clear: float
            residual: float (unfilled portion)
        """
        max_slippage = self.max_slippage_bps / 10_000
        floor_price = self.bankruptcy_price * (1 - max_slippage)
        
        current_price = self.bankruptcy_price
        step_size_bps = 10  # Lower by 10 bps each iteration
        time = 0.0
        step_time = 0.1  # 100ms per price step
        
        remaining = self.position_size
        cumulative_filled = 0.0
        
        # Build simulated book (price → available depth)
        book_prices = self.bankruptcy_price * np.linspace(1.0, 1 - max_slippage, 100)
        book_prices = book_prices[::-1]  # descending
        
        while remaining > 0 and time < time_remaining and current_price >= floor_price:
            # Find depth at current price level
            idx = np.searchsorted(book_prices, current_price)
            if idx < len(book_depth):
                depth_at_level = book_depth[idx]
            else:
                depth_at_level = 0.0
            
            # During cascade, depth is thin and stochastic
            stochastic_depth = depth_at_level * np.exp(
                -volatility * np.sqrt(time)  # vol reduces available depth over time
            )
            
            filled_here = min(remaining, stochastic_depth)
            remaining -= filled_here
            cumulative_filled += filled_here
            
            current_price *= (1 - step_size_bps / 10_000)
            time += step_time
        
        return {
            "cleared": remaining == 0,
            "clearing_price": current_price if cumulative_filled > 0 else None,
            "time_to_clear": time,
            "residual": remaining,
            "execution_price_vs_benchmark": (
                (current_price - self.bankruptcy_price) / self.bankruptcy_price * 10_000
                if cumulative_filled > 0 else None
            ),
            "slippage_bps": (
                (self.bankruptcy_price - current_price) / self.bankruptcy_price * 10_000
                if cumulative_filled > 0 else None
            ),
        }
```

---

### 4.3 Cascade Feedback Model

When liquidations exceed book capacity, price drops further, triggering more liquidations. This is the **death spiral**:

$$P_{t+1} = P_t - \underbrace{\alpha \cdot L_t}_{\text{liquidation pressure}} \cdot \underbrace{\frac{1}{D_t}}_{\text{depth inverse}}$$

where:
- $L_t$ = liquidation volume at time $t$
- $D_t$ = available bid depth at time $t$
- $\alpha$ = price impact per unit of liquidation (calibrated from historical events)

```python
def cascade_feedback_step(
    P: float,
    L: float,        # Liquidation volume hitting book
    D: float,        # Available bid depth
    alpha: float = 0.0001,  # Impact coefficient (calibrated)
) -> float:
    """
    Single step of cascade feedback loop.
    
    When L >> D, price moves disproportionately.
    """
    if D <= 0:
        return P * 0.5  # No buyers — price collapses to zero with probability
    return P - alpha * L / D * P
```

---

## 5. Execution Algorithms (Agent-Level)

### 5.1 Algorithm Overview

| Algorithm | Description | Archetype | AC Parameter Effect |
|-----------|-------------|-----------|---------------------|
| **VWAP** | Trade at volume-weighted average price over horizon | balanced_allocator | Static, non-adaptive |
| **TWAP** | Divide order into equal time slices | conservative_hoarder | Very low $\lambda$ |
| **IS (Implementation Shortfall)** | Minimize gap between decision price and avg exec price | aggressive_frontloader | High $\lambda$, front-load |
| **Adaptive AC** | AC with dynamic $\lambda(\sigma_t)$ | regime-aware agents | Vol-responsive $\lambda$ |

---

### 5.2 VWAP Execution

```python
def execute_vwap(
    total_qty: float,
    N: int,
    market_volumes: np.ndarray,  # Expected volumes at each interval
    price_path: np.ndarray,      # Simulated/vwap-referenced price path
) -> np.ndarray:
    """
    VWAP execution: proportionally match the expected market volume profile.
    
    v_i = total_qty * (volume_i / sum(volumes))
    
    This is a BENCHMARK algorithm — actual IS vs VWAP measures execution quality.
    """
    weights = market_volumes / market_volumes.sum()
    v = total_qty * weights
    
    # Compute VWAP achieved
    vwap_achieved = np.sum(v * price_path) / np.sum(v)
    
    return {
        "exec_schedule": v,
        "avg_price": vwap_achieved,
        "slippage_vs_arrival": (vwap_achieved / price_path[0] - 1) * 10_000,  # bps
    }
```

---

### 5.3 TWAP Execution

```python
def execute_twap(
    total_qty: float,
    N: int,
    dt: float,
    price_path: np.ndarray,
) -> np.ndarray:
    """
    TWAP execution: equal quantities per time slice.
    
    v_i = total_qty / N  (uniform)
    
    Best for: large illiquid orders where VWAP profile would reveal intent.
    Conservative archetype uses this.
    """
    v = np.full(N, total_qty / N)
    
    avg_price = np.sum(v * price_path) / np.sum(v)
    return {
        "exec_schedule": v,
        "avg_price": avg_price,
        "slippage_vs_arrival": (avg_price / price_path[0] - 1) * 10_000,
    }
```

---

### 5.4 Implementation Shortfall (IS) Algorithm

```python
def execute_implementation_shortfall(
    total_qty: float,
    N: int,
    dt: float,
    sigma: float,
    alpha: float,   # Urgency — higher = more front-loading (0.5 to 2.0)
    price_path: np.ndarray,
    P0: float,      # Arrival price (decision price)
) -> np.ndarray:
    """
    Implementation Shortfall (IS) / Arrival Price algorithm.
    
    Objective: minimize E[avg_exec_price] - P0  (the shortfall)
               subject to execution risk
    
    Optimal trajectory (from Almgren & Chriss 2001):
        v_i = (X/N) · [1 + ρ · (N+1-2i)/(N+1)]
    
    where ρ ∈ [-1, 1] controls front-loading:
        ρ = 1  → maximally front-loaded (all at start)
        ρ = 0  → TWAP
        ρ = -1 → maximally back-loaded
    
    In practice, ρ is determined by urgency parameter α:
        ρ(α) = tanh(α · (σ√T - risk_aversion))
    """
    X = total_qty
    
    # Urgency-mapped front-loading
    rho = np.tanh(alpha * (sigma * np.sqrt(dt * N) - 0.5))  # Maps to [-1, 1]
    
    # IS-optimal trajectory
    t = np.arange(1, N + 1)
    v = (X / N) * (1 + rho * (N + 1 - 2 * t) / (N + 1))
    v = np.maximum(v, 0.0)
    v = v / v.sum() * X  # Normalize
    
    avg_exec = np.sum(v * price_path) / np.sum(v)
    
    return {
        "exec_schedule": v,
        "avg_exec_price": avg_exec,
        "IS_bps": (avg_exec / P0 - 1) * 10_000,
        "rho": rho,
        "front_loading_ratio": (v[0] / (X/N)) if N > 0 else 1.0,
    }
```

---

### 5.5 Adaptive AC Algorithm

```python
class AdaptiveACExecutor:
    """
    Almgren-Chriss with dynamic parameter updates.
    
    The key innovation: recompute optimal trajectory as new
    vol regime and price information arrives.
    
    This is the 'regime-aware' archetype's primary execution tool.
    """
    def __init__(self, cfg: ACConfig):
        self.cfg = cfg
        self.executed = 0.0
        self.remaining = cfg.X
        self.current_time = 0.0
        self.traj_history = []
        self.cost_history = []

    def step(
        self,
        P_t: float,
        sigma_observed: float,
        orderbook_imbalance: float,
        cascade_risk: float,
        dt: float,
    ) -> dict:
        """
        Single execution step.
        
        At each step:
        1. Update vol estimate (GARCH or realized vol)
        2. Recompute optimal trajectory from remaining position
        3. Execute the first chunk
        4. Update state
        """
        self.cfg.sigma = sigma_observed
        self.cfg.T = max(self.cfg.T - dt, dt)  # Shrink remaining horizon
        self.cfg.N = max(self.cfg.N - 1, 1)
        self.cfg.X = self.remaining
        
        if self.remaining <= 0:
            return {"v_exec": 0.0, "price": P_t, "done": True}
        
        # Recompute optimal trajectory with current market state
        v_base = ac_optimal_trajectory(self.cfg)
        v_adj = crypto_adjusted_impact(self.cfg, orderbook_imbalance, cascade_risk)
        
        # Take the first time step's allocation
        v_exec = v_adj[0] if len(v_adj) > 0 else self.remaining
        
        # Don't exceed remaining
        v_exec = min(v_exec, self.remaining)
        
        # Execute
        cost_here = v_exec * P_t
        self.executed += v_exec
        self.remaining -= v_exec
        self.current_time += dt
        
        self.traj_history.append({
            "t": self.current_time,
            "v_exec": v_exec,
            "price": P_t,
            "remaining": self.remaining,
        })
        self.cost_history.append(cost_here)
        
        return {
            "v_exec": v_exec,
            "price": P_t,
            "remaining": self.remaining,
            "pct_done": self.executed / self.cfg.X,
            "done": self.remaining <= 0,
        }
```

---

### 5.6 Archetype → Execution Algorithm Mapping

```python
ARCHETYPE_EXEC_CONFIG = {
    "conservative_hoarder": {
        "algorithm": "TWAP",
        "lam": 0.1,           # Low risk aversion — willing to take time
        "urgency_threshold": 0.8,  # Needs strong signal before liquidating
        "front_loading": "minimal",
        "hold_threshold_theta": 0.6,
        "liquidate_speed_multiplier": 0.3,
        "acceptable_slippage_bps": 50,
    },
    "balanced_allocator": {
        "algorithm": "VWAP",
        "lam": 1.0,
        "urgency_threshold": 0.5,
        "front_loading": "moderate",
        "hold_threshold_theta": 0.5,
        "liquidate_speed_multiplier": 1.0,
        "acceptable_slippage_bps": 100,
    },
    "aggressive_frontloader": {
        "algorithm": "IS",
        "lam": 3.0,           # High risk aversion — prioritize certainty
        "urgency_threshold": 0.3,  # Liquidates early, avoids timing risk
        "front_loading": "aggressive",
        "hold_threshold_theta": 0.4,
        "liquidate_speed_multiplier": 2.5,
        "acceptable_slippage_bps": 200,
    },
    "regime_aware": {
        "algorithm": "AdaptiveAC",
        "lam": "dynamic",     # Computed from vol regime each step
        "urgency_threshold": 0.4,
        "front_loading": "adaptive",
        "hold_threshold_theta": 0.45,
        "liquidate_speed_multiplier": "dynamic",
        "acceptable_slippage_bps": "dynamic",
    },
}
```

---

### 5.7 Calibration Data Requirements

| Parameter | Data Source | Frequency | Method |
|-----------|-------------|-----------|--------|
| $\eta$ (permanent impact) | Historical large trades vs price drift | Daily | OLS regression |
| $\gamma$ (temporary impact) | Tick-level trade data vs spread | Intraday | Spread decomposition |
| $\lambda$ (risk aversion) | Agent behavior survey / backtest | Weekly | Policy calibration |
| $\sigma$ (volatility) | 30min returns | Intraday | Realized vol GARCH |
| $\alpha$ (cascade) | Historical liquidation cascade events | Event-driven | MLE fit to waterfall |
| $\psi$ (book imbalance) | L2 book snapshots | Continuous | Correlation with impact |
| $P_{\text{liq}}$ | Agent position data | Real-time | From leverage + entry |
| ADV profile | Market volume time series | Daily | VWAP bucket analysis |

---

## Cross-Component Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                      ESL Simulation Loop                         │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │ Vol Regime   │───▶│ Liquidation  │───▶│ Global Liquidation│   │
│  │ Detector     │    │ Urgency Fn   │    │ Engine           │   │
│  └──────────────┘    └──────────────┘    └────────┬─────────┘   │
│                                                  │              │
│  ┌──────────────┐    ┌──────────────┐           ▼              │
│  │ Waterfall    │◀───│ Hyperliquid  │    ┌──────────────────┐  │
│  │ Reconstructor│    │ Data Feed    │    │ Execution Engine │  │
│  └──────┬───────┘    └──────────────┘    │  (VWAP/TWAP/IS/  │  │
│         │                               │   Adaptive AC)   │  │
│         ▼                               └────────┬─────────┘  │
│  ┌──────────────┐                                 │              │
│  │ Cascade      │                                 ▼              │
│  │ Feedback     │─────────────────────────▶ Price Path Update  │
│  └──────────────┘    (death spiral or stabilization)            │
└─────────────────────────────────────────────────────────────────┘
```

**Data flow:**
1. Vol regime detector emits regime → Liquidation Urgency Engine
2. Urgency score > threshold → Global Liquidation Engine activates
3. Engine queries Waterfall Reconstructor for expected cascade depth
4. Execution Algorithm (per archetype) produces trade schedule
5. Cascade Feedback updates price path → loop back to (1)

---

## Key References

- Almgren, R. & Chriss, N. (2000). *Optimal Execution of Portfolio Transactions.* Journal of Risk, 3(2).
- Almgren, R. & Chriss, N. (2001). *Bidding the Option Market.* Preprint.
- Cont, R. & Wagalath, L. (2016). *Institutional Investors and the Stylized Properties of Equity Returns.* 
- Gatheral, J. (2010). *No-Dynamic-Arbitrage and Market Impact.* CRC Press.
- Hyperliquid Whitepaper (2024). Liquidation Engine Specification.
