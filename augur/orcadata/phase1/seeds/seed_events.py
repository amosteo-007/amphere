"""Seed events, causal links, and analogue summaries into FalkorDBLite."""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

FALKOR_AVAILABLE = False
try:
    from falkorlitelib import Graph
    FALKOR_AVAILABLE = True
except ImportError:
    print("[seed_events] falkorlitelib not installed — will write SQL stub only")


GRAPH_DB = str(Path(__file__).parent.parent / "graph" / "orca_graph.db")

# ─────────────────────────────────────────────────────────────────
# event_master entries
# ─────────────────────────────────────────────────────────────────
EVENTS = [
    {
        "event_id": "iran_oil_shock_2025",
        "title": "Iran Expropriation of Offshore Drilling Assets",
        "event_type": "EXPROPRIATION",
        "start_date": "2025-01-15",
        "end_date": None,
        "geography": "IR",
        "severity": 0.92,
        "event_status": "ACTIVE",
        "irreversibility": 0.92,
        "complexity": "IMPOSSIBLE",
        "cost_band": ">$1B",
        "tier": 5,
        "priority": "P0",
        "restoration_months": None,
        "analogue_id": "iran_oil_shock_2025",
    },
    {
        "event_id": "russia_gas_pipeline_2022",
        "title": "Russia Shuts Down Nord Stream / Gas Pipeline Infrastructure",
        "event_type": "PIPELINE_SHUTDOWN",
        "start_date": "2022-02-24",
        "end_date": "2022-09-30",
        "geography": "RU/EU",
        "severity": 0.90,
        "event_status": "RESOLVED",
        "irreversibility": 0.90,
        "complexity": "HIGH",
        "cost_band": "$100M-$1B",
        "tier": 4,
        "priority": "P1",
        "restoration_months": 18,
        "analogue_id": "russia_gas_pipeline_2022",
    },
    {
        "event_id": "opec_production_cut_2024",
        "title": "OPEC+ Announced and Executed Production Cut",
        "event_type": "PRODUCTION_CUT",
        "start_date": "2024-03-15",
        "end_date": "2024-09-30",
        "geography": "GLOBAL",
        "severity": 0.65,
        "event_status": "RESOLVED",
        "irreversibility": 0.65,
        "complexity": "MEDIUM",
        "cost_band": "$10M-$100M",
        "tier": 3,
        "priority": "P2",
        "restoration_months": 6,
        "analogue_id": "opec_production_cut_2024",
    },
]

# ─────────────────────────────────────────────────────────────────
# event_entity_role edges
# ─────────────────────────────────────────────────────────────────
EVENT_ENTITY_ROLES = [
    # Iran -> iran_oil_shock_2025 as INITIATOR
    {
        "from_node": "event_master",
        "from_id": "iran_oil_shock_2025",
        "to_node": "entity_master",
        "to_id": "iran",
        "edge_type": "event_entity_role",
        "properties": {
            "role_type": "INITIATOR",
            "description": "Expropriated offshore drilling assets from international energy companies",
        },
    },
    # Russia -> russia_gas_pipeline_2022 as INITIATOR
    {
        "from_node": "event_master",
        "from_id": "russia_gas_pipeline_2022",
        "to_node": "entity_master",
        "to_id": "russia",
        "edge_type": "event_entity_role",
        "properties": {
            "role_type": "INITIATOR",
            "description": "Shut down Nord Stream and associated pipeline infrastructure",
        },
    },
    # EU -> russia_gas_pipeline_2022 as IMPACTED
    {
        "from_node": "event_master",
        "from_id": "russia_gas_pipeline_2022",
        "to_node": "entity_master",
        "to_id": "eu",
        "edge_type": "event_entity_role",
        "properties": {
            "role_type": "IMPACTED",
            "description": "Lost natural gas supply from Russia; faced energy crisis",
        },
    },
    # OPEC+ -> opec_production_cut_2024 as INITIATOR
    {
        "from_node": "event_master",
        "from_id": "opec_production_cut_2024",
        "to_node": "entity_master",
        "to_id": "opec_plus",
        "edge_type": "event_entity_role",
        "properties": {
            "role_type": "INITIATOR",
            "description": "Announced and executed coordinated production cut of 1.4mb/d",
        },
    },
    # Saudi Aramco -> opec_production_cut_2024 as PRODUCER
    {
        "from_node": "event_master",
        "from_id": "opec_production_cut_2024",
        "to_node": "entity_master",
        "to_id": "saudi_aramco",
        "edge_type": "event_entity_role",
        "properties": {
            "role_type": "PRODUCER",
            "description": "Implemented production cuts per OPEC+ agreement",
        },
    },
]

