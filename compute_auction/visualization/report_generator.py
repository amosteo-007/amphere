"""
Visualization & Web Report Generator for Compute Auction Tournament
"""

import json
import os
from typing import Dict, List
from datetime import datetime


class ReportGenerator:
    """Generate HTML reports with visualizations"""
    
    def __init__(self, output_dir: str = "/home/agent/.openclaw/workspace/compute_auction/web"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        os.makedirs(f"{output_dir}/charts", exist_ok=True)
        
    def generate_report(self, tournament_results: Dict) -> str:
        """Generate full HTML report"""
        
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Compute Auction Tournament Results</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            line-height: 1.6;
        }}
        .container {{
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }}
        header {{
            text-align: center;
            padding: 40px 0;
            border-bottom: 1px solid #334155;
            margin-bottom: 30px;
        }}
        h1 {{
            font-size: 2.5em;
            background: linear-gradient(135deg, #60a5fa, #a78bfa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }}
        .subtitle {{
            color: #94a3b8;
            font-size: 1.1em;
        }}
        .timestamp {{
            color: #64748b;
            font-size: 0.9em;
            margin-top: 10px;
        }}
        .grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}
        .card {{
            background: #1e293b;
            border-radius: 12px;
            padding: 20px;
            border: 1px solid #334155;
        }}
        .card h2 {{
            color: #60a5fa;
            margin-bottom: 15px;
            font-size: 1.3em;
        }}
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
        }}
        .stat-box {{
            background: #0f172a;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }}
        .stat-value {{
            font-size: 2em;
            font-weight: bold;
            color: #34d399;
        }}
        .stat-label {{
            color: #94a3b8;
            font-size: 0.85em;
            margin-top: 5px;
        }}
        .leaderboard {{
            width: 100%;
            border-collapse: collapse;
        }}
        .leaderboard th {{
            text-align: left;
            padding: 12px;
            color: #94a3b8;
            border-bottom: 2px solid #334155;
            font-weight: 600;
        }}
        .leaderboard td {{
            padding: 12px;
            border-bottom: 1px solid #334155;
        }}
        .leaderboard tr:hover {{
            background: #334155;
        }}
        .bidder-llm {{
            color: #f472b6;
            font-weight: bold;
        }}
        .bidder-mdp {{
            color: #60a5fa;
        }}
        .winner {{
            color: #34d399;
            font-weight: bold;
        }}
        .chart-container {{
            position: relative;
            height: 300px;
            margin-top: 20px;
        }}
        .auction-detail {{
            background: #1e293b;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            border: 1px solid #334155;
        }}
        .auction-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }}
        .auction-title {{
            color: #60a5fa;
            font-size: 1.2em;
            font-weight: 600;
        }}
        .auction-winner {{
            background: #059669;
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.85em;
        }}
        .auction-winner.none {{
            background: #64748b;
        }}
        .auction-stats {{
            display: flex;
            gap: 20px;
            color: #94a3b8;
            font-size: 0.9em;
            margin-bottom: 15px;
        }}
        .price-curve {{
            height: 200px;
        }}
        .full-width {{
            grid-column: 1 / -1;
        }}
        .scratchpad {{
            background: #0f172a;
            padding: 15px;
            border-radius: 8px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.85em;
            white-space: pre-wrap;
            max-height: 300px;
            overflow-y: auto;
            color: #94a3b8;
        }}
        .scratchpad-entry {{
            margin-bottom: 10px;
            padding-bottom: 10px;
            border-bottom: 1px dashed #334155;
        }}
        .scratchpad-header {{
            color: #60a5fa;
            font-weight: bold;
            margin-bottom: 5px;
        }}
        nav {{
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }}
        nav a {{
            color: #94a3b8;
            text-decoration: none;
            padding: 8px 16px;
            border-radius: 6px;
            background: #1e293b;
            transition: all 0.2s;
        }}
        nav a:hover {{
            background: #334155;
            color: #e2e8f0;
        }}
        nav a.active {{
            background: #60a5fa;
            color: #0f172a;
        }}
        .section {{
            display: none;
        }}
        .section.active {{
            display: block;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🔋 Compute Auction Tournament</h1>
            <p class="subtitle">LLM Agent vs MDP Scripts in Double Dutch Auctions</p>
            <p class="timestamp">Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        </header>
        
        <nav>
            <a href="#overview" class="nav-link active" onclick="showSection('overview')">Overview</a>
            <a href="#leaderboard" class="nav-link" onclick="showSection('leaderboard')">Leaderboard</a>
            <a href="#auctions" class="nav-link" onclick="showSection('auctions')">Auctions</a>
            <a href="#scratchpads" class="nav-link" onclick="showSection('scratchpads')">Scratchpads</a>
            <a href="#analytics" class="nav-link" onclick="showSection('analytics')">Analytics</a>
        </nav>
        
        <div id="overview" class="section active">
            {self._generate_overview(tournament_results)}
        </div>
        
        <div id="leaderboard" class="section">
            {self._generate_leaderboard(tournament_results)}
        </div>
        
        <div id="auctions" class="section">
            {self._generate_auction_details(tournament_results)}
        </div>
        
        <div id="scratchpads" class="section">
            {self._generate_scratchpad_view(tournament_results)}
        </div>
        
        <div id="analytics" class="section">
            {self._generate_analytics(tournament_results)}
        </div>
    </div>
    
    <script>
        function showSection(sectionId) {{
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
            document.getElementById(sectionId).classList.add('active');
            event.target.classList.add('active');
        }}
        
        {self._generate_chart_scripts(tournament_results)}
    </script>
</body>
</html>"""
        
        # Save report
        report_path = os.path.join(self.output_dir, "index.html")
        with open(report_path, 'w') as f:
            f.write(html)
        
        return report_path
    
    def _generate_overview(self, results: Dict) -> str:
        """Generate overview section"""
        summary = results.get("summary", {})
        
        total_auctions = 0
        total_profit = 0
        
        for bidder, stats in summary.items():
            total_auctions = max(total_auctions, stats.get("auctions_participated", 0))
            total_profit += stats.get("total_profit", 0)
        
        # Find best performer
        best_bidder = max(summary.items(), key=lambda x: x[1].get("total_profit", 0)) if summary else ("None", {})
        
        html = f"""
        <div class="grid">
            <div class="card">
                <h2>📊 Tournament Stats</h2>
                <div class="stats-grid">
                    <div class="stat-box">
                        <div class="stat-value">{total_auctions}</div>
                        <div class="stat-label">Total Auctions</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">${total_profit:,.2f}</div>
                        <div class="stat-label">Total Profit</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">{len(summary)}</div>
                        <div class="stat-label">Participants</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">{best_bidder[0]}</div>
                        <div class="stat-label">Top Performer</div>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <h2>🏆 Win Distribution</h2>
                <div class="chart-container">
                    <canvas id="winChart"></canvas>
                </div>
            </div>
            
            <div class="card full-width">
                <h2>💰 Profit by Bidder</h2>
                <div class="chart-container">
                    <canvas id="profitChart"></canvas>
                </div>
            </div>
            
            <div class="card full-width">
                <h2>📈 Win Rate vs Budget Efficiency</h2>
                <div class="chart-container">
                    <canvas id="efficiencyChart"></canvas>
                </div>
            </div>
        </div>
        """
        return html
    
    def _generate_leaderboard(self, results: Dict) -> str:
        """Generate leaderboard table"""
        summary = results.get("summary", {})
        
        # Sort by total profit
        sorted_bidders = sorted(
            summary.items(),
            key=lambda x: x[1].get("total_profit", 0),
            reverse=True
        )
        
        rows = ""
        for i, (bidder_id, stats) in enumerate(sorted_bidders, 1):
            bidder_class = "bidder-llm" if "llm" in bidder_id else "bidder-mdp"
            win_rate = stats.get("win_rate", 0)
            
            rows += f"""
            <tr>
                <td>#{i}</td>
                <td class="{bidder_class}">{bidder_id}</td>
                <td>{stats.get('auctions_won', 0)}/{stats.get('auctions_participated', 0)}</td>
                <td class="{'winner' if win_rate > 50 else ''}">{win_rate:.1f}%</td>
                <td>${stats.get('total_profit', 0):,.2f}</td>
                <td>${stats.get('budget_utilized', 0):,.2f}</td>
                <td>${stats.get('profit_per_dollar_spent', 0):.3f}</td>
                <td>${stats.get('final_budget', 0):,.2f}</td>
            </tr>
            """
        
        html = f"""
        <div class="card">
            <h2>🏅 Tournament Leaderboard</h2>
            <table class="leaderboard">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Bidder</th>
                        <th>Wins/Total</th>
                        <th>Win Rate</th>
                        <th>Total Profit</th>
                        <th>Budget Used</th>
                        <th>Profit/$</th>
                        <th>Final Budget</th>
                    </tr>
                </thead>
                <tbody>
                    {rows}
                </tbody>
            </table>
        </div>
        """
        return html
    
    def _generate_auction_details(self, results: Dict) -> str:
        """Generate detailed auction cards"""
        auction_logs = results.get("auction_logs", [])
        
        html = '<div class="grid">'
        
        for log in auction_logs:
            config = log.get("config", {})
            result = log.get("result", {})
            periods = log.get("periods", [])
            
            auction_id = config.get("auction_id", "unknown")
            winner = result.get("winner")
            winning_price = result.get("winning_price", 0)
            winning_period = result.get("winning_period", "N/A")
            
            # Extract price curve data
            prices = [p.get("price", 0) for p in periods]
            price_data = json.dumps(prices)
            
            # Winner display
            if winner:
                winner_badge = f'<span class="auction-winner">🏆 {winner}</span>'
            else:
                winner_badge = '<span class="auction-winner none">No Winner</span>'
            
            html += f"""
            <div class="auction-detail">
                <div class="auction-header">
                    <span class="auction-title">{auction_id}</span>
                    {winner_badge}
                </div>
                <div class="auction-stats">
                    <span>📦 {config.get('compute_units', 0)} units @ ${config.get('unit_value', 0)}/unit</span>
                    <span>💵 ${config.get('initial_price', 0):.2f} → ${config.get('min_price', 0):.2f}</span>
                    <span>⏱️ {config.get('max_periods', 0)} periods</span>
                    {f'<span>🎯 Period {winning_period}</span>' if winner else ''}
                </div>
                <div class="price-curve">
                    <canvas id="chart-{auction_id}"></canvas>
                </div>
            </div>
            """
        
        html += '</div>'
        return html
    
    def _generate_scratchpad_view(self, results: Dict) -> str:
        """Generate scratchpad view for LLM agent"""
        scratchpad_logs = results.get("scratchpad_logs", {})
        
        html = '<div class="grid">'
        
        for bidder_id, logs in scratchpad_logs.items():
            if not logs:
                continue
                
            entries_html = ""
            for log in logs:
                auction_id = log.get("auction_id", "unknown")
                scratchpad = log.get("scratchpad", [])
                
                entries_html += f'<div class="scratchpad-entry">'
                entries_html += f'<div class="scratchpad-header">{auction_id}</div>'
                
                for entry in scratchpad:
                    entries_html += f"<div>Period {entry.get('period', '?')}: {entry.get('action', '?')} @ ${entry.get('price', 0):.2f}</div>"
                    if 'reasoning' in entry:
                        entries_html += f"<div style='color:#64748b;margin-left:20px'>→ {entry.get('reasoning')}</div>"
                
                entries_html += '</div>'
            
            html += f"""
            <div class="card full-width">
                <h2>📝 Scratchpad: {bidder_id}</h2>
                <div class="scratchpad">
                    {entries_html}
                </div>
            </div>
            """
        
        html += '</div>'
        return html
    
    def _generate_analytics(self, results: Dict) -> str:
        """Generate analytics section"""
        auction_logs = results.get("auction_logs", [])
        
        # Calculate timing patterns
        win_periods = []
        for log in auction_logs:
            result = log.get("result", {})
            if result.get("winning_period") is not None:
                win_periods.append(result.get("winning_period"))
        
        avg_win_period = sum(win_periods) / len(win_periods) if win_periods else 0
        
        html = f"""
        <div class="grid">
            <div class="card">
                <h2>⏰ Timing Analytics</h2>
                <div class="stats-grid">
                    <div class="stat-box">
                        <div class="stat-value">{avg_win_period:.1f}</div>
                        <div class="stat-label">Avg Win Period</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">{len(win_periods)}</div>
                        <div class="stat-label">Completed Auctions</div>
                    </div>
                </div>
            </div>
            
            <div class="card full-width">
                <h2>📊 Win Timing Distribution</h2>
                <div class="chart-container">
                    <canvas id="timingChart"></canvas>
                </div>
            </div>
            
            <div class="card full-width">
                <h2>💵 Price vs Profit Analysis</h2>
                <div class="chart-container">
                    <canvas id="priceProfitChart"></canvas>
                </div>
            </div>
        </div>
        """
        return html
    
    def _generate_chart_scripts(self, results: Dict) -> str:
        """Generate Chart.js initialization scripts"""
        summary = results.get("summary", {})
        auction_logs = results.get("auction_logs", [])
        
        # Prepare data
        bidder_names = list(summary.keys())
        win_counts = [summary[b].get("auctions_won", 0) for b in bidder_names]
        profits = [summary[b].get("total_profit", 0) for b in bidder_names]
        win_rates = [summary[b].get("win_rate", 0) for b in bidder_names]
        budget_efficiency = [
            summary[b].get("profit_per_dollar_spent", 0) * 100 
            for b in bidder_names
        ]
        
        # Colors
        colors = ['#f472b6', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f87171']
        
        scripts = f"""
        // Win Distribution Chart
        new Chart(document.getElementById('winChart'), {{
            type: 'doughnut',
            data: {{
                labels: {json.dumps(bidder_names)},
                datasets: [{{
                    data: {json.dumps(win_counts)},
                    backgroundColor: {json.dumps(colors[:len(bidder_names)])},
                    borderWidth: 0
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{
                    legend: {{ position: 'bottom', labels: {{ color: '#94a3b8' }} }}
                }}
            }}
        }});
        
        // Profit Chart
        new Chart(document.getElementById('profitChart'), {{
            type: 'bar',
            data: {{
                labels: {json.dumps(bidder_names)},
                datasets: [{{
                    label: 'Total Profit ($)',
                    data: {json.dumps(profits)},
                    backgroundColor: {json.dumps(colors[:len(bidder_names)])},
                    borderRadius: 6
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{
                    legend: {{ display: false }}
                }},
                scales: {{
                    y: {{
                        ticks: {{ color: '#94a3b8' }},
                        grid: {{ color: '#334155' }}
                    }},
                    x: {{
                        ticks: {{ color: '#94a3b8' }},
                        grid: {{ display: false }}
                    }}
                }}
            }}
        }});
        
        // Efficiency Scatter
        new Chart(document.getElementById('efficiencyChart'), {{
            type: 'scatter',
            data: {{
                datasets: [{{
                    label: 'Bidders',
                    data: {json.dumps([{'x': wr, 'y': be} for wr, be in zip(win_rates, budget_efficiency)])},
                    backgroundColor: {json.dumps(colors[:len(bidder_names)])},
                    pointRadius: 10
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{
                    legend: {{ display: false }}
                }},
                scales: {{
                    x: {{
                        title: {{ display: true, text: 'Win Rate (%)', color: '#94a3b8' }},
                        ticks: {{ color: '#94a3b8' }},
                        grid: {{ color: '#334155' }}
                    }},
                    y: {{
                        title: {{ display: true, text: 'Budget Efficiency (% profit/$)', color: '#94a3b8' }},
                        ticks: {{ color: '#94a3b8' }},
                        grid: {{ color: '#334155' }}
                    }}
                }}
            }}
        }});
        """
        
        # Add individual auction charts
        for log in auction_logs:
            config = log.get("config", {})
            periods = log.get("periods", [])
            auction_id = config.get("auction_id", "unknown")
            
            prices = [p.get("price", 0) for p in periods]
            labels = list(range(len(prices)))
            
            scripts += f"""
            // {auction_id} Price Curve
            new Chart(document.getElementById('chart-{auction_id}'), {{
                type: 'line',
                data: {{
                    labels: {json.dumps(labels)},
                    datasets: [{{
                        label: 'Price ($)',
                        data: {json.dumps(prices)},
                        borderColor: '#60a5fa',
                        backgroundColor: 'rgba(96, 165, 250, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 3
                    }}]
                }},
                options: {{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {{ legend: {{ display: false }} }},
                    scales: {{
                        y: {{
                            ticks: {{ color: '#64748b', font: {{ size: 10 }} }},
                            grid: {{ color: '#334155' }}
                        }},
                        x: {{
                            ticks: {{ display: false }},
                            grid: {{ display: false }}
                        }}
                    }}
                }}
            }});
            """
        
        # Timing distribution
        win_periods = []
        for log in auction_logs:
            result = log.get("result", {})
            if result.get("winning_period") is not None:
                win_periods.append(result.get("winning_period"))
        
        period_counts = {}
        for p in win_periods:
            period_counts[p] = period_counts.get(p, 0) + 1
        
        scripts += f"""
        // Timing Distribution
        new Chart(document.getElementById('timingChart'), {{
            type: 'bar',
            data: {{
                labels: {json.dumps(list(period_counts.keys()))},
                datasets: [{{
                    label: 'Wins',
                    data: {json.dumps(list(period_counts.values()))},
                    backgroundColor: '#34d399',
                    borderRadius: 4
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{ legend: {{ display: false }} }},
                scales: {{
                    x: {{
                        title: {{ display: true, text: 'Period', color: '#94a3b8' }},
                        ticks: {{ color: '#94a3b8' }},
                        grid: {{ display: false }}
                    }},
                    y: {{
                        title: {{ display: true, text: 'Number of Wins', color: '#94a3b8' }},
                        ticks: {{ color: '#94a3b8', stepSize: 1 }},
                        grid: {{ color: '#334155' }}
                    }}
                }}
            }}
        }});
        """
        
        return scripts


def generate_and_serve(results_path: str = None, port: int = 8080):
    """Generate report and start HTTP server"""
    import http.server
    import socketserver
    import threading
    import webbrowser
    
    # Load results
    if results_path is None:
        results_path = "/home/agent/.openclaw/workspace/compute_auction/logs/sample_tournament.json"
    
    with open(results_path, 'r') as f:
        results = json.load(f)
    
    # Generate report
    generator = ReportGenerator()
    report_path = generator.generate_report(results)
    
    print(f"✅ Report generated: {report_path}")
    
    # Start server
    web_dir = "/home/agent/.openclaw/workspace/compute_auction/web"
    os.chdir(web_dir)
    
    Handler = http.server.SimpleHTTPRequestHandler
    
    with socketserver.TCPServer(("", port), Handler) as httpd:
        print(f"🌐 Server running at http://localhost:{port}")
        print(f"📊 Open http://localhost:{port}/index.html in your browser")
        
        # Open browser
        webbrowser.open(f"http://localhost:{port}/index.html")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Server stopped")
            httpd.shutdown()


if __name__ == "__main__":
    generate_and_serve()