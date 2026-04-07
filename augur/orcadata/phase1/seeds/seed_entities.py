"""Seed entities into FalkorDBLite entity_master node type."""

import sys
from pathlib import Path

# Add project root to path so we can import from src if needed
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

FALKOR_AVAILABLE = False
try:
    from falkorlitelib import Graph
    FALKOR_AVAILABLE = True
except ImportError:
    print("[seed_entities] falkorlitelib not installed — will write SQL stub only")


GRAPH_DB = str(Path(__file__).parent.parent / "graph" / "orca_graph.db")

ENTITIES = [
    {
        "entity_id": "iran",
        "name": "Iran",
        "aliases": ["Tehran", "IRAN", "Persia", "Islamic Republic of Iran"],
        "ticker": None,
        "cik": None,
        "lei": "549300VC1K3C5GW9GW83",  # placeholder LEI for Iran
        "entity_type": "NATION",
        "sector": "ENERGY",
        "country": "IR",
        "tags": ["oil_exporter", "opec", "middle_east", "sanctions_target"],
    },
    {
        "entity_id": "russia",
        "name": "Russia",
        "aliases": ["Russian Federation", "RUSSIAN", "Russian Federation"],
        "ticker": None,
        "cik": None,
        "lei": "5493002J6GOJFYXT5G88",
        "entity_type": "NATION",
        "sector": "ENERGY",
        "country": "RU",
        "tags": ["gas_exporter", "pipeline", "eastern_europe", "sanctions_target"],
    },
    {
        "entity_id": "opec_plus",
        "name": "OPEC+",
        "aliases": ["OPEC", "OpecPlus", "Opec Plus"],
        "ticker": None,
        "cik": None,
        "lei": None,
        "entity_type": "REGULATOR",
        "sector": "ENERGY",
        "country": None,
        "tags": ["cartel", "production_control", "crude_oil"],
    },
    {
        "entity_id": "saudi_aramco",
        "name": "Saudi Aramco",
        "aliases": ["Aramco", "Saudi Arabian Oil Company", "SAUDI ARAMCO"],
        "ticker": "2222",
        "cik": "0001707917",
        "lei": "5493001KOHBCJ3Q1P961",
        "entity_type": "IOC",
        "sector": "ENERGY",
        "country": "SA",
        "tags": ["oil_major", "integrated", "ipo_listed"],
    },
    {
        "entity_id": "gazprom",
        "name": "Gazprom",
        "aliases": ["Gazprom PJSC", "PAO Gazprom", "GAZPRU"],
        "ticker": "GAZP",
        "cik": "0001027822",
        "lei": "5493007P4OHSK2E03L87",
        "entity_type": "NOC",
        "sector": "ENERGY",
        "country": "RU",
        "tags": ["gas_major", "pipeline", "state_owned"],
    },
    {
        "entity_id": "chevron",
        "name": "Chevron",
        "aliases": ["Chevron Corporation", "CHV", "CHEVRON"],
        "ticker": "CVX",
        "cik": "0000093110",
        "lei": "549300WSQD3JBS7OND92",
        "entity_type": "IOC",
        "sector": "ENERGY",
        "country": "US",
        "tags": ["oil_major", "integrated", "upstream", "downstream"],
    },
    {
        "entity_id": "eu",
        "name": "European Union",
        "aliases": ["EU", "European Union Member States"],
        "ticker": None,
        "cik": None,
        "lei": None,
        "entity_type": "REGULATOR",
        "sector": "ENERGY",
        "country": None,
        "tags": ["regulator", "energy_import", "gas_consumer"],
    },
    {
        "entity_id": "exxonmobil",
        "name": "ExxonMobil",
        "aliases": ["Exxon", "Exxon Mobil", "XOM"],
        "ticker": "XOM",
        "cik": "0000031208",
        "lei": "PFC1E1S4QQ8O2S2G2F39",
        "entity_type": "IOC",
        "sector": "ENERGY",
        "country": "US",
        "tags": ["oil_major", "integrated", "upstream"],
    },
]


def seed_entities(graph_client=None) -> int:
    """Write all seed entities to FalkorDBLite. Returns count written."""
    if not FALKOR_AVAILABLE or graph_client is None:
        print("[seed_entities] FalkorDBLite not available — writing stub JSON instead")
        return _write_stub()

    written = 0
    for entity in ENTITIES:
        try:
            graph_client.upsert_node("entity_master", entity)
            written += 1
            print(f"  [OK] {entity['entity_id']}: {entity['name']}")
        except Exception as e:
            print(f"  [X] {entity['entity_id']}: {e}")
    return written


def _write_stub() -> int:
    """Write a JSON stub when FalkorDBLite is not available."""
    import json
    stub_path = Path(__file__).parent / "seed_entities.stub.json"
    with open(stub_path, "w") as f:
        json.dump(ENTITIES, f, indent=2)
    print(f"[seed_entities] Wrote stub to {stub_path}")
    return 0


def main():
    print("=" * 60)
    print("ORCA Phase 1 — Seed: entity_master")
    print("=" * 60)

    if FALKOR_AVAILABLE:
        print(f"\nConnecting to FalkorDBLite at: {GRAPH_DB}")
        graph = Graph(database_path=str(GRAPH_DB))
        written = seed_entities(graph)
    else:
        print("\nFalkorDBLite not installed — writing JSON stub only")
        written = seed_entities()

    print(f"\nEntities written: {written}/{len(ENTITIES)}")
    if not FALKOR_AVAILABLE:
        print("Install falkorlitelib and re-run to write to graph DB.")


if __name__ == "__main__":
    main()
