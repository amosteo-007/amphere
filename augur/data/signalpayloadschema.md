# SignalPayload Schema

The canonical event object produced by Layer 1 (market sigma breach) and Layer 2 (Agent Spidey web search + LLM extraction). Flows into the KB under the appropriate namespace.

---

## Base Fields (all SignalPayloads)

```yaml
payload_id: uuid
created_at: datetime
source_layer: L1 | L2

# Hierarchical classification (KB index keys)
sector_id: int        # 1-11 GICS sector
tier: int             # 1-5 irreversibility band
priority: P0-P5       # signal priority
restoration_layer: LOW | MEDIUM | HIGH | EXTREME | IMPOSSIBLE | null

# 2D telemetry (shared by both researchers)
coordinate_2d:
  x: float  # irreversibility, 0-1
  y: float  # escalation probability, 0-1

# KB references
kb_analogues: [scenario_id, ...]   # historical matches from KB
```

---

## L1-specific Fields (null if L2)

```yaml
l1:
  indicator: VIX | CREDIT_SPREADS | DXY | OIL | GOLD | YIELD_10Y | CUSTOM
  sigma_magnitude: float      # actual z-score at breach
  breach_direction: UP | DOWN # VIX UP = fear; DOWN = complacency
  baseline_window_days: int   # lookback window used
  composite_score: float     # weighted composite z-score
```

**Prior from alert level (L1 only):**

| Alert Level | P_restor prior |
|---|---|
| QUIET | 0.98 |
| INVESTIGATE | 0.85 |
| MAJOR_SHOCK | 0.60 |
| REGIME_SHIFT | 0.30 |

---

## L2-specific Fields (null if L1)

```yaml
l2:
  event_type: SignalType  # enum — see SignalType values below
  target: str             # "Saudi Arabia", "TSMC", "Iran"...
  irreversibility_score: float  # 0-1 (may differ from coordinate_2d.x)
  extraction_confidence: low | medium | high
  estimated_months: int | null   # physical restoration timeline
  cost_band: CostBand     # <$10M | $10-50M | $50-200M | $100-500M | $500M-1B | >$1B
  cascade_chains: [str]   # downstream sector impacts
  damage_summary: str     # 1-2 sentence LLM summary
  raw_source_url: str    # source article URL
```

### SignalType Enum

```
SUPPLY_SHOCK          — Physical supply disruption
REGULATORY            — Regulatory change, approval, ban
EXPROPRIATION          — Asset seizure, nationalization
SANCTIONS              — OFAC, SDN, trade sanctions
MILITARY_ACTION        — Kinetic action, conflict escalation
INFRASTRUCTURE_DAMAGE  — Physical damage to facilities
REGIME_CHANGE          — Government/political change
TRADE_RESTRICTION      — Tariffs, quotas, export controls
EXPORT_BAN             — Formal export prohibition
FORCE_MAJEURE         — Contractual invocation of force majeure
PRODUCTION_CUT         — OPEC+/government-mandated production reduction
PRICE_CONTROL          — Government price caps/floors
INSURANCE_WITHDRAWAL   — Insurance pullout from region/sector
PIPELINE_SHUTDOWN      — Pipeline closure, flow cessation
REFINERY_OUTAGE        — Refinery disruption
DIPLOMATIC_BREAK       — Diplomatic relations severed
TREATY_COLLAPSE        — International agreement breakdown
```

### CostBand Enum

```
<$10M | $10-50M | $50-200M | $100-500M | $500M-1B | >$1B
```

---

## Shared Fields (both L1 and L2)

```yaml
# L1: set at write time from alert level mapping
# L2: null at write time; computed fresh by researchers per cycle
prior: float | null

# L1: set from AlertLevel at write time
# L2: null at write time
alert_level: AlertLevel | null

# What is poorly constrained for this signal
uncertainties: list[str]
```

---

## Key Design Decisions

1. **L2 `prior` is null at write time.** Researcher B computes P_restor fresh from complexity + escalation when producing ProbabilisticState. The prior is not stored as historical fact.

2. **`restoration_layer` is null for L2 at write time.** Agents compute the restoration layer fresh per cycle from the taxonomy + complexity data. KB holds resolved historical outcomes, not current assessments.

3. **L1 and L2 are a lead-lag pair.** L1 is the leading signal (markets price before news). L2 is confirmation. They feed the same KB and are read together by researchers.

4. **`kb_analogues` is resolved at write time** by matching the incoming signal against historical_analogues namespace — not computed fresh each time.
