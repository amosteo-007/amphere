"""Three rule-based trading archetypes for Phase 1.

All archetypes are fully deterministic — no look-ahead, no LLM.
Regime awareness comes from the VolatilityModule's volatility_regime output.
"""

from __future__ import annotations

from typing import Optional

from archetypes.base import (
    BaseArchetype,
    MarketState,
    Trade,
    Portfolio,
)
from data.schema import OHLCVData


# ---------------------------------------------------------------------------
# Trend Follower
# ---------------------------------------------------------------------------

class TrendFollower(BaseArchetype):
    """
    Buys on confirmed uptrends, sells on breakdown.

    Entry rules:
        - price > SMA-20 AND log_return > 0 AND volatility_regime != 'high'
        - Small position size in uncertain regimes

    Exit rules:
        - price < SMA-20 OR volatility_regime == 'high' ( Regime shift exit)
        - Stop-loss: 3 * vol_20d from entry

    Position sizing:
        - vol_20d < 50th pctile of history → full size (max_position_pct)
        - vol_20d > 75th pctile of history → half size
        - vol_20d > 90th pctile → no new entries
    """

    name = "trend_follower"

    def __init__(
        self,
        initial_cash: float = 1_000_000.0,
        stop_loss_atr: float = 3.0,
        max_position_pct: float = 0.20,
    ):
        super().__init__(initial_cash, max_position_pct)
        self.stop_loss_atr = stop_loss_atr
        self._entry_prices: dict[str, float] = {}
        self._position_size: float = 0.0

    def reset(self) -> None:
        super().reset()
        self._entry_prices = {}

    def _vol_regime_size(self, state: MarketState) -> float:
        """Position size scalar based on vol regime. Returns 0-1."""
        if state.vol_20d is None:
            return 0.5
        # These thresholds are hardcoded from prior 5y data distribution
        # Low regime: vol_20d < 0.6 annualized → full size
        # Mid regime: 0.6-1.0 → 50%
        # High regime: > 1.0 → 25%
        if state.vol_20d < 0.6:
            return 1.0
        elif state.vol_20d < 1.0:
            return 0.5
        elif state.vol_20d < 1.5:
            return 0.25
        return 0.0  # extreme vol — no new entries

    def get_signal(
        self,
        state: MarketState,
        all_states: dict[str, MarketState],
    ) -> Optional[dict]:
        ticker = state.ticker
        current_price = state.Close
        pos = self.portfolio.positions.get(ticker)

        # === EXIT LOGIC ===
        if pos and pos.quantity > 0:
            entry = self._entry_prices.get(ticker, current_price)
            # Stop loss
            if state.vol_20d and state.vol_20d > 0:
                atr = state.vol_20d * current_price / 365  # rough ATR proxy
                if current_price < entry - self.stop_loss_atr * atr:
                    return {"action": "sell", "quantity": pos.quantity}
            # Regime exit
            if state.volatility_regime == "high":
                return {"action": "sell", "quantity": pos.quantity}
            # Trend breakdown
            if state.sma_20 and current_price < state.sma_20:
                return {"action": "sell", "quantity": pos.quantity}
            # Don't add to losing position
            if state.log_return is not None and state.log_return < -0.01:
                return None

        # === ENTRY LOGIC ===
        # No position — look for entry
        if pos is None or pos.quantity == 0:
            if state.volatility_regime == "high":
                return None
            if state.sma_20 is None or state.sma_50 is None:
                return None
            # Price above both SMAs = confirmed uptrend
            above_sma = current_price > state.sma_20 and current_price > state.sma_50 * 1.0
            positive_return = state.log_return is not None and state.log_return > 0
            if above_sma and positive_return:
                size_scalar = self._vol_regime_size(state)
                if size_scalar == 0:
                    return None
                # Size: max_position_pct * size_scalar * portfolio_value / price
                max_qty = (
                    self.max_position_pct
                    * size_scalar
                    * self.portfolio.total_value({ticker: current_price})
                    / current_price
                )
                self._entry_prices[ticker] = current_price
                return {"action": "buy", "quantity": max(1.0, max_qty * 0.5)}
            return None

        return None


# ---------------------------------------------------------------------------
# Mean Reveter
# ---------------------------------------------------------------------------

