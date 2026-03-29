"""
Deterministic MDP Scripts - Compute Auction Bidders
Each script implements a specific strategic profile derived from MDP optimal policies.
"""

import math
from typing import Dict, Any, Tuple
import json

# Base class for MDP scripts
class MDPBidder:
    """Base class for deterministic MDP-based bidders"""
    
    def __init__(self, bidder_id: str, params: Dict = None):
        self.bidder_id = bidder_id
        self.params = params or {}
        self.scratchpad: list = []  # Track reasoning
        
    def decide(self, public_state: Any, private_state: Dict) -> str:
        """Return 'ACCEPT', 'WAIT', or 'PASS'"""
        raise NotImplementedError
    
    def get_scratchpad(self) -> str:
        """Return reasoning log"""
        return "\n".join(self.scratchpad[-10:])  # Last 10 entries


# =============================================================================
# CATEGORY A: THRESHOLD-BASED SCRIPTS (Simple Optimal Policies)
# =============================================================================

class ThresholdMyopic(MDPBidder):
    """
    MDP Script A1: Myopic Optimal
    Solves single-auction MDP without considering budget coupling.
    Accepts when price reaches threshold % of value.
    
    Real-world analog: Small compute buyer who treats each auction independently
    """
    
    def __init__(self, bidder_id: str, params: Dict = None):
        super().__init__(bidder_id, params)
        self.threshold_ratio = params.get("threshold_ratio", 0.75)  # Accept at 75% of value
        
    def decide(self, public_state, private_state: Dict) -> str:
        current_price = public_state.current_price
        unit_value = public_state.compute_unit_value
        units = public_state.compute_units_available
        
        # Total value of this compute batch
        total_value = unit_value * units
        threshold_price = total_value * self.threshold_ratio
        
        remaining_budget = private_state.get("remaining_budget", 0)
        
        self.scratchpad.append(f"[{public_state.period}] Myopic analysis:")
        self.scratchpad.append(f"  Value: ${total_value:.2f}, Price: ${current_price:.2f}")
        self.scratchpad.append(f"  Threshold: ${threshold_price:.2f} ({self.threshold_ratio*100:.0f}%)")
        
        # Cannot afford
        if current_price > remaining_budget:
            self.scratchpad.append(f"  → PASS (cannot afford, have ${remaining_budget:.2f})")
            return "PASS"
        
        # Check threshold
        if current_price <= threshold_price:
            self.scratchpad.append(f"  → ACCEPT (price at/below threshold)")
            return "ACCEPT"
        
        self.scratchpad.append(f"  → WAIT (price above threshold)")
        return "WAIT"


class ThresholdConservative(MDPBidder):
    """
    MDP Script A2: Conservative with Budget Buffer
    Maintains minimum budget reserve, waits for deep discounts.
    
    Real-world analog: Large enterprise buyer with procurement discipline
    """
    
    def __init__(self, bidder_id: str, params: Dict = None):
        super().__init__(bidder_id, params)
        self.base_threshold = params.get("base_threshold", 0.60)  # 60% of value
        self.budget_buffer = params.get("budget_buffer", 0.30)    # Keep 30% buffer
        
    def decide(self, public_state, private_state: Dict) -> str:
        current_price = public_state.current_price
        unit_value = public_state.compute_unit_value
        units = public_state.compute_units_available
        
        total_value = unit_value * units
        remaining_budget = private_state.get("remaining_budget", 0)
        initial_budget = private_state.get("initial_budget", 1)
        
        # Calculate dynamic threshold
        budget_ratio = remaining_budget / initial_budget
        buffer_required = initial_budget * self.budget_buffer
        
        # Adjust threshold based on budget health
        threshold = total_value * self.base_threshold
        if remaining_budget < buffer_required:
            # Low on budget: be more conservative
            threshold *= 0.90
            self.scratchpad.append(f"[{public_state.period}] CONSERVATIVE (low budget mode):")
        else:
            self.scratchpad.append(f"[{public_state.period}] CONSERVATIVE (normal mode):")
        
        self.scratchpad.append(f"  Value: ${total_value:.2f}")
        self.scratchpad.append(f"  Budget: ${remaining_budget:.2f}/{initial_budget:.2f} ({budget_ratio*100:.1f}%)")
        self.scratchpad.append(f"  Price: ${current_price:.2f}, Threshold: ${threshold:.2f}")
        
        # Cannot afford
        if current_price > remaining_budget:
            self.scratchpad.append(f"  → PASS (insufficient funds)")
            return "PASS"
        
        # Below threshold - accept
        if current_price <= threshold:
            # Check if we'd keep enough buffer
            if remaining_budget - current_price >= buffer_required * 0.5:
                self.scratchpad.append(f"  → ACCEPT (meets threshold, buffer preserved)")
                return "ACCEPT"
            else:
                self.scratchpad.append(f"  → WAIT (would violate budget buffer)")
                return "WAIT"
        
        self.scratchpad.append(f"  → WAIT (price above threshold)")
        return "WAIT"


