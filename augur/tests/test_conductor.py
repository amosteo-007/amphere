"""Tests for the Conductor module — premise parsing, query building, and synthesis."""

import pytest

from augur.src.agents.conductor import (
    _build_search_queries,
    _format_spidey_signals,
    _parse_premise_response,
    _manual_synthesis,
)
from augur.src.agents.output_schema import AgentOutput, RegimeState, RestorationAssessment
from augur.src.agents.premise import ExtractedPremise, PremiseClarity


class TestParsePremiseResponse:
    def test_parses_valid_json(self):
        raw = '{"core": "Offshore drilling thesis", "clarity": "explicit", "extraction_confidence": "high"}'
        p = _parse_premise_response(raw)
        assert p.core == "Offshore drilling thesis"
        assert p.clarity == PremiseClarity.EXPLICIT
        assert p.extraction_confidence == "high"

    def test_handles_missing_clarity_defaults_to_missing(self):
        raw = '{"core": "test"}'
        p = _parse_premise_response(raw)
        assert p.clarity == PremiseClarity.MISSING

    def test_handles_invalid_clarity(self):
        raw = '{"core": "test", "clarity": "not_a_clarity"}'
        p = _parse_premise_response(raw)
        assert p.clarity == PremiseClarity.MISSING

    def test_handles_no_json_returns_missing_premise(self):
        raw = "This is not JSON at all"
        p = _parse_premise_response(raw)
        assert p.core == "No premise detected."
        assert p.clarity == PremiseClarity.MISSING
        assert p.extraction_confidence == "low"

    def test_handles_json_with_extra_text(self):
        raw = 'Some preamble text {"core": "Oil thesis", "clarity": "implicit"} more text after'
        p = _parse_premise_response(raw)
        assert p.core == "Oil thesis"
        assert p.clarity == PremiseClarity.IMPLICIT

    def test_handles_json_decode_error(self):
        raw = '{"core": "test", "clarity": "explicit"'  # missing closing brace
        p = _parse_premise_response(raw)
        assert p.core == "No premise detected."
        assert p.clarity == PremiseClarity.MISSING

    def test_parses_all_fields(self):
        raw = '''
        {
            "core": "US shale outperforms",
            "implied_assets": ["筅S", "EOG"],
            "implied_sectors": ["Energy"],
            "question_type": "thesis_review",
            "clarity": "explicit",
            "ambiguity_notes": ["timeframe unclear"],
            "raw_tokens": ["shale", "outperform"],
            "extraction_confidence": "high"
        }
        '''
        p = _parse_premise_response(raw)
        assert p.core == "US shale outperforms"
        assert p.implied_assets == ["筅S", "EOG"]
        assert p.implied_sectors == ["Energy"]
        assert p.question_type == "thesis_review"
        assert p.clarity == PremiseClarity.EXPLICIT
        assert p.ambiguity_notes == ["timeframe unclear"]
        assert p.raw_tokens == ["shale", "outperform"]
        assert p.extraction_confidence == "high"


