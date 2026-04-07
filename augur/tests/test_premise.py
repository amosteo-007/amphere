"""Tests for premise extraction and echo-back formatting."""

import pytest

from augur.src.agents.premise import (
    ExtractedPremise,
    PremiseClarity,
    EchoBack,
    format_echo_back,
)


class TestExtractedPremise:
    def test_defaults(self):
        p = ExtractedPremise(core="Test thesis")
        assert p.core == "Test thesis"
        assert p.clarity == PremiseClarity.EXPLICIT
        assert p.implied_assets == []
        assert p.implied_sectors == []
        assert p.question_type == "general"
        assert p.extraction_confidence == "medium"

    def test_full_fields(self):
        p = ExtractedPremise(
            core="US shale outperforms for 3 years",
            implied_assets=["筅S", "EOG"],
            implied_sectors=["Energy"],
            question_type="thesis_review",
            clarity=PremiseClarity.IMPLICIT,
            ambiguity_notes=["What timeframe exactly?"],
            raw_tokens=["shale", "outperform"],
            extraction_confidence="high",
        )
        assert p.core == "US shale outperforms for 3 years"
        assert p.implied_assets == ["筅S", "EOG"]
        assert p.implied_sectors == ["Energy"]
        assert p.question_type == "thesis_review"
        assert p.clarity == PremiseClarity.IMPLICIT
        assert "What timeframe exactly?" in p.ambiguity_notes


class TestFormatEchoBack:
    def test_explicit_high_confidence_auto_proceed(self):
        p = ExtractedPremise(
            core="Offshore drilling thesis",
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        echo = format_echo_back(p)
        assert echo.auto_proceed is True
        assert "Offshore drilling thesis" in echo.echo_text

    def test_implicit_generates_clarification_question(self):
        p = ExtractedPremise(
            core="Energy exposure is worrying",
            clarity=PremiseClarity.IMPLICIT,
            extraction_confidence="medium",
        )
        echo = format_echo_back(p)
        assert echo.auto_proceed is False
        assert len(echo.clarification_questions) > 0
        assert "more directly" in echo.clarification_questions[0]

    def test_vague_generates_clarification_question(self):
        p = ExtractedPremise(
            core="Is everything okay?",
            clarity=PremiseClarity.VAGUE,
            extraction_confidence="low",
        )
        echo = format_echo_back(p)
        assert echo.auto_proceed is False
        assert len(echo.clarification_questions) > 0

    def test_missing_generates_clarification_question(self):
        p = ExtractedPremise(
            core="No premise detected.",
            clarity=PremiseClarity.MISSING,
            extraction_confidence="low",
        )
        echo = format_echo_back(p)
        assert echo.auto_proceed is False

    def test_echo_back_includes_sectors(self):
        p = ExtractedPremise(
            core="Energy sector thesis",
            implied_sectors=["Energy", "Financials"],
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        echo = format_echo_back(p)
        assert "Energy" in echo.echo_text
        assert "Financials" in echo.echo_text

    def test_echo_back_includes_assets(self):
        p = ExtractedPremise(
            core="Oil majors thesis",
            implied_assets=["XOM", "CVX"],
            clarity=PremiseClarity.EXPLICIT,
            extraction_confidence="high",
        )
        echo = format_echo_back(p)
        assert "XOM" in echo.echo_text
        assert "CVX" in echo.echo_text
