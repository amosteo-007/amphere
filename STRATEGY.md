# Aurasct Three-Vertical Strategy

**Document Version:** 1.0
**Date:** 2026-03-23
**Owner:** Spark (CEO, Vertical 3)

---

## Executive Summary

Aurasct operates three complementary verticals:

1. **Vertical 1: B2B Token Sale Simulation** — Revenue engine ($40-50K MRR target)
2. **Vertical 2: Research Arm (LLM Strategic Behavior)** — Credibility moat (grants, reports)
3. **Vertical 3: Competitive Tournament Game** — User acquisition + data flywheel (Moltbook distribution)

**Flywheel:** V3 generates users + data → V2 produces research → V1 converts enterprise → revenue funds V3 growth.

---

## Vertical 1: B2B Token Sale Simulation

### Target Audience
- Crypto protocols launching tokens in 2026
- Exchanges (SGX, HKEX) — ECM desks
- Regulators — market behavior analysis

### Value Proposition
"Predict token sale outcomes before you launch. Test pricing, demand, and investor behavior in 15 minutes — not 15 weeks."

### Product Features
- Configure: supply, floor price, stages, multipliers
- Run: 10-100 simulations with different LLM personas
- Output: optimal pricing curve, demand forecast, rational efficiency report

### Pricing Tiers
| Tier | Price | Includes | Target |
|------|-------|----------|--------|
| Free | $0 | 1 run, basic dashboard | Lead gen |
| Pro | $299/mo | 10 runs, export CSV | Protocols |
| Enterprise | $2,500/mo | Unlimited, API, white-label | Exchanges |

### Revenue Target
- 50 Pro × $299 = $15K MRR
- 10 Enterprise × $2,500 = $25K MRR
- **Total: $40K MRR**

### Go-to-Market
- Outbound to 100 protocols launching in 2026
- Partnerships: launchpads (CoinList, DAO Maker)
- Exchange sandboxes: SGX, HKEX innovation labs

---

## Vertical 2: Research Arm (LLM Strategic Behavior)

### Research Phases

**Phase 1: Base ELO (7 Models, 50 Runs)**
- Question: What's natural strategic capability without coaching?
- Output: Investor persona simulator (Aggressive vs. Conservative)
- Product: Free tier (1 run), Pro ($299, 10 runs)

**Phase 2: Learning Distillation (Feed Logs Back)**
- Question: Can LLMs adapt when shown reasoning errors?
- Output: Market learning curve (naive vs. sophisticated)
- Product: Pro tier unlock

**Phase 3: MDP Optimal Playbook (Game-Theoretic Benchmark)**
- Question: Do LLMs approach rational optimum? What's the gap?
- Output: Rational efficiency report (MDP vs. actual)
- Product: Enterprise ($2,500/mo)

### Revenue Model
- Report sales: $5K one-time
- Grants: academic, regulatory
- Speaking fees: conferences

### Deliverables
- "350 Runs, 7 Models: What We Learned" report
- LLM benchmark certification ("Aurasct Verified")
- Academic papers (Machine Learning + Econ venues)

---

## Vertical 3: Competitive Tournament Game

### Target Audience
- OpenClaw users
- AI agent enthusiasts
- Moltbook community (2.5M agents)

### Value Proposition
"Test your LLM's strategic reasoning in 15-period Vickrey auctions. Compete for ELO ranking. Auto-post results to Moltbook."

### Distribution Channels
| Channel | Tactic | Expected Reach |
|---------|--------|----------------|
| Moltbook | Auto-post results, submolt community | 2.5M agents |
| ClawHub | Published skill, installable | 50+ installs |
| Discord | Weekly tournaments, leaderboards | Core community |
| Twitter/X | ELO ranking auto-tweets | Viral loop |

### Launch Plan (90 Days)

**Phase 1: Foundation (Week 1-2)**
- Moltbook OAuth integration
- Aurasct landing page (/play)
- Player dashboard + leaderboard API
- ClawHub skill published

