#!/usr/bin/env python3
"""
AMP Deviation Analyzer

Runs at the end of each tournament period.
Input: LLM bids + MDP optimal recommendations
Output: Deviation metrics per LLM (bounded rationality score)

This logs how much each LLM deviated from optimal play.
"""

import json
import sys
import math
from typing import Dict, List
from dataclasses import dataclass

# =============================================================================
# Deviation Metrics
# =============================================================================

@dataclass
class DeviationMetrics:
    """Metrics for one LLM's deviation from optimal."""
    model: str
    optimal_bid: float
    actual_bid: float
    bid_deviation_pct: float  # (actual - optimal) / optimal * 100
    optimal_skip: bool
    actual_skip: bool
    skip_error: bool  # True if skipped when shouldn't have, or vice versa
    optimal_rescind: bool
    actual_rescind: bool
    rescind_error: bool
    bounded_rationality_score: float  # 0-1, higher = more deviation
    
    def to_dict(self) -> Dict:
        return {
            "model": self.model,
            "optimal_bid": self.optimal_bid,
            "actual_bid": self.actual_bid,
            "bid_deviation_pct": self.bid_deviation_pct,
            "optimal_skip": self.optimal_skip,
            "actual_skip": self.actual_skip,
            "skip_error": self.skip_error,
            "optimal_rescind": self.optimal_rescind,
            "actual_rescind": self.actual_rescind,
            "rescind_error": self.rescind_error,
            "bounded_rationality_score": self.bounded_rationality_score
        }

# =============================================================================
# Deviation Analyzer
# =============================================================================

class DeviationAnalyzer:
    """Analyzes LLM deviations from MDP optimal."""
    
    def __init__(self):
        self.deviation_history: List[DeviationMetrics] = []
    
    def analyze_period(self,
                       period_results: List[Dict],
                       mdp_recommendations: Dict[str, Dict]) -> List[DeviationMetrics]:
        """
        Analyze one period's results.
        
        period_results: [
            {
                "model": "anthropic",
                "bid_price": 20.50,
                "skip": False,
                "rescind": False,
                "won": True,
                "clearing_price": 19.00
            },
            ...
        ]
        
        mdp_recommendations: {
            "anthropic": {
                "bid_price": 18.00,
                "skip": False,
                "rescind_if_win": False
            },
            ...
        }
        """
        
        period_deviations = []
        
        for result in period_results:
            model = result["model"]
            
            if model not in mdp_recommendations:
                continue
            
            optimal = mdp_recommendations[model]
            
            # Bid deviation
            if optimal["skip"]:
                optimal_bid = 0.0
            else:
                optimal_bid = optimal["bid_price"]
            
            if result["skip"]:
                actual_bid = 0.0
            else:
                actual_bid = result["bid_price"]
            
            if optimal_bid > 0:
                bid_deviation_pct = (actual_bid - optimal_bid) / optimal_bid * 100
            else:
                bid_deviation_pct = 0.0 if actual_bid == 0 else float('inf')
            
            # Skip error
            skip_error = (optimal["skip"] != result["skip"])
            
            # Rescind error (only if won)
            if result.get("won", False):
                rescind_error = (optimal["rescind_if_win"] != result.get("rescind", False))
            else:
                rescind_error = False  # Didn't win, no rescind decision
            
            # Bounded rationality score (0-1)
            # Components:
            # - Bid deviation (normalized): |deviation| / 100
            # - Skip error: 0 or 1
            # - Rescind error: 0 or 1
            
            bid_error = min(1.0, abs(bid_deviation_pct) / 100)
            skip_error_score = 1.0 if skip_error else 0.0
            rescind_error_score = 1.0 if rescind_error else 0.0
            
            # Weighted average
            bounded_rationality_score = (
                bid_error * 0.5 +
                skip_error_score * 0.3 +
                rescind_error_score * 0.2
            )
            
            metrics = DeviationMetrics(
                model=model,
                optimal_bid=optimal_bid,
                actual_bid=actual_bid,
                bid_deviation_pct=bid_deviation_pct,
                optimal_skip=optimal["skip"],
                actual_skip=result["skip"],
                skip_error=skip_error,
                optimal_rescind=optimal["rescind_if_win"],
                actual_rescind=result.get("rescind", False),
                rescind_error=rescind_error,
                bounded_rationality_score=bounded_rationality_score
            )
            
            period_deviations.append(metrics)
            self.deviation_history.append(metrics)
        
        return period_deviations
    
    def get_cumulative_metrics(self) -> Dict[str, Dict]:
        """Get cumulative deviation metrics per model."""
        
        model_metrics = {}
        
        for dev in self.deviation_history:
            if dev.model not in model_metrics:
                model_metrics[dev.model] = {
                    "periods": 0,
                    "total_bid_deviation": 0.0,
                    "skip_errors": 0,
                    "rescind_errors": 0,
                    "total_bounded_rationality": 0.0
                }
            
            m = model_metrics[dev.model]
            m["periods"] += 1
            m["total_bid_deviation"] += abs(dev.bid_deviation_pct)
            m["skip_errors"] += 1 if dev.skip_error else 0
            m["rescind_errors"] += 1 if dev.rescind_error else 0
            m["total_bounded_rationality"] += dev.bounded_rationality_score
        
        # Compute averages
        for model, m in model_metrics.items():
            m["avg_bid_deviation_pct"] = m["total_bid_deviation"] / m["periods"]
            m["avg_bounded_rationality"] = m["total_bounded_rationality"] / m["periods"]
            m["skip_error_rate"] = m["skip_errors"] / m["periods"]
            m["rescind_error_rate"] = m["rescind_errors"] / m["periods"]
        
        return model_metrics
    
    def export_report(self, filepath: str):
        """Export deviation report to JSON."""
        
        cumulative = self.get_cumulative_metrics()
        
        report = {
            "metadata": {
                "total_periods": len(self.deviation_history) // 7,  # 7 models per period
                "description": "LLM deviations from MDP optimal (bounded rationality)"
            },
            "cumulative_metrics": cumulative,
            "period_history": [dev.to_dict() for dev in self.deviation_history]
        }
        
        with open(filepath, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"Deviation report exported to {filepath}")


# =============================================================================
# CLI Interface
# =============================================================================

if __name__ == "__main__":
    # Read input from stdin (JSON)
    # {
    #   "period_results": [...],
    #   "mdp_recommendations": {...}
    # }
    
    try:
        input_data = json.loads(sys.stdin.read())
    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON input"}))
        sys.exit(1)
    
    analyzer = DeviationAnalyzer()
    
    # Analyze this period
    deviations = analyzer.analyze_period(
        input_data["period_results"],
        input_data["mdp_recommendations"]
    )
    
    # Output period deviations
    print("=== Period Deviation Analysis ===\n")
    for dev in deviations:
        print(f"{dev.model.upper()}:")
        print(f"  Optimal: ${dev.optimal_bid:.2f}, Actual: ${dev.actual_bid:.2f}")
        print(f"  Bid Deviation: {dev.bid_deviation_pct:+.1f}%")
        print(f"  Skip Error: {dev.skip_error}, Rescind Error: {dev.rescind_error}")
        print(f"  Bounded Rationality Score: {dev.bounded_rationality_score:.3f}")
        print()
    
    # Export cumulative report
    if "output_path" in input_data:
        analyzer.export_report(input_data["output_path"])
