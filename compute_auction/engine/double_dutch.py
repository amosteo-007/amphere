"""
Double Dutch Auction Engine - Compute Resource Market
Finite periods, descending price, first-accept wins
"""

import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from enum import Enum
import time

class AuctionStatus(Enum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

@dataclass
class AuctionState:
    """Full state visible to all bidders each period"""
    period: int                      # Current period (0 to max_periods)
    max_periods: int                 # Total periods in auction
    periods_remaining: int           # Periods left
    
    current_price: float             # Current compute unit price
    initial_price: float             # Starting price
    min_price: float                 # Floor price
    
    compute_units_available: int     # Units being auctioned
    compute_unit_value: float        # True value per unit (if known)
    
    active_bidders: List[str]        # Who's still in
    bids_this_period: Dict[str, float]  # Bids submitted this period (if any)
    
    # Historical for pattern detection
    price_history: List[float] = field(default_factory=list)
    accepted_periods: List[int] = field(default_factory=list)  # When others accepted

@dataclass 
class BidderState:
    """Private state for each bidder"""
    bidder_id: str
    remaining_budget: float
    initial_budget: float
    
    # History across all auctions (for learning)
    auctions_participated: int = 0
    auctions_won: int = 0
    total_profit: float = 0.0
    
    # This auction
    current_auction_bids: List[Tuple[int, float]] = field(default_factory=list)  # (period, price considered)
    
@dataclass
class AuctionResult:
    """Outcome of a single auction"""
    winner: Optional[str]
    winning_price: Optional[float]
    winning_period: Optional[int]
    
    total_bids_placed: int
    price_decline_curve: List[float]
    
    # Per-bidder outcomes
    bidder_outcomes: Dict[str, Dict] = field(default_factory=dict)


class DoubleDutchAuction:
    """
    Compute resource auction with finite discrete periods.
    Price descends each period. First ACCEPT wins immediately.
    """
    
    def __init__(
        self,
        auction_id: str,
        compute_units: int,
        unit_value: float,           # True value per unit
        initial_price: float,
        min_price: float,
        max_periods: int,
        price_decay: str = "linear"  # "linear" or "exponential"
    ):
        self.auction_id = auction_id
        self.compute_units = compute_units
        self.unit_value = unit_value
        self.initial_price = initial_price
        self.min_price = min_price
        self.max_periods = max_periods
        self.price_decay = price_decay
        
        self.period = 0
        self.status = AuctionStatus.PENDING
        self.winner: Optional[str] = None
        self.winning_price: Optional[float] = None
        self.winning_period: Optional[int] = None
        
        self.bidders: Dict[str, BidderState] = {}
        self.active_bidders: set = set()
        
        self.price_history: List[float] = [initial_price]
        self.action_log: List[Dict] = []
        
    def register_bidder(self, bidder_id: str, initial_budget: float):
        """Register a bidder with their budget"""
        self.bidders[bidder_id] = BidderState(
            bidder_id=bidder_id,
            remaining_budget=initial_budget,
            initial_budget=initial_budget
        )
        self.active_bidders.add(bidder_id)
        
    def start(self):
        """Begin the auction"""
        self.status = AuctionStatus.ACTIVE
        self.period = 0
        
    def get_current_price(self) -> float:
        """Calculate price for current period"""
        if self.price_decay == "linear":
            progress = self.period / self.max_periods
            return self.initial_price - (self.initial_price - self.min_price) * progress
        elif self.price_decay == "exponential":
            decay_rate = (self.min_price / self.initial_price) ** (1 / self.max_periods)
            return self.initial_price * (decay_rate ** self.period)
        return self.initial_price
    
    def get_public_state(self) -> AuctionState:
        """State visible to all bidders"""
        return AuctionState(
            period=self.period,
            max_periods=self.max_periods,
            periods_remaining=self.max_periods - self.period,
            current_price=self.get_current_price(),
            initial_price=self.initial_price,
            min_price=self.min_price,
            compute_units_available=self.compute_units,
            compute_unit_value=self.unit_value,
            active_bidders=list(self.active_bidders),
            bids_this_period={},
            price_history=self.price_history.copy(),
            accepted_periods=[]  # Could track when others dropped/accepted
        )
    
    def get_private_state(self, bidder_id: str) -> Dict:
        """Private state for specific bidder"""
        if bidder_id not in self.bidders:
            return {}
        bidder = self.bidders[bidder_id]
        return {
            "bidder_id": bidder_id,
            "remaining_budget": bidder.remaining_budget,
            "initial_budget": bidder.initial_budget,
            "budget_utilization": 1 - (bidder.remaining_budget / bidder.initial_budget),
            "can_afford": bidder.remaining_budget >= self.get_current_price()
        }
    
    def submit_action(self, bidder_id: str, action: str) -> Dict:
        """
        Process bidder action for current period.
        action: "ACCEPT" | "WAIT" | "PASS"
        """
        if self.status != AuctionStatus.ACTIVE:
            return {"error": "Auction not active", "status": self.status.value}
        
        if bidder_id not in self.active_bidders:
            return {"error": "Not active in auction"}
        
        current_price = self.get_current_price()
        
        # Log the action
        self.action_log.append({
            "period": self.period,
            "bidder": bidder_id,
            "action": action,
            "price": current_price
        })
        
        if action == "ACCEPT":
            bidder = self.bidders[bidder_id]
            
            # Check if can afford
            if bidder.remaining_budget < current_price:
                return {
                    "error": "Insufficient budget",
                    "required": current_price,
                    "available": bidder.remaining_budget
                }
            
            # WINNER!
            self.winner = bidder_id
            self.winning_price = current_price
            self.winning_period = self.period
            self.status = AuctionStatus.COMPLETED
            
            # Deduct from budget
            bidder.remaining_budget -= current_price
            bidder.auctions_won += 1
            bidder.current_auction_bids.append((self.period, current_price))
            
            # Calculate profit
            total_value = self.compute_units * self.unit_value
            profit = total_value - current_price
            bidder.total_profit += profit
            
            return {
                "result": "WIN",
                "price": current_price,
                "period": self.period,
                "profit": profit,
                "remaining_budget": bidder.remaining_budget
            }
        
        elif action == "PASS":
            # Permanently exit this auction
            self.active_bidders.discard(bidder_id)
            
        else:  # WAIT
            # Record consideration
            bidder = self.bidders[bidder_id]
            bidder.current_auction_bids.append((self.period, current_price))
        
        return {"result": "CONTINUE", "period": self.period}
    
    def advance_period(self) -> bool:
        """
        Move to next period. Returns False if auction ended.
        """
        if self.status == AuctionStatus.COMPLETED:
            return False
        
        self.period += 1
        
        # Check if max periods reached
        if self.period >= self.max_periods:
            self.status = AuctionStatus.COMPLETED
            return False
        
        # Check if any bidders remain
        if len(self.active_bidders) == 0:
            self.status = AuctionStatus.COMPLETED
            return False
        
        self.price_history.append(self.get_current_price())
        return True
    
    def get_result(self) -> AuctionResult:
        """Get final auction outcome"""
        bidder_outcomes = {}
        for bidder_id, bidder in self.bidders.items():
            won = (self.winner == bidder_id)
            cost = self.winning_price if won else 0
            profit = (self.compute_units * self.unit_value - cost) if won else 0
            
            bidder_outcomes[bidder_id] = {
                "won": won,
                "cost": cost,
                "profit": profit,
                "remaining_budget": bidder.remaining_budget,
                "bids_considered": bidder.current_auction_bids
            }
        
        return AuctionResult(
            winner=self.winner,
            winning_price=self.winning_price,
            winning_period=self.winning_period,
            total_bids_placed=len(self.action_log),
            price_decline_curve=self.price_history,
            bidder_outcomes=bidder_outcomes
        )
    
    def run_period_sync(self, actions: Dict[str, str]) -> Dict:
        """
        Synchronous: collect all actions for this period, process, advance.
        Returns state for next period or result.
        """
        results = {}
        
        # Process all actions
        for bidder_id, action in actions.items():
            if bidder_id in self.active_bidders:
                result = self.submit_action(bidder_id, action)
                results[bidder_id] = result
                
                # If someone won, auction ends immediately
                if result.get("result") == "WIN":
                    return {
                        "status": "COMPLETED",
                        "winner": bidder_id,
                        "results": results,
                        "auction_result": self.get_result()
                    }
        
        # Advance to next period
        continued = self.advance_period()
        
        if not continued:
            return {
                "status": "COMPLETED",
                "results": results,
                "auction_result": self.get_result()
            }
        
        # Return updated state
        return {
            "status": "CONTINUING",
            "period": self.period,
            "public_state": self.get_public_state(),
            "results": results
        }


def run_auction_tournament(
    auction_configs: List[Dict],
    bidders: List[Tuple[str, float]],  # (bidder_id, initial_budget)
    bidder_agents: Dict[str, callable]   # bidder_id -> agent function
) -> List[AuctionResult]:
    """
    Run multiple auctions in sequence with persistent budgets.
    """
    results = []
    
    for config in auction_configs:
        auction = DoubleDutchAuction(**config)
        
        # Register bidders with their current budgets
        for bidder_id, budget in bidders:
            auction.register_bidder(bidder_id, budget)
        
        auction.start()
        
        # Run auction period by period
        while auction.status == AuctionStatus.ACTIVE:
            # Collect actions from each agent
            actions = {}
            for bidder_id, _ in bidders:
                if bidder_id in auction.active_bidders:
                    public = auction.get_public_state()
                    private = auction.get_private_state(bidder_id)
                    actions[bidder_id] = bidder_agents[bidder_id](public, private)
            
            # Process period
            outcome = auction.run_period_sync(actions)
            
            if outcome["status"] == "COMPLETED":
                break
        
        # Record result and update budgets for next auction
        result = auction.get_result()
        results.append(result)
        
        # Update persistent budgets
        for i, (bidder_id, _) in enumerate(bidders):
            bidders[i] = (bidder_id, auction.bidders[bidder_id].remaining_budget)
    
    return results


if __name__ == "__main__":
    # Quick test
    auction = DoubleDutchAuction(
        auction_id="test_001",
        compute_units=100,
        unit_value=10.0,
        initial_price=1500.0,
        min_price=500.0,
        max_periods=10
    )
    
    auction.register_bidder("agent_a", 5000.0)
    auction.register_bidder("agent_b", 5000.0)
    auction.start()
    
    print(f"Auction started: {auction.max_periods} periods")
    print(f"Price range: {auction.initial_price} -> {auction.min_price}")
    
    # Simulate a few periods
    for _ in range(5):
        price = auction.get_current_price()
        print(f"Period {auction.period}: Price = {price:.2f}")
        
        actions = {"agent_a": "WAIT", "agent_b": "WAIT"}
        outcome = auction.run_period_sync(actions)
        
        if outcome["status"] == "COMPLETED":
            break
    
    # Now agent_a accepts
    result = auction.submit_action("agent_a", "ACCEPT")
    print(f"\nFinal: {result}")
    print(f"Winner: {auction.winner} at price {auction.winning_price}")