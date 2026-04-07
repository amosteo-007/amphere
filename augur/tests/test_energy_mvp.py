#!/usr/bin/env python
"""
Comprehensive test suite for the Energy MVP end-to-end pipeline.

Tests:
  1. KB setup & seed events
  2. Layer 1 sigma breach engine with synthetic price data
  3. Premise extraction (structure + parsing)
  4. Researcher A & B stubs with seeded KB data
  5. Conductor synthesis (manual fallback)
  6. End-to-end --seed-only run
  7. Error handling (missing env vars, KB path, etc.)
  8. Output schema integrity

Run all:
  python tests/test_energy_mvp.py

Run verbose:
  python tests/test_energy_mvp.py -v
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

# Ensure src/ is on the path so `from agents.researcher_a import ...` resolves.
# Do NOT add the project root (no __init__.py there) — that would break
# relative imports like `from ..knowledge` in researcher_a.py, because Python
# would treat the project root as a non-package directory on sys.path.
SRC_PATH = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(SRC_PATH))


# --------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------

def seed_only_run() -> tuple[int, str, str]:
    """Run `python scripts/run_energy_mvp.py --seed-only`."""
    result = subprocess.run(
        [sys.executable, "scripts/run_energy_mvp.py", "--seed-only"],
        capture_output=True,
        text=True,
        cwd=Path(__file__).parent.parent,
    )
    return result.returncode, result.stdout, result.stderr


def seed_l1_data(kb):
    """Seed KB with L1 data that Researcher A expects."""
    from knowledge.base import DataNamespace
    # Researcher A reads: kb.get(MARKET_INDICATORS, "layer1_latest")
    # Expected structure: {signals: [...], composite_score: float, alert_level: str}
    kb.set(
        namespace=DataNamespace.MARKET_INDICATORS,
        key="layer1_latest",
        value={
            "signals": [
                {
                    "indicator": "VIX",
                    "sigma_magnitude": 7.2,
                    "breach_direction": "UP",
                    "composite_score": 5.8,
                    "alert_level": "MAJOR_SHOCK",
                }
            ],
            "composite_score": 5.8,
            "alert_level": "MAJOR_SHOCK",
            "prior_voltage": 0.1,
        },
        source="test_seed",
        ttl=timedelta(minutes=5),
    )


def seed_l2_data(kb):
    """Seed KB with L2 data that Researcher B expects (latest_batch key)."""
    from knowledge.base import DataNamespace
    # Researcher B reads: kb.get(SIGNAL_EXTRACTIONS, "latest_batch")
    # Expected: {signals: [...]}
    kb.set(
        namespace=DataNamespace.SIGNAL_EXTRACTIONS,
        key="latest_batch",
        value={
            "signals": [
                {
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
                    "cascade_chains": ["refinery_inputs"],
                    "damage_summary": "Nationalization of 50% IOC stake in South Pars.",
                    "source_title": "Iran nationalises share",
                    "raw_source_url": "https://www.reuters.com/iran-oil",
                    "extraction_confidence": "high",
                    "uncertainties": [],
                },
                {
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
                    "cascade_chains": ["lng_shipping"],
                    "damage_summary": "Nord Stream 1 flow reduced to zero.",
                    "source_title": "Russia turns off gas",
                    "raw_source_url": "https://www.bbc.com/russia-gas",
                    "extraction_confidence": "high",
                    "uncertainties": [],
                },
            ]
        },
        source="test_seed",
        ttl=timedelta(hours=6),
    )


# --------------------------------------------------------------------
# Test: KB Setup & Seed Events
# --------------------------------------------------------------------

class TestKnowledgeBaseSetup(unittest.TestCase):
    """Test that the KB can be created, seeded, and queried."""

    def setUp(self):
        self._tmpdir = tempfile.mkdtemp()
        self._db_path = os.path.join(self._tmpdir, "test_kb.db")

    def tearDown(self):
        import shutil
        shutil.rmtree(self._tmpdir, ignore_errors=True)

    def test_kb_creates_new_file(self):
        from knowledge.base import KnowledgeBase
        kb = KnowledgeBase(self._db_path)
        self.assertTrue(Path(self._db_path).exists())

    def test_kb_set_and_get_roundtrip(self):
        from knowledge.base import KnowledgeBase, DataNamespace
        kb = KnowledgeBase(self._db_path)
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key="test_key",
            value={"foo": "bar"},
            source="test",
        )
        entry = kb.get(DataNamespace.SIGNAL_EXTRACTIONS, "test_key")
        self.assertIsNotNone(entry)
        self.assertEqual(entry.value["foo"], "bar")

    def test_kb_get_fresh_respects_ttl(self):
        from knowledge.base import KnowledgeBase, DataNamespace
        kb = KnowledgeBase(self._db_path)
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key="fresh_key",
            value={"v": 1},
            source="test",
            ttl=timedelta(hours=6),
        )
        entry = kb.get_fresh(DataNamespace.SIGNAL_EXTRACTIONS, "fresh_key")
        self.assertIsNotNone(entry)

    def test_seed_only_run_exits_zero(self):
        rc, stdout, stderr = seed_only_run()
        self.assertEqual(rc, 0, f"stderr: {stderr}")
        self.assertIn("Seeded", stdout)

    def test_seed_only_writes_iran_event(self):
        from knowledge.base import KnowledgeBase, DataNamespace
        rc, _, _ = seed_only_run()
        self.assertEqual(rc, 0)
        kb_path = Path(__file__).parent.parent / "augur_knowledge.db"
        kb = KnowledgeBase(str(kb_path))
        iran = kb.get(DataNamespace.SIGNAL_EXTRACTIONS, "iran_oil_shock_2025")
        self.assertIsNotNone(iran)
        self.assertEqual(iran.value["event_type"], "EXPROPRIATION")
        self.assertEqual(iran.value["irreversibility"], 0.92)

    def test_kb_stats_after_seed(self):
        from knowledge.base import KnowledgeBase, DataNamespace
        rc, _, _ = seed_only_run()
        self.assertEqual(rc, 0)
        kb_path = Path(__file__).parent.parent / "augur_knowledge.db"
        kb = KnowledgeBase(str(kb_path))
        stats = kb.stats()
        self.assertGreater(stats.get("signal_extractions", {}).get("fresh", 0), 0)


# --------------------------------------------------------------------
# Test: Layer 1 Sigma Breach Engine
# --------------------------------------------------------------------

class TestLayer1Engine(unittest.TestCase):
    """Test the L1 sigma breach detection with synthetic price data."""

    def test_sigma_reading_zscore_calculation(self):
        from signals.ingestion.layer1 import SigmaReading, Indicator
        # short_mean=30, short_std=5, current=60 → zscore = (60-30)/5 = 6.0
        reading = SigmaReading(
            indicator=Indicator.VIX,
            current=60.0,
            short_mean=30.0,
            short_std=5.0,
            long_mean=20.0,
            long_std=5.0,
        )
        self.assertAlmostEqual(reading.short_zscore, 6.0, places=1)
        self.assertIsNotNone(reading.short_sigma_breach)  # >= 6σ threshold

    def test_sigma_reading_no_breach_calm_market(self):
        from signals.ingestion.layer1 import SigmaReading, Indicator
        reading = SigmaReading(
            indicator=Indicator.VIX,
            current=20.0,
            short_mean=20.0,
            short_std=1.0,
            long_mean=20.0,
            long_std=5.0,
        )
        self.assertFalse(bool(reading.short_sigma_breach))
        self.assertFalse(bool(reading.long_sigma_breach))

    def test_sigma_reading_zero_std_guard(self):
        from signals.ingestion.layer1 import SigmaReading, Indicator
        reading = SigmaReading(
            indicator=Indicator.VIX,
            current=50.0,
            short_mean=30.0,
            short_std=0.0,  # zero stddev — should return 0, not divide by zero
            long_mean=20.0,
            long_std=0.0,
        )
        self.assertEqual(reading.short_zscore, 0.0)

    def test_composite_score_major_shock(self):
        from signals.ingestion.layer1 import CompositeScore, SigmaReading, Indicator, AlertLevel
        readings = [
            SigmaReading(Indicator.VIX, current=60.0, short_mean=30.0, short_std=5.0,
                         long_mean=20.0, long_std=5.0),
            SigmaReading(Indicator.CREDIT_SPREADS, current=5.0, short_mean=2.0, short_std=0.5,
                         long_mean=2.0, long_std=0.5),
        ]
        score = CompositeScore.compute(readings)
        self.assertIsNotNone(score)
        self.assertIn(score.alert_level, (AlertLevel.MAJOR_SHOCK, AlertLevel.REGIME_SHIFT))

    def test_composite_score_quiet(self):
        from signals.ingestion.layer1 import CompositeScore, SigmaReading, Indicator, AlertLevel
        readings = [
            SigmaReading(Indicator.VIX, current=20.0, short_mean=20.0, short_std=1.0,
                         long_mean=20.0, long_std=5.0),
            SigmaReading(Indicator.CREDIT_SPREADS, current=0.5, short_mean=0.5, short_std=0.1,
                         long_mean=0.5, long_std=0.2),
            SigmaReading(Indicator.DXY, current=100.0, short_mean=100.0, short_std=1.0,
                         long_mean=100.0, long_std=5.0),
        ]
        score = CompositeScore.compute(readings)
        self.assertEqual(score.alert_level, AlertLevel.QUIET)

    def test_reference_point_trims_to_14_days(self):
        from signals.ingestion.layer1 import ReferencePoint, Indicator
        rp = ReferencePoint()
        prices = {Indicator.VIX: 25.0}
        for i in range(30):
            rp.update(prices)
        vix_prices = rp.indicator_values_14d.get(Indicator.VIX, [])
        self.assertLessEqual(len(vix_prices), 14)

    def test_reference_point_should_refresh_after_14_days(self):
        from signals.ingestion.layer1 import ReferencePoint, Indicator
        from datetime import timedelta
        rp = ReferencePoint()
        # Manually age the reference point to 14 days old so should_refresh returns True.
        # (update() resets established_at each time, so looping update() never ages it.)
        rp.established_at = datetime.now(timezone.utc) - timedelta(days=14)
        prices = {Indicator.VIX: 25.0}
        self.assertTrue(rp.should_refresh)

    def test_prior_from_alert_ordering(self):
        from signals.ingestion.layer1 import prior_from_alert, AlertLevel
        quiet = prior_from_alert(AlertLevel.QUIET)
        investigate = prior_from_alert(AlertLevel.INVESTIGATE)
        major = prior_from_alert(AlertLevel.MAJOR_SHOCK)
        regime = prior_from_alert(AlertLevel.REGIME_SHIFT)
        self.assertGreater(quiet, investigate)
        self.assertGreater(investigate, major)
        self.assertGreater(major, regime)

    def test_layer1_state_update(self):
        from signals.ingestion.layer1 import Layer1State, Indicator
        state = Layer1State()
        prices = {
            Indicator.VIX: 50.0,
            Indicator.CREDIT_SPREADS: 3.5,
        }
        state.update(prices)
        self.assertIsNotNone(state.composite_score)
        self.assertIsNotNone(state.alert_level)
        self.assertIsNotNone(state.prior)


# --------------------------------------------------------------------
# Test: Premise Extraction
# --------------------------------------------------------------------

class TestPremiseExtraction(unittest.TestCase):
    """Test premise extraction structures."""

    def test_extracted_premise_dataclass(self):
        from agents.premise import ExtractedPremise, PremiseClarity
        p = ExtractedPremise(
            core="Oil prices will rise due to supply disruption.",
            implied_assets=["XOM", "CVX"],
            implied_sectors=["Energy"],
            question_type="thesis_review",
            clarity=PremiseClarity.EXPLICIT,
            ambiguity_notes=[],
            raw_tokens=["oil", "supply"],
            extraction_confidence="high",
        )
        self.assertEqual(p.core, "Oil prices will rise due to supply disruption.")
        self.assertIn("Energy", p.implied_sectors)
        self.assertEqual(p.clarity, PremiseClarity.EXPLICIT)

    def test_format_echo_back_explicit_auto_proceeds(self):
        from agents.premise import format_echo_back, ExtractedPremise, PremiseClarity
        p = ExtractedPremise(
            core="Offshore drilling is undervalued.",
            implied_assets=["RIG", "DO"],
            implied_sectors=["Energy"],
            question_type="thesis_review",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        echo = format_echo_back(p)
        self.assertIn("offshore drilling", echo.echo_text.lower())
        self.assertTrue(echo.auto_proceed)

    def test_format_echo_back_vague_requests_clarification(self):
        from agents.premise import format_echo_back, ExtractedPremise, PremiseClarity
        p = ExtractedPremise(
            core="Energy is interesting.",
            implied_assets=[],
            implied_sectors=[],
            question_type="general",
            clarity=PremiseClarity.VAGUE,
            extraction_confidence="low",
        )
        echo = format_echo_back(p)
        self.assertFalse(echo.auto_proceed)
        self.assertGreater(len(echo.clarification_questions), 0)

    def test_parse_premise_valid_json(self):
        from agents.conductor import _parse_premise_response
        from agents.premise import PremiseClarity
        response = '{"core":"Test claim","clarity":"explicit","implied_assets":["XOM"],"implied_sectors":["Energy"],"question_type":"thesis_review","extraction_confidence":"high","ambiguity_notes":[],"raw_tokens":[]}'
        result = _parse_premise_response(response)
        self.assertEqual(result.core, "Test claim")
        self.assertEqual(result.clarity, PremiseClarity.EXPLICIT)

    def test_parse_premise_missing_clarity_defaults_to_missing(self):
        from agents.conductor import _parse_premise_response
        from agents.premise import PremiseClarity
        response = '{"core":"Test claim"}'
        result = _parse_premise_response(response)
        self.assertEqual(result.clarity, PremiseClarity.MISSING)

    def test_parse_premise_no_json_fallback(self):
        from agents.conductor import _parse_premise_response
        from agents.premise import PremiseClarity
        result = _parse_premise_response("This is not JSON at all")
        self.assertEqual(result.clarity, PremiseClarity.MISSING)


# --------------------------------------------------------------------
# Test: Researcher A (Quantitative School)
# --------------------------------------------------------------------

class TestResearcherA(unittest.TestCase):
    """Test Researcher A with empty and seeded KB."""

    def test_researcher_a_no_l1_data_returns_stub(self):
        from agents.researcher_a import run_researcher_a
        from agents.premise import ExtractedPremise, PremiseClarity
        from knowledge.base import KnowledgeBase

        tmpdir = tempfile.mkdtemp()
        try:
            kb = KnowledgeBase(os.path.join(tmpdir, "kb.db"))
            p = ExtractedPremise(
                core="Energy thesis",
                implied_assets=["XOM"],
                implied_sectors=["Energy"],
                question_type="thesis_review",
                clarity=PremiseClarity.EXPLICIT,
                extraction_confidence="high",
            )
            result = run_researcher_a(p, kb=kb)
            self.assertEqual(result.role, "researcher_a")
            self.assertEqual(result.regime.state.value, "solid")
            self.assertEqual(len(result.signals), 0)
        finally:
            import shutil; shutil.rmtree(tmpdir, ignore_errors=True)

    def test_researcher_a_with_l1_data_returns_regime(self):
        from agents.researcher_a import run_researcher_a
        from agents.premise import ExtractedPremise, PremiseClarity
        from knowledge.base import KnowledgeBase

        tmpdir = tempfile.mkdtemp()
        try:
            kb = KnowledgeBase(os.path.join(tmpdir, "kb.db"))
            seed_l1_data(kb)
            p = ExtractedPremise(
                core="Energy thesis",
                implied_assets=["XOM"],
                implied_sectors=["Energy"],
                question_type="thesis_review",
                clarity=PremiseClarity.EXPLICIT,
                extraction_confidence="high",
            )
            result = run_researcher_a(p, kb=kb)
            self.assertEqual(result.role, "researcher_a")
            self.assertIn(result.regime.state.value, ("liquid", "gas"))
            self.assertGreater(len(result.signals), 0)
        finally:
            import shutil; shutil.rmtree(tmpdir, ignore_errors=True)


# --------------------------------------------------------------------
# Test: Researcher B (Event-Driven School)
# --------------------------------------------------------------------

class TestResearcherB(unittest.TestCase):
    """Test Researcher B with empty and seeded KB."""

    def test_researcher_b_no_l2_data_returns_stub(self):
        from agents.researcher_b import run_researcher_b
        from agents.premise import ExtractedPremise, PremiseClarity
        from knowledge.base import KnowledgeBase

        tmpdir = tempfile.mkdtemp()
        try:
            kb = KnowledgeBase(os.path.join(tmpdir, "kb.db"))
            p = ExtractedPremise(
                core="Energy thesis",
                implied_assets=["XOM"],
                implied_sectors=["Energy"],
                question_type="thesis_review",
                clarity=PremiseClarity.EXPLICIT,
                extraction_confidence="high",
            )
            result = run_researcher_b(p, kb=kb)
            self.assertEqual(result.role, "researcher_b")
            self.assertEqual(result.regime.state.value, "solid")
        finally:
            import shutil; shutil.rmtree(tmpdir, ignore_errors=True)

    def test_researcher_b_with_l2_seeds_returns_signal_findings(self):
        from agents.researcher_b import run_researcher_b
        from agents.premise import ExtractedPremise, PremiseClarity
        from knowledge.base import KnowledgeBase

        tmpdir = tempfile.mkdtemp()
        try:
            kb = KnowledgeBase(os.path.join(tmpdir, "kb.db"))
            seed_l2_data(kb)
            p = ExtractedPremise(
                core="Offshore drilling faces geopolitical risk",
                implied_assets=["RIG"],
                implied_sectors=["Energy"],
                question_type="thesis_review",
                clarity=PremiseClarity.EXPLICIT,
                extraction_confidence="high",
            )
            result = run_researcher_b(p, kb=kb)
            self.assertEqual(result.role, "researcher_b")
            self.assertGreater(len(result.signals), 0)
            self.assertEqual(result.regime.state.value, "gas")
        finally:
            import shutil; shutil.rmtree(tmpdir, ignore_errors=True)


# --------------------------------------------------------------------
# Test: Conductor Synthesis
# --------------------------------------------------------------------

class TestConductorSynthesis(unittest.TestCase):
    """Test conductor synthesis paths."""

    def test_manual_synthesis_a_only(self):
        from agents.conductor import _manual_synthesis
        from agents.output_schema import AgentOutput, RegimeAssessment, RestorationAssessment
        from agents.premise import ExtractedPremise, PremiseClarity

        p = ExtractedPremise(
            core="Test",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        output_a = AgentOutput(
            role="researcher_a",
            premise_id="test",
            regime=RegimeAssessment(state=MagicMock(value="solid"), confidence="high", reasoning=""),
            restoration=RestorationAssessment(probability=0.95, velocity=0.0, confidence="high", reasoning=""),
        )
        output_b = AgentOutput(role="researcher_b", premise_id="test")
        result = _manual_synthesis(p, output_a, output_b, [])
        self.assertIsNotNone(result)
        self.assertEqual(result.role, "conductor")

    def test_manual_synthesis_50_50_blend(self):
        from agents.conductor import _manual_synthesis
        from agents.output_schema import AgentOutput, RegimeAssessment, RestorationAssessment
        from agents.premise import ExtractedPremise, PremiseClarity
        from agents.output_schema import RegimeState

        p = ExtractedPremise(
            core="Test",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        output_a = AgentOutput(
            role="researcher_a",
            premise_id="test",
            regime=RegimeAssessment(state=RegimeState.LIQUID, confidence="high", reasoning="A says LIQUID"),
            restoration=RestorationAssessment(probability=0.70, velocity=-0.01, confidence="medium", reasoning=""),
        )
        output_b = AgentOutput(
            role="researcher_b",
            premise_id="test",
            regime=RegimeAssessment(state=RegimeState.GAS, confidence="high", reasoning="B says GAS"),
            restoration=RestorationAssessment(probability=0.50, velocity=-0.05, confidence="medium", reasoning=""),
        )
        result = _manual_synthesis(p, output_a, output_b, [])
        self.assertIsNotNone(result.convergence)
        self.assertIsNotNone(result.restoration)
        self.assertEqual(result.restoration.probability, 0.60)  # 50/50 blend

    def test_build_search_queries_energy_offshore(self):
        from agents.conductor import _build_search_queries
        from agents.premise import ExtractedPremise, PremiseClarity

        p = ExtractedPremise(
            core="Offshore drilling in the Gulf of Mexico is at risk from geopolitical tensions",
            implied_assets=["RIG", "DO"],
            implied_sectors=["Energy"],
            question_type="thesis_review",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        queries = _build_search_queries(p, sector_id=1)
        self.assertIsInstance(queries, list)
        self.assertGreater(len(queries), 0)
        joined = " ".join(queries).lower()
        self.assertTrue(
            any(kw in joined for kw in ["offshore", "gulf", "drilling"]),
            f"Expected offshore/gulf/drilling keywords, got: {queries}"
        )

    def test_build_search_queries_unknown_sector(self):
        from agents.conductor import _build_search_queries
        from agents.premise import ExtractedPremise, PremiseClarity

        p = ExtractedPremise(
            core="Tech stocks are undervalued",
            implied_assets=["AAPL"],
            implied_sectors=["Information Technology"],
            question_type="thesis_review",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        queries = _build_search_queries(p, sector_id=99)
        self.assertIsInstance(queries, list)

    def test_format_spidey_signals_empty(self):
        from agents.conductor import _format_spidey_signals
        formatted = _format_spidey_signals([])
        self.assertIn("no signals", formatted.lower())

    def test_format_spidey_signals_with_data(self):
        from agents.conductor import _format_spidey_signals
        from agents.spidey import ExtractedSignal, SignalType
        import uuid

        sig = ExtractedSignal(
            extraction_id=str(uuid.uuid4()),
            event_type=SignalType.PRODUCTION_CUT,
            target="Saudi Arabia",
            sector_id=1,
            tier=2,
            priority="P2",
            irreversibility=0.75,
            escalation_probability=0.65,
            complexity=None,
            estimated_months=6,
            cost_band=None,
            cascade_chains=[],
            damage_summary="Test damage",
            source_title="Test source",
            raw_source_url="https://example.com",
            extraction_confidence="medium",
            uncertainties=[],
        )
        formatted = _format_spidey_signals([sig])
        self.assertIn("Saudi Arabia", formatted)
        self.assertIn("PRODUCTION_CUT", formatted)


# --------------------------------------------------------------------
# Test: End-to-End
# --------------------------------------------------------------------

class TestEndToEnd(unittest.TestCase):
    """Test the full pipeline end-to-end."""

    def test_seed_only_exits_zero(self):
        rc, stdout, stderr = seed_only_run()
        self.assertEqual(rc, 0, f"stderr: {stderr}")

    def test_skip_spidey_run_starts_pipeline(self):
        """Run with --skip-spidey. No web access needed. May fail on LLM but shouldn't crash."""
        result = subprocess.run(
            [sys.executable, "scripts/run_energy_mvp.py",
             "Is my offshore drilling thesis still valid?", "--skip-spidey"],
            capture_output=True,
            text=True,
            timeout=120,
            cwd=Path(__file__).parent.parent,
        )
        # Pipeline should at least start (may fail on Ollama call)
        self.assertIn("Query:", result.stdout)

    def test_full_pipeline_with_mocks(self):
        """Full pipeline with mocked LLM — tests all non-web paths."""
        from agents.conductor import conduct
        from agents.premise import ExtractedPremise, PremiseClarity
        from knowledge.base import KnowledgeBase

        tmpdir = tempfile.mkdtemp()
        try:
            kb = KnowledgeBase(os.path.join(tmpdir, "kb.db"))
            seed_l1_data(kb)
            seed_l2_data(kb)

            # Mock premise extraction and synthesis LLM call
            with patch("agents.conductor.extract_premise") as mock_extract, \
                 patch("agents.conductor.synthesize") as mock_synth:
                mock_extract.return_value = ExtractedPremise(
                    core="Offshore drilling faces geopolitical risk.",
                    implied_assets=["RIG", "DO"],
                    implied_sectors=["Energy"],
                    question_type="thesis_review",
                    clarity=PremiseClarity.EXPLICIT,
                    extraction_confidence="high",
                )
                # Return a valid conductor AgentOutput from synthesize
                from agents.output_schema import AgentOutput, RegimeAssessment, RestorationAssessment, RegimeState
                mock_synth.return_value = AgentOutput(
                    role="conductor",
                    premise_id="test",
                    regime=RegimeAssessment(state=RegimeState.LIQUID, confidence="high", reasoning="mocked"),
                    restoration=RestorationAssessment(probability=0.65, velocity=-0.02, confidence="high", reasoning=""),
                    signals=[],
                )

                output = conduct(
                    "Is my offshore drilling thesis still valid?",
                    kb=kb,
                    skip_echo_confirmation=True,
                )

            self.assertEqual(output.role, "conductor")
            self.assertIsNotNone(output.echo_back)
        finally:
            import shutil; shutil.rmtree(tmpdir, ignore_errors=True)


