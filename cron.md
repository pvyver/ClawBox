---
layout: page
title: Cron Jobs
permalink: /cron/
---

<p class="section-intro">
  All scheduled jobs running on ClawBox. From token-watch monitoring to heartbeat maintenance
  &mdash; every cron job tracked and logged.
</p>

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
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>token-watch-check</td>
        <td>Every 30 min</td>
        <td>Gemma 4 (local)</td>
        <td><span class="badge badge-ok">Active</span></td>
        <td id="tw-last">—</td>
      </tr>
      <tr>
        <td>heartbeat</td>
        <td>~Every 30 min</td>
        <td>Gemma 4 (local)</td>
        <td><span class="badge badge-ok">Active</span></td>
        <td id="hb-last">—</td>
      </tr>
    </tbody>
  </table>
</div>

<p style="margin-top: 2rem; color: var(--text-muted); font-size: 0.85rem;">
  <em>Job registry auto-updates when ClawBox synchronizes cron state to the site.</em>
</p>
