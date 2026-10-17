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

  // Rail groups fold: the choice is remembered in this browser (the group holding the open page always shows open).
  (function () {
    var k = 'rail-groups', saved = {};
    try { saved = JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { saved = {}; }
    document.querySelectorAll('.rail details.rg').forEach(function (d) {
      var n = d.dataset.rg;
      if (saved[n] === true) d.open = true;
      d.addEventListener('toggle', function () {
        saved[n] = d.open;
        try { localStorage.setItem(k, JSON.stringify(saved)); } catch (e) { /* private window */ }
      });
    });
  })();

  // Light / dark: change the page now, remember it for this person on the server.
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-theme-toggle]');
    if (!b) return;
    var mode = b.dataset.mode === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = mode;
    document.querySelectorAll('[data-theme-toggle]').forEach(function (t) {
      t.dataset.mode = mode;
      var label = mode === 'dark' ? 'Light mode' : 'Dark mode';
      if (t.classList.contains('ibtn')) { t.title = label; t.setAttribute('aria-label', label); } else t.textContent = label;
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

  // Setup > Where: the currency follows the country until the person picks one themselves.
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches && t.matches('select[data-currency]')) { t.dataset.picked = '1'; return; }
    if (!(t.matches && t.matches('select[data-currency-map]'))) return;
    var cur = t.form && t.form.querySelector('select[data-currency]');
    if (!cur || cur.dataset.picked) return;
    var map = {}; try { map = JSON.parse(t.getAttribute('data-currency-map')); } catch (err) { return; }
    var code = map[t.value];
    if (code && cur.querySelector('option[value="' + code + '"]')) cur.value = code;
  });

  // Inbox: each file is sent as its own request (raw bytes, name in a header), one at a time with a progress bar; the
  // server checks every one. Files come from the picker, a drop anywhere on the Inbox page, or a paste. When the batch
  // is in, the cards reload and, when this household's AI (or the no-AI readers) can file now, filing starts and the
  // progress panel (#iprog, polled by htmx) shows each file's step.
  function meta() { var m = document.querySelector('meta[name="csrf-token"]'); return m ? m.content : ''; }
  function inboxView() { var on = document.querySelector('#inbox .icat.on'); return on ? (on.getAttribute('hx-get') || '').split('view=')[1] || 'all' : 'all'; }
  function inboxReload() {
    if (window.htmx && document.getElementById('inbox')) htmx.ajax('GET', '/inbox/body?view=' + encodeURIComponent(inboxView()), {target: '#inbox', swap: 'innerHTML'});
  }
  function kb(n) { return n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }
  function uploadFiles(files) {
    var list = document.getElementById('upload-result'), zone = document.getElementById('upload');
    if (!list || !files.length) return;
    list.textContent = '';
    var rows = files.map(function (f) {
      var li = document.createElement('li'); li.className = 'pfile t-wait';
      var top = document.createElement('div'); top.className = 'pf-top';
      var nm = document.createElement('span'); nm.className = 'pf-name'; nm.textContent = f.name;
      var st = document.createElement('span'); st.className = 'chip-s'; st.textContent = 'In line';
      var bar = document.createElement('progress'); bar.max = 100; bar.value = 0; bar.setAttribute('aria-label', f.name);
      var ln = document.createElement('p'); ln.className = 'muted pf-line'; ln.textContent = kb(f.size);
      top.appendChild(nm); top.appendChild(st);
      var main = document.createElement('div'); main.className = 'pf-main'; main.appendChild(top); main.appendChild(bar); main.appendChild(ln);
      li.appendChild(main); list.appendChild(li);
      return {li: li, st: st, bar: bar, ln: ln};
    });
    var saved = 0;
    function one(i) {
      if (i >= files.length) {
        if (saved && zone && zone.dataset.autofile && window.htmx) {
          htmx.ajax('POST', '/inbox/filenow', {target: '#inbox', swap: 'innerHTML', values: {view: inboxView()}});
        } else { inboxReload(); }
        setTimeout(function () { list.querySelectorAll('.t-ok').forEach(function (li) { li.remove(); }); }, 6000);
        return;
      }
      var f = files[i], r = rows[i], x = new XMLHttpRequest();
      r.li.className = 'pfile t-work'; r.st.textContent = 'Sending';
      x.open('POST', '/inbox/upload');
      x.setRequestHeader('X-CSRF-Token', meta());
      x.setRequestHeader('X-Filename', encodeURIComponent(f.name));
      x.setRequestHeader('Content-Type', 'application/octet-stream');
      x.upload.onprogress = function (e) { if (e.lengthComputable) r.bar.value = Math.round(e.loaded * 100 / e.total); };
      function end(ok, msg) {
        r.bar.value = 100; r.li.className = 'pfile ' + (ok ? 't-ok' : 't-bad');
        r.st.textContent = ok ? 'Received' : 'Not added'; r.ln.textContent = msg;
        if (ok) saved++;
        one(i + 1);
      }
      x.onload = function () {
        var j; try { j = JSON.parse(x.responseText); } catch (err) { j = {ok: false, message: 'Not saved (' + x.status + ').'}; }
        end(!!j.ok, j.message || '');
      };
      x.onerror = function () { end(false, 'Could not be sent.'); };
      x.send(f);
    }
    one(0);
  }
  document.addEventListener('change', function (e) {
    var input = e.target.closest('#inbox-files');
    if (!input || !input.files.length) return;
    var files = Array.prototype.slice.call(input.files);
    input.value = '';
    uploadFiles(files);
  });
  (function () {
    var depth = 0;
    function onInbox() { return !!document.getElementById('upload'); }
    function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; }
    document.addEventListener('dragenter', function (e) { if (!onInbox() || !hasFiles(e)) return; depth++; document.body.classList.add('dragging'); });
    document.addEventListener('dragleave', function () { if (!onInbox()) return; depth = Math.max(0, depth - 1); if (!depth) document.body.classList.remove('dragging'); });
    document.addEventListener('dragover', function (e) { if (onInbox() && hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    document.addEventListener('drop', function (e) {
      if (!onInbox() || !hasFiles(e)) return;
      e.preventDefault(); depth = 0; document.body.classList.remove('dragging');
      uploadFiles(Array.prototype.slice.call(e.dataTransfer.files));
    });
    document.addEventListener('paste', function (e) {
      if (!onInbox() || !e.clipboardData || e.target.closest('input,textarea,[contenteditable]')) return;
      var files = Array.prototype.slice.call(e.clipboardData.files || []);
      if (!files.length) return;
      e.preventDefault();
      uploadFiles(files.map(function (f, i) {
        if (f.name && f.name !== 'image.png') return f;
        var ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
        return new File([f], 'pasted_' + new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '') + (i ? '_' + i : '') + '.' + ext, {type: f.type});
      }));
    });
    document.addEventListener('inbox-done', function () { if (document.getElementById('inbox')) setTimeout(inboxReload, 50); });
  })();

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

  // Story cards (Today, This month): one slide at a time; tap the right side / swipe left = next, left side / swipe right = back,
  // arrow keys when it has focus. Without this script every slide shows, one under another.
  function story(root) {
    (root || document).querySelectorAll('[data-story]').forEach(function (box) {
      if (box.dataset.ready) return;
      box.dataset.ready = '1';
      box.classList.add('js');
      var slides = box.querySelectorAll('.slide'), at = 0, x0 = null, y0 = 0;
      var strip = document.createElement('div');
      strip.className = 'sbars';
      strip.setAttribute('aria-hidden', 'true');
      slides.forEach(function () { strip.appendChild(document.createElement('i')); });
      if (slides.length > 1) box.insertBefore(strip, box.firstChild);
      if (slides.length < 2) box.classList.add('one');
      var bars = strip.querySelectorAll('i');
      function show(i, back) {
        at = Math.max(0, Math.min(slides.length - 1, i));
        slides.forEach(function (s, k) { s.classList.toggle('on', k === at); s.classList.toggle('back', !!back && k !== at); s.setAttribute('aria-hidden', k === at ? 'false' : 'true'); });
        bars.forEach(function (b, k) { b.classList.toggle('on', k <= at); });
      }
      function interactive(t) { return t.closest && t.closest('a,button,select,input,label,form'); }
      box.addEventListener('click', function (e) {
        if (interactive(e.target)) return;
        var r = box.getBoundingClientRect();
        if (e.clientX - r.left < r.width * 0.33) show(at - 1, true); else show(at + 1);
      });
      box.addEventListener('pointerdown', function (e) { if (!interactive(e.target)) { x0 = e.clientX; y0 = e.clientY; } });
      box.addEventListener('pointerup', function (e) {
        if (x0 === null) return;
        var dx = e.clientX - x0, dy = e.clientY - y0;
        x0 = null;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
          box.dataset.swiped = '1';
          if (dx < 0) show(at + 1); else show(at - 1, true);
        }
      });
      box.addEventListener('click', function (e) { if (box.dataset.swiped) { delete box.dataset.swiped; e.stopImmediatePropagation(); } }, true);
      box.addEventListener('keydown', function (e) {
        if (interactive(e.target)) return;
        if (e.key === 'ArrowRight') { show(at + 1); e.preventDefault(); }
        if (e.key === 'ArrowLeft') { show(at - 1, true); e.preventDefault(); }
      });
      show(0);
    });
    // Charges in the category list: biggest first or by date.
    (root || document).querySelectorAll('.msort').forEach(function (g) {
      if (g.dataset.ready) return;
      g.dataset.ready = '1';
      g.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-sort]');
        if (!b) return;
        g.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
        var byDate = b.dataset.sort === 'd';
        g.parentNode.querySelectorAll('.mrowsx').forEach(function (list) {
          Array.prototype.slice.call(list.children).sort(function (p, q) {
            return byDate ? q.dataset.d.localeCompare(p.dataset.d) : parseFloat(q.dataset.a) - parseFloat(p.dataset.a);
          }).forEach(function (row) { list.appendChild(row); });
        });
      });
    });
  }
  document.addEventListener('DOMContentLoaded', function () { story(); });
  document.addEventListener('htmx:afterSettle', function () { story(); });

  // Help panel: the "?" button loads the page's help into #helpp (htmx); close with the x, Esc or the button again.
  function helpOpen(open) {
    var p = document.getElementById('helpp'), b = document.querySelector('.helpbtn');
    if (!p || !b) return;
    p.hidden = !open;
    p.classList.toggle('open', open);
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) p.focus(); else b.focus();
  }
  document.addEventListener('htmx:beforeRequest', function (e) {
    var p = document.getElementById('helpp');
    if (e.detail.elt && e.detail.elt.classList && e.detail.elt.classList.contains('helpbtn') && p && !p.hidden) {
      e.preventDefault();
      helpOpen(false);
    }
  });
  document.addEventListener('htmx:afterSwap', function (e) { if (e.target && e.target.id === 'helpp') helpOpen(true); });
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-help-close]')) helpOpen(false); });
  // [data-check-all="1|0"] ticks or unticks every box in its fieldset (Settings > Connections > Bank sync accounts)
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-check-all]');
    var fs = b && b.closest('fieldset');
    if (!fs) return;
    var on = b.getAttribute('data-check-all') === '1';
    fs.querySelectorAll('input[type=checkbox]').forEach(function (c) { c.checked = on; });
  });
  document.addEventListener('keydown', function (e) {
    var p = document.getElementById('helpp');
    if (e.key === 'Escape' && p && !p.hidden) helpOpen(false);
  });

  // First visit to a page: a one-line tip next to the "?" button, until "Got it" or the panel is opened (this browser).
  function seenTips() { try { return JSON.parse(localStorage.getItem('help-tips') || '[]'); } catch (e) { return []; } }
  function tipSeen(key) {
    var seen = seenTips();
    if (seen.indexOf(key) < 0) seen.push(key);
    try { localStorage.setItem('help-tips', JSON.stringify(seen)); } catch (e) { /* private window: shows again */ }
    var t = document.querySelector('.helptip');
    if (t) t.hidden = true;
  }
  document.addEventListener('DOMContentLoaded', function () {
    var t = document.querySelector('.helptip');
    if (t && seenTips().indexOf(t.dataset.helpTip) < 0) t.hidden = false;
  });
  document.addEventListener('click', function (e) {
    var t = document.querySelector('.helptip');
    if (!t || !e.target.closest) return;
    if (e.target.closest('[data-help-tip-close]') || e.target.closest('.helpbtn')) tipSeen(t.dataset.helpTip);
  });

  // Folded Settings cards: a link to #id inside one opens it, and the card a form was sent from stays open after the
  // page loads again (HX-Redirect). Only the card's heading is remembered, for this tab.
  function openFold(el) {
    var d = el && el.closest ? el.closest('details.sfold') : null;
    if (d) d.open = true;
  }
  document.addEventListener('DOMContentLoaded', function () {
    if (location.hash.length > 1) openFold(document.getElementById(location.hash.slice(1)));
    var keep = null;
    try { keep = sessionStorage.getItem('sfold'); sessionStorage.removeItem('sfold'); } catch (e) {}
    if (keep) document.querySelectorAll('details.sfold > summary h2').forEach(function (h) {
      if (h.textContent === keep) h.closest('details').open = true;
    });
  });
  document.addEventListener('htmx:beforeRequest', function (e) {
    var d = e.target && e.target.closest ? e.target.closest('details.sfold') : null;
    var h = d && d.querySelector('summary h2');
    if (h) try { sessionStorage.setItem('sfold', h.textContent); } catch (err) {}
  });

  // Installable app: the service worker only keeps the app's own files (never a signed-in page).
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('/sw.js', {scope: '/'}).catch(function () {});
  }
})();
