"""
Yahoo Finance OHLCV fetcher — stdlib + pandas only.
Uses the v8/finance/chart JSON API (what Yahoo Finance web uses).
No pip dependencies required beyond pandas/numpy/scipy/sklearn.
"""

from __future__ import annotations

import logging
import math
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional

import pandas as pd

from .schema import OHLCVData

logger = logging.getLogger(__name__)

DEFAULT_RAW_DIR = Path(__file__).parent.parent.parent / "data" / "raw"

_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"


def _build_chart_url(ticker: str, period1: int, period2: int, interval: str = "1d") -> str:
    params = (
        f"period1={period1}"
        f"&period2={period2}"
        f"&interval={interval}"
        f"&includePrePost=false"
        f"&events=history"
    )
    return f"{_CHART_URL.format(ticker=ticker)}?{params}"


def _fetch_json(ticker: str, period1: int, period2: int, interval: str = "1d") -> dict:
    """Fetch JSON from Yahoo Finance chart API."""
    url = _build_chart_url(ticker, period1, period2, interval)
    logger.info("Fetching %s", url[:120])

    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            import json
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Yahoo API HTTP {e.code} for {ticker}: {url}") from e
    except Exception as e:
        raise RuntimeError(f"Yahoo API failed for {ticker}: {e}") from e


def _parse_yahoo_json(ticker: str, payload: dict) -> pd.DataFrame:
    """Parse Yahoo Finance v8 chart JSON into a DataFrame."""
    result = payload.get("chart", {}).get("result")
    if not result:
        error = payload.get("chart", {}).get("error", {})
        raise ValueError(f"Yahoo returned no result for {ticker}: {error}")

    result = result[0]
    timestamps = result["timestamp"]
    quote = result["indicators"]["quote"][0]

    df = pd.DataFrame({
        "timestamp": pd.to_datetime(timestamps, unit="s", utc=True),
        "Open":    quote.get("open"),
        "High":    quote.get("high"),
        "Low":     quote.get("low"),
        "Close":   quote.get("close"),
        "Volume":  quote.get("volume"),
    })

    df = df.dropna(subset=["Close", "timestamp"])
    df = df.set_index("timestamp").sort_index()
    df.index = df.index.tz_localize(None)  # naive datetime for consistency

    # Standardise column order
    df = df[["Open", "High", "Low", "Close", "Volume"]]
    return df


def fetch_yfinance(
    ticker: str,
    start,
    end,
    interval: str = "1d",
    write_dir: Optional[Path | str] = None,
    force: bool = False,
) -> OHLCVData:
    """
    Fetch daily OHLCV from Yahoo Finance (JSON API, no auth required).

    Parameters
    ----------
    ticker : str
        Yahoo Finance ticker, e.g. "BTC-USD", "ETH-USD".
    start, end : date-like
        Inclusive start, exclusive end.
    interval : str
        Yahoo interval string. Default "1d". Also supports "1h", "1wk", etc.
    write_dir : Path, optional
        Cache downloaded CSV here.
    force : bool
        Re-download even if cached.

    Returns
    -------
    OHLCVData
    """
    start_ts = pd.Timestamp(start)
    end_ts = pd.Timestamp(end)

    cache_path = None
    if write_dir is not None:
        write_dir = Path(write_dir)
        write_dir.mkdir(parents=True, exist_ok=True)
        cache_path = (
            write_dir
            / f"{ticker.replace('-', '_')}_{interval}_{start_ts.date()}_{end_ts.date()}.csv"
        )

    if cache_path and cache_path.exists() and not force:
        logger.info("Loading from cache: %s", cache_path)
        df = pd.read_csv(cache_path, parse_dates=["timestamp"], index_col="timestamp")
        return OHLCVData(ticker=ticker, interval=interval,
                         start=start_ts, end=end_ts, df=df)

    period1 = int(start_ts.timestamp())
    period2 = int(end_ts.timestamp())

    payload = _fetch_json(ticker, period1, period2, interval)
    df = _parse_yahoo_json(ticker, payload)

    if cache_path:
        df.to_csv(cache_path)
        logger.info("Cached to %s  (%d rows)", cache_path, len(df))

    return OHLCVData(ticker=ticker, interval=interval,
                     start=start_ts, end=end_ts, df=df)


def fetch_crypto_5y(
    tickers: list[str] = ["BTC-USD", "ETH-USD"],
    end: str | pd.Timestamp = "2025-08-31",
    write_dir: Optional[Path | str] = None,
    force: bool = False,
) -> dict[str, OHLCVData]:
    """
    Fetch 5 years of daily OHLCV for the given tickers.

    The end date is deliberately set to 2025-08-31 — the last date an LLM
    with a knowledge cutoff in August 2025 would have seen in training.
    This lets events after that date (e.g. Oct 10, 2025) serve as
    genuine forward-tests.

    Parameters
    ----------
    tickers : list[str]
    end : str | pd.Timestamp
        Last date (inclusive). Default "2025-08-31".
    write_dir : Path, optional
    force : bool

    Returns
    -------
    dict[str, OHLCVData]
    """
    end_dt = pd.Timestamp(end)
    start_dt = end_dt - pd.DateOffset(years=5)

    results = {}
    for ticker in tickers:
        data = fetch_yfinance(
            ticker=ticker,
            start=start_dt,
            end=end_dt + pd.Timedelta(days=1),
            interval="1d",
            write_dir=write_dir,
            force=force,
        )
        results[ticker] = data
        rows = len(data.df)
        actual_start = data.df.index[0].date()
        actual_end = data.df.index[-1].date()
        logger.info(
            "  %-10s  rows=%-5d  actual_range=%s → %s",
            ticker, rows, actual_start, actual_end
        )
    return results


def validate_data_quality(data: OHLCVData) -> dict:
    """
    Sanity-check an OHLCVData object.
    Returns a dict of warnings (empty = clean).
    """
    df = data.df
    warnings = {}

    # Check for missing days (allow ~2% gaps for weekends/holidays on daily)
    expected = pd.date_range(df.index[0], df.index[-1], freq="B")  # business days
    missing_pct = 1 - len(df) / len(expected)
    if missing_pct > 0.05:
        warnings["missing_days_pct"] = round(missing_pct, 4)

    # Check for zero-volume rows
    zero_vol = (df["Volume"] == 0).sum()
    if zero_vol > 0:
        warnings["zero_volume_rows"] = zero_vol

    # Check for NaN
    nan_counts = df.isna().sum()
    if nan_counts.any():
        warnings["nan_counts"] = nan_counts[nan_counts > 0].to_dict()

    # Check High < Low (data error)
    invalid_hl = (df["High"] < df["Low"]).sum()
    if invalid_hl > 0:
        warnings["high_below_low"] = invalid_hl

    # Check for close outside High-Low range
    oob = ((df["Close"] < df["Low"]) | (df["Close"] > df["High"])).sum()
    if oob > 0:
        warnings["close_out_of_range"] = oob

    return warnings