class ThresholdAggressive(MDPBidder):
    """
    MDP Script A3: Aggressive Early Bidding
    Accepts earlier to preempt competition. Higher threshold, acts on competition signals.
    
    Real-world analog: Startup with urgent compute needs, willing to pay premium
    """
    
    def __init__(self, bidder_id: str, params: Dict = None):
        super().__init__(bidder_id, params)
        self.base_threshold = params.get("base_threshold", 0.85)  # 85% of value
        self.competition_urgency = params.get("competition_urgency", True)
        
    def decide(self, public_state, private_state: Dict) -> str:
        current_price = public_state.current_price
        unit_value = public_state.compute_unit_value
        units = public_state.compute_units_available
        num_active = len(public_state.active_bidders)
        
        total_value = unit_value * units
        remaining_budget = private_state.get("remaining_budget", 0)
        
        # Calculate urgency factor based on competition
        threshold = total_value * self.base_threshold
        if self.competition_urgency and num_active > 2:
            # More competitors = more urgency
            urgency = min(0.15, (num_active - 2) * 0.03)
            adjusted_threshold = threshold * (1 + urgency)
            urgency_note = f"(urgency +{urgency*100:.0f}% from {num_active} bidders)"
        else:
            adjusted_threshold = threshold
            urgency_note = ""
        
        self.scratchpad.append(f"[{public_state.period}] AGGRESSIVE:")
        self.scratchpad.append(f"  Value: ${total_value:.2f}, Price: ${current_price:.2f}")
        self.scratchpad.append(f"  Base threshold: ${threshold:.2f}")
        self.scratchpad.append(f"  Adjusted: ${adjusted_threshold:.2f} {urgency_note}")
        
        # Cannot afford
        if current_price > remaining_budget:
            self.scratchpad.append(f"  → PASS (out of budget)")
            return "PASS"
        
        # Accept if at or below adjusted threshold
        if current_price <= adjusted_threshold:
            self.scratchpad.append(f"  → ACCEPT (preempt strike!)")
            return "ACCEPT"
        
        # Special: Late in auction, become more aggressive
        progress = public_state.period / public_state.max_periods
        if progress > 0.7 and current_price <= total_value * 0.95:
            self.scratchpad.append(f"  → ACCEPT (late game, avoiding loss)")
            return "ACCEPT"
        
        self.scratchpad.append(f"  → WAIT (holding for better price)")
        return "WAIT"


# =============================================================================
# CATEGORY B: DYNAMIC PROGRAMMING SCRIPTS (Multi-Auction Aware)
# =============================================================================

