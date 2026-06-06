---
layout: page
title: Token Usage
permalink: /token-usage/
---

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
      <span class="stat-value" id="ds-today">—</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Daily Cap</span>
      <span class="stat-value">250M tokens</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill ok" id="ds-bar" style="width: 0%"></div>
    </div>
    <div class="card-meta" style="margin-top: 0.75rem;">
      <span>Usage: <span id="ds-pct">0%</span></span>
      <span class="badge badge-ok" id="ds-badge">Under limit</span>
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
      <span class="stat-label">Usage</span>
      <span class="stat-value">Unlimited (local GPU)</span>
    </div>
    <div class="card-meta" style="margin-top: 0.75rem;">
      <span>Use for: background/cron/memory tasks</span>
      <span class="badge badge-ok">Available</span>
    </div>
  </div>
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
        <th>Alert?</th>
      </tr>
    </thead>
    <tbody id="history-body">
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted);">
          No data yet &mdash; history will appear as token-watch runs.
        </td>
      </tr>
    </tbody>
  </table>
</div>

<p style="margin-top: 2rem; color: var(--text-muted); font-size: 0.85rem;">
  <em>Data sourced from <code>data/token-watch/</code>. Updated every 30 minutes by the token-watch cron job.</em>
</p>
