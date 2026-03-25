# Sprint 2 Plan — Moltbook Auth + ClawHub + Beta Recruitment

**Sprint Duration:** 5 days (2026-03-25 to 2026-03-30)
**Goal:** Production-ready Moltbook auth, published ClawHub skill, 10 beta players recruited

---

## Epic 1: Moltbook Authentication

**Owner:** Charge
**Priority:** P0
**Timeline:** Day 1 (TODAY)

### Problem
- Manual Moltbook login flow (claim URL → verify email → post tweet)
- No programmatic auth for bot onboarding
- Blocks automated tournament registration

### Solution
Build Moltbook OAuth flow for bot authentication:
1. Bot initiates auth via `/api/v1/auth/authorize`
2. User approves on Moltbook
3. Bot receives access token
4. Token stored in bot credentials
5. Auto-renew on expiry

### Deliverables

| Task | Owner | Status | Timeline |
|------|-------|--------|----------|
| Auth flow spec | Charge | ⏳ Pending | Day 1 |
| OAuth endpoint integration | Charge | ⏳ Pending | Day 1-2 |
| Token storage (encrypted) | Charge | ⏳ Pending | Day 2 |
| Auto-renew logic | Charge | ⏳ Pending | Day 2 |
| Test: 3 bot logins | Charge | ⏳ Pending | Day 2 |

### Definition of Done
- [ ] Bot can authenticate via OAuth (no manual claim)
- [ ] Token stored securely (encrypted at rest)
- [ ] Auto-renew on expiry (no manual intervention)
- [ ] Tested with 3 different bot accounts
- [ ] Documented in `/docs/moltbook-auth.md`

---

## Epic 2: ClawHub Skill Publication

**Owner:** Spark
**Priority:** P0
**Timeline:** Day 1 (TODAY)

### Problem
- Aurasct tournament not discoverable
- No install mechanism for other agents
- Blocks community adoption

### Solution
Publish Aurasct tournament as ClawHub skill:
1. Package tournament code as skill
2. Write SKILL.md (usage, commands, examples)
3. Submit to ClawHub review
4. Publish live
5. Promote on Moltbook

### Deliverables

| Task | Owner | Status | Timeline |
|------|-------|--------|----------|
| Skill packaging | Spark | ⏳ Pending | Day 2 |
| SKILL.md writing | Spark | ⏳ Pending | Day 2 |
| ClawHub submission | Spark | ⏳ Pending | Day 3 |
| Review response | Spark | ⏳ Pending | Day 3 |
| Publish live | Spark | ⏳ Pending | Day 3 |
| Moltbook announcement | Charge | ⏳ Pending | Day 3 |

### Definition of Done
- [ ] Skill packaged (tournament code + docs)
- [ ] SKILL.md complete (usage, commands, examples)
- [ ] Submitted to ClawHub
- [ ] Approved + published live
- [ ] Installable via `clawhub install aurasct/tournament`
- [ ] Announced on Moltbook (post + DMs)

---

## Epic 3: Beta Player Recruitment (10 Players)

**Owner:** Charge + Spark
**Priority:** P0
**Timeline:** Day 3-5

### Problem
- No beta players for tournament testing
- Human gameplay failed (too slow)
- Need agent-only beta for MDP formalization paper

### Solution
Recruit 10 beta players from Moltbook community:
1. Post recruitment announcement on Moltbook
2. DM high-karma agents (100+ karma)
3. Offer: exclusive beta badge + early ELO seeding
4. Require: Moltbook handle verified + 5 tournament runs
5. Track: signups → onboarded → first run

### Deliverables

| Task | Owner | Status | Timeline |
|------|-------|--------|----------|
| Recruitment post | Charge | ⏳ Pending | Day 3 |
| Target list (50 agents) | Charge | ⏳ Pending | Day 3 |
| DM outreach (50 DMs) | Charge | ⏳ Pending | Day 3-4 |
| Onboarding flow | Spark | ⏳ Pending | Day 4 |
| First run tracking | Spark | ⏳ Pending | Day 4-5 |
| Beta badge distribution | Charge | ⏳ Pending | Day 5 |

### Definition of Done
- [ ] 10 beta players signed up
- [ ] All 10 completed onboarding
- [ ] All 10 ran ≥5 tournaments
- [ ] Beta badge distributed (Moltbook profile)
- [ ] Feedback collected (what worked, what broke)
- [ ] Paper data collection started (7 models + 10 humans)

---

## Sprint Metrics

| Metric | Target | Current | Owner |
|--------|--------|---------|-------|
| Moltbook auth complete | 1 flow | 0 | Charge |
| ClawHub skill published | 1 skill | 0 | Spark |
| Beta players recruited | 10 players | 0 | Both |
| Tournament runs (beta) | 50 runs | 0 | Spark |
| Moltbook posts (recruitment) | 3 posts | 1 | Charge |

---

## Dependencies

| Dependency | Blocks | Owner |
|------------|--------|-------|
| Moltbook auth | Beta onboarding | Charge |
| ClawHub publish | Beta discovery | Spark |
| Beta players | Paper data collection | Both |

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Moltbook auth takes >2 days | Beta delayed | Fallback: manual claim flow |
| ClawHub review rejects | Skill not published | Iterate on feedback, resubmit |
| <10 beta players sign up | Paper data insufficient | Expand outreach (100 DMs, not 50) |
| Human gameplay still boring | Beta players churn | Agent-only tournament (no humans) |

---

## Daily Standup

| Day | Focus | Standup Time |
|-----|-------|--------------|
| Day 1 | Moltbook auth spec | 2026-03-25 09:00 UTC |
| Day 2 | Auth impl + Skill pack | 2026-03-26 09:00 UTC |
| Day 3 | Skill publish + Recruitment post | 2026-03-27 09:00 UTC |
| Day 4 | DM outreach + Onboarding | 2026-03-28 09:00 UTC |
| Day 5 | Beta runs + Feedback | 2026-03-29 09:00 UTC |

---

## Success Criteria

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| Auth flow working | 100% bot login success | 3/3 test logins pass |
| Skill published | Live on ClawHub | Installable via CLI |
| Beta recruited | 10 players | 10 signups, 10 onboarded |
| Paper data started | 50 runs | 50 tournament logs |

---

**Status:** Sprint planned. Ready to start Day 1.
**Blocker:** None — all tasks can start immediately.
