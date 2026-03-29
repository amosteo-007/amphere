#!/usr/bin/env python3
"""
AMP Live MDP Oracle

Runs at the start of each tournament period.
Input: Current tournament state (budget, tokens, SP, etc.)
Output: Optimal bid + rescind recommendation for each agent

This is injected into the LLM system prompt at runtime.
"""

import json
import sys
import math
from typing import Dict, List, Optional
from dataclasses import dataclass

# =============================================================================
# Tournament Config
# =============================================================================

@dataclass
class TournamentConfig:
    stages: int = 3
    periods_per_stage: int = 5
    initial_budget: float = 10000.0
    
    tokens_per_stage: tuple = (120, 80, 40)
    floor_per_stage: tuple = (10.0, 15.0, 28.0)
    multiplier_per_stage: tuple = (1.0, 1.5, 3.0)
    
    sp_1st: int = 3
    sp_2nd: int = 2
    sp_3rd: int = 1
    
    rescind_tax_rate: float = 0.10
    rescind_reveal_delay: int = 2
    rescind_forbidden: tuple = ((3, 4), (3, 5))

CONFIG = TournamentConfig()

# =============================================================================
# Equilibrium Trajectory (from MDP solver)
# =============================================================================

EQUILIBRIUM_TRAJECTORY = [
    # (period, stage, period_in_stage, bid_multiple, bid_price, win_prob, expected_cost)
    (0, 1, 1, 1.80, 18.0, 0.073, 2059.07),
    (1, 1, 2, 2.00, 20.0, 0.372, 2092.81),
    (2, 1, 3, 2.20, 22.0, 0.961, 2269.40),
    (3, 1, 4, 1.20, 12.0, 0.017, 1246.54),
    (4, 1, 5, 2.50, 25.0, 1.000, 2479.79),
    (5, 2, 1, 2.10, 31.5, 1.000, 2515.91),
    (6, 2, 2, 2.30, 34.5, 1.000, 2556.79),
    (7, 2, 3, 0.00, None, 0.000, 0.00),  # SKIP
    (8, 2, 4, 0.00, None, 0.000, 0.00),  # SKIP
    (9, 2, 5, 0.00, None, 0.000, 0.00),  # SKIP
    (10, 3, 1, 0.00, None, 0.000, 0.00),  # SKIP
    (11, 3, 2, 0.00, None, 0.000, 0.00),  # SKIP
    (12, 3, 3, 0.00, None, 0.000, 0.00),  # SKIP
    (13, 3, 4, 0.00, None, 0.000, 0.00),  # SKIP
    (14, 3, 5, 0.00, None, 0.000, 0.00),  # SKIP
]

# =============================================================================
# Live MDP Oracle
# =============================================================================

