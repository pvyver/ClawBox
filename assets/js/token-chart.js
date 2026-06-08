/**
 * ClawBox Token Usage Chart — Chart.js line/bar chart
 *
 * Reads history data from the <canvas> data-history attribute and renders
 * a stacked bar chart with a budget cap line overlay.
 */
(function () {
  'use strict';

  var canvas = document.getElementById('usage-chart');
  if (!canvas) return;

  // ── Parse data from Liquid-rendered attributes ───────────────────────
  var rawHistory;
  try {
    rawHistory = JSON.parse(canvas.getAttribute('data-history') || '[]');
  } catch (e) {
    rawHistory = [];
  }
  var dailyCap = parseInt(canvas.getAttribute('data-cap') || '250000000', 10);

  if (!rawHistory || rawHistory.length === 0) {
    canvas.parentNode.innerHTML =
      '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">' +
      'No history data yet &mdash; charts appear as token-watch runs accumulate.</p>';
    return;
  }

  // ── Prepare datasets ─────────────────────────────────────────────────
  // Sort by date ascending
  rawHistory.sort(function (a, b) { return a.date.localeCompare(b.date); });

  var labels = rawHistory.map(function (d) { return d.date; });
  var dsData = rawHistory.map(function (d) { return d.deepseek_tokens || 0; });
  var gmData = rawHistory.map(function (d) { return d.llama3_tokens || 0; });
  var capLine = rawHistory.map(function () { return dailyCap; });

  // Format ticks: millions
  function fmtM(v) {
    return (v / 1e6).toFixed(v >= 1e8 ? 0 : 1) + 'M';
  }

  // ── Theme colours from CSS custom props ──────────────────────────────
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim() || '#f97316';
  var success = style.getPropertyValue('--success').trim() || '#22c55e';
  var danger = style.getPropertyValue('--danger').trim() || '#ef4444';
  var textSec = style.getPropertyValue('--text-secondary').trim() || '#9ca3af';
  var border = style.getPropertyValue('--border').trim() || '#2a2a4a';
  var bgCard = style.getPropertyValue('--bg-card').trim() || '#16213e';

  // ── Init Chart ───────────────────────────────────────────────────────
  var ctx = canvas.getContext('2d');

  var chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'DeepSeek Flash',
          data: dsData,
          backgroundColor: accent + 'cc',
          borderColor: accent,
          borderWidth: 1,
          borderRadius: 2,
        },
        {
          label: 'Llama 3.2 (Local)',
          data: gmData,
          backgroundColor: success + 'cc',
          borderColor: success,
          borderWidth: 1,
          borderRadius: 2,
        },
        {
          label: 'Daily Cap',
          data: capLine,
          type: 'line',
          borderColor: danger,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          pointHitRadius: 8,
          fill: false,
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
          display: false, // Custom legend below chart
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
              var val = context.parsed.y || 0;
              var capPct = (val / dailyCap * 100).toFixed(1);
              var human = val >= 1e6
                ? (val / 1e6).toFixed(1) + 'M'
                : val.toLocaleString();
              return label + ': ' + human + ' (' + capPct + '%)';
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: border + '66' },
          ticks: { color: textSec, font: { size: 11 } },
        },
        y: {
          grid: { color: border + '66' },
          ticks: {
            color: textSec,
            font: { size: 11 },
            callback: fmtM,
          },
          beginAtZero: true,
        },
      },
    },
  });
})();
