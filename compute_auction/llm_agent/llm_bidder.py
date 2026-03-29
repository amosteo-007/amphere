"""
LLM Agent with Scratchpad for Compute Auctions
Uses reasoning traces to strategize across finite periods
"""

import json
import os
from typing import Dict, Any, Optional
from dataclasses import asdict

# OpenClaw integration
LLM_BIDDER_PROMPT = """You are an AI agent bidding in a compute resource auction.

## AUCTION FORMAT: Double Dutch (Finite Periods)
- Price starts HIGH and decreases each period
- FIRST bidder to ACCEPT wins immediately at current price
- If you WAIT, someone else might snipe the auction
- If you PASS, you're out for this auction (save budget for next)

## YOUR GOAL
Maximize total profit across ALL auctions (not just this one).
- Each compute unit has a known value
- Paying less = more profit
- But losing = zero profit from this auction
- Budget carries over - conserve for future opportunities

## CURRENT AUCTION
Auction ID: {auction_id}
Compute Units Available: {compute_units}
Value per Unit: ${unit_value}
Total Value (if won): ${total_value}

## CURRENT STATE (Period {period}/{max_periods})
- Current Price: ${current_price}
- Periods Remaining: {periods_remaining}
- Active Bidders: {num_bidders} competing
- Your Budget: ${remaining_budget:.2f} / ${initial_budget:.2f}
- Can Afford: {can_afford}

## PRICE HISTORY (recent periods)
{price_history}

## YOUR SCRATCHPAD (Strategy Memory)
This records your reasoning from prior periods in this auction.
Use this to maintain consistency and detect patterns.

{scratchpad}

## YOUR AUCTION HISTORY
Auctions participated: {total_auctions}
Auctions won: {auctions_won}
Total profit so far: ${total_profit:.2f}

## STRATEGIC CONSIDERATIONS
1. **Immediate opportunity cost**: Current profit = ${current_profit:.2f} if you accept now
2. **Risk of waiting**: Someone else might accept; you get $0 from this auction
3. **Budget constraint**: Spending ${current_price} leaves ${budget_after:.2f} for future
4. **Future opportunities**: Expected {expected_auctions} more auctions, average value ~${expected_future_value:.2f}

## DECISION FRAMEWORK
Think through:
- Is current profit margin sufficient?
- How likely is someone else to accept soon?
- Should I conserve budget for better opportunities?
- Is this the right time to strike?

## OUTPUT FORMAT
Respond with JSON:
{{
    "action": "ACCEPT" | "WAIT" | "PASS",
    "reasoning": "Your strategic thinking (2-3 sentences)",
    "confidence": 0.0-1.0,
    "expected_opponent_behavior": "When do you think opponents will accept?",
    "scratchpad_update": "What to remember for next period (keep under 100 words)"
}}

Be decisive. The auction moves quickly."""


