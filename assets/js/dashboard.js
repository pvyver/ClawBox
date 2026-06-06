/**
 * ClawBox Dashboard — Client-side data refresh
 *
 * Fetches latest site.json and updates dashboard placeholders.
 */
(function () {
  'use strict';

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text || '\u2014';
  }

  function fetchData() {
    var url = window.location.pathname.includes('/ClawBox/')
      ? '/ClawBox/assets/data/site.json'
      : '/assets/data/site.json';

    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var ts = data.update_timestamp || '';
        setText('health-time', ts);
        setText('live-updated', ts);
        setText('site-updated', ts);
      })
      .catch(function (err) {
        console.warn('Dashboard data fetch:', err.message);
      });

    // Also fetch health for live snapshot
    var hurl = window.location.pathname.includes('/ClawBox/')
      ? '/ClawBox/assets/data/health.json'
      : '/assets/data/health.json';

    fetch(hurl)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (h) {
        if (h.temperature && h.temperature.display) setText('live-temp', h.temperature.display);
        if (h.memory && h.memory.used_human) setText('live-ram', h.memory.used_human);
        if (h.disk) {
          setText('live-disk', h.disk.used_human ? h.disk.used_human + ' used' : (h.disk.used_percent != null ? h.disk.used_percent + '% used' : ''));
        }
      })
      .catch(function () {});

    // Fetch token usage for today
    var turl = window.location.pathname.includes('/ClawBox/')
      ? '/ClawBox/assets/data/token-usage.json'
      : '/assets/data/token-usage.json';

    fetch(turl)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (tu) {
        if (tu.today && tu.today.total_human) setText('token-today', tu.today.total_human);
      })
      .catch(function () {});

    // Fetch cron for counts
    var curl = window.location.pathname.includes('/ClawBox/')
      ? '/ClawBox/assets/data/cron-jobs.json'
      : '/assets/data/cron-jobs.json';

    fetch(curl)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (cj) {
        if (cj.total != null) setText('cron-count', cj.total);
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchData);
  } else {
    fetchData();
  }
})();
