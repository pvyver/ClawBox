/**
 * ClawBox Health Page — Client-side data refresh
 *
 * Fetches the latest health.json and updates all DOM elements
 * with dynamic badge coloring based on thresholds.
 */
(function () {
  'use strict';

  // ── Threshold configuration ──────────────────────────────────────────
  const THRESHOLDS = {
    temperature: { warn: 70, critical: 80 },
    memory: { warn: 80, critical: 90 },
    disk: { warn: 80, critical: 95 },
    cpu: { warn: 60, critical: 80 },
  };

  // ── Helpers ──────────────────────────────────────────────────────────

  function badgeClass(value, thresholds) {
    if (value >= thresholds.critical) return 'badge-err';
    if (value >= thresholds.warn) return 'badge-warn';
    return 'badge-ok';
  }

  function fillClass(value, thresholds) {
    if (value >= thresholds.critical) return 'err';
    if (value >= thresholds.warn) return 'warn';
    return 'ok';
  }

  function badgeText(value, thresholds) {
    if (value >= thresholds.critical) return 'Critical';
    if (value >= thresholds.warn) return 'Warning';
    return 'Normal';
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setBadge(id, text, cls) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = text;
      el.className = 'badge ' + cls;
    }
  }

  function setBar(id, pct, cls) {
    const el = document.getElementById(id);
    if (el) {
      el.style.width = Math.min(pct, 100) + '%';
      el.className = 'progress-fill ' + cls;
    }
  }

  function round1(v) {
    return Math.round(v * 10) / 10;
  }

  // ── Data fetch and render ────────────────────────────────────────────

  function applyHealthData(data) {
    if (!data) return;

    const cpu = data.cpu || {};
    const mem = data.memory || {};
    const disk = data.disk || {};
    const temp = data.temperature || {};
    const gpu = data.gpu || {};
    const up = data.uptime || {};

    // ── CPU ──
    const cpuLoad = cpu.load_1m || 0;
    const cpuPct = Math.min(cpuLoad * 16.67 * 100, 100);
    setText('cpu-load',
      (cpu.load_1m != null ? round1(cpu.load_1m) : '\u2014') + ' / ' +
      (cpu.load_5m != null ? round1(cpu.load_5m) : '\u2014') + ' / ' +
      (cpu.load_15m != null ? round1(cpu.load_15m) : '\u2014')
    );
    setBar('cpu-bar', cpuPct, fillClass(cpuPct, THRESHOLDS.cpu));

    // ── Temperature ──
    const tempVal = temp.value_celsius || 0;
    setText('temp-value', temp.display || '\u2014');
    setBadge('temp-badge', badgeText(tempVal, THRESHOLDS.temperature), badgeClass(tempVal, THRESHOLDS.temperature));
    setBar('temp-bar', tempVal * 1.25, fillClass(tempVal, THRESHOLDS.temperature));

    // ── Memory ──
    const memPct = mem.used_percent || 0;
    setText('mem-used', mem.used_human || '\u2014');
    setBar('mem-bar', memPct, fillClass(memPct, THRESHOLDS.memory));

    // ── Disk ──
    const diskPct = disk.used_percent || 0;
    setText('disk-used', disk.used_human || '\u2014');
    setBar('disk-bar', diskPct, fillClass(diskPct, THRESHOLDS.disk));

    // ── GPU ──
    if (gpu.temperature_celsius != null) setText('gpu-temp', gpu.temperature_celsius + '\u00B0C');
    if (gpu.usage_percent != null) setText('gpu-usage', gpu.usage_percent + '%');

    // ── Power & Thermal ──
    var pt = data.power_thermal || {};
    var pw = pt.power || {};
    var th = pt.thermal || {};

    var maxGauge = 15; // 15W maps to 100% gauge width
    function gaugeWidth(watts) {
      return Math.min(Math.round((watts / maxGauge) * 100), 100);
    }
    function gaugeCls(watts) {
      if (watts >= 12) return 'gauge-bar gauge-bar-critical';
      if (watts >= 8) return 'gauge-bar gauge-bar-warn';
      return 'gauge-bar';
    }

    // Power bars
    var vddInW = pw.vdd_in_watts || 0;
    var vddCpuW = pw.vdd_cpu_watts || 0;
    var vddGpuW = pw.vdd_gpu_watts || 0;
    var totalW = pw.total_watts || 0;

    var gIn = document.getElementById('gauge-vdd-in');
    if (gIn) { gIn.style.width = gaugeWidth(vddInW) + '%'; gIn.className = gaugeCls(vddInW); }
    setText('gauge-vdd-in-val', round1(vddInW) + ' W');

    var gCpu = document.getElementById('gauge-vdd-cpu');
    if (gCpu) { gCpu.style.width = gaugeWidth(vddCpuW) + '%'; gCpu.className = gaugeCls(vddCpuW); }
    setText('gauge-vdd-cpu-val', round1(vddCpuW) + ' W');

    var gGpu = document.getElementById('gauge-vdd-gpu');
    if (gGpu) { gGpu.style.width = gaugeWidth(vddGpuW) + '%'; gGpu.className = gaugeCls(vddGpuW); }
    setText('gauge-vdd-gpu-val', round1(vddGpuW) + ' W');

    var gTot = document.getElementById('gauge-total');
    if (gTot) { gTot.style.width = gaugeWidth(totalW) + '%'; }
    setText('gauge-total-val', round1(totalW) + ' W');

    // Thermal values
    if (th.junction_temp != null) setText('junct-temp', round1(th.junction_temp) + '\u00B0C');
    if (th.fan_speed_pct != null) setText('fan-speed', round0(th.fan_speed_pct) + '%');
    if (th.fan_rpm != null) setText('fan-rpm', th.fan_rpm);
    if (th.throttle_temp != null) setText('throttle-temp', round1(th.throttle_temp) + '\u00B0C');

    // Throttle warning
    var throttled = pw.throttled || false;
    var warnEl = document.getElementById('throttle-warning');
    var detailEl = document.getElementById('throttle-detail');
    var reasonEl = document.getElementById('throttle-reason');

    if (warnEl) {
      warnEl.style.display = throttled ? 'inline-block' : 'none';
    }
    if (detailEl) {
      detailEl.style.display = throttled ? 'block' : 'none';
    }
    if (reasonEl && pw.throttle_reason) {
      reasonEl.textContent = pw.throttle_reason;
    }

    // ── System Services ──
    var svc = data.services || {};
    var svcTable = document.getElementById('services-table');
    if (svcTable) {
      var keys = Object.keys(svc);
      if (keys.length > 0) {
        var html = '<table class="services-table"><thead><tr><th>Service</th><th>Status</th><th>Since</th></tr></thead><tbody>';
        for (var si = 0; si < keys.length; si++) {
          var name = keys[si];
          var s = svc[name];
          var statusCls = s.state === 'active' ? 'badge-ok' : (s.state === 'failed' ? 'badge-err' : 'badge-warn');
          html += '<tr><td>' + name + '</td><td><span class="badge ' + statusCls + '">' + (s.state || '?') + '</span></td><td>' + (s.since || '\u2014') + '</td></tr>';
        }
        html += '</tbody></table>';
        svcTable.innerHTML = html;
      }
    }

    // ── Uptime / timestamp ──
    if (up.display) setText('uptime-display', up.display);
    if (data.timestamp) {
      const ts = new Date(data.timestamp);
      setText('health-updated', ts.toISOString().replace('T', ' ').slice(0, 19) + ' UTC');
    }
  }

  function fetchHealth() {
    const src = document.currentScript
      ? document.currentScript.src.replace(/\/[^/]+$/, '/../data/health.json')
      : window.location.origin + '/ClawBox/assets/data/health.json';

    // Try relative path first
    const url = window.location.pathname.includes('/ClawBox/')
      ? '/ClawBox/assets/data/health.json'
      : '/assets/data/health.json';

    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(applyHealthData)
      .catch(function (err) {
        console.warn('Health data fetch failed:', err.message);
      });
  }

  // ── Cron status ──────────────────────────────────────────────────────

  function fetchCronStatus() {
    const url = window.location.pathname.includes('/ClawBox/')
      ? '/ClawBox/assets/data/cron-jobs.json'
      : '/assets/data/cron-jobs.json';

    fetch(url)
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (cj) {
        var jobs = cj.jobs || [];
        var failing = 0;
        for (var i = 0; i < jobs.length; i++) {
          if (jobs[i].consecutive_errors > 0) failing++;
        }
        var el = document.getElementById('cron-fail-status');
        if (el) {
          var p = el.parentNode;
          if (failing > 0) {
            el.textContent = failing + ' failing';
            el.className = 'badge badge-err';
            if (p && !p.querySelector('#cron-fail-names')) {
              var names = document.createElement('span');
              names.id = 'cron-fail-names';
              names.style.cssText = 'margin-left: 0.5rem; color: var(--danger); font-size: 0.8rem;';
              var ns = [];
              for (var j = 0; j < jobs.length; j++) {
                if (jobs[j].consecutive_errors > 0) ns.push(jobs[j].name);
              }
              names.textContent = '(' + ns.join(', ') + ')';
              p.appendChild(names);
            }
          } else {
            el.textContent = 'All OK';
            el.className = 'badge badge-ok';
            var namesEl = document.getElementById('cron-fail-names');
            if (namesEl) namesEl.parentNode.removeChild(namesEl);
          }
        }
      })
      .catch(function () {});
  }

  // ── Init ─────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      fetchHealth();
      fetchCronStatus();
    });
  } else {
    fetchHealth();
    fetchCronStatus();
  }
})();
