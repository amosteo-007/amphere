"""Initialize FalkorDBLite graph — entity_master, event_master, causal_link, etc."""

import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

FALKOR_AVAILABLE = False
try:
    from falkorlitelib import Graph
    FALKOR_AVAILABLE = True
except ImportError:
    print("[init_graph] falkorlitelib not installed")

GRAPH_DB = str(Path(__file__).parent / "orca_graph.db")

NODE_SCHEMAS = {
    "entity_master": {
        "description": "Canonical entity — nations, companies, regulators",
        "properties": {
            "entity_id": "string (required, primary key)",
            "name": "string (required)",
            "aliases": "json list of strings",
            "ticker": "string | null (e.g. CVX, XOM)",
            "cik": "string | null",
            "lei": "string | null",
            "entity_type": "string (NATION | IOC | NOC | REGULATOR | etc.)",
            "sector": "string (ENERGY | etc.)",
            "country": "string | null (ISO code)",
            "tags": "json list of strings",
        },
    },
    "event_master": {
        "description": "Canonical event node with embedded Augur signal fields + ORCA fields",
        "properties": {
            "event_id": "string (required, primary key)",
            "title": "string",
            "event_type": "string (EXPROPRIATION | SUPPLY_SHOCK | SANCTIONS | etc.)",
            "start_date": "date string (YYYY-MM-DD)",
            "end_date": "date string | null",
            "geography": "string (country/region affected)",
            "severity": "float 0-1",
            "event_status": "string (ACTIVE | RESOLVED | ONGOING)",
            # Augur signal fields
            "irreversibility": "float 0-1",
            "complexity": "string (TRIVIAL | LOW | MEDIUM | HIGH | IMPOSSIBLE)",
            "cost_band": "string (<$10M | $10M-$100M | $100M-$1B | >$1B)",
            "tier": "int 1-5",
            "priority": "string (P0-P5)",
            "restoration_months": "int | null",
            # ORCA field
            "analogue_id": "string | null (links to analogue_case)",
        },
    },
    "analogue_case": {
        "description": "Historical analogue with 5W1H narrative and restoration outcome",
        "properties": {
            "analogue_id": "string (primary key)",
            "summary_text": "text (5W1H narrative)",
            "tags": "json list of strings",
            "severity": "float 0-1",
            "duration_days": "int | null",
            "structural_flags": "json list of strings",
            "restoration_cost_actual": "float | null (USD)",
            "restoration_months_actual": "int | null",
            "fully_restored": "bool",
        },
    },
}

EDGE_SCHEMAS = {
    "event_entity_role": {
        "description": "Links an event to an entity with a role",
        "from_node": "event_master",
        "to_node": "entity_master",
        "properties": {
            "role_type": "string (INITIATOR | TARGET | PRODUCER | REGULATOR | IMPACTED)",
            "description": "string (human-readable description)",
        },
    },
    "causal_link": {
        "description": "Causal relationship between two events",
        "from_node": "event_master",
        "to_node": "event_master",
        "properties": {
            "causal_link_id": "string",
            "mechanism": "string (SUPPLY_SHIFT | PRICE_SPIKE | REGULATORY | etc.)",
            "direction": "string (UPSTREAM | DOWNSTREAM | LATERAL)",
            "confidence": "float 0-1",
            "strength": "float 0-1",
            "time_lag_days": "int",
            "evidence_source": "string (article_id | filing_id | manual | analogue)",
        },
    },
    "analogue_similarity": {
        "description": "Pairwise similarity between two analogues",
        "from_node": "analogue_case",
        "to_node": "analogue_case",
        "properties": {
            "similarity_score": "float 0-1",
            "similarity_method": "string (SEMANTIC_VECTOR | CAUSAL_PROFILE | REGIME_MATCH)",
            "last_computed_at": "ISO datetime string",
        },
    },
}


def create_graph_schema(graph: Graph) -> dict:
    """Initialize FalkorDBLite with ORCA schema. Returns counts."""
    counts = {"nodes": 0, "edges": 0}
    for node_type, schema in NODE_SCHEMAS.items():
        try:
            graph.create_node_type(node_type, properties=list(schema["properties"].keys()))
            print(f"  [OK] node type: {node_type}")
            counts["nodes"] += 1
        except Exception as e:
            print(f"  [--] node type {node_type}: {e}")

    for edge_type, schema in EDGE_SCHEMAS.items():
        try:
            graph.create_edge_type(
                edge_type,
                from_node=schema["from_node"],
                to_node=schema["to_node"],
                properties=list(schema["properties"].keys()),
            )
            print(f"  [OK] edge type: {edge_type} ({schema['from_node']} -> {schema['to_node']})")
            counts["edges"] += 1
        except Exception as e:
            print(f"  [--] edge type {edge_type}: {e}")

    return counts


def init_sqlite_stub(db_path: str):
    """Write schema to a SQLite stub for environments without FalkorDBLite."""
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")

    conn.execute("""
        CREATE TABLE IF NOT EXISTS graph_node (
            node_type TEXT NOT NULL,
            node_id   TEXT NOT NULL,
            properties TEXT NOT NULL,  -- JSON
            PRIMARY KEY (node_type, node_id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS graph_edge (
            edge_type     TEXT NOT NULL,
            from_node_type TEXT NOT NULL,
            from_node_id  TEXT NOT NULL,
            to_node_type  TEXT NOT NULL,
            to_node_id    TEXT NOT NULL,
            properties     TEXT NOT NULL,  -- JSON
            PRIMARY KEY (edge_type, from_node_id, to_node_id)
        )
    """)
    conn.commit()
    conn.close()


def write_schema_docs():
    """Write schema documentation to JSON for reference."""
    out = {"nodes": NODE_SCHEMAS, "edges": EDGE_SCHEMAS}
    doc_path = Path(__file__).parent / "graph_schema.json"
    with open(doc_path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"  [OK] Schema docs: {doc_path}")


def main():
    print("=" * 60)
    print("ORCA Phase 1 — Initialize FalkorDBLite graph schema")
    print("=" * 60)
    print(f"\nGraph DB: {GRAPH_DB}")

    if FALKOR_AVAILABLE:
        print(f"\nConnecting to FalkorDBLite...")
        graph = Graph(database_path=GRAPH_DB)
        counts = create_graph_schema(graph)
        print(f"\nSchema initialized: {counts['nodes']} node types, {counts['edges']} edge types")
    else:
        print("\nFalkorDBLite not installed.")
        print("Installing: pip install falkorlitelib")
        print("\nWriting SQLite stub + schema docs as fallback...")
        Path(GRAPH_DB).parent.mkdir(parents=True, exist_ok=True)
        init_sqlite_stub(GRAPH_DB)
        print(f"  [OK] SQLite stub: {GRAPH_DB}")
        write_schema_docs()

    print("\n[OK] FalkorDBLite initialization complete")


if __name__ == "__main__":
    main()
