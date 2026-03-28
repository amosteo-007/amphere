#!/usr/bin/env python3
"""
AMP Simulation Engine - MVP (3-cycle proof of concept)

Layer 2: LLM Swarm Simulation
- Loads 7 archetype profiles from tournament data
- Runs 3-cycle simulation (30 days, 10-day intervals)
- Each agent adopts a role + archetype
- Outputs decision logs with reasoning
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Any
import asyncio

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARCHETYPES_PATH = os.path.join(BASE_DIR, "archetypes", "profiles.json")
LOGS_DIR = os.path.join(BASE_DIR, "logs")

class ArchetypeMapper:
    """Loads and manages archetype profiles from tournament data."""
    
    def __init__(self, profiles_path: str):
        with open(profiles_path, 'r') as f:
            self.profiles = json.load(f)
    
    def get_archetype(self, model_name: str) -> Dict[str, Any]:
        """Get archetype profile by model name."""
        return self.profiles.get(model_name.lower())
    
    def get_all_archetypes(self) -> Dict[str, Dict[str, Any]]:
        """Return all archetype profiles."""
        return self.profiles


class Agent:
    """Represents a single agent in the simulation."""
    
    def __init__(self, model_name: str, role: str, archetype: Dict[str, Any]):
        self.model_name = model_name
        self.role = role
        self.archetype = archetype
        self.decisions: List[Dict[str, Any]] = []
    
    def generate_prompt(self, scenario: Dict[str, Any], cycle: int, 
                       market_state: Dict[str, Any]) -> str:
        """Generate the decision prompt for this agent."""
        
        traits = self.archetype['traits']
        metrics = self.archetype.get('tournament_metrics', {})
        
        prompt = f"""=== SYSTEM ROLE ===
You are participating in a multi-agent economic simulation. You will adopt a specific 
role and behavioral archetype derived from 75 tournament runs.

=== YOUR IDENTITY ===
**Model:** {self.model_name.upper()}
**Role:** {self.role}
**Archetype:** {self.archetype['label']}

**Your Behavioral DNA (from tournament data):**
- Risk Tolerance: {traits['risk_tolerance']:.2f}/1.0 → {self._interpret_risk(traits['risk_tolerance'])}
- Planning Horizon: {traits['planning_horizon']:.2f}/1.0 → {self._interpret_planning(traits['planning_horizon'])}
- Adaptability: {traits['adaptability']:.2f}/1.0 → {self._interpret_adaptability(traits['adaptability'])}
- Assertiveness: {traits['assertiveness']:.2f}/1.0 → {self._interpret_assertiveness(traits['assertiveness'])}
- Consistency: {traits['consistency']:.2f}/1.0 → {self._interpret_consistency(traits['consistency'])}

**Tournament Metrics:**
{self._format_metrics(metrics)}

**Simulation Behavior:** {self.archetype['simulation_behavior']}

=== SCENARIO CONTEXT ===
**Event:** {scenario['event']}
**Market Impact:**
{self._format_market_impact(scenario['market_impact'])}

**Your Situation:**
{scenario['role_context'].get(self.role, "No specific context provided.")}

=== DECISION CYCLE ===
**Cycle:** {cycle} of 3 (Days {(cycle-1)*10+1}-{cycle*10} of 30-day simulation)

**Previous Cycle Actions:**
{self._format_previous_actions(cycle)}

**Market State:**
- Oil Price: ${market_state.get('oil_price', 80):.2f}/bbl ({market_state.get('oil_price_change', 0):+.1f}%)
- Shipping Rates: ${market_state.get('shipping_rate', 10000):.0f}/day ({market_state.get('shipping_rate_change', 0):+.1f}%)
- Market Volatility: {market_state.get('volatility', 'moderate')}

=== AVAILABLE ACTIONS ===
1. **Price Adjustment:** -10% to +40% (applies to next shipment/contract)
2. **Volume Adjustment:** -30% to +20% (production/supply quantity)
3. **Contract Action:** Hold terms, Renegotiate, Cancel, Delay
4. **Hedging:** Lock forward contract for next 30 days (Yes/No)
5. **Strategic Move:** (open-ended, e.g., "seek alternative suppliers", "announce expansion")

=== OUTPUT FORMAT ===
Respond ONLY with valid JSON:

{{
  "price_change_pct": <number>,
  "volume_change_pct": <number>,
  "contract_action": "<hold|renegotiate|cancel|delay>",
  "hedge": <true|false>,
  "strategic_move": "<optional text>",
  "reasoning": "<2-4 sentences explaining your decision in character, referencing your archetype traits>"
}}

