"""Tests for archetypes and simulation engine."""

import sys
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / ".deps"))
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import pandas as pd
import numpy as np

from archetypes.base import Portfolio, Position, MarketState, Trade
from archetypes.strategies import TrendFollower, MeanReversion, LiquidityAvoider
from simulation.engine import MarketSimulator, SimConfig


logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_enriched_df(n: int = 200, seed: int = 7) -> pd.DataFrame:
    """Build a synthetic enriched DataFrame for archetype testing."""
    rng = np.random.default_rng(seed)
    dates = pd.date_range("2024-01-01", periods=n, freq="B")
    log_ret = rng.normal(0.001, 0.02, n)
    price = 100_000 * np.exp(np.cumsum(log_ret))
    sma20 = pd.Series(price).rolling(20).mean()
    sma50 = pd.Series(price).rolling(50).mean()
    vol20 = pd.Series(log_ret).rolling(20).std() * np.sqrt(365)

    return pd.DataFrame(
        {
            "Open": price * 0.999,
            "High": price * 1.005,
            "Low": price * 0.995,
            "Close": price,
            "Volume": rng.integers(1e9, 2e9, n).astype(float),
            "log_return": log_ret,
            "vol_20d": vol20,
            "volatility_regime": np.where(vol20 > 0.8, "high", "low"),
            "sma_20": sma20,
            "sma_50": sma50,
            "price_vs_sma_20": price / sma20 - 1,
            "price_vs_sma_50": price / sma50 - 1,
            "z_score": np.zeros(n),
            "is_jump": pd.Series([False] * n),
        },
        index=pd.DatetimeIndex(dates, name="timestamp"),
    )


# ---------------------------------------------------------------------------
# Portfolio tests
# ---------------------------------------------------------------------------

def test_portfolio_apply_trade():
    p = Portfolio(cash=100_000.0)
    # Buy 0.3 BTC at 50k → cost=15k → cash=85k, pos=0.3 BTC
    assert p.apply_trade("BTC", 0.3, 50_000.0) is True
    assert p.positions["BTC"].quantity == 0.3
    assert p.cash == 85_000.0
    # Sell 0.2 BTC at 55k → receive 11k → cash=96k, BTC qty=0.1
    assert p.apply_trade("BTC", -0.2, 55_000.0) is True
    assert np.isclose(p.positions["BTC"].quantity, 0.1)
    assert p.cash == 96_000.0
    # Buy 10 BTC at 50k against 61k cash → cost=500k > 60.39k cash*0.99 → rejected
    p2 = Portfolio(cash=1_000.0)
    assert p2.apply_trade("BTC", 1.0, 200_000.0) is False
    # Position overweight guard — start fresh with 1M cash
    p3 = Portfolio(cash=1_000_000.0)
    # Buy 1 BTC @ 100k = 10% of portfolio → allowed
    assert p3.apply_trade("BTC", 1.0, 100_000.0) is True
    assert p3.cash == 900_000.0
    # Adding 10 more BTC would be 1.1M/1.9M ≈ 58% of portfolio → rejected
    assert p3.apply_trade("BTC", 10.0, 100_000.0) is False
    print("  Portfolio.apply_trade    ok")


# ---------------------------------------------------------------------------
# Archetype signal tests
# ---------------------------------------------------------------------------

def test_trend_follower_entry_exit():
    df = make_enriched_df(100)
    arch = TrendFollower(initial_cash=1_000_000.0)

    # Inject a clear uptrend in row 99 (last row)
    state = MarketState.from_row("BTC", df.iloc[-1])
    # Make it a clear uptrend
    state.sma_20 = state.Close * 0.95
    state.sma_50 = state.Close * 0.93
    state.log_return = 0.02
    state.vol_20d = 0.4
    state.volatility_regime = "low"
    state.price_vs_sma_20 = 0.05
    state.price_vs_sma_50 = 0.07

    sig = arch.get_signal(state, {})
    assert sig is not None, "Should generate buy signal in uptrend"
    assert sig["action"] == "buy"
    print("  TrendFollower entry       ok")

    # Now test regime exit
    arch2 = TrendFollower(initial_cash=1_000_000.0)
    arch2._entry_prices["BTC"] = state.Close
    arch2.portfolio.positions["BTC"] = Position("BTC", quantity=1.0)
    arch2.portfolio.cash = 500_000.0
    state2 = MarketState.from_row("BTC", df.iloc[-1])
    state2.volatility_regime = "high"  # Regime switch
    sig2 = arch2.get_signal(state2, {})
    assert sig2 is not None
    assert sig2["action"] == "sell"
    print("  TrendFollower regime exit ok")


