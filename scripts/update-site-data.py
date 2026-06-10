#!/usr/bin/env python3
"""
ClawBox Site Data Updater
=========================
Reads live system stats, token-watch data, and cron job registry,
then writes JSON data files into the Jekyll site repo and pushes.

Run locally on ClawBox. Designed to run on a cron schedule.
"""

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────
REPO_DIR = Path(__file__).resolve().parent.parent
WORKSPACE = Path(os.environ.get("HOME", "/home/clawbox")) / ".openclaw" / "workspace"
TOKEN_WATCH_DIR = WORKSPACE / "data" / "token-watch"
STATE_DIR = Path(os.environ.get("OPENCLAW_STATE_DIR", str(Path.home() / ".openclaw")))
OPENCLAW_BIN = str(Path.home() / ".local" / "bin" / "openclaw")
# OPENCLAW_CLI env var is an internal OpenClaw runtime var (value: "1"),
# so we ignore it here and use the explicit path.

DATA_DIR = REPO_DIR / "_data"
ASSETS_DATA_DIR = REPO_DIR / "assets" / "data"

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(ASSETS_DATA_DIR, exist_ok=True)

NOW = datetime.now(timezone.utc)
NOW_ISO = NOW.isoformat()


# ── Helpers ────────────────────────────────────────────────────────────

def read_json(path, default=None):
    """Read a JSON file, returning default on failure."""
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default if default is not None else {}


def write_json(path, data):
    """Write data as pretty JSON to path (atomic via temp + rename)."""
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2, default=str)
    tmp.rename(path)


def run_cmd(cmd, timeout=30):
    """Run a shell command, return (returncode, stdout, stderr)."""
    try:
        r = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout
        )
        return r.returncode, r.stdout.strip(), r.stderr.strip()
    except subprocess.TimeoutExpired:
        return -1, "", "timeout"
    except FileNotFoundError:
        return -2, "", "command not found"


def bytes_fmt(n):
    """Format bytes to human-readable string."""
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if abs(n) < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} PB"


# ── 1. System Stats ────────────────────────────────────────────────────

def collect_cpu_stats():
    """Read CPU load from /proc/loadavg and CPU info."""
    info = {"cores": 6, "model": "Cortex-A78AE"}
    try:
        with open("/proc/loadavg") as f:
            parts = f.read().split()
            info["load_1m"] = float(parts[0])
            info["load_5m"] = float(parts[1])
            info["load_15m"] = float(parts[2])
            info["runnable"] = int(parts[3].split("/")[0])
            info["total_processes"] = int(parts[3].split("/")[1])
    except OSError:
        pass
    return info


def collect_memory_stats():
    """Read memory from /proc/meminfo."""
    try:
        meminfo = {}
        with open("/proc/meminfo") as f:
            for line in f:
                m = re.match(r"^(\w+):\s+(\d+)", line)
                if m:
                    meminfo[m.group(1)] = int(m.group(2)) * 1024  # kB → bytes

        total = meminfo.get("MemTotal", 0)
        free = meminfo.get("MemFree", 0)
        buffers = meminfo.get("Buffers", 0)
        cached = meminfo.get("Cached", 0)
        available = meminfo.get("MemAvailable", 0)
        used = total - free - buffers - cached

        return {
            "total_bytes": total,
            "used_bytes": max(used, 0),
            "free_bytes": free,
            "available_bytes": available,
            "used_percent": round((used / total) * 100, 1) if total else 0,
            "total_human": bytes_fmt(total),
            "used_human": bytes_fmt(max(used, 0)),
        }
    except OSError:
        return {"error": "could not read /proc/meminfo"}


def collect_disk_stats():
    """Read disk usage via statvfs on /."""
    try:
        s = os.statvfs("/")
        total = s.f_frsize * s.f_blocks
        free = s.f_frsize * s.f_bfree
        used = total - free
        return {
            "total_bytes": total,
            "used_bytes": used,
            "free_bytes": free,
            "used_percent": round((used / total) * 100, 1) if total else 0,
            "total_human": bytes_fmt(total),
            "used_human": bytes_fmt(used),
            "free_human": bytes_fmt(free),
        }
    except OSError:
        return {"error": "could not stat /"}


def collect_temperature():
    """Read max temperature from thermal zones."""
    temps = []
    tz_dir = Path("/sys/devices/virtual/thermal")
    for tz in sorted(tz_dir.glob("thermal_zone*")):
        try:
            with open(tz / "temp", "r") as f:
                raw = f.read().strip()
            if raw and raw.replace(".", "").replace("-", "").isdigit():
                temps.append(float(raw) / 1000.0)
        except (OSError, ValueError, TypeError):
            pass
    if temps:
        return {
            "value_celsius": round(max(temps), 1),
            "display": f"{max(temps):.1f}°C",
        }
    return {"error": "no thermal data"}


def collect_gpu_stats():
    """Parse tegrastats output for GPU temp and frequency."""
    try:
        r = subprocess.run(
            ["timeout", "2", "tegrastats"],
            capture_output=True, text=True, timeout=5,
        )
        out = r.stdout.strip() if r.stdout else ""
        if not out:
            return {}
        last = out.split("\n")[-1] if "\n" in out else out

        # Parse GPU temp
        gpu_temp = None
        m = re.search(r"gpu@([\d.]+)C", last)
        if m:
            gpu_temp = float(m.group(1))

        # Parse GR3D frequency
        gr3d = None
        m = re.search(r"GR3D_FREQ\s+(\d+)%", last)
        if m:
            gr3d = int(m.group(1))

        result = {}
        if gpu_temp is not None:
            result["temperature_celsius"] = gpu_temp
        if gr3d is not None:
            result["usage_percent"] = gr3d
        result["raw"] = last[:300]
        return result
    except (OSError, subprocess.TimeoutExpired):
        return {}


