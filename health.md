---
layout: page
title: System Health
permalink: /health/
---

{% assign h = site.data.health %}
{% assign cpu = h.cpu %}
{% assign mem = h.memory %}
{% assign disk = h.disk %}
{% assign temp = h.temperature %}
{% assign gpu = h.gpu %}
{% assign up = h.uptime %}
{% assign cj = site.data.cron-jobs %}
{% assign failing_jobs_cron = cj.jobs | where_exp: "j", "j.consecutive_errors > 0" %}
{% assign failing_cron_count = failing_jobs_cron | size %}
{% capture cron_fail_msg %}{% if failing_cron_count > 0 %}<span class="badge badge-err" id="cron-fail-status">{{ failing_cron_count }} failing</span>{% else %}<span class="badge badge-ok" id="cron-fail-status">All OK</span>{% endif %}{% endcapture %}

{% comment %} ── Threshold logic (duplicated in JS for client-side refresh) ── {% endcomment %}
{% assign cpu_pct = cpu.load_1m | default: 0 | times: 16.67 | round: 1 %}
{% capture cpu_badge %}{% if cpu_pct > 80 %}badge-err{% elsif cpu_pct > 60 %}badge-warn{% else %}badge-ok{% endif %}{% endcapture %}

{% assign temp_val = temp.value_celsius | default: 0 %}
{% capture temp_badge %}{% if temp_val > 80 %}badge-err{% elsif temp_val > 70 %}badge-warn{% else %}badge-ok{% endif %}{% endcapture %}
{% capture temp_class %}{% if temp_val > 80 %}err{% elsif temp_val > 70 %}warn{% else %}ok{% endif %}{% endcapture %}

{% assign mem_pct = mem.used_percent | default: 0 %}
{% capture mem_badge %}{% if mem_pct > 90 %}badge-err{% elsif mem_pct > 80 %}badge-warn{% else %}badge-ok{% endif %}{% endcapture %}
{% capture mem_class %}{% if mem_pct > 90 %}err{% elsif mem_pct > 80 %}warn{% else %}ok{% endif %}{% endcapture %}

{% assign disk_pct = disk.used_percent | default: 0 %}
{% capture disk_badge %}{% if disk_pct > 95 %}badge-err{% elsif disk_pct > 80 %}badge-warn{% else %}badge-ok{% endif %}{% endcapture %}
{% capture disk_class %}{% if disk_pct > 95 %}err{% elsif disk_pct > 80 %}warn{% else %}ok{% endif %}{% endcapture %}

{% assign pt = h.power_thermal %}
{% assign pw = pt.power | default: nil %}
{% assign th = pt.thermal | default: nil %}
{% assign throttled = false %}{% if pw %}{% assign throttled = pw.throttled %}{% endif %}
{% assign fan_pct = 0 %}{% if th %}{% assign fan_pct = th.fan_speed_pct %}{% endif %}

<p class="section-intro">
  Real-time health metrics for the ClawBox Jetson system. CPU load, temperature, memory pressure,
  disk usage, and GPU status &mdash; everything that keeps your AI companion running smoothly.
</p>

