#!/usr/bin/env python3
"""
MCP Client — calls the jetson-monitor MCP server tools over stdio JSON-RPC.

Used by update-site-data.py to fetch system stats through the MCP server
instead of reading /proc and running shell commands directly.
"""

import json
import subprocess
import os
import re
from pathlib import Path

MCP_SERVER = Path(os.environ.get("HOME", "/home/clawbox")) / "documents" / "mcp" / "jetson-monitor" / "dist" / "index.js"
MCP_CMD = ["node", str(MCP_SERVER)]

_TIMEOUT = 15  # seconds per call


def _call_mcp(method, params=None):
    """Send a JSON-RPC request to the MCP server over stdio.

    Spawns a fresh server process per call. The MCP server needs
    a moment to start and the JSON must be newline-terminated.
    Returns the parsed result dict on success, or None on failure.
    """
    import time
    if params is None:
        params = {}

    request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params,
    }

    payload = json.dumps(request) + "\n"

    try:
        proc = subprocess.Popen(
            MCP_CMD,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        )
    except (FileNotFoundError, OSError):
        return None

    # Give the server time to start
    time.sleep(1.0)

    try:
        out, _ = proc.communicate(input=payload, timeout=_TIMEOUT)
    except (subprocess.TimeoutExpired, OSError):
        proc.kill()
        return None

    if proc.returncode != 0:
        return None

    try:
        response = json.loads(out.strip())
    except (json.JSONDecodeError, ValueError):
        return None

    if "result" in response:
        return response["result"]
    return None


# ── Tool Wrappers ─────────────────────────────────────────────────────

def get_system_info():
    """Get basic system info: hostname, OS, kernel, uptime, arch."""
    result = _call_mcp("tools/call", {"name": "get_system_info", "arguments": {}})
    if result and "content" in result and result["content"]:
        text = result["content"][0]["text"]
        return _parse_kv(text)
    return {}


def get_cpu_stats():
    """Get CPU usage, load averages, temperature, core count."""
    result = _call_mcp("tools/call", {"name": "get_cpu_stats", "arguments": {}})
    if result and "content" in result and result["content"]:
        text = result["content"][0]["text"]
        return _parse_cpu(text)
    return {}


def get_memory_stats():
    """Get RAM and swap usage."""
    result = _call_mcp("tools/call", {"name": "get_memory_stats", "arguments": {}})
    if result and "content" in result and result["content"]:
        text = result["content"][0]["text"]
        return _parse_memory(text)
    return {}


def get_disk_stats():
    """Get filesystem disk usage."""
    result = _call_mcp("tools/call", {"name": "get_disk_stats", "arguments": {}})
    if result and "content" in result and result["content"]:
        text = result["content"][0]["text"]
        return _parse_disk(text)
    return {}


def get_gpu_stats():
    """Get GPU utilisation, memory, temperature."""
    result = _call_mcp("tools/call", {"name": "get_gpu_stats", "arguments": {}})
    if result and "content" in result and result["content"]:
        text = result["content"][0]["text"]
        return _parse_gpu(text)
    return {}


def get_network_stats():
    """Get network interfaces and traffic counters."""
    result = _call_mcp("tools/call", {"name": "get_network_stats", "arguments": {}})
    if result and "content" in result and result["content"]:
        text = result["content"][0]["text"]
        return _parse_network(text)
    return {}


def get_processes(limit=10):
    """Get top processes by CPU."""
    result = _call_mcp("tools/call", {"name": "get_processes", "arguments": {"limit": limit}})
    if result and "content" in result and result["content"]:
        text = result["content"][0]["text"]
        return {"raw": text}
    return {}


def get_system_health():
    """Get comprehensive health summary with alerts."""
    result = _call_mcp("tools/call", {"name": "get_system_health", "arguments": {}})
    if result and "content" in result and result["content"]:
        text = result["content"][0]["text"]
        return _parse_health(text)
    return {}


# ── Parsers ───────────────────────────────────────────────────────────

def _parse_kv(text):
    """Parse simple 'Key: Value' lines into a dict."""
    result = {}
    for line in text.split("\n"):
        m = re.match(r"^([A-Za-z /_\-]+):\s*(.+)$", line.strip())
        if m:
            result[m.group(1).strip().lower().replace(" ", "_")] = m.group(2).strip()
    return result


def _parse_cpu(text):
    """Parse CPU stats output into structured dict."""
    result = {"cores": 0, "usage_percent": 0, "load_1m": 0, "load_5m": 0, "load_15m": 0, "temperatures": {}}
    in_temps = False
    for line in text.split("\n"):
        line = line.strip()
        if "CPU Usage:" in line:
            m = re.search(r"([\d.]+)%", line)
            if m: result["usage_percent"] = float(m.group(1))
        elif "Cores:" in line:
            m = re.search(r"(\d+)", line)
            if m: result["cores"] = int(m.group(1))
        elif "Load Avg:" in line:
            m = re.search(r"([\d.]+)\s+([\d.]+)\s+([\d.]+)", line)
            if m:
                result["load_1m"] = float(m.group(1))
                result["load_5m"] = float(m.group(2))
                result["load_15m"] = float(m.group(3))
        elif "Temperatures:" in line:
            in_temps = True
        elif in_temps and line.startswith("  "):
            m = re.match(r"\s+(.+):\s+([\d.]+)°C", line)
            if m:
                result["temperatures"][m.group(1).strip()] = float(m.group(2))
    return result


