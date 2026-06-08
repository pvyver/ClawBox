/**
 * ClawBox Dashboard — Client-side data refresh
 *
 * Fetches latest data JSON and updates compact dashboard elements.
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

  function setBadge(id, text, cls) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = text;
      el.className = 'badge ' + cls;
    }
  }

  function setMiniBar(id, pct, cls) {
    var el = document.getElementById(id);
    if (el) {
      el.style.width = Math.min(pct, 100) + '%';
      el.className = 'mini-fill ' + cls;
    }
  }

  function round1(v) { return Math.round(v * 10) / 10; }

  // ── Fetch all data ───────────────────────────────────────────────────

  function fetchAll() {
    // Site meta (timestamp)
    fetch(basePath + 'site.json')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (d) {
        var ts = d.update_timestamp || '';
        setText('live-updated', ts);
      })
      .catch(function () {});

    // Health data
    fetch(basePath + 'health.json')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (h) {
        var temp = h.temperature || {};
        var mem = h.memory || {};
        var disk = h.disk || {};
        var cpu = h.cpu || {};
        var up = h.uptime || {};

        var tempVal = temp.value_celsius || 0;
        var memPct = mem.used_percent || 0;
        var diskPct = disk.used_percent || 0;

        setText('stat-temp', temp.display || '\u2014');
        setText('stat-ram', mem.used_human || '\u2014');
        setText('stat-disk', disk.used_human || '\u2014');
        setText('stat-uptime', up.display || '\u2014');

        setText('cc-cpu', cpu.load_1m != null ? round1(cpu.load_1m) : '\u2014');
        setText('cc-temp', temp.display || '\u2014');
        setText('cc-mem', mem.used_human || '\u2014');

        var tempCls = tempVal > 80 ? 'badge-err' : tempVal > 70 ? 'badge-warn' : 'badge-ok';
        var memCls = memPct > 90 ? 'badge-err' : memPct > 80 ? 'badge-warn' : 'badge-ok';
        var diskCls = diskPct > 95 ? 'badge-err' : diskPct > 80 ? 'badge-warn' : 'badge-ok';

        setBadge('stat-temp-badge', round1(tempVal) + '\u00B0', tempCls);
        setMiniBar('stat-ram-bar', memPct, memCls);
        setMiniBar('stat-disk-bar', diskPct, diskCls);
      })
      .catch(function () {});

    // Token usage
    fetch(basePath + 'token-usage.json')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (tu) {
        var t = tu.today || {};
        var pct = t.used_percent || 0;
        var human = t.total_human || '\u2014';
        setText('stat-tokens', human);
        setText('cc-tokens', human);
        setText('cc-cap', tu.daily_cap_human || '250M');
        setText('cc-pct', round1(pct) + '%');

        var cls = pct > 90 ? 'badge-err' : pct > 70 ? 'badge-warn' : 'badge-ok';
        setBadge('stat-token-badge', Math.round(pct) + '%', cls);
      })
      .catch(function () {});

    // Cron jobs
    fetch(basePath + 'cron-jobs.json')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (cj) {
        var count = cj.total || 0;
        var jobs = cj.jobs || [];
        var failing = 0;
        var failingName = '';
        for (var i = 0; i < jobs.length; i++) {
          if (jobs[i].consecutive_errors > 0) {
            failing++;
            if (!failingName) failingName = jobs[i].name;
          }
        }

        setText('stat-crons', count);
        setText('cc-active', count);
        setText('cc-failing', failing);

        // Stats bar failing badge
        var failBadge = document.getElementById('stat-cron-fail');
        if (failing > 0) {
          if (!failBadge) {
            var chip = document.getElementById('stat-crons').parentNode.parentNode;
            var existing = chip.querySelector('.chip-badge');
            if (existing) {
              var newBadge = document.createElement('span');
              newBadge.className = 'chip-badge';
              newBadge.innerHTML = '<span class="badge badge-err" id="stat-cron-fail">' + failing + ' failing</span>';
              chip.appendChild(newBadge);
            }
          } else {
            failBadge.textContent = failing + ' failing';
          }
        } else if (failBadge) {
          failBadge.parentNode.removeChild(failBadge);
        }

        // Compact card warn state
        var card = document.getElementById('cron-card');
        if (card) {
          if (failing > 0) {
            card.classList.add('card-warn');
          } else {
            card.classList.remove('card-warn');
          }
        }

        // Badge on compact card header
        var ccBadge = document.getElementById('cc-cron-fail');
        if (failing > 0) {
          if (!ccBadge) {
            var header = document.querySelector('#cron-card .compact-card-header');
            if (header) {
              var b = document.createElement('span');
              b.className = 'badge badge-err';
              b.id = 'cc-cron-fail';
              b.textContent = failing;
              header.appendChild(b);
            }
          } else {
            ccBadge.textContent = failing;
          }
        } else if (ccBadge) {
          ccBadge.parentNode.removeChild(ccBadge);
        }

        // Nav badge
        var navBadge = document.getElementById('nav-cron-badge');
        if (navBadge) {
          if (failing > 0) {
            navBadge.textContent = failing;
            navBadge.className = 'nav-badge nav-badge-warn';
          } else {
            navBadge.textContent = '';
            navBadge.className = 'nav-badge';
          }
        }
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchAll);
  } else {
    fetchAll();
  }
})();
