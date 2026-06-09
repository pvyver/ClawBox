---
layout: default
title: Dashboard
permalink: /
---

{% assign h = site.data.health %}
{% assign tu = site.data.token-usage %}
{% assign cj = site.data.cron-jobs %}
{% assign s = site.data.site %}
{% assign mem = h.memory %}
{% assign temp = h.temperature %}
{% assign disk = h.disk %}
{% assign gpu = h.gpu %}
{% assign up = h.uptime %}

{% assign health_time = s.update_timestamp | default: "pending..." %}
{% assign cron_count = cj.total | default: 0 %}
{% assign failing_jobs = cj.jobs | where_exp: "j", "j.consecutive_errors > 0" %}
{% assign failing_count = failing_jobs | size %}
{% assign failing_name = failing_jobs[0].name | default: "" %}
{% assign token_today = tu.today.total_human | default: "\u2014" %}
{% assign token_pct = tu.today.used_percent | default: 0 %}
{% assign mem_pct = mem.used_percent | default: 0 %}
{% assign disk_pct = disk.used_percent | default: 0 %}
{% assign temp_val = temp.value_celsius | default: 0 %}

{% capture mem_badge %}{% if mem_pct > 90 %}badge-err{% elsif mem_pct > 80 %}badge-warn{% else %}badge-ok{% endif %}{% endcapture %}
{% capture disk_badge %}{% if disk_pct > 95 %}badge-err{% elsif disk_pct > 80 %}badge-warn{% else %}badge-ok{% endif %}{% endcapture %}
{% capture temp_badge %}{% if temp_val > 80 %}badge-err{% elsif temp_val > 70 %}badge-warn{% else %}badge-ok{% endif %}{% endcapture %}
{% capture token_badge %}{% if token_pct > 90 %}badge-err{% elsif token_pct > 80 %}badge-warn{% else %}badge-ok{% endif %}{% endcapture %}

<!-- Tagline bar -->
<div class="tagline-bar">
  <span class="tagline-icon">🦞</span>
  <span>Your AI lobster companion's control center &mdash; real-time system overview.</span>
  <span class="tagline-time" id="live-updated">{{ s.update_timestamp | default: "" }}</span>
</div>

<!-- Compact live stats bar -->
<div class="stats-bar" id="stats-bar">
  <div class="stat-chip">
    <span class="chip-icon">🌡️</span>
    <span class="chip-label">Temp</span>
    <span class="chip-value" id="stat-temp">{{ temp.display | default: "\u2014" }}</span>
    <span class="chip-badge"><span class="badge {{ temp_badge }}" id="stat-temp-badge">{{ temp_val }}°</span></span>
  </div>
  <div class="stat-chip">
    <span class="chip-icon">💾</span>
    <span class="chip-label">RAM</span>
    <span class="chip-value" id="stat-ram">{{ mem.used_human | default: "\u2014" }}</span>
    <span class="chip-bar"><span class="mini-bar"><span class="mini-fill {{ mem_badge }}" id="stat-ram-bar" style="width: {{ mem_pct | round: 0 }}%"></span></span></span>
  </div>
  <div class="stat-chip">
    <span class="chip-icon">💽</span>
    <span class="chip-label">Disk</span>
    <span class="chip-value" id="stat-disk">{{ disk.used_human | default: "\u2014" }}</span>
    <span class="chip-bar"><span class="mini-bar"><span class="mini-fill {{ disk_badge }}" id="stat-disk-bar" style="width: {{ disk_pct | round: 0 }}%"></span></span></span>
  </div>
  <div class="stat-chip">
    <span class="chip-icon">📊</span>
    <span class="chip-label">Tokens</span>
    <span class="chip-value" id="stat-tokens">{{ token_today }}</span>
    <span class="chip-badge"><span class="badge {{ token_badge }}" id="stat-token-badge">{{ token_pct | round: 0 }}%</span></span>
  </div>
  <div class="stat-chip">
    <span class="chip-icon">⏰</span>
    <span class="chip-label">Crons</span>
    <span class="chip-value" id="stat-crons">{{ cron_count }}</span>
    <span class="chip-badge">active{% if failing_count > 0 %} <span class="badge badge-err" id="stat-cron-fail">{{ failing_count }} failing</span>{% endif %}</span>
  </div>
  <div class="stat-chip">
    <span class="chip-icon">🕐</span>
    <span class="chip-label">Uptime</span>
    <span class="chip-value" id="stat-uptime">{{ up.display | default: "\u2014" }}</span>
    <span class="chip-badge">online</span>
  </div>
</div>

