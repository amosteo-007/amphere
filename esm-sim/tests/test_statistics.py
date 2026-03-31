"""Tests for the statistics pipeline."""

import sys
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / ".deps"))

import numpy as np
import pandas as pd

from statistics.pipeline import (
    LogReturnModule,
    VolatilityModule,
    SMAModule,
    JumpFlagModule,
    StatisticsPipeline,
    mvp_pipeline,
    describe_regimes,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_btc_df(n: int = 200, seed: int = 42) -> pd.DataFrame:
    """Synthetic BTC-like price series for testing."""
    rng = np.random.default_rng(seed)
    dates = pd.date_range("2024-01-01", periods=n, freq="B")
    log_returns = rng.normal(0.001, 0.02, n)
    price = 100_000 * np.exp(np.cumsum(log_returns))
    return pd.DataFrame(
        {
            "Open": price,
            "High": price * 1.01,
            "Low": price * 0.99,
            "Close": price,
            "Volume": rng.integers(1e9, 2e9, n).astype(float),
        },
        index=pd.DatetimeIndex(dates, name="timestamp"),
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_log_return_module():
    df = make_btc_df(10)
    mod = LogReturnModule()
    out = mod.fit_transform(df)

    assert "log_return" in out.columns
    expected_lr = np.log(out["Close"].iloc[1] / out["Close"].iloc[0])
    assert abs(out["log_return"].iloc[1] - expected_lr) < 1e-9
    assert np.isnan(out["log_return"].iloc[0])
    print("  LogReturnModule          ok")


def test_volatility_module():
    df = make_btc_df(200)
    mod = VolatilityModule()
    out = mod.fit_transform(df)

    assert "vol_20d" in out.columns
    assert "volatility_regime" in out.columns
    assert set(out["volatility_regime"].dropna().unique()).issubset({"low", "high"})
    assert (out["volatility_regime"].iloc[:90] == "low").all()
    assert out["vol_20d"].notna().sum() >= 110
    print("  VolatilityModule          ok")


def test_volatility_regime_changes_with_vol():
    rng = np.random.default_rng(99)
    dates = pd.date_range("2024-01-01", periods=300, freq="B")
    returns_low = rng.normal(0.001, 0.01, 150)
    returns_high = rng.normal(0.001, 0.05, 150)
    log_returns = np.concatenate([returns_low, returns_high])
    price = 100_000 * np.exp(np.cumsum(log_returns))
    df = pd.DataFrame(
        {
            "Open": price,
            "High": price * 1.01,
            "Low": price * 0.99,
            "Close": price,
            "Volume": rng.integers(1e9, 2e9, 300).astype(float),
        },
        index=pd.DatetimeIndex(dates, name="timestamp"),
    )

    mod = VolatilityModule()
    out = mod.fit_transform(df)

    early_high = (out["volatility_regime"].iloc[100:140] == "high").sum()
    late_high = (out["volatility_regime"].iloc[240:280] == "high").sum()
    assert late_high > early_high, (
        f"Expected more high-regime in volatile period "
        f"(late={late_high}, early={early_high})"
    )
    print("  VolatilityModule regime   ok")


def test_sma_module():
    df = make_btc_df(60)
    mod = SMAModule(windows=[20, 50])
    out = mod.fit_transform(df)

    assert "sma_20" in out.columns
    assert "sma_50" in out.columns
    assert "price_vs_sma_20" in out.columns
    assert "price_vs_sma_50" in out.columns

    expected_sma20 = out["Close"].iloc[5:25].mean()
    assert abs(out["sma_20"].iloc[24] - expected_sma20) < 1e-9

    expected_dev = out["Close"].iloc[30] / out["sma_20"].iloc[30] - 1
    assert abs(out["price_vs_sma_20"].iloc[30] - expected_dev) < 1e-9

    assert out["sma_50"].iloc[:49].isna().all()
    assert not np.isnan(out["sma_50"].iloc[49])
    print("  SMAModule                 ok")


def test_jump_flag_module():
    rng = np.random.default_rng(7)
    dates = pd.date_range("2024-01-01", periods=100, freq="B")
    returns = rng.normal(0, 0.01, 99)
    returns = np.concatenate([[0.0], returns])
    returns[50] = 0.15
    price = 100_000 * np.exp(np.cumsum(returns))
    df = pd.DataFrame(
        {
            "Open": price,
            "High": price * 1.01,
            "Low": price * 0.99,
            "Close": price,
            "Volume": rng.integers(1e9, 2e9, 100).astype(float),
        },
        index=pd.DatetimeIndex(dates, name="timestamp"),
    )

    mod = JumpFlagModule(window=20, n_std=4.0)
    out = mod.fit_transform(df)

    assert "z_score" in out.columns
    assert "is_jump" in out.columns
    assert out["is_jump"].sum() >= 1, "Jump should be flagged"
    print("  JumpFlagModule            ok")


def test_pipeline_alignment():
    df = make_btc_df(200)
    pipeline = mvp_pipeline()
    out = pipeline.fit_transform(df)

    assert len(out) == len(df), "Pipeline must not drop or add rows"
    assert list(out.index) == list(df.index), "Index must be preserved"
    for col in ["Open", "High", "Low", "Close", "Volume"]:
        assert col in out.columns
    print("  StatisticsPipeline        ok")


def test_pipeline_with_real_data():
    raw_dir = Path(__file__).parent.parent / "data" / "raw"
    btc_path = raw_dir / "BTC_USD_1d_2020-08-31_2025-09-01.csv"
    if not btc_path.exists():
        print("  real data not present — skipped")
        return

    df = pd.read_csv(btc_path, parse_dates=["timestamp"], index_col="timestamp")
    pipeline = mvp_pipeline()
    out = pipeline.fit_transform(df)

    assert len(out) == len(df)
    assert out["vol_20d"].notna().sum() > 100
    high_count = (out["volatility_regime"] == "high").sum()
    low_count = (out["volatility_regime"] == "low").sum()
    print(
        f"  real BTC data ({len(df)} rows): "
        f"{high_count} high, {low_count} low regime"
    )
    if out["is_jump"].sum() > 0:
        print(f"  JumpFlag detected {out['is_jump'].sum()} jump days")


def test_describe_regimes():
    df = make_btc_df(200)
    mod = VolatilityModule()
    out = mod.fit_transform(df)
    summary = describe_regimes(out)
    assert "count" in summary.columns
    assert "pct" in summary.columns
    assert summary["count"].sum() == len(out)
    print("  describe_regimes          ok")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    print("\n=== statistics module tests ===")
    test_log_return_module()
    test_volatility_module()
    test_volatility_regime_changes_with_vol()
    test_sma_module()
    test_jump_flag_module()
    test_pipeline_alignment()
    test_pipeline_with_real_data()
    test_describe_regimes()
    print("\nAll statistics tests passed")
