/**
 * ClawBox Cron Page — Client-side data refresh
 */
(function () {
  'use strict';

  var basePath = window.location.pathname.includes('/ClawBox/')
    ? '/ClawBox/assets/data/'
    : '/assets/data/';
  var dataUrl = basePath + 'cron-jobs.json';

  function pad(v) { return v < 10 ? '0' + v : v; }

  function formatMs(ms) {
    if (!ms) return '\u2014';
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) +
      ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ' UTC';
  }

  function durStr(ms) {
    if (!ms || ms <= 0) return '\u2014';
    if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
    return (ms / 60000).toFixed(1) + 'm';
  }

  function badgeCls(status) {
    var s = (status || '').toLowerCase();
    if (s === 'ok') return 'badge-ok';
    if (s === 'error' || s === 'failed') return 'badge-err';
    if (s === 'disabled') return 'badge-warn';
    return 'badge-ok';
  }

  function statusText(status) {
    var s = (status || '').toLowerCase();
    if (s === 'ok') return 'Active';
    if (s === 'error') return 'Error';
    return status || 'Unknown';
  }

  function modelDisplay(model) {
    if (!model) return 'default';
    if (model.indexOf('llama') !== -1) return 'Llama 3.2 (local)';
    if (model.indexOf('deepseek') !== -1) return 'DeepSeek Flash';
    return model;
  }

  function renderTable(jobs) {
    var tbody = document.getElementById('cron-tbody');
    if (!tbody) return;

    var html = '';
    for (var i = 0; i < jobs.length; i++) {
      var j = jobs[i];
      var name = j.name || j.id || '?';
      var sched = j.schedule || '\u2014';
      var model = modelDisplay(j.model);
      var status = j.status || 'unknown';
      var lastRun = formatMs(j.last_run);
      var dur = durStr(j.last_duration_ms);
      var errors = j.consecutive_errors || 0;
      var rowId = errors > 0 ? ' id="cron-error-' + slugify(name) + '" class="cron-row-error"' : '';

      html += '<tr' + rowId + '>' +
        '<td>' + escHtml(name) + '</td>' +
        '<td>' + escHtml(sched) + '</td>' +
        '<td>' + escHtml(model) + '</td>' +
        '<td><span class="badge ' + badgeCls(status) + '">' + statusText(status) +
        (errors > 0 ? ' (' + errors + 'x)' : '') + '</span></td>' +
        '<td>' + lastRun + '</td>' +
        '<td>' + dur + '</td>' +
        '</tr>';
    }
    tbody.innerHTML = html || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No jobs found.</td></tr>';
  }

  function slugify(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function scrollToFailing() {
    var hash = window.location.hash.replace(/^#/, '');
    if (hash === 'failing') {
      var firstErr = document.querySelector('.cron-row-error');
      if (firstErr) {
        setTimeout(function () { firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 200);
      }
    } else if (hash) {
      var target = document.getElementById(hash) || document.getElementById('cron-error-' + hash);
      if (target) {
        setTimeout(function () { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 200);
      }
    }
  }

  fetch(dataUrl)
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      if (data.jobs) {
        renderTable(data.jobs);
        scrollToFailing();
      }
    })
    .catch(function (err) {
      console.warn('Cron data fetch:', err.message);
    });
})();
