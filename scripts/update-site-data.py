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
    }


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


# ── 4. Write All Data ──────────────────────────────────────────────────

def write_data_files(health, token_usage, cron_jobs):
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
        (DATA_DIR / "site.json", site_meta),
        (ASSETS_DATA_DIR / "health.json", health),
        (ASSETS_DATA_DIR / "token-usage.json", token_usage),
        (ASSETS_DATA_DIR / "cron-jobs.json", cron_jobs),
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
    print(f"   CPU: {cpu.get('load_1m', '?'):.2f} | "
          f"Mem: {mem.get('used_percent', '?')}% | "
          f"Disk: {disk.get('used_percent', '?')}% | "
          f"Temp: {temp.get('display', '?')}")

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

    print()
    print("💾 Writing data files...")
    site_meta = write_data_files(health, token_usage, cron_jobs)

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