# ─────────────────────────────────────────────────────────────────
# causal_link edges
# ─────────────────────────────────────────────────────────────────
CAUSAL_LINKS = [
    {
        "from_node": "event_master",
        "from_id": "iran_oil_shock_2025",
        "to_node": "event_master",
        "to_id": "opec_production_cut_2024",
        "edge_type": "causal_link",
        "properties": {
            "causal_link_id": "cl_iran_to_opec",
            "mechanism": "SUPPLY_SHIFT",
            "direction": "DOWNSTREAM",
            "confidence": 0.85,
            "strength": 0.70,
            "time_lag_days": 90,
            "evidence_source": "analogue",
        },
    },
    {
        "from_node": "event_master",
        "from_id": "russia_gas_pipeline_2022",
        "to_node": "event_master",
        "to_id": "opec_production_cut_2024",
        "edge_type": "causal_link",
        "properties": {
            "causal_link_id": "cl_russia_to_opec",
            "mechanism": "PRICE_SPIKE",
            "direction": "LATERAL",
            "confidence": 0.78,
            "strength": 0.60,
            "time_lag_days": 45,
            "evidence_source": "analogue",
        },
    },
]

# ─────────────────────────────────────────────────────────────────
# analogue_summaries (analogue_case nodes with restoration outcomes)
# ─────────────────────────────────────────────────────────────────
ANALOGUES = [
    {
        "analogue_id": "iran_oil_shock_2025",
        "summary_text": (
            "WHO: Iran expropriated offshore drilling assets from Western energy companies "
            "(IOCs including TotalEnergies, Eni, and others) in January 2025, citing national sovereignty. "
            "WHAT: Iranian parliament voted to cancel contracts, nationalizing offshore fields in the Persian Gulf. "
            "WHEN: January 15, 2025. "
            "WHERE: Persian Gulf offshore fields, specifically the {SPOND} joint development zone. "
            "WHY: Geopolitical escalation following nuclear talks breakdown; Iran sought to demonstrate "
            "sovereignty over natural resources as leverage in negotiations. "
            "HOW: Legislative decree; Iranian military escorted workers onto platforms, displacing IOC staff. "
            "IMPACT: 1.2mb/d of production capacity disrupted. Brent rose from $78 to $94/bbl in 2 weeks. "
            "RESTORATION: Not yet restored as of April 2026 — ongoing diplomatic standoff."
        ),
        "tags": ["EXPROPRIATION", "IR", "HIGH_SEVERITY", "ACTIVE", "IOC", "OFFSHORE"],
        "severity": 0.92,
        "duration_days": None,  # still active
        "structural_flags": ["nationalization", "geopolitical", "ioc_displacement", "supply_shock"],
        "restoration_cost_actual": None,
        "restoration_months_actual": None,
        "fully_restored": False,
    },
    {
        "analogue_id": "russia_gas_pipeline_2022",
        "summary_text": (
            "WHO: Russia (Gazprom) shut down Nord Stream 1 and related pipeline infrastructure to the EU. "
            "WHAT: Physical gas flow through the major export pipeline ceased following geopolitical tensions "
            "surrounding the invasion of Ukraine. Nord Stream 2 certification was also suspended. "
            "WHEN: February 24, 2022 (invasion) — flow ceased progressively through September 2022. "
            "WHERE: Nord Stream pipeline from Russia to Germany under the Baltic Sea. "
            "WHY: Russia's use of energy as a geopolitical weapon in response to Western sanctions "
            "following the invasion of Ukraine. "
            "HOW: Technical借口 (technical faults used as pretext) then physical shutdown; "
            "later sabotage (September 2022) destroyed 3 of 4 Nord Stream 1 strings. "
            "IMPACT: ~220bcm/yr of supply to EU disrupted. EU gas prices spiked 500% year-on-year. "
            "RESTORATION: Pipeline infrastructure intact but not operational. "
            "EU redirected LNG imports. Partial restoration by mid-2023 through alternative routes."
        ),
        "tags": ["PIPELINE_SHUTDOWN", "RU", "EU", "HIGH_SEVERITY", "RESOLVED", "GAS", "NORDSTREAM"],
        "severity": 0.90,
        "duration_days": 556,  # Feb 2022 — Sep 2023
        "structural_flags": ["pipeline_infrastructure", "geopolitical_weapon", "supply_shock", "lng_substitute"],
        "restoration_cost_actual": 300_000_000_000,  # EU energy crisis cost estimate
        "restoration_months_actual": 18,
        "fully_restored": False,  # infrastructure intact but geopolitical restoration incomplete
    },
    {
        "analogue_id": "opec_production_cut_2024",
        "summary_text": (
            "WHO: OPEC+ (Saudi Arabia, Russia, UAE, Iraq, Kazakhstan etc.) announced and executed "
            "a coordinated production cut of 1.4 million barrels per day. "
            "WHAT: Voluntary production cut to stabilize oil prices following demand concerns "
            "and perceived market oversupply. "
            "WHEN: Announced March 15, 2024; implemented April 2024 through December 2024. "
            "WHERE: Global crude oil market; primarily Saudi Arabia and Russia. "
            "WHY: Brent had fallen from $95 (Oct 2023) to $75 (March 2024) on demand concerns. "
            "Saudi Arabia sought to demonstrate cartel price management capacity. "
            "HOW: Ministerial decision via OPEC+ JMMC; voluntary quota reduction per country. "
            "IMPACT: Brent rose from $75 to $90/bbl within 6 weeks. US strategic reserves "
            "released to offset price impact. "
            "RESTORATION: Full restoration by end-2024 as agreed. Prices returned to $80-85 range."
        ),
        "tags": ["PRODUCTION_CUT", "GLOBAL", "MEDIUM_SEVERITY", "RESOLED", "OPEC", "CARTEL"],
        "severity": 0.65,
        "duration_days": 180,  # April — September 2024
        "structural_flags": ["voluntary_cut", "cartel_coordination", "price_management"],
        "restoration_cost_actual": 2_000_000_000,  # consumer country strategic reserve costs
        "restoration_months_actual": 6,
        "fully_restored": True,
    },
]


