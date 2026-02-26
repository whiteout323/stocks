#!/usr/bin/env python3
"""
Simple HTTP server for the SPY Momentum Scanner frontend.
Serves the frontend/ directory on http://localhost:8080

Usage:
  python3 serve.py           # default port 8080
  python3 serve.py 3000      # custom port
"""

import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Allow Babel standalone to work with proper MIME types
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def guess_type(self, path):
        if path.endswith(".js"):
            return "application/javascript"
        return super().guess_type(path)


if __name__ == "__main__":
    with http.server.HTTPServer(("", PORT), Handler) as httpd:
        print(f"\n  \u25C8 SPY Momentum Scanner")
        print(f"  Dashboard: http://localhost:{PORT}")
        print(f"  Serving:   {DIRECTORY}")
        print(f"\n  Press Ctrl+C to stop.\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Server stopped.")
