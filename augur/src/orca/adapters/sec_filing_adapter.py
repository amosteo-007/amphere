"""SecFilingAdapter — parses XBRL facts, writes to SQLite and LanceDB."""

import hashlib
import sqlite3
import uuid
from datetime import date
from pathlib import Path
from typing import TypedDict

try:
    import lancedb
except ImportError:
    lancedb = None

from .base import WriteResult

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
EMBED_DIM = 384


class SecFilingAdapter:
    """
    Boundary-layer adapter for SEC XBRL filing ingestion.

    For MVP: generates synthetic XBRL-like fact dicts (no live EDGAR fetch).
    In production: replace _fetch_filing with real EDGAR API call.

    Writes to:
      - SQLite: raw_sec_filing_facts
      - LanceDB: filing_chunks (chunked filing text with embeddings)
    """

    def __init__(self, sqlite_db: str, lancedb_uri: str):
        self.sqlite_db = sqlite_db
        self.lancedb_uri = lancedb_uri

    def fetch_filing(self, entity_id: str, filing_id: str) -> "FilingFacts":
        """
        Fetch (or generate) XBRL facts for a filing.

        For MVP: returns a synthetic FilingFacts dict.
        In production: fetch from SEC EDGAR XBRL API.

        Returns FilingFacts with concept→value mappings and filing text.
        """
        # Synthetic XBRL facts for MVP energy company
        synthetic_text = self._generate_synthetic_filing_text(entity_id, filing_id)
        facts = {
            "Revenue": 45_000_000_000,
            "NetIncome": 8_200_000_000,
            "TotalAssets": 320_000_000_000,
            "OilAndGasRevenue": 38_000_000_000,
            "ProductionVolume": 3_200_000,  # barrels
            "OperatingCashFlow": 12_500_000_000,
        }
        return {"filing_id": filing_id, "entity_id": entity_id, "facts": facts, "text": synthetic_text}

    def write(self, entity_id: str, filing_id: str, facts: dict) -> WriteResult:
        """
        Write XBRL facts to SQLite + chunked filing text to LanceDB.

        Returns WriteResult with facts_written and chunks_written.
        """
        result = WriteResult()

        # --- SQLite: raw_sec_filing_facts ---
        conn = self._get_sqlite_conn()
        try:
            filing_text = facts.get("text", "")
            fiscal_period = date.today().isoformat()
            for concept, value in facts.items():
                if concept in ("text", "filing_id", "entity_id"):
                    continue
                conn.execute(
                    """
                    INSERT OR REPLACE INTO raw_sec_filing_facts
                        (filing_id, concept, value, unit, context_ref, period_end, entity_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        filing_id,
                        concept,
                        value,
                        None,  # unit
                        "current",  # context_ref
                        fiscal_period,
                        entity_id,
                    ),
                )
                result.facts_written += 1
            conn.commit()
        except Exception as e:
            result.errors.append(f"SQLite XBRL write error: {e}")
        finally:
            conn.close()

        # --- LanceDB: filing_chunks ---
        if lancedb is not None:
            chunks_result = self._write_chunks(filing_id, entity_id, fiscal_period, filing_text)
            result.chunks_written = chunks_result
        else:
            result.errors.append("LanceDB not installed — filing chunks not written")

        return result

    def _get_sqlite_conn(self) -> sqlite3.Connection:
        Path(self.sqlite_db).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.sqlite_db)
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _generate_synthetic_filing_text(self, entity_id: str, filing_id: str) -> str:
        """Generate realistic synthetic filing text for MVP."""
        return (
            f"Entity {entity_id} Filing {filing_id}: "
            "Annual Report. Revenue increased 8% year-over-year driven by higher commodity prices. "
            "Oil and gas production averaged 3.2 million barrels per day. "
            "Total assets were $320 billion. Operating cash flow was $12.5 billion. "
            "Capital expenditures were $9.1 billion focused on deepwater and LNG projects. "
            "The company maintains a strong balance sheet with a debt-to-capital ratio of 25%. "
            "Reserve life index is approximately 11 years at current production rates. "
        )

    def _mock_embedding(self, text: str) -> list[float]:
        """Generate a deterministic mock embedding (not a real LLM call)."""
        import struct
        vec = []
        for i in range(EMBED_DIM):
            seed = struct.unpack(
                ">I",
                hashlib.sha256(f"{text}:{i}".encode()).digest()[:4]
            )[0]
            vec.append((seed % 1000) / 1000.0)
        return vec

    def _write_chunks(
        self,
        filing_id: str,
        entity_id: str,
        fiscal_period_end: str,
        filing_text: str,
    ) -> int:
        """Chunk filing text and write to LanceDB."""
        try:
            db = lancedb.open(self.lancedb_uri)
            table_names = db.table_names()
            chunks = self._chunk_text(filing_text)
            written = 0

            for chunk_text, chunk_idx in chunks:
                row = {
                    "chunk_id": str(uuid.uuid4()),
                    "filing_id": filing_id,
                    "chunk_text": chunk_text,
                    "chunk_index": chunk_idx,
                    "embedding": self._mock_embedding(chunk_text),
                    "fiscal_period_end": fiscal_period_end,
                    "entity_id": entity_id,
                }
                if "filing_chunks" in table_names:
                    db.open_table("filing_chunks").add([row])
                written += 1

            return written
        except Exception as e:
            print(f"[SecFilingAdapter] LanceDB write error: {e}")
            return 0

    def _chunk_text(self, text: str) -> list[tuple[str, int]]:
        """Split text into overlapping chunks."""
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
