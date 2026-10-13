// Edit mode for signed-in parents (Cloudflare Access login), inside the themed dashboard.
// Native: the frame's own sheets (add/edit events, routines & one-day changes, chores ticks, shopping list) save with full
// parent rights. Everything else opens the editor's form for that item in a themed bottom sheet (embedded /edit/?embed=1).
(function () {
  'use strict';
  var D = window.DATA, $ = function (s) { return document.querySelector(s); };
  var TAB = { home: 'events', calendar: 'events', tasks: 'chores', meals: 'meals', shopping: 'groceries' };
  var MORE = [
    ['people', 'Family', 'Names, roles, birthdays, colours, school'], ['routine', 'Routines & days off', 'Weekly routines for everyone'],
    ['wishes', 'Wish lists', 'Christmas, birthday, anytime — per person'], ['dates', 'Birthdays & anniversaries', 'Yearly dates, reminders on Today'], ['recipes', 'Recipes & cocktails', 'Saved recipes, add to shopping'], ['usuals', 'Usual items', 'Your staples catalog'], ['stores', 'Stores', 'Where you shop'],
    ['care', 'Care & babysitter', 'Care schedule and sitter link'], ['calendars', 'Calendar sync', 'Google, iCloud, Outlook, school calendar links'],
    ['photos', 'Photos', 'Screensaver photos'], ['look', 'Look & layout', 'Themes, colours, what shows'], ['widget', 'iPhone widget', 'Home-screen widget'],
    ['groceries', 'Shopping trips', 'Plan trips, stores, the list'], ['events', 'All events', 'Every event as a list'], ['chores', 'All chores', 'Every chore as a list']
  ];
  App.parent = false; App.editMode = false;

  function embed(q, title) {
    var url = '/edit/?embed=1&' + q; document.documentElement.classList.add('em-open');
    App.sheet('<div class="em-head"><div class="label">Edit</div><h2 class="serif sheet-h">' + App.esc(title || 'Edit') + '</h2></div>' +
      '<iframe class="em-frame" src="' + url + '" title="' + App.esc(title || 'Edit') + '"></iframe>', { cls: 'sheet--embed' + (/(open|add|scan)=/.test(q) ? ' sheet--form' : ''), onClose: function () { document.documentElement.classList.remove('em-open'); refresh(); } });
  }
  App.editEmbed = embed;
  // in-view add buttons (parents) + long-press a chore to edit it
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-view-add]'); if (!b) return; ev.stopPropagation(); ev.preventDefault();
    var k = b.dataset.viewAdd;
    if (k === 'chores') return embed('tab=chores&add=1&r=' + encodeURIComponent(b.dataset.r || ''), 'New chore');
    if (k === 'meals') return embed('tab=meals&add=1', 'New meal');
  }, true);
  var lp = null, lpFired = false;
  function lpStart(ev) { var c = ev.target.closest('[data-ch]'); if (!c || !App.parent || App.editMode) return; lpFired = false;
    clearTimeout(lp); lp = setTimeout(function () { lpFired = true; if (navigator.vibrate) navigator.vibrate(10); embed('tab=chores&open=' + encodeURIComponent(c.dataset.ch.split('@')[0]), 'Chore'); }, 550); }
  function lpEnd() { clearTimeout(lp); }
  document.addEventListener('touchstart', lpStart, { passive: true }); document.addEventListener('mousedown', lpStart);
  ['touchend', 'touchmove', 'touchcancel', 'mouseup', 'mouseleave'].forEach(function (t) { document.addEventListener(t, lpEnd, { passive: true }); });
  document.addEventListener('click', function (ev) { if (lpFired && ev.target.closest('[data-ch]')) { lpFired = false; ev.stopPropagation(); ev.preventDefault(); } }, true);
  document.addEventListener('contextmenu', function (ev) { if (App.parent && ev.target.closest('[data-ch]')) ev.preventDefault(); });
  document.addEventListener('click', function (ev) { if (ev.target.closest('[data-recipes]')) { ev.stopPropagation(); ev.preventDefault(); embed('tab=recipes', 'Recipes'); } }, true);
  function refresh() { if (window.HQPull) window.HQPull(); }
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.type === 'hq-saved') refresh();
    if (e.data.type === 'hq-edit-close') { App.closeSheet(); refresh(); }
  });

  function moreSheet() {
    document.documentElement.classList.add('em-open');
    var tiles = (App.parent ? '<button class="em-tile' + (App.editMode ? ' is-on' : '') + '" data-em-act="edit"><b>✎</b><span>' + (App.editMode ? 'Editing on' : 'Edit mode') + '</span></button>' : '') +
      ((App.season && App.season() === 'christmas') || new Date().getMonth() === 11 ? '<button class="em-tile" data-em-act="wish"><b>🎄</b><span>Christmas lists</span></button>' : '<button class="em-tile" data-em-act="wish"><b>🎁</b><span>Wish lists</span></button>') +
      '<button class="em-tile" data-em-act="sitter"><b>🧸</b><span>Sitter mode</span></button><button class="em-tile" data-em-act="show"><b>🖼</b><span>Slideshow</span></button>';
    App.sheet('<div class="sheet-pad"><div class="label">Home HQ</div><h2 class="serif sheet-h">More</h2><div class="em-tiles">' + tiles + '</div>' +
      (App.parent ? '<div class="label em-sub">Settings</div><div class="em-more">' + MORE.map(function (m) {
        return '<button class="em-row" data-em-more="' + m[0] + '"><b>' + m[1] + '</b><span>' + m[2] + '</span><i>›</i></button>';
      }).join('') + '</div>' : '') + '</div>', { cls: 'sheet--more', onClose: function () { document.documentElement.classList.remove('em-open'); }, onMount: function (el) {
      el.addEventListener('click', function (ev) {
        var a = ev.target.closest('[data-em-act]');
        if (a) { var k0 = a.dataset.emAct; App.closeSheet();
          setTimeout(function () { if (k0 === 'edit') setMode(!App.editMode); else if (k0 === 'wish') App.wishSheet(); else { var b0 = $(k0 === 'sitter' ? '#railSitter' : '#railShow'); if (b0) b0.click(); } }, 60); return; }
        var b = ev.target.closest('[data-em-more]'); if (!b) return;
        var k = b.dataset.emMore;
        App.closeSheet(); setTimeout(function () { if (k === 'calendars' && App.calSyncSheet) return App.calSyncSheet(); embed('tab=' + k, b.querySelector('b').textContent); }, 60);
      });
    } });
  }
  App.moreSheet = moreSheet;

  function setMode(on) {
    App.editMode = on; document.documentElement.classList.toggle('edit-mode', on);
    var b = $('#railEdit'); if (b) b.classList.toggle('is-on', on);
    try { sessionStorage.setItem('hq-editmode', on ? '1' : ''); } catch (e) {}
    if (on) App.toast && App.toast('<b>Edit mode</b> — tap anything to change it', { icon: 'check' });
  }

  // edit-mode taps: route items to their editor
  document.addEventListener('click', function (ev) {
    if (!App.editMode || ev.target.closest('.sheet-layer, #sheetLayer, .em-bar, .rail')) return;
    var t, id;
    if ((t = ev.target.closest('[data-ev]'))) {
      id = t.dataset.ev;
      if (/^rt:/.test(id)) return;                     // routine blocks keep their native day sheet
      ev.stopPropagation(); ev.preventDefault();
      if (/^bday:d:/.test(id)) return embed('tab=dates&open=' + encodeURIComponent(id.split(':')[2]), 'Birthday');
      if (/^bday:/.test(id)) return embed('tab=people', 'Family');
      var ev0 = (App.events ? App.events() : D.events).filter(function (x) { return x.id === id; })[0];
      return embed('tab=events&open=' + encodeURIComponent(id.split('@')[0]), ev0 && ev0.readOnly && !ev0.recurring ? 'Synced event' : 'Event');
    }
    if ((t = ev.target.closest('[data-ch]'))) { ev.stopPropagation(); ev.preventDefault(); return embed('tab=chores&open=' + encodeURIComponent(t.dataset.ch.split('@')[0]), 'Chore'); }
    if ((t = ev.target.closest('.s-row[data-id], [data-check]'))) { ev.stopPropagation(); ev.preventDefault(); return embed('tab=groceries&open=' + encodeURIComponent(t.dataset.id || t.dataset.check), 'Shopping item'); }
    if ((t = ev.target.closest('[data-routine], .h-lane-head'))) return;   // native routine sheet
    if ((t = ev.target.closest('.h-meals'))) { ev.stopPropagation(); ev.preventDefault(); return embed('tab=meals', 'Meals'); }
  }, true);

  function bar() {
    var el = document.createElement('div'); el.className = 'em-bar';
    el.innerHTML = '<span>✎ Editing</span><button data-em-add>＋ Add</button><button data-em-scan>✨ Scan</button><button data-em-done>Done</button>';
    document.body.appendChild(el);
    el.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-em-done]')) return setMode(false);
      if (ev.target.closest('[data-em-scan]')) return embed('tab=' + (TAB[App.current] || 'events') + '&scan=1', 'Scan or paste');
      if (ev.target.closest('[data-em-add]')) return embed('tab=' + (TAB[App.current] || 'events') + '&add=1', 'New ' + ({ tasks: 'chore', meals: 'meal', shopping: 'item' }[App.current] || 'event'));
    });
  }
  function railButtons() {
    var rail = $('#rail'), before = $('#railSitter'); if (!rail || $('#railEdit')) return;
    var mk = function (id, label, svg) { var b = document.createElement('button'); b.className = 'rail-show rail-parent'; b.id = id; b.innerHTML = svg + '<span>' + label + '</span>'; rail.insertBefore(b, before); return b; };
    mk('railEdit', 'Edit', '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/></svg>').addEventListener('click', function () { setMode(!App.editMode); });
    moreBtn(); if (0) mk('railMore', 'More', '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h.01M12 12h.01M19 12h.01"/></svg>').addEventListener('click', moreSheet);
  }
  function moreBtn() {
    var rail = $('#rail'); if (!rail || $('#railMore')) return;
    var b = document.createElement('button'); b.className = 'rail-show rail-more'; b.id = 'railMore';
    b.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h.01M12 12h.01M19 12h.01"/></svg><span>More</span>';
    rail.insertBefore(b, $('#railSitter')); b.addEventListener('click', moreSheet);
  }
  moreBtn();
  function enable() {
    App.parent = true; document.documentElement.classList.add('is-parent');
    railButtons(); bar();
    try { if (sessionStorage.getItem('hq-editmode')) setMode(true); } catch (e) {}
    var q = new URLSearchParams(location.search);
    var op = q.get('open'); if (op === 'calendars' && App.calSyncSheet) setTimeout(function () { App.calSyncSheet(); }, 400); else if (op) setTimeout(function () { embed('tab=' + encodeURIComponent(op), (MORE.filter(function (m) { return m[0] === op; })[0] || [0, 'Settings'])[1]); }, 400);
    else if (q.get('view') === 'more' || q.get('more')) setTimeout(moreSheet, 300);
    if (q.get('edit') === '1') setMode(true);
  }
  // signed-in parent? (the Access cookie; the kiosk frame with only a key gets 401 and stays as it is)
  if (!App.preview) {
    fetch('/api/me', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.email) enable(); }).catch(function () {});
  }
  // ?view=calendar|meals|shopping|chores|today deep links (iPhone widget)
  var V = { calendar: 'calendar', meals: 'meals', shopping: 'shopping', chores: 'tasks', tasks: 'tasks', today: 'home', home: 'home', family: 'home', more: 'home' };
  var v = new URLSearchParams(location.search).get('view');
  if (v && V[v]) { if (location.hash !== '#' + V[v]) history.replaceState(null, '', location.pathname + location.search + '#' + V[v]); }
})();
