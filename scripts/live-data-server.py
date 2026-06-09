#!/usr/bin/env python3
"""
ClawBox Live Data Server — SSE endpoint for real-time dashboard updates.

Runs on the Jetson alongside update-site-data.py. Monitors the data JSON
files and pushes updates to connected dashboard clients via Server-Sent Events.

Usage:
    python3 scripts/live-data-server.py [--port PORT] [--interval SECONDS]

Defaults: port=8765, interval=10 seconds (checks files for changes)
"""

import argparse
import hashlib
import json
import os
import signal
import socket
import sys
import time
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

REPO_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_DIR / "assets" / "data"
DEFAULT_PORT = 8765
POLL_INTERVAL = 10  # seconds

# Clients connected via SSE
_clients = []


def get_local_ip():
    """Get the primary local IP address."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip


def read_data_files():
    """Read all JSON files from the data directory, return dict of {filename: content}."""
    result = {}
    if not DATA_DIR.exists():
        return result
    for f in sorted(DATA_DIR.glob("*.json")):
        try:
            content = f.read_text()
            result[f.name] = content
        except (OSError, json.JSONDecodeError):
            pass
    return result


def hash_data(data):
    """Quick hash to detect changes."""
    raw = json.dumps(data, sort_keys=True).encode()
    return hashlib.md5(raw).hexdigest()


def broadcast(data_map, event_type="update"):
    """Push data to all connected SSE clients."""
    payload = json.dumps({
        "type": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": data_map,
    })
    dead = []
    for handler in _clients:
        try:
            handler.send_sse(payload, event=event_type)
        except (BrokenPipeError, ConnectionResetError):
            dead.append(handler)
    for h in dead:
        if h in _clients:
            _clients.remove(h)


class SSEHandler(BaseHTTPRequestHandler):
    """HTTP request handler with SSE endpoint."""

    def log_message(self, format, *args):
        # Quieter logs, but still show connections
        if "GET /events" in str(args):
            sys.stderr.write(f"[live-data] SSE client connected\n")
        sys.stderr.flush()

    def _send_headers(self, content_type="text/event-stream", cors=True):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        if cors:
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.end_headers()

    def send_sse(self, data, event="update", retry=5000):
        """Send an SSE message."""
        self.wfile.write(f"retry: {retry}\n".encode())
        self.wfile.write(f"event: {event}\n".encode())
        self.wfile.write(f"data: {data}\n\n".encode())
        self.wfile.flush()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)

        # SSE endpoint
        if parsed.path == "/events":
            self._send_headers()
            _clients.append(self)
            # Send initial data on connect
            data = read_data_files()
            self.send_sse(json.dumps({
                "type": "initial",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": data,
            }), event="initial")
            # Keep connection alive
            while True:
                try:
                    time.sleep(30)
                    self.send_sse("{}", event="heartbeat")
                except (BrokenPipeError, ConnectionResetError, OSError):
                    break
            return

        # JSON data file serving
        if parsed.path.startswith("/data/") and parsed.path.endswith(".json"):
            filename = parsed.path[len("/data/"):]
            filepath = DATA_DIR / filename
            if filepath.exists() and filepath.is_file():
                self._send_headers("application/json")
                self.wfile.write(filepath.read_bytes())
                return
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'{"error":"not found"}')
            return

        # Health check
        if parsed.path == "/health":
            self._send_headers("application/json")
            self.wfile.write(json.dumps({
                "status": "ok",
                "host": get_local_ip(),
                "port": DEFAULT_PORT,
                "data_dir": str(DATA_DIR),
                "clients": len(_clients),
            }).encode())
            return

        # Info/status page
        if parsed.path == "/":
            self._send_headers("text/html")
            html = f"""<!DOCTYPE html>
<html><head><title>ClawBox Live Data Server</title>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{{font-family:sans-serif;background:#1a1a2e;color:#e0e0e0;padding:2em}}
h1{{color:#f97316}}pre{{background:#16213e;padding:1em;border-radius:8px}}
.status{{color:#22c55e}}</style></head><body>
<h1>🦞 ClawBox Live Data Server</h1>
<p class="status">● Running</p>
<pre>Host: {get_local_ip()}:{DEFAULT_PORT}
Data: {DATA_DIR}
Clients: {len(_clients)}
SSE:  <a href="/events" style="color:#f97316">/events</a>
Data: <a href="/data/health.json" style="color:#f97316">/data/health.json</a>
</pre></body></html>"""
            self.wfile.write(html.encode())
            return

        # 404
        self.send_response(404)
        self.end_headers()
        self.wfile.write(b"Not found")


def file_watcher():
    """Background loop: poll data files for changes, broadcast updates."""
    last_hash = None
    while True:
        time.sleep(POLL_INTERVAL)
        if not _clients:
            # No one listening, skip
            continue
        data = read_data_files()
        h = hash_data(data)
        if h != last_hash:
            broadcast(data, "update")
            last_hash = h


def main():
    parser = argparse.ArgumentParser(description="ClawBox Live Data Server")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="HTTP port")
    parser.add_argument("--interval", type=int, default=POLL_INTERVAL,
                        help="File poll interval (seconds)")
    args = parser.parse_args()

    port = args.port
    POLL_INTERVAL = args.interval

    # Start file watcher in background thread
    import threading
    watcher = threading.Thread(target=file_watcher, daemon=True)
    watcher.start()

    server = HTTPServer(("0.0.0.0", port), SSEHandler)

    def shutdown(sig, frame):
        print(f"\nShutting down...", file=sys.stderr)
        server.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    ip = get_local_ip()
    print(f"🦞 ClawBox Live Data Server", file=sys.stderr)
    print(f"   SSE:  http://{ip}:{port}/events", file=sys.stderr)
    print(f"   Data: http://{ip}:{port}/data/", file=sys.stderr)
    print(f"   Poll: {POLL_INTERVAL}s", file=sys.stderr)
    print(f"   Dir:  {DATA_DIR}", file=sys.stderr)
    sys.stderr.flush()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    main()