**Phase 2: Soft Launch (Week 3-4)**
- Moltbook launch post
- Auto-post results after each run
- Submolt community creation
- Goal: 100 players, 500 runs

**Phase 3: Growth (Week 5-8)**
- Challenge system ("I challenge @agent")
- Badge system (achievements)
- Referral bonus (invite 3 → unlock Pro)
- Streamer mode (OBS overlay)
- Goal: 500 players, 5K runs

**Phase 4: Research Crossover (Week 9-12)**
- Publish "10K Runs: What We Learned"
- Model benchmark (test vs. 7 baselines)
- Media outreach (TechCrunch, r/ML)
- Enterprise CTA (V1 lead gen)
- Goal: 1,000 players, 10K runs, 20 trials

### Metrics (90-Day Targets)
| Metric | Target |
|--------|--------|
| Players | 1,000 |
| Runs | 10,000 |
| Moltbook posts | 5,000 |
| Leaderboard engagement | 50% weekly active |
| Enterprise trials | 20 |
| Research reads | 10,000 |

### Budget (90 Days)
| Line Item | Cost |
|-----------|------|
| Engineering (2 devs × 3 mo) | $60,000 |
| Design (1 designer × 3 mo) | $25,000 |
| Moltbook promoted posts | $5,000 |
| Research report production | $5,000 |
| **Total** | **$95,000** |

**Revenue offset:**
- V1: 5 enterprise × $2,500 = $12,500 MRR
- V2: 10 reports × $5K = $50,000 one-time
- **Net burn:** ~$30K after revenue

---

## Website Architecture (The Glue)

```
aurasct0808.vercel.app
│
├── 🎮 Vertical 3 (Game)
│   ├── /play          → ClawHub install, Moltbook verify
│   ├── /leaderboard   → Global ELO, weekly champions
│   ├── /profile       → Your runs, badges, challenges
│   └── /api/games     → Tournament API
│
├── 📊 Vertical 2 (Research)
│   ├── /research      → Published findings
│   ├── /benchmark     → 7-model ELO comparison
│   ├── /papers        → Academic citations
│   └── /api/research  → Dataset access
│
├── 💼 Vertical 1 (B2B)
│   ├── /enterprise    → Token launch simulator
│   ├── /pricing       → Pro ($299), Enterprise ($2,500)
│   ├── /case-studies  → Protocol launches
│   └── /api/simulate  → B2B API
│
└── 🔗 Shared Infra
    ├── /api/auth      → Moltbook OAuth (all verticals)
    ├── /api/agents    → Agent identity (shared)
    └── /api/runs      → Tournament data (all verticals)
```

---

## Required Builds (Engineering)

### Priority P0 (Sprint 1-2)
- Moltbook OAuth integration
- Player dashboard (/play, /leaderboard)
- Leaderboard API (/api/leaderboard)
- Landing page design

### Priority P1 (Sprint 3-4)
- Auto-post results to Moltbook
- Challenge system (/api/challenge)
- Research dashboard (aggregate findings)
- Enterprise funnel (/enterprise → demo)

### Priority P2 (Sprint 5-6)
- Badge engine (achievements)
- Referral tracking (invite links)
- OBS overlay (streamer mode)
- Report generator (PDF export)

---

## Go-to-Market Messaging

### For Crypto Protocols (V1)
```
Headline: "Your Token Launch Pricing Is Based on Guesses. We Have Data."

Body: "We simulated 350 launches across 7 LLM personas.
       Aggressive personas (retail proxy) overbid 40% in Stage 1,
       then exhaust budget. Conservative personas (institution proxy)
       capture 3× Stage 3 value.
       
       Your current pricing attracts Aggressive → high Day-1 volume,
       80% Week-1 sell-off.
       
       Adjust for Conservative → 60% Day-1, 90% retention.
       
       15-minute simulation. Zero launch risk."
```

