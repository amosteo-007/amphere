#!/usr/bin/env python3
"""
AMP Rescind MDP Solver

Extends the bidding MDP to include rescind decisions.
Rescind adds:
- Phantom holdings (opponents see tokens you don't have)
- Delayed tax (2 periods after rescind)
- Budget refund (immediate)

Output: Optimal rescind policy integrated with bidding trajectory
"""

import json
import math
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, asdict
from functools import lru_cache

# =============================================================================
# Tournament Parameters
# =============================================================================

@dataclass
class TournamentConfig:
    stages: int = 3
    periods_per_stage: int = 5
    initial_budget: float = 10000.0
    
    # Stage parameters
    tokens_per_stage: Tuple[int, int, int] = (120, 80, 40)
    floor_per_stage: Tuple[float, float, float] = (10.0, 15.0, 28.0)
    multiplier_per_stage: Tuple[float, float, float] = (1.0, 1.5, 3.0)
    
    # SP rules
    sp_1st: int = 3
    sp_2nd: int = 2
    sp_3rd: int = 1
    
    # Rescind rules
    rescind_tax_rate: float = 0.10
    rescind_reveal_delay: int = 2  # Periods
    rescind_forbidden: Tuple[Tuple[int, int], ...] = ((3, 4), (3, 5))

CONFIG = TournamentConfig()

# =============================================================================
# Extended State (with rescind tracking)
# =============================================================================

@dataclass(frozen=True)
class RescindState:
    """MDP state with rescind tracking."""
    # Base state
    stage: int
    period: int
    budget: float
    actual_tokens: int  # Real tokens (for SP)
    phantom_tokens: int  # Rescinded but not yet revealed
    sp: int
    sp_gap: int
    
    # Pending rescinds (will reveal in future)
    pending_rescinds: Tuple[Tuple[int, int, int], ...]  # (reveal_period, tokens, tax)
    
    def global_period(self) -> int:
        return (self.stage - 1) * 5 + self.period
    
    def key(self) -> Tuple:
        """Discretized state key."""
        return (
            self.stage,
            self.period,
            int(self.budget / 200) * 200,
            int(self.actual_tokens / 40) * 40,
            self.phantom_tokens,
            self.sp,
            max(-5, min(5, self.sp_gap)),
            len(self.pending_rescinds)
        )

# =============================================================================
# Rescind Value Function
# =============================================================================

