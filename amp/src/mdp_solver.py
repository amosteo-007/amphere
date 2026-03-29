#!/usr/bin/env python3
"""
AMP MDP Solver — Optimal Bidding Lookup Table

Solves the Aurasct tournament as a single-agent MDP via backward induction.
Other players are modeled as a stochastic price process (not strategic opponents).

Output: Lookup table mapping (stage, period, budget, tokens, sp_gap) → optimal_bid
"""

import json
import math
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, asdict
from functools import lru_cache

def sigmoid(x: float) -> float:
    """Sigmoid function without numpy."""
    return 1 / (1 + math.exp(-x))

# =============================================================================
# Tournament Parameters (from skill file)
# =============================================================================

@dataclass
class TournamentConfig:
    stages: int = 3
    periods_per_stage: int = 5
    total_periods: int = 15
    initial_budget: float = 10000.0
    initial_sp: int = 0
    
    # Stage parameters
    tokens_per_stage: Tuple[int, int, int] = (120, 80, 40)
    floor_per_stage: Tuple[float, float, float] = (10.0, 15.0, 28.0)
    multiplier_per_stage: Tuple[float, float, float] = (1.0, 1.5, 3.0)
    
    # SP rules
    sp_1st: int = 3
    sp_2nd: int = 2
    sp_3rd: int = 1
    bonus_sp: int = 1
    
    # Rescind rules
    rescind_tax_rate: float = 0.10
    rescind_reveal_delay: int = 2
    rescind_forbidden_periods: Tuple[Tuple[int, int], ...] = ((3, 4), (3, 5))

CONFIG = TournamentConfig()

# =============================================================================
# State Representation
# =============================================================================

@dataclass(frozen=True)
class State:
    """MDP state (simplified for tractability)."""
    stage: int                    # 1-3
    period: int                   # 1-5
    budget: float                 # Remaining budget
    tokens_s1: int                # Stage 1 tokens held
    tokens_s2: int                # Stage 2 tokens held
    tokens_s3: int                # Stage 3 tokens held
    sp: int                       # Stage points accumulated
    sp_gap: int                   # SP difference vs. leader (negative = behind)
    
    def key(self) -> Tuple:
        """Discretized state key for lookup table."""
        # Discretize budget to $100 bins
        budget_bin = int(self.budget / 100) * 100
        # Discretize tokens to 40-token bins
        tokens_bin = (
            int(self.tokens_s1 / 40) * 40,
            int(self.tokens_s2 / 40) * 40,
            int(self.tokens_s3 / 40) * 40
        )
        return (
            self.stage,
            self.period,
            budget_bin,
            tokens_bin,
            max(-10, min(10, self.sp_gap))  # Clamp to [-10, 10]
        )

# =============================================================================
# Action Space
# =============================================================================

@dataclass(frozen=True)
class Action:
    """Bid action."""
    price_per_token: Optional[float] = None
    skip: bool = False
    
    def is_skip(self) -> bool:
        return self.skip
    
    def cost(self, stage: int) -> float:
        if self.skip:
            return 0.0
        tokens = CONFIG.tokens_per_stage[stage - 1]
        return self.price_per_token * tokens

# =============================================================================
# Value Function via Backward Induction
# =============================================================================