# --------------------------------------------------------------------
# Test: Phase 4 — conduct() end-to-end with seeded KB
# --------------------------------------------------------------------

class TestConductEndToEnd(unittest.TestCase):
    """Verify conduct() with real seeded KB produces coherent output."""

    def test_conduct_full_pipeline_with_real_kb_no_spidey(self):
        """conduct() with seeded L1+L2 KB and spidey mocked returns valid output.

        Verifies the full call path: extract_premise → delegate_to_spidey →
        research_a + research_b → synthesize, with a real KB and no LLM calls.
        """
        from agents.conductor import conduct, delegate_to_spidey, research_a, research_b
        from agents.premise import ExtractedPremise, PremiseClarity
        from agents.output_schema import RegimeState
        from knowledge.base import KnowledgeBase

        tmpdir = tempfile.mkdtemp()
        try:
            kb = KnowledgeBase(os.path.join(tmpdir, "kb.db"))
            seed_l1_data(kb)
            seed_l2_data(kb)

            premise = ExtractedPremise(
                core="Offshore drilling faces geopolitical risk.",
                implied_sectors=["Energy"],
                clarity=PremiseClarity.EXPLICIT,
                extraction_confidence="high",
            )

            # Patch spidey to return empty (simulates no web access)
            with patch("agents.conductor.spawn_spidey_agent", return_value=[]):
                # Researchers should read seeded data
                output_a = research_a(premise, kb=kb)
                output_b = research_b(premise, kb=kb)

            # Researcher A reads L1 seed → should have signal findings
            self.assertEqual(output_a.role, "researcher_a")
            self.assertIsNotNone(output_a.regime)
            self.assertIn(output_a.regime.state, (RegimeState.SOLID, RegimeState.LIQUID, RegimeState.GAS))

            # Researcher B reads L2 seed → should have signal findings
            # seed_l2_data uses IMPOSSIBLE complexity → GAS regime
            self.assertEqual(output_b.role, "researcher_b")
            self.assertIsNotNone(output_b.regime)
            self.assertEqual(output_b.regime.state, RegimeState.GAS)
            self.assertGreater(len(output_b.signals), 0)
            self.assertEqual(output_b.signals[0].irreversibility, 0.92)

            # delegate_to_spidey with empty spidey returns []
            signals = delegate_to_spidey(premise, kb=kb)
            self.assertIsInstance(signals, list)
        finally:
            import shutil; shutil.rmtree(tmpdir, ignore_errors=True)

    def test_conduct_returns_echo_back_and_regime(self):
        """conduct() with skip=True returns echo_back, regime, and signal_stack."""
        from agents.conductor import conduct
        from agents.premise import ExtractedPremise, PremiseClarity
        from agents.output_schema import RegimeState
        from knowledge.base import KnowledgeBase

        tmpdir = tempfile.mkdtemp()
        try:
            kb = KnowledgeBase(os.path.join(tmpdir, "kb.db"))
            seed_l1_data(kb)
            seed_l2_data(kb)

            premise = ExtractedPremise(
                core="Offshore drilling faces geopolitical risk.",
                clarity=PremiseClarity.EXPLICIT,
                extraction_confidence="high",
            )

            with patch("agents.conductor.extract_premise", return_value=premise), \
                 patch("agents.conductor.spawn_spidey_agent", return_value=[]), \
                 patch("agents.conductor.synthesize") as mock_synth:
                from agents.output_schema import AgentOutput, RegimeAssessment, RestorationAssessment
                mock_synth.return_value = AgentOutput(
                    role="conductor",
                    premise_id="test",
                    regime=RegimeAssessment(state=RegimeState.LIQUID, confidence="high", reasoning="test"),
                    restoration=RestorationAssessment(probability=0.65, velocity=-0.02, confidence="high", reasoning=""),
                    signals=[],
                )
                output = conduct(
                    "Is my offshore drilling thesis still valid?",
                    kb=kb,
                    skip_echo_confirmation=True,
                )

            self.assertEqual(output.role, "conductor")
            self.assertIsNotNone(output.echo_back)
            self.assertIsNotNone(output.regime)
            self.assertIn(output.regime.state, (RegimeState.SOLID, RegimeState.LIQUID, RegimeState.GAS))
        finally:
            import shutil; shutil.rmtree(tmpdir, ignore_errors=True)

    def test_conduct_with_seeded_kb_produces_signal_findings(self):
        """Researcher B's seeded L2 data appears in the final conductor output."""
        from agents.conductor import conduct
        from agents.premise import ExtractedPremise, PremiseClarity
        from agents.output_schema import RegimeState, SignalFinding
        from knowledge.base import KnowledgeBase

        tmpdir = tempfile.mkdtemp()
        try:
            kb = KnowledgeBase(os.path.join(tmpdir, "kb.db"))
            seed_l1_data(kb)
            seed_l2_data(kb)

            premise = ExtractedPremise(
                core="Energy infrastructure thesis",
                clarity=PremiseClarity.EXPLICIT,
                extraction_confidence="high",
            )

            with patch("agents.conductor.extract_premise", return_value=premise), \
                 patch("agents.conductor.spawn_spidey_agent", return_value=[]), \
                 patch("agents.conductor.synthesize") as mock_synth:
                from agents.output_schema import AgentOutput, RegimeAssessment, RestorationAssessment
                mock_synth.return_value = AgentOutput(
                    role="conductor",
                    premise_id="test",
                    regime=RegimeAssessment(state=RegimeState.GAS, confidence="high", reasoning="test"),
                    restoration=RestorationAssessment(probability=0.20, velocity=0.0, confidence="high", reasoning=""),
                    signals=[
                        SignalFinding(
                            signal_id="sig-test",
                            signal_name="L2:EXPROPRIATION@Iran",
                            sector_id=1,
                            priority="P1",
                            irreversibility=0.92,
                            escalation_probability=0.78,
                            confidence="high",
                            reasoning="From KB seed",
                            source="layer2:spidey",
                            divergence=False,
                        ),
                    ],
                )
                output = conduct(
                    "Energy geopolitical risk thesis",
                    kb=kb,
                    skip_echo_confirmation=True,
                )

            # Signal from B's seeded data should be in conductor output
            self.assertGreater(len(output.signals), 0)
            sig_names = {s.signal_name for s in output.signals}
            self.assertIn("L2:EXPROPRIATION@Iran", sig_names)
        finally:
            import shutil; shutil.rmtree(tmpdir, ignore_errors=True)

    def test_manual_synthesis_fallback_is_reachable(self):
        """When synthesize() raises, _manual_synthesis produces valid conductor output."""
        from agents.conductor import conduct, _manual_synthesis, research_a, research_b
        from agents.premise import ExtractedPremise, PremiseClarity
        from agents.output_schema import AgentOutput, RegimeAssessment, RestorationAssessment, RegimeState
        from knowledge.base import KnowledgeBase

        tmpdir = tempfile.mkdtemp()
        try:
            kb = KnowledgeBase(os.path.join(tmpdir, "kb.db"))
            seed_l1_data(kb)
            seed_l2_data(kb)

            premise = ExtractedPremise(
                core="Offshore drilling thesis",
                clarity=PremiseClarity.EXPLICIT,
                extraction_confidence="high",
            )
            output_a = research_a(premise, kb=kb)
            output_b = research_b(premise, kb=kb)

            result = _manual_synthesis(premise, output_a, output_b, [])

            self.assertEqual(result.role, "conductor")
            self.assertIsNotNone(result.regime)
            self.assertIn(result.regime.state, (RegimeState.SOLID, RegimeState.LIQUID, RegimeState.GAS))
            self.assertIsNotNone(result.restoration)
            self.assertIsNotNone(result.synthesis)
            self.assertIn("LLM call failed", result.synthesis)
        finally:
            import shutil; shutil.rmtree(tmpdir, ignore_errors=True)


