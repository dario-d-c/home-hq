// Frame screensaver: after N idle minutes, crossfade through the family's shared photos.
// Built for a weak Android WebView: two <img> layers, opacity transitions only, optional slow
// transform (Ken Burns), next image preloaded and decoded before it is shown.
// Test mode: /?ssidle=10 (seconds) & ?sssecs=4.
(function () {
  var qs = new URLSearchParams(location.search);
  var TEST_IDLE = +qs.get('ssidle') || 0, TEST_SECS = +qs.get('sssecs') || 0;
  var settings = { idleMin: 5, secs: 12, shuffle: true, kenBurns: false };
  var photos = [], order = [], pos = 0;
  var lastInput = Date.now(), active = false, timer = null, idleTimer = null;
  var root, layers, cur = 0, clockEl, nextEl, clockTimer;

  function idleMs() { return TEST_IDLE ? TEST_IDLE * 1000 : settings.idleMin * 60000; }
  function secs() { return TEST_SECS || settings.secs; }
  function shown() { return photos.filter(function (p) { return p.show !== false; }); }
  function src(p) { return '/api/photo/' + p.id + '?v=s'; }

  function load() {
    return fetch('/api/photos', { cache: 'no-store', credentials: 'same-origin', headers: window.HQFrameKey ? { 'x-frame-key': window.HQFrameKey } : {} }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d) return;
      settings = d.settings || settings;
      var ids = JSON.stringify(shown().map(function (p) { return p.id; }));
      photos = d.photos || [];
      if (JSON.stringify(shown().map(function (p) { return p.id; })) !== ids) reorder();
      if (active && !shown().length) stop();
    }).catch(function () {});
  }
  var lastId = null;
  function reorder() {
    order = shown().slice();
    if (settings.shuffle) for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t; }
    // never show the same photo twice in a row across a reshuffle
    if (order.length > 1 && order[0].id === lastId) { var f = order.shift(); order.push(f); }
    pos = 0;
  }

  function build() {
    root = document.createElement('div');
    root.className = 'ss';
    root.innerHTML = '<img class="ss-img" alt=""><img class="ss-img" alt=""><div class="ss-info"><div class="ss-clock"></div><div class="ss-date"></div><div class="ss-next"></div></div>';
    layers = root.querySelectorAll('.ss-img');
    clockEl = root.querySelector('.ss-clock'); nextEl = root.querySelector('.ss-next');
    // Swallow the whole touch so nothing underneath gets tapped, then dismiss.
    ['pointerdown', 'mousedown', 'touchstart'].forEach(function (t) {
      root.addEventListener(t, function (e) { e.preventDefault(); e.stopPropagation(); if (active) stop(); }, { passive: false });
    });
    ['click', 'pointerup', 'mouseup', 'touchend'].forEach(function (t) {
      root.addEventListener(t, function (e) { e.preventDefault(); e.stopPropagation(); }, { passive: false });
    });
    document.body.appendChild(root);
  }

  function tick() {
    var A = window.App, now = A ? A.now() : new Date();
    clockEl.textContent = A ? A.fmt.time(now) : now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    root.querySelector('.ss-date').textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    var next = null;
    try {
      next = (window.DATA.events || []).filter(function (e) { return !e.allDay && e.start > now; }).sort(function (a, b) { return a.start - b.start; })[0];
    } catch (e) {}
    nextEl.textContent = next ? 'Next: ' + next.title + ' · ' + (A ? A.fmt.rel(next.start) + ' ' + A.fmt.time(next.start) : next.start.toLocaleString()) : '';
  }

  function show(p, first) {
    var nextLayer = layers[1 - cur], img = new Image();
    img.onload = function () {
      var go = function () {
        if (!active) return;
        nextLayer.src = img.src;
        nextLayer.style.transition = 'none';
        nextLayer.style.transform = settings.kenBurns ? 'scale(1.0) translate3d(0,0,0)' : '';
        // force style flush, then animate opacity (+ optional slow zoom)
        void nextLayer.offsetWidth;
        nextLayer.style.transition = 'opacity 1.6s ease' + (settings.kenBurns ? ', transform ' + (secs() + 2) + 's linear' : '');
        nextLayer.style.opacity = 1;
        if (settings.kenBurns) nextLayer.style.transform = 'scale(1.08) translate3d(' + (Math.random() > .5 ? '-' : '') + '1.5%,0,0)';
        layers[cur].style.opacity = 0;
        cur = 1 - cur;
        // preload the one after
        var after = order[(pos) % order.length]; if (after) { var pre = new Image(); pre.src = src(after); }
      };
      if (img.decode) img.decode().then(go, go); else go();
    };
    img.onerror = function () { if (active) timer = setTimeout(advance, 1000); };
    img.src = src(p);
  }
  function advance() {
    if (!active) return;
    if (!order.length) reorder();
    if (!order.length) return stop();
    if (pos >= order.length) reorder();
    var p = order[pos++]; lastId = p.id;
    show(p);
    timer = setTimeout(advance, secs() * 1000);
  }

  function start() {
    if (/[?&]preview=1/.test(location.search)) return;   // never in the editor preview
    if (active || !shown().length || document.querySelector('#sheetLayer.is-open') || document.querySelector('.sitter-ov')) return;
    if (!root) build();
    active = true;
    if (!order.length) reorder();
    layers[0].style.opacity = 0; layers[1].style.opacity = 0;
    root.classList.add('is-on');
    tick(); clockTimer = setInterval(tick, 15000);
    advance();
  }
  function stop() {
    active = false; clearTimeout(timer); clearInterval(clockTimer);
    if (!root) return;
    root.classList.remove('is-on');
    // keep catching stray taps for a moment while it fades, then let them through
    root.classList.add('is-leaving');
    setTimeout(function () { root.classList.remove('is-leaving'); layers[0].removeAttribute('src'); layers[1].removeAttribute('src'); }, 700);
    lastInput = Date.now();
  }

  function onInput() { lastInput = Date.now(); }
  ['pointerdown', 'touchstart', 'keydown', 'mousedown'].forEach(function (t) { document.addEventListener(t, onInput, true); });
  idleTimer = setInterval(function () { if (!active && Date.now() - lastInput >= idleMs()) start(); }, TEST_IDLE ? 1000 : 5000);

  window.addEventListener('load', function () { load(); setInterval(load, 60000); });
  function startNow() {
    var A = window.App;
    if (/[?&]preview=1/.test(location.search)) { if (A) A.toast('The slideshow only plays on the frame itself', { ms: 3500, icon: 'photo' }); return; }
    if (shown().length) return start();
    // the list may not have loaded yet (or changed since): fetch fresh before saying there are none
    var p = load(); (p && p.then ? p : Promise.resolve()).then(function () {
      if (shown().length) start();
      else if (A) A.toast('No photos yet — add some in <b>More → Photos</b>', { ms: 5000, icon: 'photo' });
    });
  }
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#railShow')) startNow(); });
  window.HQScreensaver = { startNow: startNow, start: start, stop: stop, isActive: function () { return active; }, reload: load };
})();