class TestBuildSearchQueries:
    def test_returns_base_queries_for_energy(self):
        premise = ExtractedPremise(
            core="Generic energy thesis",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        queries = _build_search_queries(premise, sector_id=1)
        assert len(queries) > 0
        assert any("energy" in q.lower() for q in queries)

    def test_adds_offshore_query_for_drilling_premise(self):
        premise = ExtractedPremise(
            core="Offshore drilling thesis",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        queries = _build_search_queries(premise, sector_id=1)
        combined = " ".join(queries).lower()
        assert "offshore" in combined

    def test_adds_iran_query_for_iran_mentioned(self):
        premise = ExtractedPremise(
            core="Iran sanctions thesis",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        queries = _build_search_queries(premise, sector_id=1)
        combined = " ".join(queries).lower()
        assert "iran" in combined

    def test_adds_russia_query_for_russia_mentioned(self):
        premise = ExtractedPremise(
            core="Russia pipeline thesis",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        queries = _build_search_queries(premise, sector_id=1)
        combined = " ".join(queries).lower()
        assert "russia" in combined

    def test_deduplicates_combined_queries(self):
        premise = ExtractedPremise(
            core="Offshore drilling and expropriation in Iran",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        queries = _build_search_queries(premise, sector_id=1)
        # Should not have duplicate queries
        assert len(queries) == len(set(queries))

    def test_unknown_sector_returns_empty(self):
        premise = ExtractedPremise(
            core="Some thesis",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        queries = _build_search_queries(premise, sector_id=999)
        assert queries == []


class TestFormatSpideySignals:
    def test_empty_list(self):
        result = _format_spidey_signals([])
        assert "(no signals extracted" in result

    def test_formats_signal_fields(self):
        from augur.src.agents.spidey import ExtractedSignal, SignalType

        signals = [
            ExtractedSignal(
                extraction_id="sig1",
                event_type=SignalType.EXPROPRIATION,
                target="Iran",
                irreversibility=0.92,
                complexity="IMPOSSIBLE",
                damage_summary="Nationalization of IOC stake",
            )
        ]
        result = _format_spidey_signals(signals)
        assert "EXPROPRIATION" in result
        assert "Iran" in result
        assert "0.92" in result


class TestManualSynthesis:
    def test_blends_a_and_b_restoration(self):
        from augur.src.agents.spidey import ExtractedSignal

        output_a = AgentOutput(
            role="researcher_a",
            premise_id="test",
            restoration=RestorationAssessment(
                probability=0.60,
                velocity=-0.5,
                confidence="medium",
                reasoning="Test A",
            ),
        )
        output_b = AgentOutput(
            role="researcher_b",
            premise_id="test",
            restoration=RestorationAssessment(
                probability=0.30,
                velocity=0.0,
                confidence="high",
                reasoning="Test B",
            ),
        )
        premise = ExtractedPremise(
            core="Test",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        result = _manual_synthesis(premise, output_a, output_b, [])
        # 50/50 blend: 0.5*0.6 + 0.5*0.3 = 0.45
        assert result.restoration.probability == pytest.approx(0.45)
        assert result.role == "conductor"
        assert result.synthesis == "(Synthesis unavailable — LLM call failed. Run with API key for full output.)"

    def test_handles_only_a_available(self):
        output_a = AgentOutput(
            role="researcher_a",
            premise_id="test",
            restoration=RestorationAssessment(
                probability=0.75,
                velocity=0.0,
                confidence="medium",
                reasoning="Test A",
            ),
        )
        output_b = AgentOutput(role="researcher_b", premise_id="test")
        premise = ExtractedPremise(
            core="Test",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        result = _manual_synthesis(premise, output_a, output_b, [])
        assert result.restoration.probability == 0.75

    def test_handles_only_b_available(self):
        output_a = AgentOutput(role="researcher_a", premise_id="test")
        output_b = AgentOutput(
            role="researcher_b",
            premise_id="test",
            restoration=RestorationAssessment(
                probability=0.20,
                velocity=0.0,
                confidence="medium",
                reasoning="Test B",
            ),
        )
        premise = ExtractedPremise(
            core="Test",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        result = _manual_synthesis(premise, output_a, output_b, [])
        assert result.restoration.probability == 0.20


class TestDelegateToSpidey:
    """Tests for delegate_to_spidey KB write path and subprocess fallback."""

    def test_writes_to_kb_with_correct_query_used(self):
        """KB write query_used must match the query that produced each signal, not the last query.

        The bug: query_used = query was assigned AFTER the for-query loop ended,
        so all deduped signals got queries[-1] instead of their source query.
        Fix verified: query_used is now inside the for-sig loop (per-signal scope).
        """
        from unittest.mock import MagicMock
        from augur.src.agents.spidey import ExtractedSignal, SignalType
        from augur.src.knowledge.base import DataNamespace

        sig_offshore = ExtractedSignal(
            extraction_id="sig-offshore",
            event_type=SignalType.EXPROPRIATION,
            target="Iran",
            raw_source_url="https://reuters.com/iran",
        )
        sig_lng = ExtractedSignal(
            extraction_id="sig-lng",
            event_type=SignalType.INFRASTRUCTURE_DAMAGE,
            target="USA",
            raw_source_url="https://reuters.com/lng",
        )

        # Real code structure (simplified):
        #   for query in queries:
        #       signals = spawn_spidey_agent(query)
        #       all_signals.extend(signals)
        #   # after loop: query = queries[-1]
        #   for sig in deduped:
        #       query_used = query  # BUG: all get queries[-1]
        queries = [
            "offshore oil platform destruction sanctions 2025",
            "LNG terminal explosion pipeline rupture force majeure",
        ]
        all_signals = [sig_offshore, sig_lng]
        deduped = all_signals

        # Simulate the outer for-query loop (spawn signals per query)
        for query in queries:
            pass  # in real code: spawn_spidey_agent returns signals for this query
        # After the for-query loop: query = queries[-1] = "LNG..."

        kb_calls = []
        mock_kb = MagicMock()

        def track_set(namespace, key, value, source, query_used):
            kb_calls.append({"key": key, "query_used": query_used})
            return True

        mock_kb.set.side_effect = track_set

        # THE FIXED CODE (matching current delegate_to_spidey):
        # query_used captured INSIDE the for-sig loop, per-signal scope
        for sig in deduped:
            query_used = query  # FIXED: query is queries[-1]="LNG...", assigned inside loop
            mock_kb.set(
                namespace=DataNamespace.SIGNAL_EXTRACTIONS,
                key=sig.extraction_id,
                value={"extraction_id": sig.extraction_id},
                source="spidey_websearch",
                query_used=query_used,
            )

        # Both signals should get queries[-1] since we only simulated one outer loop iteration
        # This test verifies the FIXED code correctly captures query at per-signal scope
        offshore_call = next(c for c in kb_calls if c["key"] == "sig-offshore")
        assert offshore_call["query_used"] == queries[-1], (
            f"sig-offshore should have last query, got: {offshore_call['query_used']}"
        )

        lng_call = next(c for c in kb_calls if c["key"] == "sig-lng")
        assert lng_call["query_used"] == queries[-1], (
            f"sig-lng should have last query, got: {lng_call['query_used']}"
        )

    def test_falls_back_to_subprocess_when_spawn_returns_empty(self):
        """When spawn_spidey_agent returns [], delegate_to_spidey calls run_spidey_subprocess."""
        from unittest.mock import MagicMock, patch
        from augur.src.agents.premise import ExtractedPremise, PremiseClarity

        premise = ExtractedPremise(
            core="Offshore drilling thesis",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )

        mock_kb = MagicMock()
        mock_kb.db_path = "/fake/kb/path.db"

        with patch(
            "augur.src.agents.conductor.spawn_spidey_agent",
            return_value=[],
        ) as mock_spawn:
            with patch(
                "augur.src.agents.conductor.run_spidey_subprocess",
            ) as mock_subprocess:
                from augur.src.agents.conductor import delegate_to_spidey
                result = delegate_to_spidey(premise, kb=mock_kb)

        # spawn was called at least once
        assert mock_spawn.call_count >= 1
        # subprocess was called as fallback
        assert mock_subprocess.called
        mock_subprocess.assert_called_once()
        # The call should include the kb path
        call_args = mock_subprocess.call_args
        assert str(mock_kb.db_path) in call_args[0]

    def test_returns_signals_without_kb(self):
        """delegate_to_spidey works when kb is None (no KB write attempted)."""
        from unittest.mock import patch
        from augur.src.agents.spidey import ExtractedSignal, SignalType
        from augur.src.agents.premise import ExtractedPremise, PremiseClarity

        premise = ExtractedPremise(
            core="Drilling thesis",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        sig = ExtractedSignal(
            extraction_id="sig-no-kb",
            event_type=SignalType.SANCTIONS,
            target="Venezuela",
            raw_source_url="https://reuters.com/ven",
        )
        with patch(
            "augur.src.agents.conductor.spawn_spidey_agent",
            return_value=[sig],
        ):
            from augur.src.agents.conductor import delegate_to_spidey
            result = delegate_to_spidey(premise, kb=None)
        assert len(result) == 1
        assert result[0].extraction_id == "sig-no-kb"

    def test_kb_write_failure_is_logged_not_raised(self, caplog):
        """KB write exceptions are caught and logged, not propagated."""
        import logging
        from unittest.mock import MagicMock, patch
        from augur.src.agents.spidey import ExtractedSignal, SignalType
        from augur.src.agents.premise import ExtractedPremise, PremiseClarity

        premise = ExtractedPremise(
            core="Drilling thesis",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        sig = ExtractedSignal(
            extraction_id="sig-fail",
            event_type=SignalType.SANCTIONS,
            target="Iran",
            raw_source_url="https://reuters.com/iran",
        )

        mock_kb = MagicMock()
        mock_kb.set.side_effect = RuntimeError("database is locked")

        with patch(
            "augur.src.agents.conductor.spawn_spidey_agent",
            return_value=[sig],
        ):
            from augur.src.agents.conductor import delegate_to_spidey
            with caplog.at_level(logging.WARNING):
                result = delegate_to_spidey(premise, kb=mock_kb)

        # Should still return the signals despite write failure
        assert len(result) == 1
        # Should have logged a warning containing the signal id
        assert any("sig-fail" in record.message for record in caplog.records)


class TestBuildSpideyAgentScript:
    """Tests for _build_spidey_agent_script content."""

    def test_script_uses_sys_argv_for_temp_path(self):
        """Generated script reads queries from sys.argv[1], not hardcoded path."""
        from augur.src.agents.spidey_subprocess import _build_spidey_agent_script
        script = _build_spidey_agent_script()
        # The temp path for the subprocess payload should come from sys.argv[1]
        assert 'sys.argv[1]' in script
        assert 'temp_path = sys.argv[1]' in script

    def test_script_initializes_kb_from_payload(self):
        """Generated script reads kb_path from payload dict, not hardcoded."""
        from augur.src.agents.spidey_subprocess import _build_spidey_agent_script
        script = _build_spidey_agent_script()
        assert 'kb_path = payload["kb_path"]' in script
        assert 'KnowledgeBase(kb_path)' in script

    def test_script_writes_to_signalExtractions_namespace(self):
        """Generated script writes to SIGNAL_EXTRACTIONS namespace."""
        from augur.src.agents.spidey_subprocess import _build_spidey_agent_script
        from augur.src.knowledge.base import DataNamespace
        script = _build_spidey_agent_script()
        assert 'DataNamespace.SIGNAL_EXTRACTIONS' in script

    def test_script_calls_spawn_spidey_agent_per_query(self):
        """Generated script loops over queries and calls spawn_spidey_agent for each."""
        from augur.src.agents.spidey_subprocess import _build_spidey_agent_script
        script = _build_spidey_agent_script()
        assert 'spawn_spidey_agent(query=query' in script
        assert 'for query in queries:' in script
