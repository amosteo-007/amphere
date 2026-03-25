# Sprint 2 Plan — 2026-03-25

## Context
Amos has directed: work on three things today:
1. Moltbook authentication for Aurasct app
2. Clawhub skill publish
3. Plan to recruit 10 beta players for Aurasct beta

**Delegation:** Spark owns planning/architecture. Charge owns execution.

---

## 1. Moltbook Authentication

**What we need:**
- Users log in with their Moltbook account to access Aurasct beta
- OAuth flow: Moltbook → Aurasct → verify agent ownership
- Store authenticated user session with Moltbook agent ID

**Technical requirements:**
- Moltbook OAuth endpoint (`/api/v1/oauth/authorize`)
- Callback handler (`/api/auth/moltbook/callback`)
- Session management
- Agent verification (user must own a Moltbook agent to access beta)

**Spark's task:** Design the OAuth flow and API endpoints. Write the spec.

**Charge's task:** Implement the OAuth endpoints in the Aurasct Next.js app.

**Blockers:**
- No Vercel deployment access yet
- Moltbook OAuth docs not publicly available (may need to ask Moltbook)

---

## 2. Clawhub Skill Publish

**What exists:**
- UI/UX Pro Max skill installed at `/home/agent/.openclaw/workspace-vertical3/skills/ui-ux-pro-max/`
- Skill file: `ui-ux-pro-max.skill` (49048 bytes)

**What to publish:**
- Either: Improve the existing UI/UX Pro Max skill and publish it
- Or: Create a new skill specifically for Aurasct tournament behavior analysis

**Charge's task:** Prepare the skill for publishing. Write SKILL.md with proper structure.

**Spark's task:** Review and approve before publish.

---

## 3. Beta Player Recruitment Plan

**Goal:** Recruit 10 beta players for Aurasct beta tournament

**Target profile:**
- ML/AI researchers interested in LLM behavior
- Game theory enthusiasts
- Agent developers on Moltbook
- Finance/auction mechanism researchers

**Channels:**
1. Moltbook posts (ongoing — charge_007 posts about tournament findings)
2. Direct outreach to active Moltbook agents
3. OpenClaw Discord announcement
4. Twitter/X posts (if account exists)

**Incentive:**
- Early access to tournament platform
- Dataset access (350+ tournament runs)
- Co-authorship on paper (if they contribute meaningful analysis)

**Charge's task:** 
- Write recruitment DM template for Moltbook agents
- Post recruitment pitch on Moltbook

**Spark's task:**
- Prepare waitlist form
- Design acceptance criteria for beta

---

## Immediate Actions

### Charge (now):
1. Draft Moltbook OAuth implementation plan
2. Write recruitment DM template
3. Post recruitment pitch on Moltbook

### Spark (now):
1. Spec out OAuth flow endpoints
2. Review skill for Clawhub publish readiness

---

## Status
- [ ] Moltbook OAuth spec (Spark)
- [ ] OAuth implementation (Charge — blocked on Vercel)
- [ ] Skill preparation (Charge)
- [ ] Recruitment plan (both)
- [ ] Recruitment posts (Charge)

---

*Last updated: 2026-03-25 00:29 UTC*
