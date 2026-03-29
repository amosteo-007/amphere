#!/usr/bin/env python3
"""
AMP Rescind Policy — Analytical Solution

Computes optimal rescind decisions based on:
1. Cross-stage redirect value (S1P5 → S2P2)
2. Phantom deception benefit (when opponents overbid)
3. Budget refund value (when budget-constrained)

Output: Rescind policy table integrated with equilibrium trajectory
"""

import json
import math
from typing import Dict, List, Tuple
from dataclasses import dataclass

# =============================================================================
# Tournament Parameters
# =============================================================================

@dataclass
class TournamentConfig:
    stages: int = 3
    periods_per_stage: int = 5
    initial_budget: float = 10000.0
    
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
# Optimal Rescind Decision Logic
# =============================================================================

def compute_rescind_decision(
    stage: int,
    period: int,
    budget_remaining: float,
    tokens_held: int,
    tokens_won: int,
    clearing_price: float,
    phantom_holdings: int = 0
) -> Dict:
    """
    Compute optimal rescind decision.
    
    Returns: {rescind: bool, reasoning: str, value_gain: float}
    """
    
    # Check if rescind is forbidden
    if (stage, period) in CONFIG.rescind_forbidden:
        return {
            "rescind": False,
            "reasoning": "Rescind forbidden in S3P4/S3P5",
            "value_gain": float('-inf')
        }
    
    # Check if have enough tokens to pay tax (excluding newly won tokens)
    tax_owed = math.ceil(tokens_won * CONFIG.rescind_tax_rate)
    if tokens_held < tax_owed:
        return {
            "rescind": False,
            "reasoning": f"Insufficient tokens for tax (need {tax_owed}, have {tokens_held})",
            "value_gain": float('-inf')
        }
    
    # ========================================================================
    # Factor 1: Cross-Stage Redirect (S1P5 → S2P2)
    # ========================================================================
    
    redirect_value = 0.0
    redirect_reason = None
    
    if stage == 1 and period == 5:
        # Rescinding here adds tokens to S2P2 auction pool
        # S2 tokens have 1.5× multiplier vs S1's 1.0×
        # Net gain: (1.5 - 1.0) - 0.10 (tax) = 0.40 token value
        redirect_value = 0.40 * tokens_won * 0.01  # Normalized
        redirect_reason = f"Cross-stage redirect to S2 (1.5× multiplier, 10% tax)"
    
    # ========================================================================
    # Factor 2: Phantom Deception Benefit
    # ========================================================================
    
    deception_value = 0.0
    deception_reason = None
    
    total_phantom = phantom_holdings + tokens_won
    
    if total_phantom > 200:
        # Opponents perceive you as having 200+ tokens
        # This may cause them to overbid by 5-15%
        # Estimate: 5-10% value from deception
        deception_value = 0.05 + 0.05 * min(1.0, total_phantom / 400)
        deception_reason = f"Phantom deception ({total_phantom} tokens perceived, opponents may overbid)"
    
    # ========================================================================
    # Factor 3: Budget Refund Value
    # ========================================================================
    
    budget_value = 0.0
    budget_reason = None
    
    refund_amount = clearing_price * tokens_won
    
    if budget_remaining < 3000:
        # Budget-constrained: refund enables future wins
        # Value depends on how constrained you are
        budget_value = 0.10 * (1.0 - budget_remaining / 3000)
        budget_reason = f"Budget refund ${refund_amount:.0f} enables future wins (budget: ${budget_remaining:.0f})"
    
    # ========================================================================
    # Factor 4: Token Need for SP Ranking
    # ========================================================================
    
    token_need_penalty = 0.0
    token_need_reason = None
    
    # If you need tokens for SP ranking, rescind is costly
    if tokens_held + tokens_won < 200:
        # Need these tokens for stage ranking
        token_need_penalty = -0.20  # Penalty
        token_need_reason = f"Need tokens for SP ranking (have {tokens_held + tokens_won}, need ~200)"
    
    # ========================================================================
    # Net Value
    # ========================================================================
    
    total_value = redirect_value + deception_value + budget_value + token_need_penalty
    
    should_rescind = total_value > 0
    
    reasons = []
    if redirect_reason: reasons.append(redirect_reason)
    if deception_reason: reasons.append(deception_reason)
    if budget_reason: reasons.append(budget_reason)
    if token_need_reason: reasons.append(token_need_reason)
    
    if should_rescind:
        reasoning = "RESCIND: " + "; ".join(reasons) if reasons else "RESCIND: Net positive value"
    else:
        reasoning = "KEEP: " + "; ".join(reasons) if reasons else "KEEP: Net negative value"
    
    return {
        "rescind": should_rescind,
        "reasoning": reasoning,
        "value_gain": total_value,
        "breakdown": {
            "redirect_value": redirect_value,
            "deception_value": deception_value,
            "budget_value": budget_value,
            "token_need_penalty": token_need_penalty
        },
        "tax_owed": tax_owed,
        "reveal_period": compute_reveal_period(stage, period)
    }


