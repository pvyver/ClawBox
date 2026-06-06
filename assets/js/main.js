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

  console.log('🦞 ClawBox dashboard loaded \u2014', nowISO());
})();
