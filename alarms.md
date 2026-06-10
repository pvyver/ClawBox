---
layout: page
title: Alarms & Notifications
permalink: /alarms/
---

{% assign ev = site.data.events %}
{% assign all_events = ev.events | default: site.empty %}
{% assign total_alerts = all_events | size %}

{% assign critical_count = all_events | where_exp: "e", "e.type == 'critical'" | size %}
{% assign error_count = all_events | where_exp: "e", "e.type == 'error'" | size %}
{% assign warning_count = all_events | where_exp: "e", "e.type == 'warning'" | size %}
{% assign info_count = all_events | where_exp: "e", "e.type == 'info'" | size %}

{% comment %} Active = critical + error in last 24h {% endcomment %}
{% assign now_s = site.time | date: "%s" | minus: 0 %}
{% assign day_secs = 86400 %}
{% assign active_alerts = all_events | where_exp: "e", "e.type == 'critical' or e.type == 'error'" %}
{% assign recent_active = 0 %}
{% for e in active_alerts %}
  {% assign ts = e.timestamp | date: "%s" | minus: 0 %}
  {% assign diff = now_s | minus: ts %}
  {% if diff < day_secs %}
    {% assign recent_active = recent_active | plus: 1 %}
  {% endif %}
{% endfor %}

<p class="section-intro">
  All triggered alerts and alarm notifications from ClawBox monitoring. Critical, error, and
  warning-level events are tracked with timestamps, severity badges, and source attribution.
</p>

<!-- Summary stats -->
<div class="dashboard-grid" style="grid-template-columns: repeat(4, 1fr);">
  <div class="dashboard-card" style="padding: 1rem; text-align: center;">
    <div class="card-icon" style="font-size: 1.5rem;">🔔</div>
    <div class="card-title" style="font-size: 1rem;">Total Events</div>
    <div class="stat-value" style="font-size: 1.5rem;" id="alarm-total">{{ total_alerts }}</div>
  </div>
  <div class="dashboard-card" style="padding: 1rem; text-align: center;">
    <div class="card-icon" style="font-size: 1.5rem;">🔴</div>
    <div class="card-title" style="font-size: 1rem;">Active Alerts</div>
    <div class="stat-value" style="font-size: 1.5rem; color: var(--danger);" id="alarm-active">{{ recent_active }}</div>
  </div>
  <div class="dashboard-card" style="padding: 1rem; text-align: center;">
    <div class="card-icon" style="font-size: 1.5rem;">⚠️</div>
    <div class="card-title" style="font-size: 1rem;">Warnings</div>
    <div class="stat-value" style="font-size: 1.5rem; color: var(--warning);">{{ warning_count }}</div>
  </div>
  <div class="dashboard-card" style="padding: 1rem; text-align: center;">
    <div class="card-icon" style="font-size: 1.5rem;">ℹ️</div>
    <div class="card-title" style="font-size: 1rem;">Info</div>
    <div class="stat-value" style="font-size: 1.5rem; color: var(--info);">{{ info_count }}</div>
  </div>
</div>

<!-- Filter pills -->
<div class="time-range-bar" id="alarm-filter-bar">
  <button class="time-range-pill active" data-filter="all">All</button>
  <button class="time-range-pill" data-filter="critical">Critical</button>
  <button class="time-range-pill" data-filter="error">Error</button>
  <button class="time-range-pill" data-filter="warning">Warning</button>
  <button class="time-range-pill" data-filter="info">Info</button>
  <span style="flex:1;"></span>
  <button class="time-range-pill" data-filter="active">Active (24h)</button>
</div>

<!-- Alarms table -->
<div class="data-table-wrap">
  <table class="data-table alarms-table" id="alarms-table">
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
      <tr class="alarm-row alarm-{{ e.type }}" data-type="{{ e.type }}" data-source="{{ e.source }}" data-timestamp="{{ e.timestamp }}">
        <td class="alarm-time">{{ e.timestamp | date: "%Y-%m-%d %H:%M:%S" }}</td>
        <td><span class="badge badge-{% if e.type == 'critical' %}err{% elsif e.type == 'error' %}err{% elsif e.type == 'warning' %}warn{% else %}ok{% endif %}" style="text-transform: capitalize;">{{ e.type }}</span></td>
        <td><span class="alarm-source">{{ e.source }}</span></td>
        <td class="alarm-message">{{ e.message }}</td>
        <td class="alarm-value">{% if e.value != null %}{{ e.value }}{% else %}&mdash;{% endif %}</td>
      </tr>
      {% endfor %}
    </tbody>
  </table>
</div>

{% if all_events.size == 0 %}
<div style="text-align: center; padding: 3rem; color: var(--text-muted);">
  <p style="font-size: 2rem; margin-bottom: 0.5rem;">🔕</p>
  <p>No events recorded yet. Alarms will appear as data accumulates.</p>
</div>
{% endif %}

<script src="{{ '/assets/js/alarms.js' | relative_url }}"></script>
