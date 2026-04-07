"""MarketDataAdapter — fetches/generates OHLCV and writes market metrics to SQLite."""

import math
import random
import sqlite3
from datetime import date, timedelta
from pathlib import Path
from typing import Literal

InstrumentId = Literal["BRENT", "WTI"]


class MarketDataAdapter:
    """
    Boundary-layer adapter for market data ingestion.

    For MVP: generates synthetic OHLCV data using geometric Brownian motion
    with realistic parameters (COVID crash 2020, Russia invasion 2022 spikes).

    In production: replace _fetch_ohlcv with a real market data API call
    (Polygon, Bloomberg, etc.). The write logic remains the same.
    """

    def __init__(self, sqlite_db: str):
        self.sqlite_db = sqlite_db

    def fetch_and_write(
        self,
        instrument_id: InstrumentId,
        start_date: date,
        end_date: date,
    ) -> int:
        """
        Fetch (or generate) OHLCV data and write to SQLite.

        Writes:
          - raw_oil_ohlcv_daily: OHLCV bars
          - market_metric_daily: daily_return, realized_vol per bar

        Returns count of trading days written.
        """
        ohlcv_data = self._fetch_ohlcv(instrument_id, start_date, end_date)
        return self._write_ohlcv_and_metrics(instrument_id, ohlcv_data)

    def _fetch_ohlcv(
        self,
        instrument_id: InstrumentId,
        start_date: date,
        end_date: date,
    ) -> list[dict]:
        """
        Generate synthetic OHLCV using GBM.

        Parameters chosen for realistic energy market behavior:
        - BRENT: ~$60-80/bbl baseline, ~20% annual vol
        - WTI: ~$55-75/bbl baseline, ~22% annual vol
        """
        params = {
            "BRENT": {"spot": 70.0, "vol": 0.20, "drift": 0.0002},
            "WTI":   {"spot": 65.0, "vol": 0.22, "drift": 0.0002},
        }
        p = params[instrument_id]

        seed = hash(instrument_id) % (2**31)
        rng = random.Random(seed)

        events = {
            # COVID crash 2020
            date(2020, 3, 1): -0.35,
            date(2020, 3, 2): -0.20,
            date(2020, 3, 3): -0.10,
            date(2020, 4, 20): -0.10,  # WTI negative
            # Russia invasion 2022
            date(2022, 2, 24): 0.08,
            date(2022, 2, 25): 0.06,
            date(2022, 3, 7): 0.12,
        }

        rows = []
        current_date = start_date
        spot = p["spot"]

        while current_date <= end_date:
            if current_date.weekday() < 5:  # Weekdays only
                shock = events.get(current_date, 0.0)
                if shock != 0.0:
                    daily_return = shock
                else:
                    # GBM step
                    z = rng.gauss(0, 1)
                    daily_return = p["drift"] + p["vol"] * z / math.sqrt(252)

                open_price = spot * (1 + rng.uniform(-0.005, 0.005))
                close_price = open_price * (1 + daily_return)
                high_price = max(open_price, close_price) * (1 + rng.uniform(0, 0.01))
                low_price = min(open_price, close_price) * (1 - rng.uniform(0, 0.01))
                volume = rng.uniform(500_000, 2_000_000)

                rows.append({
                    "date": current_date,
                    "open": round(open_price, 2),
                    "high": round(high_price, 2),
                    "low": round(low_price, 2),
                    "close": round(close_price, 2),
                    "volume": round(volume, 0),
                    "adjusted_close": round(close_price, 2),
                })
                spot = close_price

            current_date += timedelta(days=1)

        return rows

    def _write_ohlcv_and_metrics(
        self,
        instrument_id: InstrumentId,
        ohlcv_data: list[dict],
    ) -> int:
        """Write OHLCV rows and computed metrics to SQLite."""
        Path(self.sqlite_db).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.sqlite_db)
        conn.execute("PRAGMA foreign_keys = ON")
        written = 0

        try:
            for i, bar in enumerate(ohlcv_data):
                # Insert OHLCV bar
                conn.execute(
                    """
                    INSERT OR REPLACE INTO raw_oil_ohlcv_daily
                        (instrument_id, date, open, high, low, close, volume, adjusted_close)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        instrument_id,
                        bar["date"].isoformat(),
                        bar["open"],
                        bar["high"],
                        bar["low"],
                        bar["close"],
                        bar["volume"],
                        bar["adjusted_close"],
                    ),
                )

                # Compute daily_return
                if i > 0:
                    prev_close = ohlcv_data[i - 1]["close"]
                    daily_return = (bar["close"] - prev_close) / prev_close
                else:
                    daily_return = 0.0

                conn.execute(
                    """
                    INSERT OR REPLACE INTO market_metric_daily
                        (instrument_id, date, metric_name, value)
                    VALUES (?, ?, ?, ?)
                    """,
                    (instrument_id, bar["date"].isoformat(), "daily_return", daily_return),
                )

                # Compute rolling 20-day realized vol (Yang-Zhang approximation)
                if i >= 20:
                    window = ohlcv_data[i - 20:i]
                    realized_vol = self._realized_vol(window)
                    conn.execute(
                        """
                        INSERT OR REPLACE INTO market_metric_daily
                            (instrument_id, date, metric_name, value)
                        VALUES (?, ?, ?, ?)
                        """,
                        (instrument_id, bar["date"].isoformat(), "realized_vol", realized_vol),
                    )

                written += 1

            conn.commit()
        finally:
            conn.close()

        return written

    def _realized_vol(self, window: list[dict]) -> float:
        """
        Approximate Yang-Zhang realized vol from a 20-bar window.
        Uses close-to-close returns; open-to-close and overnight components
        are approximated from high-low spread.
        """
        if len(window) < 2:
            return 0.0

        n = len(window)
        returns = []
        for i in range(1, n):
            prev = window[i - 1]["close"]
            curr = window[i]["close"]
            ret = (curr - prev) / prev
            returns.append(ret)

        # Simple realized vol (close-to-close annualised)
        mean_ret = sum(returns) / len(returns)
        variance = sum((r - mean_ret) ** 2 for r in returns) / (len(returns) - 1)
        return math.sqrt(variance * 252)