class MDPSolver:
    def __init__(self, config: TournamentConfig = CONFIG):
        self.config = config
        self.value_function: Dict[State, float] = {}
        self.policy: Dict[State, Action] = {}
        self._build_lookup_table()
    
    def _terminal_value(self, state: State) -> float:
        """
        Compute expected value at terminal state (end of tournament).
        
        Value = Expected SP + Expected bonus SP
        """
        # Expected SP from current position
        # This is a simplification — actual SP depends on opponent behavior
        # We use a probabilistic model based on token counts
        
        total_tokens = state.tokens_s1 + state.tokens_s2 + state.tokens_s3
        
        # Expected final SP (based on current SP + expected future SP)
        # Assume: if you have tokens in all stages, you get ~2 SP per stage on average
        # If you have 0 tokens in a stage, you get 0 SP from that stage
        
        expected_sp = state.sp
        
        # Bonus SP probability (based on weighted points)
        weighted_points = (
            state.tokens_s1 * self.config.multiplier_per_stage[0] +
            state.tokens_s2 * self.config.multiplier_per_stage[1] +
            state.tokens_s3 * self.config.multiplier_per_stage[2]
        )
        
        # Probability of winning bonus SP (sigmoid based on weighted points)
        # Threshold: ~600 weighted points for 50% chance
        bonus_prob = sigmoid((weighted_points - 600) / 200)
        
        return expected_sp + bonus_prob * self.config.bonus_sp
    
    def _stage_end_value(self, state: State) -> float:
        """
        Compute value at stage end (before SP is awarded).
        """
        # Determine SP from this stage
        tokens_this_stage = [state.tokens_s1, state.tokens_s2, state.tokens_s3][state.stage - 1]
        
        # Expected SP from stage ranking (probabilistic)
        # Assume opponent token count is ~120-240 per stage (from tournament data)
        opponent_tokens = 180  # Average opponent
        
        if tokens_this_stage > opponent_tokens * 1.2:
            expected_sp = self.config.sp_1st  # 1st place
        elif tokens_this_stage > opponent_tokens * 0.8:
            expected_sp = self.config.sp_2nd  # 2nd place
        elif tokens_this_stage > 0:
            expected_sp = self.config.sp_3rd  # 3rd place
        else:
            expected_sp = 0  # No tokens = no SP
        
        # Continue to next stage
        next_state = State(
            stage=state.stage + 1,
            period=1,
            budget=state.budget,
            tokens_s1=state.tokens_s1,
            tokens_s2=state.tokens_s2,
            tokens_s3=state.tokens_s3,
            sp=state.sp + expected_sp,
            sp_gap=state.sp_gap  # Simplified
        )
        
        if state.stage >= 3:
            return self._terminal_value(next_state)
        else:
            return self._state_value(next_state)
    
    @lru_cache(maxsize=100000)
    def _state_value(self, state: State) -> float:
        """
        Compute value of a state via backward induction.
        """
        # Terminal state
        if state.stage > 3:
            return self._terminal_value(state)
        
        # Stage end
        if state.period > 5:
            return self._stage_end_value(state)
        
        # Get optimal action for this state
        best_action, best_value = self._best_action(state)
        
        # Cache the result
        self.policy[state] = best_action
        self.value_function[state] = best_value
        
        return best_value
    
    def _best_action(self, state: State) -> Tuple[Action, float]:
        """
        Find the optimal action for a given state.
        
        Returns: (best_action, best_value)
        """
        stage = state.stage
        period = state.period
        tokens_available = self.config.tokens_per_stage[stage - 1]
        floor_price = self.config.floor_per_stage[stage - 1]
        
        # Candidate actions
        candidates = []
        
        # 1. Skip action
        next_state_skip = State(
            stage=state.stage,
            period=state.period + 1,
            budget=state.budget,
            tokens_s1=state.tokens_s1,
            tokens_s2=state.tokens_s2,
            tokens_s3=state.tokens_s3,
            sp=state.sp,
            sp_gap=state.sp_gap  # Simplified: assume gap unchanged
        )
        skip_value = self._state_value(next_state_skip)
        candidates.append((Action(skip=True), skip_value))
        
        # 2. Bid actions (discretized price levels)
        # Test bids at: floor, 1.1×, 1.2×, 1.5×, 2.0× floor
        bid_multipliers = [1.0, 1.1, 1.2, 1.3, 1.5, 1.8, 2.0, 2.5, 3.0]
        
        for mult in bid_multipliers:
            price = floor_price * mult
            cost = price * tokens_available
            
            # Check budget feasibility
            if cost > state.budget:
                continue
            
            # Expected value of winning (probabilistic — depends on opponent bids)
            # Assume: probability of winning increases with bid price
            # P(win) = sigmoid((price - opponent_avg) / scale)
            opponent_avg = floor_price * 1.3  # Average opponent bid (from tournament data)
            win_prob = sigmoid((price - opponent_avg) / 3)
            
            # Value if win
            next_state_win = State(
                stage=state.stage,
                period=state.period + 1,
                budget=state.budget - cost,
                tokens_s1=state.tokens_s1 + (tokens_available if stage == 1 else 0),
                tokens_s2=state.tokens_s2 + (tokens_available if stage == 2 else 0),
                tokens_s3=state.tokens_s3 + (tokens_available if stage == 3 else 0),
                sp=state.sp,
                sp_gap=max(-10, state.sp_gap + 1)  # Simplified: winning reduces gap
            )
            value_win = self._state_value(next_state_win)
            
            # Value if lose (someone else wins)
            next_state_lose = State(
                stage=state.stage,
                period=state.period + 1,
                budget=state.budget,
                tokens_s1=state.tokens_s1,
                tokens_s2=state.tokens_s2,
                tokens_s3=state.tokens_s3,
                sp=state.sp,
                sp_gap=min(10, state.sp_gap - 1)  # Simplified: losing increases gap
            )
            value_lose = self._state_value(next_state_lose)
            
            # Expected value
            expected_value = win_prob * value_win + (1 - win_prob) * value_lose
            candidates.append((Action(price_per_token=price), expected_value))
        
        # Return best action
        best_action, best_value = max(candidates, key=lambda x: x[1])
        return best_action, best_value
    
    def _build_lookup_table(self):
        """
        Build the complete lookup table via backward induction.
        
        Iterates from terminal state backward to initial state.
        """
        print("Building MDP lookup table via backward induction...")
        
        # Iterate through all states (reverse order)
        for stage in range(3, 0, -1):
            for period in range(5, 0, -1):
                for budget in range(0, 10100, 200):  # $0-$10,000 in $200 bins
                    for tokens_s1 in range(0, 500, 80):  # 0-500 in 80-token bins
                        for tokens_s2 in range(0, 500, 80):
                            for tokens_s3 in range(0, 500, 80):
                                for sp_gap in range(-5, 6):  # -5 to +5
                                    state = State(
                                        stage=stage,
                                        period=period,
                                        budget=float(budget),
                                        tokens_s1=tokens_s1,
                                        tokens_s2=tokens_s2,
                                        tokens_s3=tokens_s3,
                                        sp=0,  # Not needed for lookup
                                        sp_gap=sp_gap
                                    )
                                    
                                    # Compute optimal action
                                    try:
                                        best_action, best_value = self._best_action(state)
                                        self.policy[state] = best_action
                                        self.value_function[state] = best_value
                                    except RecursionError:
                                        # Skip states that cause deep recursion
                                        continue
        
        print(f"Lookup table built: {len(self.policy)} states")
    
    def get_optimal_bid(self, state: State) -> Action:
        """
        Lookup optimal bid for a given state.
        """
        # Find closest matching state in lookup table
        key = state.key()
        
        # Search for exact or nearest match
        for stored_state, action in self.policy.items():
            if stored_state.key() == key:
                return action
        
        # No exact match — compute on the fly
        best_action, _ = self._best_action(state)
        return best_action
    
    def export_lookup_table(self, filepath: str):
        """
        Export lookup table to JSON for use in simulation.
        """
        table = {}
        
        for state, action in self.policy.items():
            key = str(state.key())
            table[key] = {
                "optimal_price": action.price_per_token,
                "skip": action.skip,
                "value": self.value_function.get(state, 0.0)
            }
        
        with open(filepath, 'w') as f:
            json.dump({
                "metadata": {
                    "tournament_config": asdict(self.config),
                    "num_states": len(self.policy),
                    "method": "backward_induction"
                },
                "lookup_table": table
            }, f, indent=2)
        
        print(f"Lookup table exported to {filepath}")


