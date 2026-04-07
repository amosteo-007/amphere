"""Smoke test — verify all modules import without error."""
import augur.src.taxonomy.models as models
import augur.src.state.solid_liquid_gas as slg
import augur.src.layers.restoration as restoration
import augur.src.telemetry.classifier as classifier
import augur.src.outputs.restoration_trend as restoration_trend
import augur.src.outputs.signal_stack as signal_stack
import augur.src.outputs.next_state as next_state
import augur.src.signals.ingestion.layer1 as layer1
import augur.src.signals.ingestion.layer2 as layer2


def test_tiers():
    assert len(models.TIERS) == 5
    assert models.TIERS[1].avg_irreversibility == 0.85
    assert models.TIERS[5].avg_irreversibility == 0.15


def test_sectors():
    assert len(models.Sector) == 11
    assert models.Sector.ENERGY.sector_id == 1
    assert models.Sector.INFORMATION_TECHNOLOGY.sector_id == 8


def test_regime_weights():
    assert slg.current_weights(slg.RegimeState.SOLID).researcher_a == 0.70
    assert slg.current_weights(slg.RegimeState.GAS).researcher_b == 0.70


def test_complexity_irreversibility():
    assert restoration.compute_irreversibility(restoration.Complexity.LOW) == 0.20
    assert restoration.compute_irreversibility(restoration.Complexity.IMPOSSIBLE) == 1.00


def test_telemetry_coordinate():
    coord = classifier.classify(0.85, 0.60)
    assert coord.x == 0.85
    assert coord.y == 0.60


def test_layer1_indicators():
    assert len(layer1.Indicator) == 6
    # Verify each expected indicator is present
    assert layer1.Indicator.VIX in list(layer1.Indicator)
    assert layer1.Indicator.CREDIT_SPREADS in list(layer1.Indicator)
    assert layer1.Indicator.OIL in list(layer1.Indicator)
