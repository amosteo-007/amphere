#!/bin/bash
KEY="63b2553ad27481ff57777ede82499c0534539a28862b84705d02ae751163f5ae"
TOKEN="UFRVQe2HfQThpYm67thG83UiU9MVun"
BASE="https://aurasct0808.vercel.app"
TOURNAMENT="93ff3354-c800-4621-a306-198fa1ebf34b"

poll() {
  curl -s "$BASE/api/bot/pending-multi-turn" \
    -H "Authorization: Bearer $KEY" \
    -H "x-vercel-protection-bypass: $TOKEN"
}

submit() {
  curl -s -X POST "$BASE/api/tournaments/$TOURNAMENT/human-bid" \
    -H "Authorization: Bearer $KEY" \
    -H "x-vercel-protection-bypass: $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$1"
}

state() {
  curl -s "$BASE/api/bot/state?tournament_id=$TOURNAMENT" \
    -H "Authorization: Bearer $KEY" \
    -H "x-vercel-protection-bypass: $TOKEN"
}

no_turn_count=0

while true; do
  resp=$(poll)
  
  has_turn=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print('YES' if d.get('turn') else 'NO')" 2>/dev/null)
  
  if [ "$has_turn" = "YES" ]; then
    no_turn_count=0
    
    turn_id=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['turn']['id'])" 2>/dev/null)
    decision_type=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['turn']['decision_type'])" 2>/dev/null)
    floor=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['turn']['observation']['floor_price'])" 2>/dev/null)
    tokens=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['turn']['observation']['tokens_available'])" 2>/dev/null)
    budget=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['turn']['observation']['remaining_budget'])" 2>/dev/null)
    sp=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['turn']['observation']['sp'])" 2>/dev/null)
    stage=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['turn']['stage'])" 2>/dev/null)
    period=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['turn']['period'])" 2>/dev/null)
    
    echo "[$(date)] S${stage}P${period} floor=$floor tokens=$tokens budget=$budget sp=$sp"
    
    if [ "$decision_type" = "bid" ]; then
      # Bid sizing based on stage and situation
      if [ "$floor" = "10" ]; then
        bid=13
      elif [ "$floor" = "15" ]; then
        bid=18
      else
        bid=32
      fi
      
      decision=$(python3 -c "import json; print(json.dumps({'price_per_token': $bid}))")
      echo "  --> bid $bid"
      submit "{\"turn_id\": \"$turn_id\", $decision}"
      
    elif [ "$decision_type" = "rescind" ]; then
      # Keep by default
      echo "  --> keep"
      submit "{\"turn_id\": \"$turn_id\", \"rescind\": false}"
    fi
  else
    no_turn_count=$((no_turn_count + 1))
    if [ $((no_turn_count % 10)) -eq 0 ]; then
      st=$(state)
      tstatus=$(echo "$st" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['tournament']['status'])" 2>/dev/null)
      echo "[$(date)] status=$tstatus consecutive_no_turn=$no_turn_count"
      if [ "$tstatus" = "completed" ]; then
        echo "=== TOURNAMENT COMPLETE ==="
        echo "$st" | python3 -m json.tool
        break
      fi
    fi
    sleep 2
  fi
done
