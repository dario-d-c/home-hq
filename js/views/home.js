// Home / Today: the glanceable overview. Never scrolls.
(function () {
  'use strict';
  var D = window.DATA, V = {};

  function clock() {
    var n = App.now();
    return '<div class="h-time num">' + App.fmt.time(n, false) + '<span class="h-ampm">' + App.fmt.ampm(n) + '</span></div>' +
      '<div class="h-date"><b>' + App.fmt.day(n) + '</b> ' + App.fmt.month(n) + ' ' + n.getDate() + '</div>';
  }

  function weather() {
    var w = App.weatherNow();
    var hours = App.hourly(7);
    var tmin = Math.min.apply(null, hours.map(function (h) { return h.t; }));
    var tmax = Math.max.apply(null, hours.map(function (h) { return h.t; }));
    return '<div class="h-wx-top">' +
      '<span class="h-wx-icon">' + App.icon(w.cond, 60) + '</span>' +
      '<span class="h-wx-temp num">' + w.temp + '°</span>' +
      '<span class="h-wx-meta"><b>' + w.label + '</b><span>H ' + w.hi + '°  L ' + w.lo + '°</span></span>' +
      '</div>' +
      '<div class="h-wx-say"><b>' + w.summary + '.</b> ' + w.advice + '.</div>' +
      '<div class="h-wx-hours">' + hours.map(function (h) {
        var lift = tmax === tmin ? 0 : Math.round((h.t - tmin) / (tmax - tmin) * 8);
        return '<div class="h-hr' + (h.p >= 50 ? ' is-wet' : '') + '"><span class="h-hr-l">' + h.label + '</span>' +
          '<span class="h-hr-i" style="transform:translateY(' + -lift + 'px)">' + App.icon(h.c, 22) + '</span><b>' + h.t + '°</b></div>';
      }).join('') + '</div>';
  }

  function presence() {
    // "Where's everyone": live from weekly routines (the old manual home/away status is no longer shown)
    return '<div class="label">Where’s everyone</div>' + D.people.map(function (p) {
      var w = App.whereIs(p);
      return '<div class="h-who' + (w.out ? '' : ' is-home') + '" data-routine="' + p.id + '" style="' + App.pstyle(p) + '">' +
        App.avatar(p, 30, w.out ? 'avatar--away' : '') +
        '<span><b>' + App.esc(p.name) + '</b><small>' + App.esc(w.text) + '</small></span></div>';
    }).join('');
  }

  // little banners above the hero: birthday today, no-school / early release today+tomorrow, nearest countdown
  function banners() {
    var now = App.now(), out = [], today0 = App.dayStart(now);
    D.people.forEach(function (p) {
      var b = /^(\d{4}|-)-?(\d\d)-(\d\d)$/.exec(p.birthday || '');
      if (b && +b[2] === now.getMonth() + 1 && +b[3] === now.getDate()) out.push('<div class="h-ban h-ban--bday" style="' + App.pstyle(p) + '">🎉 <b>Happy birthday, ' + App.esc(p.name) + '!</b></div>');
    });
    App.allDayOn(today0).filter(function (e) { return e.dayoff; }).forEach(function (e) { var p = App.person(e.pid) || {};
      out.push('<button class="h-ban h-ban--off" data-ev-off="' + e.id + '" style="' + App.pstyle(p) + '">🌴 <b>' + App.esc(e.title) + '</b></button>'); });
    if (window.HQCel) window.HQCel((App.look && App.look.bdayDays != null) ? App.look.bdayDays : 7).forEach(function (e) {
      var n = Math.round((App.dayStart(e.start) - today0) / 864e5); if (n === 0 && e.celebrate === 'birthday' && D.people.some(function (p) { return p.id === e.birthday; })) return;   // today's family birthday has its own banner
      var hasW = (D.wishes || []).some(function (w) { return (w.who || w.kid) === e.birthday || (w.whoName && w.whoName === e.celebName); });
      out.push('<button class="h-ban h-ban--celebrate" data-wish-who="' + App.esc(e.birthday) + '" data-wish-name="' + App.esc(e.celebName) + '"><span class="cel-mark ' + e.celebrate + '"></span><b>' + App.esc(e.title.replace(/^\S+ /, '')) + '</b> ' +
        (n === 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days') + (hasW ? ' · <u>wish list</u>' : '') + '</button>');
    });
    var kids = D.people.filter(function (p) { return p.role !== 'parent' && (p.school === true || (p.routine || []).some(function (b) { return b.type === 'school'; })); });
    [0, 1].forEach(function (i) {
      var d = App.addDays(today0, i), wd = d.getDay(); if (!kids.length || wd === 0 || wd === 6) return;
      var groups = {};
      kids.forEach(function (k) {
        var sd = App.schoolDay(d, k.id), e = sd.off || sd.half; if (!e) return;
        var label = sd.off ? 'No school' : 'Early release' + (e.dismiss ? ' ' + App.fmt.time(new Date(2000, 0, 1, +e.dismiss.slice(0, 2), +e.dismiss.slice(3, 5))) : '');
        (groups[label] = groups[label] || []).push(k.name);
      });
      Object.keys(groups).forEach(function (l) {
        if (i === 0 && /^Early/.test(l) && now.getHours() >= 15) return;
        out.push('<div class="h-ban' + (/^No/.test(l) ? ' h-ban--off' : '') + '">' + (/^No/.test(l) ? '🏖️' : '🕛') + ' <b>' + (i ? 'Tomorrow' : 'Today') + ':</b> ' + l + ' <span>– ' + App.esc(groups[l].join(', ')) + '</span></div>');
      });
    });
    var cds = countdowns(today0);
    if (cds.length) {
      var ci = (+localStorage.getItem('hq-cd') || 0) % cds.length, cd = cds[ci];
      out.push('<button class="h-ban h-ban--cd" data-cd-cycle aria-label="Countdown' + (cds.length > 1 ? ' — tap for the next one' : '') + '">' + cd.emoji + ' <b>' + App.esc(cd.title) + '</b> · ' +
        (cd.days === 0 ? 'today' : cd.days + ' day' + (cd.days === 1 ? '' : 's')) + (cds.length > 1 ? ' <span class="cd-dots">' + cds.map(function (_, i) { return '<i class="' + (i === ci ? 'on' : '') + '"></i>'; }).join('') + '</span>' : '') + '</button>');
    }
    return out.length ? '<div class="h-bans">' + out.slice(0, 3).join('') + '</div>' : '';
  }
  // opt-in countdowns: events with "countdown", plus birthdays/anniversaries and holidays switched on in More › Countdowns
  function countdowns(today0) {
    var on = {}; (D.countdowns || []).forEach(function (c) { on[c.id] = 1; });
    var seen = {}, out = [], t = App.dstr ? App.dstr(today0) : today0.getFullYear() + '-' + String(today0.getMonth() + 1).padStart(2, '0') + '-' + String(today0.getDate()).padStart(2, '0');
    var H = window.HQHol;
    App.events().forEach(function (e) {
      var ok = (e.countdown && !e.cdKey) || (e.cdKey && on[e.cdKey]); if (!ok) return;
      var k = e.master || e.cdKey || e.id, s0 = App.dayStart(e.start); if (s0 < today0 || s0 - today0 > 366 * 864e5) return;
      if (seen[k] && seen[k] <= s0) return; seen[k] = s0;
      out = out.filter(function (x) { return x.k !== k; });
      out.push({ k: k, title: e.cdKey ? e.title.replace(/^\S+ /, '') : e.title, emoji: e.cdKey ? (e.celebrate === 'anniversary' ? '🥂' : '🎂') : (e.emoji || (H ? H.cdEmoji(e.title) : '⏳')), days: Math.round((s0 - today0) / 864e5) });
    });
    if (H) Object.keys(on).forEach(function (id) { if (!/^h:/.test(id)) return; var h = H.nextHoliday(id.slice(2), t); if (!h) return;
      var d = Math.round((new Date(h.date + 'T00:00') - today0) / 864e5); if (d <= 366) out.push({ k: id, title: h.title, emoji: h.emoji, days: d }); });
    return out.sort(function (a, b) { return a.days - b.days; });
  }
  App.countdowns = function () { return countdowns(App.dayStart(App.now())); };
  document.addEventListener('click', function (ev) { var o = ev.target.closest('[data-ev-off]'); if (o && !App.editMode && App.eventSheet) App.eventSheet(App.findEvent(o.dataset.evOff)); });
  document.addEventListener('click', function (ev) { var b = ev.target.closest('[data-cd-cycle]'); if (!b || App.editMode) return;
    localStorage.setItem('hq-cd', (+localStorage.getItem('hq-cd') || 0) + 1); var hb = b.closest('.h-bans'); if (hb) hb.outerHTML = banners() || ''; });
  function upNext(skipId) {
    var now = App.now(), list = App.timedOn(now).concat(App.timedOn(App.addDays(now, 1))).filter(function (e) { return e.start > now && !e.routine && e.id !== skipId; });
    return list.slice(0, 2).map(function (e) {
      var mins = (e.start - now) / 60000, until = mins < 60 ? Math.round(mins) + ' min' : mins < 24 * 60 ? 'in ' + Math.round(mins / 60) + 'h' : App.fmt.rel(e.start);
      return '<span class="h-then-i"><b>' + App.fmt.time(e.start) + '</b> ' + App.esc(e.title) + ' <small>' + App.esc(App.isFamily(e) ? 'Everyone' : e.people.map(function (id) { return App.person(id).name; }).join(', ')) + ' · ' + until + '</small></span>';
    }).join('');
  }

  function hero() {
    return banners() + heroCard();
  }
  function heroCard() {
    var e = App.nextEvent(), now = App.now();
    if (!e) {
      var tomorrow = App.timedOn(App.addDays(now, 1))[0];
      return '<div class="h-hero h-hero--empty" data-go="calendar">' +
        '<div class="label label--light">Rest of today</div>' +
        '<div class="h-hero-title serif">Nothing else scheduled.<br><i>Enjoy the quiet.</i></div>' +
        (tomorrow ? '<div class="h-hero-meta">Tomorrow starts with <b>' + App.esc(tomorrow.title) + '</b> at ' + App.fmt.time(tomorrow.start) + '</div>' : '') +
        '</div>';
    }
    var p = App.evColor(e);
    var mins = (e.start - now) / 60000;
    var leave = (App.leaveBy(e) - now) / 60000;
    var who = e.people.map(function (id) { return App.person(id).name; });
    var whoText = App.isFamily(e) ? 'Everyone' : who.join(' + ');
    var big = mins < 100
      ? '<div class="h-hero-count num">' + Math.round(mins) + '<small>min</small></div>'
      : '<div class="h-hero-count num">' + App.fmt.time(e.start, false) + '<small>' + App.fmt.ampm(e.start) + '</small></div>';
    var leavePill = '';
    if (e.travel) {
      leavePill = leave <= 0
        ? '<span class="pill pill--alert"><i class="pulse"></i>Leave now</span>'
        : '<span class="pill' + (leave <= 15 ? ' pill--soon' : '') + '">' + App.icon('car', 20) + 'Leave in ' + App.fmt.mins(leave) + '</span>';
    }
    return '<button class="h-hero" style="' + App.evStyle(e) + '" data-ev="' + e.id + '">' +
      '<div class="h-hero-main">' +
      '  <div class="label label--on">Next up · ' + App.esc(whoText) + '</div>' +
      '  <div class="h-hero-title serif">' + App.esc(e.title) + '</div>' +
      '  <div class="h-hero-meta">' + App.fmt.range(e.start, e.end) + (e.loc ? ' · ' + App.esc(e.loc) : '') + '</div>' +
      (upNext(e.id) ? '  <div class="h-then"><span class="label label--on">Then</span>' + upNext(e.id) + '</div>' : '') +
      '  <div class="h-hero-foot">' + (e.people.length > 1 ? App.dots(e.people, 22) : '') + leavePill + '</div>' +
      '</div>' + big + '</button>';
  }

  // no more events today → where they are + the next routine items, big and legible
  function laneRoutine(p) {
    var w = App.whereIs(p), up = App.upcomingRoutine ? App.upcomingRoutine(p, 2) : [];
    return '<button class="h-rt" data-routine="' + p.id + '"><span class="h-rt-now' + (w.late ? ' is-late' : '') + '">' + App.esc(w.text.split(' · ')[0]) + '</span>' +
      up.map(function (x) { return '<span class="h-rt-next" data-rtday="' + x.pid + '|' + x.bid + '|' + x.day + '"><b>' + App.esc(x.label) + '</b> ' + App.esc(x.when) + '</span>'; }).join('') +
      (up.length ? '' : '<span class="h-rt-next h-rt-free">Free the rest of today</span>') + '</button>';
  }

  function lanes() {
    var now = App.now();
    if (!D.people.length) {
      // first run: no family yet
      var go = App.parent ? '<button class="btn h-setup-btn" data-setup-family>Add your family</button>'
        : '<a class="btn h-setup-btn" href="/auth?next=' + encodeURIComponent('/?edit=1&view=more&open=people') + '">Sign in to set up</a>';
      return '<div class="h-setup"><div class="label">Welcome to Home HQ</div><h3 class="serif">Let’s set up your family</h3>' +
        '<p>Add each person (name and colour), then your stores, chores and calendar links. Everything is saved to your own Cloudflare account.</p>' + go + '</div>';
    }
    return D.people.map(function (p) {
      // a shared event shows once — in the first of its people's lanes, striped with everyone's colours
      var list = App.timedOn(now, p.id).filter(function (e) { if (e.end <= now) return false; var ids = App.evPeople(e); return e.routine || ids.length < 2 || ids[0] === p.id; });
      var shown = list.slice(0, 3), more = list.length - shown.length;
      return '<div class="h-lane" style="' + App.pstyle(p) + '">' +
        '<button class="h-lane-head" data-routine="' + p.id + '">' + App.avatar(p, 30) + '<b>' + p.name + '</b></button>' +
        (list.length ? shown.map(function (e) {
          var cur = e.start <= now;
          var ids = App.evPeople(e), multi = ids.length > 1 && !e.routine;
          return '<button class="h-ev' + (cur ? ' is-now' : '') + (multi ? ' is-shared' : '') + '" data-ev="' + e.id + '"' + (multi ? ' style="' + App.evStyle(e) + '"' : '') + '>' +
            '<span class="h-ev-t">' + (cur ? 'Now' : App.fmt.time(e.start, false)) + '</span>' +
            '<span class="h-ev-n">' + App.esc(e.title) + (multi ? ' <span class="h-ev-with">' + (App.isFamily(e) ? 'Everyone' : 'with ' + ids.slice(1).map(function (id) { return App.person(id).name; }).join(', ')) + '</span>' : '') + '</span></button>';
        }).join('') : laneRoutine(p)) +
        (more > 0 ? '<button class="h-more" data-go="calendar">+' + more + ' more</button>' : '') +
        '</div>';
    }).join('');
  }

  function ring(done, total, size) {
    var r = size / 2 - 5, c = 2 * Math.PI * r, f = total ? done / total : 0;
    return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring-bg"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring-fg" stroke-dasharray="' + (c * f) + ' ' + c + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/></svg>';
  }
  App.ring = ring;

  function chores() {
    var r = App.currentRoutine();
    var who = D.people.map(function (p) { return p.id; }).concat(['any']);
    if (!D.chores.some(function (c) { return c.r === r.id; })) return '<div class="label">Chores · ' + r.name + '</div><div class="h-stat"><small>Nothing to do right now</small></div>';
    return '<div class="label">Chores · ' + r.name + '</div><div class="h-rings">' + who.map(function (id) {
      var list = D.chores.filter(function (c) { return c.r === r.id && c.who === id; });
      if (!list.length) return '';
      var done = list.filter(function (c) { return c.done; }).length;
      var p = App.person(id);
      return '<div class="h-ring' + (done === list.length ? ' is-done' : '') + '" style="' + App.pstyle(p) + '">' + ring(done, list.length, 64) +
        '<b class="num">' + (done === list.length ? '✓' : done + '/' + list.length) + '</b><span>' + (id === 'any' ? 'Anyone' : p.name) + '</span></div>';
    }).join('') + '</div>';
  }

  function shopping() {
    var open = D.groceries.filter(function (g) { return !g.done && window.HQTrip.onNext(g, D.trips); });
    var recent = open.slice(-3).reverse(), nt = window.HQTrip.next(D.trips);
    return '<div class="label">' + (nt ? 'Shopping · ' + App.esc(window.HQTrip.label(nt, D.stores)) : 'Shopping') + '</div>' +
      '<div class="h-stat"><span class="num">' + open.length + '</span><small>items to get</small></div>' +
      '<ul class="h-recent">' + recent.map(function (g) {
        return '<li><i></i>' + App.esc(g.name) + '</li>';
      }).join('') + '</ul>';
  }

  function status() {
    var lights = D.devices.filter(function (d) { return d.type === 'light' && d.on; }).length;
    var unlocked = D.devices.filter(function (d) { return d.type === 'lock' && !d.locked; });
    var garage = D.devices.filter(function (d) { return d.type === 'garage'; })[0];
    var secure = !unlocked.length && garage.state === 'closed';
    var secText = secure ? 'All locked' : (garage.state !== 'closed' ? 'Garage open' : unlocked[0].name + ' unlocked');
    return '<div class="label">Home</div>' +
      '<div class="h-st-row">' + App.icon('bulb', 24) + '<b class="num">' + lights + '</b><span>lights on</span></div>' +
      '<div class="h-st-row' + (secure ? '' : ' is-warn') + '">' + App.icon(secure ? 'lock' : 'unlock', 24) + '<span>' + secText + '</span></div>' +
      '<div class="h-st-row">' + App.icon('thermo', 24) + '<b class="num">' + D.climate.current + '°</b><span>inside</span></div>';
  }

  function paint() {
    var el = V.el;
    el.querySelector('.h-clock').innerHTML = clock();
    el.querySelector('.h-weather').innerHTML = weather();
    el.querySelector('.h-presence').innerHTML = presence();
    el.querySelector('.h-hero-slot').innerHTML = hero();
    el.querySelector('.h-lanes').innerHTML = lanes();
    el.querySelector('.h-chores').innerHTML = chores();
    el.querySelector('.h-meals').innerHTML = App.mealsToday();
    el.querySelector('.h-shop').innerHTML = shopping();
    el.querySelector('.h-status').innerHTML = status();
  }

  function photoCaption(s) {
    var m = App.photoMeta(s.photos[0]);
    V.el.querySelector('.h-photo-cap').innerHTML = '<b>' + (m.onThisDay ? 'On this day · ' : '') + m.kicker + '</b><span>' + App.esc(m.place) + '</span>';
  }

  App.register('home', {
    show: function (el) {
      V.el = el;
      if (!el.firstChild) {
        el.innerHTML = '<div class="home">' +
          '<div class="h-clock" data-go="calendar"></div>' +
          '<div class="h-weather" data-wxtoday></div>' +
          '<div class="h-presence"></div>' +
          '<div class="h-main"><div class="h-hero-slot"></div><div class="h-lanes" ></div></div>' +
          '<div class="h-side">' +
          '  <button class="h-photo" data-go="photos"><div class="h-photo-stage"></div><div class="h-photo-cap"></div></button>' +
          '  <button class="h-meals card" data-go="meals"></button>' +
          '  <button class="h-chores card" data-go="tasks"></button>' +
          '  <div class="h-duo"><button class="h-shop card" data-go="shopping"></button><button class="h-status card" data-go="control"></button></div>' +
          '</div></div>';
        el.addEventListener('click', function (e) {
          if (e.target.closest('[data-wxtoday]') && App.wxSheet && window.DATA.wx) { var n0 = App.now(); App.wxSheet(n0.getFullYear() + '-' + ('0' + (n0.getMonth() + 1)).slice(-2) + '-' + ('0' + n0.getDate()).slice(-2)); return; }
          var rd = e.target.closest('[data-rtday]');
          if (rd && App.routineDaySheet) { e.stopPropagation(); var q = rd.dataset.rtday.split('|'); App.routineDaySheet(q[0], q[1], q[2]); return; }
          var rt = e.target.closest('[data-routine]');
          if (rt && App.routineSheet) { e.stopPropagation(); App.routineSheet(rt.dataset.routine); return; }
          var ev = e.target.closest('[data-ev]');
          if (ev) { var fe = App.findEvent(ev.dataset.ev); if (fe && fe.routine && App.routineDaySheet) App.routineDaySheet(fe.pid, fe.bid, fe.day); else App.eventSheet(fe); return; }
          var g = e.target.closest('[data-go]');
          if (g) App.go(g.dataset.go);
        });
        V.slides = new App.Slideshow(el.querySelector('.h-photo-stage'), { layout: 'cover', captions: false, interval: 12000, onChange: photoCaption });
      }
      paint();
      V.slides.start();
    },
    resume: function () { V.slides.start(); },
    hide: function () { if (V.slides) V.slides.stop(); }
  });
  // Every minute: just the clock and next-up countdown (cheap, even while hidden). Weather on the hour.
  App.on('minute', function (n) {
    if (!V.el || !V.el.firstChild) return;
    V.el.querySelector('.h-clock').innerHTML = clock();
    V.el.querySelector('.h-hero-slot').innerHTML = hero();
    V.el.querySelector('.h-presence').innerHTML = presence();
    if (n.getMinutes() === 0) { V.el.querySelector('.h-weather').innerHTML = weather(); V.el.querySelector('.h-lanes').innerHTML = lanes(); }
  });
  App.on('data', function () { if (App.current === 'home') paint(); });
})();

document.addEventListener('click', function (ev) {
  if (!ev.target.closest('[data-setup-family]')) return;
  ev.preventDefault(); if (App.editEmbed) App.editEmbed('tab=people', 'Family');
});