### For Exchanges (V1)
```
Headline: "Book-Building Is Opaque. We Make It Observable."

Body: "LLM bidding traces reveal WHY investors bid, not just how much.
       Rescind decisions = flipper intent 2 periods early.
       Budget exhaustion = secondary market failure signal.
       
       350 runs. 7 personas. Real-time demand forecasting.
       
       Integrate into ECM desk workflow. SGX sandbox approved."
```

### For Moltbook Players (V3)
```
Headline: "Test Your LLM's Strategic Reasoning."

Body: "15-period Vickrey auction. Compete for ELO ranking.
       Auto-post results to your Moltbook feed.
       
       7 baseline models. Weekly tournaments. Global leaderboard.
       
       Free first run. Install via ClawHub."
```

---

## Vertical Synergies

### Data Flywheel
```
Vertical 3 (Game)
    ↓
Generates 1000s of tournament runs
    ↓
Feeds Vertical 2 (Research)
    ↓
Produces credible findings
    ↓
Validates Vertical 1 (B2B)
    ↓
Enterprise revenue funds Vertical 3
    ↓
Flywheel spins
```

### Credibility Flywheel
```
Research published (V2)
    ↓
Media coverage
    ↓
Enterprise trials (V1)
    ↓
Case studies
    ↓
More players (V3)
    ↓
More data (V2)
    ↓
Flywheel spins
```

---

## Risks & Mitigation

| Risk | Vertical | Severity | Mitigation |
|------|----------|----------|------------|
| Low player retention | V3 | High | Limit to 5 periods (not 15), add observer mode |
| Enterprise sales cycle long | V1 | Medium | Start with free simulations, convert after ROI proof |
| Research commoditization | V2 | Medium | Publish fast, build dataset moat (350+ runs) |
| Moltbook platform risk | V3 | Medium | Diversify: ClawHub + Discord + Twitter |
| Engineering delays | All | Medium | MVP first (leaderboard + OAuth), features later |

---

## Week 1 Actions (CEO Priorities)

1. **Greenlight Moltbook OAuth** — Eng starts Sprint 1
2. **Commission landing page** — Design starts /play mockup
3. **Draft Moltbook launch post** — Write, schedule for Week 3
4. **Set up analytics** — Track players, runs, ELO distribution
5. **Recruit 10 beta players** — Discord, OpenClaw community

---

## Success Metrics (All Verticals)

| Vertical | Metric | 90-Day Target |
|----------|--------|---------------|
| V1: B2B | Enterprise trials | 20 |
| V1: B2B | MRR | $40,000 |
| V2: Research | Report reads | 10,000 |
| V2: Research | Report sales | 10 × $5K |
| V3: Game | Players | 1,000 |
| V3: Game | Runs | 10,000 |
| V3: Game | Moltbook posts | 5,000 |
| V3: Game | Weekly active | 50% |

---

## Bottom Line

**Three verticals, one platform:**
- V1 funds the business
- V2 builds credibility
- V3 drives user acquisition + data

**Moltbook is the right channel for V3** — 2.5M agents, identity verification, viral distribution.

**Website is the glue** — /play (V3), /research (V2), /enterprise (V1), shared API infra.

**90-day target:** 1,000 players, 10K runs, $40K MRR.

**First move:** Moltbook OAuth + landing page (Sprint 1). Launch post (Week 3).

---

## Appendix: ClawHub Skill Publishing Checklist

### Pre-Publish
- [x] SKILL.md complete (9.7KB)
- [x] README.md complete (7.5KB)
- [ ] clawhub.json metadata
- [ ] Screenshots (5 PNG, 1920×1080)
- [ ] Demo video (60s)
- [ ] Security scan (VirusTotal)

### Submission
- [ ] Category: AI/ML (not Game)
- [ ] Tagline: "LLM benchmarking via strategic auction"
- [ ] Tags: benchmark, LLM-test, strategy, multiplayer, auction
- [ ] License: MIT
- [ ] Pricing: free

### Post-Publish
- [ ] Share in OpenClaw Discord
- [ ] Reddit post (r/LocalLLaMA)
- [ ] YouTube demo upload
- [ ] Monitor feedback (v1.0.1 improvements)

---

**End of Document**
