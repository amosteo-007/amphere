#!/usr/bin/env python3
"""
Compute Auction Tournament Runner
LLM Agent vs MDP Scripts in Double Dutch Auctions
"""

import sys
import json
import random
from typing import Dict, List, Tuple
from dataclasses import asdict

# Add paths
sys.path.insert(0, '/home/agent/.openclaw/workspace/compute_auction')

from engine.double_dutch import DoubleDutchAuction, AuctionStatus, AuctionResult
from scripts.mdp_bidders import create_bidder, BIDDER_REGISTRY
from llm_agent.llm_bidder import LLMBidder


class TournamentRunner:
    """Manages series of auctions between LLM and MDP agents"""
    
    def __init__(self, random_seed: int = 42):
        self.random_seed = random_seed
        random.seed(random_seed)
        
        self.auction_results: List[AuctionResult] = []
        self.bidder_histories: Dict[str, List[Dict]] = {}
        self.scratchpad_logs: Dict[str, List] = {}
        
    def generate_auction_configs(self, num_auctions: int) -> List[Dict]:
        """Generate varied auction configurations"""
        configs = []
        
        for i in range(num_auctions):
            # Vary the parameters
            compute_units = random.choice([50, 100, 200, 500])
            unit_value = random.uniform(8.0, 15.0)
            
            # Price range based on value
            total_value = compute_units * unit_value
            initial_price = total_value * random.uniform(1.3, 1.6)
            min_price = total_value * random.uniform(0.3, 0.5)
            
            # Periods based on price range
            price_drop = initial_price - min_price
            periods = max(10, int(price_drop / (total_value * 0.05)))  # 5% drops per period
            periods = min(periods, 30)  # Cap at 30
            
            configs.append({
                "auction_id": f"auction_{i+1:03d}",
                "compute_units": compute_units,
                "unit_value": round(unit_value, 2),
                "initial_price": round(initial_price, 2),
                "min_price": round(min_price, 2),
                "max_periods": periods,
                "price_decay": "linear"
            })
        
        return configs
    
    def run_single_auction(
        self, 
        config: Dict,
        bidders: List[Tuple[str, float]],
        bidder_agents: Dict[str, any]
    ) -> Tuple[AuctionResult, Dict]:
        """
        Run one auction with multiple bidders.
        Returns result and detailed logs.
        """
        auction = DoubleDutchAuction(**config)
        
        # Register all bidders
        for bidder_id, budget in bidders:
            auction.register_bidder(bidder_id, budget)
            if bidder_id not in self.bidder_histories:
                self.bidder_histories[bidder_id] = []
        
        # Initialize agents for this auction
        for bidder_id, agent in bidder_agents.items():
            if hasattr(agent, 'start_auction'):
                agent.start_auction(
                    config["auction_id"],
                    config["compute_units"],
                    config["unit_value"]
                )
        
        auction.start()
        
        # Run period by period
        period_logs = []
        
        while auction.status == AuctionStatus.ACTIVE:
            # Collect actions from each agent
            actions = {}
            state_info = {
                "public": auction.get_public_state(),
                "private": {}
            }
            
            for bidder_id, _ in bidders:
                if bidder_id in auction.active_bidders:
                    public = auction.get_public_state()
                    private = auction.get_private_state(bidder_id)
                    state_info["private"][bidder_id] = private
                    
                    # Get action from agent
                    agent = bidder_agents[bidder_id]
                    if hasattr(agent, 'decide'):
                        actions[bidder_id] = agent.decide(public, private)
                    else:
                        actions[bidder_id] = agent(public, private)  # Callable
            
            # Log this period
            period_log = {
                "period": auction.period,
                "price": auction.get_current_price(),
                "actions": actions.copy(),
                "active_bidders": list(auction.active_bidders)
            }
            period_logs.append(period_log)
            
            # Process period
            outcome = auction.run_period_sync(actions)
            
            if outcome["status"] == "COMPLETED":
                break
        
        # Get final result
        result = auction.get_result()
        
        # Update agent histories
        for bidder_id, outcome_data in result.bidder_outcomes.items():
            self.bidder_histories[bidder_id].append({
                "auction_id": config["auction_id"],
                "won": outcome_data["won"],
                "profit": outcome_data["profit"],
                "remaining_budget": outcome_data["remaining_budget"]
            })
            
            # Record outcome with agent
            agent = bidder_agents.get(bidder_id)
            if agent and hasattr(agent, 'record_outcome'):
                agent.record_outcome(
                    outcome_data["won"],
                    outcome_data.get("cost", 0),
                    outcome_data["profit"]
                )
            
            # Capture scratchpad for LLM agents
            if agent and hasattr(agent, 'get_scratchpad_log'):
                if bidder_id not in self.scratchpad_logs:
                    self.scratchpad_logs[bidder_id] = []
                self.scratchpad_logs[bidder_id].append({
                    "auction_id": config["auction_id"],
                    "scratchpad": agent.get_scratchpad_log()
                })
        
        detailed_log = {
            "config": config,
            "periods": period_logs,
            "result": asdict(result) if hasattr(result, '__dataclass_fields__') else result
        }
        
        return result, detailed_log
    
    def run_tournament(
        self,
        num_auctions: int = 20,
        initial_budget: float = 10000.0,
        mdp_opponents: List[str] = None
    ) -> Dict:
        """
        Run full tournament: LLM vs multiple MDP scripts
        """
        print(f"="*60)
        print(f"COMPUTE AUCTION TOURNAMENT")
        print(f"="*60)
        print(f"Auctions: {num_auctions}")
        print(f"Initial Budget: ${initial_budget:,.2f}")
        print(f"MDP Opponents: {mdp_opponents or list(BIDDER_REGISTRY.keys())[:3]}")
        print(f"="*60)
        
        # Generate auction configs
        configs = self.generate_auction_configs(num_auctions)
        
        # Setup bidders
        bidders: List[Tuple[str, float]] = []
        bidder_agents: Dict[str, any] = {}
        
        # LLM Agent
        llm_agent = LLMBidder("llm_agent", model="default")
        llm_agent.register_for_auction("tournament", initial_budget)
        bidders.append(("llm_agent", initial_budget))
        bidder_agents["llm_agent"] = llm_agent
        
        # MDP Agents
        mdp_types = mdp_opponents or ["myopic", "conservative", "aggressive"]
        
        for i, mdp_type in enumerate(mdp_types):
            bidder_id = f"mdp_{mdp_type}_{i+1}"
            agent = create_bidder(mdp_type, bidder_id)
            bidders.append((bidder_id, initial_budget))
            bidder_agents[bidder_id] = agent
        
        # Track budgets across auctions
        current_budgets = {bidder_id: initial_budget for bidder_id, _ in bidders}
        
        # Run auctions
        all_logs = []
        
        for i, config in enumerate(configs):
            print(f"\n--- Auction {i+1}/{num_auctions}: {config['auction_id']} ---")
            print(f"  Compute: {config['compute_units']} units @ ${config['unit_value']}/unit")
            print(f"  Price: ${config['initial_price']:.2f} → ${config['min_price']:.2f} over {config['max_periods']} periods")
            
            # Update budgets in auction
            updated_bidders = [(bidder_id, current_budgets[bidder_id]) for bidder_id, _ in bidders]
            
            result, log = self.run_single_auction(config, updated_bidders, bidder_agents)
            all_logs.append(log)
            
            # Update budgets for next auction
            for bidder_id, outcome in result.bidder_outcomes.items():
                current_budgets[bidder_id] = outcome["remaining_budget"]
            
            # Print result
            if result.winner:
                profit = result.bidder_outcomes[result.winner]["profit"]
                print(f"  Winner: {result.winner}")
                print(f"  Price: ${result.winning_price:.2f} (Period {result.winning_period})")
                print(f"  Profit: ${profit:.2f}")
            else:
                print(f"  No winner (all passed)")
            
            # Current standings
            print(f"  Budgets remaining:")
            for bidder_id, budget in sorted(current_budgets.items()):
                print(f"    {bidder_id}: ${budget:,.2f}")
        
        # Compile final results
        final_results = self._compile_results(bidders, current_budgets)
        
        return {
            "summary": final_results,
            "auction_logs": all_logs,
            "scratchpad_logs": self.scratchpad_logs
        }
    
    def _compile_results(
        self, 
        bidders: List[Tuple[str, float]], 
        final_budgets: Dict[str, float]
    ) -> Dict:
        """Compile tournament statistics"""
        
        print(f"\n{'='*60}")
        print("TOURNAMENT RESULTS")
        print(f"{'='*60}")
        
        results = {}
        initial_budget = bidders[0][1]  # All started with same
        
        for bidder_id, _ in bidders:
            history = self.bidder_histories.get(bidder_id, [])
            
            auctions_participated = len(history)
            auctions_won = sum(1 for h in history if h.get("won"))
            total_profit = sum(h.get("profit", 0) for h in history)
            final_budget = final_budgets.get(bidder_id, 0)
            
            win_rate = auctions_won / max(1, auctions_participated)
            budget_utilized = initial_budget - final_budget
            profit_per_dollar = total_profit / max(1, budget_utilized) if budget_utilized > 0 else 0
            
            results[bidder_id] = {
                "auctions_participated": auctions_participated,
                "auctions_won": auctions_won,
                "win_rate": round(win_rate * 100, 1),
                "total_profit": round(total_profit, 2),
                "budget_utilized": round(budget_utilized, 2),
                "profit_per_dollar_spent": round(profit_per_dollar, 3),
                "final_budget": round(final_budget, 2)
            }
            
            print(f"\n{bidder_id}:")
            print(f"  Wins: {auctions_won}/{auctions_participated} ({win_rate*100:.1f}%)")
            print(f"  Total Profit: ${total_profit:,.2f}")
            print(f"  Budget Utilized: ${budget_utilized:,.2f}")
            print(f"  Profit/$: ${profit_per_dollar:.3f}")
            print(f"  Final Budget: ${final_budget:,.2f}")
        
        return results


def run_sample_tournament():
    """Run a quick sample tournament for testing"""
    runner = TournamentRunner(random_seed=42)
    
    results = runner.run_tournament(
        num_auctions=5,  # Small for testing
        initial_budget=5000.0,
        mdp_opponents=["myopic", "conservative", "aggressive"]
    )
    
    # Save results
    with open('/home/agent/.openclaw/workspace/compute_auction/logs/sample_tournament.json', 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    print(f"\nDetailed logs saved to logs/sample_tournament.json")
    
    return results


if __name__ == "__main__":
    results = run_sample_tournament()