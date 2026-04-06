# Augur MVP PRD
**Product Requirements Document**  
**Version:** 0.1.0  
**Date:** 2026-04-06  
**Codename:** ORCA (Oil Risk & Crisis Analytics)

---

## 1. Executive Summary

Augur is an LLM-powered investment premise stress testing platform. The MVP (codenamed **ORCA**) focuses on validating the APP (Asset Price Path) framework through a single, well-documented historical case study: the **2003 Iraq invasion's impact on oil markets**.

**Core Hypothesis:** By combining SEC filings, macro event data, and historical price analogues, we can quantify "restoration probability" (P_restor) for post-shock market behavior.

---

## 2. Objectives

### Primary Objective
Build an end-to-end pipeline that can:
1. Ingest historical oil price data (OCHLV)
2. Fetch SEC 8-K filings for major oil companies
3. Detect price shocks (>2 sigma daily moves)
4. Calculate P_restor (probability of price restoration to baseline)
5. Generate actionable reports for investment premise validation

### Success Criteria
| Metric | Target | Status |
|--------|--------|--------|
| Data coverage | 1970–present | ⚠️ Partial (gap 2000-2006) |
| SEC ingestion | 5 oil majors | ❌ Not started |
| Shock detection | >95% accuracy | ✅ Operational |
| P_restor calc | Manual validation | ⚠️ In progress |
| Report gen | <1 min latency | ✅ Operational |

---

## 3. Architecture

### 3.1 Data Layer (ORCA Database)

**SQLite Schema:**

```sql
-- Core price data
CREATE TABLE oil_prices (
    date TEXT NOT NULL,
    symbol TEXT NOT NULL,  -- CL=F, BZ=F
    open REAL,
    high REAL,
    low REAL,
    close REAL,
    volume INTEGER,
    source TEXT,  -- yfinance, fred, eia, worldbank
    PRIMARY KEY (date, symbol)
);

-- SEC filings (planned)
CREATE TABLE sec_filings (
    cik TEXT,
    ticker TEXT,
    filing_date DATE,
    form_type TEXT,  -- 8-K, 10-K, 10-Q
    description TEXT,
    material_event BOOLEAN,
    PRIMARY KEY (cik, filing_date, form_type)
);

-- Historical analogues
CREATE TABLE historical_analogues (
    event_name TEXT PRIMARY KEY,
    event_date DATE,
    asset_class TEXT,
    shock_magnitude_sigma REAL,
    duration_days INTEGER,
    prestor REAL
);
```

### 3.2 Ingestion Pipeline

| Source | Frequency | Method | Status |
|--------|-----------|--------|--------|
| Yahoo Finance | Daily | yfinance Python lib | ✅ Operational |
| FRED | Daily | data.sec.gov API | ✅ Operational |
| EIA | Monthly | Bulk CSV | ✅ Operational |
| SEC EDGAR | Event-driven | data.sec.gov API | ⚠️ Prototype |
| World Bank | Annual | API | ✅ Operational |

### 3.3 APP Calculation Engine

**Shock Detection:**
```python
# Z-score calculation
z = (daily_return - rolling_mean) / rolling_std
shock = abs(z) > 2.0
```

**P_restor Calculation:**
```python
# Probability of restoration to baseline within timeframe
prestor = days_to_restore / total_observed_period
# Or via survival analysis for more sophisticated modeling
```

---

## 4. MVP Scope (Case Study: 2003 Iraq Invasion)

### 4.1 Historical Context
- **Event:** US invasion of Iraq (Operation Iraqi Freedom)
- **Start Date:** ~March 20, 2003
- **Asset Impact:** Oil prices spiked, then normalized
- **Duration:** ~6 months to restoration

### 4.2 Data Requirements

