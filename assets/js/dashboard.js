/**
 * ClawBox Dashboard — Client-side data refresh
 *
 * Fetches latest data JSON and updates the dashboard overview table.
 */
(function () {
  'use strict';

  var basePath = window.location.pathname.includes('/ClawBox/')
    ? '/ClawBox/assets/data/'
    : '/assets/data/';

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text || '\u2014';
  }

  function round1(v) { return Math.round(v * 10) / 10; }

  function badgeClass(pct, warn, crit) {
    return pct > crit ? 'badge-err' : pct > warn ? 'badge-warn' : 'badge-ok';
  }
  function badgeText(pct, warn, crit) {
    return pct > crit ? 'Critical' : pct > warn ? 'Warning' : 'OK';
  }
  function cpuBadge(load) {
    return load > 4 ? 'badge-err' : load > 2.5 ? 'badge-warn' : 'badge-ok';
  }
  function cpuText(load) {
    return load > 4 ? 'High' : load > 2.5 ? 'Moderate' : 'Normal';
  }

  function setBadge(id, text, cls) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = text;
      el.className = 'badge ' + cls;
    }
  }

  // Use first td child of the parent row
  function setRowBadge(rowId, text, cls) {
    var row = document.getElementById(rowId);
    if (!row) return;
    var badgeEl = row.querySelector('.badge');
    if (badgeEl) {
      badgeEl.textContent = text;
      badgeEl.className = 'badge ' + cls;
    }
  }

  function fetchAll() {
    // Timestamp
    fetch(basePath + 'site.json')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (d) {
        setText('live-updated', d.update_timestamp || '');
      })
      .catch(function () {});

    // Health
    fetch(basePath + 'health.json')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (h) {
        var cpu = h.cpu || {};
        var mem = h.memory || {};
        var disk = h.disk || {};
        var temp = h.temperature || {};
        var gpu = h.gpu || {};
        var up = h.uptime || {};

        var load = cpu.load_1m || 0;
        var memPct = mem.used_percent || 0;
        var diskPct = disk.used_percent || 0;
        var tempVal = temp.value_celsius || 0;

        setText('dash-cpu', round1(load));
        setText('dash-temp', temp.display || '\u2014');
        setText('dash-mem', (mem.used_human || '\u2014') + ' / ' + (mem.total_human || '7.6 GB'));
        setText('dash-disk', (disk.used_human || '\u2014') + ' / ' + (disk.total_human || '467 GB'));
        setText('dash-gpu-temp', 'GPU ' + (gpu.temperature_celsius || '?') + '\u00B0');

        setBadge('dash-cpu-badge', cpuText(load), cpuBadge(load));
        setBadge('dash-temp-badge', badgeText(tempVal, 70, 80), badgeClass(tempVal, 70, 80));
        setBadge('dash-mem-badge', badgeText(memPct, 80, 90), badgeClass(memPct, 80, 90));
        setBadge('dash-disk-badge', badgeText(diskPct, 80, 95), badgeClass(diskPct, 80, 95));
      })
      .catch(function () {});

    // Token usage
    fetch(basePath + 'token-usage.json')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (tu) {
        var t = tu.today || {};
        var pct = t.used_percent || 0;
        var total = t.total_human || '\u2014';
        var cap = tu.daily_cap_human || '250M';

        setText('dash-ds', t.deepseek_human || '\u2014');
        setText('dash-gm', t.gemma4_human || '\u2014');
        setText('dash-total', total + ' / ' + cap);
        setText('dash-calls', (t.calls || 0) + ' calls');

        setBadge('dash-token-badge', round1(pct) + '%', badgeClass(pct, 70, 90));
        setBadge('dash-ds-badge', badgeText(pct, 70, 90), badgeClass(pct, 70, 90));
      })
      .catch(function () {});

    // Cron jobs
    fetch(basePath + 'cron-jobs.json')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (cj) {
        var count = cj.total || 0;
        setText('dash-crons', count + ' active');
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchAll);
  } else {
    fetchAll();
  }
})();