<div class="dashboard-grid">
  <div class="dashboard-card">
    <div class="card-title">🧠 CPU</div>
    <div class="stat-row">
      <span class="stat-label">Cores</span>
      <span class="stat-value">{{ cpu.model | default: "Cortex-A78AE" }} ({{ cpu.cores | default: 6 }})</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Load (1m / 5m / 15m)</span>
      <span class="stat-value" id="cpu-load">
        {{ cpu.load_1m | default: "&mdash;" }} / {{ cpu.load_5m | default: "&mdash;" }} / {{ cpu.load_15m | default: "&mdash;" }}
      </span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill {{ cpu_pct | round: 0 }}" id="cpu-bar" style="width: {{ cpu_pct | round: 0 }}%"></div>
    </div>
  </div>

  <div class="dashboard-card">
    <div class="card-title">🌡️ Temperature</div>
    <div class="stat-row">
      <span class="stat-label">Current</span>
      <span class="stat-value" id="temp-value">{{ temp.display | default: "&mdash;" }}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Status</span>
      <span class="stat-value"><span class="badge {{ temp_badge }}" id="temp-badge">
        {% if temp_val > 80 %}Critical{% elsif temp_val > 70 %}Warning{% else %}Normal{% endif %}
      </span></span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill {{ temp_class }}" id="temp-bar" style="width: {{ temp_val | times: 1.25 | round: 0 }}%"></div>
    </div>
  </div>

  <div class="dashboard-card">
    <div class="card-title">💾 Memory</div>
    <div class="stat-row">
      <span class="stat-label">Total</span>
      <span class="stat-value">{{ mem.total_human | default: "7.6 GB" }}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Used</span>
      <span class="stat-value" id="mem-used">{{ mem.used_human | default: "&mdash;" }}</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill {{ mem_class }}" id="mem-bar" style="width: {{ mem_pct | round: 0 }}%"></div>
    </div>
  </div>

  <div class="dashboard-card">
    <div class="card-title">💽 Disk</div>
    <div class="stat-row">
      <span class="stat-label">Used</span>
      <span class="stat-value" id="disk-used">{{ disk.used_human | default: "&mdash;" }}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Free</span>
      <span class="stat-value">{{ disk.free_human | default: "&mdash;" }}</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill {{ disk_class }}" id="disk-bar" style="width: {{ disk_pct | round: 0 }}%"></div>
    </div>
  </div>
</div>

<div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.5rem; margin-top: 1rem;">
  <h2 style="font-size: 1.1rem; margin-bottom: 0.75rem;">⚡ GPU</h2>
  <div class="stat-row">
    <span class="stat-label">Temperature</span>
    <span class="stat-value" id="gpu-temp">{{ gpu.temperature_celsius | default: "&mdash;" }}°C</span>
  </div>
  <div class="stat-row">
    <span class="stat-label">Usage</span>
    <span class="stat-value" id="gpu-usage">{{ gpu.usage_percent | default: "&mdash;" }}%</span>
  </div>
  <div class="stat-row">
    <span class="stat-label">Status</span>
    <span class="stat-value" id="gpu-status">
      <span class="badge badge-ok">Operational</span>
    </span>
  </div>
</div>

{% comment %} ── Power & Thermal section ── {% endcomment %}
<div id="power-thermal-section" class="power-thermal-section" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.5rem; margin-top: 1rem;">
  <h2 style="font-size: 1.1rem; margin-bottom: 0.75rem;">
    🔌 Power &amp; Thermal
    <span id="throttle-warning" class="throttle-warning" style="display: {% if throttled %}inline-block{% else %}none{% endif %};">
      ⚠️ Thermal Throttling Active
    </span>
  </h2>
  <div class="power-gauge-grid">
    <div class="gauge-card">
      <div class="gauge-label">VDD_IN</div>
      <div class="gauge-bar-container">
        <div class="gauge-bar" id="gauge-vdd-in" style="width: {{ pw.vdd_in_watts | times: 6.67 | default: 0 | round: 0 }}%"></div>
      </div>
      <div class="gauge-value" id="gauge-vdd-in-val">{{ pw.vdd_in_watts | default: "&mdash;" }} W</div>
    </div>
    <div class="gauge-card">
      <div class="gauge-label">VDD_CPU</div>
      <div class="gauge-bar-container">
        <div class="gauge-bar" id="gauge-vdd-cpu" style="width: {{ pw.vdd_cpu_watts | times: 6.67 | default: 0 | round: 0 }}%"></div>
      </div>
      <div class="gauge-value" id="gauge-vdd-cpu-val">{{ pw.vdd_cpu_watts | default: "&mdash;" }} W</div>
    </div>
    <div class="gauge-card">
      <div class="gauge-label">VDD_SOC</div>
      <div class="gauge-bar-container">
        <div class="gauge-bar" id="gauge-vdd-gpu" style="width: {{ pw.vdd_gpu_watts | times: 6.67 | default: 0 | round: 0 }}%"></div>
      </div>
      <div class="gauge-value" id="gauge-vdd-gpu-val">{{ pw.vdd_gpu_watts | default: "&mdash;" }} W</div>
    </div>
    <div class="gauge-card gauge-card-total">
      <div class="gauge-label">Total</div>
      <div class="gauge-bar-container">
        <div class="gauge-bar gauge-bar-total" id="gauge-total" style="width: {{ pw.total_watts | times: 6.67 | default: 0 | round: 0 }}%"></div>
      </div>
      <div class="gauge-value gauge-value-total" id="gauge-total-val">{{ pw.total_watts | default: "&mdash;" }} W</div>
    </div>
  </div>

  <div class="thermal-grid">
    <div class="thermal-item">
      <span class="stat-label">Junction Temp</span>
      <span class="stat-value" id="junct-temp">{{ th.junction_temp | default: "&mdash;" }}°C</span>
    </div>
    <div class="thermal-item">
      <span class="stat-label">Fan Speed</span>
      <span class="stat-value" id="fan-speed">{{ fan_pct }}%</span>
    </div>
    <div class="thermal-item">
      <span class="stat-label">Fan RPM</span>
      <span class="stat-value" id="fan-rpm">{{ th.fan_rpm | default: "&mdash;" }}</span>
    </div>
    <div class="thermal-item">
      <span class="stat-label">Throttle Temp</span>
      <span class="stat-value" id="throttle-temp">{{ th.throttle_temp | default: 85.0 }}°C</span>
    </div>
  </div>

  <div id="throttle-detail" class="throttle-detail" style="display: {% if throttled %}block{% else %}none{% endif %};">
    <span class="stat-label">Throttle Reason</span>
    <span class="stat-value" id="throttle-reason">{{ pw.throttle_reason | default: "Unknown" }}</span>
  </div>
