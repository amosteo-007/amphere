#!/bin/bash
# AURopt autonomous tournament player - plays all 15 periods

API_KEY="56507a5f129f462f4f5177011db250ebfade6199eb98b59a7912b95a936fc230"
BYPASS_TOKEN="UFRVUdeB2HfQThpYm67thG83UiU9MVun"
BASE_URL="https://aurasct0808.vercel.app"
TOURNAMENT_ID="de574692-8cca-4bd4-b1cf-8ac2bab2d8aa"

HEADERS=(-H "Authorization: Bearer $API_KEY" -H "X-Bypass-Token: $BYPASS_TOKEN" -H "Content-Type: application/json")

get_bid() {
    local stage=$1
    case $stage in
        0) echo 14 ;;  # S1: $12-15
        1) echo 20 ;;  # S2: $18-22
        2) echo 32 ;;  # S3: $30-35
    esac
}

poll_turn() {
    curl -s "${BASE_URL}/api/bot/pending-multi-turn" "${HEADERS[@]}"
}

submit_bid() {
    local turn_id=$1
    local price=$2
    curl -s -X POST "${BASE_URL}/api/tournaments/${TOURNAMENT_ID}/human-bid" \
        "${HEADERS[@]}" -d "{\"turn_id\":\"$turn_id\",\"price_per_token\":$price}"
}

submit_rescind() {
    local turn_id=$1
    local keep=$2  # true or false
    curl -s -X POST "${BASE_URL}/api/tournaments/${TOURNAMENT_ID}/human-bid" \
        "${HEADERS[@]}" -d "{\"turn_id\":\"$turn_id\",\"rescind\":$( [ "$keep" = "true" ] && echo "false" || echo "true" )}"
}

get_state() {
    curl -s "${BASE_URL}/api/bot/state?tournament_id=${TOURNAMENT_ID}" "${HEADERS[@]}"
}

echo "=== Starting AURopt Tournament Player ==="
echo "Tournament: $TOURNAMENT_ID"
echo "Target: 15 periods (3 stages × 5 periods)"
echo ""

period_count=0
max_periods=15

while true; do
    # Check tournament state
    state=$(get_state)
    status=$(echo "$state" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tournament',{}).get('status',''))" 2>/dev/null)
    
    if [ "$status" = "completed" ]; then
        echo ""
        echo "=== Tournament Completed ==="
        echo "$state" | python3 -m json.tool
        break
    fi
    
    # Poll for turn
    turn_data=$(poll_turn)
    has_turn=$(echo "$turn_data" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('turn') else 'no')" 2>/dev/null)
    
    if [ "$has_turn" != "yes" ]; then
        sleep 2
        continue
    fi
    
    # Parse turn info
    turn_info=$(echo "$turn_data" | python3 -c "
import sys,json
d=json.load(sys.stdin)['turn']
print(f\"{d['id']}|{d['stage']}|{d['period']}|{d['decision_type']}\")
" 2>/dev/null)
    
    turn_id=$(echo "$turn_info" | cut -d'|' -f1)
    stage=$(echo "$turn_info" | cut -d'|' -f2)
    period=$(echo "$turn_info" | cut -d'|' -f3)
    decision_type=$(echo "$turn_info" | cut -d'|' -f4)
    
    period_count=$((period_count + 1))
    
    if [ "$decision_type" = "bid" ]; then
        floor=$(echo "$turn_data" | python3 -c "import sys,json; print(json.load(sys.stdin)['turn']['observation']['floor_price'])" 2>/dev/null)
        bid=$(get_bid $stage)
        
        result=$(submit_bid "$turn_id" "$bid")
        echo "P$period_count: S$((stage+1))P$((period+1)) - Bid \$$bid (floor \$$floor) - $result"
        
        # Check for rescind turn after win
        sleep 1
        rescind_data=$(poll_turn)
        rescind_check=$(echo "$rescind_data" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('turn') and d['turn']['decision_type']=='rescind' else 'no')" 2>/dev/null)
        
        if [ "$rescind_check" = "yes" ]; then
            rescind_turn_id=$(echo "$rescind_data" | python3 -c "import sys,json; print(json.load(sys.stdin)['turn']['id'])" 2>/dev/null)
            rescind_result=$(submit_rescind "$rescind_turn_id" "true")
            echo "  Rescind: KEEP - $rescind_result"
        fi
        
    elif [ "$decision_type" = "rescind" ]; then
        result=$(submit_rescind "$turn_id" "true")
        echo "Rescind decision: KEEP - $result"
    fi
    
    if [ $period_count -ge $max_periods ]; then
        echo ""
        echo "=== All 15 periods completed ==="
        final_state=$(get_state)
        echo "$final_state" | python3 -m json.tool
        break
    fi
done

echo ""
echo "=== Final Tournament State ==="
get_state | python3 -m json.tool
