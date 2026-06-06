// ClawBox Dashboard — Client-side interactivity
(function() {
  'use strict';

  // 🧭 Mobile nav toggle
  const toggle = document.querySelector('.nav-toggle');
  const navList = document.querySelector('.nav-list');
  if (toggle && navList) {
    toggle.addEventListener('click', function() {
      navList.classList.toggle('open');
    });
    // Close nav on outside click
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
    const now = nowISO();

    // Dashboard index cards
    const healthTime = document.getElementById('health-time');
    if (healthTime && healthTime.textContent === 'pending...') healthTime.textContent = now;

    const cronCount = document.getElementById('cron-count');
    if (cronCount && cronCount.textContent === 'pending...') cronCount.textContent = '2';

    const tokenToday = document.getElementById('token-today');
    if (tokenToday && tokenToday.textContent === 'pending...') tokenToday.textContent = '—';

    const liveUpdated = document.getElementById('live-updated');
    if (liveUpdated) liveUpdated.textContent = now;
  }

  fillPlaceholders();

  // 🟢 Animate progress bars on scroll
  const bars = document.querySelectorAll('.progress-fill');
  if (bars.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          const bar = entry.target;
          const target = bar.getAttribute('data-target') || bar.style.width || '0%';
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
      // Store current width as data-target then reset
      const w = bar.style.width;
      if (w && w !== '0%') {
        bar.setAttribute('data-target', w);
        bar.style.width = '0%';
      }
      observer.observe(bar);
    });
  }

  console.log('🦞 ClawBox dashboard loaded —', nowISO());
})();