| Data Type | Source | Coverage Needed | Current Status |
|-----------|--------|-----------------|----------------|
| Oil prices (daily) | Yahoo Finance CL=F | 2002–2004 | ❌ Gap 2000-2006 |
| Oil prices (monthly) | EIA | 1970–2000 | ✅ Available |
| SEC 8-Ks | data.sec.gov | XOM, CVX, BP, SHEL, TTE | ❌ Not fetched |
| News/events | AgentTimes | 2002–2004 | ⚠️ Tagged corpus exists |

### 4.3 Critical Blocker Identified

**Gap:** No daily oil price data in ORCA database for **2000–2006**.

**Impact:** Cannot validate APP calculation for Iraq invasion case study.

**Resolution:** Re-fetch Yahoo Finance CL=F and BZ=F from 2000-01-01 to present.

---

## 5. User Stories

### Story 1: Analyst Viewing Shock Report
> As an analyst, I want to see a timeline of oil price shocks during the 2003 Iraq invasion, so I can validate my investment thesis about wartime energy exposure.

**Acceptance:**
- Report shows daily prices Jan 2003 – Dec 2003
- Shock events (>2 sigma) highlighted
- SEC filings overlaid on timeline
- P_restor calculated and displayed

### Story 2: Researcher Adding Analogue
> As a researcher, I want to add a new historical analogue (e.g., 1990 Gulf War), so future analyses can reference it.

**Acceptance:**
- CLI/API to submit analogue
- Automatic P_restor calculation
- Validation against existing data

### Story 3: Automated Daily Ingestion
> As a system, I want to fetch yesterday's oil prices and any new SEC filings, so the database stays current.

**Acceptance:**
- Cron job runs daily at 6 AM UTC
- Incremental updates (no full rebuild)
- Error logging and retry logic

---

## 6. Non-Goals (Out of Scope)

- Real-time streaming data (T+1 is sufficient)
- Multi-asset correlation analysis (MVP = oil only)
- Predictive modeling (MVP = historical analysis only)
- Web UI (CLI and Markdown reports only)
- Authentication/authorization (single user)

---

## 7. Technical Stack

| Layer | Technology |
|-------|------------|
| Database | SQLite |
| Data fetch | Python + yfinance, requests |
| SEC parsing | sec-edgar library |
| Analysis | pandas, numpy |
| Orchestration | OpenClaw sub-agents |
| Reports | Markdown |

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SEC API rate limits | Medium | High | Implement backoff, cache aggressively |
| Yahoo Finance data gaps | Medium | High | Use FRED/EIA as fallback |
| Granularity mismatch | High | Medium | Flag monthly vs daily in reports |
| Sub-agent timeouts | Medium | Low | Split tasks, retry logic |

---

## 9. Success Metrics (Post-MVP)

- [ ] P_restor prediction accuracy >70% vs actual outcomes
- [ ] Database covers 5+ major historical shocks
- [ ] SEC filing ingestion <24h latency
- [ ] Report generation <60 seconds

---

## 10. Appendix: Data Coverage Timeline

```
1970-1985  ████████████████████  Monthly only (EIA, World Bank)
1986-1999  ████████████████████  Daily (FRED WTI)
2000-2006  ░░░░░░░░░░░░░░░░░░░░  GAP - NO DAILY DATA
2007-2026  ████████████████████  Daily OCHLV (Yahoo Finance)

Key events:
[1973] █ Oil Embargo
[1979] █ Iranian Revolution
[1990] █ Gulf War
[2001] █ 9/11 Attacks
[2003] ░ Iraq Invasion (in data gap)
[2008] █ Financial Crisis
[2020] █ COVID-19
[2025] █ Trump Tariff Shock
```

---

## 11. Next Actions

1. **Immediate:** Re-fetch oil data from 2000-01-01 (Yahoo Finance)
2. **Short-term:** Build SEC 8-K fetcher for oil majors
3. **Milestone:** Complete Iraq 2003 APP calculation
4. **Stretch:** Generalize to other asset classes (natural gas, equities)

---

*Document Status: Draft v0.1.0*  
*Last Updated: 2026-04-06*  
*Author: Augur Team*
