#!/usr/bin/env python3
"""
Yang-Zhang Sigma Calculator for Historical Shock Events
Computes Yang-Zhang volatility sigma for the ORCA analogue library.

Yang-Zhang sigma captures:
- Open-Close volatility
- High-Low volatility  
- Overnight gaps (close-to-open)

Formula: σ_YZ² = k·σ_O² + (1-k)·σ_R² + σ_CP²
where k = 0.34 (optimal weighting), σ_O = overnight, σ_R = Rogers-Satchell, σ_CP = close-to-close
"""

import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
import os

DB_PATH = '/home/agent/.openclaw/workspace/augur.db'
DATA_DIR = '/home/agent/.openclaw/workspace/data'

def yang_zhang_sigma(ohlcv_df, window=21):
    """
    Compute Yang-Zhang volatility sigma.
    
    Parameters:
    -----------
    ohlcv_df : DataFrame with columns ['date', 'open', 'high', 'low', 'close']
    window : int, rolling window in days (default 21 trading days)
    
    Returns:
    --------
    DataFrame with added 'yang_zhang_sigma' column (annualized)
    """
    df = ohlcv_df.copy()
    df = df.sort_values('date').reset_index(drop=True)
    
    # Log returns
    df['log_open'] = np.log(df['open'])
    df['log_close'] = np.log(df['close'])
    df['log_high'] = np.log(df['high'])
    df['log_low'] = np.log(df['low'])
    
    # Overnight return (close to next open)
    df['overnight_ret'] = df['log_open'].shift(-1) - df['log_close']
    
    # Close-to-close return
    df['close_ret'] = df['log_close'] - df['log_open'].shift(1)
    
    # Rogers-Satchell component
    df['rs_component'] = (
        df['log_high'] - df['log_low']
    ) * (
        df['log_high'] - df['log_close']
    ) + (
        df['log_high'] - df['log_low']
    ) * (
        df['log_high'] - df['log_open']
    )
    
    # Yang-Zhang parameters
    k = 0.34  # Optimal weighting constant
    alpha = 0.01  # Smoothing factor for overnight
    
    # Rolling calculations
    df['overnight_var'] = df['overnight_ret'].rolling(window=window).var()
    df['close_var'] = df['close_ret'].rolling(window=window).var()
    df['rs_var'] = df['rs_component'].rolling(window=window).mean()  # RS uses mean
    
    # Yang-Zhang variance
    df['yz_variance'] = (
        k * df['overnight_var'] + 
        (1 - k) * df['close_var'] + 
        alpha * df['rs_var']
    )
    
    # Annualized sigma (sqrt of variance * sqrt(252))
    df['yang_zhang_sigma'] = np.sqrt(df['yz_variance']) * np.sqrt(252)
    
    return df

def fetch_911_window_data():
    """
    Fetch historical OHLC data for the 9/11 rolling window:
    T-14 = August 28, 2001 to T+14 = September 25, 2001
    
    Assets to fetch:
    - WTI Crude (CL=F or equivalent)
    - Brent Crude (BZ=F or equivalent)
    - S&P 500 (^GSPC)
    - Airline stocks: UAL, AMR, DAL, LUV
    - US 10Y Treasury (can use yield data as proxy)
    """
    
    # Date range for 9/11 window
    start_date = '2001-08-01'  # Get some pre-window for rolling calc
    end_date = '2001-10-15'    # Get some post-window
    
    print(f"Fetching data for 9/11 window: {start_date} to {end_date}")
    
    # Check what's in the DB
    conn = sqlite3.connect(DB_PATH)
    
    # Query oil prices
    oil_query = """
    SELECT date, symbol, open, high, low, close, volume, asset_type as source
    FROM historical_ohlcv 
    WHERE symbol IN ('CL=F', 'CLB00=YAHOO', 'NG1=F')
    AND date >= ? AND date <= ?
    ORDER BY date, symbol
    """
    
    # Query stock prices
    stock_query = """
    SELECT date, symbol, open, high, low, close, volume, asset_type as source
    FROM historical_ohlcv
    WHERE symbol IN ('^GSPC', '^DJI', 'UAL', 'AMR', 'DAL', 'LUV', 'JBLU', 'ALK')
    AND date >= ? AND date <= ?
    ORDER BY date, symbol
    """
    
    try:
        oil_df = pd.read_sql(oil_query, conn, params=[start_date, end_date])
        stock_df = pd.read_sql(stock_query, conn, params=[start_date, end_date])
    except Exception as e:
        print(f"Database query error: {e}")
        oil_df = pd.DataFrame()
        stock_df = pd.DataFrame()
    
    conn.close()
    
    print(f"Oil records found: {len(oil_df)}")
    print(f"Stock records found: {len(stock_df)}")
    
    if len(oil_df) == 0:
        print("\n⚠️  No 2001 data in database. Need to fetch from external source.")
        return None, None
    
    return oil_df, stock_df