</div>

{% assign svc = h.services | default: nil %}
<div id="services-section" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.5rem; margin-top: 1rem;">
  <h2 style="font-size: 1.1rem; margin-bottom: 0.75rem;">⚙️ System Services</h2>
  <div id="services-table">
    {% if svc %}
    <table class="services-table">
      <thead><tr><th>Service</th><th>Status</th><th>Since</th></tr></thead>
      <tbody>
      {% for entry in svc %}
      <tr>
        <td>{{ entry[0] }}</td>
        <td><span class="badge badge-{% if entry[1].state == 'active' %}ok{% elsif entry[1].state == 'failed' %}err{% else %}warn{% endif %}">{{ entry[1].state }}</span></td>
        <td>{{ entry[1].since | default: "&mdash;" }}</td>
      </tr>
      {% endfor %}
      </tbody>
    </table>
    {% else %}
    <p style="color: var(--text-muted); font-size: 0.9rem;">No service data available yet.</p>
    {% endif %}
  </div>
</div>

{% comment %} ── Network Health section ── {% endcomment %}
{% assign nh = site.data.network-health | default: nil %}
<div id="network-health-section" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.5rem; margin-top: 1rem;">
  <h2 style="font-size: 1.1rem; margin-bottom: 0.75rem;">🌐 Network Health</h2>
  <div id="network-health-table">
    {% if nh and nh.services.size > 0 %}
    <table class="services-table" style="width: 100%;">
      <thead><tr><th>Service</th><th>Latency</th><th>Status</th><th>Loss</th><th>Trend</th></tr></thead>
      <tbody>
      {% for svc in nh.services %}
      {% assign svc_status_badge = "badge-ok" %}
      {% if svc.status == "degraded" %}{% assign svc_status_badge = "badge-warn" %}{% endif %}
      {% if svc.status == "down" %}{% assign svc_status_badge = "badge-err" %}{% endif %}
      <tr>
        <td>{{ svc.name }}</td>
        <td>{{ svc.latency_ms }} ms</td>
        <td><span class="badge {{ svc_status_badge }}">{{ svc.status }}</span></td>
        <td>{{ svc.packet_loss }}%</td>
        <td>
          {% if svc.history.size > 1 %}
          <svg width="80" height="20" viewBox="0 0 {% if svc.history.size > 10 %}80{% else %}{{ svc.history.size | times: 8 }}{% endif %} 20" style="vertical-align: middle;">
            {% assign max_h = svc.history | max | default: 1 %}
            {% if max_h == 0 %}{% assign max_h = 1 %}{% endif %}
            {% assign points = "" %}
            {% for val in svc.history %}
              {% assign px = forloop.index0 | times: 8 %}
              {% assign py = 20 | minus: val | times: 18 | divided_by: max_h | round %}
              {% if py < 0 %}{% assign py = 0 %}{% endif %}
              {% if py > 18 %}{% assign py = 18 %}{% endif %}
              {% assign points = points | append: px | append: "," | append: py | append: " " %}
            {% endfor %}
            <polyline points="{{ points | strip }}" fill="none" stroke="var(--accent)" stroke-width="1.5"/>
          </svg>
          {% else %}
          <span style="color: var(--text-muted); font-size: 0.8rem;">&mdash;</span>
          {% endif %}
        </td>
      </tr>
      {% endfor %}
      </tbody>
    </table>
    <p style="color: var(--text-muted); font-size: 0.8rem; margin-top: 0.5rem;">
      {{ nh.services_ok }}/{{ nh.services_total }} reachable &middot; Last checked: {{ nh.last_checked | date: "%H:%M:%S UTC" }}
    </p>
    {% else %}
    <p style="color: var(--text-muted); font-size: 0.9rem;">No network health data available yet.</p>
    {% endif %}
  </div>