=== CONSTRAINTS ===
- Your decisions MUST reflect your archetype traits
- Consider your role's incentives and constraints
- Respond to market conditions and other agents' actions
- Your reasoning should explicitly reference your behavioral DNA

Begin."""
        
        return prompt
    
    def _interpret_risk(self, value: float) -> str:
        if value >= 0.8: return "Very high - commits aggressively early"
        if value >= 0.6: return "Moderate - balances risk and reward"
        if value >= 0.4: return "Low - selective, avoids overexposure"
        return "Very low - minimal exposure, floor bidding"
    
    def _interpret_planning(self, value: float) -> str:
        if value >= 0.8: return "Long-term - stages budget strategically"
        if value >= 0.6: return "Moderate - some forward planning"
        return "Short-term - focuses on immediate opportunities"
    
    def _interpret_adaptability(self, value: float) -> str:
        if value >= 0.8: return "High - flexible, responds to new information"
        if value >= 0.6: return "Moderate - some flexibility"
        return "Low - sticks to initial decisions"
    
    def _interpret_assertiveness(self, value: float) -> str:
        if value >= 0.8: return "Very high - sets market tone, leads"
        if value >= 0.6: return "Moderate - follows but optimizes"
        if value >= 0.4: return "Low - avoids confrontation"
        return "Very low - non-confrontational, waits for others"
    
    def _interpret_consistency(self, value: float) -> str:
        if value >= 0.9: return "Very high - never reverses course"
        if value >= 0.7: return "Moderate - occasionally adapts"
        return "Low - frequently changes decisions"
    
    def _format_metrics(self, metrics: Dict[str, Any]) -> str:
        lines = []
        if 'budget_s1_pct' in metrics:
            lines.append(f"- Budget S1: {metrics['budget_s1_pct']}%")
        if 'budget_s2_pct' in metrics:
            lines.append(f"- Budget S2: {metrics['budget_s2_pct']}%")
        if 'budget_s3_pct' in metrics:
            lines.append(f"- Budget S3: {metrics['budget_s3_pct']}%")
        if 's1p1_bid_avg' in metrics:
            lines.append(f"- S1P1 Avg Bid: ${metrics['s1p1_bid_avg']}")
        if 'rescind_rate' in metrics:
            lines.append(f"- Rescind Rate: {metrics['rescind_rate']*100:.1f}%")
        if 'skip_rate' in metrics:
            lines.append(f"- Skip Rate: {metrics['skip_rate']*100:.1f}%")
        if 'win_rate' in metrics:
            lines.append(f"- Win Rate: {metrics['win_rate']*100:.1f}%")
        if 'bid_variance' in metrics:
            lines.append(f"- Bid Variance: {metrics['bid_variance']:.2f}")
        if 'price_sensitivity' in metrics:
            lines.append(f"- Price Sensitivity: {metrics['price_sensitivity']:.2f}")
        return "\n".join(lines) if lines else "- No specific metrics available"
    
    def _format_market_impact(self, impact: Dict[str, str]) -> str:
        return "\n".join([f"  - {k}: {v}" for k, v in impact.items()])
    
    def _format_previous_actions(self, cycle: int) -> str:
        if cycle == 1:
            return "First cycle - no previous actions."
        
        actions = []
        for agent_decision in self.decisions[-1] if self.decisions else []:
            actions.append(f"- {agent_decision.get('agent', 'Unknown')}: {agent_decision.get('summary', 'No action')}")
        
        return "\n".join(actions) if actions else "No actions recorded."
    
    async def make_decision(self, scenario: Dict[str, Any], cycle: int,
                           market_state: Dict[str, Any]) -> Dict[str, Any]:
        """Generate decision using LLM (placeholder - would call Ollama/OpenAI)."""
        
        prompt = self.generate_prompt(scenario, cycle, market_state)
        
        # MVP: Return mock decision based on archetype
        # TODO: Replace with actual LLM call
        decision = self._mock_decision(scenario, cycle, market_state)
        decision['prompt'] = prompt  # Include prompt for debugging
        self.decisions.append(decision)
        
        return decision
    
    def _mock_decision(self, scenario: Dict[str, Any], cycle: int,
                       market_state: Dict[str, Any]) -> Dict[str, Any]:
        """Generate mock decision based on archetype traits (for testing)."""
        
        traits = self.archetype['traits']
        
        # Risk tolerance drives price change
        if traits['risk_tolerance'] >= 0.8:
            price_change = 25 + (cycle * 5)  # Aggressive
        elif traits['risk_tolerance'] >= 0.6:
            price_change = 12 + (cycle * 3)  # Moderate
        elif traits['risk_tolerance'] >= 0.4:
            price_change = 5 + (cycle * 2)   # Conservative
        else:
            price_change = 2  # Floor bidder
        
        # Planning horizon drives hedging
        hedge = traits['planning_horizon'] >= 0.7
        
        # Assertiveness drives contract action
        if traits['assertiveness'] >= 0.8:
            contract_action = "renegotiate"
        elif traits['assertiveness'] >= 0.5:
            contract_action = "hold"
        else:
            contract_action = "delay"
        
        return {
            "agent": self.model_name,
            "role": self.role,
            "archetype": self.archetype['label'],
            "cycle": cycle,
            "price_change_pct": price_change,
            "volume_change_pct": -5 if traits['risk_tolerance'] < 0.5 else 0,
            "contract_action": contract_action,
            "hedge": hedge,
            "strategic_move": self._mock_strategic_move(),
            "reasoning": f"Based on my {self.archetype['label']} profile (risk={traits['risk_tolerance']:.2f}, planning={traits['planning_horizon']:.2f}), I'm choosing this path to align with my tournament-derived behavioral patterns."
        }
    
    def _mock_strategic_move(self) -> str:
        """Generate archetype-specific strategic move."""
        label = self.archetype['label']
        
        if "Dominator" in label:
            return "Announce market leadership position, force competitors to respond"
        elif "Optimizer" in label:
            return "Wait for market clarity, then optimize positioning"
        elif "Scavenger" in label:
            return "Identify undervalued opportunities from distressed players"
        elif "Conservative" in label:
            return "Protect core relationships, avoid speculative moves"
        elif "Gambler" in label:
            return "High-risk bet on market reversal"
        elif "Contrarian" in label:
            return "Buy when others are fearful, sell when greedy"
        elif "Accumulator" in label:
            return "Steady relationship building, no dramatic moves"
        else:
            return "Monitor market conditions"


class SimulationEngine:
    """Main simulation orchestrator."""
    
    def __init__(self, archetypes_path: str = ARCHETYPES_PATH):
        self.mapper = ArchetypeMapper(archetypes_path)
        self.agents: List[Agent] = []
        self.market_state = {
            "oil_price": 80.0,
            "shipping_rate": 10000.0,
            "volatility": "moderate",
            "oil_price_change": 0,
            "shipping_rate_change": 0
        }
        self.decision_log: List[Dict[str, Any]] = []
    
    def setup_scenario(self, scenario_name: str) -> Dict[str, Any]:
        """Load scenario configuration."""
        
        scenarios = {
            "hormuz_closure": {
                "event": "Strait of Hormuz closed due to geopolitical tensions",
                "market_impact": {
                    "Crude oil": "+28%",
                    "Bunker fuel spot": "+35%",
                    "Shipping rates (alternative routes)": "+52%",
                    "Insurance premiums": "+40%"
                },
                "role_context": {
                    "Oil Producer": "You control 5% of global crude production. Hormuz closure affects 30% of your exports.",
                    "Shipping Company": "You operate 50 tankers. 35% normally transit Hormuz. Alternative routes add 12 days.",
                    "Utilities CFO": "You rely on bunker oil for 40% of power generation. 60-day inventory on hand.",
                    "Competitor Utility": "You have diversified suppliers but higher cost base than CFO's company.",
                    "Bank/Lender": "You have $500M credit line outstanding to CFO's company. Covenant: debt/EBITDA < 4x.",
                    "Bunker Oil Supplier": "You supply 3 major utilities. Hormuz closure adds $18/MT to your costs.",
                    "Insurance Company": "You underwrite war risk for tankers. Claims up 300% since closure."
                }
            }
        }
        
        return scenarios.get(scenario_name, scenarios["hormuz_closure"])
    
    def assign_roles(self, scenario: Dict[str, Any]) -> List[Agent]:
        """Assign archetypes to roles."""
        
        # MVP: Simple assignment (7 archetypes, 7 roles)
        role_assignments = [
            ("anthropic", "Oil Producer"),
            ("openai", "Shipping Company"),
            ("google", "Utilities CFO"),
            ("deepseek", "Competitor Utility"),
            ("kimi", "Bank/Lender"),
            ("groq", "Bunker Oil Supplier"),
            ("mistral", "Insurance Company")
        ]
        
        agents = []
        for model, role in role_assignments:
            archetype = self.mapper.get_archetype(model)
            if archetype:
                agent = Agent(model, role, archetype)
                agents.append(agent)
        
        self.agents = agents
        return agents
    
    def update_market_state(self, decisions: List[Dict[str, Any]]) -> None:
        """Update market state based on agent decisions."""
        
        # Simple aggregation (MVP)
        avg_price_change = sum(d.get('price_change_pct', 0) for d in decisions) / len(decisions)
        
        self.market_state['oil_price'] *= (1 + avg_price_change / 100)
        self.market_state['oil_price_change'] = avg_price_change
        self.market_state['volatility'] = "high" if avg_price_change > 15 else "moderate"
    
    async def run_cycle(self, scenario: Dict[str, Any], cycle: int) -> List[Dict[str, Any]]:
        """Run a single decision cycle."""
        
        decisions = []
        for agent in self.agents:
            decision = await agent.make_decision(scenario, cycle, self.market_state)
            decisions.append(decision)
        
        # Update market state
        self.update_market_state(decisions)
        
        # Log decisions
        self.decision_log.append({
            "cycle": cycle,
            "decisions": decisions,
            "market_state": self.market_state.copy()
        })
        
        return decisions
    
    async def run_simulation(self, scenario_name: str = "hormuz_closure", 
                            cycles: int = 3) -> Dict[str, Any]:
        """Run the full simulation."""
        
        print(f"🚀 Starting AMP Simulation MVP")
        print(f"Scenario: {scenario_name}")
        print(f"Cycles: {cycles} (30 days, 10-day intervals)")
        print(f"Agents: {len(self.agents)}")
        print("-" * 60)
        
        scenario = self.setup_scenario(scenario_name)
        self.assign_roles(scenario)
        
        for cycle in range(1, cycles + 1):
            print(f"\n📊 Cycle {cycle}/3 (Days {(cycle-1)*10+1}-{cycle*10})")
            decisions = await self.run_cycle(scenario, cycle)
            
            # Print summary
            for d in decisions:
                print(f"  {d['agent']:10} ({d['archetype']:25}): {d['price_change_pct']:+.1f}% price, {d['contract_action']:12}, hedge={d['hedge']}")
        
        # Generate summary report
        return self.generate_report(scenario)
    
    def generate_report(self, scenario: Dict[str, Any]) -> Dict[str, Any]:
        """Generate simulation summary report."""
        
        report = {
            "scenario": scenario['event'],
            "total_cycles": len(self.decision_log),
            "agents": [a.model_name for a in self.agents],
            "final_market_state": self.market_state,
            "decision_logs": self.decision_log,
            "key_insights": self._extract_insights()
        }
        
        # Save to file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_path = os.path.join(LOGS_DIR, f"simulation_{timestamp}.json")
        
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n💾 Report saved to: {report_path}")
        
        return report
    
    def _extract_insights(self) -> List[str]:
        """Extract key insights from decision logs."""
        
        insights = []
        
        # Find most aggressive agent
        all_decisions = [d for cycle in self.decision_log for d in cycle['decisions']]
        max_price = max(all_decisions, key=lambda x: x['price_change_pct'])
        insights.append(f"Most aggressive: {max_price['agent']} ({max_price['archetype']}) with {max_price['price_change_pct']:+.1f}% price change")
        
        # Find hedging behavior
        hedgers = [d for d in all_decisions if d['hedge']]
        insights.append(f"Hedging activity: {len(hedgers)}/{len(all_decisions)} decisions included hedging")
        
        # Market trajectory
        final_oil = self.market_state['oil_price']
        insights.append(f"Oil price trajectory: $80.00 → ${final_oil:.2f} ({(final_oil/80-1)*100:+.1f}%)")
        
        return insights


async def main():
    """Run the MVP simulation."""
    
    engine = SimulationEngine()
    report = await engine.run_simulation(scenario_name="hormuz_closure", cycles=3)
    
    print("\n" + "=" * 60)
    print("📋 SIMULATION SUMMARY")
    print("=" * 60)
    print(f"Scenario: {report['scenario']}")
    print(f"Agents: {', '.join(report['agents'])}")
    print(f"Final Oil Price: ${report['final_market_state']['oil_price']:.2f}")
    print(f"\nKey Insights:")
    for insight in report['key_insights']:
        print(f"  • {insight}")


if __name__ == "__main__":
    asyncio.run(main())
