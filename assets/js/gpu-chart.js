/**
 * ClawBox GPU History Chart — dual-axis Chart.js chart
 *
 * Reads gpu-history data from a hidden script[data-gpu-history] tag and
 * renders a dual-axis chart: temperature (line, left axis) and usage (bar,
 * right axis), with time range pills reusing TimeRangeFilter.
 */
(function () {
  'use strict';

  var script = document.getElementById('gpu-history-data');
  if (!script) return;

  var rawHistory;
  try {
    rawHistory = JSON.parse(script.getAttribute('data-gpu-history') || '[]');
  } catch (e) {
    rawHistory = [];
  }

  if (!rawHistory || rawHistory.length === 0) {
    var container = document.getElementById('gpu-chart-container');
    if (container) {
      container.innerHTML =
        '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">' +
        'GPU history will appear as data accumulates over the next few update cycles.</p>';
    }
    return;
  }

  // Sort by timestamp ascending
  rawHistory.sort(function (a, b) { return a.timestamp.localeCompare(b.timestamp); });

  // Format timestamps to short display strings (HH:MM or MMM DD HH:MM)
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

  var labels = rawHistory.map(function (d) { return fmtTS(d.timestamp); });
  var tempData = rawHistory.map(function (d) { return d.temperature_celsius; });
  var usageData = rawHistory.map(function (d) { return d.usage_percent; });

  // ── Theme colours ──
  var style = getComputedStyle(document.documentElement);
  var danger = style.getPropertyValue('--danger').trim() || '#ef4444';
  var accent = style.getPropertyValue('--accent').trim() || '#f97316';
  var textSec = style.getPropertyValue('--text-secondary').trim() || '#9ca3af';
  var border = style.getPropertyValue('--border').trim() || '#2a2a4a';
  var bgCard = style.getPropertyValue('--bg-card').trim() || '#16213e';
  var success = style.getPropertyValue('--success').trim() || '#22c55e';

  var canvas = document.getElementById('gpu-chart');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');

  var chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'GPU Usage',
          data: usageData,
          backgroundColor: accent + '99',
          borderColor: accent,
          borderWidth: 1,
          borderRadius: 2,
          order: 2,
          yAxisID: 'y-usage',
        },
        {
          label: 'GPU Temp',
          data: tempData,
          type: 'line',
          borderColor: danger,
          backgroundColor: danger + '18',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: danger,
          pointBorderColor: '#fff',
          pointBorderWidth: 1,
          fill: true,
          tension: 0.3,
          order: 1,
          yAxisID: 'y-temp',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: textSec,
            font: { size: 12 },
            usePointStyle: true,
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: bgCard,
          titleColor: '#e0e0e0',
          bodyColor: '#e0e0e0',
          borderColor: border,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label: function (context) {
              var label = context.dataset.label || '';
              var val = context.parsed.y;
              if (context.dataset.yAxisID === 'y-temp') {
                return label + ': ' + val.toFixed(1) + '°C';
              }
              return label + ': ' + val + '%';
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: border + '66' },
          ticks: { color: textSec, font: { size: 10 }, maxTicksLimit: 12 },
        },
        'y-temp': {
          position: 'left',
          title: {
            display: true,
            text: 'Temperature (°C)',
            color: danger,
            font: { size: 11 },
          },
          grid: { color: border + '44' },
          ticks: { color: textSec, font: { size: 10 } },
          beginAtZero: true,
        },
        'y-usage': {
          position: 'right',
          title: {
            display: true,
            text: 'Usage (%)',
            color: accent,
            font: { size: 11 },
          },
          grid: { display: false },
          ticks: { color: textSec, font: { size: 10 } },
          beginAtZero: true,
          max: 100,
        },
      },
    },
  });

  // ── Time range pill bar ──
  var fullHistory = rawHistory.slice();
  if (window.TimeRangeFilter) {
    // GPU chart uses timestamp-based filtering, so override the filter
    // logic to compare ISO timestamps instead of date strings
    var gpuFilter = {
      filterData: function (history, range) {
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
          var t = new Date(entry.timestamp).getTime();
          return t >= cutoff;
        });
      },

      applyFilter: function (chart, history, range) {
        var filtered = this.filterData(history, range);
        chart.data.labels = filtered.map(function (d) { return fmtTS(d.timestamp); });
        chart.data.datasets[0].data = filtered.map(function (d) { return d.usage_percent; });
        chart.data.datasets[1].data = filtered.map(function (d) { return d.temperature_celsius; });
        chart.update('none');
      },

      initPillBar: function (containerId, chart, history) {
        var container = document.getElementById(containerId);
        if (!container) return;

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
            var pills = container.querySelectorAll('.time-range-pill');
            pills.forEach(function (p) { p.classList.remove('active'); });
            pill.classList.add('active');

            var url = new URL(window.location);
            if (r === defaultRange) {
              url.searchParams.delete('range');
            } else {
              url.searchParams.set('range', r);
            }
            history.replaceState(null, '', url.toString());

            gpuFilter.applyFilter(chart, history, r);
          });
          container.appendChild(pill);
        });

        gpuFilter.applyFilter(chart, history, activeRange);
      },
    };

    gpuFilter.initPillBar('gpu-time-range-bar', chart, fullHistory);
  }
})();
