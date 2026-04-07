"""Tests for Researcher A and Researcher B."""

import pytest

from augur.src.agents.output_schema import RegimeState
from augur.src.agents.premise import ExtractedPremise, PremiseClarity


class TestResearcherAStub:
    """Researcher A returns a descriptive stub when no L1 data is in the KB."""

    def test_run_researcher_a_no_kb_returns_stub(self):
        from augur.src.agents.researcher_a import run_researcher_a

        premise = ExtractedPremise(
            core="Offshore drilling thesis",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        output = run_researcher_a(premise, kb=None)
        assert output.role == "researcher_a"
        assert output.regime is not None
        assert output.regime.state == RegimeState.SOLID
        assert output.restoration is not None
        assert output.signals == []

    def test_run_researcher_a_no_l1_data_returns_stub(self, tmp_path):
        from augur.src.agents.researcher_a import run_researcher_a
        from augur.src.knowledge.base import DataNamespace, KnowledgeBase

        db = tmp_path / "empty_kb.db"
        kb = KnowledgeBase(str(db))
        # KB exists but has no market_indicators data — seed something in a different namespace
        kb.set(
            namespace=DataNamespace.NEWS_ARTICLES,
            key="article_1",
            value={"title": "Some news"},
            source="test",
        )

        premise = ExtractedPremise(
            core="Offshore drilling thesis",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        output = run_researcher_a(premise, kb=kb)
        assert output.role == "researcher_a"
        assert output.regime.state == RegimeState.SOLID
        assert output.signals == []

    def test_run_researcher_a_with_l1_data_returns_full_output(self, tmp_path):
        from augur.src.agents.researcher_a import run_researcher_a
        from augur.src.knowledge.base import DataNamespace, KnowledgeBase

        db = tmp_path / "kb_with_l1.db"
        kb = KnowledgeBase(str(db))
        # Seed L1 market data
        kb.set(
            namespace=DataNamespace.MARKET_INDICATORS,
            key="layer1_latest",
            value={
                "composite_score": 7.5,
                "alert_level": "MAJOR_SHOCK",
                "prior_voltage": 2.1,
                "signals": [
                    {
                        "indicator": "VIX",
                        "sigma_magnitude": 5.5,
                        "breach_direction": "UP",
                    },
                    {
                        "indicator": "CREDIT_SPREADS",
                        "sigma_magnitude": 4.0,
                        "breach_direction": "UP",
                    },
                ],
            },
            source="test_seed",
        )

        premise = ExtractedPremise(
            core="Offshore drilling thesis",
            implied_sectors=["Energy"],
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        output = run_researcher_a(premise, kb=kb)
        assert output.role == "researcher_a"
        assert output.regime.state == RegimeState.LIQUID
        assert output.restoration is not None
        assert len(output.signals) == 2
        assert output.signals[0].signal_name == "L1:VIX sigma breach"
        assert output.signals[0].irreversibility == 0.6


class TestResearcherBStub:
    """Researcher B returns a descriptive stub when no L2 signals are in the KB."""

    def test_run_researcher_b_no_kb_returns_stub(self):
        from augur.src.agents.researcher_b import run_researcher_b

        premise = ExtractedPremise(
            core="Offshore drilling thesis",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        output = run_researcher_b(premise, kb=None)
        assert output.role == "researcher_b"
        assert output.regime is not None
        assert output.regime.state == RegimeState.SOLID
        assert output.restoration is not None
        assert output.signals == []

    def test_run_researcher_b_no_l2_signals_returns_stub(self, tmp_path):
        from augur.src.agents.researcher_b import run_researcher_b
        from augur.src.knowledge.base import KnowledgeBase

        db = tmp_path / "empty_kb.db"
        kb = KnowledgeBase(str(db))
        # Don't seed any signal_extractions

        premise = ExtractedPremise(
            core="Offshore drilling thesis",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        output = run_researcher_b(premise, kb=kb)
        assert output.role == "researcher_b"
        assert output.regime.state == RegimeState.SOLID
        assert output.signals == []

    def test_run_researcher_b_with_l2_signals_returns_full_output(self, tmp_path):
        from augur.src.agents.researcher_b import run_researcher_b
        from augur.src.knowledge.base import DataNamespace, KnowledgeBase

        db = tmp_path / "kb_with_l2.db"
        kb = KnowledgeBase(str(db))
        # Seed L2 signals like Spidey would write them
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key="iran_oil_shock_2025",
            value={
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
                "cascade_chains": ["refinery_inputs", "tanker_insurance"],
                "damage_summary": "Nationalization of 50% IOC stake",
                "extraction_confidence": "high",
                "uncertainties": [],
            },
            source="manual_seed",
        )
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key="russia_gas_pipeline_2022",
            value={
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
                "cascade_chains": ["lng_shipping", "industrial_energy_cost"],
                "damage_summary": "Nord Stream 1 flow reduced to zero",
                "extraction_confidence": "high",
                "uncertainties": [],
            },
            source="manual_seed",
        )

        premise = ExtractedPremise(
            core="Offshore drilling thesis",
            implied_sectors=["Energy"],
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        output = run_researcher_b(premise, kb=kb)
        assert output.role == "researcher_b"
        # IMPOSSIBLE + HIGH complexity → GAS regime
        assert output.regime.state == RegimeState.GAS
        assert len(output.signals) == 2
        assert output.signals[0].irreversibility == 0.92

    def test_run_researcher_b_medium_complexity_yields_liquid_regime(self, tmp_path):
        from augur.src.agents.researcher_b import run_researcher_b
        from augur.src.knowledge.base import DataNamespace, KnowledgeBase

        db = tmp_path / "kb_medium.db"
        kb = KnowledgeBase(str(db))
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key="opec_production_cut_2024",
            value={
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
                "cascade_chains": ["refinery_margins"],
                "damage_summary": "OPEC+ voluntary production cut",
                "extraction_confidence": "medium",
                "uncertainties": [],
            },
            source="manual_seed",
        )

        premise = ExtractedPremise(
            core="OPEC thesis",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        output = run_researcher_b(premise, kb=kb)
        # MEDIUM complexity only → SOLID regime
        assert output.regime.state == RegimeState.SOLID
        assert len(output.signals) == 1


class TestResearcherBMixedFormat:
    """Researcher B correctly reads both individual entries and batch wrappers from KB."""

    def test_researcher_b_reads_individual_seed_entries(self, tmp_path):
        """Individual entries (the run_energy_mvp.py seed format) are read correctly."""
        from augur.src.agents.researcher_b import run_researcher_b
        from augur.src.knowledge.base import DataNamespace, KnowledgeBase

        db = tmp_path / "kb_individual.db"
        kb = KnowledgeBase(str(db))

        # Individual entry format — matches run_energy_mvp.py seed_historical_events
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key="iran_oil_shock_2025",
            value={
                "event_type": "EXPROPRIATION",
                "target": "Iran",
                "sector_id": 1,
                "priority": "P1",
                "irreversibility": 0.92,
                "escalation_probability": 0.78,
                "complexity": "IMPOSSIBLE",
                "damage_summary": "Nationalization of IOC stake",
                "extraction_confidence": "high",
            },
            source="manual_seed",
        )
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key="russia_gas_pipeline_2022",
            value={
                "event_type": "PIPELINE_SHUTDOWN",
                "target": "Russia",
                "sector_id": 1,
                "priority": "P1",
                "irreversibility": 0.90,
                "escalation_probability": 0.85,
                "complexity": "HIGH",
                "damage_summary": "Nord Stream 1 flow reduced to zero",
                "extraction_confidence": "high",
            },
            source="manual_seed",
        )

        premise = ExtractedPremise(
            core="Offshore drilling thesis",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        output = run_researcher_b(premise, kb=kb)

        assert output.role == "researcher_b"
        assert len(output.signals) == 2
        # IMPOSSIBLE + HIGH → GAS
        assert output.regime.state == RegimeState.GAS
        # Both individual entries are present
        signal_names = {s.signal_name for s in output.signals}
        assert "L2:EXPROPRIATION@Iran" in signal_names
        assert "L2:PIPELINE_SHUTDOWN@Russia" in signal_names

    def test_researcher_b_reads_batch_wrapper(self, tmp_path):
        """Legacy batch wrapper format {signals: [...]} is read correctly."""
        from augur.src.agents.researcher_b import run_researcher_b
        from augur.src.knowledge.base import DataNamespace, KnowledgeBase

        db = tmp_path / "kb_batch.db"
        kb = KnowledgeBase(str(db))

        # Batch wrapper format — legacy seed_l2_data() style
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key="legacy_batch_1",
            value={
                "signals": [
                    {
                        "event_type": "EXPROPRIATION",
                        "target": "Iran",
                        "sector_id": 1,
                        "priority": "P1",
                        "irreversibility": 0.92,
                        "escalation_probability": 0.78,
                        "complexity": "IMPOSSIBLE",
                        "damage_summary": "Nationalization of IOC stake",
                        "extraction_confidence": "high",
                    },
                    {
                        "event_type": "PRODUCTION_CUT",
                        "target": "Saudi Arabia / OPEC+",
                        "sector_id": 1,
                        "priority": "P2",
                        "irreversibility": 0.65,
                        "escalation_probability": 0.60,
                        "complexity": "MEDIUM",
                        "damage_summary": "OPEC+ voluntary production cut",
                        "extraction_confidence": "medium",
                    },
                ]
            },
            source="legacy_seed",
        )

        premise = ExtractedPremise(
            core="Energy thesis",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        output = run_researcher_b(premise, kb=kb)

        assert output.role == "researcher_b"
        assert len(output.signals) == 2
        signal_names = {s.signal_name for s in output.signals}
        assert "L2:EXPROPRIATION@Iran" in signal_names
        assert "L2:PRODUCTION_CUT@Saudi Arabia / OPEC+" in signal_names

    def test_researcher_b_reads_mixed_entries(self, tmp_path):
        """Individual entries and batch wrappers can coexist in the same KB."""
        from augur.src.agents.researcher_b import run_researcher_b
        from augur.src.knowledge.base import DataNamespace, KnowledgeBase

        db = tmp_path / "kb_mixed.db"
        kb = KnowledgeBase(str(db))

        # Individual entry
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key="iran_oil_shock_2025",
            value={
                "event_type": "EXPROPRIATION",
                "target": "Iran",
                "sector_id": 1,
                "priority": "P1",
                "irreversibility": 0.92,
                "escalation_probability": 0.78,
                "complexity": "IMPOSSIBLE",
                "damage_summary": "Nationalization of IOC stake",
                "extraction_confidence": "high",
            },
            source="manual_seed",
        )
        # Batch wrapper
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key="legacy_batch",
            value={
                "signals": [
                    {
                        "event_type": "PIPELINE_SHUTDOWN",
                        "target": "Russia",
                        "sector_id": 1,
                        "priority": "P1",
                        "irreversibility": 0.90,
                        "escalation_probability": 0.85,
                        "complexity": "HIGH",
                        "damage_summary": "Nord Stream 1 flow reduced to zero",
                        "extraction_confidence": "high",
                    },
                    {
                        "event_type": "PRODUCTION_CUT",
                        "target": "Saudi Arabia / OPEC+",
                        "sector_id": 1,
                        "priority": "P2",
                        "irreversibility": 0.65,
                        "escalation_probability": 0.60,
                        "complexity": "MEDIUM",
                        "damage_summary": "OPEC+ voluntary production cut",
                        "extraction_confidence": "medium",
                    },
                ]
            },
            source="legacy_seed",
        )

        premise = ExtractedPremise(
            core="Energy thesis",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        output = run_researcher_b(premise, kb=kb)

        assert output.role == "researcher_b"
        # 1 individual + 2 from batch = 3 total
        assert len(output.signals) == 3
        signal_names = {s.signal_name for s in output.signals}
        assert "L2:EXPROPRIATION@Iran" in signal_names
        assert "L2:PIPELINE_SHUTDOWN@Russia" in signal_names
        assert "L2:PRODUCTION_CUT@Saudi Arabia / OPEC+" in signal_names
        # IMPOSSIBLE + HIGH + MEDIUM → GAS (highest complexity wins)
        assert output.regime.state == RegimeState.GAS
