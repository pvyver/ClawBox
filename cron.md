---
layout: page
title: Cron Jobs
permalink: /cron/
---

{% assign cj = site.data.cron-jobs %}
{% assign jobs = cj.jobs | default: site.empty %}
{% assign last_updated = site.data.site.update_timestamp | default: "&mdash;" %}

<p class="section-intro">
  All scheduled jobs running on ClawBox. From token-watch monitoring to heartbeat maintenance
  &mdash; every cron job tracked and logged.
</p>

{% if jobs.size == 0 %}

<div class="dashboard-grid">
  <div class="dashboard-card">
    <div class="card-icon">🔍</div>
    <h2 class="card-title">Token Watch</h2>
    <p class="card-desc">Monitors token usage every 30 minutes. Alerts at 70% and 90% of daily budget.</p>
    <div class="card-meta">
      <span>Interval: 30 min</span>
      <span class="badge badge-ok">Active</span>
    </div>
  </div>

  <div class="dashboard-card">
    <div class="card-icon">💓</div>
    <h2 class="card-title">Heartbeat</h2>
    <p class="card-desc">Periodic system pulse. Checks for alerts, weather, calendar, and memory maintenance.</p>
    <div class="card-meta">
      <span>Interval: Variable</span>
      <span class="badge badge-ok">Active</span>
    </div>
  </div>
</div>

{% else %}

<div class="dashboard-grid">
  {% for job in jobs | limit: 4 %}
  <div class="dashboard-card">
    <div class="card-icon">
      {% if job.name contains 'token' or job.name contains 'watch' %}🔍
      {% elsif job.name contains 'heart' or job.name contains 'beat' %}💓
      {% elsif job.name contains 'news' %}📰
      {% elsif job.name contains 'weather' or job.name contains 'wind' or job.name contains 'forecast' %}🌤️
      {% elsif job.name contains 'blog' or job.name contains 'digest' %}📝
      {% elsif job.name contains 'update' or job.name contains 'data' %}📡
      {% elsif job.name contains 'summary' %}📋
      {% else %}⏰{% endif %}
    </div>
    <h2 class="card-title">{{ job.name }}</h2>
    <p class="card-desc">{{ job.description | truncate: 120 }}</p>
    <div class="card-meta">
      <span>{{ job.schedule }}</span>
      <span class="badge {{ job.badge | default: 'badge-ok' }}">
        {% if job.status == 'ok' %}Active{% elsif job.status == 'error' %}Error{% else %}{{ job.status | capitalize }}{% endif %}
      </span>
    </div>
  </div>
  {% endfor %}
</div>

{% endif %}

<h2 style="font-size: 1.2rem; margin: 2rem 0 1rem;">Job Registry</h2>

<div class="data-table-wrap">
  <table class="data-table">
    <thead>
      <tr>
        <th>Job</th>
        <th>Schedule</th>
        <th>Model</th>
        <th>Status</th>
        <th>Last Run</th>
        <th>Duration</th>
      </tr>
    </thead>
    <tbody id="cron-tbody">
      {% if jobs.size == 0 %}
      <tr>
        <td>token-watch-check</td>
        <td>Every 30 min</td>
        <td>Llama 3.2 (local)</td>
        <td><span class="badge badge-ok">Active</span></td>
        <td id="tw-last">&mdash;</td>
        <td>&mdash;</td>
      </tr>
      <tr>
        <td>heartbeat</td>
        <td>~Every 30 min</td>
        <td>Llama 3.2 (local)</td>
        <td><span class="badge badge-ok">Active</span></td>
        <td id="hb-last">&mdash;</td>
        <td>&mdash;</td>
      </tr>
      {% else %}
      {% for job in jobs %}
      {% assign last_run_ms = job.last_run | default: 0 %}
      {% assign last_run_str = "" %}
      {% if last_run_ms > 0 %}
        {% assign last_run_ts = last_run_ms | divided_by: 1000 | date: "%b %d %H:%M" %}
        {% capture last_run_str %}{{ last_run_ts }} UTC{% endcapture %}
      {% else %}
        {% assign last_run_str = "&mdash;" %}
      {% endif %}

      {% assign dur = job.last_duration_ms | default: 0 %}
      {% if dur > 0 and dur < 60000 %}
        {% assign dur_secs = dur | divided_by: 1000.0 | round: 1 %}
        {% capture dur_str %}{{ dur_secs }}s{% endcapture %}
      {% elsif dur >= 60000 %}
        {% assign dur_mins = dur | divided_by: 60000.0 | round: 1 %}
        {% capture dur_str %}{{ dur_mins }}m{% endcapture %}
      {% else %}
        {% assign dur_str = "&mdash;" %}
      {% endif %}

      <tr{% if job.consecutive_errors > 0 %} class="cron-row-error" id="cron-error-{{ job.name | slugify }}"{% endif %}>
        <td>{{ job.name }}</td>
        <td>{{ job.schedule }}</td>
        <td>{% if job.model contains 'llama' %}Llama 3.2 (local){% elsif job.model contains 'deepseek' %}DeepSeek Flash{% else %}{{ job.model }}{% endif %}</td>
        <td><span class="badge {{ job.badge | default: 'badge-ok' }}">
          {% if job.status == 'ok' %}Active{% elsif job.status == 'error' %}Error{% else %}{{ job.status | capitalize }}{% endif %}
        {% if job.consecutive_errors > 0 %} ({{ job.consecutive_errors }}x){% endif %}
        </span></td>
        <td>{{ last_run_str }}</td>
        <td>{{ dur_str }}</td>
      </tr>
      {% endfor %}
      {% endif %}
    </tbody>
  </table>
</div>

<script src="{{ '/assets/js/cron.js' | relative_url }}"></script>
