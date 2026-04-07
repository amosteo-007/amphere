"""ORCA ingestion adapters — boundary-layer components."""

from .base import WriteResult, EntityMatch, ExtractedSignal
from .spidey_adapter import SpideyOutputAdapter
from .market_adapter import MarketDataAdapter
from .sec_filing_adapter import SecFilingAdapter
from .entity_canonicalizer import EntityCanonicalizer

__all__ = [
    "WriteResult",
    "EntityMatch",
    "ExtractedSignal",
    "SpideyOutputAdapter",
    "MarketDataAdapter",
    "SecFilingAdapter",
    "EntityCanonicalizer",
]