class LLMBidder:
    """
    LLM-powered bidder with scratchpad for cross-period reasoning.
    """
    
    def __init__(self, bidder_id: str, model: str = None):
        self.bidder_id = bidder_id
        self.model = model or "default"
        
        # Persistent state across auctions
        self.initial_budget = 0
        self.remaining_budget = 0
        self.total_auctions = 0
        self.auctions_won = 0
        self.total_profit = 0.0
        
        # Current auction state
        self.current_auction_id: Optional[str] = None
        self.scratchpad: list = []  # List of reasoning entries per period
        self.bids_considered: list = []  # (period, price)
        
        # History for pattern learning
        self.price_history: list = []  # Observed prices across auctions
        self.winning_periods: list = []  # When auctions typically end
        
    def register_for_auction(self, auction_id: str, initial_budget: float):
        """Called at start of tournament"""
        self.initial_budget = initial_budget
        self.remaining_budget = initial_budget
        
    def start_auction(self, auction_id: str, compute_units: int, unit_value: float):
        """Called at start of each auction"""
        self.current_auction_id = auction_id
        self.scratchpad = []  # Fresh scratchpad for this auction
        self.bids_considered = []
        
    def decide(self, public_state: Any, private_state: Dict) -> str:
        """
        Main decision function. Returns 'ACCEPT', 'WAIT', or 'PASS'.
        """
        # Update internal state
        self.remaining_budget = private_state.get("remaining_budget", self.remaining_budget)
        
        # Build prompt
        prompt = self._build_prompt(public_state, private_state)
        
        # For now, return a simple heuristic-based decision
        # In full implementation, this would call the LLM API
        action = self._heuristic_decide(public_state, private_state)
        
        # Update scratchpad
        self.scratchpad.append({
            "period": public_state.period,
            "price": public_state.current_price,
            "action": action,
            "reasoning": f"Price ${public_state.current_price:.0f} at period {public_state.period}"
        })
        
        self.bids_considered.append((public_state.period, public_state.current_price))
        
        return action
    
    def _build_prompt(self, public_state: Any, private_state: Dict) -> str:
        """Construct the LLM prompt with current state and scratchpad"""
        
        # Format price history (last 10 entries)
        price_history_str = "\n".join([
            f"  Period {i}: ${p:.2f}" 
            for i, p in enumerate(public_state.price_history[-10:])
        ]) if public_state.price_history else "  (auction just started)"
        
        # Format scratchpad
        scratchpad_str = "\n".join([
            f"  Period {entry['period']}: {entry['reasoning']}" 
            for entry in self.scratchpad[-5:]  # Last 5 entries
        ]) if self.scratchpad else "  (no prior thinking recorded)"
        
        # Calculate derived values
        total_value = public_state.compute_unit_value * public_state.compute_units_available
        current_profit = total_value - public_state.current_price
        budget_after = private_state.get("remaining_budget", 0) - public_state.current_price
        
        # Estimate future opportunities
        expected_auctions = 10  # Tournament parameter
        expected_future_value = total_value * 0.8  # Rough estimate
        
        return LLM_BIDDER_PROMPT.format(
            auction_id=self.current_auction_id or "unknown",
            compute_units=public_state.compute_units_available,
            unit_value=public_state.compute_unit_value,
            total_value=total_value,
            period=public_state.period,
            max_periods=public_state.max_periods,
            periods_remaining=public_state.periods_remaining,
            current_price=public_state.current_price,
            num_bidders=len(public_state.active_bidders),
            remaining_budget=private_state.get("remaining_budget", 0),
            initial_budget=private_state.get("initial_budget", 1),
            can_afford="YES" if private_state.get("can_afford", False) else "NO",
            price_history=price_history_str,
            scratchpad=scratchpad_str,
            total_auctions=self.total_auctions,
            auctions_won=self.auctions_won,
            total_profit=self.total_profit,
            current_profit=max(0, current_profit),
            budget_after=budget_after,
            expected_auctions=expected_auctions,
            expected_future_value=expected_future_value
        )
    
    def _heuristic_decide(self, public_state: Any, private_state: Dict) -> str:
        """
        Simple heuristic for testing without LLM call.
        Can be replaced with actual LLM call.
        """
        current_price = public_state.current_price
        unit_value = public_state.compute_unit_value
        units = public_state.compute_units_available
        total_value = unit_value * units
        remaining_budget = private_state.get("remaining_budget", 0)
        
        # Cannot afford
        if current_price > remaining_budget:
            return "PASS"
        
        # Simple threshold strategy (for testing)
        threshold = total_value * 0.70  # 70% of value
        
        if current_price <= threshold:
            return "ACCEPT"
        
        return "WAIT"
    
    def _llm_decide(self, public_state: Any, private_state: Dict) -> str:
        """
        Full LLM call implementation.
        This would call the actual model API.
        """
        prompt = self._build_prompt(public_state, private_state)
        
        # In actual implementation:
        # response = call_llm_api(prompt, model=self.model, temperature=0.3)
        # result = json.loads(response)
        # 
        # # Update scratchpad with LLM's reasoning
        # self.scratchpad.append({
        #     "period": public_state.period,
        #     "price": public_state.current_price,
        #     "action": result["action"],
        #     "reasoning": result["reasoning"],
        #     "confidence": result["confidence"]
        # })
        # 
        # return result["action"]
        
        # Fallback to heuristic for now
        return self._heuristic_decide(public_state, private_state)
    
    def record_outcome(self, won: bool, price: float, profit: float):
        """Called after auction completes"""
        self.total_auctions += 1
        
        if won:
            self.auctions_won += 1
            self.total_profit += profit
            self.remaining_budget -= price
            self.winning_periods.append({"auction": self.current_auction_id, "period": len(self.scratchpad)})
        else:
            self.total_profit += 0  # Lost auctions contribute no profit
        
        # Record price for pattern learning
        self.price_history.append(price if price else 0)
        
    def get_scratchpad_log(self) -> list:
        """Export scratchpad for analysis"""
        return self.scratchpad
    
    def get_agent_summary(self) -> Dict:
        """Summary statistics for this agent"""
        return {
            "bidder_id": self.bidder_id,
            "model": self.model,
            "auctions_participated": self.total_auctions,
            "auctions_won": self.auctions_won,
            "win_rate": self.auctions_won / max(1, self.total_auctions),
            "total_profit": self.total_profit,
            "remaining_budget": self.remaining_budget,
            "budget_efficiency": self.total_profit / max(1, self.initial_budget - self.remaining_budget) if self.initial_budget != self.remaining_budget else 0
        }


