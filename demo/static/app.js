(function () {
  'use strict';
  var charts = [];
  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function money(v) { return '$' + Math.round(v).toLocaleString('en-US'); }

  // Every HTMX request carries the session's CSRF token (the server checks it on anything that is not a read).
  document.addEventListener('htmx:configRequest', function (e) {
    var m = document.querySelector('meta[name="csrf-token"]');
    if (m && m.content) e.detail.headers['X-CSRF-Token'] = m.content;
  });

  // Phone bottom bar: the More sheet closes on a tap outside it or on Escape.
  document.addEventListener('click', function (e) {
    var open = document.querySelector('.bmore[open]');
    if (open && !open.contains(e.target)) open.removeAttribute('open');
  });
  document.addEventListener('keydown', function (e) {
    var open = document.querySelector('.bmore[open]');
    if (open && e.key === 'Escape') { open.removeAttribute('open'); open.querySelector('summary').focus(); }
  });

  // Light / dark: change the page now, remember it for this person on the server.
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-theme-toggle]');
    if (!b) return;
    var mode = b.dataset.mode === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = mode;
    document.querySelectorAll('[data-theme-toggle]').forEach(function (t) {
      t.dataset.mode = mode;
      t.textContent = mode === 'dark' ? 'Light mode' : 'Dark mode';
    });
    var m = document.querySelector('meta[name="csrf-token"]');
    fetch('/theme', {method: 'POST', credentials: 'same-origin',
      headers: {'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': m ? m.content : ''},
      body: 'mode=' + mode});
    render();
  });

  function render() {
    charts.forEach(function (c) { c.dispose(); }); charts = [];
    var el = document.getElementById('chart-data');
    if (!el || !window.echarts) return;
    var d = JSON.parse(el.textContent), ink = css('--text'), mute = css('--text-2'), line = css('--line');
    var c1 = css('--accent'), c2 = css('--chart-2'), c3 = css('--chart-3');
    var base = {textStyle: {color: ink}, grid: {left: 8, right: 12, top: 30, bottom: 8, containLabel: true},
      tooltip: {trigger: 'axis', valueFormatter: money, backgroundColor: css('--surface'), borderColor: line, textStyle: {color: ink}},
      legend: {top: 0, textStyle: {color: mute}}};
    var cat = function (data) {
      return {type: 'category', data: data, axisLine: {lineStyle: {color: line}}, axisLabel: {color: mute, hideOverlap: true}};
    };
    var val = function () {
      return {type: 'value', axisLabel: {color: mute, formatter: money}, splitLine: {lineStyle: {color: line}}};
    };
    var spec = {
      flow: Object.assign({}, base, {
        xAxis: cat(d.months), yAxis: val(), color: [c1, c2, c3],
        series: [{name: 'Income', type: 'bar', data: d.income, barMaxWidth: 22},
                 {name: 'Spent', type: 'bar', data: d.expenses, barMaxWidth: 22},
                 {name: 'Left', type: 'line', data: d.left, smooth: true, symbol: 'none', lineStyle: {width: 2}}]}),
      cats: Object.assign({}, base, {
        xAxis: val(), yAxis: cat(d.cat_names), color: [c3, c1],
        series: [{name: 'Before', type: 'bar', data: d.cat_before, barMaxWidth: 12},
                 {name: 'Now', type: 'bar', data: d.cat_now, barMaxWidth: 12}]}),
      yoy: Object.assign({}, base, {
        xAxis: cat(d.months), yAxis: val(), color: [c1, c3],
        series: [{name: 'This year', type: 'line', data: d.expenses, smooth: true, symbol: 'none', lineStyle: {width: 3}},
                 {name: 'Year before', type: 'line', data: d.last_year, smooth: true, symbol: 'none',
                  lineStyle: {width: 2, type: 'dashed'}}]})
    };
    document.querySelectorAll('[data-chart]').forEach(function (n) {
      var c = echarts.init(n, null, {renderer: 'svg'}); c.setOption(spec[n.dataset.chart]); charts.push(c);
    });
  }
  window.addEventListener('load', render);
  document.addEventListener('htmx:afterSettle', render);
  window.addEventListener('resize', function () { charts.forEach(function (c) { c.resize(); }); });

  // Inbox: each chosen file is sent as its own request (raw bytes, name in a header); the server checks every one.
  function meta() { var m = document.querySelector('meta[name="csrf-token"]'); return m ? m.content : ''; }
  document.addEventListener('change', function (e) {
    var input = e.target.closest('#inbox-files');
    if (!input || !input.files.length) return;
    var list = document.getElementById('upload-result'), files = Array.prototype.slice.call(input.files), left = files.length;
    function line(text, bad) {
      var li = document.createElement('li'); li.textContent = text; if (bad) li.className = 'bad'; list.appendChild(li);
    }
    function finish() {
      if (--left > 0) return;
      input.value = '';
      var on = document.querySelector('#inbox .seg button.on'), v = on ? on.textContent.trim().toLowerCase() : 'all';
      if (window.htmx) htmx.ajax('GET', '/inbox/body?view=' + encodeURIComponent(v), {target: '#inbox', swap: 'innerHTML'});
    }
    list.textContent = '';
    files.forEach(function (f) {
      fetch('/inbox/upload', {method: 'POST', credentials: 'same-origin', body: f,
        headers: {'X-CSRF-Token': meta(), 'X-Filename': encodeURIComponent(f.name), 'Content-Type': 'application/octet-stream'}})
        .then(function (r) { return r.json().catch(function () { return {ok: false, message: 'Not saved (' + r.status + ').'}; }); })
        .then(function (j) { line(f.name + ': ' + j.message, !j.ok); })
        .catch(function () { line(f.name + ': could not be sent.', true); })
        .then(finish);
    });
  });

  // A single file sent as the raw body (the Google client file, a timesheet, a work calendar); reload on success.
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-upload]');
    if (!b) return;
    var input = document.querySelector(b.dataset.upload), said = document.querySelector(b.dataset.upload + '-said');
    if (!input || !input.files.length) { if (said) said.textContent = 'Choose the file first.'; return; }
    var to = b.dataset.uploadTo, extra = b.dataset.uploadExtra && document.querySelector(b.dataset.uploadExtra);
    if (extra) to += '&calendar=' + encodeURIComponent(extra.value || '');
    var head = {'X-CSRF-Token': meta(), 'Content-Type': 'application/octet-stream'};
    if (b.dataset.uploadName) head['X-Filename'] = encodeURIComponent(input.files[0].name);
    b.disabled = true;
    fetch(to, {method: 'POST', credentials: 'same-origin', body: input.files[0], headers: head})
      .then(function (r) { return r.json().catch(function () { return {ok: false, message: 'Not saved (' + r.status + ').'}; }); })
      .then(function (j) { if (j.ok) { window.location.reload(); } else { if (said) said.textContent = j.message; b.disabled = false; } })
      .catch(function () { if (said) said.textContent = 'Could not be sent.'; b.disabled = false; });
  });

  // Restore: this web app closes for about a minute; when it answers again, go back to Settings > Data.
  function waitBack(el) {
    if (!el || el.dataset.waiting) return;
    el.dataset.waiting = '1';
    var tick = function () {
      fetch('/healthz', {cache: 'no-store'}).then(function (r) {
        if (r.ok) { window.location.replace(el.dataset.waitBack); } else { setTimeout(tick, 3000); }
      }).catch(function () { setTimeout(tick, 3000); });
    };
    setTimeout(tick, 8000);
  }
  document.addEventListener('htmx:afterSettle', function () { waitBack(document.querySelector('[data-wait-back]')); });
  window.addEventListener('load', function () { waitBack(document.querySelector('[data-wait-back]')); });

  // Chat: after each answer, show the newest line and give the box back for the next question.
  function chatSettled() {
    var log = document.getElementById('chatlog');
    if (!log) return;
    var last = log.lastElementChild;
    if (last && last.scrollIntoView) last.scrollIntoView({block: 'nearest'});
    var box = document.querySelector('#chat .composer input');
    if (box && document.activeElement !== box && window.matchMedia('(pointer: fine)').matches) box.focus();
  }
  document.addEventListener('htmx:afterSettle', function (e) { if (e.target && e.target.id === 'chat') chatSettled(); });
  window.addEventListener('load', chatSettled);

  // Notes: clear the Add form only when the server says the item was saved (a refused one keeps what was typed).
  document.addEventListener('htmx:afterRequest', function (e) {
    var f = e.detail.elt;
    if (f && f.matches && f.matches('form[data-reset-on-save]') && e.detail.xhr && e.detail.xhr.getResponseHeader('X-Saved') === '1') f.reset();
  });

  // Tables with five or more columns become one card per row on a phone (CSS does the layout; the label of each
  // cell is its column heading).
  function cardTables(root) {
    (root || document).querySelectorAll('.tablewrap > table').forEach(function (t) {
      var heads = t.querySelectorAll('thead th');
      if (heads.length < 5 || t.classList.contains('cards')) return;
      var names = Array.prototype.map.call(heads, function (h) { return h.textContent.trim(); });
      t.querySelectorAll('tbody tr').forEach(function (tr) {
        Array.prototype.forEach.call(tr.children, function (td, i) { if (names[i]) td.setAttribute('data-label', names[i]); });
      });
      t.classList.add('cards');
    });
  }
  document.addEventListener('DOMContentLoaded', function () { cardTables(); });
  document.addEventListener('htmx:afterSettle', function (e) { cardTables(e.target); });

  // Installable app: the service worker only keeps the app's own files (never a signed-in page).
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('/sw.js', {scope: '/'}).catch(function () {});
  }
})();
