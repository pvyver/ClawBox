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

{% assign health_time = s.update_timestamp | default: "pending..." %}
{% assign cron_count = cj.total | default: 0 %}
{% assign token_today = tu.today.total_human | default: "\u2014" %}
{% assign token_pct = tu.today.used_percent | default: 0 %}

<section class="hero">
  <div class="hero-icon">🦞</div>
  <h1><span>ClawBox</span> Dashboard</h1>
  <p>Your AI lobster companion's control center. Health, schedules, and token usage at a glance.</p>
</section>

<div class="dashboard-grid">
  <a href="{{ '/health' | relative_url }}" class="dashboard-card">
    <div class="card-icon">❤️</div>
    <h2 class="card-title">System Health</h2>
    <p class="card-desc">CPU, memory, disk, temperature &mdash; everything your Jetson needs to stay sharp.</p>
    <div class="card-meta">
      <span>Last check: <span id="health-time">{{ health_time }}</span></span>
      <span class="badge badge-ok">Online</span>
    </div>
  </a>

  <a href="{{ '/cron' | relative_url }}" class="dashboard-card">
    <div class="card-icon">⏰</div>
    <h2 class="card-title">Cron Jobs</h2>
    <p class="card-desc">Scheduled tasks, recurring jobs, and background maintenance routines.</p>
    <div class="card-meta">
      <span>Active jobs: <span id="cron-count">{{ cron_count }}</span></span>
      <span class="badge badge-ok">Monitoring</span>
    </div>
  </a>

  <a href="{{ '/token-usage' | relative_url }}" class="dashboard-card">
    <div class="card-icon">📊</div>
    <h2 class="card-title">Token Usage</h2>
    <p class="card-desc">Consumption per model, daily budgets, and cost tracking across cloud and local.</p>
    <div class="card-meta">
      <span>Today: <span id="token-today">{{ token_today }}</span></span>
      <span class="badge {% if token_pct > 90 %}badge-err{% elsif token_pct > 70 %}badge-warn{% else %}badge-ok{% endif %}">
        {% if token_pct > 90 %}Critical{% elsif token_pct > 70 %}Warning{% else %}Tracking{% endif %}
      </span>
    </div>
  </a>
</div>

<section>
  <h2 style="margin-bottom: 1rem; font-size: 1.3rem;">Live Snapshot</h2>
  <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.5rem;">
    <p style="color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 1rem;">
      System data is updated automatically by ClawBox background jobs. These values represent the most recent snapshot.
    </p>
    <div class="stat-row">
      <span class="stat-label">🧠 Model</span>
      <span class="stat-value">DeepSeek Flash / Gemma 4</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">🌡️ Jetson Temp</span>
      <span class="stat-value" id="live-temp">{{ temp.display | default: "~58°C" }}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">💾 RAM</span>
      <span class="stat-value" id="live-ram">{{ mem.used_human | default: "7.6 GB" }}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">💽 Disk</span>
      <span class="stat-value" id="live-disk">{{ disk.used_human | default: "11% used" }}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">📅 Last Updated</span>
      <span class="stat-value" id="live-updated">{{ s.update_timestamp | default: "—" }}</span>
    </div>
  </div>
</section>

<script src="{{ '/assets/js/dashboard.js' | relative_url }}"></script>