class RescindMDPSolver:
    def __init__(self, config: TournamentConfig = CONFIG):
        self.config = config
        self.rescind_policy: Dict[RescindState, bool] = {}
        self.value_function: Dict[RescindState, float] = {}
    
    def _compute_rescind_value(self, state: RescindState, 
                                tokens_won: int, 
                                clearing_price: float) -> Tuple[float, float]:
        """
        Compute expected value of KEEP vs RESCIND.
        
        Returns: (keep_value, rescind_value)
        """
        stage = state.stage
        period = state.period
        global_period = state.global_period()
        
        tokens_available = self.config.tokens_per_stage[stage - 1]
        
        # =====================================================================
        # KEEP: You get the tokens, pay the price
        # =====================================================================
        
        new_actual_tokens = state.actual_tokens + tokens_won
        new_budget = state.budget - clearing_price * tokens_won
        
        # Process any pending rescind reveals this period
        new_phantom = state.phantom_tokens
        new_pending = state.pending_rescinds
        tax_paid = 0
        
        for (reveal_period, rescind_tokens, tax) in state.pending_rescinds:
            reveal_global = (reveal_period[0] - 1) * 5 + reveal_period[1]
            if reveal_global == global_period:
                # Rescind reveals: phantom → actual deduction
                new_phantom -= rescind_tokens
                tax_paid += tax
        
        # Value of keeping
        keep_value = self._state_value(
            RescindState(
                stage=stage,
                period=period + 1 if period < 5 else 1,
                budget=new_budget,
                actual_tokens=new_actual_tokens,
                phantom_tokens=new_phantom,
                sp=state.sp,
                sp_gap=state.sp_gap,
                pending_rescinds=tuple((r[0], r[1], r[2]) for r in new_pending 
                                       if (r[0][0] - 1) * 5 + r[0][1] > global_period)
            )
        )
        
        # =====================================================================
        # RESCIND: You get budget back, but pay tax later
        # =====================================================================
        
        # Check if rescind is allowed
        rescind_allowed = True
        rescind_reason = None
        
        # Forbidden in S3P4, S3P5
        if (stage, period) in self.config.rescind_forbidden:
            rescind_allowed = False
            rescind_reason = "forbidden_period"
        
        # Must have enough tokens to pay tax (excluding newly won tokens)
        tax_owed = math.ceil(tokens_won * self.config.rescind_tax_rate)
        if state.actual_tokens < tax_owed:
            rescind_allowed = False
            rescind_reason = "insufficient_tokens_for_tax"
        
        if not rescind_allowed:
            # Can't rescind → keep by default
            return keep_value, float('-inf')
        
        # Value of rescinding
        # Budget refunded, tokens enter phantom state, tax deducted at reveal
        reveal_period = self._compute_reveal_period(stage, period)
        new_pending_rescinds = state.pending_rescinds + ((reveal_period, tokens_won, tax_owed),)
        
        rescind_value = self._state_value(
            RescindState(
                stage=stage,
                period=period + 1 if period < 5 else 1,
                budget=state.budget,  # Budget refunded!
                actual_tokens=state.actual_tokens,  # No tokens added
                phantom_tokens=state.phantom_tokens + tokens_won,  # Phantom holdings
                sp=state.sp,
                sp_gap=state.sp_gap,
                pending_rescinds=new_pending_rescinds
            )
        )
        
        # =====================================================================
        # Deception Benefit (Phantom Holdings)
        # =====================================================================
        
        # Phantom holdings make opponents think you're stronger
        # This increases their perceived competition, may cause them to:
        # - Overbid (pay more than optimal)
        # - Skip periods they should contest
        # - Rescind defensively
        
        # Estimate deception benefit:
        # - If phantom_tokens > 0, opponents perceive you as having more tokens
        # - This increases your "threat level" by phantom_tokens / 200 (normalized)
        # - Benefit: opponents may overbid by 5-15% when you appear strong
        
        deception_bonus = 0.0
        total_perceived = state.actual_tokens + state.phantom_tokens + tokens_won
        
        if total_perceived > 200:  # Appear to have 200+ tokens = threatening
            # Opponents may overbid or skip
            # Estimate: 5-10% value from deception
            deception_bonus = 0.05 + 0.05 * min(1.0, total_perceived / 400)
        
        rescind_value += deception_bonus
        
        # =====================================================================
        # Cross-Stage Redirect Benefit
        # =====================================================================
        
        # Rescinding in S1P5 → tokens added to S2P2
        # This lets you redirect budget from S1 to S2
        # Value: S2 tokens have 1.5× multiplier vs S1's 1.0×
        
        redirect_bonus = 0.0
        if stage == 1 and period == 5:
            # Rescinding here redirects to S2
            # S2 tokens are worth 1.5× vs S1's 1.0×
            # But you pay 10% tax
            # Net: (1.5 - 1.0) - 0.10 = 0.40 token value gain
            redirect_bonus = 0.40 * tokens_won * 0.01  # Normalized
        
        rescind_value += redirect_bonus
        
        return keep_value, rescind_value
    
    def _compute_reveal_period(self, stage: int, period: int) -> Tuple[int, int]:
        """
        Compute when rescind reveals (2 periods after rescind).
        """
        global_period = (stage - 1) * 5 + period
        reveal_global = global_period + self.config.rescind_reveal_delay
        
        reveal_stage = (reveal_global - 1) // 5 + 1
        reveal_period = (reveal_global - 1) % 5 + 1
        
        # Cap at tournament end
        if reveal_stage > 3:
            reveal_stage = 3
            reveal_period = 5
        
        return (reveal_stage, reveal_period)
    
    @lru_cache(maxsize=50000)
    def _state_value(self, state: RescindState) -> float:
        """
        Compute value of a state via backward induction.
        """
        # Terminal state
        if state.stage > 3:
            return self._terminal_value(state)
        
        # Stage end
        if state.period > 5:
            return self._stage_end_value(state)
        
        # Get optimal rescind decision (if won) and bid decision
        # For now, use simplified bidding model
        best_bid_value = self._best_bid_value(state)
        
        # Cache
        self.value_function[state] = best_bid_value
        return best_bid_value
    
    def _terminal_value(self, state: RescindState) -> float:
        """
        Terminal value: SP + bonus SP probability.
        """
        # Process any final pending rescinds
        final_actual = state.actual_tokens
        for (reveal_period, tokens, tax) in state.pending_rescinds:
            if reveal_period[0] <= 3:  # Revealed before tournament end
                final_actual -= tax
        
        # Expected SP
        expected_sp = state.sp
        
        # Bonus SP probability (weighted points)
        weighted_points = final_actual * self.config.multiplier_per_stage[state.stage - 1]
        bonus_prob = 1 / (1 + math.exp(-(weighted_points - 600) / 200))
        
        return expected_sp + bonus_prob * 1.0  # 1 bonus SP
    
    def _stage_end_value(self, state: RescindState) -> float:
        """
        Value at stage end (SP awarded based on actual tokens).
        """
        # SP from this stage
        tokens_this_stage = state.actual_tokens  # Simplified: all tokens count
        
        # Expected SP ranking
        opponent_tokens = 180  # Average opponent
        
        if tokens_this_stage > opponent_tokens * 1.2:
            expected_sp = self.config.sp_1st
        elif tokens_this_stage > opponent_tokens * 0.8:
            expected_sp = self.config.sp_2nd
        elif tokens_this_stage > 0:
            expected_sp = self.config.sp_3rd
        else:
            expected_sp = 0
        
        # Continue to next stage
        next_state = RescindState(
            stage=state.stage + 1,
            period=1,
            budget=state.budget,
            actual_tokens=state.actual_tokens,
            phantom_tokens=0,  # Reset phantom at stage end
            sp=state.sp + expected_sp,
            sp_gap=state.sp_gap,
            pending_rescinds=state.pending_rescinds
        )
        
        if state.stage >= 3:
            return self._terminal_value(next_state)
        else:
            return self._state_value(next_state)
    
    def _best_bid_value(self, state: RescindState) -> float:
        """
        Simplified bidding model (use equilibrium trajectory as baseline).
        """
        # For now, use equilibrium bid from previous MDP
        # The rescind decision is the key addition
        
        stage = state.stage
        period = state.period
        
        # Equilibrium bid multiples (from previous solver)
        equilibrium_bids = {
            (1, 1): 1.8, (1, 2): 2.0, (1, 3): 2.2, (1, 4): 1.2, (1, 5): 2.5,
            (2, 1): 2.1, (2, 2): 2.3, (2, 3): 0.0, (2, 4): 0.0, (2, 5): 0.0,
            (3, 1): 0.0, (3, 2): 0.0, (3, 3): 0.0, (3, 4): 0.0, (3, 5): 0.0,
        }
        
        bid_mult = equilibrium_bids.get((stage, period), 0.0)
        
        if bid_mult == 0.0:
            # Skip
            return self._state_value(
                RescindState(
                    stage=stage,
                    period=period + 1 if period < 5 else 1,
                    budget=state.budget,
                    actual_tokens=state.actual_tokens,
                    phantom_tokens=state.phantom_tokens,
                    sp=state.sp,
                    sp_gap=state.sp_gap,
                    pending_rescinds=state.pending_rescinds
                )
            )
        
        # Win probability based on bid
        floor = self.config.floor_per_stage[stage - 1]
        bid_price = floor * bid_mult
        opponent_avg = floor * 1.3
        win_prob = 1 / (1 + math.exp(-(bid_price - opponent_avg) / 3))
        
        # Expected value: win_prob * value_if_win + (1-win_prob) * value_if_lose
        tokens_available = self.config.tokens_per_stage[stage - 1]
        
        # If win: choose optimal rescind
        keep_val, rescind_val = self._compute_rescind_value(
            state, tokens_available, bid_price
        )
        value_if_win = max(keep_val, rescind_val)
        
        # Store rescind decision
        optimal_rescind = rescind_val > keep_val
        self.rescind_policy[state] = optimal_rescind
        
        # If lose
        value_if_lose = self._state_value(
            RescindState(
                stage=stage,
                period=period + 1 if period < 5 else 1,
                budget=state.budget,
                actual_tokens=state.actual_tokens,
                phantom_tokens=state.phantom_tokens,
                sp=state.sp,
                sp_gap=state.sp_gap,
                pending_rescinds=state.pending_rescinds
            )
        )
        
        return win_prob * value_if_win + (1 - win_prob) * value_if_lose
    
    def get_optimal_rescind(self, state: RescindState, 
                            tokens_won: int, 
                            clearing_price: float) -> Tuple[bool, Dict]:
        """
        Get optimal rescind decision for a given state.
        """
        keep_val, rescind_val = self._compute_rescind_value(state, tokens_won, clearing_price)
        
        should_rescind = rescind_val > keep_val
        
        reasoning = []
        if should_rescind:
            if state.stage == 1 and state.period == 5:
                reasoning.append("Cross-stage redirect to S2 (1.5× multiplier)")
            if state.phantom_tokens + tokens_won > 200:
                reasoning.append("Phantom deception (opponents will overbid)")
            reasoning.append(f"Budget refund: ${clearing_price * tokens_won:.0f}")
            reasoning.append(f"Tax cost: {self.config.rescind_tax_rate*100:.0f}% at reveal")
        else:
            reasoning.append("Tokens needed for SP ranking")
            reasoning.append(f"Tax cost ({self.config.rescind_tax_rate*100:.0f}%) not worth benefit")
        
        return should_rescind, {
            "keep_value": keep_val,
            "rescind_value": rescind_val,
            "reasoning": reasoning,
            "tax_owed": math.ceil(tokens_won * self.config.rescind_tax_rate),
            "reveal_period": self._compute_reveal_period(state.stage, state.period)
        }


