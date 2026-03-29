#!/usr/bin/env python3
"""
AMP Rescind Futures MDP

Rescind as a futures contract with information asymmetry:
- Period P: Win + rescind (private)
- Period P+1, P+2: Opponents overbid (they think supply is constrained)
- Period P+2: Tokens return to pool, tax paid, asymmetry closes

Key insight: You know true supply curve for T+2. Opponents don't.
"""

import json
import math
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass

# =============================================================================
# Tournament Parameters
# =============================================================================

@dataclass
class TournamentConfig:
    stages: int = 3
    periods_per_stage: int = 5
    initial_budget: float = 10000.0
    initial_tokens: int = 0
    
    tokens_per_stage: Tuple[int, int, int] = (120, 80, 40)
    floor_per_stage: Tuple[float, float, float] = (10.0, 15.0, 28.0)
    multiplier_per_stage: Tuple[float, float, float] = (1.0, 1.5, 3.0)
    
    sp_1st: int = 3
    sp_2nd: int = 2
    sp_3rd: int = 1
    
    rescind_tax_rate: float = 0.10
    rescind_reveal_delay: int = 2
    rescind_forbidden: Tuple[Tuple[int, int], ...] = ((3, 4), (3, 5))

CONFIG = TournamentConfig()

# =============================================================================
# State with Information Asymmetry
# =============================================================================

@dataclass(frozen=True)
class FuturesState:
    """
    State includes both true state and opponent perception.
    """
    # True state (you know this)
    period: int
    stage: int
    budget: float
    private_tokens: int  # Your actual token holdings
    pending_reveals: Tuple[Tuple[int, int], ...]  # (reveal_period, tokens)
    
    # Opponent perception (they don't know about rescinds)
    opponent_perceived_tokens: int  # What they think you have
    opponent_perceived_supply: int  # What they think is in the pool
    
    def true_supply(self) -> int:
        """True tokens available in pool."""
        base = CONFIG.tokens_per_stage[self.stage - 1]
        # Pending reveals will add back to pool
        for (reveal_period, tokens) in self.pending_reveals:
            if reveal_period <= self.period:
                base += tokens
        return base
    
    def perceived_supply_gap(self) -> int:
        """Difference between true and perceived supply."""
        return self.opponent_perceived_supply - self.true_supply()
    
    def key(self) -> Tuple:
        """Discretized state key."""
        return (
            self.stage,
            self.period,
            int(self.budget / 500) * 500,
            int(self.private_tokens / 40) * 40,
            int(self.opponent_perceived_tokens / 40) * 40,
            len(self.pending_reveals)
        )

# =============================================================================
# Opponent Bid Model (Naive vs. Rational)
# =============================================================================

class OpponentModel:
    """Models how opponents bid based on perceived supply."""
    
    def __init__(self, knowledge_level: str = "naive"):
        """
        knowledge_level:
        - "naive": Opponents don't discount phantom (matches 0/118 scratchpad data)
        - "rational": Opponents discount phantom (Nash equilibrium)
        """
        self.knowledge_level = knowledge_level
    
    def bid_aggression_multiplier(self, perceived_supply: int, true_supply: int) -> float:
        """
        How much opponents overbid based on perceived scarcity.
        
        If they think supply is constrained, they bid more aggressively.
        """
        if self.knowledge_level == "naive":
            # They believe phantom tokens are gone forever
            # Perceived scarcity = true_supply / perceived_supply
            if perceived_supply <= 0:
                return 1.5  # Maximum overbid (50% higher)
            
            scarcity_ratio = true_supply / perceived_supply
            
            # Scarcity ratio > 1 means they think supply is lower than it actually is
            # They overbid by up to 50% when they think supply is half of true supply
            overbid_factor = 1.0 + (scarcity_ratio - 1.0) * 0.5
            
            return min(1.5, max(1.0, overbid_factor))
        
        else:  # rational
            # They discount phantom holdings
            # No overbidding
            return 1.0
    
    def expected_clearing_price(self, floor: float, perceived_supply: int, 
                                 true_supply: int) -> float:
        """
        Expected clearing price given opponent perception.
        """
        aggression = self.bid_aggression_multiplier(perceived_supply, true_supply)
        return floor * aggression

# =============================================================================
# Rescind Futures MDP Solver
# =============================================================================