<!-- Compact dashboard cards -->
<div class="compact-grid">
  <a href="{{ '/health' | relative_url }}" class="compact-card">
    <div class="compact-card-header">
      <span class="compact-card-icon">❤️</span>
      <span class="compact-card-title">System Health</span>
    </div>
    <div class="compact-card-stats">
      <span><span class="cs-label">CPU</span> <span id="cc-cpu" class="cs-value">{% if h.cpu.load_1m %}{{ h.cpu.load_1m }}{% else %}\u2014{% endif %}</span></span>
      <span><span class="cs-label">Temp</span> <span id="cc-temp" class="cs-value">{{ temp.display | default: "\u2014" }}</span></span>
      <span><span class="cs-label">Mem</span> <span id="cc-mem" class="cs-value">{{ mem.used_human | default: "\u2014" }}</span></span>
    </div>
  </a>

  <a href="{{ '/cron' | relative_url }}" class="compact-card{% if failing_count > 0 %} card-warn{% endif %}" id="cron-card">
    <div class="compact-card-header">
      <span class="compact-card-icon">⏰</span>
      <span class="compact-card-title">Cron Jobs</span>
      {% if failing_count > 0 %}<span class="badge badge-err" id="cc-cron-fail">{{ failing_count }}</span>{% endif %}
    </div>
    <div class="compact-card-stats">
      <span><span class="cs-label">Active</span> <span id="cc-active" class="cs-value">{{ cron_count }}</span></span>
      <span><span class="cs-label">Failing</span> <span id="cc-failing" class="cs-value">{{ failing_count }}</span></span>
      <span><span class="cs-label">Last</span> <span id="cc-last" class="cs-value">{{ health_time | default: "\u2014" }}</span></span>
    </div>
  </a>

  <a href="{{ '/token-usage' | relative_url }}" class="compact-card">
    <div class="compact-card-header">
      <span class="compact-card-icon">📊</span>
      <span class="compact-card-title">Token Usage</span>
    </div>
    <div class="compact-card-stats">
      <span><span class="cs-label">Today</span> <span id="cc-tokens" class="cs-value">{{ token_today }}</span></span>
      <span><span class="cs-label">Cap</span> <span id="cc-cap" class="cs-value">{{ tu.daily_cap_human | default: "250M" }}</span></span>
      <span><span class="cs-label">Used</span> <span id="cc-pct" class="cs-value {{ token_badge }}">{{ token_pct | round: 1 }}%</span></span>
    </div>
  </a>

  {% comment %} ── Network Traffic card ── {% endcomment %}
  {% assign nt = h.network | default: nil %}
  {% assign nt_in = nt.total_in_human | default: "\u2014" %}
  {% assign nt_out = nt.total_out_human | default: "\u2014" %}
  {% assign nt_conns = nt.active_connections | default: "\u2014" %}
  <a href="{{ '/health' | relative_url }}" class="compact-card" id="net-traffic-card">
    <div class="compact-card-header">
      <span class="compact-card-icon">📶</span>
      <span class="compact-card-title">Network Traffic</span>
    </div>
    <div class="compact-card-stats">
      <span><span class="cs-label">RX In</span> <span id="cc-nt-in" class="cs-value">{{ nt_in }}</span></span>
      <span><span class="cs-label">TX Out</span> <span id="cc-nt-out" class="cs-value">{{ nt_out }}</span></span>
      <span><span class="cs-label">Conns</span> <span id="cc-nt-conns" class="cs-value">{{ nt_conns }}</span></span>
    </div>
  </a>

  {% comment %} ── Network Health card ── {% endcomment %}
  {% assign nh = site.data.network-health | default: nil %}
  {% assign nh_ok = nh.services_ok | default: 0 %}
  {% assign nh_total = nh.services_total | default: 0 %}
  {% assign nh_label = "Not checked" %}
  {% if nh_total > 0 %}
    {% if nh_ok == nh_total %}
      {% assign nh_label = "All OK" %}
    {% elsif nh_ok > 0 %}
      {% assign nh_label = nh_ok | append: "/" | append: nh_total %}
    {% else %}
      {% assign nh_label = "Unreachable" %}
    {% endif %}
  {% endif %}
  {% assign nh_badge = "badge-ok" %}
  {% if nh_ok == 0 and nh_total > 0 %}{% assign nh_badge = "badge-err" %}{% endif %}
  {% if nh_ok > 0 and nh_ok < nh_total %}{% assign nh_badge = "badge-warn" %}{% endif %}
  <a href="{{ '/health' | relative_url }}" class="compact-card" id="network-card">
    <div class="compact-card-header">
      <span class="compact-card-icon">🌐</span>
      <span class="compact-card-title">Network Health</span>
    </div>
    <div class="compact-card-stats">
      <span><span class="cs-label">Status</span> <span id="cc-nh-status" class="cs-value"><span class="badge {{ nh_badge }}">{{ nh_label }}</span></span></span>
      <span><span class="cs-label">Loss</span> <span id="cc-nh-loss" class="cs-value">&mdash;</span></span>
      <span><span class="cs-label">Latency</span> <span id="cc-nh-latency" class="cs-value">&mdash;</span></span>
    </div>
  </a>

  {% comment %} ── Processes card ── {% endcomment %}
  {% assign procs = h.processes | default: nil %}
  {% assign top_cpu_name = "—" %}
  {% assign top_cpu_pct = "" %}
  {% assign top_mem_name = "—" %}
  {% assign top_mem_pct = "" %}
  {% if procs.by_cpu.size > 0 %}{% assign p = procs.by_cpu[0] %}{% assign top_cpu_name = p.name %}{% assign top_cpu_pct = p.cpu_percent %}{% endif %}
  {% if procs.by_mem.size > 0 %}{% assign p = procs.by_mem[0] %}{% assign top_mem_name = p.name %}{% assign top_mem_pct = p.mem_percent %}{% endif %}
  {% assign proc_count = procs.total_processes | default: 0 %}
  <a href="{{ '/health' | relative_url }}" class="compact-card">
    <div class="compact-card-header">
      <span class="compact-card-icon">🔧</span>
      <span class="compact-card-title">Top Processes</span>
    </div>
    <div class="compact-card-stats">
      <span><span class="cs-label">Top CPU</span> <span id="cc-top-cpu" class="cs-value">{{ top_cpu_name }} {{ top_cpu_pct }}%</span></span>
      <span><span class="cs-label">Top MEM</span> <span id="cc-top-mem" class="cs-value">{{ top_mem_name }} {{ top_mem_pct }}%</span></span>
      <span><span class="cs-label">Processes</span> <span id="cc-proc-count" class="cs-value">{{ proc_count }}</span></span>
    </div>
  </a>
</div>

<script src="{{ '/assets/js/dashboard.js' | relative_url }}"></script>
