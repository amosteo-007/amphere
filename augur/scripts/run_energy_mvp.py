#!/usr/bin/env python
"""
Energy Sector MVP — End-to-end demo.

Run the full Augur pipeline for the Energy sector:
  1. Take a user query about energy investing
  2. Conductor extracts premise + confirms
  3. Agent Spidey (via Claude Code subprocess) runs live web search → L2 signal extraction → KB
  4. Researcher A reads L1 market data from KB
  5. Researcher B reads L2 signals from KB
  6. Conductor synthesizes A + B → 3 outputs

Architecture:
  - Python script: orchestrates the full pipeline
  - Claude Code subprocess: runs Agent Spidey (has WebSearch/WebFetch tool access)
  - Communication: via KB (Spidey writes to KB, conductor reads from KB)

Usage:
  python scripts/run_energy_mvp.py "Is my offshore drilling thesis still valid?"
  python scripts/run_energy_mvp.py --interactive

Requirements:
  - OLLAMA_API_KEY and OLLAMA_MODEL environment variables (see .env.example)
  - Network access
  - augur_taxonomy.db present
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from agents import conduct, ExtractedSignal
from agents.spidey import (
    EXTRACTION_SYSTEM_PROMPT,
    SECTOR_QUERIES,
    extracted_signal_to_cache_value,
    spawn_spidey_agent,
)
from agents.spidey_subprocess import run_spidey_subprocess, _build_spidey_agent_script
from knowledge.base import KnowledgeBase, DataNamespace


# --------------------------------------------------------------------
# Knowledge Base setup
# --------------------------------------------------------------------

KB_PATH = Path(__file__).parent.parent / "augur_knowledge.db"


def get_kb() -> KnowledgeBase:
    return KnowledgeBase(str(KB_PATH))


# --------------------------------------------------------------------
# Print helpers
# --------------------------------------------------------------------

def print_section(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)


def print_result(output) -> None:
    print_section("CONDUCTOR OUTPUT")

    if output.echo_back:
        print("\n[PHASE 1 — PREMISE ECHO-BACK]")
        print(output.echo_back)

    if output.synthesis:
        print("\n[PHASE 3 — SYNTHESIS]")
        print(output.synthesis)

    if output.regime:
        print("\n[REGIME ASSESSMENT]")
        print(f"  State:        {output.regime.state.value.upper()}")
        print(f"  Confidence:   {output.regime.confidence}")
        print(f"  Reasoning:    {output.regime.reasoning}")

    if output.restoration:
        r = output.restoration
        print("\n[RESTORATION ASSESSMENT]")
        print(f"  P_restor:     {r.probability:.2%}")
        print(f"  Velocity:     {r.velocity:+.3f}")
        print(f"  Confidence:   {r.confidence}")
        print(f"  Reasoning:    {r.reasoning}")

    print("\n[SIGNAL STACK — Ranked by Irreversibility]")
    if output.signals:
        sorted_signals = sorted(output.signals, key=lambda s: s.irreversibility, reverse=True)
        for i, sig in enumerate(sorted_signals, 1):
            print(f"  {i}. {sig.signal_name}")
            print(f"     Source:    {sig.source}")
            print(f"     Irrev:     {sig.irreversibility:.2f} | Escalation: {sig.escalation_probability:.2f}")
            print(f"     Confidence: {sig.confidence}")
            print(f"     Reasoning:  {sig.reasoning[:120]}...")
    else:
        print("  (no signals)")

    if output.divergence:
        d = output.divergence
        print("\n[DIVERGENCE — A vs B]")
        print(f"  Interpretation: {d.interpretation}")
        for point in d.points:
            print(f"  - {point}")

    print("\n[CONVERGENCE]")
    print(f"  A vs B:       {output.convergence}")

    if output.recommended_state_weights:
        print(f"  Weights:      A={output.recommended_state_weights.get('researcher_a', 'N/A')} / "
              f"B={output.recommended_state_weights.get('researcher_b', 'N/A')}")

    print("\n[OPEN QUESTIONS]")
    for q in output.open_questions or []:
        print(f"  ? {q}")
    print()


# --------------------------------------------------------------------
# Seed historical events
# --------------------------------------------------------------------

SEED_EVENTS: list[dict] = [
    {
        "extraction_id": "iran_oil_shock_2025",
        "event_type": "EXPROPRIATION",
        "target": "Iran",
        "sector_id": 1,
        "tier": 2,
        "priority": "P1",
        "irreversibility": 0.92,
        "escalation_probability": 0.78,
        "complexity": "IMPOSSIBLE",
        "estimated_months": None,
        "cost_band": ">$1B",
        "cascade_chains": ["refinery_inputs", "tanker_insurance", "petrochemical_feedstock"],
        "damage_summary": "Nationalization of 50% IOC stake in South Pars gas field — capital destroyed, political reversal only path to restoration.",
        "source_title": "Iran nationalises share of foreign oil projects",
        "raw_source_url": "https://www.reuters.com/business/energy/iran-nationalises-share-foreign-oil-projects-2025",
        "extraction_confidence": "high",
        "uncertainties": [],
    },
    {
        "extraction_id": "russia_gas_pipeline_2022",
        "event_type": "PIPELINE_SHUTDOWN",
        "target": "Russia",
        "sector_id": 1,
        "tier": 2,
        "priority": "P1",
        "irreversibility": 0.90,
        "escalation_probability": 0.85,
        "complexity": "HIGH",
        "estimated_months": 24,
        "cost_band": ">$1B",
        "cascade_chains": ["lng_shipping", "industrial_energy_cost", "petrochemical_feedstock"],
        "damage_summary": "Nord Stream 1 flow reduced to zero — permanent infrastructure damage to pipeline integrity.",
        "source_title": "Russia turns off gas pipeline to Europe",
        "raw_source_url": "https://www.bbc.com/news/world-europe-60106520",
        "extraction_confidence": "high",
        "uncertainties": [],
    },
    {
        "extraction_id": "opec_production_cut_2024",
        "event_type": "PRODUCTION_CUT",
        "target": "Saudi Arabia / OPEC+",
        "sector_id": 1,
        "tier": 3,
        "priority": "P2",
        "irreversibility": 0.65,
        "escalation_probability": 0.60,
        "complexity": "MEDIUM",
        "estimated_months": 6,
        "cost_band": "$500M-1B",
        "cascade_chains": ["refinery_margins", "consumer_energy_cost"],
        "damage_summary": "OPEC+ voluntary production cut of 1.16M b/d — price support mechanism, not physical destruction.",
        "source_title": "Saudi Arabia and Russia lead OPEC+ production cuts",
        "raw_source_url": "https://www.reuters.com/markets/commodities/opec-production-cut/",
        "extraction_confidence": "medium",
        "uncertainties": ["OPEC+ compliance rates historically poor — actual supply reduction uncertain."],
    },
]


def seed_historical_events(kb: KnowledgeBase) -> int:
    count = 0
    for event in SEED_EVENTS:
        event_copy = dict(event)
        event_copy["extracted_at"] = datetime.now(timezone.utc).isoformat()
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key=event["extraction_id"],
            value=event_copy,
            source="manual_seed",
        )
        count += 1
    print(f"  Seeded {count} historical energy events to KB")
    return count


# --------------------------------------------------------------------
# Interactive mode
# --------------------------------------------------------------------

def interactive_mode():
    kb = get_kb()
    print("\nAugur — Energy Sector MVP")
    print("Type 'quit' to exit.\n")
    while True:
        try:
            query = input("Query > ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting.")
            break
        if not query:
            continue
        if query.lower() in ("quit", "exit", "q"):
            print("Exiting.")
            break
        print(f"\nRunning: {query}")
        output = conduct(query, kb=kb, skip_echo_confirmation=True)
        print_result(output)


# --------------------------------------------------------------------
# Main
# --------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Energy Sector MVP — Augur Demo")
    parser.add_argument("query", nargs="?", default=None)
    parser.add_argument("--interactive", "-i", action="store_true")
    parser.add_argument("--seed-only", action="store_true")
    parser.add_argument("--skip-spidey", action="store_true")
    args = parser.parse_args()

    kb = get_kb()
    seed_historical_events(kb)

    if args.seed_only:
        print("\nSeed-only mode — exiting.")
        return

    if args.interactive or not args.query:
        interactive_mode()
        return

    print(f"\nQuery: {args.query}")
    output = conduct(args.query, kb=kb, skip_echo_confirmation=True)
    print_result(output)


if __name__ == "__main__":
    main()