# =============================================================================
# PROMPT VARIANTS FOR EXPERIMENTATION
# =============================================================================

PROMPT_VARIANTS = {
    "analytical": """You are a strategic bidding analyst. Use cold logic:
- Calculate expected value of accepting vs waiting
- Consider opponent behavior probabilistically  
- Optimize for long-run profit, not just this auction
Be precise and quantitative in your reasoning.""",

    "intuitive": """You are an experienced auction participant. Trust your gut:
- Feel the rhythm of the auction
- Read the room (competitor behavior)
- When the price feels right, strike
Describe your intuitions clearly.""",

    "adaptive": """You are an adaptive learner. Track patterns:
- What prices have won recently?
- Are opponents aggressive or conservative?
- Adjust your strategy based on observed behavior
Explicitly state what you've learned.""",

    "risk_averse": """You are a conservative risk manager. Prioritize:
- Protecting your budget
- Only accepting deals with clear positive expected value
- Avoiding the winner's curse
Be cautious and patient.""",

    "risk_seeking": """You are an aggressive opportunist. Focus on:
- Securing compute before competitors
- Willingness to pay above average for guaranteed wins
- Building momentum through early victories
Be decisive and bold."""
}


# =============================================================================
# TEST
# =============================================================================

if __name__ == "__main__":
    from dataclasses import dataclass
    
    @dataclass
    class MockPublic:
        period: int
        max_periods: int
        periods_remaining: int
        current_price: float
        initial_price: float
        min_price: float
        compute_units_available: int
        compute_unit_value: float
        active_bidders: list
        bids_this_period: dict
        price_history: list
        accepted_periods: list
    
    print("Testing LLM Bidder:\n")
    
    agent = LLMBidder("llm_agent_001")
    agent.register_for_auction("tournament_001", 10000.0)
    agent.start_auction("auction_001", 100, 10.0)
    
    # Simulate several periods
    for period in range(0, 15, 3):
        public = MockPublic(
            period=period,
            max_periods=20,
            periods_remaining=20-period,
            current_price=1500 - period * 70,  # Descending
            initial_price=1500,
            min_price=400,
            compute_units_available=100,
            compute_unit_value=10.0,
            active_bidders=["llm_agent_001", "mdp_aggressive", "mdp_conservative"],
            bids_this_period={},
            price_history=[1500 - i*70 for i in range(period+1)],
            accepted_periods=[]
        )
        
        private = {
            "remaining_budget": 10000 - (period * 100),  # Simulated spending
            "initial_budget": 10000,
            "can_afford": True
        }
        
        action = agent.decide(public, private)
        print(f"Period {period}: Price ${public.current_price:.0f} -> Action: {action}")
    
    print(f"\nFinal Scratchpad:")
    for entry in agent.get_scratchpad_log():
        print(f"  {entry}")
    
    print(f"\nAgent Summary:")
    print(json.dumps(agent.get_agent_summary(), indent=2))