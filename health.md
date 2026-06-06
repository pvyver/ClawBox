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

<div style="margin-top: 1.5rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1rem 1.5rem;">
  <div class="stat-row" style="border: none;">
    <span class="stat-label">🕐 Uptime</span>
    <span class="stat-value" id="uptime-display">{{ up.display | default: "&mdash;" }}</span>
  </div>
  <div class="stat-row" style="border: none;">
    <span class="stat-label">📅 Last Updated</span>
    <span class="stat-value" id="health-updated">{{ site.data.site.update_timestamp | default: "&mdash;" }}</span>
  </div>
</div>

<script src="{{ '/assets/js/health.js' | relative_url }}"></script>
