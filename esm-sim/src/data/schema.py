"""Market data schema — shared dataclasses for ESM simulation engine."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
import pandas as pd


@dataclass
class MarketSlice:
    """Single time bar of market data.

    All fields prefixed with underscore are derived by the statistics pipeline,
    not raw from the source.
    """

    # Raw fields (from data source)
    timestamp: pd.Timestamp
    open: float
    high: float
    low: float
    close: float
    volume: float

    # Derived fields (populated by StatisticsPipeline)
    log_return: Optional[float] = None
    volatility_regime: Optional[str] = None  # 'low' | 'high'
    sma_20: Optional[float] = None
    sma_50: Optional[float] = None
    price_vs_sma20: Optional[float] = None  # close / sma_20 - 1
    z_score: Optional[float] = None  # rolling z-score of log_return
    is_jump: Optional[bool] = None   # True if |z_score| > threshold
    label: Optional[str] = None       # regime label from HMM (future)

    def with_enriched(self, **kwargs) -> "MarketSlice":
        """Return a copy with additional derived fields set."""
        import copy
        new_slice = copy.deepcopy(self)
        for k, v in kwargs.items():
            if hasattr(new_slice, k):
                setattr(new_slice, k, v)
        return new_slice


@dataclass
class OHLCVData:
    """Container for raw OHLCV data with metadata."""

    ticker: str                    # e.g. "BTC-USD"
    interval: str                  # e.g. "1d"
    start: pd.Timestamp
    end: pd.Timestamp
    df: pd.DataFrame = field(default_factory=pd.DataFrame)

    @property
    def shape(self) -> tuple[int, int]:
        return self.df.shape

    def __len__(self) -> int:
        return len(self.df)

    def head(self, n: int = 5) -> pd.DataFrame:
        return self.df.head(n)

    def tail(self, n: int = 5) -> pd.DataFrame:
        return self.df.tail(n)