</div>

{% comment %} ── Top Processes section ── {% endcomment %}
{% assign procs = h.processes | default: nil %}
<div id="processes-section" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.5rem; margin-top: 1rem;">
  <h2 style="font-size: 1.1rem; margin-bottom: 0.75rem;">🔧 Top Processes</h2>
  <div id="processes-table">
    {% if procs and procs.by_cpu.size > 0 %}
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
      <div>
        <h3 style="font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--text-secondary);">Top 5 by CPU</h3>
        <table class="services-table" style="width: 100%;">
          <thead><tr><th>PID</th><th>Name</th><th>CPU%</th><th>MEM%</th><th>User</th></tr></thead>
          <tbody>
          {% for p in procs.by_cpu %}
          {% assign sev = p.severity | default: "ok" %}
          {% capture row_class %}{% if p.is_claw %}claw-row{% endif %}{% endcapture %}
          <tr class="{{ row_class }}">
            <td>{{ p.pid }}</td>
            <td>{% if p.is_claw %}🦜 {% endif %}{{ p.name }}</td>
            <td><span class="badge badge-{{ sev }}">{{ p.cpu_percent }}%</span></td>
            <td>{{ p.mem_percent }}%</td>
            <td>{{ p.user }}</td>
          </tr>
          {% endfor %}
          </tbody>
        </table>
      </div>
      <div>
        <h3 style="font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--text-secondary);">Top 5 by Memory</h3>
        <table class="services-table" style="width: 100%;">
          <thead><tr><th>PID</th><th>Name</th><th>CPU%</th><th>MEM%</th><th>User</th></tr></thead>
          <tbody>
          {% for p in procs.by_mem %}
          {% assign sev = p.severity | default: "ok" %}
          {% capture row_class %}{% if p.is_claw %}claw-row{% endif %}{% endcapture %}
          <tr class="{{ row_class }}">
            <td>{{ p.pid }}</td>
            <td>{% if p.is_claw %}🦜 {% endif %}{{ p.name }}</td>
            <td><span class="badge badge-{{ sev }}">{{ p.cpu_percent }}%</span></td>
            <td>{{ p.mem_percent }}%</td>
            <td>{{ p.user }}</td>
          </tr>
          {% endfor %}
          </tbody>
        </table>
      </div>
    </div>
    <p style="color: var(--text-muted); font-size: 0.8rem; margin-top: 0.5rem;">Total: {{ procs.total_processes }} processes</p>
    {% else %}
    <p style="color: var(--text-muted); font-size: 0.9rem;">No process data available yet.</p>
    {% endif %}
  </div>
</div>

<div style="margin-top: 1.5rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1rem 1.5rem;">
  <div class="stat-row" style="border: none;">
    <span class="stat-label">🕐 Uptime</span>
    <span class="stat-value" id="uptime-display">{{ up.display | default: "&mdash;" }}</span>
  </div>
  <div class="stat-row" style="border: none;">
    <span class="stat-label">📅 Last Updated</span>
    <span class="stat-value" id="health-updated">{{ site.data.site.update_timestamp | default: "&mdash;" }}</span>
  </div>
  <div class="stat-row" style="border: none;">
    <span class="stat-label">⏰ Cron Jobs</span>
    <span class="stat-value" id="health-cron-status">{{ cron_fail_msg }}</span>
  </div>
</div>

<script src="{{ '/assets/js/health.js' | relative_url }}"></script>
