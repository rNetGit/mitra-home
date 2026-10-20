// The Mitra Wall (webapp/routes_wall.py). No framework, no inline script (the app's CSP).
//  * <form data-wall> posts with this wall's CSRF token (meta csrf-token) and follows the answer: the page reloads with
//    the change, or shows the sentence the PC sent back.
//  * After <body data-idle> seconds without a touch the wall goes to the resting screen; a touch there opens Today.
//  * Every <body data-refresh> seconds without a touch the page reloads, so a change made on a phone or the PC shows up.
//  * [data-clock] shows the time; at night (body data-night-from / -to, Settings > Phones > Mitra Wall > Wall screen;
//    10 PM to 6 AM unless changed) the wall goes back to the (dark) clock after NIGHT_IDLE seconds; the screen is kept
//    awake where the browser allows.
//  * The resting screen: [data-hand] (the traditional clock) turns every second; with body data-photos it shows the
//    clock for data-clock-s seconds, then up to data-per-turn photos for data-photo-s seconds each, then the clock again,
//    only between data-photos-from and -to and never at night. It reloads only while the clock shows.
//  * [data-unlock-left] counts the money view down and locks it at zero.
//  * A tap on [data-pop] (an event, an all-day line, a month day) shows its hidden .pop in the one <dialog id="wpop">;
//    a tap outside the box or Close shuts it.
(function () {
  'use strict';
  var body = document.body;
  var token = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
  var lastTouch = Date.now();
  var rest = body.getAttribute('data-rest-url') || '/wall/rest';
  var home = body.getAttribute('data-home-url') || '/wall';
  var idle = parseInt(body.getAttribute('data-idle') || '0', 10);
  var NIGHT_IDLE = 30;
  var refresh = parseInt(body.getAttribute('data-refresh') || '0', 10);
  var resting = body.classList.contains('rest');

  function mins(hm, dflt) {
    var m = /^(\d{2}):(\d{2})$/.exec(hm || '');
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : dflt;
  }
  function within(now, a, b) { return a < b ? (now >= a && now < b) : (now >= a || now < b); }
  var nightFrom = mins(body.getAttribute('data-night-from'), 22 * 60);
  var nightTo = mins(body.getAttribute('data-night-to'), 6 * 60);
  function isNight(d) { return within(d.getHours() * 60 + d.getMinutes(), nightFrom, nightTo); }

  function say(text) {
    var box = document.getElementById('wmsg');
    if (!box) return;
    box.textContent = text;
    box.hidden = false;
    setTimeout(function () { box.hidden = true; }, 6000);
  }

  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f.hasAttribute('data-wall')) return;
    e.preventDefault();
    var btn = e.submitter || f.querySelector('button');
    if (btn) btn.disabled = true;
    var data = new URLSearchParams(new FormData(f));
    if (e.submitter && e.submitter.name) data.set(e.submitter.name, e.submitter.value);
    fetch(f.action, { method: 'POST', credentials: 'same-origin', redirect: 'follow',
      headers: { 'X-CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: data.toString() })
      .then(function (r) {
        if (r.ok) { location.replace(r.redirected ? r.url : location.href); return null; }
        if (r.status === 403) { location.reload(); return null; }
        return r.text().then(function (t) { say(t.slice(0, 200) || 'That did not work. Try again.'); });
      })
      .catch(function () { say('The PC did not answer. Is it on?'); })
      .then(function () { if (btn) btn.disabled = false; });
  });

  var pop = document.getElementById('wpop');
  function openPop(el) {
    var src = el.querySelector('.pop');
    if (!pop || !src || typeof pop.showModal !== 'function') return;
    pop.querySelector('.wpop-body').innerHTML = src.innerHTML;  // server-rendered, escaped by the template
    pop.showModal();
  }
  document.addEventListener('click', function (e) {
    if (pop && e.target === pop) { pop.close(); return; }  // the backdrop
    var el = e.target.closest ? e.target.closest('[data-pop]') : null;
    if (el && !(pop && pop.contains(el))) openPop(el);
  });
  document.addEventListener('keydown', function (e) {
    var el = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && el && el.hasAttribute && el.hasAttribute('data-pop')) {
      e.preventDefault();
      openPop(el);
    }
  });

  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, function () { lastTouch = Date.now(); }, { passive: true });
  });
  if (resting) {
    document.addEventListener('pointerdown', function () { location.href = home; });
  }

  function tick() {
    var now = new Date();
    var h = now.getHours();
    var night = isNight(now);
    body.classList.toggle('night', night);
    document.querySelectorAll('[data-clock]').forEach(function (el) {
      var m = String(now.getMinutes()).padStart(2, '0');
      el.textContent = el.getAttribute('data-clock') === '12'
        ? ((h % 12) || 12) + ':' + m + (h < 12 ? ' AM' : ' PM') : ((h % 12) || 12) + ':' + m;
    });
    var quiet = (Date.now() - lastTouch) / 1000;
    if (!resting && idle && quiet >= (night ? Math.min(idle, NIGHT_IDLE) : idle)) { location.href = rest; return; }
    if (refresh && quiet >= refresh && document.visibilityState === 'visible' && !showingPhoto) { location.reload(); }
  }
  // ---- the resting screen: the traditional clock's hands, and photos in turn with the clock --------------------------
  var showingPhoto = false;
  var hands = document.querySelectorAll('[data-hand]');
  function turnHands() {
    if (!hands.length) return;
    var d = new Date(), s = d.getSeconds(), m = d.getMinutes() + s / 60, hr = (d.getHours() % 12) + m / 60;
    hands.forEach(function (el) {
      var k = el.getAttribute('data-hand');
      var a = k === 'h' ? hr * 30 : k === 'm' ? m * 6 : s * 6;
      el.setAttribute('transform', 'rotate(' + a.toFixed(2) + ' 100 100)');
    });
  }
  if (hands.length) { setInterval(turnHands, 1000); turnHands(); }

  var stage = document.getElementById('stage');
  var urls = [];
  try { urls = JSON.parse(body.getAttribute('data-photos') || '[]'); } catch (err) { urls = []; }
  if (resting && stage && urls.length) {
    var imgs = stage.querySelectorAll('.ph');
    var photoS = parseInt(body.getAttribute('data-photo-s') || '15', 10);
    var clockS = parseInt(body.getAttribute('data-clock-s') || '45', 10);
    var perTurn = parseInt(body.getAttribute('data-per-turn') || '4', 10);
    var pFrom = mins(body.getAttribute('data-photos-from'), 7 * 60), pTo = mins(body.getAttribute('data-photos-to'), 21 * 60);
    var order = [], pos = 0, shownThisTurn = 0, front = 0, since = Date.now();
    function shuffle() {
      order = urls.slice();
      for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = order[i]; order[i] = order[j]; order[j] = t; }
      pos = 0;
    }
    function photosNow() {
      var d = new Date();
      return !isNight(d) && within(d.getHours() * 60 + d.getMinutes(), pFrom, pTo);
    }
    function showNext() {
      if (pos >= order.length) shuffle();
      var url = order[pos++], back = imgs[1 - front];
      back.onload = function () {
        back.classList.add('on');
        imgs[front].classList.remove('on');
        front = 1 - front;
      };
      back.onerror = function () { since = Date.now() - photoS * 1000; };  // skip a photo that will not load
      back.src = url;
      shownThisTurn += 1;
      since = Date.now();
    }
    function toClock() {
      stage.hidden = true;
      imgs.forEach(function (im) { im.classList.remove('on'); });
      showingPhoto = false;
      since = Date.now();
    }
    shuffle();
    setInterval(function () {
      var gone = (Date.now() - since) / 1000;
      if (!showingPhoto) {
        if (gone >= clockS && photosNow()) { stage.hidden = false; showingPhoto = true; shownThisTurn = 0; showNext(); }
      } else if (!photosNow()) {
        toClock();
      } else if (gone >= photoS) {
        if (shownThisTurn >= perTurn) toClock(); else showNext();
      }
    }, 1000);
  }

  setInterval(tick, 15000);
  tick();

  var left = document.querySelector('[data-unlock-left]');
  if (left) {
    var n = parseInt(left.getAttribute('data-unlock-left'), 10) || 0;
    var t = setInterval(function () {
      n -= 1;
      if (n <= 0) { clearInterval(t); location.href = home; return; }
      left.textContent = '0:' + String(n).padStart(2, '0');
    }, 1000);
  }

  var lock = null;
  function awake() {
    if (!navigator.wakeLock || document.visibilityState !== 'visible') return;
    navigator.wakeLock.request('screen').then(function (l) { lock = l; }).catch(function () {});
  }
  document.addEventListener('visibilitychange', awake);
  awake();
  void lock;
})();
