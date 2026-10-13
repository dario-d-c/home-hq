// Shopping: categorized list (left) + quick-add with usuals (right).
(function () {
  'use strict';
  var D = window.DATA;
  var V = { el: null, store: 'all', query: '', drawer: false, pending: {}, flash: null };

  function onT(g) { return window.HQTrip.onNext(g, D.trips); }
  // 'any' = Anywhere: shows in its own tab and in every store's tab
  function inStore(g, st) { return st === 'all' || g.store === st || (g.store === 'any' && st !== 'any'); }
  function open() { return D.groceries.filter(function (g) { return onT(g) && !g.done && inStore(g, V.store); }); }
  function done() { return D.groceries.filter(function (g) { return onT(g) && g.done && inStore(g, V.store); }); }
  var WF = function (n) { return 'https://www.amazon.com/s?k=' + encodeURIComponent(n) + '&i=wholefoods'; };
  function storeName(id) { var x = D.stores.filter(function (s) { return s.id === id; })[0]; return x ? x.name : ''; }

  function categorize(name) {
    var n = name.toLowerCase();
    var hit = D.catalog.filter(function (c) { return c[0].toLowerCase() === n; })[0] ||
      D.catalog.filter(function (c) { var a = c[0].toLowerCase(); return a.indexOf(n) > -1 || n.indexOf(a) > -1; })[0] ||
      D.catalog.filter(function (c) { return n.split(/\s+/).some(function (w) { return w.length > 3 && c[0].toLowerCase().indexOf(w) > -1; }); })[0];
    return hit ? hit[1] : 'Other';
  }
  function find(name, isDone) {
    return D.groceries.filter(function (g) { return onT(g) && !!g.done === isDone && g.name.toLowerCase() === name.toLowerCase(); })[0];
  }

  function row(g) {
    return '<div class="s-row' + (V.pending[g.id] ? ' is-checking' : '') + '" data-id="' + g.id + '">' +
      '<button class="s-hit" data-check="' + g.id + '">' +
      '<span class="s-box">' + App.icon('check', 22) + '</span>' +
      '<span class="s-name"><b>' + App.esc(g.name) + '</b>' + (g.note ? '<small>' + App.esc(g.note) + '</small>' : '') + '</span>' +
      (V.store === 'all' && g.store && g.store !== (D.stores[0] || {}).id && storeName(g.store) ? '<span class="s-store' + (g.store === 'any' ? ' s-store--any' : '') + '">' + App.esc(storeName(g.store)) + '</span>'
        : V.store !== 'all' && V.store !== 'any' && g.store === 'any' ? '<span class="s-store s-store--any">Anywhere</span>' : '') +
      '</button>' + (V.store === 'wf' ? '<a class="s-wf" href="' + WF(g.name) + '" target="_blank" rel="noopener" data-wf aria-label="Find ' + App.esc(g.name) + ' on Whole Foods">↗</a>' : '') +
      '<button class="s-del" data-remove="' + g.id + '" aria-label="Remove">' + App.icon('x', 22) + '</button>' +
      '<div class="s-qty"><button data-qty="-1" data-id="' + g.id + '" aria-label="Less">' + App.icon('minus', 22) + '</button><span class="num">' + g.qty + '</span><button data-qty="1" data-id="' + g.id + '" aria-label="More">' + App.icon('plus', 22) + '</button></div>' +
      '</div>';
  }

  function listHTML() {
    var items = open(), order = D.catOrder.all.concat(['Other']);
    items.forEach(function (g) { if (order.indexOf(g.cat) < 0) order.push(g.cat); });
    var groups = order.map(function (cat) { return { cat: cat, items: items.filter(function (g) { return g.cat === cat; }) }; }).filter(function (x) { return x.items.length; });
    var d = done();
    var wfBar = V.store === 'wf' && items.length ? '<div class="s-wfbar"><span class="label">Whole Foods on Amazon</span><a class="btn btn--ghost" href="' + WF(items[0].name) + '" target="_blank" rel="noopener" data-wf>Open Whole Foods ↗</a><button class="btn btn--ghost" data-wf-copy>Copy list</button></div>' : '';
    return wfBar + (items.length ? groups.map(function (gr) {
      return '<div class="s-cat" data-cat="' + gr.cat + '"><div class="s-cat-h"><span class="label">' + gr.cat + '</span><span class="label" data-cat-count>' + gr.items.length + '</span></div>' + gr.items.map(row).join('') + '</div>';
    }).join('') : '<div class="s-empty serif">All stocked up.<br><i>Nothing left to buy.</i></div>') +
      (d.length ? '<div class="s-drawer' + (V.drawer ? ' is-open' : '') + '">' +
        '<div class="s-drawer-bar"><button class="s-drawer-h" data-drawer><span>' + App.icon('check', 22) + ' Got it <b class="num">(' + d.length + ')</b></span><span class="label">' + (V.drawer ? 'Hide' : 'Show') + '</span></button>' +
        '<button class="btn btn--ghost s-clear-top" data-clear>Clear checked</button></div>' +
        (V.drawer ? '<div class="s-drawer-list">' + d.map(function (g) {
          return '<button class="s-got" data-revive="' + g.id + '">' + App.esc(g.name) + '<span class="label">Add back</span></button>';
        }).join('') + '<button class="btn btn--ghost s-clear" data-clear>Clear ' + d.length + ' checked items</button></div>' : '') +
        '</div>' : '');
  }

  function usualByName(n) { return (D.usuals || []).filter(function (u) { return u.name.toLowerCase() === String(n).toLowerCase(); })[0]; }
  function suggestHTML() {
    var q = V.query.trim().toLowerCase(), us = D.usuals || [];
    if (q) {
      var matches = us.filter(function (u) { return u.name.toLowerCase().indexOf(q) > -1; }).slice(0, 5);
      var exact = matches.some(function (m) { return m.name.toLowerCase() === q; });
      return '<div class="label">Your usual items</div><div class="s-ac">' + matches.map(function (m) {
        var on = find(m.name, false);
        return '<button class="s-ac-row" data-add="' + App.esc(m.name) + '"><b>' + App.esc(m.name) + '</b><span class="label">' + (on ? 'On list · ×' + on.qty : App.esc(m.cat || '')) + '</span>' + App.icon('plus', 26) + '</button>';
      }).join('') + (exact ? '' : '<button class="s-ac-row s-ac-row--new" data-add="' + App.esc(V.query.trim()) + '"><b>Add “' + App.esc(V.query.trim()) + '”</b><span class="label">' + categorize(V.query) + '</span>' + App.icon('plus', 26) + '</button>') + '</div>';
    }
    if (!us.length) return '<div class="label">Usual items</div><p class="s-hint serif"><i>Add the things you buy every week (tap ✎ Edit → Usual items) and they’ll appear here as one-tap buttons.</i></p>';
    return '<div class="label">Usuals · tap to add</div><div class="s-usuals">' + us.map(function (u) { return usualTile(u.name); }).join('') + '</div>';
  }
  function usualTile(name) {
    var on = find(name, false), u = usualByName(name);
    return '<button class="s-tile' + (on ? ' is-on' : '') + '" data-add="' + App.esc(name) + '">' +
      '<b>' + App.esc(name) + '</b><span>' + (on ? App.icon('check', 16) + 'On list' + (on.qty > 1 ? ' ×' + on.qty : '') : App.esc((u && u.cat) || categorize(name))) + '</span></button>';
  }

  // ---- granular updates (full list + usuals rebuild costs ~500ms on the wall tablet)
  function swap(old, html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    old.parentNode.replaceChild(tmp.firstChild, old);
  }
  function refreshSuggestFor(g) {
    if (V.query.trim()) return paintSuggest();
    var t = V.el.querySelector('.s-usuals [data-add="' + App.esc(g.name) + '"]');
    if (t) swap(t, usualTile(g.name));
  }
  function catCount(cat) {
    var c = V.el.querySelector('.s-cat[data-cat="' + cat + '"]');
    if (!c) return;
    var n = c.querySelectorAll('.s-row').length;
    if (!n) c.parentNode.removeChild(c);
    else c.querySelector('[data-cat-count]').textContent = n;
  }
  function inView(g) { return !g.done && inStore(g, V.store); }
  function insertRow(g) {
    var cat = V.el.querySelector('.s-cat[data-cat="' + g.cat + '"]');
    if (!inView(g)) return paintHead();
    if (!cat) return paintList();
    var tmp = document.createElement('div');
    tmp.innerHTML = row(g);
    cat.appendChild(tmp.firstChild);
    catCount(g.cat);
    paintHead();
  }
  function removeRow(g) {
    var r = V.el.querySelector('.s-list [data-id="' + g.id + '"]');
    var drawer = V.el.querySelector('.s-drawer');
    if (!r || !drawer || V.drawer || !open().length) return paintList();
    r.parentNode.removeChild(r);
    catCount(g.cat);
    drawer.querySelector('.num').textContent = '(' + done().length + ')';
    paintHead();
  }
  function flash(g) {
    var r = V.el.querySelector('.s-list [data-id="' + g.id + '"]');
    if (!r) return;
    r.classList.add('is-flash');
    if (r.scrollIntoView) r.scrollIntoView({ block: 'nearest' });
    setTimeout(function () { r.classList.remove('is-flash'); }, 1200);
  }

  function paintList() { var l = V.el.querySelector('.s-list'); var st = l.scrollTop; l.innerHTML = listHTML(); l.scrollTop = st; paintHead(); }
  function paintSuggest() { V.el.querySelector('.s-suggest').innerHTML = suggestHTML(); }
  function paintHead() {
    var all = D.groceries.filter(function (g) { return onT(g) && !g.done; });
    var nt = window.HQTrip.next(D.trips), lb = V.el.querySelector('.s-head .label'); if (lb) lb.textContent = nt ? 'Next trip · ' + window.HQTrip.label(nt, D.stores) : 'Shared list';
    V.el.querySelector('.s-count').innerHTML = '<span class="num">' + open().length + '</span> to get';
    V.el.querySelector('.s-stores').innerHTML = [['all', 'All']].concat(D.stores.map(function (s) { return [s.id, s.name]; })).map(function (s) {
      var n = all.filter(function (g) { return inStore(g, s[0]); }).length;
      return '<button class="' + (V.store === s[0] ? 'is-on' : '') + '" data-store="' + s[0] + '">' + s[1] + ' <span class="num">' + n + '</span></button>';
    }).join('');
  }
  function render() {
    V.el.innerHTML = '<div class="shop">' +
      '<header class="s-head"><div><div class="label">Shared list</div><h1 class="serif">Groceries</h1></div><div class="s-count"></div><div class="seg s-stores"></div></header>' +
      '<div class="s-list"></div>' +
      '<aside class="s-side">' +
      '  <div class="s-add">' +
      '    <label class="s-input-wrap">' + App.icon('plus', 30) + '<input class="s-input" placeholder="Add an item…" autocomplete="off" enterkeyhint="done"></label>' +
      '  </div>' +
      '  <div class="s-suggest"></div>' +
      '</aside></div>';
    var input = V.el.querySelector('.s-input');
    input.value = V.query;
    input.addEventListener('input', function () { V.query = input.value; paintSuggest(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && input.value.trim()) { add(input.value); } });
    paintList(); paintSuggest();
  }

  function add(name) {
    name = name.trim();
    var g = find(name, false), msg;
    if (g) {
      g.qty++;
      msg = 'Already on the list · now <b>×' + g.qty + '</b> ' + App.esc(g.name);
      var q = V.el.querySelector('.s-list [data-id="' + g.id + '"] .s-qty .num');
      if (q) q.textContent = g.qty;
    } else if ((g = find(name, true))) {
      g.done = false; g.qty = (usualByName(name) || {}).qty || 1;
      msg = 'Added back <b>' + App.esc(g.name) + '</b>';
      paintList();
    } else {
      var u = usualByName(name);
      g = { id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: u ? u.name : name.charAt(0).toUpperCase() + name.slice(1), cat: u && u.cat ? u.cat : categorize(name), qty: u && u.qty ? u.qty : 1,
        store: V.store !== 'all' ? V.store : u && u.store ? u.store : 'any', done: false, note: '' };
      var nt0 = window.HQTrip.next(D.trips); if (nt0) g.trip = nt0.id;
      D.groceries.push(g);
      msg = 'Added <b>' + App.esc(g.name) + '</b> to ' + g.cat;
      insertRow(g);
    }
    var hadQuery = !!V.query.trim();
    V.query = '';
    var input = V.el.querySelector('.s-input');
    if (input) input.value = '';
    if (hadQuery) paintSuggest(); else refreshSuggestFor(g);
    flash(g);
    App.emit('data');
    App.toast(msg, { icon: 'cart', ms: 3000 });
  }

  function check(g) {
    V.pending[g.id] = true;
    var rowEl = V.el.querySelector('[data-id="' + g.id + '"]');
    rowEl.classList.add('is-checking');
    setTimeout(function () {
      if (!V.pending[g.id]) return;
      delete V.pending[g.id];
      g.done = true;
      removeRow(g);
      refreshSuggestFor(g);
      App.emit('data');
    }, 1200);
    App.toast('<b>' + App.esc(g.name) + '</b> checked off', {
      icon: 'check',
      undo: function () {
        var wasDone = g.done;
        delete V.pending[g.id];
        g.done = false;
        if (wasDone) paintList();
        else { var r = V.el.querySelector('.s-list [data-id="' + g.id + '"]'); if (r) r.classList.remove('is-checking'); }
        refreshSuggestFor(g);
        App.emit('data');
      }
    });
  }

  function onClick(e) {
    var t;
    if (e.target.closest('[data-wf]')) { e.stopPropagation(); return; }
    if (e.target.closest('[data-wf-copy]')) { var txt = open().map(function (g) { return (g.qty > 1 ? g.qty + ' × ' : '') + g.name; }).join('\n');
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { App.toast('List copied', { icon: 'check', ms: 2000 }); }, function () { window.prompt('Copy the list', txt); }); return; }
    if ((t = e.target.closest('[data-check]'))) {
      var g = D.groceries.filter(function (x) { return x.id === t.dataset.check; })[0];
      if (g && !V.pending[g.id]) check(g);
      else if (g) { delete V.pending[g.id]; t.parentNode.classList.remove('is-checking'); }
      return;
    }
    if ((t = e.target.closest('[data-remove]'))) {
      var gr = D.groceries.filter(function (x) { return x.id === t.dataset.remove; })[0]; if (!gr) return;
      D.groceries = D.groceries.filter(function (x) { return x !== gr; }); paintList(); refreshSuggestFor(gr); App.emit('data');
      return App.toast('Removed <b>' + App.esc(gr.name) + '</b>', { icon: 'x', undo: function () { D.groceries.push(gr); paintList(); refreshSuggestFor(gr); App.emit('data'); } });
    }
    if ((t = e.target.closest('[data-qty]'))) {
      var q = D.groceries.filter(function (x) { return x.id === t.dataset.id; })[0];
      q.qty = Math.max(1, q.qty + +t.dataset.qty);
      t.parentNode.querySelector('.num').textContent = q.qty;
      refreshSuggestFor(q);
      return;
    }
    if ((t = e.target.closest('[data-add]'))) return add(t.dataset.add);
    if ((t = e.target.closest('[data-store]'))) { V.store = t.dataset.store; return paintList(); }
    if ((t = e.target.closest('[data-drawer]'))) { V.drawer = !V.drawer; return paintList(); }
    if ((t = e.target.closest('[data-revive]'))) {
      var r = D.groceries.filter(function (x) { return x.id === t.dataset.revive; })[0];
      r.done = false; paintList(); paintSuggest(); App.emit('data');
      return App.toast('Added back <b>' + App.esc(r.name) + '</b>', { icon: 'cart', ms: 2500 });
    }
    if ((t = e.target.closest('[data-clear]'))) {
      var gone = done();
      D.groceries = D.groceries.filter(function (x) { return gone.indexOf(x) < 0; });
      V.drawer = false;
      paintList(); App.emit('data');
      App.toast('Cleared ' + gone.length + ' items', {
        icon: 'check', undo: function () { D.groceries = D.groceries.concat(gone); paintList(); App.emit('data'); }
      });
    }
  }

  App.register('shopping', {
    show: function (el) {
      if (!V.el) { V.el = el; el.addEventListener('click', onClick); }
      render();
    }
  });
})();
