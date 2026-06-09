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

  // ── Cache-busting ────────────────────────────────────────────────────
  function bust(url) {
    return url + '?t=' + Date.now();
  }

  // ── Poll control ─────────────────────────────────────────────────────
  var pollIntervals = [10, 15, 30, 60, 300, 0];  // seconds; 0 = off
  var pollInterval = 10; // default: 10s
  var pollTimer = null;
  var tabVisible = true;

  // Persist preference
  try {
    var saved = localStorage.getItem('clawbox_poll_interval');
    if (saved) {
      var n = parseInt(saved, 10);
      if (pollIntervals.indexOf(n) >= 0) pollInterval = n;
    }
  } catch (e) {}

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    if (pollInterval === 0) return;
    pollTimer = setInterval(function () {
      if (tabVisible) fetchAll();
    }, pollInterval * 1000);
  }

  function setPollInterval(secs) {
    pollInterval = secs;
    try { localStorage.setItem('clawbox_poll_interval', secs); } catch (e) {}
    startPolling();
    updatePollUI();
  }

  // Page Visibility API — pause when tab is hidden
  document.addEventListener('visibilitychange', function () {
    tabVisible = !document.hidden;
  });

  // ── Pulse animation ────────────────────────────────────────────────
  function pulseStatsBar() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var bar = document.getElementById('stats-bar');
    if (bar) {
      bar.classList.remove('pulse');
      // Force reflow to restart animation
      void bar.offsetWidth;
      bar.classList.add('pulse');
    }
  }

  // ── Live timestamp ticker ──────────────────────────────────────────
  function startTimestampTicker() {
    setInterval(function () {
      var el = document.getElementById('live-updated');
      if (!el) return;
      var now = new Date();
      var h = String(now.getHours()).padStart(2, '0');
      var m = String(now.getMinutes()).padStart(2, '0');
      el.textContent = 'live ' + h + ':' + m;
    }, 10000);
  }

  // ── Poll settings UI ───────────────────────────────────────────────
  function updatePollUI() {
    var btn = document.getElementById('poll-toggle');
    if (!btn) return;
    if (pollInterval === 0) {
      btn.textContent = 'Auto-refresh: \u274C off';
      btn.className = 'poll-toggle poll-off';
    } else {
      btn.textContent = 'Auto-refresh: ' + pollInterval + 's';
      btn.className = 'poll-toggle poll-on';
    }
  }

  function buildPollUI() {
    var ts = document.getElementById('live-updated');
    if (!ts || document.getElementById('poll-toggle')) return;

    var wrapper = document.createElement('div');
    wrapper.className = 'poll-control';

    var btn = document.createElement('button');
    btn.id = 'poll-toggle';
    btn.className = 'poll-toggle poll-on';
    btn.setAttribute('aria-label', 'Toggle auto-refresh interval');
    wrapper.appendChild(btn);
    ts.parentNode.appendChild(wrapper);

    // Cycle through intervals on click
    btn.addEventListener('click', function () {
      var idx = pollIntervals.indexOf(pollInterval);
      var next = (idx + 1) % pollIntervals.length;
      setPollInterval(pollIntervals[next]);
    });

    updatePollUI();
  }

  // ── Fetch all data (with cache busting) ──────────────────────────────

  function fetchAll() {
    // Site meta (timestamp)
    fetch(bust(basePath + 'site.json'))
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (d) {
        var ts = d.update_timestamp || '';
        setText('live-updated', ts);
      })
      .catch(function () {});

    // Health data
    fetch(bust(basePath + 'health.json'))
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

    // Active sessions (from health.json sessions key)
    fetch(bust(basePath + 'health.json'))
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (h) {
        var ss = h.sessions || {};
        var active = ss.active_count || 0;
        var total = ss.total_visible || 0;
        setText('cc-sess-active', active);
        setText('cc-sess-total', total);

        // Show the model of the first active session
        var sessions = ss.sessions || [];
        var modelLabel = '\u2014';
        for (var i = 0; i < sessions.length; i++) {
          if (sessions[i].status === 'running') {
            var m = sessions[i].model || '';
            modelLabel = m.replace('deepseek/', 'DS ').replace('ollama/', '');
            if (modelLabel.length > 15) modelLabel = modelLabel.substr(0, 15) + '\u2026';
            break;
          }
        }
        setText('cc-sess-model', modelLabel);
      })
      .catch(function () {});

    // Token usage
    fetch(bust(basePath + 'token-usage.json'))
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
    fetch(basePath + 'network-health.json')
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

    // Network traffic (from health.json network key)
    fetch(basePath + 'health.json')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (h) {
        var net = h.network || {};
        setText('cc-nt-in', net.total_in_human || '\u2014');
        setText('cc-nt-out', net.total_out_human || '\u2014');
        setText('cc-nt-conns', net.active_connections || '\u2014');
      })
      .catch(function () {});

    // Cron jobs
    fetch(basePath + 'cron-jobs.json')
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
  }

  // ── Live Data Client (SSE + polling fallback) ─────────────────────

  function LiveDataClient() {
    this.basePath = basePath;
    this.sseUrl = null;
    this.eventSource = null;
    this.pollTimer = null;
    this.retryDelay = 1000;
    this.maxRetry = 30000;
    this.pollInterval = 10000;
    this.usingSse = false;

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

  LiveDataClient.prototype._fallback = function () {
    var self = this;
    this.usingSse = false;
    // Poll every pollInterval
    fetchAll(); // immediate first fetch
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(function () {
      fetchAll();
    }, this.pollInterval);

    // Show indicator that we're polling
    var ts = document.getElementById('live-updated');
    if (ts) {
      var note = document.createElement('small');
      note.style.display = 'block';
      note.style.fontSize = '0.75em';
      note.style.opacity = '0.6';
      note.id = 'live-mode';
      if (!document.getElementById('live-mode')) {
        ts.parentNode.appendChild(note);
      }
      note.textContent = '\u23F3 polling every ' + (self.pollInterval / 1000) + 's';
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
  };

  // ── Init ──────────────────────────────────────────────────────────

  var liveClient = null;

  function init() {
    fetchAll(); // Initial fetch from GitHub Pages
    liveClient = new LiveDataClient();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
