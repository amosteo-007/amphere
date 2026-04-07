"""Tests for Agent Spidey — serialization, signal types, and query building."""

import pytest

from augur.src.agents.spidey import (
    CostBand,
    ExtractedSignal,
    SignalType,
    SECTOR_QUERIES,
    extracted_signal_to_cache_value,
)


class TestExtractedSignal:
    def test_default_generates_uuid(self):
        sig = ExtractedSignal()
        assert sig.extraction_id is not None
        assert len(sig.extraction_id) > 0

    def test_default_timestamp(self):
        sig = ExtractedSignal()
        assert sig.extracted_at is not None

    def test_full_fields(self):
        sig = ExtractedSignal(
            sector_id=1,
            tier=2,
            priority="P1",
            irreversibility=0.92,
            escalation_probability=0.78,
            complexity="IMPOSSIBLE",
            event_type=SignalType.EXPROPRIATION,
            target="Iran",
            extraction_confidence="high",
            estimated_months=None,
            cost_band=CostBand.BAND_OVER_1B,
            cascade_chains=["refinery_inputs"],
            damage_summary="Nationalization of IOC stake",
            raw_source_url="https://reuters.com/article",
            source_title="Iran nationalises share",
            uncertainties=["political reversal only path"],
        )
        assert sig.event_type == SignalType.EXPROPRIATION
        assert sig.irreversibility == 0.92
        assert sig.target == "Iran"
        assert sig.cascade_chains == ["refinery_inputs"]


class TestSignalType:
    def test_all_energy_event_types_present(self):
        expected = [
            "SUPPLY_SHOCK",
            "REGULATORY",
            "EXPROPRIATION",
            "SANCTIONS",
            "MILITARY_ACTION",
            "INFRASTRUCTURE_DAMAGE",
            "REGIME_CHANGE",
            "TRADE_RESTRICTION",
            "EXPORT_BAN",
            "FORCE_MAJEURE",
            "PRODUCTION_CUT",
            "PRICE_CONTROL",
            "INSURANCE_WITHDRAWAL",
            "PIPELINE_SHUTDOWN",
            "DIPLOMATIC_BREAK",
            "TREATY_COLLAPSE",
            "REFINERY_OUTAGE",
        ]
        actual = [e.value for e in SignalType]
        for e in expected:
            assert e in actual


class TestCostBand:
    def test_all_cost_bands_present(self):
        expected = ["<$10M", "$10-50M", "$50-200M", "$100-500M", "$500M-1B", ">$1B"]
        actual = [c.value for c in CostBand]
        for e in expected:
            assert e in actual


class TestExtractedSignalToCacheValue:
    def test_round_trip(self):
        sig = ExtractedSignal(
            extraction_id="test-id-123",
            sector_id=1,
            tier=2,
            priority="P1",
            irreversibility=0.90,
            escalation_probability=0.85,
            complexity="HIGH",
            event_type=SignalType.PIPELINE_SHUTDOWN,
            target="Russia",
            extraction_confidence="high",
            estimated_months=24,
            cost_band=CostBand.BAND_OVER_1B,
            cascade_chains=["lng_shipping", "industrial_energy_cost"],
            damage_summary="Nord Stream flow reduced to zero",
            raw_source_url="https://bbc.com/article",
            source_title="Russia turns off gas",
            uncertainties=["political resolution unlikely"],
        )
        cached = extracted_signal_to_cache_value(sig)

        assert cached["extraction_id"] == "test-id-123"
        assert cached["sector_id"] == 1
        assert cached["event_type"] == "PIPELINE_SHUTDOWN"
        assert cached["target"] == "Russia"
        assert cached["irreversibility"] == 0.90
        assert cached["complexity"] == "HIGH"
        assert cached["cost_band"] == ">$1B"
        assert cached["cascade_chains"] == ["lng_shipping", "industrial_energy_cost"]
        assert cached["estimated_months"] == 24
        assert "Nord Stream" in cached["damage_summary"]
        assert "bbc.com" in cached["raw_source_url"]

    def test_null_event_type_serializes_to_none(self):
        sig = ExtractedSignal(extraction_id="null-event-test")
        cached = extracted_signal_to_cache_value(sig)
        assert cached["event_type"] is None

    def test_null_cost_band_serializes_to_none(self):
        sig = ExtractedSignal(extraction_id="null-cost-test")
        cached = extracted_signal_to_cache_value(sig)
        assert cached["cost_band"] is None


class TestSectorQueries:
    def test_energy_sector_has_queries(self):
        assert 1 in SECTOR_QUERIES
        assert len(SECTOR_QUERIES[1]) > 0

    def test_energy_queries_cover_key_topics(self):
        queries_text = " ".join(SECTOR_QUERIES[1]).lower()
        assert "energy" in queries_text or "oil" in queries_text or "gas" in queries_text
        assert "sanctions" in queries_text or "expropriation" in queries_text
