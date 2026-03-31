"""Tests for the data layer."""

import sys
from pathlib import Path

# Ensure deps are on path before any data imports
sys.path.insert(0, str(Path(__file__).parent.parent / ".deps"))

from data.schema import MarketSlice, OHLCVData
from data.fetcher import fetch_yfinance, fetch_crypto_5y, validate_data_quality


def test_schema():
    """MarketSlice and OHLCVData dataclasses."""
    import pandas as pd
    df = pd.DataFrame({
        "Open":   [100, 101],
        "High":   [105, 103],
        "Low":    [99,  98],
        "Close":  [102, 100],
        "Volume": [1000, 1100],
    }, index=pd.to_datetime(["2025-07-01", "2025-07-02"]))

    ohlcv = OHLCVData(
        ticker="BTC-USD",
        interval="1d",
        start=pd.Timestamp("2025-07-01"),
        end=pd.Timestamp("2025-07-03"),
        df=df,
    )
    assert len(ohlcv) == 2
    assert ohlcv.shape == (2, 5)
    assert list(ohlcv.df.columns) == ["Open", "High", "Low", "Close", "Volume"]

    sl = MarketSlice(
        timestamp=pd.Timestamp("2025-07-01"),
        open=100, high=105, low=99, close=102, volume=1000,
        volatility_regime="low",
    )
    assert sl.volatility_regime == "low"
    enriched = sl.with_enriched(log_return=0.02, sma_20=101.0)
    assert enriched.log_return == 0.02
    assert enriched.sma_20 == 101.0
    print("  ✓ schema")


def test_fetch_yfinance():
    """Small fetch from Yahoo Finance."""
    data = fetch_yfinance(
        "BTC-USD",
        start="2025-08-01",
        end="2025-08-15",
        write_dir=Path(__file__).parent.parent / "data" / "raw",
    )
    assert len(data.df) > 0
    assert list(data.df.columns) == ["Open", "High", "Low", "Close", "Volume"]
    assert (data.df["Close"] > 0).all()
    assert (data.df["High"] >= data.df["Low"]).all()
    assert (data.df["Close"] <= data.df["High"]).all()
    assert (data.df["Close"] >= data.df["Low"]).all()
    print(f"  ✓ fetch_yfinance ({len(data.df)} rows)")
    return data


def test_validate():
    """Quality checks on real data."""
    raw_dir = Path(__file__).parent.parent / "data" / "raw"
    btc_path = raw_dir / "BTC_USD_1d_2020-08-31_2025-09-01.csv"
    import pandas as pd
    df = pd.read_csv(btc_path, parse_dates=["timestamp"], index_col="timestamp")
    ohlcv = OHLCVData(
        ticker="BTC-USD",
        interval="1d",
        start=df.index[0],
        end=df.index[-1],
        df=df,
    )
    warnings = validate_data_quality(ohlcv)
    assert warnings == {}, f"Quality warnings: {warnings}"
    print(f"  ✓ validate_data_quality ({len(ohlcv.df)} rows, clean)")


def test_fetch_crypto_5y():
    """Full 5-year fetch."""
    raw_dir = Path(__file__).parent.parent / "data" / "raw"
    results = fetch_crypto_5y(
        ["BTC-USD", "ETH-USD"],
        end="2025-08-31",
        write_dir=raw_dir,
    )
    for ticker, ohlcv in results.items():
        assert len(ohlcv.df) > 1500, f"{ticker} has only {len(ohlcv.df)} rows"
        assert ohlcv.df.index[0].year >= 2020, f"{ticker} starts too late"
        assert ohlcv.df.index[-1].year >= 2025, f"{ticker} ends too early"
        print(f"  ✓ {ticker}: {len(ohlcv.df)} rows  "
              f"{ohlcv.df.index[0].date()} → {ohlcv.df.index[-1].date()}")


if __name__ == "__main__":
    print("\n=== data layer tests ===")
    test_schema()
    test_fetch_yfinance()
    test_validate()
    test_fetch_crypto_5y()
    print("\nAll data layer tests passed ✓\n")
