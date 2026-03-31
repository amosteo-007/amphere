"""Statistics pipeline — pluggable modules for market data enrichment.

Every module implements the StatModule interface and can be swapped in/out
without touching the archetype or simulation code.

Example usage:
    pipeline = StatisticsPipeline([
        VolatilityModule(),
        SMAModule(windows=[20, 50]),
        JumpFlagModule(),
    ])
    enriched = pipeline.fit_transform(raw_df)
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Interface
# ---------------------------------------------------------------------------

class StatModule(ABC):
    """Interface for all statistics pipeline modules."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique identifier for this module."""
        ...

    @abstractmethod
    def fit(self, data: pd.DataFrame) -> None:
        """
        Fit any parameters on historical data (optional for v1 modules).
        Called once before transform.
        """
        ...

    @abstractmethod
    def transform(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Add derived columns to data.
        Must NOT drop or reorder rows — alignment is preserved.
        Returns a new DataFrame with additional columns.
        """
        ...

    def fit_transform(self, data: pd.DataFrame) -> pd.DataFrame:
        self.fit(data)
        return self.transform(data)


# ---------------------------------------------------------------------------
# StatisticsPipeline — runs a sequence of modules
# ---------------------------------------------------------------------------

class StatisticsPipeline:
    """Runs a list of StatModule instances in order."""

    def __init__(self, modules: list[StatModule]):
        self.modules = modules

    def fit(self, data: pd.DataFrame) -> None:
        for module in self.modules:
            module.fit(data)

    def transform(self, data: pd.DataFrame) -> pd.DataFrame:
        result = data.copy()
        for module in self.modules:
            before = set(result.columns)
            result = module.transform(result)
            added = set(result.columns) - before
            logger.debug(
                "%s added columns: %s", module.name, sorted(added)
            )
        return result

    def fit_transform(self, data: pd.DataFrame) -> pd.DataFrame:
        self.fit(data)
        return self.transform(data)


# ---------------------------------------------------------------------------
# Module 1: Log Returns
# ---------------------------------------------------------------------------

class LogReturnModule(StatModule):
    """
    Adds a log_return column: ln(close_t / close_{t-1}).

    No fitting required.
    """

    @property
    def name(self) -> str:
        return "log_return"

    def fit(self, data: pd.DataFrame) -> None:
        pass

    def transform(self, data: pd.DataFrame) -> pd.DataFrame:
        df = data.copy()
        df["log_return"] = np.log(df["Close"] / df["Close"].shift(1))
        return df


# ---------------------------------------------------------------------------
# Module 2: Rolling Volatility + Regime Detection
# ---------------------------------------------------------------------------

class VolatilityModule(StatModule):
    """
    Computes rolling annualized volatility and classifies regime.

    Regime logic (v1 — hard threshold):
        - Rolling 20-day realized vol vs 75th percentile of 90-day window
        - Above threshold  → 'high'
        - Below or equal   → 'low'

    Output columns:
        - vol_20d       : 20-day annualized volatility (float)
        - volatility_regime : 'low' | 'high'

    No fitting required — all thresholds are hardcoded to avoid
    look-ahead bias on historical data.
    """

    def __init__(
        self,
        window_vol: int = 20,
        window_regime: int = 90,
        pctile: float = 75.0,
    ):
        self.window_vol = window_vol
        self.window_regime = window_regime
        self.pctile = pctile

    @property
    def name(self) -> str:
        return "volatility_simple"

    def fit(self, data: pd.DataFrame) -> None:
        pass

    def transform(self, data: pd.DataFrame) -> pd.DataFrame:
        df = data.copy()

        # Log returns
        if "log_return" not in df.columns:
            df["log_return"] = np.log(df["Close"] / df["Close"].shift(1))

        # Annualized rolling volatility (sqrt(252) trading days)
        df["vol_20d"] = (
            df["log_return"]
            .rolling(self.window_vol)
            .std()
            * np.sqrt(365)
        )

        # Rolling percentile of realized vol as threshold
        rolling_pctile = df["vol_20d"].rolling(self.window_regime).quantile(
            self.pctile / 100
        )

        df["volatility_regime"] = np.where(
            df["vol_20d"] > rolling_pctile, "high", "low"
        )
        # Fill NaN from warm-up period with 'low'
        mask = df["vol_20d"].isna()
        df.loc[mask, "volatility_regime"] = "low"

        return df


# ---------------------------------------------------------------------------
# Module 3: Simple Moving Averages
# ---------------------------------------------------------------------------

class SMAModule(StatModule):
    """
    Computes rolling simple moving averages and price-vs-SMA deviation.

    Output columns:
        - sma_<N>           : N-day SMA of Close
        - price_vs_sma_<N>  : Close / sma_<N> - 1 (fractional deviation)

    No fitting required.
    """

    def __init__(self, windows: list[int] = (20, 50)):
        self.windows = windows

    @property
    def name(self) -> str:
        return "sma"

    def fit(self, data: pd.DataFrame) -> None:
        pass

    def transform(self, data: pd.DataFrame) -> pd.DataFrame:
        df = data.copy()
        for w in self.windows:
            col = f"sma_{w}"
            df[col] = df["Close"].rolling(w).mean()
            df[f"price_vs_sma_{w}"] = df["Close"] / df[col] - 1
        return df


# ---------------------------------------------------------------------------
# Module 4: Jump Detection (Simple Z-Score)
# ---------------------------------------------------------------------------

class JumpFlagModule(StatModule):
    """
    Flags days where the log return is > N standard deviations from
    a rolling mean — a simple proxy for price jumps.

    Output columns:
        - z_score  : rolling z-score of log_return
        - is_jump  : True if |z_score| > threshold

    Based on the same logic as the Barndorff-Nielsen & Shephard (2006)
    bipower variation test, but simplified to rolling z-score for v1.

    No fitting required.
    """

    def __init__(
        self,
        window: int = 20,
        n_std: float = 4.0,
    ):
        self.window = window
        self.n_std = n_std

    @property
    def name(self) -> str:
        return "jump_flag"

    def fit(self, data: pd.DataFrame) -> None:
        pass

    def transform(self, data: pd.DataFrame) -> pd.DataFrame:
        df = data.copy()

        if "log_return" not in df.columns:
            df["log_return"] = np.log(df["Close"] / df["Close"].shift(1))

        rolling_mean = df["log_return"].rolling(self.window).mean()
        rolling_std = df["log_return"].rolling(self.window).std()

        df["z_score"] = (df["log_return"] - rolling_mean) / rolling_std
        df["is_jump"] = np.abs(df["z_score"]) > self.n_std

        return df


# ---------------------------------------------------------------------------
# Module 5: Full MVP Pipeline
# ---------------------------------------------------------------------------

def mvp_pipeline() -> StatisticsPipeline:
    """
    Returns the standard Phase 1 statistics pipeline.

    Adds columns:
        log_return, vol_20d, volatility_regime,
        sma_20, sma_50, price_vs_sma_20, price_vs_sma_50,
        z_score, is_jump
    """
    return StatisticsPipeline([
        LogReturnModule(),
        VolatilityModule(),
        SMAModule(windows=[20, 50]),
        JumpFlagModule(),
    ])


def describe_regimes(df: pd.DataFrame) -> pd.DataFrame:
    """
    Summarise volatility regime distribution in a DataFrame
    that has a 'volatility_regime' column.
    """
    counts = df["volatility_regime"].value_counts()
    pct = counts / len(df) * 100
    summary = pd.DataFrame({
        "count": counts,
        "pct": pct,
    })
    logger.info(
        "Regime distribution:\n%s",
        summary.to_string(),
    )
    return summary
