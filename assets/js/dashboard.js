/**
 * ClawBox Dashboard — Client-side data refresh
 *
 * Fetches latest data JSON and updates compact dashboard elements.
 */
(function () {
  'use strict';

  var basePath = window.location.pathname.includes('/ClawBox/')
    ? '/ClawBox/assets/data/'
    : '/assets/data/';

  // ── Configurable refresh interval ────────────────────────────────
  var REFRESH_KEY = 'clawbox-refresh-interval';
  var REFRESH_DEFAULTS = { label: '15s', ms: 15000 };
  var REFRESH_OPTIONS = [
    { label: '5s',  ms:  5000 },
    { label: '15s', ms: 15000 },
    { label: '30s', ms: 30000 },
    { label: '1m',  ms: 60000 },
    { label: 'Off', ms:     0 },
  ];

  function getRefreshInterval() {
    try {
      var saved = localStorage.getItem(REFRESH_KEY);
      if (saved !== null) {
        var ms = parseInt(saved, 10);
        if (!isNaN(ms) && ms >= 0) return ms;
      }
    } catch (e) {}
    return REFRESH_DEFAULTS.ms;
  }

  function setRefreshInterval(ms) {
    try { localStorage.setItem(REFRESH_KEY, String(ms)); } catch (e) {}
  }

  function cacheBust(url) {
    var sep = url.indexOf('?') === -1 ? '?' : '&';
    return url + sep + 't=' + Date.now();
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text || '\u2014';
  }

  function setBadge(id, text, cls) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = text;
      el.className = 'badge ' + cls;
    }
  }

  function setMiniBar(id, pct, cls) {
    var el = document.getElementById(id);
    if (el) {
      el.style.width = Math.min(pct, 100) + '%';
      el.className = 'mini-fill ' + cls;
    }
  }

  function round1(v) { return Math.round(v * 10) / 10; }

  // ── Pulse animation trigger ────────────────────────────────────────
  var pulseTimer = null;
  var PULSE_DURATION = 600;

  function triggerRefreshPulse() {
    var bar = document.getElementById('stats-bar');
    if (!bar) return;
    bar.classList.remove('refresh-pulse');
    // Force reflow so the class re-triggers the animation
    void bar.offsetWidth;
    bar.classList.add('refresh-pulse');
    if (pulseTimer) clearTimeout(pulseTimer);
    pulseTimer = setTimeout(function () {
      bar.classList.remove('refresh-pulse');
    }, PULSE_DURATION);
  }

  // ── Real-time last-updated clock ───────────────────────────────────
  var lastUpdated = null;
  var clockInterval = null;

  function updateLastUpdatedClock() {
    var el = document.getElementById('live-updated');
    if (!el) return;
    if (!lastUpdated) return;
    var elapsed = Math.floor((Date.now() - lastUpdated) / 1000);
    var text;
    if (elapsed < 3) {
      text = 'just now';
    } else if (elapsed < 60) {
      text = elapsed + 's ago';
    } else {
      var min = Math.floor(elapsed / 60);
      var sec = elapsed % 60;
      text = min + 'm ' + sec + 's ago';
    }
    el.textContent = text;
  }

  function startClock() {
    if (clockInterval) clearInterval(clockInterval);
    updateLastUpdatedClock();
    clockInterval = setInterval(updateLastUpdatedClock, 1000);
  }

  // ── Fetch all data ───────────────────────────────────────────────────

  function fetchAll() {
    // Site meta (timestamp)
    fetch(cacheBust(basePath + 'site.json'))
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (d) {
        var ts = d.update_timestamp || '';
        setText('live-updated', ts);
      })
      .catch(function () {});

    // Health data
    fetch(cacheBust(basePath + 'health.json'))
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (h) {
        var temp = h.temperature || {};
        var mem = h.memory || {};
        var disk = h.disk || {};
        var cpu = h.cpu || {};
        var up = h.uptime || {};

        var tempVal = temp.value_celsius || 0;
        var memPct = mem.used_percent || 0;
        var diskPct = disk.used_percent || 0;

        setText('stat-temp', temp.display || '\u2014');
        setText('stat-ram', mem.used_human || '\u2014');
        setText('stat-disk', disk.used_human || '\u2014');
        setText('stat-uptime', up.display || '\u2014');

        setText('cc-cpu', cpu.load_1m != null ? round1(cpu.load_1m) : '\u2014');
        setText('cc-temp', temp.display || '\u2014');
        setText('cc-mem', mem.used_human || '\u2014');

        var tempCls = tempVal > 80 ? 'badge-err' : tempVal > 70 ? 'badge-warn' : 'badge-ok';
        var memCls = memPct > 90 ? 'badge-err' : memPct > 80 ? 'badge-warn' : 'badge-ok';
        var diskCls = diskPct > 95 ? 'badge-err' : diskPct > 80 ? 'badge-warn' : 'badge-ok';

        setBadge('stat-temp-badge', round1(tempVal) + '\u00B0', tempCls);
        setMiniBar('stat-ram-bar', memPct, memCls);
        setMiniBar('stat-disk-bar', diskPct, diskCls);

        // Top processes card
        var procs = h.processes || {};
        var byCpu = procs.by_cpu || [];
        var byMem = procs.by_mem || [];
        var total = procs.total_processes || 0;

        if (byCpu.length > 0) {
          var topCpu = byCpu[0];
          setText('cc-top-cpu', topCpu.name + ' ' + round1(topCpu.cpu_percent) + '%');
        } else {
          setText('cc-top-cpu', '\u2014');
        }
        if (byMem.length > 0) {
          var topMem = byMem[0];
          setText('cc-top-mem', topMem.name + ' ' + round1(topMem.mem_percent) + '%');
        } else {
          setText('cc-top-mem', '\u2014');
        }
        setText('cc-proc-count', total);
      })
      .catch(function () {});

    // Token usage
    fetch(cacheBust(basePath + 'token-usage.json'))
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (tu) {
        var t = tu.today || {};
        var pct = t.used_percent || 0;
        var human = t.total_human || '\u2014';
        setText('stat-tokens', human);
        setText('cc-tokens', human);
        setText('cc-cap', tu.daily_cap_human || '250M');
        setText('cc-pct', round1(pct) + '%');

        var cls = pct > 90 ? 'badge-err' : pct > 80 ? 'badge-warn' : 'badge-ok';
        setBadge('stat-token-badge', Math.round(pct) + '%', cls);
      })
      .catch(function () {});

    // Network health
    fetch(cacheBust(basePath + 'network-health.json'))
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (nh) {
        var ok = nh.services_ok || 0;
        var total = nh.services_total || 0;
        var label = 'Not checked';
        if (total > 0) {
          if (ok === total) label = 'All OK';
          else if (ok > 0) label = ok + '/' + total;
          else label = 'Unreachable';
        }
        var cls = 'badge-ok';
        if (ok === 0 && total > 0) cls = 'badge-err';
        else if (ok > 0 && ok < total) cls = 'badge-warn';

        var statusEl = document.getElementById('cc-nh-status');
        if (statusEl) statusEl.innerHTML = '<span class="badge ' + cls + '">' + label + '</span>';

        // Average loss and latency across services
        var services = nh.services || [];
        var avgLoss = 0;
        var avgLat = 0;
        for (var i = 0; i < services.length; i++) {
          avgLoss += services[i].packet_loss || 0;
          avgLat += services[i].latency_ms || 0;
        }
        if (services.length > 0) {
          avgLoss = Math.round(avgLoss / services.length * 10) / 10;
          avgLat = Math.round(avgLat / services.length);
        }
        setText('cc-nh-loss', avgLoss + '%');
        setText('cc-nh-latency', avgLat + 'ms');
      })
      .catch(function () {});

    // Cron jobs
    fetch(cacheBust(basePath + 'cron-jobs.json'))
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (cj) {
        var count = cj.total || 0;
        var jobs = cj.jobs || [];
        var failing = 0;
        var failingName = '';
        for (var i = 0; i < jobs.length; i++) {
          if (jobs[i].consecutive_errors > 0) {
            failing++;
            if (!failingName) failingName = jobs[i].name;
          }
        }

        setText('stat-crons', count);
        setText('cc-active', count);
        setText('cc-failing', failing);

        // Stats bar failing badge
        var failBadge = document.getElementById('stat-cron-fail');
        if (failing > 0) {
          if (!failBadge) {
            var chip = document.getElementById('stat-crons').parentNode.parentNode;
            var existing = chip.querySelector('.chip-badge');
            if (existing) {
              var newBadge = document.createElement('span');
              newBadge.className = 'chip-badge';
              newBadge.innerHTML = '<span class="badge badge-err" id="stat-cron-fail">' + failing + ' failing</span>';
              chip.appendChild(newBadge);
            }
          } else {
            failBadge.textContent = failing + ' failing';
          }
        } else if (failBadge) {
          failBadge.parentNode.removeChild(failBadge);
        }

        // Compact card warn state
        var card = document.getElementById('cron-card');
        if (card) {
          if (failing > 0) {
            card.classList.add('card-warn');
          } else {
            card.classList.remove('card-warn');
          }
        }

        // Badge on compact card header
        var ccBadge = document.getElementById('cc-cron-fail');
        if (failing > 0) {
          if (!ccBadge) {
            var header = document.querySelector('#cron-card .compact-card-header');
            if (header) {
              var b = document.createElement('span');
              b.className = 'badge badge-err';
              b.id = 'cc-cron-fail';
              b.textContent = failing;
              header.appendChild(b);
            }
          } else {
            ccBadge.textContent = failing;
          }
        } else if (ccBadge) {
          ccBadge.parentNode.removeChild(ccBadge);
        }

        // Nav badge
        var navBadge = document.getElementById('nav-cron-badge');
        if (navBadge) {
          if (failing > 0) {
            navBadge.textContent = failing;
            navBadge.className = 'nav-badge nav-badge-warn';
          } else {
            navBadge.textContent = '';
            navBadge.className = 'nav-badge';
          }
        }
      })
      .catch(function () {});

    // Trigger pulse animation
    triggerRefreshPulse();

    // Update real-time clock reference
    lastUpdated = Date.now();
    startClock();
  }

  // ── Live Data Client (SSE + polling fallback) ─────────────────────

  function LiveDataClient() {
    this.basePath = basePath;
    this.sseUrl = null;
    this.eventSource = null;
    this.pollTimer = null;
    this.retryDelay = 1000;
    this.maxRetry = 30000;
    this.pollInterval = getRefreshInterval();
    this.usingSse = false;
    this._hidden = false;

    // Auto-detect SSE server — check common local IPs
    this._detectServer();
  }

  LiveDataClient.prototype._detectServer = function () {
    var self = this;
    var port = 8765;
    // Detect if we're on a local network or GitHub Pages
    var hostname = window.location.hostname;

    // If on local dev server or same host, try localhost first
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      self.sseUrl = 'http://localhost:' + port;
      self._connect();
      return;
    }

    // Try the page's origin (if served from the Jetson)
    var origin = window.location.origin;
    var testUrl = origin.replace(/:\d+$/, '') + ':' + port + '/health';
    fetch(testUrl, { mode: 'cors' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (d) {
        if (d.status === 'ok') {
          self.sseUrl = origin.replace(/:\d+$/, '') + ':' + port;
          self._connect();
        } else {
          self._fallback();
        }
      })
      .catch(function () {
        // Try common local IPs
        self._tryLocalIPs();
      });
  };

  LiveDataClient.prototype._tryLocalIPs = function () {
    // Try 10.x.x.x, 192.168.x.x, 172.16-31.x.x — we detect from gateway
    // Simplest: just try 192.168.1.x (most common)
    var self = this;
    var port = 8765;

    // Get the page's origin host parts to guess the gateway
    var hostParts = window.location.hostname.split('.');
    var gatewayBase = null;
    if (hostParts.length >= 2 && /^\d+$/.test(hostParts[0])) {
      // IP-based, try the same subnet
      var parts = hostParts.map(Number);
      if (parts.length === 4) {
        // Common gateways: .1, .2, .254
        var candidates = [];
        for (var last = 1; last <= 254; last++) {
          if (last === parts[3]) continue; // skip self
          candidates.push(parts[0] + '.' + parts[1] + '.' + parts[2] + '.' + last);
        }
        self._tryCandidates(candidates, port);
        return;
      }
    }

    // DNS hostname — try common local patterns
    var candidates = [
      'localhost',
      '192.168.1.1',
      '192.168.0.1',
      '10.0.0.1',
      '172.16.0.1',
    ];
    self._tryCandidates(candidates, port);
  };

  LiveDataClient.prototype._tryCandidates = function (ips, port) {
    var self = this;
    var idx = 0;

    function next() {
      if (idx >= ips.length) {
        self._fallback();
        return;
      }
      var ip = ips[idx++];
      var url = 'http://' + ip + ':' + port + '/health';
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, 2000);

      fetch(url, { mode: 'cors', signal: controller.signal })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function (d) {
          clearTimeout(timer);
          if (d.status === 'ok' && d.data_dir) {
            self.sseUrl = 'http://' + ip + ':' + port;
            self._connect();
          } else {
            next();
          }
        })
        .catch(function () {
          clearTimeout(timer);
          next();
        });
    }
    next();
  };

  LiveDataClient.prototype._connect = function () {
    var self = this;
    if (!this.sseUrl) {
      this._fallback();
      return;
    }

    this.usingSse = true;
    this.eventSource = new EventSource(this.sseUrl + '/events');

    this.eventSource.addEventListener('initial', function (e) {
      self._onData(JSON.parse(e.data));
    });

    this.eventSource.addEventListener('update', function (e) {
      self._onData(JSON.parse(e.data));
    });

    this.eventSource.addEventListener('heartbeat', function () {
      // Keepalive — no action needed
    });

    this.eventSource.onerror = function () {
      // Connection lost — try to reconnect with backoff
      self.usingSse = false;
      self.eventSource.close();
      self.retryDelay = Math.min(self.retryDelay * 2, self.maxRetry);
      setTimeout(function () {
        if (!self.usingSse) self._connect();
      }, self.retryDelay);
    };

    this.retryDelay = 1000; // Reset on successful connect
  };

  LiveDataClient.prototype._startPolling = function () {
    var self = this;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollInterval = getRefreshInterval();

    if (this.pollInterval <= 0) {
      // Polling is disabled — just show the mode indicator
      self._updatePollIndicator();
      return;
    }

    this.pollTimer = setInterval(function () {
      if (self._hidden) return; // Skip while tab is hidden
      fetchAll();
    }, this.pollInterval);

    self._updatePollIndicator();
  };

  LiveDataClient.prototype._updatePollIndicator = function () {
    var interval = getRefreshInterval();
    var indicator = document.getElementById('live-mode');
    var container = document.getElementById('live-updated');
    if (!container) return;

    if (interval <= 0) {
      if (indicator) indicator.textContent = '\u23F3 polling off';
      else {
        var el = document.createElement('small');
        el.style.display = 'block';
        el.style.fontSize = '0.75em';
        el.style.opacity = '0.6';
        el.id = 'live-mode';
        el.textContent = '\u23F3 polling off';
        container.parentNode.appendChild(el);
      }
      return;
    }

    var label = '15s';
    for (var i = 0; i < REFRESH_OPTIONS.length; i++) {
      if (REFRESH_OPTIONS[i].ms === interval) {
        label = REFRESH_OPTIONS[i].label;
        break;
      }
    }

    if (indicator) {
      indicator.textContent = '\u23F3 every ' + label;
    } else {
      var note = document.createElement('small');
      note.style.display = 'block';
      note.style.fontSize = '0.75em';
      note.style.opacity = '0.6';
      note.id = 'live-mode';
      note.textContent = '\u23F3 every ' + label;
      container.parentNode.appendChild(note);
    }
  };

  LiveDataClient.prototype._fallback = function () {
    var self = this;
    this.usingSse = false;
    // Poll according to config
    fetchAll(); // immediate first fetch
    this._startPolling();

    // Page Visibility API — pause when hidden, resume when visible
    function onVisibilityChange() {
      self._hidden = document.hidden || document.webkitHidden;
      if (!self._hidden && self.pollTimer) {
        // Tab became visible again — do an immediate refresh
        fetchAll();
      }
    }

    if (typeof document.addEventListener !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
      document.addEventListener('webkitvisibilitychange', onVisibilityChange);
    }
  };

  LiveDataClient.prototype._onData = function (msg) {
    var data = msg.data;
    if (!data) return;

    // Dispatch to individual fetchers based on available files
    var keys = Object.keys(data);
    if (keys.length === 0) return;

    // Run fetchAll-style updates from SSE data inline
    this._updateFromSSE(data);
  };

  LiveDataClient.prototype._updateFromSSE = function (dataMap) {
    // Parse and set site.json timestamp
    if (dataMap['site.json']) {
      try {
        var site = JSON.parse(dataMap['site.json']);
        var ts = site.update_timestamp || '';
        setText('live-updated', ts);
      } catch (e) {}
    }

    // Health data
    if (dataMap['health.json']) {
      try {
        var h = JSON.parse(dataMap['health.json']);
        var temp = h.temperature || {};
        var mem = h.memory || {};
        var disk = h.disk || {};
        var cpu = h.cpu || {};
        var up = h.uptime || {};

        var tempVal = temp.value_celsius || 0;
        var memPct = mem.used_percent || 0;
        var diskPct = disk.used_percent || 0;

        setText('stat-temp', temp.display || '\u2014');
        setText('stat-ram', mem.used_human || '\u2014');
        setText('stat-disk', disk.used_human || '\u2014');
        setText('stat-uptime', up.display || '\u2014');

        setText('cc-cpu', cpu.load_1m != null ? round1(cpu.load_1m) : '\u2014');
        setText('cc-temp', temp.display || '\u2014');
        setText('cc-mem', mem.used_human || '\u2014');

        var tempCls = tempVal > 80 ? 'badge-err' : tempVal > 70 ? 'badge-warn' : 'badge-ok';
        var memCls = memPct > 90 ? 'badge-err' : memPct > 80 ? 'badge-warn' : 'badge-ok';
        var diskCls = diskPct > 95 ? 'badge-err' : diskPct > 80 ? 'badge-warn' : 'badge-ok';

        setBadge('stat-temp-badge', round1(tempVal) + '\u00B0', tempCls);
        setMiniBar('stat-ram-bar', memPct, memCls);
        setMiniBar('stat-disk-bar', diskPct, diskCls);

        // Top processes
        var procs = h.processes || {};
        var byCpu = procs.by_cpu || [];
        var byMem = procs.by_mem || [];
        var total = procs.total_processes || 0;
        if (byCpu.length > 0) {
          setText('cc-top-cpu', byCpu[0].name + ' ' + round1(byCpu[0].cpu_percent) + '%');
        } else {
          setText('cc-top-cpu', '\u2014');
        }
        if (byMem.length > 0) {
          setText('cc-top-mem', byMem[0].name + ' ' + round1(byMem[0].mem_percent) + '%');
        } else {
          setText('cc-top-mem', '\u2014');
        }
        setText('cc-proc-count', total);

        // Network health
        var nh = h.network_health || h.network || {};
        if (nh.services_ok != null) {
          var ok = nh.services_ok || 0;
          var nTotal = nh.services_total || 0;
          var label = 'Not checked';
          if (nTotal > 0) {
            if (ok === nTotal) label = 'All OK';
            else if (ok > 0) label = ok + '/' + nTotal;
            else label = 'Unreachable';
          }
          var cls = 'badge-ok';
          if (ok === 0 && nTotal > 0) cls = 'badge-err';
          else if (ok > 0 && ok < nTotal) cls = 'badge-warn';

          var nhEl = document.getElementById('cc-nh-status');
          if (nhEl) nhEl.innerHTML = '<span class="badge ' + cls + '">' + label + '</span>';
        }
      } catch (e) {}
    }

    // Token usage
    if (dataMap['token-usage.json']) {
      try {
        var tu = JSON.parse(dataMap['token-usage.json']);
        var t = tu.today || {};
        var pct = t.used_percent || 0;
        var human = t.total_human || '\u2014';
        setText('stat-tokens', human);
        setText('cc-tokens', human);
        setText('cc-cap', tu.daily_cap_human || '250M');
        setText('cc-pct', round1(pct) + '%');

        var cls = pct > 90 ? 'badge-err' : pct > 80 ? 'badge-warn' : 'badge-ok';
        setBadge('stat-token-badge', Math.round(pct) + '%', cls);
      } catch (e) {}
    }

    // Cron jobs
    if (dataMap['cron-jobs.json']) {
      try {
        var cj = JSON.parse(dataMap['cron-jobs.json']);
        var count = cj.total || 0;
        var jobs = cj.jobs || [];
        var failing = 0;
        var failingName = '';
        for (var i = 0; i < jobs.length; i++) {
          if (jobs[i].consecutive_errors > 0) {
            failing++;
            if (!failingName) failingName = jobs[i].name;
          }
        }
        setText('stat-crons', count);
        setText('cc-active', count);
        setText('cc-failing', failing);

        var failBadge = document.getElementById('stat-cron-fail');
        if (failing > 0) {
          if (!failBadge) {
            var chip = document.getElementById('stat-crons').parentNode.parentNode;
            var existing = chip.querySelector('.chip-badge');
            if (existing) {
              var newBadge2 = document.createElement('span');
              newBadge2.className = 'chip-badge';
              newBadge2.innerHTML = '<span class="badge badge-err" id="stat-cron-fail">' + failing + ' failing</span>';
              chip.appendChild(newBadge2);
            }
          } else {
            failBadge.textContent = failing + ' failing';
          }
        } else if (failBadge) {
          failBadge.parentNode.removeChild(failBadge);
        }

        var card = document.getElementById('cron-card');
        if (card) {
          if (failing > 0) card.classList.add('card-warn');
          else card.classList.remove('card-warn');
        }

        var ccBadge = document.getElementById('cc-cron-fail');
        if (failing > 0) {
          if (!ccBadge) {
            var header = document.querySelector('#cron-card .compact-card-header');
            if (header) {
              var b = document.createElement('span');
              b.className = 'badge badge-err';
              b.id = 'cc-cron-fail';
              b.textContent = failing;
              header.appendChild(b);
            }
          } else {
            ccBadge.textContent = failing;
          }
        } else if (ccBadge) {
          ccBadge.parentNode.removeChild(ccBadge);
        }

        var navBadge = document.getElementById('nav-cron-badge');
        if (navBadge) {
          if (failing > 0) {
            navBadge.textContent = failing;
            navBadge.className = 'nav-badge nav-badge-warn';
          } else {
            navBadge.textContent = '';
            navBadge.className = 'nav-badge';
          }
        }
      } catch (e) {}
    }

    // Trigger pulse and clock on SSE data arrival too
    triggerRefreshPulse();
    lastUpdated = Date.now();
    startClock();
  };

  // ── Refresh interval config sync ─────────────────────────────────

  function applyRefreshInterval(ms) {
    setRefreshInterval(ms);
    if (liveClient) {
      liveClient.pollInterval = getRefreshInterval();
      if (liveClient.pollTimer) clearInterval(liveClient.pollTimer);
      liveClient._startPolling();
    }
    // Update the dropdown UI
    var dropdown = document.getElementById('refresh-interval-select');
    if (dropdown) {
      dropdown.value = String(ms);
    }
    // Fire a custom event so other components can react
    var evt = new CustomEvent('clawbox:refresh-interval-change', { detail: { ms: ms } });
    document.dispatchEvent(evt);
  }

  // Expose globally for the footer dropdown
  window.clawbox = window.clawbox || {};
  window.clawbox.refreshOptions = REFRESH_OPTIONS;
  window.clawbox.getRefreshInterval = getRefreshInterval;
  window.clawbox.applyRefreshInterval = applyRefreshInterval;

  // ── Init ──────────────────────────────────────────────────────────

  var liveClient = null;

  function init() {
    fetchAll(); // Initial fetch from GitHub Pages
    liveClient = new LiveDataClient();

    // Sync initial interval value into any dropdown that already exists
    var dropdown = document.getElementById('refresh-interval-select');
    if (dropdown) {
      dropdown.value = String(getRefreshInterval());
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
