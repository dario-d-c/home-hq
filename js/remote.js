// Shared data sync for the frame.
//  • Pulls /api/data at boot, every 60s and on wake, swapping it into window.DATA.
//  • Pushes taps made on the frame (chores, stars, groceries, calendar adds) back to the API,
//    authenticated with a frame key saved once via /?key=<FRAME_KEY>.
//  • Local edits are merged item-by-item onto the latest server copy, and a refresh never
//    overwrites unsaved taps or lands within a few seconds of the last tap.
(function () {
  var D = window.DATA;
  var CACHE = 'hq-data-cache-v3', KEYNAME = 'hq-frame-key';
  var SECTIONS = ['chores', 'groceries', 'events', 'stars', 'lunch'];
  var last = null;          // last server JSON text applied
  var base = {};            // section -> JSON of local state as of last sync (diff baseline)
  var lastTouch = 0, pushing = false, pulling = false;

  try { localStorage.removeItem('hq-data-cache'); localStorage.removeItem('hq-data-cache-v2'); } catch (e) {}   // old cache could hold mock data

  // one-time frame key setup: /?key=... → localStorage, then strip from URL
  try {
    var qs = new URLSearchParams(location.search), k = qs.get('key');
    if (k) {
      localStorage.setItem(KEYNAME, k); qs.delete('key');
      history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs : '') + location.hash);
    }
  } catch (e) {}
  function frameKey() { try { return localStorage.getItem(KEYNAME) || ''; } catch (e) { return ''; } }
  window.HQFrameKey = frameKey;

  // Chores can repeat at several times of day (c.r = ['morning','evening']). The frame works on one
  // instance per slot (id 'c1@morning'); done is tracked per slot per day in doneSlots[slot] = 'YYYY-MM-DD'.
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function slots(c) { var r = Array.isArray(c.r) ? c.r : c.r ? [c.r] : []; return r.length ? r : ['after']; }
  // Chores can also be for several people (c.who = ['jamie','riley']): each person gets their own
  // instance per slot (id 'c1@morning@jamie') with its own tick and stars. Done key: slot, or 'slot|person'
  // when there is more than one person (so single-person chores keep the old format).
  function whos(c) { return Array.isArray(c.who) ? (c.who.length ? c.who : ['any']) : [c.who || 'any']; }
  function dkey(c, slot, pid) { return whos(c).length > 1 ? slot + '|' + pid : slot; }
  // which days a chore happens: c.date (just once), c.days ([0..6] weekdays), else every day; c.skip = ['YYYY-MM-DD'] days off
  function choreOn(c, ymd) {
    if ((c.skip || []).indexOf(ymd) > -1) return false;
    if (c.date) return c.date === ymd;
    if (Array.isArray(c.days) && c.days.length) { var p = ymd.split('-'); return c.days.indexOf(new Date(+p[0], +p[1] - 1, +p[2]).getDay()) > -1; }
    return true;
  }
  window.HQChoreOn = choreOn;
  // instances for today go to D.chores; chores not on today are kept (D.choresOff) so saving never drops them
  function expand(list, offOut) {
    var t = today(), out = [];
    list.forEach(function (c) {
      if (offOut && !choreOn(c, t)) { offOut.push(c); return; }
      var ws = whos(c);
      slots(c).forEach(function (slot) {
        ws.forEach(function (pid) {
          var done = c.doneSlots ? c.doneSlots[dkey(c, slot, pid)] === t : (!!c.done && !Array.isArray(c.r) && c.r === slot);
          var x = Object.assign({}, c, { id: c.id + '@' + slot + (ws.length > 1 ? '@' + pid : ''), _base: c.id, _who: c.who, r: slot, who: pid, done: done });
          delete x.doneSlots;
          if (!done) delete x.doneBy;
          out.push(x);
        });
      });
    });
    return out;
  }
  function collapse(list) {
    var t = today(), order = [], by = {};
    list.forEach(function (x) {
      var id = x._base || x.id, slot = x.r;
      if (!by[id]) {
        by[id] = Object.assign({}, x, { id: id, r: [], doneSlots: {}, who: x._who !== undefined ? x._who : x.who });
        delete by[id]._base; delete by[id]._who; delete by[id].done; delete by[id].doneBy;
        order.push(id);
      }
      var c = by[id];
      if (c.r.indexOf(slot) < 0) c.r.push(slot);
      if (x.done) { c.doneSlots[dkey(c, slot, x.who)] = t; if (x.doneBy) c.doneBy = x.doneBy; }
    });
    return order.map(function (id) { var c = by[id]; if (!Object.keys(c.doneSlots).length) delete c.doneSlots; return c; });
  }
  // ---- recurring events: master {repeat:{freq:'daily'|'weekly'|'monthly'|'yearly', every, days:[0..6], until:'YYYY-MM-DD'}, skip:['YYYY-MM-DD']}
  // expanded into read-only instances (id master@YYYY-MM-DD) from 60 days back to ~13 months ahead.
  function key8(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function occurrences(m) {
    var r = m.repeat, s0 = new Date(m.start), e0 = new Date(m.end), dur = e0 - s0, every = Math.max(1, +r.every || 1);
    var now = new Date(), from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 60), to = new Date(now.getFullYear() + 1, now.getMonth() + 1, 1);
    var until = r.until ? new Date(r.until + 'T23:59:59') : null, skip = m.skip || [], out = [], first = new Date(s0.getFullYear(), s0.getMonth(), s0.getDate());
    var days = r.freq === 'weekly' ? (r.days && r.days.length ? r.days : [s0.getDay()]) : null;
    for (var d = new Date(Math.max(+first, +from)); d < to && out.length < 800; d.setDate(d.getDate() + 1)) {
      d.setHours(0, 0, 0, 0);
      if (until && d > until) break;
      var diff = Math.round((d - first) / 864e5), ok;
      if (r.freq === 'daily') ok = diff % every === 0;
      else if (r.freq === 'weekly') ok = days.indexOf(d.getDay()) > -1 && Math.floor((diff + first.getDay()) / 7) % every === 0;
      else if (r.freq === 'monthly') ok = d.getDate() === s0.getDate() && ((d.getFullYear() - s0.getFullYear()) * 12 + d.getMonth() - s0.getMonth()) % every === 0;
      else if (r.freq === 'yearly') ok = d.getDate() === s0.getDate() && d.getMonth() === s0.getMonth();
      if (!ok || skip.indexOf(key8(d)) > -1) continue;
      var st = new Date(d.getFullYear(), d.getMonth(), d.getDate(), s0.getHours(), s0.getMinutes());
      out.push(Object.assign({}, m, { id: m.id + '@' + key8(d), master: m.id, start: st, end: new Date(+st + dur), people: m.people && m.people.length ? m.people : D.ALL.slice(), readOnly: true, recurring: true }));
    }
    return out;
  }
  // birthdays: person.birthday 'YYYY-MM-DD' (or '--MM-DD') → yearly all-day countdown events
  function birthdays(people, dates) {
    var out = [], now = new Date();
    var src = people.filter(function (p) { return p.birthday; }).map(function (p) { return { id: p.id, pid: p.id, name: p.name, kind: 'birthday', date: p.birthday }; })
      .concat((dates || []).map(function (d) { return { id: 'd:' + d.id, pid: d.pid, name: d.name, kind: d.kind || 'birthday', date: d.date }; }));
    src.forEach(function (p) {
      var m = /^(\d{4}|-)-?(\d\d)-(\d\d)$/.exec(p.date || ''); if (!m) return;
      [now.getFullYear(), now.getFullYear() + 1].forEach(function (y) {
        var d = new Date(y, +m[2] - 1, +m[3]); if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)) return;
        var n = /^\d{4}$/.test(m[1]) ? y - +m[1] : 0, ann = p.kind === 'anniversary';
        out.push({ id: 'bday:' + p.id + ':' + y, title: (ann ? '🥂 ' : '🎂 ') + (ann ? p.name + '’s anniversary' + (n > 0 ? ' · ' + n + ' yrs' : '') : p.name + (n > 0 ? ' turns ' + n : '’s birthday')),
          allDay: true, start: d, end: new Date(y, +m[2] - 1, +m[3] + 1), people: p.pid ? [p.pid] : (D.ALL || []).slice(), readOnly: true, birthday: p.pid || p.id, celebrate: ann ? 'anniversary' : 'birthday',
          celebName: p.name, turning: n || null, cdKey: 'b:' + (p.pid || p.id) });
      });
    });
    return out;
  }
  window.HQCel = function (days) {
    var t0 = App.dayStart(new Date()), end = App.addDays(t0, days == null ? 7 : days);
    return birthdays(D.people || [], D.dates || []).filter(function (e) { return e.start >= t0 && e.start <= end; })
      .filter(function (e, i, a) { return a.findIndex(function (x) { return x.birthday === e.birthday; }) === i; })
      .sort(function (a, b) { return a.start - b.start; });
  };
  function ser(s) {
    if (s === 'events') return JSON.stringify(D.events.filter(function (e) { return !e.readOnly; }).concat(D.recurringRaw || []));
    if (s === 'chores') { var all = collapse(D.chores).concat(D.choresOff || []), ord = (D.choresRaw || []).map(function (c) { return c.id; });
      var ix = function (c) { var i = ord.indexOf(c.id); return i < 0 ? 1e6 : i; }; return JSON.stringify(all.map(function (c, i) { return [c, i]; }).sort(function (a, b) { return (ix(a[0]) - ix(b[0])) || (a[1] - b[1]); }).map(function (x) { return x[0]; })); }
    return JSON.stringify(D[s]);
  }
  function snapshot() { SECTIONS.forEach(function (s) { base[s] = ser(s); }); }

  function apply(d) {
    if (!d) return;
    if (Array.isArray(d.people)) {
      d.people.forEach(function (p) {
        var cur = D.people.filter(function (x) { return x.id === p.id; })[0];
        if (cur) Object.assign(cur, p); else D.people.push(p);
      });
      var keep = D.people.filter(function (x) { return d.people.some(function (p) { return p.id === x.id; }); });
      D.people.length = 0; keep.forEach(function (p) { D.people.push(p); });
      D.ALL = D.people.map(function (p) { return p.id; });
    }
    if (Array.isArray(d.events)) {
      // all-day events are stored as home-timezone midnights (end exclusive). Read the calendar date in the family's
      // timezone and rebuild it as a local midnight, so a phone/browser in another timezone (or UTC) shows the same days.
      var homeDay = function (iso) {
        var d = new Date(iso);
        try {
          var p = new Intl.DateTimeFormat('en-CA', { timeZone: (window.DATA && D.tz) || 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(+d + 6 * 36e5)).split('-');
          return new Date(+p[0], +p[1] - 1, +p[2]);
        } catch (er) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
      };
      var ymd = function (x) { var p = x.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
      D.recurringRaw = d.events.filter(function (e) { return e.repeat && e.repeat.freq; });
      var manual = d.events.filter(function (e) { return !(e.repeat && e.repeat.freq); }).map(function (e) {
        return Object.assign({}, e, { start: e.allDay ? homeDay(e.start) : new Date(e.start), end: e.allDay ? homeDay(e.end) : new Date(e.end), people: e.people && e.people.length ? e.people : D.ALL.slice() });
      });
      D.recurringRaw.forEach(function (m) { manual = manual.concat(occurrences(m)); });
      manual = manual.concat(birthdays(d.people || D.people || [], Array.isArray(d.dates) ? d.dates : D.dates || []));
      var synced = (d.syncedEvents || []).map(function (e) {
        var s0 = e.allDay ? ymd(e.startDate) : new Date(e.start), e0 = e.allDay ? ymd(e.endDate) : new Date(e.end);
        return Object.assign({}, e, { start: s0, end: e0, people: e.people && e.people.length ? e.people : D.ALL.slice(), readOnly: true });
      });
      // the same event can arrive from several calendars (e.g. Sam's and Jamie's): keep ONE, people merged
      var seen = {}, dd = [];
      synced.forEach(function (e) { var uid = String(e.id).split(':').slice(2).join(':') || e.title, k = uid + '|' + (+e.start);
        var x = seen[k]; if (!x) { seen[k] = e; dd.push(e); return; }
        if (!(x.people.length >= D.ALL.length)) e.people.forEach(function (id) { if (x.people.indexOf(id) < 0) x.people.push(id); }); });
      D.events = manual.concat(dd);
    }
    if (Array.isArray(d.chores)) { var off = []; D.chores = expand(d.chores, off); D.choresOff = off; D.choresRaw = d.chores; }
    var MIG = { grocer: 'mb', costco: 'bj' };   // old store ids
    if (Array.isArray(d.groceries)) D.groceries = d.groceries.map(function (g) { var x = Object.assign({}, g); if (MIG[x.store]) x.store = MIG[x.store]; return x; });
    if (Array.isArray(d.stores) && d.stores.length) {   // saved order wins; built-ins added if missing (never written back)
      var st = d.stores.slice();
      [{ id: 'wf', name: 'Whole Foods (delivery)' }, { id: 'any', name: 'Anywhere' }].forEach(function (b) { if (!st.some(function (x) { return x.id === b.id; })) st.push(b); });
      D.stores = st;
    }
    D.usuals = Array.isArray(d.usuals) ? d.usuals : [];
    D.trips = Array.isArray(d.trips) ? d.trips : [];
    D.wishes = Array.isArray(d.wishes) ? d.wishes : [];
    D.dates = Array.isArray(d.dates) ? d.dates : [];
    D.recipes = Array.isArray(d.recipes) ? d.recipes : [];
    D.countdowns = Array.isArray(d.countdowns) ? d.countdowns : [];
    if (d.stars) D.stars = Object.assign({}, d.stars);
    D.meals = Array.isArray(d.meals) ? d.meals : [];   // read-only on the frame
    D.menus = Array.isArray(d.menus) ? d.menus : [];
    D.lunch = Array.isArray(d.lunch) ? d.lunch.map(function (x) { return Object.assign({}, x); }) : [];
    snapshot();
  }

  function redraw() {
    var A = window.App;
    if (A && A.views) Object.keys(A.views).forEach(function (k) { A.views[k]._dirty = true; });
    if (A && A.current && !document.querySelector('#sheetLayer.is-open')) {
      try { A.rerender(); } catch (e) { console.warn('rerender failed', e); }
    }
  }

  function dirtySections() { return SECTIONS.filter(function (s) { return ser(s) !== base[s]; }); }
  function busy() { return pushing || dirtySections().length || Date.now() - lastTouch < 8000 || document.querySelector('#sheetLayer.is-open'); }

  // 3-way merge of one section: apply local changes (base → mine) onto the server copy.
  function merge(s, baseVal, mine, server) {
    if (s === 'stars') {
      var out = Object.assign({}, server);
      Object.keys(mine).forEach(function (k) { out[k] = (server[k] || 0) + (mine[k] - (baseVal[k] || 0)); });
      return out;
    }
    var byId = function (a) { var m = {}; a.forEach(function (x) { m[x.id] = x; }); return m; };
    var b = byId(baseVal), m = byId(mine), res = server.slice();
    var idx = function (id) { for (var i = 0; i < res.length; i++) if (res[i].id === id) return i; return -1; };
    Object.keys(b).forEach(function (id) { if (!m[id]) { var i = idx(id); if (i >= 0) res.splice(i, 1); } });   // deleted here
    mine.forEach(function (x) {
      var i = idx(x.id);
      if (!b[x.id]) { if (i < 0) res.push(x); }                                                                // added here
      else if (JSON.stringify(b[x.id]) !== JSON.stringify(x) && i >= 0) res[i] = x;                            // changed here
    });
    return res;
  }

  function push() {
    if (/[?&]preview=1/.test(location.search)) return;   // editor preview never saves taps
    var key = frameKey(), dirty = dirtySections();
    if (!key || !dirty.length || pushing) return;
    pushing = true;
    var mine = {}, baseVals = {};
    dirty.forEach(function (s) { mine[s] = JSON.parse(ser(s)); baseVals[s] = JSON.parse(base[s]); });
    fetch('/api/data', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (server) {
        var body = {};
        dirty.forEach(function (s) { body[s] = merge(s, baseVals[s], mine[s], server[s] || (s === 'stars' ? {} : [])); });
        return fetch('/api/data', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-frame-key': key }, body: JSON.stringify(body) });
      })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (saved) {
        // mark what we sent as synced; anything tapped meanwhile stays dirty for the next push
        dirty.forEach(function (s) { base[s] = JSON.stringify(mine[s]); });
        last = JSON.stringify(saved);
        try { localStorage.setItem(CACHE, last); } catch (e) {}
      })
      .catch(function (e) { console.warn('[remote] save failed, will retry:', e.message); })
      .then(function () { pushing = false; });
  }

  window.HQPull = function () { pull(true); };
  function pull(force) {
    // forced pulls (after an edit sheet saved/closed) only wait for real local changes, not for recent taps
    var hold = function () { return force ? (pushing || dirtySections().length) : busy(); };
    if (pulling || hold()) { if (force) setTimeout(function () { pull(true); }, 1500); return; }
    pulling = true;
    fetch('/api/data', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (txt) {
        if (hold()) return;
        if (txt === last) { if (force) redraw(); return; }   // unchanged (forced: repaint, the data may have been applied while a sheet was open)
        last = txt;
        apply(JSON.parse(txt));
        if (!/[?&]preview=1/.test(location.search)) { try { localStorage.setItem(CACHE, txt); } catch (e) {} }
        redraw();
      })
      .catch(function (e) { console.warn('[remote] using cached/mock data:', e.message); })
      .then(function () { pulling = false; });
  }

  try { var c = localStorage.getItem(CACHE); if (c) { last = c; apply(JSON.parse(c)); } } catch (e) {}
  snapshot();
  ['pointerdown', 'keydown'].forEach(function (t) { document.addEventListener(t, function () { lastTouch = Date.now(); }, true); });
  window.addEventListener('load', function () {
    pull(true);
    setInterval(pull, 60000);
    // new day → re-expand chores so yesterday's ticks clear (per-slot done is dated)
    var day = today();
    setInterval(function () { if (today() !== day && !busy() && last) { day = today(); apply(JSON.parse(last)); redraw(); } }, 60000);
    setInterval(function () { if (Date.now() - lastTouch > 1500) push(); }, 2000);   // debounce taps, then save
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) pull(); });
  window.HQSync = { push: push, pull: pull, hasKey: function () { return !!frameKey(); } };
})();
