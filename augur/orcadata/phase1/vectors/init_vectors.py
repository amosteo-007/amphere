"""Initialize LanceDB with ORCA vector tables."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

EMBED_DIM = 384  # Configurable embedding dimension

LANCEDB_AVAILABLE = False
try:
    import lancedb
    LANCEDB_AVAILABLE = True
except ImportError:
    print("[init_vectors] lancedb not installed — pip install lancedb to use")


LANCE_URI = str(Path(__file__).parent / "orca_vectors")

TABLES = {
    "article_chunks": [
        ("chunk_id", "varchar"),
        ("article_id", "varchar"),
        ("chunk_text", "text"),
        ("chunk_index", "int32"),
        ("embedding", f"vector({EMBED_DIM})"),
        ("published_at", "varchar"),
        ("source", "varchar"),
        ("geography", "varchar"),
        ("sector", "varchar"),
    ],
    "filing_chunks": [
        ("chunk_id", "varchar"),
        ("filing_id", "varchar"),
        ("chunk_text", "text"),
        ("chunk_index", "int32"),
        ("embedding", f"vector({EMBED_DIM})"),
        ("fiscal_period_end", "varchar"),
        ("entity_id", "varchar"),
    ],
    "analogue_summaries": [
        ("analogue_id", "varchar"),
        ("summary_text", "text"),
        ("embedding", f"vector({EMBED_DIM})"),
        ("tags", "varchar"),  # JSON-serialized list
        ("severity", "float32"),
        ("duration_days", "int32"),
        ("structural_flags", "varchar"),  # JSON-serialized list
        ("restoration_cost_actual", "float32"),
        ("restoration_months_actual", "int32"),
        ("fully_restored", "bool"),
    ],
    "causal_chain_blocks": [
        ("chain_block_id", "varchar"),
        ("source_event_id", "varchar"),
        ("target_event_id", "varchar"),
        ("narrative_text", "text"),
        ("embedding", f"vector({EMBED_DIM})"),
        ("mechanism", "varchar"),
        ("confidence", "float32"),
        ("time_lag_days", "int32"),
    ],
}


def create_tables(uri: str) -> dict:
    """Create all 4 LanceDB tables. Returns dict of table_name -> created (bool)."""
    if not LANCEDB_AVAILABLE:
        print("[init_vectors] LanceDB not installed")
        return {name: False for name in TABLES}

    db = lancedb.connect(uri)
    results = {}

    for table_name, schema_fields in TABLES.items():
        existing = table_name in db.table_names()
        if existing:
            print(f"  -- {table_name}: already exists (skipped)")
            results[table_name] = False
            continue

        # Build schema using pyarrow
        import pyarrow as pa

        fields = []
        for field_name, field_type in schema_fields:
            if "vector" in field_type:
                dim_str = field_type.split("(")[1].split(")")[0]
                dim = int(dim_str)
                fields.append(pa.field(field_name, pa.list_(pa.float32(), dim)))
            elif field_type == "int32":
                fields.append(pa.field(field_name, pa.int32()))
            elif field_type == "float32":
                fields.append(pa.field(field_name, pa.float32()))
            elif field_type == "bool":
                fields.append(pa.field(field_name, pa.bool_()))
            elif field_type == "text":
                fields.append(pa.field(field_name, pa.string()))
            else:
                fields.append(pa.field(field_name, pa.string()))

        schema = pa.schema(fields)
        db.create_table(table_name, schema=schema)
        print(f"  [OK] {table_name}: created with {len(schema_fields)} columns")
        results[table_name] = True

    return results


def search_similar(uri: str, table_name: str, query_vector: list[float], column: str = "embedding", limit: int = 5) -> list[dict]:
    """
    ANN search stub — returns top-k results from a LanceDB table.
    Returns list of dicts with row data and distance score.
    """
    if not LANCEDB_AVAILABLE:
        raise RuntimeError("LanceDB not installed")

    tbl = lancedb.open(uri).open_table(table_name)
    results = tbl.search(query_vector).limit(limit).to_list()
    return results


def main():
    print("=" * 60)
    print("ORCA Phase 1 — Initialize LanceDB vector tables")
    print("=" * 60)
    print(f"\nLanceDB URI: {LANCE_URI}")
    print(f"Embedding dim: {EMBED_DIM}")
    print(f"Tables: {', '.join(TABLES.keys())}")

    if not LANCEDB_AVAILABLE:
        print("\nLanceDB is not installed.")
        print("To install: pip install lancedb")
        print("This script will write schema documentation but cannot initialize tables.")
        return

    Path(LANCE_URI).mkdir(parents=True, exist_ok=True)
    results = create_tables(LANCE_URI)

    print(f"\nTables created: {sum(results.values())}/{len(results)}")
    if all(results.values()):
        print("[OK] All tables initialized successfully")
    else:
        existing = [k for k, v in results.items() if not v]
        print(f"[--] Already existed: {', '.join(existing)}")


if __name__ == "__main__":
    main()