def test_mean_reverter():
    df = make_enriched_df(100)
    arch = MeanReversion(initial_cash=1_000_000.0)

    state = MarketState.from_row("BTC", df.iloc[-1])
    # 15% below fair value → should buy
    state.price_vs_sma_50 = -0.15
    state.volatility_regime = "low"
    state.sma_50 = state.Close / 0.85
    sig = arch.get_signal(state, {})
    assert sig is not None and sig["action"] == "buy"
    print("  MeanReversion entry      ok")

    # In high vol, should not enter
    state3 = MarketState.from_row("BTC", df.iloc[-1])
    state3.price_vs_sma_50 = -0.15
    state3.volatility_regime = "high"
    sig3 = arch.get_signal(state3, {})
    assert sig3 is None, "Mean reverter should not enter in high vol"
    print("  MeanReversion vol guard  ok")


def test_liquidity_avoider():
    df = make_enriched_df(100)
    arch = LiquidityAvoider(initial_cash=1_000_000.0)

    # Build a valid "all green" entry state
    state = MarketState.from_row("BTC", df.iloc[-1])
    state.vol_20d = 0.4
    state.volatility_regime = "low"
    state.is_jump = False
    state.sma_20 = state.Close * 0.98   # price > sma_20
    state.sma_50 = state.Close * 0.96
    state.log_return = 0.005            # positive return
    state.price_vs_sma_20 = 0.02
    sig = arch.get_signal(state, {})
    assert sig is not None and sig["action"] == "buy"
    print("  LiquidityAvoider entry   ok")

    # Jump detected → must exit
    arch.portfolio.positions["BTC"] = Position("BTC", quantity=5.0)
    state2 = MarketState.from_row("BTC", df.iloc[-1])
    state2.is_jump = True
    sig2 = arch.get_signal(state2, {})
    assert sig2 is not None and sig2["action"] == "sell"
    assert sig2["quantity"] == 5.0
    print("  LiquidityAvoider jump exit ok")


# ---------------------------------------------------------------------------
# Full simulation smoke test (synthetic data)
# ---------------------------------------------------------------------------

def test_full_simulation_synthetic():
    config = SimConfig(
        tickers=["BTC-USD"],
        start_date="2024-01-01",
        end_date="2024-06-30",
        initial_cash=1_000_000.0,
    )
    sim = MarketSimulator(config)

    # Load synthetic data directly
    df = make_enriched_df(200)
    sim._enriched["BTC-USD"] = df

    result = sim.run_archetype(LiquidityAvoider(initial_cash=1_000_000.0))
    assert result.final_value > 0
    assert result.num_trades >= 0
    assert not np.isnan(result.cvar_95)
    print(f"  Full simulation (synthetic): final=${result.final_value:,.0f}  trades={result.num_trades}")
    print("  Full simulation           ok")


# ---------------------------------------------------------------------------
# Full simulation with real cached data
# ---------------------------------------------------------------------------

def test_full_simulation_real():
    raw_dir = Path(__file__).parent.parent / "data" / "raw"
    if not (raw_dir / "BTC_USD_1d_2020-08-31_2025-09-01.csv").exists():
        print("  real data not present — skipped")
        return

    config = SimConfig(
        tickers=["BTC-USD"],
        start_date="2020-08-31",
        end_date="2025-09-01",
        initial_cash=1_000_000.0,
    )
    sim = MarketSimulator(config)
    sim.load_data()

    results = sim.run_all(
        include_trend_follower=True,
        include_mean_reverter=True,
        include_liquidity_avoider=True,
    )
    MarketSimulator.print_summary(results)

    for name, r in results.items():
        assert r.final_value > 0
        assert not np.isnan(r.cvar_95)
    print("  Real data simulation     ok")


# ---------------------------------------------------------------------------
# Shock injection test
# ---------------------------------------------------------------------------

def test_shock_injection():
    raw_dir = Path(__file__).parent.parent / "data" / "raw"
    if not (raw_dir / "BTC_USD_1d_2020-08-31_2025-09-01.csv").exists():
        print("  real data not present — skipped")
        return

    config = SimConfig(
        tickers=["BTC-USD"],
        start_date="2024-01-01",
        end_date="2024-12-31",
        initial_cash=1_000_000.0,
        shock_date="2024-03-01",
        shock_ticker="BTC-USD",
        shock_type="price_drop",
        shock_magnitude=0.50,
    )
    sim = MarketSimulator(config)
    sim.load_data()

    close_before = sim._enriched["BTC-USD"].loc[
        sim._enriched["BTC-USD"].index >= "2024-03-01"
    ].iloc[0]["Close"]
    sim.inject_shock("2024-03-01", "BTC-USD", "price_drop", 0.50)
    close_after = sim._enriched["BTC-USD"].loc[
        sim._enriched["BTC-USD"].index >= "2024-03-01"
    ].iloc[0]["Close"]
    assert close_after < close_before
    print(f"  Shock injection: BTC dropped ${close_before:.0f} → ${close_after:.0f}")
    print("  Shock injection           ok")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("\n=== archetype + simulation tests ===")
    test_portfolio_apply_trade()
    test_trend_follower_entry_exit()
    test_mean_reverter()
    test_liquidity_avoider()
    test_full_simulation_synthetic()
    test_full_simulation_real()
    test_shock_injection()
    print("\nAll archetype + simulation tests passed")