def collect_uptime():
    """Read uptime from /proc/uptime."""
    try:
        with open("/proc/uptime") as f:
            secs = float(f.read().split()[0])
        days = int(secs // 86400)
        hours = int((secs % 86400) // 3600)
        mins = int((secs % 3600) // 60)
        return {
            "seconds": secs,
            "display": f"{days}d {hours}h {mins}m",
        }
    except (OSError, ValueError):
        return {"display": "unknown"}


def collect_power_thermal():
    """Collect Jetson power & thermal monitoring data.

    Reads from sysfs (INA3221 power monitor, PWM fan, cooling devices)
    and parses tegrastats for power rail data when available.
    """
    data = {
        "power": {"vdd_in_watts": 0, "vdd_cpu_watts": 0, "vdd_gpu_watts": 0,
                  "total_watts": 0, "throttled": False, "throttle_reason": ""},
        "thermal": {"fan_speed_pct": 0, "fan_rpm": 0,
                     "junction_temp": 0, "throttle_temp": 85.0},
    }

    # ── INA3221 power monitor (hwmon1) ──
    try:
        path_in4 = Path("/sys/class/hwmon/hwmon1/in4_input")
        path_in5 = Path("/sys/class/hwmon/hwmon1/in5_input")
        path_in6 = Path("/sys/class/hwmon/hwmon1/in6_input")
        if path_in4.exists():
            vdd_in_mw = int(path_in4.read_text().strip())
            data["power"]["vdd_in_watts"] = round(vdd_in_mw / 1000, 2)
        if path_in5.exists():
            cpu_mw = int(path_in5.read_text().strip())
            data["power"]["vdd_cpu_watts"] = round(cpu_mw / 1000, 2)
        if path_in6.exists():
            gpu_mw = int(path_in6.read_text().strip())
            data["power"]["vdd_gpu_watts"] = round(gpu_mw / 1000, 2)
    except (OSError, ValueError):
        pass

    # Fallback: parse tegrastats raw for power data
    if data["power"]["vdd_in_watts"] == 0:
        try:
            gpu_raw = collect_gpu_stats().get("raw", "")
            m = re.search(r"VDD_IN\s+(\d+)mW", gpu_raw)
            if m:
                data["power"]["vdd_in_watts"] = round(int(m.group(1)) / 1000, 2)
            m = re.search(r"VDD_CPU_GPU_CV\s+(\d+)mW", gpu_raw)
            if m:
                data["power"]["vdd_cpu_watts"] = round(int(m.group(1)) / 1000, 2)
            m = re.search(r"VDD_SOC\s+(\d+)mW", gpu_raw)
            if m:
                data["power"]["vdd_gpu_watts"] = round(int(m.group(1)) / 1000, 2)
        except (OSError, ValueError):
            pass

    total = data["power"]["vdd_in_watts"] + data["power"]["vdd_cpu_watts"] + data["power"]["vdd_gpu_watts"]
    data["power"]["total_watts"] = round(total, 2)

    # ── Throttle status from cooling device alert states ──
    try:
        throttled_parts = []
        throttle_map = {
            "cpu-throttle-alert": "CPU",
            "gpu-throttle-alert": "GPU",
            "cv0-throttle-alert": "CV0",
            "cv1-throttle-alert": "CV1",
            "cv2-throttle-alert": "CV2",
            "soc0-throttle-alert": "SOC0",
            "soc1-throttle-alert": "SOC1",
            "soc2-throttle-alert": "SOC2",
            "hot-surface-alert": "Surface",
        }
        for cd_path in sorted(Path("/sys/devices/virtual/thermal").glob("cooling_device*")):
            try:
                ctype = cd_path.joinpath("type").read_text().strip()
            except OSError:
                continue
            if ctype in throttle_map:
                try:
                    state = int(cd_path.joinpath("cur_state").read_text().strip())
                    if state > 0:
                        throttled_parts.append(throttle_map[ctype])
                except (OSError, ValueError):
                    pass
        if throttled_parts:
            data["power"]["throttled"] = True
            data["power"]["throttle_reason"] = ", ".join(throttled_parts)
    except OSError:
        pass

    # ── Fan speed (RPM + PWM percentage) ──
    try:
        rpm_path = Path("/sys/class/hwmon/hwmon2/rpm")
        if rpm_path.exists():
            data["thermal"]["fan_rpm"] = int(rpm_path.read_text().strip())
    except (OSError, ValueError):
        pass

    try:
        pwm_path = Path("/sys/class/hwmon/hwmon0/pwm1")
        max_state_path = Path("/sys/devices/virtual/thermal/cooling_device2/max_state")
        if pwm_path.exists() and max_state_path.exists():
            pwm_val = int(pwm_path.read_text().strip())
            max_val = int(max_state_path.read_text().strip())
            max_pwm = 255
            data["thermal"]["fan_speed_pct"] = round((pwm_val / max_pwm) * 100)
    except (OSError, ValueError):
        pass

    # ── Junction temperature ──
    try:
        tj_path = Path("/sys/devices/virtual/thermal/thermal_zone8/temp")
        if tj_path.exists():
            data["thermal"]["junction_temp"] = round(int(tj_path.read_text().strip()) / 1000, 1)
    except (OSError, ValueError):
        pass

    return data


def collect_services():
    """Query systemd for service statuses."""
    services = ["openclaw", "ssh", "NetworkManager", "docker", "cron", "nginx"]
    result = {}
    for svc in services:
        rc, active_out, _ = run_cmd(["systemctl", "is-active", svc], timeout=10)
        state = active_out.strip() or "unknown"

        if rc == 0 and state == "active":
            _, since_out, _ = run_cmd(
                ["systemctl", "show", svc, "--property=ActiveEnterTimestamp"], timeout=10
            )
            _, load_out, _ = run_cmd(
                ["systemctl", "show", svc, "--property=LoadState"], timeout=10
            )
            _, sub_out, _ = run_cmd(
                ["systemctl", "show", svc, "--property=SubState"], timeout=10
            )
            entry = {
                "state": state,
                "load_state": load_out.replace("LoadState=", "").strip() if load_out else "loaded",
                "sub_state": sub_out.replace("SubState=", "").strip() if sub_out else "running",
                "since": since_out.replace("ActiveEnterTimestamp=", "").strip() if since_out else "",
            }
        else:
            entry = {"state": state, "load_state": "", "sub_state": "", "since": ""}
        result[svc] = entry
    return result


# ── Network Traffic Stats ──────────────────────────────────────────────
NET_TRAFFIC_STATE_FILE = WORKSPACE / "data" / "network-traffic-state.json"


def collect_network_traffic():
    """Read /proc/net/dev for per-interface traffic and /proc/net/tcp for
    active connection count. Also capture interface metadata from `ip addr`.

    Returns a dict suitable for embedding in health.json under a `network` key.
    """
    # ── Per-interface bytes from /proc/net/dev ──
    interfaces = []
    try:
        with open("/proc/net/dev") as f:
            lines = f.readlines()
    except OSError:
        lines = []

    # Lines look like:
    #   eth0: 123456  789  0  0  0  0  0  0  654321  456  0  0  0  0  0  0
    for line in lines:
        line = line.strip()
        if not line or line.startswith("Inter-|") or line.startswith(" face"):
            continue
        parts = line.split()
        iface = parts[0].rstrip(":")
        if iface == "lo":
            continue
        try:
            rx_bytes = int(parts[1])
            tx_bytes = int(parts[9])
            interfaces.append({
                "name": iface,
                "rx_bytes": rx_bytes,
                "tx_bytes": tx_bytes,
            })
        except (ValueError, IndexError):
            continue

    # ── Active TCP connections from /proc/net/tcp ──
    active_connections = 0
    try:
        with open("/proc/net/tcp") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("sl"):
                    continue
                parts = line.split()
                if len(parts) >= 4:
                    # State is numeric in /proc/net/tcp; 01 = ESTABLISHED
                    if parts[3] == "01":
                        active_connections += 1
    except OSError:
        pass

    # Also check /proc/net/tcp6
    try:
        with open("/proc/net/tcp6") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("sl"):
                    continue
                parts = line.split()
                if len(parts) >= 4 and parts[3] == "01":
                    active_connections += 1
    except OSError:
        pass

    # ── IP addresses via `ip addr` ──
    rc, ip_out, _ = run_cmd(["ip", "-brief", "addr", "show"], timeout=5)
    ip_map = {}
    if rc == 0:
        # lo               UNKNOWN        127.0.0.1/8
        # eth0             UP             192.168.0.122/24
        for line in ip_out.split("\n"):
            parts = line.split()
            if len(parts) >= 3:
                iface = parts[0]
                state = parts[1]
                ips = [p for p in parts[2:] if "/" in p]
                ip_map[iface] = {
                    "state": state,
                    "ips": [ip.split("/")[0] for ip in ips],
                }

    # Merge IP data into interfaces
    for iface_info in interfaces:
        name = iface_info["name"]
        meta = ip_map.get(name, {})
        iface_info["state"] = meta.get("state", "unknown")
        iface_info["ip"] = meta.get("ips", [None])[0] or ""
        # Mark loopback (just in case it got through)
        if name == "lo":
            iface_info["state"] = "unknown"

    # ── Delta-based throughput rate ──
    state = read_json(NET_TRAFFIC_STATE_FILE, {})
    prev = state.get("interfaces", {})
    now_seconds = NOW.timestamp()
    elapsed = now_seconds - state.get("timestamp", now_seconds)

    for iface_info in interfaces:
        name = iface_info["name"]
        prev_iface = prev.get(name, {})
        dt = max(elapsed, 1.0)
        drx = iface_info["rx_bytes"] - prev_iface.get("rx_bytes", iface_info["rx_bytes"])
        dtx = iface_info["tx_bytes"] - prev_iface.get("tx_bytes", iface_info["tx_bytes"])
        iface_info["rx_rate"] = round(max(drx / dt, 0))
        iface_info["tx_rate"] = round(max(dtx / dt, 0))
        iface_info["total_in_human"] = bytes_fmt(iface_info["rx_bytes"])
        iface_info["total_out_human"] = bytes_fmt(iface_info["tx_bytes"])

    # Persist state for delta on next run
    new_state = {
        "timestamp": now_seconds,
        "interfaces": {iface["name"]: iface for iface in interfaces},
    }
    write_json(NET_TRAFFIC_STATE_FILE, new_state)

    # ── Aggregate totals ──
    total_in = sum(iface["rx_bytes"] for iface in interfaces)
    total_out = sum(iface["tx_bytes"] for iface in interfaces)

    return {
        "interfaces": interfaces,
        "active_connections": active_connections,
        "total_in_human": bytes_fmt(total_in),
        "total_out_human": bytes_fmt(total_out),
        "total_in_bytes": total_in,
        "total_out_bytes": total_out,
    }


# ── Network Health State ────────────────────────────────────────────────
NETWORK_HEALTH_STATE_FILE = WORKSPACE / "data" / "network-health-state.json"
PING_COUNT = 3
PING_TIMEOUT = 2  # seconds per ping


def get_default_gateway():
    """Get the default gateway IP from `ip route`."""
    rc, out, _ = run_cmd(["ip", "route", "show", "default"], timeout=5)
    if rc == 0 and out:
        parts = out.split()
        if len(parts) >= 3:
            return parts[2]
    return None


def ping_host(host):
    """Ping a host and return (avg_latency_ms, packet_loss_pct)."""
    rc, out, _ = run_cmd(
        ["ping", "-c", str(PING_COUNT), "-W", str(PING_TIMEOUT), host],
        timeout=15,
    )

    # packet loss
    loss = 100.0
    m = re.search(r"(\d+(?:\.\d+)?)%\s*packet loss", out)
    if m:
        loss = float(m.group(1))

    # average latency
    avg = None
    m = re.search(r"(?:rtt|round-trip)\s+.*?\s+([0-9.]+)/([0-9.]+)/([0-9.]+)/([0-9.]+)\s*ms", out, re.IGNORECASE)
    if m:
        avg = round(float(m.group(2)), 1)
    elif rc == 0:
        avg = 0.0  # reachable but no rtt line (unlikely but safe)

    return avg, loss


def collect_network_health():
    """Ping key endpoints and record latency + packet loss history."""
    state = read_json(NETWORK_HEALTH_STATE_FILE, {})
    history = state.get("history", {})

    services_config = [
        {"name": "GitHub API", "host": "api.github.com"},
        {"name": "Cloudflare DNS", "host": "1.1.1.1"},
        {"name": "Google DNS", "host": "8.8.8.8"},
    ]

    gw = get_default_gateway()
    if gw:
        services_config.append({"name": "Gateway", "host": gw})

    services = []
    for svc in services_config:
        key = svc["host"]
        svc_history = history.get(key, [])

        avg, loss = ping_host(svc["host"])

        if avg is not None:
            svc_history.append(avg)
            # keep last 10 entries
            svc_history = svc_history[-10:]

        # Determine status
        if avg is None or loss >= 5 or (avg is not None and avg > 500):
            status = "down"
        elif avg >= 300 or loss >= 1:
            status = "degraded"
        else:
            status = "ok"

        max_h = max(svc_history) if svc_history else 1.0
        max_h = max_h if max_h > 0 else 1.0

        services.append({
            "name": svc["name"],
            "host": svc["host"],
            "latency_ms": avg if avg is not None else 0,
            "packet_loss": round(loss, 1),
            "status": status,
            "history": svc_history,
            "max_h": max_h,
        })

        history[key] = svc_history

    # Persist history
    state["history"] = history
    write_json(NETWORK_HEALTH_STATE_FILE, state)

    return {
        "services": services,
        "last_checked": NOW_ISO,
        "services_ok": sum(1 for s in services if s["status"] == "ok"),
        "services_total": len(services),
    }


def collect_processes():
    """Collect top processes by CPU and memory usage."""
    claw_keywords = ["node", "openclaw", "python3"]
    all_procs = []
    rc, out, _ = run_cmd(
        ["ps", "aux", "--sort=-%cpu"], timeout=10
    )
    if rc != 0:
        return {"by_cpu": [], "by_mem": [], "total_processes": 0, "timestamp": NOW_ISO}

    lines = out.strip().split("\n")
    if len(lines) < 2:
        return {"by_cpu": [], "by_mem": [], "total_processes": 0, "timestamp": NOW_ISO}

    for line in lines[1:]:
        parts = line.split(None, 10)
        if len(parts) < 11:
            continue
        try:
            pid = int(parts[1])
            cpu = float(parts[2])
            mem = float(parts[3])
            user = parts[0]
            cmd = parts[10][:60]  # truncate long command lines
            name = cmd.split("/")[-1].split()[0] if cmd else "?"

            is_claw = any(kw in cmd.lower() for kw in claw_keywords)

            if cpu > 50.0:
                severity = "critical"
            elif cpu > 30.0:
                severity = "warning"
            else:
                severity = "ok"

            all_procs.append({
                "pid": pid,
                "name": name,
                "cmd": cmd,
                "cpu_percent": round(cpu, 1),
                "mem_percent": round(mem, 1),
                "user": user,
                "is_claw": is_claw,
                "severity": severity,
            })
        except (ValueError, IndexError):
            continue

    # Top 5 by CPU (already sorted from ps)
    by_cpu = all_procs[:5]

    # Top 5 by memory
    by_mem = sorted(all_procs, key=lambda p: p["mem_percent"], reverse=True)[:5]

    return {
        "by_cpu": by_cpu,
        "by_mem": by_mem,
        "total_processes": len(all_procs),
        "timestamp": NOW_ISO,
    }


# ── GPU History ─────────────────────────────────────────────────────────
GPU_HISTORY_FILE = DATA_DIR / "gpu-history.json"
HEALTH_HISTORY_FILE = DATA_DIR / "health-history.json"


def collect_gpu_history():
    """Append current GPU snapshot to history, keep last 30 days.

    GPU metrics are collected at this moment. We append to a JSON array
    so trends accumulate over time. Old entries (>= 30 days) are pruned.
    """
    gpu_now = collect_gpu_stats()
    if not gpu_now or "raw" in gpu_now and len(gpu_now) <= 1:
        # No meaningful GPU data; skip this collection
        print("   ⚠ No GPU data to record")
        return read_json(GPU_HISTORY_FILE, {"history": []})

    snapshot = {
        "timestamp": NOW_ISO,
        "temperature_celsius": gpu_now.get("temperature_celsius"),
        "usage_percent": gpu_now.get("usage_percent"),
    }

    history_data = read_json(GPU_HISTORY_FILE, {"history": []})
    history_data["history"].append(snapshot)

    # Prune entries older than 30 days
    cutoff = NOW.timestamp() - (30 * 86400)
    history_data["history"] = [
        e for e in history_data["history"]
        if _ts_of(e) >= cutoff
    ]

    history_data["last_updated"] = NOW_ISO
    history_data["total_entries"] = len(history_data["history"])
    return history_data


def _ts_of(entry):
    """Parse ISO timestamp from an entry to a Unix timestamp float."""
    ts = entry.get("timestamp", "")
    try:
        dt = datetime.fromisoformat(ts)
        return dt.timestamp()
    except (ValueError, TypeError, AttributeError):
        return 0


def collect_health_history():
    """Append system health snapshot to history, keep last 90 days.

    Collects CPU load, memory %, disk %, and temperature on each run.
    Prunes entries older than 90 days to keep file size manageable.
    """
    stats = collect_system_stats()

    snapshot = {
        "timestamp": NOW_ISO,
        "cpu_load_1m": stats.get("cpu", {}).get("load_1m"),
        "cpu_load_5m": stats.get("cpu", {}).get("load_5m"),
        "cpu_load_15m": stats.get("cpu", {}).get("load_15m"),
        "memory_percent": stats.get("memory", {}).get("used_percent"),
        "disk_percent": stats.get("disk", {}).get("used_percent"),
        "disk_used_bytes": stats.get("disk", {}).get("used_bytes"),
        "disk_total_bytes": stats.get("disk", {}).get("total_bytes"),
        "temperature_celsius": stats.get("temperature", {}).get("value_celsius"),
    }

    history_data = read_json(HEALTH_HISTORY_FILE, {"history": []})
    history_data["history"].append(snapshot)

    # Prune entries older than 90 days (~4320 entries at 30min intervals)
    cutoff = NOW.timestamp() - (90 * 86400)
    history_data["history"] = [
        e for e in history_data["history"]
        if _ts_of(e) >= cutoff
    ]

    history_data["last_updated"] = NOW_ISO
    history_data["total_entries"] = len(history_data["history"])
    return history_data



def collect_disk_projection(health_history=None):
    """Compute disk usage trends, growth rate, and big directories.

    Reads health history to calculate growth rate (MB/day) and
    linear regression projection for when disk will be full.
    Also scans key directories for big consumers.
    """
    if health_history is None:
        history = read_json(HEALTH_HISTORY_FILE, {"history": []})
    else:
        history = health_history
    history_entries = history.get("history", [])
    
    # Filter entries with disk data
    disk_entries = [(e.get("timestamp", ""), e.get("disk_used_bytes"))
                    for e in history_entries
                    if e.get("disk_used_bytes") and e.get("disk_total_bytes")]

    result = {"history": [], "growth_rate": {}, "projection": {}, "big_dirs": []}

    if len(disk_entries) < 2:
        return result

    # Build history for output
    latest_disk = disk_entries[-1]
    total_bytes = history_entries[-1].get("disk_total_bytes", 1)
    
    result["history"] = sorted([
        {"date": ts[:10], "used_bytes": b, "used_percent": round(b / total_bytes * 100, 1)}
        for ts, b in disk_entries if ts
    ], key=lambda x: x["date"])

    # Linear regression for growth rate
    x_vals = list(range(len(disk_entries)))
    y_vals = [d[1] for d in disk_entries]
    n = len(x_vals)
    
    if n >= 2:
        sum_x = sum(x_vals)
        sum_y = sum(y_vals)
        sum_xy = sum(x * y for x, y in zip(x_vals, y_vals))
        sum_xx = sum(x * x for x in x_vals)
        
        slope = (n * sum_xy - sum_x * sum_y) / (n * sum_xx - sum_x * sum_x) if (n * sum_xx - sum_x * sum_x) else 0

        # Convert slope: 30 min intervals -> bytes/day
        bytes_per_day = slope * 48  # 48 intervals per day
        mb_per_day = bytes_per_day / (1024 * 1024)

        result["growth_rate"] = {
            "per_day_mb": round(mb_per_day, 1),
            "per_week_gb": round(mb_per_day * 7 / 1024, 2),
            "per_month_gb": round(mb_per_day * 30 / 1024, 1),
        }

        # Projection: days until full
        latest_bytes = y_vals[-1]
        remaining = total_bytes - latest_bytes
        if slope > 0:
            days_until_full = int(remaining / (slope * 48)) if (slope * 48) > 0 else 99999
            import datetime
            est_date = (NOW + datetime.timedelta(days=days_until_full)).strftime("%Y-%m-%d")
            result["projection"] = {
                "days_until_full": min(days_until_full, 9999),
                "estimated_date": est_date,
                "current_used_human": bytes_fmt(latest_bytes),
                "total_human": bytes_fmt(total_bytes),
            }

    # Scan big directories
    big_dirs = []
    for path in [STATE_DIR, REPO_DIR, "/var/log"]:
        try:
            rc, out, _ = run_cmd(["du", "-sb", str(path)], timeout=10)
            if rc == 0:
                size_bytes = int(out.split()[0])
                big_dirs.append({
                    "path": str(path),
                    "size_human": bytes_fmt(size_bytes),
                    "size_bytes": size_bytes,
                })
        except (ValueError, IndexError, OSError):
            pass

    # Also scan .openclaw/ data directory
    for sub in ["sessions", "cache"]:
        p = STATE_DIR / sub
        if p.is_dir():
            try:
                rc, out, _ = run_cmd(["du", "-sb", str(p)], timeout=10)
                if rc == 0:
                    size_bytes = int(out.split()[0])
                    big_dirs.append({
                        "path": str(p),
                        "size_human": bytes_fmt(size_bytes),
                        "size_bytes": size_bytes,
                    })
            except (ValueError, IndexError, OSError):
                pass

    result["big_dirs"] = sorted(big_dirs, key=lambda x: -x["size_bytes"])
    result["last_updated"] = NOW_ISO
    return result


def collect_system_stats():
    """Gather all system stats."""
    return {
        "timestamp": NOW_ISO,
        "cpu": collect_cpu_stats(),
        "memory": collect_memory_stats(),
        "disk": collect_disk_stats(),
        "temperature": collect_temperature(),
        "gpu": collect_gpu_stats(),
        "uptime": collect_uptime(),
        "power_thermal": collect_power_thermal(),
        "services": collect_services(),
        "processes": collect_processes(),
        "network": collect_network_traffic(),
        "sessions": collect_active_sessions(),
    }


# ── Active Sessions ───────────────────────────────────────────────────


def collect_active_sessions():
    """Query OpenClaw for active and recent sessions."""
    rc, out, _ = run_cmd([OPENCLAW_BIN, "sessions", "list", "--json"], timeout=15)
    if rc != 0:
        return {"active_count": 0, "sessions": [], "error": "query_failed"}

    try:
        raw = json.loads(out)
    except json.JSONDecodeError:
        return {"active_count": 0, "sessions": [], "error": "parse_failed"}

    raw_sessions = raw.get("sessions", [])
    now_ms = NOW.timestamp() * 1000

    sessions = []
    active_count = 0
    for s in raw_sessions:
        status = s.get("status", "")
        started = s.get("startedAt", 0)
        started_secs = (now_ms - started) / 1000 if started else 0

        if started_secs < 60:
            started_display = "%ds ago" % int(started_secs)
        elif started_secs < 3600:
            started_display = "%dm ago" % int(started_secs / 60)
        else:
            started_display = "%dh ago" % int(started_secs / 3600)

        model = s.get("model", "unknown")
        channel = s.get("channel", s.get("lastChannel", "unknown"))
        tokens = s.get("totalTokens", 0) or 0

        entry = {
            "id": s.get("sessionId", ""),
            "key": s.get("key", ""),
            "model": model,
            "channel": channel,
            "started_ago": started_display,
            "started_ms": started,
            "age_seconds": int(started_secs),
            "estimated_tokens": tokens,
            "tokens_human": human_token_count(tokens),
            "status": status,
        }
        sessions.append(entry)
        if status == "running":
            active_count += 1

    return {
        "active_count": active_count,
        "total_visible": len(sessions),
        "sessions": sessions,
        "last_updated": NOW_ISO,
    }


def human_token_count(tokens):
    if tokens >= 1_000_000:
        return "%.1fM" % (tokens / 1_000_000)
    if tokens >= 1_000:
        return "%dK" % (tokens / 1_000)
    return str(tokens)


# ── 2. Token Watch ─────────────────────────────────────────────────────

def collect_token_usage():
    """Read all daily token-watch files and summarise."""
    daily = []
    totals = {"gemma4": 0, "deepseek": 0, "total": 0, "calls": 0}
    today_str = NOW.strftime("%Y-%m-%d")

    if TOKEN_WATCH_DIR.is_dir():
        for f in sorted(TOKEN_WATCH_DIR.glob("daily-*.json")):
            data = read_json(f)
            if not data:
                continue
            date = data.get("date", "")
            models = data.get("models", {})

            ds_tokens = sum(
                v["tokens"] for k, v in models.items()
                if "deepseek" in k.lower()
            )
            gm_tokens = sum(
                v["tokens"] for k, v in models.items()
                if "gemma" in k.lower()
            )

            entry = {
                "date": date,
                "deepseek_tokens": ds_tokens,
                "gemma4_tokens": gm_tokens,
                "total_tokens": data.get("totalTokens", 0),
                "fresh_tokens": data.get("freshTokens", 0),
                "calls": data.get("calls", 0),
                "last_updated": data.get("lastUpdated", ""),
            }
            daily.append(entry)

            if date == today_str:
                totals["gemma4"] = gm_tokens
                totals["deepseek"] = ds_tokens
                totals["total"] = data.get("totalTokens", 0)
                totals["fresh"] = data.get("freshTokens", 0)
                totals["calls"] = data.get("calls", 0)

    daily_cap = 250_000_000
    pct = round((totals.get("total", 0) / daily_cap) * 100, 1) if daily_cap else 0

    return {
        "today": {
           "deepseek_tokens": totals["deepseek"],
           "gemma4_tokens": totals["gemma4"],
           "total_tokens": totals["total"],
           "fresh_tokens": totals.get("fresh", 0),
           "calls": totals.get("calls", 0),
           "used_percent": pct,
           "deepseek_human": bytes_fmt(totals["deepseek"]),
           "gemma4_human": bytes_fmt(totals["gemma4"]),
           "total_human": bytes_fmt(totals["total"]),
        },
        "daily_history": daily,
        "daily_cap": daily_cap,
        "daily_cap_human": "250M",
        "last_updated": NOW_ISO,
    }


# ── 2.5. LLM Latency Tracking ─────────────────────────────────────────

LATENCY_HISTORY_FILE = DATA_DIR / "latency-history.json"
LATENCY_CURSOR_FILE = WORKSPACE / "data" / "latency-cursor.json"

# OpenClaw sessions directory for trajectory logs
SESSION_DIR = STATE_DIR / "agents" / "main" / "sessions"


def _parse_trajectory_timing(entry):
    """Extract timing info from a model.completed trajectory entry.

    Computes per-turn latency: time between adjacent assistant messages
    (best proxy for actual model response time). Falls back to last
    assistant minus last user timestamp for single-turn conversations.

    Returns dict with model, timestamp, latency_ms, input_tokens, output_tokens
    or None if it can't be parsed.
    """
    snap = entry.get("data", {}).get("messagesSnapshot", [])
    if not snap:
        return None

    asst_idxs = [i for i, m in enumerate(snap) if m.get("role") == "assistant"]
    if not asst_idxs:
        return None

    timestamps = [m.get("timestamp", 0) for m in snap]

    # Per-turn latency: time between adjacent assistant messages
    if len(asst_idxs) >= 2:
        last_asst_idx = asst_idxs[-1]
        prev_asst_idx = asst_idxs[-2]
        latency = timestamps[last_asst_idx] - timestamps[prev_asst_idx]
    else:
        # Single assistant message: use last user message as start
        user_idxs = [i for i, m in enumerate(snap) if m.get("role") == "user"]
        if not user_idxs:
            return None
        last_user_idx = user_idxs[-1]
        latency = timestamps[asst_idxs[-1]] - timestamps[last_user_idx]

    if latency <= 0 or latency > 600000:  # cap at 10 min
        return None

    usage = entry.get("data", {}).get("usage", {})
    return {
        "model": entry.get("modelId", "unknown"),
        "timestamp": entry.get("ts", ""),
        "latency_ms": latency,
        "input_tokens": usage.get("input", 0),
        "output_tokens": usage.get("output", 0),
    }


def collect_latency_history():
    """Scan trajectory files for model.completed entries and compute per-model
    daily latency percentiles (p50, p95, p99). Uses cursor for incremental
    processing. Keeps last 1000 recent requests.
    """
    cursor = read_json(LATENCY_CURSOR_FILE, {"files": {}})
    history = read_json(LATENCY_HISTORY_FILE, {"daily": [], "recent": [], "total_processed": 0})
    recent = history.get("recent", [])
    total_processed = history.get("total_processed", 0)
    new_count = 0

    if not SESSION_DIR.is_dir():
        return {"daily": [], "recent": [], "total_processed": 0, "error": "no_session_dir"}

    # Get trajectory files, sorted by mtime (newest first for limit)
    traj_files = sorted(
        SESSION_DIR.glob("*.trajectory.jsonl"),
        key=lambda f: f.stat().st_mtime, reverse=True
    )

    # Only scan the last 30 files per run (quick)
    for tf in traj_files[:30]:
        fname = tf.name
        previous_lines = cursor.get("files", {}).get(fname, 0)

        try:
            with open(tf) as f:
                lines = f.readlines()
        except (OSError, IOError):
            continue

        total_lines = len(lines)
        if total_lines <= previous_lines:
            continue

        # Process only new lines
        for line in lines[previous_lines:]:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if entry.get("type") != "model.completed":
                continue

            timing = _parse_trajectory_timing(entry)
            if timing:
                # Normalize model name
                mid = timing["model"].replace("deepseek/", "deepseek-").replace("ollama/", "")
                timing["model_short"] = mid

                recent.append(timing)
                new_count += 1
                total_processed += 1

        cursor["files"][fname] = total_lines

    # Keep only last 1000 recent entries
    if len(recent) > 1000:
        recent = recent[-1000:]

    # Persist cursor
    write_json(LATENCY_CURSOR_FILE, cursor)

    # Compute daily percentiles per model
    from collections import defaultdict

    by_model_day = defaultdict(list)
    for r in recent:
        ts = r.get("timestamp", "")
        day = ts[:10] if len(ts) >= 10 else ""
        if day:
            by_model_day[(r["model_short"], day)].append(r["latency_ms"])

    daily = []
    for (model, day), lats in sorted(by_model_day.items()):
        lats_sorted = sorted(lats)
        n = len(lats_sorted)
        p50 = lats_sorted[n // 2] if n else 0
        p95 = lats_sorted[int(n * 0.95)] if n > 1 else (lats_sorted[-1] if lats_sorted else 0)
        p99 = lats_sorted[int(n * 0.99)] if n > 1 else (lats_sorted[-1] if lats_sorted else 0)
        daily.append({
            "date": day,
            "model": model,
            "requests": n,
            "p50_ms": p50,
            "p95_ms": p95,
            "p99_ms": p99,
        })

    # Merge daily from previous history (keep old entries not in current scan)
    existing_daily = { (d["date"], d["model"]): d for d in history.get("daily", []) }
    for d in daily:
        existing_daily[(d["date"], d["model"])] = d

    return {
        "daily": sorted(existing_daily.values(), key=lambda x: (x["date"], x["model"])),
        "recent": recent,
        "total_processed": total_processed,
    }


def collect_token_breakdown():
    """Parse trajectory files for per-session, per-channel, per-model token breakdown.

    Returns channel distribution, top sessions, and cron job breakdown.
    Uses the same cursor as latency tracking (shares trajectory scanning).
    """
    breakdown_file = DATA_DIR / "token-breakdown.json"
    history = read_json(breakdown_file, {"by_channel": [], "top_sessions": [], "by_model": [], "by_cron_job": []})
    from collections import defaultdict

    # Build cron name map (UUID -> human name)
    if not _CRON_NAME_MAP:
        try:
            cj = collect_cron_jobs()
            for j in cj.get("jobs", []):
                jid = j.get("id", "")
                name = j.get("name", jid[:8])
                if jid:
                    _CRON_NAME_MAP[jid] = name
                    _CRON_NAME_MAP[jid[:8]] = name
        except Exception:
            pass

    # Build from recent active sessions
    sessions_data = collect_active_sessions()
    by_channel = defaultdict(int)
    by_model = defaultdict(int)
    by_cron = defaultdict(int)

    for s in sessions_data.get("sessions", []):
        model = s.get("model", "unknown")
        tokens = s.get("estimated_tokens", 0)
        sk = s.get("key", "") or ""

        # Derive channel from session key pattern
        if ":cron:" in sk:
            parts = sk.split(":")
            cron_uuid = parts[3] if len(parts) > 3 else "cron"
            # Resolve name via cron job registry
            cron_name = _CRON_NAME_MAP.get(cron_uuid, cron_uuid[:8])
            by_cron[cron_name] += tokens
            ch = "cron"
        elif ":dashboard" in sk or ":webchat" in sk:
            ch = "webchat"
        elif ":telegram" in sk:
            ch = "telegram"
        elif ":signal" in sk or sk.startswith("agent:main:signal"):
            ch = "signal"
        else:
            ch = "conversation"

        by_channel[ch] += tokens
        by_model[model] += tokens

    total = sum(by_channel.values()) or 1

    result = {
        "by_channel": sorted(
            [{"channel": k, "tokens": v, "percentage": round(v / total * 100, 1)}
             for k, v in by_channel.items()],
            key=lambda x: -x["tokens"]
        ),
        "by_model": sorted(
            [{"model": k, "tokens": v, "percentage": round(v / total * 100, 1)}
             for k, v in by_model.items()],
            key=lambda x: -x["tokens"]
        ),
        "by_cron_job": sorted(
            [{"job": k, "tokens": v} for k, v in by_cron.items()],
            key=lambda x: -x["tokens"]
        ),
        "top_sessions": sorted(
            sessions_data.get("sessions", []),
            key=lambda x: -x.get("estimated_tokens", 0)
        )[:20],
        "total_tokens": total,
        "last_updated": NOW_ISO,
    }
    return result


# Build cron name map once (UUID -> human name)
_CRON_NAME_MAP = {}
try:
    cj = collect_cron_jobs()
    for j in cj.get("jobs", []):
        # Store by job ID prefix (first 8 chars) and full UUID
        jid = j.get("id", "")
        name = j.get("name", jid[:8])
        if jid:
            _CRON_NAME_MAP[jid] = name
            _CRON_NAME_MAP[jid[:8]] = name
except Exception:
    pass


# ── 3. Cron Jobs ───────────────────────────────────────────────────────

def schedule_to_display(sched):
    """Convert schedule object to a human-friendly string."""
    if not sched:
        return "unknown"
    kind = sched.get("kind", "")
    if kind == "every":
        ms = sched.get("everyMs", 0)
        mins = ms // 60000
        if mins < 60:
            return f"Every {mins} min" if mins > 1 else "Every minute"
        hours = mins // 60
        if hours < 24:
            return f"Every {hours}h" if hours > 1 else "Every hour"
        return f"Every {hours // 24}d"
    if kind == "cron":
        expr = sched.get("expr", "")
        tz = sched.get("tz", "")
        suffix = f" ({tz.split('/')[-1]})" if tz else ""
        return f"Cron: {expr}{suffix}"
    if kind == "at":
        return f"At: {sched.get('at', '?')}"
    return str(sched)


def status_badge(status):
    """Map job status to badge class."""
    if not status:
        return "badge-unknown"
    s = status.lower()
    if s in ("ok", "active", "running"):
        return "badge-ok"
    if s in ("error", "failed"):
        return "badge-err"
    if s in ("disabled", "paused"):
        return "badge-warn"
    return "badge-unknown"


def collect_cron_jobs():
    """Query OpenClaw cron list."""
    rc, out, _ = run_cmd([OPENCLAW_BIN, "cron", "list", "--json"], timeout=20)

    if rc != 0:
        return {"jobs": [], "error": "Could not query cron", "last_updated": NOW_ISO}

    try:
        raw = json.loads(out)
    except json.JSONDecodeError:
        return {"jobs": [], "error": "Invalid cron response", "last_updated": NOW_ISO}

    job_list = raw.get("jobs", [])
    jobs = []
    for j in job_list:
        sched = j.get("schedule", {})
        state = j.get("state", {})
        status = state.get("lastStatus", j.get("status", "unknown"))

        jobs.append({
            "id": j.get("id", ""),
            "name": j.get("name", ""),
            "description": j.get("description", ""),
            "schedule": schedule_to_display(sched),
            "model": j.get("payload", {}).get("model", "default"),
            "session_target": j.get("sessionTarget", ""),
            "status": status,
            "badge": status_badge(status),
            "enabled": j.get("enabled", True),
            "next_run": state.get("nextRunAtMs", 0),
            "last_run": state.get("lastRunAtMs", 0),
            "last_duration_ms": state.get("lastDurationMs", 0),
            "consecutive_errors": state.get("consecutiveErrors", 0),
        })

    return {"jobs": jobs, "total": raw.get("total", len(jobs)), "last_updated": NOW_ISO}


# ── 3.5. System Events ────────────────────────────────────────────────

EVENTS_FILE = DATA_DIR / "events.json"


def collect_events(health, cron_jobs, health_history, latency_history):
    """Collect significant system events: token alerts, health breaches, cron failures.

    Returns a reverse-chronological event feed with filtering support.
    Keeps last 500 events, oldest pruned.
    """
    events_data = read_json(EVENTS_FILE, {"events": []})
    existing = events_data.get("events", [])
    new_events = []

    # 1. Check for token-watch alerts
    tw_alert = WORKSPACE / "data" / "token-watch" / "alert.json"
    if tw_alert.is_file():
        try:
            alert = json.loads(tw_alert.read_text())
            level = alert.get("level", "")
            ratio = alert.get("ratio", 0)
            if level:
                new_events.append({
                    "timestamp": NOW_ISO,
                    "type": "critical" if level == "critical" else "warning",
                    "source": "token-watch",
                    "message": f"Daily budget at {ratio:.0%} ({level})",
                    "value": round(ratio * 100, 1),
                })
        except (json.JSONDecodeError, OSError):
            pass

    # 2. Health threshold breaches
    if health:
        temp = health.get("temperature", {}).get("value_celsius", 0)
        if temp > 80:
            new_events.append({"timestamp": NOW_ISO, "type": "critical", "source": "health",
                              "message": f"Temperature reached {temp:.1f}°C", "value": temp})
        elif temp > 70:
            new_events.append({"timestamp": NOW_ISO, "type": "warning", "source": "health",
                              "message": f"Temperature at {temp:.1f}°C", "value": temp})

        mem = health.get("memory", {}).get("used_percent", 0)
        if mem > 90:
            new_events.append({"timestamp": NOW_ISO, "type": "critical", "source": "health",
                              "message": f"Memory at {mem}%", "value": mem})
        elif mem > 80:
            new_events.append({"timestamp": NOW_ISO, "type": "warning", "source": "health",
                              "message": f"Memory at {mem}%", "value": mem})

        disk_pct = health.get("disk", {}).get("used_percent", 0)
        if disk_pct > 95:
            new_events.append({"timestamp": NOW_ISO, "type": "critical", "source": "health",
                              "message": f"Disk at {disk_pct}%", "value": disk_pct})
        elif disk_pct > 80:
            new_events.append({"timestamp": NOW_ISO, "type": "warning", "source": "health",
                              "message": f"Disk at {disk_pct}%", "value": disk_pct})

    # 3. Cron job failures
    if cron_jobs:
        for j in cron_jobs.get("jobs", []):
            errs = j.get("consecutive_errors", 0)
            if errs > 0:
                new_events.append({
                    "timestamp": NOW_ISO,
                    "type": "error",
                    "source": "cron",
                    "message": f"{j.get('name', 'unknown')} has {errs} consecutive errors",
                    "value": errs,
                })

    # 4. LLM latency warnings
    if latency_history:
        for d in latency_history.get("daily", []):
            p99 = d.get("p99_ms", 0)
            if p99 > 60000:  # > 1 min p99 latency
                new_events.append({
                    "timestamp": NOW_ISO,
                    "type": "warning",
                    "source": "latency",
                    "message": f"{d.get('model', '?')} p99 latency at {p99 / 1000:.0f}s",
                    "value": round(p99 / 1000, 1),
                })

    # 5. Update success event
    new_events.append({
        "timestamp": NOW_ISO,
        "type": "info",
        "source": "system",
        "message": f"Site data updated",
        "value": None,
    })

    # Merge new events at the front
    existing[:0] = new_events

    # Prune to 500
    if len(existing) > 500:
        existing = existing[:500]

    # Count active alerts (errors + warnings from last 24h)
    from datetime import timedelta
    day_ago = NOW - timedelta(hours=24)
    active = [e for e in existing if e.get("type") in ("error", "warning", "critical")
              and _ts_of(e) >= day_ago.timestamp() * 1000]

    return {
        "events": existing,
        "total_events": len(existing),
        "active_count": len(active),
        "last_updated": NOW_ISO,
    }


# ── 4. Write All Data ──────────────────────────────────────────────────

def write_data_files(health, token_usage, cron_jobs, network_health, gpu_history, health_history, latency_history, token_breakdown, disk_projection, events):
    """Write JSON to _data/ (Jekyll) and assets/data/ (static)."""
    site_meta = {
        "site_name": "ClawBox Dashboard",
        "last_updated": NOW_ISO,
        "update_timestamp": NOW.strftime("%Y-%m-%d %H:%M UTC"),
    }

    writes = [
        (DATA_DIR / "health.json", health),
        (DATA_DIR / "token-usage.json", token_usage),
        (DATA_DIR / "cron-jobs.json", cron_jobs),
        (DATA_DIR / "network-health.json", network_health),
        (DATA_DIR / "gpu-history.json", gpu_history),
        (DATA_DIR / "health-history.json", health_history),
        (DATA_DIR / "latency-history.json", latency_history),
        (DATA_DIR / "token-breakdown.json", token_breakdown),
        (DATA_DIR / "disk-history.json", disk_projection),
        (DATA_DIR / "events.json", events),
        (DATA_DIR / "site.json", site_meta),
        (ASSETS_DATA_DIR / "health.json", health),
        (ASSETS_DATA_DIR / "token-usage.json", token_usage),
        (ASSETS_DATA_DIR / "cron-jobs.json", cron_jobs),
        (ASSETS_DATA_DIR / "network-health.json", network_health),
        (ASSETS_DATA_DIR / "gpu-history.json", gpu_history),
        (ASSETS_DATA_DIR / "health-history.json", health_history),
        (ASSETS_DATA_DIR / "latency-history.json", latency_history),
        (ASSETS_DATA_DIR / "token-breakdown.json", token_breakdown),
        (ASSETS_DATA_DIR / "disk-history.json", disk_projection),
        (ASSETS_DATA_DIR / "events.json", events),
        (ASSETS_DATA_DIR / "site.json", site_meta),
    ]

    for path, data in writes:
        write_json(path, data)
        print(f"  ✓ {path.relative_to(REPO_DIR)}")

    return site_meta


# ── 5. Git Commit & Push ───────────────────────────────────────────────

def git_push():
    """Stage data files, commit, pull rebase, and push to origin."""
    rc, _, _ = run_cmd(
        ["git", "-C", str(REPO_DIR), "diff", "--quiet", "--", "_data/", "assets/data/"],
        timeout=10,
    )
    if rc == 0:
        print("  ℹ No new data to commit.")
        # Still pull to keep local in sync
        run_cmd(["git", "-C", str(REPO_DIR), "pull", "--rebase", "origin", "main"], timeout=30)
        return True

    cmds = [
        (["git", "-C", str(REPO_DIR), "add", "--", "_data/", "assets/data/"],
         "Staging data files"),
        (["git", "-C", str(REPO_DIR),
          "commit", "-m",
          f"auto: update site data [{NOW.strftime('%Y-%m-%d %H:%M UTC')}]"],
         "Committing"),
        (["git", "-C", str(REPO_DIR), "pull", "--rebase", "origin", "main"],
         "Pulling remote changes"),
        (["git", "-C", str(REPO_DIR), "push", "origin", "main"],
         "Pushing"),
    ]

    for cmd, label in cmds:
        rc, out, err = run_cmd(cmd, timeout=30)
        if rc != 0:
            # pull --rebase can conflict; try to abort
            if "pull" in cmd and rc != 0:
                run_cmd(["git", "-C", str(REPO_DIR), "rebase", "--abort"], timeout=10)
            print(f"  ✗ {label}: {err or out}")
            return False
        if out:
            first = out.split("\n")[0]
            print(f"  ✓ {first[:120]}")

    print("  ✓ Pushed to origin/main")
    return True


# ── Main ───────────────────────────────────────────────────────────────

def main():
    print(f"🦞 ClawBox Site Data Updater — {NOW_ISO}")
    print()

    print("📡 Collecting system stats...")
    health = collect_system_stats()
    cpu = health["cpu"]
    mem = health["memory"]
    disk = health["disk"]
    temp = health["temperature"]
    net = health.get("network", {})
    print(f"   CPU: {cpu.get('load_1m', '?'):.2f} | "
          f"Mem: {mem.get('used_percent', '?')}% | "
          f"Disk: {disk.get('used_percent', '?')}% | "
          f"Temp: {temp.get('display', '?')} | "
          f"Net: {net.get('total_in_human', '?')} in / {net.get('total_out_human', '?')} out / {net.get('active_connections', '?')} conns")
    sessions = health.get("sessions", {})
    print(f"   Sessions: {sessions.get('active_count', 0)} active, {sessions.get('total_visible', 0)} visible")

    print("📊 Collecting token usage...")
    token_usage = collect_token_usage()
    today = token_usage["today"]
    print(f"   DeepSeek: {today.get('deepseek_human', '?')} | "
          f"Gemma 4: {today.get('gemma4_human', '?')} | "
          f"Cap: {today.get('used_percent', 0)}% used")
    print(f"   History: {len(token_usage['daily_history'])} days")

    print("⏰ Collecting cron jobs...")
    cron_jobs = collect_cron_jobs()
    print(f"   {cron_jobs['total']} jobs found")

    print("🌐 Collecting network health...")
    network_health = collect_network_health()
    ok_count = network_health['services_ok']
    total_count = network_health['services_total']
    print(f"   {ok_count}/{total_count} services reachable")

    print("📈 Collecting GPU history...")
    gpu_history = collect_gpu_history()
    print(f"   {gpu_history.get('total_entries', 0)} entries recorded")

    print("📈 Collecting health history...")
    health_history = collect_health_history()
    print(f"   {health_history.get('total_entries', 0)} entries recorded")

    print("⏱ Collecting LLM latency...")
    latency_history = collect_latency_history()
    print(f"   {latency_history.get('total_processed', 0)} total requests processed")

    print("📊 Collecting token breakdown...")
    token_breakdown = collect_token_breakdown()
    channels = len(token_breakdown.get('by_channel', []))
    print(f"   {channels} channels, {token_breakdown.get('total_tokens', 0)} tokens tracked")

    print("💾 Scanning disk growth trends...")
    disk_projection = collect_disk_projection(health_history=health_history)
    gr = disk_projection.get("growth_rate", {})
    print(f"   {gr.get('per_day_mb', 0)} MB/day growth, {disk_projection.get('projection', {}).get('days_until_full', 0)} days until full")

    print("📋 Collecting system events...")
    events = collect_events(health, cron_jobs, health_history, latency_history)
    print(f"   {len(events.get('events', []))} events recorded")

    print()
    print("💾 Writing data files...")
    site_meta = write_data_files(health, token_usage, cron_jobs, network_health, gpu_history, health_history, latency_history, token_breakdown, disk_projection, events)

    print()
    print("📤 Pushing to GitHub...")
    ok = git_push()

    print()
    if ok:
        print("✅ Site data updated and pushed successfully.")
    else:
        print("⚠️  Data written locally but git push had issues.")
        sys.exit(1)


if __name__ == "__main__":
    main()
