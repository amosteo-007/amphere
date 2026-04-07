"""Tests for Layer 1 sigma calculations."""

import statistics
from augur.src.signals.ingestion.layer1 import (
    Indicator,
    SigmaReading,
    CompositeScore,
    ReferencePoint,
    Layer1State,
    AlertLevel,
    prior_from_alert,
)


class TestSigmaReading:
    def test_zscore_positive(self):
        r = SigmaReading(
            indicator=Indicator.VIX,
            current=30.0,
            short_mean=20.0,
            short_std=2.0,
            long_mean=18.0,
            long_std=3.0,
        )
        assert r.short_zscore == 5.0  # (30-20)/2
        assert r.long_zscore == 4.0   # (30-18)/3

    def test_zscore_negative(self):
        r = SigmaReading(
            indicator=Indicator.VIX,
            current=10.0,
            short_mean=20.0,
            short_std=2.0,
            long_mean=18.0,
            long_std=3.0,
        )
        assert r.short_zscore == -5.0
        assert abs(r.long_zscore - (-8.0 / 3.0)) < 1e-9  # (10-18)/3 = -8/3

    def test_zero_std_no_division_error(self):
        r = SigmaReading(
            indicator=Indicator.VIX,
            current=30.0,
            short_mean=20.0,
            short_std=0.0,
            long_mean=18.0,
            long_std=0.0,
        )
        assert r.short_zscore == 0.0
        assert r.long_zscore == 0.0

    def test_short_sigma_breach_above_threshold(self):
        # VIX short_sigma_threshold = 6.0. z=5.5 → below threshold → None
        r = SigmaReading(
            indicator=Indicator.VIX,
            current=31.0,
            short_mean=20.0,
            short_std=2.0,
            long_mean=18.0,
            long_std=3.0,
        )
        assert r.short_sigma_breach is None  # |5.5| < 6.0

        r2 = SigmaReading(
            indicator=Indicator.VIX,
            current=33.0,
            short_mean=20.0,
            short_std=2.0,
            long_mean=18.0,
            long_std=3.0,
        )
        assert r2.short_sigma_breach == 6.5  # |6.5| > 6.0

    def test_long_sigma_breach(self):
        # VIX long_sigma_threshold = 4.0
        r = SigmaReading(
            indicator=Indicator.VIX,
            current=30.0,
            short_mean=20.0,
            short_std=2.0,
            long_mean=18.0,
            long_std=3.0,
        )
        assert r.long_sigma_breach == 4.0  # |4.0| > 4.0 (strict)


class TestCompositeScore:
    def test_composite_quiet(self):
        readings = [
            SigmaReading(Indicator.VIX,            current=20.5, short_mean=20.0, short_std=2.0, long_mean=18.0, long_std=3.0),
            SigmaReading(Indicator.CREDIT_SPREADS,  current=75.5, short_mean=75.0, short_std=2.0, long_mean=72.0, long_std=4.0),
            SigmaReading(Indicator.DXY,            current=104.2, short_mean=104.0, short_std=0.5, long_mean=103.0, long_std=1.0),
            SigmaReading(Indicator.OIL,            current=78.2, short_mean=78.0, short_std=0.5, long_mean=77.0, long_std=2.0),
            SigmaReading(Indicator.YIELD_10Y,      current=4.52, short_mean=4.50, short_std=0.05, long_mean=4.20, long_std=0.30),
            SigmaReading(Indicator.GOLD,           current=2020.0, short_mean=2019.0, short_std=5.0, long_mean=2000.0, long_std=50.0),
        ]
        cs = CompositeScore.compute(readings)
        assert cs.alert_level == AlertLevel.QUIET
        assert abs(cs.score) < 5.0

    def test_composite_regime_shift(self):
        # VIX spikes hard — current=44, mean=20, std=2 → z=12
        # Credit spreads also wide — current=87, mean=72, std=3 → z=5
        # Composite: 12×0.25 + 5×0.25 + others near 0 = 4.25 → below 5
        # Need multiple large z-scores to push composite > 5
        # VIX z=12 (contrib 3.0) + CREDIT z=10 (contrib 2.5) + OIL z=6 (contrib 0.9) = 6.4
        readings = [
            SigmaReading(Indicator.VIX,            current=44.0, short_mean=20.0, short_std=2.0, long_mean=18.0, long_std=3.0),
            SigmaReading(Indicator.CREDIT_SPREADS,  current=87.0, short_mean=72.0, short_std=1.5, long_mean=70.0, long_std=2.0),
            SigmaReading(Indicator.OIL,            current=84.0, short_mean=77.0, short_std=1.0, long_mean=75.0, long_std=2.0),
            SigmaReading(Indicator.DXY,            current=104.0, short_mean=104.0, short_std=0.5, long_mean=103.0, long_std=1.0),
            SigmaReading(Indicator.YIELD_10Y,      current=4.50, short_mean=4.50, short_std=0.05, long_mean=4.20, long_std=0.30),
            SigmaReading(Indicator.GOLD,           current=2019.0, short_mean=2019.0, short_std=5.0, long_mean=2000.0, long_std=50.0),
        ]
        cs = CompositeScore.compute(readings)
        # VIX z=12, contrib=3.0; CREDIT z=10, contrib=2.5; OIL z=7, contrib=1.05 → total≈6.55
        assert cs.alert_level == AlertLevel.REGIME_SHIFT, f"Got {cs.score}, {cs.alert_level}"
        assert cs.score > 5.0

    def test_weights_sum_to_one(self):
        total = sum(i.composite_weight for i in Indicator)
        assert abs(total - 1.0) < 0.001


class TestReferencePoint:
    def test_reference_updates_and_tracks(self):
        rp = ReferencePoint()
        prices = {
            Indicator.VIX: 20.0,
            Indicator.CREDIT_SPREADS: 75.0,
        }
        rp.update(prices)
        assert rp.indicator_values_14d[Indicator.VIX] == [20.0]
        assert rp.baseline_prices[Indicator.VIX] == 20.0

    def test_reference_14d_window_limit(self):
        rp = ReferencePoint()
        for i in range(20):
            rp.update({Indicator.VIX: float(20 + i)})
        # Should keep only last 14
        assert len(rp.indicator_values_14d[Indicator.VIX]) == 14

    def test_should_not_refresh_under_14_days(self):
        rp = ReferencePoint()
        assert not rp.should_refresh


class TestPriorFromAlert:
    def test_prior_values_ordered(self):
        assert prior_from_alert(AlertLevel.QUIET) == 0.98
        assert prior_from_alert(AlertLevel.INVESTIGATE) == 0.85
        assert prior_from_alert(AlertLevel.MAJOR_SHOCK) == 0.60
        assert prior_from_alert(AlertLevel.REGIME_SHIFT) == 0.30

    def test_priors_decrease_with_alert(self):
        priors = [prior_from_alert(a) for a in AlertLevel]
        for i in range(len(priors) - 1):
            assert priors[i] > priors[i + 1]