class MeanReversion(BaseArchetype):
    """
    Fades extreme deviations from fair value (SMA-50).

    Entry rules:
        - price_vs_sma_50 < -0.10 (10% below fair value) → buy
        - price_vs_sma_50 > +0.10 (10% above fair value) → sell/short

    Exit rules:
        - price reverted to within 2% of SMA-50
        - OR vol spike (regime = 'high') → close all

    Position sizing:
        - Size inversely proportional to deviation (fatter tails at extremes)
        - Max short position = same as max long (max_position_pct)
    """

    name = "mean_reverter"

    def __init__(
        self,
        initial_cash: float = 1_000_000.0,
        entry_threshold: float = 0.10,
        exit_threshold: float = 0.02,
        max_position_pct: float = 0.20,
    ):
        super().__init__(initial_cash, max_position_pct)
        self.entry_threshold = entry_threshold
        self.exit_threshold = exit_threshold

    def get_signal(
        self,
        state: MarketState,
        all_states: dict[str, MarketState],
    ) -> Optional[dict]:
        ticker = state.ticker
        current_price = state.Close
        deviation = state.price_vs_sma_50  # price / sma_50 - 1
        pos = self.portfolio.positions.get(ticker)
        pos_qty = pos.quantity if pos else 0.0

        if state.sma_50 is None:
            return None

        # Regime exit — always close in high vol (reversion blows up)
        if state.volatility_regime == "high" and pos_qty != 0:
            return {"action": "sell", "quantity": abs(pos_qty)}

        # === EXIT ===
        if pos_qty != 0:
            # Long: price reverted near SMA-50
            if pos_qty > 0 and deviation is not None and abs(deviation) < self.exit_threshold:
                return {"action": "sell", "quantity": pos_qty}
            # Short: also exit near SMA-50
            if pos_qty < 0 and deviation is not None and abs(deviation) < self.exit_threshold:
                return {"action": "buy", "quantity": abs(pos_qty)}
            # No new trades while in position
            return None

        # === ENTRY ===
        if state.volatility_regime == "high":
            return None

        if deviation is None:
            return None

        portfolio_val = self.portfolio.total_value({ticker: current_price})
        max_notional = portfolio_val * self.max_position_pct

        # Deep undervaluation — buy
        if deviation < -self.entry_threshold:
            # Position size scales with deviation magnitude (more extreme = bigger)
            size_scalar = min(1.0, abs(deviation) / 0.20)
            qty = (max_notional * size_scalar) / current_price
            return {"action": "buy", "quantity": max(1.0, qty)}

        # Deep overvaluation — short (only if SMA-50 is meaningful)
        if deviation > self.entry_threshold:
            size_scalar = min(1.0, abs(deviation) / 0.20)
            qty = (max_notional * size_scalar) / current_price
            return {"action": "sell", "quantity": max(1.0, qty)}

        return None


# ---------------------------------------------------------------------------
# Liquidity Avoider
# ---------------------------------------------------------------------------

class LiquidityAvoider(BaseArchetype):
    """
    Stays in cash when market microstructure shows stress.

    Entry rules:
        - vol_20d < 60th percentile of recent history
        - No jump days (is_jump == False)
        - Price above SMA-20

    Exit rules:
        - ANY jump day → exit immediately
        - vol_20d crosses above 80th percentile → exit
        - Daily return < -3% intraday range → exit

    The goal is survival, not returns — this is the defensive archetype.
    Used as the baseline to compare whether risky trades are worth it.
    """

    name = "liquidity_avoider"

    def __init__(
        self,
        initial_cash: float = 1_000_000.0,
        vol_enter_threshold: float = 0.80,
        vol_exit_threshold: float = 1.0,
        max_position_pct: float = 0.20,
    ):
        super().__init__(initial_cash, max_position_pct)
        self.vol_enter_threshold = vol_enter_threshold
        self.vol_exit_threshold = vol_exit_threshold

    def get_signal(
        self,
        state: MarketState,
        all_states: dict[str, MarketState],
    ) -> Optional[dict]:
        ticker = state.ticker
        current_price = state.Close
        pos = self.portfolio.positions.get(ticker)
        pos_qty = pos.quantity if pos else 0.0

        # === EMERGENCY EXIT CONDITIONS ===
        if pos_qty > 0:
            # Jump detected → exit immediately
            if state.is_jump:
                return {"action": "sell", "quantity": pos_qty}
            # Extreme vol → exit
            if state.vol_20d and state.vol_20d > self.vol_exit_threshold:
                return {"action": "sell", "quantity": pos_qty}
            # Large intraday drawdown → exit (intraday Low far below Open)
            intraday_range = (state.High - state.Low) / state.Open
            if intraday_range > 0.05:  # >5% intraday range
                return {"action": "sell", "quantity": pos_qty}
            # Trend broken (price below SMA-20)
            if state.sma_20 and current_price < state.sma_20:
                return {"action": "sell", "quantity": pos_qty}
            return None

        # === ENTRY CONDITIONS ===
        # Must pass ALL filters
        if state.volatility_regime == "high":
            return None
        if state.is_jump:
            return None
        if state.sma_20 is None or current_price < state.sma_20:
            return None
        # Vol must be low enough
        if state.vol_20d and state.vol_20d > self.vol_enter_threshold:
            return None
        # Only enter when price is rising slightly
        if state.log_return is None or state.log_return <= 0:
            return None

        portfolio_val = self.portfolio.total_value({ticker: current_price})
        max_notional = portfolio_val * self.max_position_pct
        qty = max_notional / current_price
        return {"action": "buy", "quantity": max(1.0, qty * 0.5)}
