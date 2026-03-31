"""Simulation engine — runs archetypes through historical market data.

Architecture:
    1. Load raw OHLCV from cache (or fetch from Yahoo)
    2. Run StatisticsPipeline to enrich with derived columns
    3. For each archetype, simulate trading through the enriched data
    4. Collect per-archetype summaries + event log

The simulation is strictly historical — each timestep only sees
data up to that point (no look-ahead).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from archetypes.base import BaseArchetype, MarketState, Trade
from archetypes.strategies import TrendFollower, MeanReversion, LiquidityAvoider
from data.fetcher import load_or_fetch
from data.schema import OHLCVData
from statistics.pipeline import mvp_pipeline

logger = logging.getLogger(__name__)


@dataclass
class SimConfig:
    """Configuration for a simulation run."""
    tickers: list[str] = field(default_factory=lambda: ["BTC-USD", "ETH-USD"])
    start_date: str = "2020-08-31"
    end_date: str = "2025-08-31"
    initial_cash: float = 1_000_000.0
    max_position_pct: float = 0.20
    # Optional: inject a shock event on a specific date
    shock_date: Optional[str] = None
    shock_ticker: Optional[str] = None
    shock_type: Optional[str] = None  # 'price_drop' | 'vol_spike' | 'liquidation'
    shock_magnitude: float = 1.0      # e.g. 0.5 = 50% price drop


@dataclass
class SimResult:
    """Result of a simulation run for one archetype."""
    archetype_name: str
    initial_cash: float
    final_value: float
    pnl: float
    pnl_pct: float
    num_trades: int
    trade_log: list[Trade]
    daily_values: pd.Series       # portfolio value per timestamp
    daily_returns: pd.Series      # daily portfolio returns
    max_drawdown: float
    cvar_95: float                # CVaR at 95% confidence

    def summary_dict(self) -> dict:
        return {
            "archetype": self.archetype_name,
            "initial_cash": self.initial_cash,
            "final_value": round(self.final_value, 2),
            "pnl": round(self.pnl, 2),
            "pnl_pct": round(self.pnl_pct * 100, 2),
            "num_trades": self.num_trades,
            "max_drawdown_pct": round(self.max_drawdown * 100, 2),
            "cvar_95_pct": round(self.cvar_95 * 100, 2),
        }


class MarketSimulator:
    """
    Historical market simulator.

    Loads market data, enriches it, then steps through chronologically
    letting each archetype make decisions based on available history.
    """

    def __init__(self, config: SimConfig):
        self.config = config
        self._data: dict[str, pd.DataFrame] = {}
        self._enriched: dict[str, pd.DataFrame] = {}

    # -------------------------------------------------------------------------
    # Data loading
    # -------------------------------------------------------------------------

    def load_data(self) -> None:
        """Load raw OHLCV for all tickers, then run the statistics pipeline."""
        for ticker in self.config.tickers:
            logger.info("Loading data for %s", ticker)
            ohlcv = load_or_fetch(
                ticker=ticker,
                period1=self.config.start_date,
                period2=self.config.end_date,
            )
            df = ohlcv.df
            self._data[ticker] = df
            logger.info(
                "  %s: %d rows %s → %s",
                ticker, len(df), df.index[0].date(), df.index[-1].date(),
            )

        # Enrich all tickers
        pipeline = mvp_pipeline()
        for ticker, df in self._data.items():
            self._enriched[ticker] = pipeline.fit_transform(df)
            logger.info("  %s enriched: %d columns", ticker, len(self._enriched[ticker].columns))

    # -------------------------------------------------------------------------
    # Shock injection
    # -------------------------------------------------------------------------

    def inject_shock(self, shock_date: str, shock_ticker: str, shock_type: str, magnitude: float) -> None:
        """
        Inject a market shock on a specific date.

        Types:
            'price_drop' : multiply close by (1 - magnitude), cap Low, adjust High
            'vol_spike'  : multiply next 5 days' vol_20d by (1 + magnitude*2)
            'liquidation': set volume to 5x normal, price_drop 30%
        """
        df = self._enriched[shock_ticker]
        shock_ts = pd.Timestamp(shock_date)

        if shock_type == "price_drop":
            drop = 1 - magnitude
            idx = df.index.get_indexer([shock_ts], method="nearest")[0]
            for col in ["Open", "High", "Low", "Close"]:
                df.iloc[idx, df.columns.get_loc(col)] *= drop
            logger.info("  Injected %.0f%% price drop on %s", magnitude * 100, shock_date)

        elif shock_type == "vol_spike":
            idx = df.index.get_indexer([shock_ts], method="nearest")[0]
            for i in range(idx, min(idx + 5, len(df))):
                vol_col = df.columns.get_loc("vol_20d")
                df.iloc[i, vol_col] *= (1 + magnitude * 2)
            logger.info("  Injected vol spike (%sx) on %s", 1 + magnitude * 2, shock_date)

        elif shock_type == "liquidation":
            idx = df.index.get_indexer([shock_ts], method="nearest")[0]
            vol_col = df.columns.get_loc("Volume")
            df.iloc[idx, vol_col] *= 5
            for col in ["Open", "High", "Low", "Close"]:
                c = df.columns.get_loc(col)
                df.iloc[idx, c] *= 0.70
            logger.info("  Injected liquidation cascade on %s", shock_date)

    # -------------------------------------------------------------------------
    # Run simulation for one archetype
    # -------------------------------------------------------------------------

    def run_archetype(self, archetype: BaseArchetype) -> SimResult:
        """
        Step through enriched data chronologically.
        At each step, build MarketState for each ticker and call archetype.get_signal().
        """
        archetype.reset()
        daily_values: list[float] = []
        timestamps: list[pd.Timestamp] = []

        # Build a dict of current MarketState per ticker at each step
        # We iterate in lockstep across all tickers (same dates)
        all_dates = self._enriched[self.config.tickers[0]].index

        for ts in all_dates:
            # Build state per ticker
            states = {}
            prices = {}
            for ticker in self.config.tickers:
                df = self._enriched[ticker]
                if ts not in df.index:
                    continue
                row = df.loc[ts]
                states[ticker] = MarketState.from_row(ticker, row)
                prices[ticker] = row["Close"]

            # Let archetype decide and execute for each ticker
            for ticker, state in states.items():
                decision = archetype.get_signal(state, states)
                archetype.execute(
                    decision=decision,
                    ticker=ticker,
                    timestamp=ts,
                    current_price=prices[ticker],
                    portfolio_value=archetype.portfolio.total_value(prices),
                )

            daily_values.append(archetype.portfolio.total_value(prices))
            timestamps.append(ts)

        # Build series
        daily = pd.Series(daily_values, index=pd.DatetimeIndex(timestamps, name="timestamp"))
        daily_returns = daily.pct_change().dropna()

        # Risk metrics
        cvar_95 = float(daily_returns.quantile(0.05))
        running_max = daily.cummax()
        drawdown = (daily - running_max) / running_max
        max_dd = float(drawdown.min())

        result = SimResult(
            archetype_name=archetype.name,
            initial_cash=archetype.initial_cash,
            final_value=daily.iloc[-1],
            pnl=daily.iloc[-1] - archetype.initial_cash,
            pnl_pct=(daily.iloc[-1] - archetype.initial_cash) / archetype.initial_cash,
            num_trades=len(archetype.get_trade_log()),
            trade_log=archetype.get_trade_log(),
            daily_values=daily,
            daily_returns=daily_returns,
            max_drawdown=max_dd,
            cvar_95=cvar_95,
        )
        return result

    # -------------------------------------------------------------------------
    # Run all archetypes
    # -------------------------------------------------------------------------

    def run_all(
        self,
        include_trend_follower: bool = True,
        include_mean_reverter: bool = True,
        include_liquidity_avoider: bool = True,
    ) -> dict[str, SimResult]:
        """Run full simulation for all selected archetypes."""
        self.load_data()

        # Inject shock if configured
        if self.config.shock_date:
            self.inject_shock(
                self.config.shock_date,
                self.config.shock_ticker or self.config.tickers[0],
                self.config.shock_type or "price_drop",
                self.config.shock_magnitude,
            )

        archetypes_map: dict[str, BaseArchetype] = {}
        if include_trend_follower:
            archetypes_map["trend_follower"] = TrendFollower(
                initial_cash=self.config.initial_cash,
                max_position_pct=self.config.max_position_pct,
            )
        if include_mean_reverter:
            archetypes_map["mean_reverter"] = MeanReversion(
                initial_cash=self.config.initial_cash,
                max_position_pct=self.config.max_position_pct,
            )
        if include_liquidity_avoider:
            archetypes_map["liquidity_avoider"] = LiquidityAvoider(
                initial_cash=self.config.initial_cash,
                max_position_pct=self.config.max_position_pct,
            )

        results = {}
        for name, arch in archetypes_map.items():
            logger.info("Running archetype: %s", name)
            results[name] = self.run_archetype(arch)
            r = results[name]
            logger.info(
                "  → PnL: %.2f (%.1f%%) | MDD: %.1f%% | CVaR95: %.1f%% | Trades: %d",
                r.pnl, r.pnl_pct * 100, r.max_drawdown * 100, r.cvar_95 * 100, r.num_trades,
            )

        return results

    # -------------------------------------------------------------------------
    # Print summary
    # -------------------------------------------------------------------------

    @staticmethod
    def print_summary(results: dict[str, SimResult]) -> None:
        print("\n" + "=" * 70)
        print("SIMULATION RESULTS")
        print("=" * 70)
        for name, r in results.items():
            print(f"\n  [{name}]")
            print(f"    Initial cash : ${r.initial_cash:,.0f}")
            print(f"    Final value  : ${r.final_value:,.0f}")
            print(f"    PnL          : ${r.pnl:,.0f} ({r.pnl_pct*100:+.1f}%)")
            print(f"    Max drawdown : {r.max_drawdown*100:.1f}%")
            print(f"    CVaR (95%)   : {r.cvar_95*100:.1f}%")
            print(f"    Trades       : {r.num_trades}")
        print("\n" + "=" * 70)

        # Comparison table
        print("\n  {'Archetype':<22} {'Final Value':>14} {'PnL %':>8} {'MDD %':>8} {'CVaR95 %':>8} {'Trades':>7}")
        print("  " + "-" * 65)
        for name, r in results.items():
            print(
                f"  {name:<22} ${r.final_value:>13,.0f} "
                f"{r.pnl_pct*100:>+7.1f}% {r.max_drawdown*100:>7.1f}% "
                f"{r.cvar_95*100:>7.1f}% {r.num_trades:>7}"
            )
        print()
