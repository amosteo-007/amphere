"""ORCA volatility computation service — Yang-Zhang sigma estimator.

This is a reusable boundary service, NOT an inline utility.
Writes to volatility_snapshot SQLite table on schedule.
"""

from __future__ import annotations

import math
import sqlite3
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Literal

InstrumentId = Literal["BRENT", "WTI"]
Estimator = Literal["yang_zhang", "close_close", "garch"]
Regime = Literal["LOW_VOL", "NORMAL_VOL", "HIGH_VOL", "CRISIS"]


@dataclass
class VolatilityRecord:
    """A single volatility_snapshot record, matching the SQLite table schema."""
    instrument_id: InstrumentId
    window_end: date
    estimator: Estimator
    sigma_annual: float
    sigma_14d: float | None
    percentile_rank: float | None
    regime: Regime
    z_score: float | None


@dataclass
class OHLCVBar:
    """One OHLCV bar."""
    date: date
    open: float
    high: float
    low: float
    close: float


# Historical baseline for z-score / percentile computation (1970-2000 approximate)
# These are rough historical vol averages for oil; replace with real computed baselines
_HISTORICAL_BASELINE = {"BRENT": 0.20, "WTI": 0.22}
_HISTORICAL_STD = {"BRENT": 0.08, "WTI": 0.09}


def compute_yang_zhang(
    ohlcv_data: list[OHLCVBar],
    window_days: int = 30,
) -> float:
    """
    Compute Yang-Zhang annualized volatility from OHLC bars.

    The Yang-Zhang estimator separates overnight (close-to-open) and
    intraday (open-to-close) volatility, and is more accurate for
    markets with overnight gaps (energy, equities).

    Formula:
        sigma² = sigma_oc² + alpha * sigma_co² + sigma_cc²
    Where alpha = 23.33 (constant) and the three terms are the
    variances of overnight, close-to-open, and intraday returns.

    For a simplified but robust version suitable for MVP:
        sigma²_oc = mean((close_prev - open_curr) / prev_close)²
        sigma²_cc = mean((close - open) / open)²
        sigma² = sigma_oc + sigma_cc  (simplified — omits alpha term)
        annualized = sqrt(sigma²) * sqrt(252)
    """
    if len(ohlcv_data) < window_days + 1:
        return 0.0

    window = ohlcv_data[-window_days:]

    overnight_returns = []
    intraday_returns = []

    for i in range(1, len(window)):
        prev = window[i - 1]
        curr = window[i]

        overnight_ret = (curr.open - prev.close) / prev.close if prev.close != 0 else 0.0
        intraday_ret = (curr.close - curr.open) / curr.open if curr.open != 0 else 0.0

        overnight_returns.append(overnight_ret)
        intraday_returns.append(intraday_ret)

    if not overnight_returns or not intraday_returns:
        return 0.0

    def variance(rList: list[float]) -> float:
        mean = sum(rList) / len(rList)
        return sum((r - mean) ** 2 for r in rList) / (len(rList) - 1)

    var_overnight = variance(overnight_returns)
    var_intraday = variance(intraday_returns)

    # Full Yang-Zhang uses: var = var_oc + alpha * var_co + var_cc
    # alpha ≈ 23.33 gives open-to-close more weight
    # Simplified: var = var_overnight + 0.5 * var_intraday (stable approximation)
    var_total = var_overnight + 0.5 * var_intraday
    sigma = math.sqrt(var_total)
    return sigma * math.sqrt(252)


def compute_rolling_14d(ohlcv_data: list[OHLCVBar]) -> float:
    """Compute 14-day rolling realized vol from close-to-close returns."""
    if len(ohlcv_data) < 15:
        return 0.0

    window = ohlcv_data[-14:]
    returns = []
    for i in range(1, len(window)):
        prev = window[i - 1].close
        curr = window[i].close
        if prev != 0:
            returns.append((curr - prev) / prev)

    if len(returns) < 2:
        return 0.0

    mean_ret = sum(returns) / len(returns)
    variance = sum((r - mean_ret) ** 2 for r in returns) / (len(returns) - 1)
    return math.sqrt(variance * 252)


def classify_regime(z_score: float) -> Regime:
    """Classify volatility regime from z-score vs historical mean."""
    if z_score > 2.5:
        return "CRISIS"
    elif z_score > 1.5:
        return "HIGH_VOL"
    elif z_score > 0.5:
        return "NORMAL_VOL"
    return "LOW_VOL"


def compute_percentile_rank(current_sigma: float, instrument_id: InstrumentId) -> float:
    """
    Compute percentile rank of current sigma vs historical baseline.
    Returns a value 0-1.
    """
    baseline = _HISTORICAL_BASELINE.get(instrument_id, 0.20)
    hist_std = _HISTORICAL_STD.get(instrument_id, 0.08)
    if hist_std == 0:
        return 0.5
    z = (current_sigma - baseline) / hist_std
    # Standard normal CDF approximation
    percentile = 0.5 * (1 + math.erf(z / math.sqrt(2)))
    return max(0.0, min(1.0, percentile))


def write_volatility_snapshot(db_path: str, record: VolatilityRecord) -> None:
    """
    Write one volatility_snapshot record to SQLite.
    Uses INSERT OR REPLACE for idempotency.
    """
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            """
            INSERT OR REPLACE INTO volatility_snapshot
                (instrument_id, window_end, estimator, sigma_annual,
                 sigma_14d, percentile_rank, regime, z_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record.instrument_id,
                record.window_end.isoformat(),
                record.estimator,
                record.sigma_annual,
                record.sigma_14d,
                record.percentile_rank,
                record.regime,
                record.z_score,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def compute_and_store(
    db_path: str,
    instrument_id: InstrumentId,
    ohlcv_data: list[OHLCVBar],
    window_days: int = 30,
    estimator: Estimator = "yang_zhang",
) -> VolatilityRecord:
    """
    End-to-end: compute Yang-Zhang sigma from OHLC data and write to DB.

    Returns the VolatilityRecord that was written.
    """
    window_end = ohlcv_data[-1].date if ohlcv_data else date.today()

    sigma_annual = compute_yang_zhang(ohlcv_data, window_days)
    sigma_14d = compute_rolling_14d(ohlcv_data)

    baseline = _HISTORICAL_BASELINE.get(instrument_id, 0.20)
    z_score = (sigma_annual - baseline) / _HISTORICAL_STD.get(instrument_id, 0.08) if _HISTORICAL_STD.get(instrument_id, 0.08) != 0 else 0.0

    percentile_rank = compute_percentile_rank(sigma_annual, instrument_id)
    regime = classify_regime(z_score)

    record = VolatilityRecord(
        instrument_id=instrument_id,
        window_end=window_end,
        estimator=estimator,
        sigma_annual=round(sigma_annual, 6),
        sigma_14d=round(sigma_14d, 6) if sigma_14d else None,
        percentile_rank=round(percentile_rank, 4),
        regime=regime,
        z_score=round(z_score, 4),
    )

    write_volatility_snapshot(db_path, record)
    return record
