# ESM Simulation Engine

Modular crypto market simulation engine — stress-test portfolios against historical events using pluggable agent archetypes.

## Project Status

**Phase 1: Data Layer** — ✅ Complete
- 5 years of daily OHLCV fetched for BTC-USD and ETH-USD (Yahoo Finance JSON API)
- Cached as CSV in `data/raw/`
- Data quality validated (zero NaN, zero High<Low errors)

**Next:** Statistics module → Archetypes → Oct 10, 2025 event injection

---

## Quick Start

```bash
# Dependencies (installed via uv)
# pandas, numpy, scipy, scikit-learn — see .deps/

# Fetch / reload data
PYTHONPATH=.deps:src python3 -c "
from data.fetcher import fetch_crypto_5y, validate_data_quality
data = fetch_crypto_5y(['BTC-USD', 'ETH-USD'], end='2025-08-31', write_dir='data/raw')
for ticker, ohlcv in data.items():
    print(f'{ticker}: {len(ohlcv.df)} rows, {ohlcv.df.index[0].date()} → {ohlcv.df.index[-1].date()}')
    print('Quality:', validate_data_quality(ohlcv))
"
```

---

## Directory Structure

```
esm-sim/
├── data/
│   ├── raw/              # Downloaded OHLCV CSVs
│   │   ├── BTC_USD_1d_2020-08-31_2025-09-01.csv
│   │   └── ETH_USD_1d_2020-08-31_2025-09-01.csv
│   └── enriched/         # Pipeline-output parquet (Phase 2)
├── src/
│   ├── data/             # Schema + fetchers
│   │   ├── schema.py     # MarketSlice, OHLCVData dataclasses
│   │   └── fetcher.py    # Yahoo Finance JSON API (no pip needed)
│   ├── statistics/       # Phase 2
│   ├── archetypes/        # Phase 2
│   └── simulation/       # Phase 2
├── tests/
├── .deps/                # uv-installed Python packages
└── requirements.txt
```

---

## Data

| Field | Source | Coverage |
|-------|--------|----------|
| Open, High, Low, Close | Yahoo Finance v8 chart API | Daily, 2020-08-31 → 2025-08-31 |
| Volume | Yahoo Finance v8 chart API | Daily |

**End date rationale:** `2025-08-31` is the last date an LLM with an August 2025 knowledge cutoff would have seen. The Oct 10, 2025 liquidation event is therefore a genuine forward-test.

---

## Architecture Principles

- **No pip required for data fetching** — Yahoo Finance JSON API via stdlib `urllib`
- **All statistics modules implement `StatModule` interface** — swap without touching archetypes
- **All archetypes implement `Archetype` interface** — independently backtestable
- **Data layer is source-agnostic** — replace `fetcher.py` to switch from Yahoo to Alpaca

---

## Dependencies

Installed in `.deps/` via `uv`:

```
pandas>=2.0.0
numpy>=1.24.0
scipy>=1.11.0
scikit-learn>=1.3.0
```

Install: `uv pip install pandas numpy scipy scikit-learn --python /usr/bin/python3 --target .deps`