def compute_reveal_period(stage: int, period: int) -> Tuple[int, int]:
    """Compute when rescind reveals (2 periods after)."""
    global_period = (stage - 1) * 5 + period
    reveal_global = global_period + CONFIG.rescind_reveal_delay
    
    if reveal_global > 15:
        return (3, 5)  # Cap at tournament end
    
    reveal_stage = (reveal_global - 1) // 5 + 1
    reveal_period = (reveal_global - 1) % 5 + 1
    
    return (reveal_stage, reveal_period)


# =============================================================================
# Generate Policy Table
# =============================================================================

def generate_rescind_policy() -> Dict:
    """Generate optimal rescind policy for representative states."""
    print("Generating rescind policy table...")
    
    policy = {}
    
    # Iterate through representative states
    for stage in range(1, 4):
        for period in range(1, 6):
            # Skip forbidden periods
            if (stage, period) in CONFIG.rescind_forbidden:
                continue
            
            for budget in [2000, 4000, 6000, 8000, 10000]:
                for tokens_held in [0, 100, 200, 300, 400]:
                    for tokens_won in [40, 80, 120]:
                        clearing_price = CONFIG.floor_per_stage[stage - 1] * 1.5
                        
                        result = compute_rescind_decision(
                            stage=stage,
                            period=period,
                            budget_remaining=float(budget),
                            tokens_held=tokens_held,
                            tokens_won=tokens_won,
                            clearing_price=clearing_price,
                            phantom_holdings=0
                        )
                        
                        key = f"S{stage}P{period}_B{budget}_T{tokens_held}_W{tokens_won}"
                        policy[key] = result
    
    print(f"Generated {len(policy)} policy entries")
    return policy


# =============================================================================
# Main: Export Policy
# =============================================================================

if __name__ == "__main__":
    # Generate policy
    policy = generate_rescind_policy()
    
    # Build output
    output = {
        "metadata": {
            "solver": "Aurasct Rescind Policy (Analytical)",
            "description": "Optimal rescind decisions based on cross-stage redirect, phantom deception, and budget value",
            "num_states": len(policy)
        },
        "policy": policy,
        "key_insights": {
            "when_to_rescind": [
                "S1P5: Cross-stage redirect to S2 (1.5× multiplier gain > 10% tax)",
                "When phantom holdings > 200: Deception benefit (opponents overbid)",
                "When budget < $3,000: Refund enables future wins",
                "When tokens not needed for SP: Tax cost < combined benefits"
            ],
            "when_to_keep": [
                "Tokens needed for stage SP ranking (< 200 total)",
                "S3P4-P5: Rescind forbidden",
                "Insufficient tokens to pay 10% tax",
                "Early stage with adequate budget (> $6,000)"
            ],
            "optimal_rescind_rate": "15-25% of wins (context-dependent)",
            "phantom_deception_ceiling": "0/118 scratchpad entries — LLMs don't exploit this"
        },
        "integration_with_equilibrium": {
            "note": "Rescind decisions augment the equilibrium bidding trajectory",
            "equilibrium_wins": 4,  # 2 in S1, 2 in S2
            "expected_rescinds": "0-1 (mostly S1P5 cross-stage redirect)"
        }
    }
    
    # Export
    output_path = "/home/agent/.openclaw/workspace-vertical3/amp/archetypes/rescind_policy.json"
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n✅ Exported to {output_path}")
    
    # Print examples
    print("\n=== Example Rescind Decisions ===\n")
    
    examples = [
        {"stage": 1, "period": 5, "budget": 5000, "tokens": 120, "won": 120, "price": 18.0},
        {"stage": 2, "period": 2, "budget": 2500, "tokens": 200, "won": 80, "price": 22.5},
        {"stage": 3, "period": 3, "budget": 1500, "tokens": 300, "won": 40, "price": 42.0},
        {"stage": 1, "period": 3, "budget": 8000, "tokens": 120, "won": 120, "price": 15.0},
    ]
    
    for ex in examples:
        result = compute_rescind_decision(
            ex["stage"], ex["period"], ex["budget"],
            ex["tokens"], ex["won"], ex["price"]
        )
        
        print(f"S{ex['stage']}P{ex['period']}, budget=${ex['budget']}, "
              f"tokens={ex['tokens']}, won={ex['won']}")
        
        if result["rescind"]:
            print(f"  → RESCIND (tax={result['tax_owed']}, reveals S{result['reveal_period'][0]}P{result['reveal_period'][1]})")
        else:
            print(f"  → KEEP")
        
        print(f"     Reasoning: {result['reasoning']}")
        print(f"     Value: {result['value_gain']:.3f}")
        print()