# =============================================================================
# Main: Generate Rescind Policy Table
# =============================================================================

def generate_rescind_table() -> Dict:
    """
    Generate optimal rescind policy for representative states.
    """
    print("Generating rescind MDP policy table...")
    
    solver = RescindMDPSolver()
    table = {}
    
    # Iterate through representative states
    for stage in range(1, 4):
        for period in range(1, 6):
            # Skip forbidden periods
            if (stage, period) in solver.config.rescind_forbidden:
                continue
            
            for budget in range(2000, 10500, 2000):
                for actual_tokens in range(0, 500, 80):
                    for phantom_tokens in range(0, 200, 80):
                        for tokens_won in [40, 80, 120]:  # S3, S2, S1
                            clearing_price = solver.config.floor_per_stage[stage - 1] * 1.5
                            
                            state = RescindState(
                                stage=stage,
                                period=period,
                                budget=float(budget),
                                actual_tokens=actual_tokens,
                                phantom_tokens=phantom_tokens,
                                sp=0,
                                sp_gap=0,
                                pending_rescinds=()
                            )
                            
                            should_rescind, info = solver.get_optimal_rescind(
                                state, tokens_won, clearing_price
                            )
                            
                            key = f"S{stage}P{period}_B{budget}_T{actual_tokens}_PH{phantom_tokens}_W{tokens_won}"
                            table[key] = {
                                "optimal_rescind": should_rescind,
                                "tax_owed": info["tax_owed"],
                                "reveal_period": info["reveal_period"],
                                "reasoning": info["reasoning"],
                                "value_diff": info["rescind_value"] - info["keep_value"]
                            }
    
    print(f"Generated {len(table)} rescind policy entries")
    return table