class VIOptimalBidder(MDPBidder):
    """
    MDP Script B1: Value Iteration Optimal
    Pre-computed value function considering budget coupling across auctions.
    
    Real-world analog: Sophisticated procurement team with optimization models
    """
    
    def __init__(self, bidder_id: str, params: Dict = None):
        super().__init__(bidder_id, params)
        self.discount_factor = params.get("gamma", 0.95)
        self.expected_auctions_remaining = params.get("expected_auctions", 10)
        
    def _calculate_marginal_value_of_budget(self, private_state: Dict) -> float:
        """
        Shadow price of budget: how much is the next dollar worth?
        Simplified: linear decay based on budget remaining
        """
        remaining = private_state.get("remaining_budget", 0)
        initial = private_state.get("initial_budget", 1)
        
        # Budget becomes more valuable as it depletes
        budget_fraction = remaining / initial
        shadow_price = 1.0 / (0.1 + 0.9 * budget_fraction)  # 1.0 when full, ~10x when empty
        
        return shadow_price
    
    def _estimate_future_opportunity_value(self, public_state, private_state: Dict) -> float:
        """
        Expected value of keeping budget for future auctions.
        """
        remaining_budget = private_state.get("remaining_budget", 0)
        expected_future = self.expected_auctions_remaining
        
        # Average expected value per future auction
        avg_value = public_state.compute_unit_value * public_state.compute_units_available * 0.4
        
        # Discounted by time and probability of future opportunities
        future_value = avg_value * expected_future * (self.discount_factor ** public_state.period)
        
        return future_value
    
    def decide(self, public_state, private_state: Dict) -> str:
        current_price = public_state.current_price
        unit_value = public_state.compute_unit_value
        units = public_state.compute_units_available
        total_value = unit_value * units
        
        remaining_budget = private_state.get("remaining_budget", 0)
        
        # Calculate components
        immediate_profit = total_value - current_price
        shadow_price = self._calculate_marginal_value_of_budget(private_state)
        future_opportunity = self._estimate_future_opportunity_value(public_state, private_state)
        
        # Effective cost includes opportunity cost
        effective_cost = current_price + (current_price * 0.1 * shadow_price)
        
        # Value of accepting vs waiting
        value_accept = immediate_profit
        value_wait = future_opportunity * 0.1  # Small chance of getting future opportunity
        
        self.scratchpad.append(f"[{public_state.period}] VI OPTIMAL (multi-auction aware):")
        self.scratchpad.append(f"  Current auction value: ${total_value:.2f}")
        self.scratchpad.append(f"  Price: ${current_price:.2f}, Immediate profit: ${immediate_profit:.2f}")
        self.scratchpad.append(f"  Shadow price of budget: {shadow_price:.2f}x")
        self.scratchpad.append(f"  Effective cost: ${effective_cost:.2f}")
        self.scratchpad.append(f"  Value(accept): ${value_accept:.2f}, Value(wait): ${value_wait:.2f}")
        
        # Cannot afford
        if current_price > remaining_budget:
            self.scratchpad.append(f"  → PASS (budget constraint)")
            return "PASS"
        
        # Bellman-style decision
        if value_accept > value_wait and immediate_profit > 0:
            self.scratchpad.append(f"  → ACCEPT (positive net value, beats waiting)")
            return "ACCEPT"
        
        self.scratchpad.append(f"  → WAIT (waiting value higher or negative profit)")
        return "WAIT"


class OpportunityCostBidder(MDPBidder):
    """
    MDP Script B2: Opportunity Cost Aware
    Explicitly trades off current auction vs expected future opportunities.
    
    Real-world analog: Portfolio manager optimizing across compute contracts
    """
    
    def __init__(self, bidder_id: str, params: Dict = None):
        super().__init__(bidder_id, params)
        self.min_profit_margin = params.get("min_margin", 0.30)  # Need 30% profit
        
    def decide(self, public_state, private_state: Dict) -> str:
        current_price = public_state.current_price
        unit_value = public_state.compute_unit_value
        units = public_state.compute_units_available
        total_value = unit_value * units
        
        remaining_budget = private_state.get("remaining_budget", 0)
        initial_budget = private_state.get("initial_budget", 1)
        
        # Calculate remaining budget as % of expected future need
        expected_future_cost = initial_budget * 0.6  # Expect to use 60% of budget in future
        budget_pressure = (expected_future_cost - remaining_budget) / initial_budget
        budget_pressure = max(0, budget_pressure)
        
        # Adjust required margin based on budget pressure
        required_margin = self.min_profit_margin + (budget_pressure * 0.2)
        min_acceptable_price = total_value * (1 - required_margin)
        
        # Opportunity cost: what could we buy with this money later?
        opportunity_value = remaining_budget * 0.15  # 15% return on preserved budget
        
        self.scratchpad.append(f"[{public_state.period}] OPPORTUNITY COST:")
        self.scratchpad.append(f"  Total value: ${total_value:.2f}")
        self.scratchpad.append(f"  Current price: ${current_price:.2f}")
        self.scratchpad.append(f"  Budget: ${remaining_budget:.2f}, Pressure: {budget_pressure*100:.0f}%")
        self.scratchpad.append(f"  Required margin: {required_margin*100:.0f}%")
        self.scratchpad.append(f"  Min acceptable price: ${min_acceptable_price:.2f}")
        self.scratchpad.append(f"  Opportunity value of preservation: ${opportunity_value:.2f}")
        
        # Cannot afford
        if current_price > remaining_budget:
            self.scratchpad.append(f"  → PASS (cannot afford)")
            return "PASS"
        
        # Decision
        if current_price <= min_acceptable_price:
            profit = total_value - current_price
            if profit > opportunity_value * 0.5:  # Must beat half the opportunity cost
                self.scratchpad.append(f"  → ACCEPT (profit ${profit:.2f} beats opportunity)")
                return "ACCEPT"
            else:
                self.scratchpad.append(f"  → WAIT (profit doesn't justify spending)")
                return "WAIT"
        
        self.scratchpad.append(f"  → WAIT (price above margin requirement)")
        return "WAIT"


