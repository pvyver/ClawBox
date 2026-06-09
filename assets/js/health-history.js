/**
 * ClawBox Health History Charts — CPU, Memory, Disk, Temperature trends
 *
 * Reads health-history data from a hidden script[data-health-history] tag
 * and renders 4 Chart.js line charts in a 2x2 grid, with shared time
 * range pills.
 */
(function () {
  'use strict';

  var script = document.getElementById('health-history-data');
  if (!script) return;

  var rawHistory;
  try {
    rawHistory = JSON.parse(script.getAttribute('data-health-history') || '[]');
  } catch (e) {
    rawHistory = [];
  }

  if (!rawHistory || rawHistory.length < 2) {
    var container = document.getElementById('health-chart-container');
    if (container) {
      container.innerHTML =
        '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">' +
        'Health history will appear as data accumulates over the next few update cycles (every ~30 min).</p>';
    }
    return;
  }

  rawHistory.sort(function (a, b) { return a.timestamp.localeCompare(b.timestamp); });

  function fmtTS(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    var now = new Date();
    var diffDays = (now - d) / 86400000;
    var h = String(d.getHours()).padStart(2, '0');
    var m = String(d.getMinutes()).padStart(2, '0');
    var time = h + ':' + m;
    if (diffDays > 1) {
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return months[d.getMonth()] + ' ' + d.getDate() + ' ' + time;
    }
    return time;
  }

  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim() || '#f97316';
  var danger = style.getPropertyValue('--danger').trim() || '#ef4444';
  var success = style.getPropertyValue('--success').trim() || '#22c55e';
  var info = style.getPropertyValue('--info').trim() || '#3b82f6';
  var textSec = style.getPropertyValue('--text-secondary').trim() || '#9ca3af';
  var border = style.getPropertyValue('--border').trim() || '#2a2a4a';
  var bgCard = style.getPropertyValue('--bg-card').trim() || '#16213e';

  var charts = [];
  var chartConfigs = [
    { id: 'chart-cpu', label: 'CPU Load (1m)', dataKey: 'cpu_load_1m', color: accent, suffix: '' },
    { id: 'chart-mem', label: 'Memory Usage', dataKey: 'memory_percent', color: info, suffix: '%', max: 100 },
    { id: 'chart-disk', label: 'Disk Usage', dataKey: 'disk_percent', color: success, suffix: '%', max: 100 },
    { id: 'chart-temp', label: 'Temperature', dataKey: 'temperature_celsius', color: danger, suffix: '\u00B0C' },
  ];

  chartConfigs.forEach(function (cfg) {
    var canvas = document.getElementById(cfg.id);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    var labels = rawHistory.map(function (d) { return fmtTS(d.timestamp); });
    var values = rawHistory.map(function (d) { return d[cfg.dataKey] || 0; });

    var opts = {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: bgCard,
          titleColor: '#e0e0e0',
          bodyColor: '#e0e0e0',
          borderColor: border,
          borderWidth: 1,
          padding: 8,
          cornerRadius: 4,
          callbacks: {
            label: function (context) {
              return cfg.label + ': ' + context.parsed.y.toFixed(1) + cfg.suffix;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: border + '66' },
          ticks: { color: textSec, font: { size: 9 }, maxTicksLimit: 8 },
        },
        y: {
          position: 'left',
          title: {
            display: true,
            text: cfg.label + (cfg.suffix ? ' (' + cfg.suffix + ')' : ''),
            color: cfg.color,
            font: { size: 10 },
          },
          grid: { color: border + '44' },
          ticks: { color: textSec, font: { size: 9 } },
          beginAtZero: true,
        },
      },
      elements: {
        point: { radius: 2, hoverRadius: 4 },
      },
    };

    if (cfg.max != null) opts.scales.y.suggestedMax = cfg.max;

    var chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: cfg.label,
          data: values,
          borderColor: cfg.color,
          backgroundColor: cfg.color + '18',
          borderWidth: 2,
          pointBackgroundColor: cfg.color,
          pointBorderColor: '#fff',
          pointBorderWidth: 1,
          fill: true,
          tension: 0.3,
        }],
      },
      options: opts,
    });

    charts.push({ chart: chart, config: cfg, history: rawHistory.slice() });
  });

  if (charts.length === 0) return;

  function filterByRange(history, range) {
    if (!history || history.length === 0) return history || [];
    if (range === 'all') return history;
    var now = new Date();
    var msToKeep;
    switch (range) {
      case '1h':  msToKeep = 3600000; break;
      case '24h': msToKeep = 86400000; break;
      case '7d':  msToKeep = 7 * 86400000; break;
      case '30d': msToKeep = 30 * 86400000; break;
      default:    msToKeep = 30 * 86400000;
    }
    var cutoff = now.getTime() - msToKeep;
    return history.filter(function (entry) {
      return new Date(entry.timestamp).getTime() >= cutoff;
    });
  }

  function updateAllCharts(range) {
    charts.forEach(function (item) {
      var filtered = filterByRange(item.history, range);
      item.chart.data.labels = filtered.map(function (d) { return fmtTS(d.timestamp); });
      item.chart.data.datasets[0].data = filtered.map(function (d) { return d[item.config.dataKey] || 0; });
      item.chart.update('none');
    });
  }

  var rangeContainer = document.getElementById('health-time-range-bar');
  if (!rangeContainer) return;

  var ranges = ['1h', '24h', '7d', '30d', 'all'];
  var defaultRange = '24h';
  var params = new URLSearchParams(window.location.search);
  var activeRange = params.get('range') || defaultRange;

  ranges.forEach(function (r) {
    var pill = document.createElement('button');
    pill.className = 'time-range-pill' + (r === activeRange ? ' active' : '');
    pill.textContent = r;
    pill.setAttribute('data-range', r);
    pill.addEventListener('click', function () {
      rangeContainer.querySelectorAll('.time-range-pill').forEach(function (p) { p.classList.remove('active'); });
      pill.classList.add('active');
      var url = new URL(window.location);
      if (r === defaultRange) url.searchParams.delete('range');
      else url.searchParams.set('range', r);
      history.replaceState(null, '', url.toString());
      updateAllCharts(r);
    });
    rangeContainer.appendChild(pill);
  });

  updateAllCharts(activeRange);
})();
