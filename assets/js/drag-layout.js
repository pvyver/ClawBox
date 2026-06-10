/**
 * ClawBox Dashboard — Drag-and-Drop Layout
 *
 * Makes compact-grid cards and stats-bar chips draggable using SortableJS.
 * Persists layout to localStorage with a reset button.
 */
(function () {
  'use strict';

  var LAYOUT_KEY = 'clawbox-dashboard-layout';
  var GRID_SEL = '.compact-grid';
  var STATS_SEL = '.stats-bar';
  var RESET_BTN_ID = 'layout-reset-btn';

  if (typeof Sortable === 'undefined') return;

  var gridEl = document.querySelector(GRID_SEL);
  var statsEl = document.querySelector(STATS_SEL);
  if (!gridEl) return;

  var gridSortable, statsSortable;

  function init() {
    gridSortable = new Sortable(gridEl, {
      animation: 200,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      ghostClass: 'drag-ghost',
      chosenClass: 'drag-chosen',
      dragClass: 'drag-active',
      delay: 150,
      delayOnTouchOnly: true,
      direction: 'horizontal',
      onEnd: saveLayout,
    });

    if (statsEl) {
      statsSortable = new Sortable(statsEl, {
        animation: 200,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        ghostClass: 'drag-ghost',
        chosenClass: 'drag-chosen',
        dragClass: 'drag-active',
        delay: 150,
        delayOnTouchOnly: true,
        onEnd: saveLayout,
      });
    }

    setTimeout(restoreLayout, 50);
  }

  function saveLayout() {
    if (!gridEl) return;

    var data = { grid: [], stats: [] };

    gridEl.querySelectorAll('.compact-card').forEach(function (card) {
      data.grid.push(card.id || '');
    });

    if (statsEl) {
      statsEl.querySelectorAll('.stat-chip').forEach(function (chip) {
        data.stats.push(chip.id || '');
      });
    }

    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function restoreLayout() {
    var raw;
    try { raw = localStorage.getItem(LAYOUT_KEY); } catch (e) { return; }
    if (!raw) return;
    if (raw === JSON.stringify(defaultLayout())) return;

    var data;
    try { data = JSON.parse(raw); } catch (e) { return; }

    if (data.grid && data.grid.length > 0) reorderChildren(gridEl, data.grid);
    if (data.stats && data.stats.length > 0 && statsEl) reorderChildren(statsEl, data.stats);
  }

  function reorderChildren(parent, idOrder) {
    var items = {};
    for (var i = 0; i < idOrder.length; i++) {
      var el = document.getElementById(idOrder[i]);
      if (el && el.parentNode === parent) items[idOrder[i]] = el;
    }
    for (var j = 0; j < idOrder.length; j++) {
      var child = items[idOrder[j]];
      if (child) parent.appendChild(child);
    }
  }

  function defaultLayout() {
    var data = { grid: [], stats: [] };
    document.querySelectorAll(GRID_SEL + ' > .compact-card').forEach(function (c) {
      data.grid.push(c.id || '');
    });
    if (statsEl) {
      statsEl.querySelectorAll('.stat-chip').forEach(function (c) {
        data.stats.push(c.id || '');
      });
    }
    return data;
  }

  function resetLayout() {
    try { localStorage.removeItem(LAYOUT_KEY); } catch (e) {}
    window.location.reload();
  }

  function hookResetButton() {
    var btn = document.getElementById(RESET_BTN_ID);
    if (btn) btn.addEventListener('click', resetLayout);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
      hookResetButton();
    });
  } else {
    init();
    hookResetButton();
  }
})();
