/**
 * ClawBox System Event Log — Client-side filtering & search
 *
 * Filter by severity type, source, or search by message text.
 */
(function () {
  'use strict';

  var table = document.getElementById('events-table');
  if (!table) return;

  var rows = table.querySelectorAll('tbody tr.event-row');
  var totalEl = document.getElementById('ev-total');
  var filteredEl = document.getElementById('ev-filtered');
  var searchInput = document.getElementById('event-search');

  var currentType = 'all';
  var currentSource = 'all';
  var currentSearch = '';

  // ── Apply all filters ──

  function applyFilters() {
    var visible = 0;

    Array.from(rows).forEach(function (row) {
      var type = row.getAttribute('data-type');
      var source = row.getAttribute('data-source');
      var message = (row.getAttribute('data-message') || '').toLowerCase();
      var show = true;

      if (currentType !== 'all' && type !== currentType) show = false;
      if (show && currentSource !== 'all' && source !== currentSource) show = false;
      if (show && currentSearch && message.indexOf(currentSearch.toLowerCase()) === -1) show = false;

      row.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    if (filteredEl) filteredEl.textContent = visible;
  }

  // ── Hook filter pills ──

  function hookPills(attr, group) {
    var pills = document.querySelectorAll('[data-filter-' + attr + ']');
    Array.from(pills).forEach(function (pill) {
      pill.addEventListener('click', function () {
        var val = pill.getAttribute('data-filter-' + attr);

        // Deactivate siblings in the same group
        document.querySelectorAll('[data-group="' + group + '"]').forEach(function (p) {
          p.classList.remove('active');
        });
        pill.classList.add('active');

        if (attr === 'type') currentType = val;
        if (attr === 'source') currentSource = val;

        applyFilters();
      });
    });
  }

  hookPills('type', 'type');
  hookPills('source', 'source');

  // ── Search input ──

  if (searchInput) {
    var searchTimer = null;
    searchInput.addEventListener('input', function () {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        currentSearch = searchInput.value.trim();
        applyFilters();
      }, 200);
    });
  }
})();
