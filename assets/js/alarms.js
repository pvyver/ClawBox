/**
 * ClawBox Alarms & Notifications — Client-side filtering
 *
 * Handles severity filter pills and active (24h) filter for the alarms table.
 */
(function () {
  'use strict';

  var table = document.getElementById('alarms-table');
  var filterBar = document.getElementById('alarm-filter-bar');
  if (!table || !filterBar) return;

  var rows = table.querySelectorAll('tbody tr.alarm-row');
  var totalSpan = document.getElementById('alarm-total');
  var activeSpan = document.getElementById('alarm-active');

  function countVisible() {
    return Array.from(rows).filter(function (r) { return r.style.display !== 'none'; }).length;
  }

  function isActive(row) {
    var ts = row.getAttribute('data-timestamp');
    if (!ts) return false;
    var d = new Date(ts);
    if (isNaN(d.getTime())) return false;
    return (Date.now() - d.getTime()) < 86400000;
  }

  function applyFilter(filter) {
    var visibleCount = 0;
    var activeCount = 0;

    Array.from(rows).forEach(function (row) {
      var type = row.getAttribute('data-type');
      var show = false;

      if (filter === 'all') {
        show = true;
      } else if (filter === 'active') {
        show = isActive(row) && (type === 'critical' || type === 'error');
      } else {
        show = type === filter;
      }

      row.style.display = show ? '' : 'none';
      if (show) visibleCount++;
      if (show && isActive(row) && (type === 'critical' || type === 'error')) activeCount++;
    });

    if (totalSpan) totalSpan.textContent = visibleCount;
    if (activeSpan && filter === 'all') {
      // Recalculate active count regardless of filter
      var realActive = 0;
      Array.from(rows).forEach(function (row) {
        if (isActive(row)) {
          var t = row.getAttribute('data-type');
          if (t === 'critical' || t === 'error') realActive++;
        }
      });
      activeSpan.textContent = realActive;
    } else if (activeSpan) {
      activeSpan.textContent = activeCount;
    }
  }

  // ── Hook filter pills ──

  filterBar.querySelectorAll('.time-range-pill').forEach(function (pill) {
    pill.addEventListener('click', function () {
      filterBar.querySelectorAll('.time-range-pill').forEach(function (p) {
        p.classList.remove('active');
      });
      pill.classList.add('active');
      applyFilter(pill.getAttribute('data-filter'));
    });
  });

  // ── Init with 'all' ──

  applyFilter('all');
})();
