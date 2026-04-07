"""Tests for the KnowledgeBase cache."""

import tempfile
import time
from datetime import datetime, timedelta, timezone

import pytest

from augur.src.knowledge.base import (
    CacheEntry,
    DataNamespace,
    KnowledgeBase,
    TTL,
)


@pytest.fixture
def kb(tmp_path):
    """Provide a fresh KB backed by a temp file."""
    db = tmp_path / "test_kb.db"
    return KnowledgeBase(str(db))


class TestCacheEntry:
    def test_is_fresh_true(self):
        entry = CacheEntry(
            namespace=DataNamespace.MARKET_INDICATORS,
            key="vix_latest",
            value={"vix": 20.0},
            fetched_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            source="test",
        )
        assert entry.is_fresh is True

    def test_is_fresh_false(self):
        entry = CacheEntry(
            namespace=DataNamespace.MARKET_INDICATORS,
            key="vix_latest",
            value={"vix": 20.0},
            fetched_at=datetime.now(timezone.utc) - timedelta(minutes=10),
            expires_at=datetime.now(timezone.utc) - timedelta(minutes=5),
            source="test",
        )
        assert entry.is_fresh is False

    def test_age_minutes(self):
        past = datetime.now(timezone.utc) - timedelta(minutes=7, seconds=30)
        entry = CacheEntry(
            namespace=DataNamespace.MARKET_INDICATORS,
            key="test",
            value={},
            fetched_at=past,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            source="test",
        )
        assert 7.0 <= entry.age_minutes <= 8.0


class TestKnowledgeBaseSetAndGet:
    def test_set_and_get_round_trip(self, kb):
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key="iran_shock_2025",
            value={"event_type": "EXPROPRIATION", "irreversibility": 0.92},
            source="manual_seed",
        )
        entry = kb.get(DataNamespace.SIGNAL_EXTRACTIONS, "iran_shock_2025")
        assert entry is not None
        assert entry.value["event_type"] == "EXPROPRIATION"
        assert entry.value["irreversibility"] == 0.92
        assert entry.source == "manual_seed"

    def test_get_nonexistent_returns_none(self, kb):
        entry = kb.get(DataNamespace.MARKET_INDICATORS, "does_not_exist")
        assert entry is None

    def test_set_overwrites_existing(self, kb):
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key="russia_gas",
            value={"flow": 100},
            source="first",
        )
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key="russia_gas",
            value={"flow": 0},
            source="second",
        )
        entry = kb.get(DataNamespace.SIGNAL_EXTRACTIONS, "russia_gas")
        assert entry.value["flow"] == 0
        assert entry.source == "second"

    def test_set_with_custom_ttl(self, kb):
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key="short_lived",
            value={"test": True},
            source="test",
            ttl=timedelta(seconds=1),
        )
        entry = kb.get(DataNamespace.SIGNAL_EXTRACTIONS, "short_lived")
        assert entry is not None
        # Wait for expiry
        time.sleep(1.1)
        entry_after = kb.get(DataNamespace.SIGNAL_EXTRACTIONS, "short_lived")
        # is_fresh should be False but get() still returns the stale entry
        assert entry_after is not None
        assert entry_after.is_fresh is False

    def test_get_fresh_returns_none_for_stale(self, kb):
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key="staleness_test",
            value={"test": True},
            source="test",
            ttl=timedelta(seconds=1),
        )
        entry = kb.get_fresh(DataNamespace.SIGNAL_EXTRACTIONS, "staleness_test")
        assert entry is not None
        time.sleep(1.1)
        entry_stale = kb.get_fresh(DataNamespace.SIGNAL_EXTRACTIONS, "staleness_test")
        assert entry_stale is None

    def test_set_query_used_is_stored(self, kb):
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key="query_test",
            value={"q": "test query"},
            source="spidey",
            query_used="energy infrastructure destruction 2025",
        )
        entry = kb.get(DataNamespace.SIGNAL_EXTRACTIONS, "query_test")
        assert entry.query_used == "energy infrastructure destruction 2025"

    def test_namespaces_are_independent(self, kb):
        kb.set(
            namespace=DataNamespace.MARKET_INDICATORS,
            key="shared_key",
            value={"from": "market_indicators"},
            source="test",
        )
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key="shared_key",
            value={"from": "signal_extractions"},
            source="test",
        )
        mkt = kb.get(DataNamespace.MARKET_INDICATORS, "shared_key")
        sig = kb.get(DataNamespace.SIGNAL_EXTRACTIONS, "shared_key")
        assert mkt.value["from"] == "market_indicators"
        assert sig.value["from"] == "signal_extractions"


class TestExpire:
    def test_expire_all_removes_stale(self, kb):
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key="stale_entry",
            value={"test": True},
            source="test",
            ttl=timedelta(seconds=1),
        )
        time.sleep(1.1)
        kb.expire()
        entry = kb.get(DataNamespace.SIGNAL_EXTRACTIONS, "stale_entry")
        assert entry is None

    def test_expire_all_keeps_fresh(self, kb):
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key="fresh_entry",
            value={"test": True},
            source="test",
            ttl=timedelta(hours=1),
        )
        kb.expire()
        entry = kb.get(DataNamespace.SIGNAL_EXTRACTIONS, "fresh_entry")
        assert entry is not None

    def test_expire_namespace_only(self, kb):
        kb.set(
            namespace=DataNamespace.MARKET_INDICATORS,
            key="stale_mkt",
            value={"test": True},
            source="test",
            ttl=timedelta(seconds=1),
        )
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key="stale_sig",
            value={"test": True},
            source="test",
            ttl=timedelta(seconds=1),
        )
        time.sleep(1.1)
        kb.expire(namespace=DataNamespace.MARKET_INDICATORS)
        mkt = kb.get(DataNamespace.MARKET_INDICATORS, "stale_mkt")
        sig = kb.get(DataNamespace.SIGNAL_EXTRACTIONS, "stale_sig")
        assert mkt is None
        assert sig is not None  # sig namespace was not expired


class TestStats:
    def test_stats_counts_fresh_and_stale(self, kb):
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key="fresh_sig",
            value={"test": True},
            source="test",
            ttl=timedelta(hours=1),
        )
        kb.set(
            namespace=DataNamespace.SIGNAL_EXTRACTIONS,
            key="stale_sig",
            value={"test": True},
            source="test",
            ttl=timedelta(seconds=1),
        )
        time.sleep(1.1)
        stats = kb.stats()
        sig_stats = stats.get(DataNamespace.SIGNAL_EXTRACTIONS.value, {})
        assert sig_stats.get("fresh", 0) == 1
        assert sig_stats.get("stale", 0) == 1


class TestMakeKey:
    def test_make_key_deterministic(self):
        k1 = KnowledgeBase.make_key("energy", "offshore", "drilling")
        k2 = KnowledgeBase.make_key("energy", "offshore", "drilling")
        assert k1 == k2
        assert len(k1) == 16  # sha1 truncated to 16 hex chars

    def test_make_key_different_inputs_different_keys(self):
        k1 = KnowledgeBase.make_key("energy", "offshore")
        k2 = KnowledgeBase.make_key("energy", "onshore")
        assert k1 != k2

    def test_sector_key_format(self):
        key = KnowledgeBase.sector_key(1, "signals")
        assert key == "sector_1_signals"

    def test_premise_key_format(self):
        key = KnowledgeBase.premise_key("abc123", "signals")
        assert key == "abc123_signals"


class TestTTL:
    def test_ttl_values_exist_for_all_namespaces(self):
        for ns in DataNamespace:
            assert ns in TTL
            assert TTL[ns] > timedelta(0)