class LiveMDPOracle:
    """
    Computes optimal bid + rescind for current tournament state.
    """
    
    def __init__(self, config: TournamentConfig = CONFIG):
        self.config = config
    
    def get_optimal_action(self, 
                           stage: int, 
                           period: int, 
                           budget: float, 
                           tokens_held: int,
                           sp: int,
                           sp_gap: int,
                           phantom_tokens: int = 0) -> Dict:
        """
        Compute optimal action for current period.
        
        Returns: {
            "bid_price": float or None (for skip),
            "bid_multiple": float,
            "skip": bool,
            "rescind_if_win": bool,
            "reasoning": str,
            "confidence": str
        }
        """
        global_period = (stage - 1) * 5 + (period - 1)
        
        # Get equilibrium recommendation
        if global_period < len(EQUILIBRIUM_TRAJECTORY):
            eq = EQUILIBRIUM_TRAJECTORY[global_period]
            base_multiple = eq[3]
            base_price = eq[4]
        else:
            base_multiple = 0.0
            base_price = None
        
        # Adjust based on current state
        
        # 1. Budget constraint
        tokens_available = self.config.tokens_per_stage[stage - 1]
        floor = self.config.floor_per_stage[stage - 1]
        
        if base_multiple > 0:
            max_affordable_multiple = budget / (tokens_available * floor)
            if max_affordable_multiple < base_multiple:
                base_multiple = max_affordable_multiple * 0.95  # 5% buffer
                base_price = floor * base_multiple
        
        # 2. SP gap adjustment (if behind, be more aggressive)
        if sp_gap <= -2 and base_multiple > 0:
            base_multiple = min(2.5, base_multiple * 1.2)
            base_price = floor * base_multiple
        elif sp_gap >= 2 and base_multiple > 0:
            base_multiple = max(1.0, base_multiple * 0.9)
            base_price = floor * base_multiple
        
        # 3. Determine if should skip
        should_skip = base_multiple <= 0 or budget < floor * tokens_available * 0.8
        
        # 4. Compute rescind recommendation (if win)
        rescind_recommendation = self._compute_rescind_recommendation(
            stage, period, budget, tokens_held, phantom_tokens
        )
        
        # 5. Build reasoning
        reasoning = self._build_reasoning(
            stage, period, base_multiple, should_skip, rescind_recommendation, sp_gap
        )
        
        # 6. Confidence level
        if stage == 1 and period <= 5:
            confidence = "high"  # S1 is well-calibrated
        elif stage == 2 and period <= 2:
            confidence = "high"  # S2 early is well-calibrated
        elif should_skip:
            confidence = "high"  # Skipping is clear optimal
        else:
            confidence = "medium"  # State-dependent adjustments
        
        return {
            "bid_price": round(base_price, 2) if base_price else None,
            "bid_multiple": round(base_multiple, 2),
            "skip": should_skip,
            "rescind_if_win": rescind_recommendation["rescind"],
            "rescind_reasoning": rescind_recommendation["reasoning"],
            "reasoning": reasoning,
            "confidence": confidence,
            "expected_win_prob": self._estimate_win_prob(base_multiple, floor),
            "expected_cost": round(base_price * tokens_available, 2) if base_price else 0
        }
    
    def _compute_rescind_recommendation(self, 
                                         stage: int, 
                                         period: int, 
                                         budget: float,
                                         tokens_held: int,
                                         phantom_tokens: int) -> Dict:
        """Compute optimal rescind decision."""
        
        # Check if forbidden
        if (stage, period) in self.config.rescind_forbidden:
            return {"rescind": False, "reasoning": "Rescind forbidden in S3P4/S3P5"}
        
        # Check tax affordability
        tokens_won = self.config.tokens_per_stage[stage - 1]
        tax_owed = math.ceil(tokens_won * self.config.rescind_tax_rate)
        
        if tokens_held < tax_owed:
            return {"rescind": False, "reasoning": f"Insufficient tokens for tax (need {tax_owed})"}
        
        # Cross-stage redirect (S1P5 → S2P2)
        if stage == 1 and period == 5:
            return {
                "rescind": True,
                "reasoning": "Cross-stage redirect to S2 (1.5× multiplier - 10% tax = 0.40 net gain)"
            }
        
        # Budget refund (when constrained)
        if budget < 3000:
            return {
                "rescind": True,
                "reasoning": f"Budget refund enables future wins (budget: ${budget:.0f})"
            }
        
        # Phantom deception (when opponents perceive scarcity)
        if phantom_tokens + tokens_won > 200:
            return {
                "rescind": True,
                "reasoning": f"Phantom deception ({phantom_tokens + tokens_won} tokens perceived, opponents may overbid)"
            }
        
        # Default: keep tokens for SP
        return {
            "rescind": False,
            "reasoning": "Tokens needed for SP ranking"
        }
    
    def _build_reasoning(self, 
                         stage: int, 
                         period: int, 
                         multiple: float, 
                         skip: bool,
                         rescind: Dict,
                         sp_gap: int) -> str:
        """Build human-readable reasoning."""
        
        if skip:
            return f"SKIP: Budget conservation (optimal: skip S2P3+ and all S3)"
        
        reasons = []
        
        # Base strategy
        if multiple >= 2.2:
            reasons.append(f"Must-win period (bid {multiple:.1f}× floor)")
        elif multiple >= 1.8:
            reasons.append(f"Aggressive positioning (bid {multiple:.1f}× floor)")
        elif multiple >= 1.2:
            reasons.append(f"Moderate bid (bid {multiple:.1f}× floor)")
        else:
            reasons.append(f"Probe bid (bid {multiple:.1f}× floor, happy to lose)")
        
        # SP gap adjustment
        if sp_gap <= -2:
            reasons.append("behind on SP → increased aggression")
        elif sp_gap >= 2:
            reasons.append("ahead on SP → reduced aggression")
        
        # Rescind recommendation
        if rescind["rescind"]:
            reasons.append(f"RESCIND if win: {rescind['reasoning']}")
        
        return "; ".join(reasons)
    
    def _estimate_win_prob(self, multiple: float, floor: float) -> float:
        """Estimate win probability based on bid multiple."""
        if multiple <= 0:
            return 0.0
        
        bid_price = floor * multiple
        opponent_avg = floor * 1.3
        
        # Sigmoid win probability
        return 1 / (1 + math.exp(-(bid_price - opponent_avg) / 3))


# =============================================================================
# CLI Interface (for tournament runner)
# =============================================================================

if __name__ == "__main__":
    # Read tournament state from stdin (JSON)
    # Example input:
    # {
    #   "stage": 1,
    #   "period": 3,
    #   "budget": 5420.50,
    #   "tokens_held": 240,
    #   "sp": 3,
    #   "sp_gap": -1,
    #   "phantom_tokens": 0
    # }
    
    try:
        input_data = json.loads(sys.stdin.read())
    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON input"}))
        sys.exit(1)
    
    oracle = LiveMDPOracle()
    
    result = oracle.get_optimal_action(
        stage=input_data.get("stage", 1),
        period=input_data.get("period", 1),
        budget=input_data.get("budget", 10000.0),
        tokens_held=input_data.get("tokens_held", 0),
        sp=input_data.get("sp", 0),
        sp_gap=input_data.get("sp_gap", 0),
        phantom_tokens=input_data.get("phantom_tokens", 0)
    )
    
    # Output as JSON (for prompt injection)
    print(json.dumps(result, indent=2))
