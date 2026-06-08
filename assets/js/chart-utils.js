/**
 * ClawBox Chart Utilities — shared time-range filtering
 *
 * Provides:
 *   - TimeRangeFilter: filter history data and update Chart.js charts
 *   - URL query param persistence (?range=7d)
 *   - Pill bar creation and wiring
 */
(function () {
  'use strict';

  var TimeRangeFilter = {
    /**
     * Filter history array to entries within the given range.
     * @param {Array} history - Array of { date: 'YYYY-MM-DD', ... } objects (sorted ascending)
     * @param {string} range - '1h' | '24h' | '7d' | '30d' | 'all'
     * @returns {Array} filtered subset
     */
    filterData: function (history, range) {
      if (!history || history.length === 0) return history || [];
      if (range === 'all') return history;

      var now = new Date();

      // For daily data, use day-count filtering
      var daysToKeep;
      switch (range) {
        case '1h':  daysToKeep = 0; break;  // No daily data fits 1h — returns empty
        case '24h': daysToKeep = 2; break;  // Last 2 daily entries
        case '7d':  daysToKeep = 7; break;
        case '30d': daysToKeep = 30; break;
        default:    daysToKeep = 30;
      }

      if (daysToKeep === 0) return [];

      // Filter by date comparison
      var cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - daysToKeep);
      var cutoffStr = cutoff.toISOString().slice(0, 10);

      return history.filter(function (entry) {
        return entry.date >= cutoffStr;
      });
    },

    /**
     * Get human label for a range.
     */
    getDateRange: function (range) {
      var labels = {
        '1h':  'Last hour',
        '24h': 'Last 24 hours',
        '7d':  'Last 7 days',
        '30d': 'Last 30 days',
        'all': 'All time'
      };
      return labels[range] || 'Last 30 days';
    },

    /**
     * Apply range filter to an existing Chart.js chart instance.
     * Rebuilds chart.data.labels and each dataset.data from filtered history.
     *
     * @param {Chart} chart - Chart.js instance
     * @param {Array} history - Full unfiltered history array
     * @param {string} range - Range key
     * @param {string[]} dataKeys - Dataset.dataKey mapping: ['deepseek_tokens', 'llama3_tokens']
     * @param {number} capLine - Optional daily cap value for the cap dataset (last dataset)
     */
    applyFilter: function (chart, history, range, dataKeys, capLine) {
      var filtered = this.filterData(history, range);
      chart.data.labels = filtered.map(function (d) { return d.date; });

      for (var i = 0; i < dataKeys.length; i++) {
        if (chart.data.datasets[i]) {
          chart.data.datasets[i].data = filtered.map(function (d) {
            return d[dataKeys[i]] || 0;
          });
        }
      }

      // Update cap line dataset (last dataset) if provided
      if (capLine != null && chart.data.datasets.length > dataKeys.length) {
        chart.data.datasets[chart.data.datasets.length - 1].data = filtered.map(function () { return capLine; });
      }

      chart.update('none');
    },

    /**
     * Build and wire the pill bar.
     * @param {string} containerId - ID of the pill bar container element
     * @param {Chart} chart - Chart.js instance
     * @param {Array} history - Full unfiltered history
     * @param {string[]} dataKeys - Dataset keys
     * @param {number} capLine - Optional daily cap
     */
    initPillBar: function (containerId, chart, history, dataKeys, capLine) {
      var container = document.getElementById(containerId);
      if (!container) return;

      var ranges = ['1h', '24h', '7d', '30d', 'all'];
      var defaultRange = '30d';

      // Read from URL query param
      var params = new URLSearchParams(window.location.search);
      var activeRange = params.get('range') || defaultRange;

      // Create pills
      ranges.forEach(function (r) {
        var pill = document.createElement('button');
        pill.className = 'time-range-pill' + (r === activeRange ? ' active' : '');
        pill.textContent = r;
        pill.setAttribute('data-range', r);
        pill.addEventListener('click', function () {
          // Deactivate all, activate clicked
          var pills = container.querySelectorAll('.time-range-pill');
          pills.forEach(function (p) { p.classList.remove('active'); });
          pill.classList.add('active');

          // Update URL without page reload
          var url = new URL(window.location);
          if (r === defaultRange) {
            url.searchParams.delete('range');
          } else {
            url.searchParams.set('range', r);
          }
          history.replaceState(null, '', url.toString());

          // Update chart
          TimeRangeFilter.applyFilter(chart, history, r, dataKeys, capLine);
        });
        container.appendChild(pill);
      });

      // Apply initial filter
      TimeRangeFilter.applyFilter(chart, history, activeRange, dataKeys, capLine);
    }
  };

  // Expose globally
  window.TimeRangeFilter = TimeRangeFilter;
})();