def seed_events(graph_client=None) -> dict:
    """Write all events, roles, causal links, and analogues. Returns counts."""
    if not FALKOR_AVAILABLE or graph_client is None:
        print("[seed_events] FalkorDBLite not available — writing stub JSON")
        return _write_stub()

    counts = {"events": 0, "roles": 0, "causal_links": 0, "analogues": 0}

    # Events
    for event in EVENTS:
        try:
            graph_client.upsert_node("event_master", event)
            counts["events"] += 1
            print(f"  [OK] event: {event['event_id']}")
        except Exception as e:
            print(f"  [X] event {event['event_id']}: {e}")

    # Analogue case nodes
    for analogue in ANALOGUES:
        try:
            graph_client.upsert_node("analogue_case", analogue)
            counts["analogues"] += 1
            print(f"  [OK] analogue: {analogue['analogue_id']}")
        except Exception as e:
            print(f"  [X] analogue {analogue['analogue_id']}: {e}")

    # Event-entity roles
    for role in EVENT_ENTITY_ROLES:
        try:
            graph_client.upsert_edge(
                from_node=role["from_node"],
                from_id=role["from_id"],
                to_node=role["to_node"],
                to_id=role["to_id"],
                edge_type=role["edge_type"],
                properties=role["properties"],
            )
            counts["roles"] += 1
            print(f"  [OK] role: {role['from_id']} --({role['properties']['role_type']})--> {role['to_id']}")
        except Exception as e:
            print(f"  [X] role: {e}")

    # Causal links
    for link in CAUSAL_LINKS:
        try:
            graph_client.upsert_edge(
                from_node=link["from_node"],
                from_id=link["from_id"],
                to_node=link["to_node"],
                to_id=link["to_id"],
                edge_type=link["edge_type"],
                properties=link["properties"],
            )
            counts["causal_links"] += 1
            print(f"  [OK] causal: {link['from_id']} -> {link['to_id']} [{link['properties']['mechanism']}]")
        except Exception as e:
            print(f"  [X] causal link: {e}")

    return counts


def _write_stub() -> dict:
    """Write a JSON stub when FalkorDBLite is not available."""
    import json
    stub_path = Path(__file__).parent / "seed_events.stub.json"
    stub = {
        "events": EVENTS,
        "event_entity_roles": EVENT_ENTITY_ROLES,
        "causal_links": CAUSAL_LINKS,
        "analogues": ANALOGUES,
    }
    with open(stub_path, "w") as f:
        json.dump(stub, f, indent=2)
    print(f"[seed_events] Wrote stub to {stub_path}")
    return {"events": 0, "roles": 0, "causal_links": 0, "analogues": 0}


def main():
    print("=" * 60)
    print("ORCA Phase 1 — Seed: events + causal links + analogues")
    print("=" * 60)

    if FALKOR_AVAILABLE:
        print(f"\nConnecting to FalkorDBLite at: {GRAPH_DB}")
        graph = Graph(database_path=str(GRAPH_DB))
        counts = seed_events(graph)
    else:
        print("\nFalkorDBLite not installed — writing JSON stub only")
        counts = seed_events()

    print(f"\nCounts: {counts}")
    print(f"Events: {counts['events']}/{len(EVENTS)}")
    print(f"Roles: {counts['roles']}/{len(EVENT_ENTITY_ROLES)}")
    print(f"Causal links: {counts['causal_links']}/{len(CAUSAL_LINKS)}")
    print(f"Analogues: {counts['analogues']}/{len(ANALOGUES)}")


if __name__ == "__main__":
    main()