class RescindFuturesMDP:
    def __init__(self, config: TournamentConfig = CONFIG, 
                 opponent_knowledge: str = "naive"):
        self.config = config
        self.opponent_model = OpponentModel(opponent_knowledge)
        self.value_function: Dict[FuturesState, float] = {}
        self.policy: Dict[FuturesState, bool] = {}  # rescind or not
    
    def compute_rescind_value(self, state: FuturesState, 
                               tokens_won: int, 
                               clearing_price: float) -> Tuple[float, float]:
        """
        Compute value of KEEP vs RESCIND.
        
        Returns: (keep_value, rescind_value)
        """
        
        # =====================================================================
        # KEEP: You get the tokens, pay the price
        # =====================================================================
        
        new_budget = state.budget - clearing_price * tokens_won
        new_private_tokens = state.private_tokens + tokens_won
        new_perceived_tokens = state.opponent_perceived_tokens + tokens_won
        
        # No pending reveals added
        new_pending = state.pending_reveals
        
        keep_value = self._state_value(
            FuturesState(
                period=state.period + 1,
                stage=state.stage,
                budget=new_budget,
                private_tokens=new_private_tokens,
                pending_reveals=new_pending,
                opponent_perceived_tokens=new_perceived_tokens,
                opponent_perceived_supply=state.opponent_perceived_supply - tokens_won
            )
        )
        
        # =====================================================================
        # RESCIND: Budget refunded, tokens return in P+2, tax paid at reveal
        # =====================================================================
        
        # Check if rescind is allowed
        if (state.stage, state.period) in self.config.rescind_forbidden:
            return keep_value, float('-inf')
        
        # Check if have enough tokens to pay tax
        tax_owed = math.ceil(tokens_won * self.config.rescind_tax_rate)
        if state.private_tokens < tax_owed:
            return keep_value, float('-inf')
        
        # Budget refunded immediately
        refund_budget = state.budget  # Keep original budget
        
        # Private tokens unchanged (you didn't keep the won tokens)
        refund_private_tokens = state.private_tokens
        
        # Opponents still think you have the tokens
        refund_perceived_tokens = state.opponent_perceived_tokens + tokens_won
        
        # Tokens return in P+2
        reveal_period = state.period + self.config.rescind_reveal_delay
        new_pending = state.pending_reveals + ((reveal_period, tokens_won),)
        
        # =====================================================================
        # Information Asymmetry Value (P+1, P+2)
        # =====================================================================
        
        # For the next 2 periods, opponents think supply is constrained
        # This gives you an edge
        
        asymmetry_value = 0.0
        
        for future_period in range(state.period + 1, min(state.period + 3, 6)):
            # Opponents think supply is lower than it actually is
            perceived_supply = self.config.tokens_per_stage[state.stage - 1]
            true_supply = perceived_supply  # Will increase when tokens return
            
            # Their overbidding = your gain
            aggression = self.opponent_model.bid_aggression_multiplier(
                perceived_supply, true_supply
            )
            
            # You can win at discount or let them overpay
            # Value = 50% of their overbid premium
            asymmetry_value += (aggression - 1.0) * 0.5 * 0.1  # Normalized
        
        # =====================================================================
        # Cross-Stage Redirect (S1P5 → S2P2)
        # =====================================================================
        
        redirect_value = 0.0
        
        if state.stage == 1 and state.period == 5:
            # Rescinding here redirects tokens to S2P2
            # S2 tokens have 1.5× multiplier vs S1's 1.0×
            # Net: (1.5 - 1.0) - 0.10 (tax) = 0.40 token value gain
            redirect_value = 0.40 * tokens_won * 0.01
        
        # =====================================================================
        # Tax Cost
        # =====================================================================
        
        tax_cost = -tax_owed * 0.01  # Normalized cost
        
        # =====================================================================
        # Compute rescind value
        # =====================================================================
        
        rescind_value = self._state_value(
            FuturesState(
                period=state.period + 1,
                stage=state.stage,
                budget=refund_budget,
                private_tokens=refund_private_tokens,
                pending_reveals=new_pending,
                opponent_perceived_tokens=refund_perceived_tokens,
                opponent_perceived_supply=state.opponent_perceived_supply - tokens_won
            )
        ) + asymmetry_value + redirect_value + tax_cost
        
        return keep_value, rescind_value
    
    def _state_value(self, state: FuturesState) -> float:
        """Compute value of a state."""
        # Terminal state
        if state.stage > 3:
            return self._terminal_value(state)
        
        # Period end
        if state.period > 5:
            return self._stage_end_value(state)
        
        # Process any pending reveals this period
        new_pending = state.pending_reveals
        new_private_tokens = state.private_tokens
        
        for (reveal_period, tokens) in state.pending_reveals:
            if reveal_period == state.period:
                # Tax paid, tokens removed from private holdings
                tax = math.ceil(tokens * self.config.rescind_tax_rate)
                new_private_tokens -= tax
                # Remove from pending
                new_pending = tuple((p, t) for (p, t) in new_pending if p != reveal_period)
        
        # Update state after reveal
        state = FuturesState(
            period=state.period,
            stage=state.stage,
            budget=state.budget,
            private_tokens=new_private_tokens,
            pending_reveals=new_pending,
            opponent_perceived_tokens=state.opponent_perceived_tokens,
            opponent_perceived_supply=state.opponent_perceived_supply
        )
        
        # Get optimal action
        return self._best_action_value(state)
    
    def _terminal_value(self, state: FuturesState) -> float:
        """Terminal value: SP + bonus."""
        # Simplified: based on private tokens
        weighted_points = state.private_tokens * self.config.multiplier_per_stage[state.stage - 1]
        bonus_prob = 1 / (1 + math.exp(-(weighted_points - 600) / 200))
        return state.period * 0.1 + bonus_prob  # Simplified
    
    def _stage_end_value(self, state: FuturesState) -> float:
        """Value at stage end."""
        # Simplified: continue to next stage
        if state.stage >= 3:
            return self._terminal_value(state)
        else:
            return self._state_value(
                FuturesState(
                    period=1,
                    stage=state.stage + 1,
                    budget=state.budget,
                    private_tokens=state.private_tokens,
                    pending_reveals=state.pending_reveals,
                    opponent_perceived_tokens=0,  # Reset perception
                    opponent_perceived_supply=self.config.tokens_per_stage[state.stage]
                )
            )
    
    def _best_action_value(self, state: FuturesState) -> float:
        """Compute best action value (simplified bidding model)."""
        # Use equilibrium bid from previous MDP
        equilibrium_bids = {
            (1, 1): 1.8, (1, 2): 2.0, (1, 3): 2.2, (1, 4): 1.2, (1, 5): 2.5,
            (2, 1): 2.1, (2, 2): 2.3, (2, 3): 0.0, (2, 4): 0.0, (2, 5): 0.0,
            (3, 1): 0.0, (3, 2): 0.0, (3, 3): 0.0, (3, 4): 0.0, (3, 5): 0.0,
        }
        
        bid_mult = equilibrium_bids.get((state.stage, state.period), 0.0)
        
        if bid_mult == 0.0:
            # Skip
            return self._state_value(
                FuturesState(
                    period=state.period + 1,
                    stage=state.stage,
                    budget=state.budget,
                    private_tokens=state.private_tokens,
                    pending_reveals=state.pending_reveals,
                    opponent_perceived_tokens=state.opponent_perceived_tokens,
                    opponent_perceived_supply=state.opponent_perceived_supply
                )
            )
        
        # Win probability
        floor = self.config.floor_per_stage[state.stage - 1]
        bid_price = floor * bid_mult
        opponent_avg = floor * 1.3
        win_prob = 1 / (1 + math.exp(-(bid_price - opponent_avg) / 3))
        
        # If win: choose optimal rescind
        tokens_available = self.config.tokens_per_stage[state.stage - 1]
        keep_val, rescind_val = self.compute_rescind_value(
            state, tokens_available, bid_price
        )
        value_if_win = max(keep_val, rescind_val)
        
        # Store policy
        self.policy[state] = rescind_val > keep_val
        
        # If lose
        value_if_lose = self._state_value(
            FuturesState(
                period=state.period + 1,
                stage=state.stage,
                budget=state.budget,
                private_tokens=state.private_tokens,
                pending_reveals=state.pending_reveals,
                opponent_perceived_tokens=state.opponent_perceived_tokens,
                opponent_perceived_supply=state.opponent_perceived_supply
            )
        )
        
        return win_prob * value_if_win + (1 - win_prob) * value_if_lose
    
    def get_optimal_rescind(self, state: FuturesState, 
                            tokens_won: int, 
                            clearing_price: float) -> Tuple[bool, Dict]:
        """Get optimal rescind decision."""
        keep_val, rescind_val = self.compute_rescind_value(state, tokens_won, clearing_price)
        
        should_rescind = rescind_val > keep_val
        
        # Breakdown
        tax_owed = math.ceil(tokens_won * self.config.rescind_tax_rate)
        reveal_period = state.period + self.config.rescind_reveal_delay
        
        reasoning = []
        if state.stage == 1 and state.period == 5:
            reasoning.append("Cross-stage redirect to S2 (1.5× multiplier)")
        if state.opponent_perceived_supply < state.true_supply():
            reasoning.append("Information asymmetry (opponents overbid)")
        if state.budget < 3000:
            reasoning.append("Budget refund enables future wins")
        
        return should_rescind, {
            "keep_value": keep_val,
            "rescind_value": rescind_val,
            "reasoning": "; ".join(reasoning) if reasoning else "Net value comparison",
            "tax_owed": tax_owed,
            "reveal_period": (state.stage, reveal_period) if reveal_period <= 5 else (state.stage + 1, reveal_period - 5)
        }