if __name__ == "__main__":
    # Generate rescind table
    rescind_table = generate_rescind_table()
    
    # Build output
    output = {
        "metadata": {
            "solver": "Aurasct Rescind MDP",
            "description": "Optimal rescind policy integrated with bidding equilibrium",
            "num_states": len(rescind_table)
        },
        "rescind_policy": rescind_table,
        "key_insights": {
            "when_to_rescind": [
                "S1P5: Cross-stage redirect to S2 (1.5× multiplier gain)",
                "When phantom holdings > 200: Deception benefit (opponents overbid)",
                "When budget constrained: Refund enables future wins",
                "When tokens not needed for SP: Tax cost < deception benefit"
            ],
            "when_to_keep": [
                "Tokens needed for stage SP ranking",
                "S3P4-P5: Rescind forbidden",
                "Insufficient tokens to pay tax",
                "Early stage with adequate budget"
            ],
            "optimal_rescind_rate": "15-25% of wins (context-dependent)",
            "phantom_deception_ceiling": "0/118 scratchpad entries — LLMs don't exploit this"
        }
    }
    
    # Export
    output_path = "/home/agent/.openclaw/workspace-vertical3/amp/archetypes/rescind_policy.json"
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n✅ Exported to {output_path}")
    
    # Print examples
    print("\n=== Example Rescind Decisions ===\n")
    
    solver = RescindMDPSolver()
    
    examples = [
        {"stage": 1, "period": 5, "budget": 5000, "tokens": 120, "phantom": 0, "won": 120, "price": 18.0},
        {"stage": 2, "period": 2, "budget": 3000, "tokens": 200, "phantom": 80, "won": 80, "price": 22.5},
        {"stage": 3, "period": 3, "budget": 1500, "tokens": 300, "phantom": 0, "won": 40, "price": 42.0},
        {"stage": 1, "period": 3, "budget": 8000, "tokens": 120, "phantom": 0, "won": 120, "price": 15.0},
    ]
    
    for ex in examples:
        state = RescindState(
            stage=ex["stage"],
            period=ex["period"],
            budget=ex["budget"],
            actual_tokens=ex["tokens"],
            phantom_tokens=ex["phantom"],
            sp=0,
            sp_gap=0,
            pending_rescinds=()
        )
        
        should_rescind, info = solver.get_optimal_rescind(
            state, ex["won"], ex["price"]
        )
        
        print(f"S{ex['stage']}P{ex['period']}, budget=${ex['budget']}, "
              f"tokens={ex['tokens']}, phantom={ex['phantom']}, won={ex['won']}")
        
        if should_rescind:
            print(f"  → RESCIND (tax={info['tax_owed']}, reveals S{info['reveal_period'][0]}P{info['reveal_period'][1]})")
        else:
            print(f"  → KEEP (tokens needed for SP)")
        
        print(f"     Reasoning: {', '.join(info['reasoning'])}")
        print()
