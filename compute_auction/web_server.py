#!/usr/bin/env python3
"""
Quick web server for viewing auction tournament results
"""

import os
import sys
import json
import http.server
import socketserver
import webbrowser
from threading import Timer

PORT = 8080
WEB_DIR = "/home/agent/.openclaw/workspace/compute_auction/web"

def generate_report():
    """Generate fresh report from latest results"""
    sys.path.insert(0, '/home/agent/.openclaw/workspace/compute_auction')
    
    from visualization.report_generator import ReportGenerator
    
    results_path = "/home/agent/.openclaw/workspace/compute_auction/logs/sample_tournament.json"
    
    if os.path.exists(results_path):
        with open(results_path, 'r') as f:
            results = json.load(f)
        
        generator = ReportGenerator()
        report_path = generator.generate_report(results)
        print(f"✅ Report generated: {report_path}")
        return True
    else:
        print(f"⚠️ No results found at {results_path}")
        print("Run: python3 run_tournament.py")
        return False

def serve():
    """Start HTTP server"""
    os.makedirs(WEB_DIR, exist_ok=True)
    os.chdir(WEB_DIR)
    
    Handler = http.server.SimpleHTTPRequestHandler
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"🌐 Server running at http://localhost:{PORT}")
        print(f"📊 View at: http://localhost:{PORT}/index.html")
        print("\nPress Ctrl+C to stop")
        
        # Auto-open browser
        def open_browser():
            webbrowser.open(f"http://localhost:{PORT}/index.html")
        Timer(1.0, open_browser).start()
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Server stopped")

if __name__ == "__main__":
    # Generate report first
    if generate_report():
        serve()
    else:
        print("\nRun a tournament first:")
        print("  cd /home/agent/.openclaw/workspace/compute_auction")
        print("  python3 run_tournament.py")
