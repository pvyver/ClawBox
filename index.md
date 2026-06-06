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
{% assign cpu = h.cpu %}
{% assign gpu = h.gpu %}
{% assign up = h.uptime %}

{% assign health_time = s.update_timestamp | default: "pending..." %}
{% assign cron_count = cj.total | default: 0 %}
{% assign token_today = tu.today.total_human | default: "—" %}
{% assign token_pct = tu.today.used_percent | default: 0 %}
{% assign mem_pct = mem.used_percent | default: 0 %}
{% assign disk_pct = disk.used_percent | default: 0 %}
{% assign temp_val = temp.value_celsius | default: 0 %}
{% assign cpu_load = cpu.load_1m | default: 0 %}

{% capture mem_badge %}{% if mem_pct > 90 %}badge-err{% elsif mem_pct > 80 %}badge-warn{% else %}badge-ok{% endif %}{% endcapture %}
{% capture disk_badge %}{% if disk_pct > 95 %}badge-err{% elsif disk_pct > 80 %}badge-warn{% else %}badge-ok{% endif %}{% endcapture %}
{% capture temp_badge %}{% if temp_val > 80 %}badge-err{% elsif temp_val > 70 %}badge-warn{% else %}badge-ok{% endif %}{% endcapture %}
{% capture token_badge %}{% if token_pct > 90 %}badge-err{% elsif token_pct > 70 %}badge-warn{% else %}badge-ok{% endif %}{% endcapture %}
{% capture cpu_badge %}{% if cpu_load > 4 %}badge-err{% elsif cpu_load > 2.5 %}badge-warn{% else %}badge-ok{% endif %}{% endcapture %}

{% capture mem_text %}{% if mem_pct > 90 %}Critical{% elsif mem_pct > 80 %}Warning{% else %}OK{% endif %}{% endcapture %}
{% capture disk_text %}{% if disk_pct > 95 %}Critical{% elsif disk_pct > 80 %}Warning{% else %}OK{% endif %}{% endcapture %}
{% capture temp_text %}{% if temp_val > 80 %}Critical{% elsif temp_val > 70 %}Warning{% else %}OK{% endif %}{% endcapture %}
{% capture token_text %}{% if token_pct > 90 %}Critical{% elsif token_pct > 70 %}Warning{% else %}OK{% endif %}{% endcapture %}
{% capture cpu_text %}{% if cpu_load > 4 %}High{% elsif cpu_load > 2.5 %}Moderate{% else %}Normal{% endif %}{% endcapture %}

<p class="dash-tagline">🦞 ClawBox Dashboard &mdash; last updated <span id="live-updated">{{ s.update_timestamp | default: "—" }}</span></p>

<div class="data-table-wrap" style="padding: 0; overflow: hidden;">
<table class="data-table dash-table">
  <thead>
    <tr>
      <th style="width: 16%">Category</th>
      <th style="width: 18%">Metric</th>
      <th style="width: 28%">Value</th>
      <th style="width: 18%">Status</th>
      <th style="width: 20%">Detail</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="{{ '/health' | relative_url }}" class="dash-link">❤️ Health</a></td>
      <td>CPU</td>
      <td class="dash-val" id="dash-cpu">{{ cpu_load }}</td>
      <td><span class="badge {{ cpu_badge }}" id="dash-cpu-badge">{{ cpu_text }}</span></td>
      <td>{{ cpu.cores }} cores</td>
    </tr>
    <tr>
      <td><a href="{{ '/health' | relative_url }}" class="dash-link">❤️ Health</a></td>
      <td>Temperature</td>
      <td class="dash-val" id="dash-temp">{{ temp.display | default: "—" }}</td>
      <td><span class="badge {{ temp_badge }}" id="dash-temp-badge">{{ temp_text }}</span></td>
      <td id="dash-gpu-temp">GPU {{ gpu.temperature_celsius | default: "?" }}°</td>
    </tr>
    <tr>
      <td><a href="{{ '/health' | relative_url }}" class="dash-link">❤️ Health</a></td>
      <td>Memory</td>
      <td class="dash-val" id="dash-mem">{{ mem.used_human | default: "—" }} / {{ mem.total_human | default: "7.6 GB" }}</td>
      <td><span class="badge {{ mem_badge }}" id="dash-mem-badge">{{ mem_text }}</span></td>
      <td>{{ mem_pct | round: 0 }}% used</td>
    </tr>
    <tr>
      <td><a href="{{ '/health' | relative_url }}" class="dash-link">❤️ Health</a></td>
      <td>Disk</td>
      <td class="dash-val" id="dash-disk">{{ disk.used_human | default: "—" }} / {{ disk.total_human | default: "467 GB" }}</td>
      <td><span class="badge {{ disk_badge }}" id="dash-disk-badge">{{ disk_text }}</span></td>
      <td>{{ disk_pct | round: 0 }}% used</td>
    </tr>
    <tr>
      <td><a href="{{ '/token-usage' | relative_url }}" class="dash-link">📊 Tokens</a></td>
      <td>DeepSeek</td>
      <td class="dash-val" id="dash-ds">{{ tu.today.deepseek_human | default: "—" }}</td>
      <td><span class="badge {{ token_badge }}" id="dash-ds-badge">{{ token_text }}</span></td>
      <td>Cloud / capped</td>
    </tr>
    <tr>
      <td><a href="{{ '/token-usage' | relative_url }}" class="dash-link">📊 Tokens</a></td>
      <td>Gemma 4</td>
      <td class="dash-val" id="dash-gm">{{ tu.today.gemma4_human | default: "—" }}</td>
      <td><span class="badge badge-ok">Free</span></td>
      <td>Local GPU</td>
    </tr>
    <tr>
      <td><a href="{{ '/token-usage' | relative_url }}" class="dash-link">📊 Tokens</a></td>
      <td>Daily cap</td>
      <td class="dash-val" id="dash-total">{{ token_today }} / {{ tu.daily_cap_human | default: "250M" }}</td>
      <td><span class="badge {{ token_badge }}" id="dash-token-badge">{{ token_pct | round: 1 }}%</span></td>
      <td id="dash-calls">{{ tu.today.calls | default: 0 }} calls</td>
    </tr>
    <tr>
      <td><a href="{{ '/cron' | relative_url }}" class="dash-link">⏰ Cron</a></td>
      <td>Jobs</td>
      <td class="dash-val" id="dash-crons">{{ cron_count }} active</td>
      <td><span class="badge badge-ok">Running</span></td>
      <td id="dash-uptime">🕐 {{ up.display | default: "—" }}</td>
    </tr>
  </tbody>
</table>
</div>

<script src="{{ '/assets/js/dashboard.js' | relative_url }}"></script>
