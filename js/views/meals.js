// Meals: today's meals tile (Today screen) + a read-only week planner view. Data comes from /api/data (meals).
(function () {
  'use strict';
  var D = window.DATA;
  var EXTRAS = [['breakfast', 'Breakfast'], ['brunch', 'Brunch'], ['lunch', 'Lunch'], ['snack', 'Snack']];
  function schoolKids() { return D.people.filter(function (p) { return p.role !== 'parent' && (p.school === true || (p.school !== false && (p.routine || []).some(function (b) { return b.type === 'school'; }))); }); }
  function isSchoolDay(d) { var w = d.getDay(); return w >= 1 && w <= 5; }
  function lunchOf(day, pid) { var x = (D.lunch || []).filter(function (l) { return l.id === day + ':' + pid; })[0]; return x ? x.choice : 'school'; }
  function toggleLunch(day, pid) {
    var id = day + ':' + pid, next = lunchOf(day, pid) === 'home' ? 'school' : 'home';
    D.lunch = (D.lunch || []).filter(function (l) { return l.id !== id; });
    D.lunch.push({ id: id, date: day, pid: pid, choice: next });   // saved by remote.js (frame key)
  }
  App.toggleLunch = toggleLunch;
  // Weekly repeating school menus (breakfast, or lunch without a dated menu): {school, meal, days{1..5}, always, year, kids[]}
  // school-year window: first-day event → last-day event (ignoring the snow-day fallback), else Aug 1 – Jun 30
  function inYear(m, d) {
    var y = +(String(m.year || '').slice(0, 4)); if (!y) return true;
    var a = new Date(y, 7, 1), b = new Date(y + 1, 6, 1);
    (D.events || []).forEach(function (e) {
      var s = new Date(e.start); if (s < a || s >= b || !e.school) return;
      if (e.school === 'first' && s.getMonth() >= 7) { var f = new Date(s.getFullYear(), s.getMonth(), s.getDate()); if (!a.f || f < a.f) a.f = f; }
      if (/last day of school/i.test(e.title || '') && !/snow/i.test(e.title || '')) { var l = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1); if (!b.l || l < b.l) b.l = l; }
    });
    return d >= (a.f || a) && d < (b.l || b);
  }
  App.weeklyMenu = function (pid, d, meal) {
    var w = d.getDay(); if (w < 1 || w > 5) return null;
    if (App.schoolDay && App.schoolDay(d, pid).off) return null;
    var p = App.person(pid) || {};
    return (D.menus || []).filter(function (m) { return m.meal === meal && m.days && m.days[w] && inYear(m, d) && ((m.kids || []).indexOf(pid) > -1 || (p.schoolName && p.schoolName === m.school)); })[0] || null;
  };
  function ds(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function on(day, slot) { return (D.meals || []).filter(function (m) { return m.date === day && m.slot === slot; }); }
  function forWho(m) {
    var bits = [];
    if (m.for && m.for.length) bits.push(m.for.map(function (id) { return App.person(id).name; }).join(', '));
    if (m.cook) bits.push(App.person(m.cook).name + ' cooking');
    return bits.join(' · ');
  }

  function names(list) { return list.map(function (m) { return App.esc(m.title); }).join(' / '); }
  App.mealsToday = function () {
    var now = App.now(), day = ds(now);
    var dinner = on(day, 'dinner'), menu = on(day, 'school');
    var extras = EXTRAS.map(function (s) { var l = on(day, s[0]); return l.length ? '<span><em>' + s[1] + '</em> ' + names(l) + '</span>' : ''; }).join('');
    var kids = isSchoolDay(now) ? schoolKids().filter(function (p) { return !(App.schoolDay && App.schoolDay(now, p.id).off); }) : [];
    var lunch = kids.length ? '<div class="hm-lunch"><div class="hm-menu">🏫 ' + (menu.length ? names(menu) : (function () { var wm = kids[0] && App.weeklyMenu(kids[0].id, now, 'lunch'); return wm ? App.esc(wm.days[now.getDay()]) : '<i>School lunch</i>'; })()) + '</div><div class="hm-kids">' + kids.map(function (p) {
      var c = lunchOf(day, p.id);
      return '<span class="hm-kid ' + c + '" data-lunch="' + p.id + '" style="' + App.pstyle(p) + '"><i></i>' + App.esc(p.name) + ' · ' + (c === 'home' ? 'Home' : 'School') + '</span>';
    }).join('') + '</div></div>' : '';
    // school breakfast (weekly menu) per school, for school kids today
    var bk = {}; kids.forEach(function (p) { var m = App.weeklyMenu(p.id, now, 'breakfast'); if (m) (bk[m.id] = bk[m.id] || { m: m, who: [] }).who.push(p.name); });
    var bfast = Object.keys(bk).map(function (k) { var x = bk[k]; return '<div class="hm-menu hm-bfast">🥣 <em>Breakfast</em> ' + App.esc(x.m.days[now.getDay()]) + (Object.keys(bk).length > 1 ? ' <small>(' + App.esc(x.who.join(', ')) + ')</small>' : '') + '</div>'; }).join('');
    return '<div class="label">Meals · Today</div>' +
      '<div class="hm-dinner"><small>Dinner</small><b>' + (dinner.length ? names(dinner) : '<span class="hm-none">Not planned yet</span>') + '</b></div>' +
      (extras ? '<div class="hm-extras">' + extras + '</div>' : '') + bfast + lunch;
  };
  // tap a kid's lunch chip on the Today tile: School ⇄ Home (saved, per day)
  document.addEventListener('click', function (e) {
    var k = e.target.closest && e.target.closest('.h-meals [data-lunch]'); if (!k) return;
    e.stopPropagation(); e.preventDefault();
    toggleLunch(ds(App.now()), k.dataset.lunch);
    var tile = document.querySelector('.h-meals'); if (tile) tile.innerHTML = App.mealsToday();
  }, true);

  // ---- meal detail + day sheets (view for everyone; edit actions for signed-in parents)
  var SLOTN = { dinner: 'Dinner', breakfast: 'Breakfast', brunch: 'Brunch', lunch: 'Lunch', snack: 'Snack', school: 'School lunch' };
  function dObj(day) { var p = day.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function dLabel(day) { var d = dObj(day); return App.fmt.dayShort(d) + ' ' + App.fmt.monthShort(d) + ' ' + d.getDate(); }
  function list(arr, ordered) { return arr.length ? '<' + (ordered ? 'ol' : 'ul') + ' class="md-list">' + arr.map(function (x) { return '<li>' + App.esc(x) + '</li>'; }).join('') + '</' + (ordered ? 'ol' : 'ul') + '>' : ''; }
  function mealSheet(id) {
    var m = (D.meals || []).filter(function (x) { return x.id === id; })[0]; if (!m) return;
    var r = m.recipe && (D.recipes || []).filter(function (x) { return x.id === m.recipe; })[0];
    var ing = r ? r.ingredients || [] : String(m.ingredients || '').split(/\n|,/).map(function (x) { return x.trim(); }).filter(Boolean);
    var who = forWho(m);
    var html = '<div class="sheet-pad md"><div class="label">' + (SLOTN[m.slot] || 'Meal') + ' · ' + dLabel(m.date) + '</div><h2 class="serif sheet-h">' + App.esc(m.title || 'Meal') + '</h2>' +
      (r && r.image ? '<img class="md-img" src="' + App.esc(r.image) + '" alt="" referrerpolicy="no-referrer">' : '') +
      (who ? '<p class="md-who">' + App.esc(who) + '</p>' : '') + (m.notes ? '<p class="md-notes">' + App.esc(m.notes) + '</p>' : '') +
      (r ? '<div class="md-sec"><div class="label">Recipe</div><b>' + (r.kind === 'cocktail' ? '🍸 ' : '📖 ') + App.esc(r.title) + '</b>' + (r.servings ? ' <small>· serves ' + App.esc(r.servings) + '</small>' : '') + '</div>' : '') +
      (ing.length ? '<div class="md-sec"><div class="label">Ingredients</div>' + list(ing) + '</div>' : '') +
      (r && (r.steps || []).length ? '<div class="md-sec"><div class="label">Steps</div>' + list(r.steps, true) + '</div>' : '') +
      ((m.link || (r && r.url)) ? '<p><a class="md-link" href="' + App.esc(m.link || r.url) + '" target="_blank" rel="noopener">Open recipe page ↗</a></p>' : '') +
      (App.parent ? '<div class="md-acts"><button class="md-btn md-primary" data-md="edit">✎ Edit</button><button class="md-btn" data-md="recipe">📖 ' + (r ? 'Change recipe' : 'Link a recipe') + '</button>' +
        (ing.length ? '<button class="md-btn" data-md="shop">🛒 Add ingredients to shopping</button>' : '') + '<button class="md-btn md-danger" data-md="delete">Delete</button></div>' : '') + '</div>';
    App.sheet(html, { cls: 'sheet--meal', onMount: function (el) { el.addEventListener('click', function (ev) { var b = ev.target.closest('[data-md]'); if (!b) return; var k = b.dataset.md; App.closeSheet();
      setTimeout(function () { App.editEmbed('tab=meals&open=' + encodeURIComponent(id) + (k === 'edit' ? '' : '&act=' + k), k === 'edit' ? 'Edit meal' : k === 'recipe' ? 'Choose a recipe' : k === 'shop' ? 'Add ingredients' : 'Delete meal'); }, 60); }); } });
  }
  function daySheet(day) {
    var d = dObj(day), w = d.getDay(), kids = schoolKids().filter(function (p) { return isSchoolDay(d) && !App.schoolDay(d, p.id).off; });
    var rows = [];
    ['breakfast', 'brunch', 'lunch', 'dinner', 'snack'].forEach(function (sl) { on(day, sl).forEach(function (m) { rows.push('<button class="md-row" data-meal="' + m.id + '"><em>' + SLOTN[sl] + '</em><b>' + App.esc(m.title) + '</b><i>›</i></button>'); }); });
    if (!on(day, 'dinner').length) rows.push('<div class="md-row md-empty"><em>Dinner</em><i class="mp-none">Not planned</i></div>');
    var school = '';
    if (kids.length) {
      var bf = {}, ln = on(day, 'school').map(function (m) { return m.title; });
      kids.forEach(function (p) { var m = App.weeklyMenu(p.id, d, 'breakfast'); if (m && m.days[w]) bf[m.days[w]] = 1; if (!ln.length) { var l = App.weeklyMenu(p.id, d, 'lunch'); if (l && l.days[w]) ln.push(l.days[w]); } });
      school = '<div class="md-sec"><div class="label">School</div>' + (Object.keys(bf).length ? '<p class="md-menu"><em>🥣 Breakfast</em> ' + Object.keys(bf).map(App.esc).join(' / ') + '</p>' : '') +
        '<p class="md-menu"><em>🏫 Lunch</em> ' + (ln.length ? ln.map(App.esc).join(' / ') : '<i class="mp-none">No menu</i>') + '</p>' +
        '<div class="mp-kids md-kids">' + kids.map(function (p) { var c = lunchOf(day, p.id); return '<button class="hm-kid ' + c + '" data-wlunch="' + day + '|' + p.id + '" style="' + App.pstyle(p) + '"><i></i>' + App.esc(p.name) + ' · ' + (c === 'home' ? 'Home' : 'School') + '</button>'; }).join('') + '</div></div>';
    }
    var body = function () { return '<div class="sheet-pad md"><div class="label">Meal plan</div><h2 class="serif sheet-h">' + App.fmt.dayShort(d) + ' ' + App.fmt.monthShort(d) + ' ' + d.getDate() + '</h2>' +
      '<div class="md-rows">' + rows.join('') + '</div>' + school + (App.parent ? '<div class="md-acts"><button class="md-btn md-primary" data-md-add>＋ Add meal</button></div>' : '') + '</div>'; };
    App.sheet(body(), { cls: 'sheet--meal', onMount: function (el) { el.addEventListener('click', function (ev) {
      var k = ev.target.closest('[data-wlunch]'); if (k) { ev.stopPropagation(); var q = k.dataset.wlunch.split('|'); toggleLunch(q[0], q[1]); var c = lunchOf(q[0], q[1]); k.className = 'hm-kid ' + c; k.lastChild.textContent = App.person(q[1]).name + ' · ' + (c === 'home' ? 'Home' : 'School'); if (V.el) render(); return; }
      var m = ev.target.closest('[data-meal]'); if (m) { App.closeSheet(); return setTimeout(function () { mealSheet(m.dataset.meal); }, 60); }
      if (ev.target.closest('[data-md-add]')) { App.closeSheet(); setTimeout(function () { App.editEmbed('tab=meals&add=1&date=' + day + '&slot=dinner', 'New meal'); }, 60); }
    }); } });
  }
  App.mealSheet = mealSheet; App.mealDaySheet = daySheet;

  var V = { el: null, off: 0 };
  function start() {
    var n = App.dayStart(App.now()), sun = App.look && App.look.weekStart === 'sun';
    if (!sun && (n.getDay() === 6 || n.getDay() === 0)) n = App.addDays(n, n.getDay() === 6 ? 2 : 1);   // weekend: show the coming week
    return App.addDays(n, -(sun ? n.getDay() : (n.getDay() + 6) % 7) + V.off * 7);
  }
  function render() {
    var s0 = start(), today = ds(App.now());
    var days = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return App.addDays(s0, i); });
    var head = '<div class="ml-head"><div><div class="label">Meal plan</div><h1>' + App.fmt.monthShort(days[0]) + ' ' + days[0].getDate() + ' – ' + App.fmt.monthShort(days[6]) + ' ' + days[6].getDate() + '</h1></div>' +
      '<div class="ml-nav"><div class="ml-week"><button data-wk="-1" aria-label="Previous week">‹</button><button data-wk="0">This week</button><button data-wk="1" aria-label="Next week">›</button></div></div>' +
      '<div class="ml-acts"><button class="view-add" data-view-add="meals">＋ Add meal</button><button class="ml-recipes" data-recipes>📖 Recipes</button></div></div>';
    var kids = schoolKids();
    var rows = [['dinner', 'Dinner'], ['extras', 'Other meals']].concat(kids.length ? [['school', 'School lunch']] : []);
    function cellHtml(r, d) {
      var day = ds(d), inner = '';
      if (r[0] === 'extras') inner = EXTRAS.map(function (s) { return on(day, s[0]).map(function (m) { return '<div class="ml-meal" data-meal="' + m.id + '"><small>' + s[1] + '</small><b>' + App.esc(m.title) + '</b></div>'; }).join(''); }).join('');
      else if (r[0] === 'school') inner = isSchoolDay(d) ? on(day, 'school').map(function (m) { return '<div class="ml-meal" data-mschool="' + day + '"><b>' + App.esc(m.title) + '</b></div>'; }).join('') +
        '<div class="ml-kids">' + kids.filter(function (p) { return !App.schoolDay(d, p.id).off; }).map(function (p) { var c = lunchOf(day, p.id); return '<button class="hm-kid ' + c + '" data-wlunch="' + day + '|' + p.id + '" style="' + App.pstyle(p) + '"><i></i>' + App.esc(p.name[0]) + ' ' + (c === 'home' ? '🏠' : '🏫') + '</button>'; }).join('') + '</div>' : '';
      else inner = on(day, 'dinner').map(function (m) { var w = forWho(m); return '<div class="ml-meal" data-meal="' + m.id + '"><b>' + App.esc(m.title) + '</b>' + (w ? '<small>' + App.esc(w) + '</small>' : '') + '</div>'; }).join('');
      var tap = r[0] === 'dinner' && !inner ? ' data-madd="' + day + '|dinner"' : r[0] === 'school' && inner ? ' data-mschool="' + day + '"' : !inner ? ' data-mdayhead="' + day + '"' : '';
      return '<div class="ml-cell' + (day === today ? ' is-today' : '') + '"' + tap + '>' + inner + '</div>';
    }
    var dayHead = function (d) { return '<div class="ml-day' + (ds(d) === today ? ' is-today' : '') + '" data-mdayhead="' + ds(d) + '" role="button"><b>' + App.fmt.dayShort(d) + '</b><span class="num">' + d.getDate() + '</span></div>'; };
    // phones: an agenda — one card per day (dinner, other meals, school breakfast & lunch with per-kid School/Home toggles)
    if (document.documentElement.classList.contains('is-phone')) {
      var cards = days.map(function (d) {
        var day = ds(d), w = d.getDay(), inK = isSchoolDay(d) ? kids.filter(function (p) { return !App.schoolDay(d, p.id).off; }) : [];
        var din = on(day, 'dinner'), ex = EXTRAS.map(function (x) { return on(day, x[0]).map(function (m) { return '<div class="mp-line mp-tap" data-meal="' + m.id + '"><em>' + x[1] + '</em><b>' + App.esc(m.title) + '</b><i class="mp-chev">›</i></div>'; }).join(''); }).join('');
        var bf = {}, ln = on(day, 'school'), lunchTxt = ln.length ? names(ln) : '';
        inK.forEach(function (p) { var m = App.weeklyMenu(p.id, d, 'breakfast'); if (m && m.days[w]) bf[m.days[w]] = 1; if (!lunchTxt) { var l = App.weeklyMenu(p.id, d, 'lunch'); if (l && l.days[w]) lunchTxt = App.esc(l.days[w]); } });
        var school = inK.length ? (Object.keys(bf).length ? '<div class="mp-line mp-tap" data-mschool="' + day + '"><em>🥣 Breakfast</em><span>' + Object.keys(bf).map(App.esc).join(' / ') + '</span></div>' : '') +
          '<div class="mp-line mp-tap" data-mschool="' + day + '"><em>🏫 Lunch</em><span>' + (lunchTxt || '<i class="mp-none">No menu</i>') + '</span><i class="mp-chev">›</i></div>' +
          '<div class="mp-kids">' + inK.map(function (p) { var c = lunchOf(day, p.id); return '<button class="hm-kid ' + c + '" data-wlunch="' + day + '|' + p.id + '" style="' + App.pstyle(p) + '"><i></i>' + App.esc(p.name) + ' · ' + (c === 'home' ? 'Home' : 'School') + '</button>'; }).join('') + '</div>' : '';
        return '<section class="mp-day' + (day === today ? ' is-today' : '') + '"><div class="mp-head" data-mdayhead="' + day + '" role="button"><b>' + App.fmt.dayShort(d) + '</b><span class="num">' + d.getDate() + '</span><small>' + App.fmt.monthShort(d) + (day === today ? ' · Today' : '') + '</small></div>' +
          (din.length ? din.map(function (m) { var fw = forWho(m); return '<div class="mp-line mp-dinner mp-tap" data-meal="' + m.id + '"><em>Dinner</em><b>' + App.esc(m.title) + (fw ? ' <small>' + App.esc(fw) + '</small>' : '') + '</b><i class="mp-chev">›</i></div>'; }).join('')
            : '<div class="mp-line mp-dinner mp-tap" data-madd="' + day + '|dinner"><em>Dinner</em><i class="mp-none">Not planned</i>' + (App.parent ? '<i class="mp-chev mp-plus">＋</i>' : '') + '</div>') + ex + school + '</section>';
      }).join('');
      V.el.innerHTML = '<div class="meals meals--phone">' + head + '<div class="mp-list">' + cards + '</div></div>';
      return;
    }
    var grid = App.portrait
      // portrait: days are rows, meal types are columns
      ? '<div class="ml-grid" style="grid-template-columns:96px repeat(' + rows.length + ', minmax(0, 1fr));grid-template-rows:40px repeat(7, minmax(0, 1fr))"><div></div>' +
        rows.map(function (r) { return '<div class="ml-slot" style="justify-content:center">' + r[1] + '</div>'; }).join('') +
        days.map(function (d) { return dayHead(d) + rows.map(function (r) { return cellHtml(r, d); }).join(''); }).join('') + '</div>'
      : '<div class="ml-grid" style="grid-template-rows:56px repeat(' + rows.length + ', minmax(0, 1fr))"><div></div>' + days.map(dayHead).join('') +
        rows.map(function (r) { return '<div class="ml-slot">' + r[1] + '</div>' + days.map(function (d) { return cellHtml(r, d); }).join(''); }).join('') + '</div>';
    var none = !(D.meals || []).length ? '<p class="ml-empty serif"><i>Tap ✎ Edit to plan meals</i></p>' : '';
    V.el.innerHTML = '<div class="meals">' + head + grid + none + '</div>';
  }
  App.register('meals', {
    show: function (el) {
      if (!V.el) { V.el = el; el.addEventListener('click', function (e) { var l = e.target.closest('[data-wlunch]'); if (l) { e.stopPropagation(); var q = l.dataset.wlunch.split('|'); toggleLunch(q[0], q[1]); render(); return; }
        var t = e.target.closest('[data-meal]'); if (t) return mealSheet(t.dataset.meal);
        if ((t = e.target.closest('[data-madd]'))) { var a = t.dataset.madd.split('|'); if (App.parent && App.editEmbed) return App.editEmbed('tab=meals&add=1&date=' + a[0] + '&slot=' + a[1], 'New meal'); return daySheet(a[0]); }
        if ((t = e.target.closest('[data-mschool]'))) return daySheet(t.dataset.mschool);
        if ((t = e.target.closest('[data-mdayhead]'))) return daySheet(t.dataset.mdayhead); var b = e.target.closest('[data-wk]'); if (!b) return; var d = +b.dataset.wk; V.off = d ? V.off + d : 0; render(); }); }
      render();
    }
  });
})();
