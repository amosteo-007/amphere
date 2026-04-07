"""ORCA adapter base types."""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class WriteResult:
    """Result of an adapter write operation."""
    articles_written: int = 0
    chunks_written: int = 0
    events_written: int = 0
    facts_written: int = 0
    errors: list[str] = field(default_factory=list)

    @property
    def has_errors(self) -> bool:
        return bool(self.errors)


@dataclass
class EntityMatch:
    """Canonical entity resolved from free text."""
    entity_id: str
    name: str
    entity_type: str
    confidence: float  # 0-1

    def __post_init__(self):
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError(f"confidence must be 0-1, got {self.confidence}")


@dataclass
class ExtractedSignal:
    """Spidey extraction signal — canonical input for the ingestion pipeline."""
    event_type: str           # e.g. 'EXPROPRIATION', 'SANCTIONS'
    target: str               # e.g. 'Iran', 'offshore rigs'
    title: str
    description: str
    url: str
    published_at: str | None  # ISO date string
    source: str
    extraction_confidence: float  # 0-1
    irreversibility_score: float  # 0-1
    estimated_months: int | None
    cost_band: str | None     # '<$10M', '$10M-$100M', etc.