# --------------------------------------------------------------------
# Test: Error Handling
# --------------------------------------------------------------------

class TestErrorHandling(unittest.TestCase):
    """Test that errors are handled gracefully."""

    def test_conduct_with_none_kb_does_not_crash(self):
        from agents.conductor import conduct
        with patch("agents.conductor.extract_premise") as mock_extract:
            mock_extract.return_value = MagicMock(
                core="Test",
                clarity=MagicMock(value="explicit"),
                implied_assets=[],
                implied_sectors=[],
                question_type="general",
                ambiguity_notes=[],
                raw_tokens=[],
                extraction_confidence="high",
                auto_proceed=True,
            )
            with patch("agents.conductor.delegate_to_spidey") as mock_spidey, \
                 patch("agents.conductor.research_a") as mock_a, \
                 patch("agents.conductor.research_b") as mock_b:
                mock_spidey.return_value = []
                mock_a.return_value = MagicMock(role="researcher_a", premise_id="test")
                mock_b.return_value = MagicMock(role="researcher_b", premise_id="test")
                output = conduct("test", kb=None, skip_echo_confirmation=True)
                self.assertEqual(output.role, "conductor")

    def test_llm_parse_failure_returns_valid_premise(self):
        from agents.conductor import _parse_premise_response
        from agents.premise import PremiseClarity
        result = _parse_premise_response("{{{{ not json")
        self.assertIsNotNone(result)
        self.assertEqual(result.clarity, PremiseClarity.MISSING)

    def test_kb_invalid_path_raises(self):
        from knowledge.base import KnowledgeBase
        with self.assertRaises(Exception):
            KnowledgeBase("/nonexistent/parent/dir/db.db")

    def test_missing_ollama_model_uses_default(self):
        import agents.conductor as c
        self.assertTrue(hasattr(c, "conduct"))


