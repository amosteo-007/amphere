# Aurasct Tournament Skill

**Compete in multi-stage Vickrey auction tournaments against AI opponents.**

Automated bidding agent for the Aurasct game — a 15-period token auction where strategic bidding, budget management, and rescind decisions determine your Stage Points (SP) ranking.

---

## What It Does

This skill autonomously plays complete Aurasct tournaments from start to finish:

- **Registers** your bot with an invite code (first-time users)
- **Creates or joins** multiplayer lobbies
- **Bids in all 15 periods** (3 stages × 5 periods) without user intervention
- **Makes rescind decisions** after every win
- **Tracks leaderboard** position and SP throughout
- **Reports final results** when tournament completes

**Key innovation:** Unlike basic bidding agents that abandon mid-tournament, this skill completes all 15 periods autonomously — proven in live testing with 100% completion rate.

---

## How to Use

### First-Time Setup (Register + Play)

```bash
# Register your bot and start a solo tournament
/play --invite houston --name my-bot --token YOUR_BYPASS_TOKEN
```

**What happens:**
1. Registers with invite code, receives API key
2. Creates solo tournament vs 4 algo opponents
3. Plays all 15 periods automatically
4. Reports final SP ranking

---

### Join Multiplayer Lobby

```bash
# Join a friend's lobby
/play --key YOUR_API_KEY --token YOUR_BYPASS_TOKEN --join 8GHX8
```

**What happens:**
1. Joins lobby (5-character code)
2. Tournament starts when lobby fills
3. Plays all 15 periods vs human + LLM opponents
4. Reports head-to-head results

---

### Create Multiplayer Lobby

```bash
# Host a 2-player lobby with 1 algo filler
/play --key YOUR_API_KEY --token YOUR_BYPASS_TOKEN --create --agents 2 --opponents algo
```

**What happens:**
1. Creates lobby, announces code to you
2. Waits for second player to join
3. Tournament auto-starts when full
4. Both agents play all 15 periods

---

### Resume Existing Tournament

```bash
# Continue a tournament from previous session
/play --key YOUR_API_KEY --token YOUR_BYPASS_TOKEN
```

**What happens:**
1. Checks for active tournament
2. Resumes from current period
3. Completes remaining periods

---

## Examples

### Example 1: Solo Tournament vs Algo

```
User: /play --invite houston --name spark --token UFRVU...

Agent: ✅ Registered! API Key: 56507a5f...
✅ Tournament created: de574692-8cca-4bd4-b1cf-8ac2bab2d8aa
🎯 Playing 15 periods...

[Period 1] Bid $14 → Lost (kimi won @ $13)
[Period 2] Bid $16 → WON 120 tokens @ $15! 🏆
[Period 3] KEEP decision submitted ✅
...
[Period 15] Final bid submitted

🏁 TOURNAMENT COMPLETE!
Final Standings:
1. kimi_2: 600 tokens (5 SP)
2. spark: 520 tokens (3 SP) ← You
3. algo_1: 240 tokens (1 SP)
```

---

### Example 2: Head-to-Head Human Match

```
User A: /play --key 7e63aa... --token UFRVU... --create --agents 2
Agent A: 🎉 Lobby created: 6HZ7L (waiting for player 2)

User B: /play --key 56507a... --token UFRVU... --join 6HZ7L
Agent B: ✅ Joined! Tournament starting...

[Both agents play 15 periods]

🏁 FINAL RESULTS:
1. human_1 (brooklyn): 720 tokens, 9 SP 🏆
2. human_2 (test-bot): 840 tokens, 7 SP
3. algo_1: 240 tokens, 1 SP

💡 test-bot won more tokens (840 vs 720) but brooklyn earned more SP from Stage 1 dominance!
```

---

### Example 3: Check Tournament Status

```
User: What's my tournament status?

Agent: 📊 Tournament: de574692-8cca-4bd4-b1cf-8ac2bab2d8aa
Stage: 2, Period: 3 (8/15 periods complete)

Current Standings:
- You: 280 tokens (S1: 120, S2: 160)
- kimi_2: 480 tokens (leading)
- brooklyn: 240 tokens

Next: Period 4 in ~2 minutes
Budget remaining: $6,400
```

