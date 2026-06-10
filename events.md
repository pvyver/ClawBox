---
layout: page
title: System Event Log
permalink: /events/
---

{% assign ev = site.data.events %}
{% assign all_events = ev.events | default: site.empty %}
{% assign total_events = all_events | size %}

{% assign critical_count = all_events | where_exp: "e", "e.type == 'critical'" | size %}
{% assign error_count = all_events | where_exp: "e", "e.type == 'error'" | size %}
{% assign warning_count = all_events | where_exp: "e", "e.type == 'warning'" | size %}
{% assign info_count = all_events | where_exp: "e", "e.type == 'info'" | size %}

{% assign health_count = all_events | where_exp: "e", "e.source == 'health'" | size %}
{% assign cron_count = all_events | where_exp: "e", "e.source == 'cron'" | size %}
{% assign latency_count = all_events | where_exp: "e", "e.source == 'latency'" | size %}
{% assign system_count = all_events | where_exp: "e", "e.source == 'system'" | size %}

<p class="section-intro">
  Browseable feed of all system events — alerts, failures, and system activity.
  Filter by severity, source, or search for specific messages.
</p>

<!-- Summary pills -->
<div class="dashboard-grid" style="grid-template-columns: repeat(4, 1fr);">
  <div class="dashboard-card" style="padding: 0.75rem; text-align: center;">
    <div class="card-title" style="font-size: 0.9rem;">Total Events</div>
    <div class="stat-value" style="font-size: 1.3rem;" id="ev-total">{{ total_events }}</div>
  </div>
  <div class="dashboard-card" style="padding: 0.75rem; text-align: center;">
    <div class="card-title" style="font-size: 0.9rem;">Filtered</div>
    <div class="stat-value" style="font-size: 1.3rem;" id="ev-filtered">{{ total_events }}</div>
  </div>
  <div class="dashboard-card" style="padding: 0.75rem; text-align: center;">
    <div class="card-title" style="font-size: 0.9rem;">Sources</div>
    <div class="stat-value" style="font-size: 0.85rem; color: var(--text-secondary);">
      Health {{ health_count }} · Cron {{ cron_count }} · Latency {{ latency_count }} · System {{ system_count }}
    </div>
  </div>
  <div class="dashboard-card" style="padding: 0.75rem; text-align: center;">
    <div class="card-title" style="font-size: 0.9rem;">Last Updated</div>
    <div class="stat-value" style="font-size: 0.8rem; color: var(--text-muted);">{{ ev.last_updated | date: "%Y-%m-%d %H:%M:%S" | default: "&mdash;" }}</div>
  </div>
</div>

<!-- Filter bar -->
<div class="event-filter-bar" style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; margin-bottom: 1rem;">
  <span class="event-filter-label" style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Severity:</span>
  <button class="time-range-pill active" data-filter-type="all" data-group="type">All</button>
  <button class="time-range-pill" data-filter-type="critical" data-group="type">Critical</button>
  <button class="time-range-pill" data-filter-type="error" data-group="type">Error</button>
  <button class="time-range-pill" data-filter-type="warning" data-group="type">Warning</button>
  <button class="time-range-pill" data-filter-type="info" data-group="type">Info</button>

  <span style="width: 1px; height: 24px; background: var(--border); margin: 0 0.5rem;"></span>

  <span class="event-filter-label" style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Source:</span>
  <button class="time-range-pill" data-filter-source="all" data-group="source">All</button>
  <button class="time-range-pill" data-filter-source="health" data-group="source">Health</button>
  <button class="time-range-pill" data-filter-source="cron" data-group="source">Cron</button>
  <button class="time-range-pill" data-filter-source="latency" data-group="source">Latency</button>
  <button class="time-range-pill" data-filter-source="system" data-group="source">System</button>

  <span style="flex: 1;"></span>

  <input type="text" id="event-search" placeholder="🔍 Search messages..." style="background: var(--bg-card); border: 1px solid var(--border); color: var(--text-primary); padding: 0.35rem 0.75rem; border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 0.8rem; width: 200px; outline: none;" />
</div>

<!-- Events table -->
<div class="data-table-wrap">
  <table class="data-table events-table" id="events-table">
    <thead>
      <tr>
        <th>Timestamp</th>
        <th>Severity</th>
        <th>Source</th>
        <th>Message</th>
        <th>Value</th>
      </tr>
    </thead>
    <tbody>
      {% for e in all_events %}
      <tr class="event-row event-{{ e.type }}" data-type="{{ e.type }}" data-source="{{ e.source }}" data-message="{{ e.message | escape }}">
        <td class="event-time">{{ e.timestamp | date: "%Y-%m-%d %H:%M:%S" }}</td>
        <td><span class="badge badge-{% if e.type == 'critical' %}err{% elsif e.type == 'error' %}err{% elsif e.type == 'warning' %}warn{% else %}ok{% endif %}" style="text-transform: capitalize;">{{ e.type }}</span></td>
        <td><span class="event-source">{{ e.source }}</span></td>
        <td class="event-message">{{ e.message }}</td>
        <td class="event-value">{% if e.value != null %}{{ e.value }}{% else %}&mdash;{% endif %}</td>
      </tr>
      {% endfor %}
    </tbody>
  </table>
</div>

{% if all_events.size == 0 %}
<div style="text-align: center; padding: 3rem; color: var(--text-muted);">
  <p style="font-size: 2rem; margin-bottom: 0.5rem;">📋</p>
  <p>No events recorded yet. Events will appear as the system runs.</p>
</div>
{% endif %}

<script src="{{ '/assets/js/events.js' | relative_url }}"></script>
