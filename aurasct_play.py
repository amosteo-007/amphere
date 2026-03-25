#!/usr/bin/env python3
"""AURopt autonomous tournament player - plays all 15 periods"""
import requests
import time
import json

API_KEY = "56507a5f129f462f4f5177011db250ebfade6199eb98b59a7912b95a936fc230"
BYPASS_TOKEN = "UFRVUdeB2HfQThpYm67thG83UiU9MVun"
BASE_URL = "https://aurasct0808.vercel.app"
TOURNAMENT_ID = "de574692-8cca-4bd4-b1cf-8ac2bab2d8aa"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "X-Bypass-Token": BYPASS_TOKEN,
    "Content-Type": "application/json"
}

def get_bid(stage, floor_price):
    """Calculate bid based on stage"""
    if stage == 0:  # S1 floor $10
        return 14  # $12-15 range
    elif stage == 1:  # S2 floor $15
        return 20  # $18-22 range
    else:  # S3 floor $28
        return 32  # $30-35 range

def poll_turn():
    """Poll for next turn"""
    resp = requests.get(f"{BASE_URL}/api/bot/pending-multi-turn", headers=HEADERS)
    return resp.json()

def submit_bid(turn_id, price):
    """Submit bid decision"""
    payload = {"turn_id": turn_id, "price_per_token": price}
    resp = requests.post(f"{BASE_URL}/api/tournaments/{TOURNAMENT_ID}/human-bid", 
                         headers=HEADERS, json=payload)
    return resp.json()

def submit_rescind(turn_id, keep=True):
    """Submit rescind decision"""
    payload = {"turn_id": turn_id, "rescind": not keep}
    resp = requests.post(f"{BASE_URL}/api/tournaments/{TOURNAMENT_ID}/human-bid", 
                         headers=HEADERS, json=payload)
    return resp.json()

def get_state():
    """Get tournament state"""
    resp = requests.get(f"{BASE_URL}/api/bot/state?tournament_id={TOURNAMENT_ID}", headers=HEADERS)
    return resp.json()

def play_tournament():
    """Play all 15 periods autonomously"""
    results = []
    period_count = 0
    
    while True:
        # Check tournament state
        state = get_state()
        if state.get("tournament", {}).get("status") == "completed":
            print("Tournament completed!")
            break
        
        # Poll for turn
        turn_data = poll_turn()
        
        if not turn_data.get("turn"):
            time.sleep(2)
            continue
        
        turn = turn_data["turn"]
        stage = turn["stage"]
        period = turn["period"]
        decision_type = turn["decision_type"]
        turn_id = turn["id"]
        
        period_count += 1
        
        if decision_type == "bid":
            floor = turn["observation"]["floor_price"]
            bid = get_bid(stage, floor)
            
            result = submit_bid(turn_id, bid)
            print(f"P{period_count}: S{stage+1}P{period+1} - Bid ${bid} (floor ${floor}) - {result}")
            
            results.append({
                "stage": stage,
                "period": period,
                "bid": bid,
                "floor": floor,
                "result": result
            })
            
            # Check for win and rescind
            time.sleep(1)
            turn_data = poll_turn()
            if turn_data.get("turn") and turn_data["turn"]["decision_type"] == "rescind":
                rescind_turn = turn_data["turn"]
                # Default: KEEP all wins
                rescind_result = submit_rescind(rescind_turn["id"], keep=True)
                print(f"  Rescind decision: KEEP - {rescind_result}")
        
        elif decision_type == "rescind":
            # Handle rescind decision
            rescind_result = submit_rescind(turn_id, keep=True)
            print(f"Rescind: KEEP - {rescind_result}")
        
        if period_count >= 15:
            print("All 15 periods completed!")
            break
    
    # Final state
    final_state = get_state()
    print("\n=== FINAL RESULTS ===")
    print(json.dumps(final_state, indent=2))
    
    return results

if __name__ == "__main__":
    play_tournament()