def _parse_memory(text):
    """Parse memory stats into structured dict."""
    result = {"used_gb": 0, "total_gb": 0, "used_percent": 0, "free_gb": 0, "available_gb": 0, "swap_used_gb": 0, "swap_total_gb": 0}
    for line in text.split("\n"):
        line = line.strip()
        if "Memory Usage:" in line:
            m = re.search(r"([\d.]+)\s*/\s*([\d.]+)\s*GB\s*\((\d+)%\)", line)
            if m:
                result["used_gb"] = float(m.group(1))
                result["total_gb"] = float(m.group(2))
                result["used_percent"] = int(m.group(3))
        elif "Free:" in line:
            m = re.search(r"([\d.]+)\s*GB", line)
            if m: result["free_gb"] = float(m.group(1))
        elif "Available:" in line:
            m = re.search(r"([\d.]+)\s*GB", line)
            if m: result["available_gb"] = float(m.group(1))
        elif "Swap:" in line:
            m = re.search(r"([\d.]+)\s*/\s*([\d.]+)\s*GB", line)
            if m:
                result["swap_used_gb"] = float(m.group(1))
                result["swap_total_gb"] = float(m.group(2))
    return result


def _parse_disk(text):
    """Parse disk stats into list of mount dicts."""
    mounts = []
    for line in text.split("\n"):
        line = line.strip()
        m = re.match(r"([^:]+):\s+([\d.]+[A-Z]?)\s*/\s*([\d.]+[A-Z]?)\s*\((\d+)%\s*used\)", line)
        if m:
            mounts.append({
                "mount": m.group(1).strip(),
                "used": m.group(2),
                "total": m.group(3),
                "percent": int(m.group(4)),
            })
    return {"mounts": mounts}


def _parse_gpu(text):
    """Parse GPU stats output."""
    result = {"raw": text}
    for line in text.split("\n"):
        m = re.search(r"GR3D_FREQ\s+(\d+)%", line)
        if m: result["usage_percent"] = int(m.group(1))
        m = re.search(r"gpu@([\d.]+)C", line)
        if m: result["temperature_celsius"] = float(m.group(1))
        m = re.search(r"tj@([\d.]+)C", line)
        if m: result["junction_temp"] = float(m.group(1))
        if "VDD_IN" in line:
            m = re.search(r"VDD_IN\s+(\d+)mW", line)
            if m: result["vdd_in_watts"] = round(int(m.group(1)) / 1000, 2)
            m = re.search(r"VDD_CPU_GPU_CV\s+(\d+)mW", line)
            if m: result["vdd_cpu_watts"] = round(int(m.group(1)) / 1000, 2)
            m = re.search(r"VDD_SOC\s+(\d+)mW", line)
            if m: result["vdd_soc_watts"] = round(int(m.group(1)) / 1000, 2)
    return result


def _parse_network(text):
    """Parse network stats."""
    return {"raw": text}


def _parse_health(text):
    """Parse health summary."""
    result = {"alerts": [], "warnings": []}
    for line in text.split("\n"):
        line = line.strip()
        m = re.search(r"CPU:\s+([\d.]+)%", line)
        if m: result["cpu_percent"] = float(m.group(1))
        m = re.search(r"Memory:\s+([\d.]+)%", line)
        if m: result["memory_percent"] = float(m.group(1))
        m = re.search(r"Disk:\s+(\d+)%", line)
        if m: result["disk_percent"] = int(m.group(1))
        m = re.search(r"Max Temp:\s+([\d.]+)°C", line)
        if m: result["max_temp"] = float(m.group(1))
        if "ALERT" in line: result["alerts"].append(line)
        if "Warning" in line: result["warnings"].append(line)
    return result


# ── Convenience: Fetch all stats at once ──────────────────────────────

def collect_all():
    """Collect all system stats via MCP, return structured dict.

    Compatible with the data structures expected by update-site-data.py.
    Falls back to empty dicts when MCP calls fail.
    """
    info = get_system_info()
    cpu = get_cpu_stats()
    mem = get_memory_stats()
    disk = get_disk_stats()
    gpu = get_gpu_stats()
    health = get_system_health()

    # Build temperature from CPU zone data
    temps = cpu.get("temperatures", {})
    temp_celsius = max(temps.values()) if temps else health.get("max_temp", 0)

    return {
        "cpu": {
            "load_1m": cpu.get("load_1m", 0),
            "load_5m": cpu.get("load_5m", 0),
            "load_15m": cpu.get("load_15m", 0),
            "usage_percent": cpu.get("usage_percent", 0),
            "cores": cpu.get("cores", 6),
            "model": info.get("architecture", "Cortex-A78AE"),
        },
        "memory": {
            "used_gb": mem.get("used_gb", 0),
            "total_gb": mem.get("total_gb", 0),
            "used_percent": mem.get("used_percent", 0),
            "free_gb": mem.get("free_gb", 0),
            "available_gb": mem.get("available_gb", 0),
        },
        "disk": {
            "used_percent": disk.get("mounts", [{}])[0].get("percent", 0) if disk.get("mounts") else 0,
        },
        "temperature": {
            "value_celsius": temp_celsius,
        },
        "gpu": {
            "temperature_celsius": gpu.get("temperature_celsius"),
            "usage_percent": gpu.get("usage_percent"),
            "raw": gpu.get("raw", ""),
        },
        "system": info,
    }


if __name__ == "__main__":
    # Quick self-test
    import pprint
    stats = collect_all()
    pprint.pprint(stats, indent=2, width=100)