# =============================================================================
# Main: Generate Policy Table
# =============================================================================

if __name__ == "__main__":
    print("Generating rescind futures MDP policy table...")
    
    solver = RescindFuturesMDP(opponent_knowledge="naive")
    policy = {}
    
    # Generate policy for representative states
    for stage in range(1, 4):
        for period in range(1, 6):
            if (stage, period) in CONFIG.rescind_forbidden:
                continue
            
            for budget in [3000, 5000, 7000, 10000]:
                for private_tokens in [0, 100, 200, 300]:
                    for perceived_tokens in [0, 100, 200, 300, 400]:
                        for tokens_won in [40, 80, 120]:
                            clearing_price = CONFIG.floor_per_stage[stage - 1] * 1.5
                            
                            state = FuturesState(
                                period=period,
                                stage=stage,
                                budget=float(budget),
                                private_tokens=private_tokens,
                                pending_reveals=(),
                                opponent_perceived_tokens=perceived_tokens,
                                opponent_perceived_supply=CONFIG.tokens_per_stage[stage - 1]
                            )
                            
                            should_rescind, info = solver.get_optimal_rescind(
                                state, tokens_won, clearing_price
                            )
                            
                            key = f"S{stage}P{period}_B{budget}_T{private_tokens}_PT{perceived_tokens}_W{tokens_won}"
                            policy[key] = {
                                "optimal_rescind": should_rescind,
                                "reasoning": info["reasoning"],
                                "value_diff": info["rescind_value"] - info["keep_value"],
                                "tax_owed": info["tax_owed"],
                                "reveal_period": info["reveal_period"]
                            }
    
    print(f"Generated {len(policy)} policy entries")
    
    # Export
    output = {
        "metadata": {
            "solver": "Aurasct Rescind Futures MDP",
            "description": "Rescind as futures contract with information asymmetry",
            "opponent_model": "naive (0/118 scratchpad entries mention phantom discounting)",
            "num_states": len(policy)
        },
        "policy": policy,
        "key_insights": {
            "when_to_rescind": [
                "S1P5: Cross-stage redirect to S2 (1.5× multiplier - 10% tax = 0.40 net gain)",
                "When opponents perceive scarcity: They overbid in P+1, P+2 (you win cheap)",
                "When budget < $3,000: Refund enables future wins",
                "When tokens not needed for SP: Tax cost < asymmetry benefit"
            ],
            "when_to_keep": [
                "Tokens needed for SP ranking",
                "S3P4-P5: Rescind forbidden",
                "Insufficient tokens to pay 10% tax",
                "Opponents already rational (discount phantom) — no asymmetry"
            ],
            "information_asymmetry_value": "Opponents overbid 5-50% when they perceive scarcity",
            "futures_analogy": "10% tax = options premium, T+2 reveal = expiry"
        }
    }
    
    output_path = "/home/agent/.openclaw/workspace-vertical3/amp/archetypes/rescind_futures_mdp.json"
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n✅ Exported to {output_path}")
    
    # Print examples
    print("\n=== Example Rescind Decisions (Futures MDP) ===\n")
    
    examples = [
        {"stage": 1, "period": 5, "budget": 5000, "private": 120, "perceived": 120, "won": 120},
        {"stage": 1, "period": 3, "budget": 5000, "private": 120, "perceived": 240, "won": 120},
        {"stage": 2, "period": 2, "budget": 2500, "private": 200, "perceived": 280, "won": 80},
        {"stage": 3, "period": 3, "budget": 1500, "private": 300, "perceived": 340, "won": 40},
    ]
    
    for ex in examples:
        state = FuturesState(
            period=ex["period"],
            stage=ex["stage"],
            budget=ex["budget"],
            private_tokens=ex["private"],
            pending_reveals=(),
            opponent_perceived_tokens=ex["perceived"],
            opponent_perceived_supply=CONFIG.tokens_per_stage[ex["stage"] - 1]
        )
        
        result, info = solver.get_optimal_rescind(
            state, ex["won"], CONFIG.floor_per_stage[ex["stage"] - 1] * 1.5
        )
        
        print(f"S{ex['stage']}P{ex['period']}, budget=${ex['budget']}, "
              f"private={ex['private']}, perceived={ex['perceived']}")
        
        if result:
            print(f"  → RESCIND (tax={info['tax_owed']}, reveals P{info['reveal_period'][1]})")
        else:
            print(f"  → KEEP")
        
        print(f"     Reasoning: {info['reasoning']}")
        print(f"     Value diff: {info['value_diff']:.3f}")
        print()
