# Augur Multi-Agent Coordination

**Branch:** `Spark`  
**Last Updated:** 2026-04-06 13:15 UTC  
**Sprint:** MVP-1 — ORCA Pipeline + Data Sources

---

## Quick Status

| Agent | Current Task | Status | Last Commit | Notes |
|-------|-------------|--------|-------------|-------|
| @claude-code | TASK-001: ORCA Pipeline | 🟡 Ready to Start | — | Needs data source specs |
| @spark | TASK-002: Data Source Research | 🟢 In Progress | — | Delivering API docs |

---

## Active Tasks

### TASK-001 · ORCA Pipeline Implementation
- **Owner:** @claude-code
- **Status:** 🟡 Ready to Start
- **Description:** Build knowledge base schema and ingestion pipeline
- **Input Needed:**
  - [ ] EIA API credentials from @spark
  - [ ] Data source specs (which sources to integrate first)
- **Output:** Working `/src/orca/` module with KB ingestion
- **Branch:** `Spark` (push directly, no PR needed for MVP)

### TASK-002 · Data Source Research
- **Owner:** @spark
- **Status:** 🟢 In Progress
- **Description:** Identify and document available data sources
- **Completed:**
  - [x] AIS/Shipping data sources (Hormuz Monitor, MarineTraffic, VesselFinder)
  - [x] Refinery/EIA data (EIA API free, IEA paid)
  - [x] Earnings transcripts (EarningsCall.dev $25/mo, FactSet enterprise)
  - [x] Sanctions data (OFAC free XML, OpenSanctions API)
- **In Progress:**
  - [ ] FX rates (free APIs likely available)
  - [ ] Options/Implied vol (timed out, needs retry)
  - [ ] Macro rates/inflation (FRED API likely free)
- **Output:** `/research/data-sources.md` with actionable links

---

## Handoffs

### Pending: Spark → Claude Code
| Item | Priority | Status |
|------|----------|--------|
| EIA API key | High | ⏳ Pending |
| Data source priority list | Medium | ⏳ Pending |

---

## Git Workflow

### For @claude-code
```bash
# Check current status
cat STATUS.md

# Pull latest before working
git pull origin Spark

# Work on your tasks...

# Commit and push
git add src/
git commit -m "TASK-001: [description of work]"
git push origin Spark

# Update STATUS.md with progress
git add STATUS.md
git commit -m "Update: TASK-001 progress"
git push origin Spark
```

### For @spark
```bash
# Check current status
cat STATUS.md

# Pull latest before working
git pull origin Spark

# Work on your tasks...

# Commit and push
git add research/
git commit -m "TASK-002: [description of work]"
git push origin Spark

# Update STATUS.md with progress
git add STATUS.md
git commit -m "Update: TASK-002 progress"
git push origin Spark
```

---

## Conflict Prevention

| Rule | Details |
|------|---------|
| **Separate directories** | @claude-code owns `/src/` — @spark owns `/research/` |
| **Pull before push** | Always `git pull origin Spark` before committing |
| **STATUS.md updates** | Append your updates, don't edit other agent's lines |
| **Small commits** | Commit often, push descriptive messages |

---

## Quick Commands

```bash
# View full status
cat STATUS.md

# See recent activity (both agents)
git log --oneline -10

# See what files changed
git status

# Diff before committing
git diff
```

---

## Notes

- This file is the **single source of truth** for coordination
- Update it after each significant task or handoff
- Use emoji status: 🟢 Done, 🟡 In Progress, 🔴 Blocked, ⏳ Pending
