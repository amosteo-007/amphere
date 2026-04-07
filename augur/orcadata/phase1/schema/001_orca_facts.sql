-- ORCA Phase 1 Migration 001
-- Creates the orca_facts.db SQLite schema
--   - raw_news_articles: Spidey article archive
--   - raw_oil_ohlcv_daily: BRENT / WTI daily OHLCV
--   - market_metric_daily: derived daily metrics
--   - volatility_snapshot: Yang-Zhang sigma regime snapshots
--   - raw_sec_filing_facts: XBRL filing facts

-- Raw article archive (Spidey output)
CREATE TABLE IF NOT EXISTS raw_news_articles (
    article_id    TEXT PRIMARY KEY,
    source        TEXT,
    title         TEXT,
    content       TEXT,
    url           TEXT NOT NULL,
    published_at  DATETIME,
    scraped_at    DATETIME NOT NULL,
    language      TEXT DEFAULT 'en',
    query_used    TEXT,
    sector_id     INT
);

-- Daily OHLCV for oil benchmarks
CREATE TABLE IF NOT EXISTS raw_oil_ohlcv_daily (
    instrument_id TEXT NOT NULL,  -- BRENT, WTI
    date          DATE NOT NULL,
    open          REAL,
    high          REAL,
    low           REAL,
    close         REAL,
    volume        REAL,
    adjusted_close REAL,
    PRIMARY KEY (instrument_id, date)
);

-- Daily derived market metrics
CREATE TABLE IF NOT EXISTS market_metric_daily (
    instrument_id TEXT NOT NULL,
    date          DATE NOT NULL,
    metric_name   TEXT NOT NULL,   -- daily_return, realized_vol, liquidity_ratio
    value         REAL NOT NULL,
    PRIMARY KEY (instrument_id, date, metric_name)
);

-- Volatility regime snapshots
-- sigma_14d column added per ORCA technical brief (rolling 14-day Yang-Zhang)
CREATE TABLE IF NOT EXISTS volatility_snapshot (
    instrument_id   TEXT NOT NULL,
    window_end       DATE NOT NULL,
    estimator        TEXT NOT NULL,  -- yang_zhang, close_close, garch
    sigma_annual     REAL NOT NULL,  -- annualized Yang-Zhang sigma
    sigma_14d        REAL,            -- rolling 14-day sigma
    percentile_rank  REAL,            -- vs 1970-2000 historical range
    regime           TEXT,            -- LOW_VOL, NORMAL_VOL, HIGH_VOL, CRISIS
    z_score          REAL,            -- standard deviations from historical mean
    PRIMARY KEY (instrument_id, window_end, estimator)
);

-- XBRL structured facts from SEC filings
CREATE TABLE IF NOT EXISTS raw_sec_filing_facts (
    filing_id     TEXT NOT NULL,
    concept       TEXT NOT NULL,   -- US-GAAP concept id
    value         REAL,
    unit          TEXT,
    context_ref   TEXT,
    period_end    DATE,
    entity_id     TEXT,
    PRIMARY KEY (filing_id, concept, context_ref, unit)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_ohlcv_instrument_date
    ON raw_oil_ohlcv_daily(instrument_id, date);

CREATE INDEX IF NOT EXISTS idx_metrics_instrument_date
    ON market_metric_daily(instrument_id, date, metric_name);

CREATE INDEX IF NOT EXISTS idx_vol_snapshot_instrument_window
    ON volatility_snapshot(instrument_id, window_end DESC);

CREATE INDEX IF NOT EXISTS idx_articles_published
    ON raw_news_articles(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_filing_facts_entity
    ON raw_sec_filing_facts(entity_id, period_end);
