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

  // ── Init ─────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchHealth);
  } else {
    fetchHealth();
  }
})();
