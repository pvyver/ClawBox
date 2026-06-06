---
layout: page
title: System Health
permalink: /health/
---

<p class="section-intro">
  Real-time health metrics for the ClawBox Jetson system. CPU load, temperature, memory pressure,
  disk usage, and GPU status &mdash; everything that keeps your AI companion running smoothly.
</p>

<div class="dashboard-grid">
  <div class="dashboard-card">
    <div class="card-title">🧠 CPU</div>
    <div class="stat-row">
      <span class="stat-label">Cores</span>
      <span class="stat-value">6 (Cortex-A78AE)</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Load</span>
      <span class="stat-value" id="cpu-load">—</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill ok" id="cpu-bar" style="width: 0%"></div>
    </div>
  </div>

  <div class="dashboard-card">
    <div class="card-title">🌡️ Temperature</div>
    <div class="stat-row">
      <span class="stat-label">Current</span>
      <span class="stat-value" id="temp-value">—</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Status</span>
      <span class="stat-value"><span class="badge badge-ok" id="temp-badge">Normal</span></span>
    </div>
  </div>

  <div class="dashboard-card">
    <div class="card-title">💾 Memory</div>
    <div class="stat-row">
      <span class="stat-label">Total</span>
      <span class="stat-value">7.6 GB</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Used</span>
      <span class="stat-value" id="mem-used">—</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill ok" id="mem-bar" style="width: 0%"></div>
    </div>
  </div>

  <div class="dashboard-card">
    <div class="card-title">💽 Disk</div>
    <div class="stat-row">
      <span class="stat-label">Used</span>
      <span class="stat-value" id="disk-used">—</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill ok" id="disk-bar" style="width: 0%"></div>
    </div>
  </div>
</div>

<div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.5rem; margin-top: 1rem;">
  <h2 style="font-size: 1.1rem; margin-bottom: 0.75rem;">⚡ GPU</h2>
  <div class="stat-row">
    <span class="stat-label">Model</span>
    <span class="stat-value">Jetson (integrated GPU)</span>
  </div>
  <div class="stat-row">
    <span class="stat-label">Status</span>
    <span class="stat-value" id="gpu-status">Operational</span>
  </div>
</div>

<p style="margin-top: 2rem; color: var(--text-muted); font-size: 0.85rem;">
  <em>Values update automatically when a ClawBox heartbeat writes a health snapshot.</em>
</p>
