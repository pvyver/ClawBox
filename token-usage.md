---
layout: page
title: Token Usage
permalink: /token-usage/
---

{% assign tu = site.data.token-usage %}
{% assign today = tu.today %}
{% assign ds_tokens = today.deepseek_tokens | default: 0 %}
{% assign gm_tokens = today.gemma4_tokens | default: 0 %}
{% assign total_tokens = today.total_tokens | default: 0 %}
{% assign used_pct = today.used_percent | default: 0 %}
{% assign cap = tu.daily_cap | default: 250000000 %}

{% if used_pct > 90 %}
  {% assign budget_badge = "badge-err" %}
  {% assign budget_text = "Critical" %}
  {% assign bar_class = "err" %}
{% elsif used_pct > 70 %}
  {% assign budget_badge = "badge-warn" %}
  {% assign budget_text = "Warning" %}
  {% assign bar_class = "warn" %}
{% else %}
  {% assign budget_badge = "badge-ok" %}
  {% assign budget_text = "Under limit" %}
  {% assign bar_class = "ok" %}
{% endif %}

<p class="section-intro">
  Token consumption tracking across all models. ClawBox monitors usage to stay within
  budget &mdash; local Gemma 4 is free, DeepSeek Flash usage is capped.
</p>

<div class="dashboard-grid">
  <div class="dashboard-card">
    <div class="card-icon">☁️</div>
    <h2 class="card-title">DeepSeek Flash</h2>
    <p class="card-desc">Cloud-routed model with usage cap. Reserved for real-time conversations.</p>
    <div class="stat-row">
      <span class="stat-label">Today</span>
      <span class="stat-value" id="ds-today">{{ today.deepseek_human | default: "&mdash;" }}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Daily Cap</span>
      <span class="stat-value">{{ tu.daily_cap_human | default: "250M" }} tokens</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill {{ bar_class }}" id="ds-bar" style="width: {{ used_pct | round: 0 }}%"></div>
    </div>
    <div class="card-meta" style="margin-top: 0.75rem;">
      <span>Usage: <span id="ds-pct">{{ used_pct }}%</span></span>
      <span class="badge {{ budget_badge }}" id="ds-badge">{{ budget_text }}</span>
    </div>
  </div>

  <div class="dashboard-card">
    <div class="card-icon">🏠</div>
    <h2 class="card-title">Gemma 4 (Local)</h2>
    <p class="card-desc">Local model on Jetson GPU. Free to use &mdash; no budget tracking needed.</p>
    <div class="stat-row">
      <span class="stat-label">Cost</span>
      <span class="stat-value" style="color: var(--success);">Free</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Usage Today</span>
      <span class="stat-value" id="gm-today">{{ today.gemma4_human | default: "&mdash;" }}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Total Calls</span>
      <span class="stat-value" id="total-calls">{{ today.calls | default: "&mdash;" }}</span>
    </div>
    <div class="card-meta" style="margin-top: 0.75rem;">
      <span>Use for: background/cron/memory tasks</span>
      <span class="badge badge-ok">Available</span>
    </div>
  </div>
</div>

<h2 style="font-size: 1.2rem; margin: 2rem 0 1rem;">Daily Trend</h2>

<div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.5rem; margin-bottom: 2rem;">
  <canvas id="usage-chart" width="800" height="320"
    style="display: block; width: 100%; height: auto; aspect-ratio: 800/320;"
    data-cap="{{ cap }}"
    data-history='{{ tu.daily_history | jsonify | escape }}'>
  </canvas>
  <p style="margin-top: 1rem; font-size: 0.8rem; color: var(--text-muted); text-align: center;">
    <span style="display: inline-block; width: 12px; height: 12px; background: #f97316; border-radius: 2px; vertical-align: middle; margin: 0 4px;"></span> DeepSeek Flash
    <span style="display: inline-block; width: 12px; height: 12px; background: #22c55e; border-radius: 2px; vertical-align: middle; margin: 0 4px 0 16px;"></span> Gemma 4 (Local)
    <span style="display: inline-block; width: 12px; height: 12px; background: #ef4444; border-radius: 2px; vertical-align: middle; margin: 0 4px 0 16px;"></span> Daily Cap
  </p>
</div>

<h2 style="font-size: 1.2rem; margin: 2rem 0 1rem;">Daily History</h2>

<div class="data-table-wrap">
  <table class="data-table">
    <thead>
      <tr>
        <th>Date</th>
        <th>DeepSeek Flash</th>
        <th>Gemma 4</th>
        <th>Total</th>
        <th>% of Cap</th>
        <th>Calls</th>
        <th>Alert?</th>
      </tr>
    </thead>
    <tbody id="history-body">
      {% assign history = tu.daily_history | default: site.empty %}
      {% if history.size == 0 %}
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted);">
          No data yet &mdash; history will appear as token-watch runs.
        </td>
      </tr>
      {% else %}
        {% for day in history reversed %}
        {% assign day_pct = day.total_tokens | times: 100.0 | divided_by: cap %}
        {% if day_pct > 90 %}
          {% assign alert_badge = "badge-err" %}
          {% assign alert_text = "Critical" %}
        {% elsif day_pct > 70 %}
          {% assign alert_badge = "badge-warn" %}
          {% assign alert_text = "Warning" %}
        {% else %}
          {% assign alert_badge = "badge-ok" %}
          {% assign alert_text = "OK" %}
        {% endif %}
        <tr>
          <td>{{ day.date }}</td>
          <td>{{ day.deepseek_tokens | default: 0 }}</td>
          <td>{{ day.gemma4_tokens | default: 0 }}</td>
          <td>{{ day.total_tokens | default: 0 }}</td>
          <td>{{ day_pct | round: 1 }}%</td>
          <td>{{ day.calls | default: 0 }}</td>
          <td><span class="badge {{ alert_badge }}">{{ alert_text }}</span></td>
        </tr>
        {% endfor %}
      {% endif %}
    </tbody>
  </table>
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
<script src="{{ '/assets/js/token-chart.js' | relative_url }}"></script>
