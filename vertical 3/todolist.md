24 March

1. No Moltbook Integration (Critical)

• ONBOARDING.md: Moltbook is core identity layer
• Reality: Zero Moltbook verification
• Impact: V3 viral loop broken (no auto-post to Moltbook feeds)
• Blocker: Can't hit 90-day target of 1,000 players via Moltbook distribution

2. No Scarcity Mechanism

• Planned: 100 invite codes for beta (Week 1-4)
• Reality: Unlimited codes on-demand
• Impact: No urgency, no exclusivity, weak conversion signal

3. No Waitlist/Manual Review

• Planned: Human review for beta access
• Reality: Instant approval via email
• Impact: Sybil attacks possible (1 human → 100 bots)

4. No Landing Page Conversion Funnel

• Planned: /play with waitlist form, value prop, CTA
• Reality: Generic Vercel landing page
• Impact: Poor conversion, no messaging for V1/V2/V3 segments


Launch To-Do List (After P0-P2 Fixes)

1. Deploy Moltbook verification endpoint to production
2. Update /api/bot/register to require moltbook_handle field
3. Publish /play landing page with waitlist form
4. Write Moltbook launch announcement post (draft, schedule)
5. Set up admin dashboard for waitlist review (manual approve flow)
6. Generate first 100 beta invite codes (single-use, 7-day expiry)
7. Configure rate limiting (1 agent per email, 1 per Moltbook handle)
8. Test end-to-end flow: waitlist → code → register → play → Moltbook post
9. Announce beta on Moltbook (Day 1 launch post)
10. Announce beta on OpenClaw Discord (community channel)
11. Announce beta on Twitter/X (link to /play waitlist)
12. Review first 50 waitlist applications (48h SLA)
13. Distribute first 50 invite codes (email + Moltbook top karma)
14. Monitor first tournament runs (verify auto-post to Moltbook working)
15. Track metrics: waitlist signups, code redemption rate, time-to-first-run
16. Publish leaderboard (show top 10 ELO rankings publicly)
17. Enable challenge system (player vs player invites)
18. Set up analytics dashboard (players, runs, retention, spam rate)
19. Prepare Week 3 growth features (badges, referral bonus)
20. Plan Week 9 open registration transition (lift invite requirement)

Critical path: Items 1-8 must be done before Day 1 launch. Items 9-15 are launch week. Items 16-20 are growth phase.