# =============================================================================
# CATEGORY C: ADAPTIVE/PATTERN-BASED SCRIPTS
# =============================================================================

class PatternExploiter(MDPBidder):
    """
    MDP Script C1: Pattern Exploiter
    Learns opponent acceptance patterns from history, exploits them.
    
    Real-world analog: Algorithmic trader adapting to predictable opponents
    """
    
    def __init__(self, bidder_id: str, params: Dict = None):
        super().__init__(bidder_id, params)
        self.opponent_history: Dict[str, list] = {}
        self.my_observations: list = []  # (period, price, who_won_if_any)
        
    def record_observation(self, auction_result: Dict):
        """Called after each auction to learn"""
        if auction_result.get("winning_period"):
            self.my_observations.append({
                "period": auction_result["winning_period"],
                "price": auction_result["winning_price"],
                "winner": auction_result["winner"]
            })
    
    def _estimate_opponent_threshold(self) -> float:
        """Infer where opponents typically accept"""
        if len(self.my_observations) < 3:
            return 0.70  # Default assumption: 70%
        
        # Look at winning prices relative to expected values
        # Simplified: assume consistent value per unit
        recent = self.my_observations[-5:]
        avg_price_ratio = sum(o["period"] for o in recent) / len(recent)
        # Map period to price ratio (linear decay assumption)
        inferred_threshold = 0.75 - (avg_price_ratio / 100)  # Rough heuristic
        
        return max(0.50, min(0.90, inferred_threshold))
    
    def decide(self, public_state, private_state: Dict) -> str:
        current_price = public_state.current_price
        unit_value = public_state.compute_unit_value
        units = public_state.compute_units_available
        total_value = unit_value * units
        
        remaining_budget = private_state.get("remaining_budget", 0)
        
        # Infer opponent acceptance threshold
        opp_threshold = self._estimate_opponent_threshold()
        expected_opp_accept_price = total_value * opp_threshold
        
        # Strategy: bid just before they typically accept
        my_target = expected_opp_accept_price + (total_value * 0.05)  # 5% buffer above
        
        self.scratchpad.append(f"[{public_state.period}] PATTERN EXPLOITER:")
        self.scratchpad.append(f"  Observed {len(self.my_observations)} prior auctions")
        self.scratchpad.append(f"  Inferred opponent threshold: {opp_threshold*100:.0f}%")
        self.scratchpad.append(f"  Expected opponent accepts at: ${expected_opp_accept_price:.2f}")
        self.scratchpad.append(f"  Current price: ${current_price:.2f}")
        self.scratchpad.append(f"  My target: ${my_target:.2f}")
        
        # Cannot afford
        if current_price > remaining_budget:
            self.scratchpad.append(f"  → PASS (budget insufficient)")
            return "PASS"
        
        # Accept if we're near the expected opponent strike point
        if current_price <= my_target and current_price > expected_opp_accept_price * 0.95:
            self.scratchpad.append(f"  → ACCEPT (exploiting predicted opponent threshold)")
            return "ACCEPT"
        
        # Emergency: if price drops below expected opp threshold, they might snipe
        if current_price <= expected_opp_accept_price * 0.98:
            self.scratchpad.append(f"  → ACCEPT (emergency: opponent likely to strike)")
            return "ACCEPT"
        
        self.scratchpad.append(f"  → WAIT (waiting for exploit window)")
        return "WAIT"