def compute_911_sigma():
    """
    Compute Yang-Zhang sigma for the 9/11 event window.
    """
    
    oil_df, stock_df = fetch_911_window_data()
    
    if oil_df is None or len(oil_df) == 0:
        print("\n" + "="*60)
        print("DATA GAP: No 2001 OHLC data available in database")
        print("Need to fetch historical data from:")
        print("  - Yahoo Finance (yfinance library)")
        print("  - FRED (for Treasuries)")
        print("  - Alternative: Use EIA monthly data as proxy")
        print("="*60)
        return None
    
    # Compute sigma for each asset
    results = {}
    
    # Oil assets
    for symbol in oil_df['symbol'].unique():
        symbol_df = oil_df[oil_df['symbol'] == symbol].copy()
        if len(symbol_df) < 10:
            print(f"Skipping {symbol}: insufficient data ({len(symbol_df)} records)")
            continue
        
        symbol_df = yang_zhang_sigma(symbol_df, window=10)  # Shorter window for 2-week event
        
        # Extract sigma for the event window
        event_window = symbol_df[
            (symbol_df['date'] >= '2001-08-28') & 
            (symbol_df['date'] <= '2001-09-25')
        ]
        
        if len(event_window) > 0:
            results[symbol] = {
                'pre_attack_avg': float(event_window[event_window['date'] < '2001-09-11']['yang_zhang_sigma'].mean()) if len(event_window[event_window['date'] < '2001-09-11']) > 0 else None,
                'post_attack_avg': float(event_window[event_window['date'] >= '2001-09-11']['yang_zhang_sigma'].mean()) if len(event_window[event_window['date'] >= '2001-09-11']) > 0 else None,
                'peak_sigma': float(event_window['yang_zhang_sigma'].max()),
                'peak_date': str(event_window.loc[event_window['yang_zhang_sigma'].idxmax(), 'date']) if len(event_window) > 0 else None,
                'records': len(event_window)
            }
    
    # Stock assets
    for symbol in stock_df['symbol'].unique():
        symbol_df = stock_df[stock_df['symbol'] == symbol].copy()
        if len(symbol_df) < 10:
            print(f"Skipping {symbol}: insufficient data ({len(symbol_df)} records)")
            continue
        
        symbol_df = yang_zhang_sigma(symbol_df, window=10)
        
        event_window = symbol_df[
            (symbol_df['date'] >= '2001-08-28') & 
            (symbol_df['date'] <= '2001-09-25')
        ]
        
        if len(event_window) > 0:
            results[symbol] = {
                'pre_attack_avg': float(event_window[event_window['date'] < '2001-09-11']['yang_zhang_sigma'].mean()) if len(event_window[event_window['date'] < '2001-09-11']) > 0 else None,
                'post_attack_avg': float(event_window[event_window['date'] >= '2001-09-11']['yang_zhang_sigma'].mean()) if len(event_window[event_window['date'] >= '2001-09-11']) > 0 else None,
                'peak_sigma': float(event_window['yang_zhang_sigma'].max()),
                'peak_date': str(event_window.loc[event_window['yang_zhang_sigma'].idxmax(), 'date']) if len(event_window) > 0 else None,
                'records': len(event_window)
            }
    
    # Save results
    output_path = f"{DATA_DIR}/911_yang_zhang_sigma.json"
    os.makedirs(DATA_DIR, exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n✅ Yang-Zhang sigma computed and saved to: {output_path}")
    print("\nResults summary:")
    for symbol, data in results.items():
        print(f"  {symbol}: peak σ = {data['peak_sigma']:.4f} on {data['peak_date']}")
    
    return results

if __name__ == '__main__':
    print("="*60)
    print("Yang-Zhang Sigma Calculator - 9/11 Event Window")
    print("="*60)
    
    results = compute_911_sigma()
    
    if results:
        print("\n" + "="*60)
        print("SUCCESS: Sigma values computed for 9/11 window")
        print("="*60)
    else:
        print("\n" + "="*60)
        print("ACTION NEEDED: Fetch 2001 historical data")
        print("Recommended: Use yfinance to fetch CL=F, BZ=F, ^GSPC, UAL, AMR, DAL, LUV")
        print("Date range: 2001-08-01 to 2001-10-15")
        print("="*60)
