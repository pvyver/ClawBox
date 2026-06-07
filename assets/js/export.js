/**
 * ClawBox Export Module — PNG snapshot, PDF report, CSV/JSON data download
 *
 * Lazy-loads html2canvas + html2pdf.js on first use.
 * Provides export buttons in the nav bar.
 */
(function () {
  'use strict';

  var SCRIPT_BASE = 'https://cdnjs.cloudflare.com/ajax/libs';
  var BASE_PATH = window.location.pathname.includes('/ClawBox/')
    ? '/ClawBox/assets/data/'
    : '/assets/data/';

  // ── Lazy loader ──────────────────────────────────────────────────────

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  var html2canvasReady = false;
  function ensureHtml2canvas() {
    if (html2canvasReady) return Promise.resolve();
    return loadScript(SCRIPT_BASE + '/html2canvas/1.4.1/html2canvas.min.js')
      .then(function () { html2canvasReady = true; });
  }

  var html2pdfReady = false;
  function ensureHtml2pdf() {
    if (html2pdfReady) return Promise.resolve();
    // html2pdf depends on html2canvas + jspdf
    return loadScript(SCRIPT_BASE + '/html2pdf.js/0.10.1/html2pdf.bundle.min.js')
      .then(function () { html2pdfReady = true; });
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  function nowStamp() {
    return new Date().toISOString().split('T')[0];
  }

  function nowLabel() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  function downloadDataUrl(dataUrl, filename) {
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
    }, 200);
  }

  // ── PNG Export ───────────────────────────────────────────────────────

  function exportPNG() {
    var el = document.querySelector('.container') || document.querySelector('main') || document.body;
    var originalFilter = el.style.filter;

    var theme = document.documentElement.getAttribute('data-theme') || 'dark';

    ensureHtml2canvas()
      .then(function () {
        // Force stable layout: add a watermark-style timestamp
        var ts = document.createElement('div');
        ts.id = 'export-ts';
        ts.style.cssText = 'position:fixed;bottom:16px;right:16px;font-size:12px;color:#999;z-index:9999;font-family:monospace;';
        ts.textContent = 'ClawBox Dashboard ' + nowStamp();
        document.body.appendChild(ts);

        var opts = {
          scale: 2,
          useCORS: true,
          backgroundColor: getComputedStyle(document.documentElement)
            .getPropertyValue('--bg-primary').trim() || '#1a1a2e',
          logging: false,
        };

        return html2canvas(document.documentElement, opts);
      })
      .then(function (canvas) {
        var tsEl = document.getElementById('export-ts');
        if (tsEl) tsEl.remove();

        var link = canvas.toDataURL('image/png');
        downloadDataUrl(link, 'clawbox-dashboard-' + nowStamp() + '.png');
      })
      .catch(function (err) {
        console.error('PNG export error:', err);
        alert('PNG export failed. Check console for details.');
        var tsEl = document.getElementById('export-ts');
        if (tsEl) tsEl.remove();
      });
  }

  // ── PDF Export ───────────────────────────────────────────────────────

  function exportPDF() {
    var el = document.querySelector('.container') || document.querySelector('main') || document.body;

    ensureHtml2pdf()
      .then(function () {
        var opt = {
          margin:       10,
          filename:     'clawbox-dashboard-' + nowStamp() + '.pdf',
          image:        { type: 'jpeg', quality: 0.95 },
          html2canvas:  { scale: 2, useCORS: true, logging: false },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
        };
        return html2pdf().set(opt).from(el).save();
      })
      .catch(function (err) {
        console.error('PDF export error:', err);
        alert('PDF export failed. Check console for details.');
      });
  }

  // ── CSV / JSON Data Export ───────────────────────────────────────────

  function jsonToCSV(data) {
    if (!data || typeof data !== 'object') return '';
    var rows = Array.isArray(data) ? data : [data];
    if (rows.length === 0) return '';

    var headers = Object.keys(rows[0]);
    var csv = headers.join(',') + '\n';

    rows.forEach(function (row) {
      var vals = headers.map(function (h) {
        var v = row[h];
        if (v === null || v === undefined) return '';
        var s = String(v);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          s = '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      });
      csv += vals.join(',') + '\n';
    });

    return csv;
  }

  function exportDataJSON() {
    var dataSources = [
      { name: 'health', url: BASE_PATH + 'health.json' },
      { name: 'token-usage', url: BASE_PATH + 'token-usage.json' },
      { name: 'cron-jobs', url: BASE_PATH + 'cron-jobs.json' },
    ];

    // Fetch and offer as one zip-like batch of downloads
    dataSources.forEach(function (ds) {
      fetch(ds.url)
        .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function (data) {
          var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          downloadBlob(blob, ds.name + '-' + nowStamp() + '.json');
        })
        .catch(function () {
          console.warn('Could not fetch ' + ds.name);
        });
    });
  }

  function exportDataCSV() {
    var dataSources = [
      { name: 'cron-jobs', url: BASE_PATH + 'cron-jobs.json', key: 'jobs' },
      { name: 'site', url: BASE_PATH + 'site.json', key: null },
      { name: 'health', url: BASE_PATH + 'health.json', key: null },
    ];

    dataSources.forEach(function (ds) {
      fetch(ds.url)
        .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function (data) {
          var source = ds.key ? (data[ds.key] || []) : data;
          // If it's an object, try to flatten top-level keys into a single-row CSV
          var rows = Array.isArray(source) ? source : [source];
          var csv = jsonToCSV(rows);
          var blob = new Blob([csv], { type: 'text/csv' });
          downloadBlob(blob, ds.name + '-' + nowStamp() + '.csv');
        })
        .catch(function () {
          console.warn('Could not fetch ' + ds.name);
        });
    });
  }

  // ── Button click handler ─────────────────────────────────────────────

  function handleExportClick(action) {
    switch (action) {
      case 'png':   exportPNG();   break;
      case 'pdf':   exportPDF();   break;
      case 'json':  exportDataJSON(); break;
      case 'csv':   exportDataCSV();  break;
    }
  }

  // ── Export dropdown ──────────────────────────────────────────────────

  function initExportUI() {
    var container = document.getElementById('export-menu');
    if (!container) return;

    var buttons = container.querySelectorAll('[data-export]');
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var action = btn.getAttribute('data-export');
        handleExportClick(action);
      });
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExportUI);
  } else {
    initExportUI();
  }

  // Expose for debugging
  window.ClawBoxExport = { exportPNG: exportPNG, exportPDF: exportPDF, exportDataJSON: exportDataJSON, exportDataCSV: exportDataCSV };

})();