class SignalingResponder(MDPBidder):
    """
    MDP Script C2: Signaling Responder
    Responds to observed aggression patterns in opponent behavior.
    
    Real-world analog: Strategic buyer who reads market sentiment
    """
    
    def __init__(self, bidder_id: str, params: Dict = None):
        super().__init__(bidder_id, params)
        self.aggression_memory: list = []  # Track recent auction aggression
        
    def decide(self, public_state, private_state: Dict) -> str:
        current_price = public_state.current_price
        unit_value = public_state.compute_unit_value
        units = public_state.compute_units_available
        total_value = unit_value * units
        
        remaining_budget = private_state.get("remaining_budget", 0)
        periods_remaining = public_state.periods_remaining
        
        # Infer market aggression from active bidders and timing
        # (In real implementation, would use actual bid patterns)
        num_active = len(public_state.active_bidders)
        progress = public_state.period / public_state.max_periods
        
        # Heuristic: early acceptance suggests aggression
        aggression_score = 0
        if num_active <= 2 and progress < 0.5:
            aggression_score = 0.8  # Few bidders still in early = aggressive competition
            self.scratchpad.append(f"[{public_state.period}] SIGNALING (AGGRESSION DETECTED):")
        elif num_active >= 4 and progress > 0.3:
            aggression_score = 0.3  # Many bidders, passed early rounds = conservative
            self.scratchpad.append(f"[{public_state.period}] SIGNALING (conservative market):")
        else:
            aggression_score = 0.5
            self.scratchpad.append(f"[{public_state.period}] SIGNALING (neutral market):")
        
        # Adjust strategy based on aggression
        if aggression_score > 0.6:
            # Aggressive market: accept early or fold
            threshold = total_value * 0.80
            strategy = "aggressive_response"
        elif aggression_score < 0.4:
            # Conservative market: wait for deep discounts
            threshold = total_value * 0.55
            strategy = "conservative_response"
        else:
            # Balanced: moderate approach
            threshold = total_value * 0.70
            strategy = "balanced"
        
        self.scratchpad.append(f"  Detected aggression: {aggression_score*100:.0f}%")
        self.scratchpad.append(f"  Responding with: {strategy}")
        self.scratchpad.append(f"  Price: ${current_price:.2f}, Threshold: ${threshold:.2f}")
        
        # Cannot afford
        if current_price > remaining_budget:
            self.scratchpad.append(f"  → PASS (budget limit)")
            return "PASS"
        
        # Execute strategy
        if current_price <= threshold:
            self.scratchpad.append(f"  → ACCEPT ({strategy} threshold met)")
            return "ACCEPT"
        
        # Late game adjustment
        if periods_remaining <= 2 and aggression_score > 0.5:
            self.scratchpad.append(f"  → ACCEPT (late game, aggression high)")
            return "ACCEPT"
        
        self.scratchpad.append(f"  → WAIT (holding for {strategy} price)")
        return "WAIT"


# =============================================================================
# REGISTRY: Factory for creating bidders
# =============================================================================

BIDDER_REGISTRY = {
    "myopic": ThresholdMyopic,
    "conservative": ThresholdConservative,
    "aggressive": ThresholdAggressive,
    "vi_optimal": VIOptimalBidder,
    "opportunity_cost": OpportunityCostBidder,
    "pattern_exploiter": PatternExploiter,
    "signaling_responder": SignalingResponder,
}

def create_bidder(bidder_type: str, bidder_id: str, params: Dict = None) -> MDPBidder:
    """Factory function to create any registered bidder type"""
    if bidder_type not in BIDDER_REGISTRY:
        raise ValueError(f"Unknown bidder type: {bidder_type}. Available: {list(BIDDER_REGISTRY.keys())}")
    
    params = params or {}
    return BIDDER_REGISTRY[bidder_type](bidder_id, params)


# =============================================================================
# TEST
# =============================================================================

if __name__ == "__main__":
    # Mock state for testing
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
    
    public = MockPublic(
        period=5,
        max_periods=20,
        periods_remaining=15,
        current_price=800.0,
        initial_price=1500.0,
        min_price=400.0,
        compute_units_available=100,
        compute_unit_value=10.0,
        active_bidders=["bidder_a", "bidder_b", "bidder_c"],
        bids_this_period={},
        price_history=[1500, 1450, 1400, 1350, 1300, 1250, 1200, 1150, 1100, 1050, 1000, 950, 900, 850, 800],
        accepted_periods=[]
    )
    
    private = {
        "remaining_budget": 5000.0,
        "initial_budget": 5000.0,
        "budget_utilization": 0.0,
        "can_afford": True
    }
    
    print("Testing MDP Scripts:\n")
    
    for script_name in ["myopic", "conservative", "aggressive", "vi_optimal", "opportunity_cost"]:
        bidder = create_bidder(script_name, f"test_{script_name}")
        action = bidder.decide(public, private)
        print(f"\n{script_name.upper()}:")
        print(f"  Action: {action}")
        print(f"  Scratchpad:\n{bidder.get_scratchpad()}")