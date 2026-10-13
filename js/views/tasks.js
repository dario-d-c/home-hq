// Tasks / chores: one lane per person + "Anyone", scoped to the current time-of-day routine.
(function () {
  'use strict';
  var D = window.DATA;
  var V = { el: null, routine: null, pending: {}, span: localStorage.getItem('hq-chspan') || 'today' };
  function lanes() { return D.people.map(function (p) { return p.id; }).concat(['any']); }

  var ANY = { id: 'anytime', name: 'Anytime', range: 'Any time today' };
  function mode() { return V.routine || ((App.look && App.look.choresView) === 'now' ? null : 'all'); }
  function rOf(c) { return D.routines.filter(function (r) { return r.id === c.r; })[0] || ANY; }
  function routine() { if (V.routine && V.routine !== 'all') return D.routines.filter(function (r) { return r.id === V.routine; })[0]; return V.routine ? D.routines.filter(function (r) { return r.id === V.routine; })[0] : App.currentRoutine(); }
  function listFor(who, r) {
    return D.chores.filter(function (c) { return c.r === r.id && c.who === who; })
      .sort(function (a, b) { return (a.done - b.done) || ((b.overdue ? 1 : 0) - (a.overdue ? 1 : 0)); });
  }

  function row(c, p) {
    var pend = V.pending[c.id];
    return '<button class="ch' + (c.done ? ' is-done' : '') + (pend ? ' is-checking' : '') + (c.overdue && !c.done ? ' is-overdue' : '') + '" data-ch="' + c.id + '">' +
      '<span class="ch-emoji">' + c.emoji + '<span class="ch-check"><svg viewBox="0 0 24 24" width="30" height="30"><path d="M5 12.5l4.5 4.5L19 7"/></svg></span></span>' +
      '<span class="ch-text"><b>' + App.esc(c.title) + '</b>' +
      (c.overdue && !c.done ? '<small class="ch-late">Overdue</small>' : c.stars ? '<small>' + App.icon('star', 14, 'i--fill') + c.stars + (c.doneBy ? ' · ' + App.person(c.doneBy).name : '') + '</small>' : (c.doneBy ? '<small>by ' + App.person(c.doneBy).name + '</small>' : '')) +
      '</span>' +
      '</button>';
  }

  function weekGrid(id) {
    var w = D.week[id];
    if (!w) return '';
    var today = (App.now().getDay() + 6) % 7;
    return '<div class="ch-week"><div class="label">This week</div><div class="ch-week-row">' + ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(function (d, i) {
      var cls = i > today ? 'is-future' : i === today ? 'is-today' : (w[i] ? 'is-hit' : 'is-miss');
      return '<span class="' + cls + '"><i></i>' + d + '</span>';
    }).join('') + '</div></div>';
  }

  function lane(who, r) {
    var p = App.person(who), list = listFor(who, r);
    var done = list.filter(function (c) { return c.done; }).length;
    var all = list.length && done === list.length;
    var kid = D.stars[who] != null;
    return '<section class="ch-lane' + (all ? ' is-complete' : '') + '" data-lane="' + who + '" style="' + App.pstyle(p) + '">' +
      '<header class="ch-head">' + App.avatar(p, 42) +
      '<div><b>' + (who === 'any' ? 'Anyone' : p.name) + '</b>' +
      (kid ? '<span class="ch-stars">' + App.icon('star', 18, 'i--fill') + '<span class="num">' + D.stars[who] + '</span></span>' : '<span class="ch-sub">' + (who === 'any' ? 'Up for grabs' : (list.length ? done + ' of ' + list.length : 'Nothing')) + '</span>') + '</div>' +
      '<div class="ch-ring">' + App.ring(done, list.length || 1, 46) + '<span class="num">' + (all ? '✓' : list.length ? done + '/' + list.length : '–') + '</span></div>' +
      '</header>' +
      '<div class="ch-list">' + (list.length ? list.map(function (c) { return row(c, p); }).join('') : '<div class="ch-none serif"><i>Nothing this ' + (r.id === 'evening' ? 'evening' : r.id === 'morning' ? 'morning' : 'afternoon') + '</i></div>') +
      (all ? '<div class="ch-alldone serif">All done<i>!</i></div>' : '') + '</div>' +
      weekGrid(who) +
      '</section>';
  }

  // "All day": stacked rows (Anytime if any, Morning, After school, Evening) × person columns
  function chip(c) {
    return '<button class="cha' + (c.done ? ' is-done' : '') + (V.pending[c.id] ? ' is-checking' : '') + '" data-ch="' + c.id + '"><span class="cha-e">' + c.emoji + '</span><span class="cha-t">' + App.esc(c.title) + '</span>' +
      (c.stars ? '<span class="cha-s">' + c.stars + '★</span>' : '') + (c.done ? '<span class="cha-ok">✓</span>' : '') + '</button>';
  }
  function seg(on) {
    return '<div class="seg"><button class="' + (on === 'all' ? 'is-on' : '') + '" data-r="all">All day</button>' + D.routines.map(function (x) { return '<button class="' + (x.id === on ? 'is-on' : '') + '" data-r="' + x.id + '">' + x.name + '</button>'; }).join('') + '</div>';
  }
  function spanSeg() { return '<div class="t-span"><button class="' + (V.span !== 'week' ? 'is-on' : '') + '" data-span="today">Today</button><button class="' + (V.span === 'week' ? 'is-on' : '') + '" data-span="week">Week</button></div>'; }
  // ---- week view + day sheet
  var SLOTS = [['anytime', 'Anytime'], ['morning', 'Morning'], ['after', 'After school'], ['evening', 'Evening']];
  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function raw() { return D.choresRaw || []; }
  function slotsOf(c) { var r = Array.isArray(c.r) ? c.r : c.r ? [c.r] : []; return r.length ? r : ['after']; }
  function whosOf(c) { return Array.isArray(c.who) ? (c.who.length ? c.who : ['any']) : [c.who || 'any']; }
  // instances on a date: [{c, slot, who, inst (today's live instance or null)}]
  function onDay(day) {
    var isT = day === ymd(App.now()), out = [];
    raw().forEach(function (c) { if (window.HQChoreOn && !window.HQChoreOn(c, day)) return; var ws = whosOf(c);
      slotsOf(c).forEach(function (sl) { ws.forEach(function (w) { var id = c.id + '@' + sl + (ws.length > 1 ? '@' + w : '');
        out.push({ c: c, slot: sl, who: w, inst: isT ? D.chores.filter(function (x) { return x.id === id; })[0] || null : null }); }); }); });
    return out;
  }
  function weekDays() { var n = App.dayStart(App.now()), sun = App.look && App.look.weekStart === 'sun'; var s0 = App.addDays(n, -(sun ? n.getDay() : (n.getDay() + 6) % 7)); return [0, 1, 2, 3, 4, 5, 6].map(function (i) { return App.addDays(s0, i); }); }
  function dayCard(d) {
    var day = ymd(d), isT = day === ymd(App.now()), list = onDay(day), done = list.filter(function (x) { return x.inst && x.inst.done; }).length;
    var ppl = {}; list.forEach(function (x) { (ppl[x.who] = ppl[x.who] || { n: 0, d: 0 }).n++; if (x.inst && x.inst.done) ppl[x.who].d++; });
    var groups = SLOTS.map(function (s) { var l = list.filter(function (x) { return x.slot === s[0]; }); return l.length ? '<div class="cw-slot"><em>' + s[1] + '</em>' + l.map(function (x) { var p = App.person(x.who);
      return '<span class="cw-ch' + (x.inst && x.inst.done ? ' is-done' : '') + '" style="' + App.pstyle(p) + '"><i></i>' + x.c.emoji + ' ' + App.esc(x.c.title) + '</span>'; }).join('') + '</div>' : ''; }).join('');
    return '<section class="cw-day' + (isT ? ' is-today' : '') + '" data-chday="' + day + '" role="button"><header><b>' + App.fmt.dayShort(d) + '</b><span class="num">' + d.getDate() + '</span>' +
      (isT ? '<small>Today · ' + done + '/' + list.length + '</small>' : '<small>' + list.length + ' chore' + (list.length === 1 ? '' : 's') + '</small>') + '<span class="cw-ppl">' +
      Object.keys(ppl).map(function (w) { var p = App.person(w), x = ppl[w]; return '<span class="cw-dot' + (isT && x.d === x.n ? ' is-done' : '') + '" style="' + App.pstyle(p) + '" title="' + App.esc(w === 'any' ? 'Anyone' : p.name) + '">' + App.esc((w === 'any' ? '★' : p.name[0])) + '</span>'; }).join('') + '</span></header>' +
      (groups || '<p class="cw-none"><i>No chores</i></p>') + '</section>';
  }
  function renderWeek() {
    var days = weekDays(), all = raw().length;
    V.el.innerHTML = '<div class="tasks tasks--week">' +
      '<header class="t-head"><div class="t-title"><div class="label">Chores</div><h1 class="serif">This week</h1></div>' + spanSeg() +
      '<button class="view-add" data-view-add="chores" data-r="' + App.currentRoutine().id + '">＋ Add chore</button></header>' +
      '<div class="cw-grid">' + days.map(dayCard).join('') + '</div>' + (all ? '' : '<p class="ch-none serif"><i>No chores yet</i></p>') + '</div>';
  }
  function daySheet(day) {
    var p0 = day.split('-'), d = new Date(+p0[0], +p0[1] - 1, +p0[2]), isT = day === ymd(App.now());
    function body() {
      var list = onDay(day);
      var html = SLOTS.map(function (s) { var l = list.filter(function (x) { return x.slot === s[0]; }); if (!l.length) return '';
        return '<div class="label cs-slot">' + s[1] + '</div><div class="cs-list">' + l.map(function (x) { var p = App.person(x.who), dn = x.inst && x.inst.done;
          return '<div class="cs-row' + (dn ? ' is-done' : '') + '" style="' + App.pstyle(p) + '">' +
            (isT && x.inst ? '<button class="cs-tick" data-cs-tick="' + x.inst.id + '" aria-label="' + (dn ? 'Untick' : 'Tick off') + '">' + (dn ? '✓' : '') + '</button>' : '<span class="cs-tick cs-tick--off"></span>') +
            '<button class="cs-main" data-cs-open="' + x.c.id + '"><b>' + x.c.emoji + ' ' + App.esc(x.c.title) + '</b><small>' + App.esc(x.who === 'any' ? 'Anyone' : p.name) + (x.c.stars ? ' · ' + x.c.stars + '★' : '') +
              (x.c.date ? ' · just this day' : x.c.days && x.c.days.length ? ' · some days' : ' · every day') + (dn && x.inst.doneBy ? ' · done by ' + App.esc(App.person(x.inst.doneBy).name) : '') + '</small></button>' +
            (App.parent ? '<button class="cs-del" data-cs-del="' + x.c.id + '" aria-label="Delete">🗑</button>' : '') + '</div>'; }).join('') + '</div>'; }).join('');
      return '<div class="sheet-pad cs"><div class="label">Chores</div><h2 class="serif sheet-h">' + App.fmt.dayShort(d) + ' ' + App.fmt.monthShort(d) + ' ' + d.getDate() + (isT ? ' · Today' : '') + '</h2>' +
        (html || '<p class="cw-none"><i>No chores this day</i></p>') + (!isT && list.length ? '<p class="cs-note">Ticking off works on the day itself.</p>' : '') +
        (App.parent ? '<button class="cs-add" data-cs-add>＋ Add chore for this day</button>' : '') + '</div>';
    }
    App.sheet(body(), { cls: 'sheet--chday', onMount: function (el) {
      el.addEventListener('click', function (ev) { var t;
        if ((t = ev.target.closest('[data-cs-tick]'))) { var c = D.chores.filter(function (x) { return x.id === t.dataset.csTick; })[0]; if (!c || V.pending[c.id]) return;
          if (c.done) { c.done = false; var er = D.stars[c.who] != null ? c.who : (c.doneBy && D.stars[c.doneBy] != null ? c.doneBy : null); if (er && c.stars) D.stars[er] -= c.stars; delete c.doneBy; App.emit('data'); render(); el.querySelector('.sheet-pad').outerHTML = body(); return; }
          if (c.who === 'any') { App.closeSheet(); return setTimeout(function () { whoDidIt(c, document.createElement('i')); }, 60); }
          complete(c, document.createElement('i')); setTimeout(function () { var sp = el.querySelector('.sheet-pad'); if (sp) sp.outerHTML = body(); }, 450); return; }
        if ((t = ev.target.closest('[data-cs-open]'))) { if (!App.parent) return; App.closeSheet(); var id = t.dataset.csOpen; return setTimeout(function () { App.editEmbed('tab=chores&open=' + encodeURIComponent(id), 'Chore'); }, 60); }
        if ((t = ev.target.closest('[data-cs-del]'))) { App.closeSheet(); var id2 = t.dataset.csDel; return setTimeout(function () { App.editEmbed('tab=chores&open=' + encodeURIComponent(id2) + '&act=delete&date=' + day, 'Delete chore'); }, 60); }
        if (ev.target.closest('[data-cs-add]')) { App.closeSheet(); setTimeout(function () { App.editEmbed('tab=chores&add=1&date=' + day + '&r=' + App.currentRoutine().id, 'New chore'); }, 60); }
      });
    } });
  }
  App.choreDaySheet = daySheet;
  function renderAll() {
    var auto = App.currentRoutine(), L = lanes();
    var rows = (D.chores.some(function (c) { return c.r === 'anytime'; }) ? [ANY] : []).concat(D.routines);
    var done = D.chores.filter(function (c) { return c.done; }).length;
    var head = '<div class="ad-corner"></div>' + L.map(function (w) {
      var p = App.person(w), kid = D.stars[w] != null;
      return '<div class="ad-who" style="' + App.pstyle(p) + '">' + App.avatar(p, 30) + '<b>' + (w === 'any' ? 'Anyone' : App.esc(p.name)) + '</b>' + (kid ? '<span class="ch-stars">' + App.icon('star', 14, 'i--fill') + '<span class="num">' + D.stars[w] + '</span></span>' : '') + '</div>';
    }).join('');
    var body = rows.map(function (r) {
      var now = r.id === auto.id ? ' is-now' : '';
      return '<div class="ad-row' + now + '"><b>' + r.name + '</b><small>' + (now ? 'Now · ' : '') + r.range + '</small></div>' + L.map(function (w) {
        var list = D.chores.filter(function (c) { return c.r === r.id && c.who === w; }).sort(function (a, b) { return a.done - b.done; });
        return '<div class="ad-cell' + now + '" style="' + App.pstyle(App.person(w)) + '">' + list.map(chip).join('') + '</div>';
      }).join('');
    }).join('');
    if (App.portrait && D.chores.length) {
      // portrait: one section per person, a row per time of day
      body = L.map(function (w) {
        var mine = D.chores.filter(function (c) { return c.who === w; });
        if (!mine.length) return '';
        var p = App.person(w), kid = D.stars[w] != null;
        return '<section class="adp-sec" style="' + App.pstyle(p) + '"><header>' + App.avatar(p, 34) + '<b>' + (w === 'any' ? 'Anyone' : App.esc(p.name)) + '</b>' +
          (kid ? '<span class="ch-stars">' + App.icon('star', 16, 'i--fill') + '<span class="num">' + D.stars[w] + '</span></span>' : '') + '</header>' +
          rows.map(function (r) {
            var list = mine.filter(function (c) { return c.r === r.id; }).sort(function (a, b) { return a.done - b.done; });
            if (!list.length) return '';
            return '<div class="adp-row' + (r.id === auto.id ? ' is-now' : '') + '"><span>' + r.name + '</span><div>' + list.map(chip).join('') + '</div></div>';
          }).join('') + '</section>';
      }).join('');
    }
    V.el.innerHTML = '<div class="tasks">' +
      '<header class="t-head"><div class="t-title"><div class="label">Today</div><h1 class="serif">All day</h1></div>' + spanSeg() + seg('all') + '<button class="view-add" data-view-add="chores" data-r="' + App.currentRoutine().id + '">＋ Add chore</button>' +
      '<div class="t-progress"><span class="num">' + done + '<small>/' + D.chores.length + '</small></span><div class="t-bar"><i style="width:' + (D.chores.length ? done / D.chores.length * 100 : 0) + '%"></i></div><span class="label">done</span></div></header>' +
      (D.chores.length && App.portrait ? '<div class="adp">' + body + '</div>' : D.chores.length ? '<div class="ad-grid" style="grid-template-columns:132px repeat(' + L.length + ', minmax(0, 1fr));grid-template-rows:auto repeat(' + rows.length + ', minmax(0, 1fr))">' + head + body + '</div>'
        : '<div class="ch-none serif" style="margin:auto"><i>No chores yet — tap ✎ Edit to add some</i></div>') + '</div>';
  }

  function render() {
    if (V.span === 'week') return renderWeek();
    if (mode() === 'all') return renderAll();
    var r = routine(), auto = App.currentRoutine();
    var inR = D.chores.filter(function (c) { return c.r === r.id; });
    var done = inR.filter(function (c) { return c.done; }).length;
    V.el.innerHTML = '<div class="tasks">' +
      '<header class="t-head">' +
      '<div class="t-title"><div class="label">' + (r.id === auto.id ? 'Right now · ' : '') + r.range + '</div><h1 class="serif">' + r.name + '</h1></div>' +
      spanSeg() + seg(r.id) + '<button class="view-add" data-view-add="chores" data-r="' + r.id + '">＋ Add chore</button>' +
      '<div class="t-progress"><span class="num">' + done + '<small>/' + inR.length + '</small></span><div class="t-bar"><i style="width:' + (inR.length ? done / inR.length * 100 : 0) + '%"></i></div><span class="label">done</span></div>' +
      '</header>' +
      '<div class="ch-lanes">' + lanes().map(function (w) { return lane(w, r); }).join('') + '</div>' +
      '</div>';
  }

  function complete(c, btn, by) {
    var r = rOf(c);
    V.pending[c.id] = true;
    btn.classList.add('is-checking');
    setTimeout(function () {
      delete V.pending[c.id];
      c.done = true;
      if (by) c.doneBy = by;
      var earner = D.stars[c.who] != null ? c.who : (by && D.stars[by] != null ? by : null);
      if (earner && c.stars) D.stars[earner] += c.stars;
      render();
      App.emit('data');
      var laneList = listFor(c.who, r);
      var laneDone = laneList.every(function (x) { return x.done; });
      var allDone = D.chores.filter(function (x) { return x.r === r.id; }).every(function (x) { return x.done; });
      if (allDone) {
        App.toast('<b>' + r.name + ' routine complete!</b> Everyone crushed it.', { icon: 'star', ms: 5000 });
        return;
      }
      App.toast('<b>' + App.esc(c.title) + '</b> done' + (earner && c.stars ? ' · +' + c.stars + '★ ' + App.person(earner).name : ''), {
        icon: 'check',
        undo: function () {
          c.done = false;
          delete c.doneBy;
          if (earner && c.stars) D.stars[earner] -= c.stars;
          render();
          App.emit('data');
        }
      });
    }, 350);
  }

  // "Anyone" chores ask who did it, so stars go to the right kid
  function whoDidIt(c, btn) {
    App.sheet('<div class="sheet-pad"><div class="label">' + c.emoji + ' ' + App.esc(c.title) + '</div><h2 class="serif sheet-h">Who did it?</h2>' +
      '<div class="add-who add-who--big">' + D.people.map(function (p) {
        return '<button class="who-btn" data-by="' + p.id + '" style="' + App.pstyle(p) + '">' + App.avatar(p, 88) + '<span>' + p.name + '</span></button>';
      }).join('') + '</div></div>', {
      onMount: function (s, close) {
        s.addEventListener('click', function (e) {
          var b = e.target.closest('[data-by]');
          if (!b) return;
          close();
          var fresh = V.el.querySelector('[data-ch="' + c.id + '"]');
          complete(c, fresh || btn, b.dataset.by);
        });
      }
    });
  }

  function onClick(e) {
    var t;
    if ((t = e.target.closest('[data-span]'))) { V.span = t.dataset.span; localStorage.setItem('hq-chspan', V.span); return render(); }
    if ((t = e.target.closest('[data-chday]'))) return daySheet(t.dataset.chday);
    if ((t = e.target.closest('[data-r]'))) { var v = t.dataset.r, def = (App.look && App.look.choresView) === 'now' ? 'now' : 'all';
      V.routine = (v === 'all' && def === 'all') || (def === 'now' && v === App.currentRoutine().id) ? null : v; return render(); }
    if ((t = e.target.closest('[data-ch]'))) {
      var c = D.chores.filter(function (x) { return x.id === t.dataset.ch; })[0];
      if (!c || V.pending[c.id]) return;
      if (c.done) {
        c.done = false;
        var earner = D.stars[c.who] != null ? c.who : (c.doneBy && D.stars[c.doneBy] != null ? c.doneBy : null);
        if (earner && c.stars) D.stars[earner] -= c.stars;
        delete c.doneBy;
        render();
        App.emit('data');
        return;
      }
      if (c.who === 'any') return whoDidIt(c, t);
      complete(c, t);
    }
  }

  App.register('tasks', {
    show: function (el) {
      if (!V.el) { V.el = el; el.addEventListener('click', onClick); }
      render();
    }
  });
  App.on('time', function () { V.routine = null; });
})();
