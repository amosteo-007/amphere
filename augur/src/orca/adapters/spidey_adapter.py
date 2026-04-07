"""SpideyOutputAdapter — writes Spidey ExtractedSignal list to the tri-store."""

import hashlib
import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

try:
    import lancedb
except ImportError:
    lancedb = None

from .base import ExtractedSignal, WriteResult

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
EMBED_DIM = 384  # Standard embedding dimension for MVP


class SpideyOutputAdapter:
    """
    Boundary-layer adapter that routes Spidey signals to the correct storage engine.

    Writes to:
      - SQLite: raw_news_articles
      - LanceDB: article_chunks (chunked article text with embeddings)
      - FalkorDBLite: event_master (upserted per signal)

    All I/O happens here — this is a pure boundary component.
    """

    def __init__(
        self,
        sqlite_db: str,
        lancedb_uri: str,
        graph_client=None,
    ):
        self.sqlite_db = sqlite_db
        self.lancedb_uri = lancedb_uri
        self.graph_client = graph_client  # FalkorDBLite client (may be None if unavailable)

    def write(self, signals: list[ExtractedSignal]) -> WriteResult:
        """
        Persist a list of Spidey extraction signals.

        Returns a WriteResult with counts and any errors encountered.
        """
        result = WriteResult()

        if not signals:
            return result

        # --- SQLite: raw_news_articles ---
        conn = self._get_sqlite_conn()
        try:
            for sig in signals:
                article_id = self._derive_article_id(sig)
                conn.execute(
                    """
                    INSERT OR REPLACE INTO raw_news_articles
                        (article_id, source, title, content, url, published_at,
                         scraped_at, language, query_used, sector_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        article_id,
                        sig.source,
                        sig.title,
                        sig.description,  # content = description for now
                        sig.url,
                        sig.published_at,
                        datetime.utcnow().isoformat(),
                        "en",
                        None,
                        None,
                    ),
                )
                result.articles_written += 1
            conn.commit()
        except Exception as e:
            result.errors.append(f"SQLite write error: {e}")
        finally:
            conn.close()

        # --- LanceDB: article_chunks ---
        if lancedb is not None:
            chunks_result = self._write_chunks(signals)
            result.chunks_written = chunks_result
        else:
            result.errors.append("LanceDB not installed — chunks not written")

        # --- FalkorDBLite: event_master ---
        if self.graph_client is not None:
            events_result = self._write_events(signals)
            result.events_written = events_result
        else:
            result.errors.append("FalkorDBLite client not provided — events not written")

        return result

    def _get_sqlite_conn(self) -> sqlite3.Connection:
        Path(self.sqlite_db).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.sqlite_db)
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _derive_article_id(self, sig: ExtractedSignal) -> str:
        """Derive a deterministic article ID from signal content."""
        raw = f"{sig.url}:{sig.title}:{sig.published_at}"
        return hashlib.sha256(raw.encode()).hexdigest()[:32]

    def _derive_event_id(self, sig: ExtractedSignal) -> str:
        """Derive a deterministic event ID from signal."""
        raw = f"{sig.event_type}:{sig.target}"
        return hashlib.sha256(raw.encode()).hexdigest()[:24]

    def _chunk_text(self, text: str) -> list[tuple[str, int]]:
        """Split text into overlapping chunks, return (chunk_text, chunk_index)."""
        if not text:
            return []
        chunks = []
        start = 0
        idx = 0
        while start < len(text):
            end = start + CHUNK_SIZE
            chunk = text[start:end]
            chunks.append((chunk, idx))
            start += CHUNK_SIZE - CHUNK_OVERLAP
            idx += 1
        return chunks

    def _mock_embedding(self, text: str) -> list[float]:
        """Generate a deterministic mock embedding for MVP (not a real LLM call)."""
        import struct
        vec = []
        for i in range(EMBED_DIM):
            # Deterministic pseudo-random float from text content
            seed = struct.unpack(">I", hashlib.sha256(f"{text}:{i}".encode()).digest()[:4])[0]
            vec.append((seed % 1000) / 1000.0)
        return vec

    def _write_chunks(self, signals: list[ExtractedSignal]) -> int:
        """Write chunked article text to LanceDB."""
        try:
            db = lancedb.open(self.lancedb_uri)
            table_names = db.table_names()
            chunk_count = 0

            for sig in signals:
                article_id = self._derive_article_id(sig)
                chunks = self._chunk_text(sig.description)

                for chunk_text, chunk_idx in chunks:
                    row = {
                        "chunk_id": str(uuid.uuid4()),
                        "article_id": article_id,
                        "chunk_text": chunk_text,
                        "chunk_index": chunk_idx,
                        "embedding": self._mock_embedding(chunk_text),
                        "published_at": sig.published_at or datetime.utcnow().isoformat(),
                        "source": sig.source,
                        "geography": None,
                        "sector": None,
                    }
                    # Use add method if table exists
                    if "article_chunks" in table_names:
                        db.open_table("article_chunks").add([row])
                    chunk_count += 1

            return chunk_count
        except Exception as e:
            print(f"[SpideyAdapter] LanceDB write error: {e}")
            return 0

    def _write_events(self, signals: list[ExtractedSignal]) -> int:
        """Upsert event nodes in FalkorDBLite."""
        written = 0
        for sig in signals:
            event_id = self._derive_event_id(sig)
            node_props = {
                "event_id": event_id,
                "title": sig.title,
                "event_type": sig.event_type,
                "start_date": sig.published_at or datetime.utcnow().strftime("%Y-%m-%d"),
                "end_date": None,
                "geography": None,
                "severity": sig.irreversibility_score,
                "event_status": "ACTIVE",
                "irreversibility": sig.irreversibility_score,
                "complexity": self._irrev_to_complexity(sig.irreversibility_score),
                "cost_band": sig.cost_band or "UNKNOWN",
                "tier": self._irrev_to_tier(sig.irreversibility_score),
                "priority": self._irrev_to_priority(sig.irreversibility_score),
                "restoration_months": sig.estimated_months,
                "analogue_id": None,
            }
            try:
                self.graph_client.upsert_node("event_master", node_props)
                written += 1
            except Exception as e:
                print(f"[SpideyAdapter] FalkorDBLite event write error: {e}")
        return written

    def _irrev_to_complexity(self, irrev: float) -> str:
        if irrev >= 0.9:
            return "IMPOSSIBLE"
        elif irrev >= 0.75:
            return "HIGH"
        elif irrev >= 0.5:
            return "MEDIUM"
        elif irrev >= 0.25:
            return "LOW"
        return "TRIVIAL"

    def _irrev_to_tier(self, irrev: float) -> int:
        if irrev >= 0.9:
            return 5
        elif irrev >= 0.75:
            return 4
        elif irrev >= 0.5:
            return 3
        elif irrev >= 0.25:
            return 2
        return 1

    def _irrev_to_priority(self, irrev: float) -> str:
        if irrev >= 0.9:
            return "P0"
        elif irrev >= 0.75:
            return "P1"
        elif irrev >= 0.5:
            return "P2"
        elif irrev >= 0.25:
            return "P3"
        return "P4"
