#!/usr/bin/env python3
"""
ORCA Phase 1.1: Oil Price Backfill (2000-2006)
Fetches CL=F (WTI) and BZ=F (Brent) from Yahoo Finance
"""

import yfinance as yf
import sqlite3
import pandas as pd
from datetime import datetime
from pathlib import Path

DB_PATH = Path("/home/agent/.openclaw/workspace/orcadata/phase1/orca_facts.db")
DATA_DIR = Path("/home/agent/.openclaw/workspace/orcadata/phase1/seeds")

def init_database():
    """Initialize SQLite with ORCA schema."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS raw_oil_ohlcv_daily (
            instrument_id TEXT NOT NULL,
            date DATE NOT NULL,
            open REAL,
            high REAL,
            low REAL,
            close REAL,
            volume REAL,
            adjusted_close REAL,
            data_quality TEXT DEFAULT 'VERIFIED',
            source TEXT DEFAULT 'yfinance',
            PRIMARY KEY (instrument_id, date)
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS data_quality_log (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            instrument_id TEXT,
            date_range TEXT,
            expected_records INTEGER,
            actual_records INTEGER,
            missing_dates TEXT,
            validation_status TEXT,
            logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.commit()
    conn.close()
    print(f"✓ Database initialized: {DB_PATH}")

def fetch_yahoo_futures(symbol, start_date, end_date):
    """Fetch futures data from Yahoo Finance."""
    print(f"Fetching {symbol} from {start_date} to {end_date}...")
    
    ticker = yf.Ticker(symbol)
    df = ticker.history(start=start_date, end=end_date)
    
    if df.empty:
        print(f"  ⚠ No data returned for {symbol}")
        return None
    
    # Reset index to get Date as column
    df = df.reset_index()
    df['Date'] = pd.to_datetime(df['Date']).dt.strftime('%Y-%m-%d')
    
    # Rename columns
    df = df.rename(columns={
        'Date': 'date',
        'Open': 'open',
        'High': 'high',
        'Low': 'low',
        'Close': 'close',
        'Volume': 'volume'
    })
    
    # Map symbol to instrument_id
    instrument_map = {
        'CL=F': 'WTI',
        'BZ=F': 'BRENT'
    }
    df['instrument_id'] = instrument_map.get(symbol, symbol)
    df['adjusted_close'] = df['close']
    df['data_quality'] = 'VERIFIED'
    df['source'] = 'yfinance'
    
    print(f"  ✓ Fetched {len(df)} records for {symbol}")
    return df[['instrument_id', 'date', 'open', 'high', 'low', 'close', 'volume', 'adjusted_close', 'data_quality', 'source']]

def upsert_prices(df):
    """Insert or update price records."""
    if df is None or df.empty:
        return 0
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    records = df.to_dict('records')
    inserted = 0
    
    for record in records:
        cursor.execute("""
            INSERT INTO raw_oil_ohlcv_daily 
            (instrument_id, date, open, high, low, close, volume, adjusted_close, data_quality, source)
            VALUES (:instrument_id, :date, :open, :high, :low, :close, :volume, :adjusted_close, :data_quality, :source)
            ON CONFLICT(instrument_id, date) DO UPDATE SET
                open = excluded.open,
                high = excluded.high,
                low = excluded.low,
                close = excluded.close,
                volume = excluded.volume,
                adjusted_close = excluded.adjusted_close,
                data_quality = excluded.data_quality,
                source = excluded.source
        """, record)
        inserted += cursor.rowcount
    
    conn.commit()
    conn.close()
    return inserted

def validate_coverage(instrument_id, start_date, end_date):
    """Check data coverage and log quality."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT COUNT(*) FROM raw_oil_ohlcv_daily 
        WHERE instrument_id = ? AND date >= ? AND date <= ?
    """, (instrument_id, start_date, end_date))
    
    actual = cursor.fetchone()[0]
    
    # Expected trading days (approx 252/year)
    start = datetime.strptime(start_date, '%Y-%m-%d')
    end = datetime.strptime(end_date, '%Y-%m-%d')
    years = (end - start).days / 365.25
    expected = int(years * 252)
    
    # Find missing dates
    cursor.execute("""
        SELECT date FROM raw_oil_ohlcv_daily 
        WHERE instrument_id = ? AND date >= ? AND date <= ?
        ORDER BY date
    """, (instrument_id, start_date, end_date))
    
    existing = set([row[0] for row in cursor.fetchall()])
    
    status = 'COMPLETE' if actual >= expected * 0.95 else 'PARTIAL' if actual >= expected * 0.5 else 'INCOMPLETE'
    
    cursor.execute("""
        INSERT INTO data_quality_log 
        (instrument_id, date_range, expected_records, actual_records, validation_status)
        VALUES (?, ?, ?, ?, ?)
    """, (instrument_id, f"{start_date} to {end_date}", expected, actual, status))
    
    conn.commit()
    conn.close()
    
    print(f"  Validation: {actual}/{expected} records ({status})")
    return status

def main():
    print("=" * 60)
    print("ORCA Phase 1.1: Oil Price Backfill")
    print("=" * 60)
    
    # Initialize database
    init_database()
    
    # Fetch WTI (CL=F)
    print("\n--- WTI Crude (CL=F) ---")
    wti_full = fetch_yahoo_futures('CL=F', '2000-01-01', '2026-04-06')
    if wti_full is not None:
        upsert_prices(wti_full)
        validate_coverage('WTI', '2000-01-01', '2006-12-31')
        validate_coverage('WTI', '2007-01-01', '2026-04-06')
    
    # Fetch Brent (BZ=F)
    print("\n--- Brent Crude (BZ=F) ---")
    brent_full = fetch_yahoo_futures('BZ=F', '2000-01-01', '2026-04-06')
    if brent_full is not None:
        upsert_prices(brent_full)
        validate_coverage('BRENT', '2000-01-01', '2006-12-31')
        validate_coverage('BRENT', '2007-01-01', '2026-04-06')
    
    # Summary
    print("\n" + "=" * 60)
    print("BACKFILL COMPLETE")
    print("=" * 60)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT instrument_id, COUNT(*), MIN(date), MAX(date) FROM raw_oil_ohlcv_daily GROUP BY instrument_id")
    
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]} records ({row[2]} to {row[3]})")
    
    conn.close()

if __name__ == '__main__':
    main()
