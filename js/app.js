// Core shell: router, demo clock, idle/ambient, toasts, sheets, helpers.
(function () {
  'use strict';
  var D = window.DATA;
  var App = window.App = { state: D, views: {}, current: null, mode: 'day', calMode: 'normal' };
  var $ = App.$ = function (s, r) { return (r || document).querySelector(s); };
  App.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ------------------------------------------------------------ events
  var handlers = {};
  App.on = function (e, fn) { (handlers[e] = handlers[e] || []).push(fn); };
  App.emit = function (e, a) { (handlers[e] || []).forEach(function (fn) { fn(a); }); };

  // ------------------------------------------------------------ time (demo clock)
  var offset = 0;
  App.now = function () { return new Date(Date.now() + offset); };
  App.setTime = function (h, m) {
    if (h == null) offset = 0;
    else { var d = new Date(); d.setHours(h, m, 0, 0); offset = d - Date.now(); }
    lastMin = -1;
    App.emit('time');
    App.rerender();
  };
  App.dayStart = function (d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  App.addDays = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; };
  App.sameDay = function (a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };
  App.isNight = function () { var h = App.now().getHours(); return h >= 22 || h < 6; };

  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  App.fmt = {
    time: function (d, ampm) {
      var h = d.getHours(), m = d.getMinutes();
      if (App.look && App.look.clock24) return h + ':' + (m < 10 ? '0' : '') + m;
      var s = (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m;
      return ampm === false ? s : s + ' ' + (h >= 12 ? 'PM' : 'AM');
    },
    // "4 PM", "3:45 PM"
    hour: function (d) {
      var h = d.getHours(), m = d.getMinutes();
      if (App.look && App.look.clock24) return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
      return (h % 12 || 12) + (m ? ':' + (m < 10 ? '0' : '') + m : '') + ' ' + (h >= 12 ? 'PM' : 'AM');
    },
    ampm: function (d) { return App.look && App.look.clock24 ? '' : d.getHours() >= 12 ? 'PM' : 'AM'; },
    range: function (a, b) {
      var same = App.fmt.ampm(a) === App.fmt.ampm(b);
      return (same ? App.fmt.time(a, false) : App.fmt.time(a)) + ' – ' + App.fmt.time(b);
    },
    day: function (d) { return DAYS[d.getDay()]; },
    dayShort: function (d) { return DAYS[d.getDay()].slice(0, 3); },
    month: function (d) { return MONTHS[d.getMonth()]; },
    monthShort: function (d) { return MON_SHORT[d.getMonth()]; },
    mins: function (m) {
      m = Math.max(0, Math.round(m));
      if (m < 60) return m + ' min';
      var h = Math.floor(m / 60), r = m % 60;
      return h + ' hr' + (r ? ' ' + r + ' min' : '');
    },
    rel: function (d) {
      var t = App.dayStart(App.now()), x = App.dayStart(d), diff = Math.round((x - t) / 864e5);
      if (diff === 0) return 'Today';
      if (diff === 1) return 'Tomorrow';
      if (diff === -1) return 'Yesterday';
      return DAYS[d.getDay()];
    }
  };
  App.esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // ------------------------------------------------------------ icons + people
  App.icon = function (name, size, cls) {
    size = size || 24;
    return '<svg class="i ' + (cls || '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (window.ICONS[name] || '') + '</svg>';
  };
  App.person = function (id) {
    if (id === 'family' || id === 'any') return D.family;
    for (var i = 0; i < D.people.length; i++) if (D.people[i].id === id) return D.people[i];
    return D.family;
  };
  App.pstyle = function (p) {
    if (typeof p === 'string') p = App.person(p);
    if (window.HQTheme && p) {
      var x = window.HQTheme.person(p, D.people.indexOf(p) > -1 ? D.people.indexOf(p) : 0, (App.look && App.look.people) || 'soft', App.themeKey || 'oat');
      return '--c:' + x.color + ';--c-rgb:' + window.HQTheme.rgb(x.color) + ';--c-ink:' + x.ink;
    }
    return '--c:' + p.color + ';--c-rgb:' + p.rgb + ';--c-ink:' + p.ink;
  };
  App.avatar = function (p, size, cls) {
    if (typeof p === 'string') p = App.person(p);
    size = size || 48;
    return '<span class="avatar ' + (cls || '') + '" style="' + App.pstyle(p) + ';width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.46) + 'px">' + (p.id === 'family' ? '★' : p.name[0]) + '</span>';
  };
  App.dots = function (ids, size) {
    return '<span class="dots">' + ids.map(function (id) { return '<i style="' + App.pstyle(id) + (size ? ';width:' + size + 'px;height:' + size + 'px' : '') + '"></i>'; }).join('') + '</span>';
  };

  // ------------------------------------------------------------ calendar helpers
  App.events = function () {
    var list = D.events.slice();
    var today = App.dayStart(App.now());
    if (App.calMode === 'busy') list = list.concat(D.busyExtras);
    if (App.calMode === 'empty') list = list.filter(function (e) { return e.allDay || !App.sameDay(e.start, today); });
    return list;
  };
  App.isFamily = function (e) { return e.people.length >= D.people.length; };
  App.evColor = function (e) { return App.isFamily(e) ? D.family : App.person(e.people[0]); };
  // people an event belongs to, and a style with their colours split evenly (hard-stop stripes) when it's shared
  App.evPeople = function (e) { var ids = (e.people && e.people.length ? e.people : D.ALL || []); return D.people.map(function (p) { return p.id; }).filter(function (id) { return ids.indexOf(id) > -1; }); };
  App.pcolor = function (id) { var p = App.person(id); if (!p) return '#888'; var m = /--c:([^;]+)/.exec(App.pstyle(p)); return m ? m[1] : p.color; };
  App.stripes = function (ids, dir) { var n = ids.length; return 'linear-gradient(' + dir + ',' + ids.map(function (id, i) { var c = App.pcolor(id); return c + ' ' + (i * 100 / n).toFixed(2) + '% ' + ((i + 1) * 100 / n).toFixed(2) + '%'; }).join(',') + ')'; };
  App.evStyle = function (e, base) {
    var ids = App.evPeople(e), st = App.pstyle(base || (ids.length > 1 ? App.person(ids[0]) : App.evColor(e)));
    return ids.length > 1 ? st + ';--stripes:' + App.stripes(ids, '180deg') + ';--stripes-h:' + App.stripes(ids, '90deg') : st;
  };
  App.timedOn = function (day, pid) {
    var s = App.dayStart(day), e = App.addDays(s, 1);
    return App.events().filter(function (ev) {
      return !ev.allDay && ev.start < e && ev.end > s && (!pid || ev.people.indexOf(pid) > -1);
    }).sort(function (a, b) { return a.start - b.start || b.end - a.end; });
  };
  App.allDayOn = function (day, pid) {
    var s = App.dayStart(day), e = App.addDays(s, 1);
    return App.events().filter(function (ev) {
      return ev.allDay && ev.start < e && ev.end > s && (!pid || ev.people.indexOf(pid) > -1);
    });
  };
  App.leaveBy = function (e) { return e.travel ? new Date(+e.start - e.travel * 60000) : e.start; };
  // The next thing someone needs to act on: earliest upcoming "leave by" today.
  App.nextEvent = function () {
    var now = App.now();
    var list = App.timedOn(now).filter(function (e) { return e.start > now; });
    list.sort(function (a, b) { return App.leaveBy(a) - App.leaveBy(b); });
    return list[0] || null;
  };
  App.findEvent = function (id) {
    return App.events().filter(function (e) { return e.id === id; })[0];
  };

  // ------------------------------------------------------------ chores + weather helpers
  App.currentRoutine = function () {
    var h = App.now().getHours();
    for (var i = 0; i < D.routines.length; i++) if (h >= D.routines[i].from && h < D.routines[i].to) return D.routines[i];
    return D.routines[2];
  };
  App.weatherNow = function () {
    var W = D.weather, h = App.now().getHours();
    var rainAt = -1;
    for (var i = h; i < 24; i++) if (W.p[i] >= 50) { rainAt = i; break; }
    var summary, advice;
    if (rainAt === h) {
      var stop = h; while (stop < 24 && W.p[stop] >= 50) stop++;
      summary = 'Rain until ' + App.fmt.hour(new Date(2000, 0, 1, stop));
      advice = 'Umbrella weather';
    } else if (rainAt > -1) {
      summary = 'Rain from ' + App.fmt.hour(new Date(2000, 0, 1, rainAt));
      var soccer = App.timedOn(App.now()).filter(function (e) { return /soccer/i.test(e.title) && e.start > App.now(); })[0];
      advice = soccer ? 'Pack a rain jacket for soccer' : 'Grab a rain jacket';
    } else {
      summary = W.t[h] < 12 ? 'Clear and cool' : 'Dry all day';
      advice = W.t[h] < 12 ? 'Jacket weather' : 'Light layers';
    }
    var labels = { sun: 'Sunny', moon: 'Clear', partly: 'Partly cloudy', cloud: 'Overcast', rain: 'Rain' };
    return { temp: W.t[h], cond: W.c[h], label: labels[W.c[h]], hi: W.hi, lo: W.lo, summary: summary, advice: advice, hour: h };
  };
  App.hourly = function (count) {
    var W = D.weather, h = App.now().getHours(), out = [];
    for (var i = 0; i < count; i++) {
      var x = (h + i) % 24;
      out.push({ h: x, t: W.t[x], c: W.c[x], p: W.p[x], label: i === 0 ? 'Now' : ((x % 12 || 12) + (x >= 12 ? 'p' : 'a')) });
    }
    return out;
  };

  // ------------------------------------------------------------ router
  App.register = function (name, view) { App.views[name] = view; };
  // Views are built once and kept laid out (hidden with content-visibility), so switching tabs
  // only has to paint. A view is rebuilt when its data changed ('data'/'time' events) or, for
  // time-sensitive views (minutely: true), when the minute has rolled over since it was built.
  function minuteKey() { return Math.floor(App.now().getTime() / 60000); }
  function build(name, opts) {
    var view = App.views[name];
    view.show($('#view-' + name), opts || {});
    view._built = true; view._dirty = false; view._min = minuteKey();
  }
  App.go = function (name, opts) {
    opts = opts || {};
    if (!App.views[name]) name = 'home';
    if (App.current && App.current !== name && App.views[App.current].hide) App.views[App.current].hide();
    App.$$('.view').forEach(function (v) { v.classList.toggle('is-active', v.dataset.view === name); });
    App.$$('.rail-item').forEach(function (b) { b.classList.toggle('is-active', b.dataset.go === name); });
    App.current = name;
    if (document.documentElement.classList.contains('is-phone')) { try { window.scrollTo(0, 0); } catch (e) {} }
    var view = App.views[name];
    if (!view._built || view._dirty || opts.rerender || (view.minutely && view._min !== minuteKey())) build(name, opts);
    else if (view.resume) view.resume($('#view-' + name));
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  };
  // Build a hidden view and lay it out now (cached by content-visibility; no paint happens).
  function prebuild(name) {
    var el = $('#view-' + name), view = App.views[name];
    build(name);
    if (view.hide) view.hide();
    el.classList.add('is-warming');
    el.offsetHeight;
    el.classList.remove('is-warming');
  }
  // Pre-build (startup) and re-build (after data changes) hidden views in the background, one per
  // slot, so navigating to them never pays the rebuild cost.
  var refreshTimer = null;
  function refreshStale(delay) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function next() {
      var name = Object.keys(App.views).filter(function (k) {
        var v = App.views[k];
        return k !== App.current && (!v._built || v._dirty);
      })[0];
      if (!name) return;
      prebuild(name);
      refreshTimer = setTimeout(next, 400);
    }, delay);
  }
  function markStale() {
    Object.keys(App.views).forEach(function (k) { if (k !== App.current) App.views[k]._dirty = true; });
    refreshStale(1500);
  }
  App.on('data', markStale);
  App.on('time', markStale);
  App.rerender = function () {
    if (App.current) App.views[App.current].show($('#view-' + App.current), { rerender: true });
  };

  // ------------------------------------------------------------ toasts (single, with undo)
  var toastTimer;
  App.toast = function (html, opts) {
    opts = opts || {};
    var box = $('#toasts');
    box.innerHTML = '';
    clearTimeout(toastTimer);
    var ms = opts.ms || 5000;
    var t = document.createElement('div');
    t.className = 'toast' + (opts.tone ? ' toast--' + opts.tone : '');
    t.style.setProperty('--ms', ms + 'ms');
    t.innerHTML = (opts.icon ? App.icon(opts.icon, 26) : '') + '<span class="toast-msg">' + html + '</span>' +
      (opts.undo ? '<button class="toast-undo">' + App.icon('undo', 22) + 'Undo</button>' : '');
    box.appendChild(t);
    t.classList.add('is-in');
    function kill() { t.remove(); }
    toastTimer = setTimeout(kill, ms);
    if (opts.undo) t.querySelector('.toast-undo').addEventListener('click', function () { clearTimeout(toastTimer); opts.undo(); kill(); });
  };

  // ------------------------------------------------------------ sheets (modal cards)
  // Sheets always fit the part of the screen you can actually see (scaled stage, iOS toolbars,
  // on-screen keyboard): --sv-top/--sv-h are the visible band in the sheet layer's own coordinates.
  var fitBound = false;
  function fitSheet() {
    var layer = $('#sheetLayer'); if (!layer || !layer.classList.contains('is-open')) return;
    var vv = window.visualViewport, vt = vv ? vv.offsetTop : 0, vh = vv ? vv.height : window.innerHeight;
    var r = layer.getBoundingClientRect(), k = layer.offsetHeight ? r.height / layer.offsetHeight : 1;
    var top = Math.max(r.top, vt), bot = Math.min(r.bottom, vt + vh);
    if (bot - top < 120) { top = r.top; bot = r.bottom; }
    var nt = Math.round((top - r.top) / k), nh = Math.round((bot - top) / k);
    // only write real changes (iOS fires viewport scroll/resize in bursts while focusing → no relayout/flicker loops)
    if (Math.abs(nt - (fitSheet.t || -99)) < 2 && Math.abs(nh - (fitSheet.h || -99)) < 2) return;
    fitSheet.t = nt; fitSheet.h = nh;
    layer.style.setProperty('--sv-top', nt + 'px');
    layer.style.setProperty('--sv-h', nh + 'px');
  }
  // Phones: sheets with fields are full-screen pages with a FIXED height (measured once at open). The keyboard never
  // resizes them: after it finishes moving (one debounced settle, ~300ms) we only pad the inside by the keyboard
  // height and scroll the focused field into view once.
  var fitRaf = 0, settleT = 0;
  function isFull() { var sh = document.querySelector('#sheetLayer.is-open .sheet'); return !!(sh && sh.classList.contains('sheet--full')); }
  function settle() {
    var layer = $('#sheetLayer'), sh = layer && layer.querySelector('.sheet--full'); if (!sh) return;
    var vv = window.visualViewport, ih = window.innerHeight;
    var kb = vv ? Math.max(0, Math.round(ih - vv.height - vv.offsetTop)) : 0, top = vv ? Math.round(vv.offsetTop) : 0;
    if (kb < 80) kb = 0;   // toolbar wobble, not a keyboard
    if (settle.kb !== kb) { settle.kb = kb; layer.style.setProperty('--kb', kb + 'px'); }
    if (settle.top !== top) { settle.top = top; layer.style.setProperty('--vv-top', top + 'px'); }
    var f = document.activeElement, box = sh.querySelector('.sheet-body');
    if (box && f && sh.contains(f) && f.matches('input, textarea, select')) {
      var r = f.getBoundingClientRect(), b = box.getBoundingClientRect(), bottom = b.bottom - (kb ? Math.max(0, b.bottom - (vv.offsetTop + vv.height)) : 0);
      if (r.top < b.top + 8 || r.bottom > bottom - 8) box.scrollTop += r.top - b.top - 24;
    }
  }
  function fitSoon() {
    if (isFull()) { clearTimeout(settleT); settleT = setTimeout(settle, 300); return; }
    if (fitRaf) return; fitRaf = requestAnimationFrame(function () { fitRaf = 0; fitSheet(); });
  }
  document.addEventListener('focusin', function (ev) { if (isFull() && ev.target.closest('#sheetLayer')) { clearTimeout(settleT); settleT = setTimeout(settle, 300); } });
  document.addEventListener('focusout', function (ev) { if (isFull() && ev.target.closest('#sheetLayer')) { clearTimeout(settleT); settleT = setTimeout(settle, 300); } });
  App.fitSheet = fitSheet;
  App.sheet = function (html, opts) {
    opts = opts || {};
    var layer = $('#sheetLayer');
    layer.innerHTML = '<div class="sheet-scrim"></div><div class="sheet ' + (opts.cls || '') + '">' +
      '<button class="sheet-x" data-close aria-label="Close">' + App.icon('x', 28) + '</button><div class="sheet-body">' + html + '</div></div>';
    layer.classList.add('is-open');
    var shEl = layer.querySelector('.sheet');
    if (document.documentElement.classList.contains('is-phone') && (opts.full || /sheet--embed/.test(opts.cls || '') || shEl.querySelector('input:not([type=checkbox]):not([type=radio]), textarea, select'))) {
      shEl.classList.add('sheet--full'); settle.kb = settle.top = null;
      layer.style.setProperty('--lh', window.innerHeight + 'px'); layer.style.setProperty('--kb', '0px'); layer.style.setProperty('--vv-top', '0px');
    }
    fitSheet.t = fitSheet.h = null; fitSheet(); if (!fitBound) { fitBound = true; var vv = window.visualViewport; window.addEventListener('resize', fitSoon); if (vv) { vv.addEventListener('resize', fitSoon); vv.addEventListener('scroll', fitSoon); } }
    var R = document.documentElement, lockY = window.scrollY || 0;
    if (R.classList.contains('is-phone') && !R.classList.contains('sheet-lock')) { R.style.setProperty('--lock-y', -lockY + 'px'); R.classList.add('sheet-lock'); }
    function close() {
      if (!layer.classList.contains('is-open')) return;
      layer.classList.remove('is-open');
      if (R.classList.contains('sheet-lock')) { R.classList.remove('sheet-lock'); window.scrollTo(0, lockY); }
      if (opts.onClose) opts.onClose();
      layer.innerHTML = '';
    }
    App.closeSheet = close;
    layer.querySelector('.sheet-scrim').addEventListener('click', close);
    App.$$('[data-close]', layer).forEach(function (b) { b.addEventListener('click', close); });
    if (opts.onMount) opts.onMount(layer.querySelector('.sheet'), close);
    return close;
  };
  App.closeSheet = function () {};

  // Stage-local coordinates for an element's center (stage may be scaled on desktop)
  App.centerOf = function (el) {
    var stage = $('#stage').getBoundingClientRect(), r = el.getBoundingClientRect(), k = stage.width / 1280;
    return { x: (r.left + r.width / 2 - stage.left) / k, y: (r.top + r.height / 2 - stage.top) / k };
  };

  // ------------------------------------------------------------ press-and-hold
  App.hold = function (el, ms, cb) {
    var t = null;
    el.style.setProperty('--hold', ms + 'ms');
    el.addEventListener('pointerdown', function () {
      if (cb.enabled && !cb.enabled()) return;
      el.classList.add('is-holding');
      t = setTimeout(function () { t = null; el.classList.remove('is-holding'); cb.done(); }, ms);
    });
    function cancel(e) {
      if (!t) return;
      clearTimeout(t); t = null;
      el.classList.remove('is-holding');
      if (cb.cancel && e.type === 'pointerup') cb.cancel();
    }
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('pointercancel', cancel);
  };

  // ------------------------------------------------------------ modes: day / ambient / night
  App.setMode = function (m) {
    var stage = $('#stage');
    App.mode = m;
    stage.dataset.mode = m;
    App.emit('mode', m);
  };

  // ------------------------------------------------------------ idle
  App.idle = { home: 60, ambient: 120 };
  var idleSec = 0;
  function onIdleTick() {
    idleSec++;
    var blocked = $('#takeover').classList.contains('is-open');
    if (App.mode === 'nightdash' && idleSec >= 20) { App.setMode('night'); return; }
    if (App.mode !== 'day' || blocked) return;
    var sv = (App.look && App.look.startView) || 'home';
    if (idleSec === App.idle.home && App.current !== sv) { App.closeSheet(); App.go(sv); }
    // The old built-in ambient/night photo modes no longer start on idle; the family-photo
    // screensaver (js/screensaver.js) takes over instead.
  }
  App.resetIdle = function () { idleSec = 0; };

  // ------------------------------------------------------------ stage scaling (desktop preview only)
  // Fill any screen: the layout is designed at 1280×800 but the stage stretches to the screen's
  // aspect ratio (4:3 iPads get a taller stage, portrait a narrower/taller one) and is then scaled.
  // Fill any screen. Landscape: the 1280×800 design stretched to the screen's aspect ratio. Portrait
  // (taller than wide, or forced in Look & layout): a genuine portrait layout (css/portrait.css) on an
  // ~800px-wide stage. Switches live on rotation/resize; views re-render, state is kept.
  var wasPortrait = null;
  function fit() {
    var vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight || document.documentElement.clientHeight;
    if (!vw || !vh) { setTimeout(fit, 200); return; }   // in-app browsers can report 0 during their open animation
    var a = vw / vh, W, H, mode = (App.look && App.look.orientation) || 'auto';
    var port = mode === 'portrait' || (mode === 'auto' && a < 1);
    if (port) { if (a < 1) { W = vw < 520 ? 470 : 800; H = Math.round(W / a); } else { W = 800; H = 1280; } }
    else if (a >= 1.6) { H = 800; W = Math.round(800 * a); }
    else if (a >= 1) { W = 1280; H = Math.round(1280 / a); }
    else { W = 1280; H = 800; }   // landscape forced on a portrait screen: letterbox
    var st = $('#stage'), s = Math.min(vw / W, vh / H);
    var phone = port && a < 1 && vw < 520;
    if (phone) {
      // phones: no scaled stage — real device-width layout, full visible viewport (iOS toolbars: innerHeight / visualViewport)
      st.style.width = ''; st.style.height = ''; st.style.marginLeft = ''; st.style.marginTop = ''; st.style.transform = '';
      document.documentElement.classList.add('is-portrait', 'is-phone'); App.portrait = true;
      if (wasPortrait === false && App.current) { Object.keys(App.views).forEach(function (k) { App.views[k]._dirty = true; }); try { App.rerender(); } catch (e) {} App.emit('orientation', true); }
      wasPortrait = true; return;
    }
    document.documentElement.classList.remove('is-phone');
    st.style.width = W + 'px'; st.style.height = H + 'px';
    st.style.marginLeft = -W / 2 + 'px'; st.style.marginTop = -H / 2 + 'px';
    st.style.transform = Math.abs(s - 1) < 0.005 ? '' : 'scale(' + s + ')';
    document.documentElement.classList.toggle('is-portrait', port);
    App.portrait = port;
    if (wasPortrait !== null && wasPortrait !== port && App.current) {
      Object.keys(App.views).forEach(function (k) { App.views[k]._dirty = true; });
      try { App.rerender(); } catch (e) {}
      App.emit('orientation', port);
    }
    wasPortrait = port;
  }
  App.fit = fit;
  // phones: always open at the top (no restored scroll, no focus-scroll)
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}
  function toTop() { if (document.documentElement.classList.contains('is-phone') && !document.documentElement.classList.contains('sheet-lock')) window.scrollTo(0, 0); }
  window.addEventListener('load', function () { toTop(); setTimeout(toTop, 300); setTimeout(toTop, 1200); });
  window.addEventListener('pageshow', toTop);

  // ------------------------------------------------------------ clock tick
  var lastMin = -1;
  function tick() {
    var n = App.now();
    App.emit('second', n);
    if (n.getMinutes() !== lastMin) {
      lastMin = n.getMinutes();
      $('#railClock').innerHTML = '<b>' + App.fmt.time(n, false) + '</b><span>' + App.fmt.ampm(n) + '</span>';
      App.emit('minute', n);
    }
    onIdleTick();
  }

  // ------------------------------------------------------------ boot
  App.start = function () {
    // Real time (the original prototype froze a demo clock at 3:18 PM).
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', function () { setTimeout(fit, 250); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
    setTimeout(fit, 500); setTimeout(fit, 1500);   // sheets/in-app browsers settle their size late
    // Switch tabs the instant a finger lands (pointerdown), not on release. Keyboard "clicks"
    // (detail === 0) still work.
    $('#rail').addEventListener('pointerdown', function (e) {
      var b = e.target.closest('[data-go]');
      if (b && e.button === 0) App.go(b.dataset.go);
    });
    $('#rail').addEventListener('click', function (e) {
      var b = e.target.closest('[data-go]');
      if (b && e.detail === 0) App.go(b.dataset.go);
    });
    document.addEventListener('pointerdown', App.resetIdle, true);
    window.addEventListener('hashchange', function () { App.go(location.hash.slice(1)); });
    App.go(location.hash.slice(1) || (App.look && App.look.startView) || 'home');
    tick();
    setInterval(tick, 1000);
    App.started = true;
    App.emit('ready');
    refreshStale(1500);
  };
  document.addEventListener('DOMContentLoaded', function () { App.start(); });
})();