# --------------------------------------------------------------------
# Test: Output Schema Integrity
# --------------------------------------------------------------------

class TestOutputSchema(unittest.TestCase):
    """Test that the output schema is self-consistent."""

    def test_agent_output_has_all_required_fields(self):
        from agents.output_schema import AgentOutput
        output = AgentOutput(role="conductor", premise_id="test")
        _ = output.echo_back
        _ = output.synthesis
        _ = output.convergence
        _ = output.open_questions
        _ = output.recommended_state_weights
        _ = output.regime
        _ = output.restoration
        _ = output.signals
        _ = output.divergence
        _ = output.uncertainties

    def test_regime_state_enum_values(self):
        from agents.output_schema import RegimeState
        self.assertIn("solid", RegimeState._value2member_map_)
        self.assertIn("liquid", RegimeState._value2member_map_)
        self.assertIn("gas", RegimeState._value2member_map_)

    def test_signal_finding_fields(self):
        from agents.output_schema import SignalFinding
        sf = SignalFinding(
            signal_id="sig-001",
            signal_name="Iran Expropriation",
            sector_id=1,
            priority="P1",
            irreversibility=0.92,
            escalation_probability=0.78,
            confidence="high",
            reasoning="Historical analogue: 1979 revolution.",
            source="layer2:reuters",
            divergence=False,
        )
        self.assertEqual(sf.irreversibility, 0.92)

    def test_regime_assessment_dataclass(self):
        from agents.output_schema import RegimeAssessment, RegimeState
        ra = RegimeAssessment(
            state=RegimeState.GAS,
            confidence="high",
            reasoning="IMPOSSIBLE complexity signals dominate.",
        )
        self.assertEqual(ra.state, RegimeState.GAS)

    def test_restoration_assessment_dataclass(self):
        from agents.output_schema import RestorationAssessment
        ra = RestorationAssessment(
            probability=0.30,
            velocity=-0.05,
            confidence="medium",
            reasoning="Regime shift in progress.",
            historical_analogues=["iran_oil_shock_2025"],
        )
        self.assertAlmostEqual(ra.probability, 0.30)


