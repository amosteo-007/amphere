"""Seed synthetic oil OHLCV and market metrics into orca_facts.db."""

import math
import random
import sqlite3
from datetime import date, timedelta
from pathlib import Path

SQLITE_DB = str(Path(__file__).parent.parent / "orca_facts.db")

BRENT_SEED = 70.0   # $/bbl baseline
WTI_SEED   = 65.0
BRENT_VOL  = 0.20
WTI_VOL    = 0.22
DRIFT      = 0.0002


def _build_bars(
    instrument: str,
    start: date,
    end: date,
    spot: float,
    vol: float,
    seed: int,
) -> list[dict]:
    """Generate synthetic OHLCV via GBM with historical event shocks."""
    rng = random.Random(seed)

    events = {
        date(2020, 3, 1): -0.30,
        date(2020, 3, 2): -0.18,
        date(2020, 3, 3): -0.10,
        date(2020, 4, 20): -0.08,  # WTI negative pricing event
        date(2022, 2, 24):  0.09,   # Russia invasion
        date(2022, 2, 25):  0.07,
        date(2022, 3, 7):   0.12,   # Embargo shock
        date(2022, 6, 1):  -0.06,   # Recession fears
        date(2023, 3, 15): -0.05,   # SVB / banking stress
        date(2024, 4, 1):   0.05,   # OPEC+ cut announcement
    }

    rows = []
    cur = start
    price = spot

    while cur <= end:
        if cur.weekday() < 5:
            shock = events.get(cur, 0.0)
            if shock != 0.0:
                daily_ret = shock
            else:
                z = rng.gauss(0, 1)
                daily_ret = DRIFT + vol * z / math.sqrt(252)

            open_px  = price * (1 + rng.uniform(-0.005, 0.005))
            close_px = open_px  * (1 + daily_ret)
            high_px  = max(open_px, close_px) * (1 + rng.uniform(0, 0.012))
            low_px   = min(open_px, close_px) * (1 - rng.uniform(0, 0.012))
            volume   = rng.uniform(400_000, 2_500_000)

            rows.append({
                "date": cur,
                "open":  round(open_px,  2),
                "high":  round(high_px,  2),
                "low":   round(low_px,   2),
                "close": round(close_px, 2),
                "volume": round(volume, 0),
                "adjusted_close": round(close_px, 2),
            })
            price = close_px

        cur += timedelta(days=1)

    return rows


def _realized_vol(window: list[dict]) -> float:
    """Annualised close-to-close realized vol from a price window."""
    if len(window) < 2:
        return 0.0
    rets = []
    for i in range(1, len(window)):
        prev = window[i - 1]["close"]
        curr = window[i]["close"]
        if prev != 0:
            rets.append((curr - prev) / prev)
    if len(rets) < 2:
        return 0.0
    mean_r = sum(rets) / len(rets)
    var = sum((r - mean_r) ** 2 for r in rets) / (len(rets) - 1)
    return math.sqrt(var * 252)


def seed_market_data(
    db_path: str = SQLITE_DB,
    start_date: date = date(2020, 1, 1),
    end_date: date   = date(2025, 12, 31),
) -> dict:
    """Generate and insert synthetic OHLCV + market metrics for BRENT and WTI."""
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")

    counts = {"brent_bars": 0, "wti_bars": 0, "metrics": 0}

    for instrument_id, spot, vol, seed in [
        ("BRENT", BRENT_SEED, BRENT_VOL, 42),
        ("WTI",   WTI_SEED,   WTI_VOL,   137),
    ]:
        bars = _build_bars(instrument_id, start_date, end_date, spot, vol, seed)

        for i, bar in enumerate(bars):
            conn.execute(
                """
                INSERT OR REPLACE INTO raw_oil_ohlcv_daily
                    (instrument_id, date, open, high, low, close, volume, adjusted_close)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (instrument_id, bar["date"].isoformat(),
                 bar["open"], bar["high"], bar["low"], bar["close"],
                 bar["volume"], bar["adjusted_close"]),
            )

            # daily_return
            if i > 0:
                prev_close = bars[i - 1]["close"]
                daily_ret = (bar["close"] - prev_close) / prev_close
            else:
                daily_ret = 0.0

            conn.execute(
                """
                INSERT OR REPLACE INTO market_metric_daily
                    (instrument_id, date, metric_name, value)
                VALUES (?, ?, ?, ?)
                """,
                (instrument_id, bar["date"].isoformat(), "daily_return", daily_ret),
            )
            counts["metrics"] += 1

            # 20-day rolling realized vol
            if i >= 20:
                rv = _realized_vol(bars[i - 20:i])
                conn.execute(
                    """
                    INSERT OR REPLACE INTO market_metric_daily
                        (instrument_id, date, metric_name, value)
                    VALUES (?, ?, ?, ?)
                    """,
                    (instrument_id, bar["date"].isoformat(), "realized_vol", rv),
                )
                counts["metrics"] += 1

        conn.commit()
        if instrument_id == "BRENT":
            counts["brent_bars"] = len(bars)
        else:
            counts["wti_bars"] = len(bars)

        print(f"  [OK] {instrument_id}: {len(bars)} bars written")

    conn.close()
    return counts


def main():
    print("=" * 60)
    print("ORCA Phase 1 — Seed: market data (2020-2025)")
    print("=" * 60)
    print(f"\nWriting to: {SQLITE_DB}")
    print(f"Period: 2020-01-01 -> 2025-12-31")
    counts = seed_market_data()
    print(f"\nDone. {counts}")
    total_bars = counts["brent_bars"] + counts["wti_bars"]
    print(f"Total OHLCV bars: {total_bars}")
    print(f"Total metric records: {counts['metrics']}")


if __name__ == "__main__":
    main()
