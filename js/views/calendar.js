// Calendar: Today-by-person lanes (default), 3-day, rolling week, month.
(function () {
  'use strict';
  var D = window.DATA;
  var PX = 72, START = 6, END = 23, START0 = 6, END0 = 23; // 72px per hour, 6 AM → 11 PM
  var V = { mode: 'day', date: null, el: null, scroll: null };
  var MODES = [['day', 'Today'], ['3day', '3 Day'], ['week', 'Week'], ['month', 'Month']];

  function y(d) { return ((d.getHours() + d.getMinutes() / 60) - START) * PX; }
  function clampTop(e, day) {
    var s = App.dayStart(day);
    var a = e.start < s ? new Date(+s + START * 36e5) : e.start;
    var endOfDay = new Date(+s + END * 36e5);
    var b = e.end > endOfDay ? endOfDay : e.end;
    return { top: Math.max(0, y(a)), h: Math.max(24, y(b) - Math.max(0, y(a)) - 3) };
  }

  // Overlap layout → [{e, col, cols}] (cols capped at 2, extra returned as overflow groups)
  function layout(evs) {
    var out = [], clusters = [], cur = null, curEnd = 0;
    evs.forEach(function (e) {
      if (!cur || +e.start >= curEnd) { cur = []; clusters.push(cur); curEnd = 0; }
      cur.push(e); curEnd = Math.max(curEnd, +e.end);
    });
    clusters.forEach(function (c) {
      var cols = [], placed = [];
      c.forEach(function (e) {
        var i = cols.findIndex(function (end) { return end <= +e.start; });
        if (i < 0) { i = cols.length; cols.push(0); }
        cols[i] = +e.end;
        placed.push({ e: e, col: i });
      });
      var n = cols.length;
      if (n <= 2) placed.forEach(function (p) { out.push({ e: p.e, col: p.col, cols: n }); });
      else {
        var extra = placed.filter(function (p) { return p.col > 0; }).map(function (p) { return p.e; });
        placed.filter(function (p) { return p.col === 0; }).forEach(function (p) { out.push({ e: p.e, col: 0, cols: 2 }); });
        out.push({ more: extra, col: 1, cols: 2, start: new Date(Math.min.apply(null, extra.map(function (e) { return +e.start; }))), end: new Date(Math.max.apply(null, extra.map(function (e) { return +e.end; }))) });
      }
    });
    return out;
  }

  function compact(d) { var h = d.getHours(), m = d.getMinutes(); return (h % 12 || 12) + (m ? ':' + ('0' + m).slice(-2) : '') + (h < 12 ? 'a' : 'p'); }
  function evBlock(e, style, opts) {
    opts = opts || {};
    var now = App.now();
    var p = opts.color || App.evColor(e);
    var mins = (e.end - e.start) / 60000;
    var cls = 'ev' + (e.end <= now ? ' is-past' : '') + (e.start <= now && e.end > now ? ' is-now' : '') + (mins < 45 ? ' is-short' : '') + (App.isFamily(e) ? ' is-family' : '') + (opts.half ? ' is-half' : '') + (e.routine ? ' is-routine' : '');
    var others = opts.lane ? e.people.filter(function (id) { return id !== opts.lane; }) : ((e.people.length > 1 || ONE) && !App.isFamily(e) ? e.people : []);
    var travel = e.travel ? '<span class="ev-travel" style="height:' + (e.travel * PX / 60) + 'px"></span>' : '';
    var ed = editable(e) && (V.mode === 'day' || V.mode === '3day');
    if (ed) cls += ' is-edit';
    return '<button class="' + cls + '" data-ev="' + e.id + '" style="' + (opts.color ? App.pstyle(p) : App.evStyle(e)) + ';' + style + '">' + travel + (ed ? '<span class="ev-rs" aria-hidden="true"></span>' : '') +
      '<span class="ev-title">' + App.esc(e.title) + '</span>' +
      '<span class="ev-meta">' + (e.routine ? compact(e.start) + (e.end ? '–' + compact(e.end) : '') + ' <i class="ev-tap">✎</i>' : App.fmt.range(e.start, e.end)) + (e.travel ? ' · <b>' + App.icon('car', 16) + 'Leave ' + App.fmt.time(App.leaveBy(e), false) + '</b>' : '') + '</span>' +
      (others.length && !App.isFamily(e) ? '<span class="ev-with">' + App.dots(others, 14) + '</span>' : '') +
      (App.isFamily(e) ? '<span class="ev-with">' + App.dots(D.ALL, 14) + '</span>' : '') +
      '</button>';
  }

  function placeBlocks(all, colorFn, laneId) {
    var rts = all.filter(function (e) { return e.routine; }), list = all.filter(function (e) { return !e.routine; });
    // routines sit underneath as a soft full-width band; real events get the right-hand 78% so the routine label stays readable
    var inset = rts.length && list.length ? 22 : 0;
    var bg = layout(rts).map(function (it) {
      if (it.more) return '';
      var e = it.e, b = clampTop(e, V.date), w = 100 / it.cols;
      return evBlock(e, 'top:' + b.top + 'px;height:' + b.h + 'px;left:' + (2 + it.col * 12) + 'px;right:2px', { lane: laneId, color: colorFn ? colorFn(e) : null });
    }).join('');
    return bg + layout(list).map(function (it) {
      var w = (100 - inset) / it.cols, left = inset + it.col * w;
      if (it.more) {
        var t = y(it.start), h = Math.max(30, y(it.end) - t - 3);
        return '<button class="ev ev--more" data-moreday="' + (+App.dayStart(V.date)) + '" data-more="' + it.more.map(function (e) { return e.id; }).join(',') + '" style="top:' + t + 'px;height:' + h + 'px;left:calc(' + left + '% + 2px);width:calc(' + w + '% - 4px)">+' + it.more.length + '<small>more</small></button>';
      }
      var b = clampTop(it.e, V.date);
      return evBlock(it.e, 'top:' + b.top + 'px;height:' + b.h + 'px;left:calc(' + left + '% + 2px);width:calc(' + w + '% - 4px)', { lane: laneId, color: colorFn ? colorFn(it.e) : null, half: it.cols > 1 });
    }).join('');
  }

  function hoursCol() {
    var h = '';
    for (var i = START; i <= END; i++) {
      h += '<div class="hr" style="top:' + (i - START) * PX + 'px"><span>' + (i === 12 ? 'Noon' : (i % 12 || 12) + (i < 12 ? ' AM' : ' PM')) + '</span></div>';
    }
    return h;
  }
  function nowLine(days) {
    var now = App.now(), idx = -1;
    days.forEach(function (d, i) { if (App.sameDay(d, now)) idx = i; });
    if (idx < 0 || now.getHours() < START || now.getHours() >= END) return '';
    return '<div class="now-line" style="top:' + y(now) + 'px"><span class="num">' + App.fmt.time(now, false) + '</span></div>';
  }

  // meals strip for a day: planned meals + school breakfast/lunch (weekly templates), skipped on no-school days
  function dayMeals(day) {
    var ds = day.getFullYear() + '-' + ('0' + (day.getMonth() + 1)).slice(-2) + '-' + ('0' + day.getDate()).slice(-2), out = [];
    var LBL = { breakfast: 'Breakfast', lunch: 'Lunch', school: 'School lunch', dinner: 'Dinner', snack: 'Snack' };
    (D.meals || []).filter(function (m) { return m.date === ds; }).forEach(function (m) { out.push('<span><em>' + (LBL[m.slot] || m.slot || 'Meal') + '</em> ' + App.esc(m.title || m.name || '') + '</span>'); });
    var kid = (D.people || []).filter(function (p) { return p.role !== 'parent' && p.school; })[0];
    if (kid && App.weeklyMenu) {
      var b = App.weeklyMenu(kid.id, day, 'breakfast'); if (b) out.unshift('<span><em>School breakfast</em> ' + App.esc(b.days[day.getDay()]) + '</span>');
      if (!(D.meals || []).some(function (m) { return m.date === ds && m.slot === 'school'; })) { var l = App.weeklyMenu(kid.id, day, 'lunch'); if (l) out.push('<span><em>School lunch</em> ' + App.esc(l.days[day.getDay()]) + '</span>'); }
    }
    var wx = App.wxBadge ? App.wxBadge(day) : '';
    return out.length || wx ? '<div class="day-meals">' + wx + out.join('') + '</div>' : '';
  }

  // ------------------------------------------------------------ Today (lanes per person)
  var ONE = false;   // phone day view: one shared timeline, every block shows its people as colour dots
  function dayView() {
    var day = V.date;
    if (document.documentElement.classList.contains('is-phone')) {
      ONE = true;
      var ad1 = App.allDayOn(day), out;
      out = '<div class="cal-day cal-one">' + dayMeals(day) +
        (ad1.length ? '<div class="allday"><div class="gutter label">All day</div><div class="allday-grid allday-grid--one">' + ad1.map(function (e) {
          return '<button class="ad" data-ev="' + e.id + '" style="' + App.evStyle(e) + '">' + App.esc(e.title) + (App.isFamily(e) ? '' : ' <span class="ev-with">' + App.dots(e.people, 12) + '</span>') + '</button>';
        }).join('') + '</div></div>' : '') +
        '<div class="grid-scroll"><div class="grid" style="height:' + (END - START) * PX + 'px"><div class="hours">' + hoursCol() + '</div>' +
        '<div class="lanes lanes--one"><div class="lane">' + placeBlocks(App.timedOn(day)) + '</div></div>' + nowLine([day]) + '</div></div>' +
        (!App.timedOn(day).length && !ad1.length ? '<div class="cal-empty serif">Nothing on the calendar.<br><i>A rare, quiet day.</i></div>' : '') + '</div>';
      ONE = false; return out;
    }
    var fam = App.timedOn(day).filter(function (e) { return !e.routine && (App.isFamily(e) || App.evPeople(e).length > 1); });
    var allDay = App.allDayOn(day);
    // shared all-day items: ONE chip spanning the people's columns when they're adjacent, otherwise the full row
    var ids0 = D.people.map(function (p) { return p.id; });
    function span(e) { var ix = App.evPeople(e).map(function (id) { return ids0.indexOf(id); }).filter(function (i) { return i > -1; }).sort(function (a, b) { return a - b; });
      if (!ix.length || App.isFamily(e)) return '1 / -1'; if (ix[ix.length - 1] - ix[0] === ix.length - 1) return (ix[0] + 1) + ' / ' + (ix[ix.length - 1] + 2); return '1 / -1'; }
    var ad = allDay.length ? '<div class="allday"><div class="gutter label">All day</div><div class="allday-grid" style="grid-template-columns:repeat(' + D.people.length + ', minmax(0, 1fr))">' + allDay.map(function (e) {
      var col = span(e);
      var s = App.dayStart(day), spanDays = Math.round((e.end - e.start) / 864e5), dayN = Math.round((s - e.start) / 864e5) + 1;
      return '<button class="ad' + (e.start < s ? ' ad--cont' : '') + '" data-ev="' + e.id + '" style="grid-column:' + col + ';' + App.evStyle(e) + '">' +
        (e.start < s ? App.icon('left', 16) : '') + App.esc(e.title) + (spanDays > 1 ? ' <small>Day ' + dayN + ' of ' + spanDays + '</small>' : '') + '</button>';
    }).join('') + '</div></div>' : '';
    var grid = '<div class="grid-scroll"><div class="grid" style="height:' + (END - START) * PX + 'px">' +
      '<div class="hours">' + hoursCol() + '</div>' +
      '<div class="lanes">' + D.people.map(function (p) {
        var list = App.timedOn(day, p.id).filter(function (e) { return !App.isFamily(e) && (e.routine || App.evPeople(e).length < 2); });
        return '<div class="lane" style="' + App.pstyle(p) + '">' + placeBlocks(list, null, p.id) + '</div>';
      }).join('') +
      '<div class="lane-fam">' + fam.map(function (e) {
        var b = clampTop(e, day), N = D.people.length, sp = span(e).split(' / '), a = 0, z = N;
        if (sp[1] !== '-1') { a = +sp[0] - 1; z = +sp[1] - 1; }
        return evBlock(e, 'top:' + b.top + 'px;height:' + b.h + 'px;left:calc(' + (a * 100 / N) + '% + 2px);width:calc(' + ((z - a) * 100 / N) + '% - 4px)');
      }).join('') + '</div>' +
      nowLine([day]) + '</div>' +
      '</div></div>';
    var empty = !App.timedOn(day).length ? '<div class="cal-empty serif">Nothing on the calendar.<br><i>A rare, quiet day.</i></div>' : '';
    return '<div class="cal-day">' + dayMeals(day) + ad + grid + empty + '</div>';
  }

  // ------------------------------------------------------------ 3 day
  function threeDay() {
    if (document.documentElement.classList.contains('is-phone')) return agenda(3);
    var days = [0, 1, 2].map(function (i) { return App.addDays(V.date, i); });
    var now = App.now();
    var anyAllDay = days.some(function (d) { return App.allDayOn(d).length; });
    var head = '<div class="lanes-head"><div class="gutter"></div>' + days.map(function (d) {
      var today = App.sameDay(d, now);
      return '<div class="day-head' + (today ? ' is-today' : '') + '" data-day="' + (+d) + '"><span class="num">' + d.getDate() + '</span><b class="dh-long">' + App.fmt.rel(d) + '</b><b class="dh-short">' + App.fmt.dayShort(d) + '</b><small>' + App.fmt.monthShort(d) + '</small></div>';
    }).join('') + '</div>';
    var ad = '';
    if (anyAllDay) {
      var s0 = App.dayStart(days[0]), s3 = App.addDays(s0, 3);
      var list = App.events().filter(function (e) { return e.allDay && e.start < s3 && e.end > s0; });
      ad = '<div class="allday"><div class="gutter label">All day</div><div class="allday-grid allday-grid--3">' + list.map(function (e) {
        var a = Math.max(0, Math.round((e.start - s0) / 864e5)), b = Math.min(3, Math.round((e.end - s0) / 864e5));
        return '<button class="ad' + (e.start < s0 ? ' ad--cont' : '') + '" data-ev="' + e.id + '" style="grid-column:' + (a + 1) + ' / ' + (b + 1) + ';' + App.evStyle(e) + '">' +
          (e.start < s0 ? App.icon('left', 16) : '') + App.esc(e.title) + (e.end > s3 ? App.icon('right', 16) : '') + '</button>';
      }).join('') + '</div></div>';
    }
    var grid = '<div class="grid-scroll"><div class="grid" style="height:' + (END - START) * PX + 'px">' +
      '<div class="hours">' + hoursCol() + '</div>' +
      '<div class="lanes lanes--3">' + days.map(function (d) {
        var save = V.date; V.date = d;
        var html = '<div class="lane' + (App.sameDay(d, now) ? ' is-today' : '') + '">' + placeBlocks(App.timedOn(d)) + '</div>';
        V.date = save;
        return html;
      }).join('') + '</div>' +
      nowLine(days).replace('now-line', 'now-line now-line--' + days.findIndex(function (d) { return App.sameDay(d, now); })) +
      '</div></div>';
    return '<div class="cal-day cal-3">' + head + ad + grid + '</div>';
  }

  // ------------------------------------------------------------ rolling week
  // phones: week and 3-day as an agenda — one full-width section per day, plain flow (no absolute headers)
  function agenda(n) {
    var now = App.now(), out = '';
    for (var i = 0; i < n; i++) {
      var d = App.addDays(V.date, i), today = App.sameDay(d, now);
      var ad = App.allDayOn(d), tm = App.timedOn(d).slice().sort(function (a, b) { return a.start - b.start; });
      var row = function (e) {
        var p = App.evColor(e);
        return '<button class="ag-row' + (e.routine ? ' is-routine' : '') + (e.end <= now ? ' is-past' : '') + '" data-ev="' + e.id + '" style="' + App.pstyle(p) + '">' +
          '<span class="ag-t">' + (e.routine ? compact(e.start) + (e.end ? '–' + compact(e.end) : '') : App.fmt.time(e.start, false)) + '</span>' +
          '<span class="ag-x"><b>' + App.esc(e.title) + '</b>' + (App.isFamily(e) ? '' : '<span class="ag-who">' + App.dots(e.people, 12) + '</span>') + '</span>' +
          (e.routine ? '<i class="ag-edit">✎</i>' : '') + '</button>';
      };
      out += '<section class="ag-day' + (today ? ' is-today' : '') + '">' +
        '<div class="ag-head" role="button" data-day="' + (+d) + '"><b>' + App.fmt.dayShort(d) + '</b><span class="num">' + d.getDate() + '</span><small>' + App.fmt.monthShort(d) + (today ? ' · Today' : '') + '</small>' +
        '<span class="ag-wx">' + (App.wxBadge ? App.wxBadge(d, true) : '') + '</span></div>' +
        (ad.length ? '<div class="ag-chips">' + ad.map(function (e) { return '<button class="ag-chip" data-ev="' + e.id + '" style="' + App.evStyle(e) + '">' + App.esc(e.title) + '</button>'; }).join('') + '</div>' : '') +
        (tm.length ? tm.map(row).join('') : (ad.length ? '' : '<div class="ag-free serif"><i>Free</i></div>')) + '</section>';
    }
    return '<div class="agenda">' + out + '</div>';
  }

  function weekView() {
    if (document.documentElement.classList.contains('is-phone')) return agenda(7);
    var now = App.now();
    return '<div class="week">' + [0, 1, 2, 3, 4, 5, 6].map(function (i) {
      var d = App.addDays(V.date, i), today = App.sameDay(d, now);
      var ad = App.allDayOn(d), list = App.timedOn(d), max = 7 - ad.length, more = list.length - max;
      return '<div class="wk-col' + (today ? ' is-today' : '') + '" data-day="' + (+d) + '">' +
        '<div class="wk-head"><b>' + App.fmt.dayShort(d) + '</b><span class="num">' + d.getDate() + '</span>' + (App.wxBadge ? App.wxBadge(d, true) : '') + '</div>' +
        ad.map(function (e) { return '<button class="wk-ad" data-ev="' + e.id + '" style="' + App.evStyle(e) + '">' + App.esc(e.title) + '</button>'; }).join('') +
        list.slice(0, max).map(function (e) {
          return '<button class="wk-ev' + (e.end <= now ? ' is-past' : '') + '" data-ev="' + e.id + '" style="' + App.evStyle(e) + '">' +
            '<span class="wk-t">' + App.fmt.time(e.start, false) + '</span><span class="wk-n">' + App.esc(e.title) + '</span></button>';
        }).join('') +
        (more > 0 ? '<button class="wk-more" data-day="' + (+d) + '">+' + more + ' more</button>' : '') +
        (!list.length && !ad.length ? '<div class="wk-free serif"><i>Free</i></div>' : '') +
        '</div>';
    }).join('') + '</div>';
  }

  // ------------------------------------------------------------ month (dots only)
  function monthView() {
    var now = App.now();
    var first = new Date(V.date.getFullYear(), V.date.getMonth(), 1);
    var sun = App.look && App.look.weekStart === 'sun';
    var start = App.addDays(first, -(sun ? first.getDay() : (first.getDay() + 6) % 7));
    var cells = '';
    for (var i = 0; i < 42; i++) {
      var d = App.addDays(start, i);
      var evs = App.allDayOn(d).concat(App.timedOn(d));
      var dots = evs.slice(0, 5).map(function (e) { return '<i style="' + App.evStyle(e) + '"></i>'; }).join('');
      // one-line chips (shown when the cell is big enough — see fitMonth); dots are the fallback
      var chips = evs.slice(0, 8).map(function (e) {
        return '<span class="mo-chip' + (e.allDay ? ' is-ad' : '') + '" style="' + App.evStyle(e) + '">' + (e.allDay ? '' : '<b>' + compact(e.start) + '</b> ') + App.esc(e.title) + '</span>';
      }).join('');
      cells += '<button class="mo-cell' + (d.getMonth() !== first.getMonth() ? ' is-out' : '') + (App.sameDay(d, now) ? ' is-today' : '') + '" data-day="' + (+d) + '" data-n="' + evs.length + '">' +
        '<span class="num">' + d.getDate() + '</span><span class="mo-chips">' + chips + '<em class="mo-more"></em></span><span class="mo-dots">' + dots + (evs.length > 5 ? '<em>+' + (evs.length - 5) + '</em>' : '') + '</span></button>';
    }
    return '<div class="month"><div class="mo-dow">' + (sun ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']).map(function (d) { return '<span class="label">' + d + '</span>'; }).join('') + '</div>' +
      '<div class="mo-grid">' + cells + '</div></div>';
  }

  // ------------------------------------------------------------ header
  function title() {
    var d = V.date, now = App.now();
    if (V.mode === 'day') return { k: App.fmt.month(d) + ' ' + d.getFullYear() + (App.sameDay(d, now) ? ' · Today' : ' · ' + App.fmt.rel(d)), t: App.fmt.day(d) + ' <i>' + d.getDate() + '</i>' };
    if (V.mode === '3day') { var e = App.addDays(d, 2); return { k: App.fmt.month(d) + ' ' + d.getFullYear(), t: App.fmt.dayShort(d) + ' ' + d.getDate() + ' <i>–</i> ' + App.fmt.dayShort(e) + ' ' + e.getDate() }; }
    if (V.mode === 'week') { var w = App.addDays(d, 6); return { k: 'Next 7 days', t: App.fmt.monthShort(d) + ' ' + d.getDate() + ' <i>–</i> ' + App.fmt.monthShort(w) + ' ' + w.getDate() }; }
    return { k: d.getFullYear(), t: App.fmt.month(d) };
  }
  function header() {
    var t = title();
    var isToday = V.mode === 'month' ? (V.date.getMonth() === App.now().getMonth()) : App.sameDay(V.date, App.now());
    return '<header class="cal-head">' +
      '<button class="icon-btn" data-nav="-1" aria-label="Previous">' + App.icon('left', 24) + '</button>' +
      '<div class="cal-title"><div class="serif">' + t.t + '</div><div class="label">' + t.k + '</div></div>' +
      '<button class="icon-btn" data-nav="1" aria-label="Next">' + App.icon('right', 24) + '</button>' +
      '<button class="btn btn--ghost' + (isToday ? ' is-hidden' : '') + '" data-today>Today</button>' +
      '<div class="seg">' + MODES.map(function (m) { return '<button class="' + (V.mode === m[0] ? 'is-on' : '') + '" data-mode="' + m[0] + '">' + m[1] + '</button>'; }).join('') + '</div>' +
      '<button class="fab" data-add aria-label="Add event">' + App.icon('plus', 26) + '</button>' +
      '</header>';
  }

  // widen the hour range so early/late items (e.g. a 5 AM work block) are visible
  function fitRange() {
    var n = { day: 1, '3day': 3 }[V.mode]; START = START0; END = END0;
    if (!n) return;
    for (var i = 0; i < n; i++) {
      var d = App.addDays(App.dayStart(V.date), i), s = +d, e = +App.addDays(d, 1);
      App.timedOn(d).forEach(function (ev) {
        if (+ev.start >= s && +ev.start < e) START = Math.min(START, ev.start.getHours());
        if (+ev.end > s && +ev.end <= e) { var h = ev.end.getHours() + (ev.end.getMinutes() ? 1 : 0); if (h > 0) END = Math.max(END, Math.min(24, h)); }
      });
    }
  }
  // Month: chips when cells are big enough (≥ 1 chip line and ≥ 64px wide), as many as fit then "+N more"; else dots
  function fitMonth() {
    var grid = V.el.querySelector('.mo-grid'); if (!grid) return;
    var cell = grid.querySelector('.mo-cell'); if (!cell) return;
    var k = grid.getBoundingClientRect().width / (grid.offsetWidth || 1) || 1;
    var cs = getComputedStyle(cell), num = cell.querySelector('.num');
    var inner = cell.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - num.offsetHeight - 2;
    grid.classList.add('mo--chips');
    var probe = grid.querySelector('.mo-chip'), lh = probe ? probe.offsetHeight + 2 : 18;
    var fit = Math.floor(inner / lh), wide = cell.clientWidth * k >= 64;
    if (!wide || fit < 1) { grid.classList.remove('mo--chips'); return; }
    App.$$('.mo-cell', grid).forEach(function (c) {
      var n = +c.dataset.n, ch = App.$$('.mo-chip', c), show = n > fit ? fit - 1 : n;
      if (show < 1 && n) show = 1;
      ch.forEach(function (x, i) { x.style.display = i < show ? '' : 'none'; });
      var more = c.querySelector('.mo-more'); more.textContent = n > show ? '+' + (n - show) + ' more' : ''; more.style.display = n > show ? '' : 'none';
    });
  }
  window.addEventListener('resize', function () { if (V.el && V.mode === 'month' && App.current === 'calendar') { clearTimeout(fitMonth.t); fitMonth.t = setTimeout(fitMonth, 150); } });
  function render() {
    fitRange();
    var body = { day: dayView, '3day': threeDay, week: weekView, month: monthView }[V.mode]();
    V.el.innerHTML = '<div class="cal cal--' + V.mode + '">' + header() + '<div class="cal-body">' + body + '</div></div>';
    if (V.mode === 'month') fitMonth();
    var sc = V.el.querySelector('.grid-scroll');
    if (sc) {
      var now = App.now();
      sc.scrollTop = V.scroll != null ? V.scroll : Math.max(0, y(now) - 170);
      sc.addEventListener('scroll', function () { V.scroll = sc.scrollTop; });
    }
  }

  function nav(dir) {
    if (V.mode === 'month') V.date = new Date(V.date.getFullYear(), V.date.getMonth() + dir, 1);
    else V.date = App.addDays(V.date, dir * ({ day: 1, '3day': 3, week: 7 }[V.mode]));
    V.scroll = null;
    render();
  }

  function onClick(e) {
    var t;
    if ((t = e.target.closest('[data-ev]'))) { var fe = App.findEvent(t.dataset.ev); if (fe && fe.routine && App.routineDaySheet) return App.routineDaySheet(fe.pid, fe.bid, fe.day); return App.eventSheet(fe); }
    if ((t = e.target.closest('.cal-body [data-day]')) && !e.target.closest('[data-more]')) { V.mode = 'day'; V.date = new Date(+t.dataset.day); V.scroll = null; return render(); }
    if ((t = e.target.closest('[data-more]'))) { if (V.mode !== 'day' && t.dataset.moreday) { V.mode = 'day'; V.date = new Date(+t.dataset.moreday); V.scroll = null; return render(); } return moreSheet(t.dataset.more.split(',')); }
    if ((t = e.target.closest('[data-nav]'))) return nav(+t.dataset.nav);
    if ((t = e.target.closest('[data-today]'))) { V.date = App.dayStart(App.now()); if (V.mode === 'month') V.date.setDate(1); V.scroll = null; return render(); }
    // scoped: #stage itself carries data-mode (day/ambient/night) — an unscoped closest() swallowed month-cell taps
    if ((t = e.target.closest('.cal-head [data-mode]'))) {
      V.mode = t.dataset.mode;
      if (V.mode === 'month') V.date = new Date(V.date.getFullYear(), V.date.getMonth(), 1);
      V.scroll = null;
      return render();
    }
    if ((t = e.target.closest('.cal-body [data-day]'))) { V.mode = 'day'; V.date = new Date(+t.dataset.day); V.scroll = null; return render(); }
    if ((t = e.target.closest('[data-add]'))) return addSheet();
  }

  // Swipe left/right to change day (the only swipe gesture in the app)
  function swipe(el) {
    var sx, sy, st;
    el.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; st = Date.now(); });
    el.addEventListener('pointerup', function (e) {
      if (sx == null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 90 && Math.abs(dy) < 60 && Date.now() - st < 700 && !e.target.closest('.cal-head')) nav(dx < 0 ? 1 : -1);
    });
  }

  // ------------------------------------------------------------ sheets
  App.eventSheet = function (e) {
    if (!e) return;
    var p = App.evColor(e), fam = App.isFamily(e);
    App.sheet(
      '<div class="evs" style="' + App.pstyle(p) + '">' +
      '<div class="evs-band"><div class="label label--on">' + App.fmt.rel(e.start) + ' · ' + App.fmt.month(e.start) + ' ' + e.start.getDate() + '</div>' +
      '<h2 class="serif">' + App.esc(e.title) + '</h2>' +
      '<div class="evs-time num">' + (e.allDay ? 'All day' : App.fmt.range(e.start, e.end)) + '</div></div>' +
      '<div class="evs-body">' +
      (e.travel ? '<div class="evs-row evs-leave">' + App.icon('car', 28) + '<div><b>Leave by ' + App.fmt.time(App.leaveBy(e)) + '</b><span>' + e.travel + ' min drive in current traffic</span></div></div>' : '') +
      (e.loc ? '<div class="evs-row">' + App.icon('pin', 28) + '<div><b>' + App.esc(e.loc) + '</b><span>Tap to send directions to phone</span></div></div>' : '') +
      '<div class="evs-row">' + App.icon('person', 28) + '<div class="evs-people">' + (fam ? D.people : e.people.map(App.person)).map(function (x) {
        return '<span class="chip" style="' + App.pstyle(x) + '">' + App.avatar(x, 32) + x.name + '</span>';
      }).join('') + '</div></div>' +
      (e.notes ? '<div class="evs-notes serif">“' + App.esc(e.notes) + '”</div>' : '') +
      (e.countdown && e.start > App.now() ? '<div class="evs-row">⏳<div><b>' + Math.round((App.dayStart(e.start) - App.dayStart(App.now())) / 864e5) + ' days to go</b></div></div>' : '') +
      (e.dayoff ? '<p class="evs-note">Day off — work and school blocks are skipped this day.' + (App.parent ? ' Change it in their routine.' : '') + '</p>' :
        /^cal:/.test(e.id) ? '<p class="evs-note">🔒 Synced from ' + App.esc(e.cal || 'a linked calendar') + ' — read-only here. Change it in that calendar and it updates on the next sync.</p>' :
        e.birthday ? '<p class="evs-note">From Birthdays &amp; anniversaries.</p>' :
        e.recurring ? '<p class="evs-note">Repeating event.</p>' + (App.parent && e.master ? '<div class="sheet-actions"><button class="btn btn--ghost" data-evseries>Edit the series</button></div>' : '') :
        !e.readOnly && App.parent ? '<div class="sheet-actions evs-acts"><button class="btn btn--ghost" data-evdel>Delete</button><button class="btn btn--ghost" data-evdup>Duplicate</button><button class="btn btn--solid" data-evedit>Edit</button></div>' : '') +
      '</div></div>', { cls: 'sheet--event', onMount: function (sh, close) {
        var se = sh.querySelector('[data-evseries]'); if (se) se.addEventListener('click', function () { close(); setTimeout(function () { App.editEmbed('tab=events&open=' + encodeURIComponent(e.master), 'Event'); }, 60); });
        var ed = sh.querySelector('[data-evedit]'); if (ed) ed.addEventListener('click', function () { close(); setTimeout(function () { App.eventForm(e, 'edit'); }, 60); });
        var du = sh.querySelector('[data-evdup]'); if (du) du.addEventListener('click', function () { close(); setTimeout(function () { App.eventForm(e, 'dup'); }, 60); });
        var b = sh.querySelector('[data-evdel]'); if (!b) return;
        b.addEventListener('click', function () { var i = D.events.indexOf(e); if (i < 0) return; D.events.splice(i, 1); close(); App.emit('data'); App.rerender();
          App.toast('Deleted <b>' + App.esc(e.title) + '</b>', { icon: 'calendar', undo: function () { D.events.push(e); App.emit('data'); App.rerender(); } }); });
      } });
  };

  function moreSheet(ids) {
    var list = ids.map(App.findEvent).filter(Boolean);
    App.sheet('<div class="sheet-pad"><div class="label">Overlapping</div><h2 class="serif sheet-h">' + list.length + ' more events</h2>' +
      '<div class="more-list">' + list.map(function (e) {
        return '<button class="more-row" data-ev="' + e.id + '" style="' + App.evStyle(e) + '"><i></i><b>' + App.esc(e.title) + '</b><span>' + App.fmt.range(e.start, e.end) + '</span></button>';
      }).join('') + '</div></div>', {
      onMount: function (s) { s.addEventListener('click', function (ev) { var t = ev.target.closest('[data-ev]'); if (t) App.eventSheet(App.findEvent(t.dataset.ev)); }); }
    });
  }

  // ------------------------------------------------------------ add / edit form (real start + end pickers)
  function pad2(n) { return ('0' + n).slice(-2); }
  function dstr(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function tstr(d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  function parseDT(ds, ts) { var a = (ds || '').split('-'), t = (ts || '00:00').split(':'); return new Date(+a[0], +a[1] - 1, +a[2], +t[0] || 0, +t[1] || 0); }
  function newId() { return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  App.eventForm = function (src, mode) {   // mode: 'new' | 'edit' | 'dup'
    mode = mode || (src ? 'edit' : 'new');
    var base = V.date && V.date > App.now() ? App.dayStart(V.date) : App.now();
    var s0 = src ? new Date(src.start) : new Date(base); if (!src) { s0.setMinutes(0, 0, 0); s0.setHours(Math.min(21, Math.max(8, App.now().getHours() + 1))); if (V.date && V.date > App.now()) s0.setHours(15, 30); }
    var e0 = src ? new Date(src.end) : new Date(+s0 + 36e5);
    var allDay = !!(src && src.allDay); if (allDay) e0 = App.addDays(e0, -1);   // shown inclusive
    var st = { who: src ? (App.isFamily(src) ? D.ALL.slice() : src.people.slice()) : [] };
    var ideas = ['Soccer', 'Playdate', 'Eye exam', 'Dinner out', 'Swim', 'Birthday party'];
    var durs = [[15, '15m'], [30, '30m'], [60, '1h'], [90, '1½h'], [120, '2h'], [180, '3h']];
    var label = mode === 'edit' ? 'Edit event' : mode === 'dup' ? 'Duplicate event' : 'New event';
    App.sheet(
      '<div class="sheet-pad add evf">' +
      '<h2 class="serif sheet-h">' + label + '</h2>' +
      '<input class="big-input serif" placeholder="What’s happening?" data-f="title" value="' + App.esc(src ? src.title : '') + '">' +
      (mode === 'new' ? '<div class="chips">' + ideas.map(function (i) { return '<button class="chip chip--ghost" data-idea="' + i + '">' + i + '</button>'; }).join('') + '</div>' : '') +
      '<div class="label">Who</div><div class="add-who">' + D.people.map(function (p) {
        return '<button class="who-btn' + (st.who.indexOf(p.id) > -1 ? ' is-on' : '') + '" data-who="' + p.id + '" style="' + App.pstyle(p) + '">' + App.avatar(p, 56) + '<span>' + p.name + '</span></button>';
      }).join('') + '<button class="who-btn' + (st.who.length === D.ALL.length ? ' is-on' : '') + '" data-who="all" style="' + App.pstyle(D.family) + '">' + App.avatar(D.family, 56) + '<span>Everyone</span></button></div>' +
      '<label class="evf-ad"><input type="checkbox" data-f="allday"' + (allDay ? ' checked' : '') + '><span class="evf-sw"></span><b>All day</b></label>' +
      '<div class="evf-grid">' +
      '<div class="label">Starts</div><div class="evf-dt"><input type="date" data-f="sd" value="' + dstr(s0) + '"><input type="time" step="900" data-f="stm" value="' + tstr(s0) + '"></div>' +
      '<div class="label">Ends</div><div class="evf-dt"><input type="date" data-f="ed" value="' + dstr(e0) + '"><input type="time" step="900" data-f="etm" value="' + tstr(e0) + '"></div>' +
      '</div>' +
      '<div class="evf-quick"><span class="label">Quick length</span><div class="chips">' + durs.map(function (t) { return '<button class="chip chip--ghost" data-dur="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div></div>' +
      '<p class="evf-err" hidden></p>' +
      '<div class="label">Where</div><input class="evf-in" data-f="loc" placeholder="Optional" value="' + App.esc((src && src.loc) || '') + '">' +
      '<div class="label">Notes</div><textarea class="evf-in" data-f="notes" rows="2" placeholder="Optional">' + App.esc((src && src.notes) || '') + '</textarea>' +
      '<div class="sheet-actions"><button class="btn btn--ghost" data-close>Cancel</button><button class="btn btn--solid" data-save>' + (mode === 'edit' ? 'Save' : 'Add to calendar') + '</button></div>' +
      '</div>', {
      cls: 'sheet--wide sheet--evf',
      onMount: function (s, close) {
        var f = function (k) { return s.querySelector('[data-f=' + k + ']'); }, input = f('title');
        var lastDur = Math.max(15, Math.round((e0 - s0) / 60000)) || 60;
        function sync() { s.classList.toggle('is-allday', f('allday').checked); }
        sync();
        f('allday').addEventListener('change', sync);
        // moving the start keeps the length; editing the end changes it
        function startChanged() { var a = parseDT(f('sd').value, f('stm').value); if (isNaN(a)) return; var e = new Date(+a + lastDur * 60000); f('ed').value = dstr(e); f('etm').value = tstr(e); }
        f('sd').addEventListener('change', function () { if (f('allday').checked) { if (f('ed').value < f('sd').value) f('ed').value = f('sd').value; } else startChanged(); });
        f('stm').addEventListener('change', startChanged);
        ['ed', 'etm'].forEach(function (k) { f(k).addEventListener('change', function () { var a = parseDT(f('sd').value, f('stm').value), b = parseDT(f('ed').value, f('etm').value); if (b > a) lastDur = Math.round((b - a) / 60000); }); });
        s.addEventListener('click', function (ev) {
          var t = ev.target.closest('button');
          if (!t) return;
          if (t.dataset.idea) input.value = t.dataset.idea;
          if (t.dataset.dur) { lastDur = +t.dataset.dur; f('allday').checked = false; sync(); startChanged(); App.$$('[data-dur]', s).forEach(function (b) { b.classList.toggle('is-on', b === t); }); }
          if (t.dataset.who) {
            if (t.dataset.who === 'all') st.who = st.who.length === D.ALL.length ? [] : D.ALL.slice();
            else { var i = st.who.indexOf(t.dataset.who); if (i > -1) st.who.splice(i, 1); else st.who.push(t.dataset.who); }
            App.$$('[data-who]', s).forEach(function (b) { b.classList.toggle('is-on', b.dataset.who === 'all' ? st.who.length === D.ALL.length : st.who.indexOf(b.dataset.who) > -1); });
          }
          if (!t.hasAttribute('data-save')) return;
          var err = s.querySelector('.evf-err'), ad = f('allday').checked, start, end;
          if (ad) { start = parseDT(f('sd').value); end = App.addDays(parseDT(f('ed').value), 1); }
          else { start = parseDT(f('sd').value, f('stm').value); end = parseDT(f('ed').value, f('etm').value); }
          if (isNaN(start) || isNaN(end)) { err.hidden = false; err.textContent = 'Pick a start and end.'; return; }
          if (end <= start) { err.hidden = false; err.textContent = 'The end needs to be after the start.'; return; }
          var vals = { title: input.value.trim() || 'New event', people: st.who.length ? st.who.slice() : D.ALL.slice(), start: start, end: end, allDay: ad || undefined, loc: f('loc').value.trim() || undefined, notes: f('notes').value.trim() || undefined };
          close();
          if (mode === 'edit' && src) {
            var before = Object.assign({}, src);
            Object.keys(vals).forEach(function (k) { if (vals[k] === undefined) delete src[k]; else src[k] = vals[k]; });
            App.emit('data'); render();
            App.toast('Saved <b>' + App.esc(src.title) + '</b>', { icon: 'calendar', undo: function () { Object.keys(src).forEach(function (k) { delete src[k]; }); Object.assign(src, before); App.emit('data'); render(); } });
            return;
          }
          var e = { id: newId(), title: vals.title, people: vals.people, start: start, end: end };
          ['allDay', 'loc', 'notes'].forEach(function (k) { if (vals[k] !== undefined) e[k] = vals[k]; });
          if (src && src.travel) e.travel = src.travel;
          D.events.push(e);
          V.date = App.dayStart(start); V.mode = V.mode === 'month' ? 'day' : V.mode; V.scroll = null;
          render(); App.emit('data');
          App.toast('Added <b>' + App.esc(e.title) + '</b> · ' + App.fmt.rel(start) + (ad ? '' : ' ' + App.fmt.time(start)), {
            icon: 'calendar', undo: function () { var i = D.events.indexOf(e); if (i > -1) D.events.splice(i, 1); render(); App.emit('data'); }
          });
        });
      }
    });
  };
  function addSheet() { App.eventForm(null, 'new'); }

  // ------------------------------------------------------------ drag to move / drag bottom edge to resize (parents, own events)
  function editable(e) { return !!(e && App.parent && !e.readOnly && !e.routine && !e.allDay && D.events.indexOf(e) > -1); }
  function dragInit(el) {
    var g = null, swallow = false, SNAP = 15;
    el.addEventListener('click', function (ev) { if (swallow) { swallow = false; ev.stopPropagation(); ev.preventDefault(); } }, true);
    el.addEventListener('touchmove', function (ev) { if (g && g.on) ev.preventDefault(); }, { passive: false });
    el.addEventListener('contextmenu', function (ev) { if (g) ev.preventDefault(); });
    el.addEventListener('pointerdown', function (ev) {
      var b = ev.target.closest('.ev[data-ev]'); if (!b || ev.button > 0) return;
      var e = App.findEvent(b.dataset.ev); if (!editable(e)) return;
      var grid = b.closest('.grid'); if (!grid) return;
      var k = grid.getBoundingClientRect().height / grid.offsetHeight || 1;
      var rs = !!ev.target.closest('.ev-rs');
      g = { b: b, e: e, k: k, x: ev.clientX, y: ev.clientY, rs: rs, on: false, top: b.offsetTop, h: b.offsetHeight, dm: 0, dd: 0, lane: b.parentNode, id: ev.pointerId };
      if (rs) begin(); else g.t = setTimeout(begin, 280);
    });
    function begin() { if (!g) return; g.on = true; g.b.classList.add(g.rs ? 'is-resizing' : 'is-dragging'); try { g.b.setPointerCapture(g.id); } catch (er) {} if (navigator.vibrate) try { navigator.vibrate(8); } catch (er) {} }
    el.addEventListener('pointermove', function (ev) {
      if (!g) return;
      var dx = ev.clientX - g.x, dy = ev.clientY - g.y;
      if (!g.on) { if (Math.abs(dx) > 8 || Math.abs(dy) > 8) { clearTimeout(g.t); g = null; } return; }
      ev.preventDefault();
      var mins = Math.round(dy / g.k / PX * 60 / SNAP) * SNAP;
      var dur = (g.e.end - g.e.start) / 60000;
      if (g.rs) { mins = Math.max(SNAP - dur, mins); g.dm = mins; g.b.style.height = Math.max(20, g.h + mins * PX / 60) + 'px'; }
      else {
        g.dm = mins; g.b.style.top = (g.top + mins * PX / 60) + 'px';
        var lanes = g.b.closest('.lanes--3');
        if (lanes) { var ls = App.$$('.lanes--3 > .lane', V.el), hit = -1; ls.forEach(function (l, i) { var r = l.getBoundingClientRect(); if (ev.clientX >= r.left && ev.clientX < r.right) hit = i; });
          var from = ls.indexOf(g.lane); if (hit > -1 && from > -1) { g.dd = hit - from; if (g.b.parentNode !== ls[hit]) ls[hit].appendChild(g.b); } }
      }
      var ns = new Date(+g.e.start + (g.rs ? 0 : g.dm * 60000) + g.dd * 864e5), ne = new Date(+g.e.end + g.dm * 60000 + g.dd * 864e5);
      var m = g.b.querySelector('.ev-meta'); if (m) m.textContent = App.fmt.range(ns, ne);
    });
    function end(ev, cancel) {
      if (!g) return; clearTimeout(g.t); var x = g; g = null;
      if (!x.on) return;
      swallow = true; setTimeout(function () { swallow = false; }, 400);
      if (cancel || (!x.dm && !x.dd)) { render(); return; }
      var e = x.e, s0 = e.start, e0 = e.end;
      if (x.rs) e.end = new Date(+e.end + x.dm * 60000);
      else { e.start = new Date(+e.start + x.dm * 60000 + x.dd * 864e5); e.end = new Date(+e.end + x.dm * 60000 + x.dd * 864e5); }
      App.emit('data'); render();
      App.toast((x.rs ? 'Now ' : 'Moved to ') + '<b>' + App.fmt.range(e.start, e.end) + '</b>', { icon: 'calendar', undo: function () { e.start = s0; e.end = e0; App.emit('data'); render(); } });
    }
    el.addEventListener('pointerup', function (ev) { end(ev, false); });
    el.addEventListener('pointercancel', function (ev) { end(ev, !(g && g.on)); });
  }

  App.register('calendar', {
    show: function (el, opts) {
      if (!V.el) {
        V.el = el;
        el.addEventListener('click', onClick);
        swipe(el); dragInit(el);
      }
      if (!V.date) V.date = App.dayStart(App.now());
      if (!opts.rerender) V.scroll = null;
      render();
    }
  });
  App.on('minute', function () {
    if (App.current !== 'calendar') return;
    var line = V.el.querySelector('.now-line');
    var now = App.now();
    if (line) { line.style.top = y(now) + 'px'; line.querySelector('span').textContent = App.fmt.time(now, false); }
  });
  App.on('time', function () { V.date = App.dayStart(App.now()); V.scroll = null; });
})();