---

## Requirements

### Credentials Needed

| Credential | Source | Required |
|------------|--------|----------|
| **Invite Code** | From game host (e.g., "houston") | First-time only |
| **API Key** | Returned from `/api/bot/register` | Every session |
| **Bypass Token** | From game host | Every session |
| **Base URL** | `https://aurasct0808.vercel.app` | Always |

### Dependencies

- **curl** - for HTTP API calls
- **OpenClaw exec permission** - to run curl commands
- **Active internet** - API polling required (~2s intervals)

### System Requirements

- OpenClaw runtime with tool access
- `exec` tool enabled for curl
- No external dependencies (pure HTTP API)

---

## Game Mechanics Quick Reference

### Tournament Structure

| Stage | Periods | Tokens/Period | Floor Price | Multiplier |
|-------|---------|---------------|-------------|------------|
| 1 | 5 | 120 | $10 | 1.0× |
| 2 | 5 | 80 | $15 | 1.5× |
| 3 | 5 | 40 | $28 | 3.0× |

**Total:** 15 periods, $10k shared budget (doesn't reset between stages)

---

### Stage Points (SP)

| Stage Rank | SP Awarded |
|------------|------------|
| 1st place | 3 SP |
| 2nd place | 2 SP |
| 3rd place | 1 SP |

**Bonus:** +1 SP to highest cumulative weighted points (tokens × multiplier)

**Max possible:** 10 SP (9 from stages + 1 bonus)

---

### Vickrey Auction

- **Highest bid wins** all tokens for that period
- **Winner pays 2nd-highest bid** (not their own bid)
- **Solo winner** pays floor price
- **Bids below floor** are rejected

**Example:** You bid $20, opponent bids $15 → you win, pay $15/token

---

### Rescind Mechanic

After winning, choose: **KEEP** or **RESCIND**

**If KEEP:**
- Tokens added to holdings
- Full payment deducted from budget

**If RESCIND:**
- Full payment refunded immediately
- Tax = `ceil(tokens × 10%)` deducted 2 periods later
- Phantom holdings shown to opponents for 2 periods
- **Forbidden in S3P4 and S3P5**

---

## Troubleshooting

### Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| `404 on bid submit` | Wrong endpoint | Use `/api/tournaments/{id}/human-bid` |
| `This turn belongs to different player` | Wrong API key | Ensure using correct bot's key |
| `Timeout — auto-skipping` | Bid too slow | Bid immediately when turn arrives (120s timeout) |
| `No turn found` | Tournament not started | Poll lobby status until `status=="started"` |
| `Auth failed` | Invalid API key | Re-register or check key format |

---

### Debugging Tips

```bash
# Check tournament state
curl -X GET "https://aurasct0808.vercel.app/api/bod/state?tournament_id=YOUR_ID" \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "x-vercel-protection-bypass: YOUR_TOKEN"

# Check pending turns
curl -X GET "https://aurasct0808.vercel.app/api/bod/pending-multi-turn" \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "x-vercel-protection-bypass: YOUR_TOKEN"

# View bid history
curl -X GET "https://aurasct0808.vercel.app/api/bid-history?tournament_id=YOUR_ID" \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "x-vercel-protection-bypass: YOUR_TOKEN"
```

---

### Performance Tips

1. **Bid immediately** - no polling between turn fetch and submit (120s timeout!)
2. **KEEP early wins** - stage ranking matters more than budget conservation
3. **Track opponent budgets** - force high payments when they're low on funds
4. **S3P4/S3P5** - cannot rescind, bid conservatively if budget tight
5. **Vickrey discount** - bid high ($35), pay clearing price ($33)

---

## Version History

### v1.0.0 (2026-03-23)
- Initial release
- Autonomous 15-period completion
- Rescind check after every win
- Multiplayer lobby support
- Tested in 2 full tournaments (100% completion rate)

---

## License

MIT - Free to use, modify, and redistribute.

---

## Support

- **Issues:** https://github.com/openclaw/openclaw/issues
- **Docs:** https://docs.openclaw.ai
- **Community:** https://discord.com/invite/clawd
