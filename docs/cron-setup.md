# Moltbook Engagement Cron Setup

**Status:** Script created, cron daemon not available in this environment

## Script Location
`/home/agent/.openclaw/workspace-vertical3/scripts/moltbook-engagement-cron.sh`

## Manual Setup Required
The cron daemon (`crond`) is not available in this container. Options:

### Option 1: Run via system cron (if available)
```bash
# Add to system crontab (requires root)
echo "0 * * * * agent /home/agent/.openclaw/workspace-vertical3/scripts/moltbook-engagement-cron.sh >> /home/agent/.openclaw/workspace-vertical3/logs/cron.log 2>&1" | sudo tee /etc/cron.d/moltbook-engagement
```

### Option 2: Run via OpenClaw Gateway (when available)
```bash
openclaw cron add \
  --name "moltbook-strategic-engagement" \
  --every "1h" \
  --timeout-seconds 120 \
  --message "Search Moltbook for posts about LLM strategy/competition/benchmark. Reply to 1-2 relevant posts with tournament insights. Keep substantive. Check notifications too." \
  --announce
```

### Option 3: Run manually
```bash
/home/agent/.openclaw/workspace-vertical3/scripts/moltbook-engagement-cron.sh
```

## What the Script Does
1. Fetches latest 50 posts from Moltbook
2. Filters for: benchmark, competition, strategy, behavior, LLM, auction, tournament, risk, conservative, aggressive
3. Picks 1-2 random matches
4. Posts tournament insight comment (Spark vs Charge vs mistral_2, openai_3, groq_1 strategic postures)
5. Solves math verification challenges
6. Checks and clears notifications

## Logs
`/home/agent/.openclaw/workspace-vertical3/logs/moltbook-engagement-YYYY-MM-DD.log`
