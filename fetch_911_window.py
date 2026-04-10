#!/usr/bin/env python3
"""
Fetch historical OHLC data for 9/11 event window from Yahoo Finance.
Assets: WTI (CL=F), Brent (BZ=F), S&P 500 (^GSPC), Airlines (UAL, AMR, DAL, LUV)
Window: 2001-08-01 to 2001-10-15
"""

import yfinance as yf
import pandas as pd
import sqlite3
import os
from datetime import datetime

DB_PATH = '/home/agent/.openclaw/workspace/augur.db'
DATA_DIR = '/home/agent/.openclaw/workspace/data'

# Assets to fetch - with fallback tickers
TICKERS = {
    'CL=F': 'WTI Crude',
    'CLB00=YAHOO': 'Brent Crude (alternative)',
    'NG1=F': 'Natural Gas',  # fallback energy
    '^GSPC': 'S&P 500',
    '^DJI': 'Dow Jones',  # proxy for market
    'LUV': 'Southwest Airlines',
    'JBLU': 'JetBlue (later, but useful)',
    'ALK': 'Alaska Air',
}

START_DATE = '2001-08-01'
END_DATE = '2001-10-15'

def fetch_and_save():
    os.makedirs(DATA_DIR, exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create table if not exists
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS historical_ohlcv (
        date TEXT,
        symbol TEXT,
        open REAL,
        high REAL,
        low REAL,
        close REAL,
        volume INTEGER,
        asset_type TEXT,
        fetched_at TEXT,
        PRIMARY KEY (date, symbol)
    )
    ''')
    
    all_data = []
    
    for ticker, name in TICKERS.items():
        print(f"Fetching {ticker} ({name})...")
        
        try:
            data = yf.download(ticker, start=START_DATE, end=END_DATE, progress=False)
            
            if len(data) == 0:
                print(f"  ⚠️  No data for {ticker}")
                continue
            
            # Handle different yfinance output formats
            if isinstance(data.columns, pd.MultiIndex):
                # New yfinance format
                data = data.droplevel(1, axis=1)
            
            asset_type = 'commodity' if 'F' in ticker else ('index' if '^' in ticker else 'equity')
            
            for date, row in data.iterrows():
                date_str = date.strftime('%Y-%m-%d') if hasattr(date, 'strftime') else str(date)[:10]
                
                record = {
                    'date': date_str,
                    'symbol': ticker,
                    'open': float(row['Open']) if pd.notna(row['Open']) else None,
                    'high': float(row['High']) if pd.notna(row['High']) else None,
                    'low': float(row['Low']) if pd.notna(row['Low']) else None,
                    'close': float(row['Close']) if pd.notna(row['Close']) else None,
                    'volume': int(row['Volume']) if pd.notna(row['Volume']) else None,
                    'asset_type': asset_type,
                    'fetched_at': datetime.now().isoformat(),
                }
                
                all_data.append(record)
                
                # Insert into DB
                cursor.execute('''
                INSERT OR REPLACE INTO historical_ohlcv 
                (date, symbol, open, high, low, close, volume, asset_type, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    record['date'], record['symbol'], record['open'], record['high'],
                    record['low'], record['close'], record['volume'], record['asset_type'],
                    record['fetched_at']
                ))
            
            print(f"  ✅ {len(data)} records fetched")
            
        except Exception as e:
            print(f"  ❌ Error fetching {ticker}: {e}")
    
    conn.commit()
    conn.close()
    
    # Save CSV backup
    if all_data:
        df = pd.DataFrame(all_data)
        csv_path = f"{DATA_DIR}/911_window_ohlcv.csv"
        df.to_csv(csv_path, index=False)
        print(f"\n✅ Saved {len(all_data)} records to {csv_path}")
        print(f"✅ Inserted into database: {DB_PATH}")
    else:
        print("\n❌ No data fetched")
    
    return all_data

if __name__ == '__main__':
    print("="*60)
    print(f"Fetching 9/11 window data: {START_DATE} to {END_DATE}")
    print("="*60)
    
    data = fetch_and_save()
    
    if data:
        print("\n" + "="*60)
        print("SUCCESS: Data ready for Yang-Zhang computation")
        print("="*60)