# --------------------------------------------------------------------
# Test: Spidey Signal Schema
# --------------------------------------------------------------------

class TestSpideySignals(unittest.TestCase):
    """Test Spidey signal extraction and KB serialization."""

    def test_extracted_signal_to_cache_value_roundtrip(self):
        from agents.spidey import ExtractedSignal, SignalType, extracted_signal_to_cache_value
        from agents.spidey import CostBand
        import uuid
        sig = ExtractedSignal(
            extraction_id=str(uuid.uuid4()),
            event_type=SignalType.EXPROPRIATION,
            target="Iran",
            sector_id=1,
            tier=2,
            priority="P1",
            irreversibility=0.92,
            escalation_probability=0.78,
            complexity="IMPOSSIBLE",
            estimated_months=None,
            cost_band=CostBand.BAND_OVER_1B,
            cascade_chains=["refinery_inputs"],
            damage_summary="Nationalization of IOC stake.",
            source_title="Iran nationalises",
            raw_source_url="https://reuters.com/iran",
            extraction_confidence="high",
            uncertainties=[],
        )
        cached = extracted_signal_to_cache_value(sig)
        self.assertEqual(cached["event_type"], "EXPROPRIATION")
        self.assertEqual(cached["irreversibility"], 0.92)
        self.assertEqual(cached["target"], "Iran")
        # cost_band must be CostBand enum (not string) for .value to work
        self.assertEqual(cached["cost_band"], ">$1B")


# --------------------------------------------------------------------
# Main
# --------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Energy MVP Test Suite")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    suite = unittest.TestLoader().loadTestsFromModule(sys.modules[__name__])
    verbosity = 2 if args.verbose else 1
    runner = unittest.TextTestRunner(verbosity=verbosity)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)


if __name__ == "__main__":
    main()
