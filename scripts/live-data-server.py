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
import threading
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
    result = {}
    if not DATA_DIR.exists():
        return result
    for f in sorted(DATA_DIR.glob("*.json")):
        try:
            result[f.name] = f.read_text()
        except OSError:
            pass
    return result


def hash_data(data):
    raw = json.dumps(data, sort_keys=True).encode()
    return hashlib.md5(raw).hexdigest()


def broadcast(data_map, event_type="update"):
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

    def log_message(self, format, *args):
        if "GET /events" in str(args):
            sys.stderr.write("[live-data] SSE client connected\n")
        elif "GET /health" in str(args):
            pass  # quiet
        else:
            sys.stderr.write("[live-data] %s\n" % (args,))
        sys.stderr.flush()

    def _send_headers(self, ctype="text/event-stream"):
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        if ctype == "text/event-stream":
            self.send_header("Connection", "keep-alive")
        self.end_headers()

    def send_sse(self, data, event="update", retry=5000):
        self.wfile.write("retry: %d\n" % retry)
        self.wfile.write("event: %s\n" % event)
        self.wfile.write("data: %s\n\n" % data)
        self.wfile.flush()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/events":
            self._send_headers("text/event-stream")
            _clients.append(self)
            data = read_data_files()
            self.send_sse(json.dumps({
                "type": "initial",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": data,
            }), event="initial")
            while True:
                try:
                    time.sleep(30)
                    self.send_sse("{}", event="heartbeat")
                except (BrokenPipeError, ConnectionResetError, OSError):
                    break
            return

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

        self.send_response(404)
        self.end_headers()
        self.wfile.write(b"Not found")


def file_watcher():
    last_hash = None
    while True:
        time.sleep(POLL_INTERVAL)
        if not _clients:
            continue
        data = read_data_files()
        h = hash_data(data)
        if h != last_hash:
            broadcast(data, "update")
            last_hash = h


def main():
    global POLL_INTERVAL
    parser = argparse.ArgumentParser(description="ClawBox Live Data Server")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="HTTP port")
    parser.add_argument("--interval", type=int, default=POLL_INTERVAL,
                        help="File poll interval (seconds)")
    args = parser.parse_args()
    POLL_INTERVAL = args.interval

    watcher = threading.Thread(target=file_watcher, daemon=True)
    watcher.start()

    server = HTTPServer(("0.0.0.0", args.port), SSEHandler)

    def shutdown(sig, frame):
        sys.stderr.write("\nShutting down...\n")
        server.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    ip = get_local_ip()
    sys.stderr.write("ClawBox Live Data Server\n")
    sys.stderr.write("  SSE:  http://%s:%d/events\n" % (ip, args.port))
    sys.stderr.write("  Data: http://%s:%d/data/\n" % (ip, args.port))
    sys.stderr.write("  Poll: %ds\n" % POLL_INTERVAL)
    sys.stderr.write("  Dir:  %s\n" % DATA_DIR)
    sys.stderr.flush()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    main()
