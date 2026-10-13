// Weekly routines (person.routine = [{id, days:[0..6], type, label, start:'HH:MM', end:'HH:MM'}]).
// Powers "Where's everyone" on Today, upcoming bedtimes, and optional faint blocks on the calendar.
(function () {
  'use strict';
  var D = window.DATA;
  var NAMES = { work: 'Work', school: 'School', daycare: 'Daycare', commute: 'On the way', activity: 'Activity', bed: 'Bedtime', wake: 'Wake up', other: '' };
  function at(day, hm) { var p = String(hm || '').split(':'); var d = App.dayStart(day); d.setHours(+p[0] || 0, +p[1] || 0, 0, 0); return d; }
  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function hm(d) { return App.fmt.time(d, false).replace(/:00$/, ''); }
  // School-year calendar events (scanned): no-school days and half days for a kid on a date
  var OFF = ['noschool', 'vacation', 'pd'];
  App.schoolDay = function (day, pid) {
    var d0 = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12), r = { off: null, half: null };
    (D.events || []).forEach(function (e) {
      if (!e.school || !(e.start <= d0 && d0 < e.end) || (e.people && e.people.length && e.people.indexOf(pid) < 0)) return;
      if (OFF.indexOf(e.school) > -1) r.off = e; else if (e.school === 'half') r.half = e;
    });
    return r;
  };
  // per-person days off (vacation/holiday): skips work/school/daycare/commute blocks on those dates
  var OFFTYPES = ['work', 'school', 'daycare', 'commute', 'activity'];
  App.dayOff = function (p, day) { var k = ymd(day); return (p.dayoff || []).filter(function (x) { return x.from <= k && k <= x.to; })[0] || null; };
  App.routineOn = function (p, day) {
    var wd = day.getDay(), sd = App.schoolDay(day, p.id);
    var k = ymd(day), off = App.dayOff(p, day);
    return (p.routine || []).filter(function (b) { return (b.days || []).indexOf(wd) > -1 && b.start && !(b.skip && b.skip.indexOf(k) > -1) && !(sd.off && b.type === 'school') && !(off && OFFTYPES.indexOf(b.type) > -1); })
      .map(function (b) {
        var ov = b.over && b.over[k];
        if (ov) return { b: b, s: at(day, ov.start), e: ov.end ? at(day, ov.end) : null, changed: true };
        var e = b.end ? at(day, b.end) : null;
        if (b.type === 'school' && sd.half && sd.half.dismiss) e = at(day, sd.half.dismiss);   // early release
        return { b: b, s: at(day, b.start), e: e };
      })
      .sort(function (a, b) { return a.s - b.s; });
  };
  function label(b) { return b.label || NAMES[b.type] || 'Busy'; }
  // e.g. "Work until 5 · home ~5:45", "School until 3:15", "Home · bed 7:30", "Asleep · up 7"
  App.whereIs = function (p) {
    var now = App.now(), list = App.routineOn(p, now);
    if (p.late && p.late.date === ymd(now) && at(now, p.late.until) > now) return { text: 'Running late · home ~' + hm(at(now, p.late.until)), out: true, late: true };
    var blocks = list.filter(function (x) { return x.e && x.b.type !== 'bed' && x.b.type !== 'wake'; });
    var bed = list.filter(function (x) { return x.b.type === 'bed'; })[0];
    var wake = list.filter(function (x) { return x.b.type === 'wake'; })[0];
    var tomorrowWake = App.routineOn(p, App.addDays(now, 1)).filter(function (x) { return x.b.type === 'wake'; })[0];
    var cur = blocks.filter(function (x) { return x.s <= now && x.e > now; })[0];
    if (cur) {
      var after = blocks.filter(function (x) { return x.s >= cur.e && x.b.type === 'commute' && +x.s - +cur.e <= 3600000; })[0];
      if (cur.b.type === 'commute') return { text: 'On the way · home ~' + hm(cur.e), out: true };
      return { text: label(cur.b) + ' until ' + hm(cur.e) + (after ? ' · home ~' + hm(after.e) : ''), out: true };
    }
    if (bed && now >= bed.s) return { text: 'Asleep' + (tomorrowWake ? ' · up ' + hm(tomorrowWake.s) : ''), out: false, asleep: true };
    if (wake && now < wake.s) return { text: 'Asleep · up ' + hm(wake.s), out: false, asleep: true };
    var next = blocks.filter(function (x) { return x.s > now; })[0];
    var bits = ['Home'];
    if (next && +next.s - +now < 3 * 3600000) bits.push(label(next.b) + ' at ' + hm(next.s));
    else if (bed && now.getHours() >= 15) bits.push('bed ' + hm(bed.s));
    return { text: bits.join(' · '), out: false };
  };
  // Next routine items from now (today → next 3 days), e.g. [{label:'Work', when:'5 AM tomorrow'}]
  App.upcomingRoutine = function (p, n) {
    var now = App.now(), out = [];
    for (var i = 0; i < 4 && out.length < n; i++) {
      var day = App.addDays(App.dayStart(now), i);
      App.routineOn(p, day).forEach(function (x) {
        if (out.length >= n || x.s <= now || x.b.type === 'wake' && i === 0 && false) return;
        if (x.b.type === 'commute') return;
        out.push({ pid: p.id, bid: x.b.id, day: ymd(day), label: label(x.b), type: x.b.type, when: App.fmt.time(x.s) + (i === 0 ? '' : i === 1 ? ' tomorrow' : ' ' + App.fmt.dayShort(day)), s: x.s });
      });
    }
    return out;
  };
  App.hasRoutines = function () { return D.people.some(function (p) { return (p.routine || []).length; }); };
  // faint routine blocks on the calendar (Look & layout toggle)
  var cache = {};
  App.routineEvents = function (day) {
    var key = App.dayStart(day).getTime();
    var out = [];
    D.people.forEach(function (p) {
      App.routineOn(p, day).forEach(function (x) {
        if (!x.e || x.b.type === 'bed' || x.b.type === 'wake' || x.e <= x.s) return;
        var e = { id: 'rt:' + p.id + ':' + x.b.id + ':' + key, title: label(x.b) + (x.changed ? ' (changed)' : ''), start: x.s, end: x.e, people: [p.id], routine: true, readOnly: true, pid: p.id, bid: x.b.id, day: ymd(day) };
        cache[e.id] = e; out.push(e);
      });
    });
    return out;
  };
  var timedOn = App.timedOn;
  App.timedOn = function (day, pid) {
    var list = timedOn.apply(this, arguments);
    if (!(App.look && App.look.routinesOnCal)) return list;   // calendar shows only one-off items unless turned on
    var s = App.dayStart(day);
    return list.concat(App.routineEvents(s).filter(function (e) { return !pid || e.people.indexOf(pid) > -1; }))
      .sort(function (a, b) { return a.start - b.start || b.end - a.end; });
  };
  var nextEvent = App.nextEvent;
  App.nextEvent = function () { var on = App.look && App.look.routinesOnCal; if (on) App.look.routinesOnCal = false; try { return nextEvent(); } finally { if (on) App.look.routinesOnCal = true; } };
  // days off show as an all-day chip ("Alex · Day off") everywhere the calendar shows all-day items
  var events0 = App.events;
  function pd(k) { var a = k.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
  App.events = function () {
    var list = events0.apply(this, arguments);
    (D.people || []).forEach(function (p) {
      (p.dayoff || []).forEach(function (x) {
        if (!x.from || !x.to) return;
        var e = { id: 'off:' + p.id + ':' + x.from, title: (p.name || p.id) + ' · ' + (x.label || 'Day off'), start: pd(x.from), end: App.addDays(pd(x.to), 1), allDay: true, people: [p.id], readOnly: true, dayoff: true, pid: p.id, from: x.from, to: x.to };
        cache[e.id] = e; list.push(e);
      });
    });
    return list;
  };
  var find = App.findEvent;
  App.findEvent = function (id) { return find(id) || cache[id]; };

  // ------------------------------------------------------------ routine sheet (edit on the frame)
  var DAYN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], TYPES = [['work', 'Work'], ['school', 'School'], ['daycare', 'Daycare'], ['activity', 'Activity'], ['commute', 'Commute'], ['bed', 'Bedtime'], ['wake', 'Wake up'], ['other', 'Other']];
  function t12(v) { return v ? App.fmt.time(at(App.now(), v)) : ''; }
  function uid() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function saveRoutine(p) {
    var key = window.HQFrameKey && window.HQFrameKey();
    if (/[?&]preview=1/.test(location.search)) return Promise.resolve();
    var h = { 'content-type': 'application/json' }; if (key) h['x-frame-key'] = key;
    return fetch('/api/routine/' + encodeURIComponent(p.id), { method: 'PUT', headers: h, credentials: 'same-origin', body: JSON.stringify({ routine: p.routine || [], late: p.late || null, dayoff: p.dayoff || [] }) })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); App.toast && App.toast('Saved'); })
      .catch(function (e) { App.toast && App.toast('Couldn’t save — ' + e.message); });
  }
  App.saveRoutine = saveRoutine;
  // One block on one date: skip / change times for that day / edit weekly / restore; holiday helper for adults' work
  App.routineDaySheet = function (pid, bid, k) {
    var p = App.person(pid), b = (p.routine || []).filter(function (x) { return x.id === bid; })[0]; if (!b) return;
    var pp = k.split('-'), day = new Date(+pp[0], +pp[1] - 1, +pp[2]), dl = App.fmt.dayShort(day) + ' ' + App.fmt.monthShort(day) + ' ' + day.getDate();
    function draw(sh) {
      var skipped = (b.skip || []).indexOf(k) > -1, ov = b.over && b.over[k];
      var hol = (D.events || []).filter(function (e) { return e.school && ['noschool', 'vacation', 'pd'].indexOf(e.school) > -1 && e.start <= at(day, '12:00') && at(day, '12:00') < e.end; })[0];
      var adults = D.people.filter(function (x) { return x.role === 'parent' && (x.routine || []).some(function (y) { return y.type === 'work' && (y.days || []).indexOf(day.getDay()) > -1 && (y.skip || []).indexOf(k) < 0; }); });
      sh.querySelector('.rd-body').innerHTML = '<div class="sheet-pad rt" style="' + App.pstyle(p) + '"><div class="label">' + App.esc(p.name) + ' · ' + dl + '</div>' +
        '<h2 class="serif sheet-h">' + App.esc(label(b)) + '</h2>' +
        '<p class="rt-now">' + (skipped ? 'Skipped on ' + dl : (ov ? 'Changed: ' : 'Usually ') + t12(ov ? ov.start : b.start) + ((ov ? ov.end : b.end) ? ' – ' + t12(ov ? ov.end : b.end) : '')) + '</p>' +
        (hol && adults.length && b.type === 'work' ? '<button class="btn rt-add rt-hol" data-rd-hol>🏖️ ' + App.esc(hol.title.replace(/^\S+\s/, '')) + ' — skip work for ' + App.esc(adults.map(function (a) { return a.name; }).join(' & ')) + '</button>' : '') +
        '<div class="rd-acts">' +
        (skipped ? '<button class="btn rt-add" data-rd-unskip>↺ Restore on ' + dl + '</button>' : '<button class="btn btn--solid rt-add" data-rd-skip>Skip on ' + dl + '</button>') +
        (skipped ? '' : '<div class="rt-f rt-times"><label><span>Start (this day)</span><input type="time" class="rt-in" data-rd-s value="' + ((ov || b).start || '') + '"></label>' + (b.end ? '<label><span>End (this day)</span><input type="time" class="rt-in" data-rd-e value="' + ((ov || b).end || '') + '"></label>' : '') + '</div>' +
          '<button class="btn rt-add" data-rd-ov>Change times for this day only</button>') +
        (ov ? '<button class="btn rt-add" data-rd-unov>↺ Back to usual times</button>' : '') +
        '<button class="btn btn--ghost rt-add" data-rd-weekly>Edit every week…</button></div></div>';
    }
    App.sheet('<div class="rd-body"></div>', { cls: 'sheet--routine', onMount: function (sh, close) {
      draw(sh);
      function done(msg, undo) { saveRoutine(p); App.rerender(); draw(sh); if (msg) App.toast(msg, { icon: 'calendar', undo: undo }); }
      sh.addEventListener('click', function (ev) {
        var t = ev.target.closest('button'); if (!t) return; var d = t.dataset;
        if (d.rdSkip != null) { b.skip = (b.skip || []).concat(k); return done('Skipped ' + label(b) + ' on ' + dl, function () { b.skip = b.skip.filter(function (x) { return x !== k; }); if (!b.skip.length) delete b.skip; saveRoutine(p); App.rerender(); }); }
        if (d.rdUnskip != null) { b.skip = (b.skip || []).filter(function (x) { return x !== k; }); if (!b.skip.length) delete b.skip; return done('Restored'); }
        if (d.rdOv != null) { var s0 = sh.querySelector('[data-rd-s]').value, e0 = sh.querySelector('[data-rd-e]'); if (!s0) return; b.over = b.over || {}; b.over[k] = { start: s0 }; if (e0 && e0.value) b.over[k].end = e0.value; return done('Changed for ' + dl); }
        if (d.rdUnov != null) { delete b.over[k]; if (!Object.keys(b.over).length) delete b.over; return done('Back to usual times'); }
        if (d.rdWeekly != null) { close(); return App.routineSheet(pid); }
        if (d.rdHol != null) {
          var touched = [];
          D.people.filter(function (x) { return x.role === 'parent'; }).forEach(function (a) {
            var hit = false; (a.routine || []).forEach(function (y) { if (y.type === 'work' && (y.days || []).indexOf(day.getDay()) > -1 && (y.skip || []).indexOf(k) < 0) { y.skip = (y.skip || []).concat(k); hit = true; } });
            if (hit) { touched.push(a); saveRoutine(a); }
          });
          App.rerender(); draw(sh); App.toast('Work skipped for ' + touched.map(function (a) { return a.name; }).join(' & ') + ' on ' + dl, { icon: 'calendar', undo: function () {
            touched.forEach(function (a) { (a.routine || []).forEach(function (y) { if (y.skip) { y.skip = y.skip.filter(function (x) { return x !== k; }); if (!y.skip.length) delete y.skip; } }); saveRoutine(a); }); App.rerender(); } });
        }
      });
    } });
  };
  App.routineSheet = function (pid) {
    var p = App.person(pid); if (!p || !p.id) return;
    var st = { edit: null };
    function list() {
      var today = ymd(App.now()), w = App.whereIs(p);
      var rows = (p.routine || []).slice().sort(function (a, b) { return (a.start || '') < (b.start || '') ? -1 : 1; }).map(function (b) {
        var skipped = (b.skip || []).indexOf(today) > -1, todayOn = (b.days || []).indexOf(App.now().getDay()) > -1;
        return '<div class="rt-row' + (skipped ? ' is-skip' : '') + '"><button class="rt-main" data-rt-edit="' + b.id + '"><b>' + App.esc(label(b)) + '</b><span>' + t12(b.start) + (b.end ? ' – ' + t12(b.end) : '') + ' · ' + (b.days || []).map(function (d) { return DAYN[d]; }).join(' ') + '</span></button>' +
          (todayOn ? '<button class="rt-btn" data-rt-skip="' + b.id + '">' + (skipped ? 'Undo skip' : 'Skip today') + '</button>' : '') +
          '<button class="rt-btn rt-del" data-rt-del="' + b.id + '" aria-label="Delete">' + App.icon('x', 24) + '</button></div>';
      }).join('');
      var late = p.late && p.late.date === today;
      return '<div class="sheet-pad rt" style="' + App.pstyle(p) + '"><div class="label">Routine</div><h2 class="serif sheet-h">' + App.esc(p.name) + '</h2>' +
        '<p class="rt-now">' + App.esc(w.text) + '</p>' +
        '<div class="rt-late"><span>Running late? Home at ~</span>' + [15, 30, 60].map(function (m) { return '<button class="rt-chip" data-rt-late="' + m + '">+' + (m < 60 ? m + 'm' : '1h') + '</button>'; }).join('') +
        '<input type="time" class="rt-time" data-rt-lateat value="' + (late ? p.late.until : '') + '">' + (late ? '<button class="rt-chip" data-rt-late="0">Clear</button>' : '') + '</div>' +
        '<div class="rt-list">' + (rows || '<p class="rt-empty">No routine yet — add work, school or bedtime so the frame knows where everyone is.</p>') + '</div>' +
        '<button class="btn rt-add" data-rt-new>+ Add to routine</button></div>';
    }
    function form(b) {
      return '<div class="sheet-pad rt" style="' + App.pstyle(p) + '"><div class="label">' + App.esc(p.name) + ' · routine</div><h2 class="serif sheet-h">' + (b.id ? 'Edit' : 'Add') + '</h2>' +
        '<div class="rt-f"><span>Type</span><div class="rt-chips">' + TYPES.map(function (t) { return '<button class="rt-chip' + (b.type === t[0] ? ' is-on' : '') + '" data-f-type="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div></div>' +
        '<div class="rt-f"><span>Name</span><input class="rt-in" data-f-label value="' + App.esc(b.label || '') + '" placeholder="' + (NAMES[b.type] || 'e.g. Soccer') + '"></div>' +
        '<div class="rt-f"><span>Days</span><div class="rt-chips">' + [1, 2, 3, 4, 5, 6, 0].map(function (d) { return '<button class="rt-chip' + ((b.days || []).indexOf(d) > -1 ? ' is-on' : '') + '" data-f-day="' + d + '">' + DAYN[d] + '</button>'; }).join('') + '</div></div>' +
        '<div class="rt-f rt-times"><label><span>Start</span><input type="time" class="rt-in" data-f-start value="' + (b.start || '') + '"></label>' +
        (b.type === 'bed' || b.type === 'wake' ? '' : '<label><span>End</span><input type="time" class="rt-in" data-f-end value="' + (b.end || '') + '"></label>') + '</div>' +
        '<div class="rt-actions"><button class="btn" data-rt-cancel>Cancel</button><button class="btn btn--solid" data-rt-save>Save</button></div></div>';
    }
    function draw(sh) { sh.querySelector('.rt-body').innerHTML = st.edit ? form(st.edit) : list(); }
    App.sheet('<div class="rt-body"></div>', { cls: 'sheet--routine', onMount: function (sh) {
      draw(sh);
      sh.addEventListener('click', function (ev) {
        var t = ev.target.closest('button'); if (!t) return;
        var d = t.dataset, today = ymd(App.now()), R = p.routine = p.routine || [];
        var find = function (id) { return R.filter(function (b) { return b.id === id; })[0]; };
        if (d.rtNew != null) { st.edit = { type: 'work', days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' }; return draw(sh); }
        if (d.rtEdit) { st.edit = JSON.parse(JSON.stringify(find(d.rtEdit))); return draw(sh); }
        if (d.rtCancel != null) { st.edit = null; return draw(sh); }
        if (d.rtDel) { var b0 = find(d.rtDel); if (!confirm('Delete ' + label(b0) + '?')) return; p.routine = R.filter(function (b) { return b.id !== d.rtDel; }); saveRoutine(p); App.rerender(); return draw(sh); }
        if (d.rtSkip) { var b1 = find(d.rtSkip), sk = (b1.skip || []).filter(function (x) { return x >= today; }); b1.skip = sk.indexOf(today) > -1 ? sk.filter(function (x) { return x !== today; }) : sk.concat(today); if (!b1.skip.length) delete b1.skip; saveRoutine(p); App.rerender(); return draw(sh); }
        if (d.rtLate != null) { var m = +d.rtLate; if (!m) delete p.late; else { var base = App.now(), w = App.whereIs(p), mm = /home ~(\d+)(?::(\d+))?/.exec(w.text); var x = new Date(base.getTime() + m * 60000); p.late = { date: today, until: ('0' + x.getHours()).slice(-2) + ':' + ('0' + x.getMinutes()).slice(-2) }; }
          saveRoutine(p); App.rerender(); return draw(sh); }
        if (d.fType) { st.edit.type = d.fType; if (d.fType === 'bed' || d.fType === 'wake') delete st.edit.end; return draw(sh); }
        if (d.fDay != null) { var dd = +d.fDay, ds = st.edit.days || []; st.edit.days = ds.indexOf(dd) > -1 ? ds.filter(function (x) { return x !== dd; }) : ds.concat(dd); return draw(sh); }
        if (d.rtSave != null) {
          var e = st.edit, lab = sh.querySelector('[data-f-label]').value.trim(), s0 = sh.querySelector('[data-f-start]').value, e0 = sh.querySelector('[data-f-end]');
          if (!s0 || !(e.days || []).length) return App.toast && App.toast('Pick days and a start time');
          var out = { id: e.id || uid(), type: e.type, label: lab || NAMES[e.type] || 'Busy', days: e.days.slice().sort(), start: s0 };
          if (e0 && e0.value) out.end = e0.value; if (e.skip) out.skip = e.skip;
          p.routine = R.filter(function (b) { return b.id !== out.id; }).concat(out);
          st.edit = null; saveRoutine(p); App.rerender(); return draw(sh);
        }
      });
      sh.addEventListener('change', function (ev) {
        if (ev.target.matches('[data-rt-lateat]') && ev.target.value) { p.late = { date: ymd(App.now()), until: ev.target.value }; saveRoutine(p); App.rerender(); draw(sh); }
      });
    } });
  };
})();