# =============================================================================
# Main: Build and Export Lookup Table
# =============================================================================

if __name__ == "__main__":
    solver = MDPSolver()
    solver.export_lookup_table("/home/agent/.openclaw/workspace-vertical3/amp/archetypes/optimal_bidding_table.json")
    
    # Print some example lookups
    print("\n=== Example Optimal Bids ===\n")
    
    examples = [
        State(1, 1, 10000.0, 0, 0, 0, 0, 0),  # S1P1, full budget, no tokens
        State(1, 5, 5000.0, 240, 0, 0, 0, -2),  # S1P5, behind by 2 SP
        State(2, 3, 3000.0, 240, 80, 0, 3, 1),  # S2P3, leading
        State(3, 5, 1500.0, 240, 160, 40, 6, 0),  # S3P5, final period
    ]
    
    for state in examples:
        action = solver.get_optimal_bid(state)
        value = solver.value_function.get(state, 0.0)
        print(f"State: S{state.stage}P{state.period}, budget=${state.budget:.0f}, "
              f"tokens=({state.tokens_s1},{state.tokens_s2},{state.tokens_s3}), "
              f"SP={state.sp}, gap={state.sp_gap}")
        if action.skip:
            print(f"  → Optimal: SKIP (value={value:.2f})")
        else:
            print(f"  → Optimal: Bid ${action.price_per_token:.2f}/token (value={value:.2f})")
        print()
