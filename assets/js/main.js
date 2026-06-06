// ClawBox Dashboard — Client-side interactivity
(function() {
  'use strict';

  // 🧭 Mobile nav toggle
  var toggle = document.querySelector('.nav-toggle');
  var navList = document.querySelector('.nav-list');
  if (toggle && navList) {
    toggle.addEventListener('click', function() {
      navList.classList.toggle('open');
    });
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.site-nav')) {
        navList.classList.remove('open');
      }
    });
  }

  // ⏰ Timestamp helper
  function nowISO() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  }

  // 📊 Fill empty stat placeholders
  function fillPlaceholders() {
    var now = nowISO();

    var healthTime = document.getElementById('health-time');
    if (healthTime && healthTime.textContent === 'pending...') healthTime.textContent = now;

    var cronCount = document.getElementById('cron-count');
    if (cronCount && cronCount.textContent === 'pending...') cronCount.textContent = '2';

    var tokenToday = document.getElementById('token-today');
    if (tokenToday && tokenToday.textContent === 'pending...') tokenToday.textContent = '\u2014';

    var liveUpdated = document.getElementById('live-updated');
    if (liveUpdated) liveUpdated.textContent = now;
  }

  fillPlaceholders();

  // 🟢 Animate progress bars on scroll
  var bars = document.querySelectorAll('.progress-fill');
  if (bars.length && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var bar = entry.target;
          var target = bar.getAttribute('data-target') || bar.style.width || '0%';
          bar.style.transition = 'width 1.2s cubic-bezier(0.22, 1, 0.36, 1)';
          bar.style.width = '0%';
          requestAnimationFrame(function() {
            bar.style.width = target;
          });
          observer.unobserve(bar);
        }
      });
    }, { threshold: 0.1 });

    bars.forEach(function(bar) {
      var w = bar.style.width;
      if (w && w !== '0%') {
        bar.setAttribute('data-target', w);
        bar.style.width = '0%';
      }
      observer.observe(bar);
    });
  }

  // 🌗 Theme toggle
  (function initTheme() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;

    // Read saved preference
    var saved = localStorage.getItem('clawbox-theme');
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
    }
    // If no saved pref and system prefers light, let the @media query handle it

    btn.addEventListener('click', function() {
      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('clawbox-theme', next);
    });
  })();

  // ⏱ Data freshness indicator
  (function initFreshness() {
    var badge = document.getElementById('freshness-badge');
    var label = document.getElementById('freshness-label');
    if (!badge || !label) return;

    // Reference timestamp: injected by Jekyll from site.json
    var lastUpdated = null;
    var metaEl = document.getElementById('data-last-updated');
    if (metaEl && metaEl.getAttribute('data-iso')) {
      lastUpdated = new Date(metaEl.getAttribute('data-iso'));
    }

    // Fallback: also try to parse inline data from footer/header page info
    var dataEl = document.getElementById('data-last-updated-inline');
    if (!lastUpdated && dataEl && dataEl.textContent) {
      lastUpdated = new Date(dataEl.textContent);
    }

    function updateFreshness() {
      var now = Date.now();
      var badgeEl = document.getElementById('freshness-badge');
      var labelEl = document.getElementById('freshness-label');
      if (!badgeEl || !labelEl) return;

      if (!lastUpdated || isNaN(lastUpdated.getTime())) {
        badgeEl.className = 'freshness-badge offline';
        labelEl.textContent = 'No data';
        return;
      }

      var elapsedMs = now - lastUpdated.getTime();
      var elapsedSec = Math.floor(elapsedMs / 1000);

      if (elapsedMs < 0) {
        // Timestamp is in the future — treat as live
        badgeEl.className = 'freshness-badge live';
        labelEl.textContent = 'Live';
        return;
      }

      var className, text;

      if (elapsedSec <= 60) {
        // 🟢 Live: within 60s
        className = 'live';
        text = elapsedSec <= 5 ? 'Live' : elapsedSec + 's ago';
      } else if (elapsedSec <= 600) {
        // 🟡 Stale: 1-10 min
        className = 'stale';
        var min = Math.floor(elapsedSec / 60);
        var sec = elapsedSec % 60;
        text = min + 'm ' + sec + 's ago';
      } else {
        // 🔴 Offline: >10 min
        className = 'offline';
        var minutes = Math.floor(elapsedSec / 60);
        var hours = Math.floor(minutes / 60);
        if (hours >= 1) {
          var remMin = minutes % 60;
          text = hours + 'h ' + remMin + 'm ago';
        } else {
          text = minutes + 'm ago';
        }
      }

      badgeEl.className = 'freshness-badge ' + className;
      labelEl.textContent = text;
    }

    // Update immediately, then every 1s
    updateFreshness();
    setInterval(updateFreshness, 1000);
  })();

  console.log('🦞 ClawBox dashboard loaded \u2014', nowISO());
})();
