// Calendar sync as a native dashboard sheet (no embedded editor iframe): list, add, edit (several people), delete, sync now.
(function () {
  'use strict';
  var D = window.DATA, esc = function (s) { return App.esc(s == null ? '' : String(s)); };
  var S = { cals: null, status: {}, view: 'list', cur: null, busy: '', err: '', delArm: false, el: null };
  function whoOf(c) { return Array.isArray(c.whos) && c.whos.length ? c.whos : c.who && c.who !== 'family' ? [c.who] : []; }
  function api(method, path, body) {
    return fetch('/api/' + path, { method: method, credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401) { var e = new Error('signin'); e.signin = true; throw e; }
        if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; }); });
  }
  function when(iso) { if (!iso) return ''; var d = new Date(iso); return (App.sameDay(d, App.now()) ? '' : App.fmt.dayShort(d) + ' ') + App.fmt.time(d); }
  function lastSync() { var t = 0; Object.keys(S.status || {}).forEach(function (k) { var f = S.status[k] && S.status[k].fetched; if (f && +new Date(f) > t) t = +new Date(f); }); return t ? when(new Date(t).toISOString()) : ''; }
  function dots(ids) { return ids.length ? ids.map(function (id) { var p = App.person(id) || {}; return '<i style="background:' + esc(p.color || '#888') + '"></i>'; }).join('') : '<i style="background:#16161A"></i>'; }
  function names(ids) { return ids.length ? ids.map(function (id) { return (App.person(id) || {}).name || id; }).join(', ') : 'Everyone'; }
  function msg() { return '<p class="cs2-msg' + (S.err ? ' cs2-err' : S.busy ? ' cs2-busy' : '') + '" aria-live="polite">' + (S.err || esc(S.busy) || '') + '</p>'; }
  function note(t) { S.err = t; var m = S.el && S.el.querySelector('.cs2-msg'); if (m) { m.className = 'cs2-msg' + (t ? ' cs2-err' : ''); m.innerHTML = t || ''; } }
  function listHtml() {
    if (!S.cals) return '<p class="cs2-hint">Loading…</p>' + msg();
    var ls = lastSync();
    return msg() + (S.cals.length ? '<div class="cs2-list">' + S.cals.map(function (c) {
      var st = S.status[c.id], w = whoOf(c);
      var line = !st ? 'Not synced yet' : st.ok ? st.count + ' events · synced ' + when(st.fetched) : '⚠ ' + esc(st.error || 'Couldn’t fetch') + (st.count ? ' · showing last ' + st.count + ' events' : '');
      return '<div class="cs2-row' + (st && !st.ok ? ' is-bad' : '') + '"><span class="cs2-dots">' + dots(w) + '</span>' +
        '<button class="cs2-main" data-cs2-edit="' + esc(c.id) + '"><b>' + esc(c.name) + '</b><span>' + esc(names(w)) + '</span><small>' + line + '</small></button>' +
        '<button class="cs2-ic" data-cs2-edit="' + esc(c.id) + '" aria-label="Edit">✎</button></div>';
    }).join('') + '</div>' : '<p class="cs2-hint">No calendars yet. Link a Google, iCloud or Outlook calendar and its events show up automatically.</p>') +
      '<div class="cs2-bar"><button class="btn btn--ghost" data-cs2-sync' + (S.busy ? ' disabled' : '') + '>🔄 Sync now</button><span class="cs2-last">' + (ls ? 'Last synced ' + ls : '') + '</span></div>' +
      '<details class="cs2-help"><summary>How to find a calendar link</summary><p><b>Google:</b> calendar.google.com on a computer → calendar ⋮ → Settings and sharing → <i>Secret address in iCal format</i>.</p><p><b>iCloud:</b> Calendar app → Calendars → ⓘ → Public Calendar → Share Link.</p><p><b>Outlook:</b> Settings → Calendar → Shared calendars → Publish → ICS link.</p></details>' +
      '<div class="sheet-actions"><button class="btn btn--solid" data-cs2-add>＋ Add calendar</button></div>';
  }
  function formHtml() {
    var c = S.cur, w = whoOf(c), isNew = !S.cals.some(function (x) { return x.id === c.id; });
    return msg() + '<label class="cs2-f"><span class="label">Name</span><input data-f="name" value="' + esc(c.name) + '" placeholder="e.g. Jamie’s soccer" autocomplete="off"></label>' +
      '<label class="cs2-f"><span class="label">Secret iCal link</span><textarea data-f="url" rows="3" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="https://… or webcal://…">' + esc(c.url) + '</textarea></label>' +
      '<div class="cs2-f"><span class="label">Whose calendar · pick one or more (none = everyone)</span><div class="chips cs2-who">' + D.people.map(function (p) {
        return '<button type="button" class="chip' + (w.indexOf(p.id) > -1 ? ' is-on' : '') + '" data-cs2-who="' + esc(p.id) + '" style="' + App.pstyle(p) + '"><i class="cs2-pd"></i>' + esc(p.name) + '</button>'; }).join('') + '</div></div>' +
      '<p class="cs2-hint">Events refresh every 15 minutes and are read-only on the calendar.</p>' +
      (!isNew ? '<button class="btn cs2-del' + (S.delArm ? ' is-armed' : '') + '" data-cs2-del>' + (S.delArm ? 'Tap again to delete “' + esc(c.name) + '”' : 'Delete calendar') + '</button>' : '') +
      '<div class="sheet-actions"><button class="btn btn--ghost" data-cs2-back>Cancel</button><button class="btn btn--solid" data-cs2-save' + (S.busy ? ' disabled' : '') + '>Save</button></div>';
  }
  // paint only the body content — the sheet itself never re-opens or re-animates
  function paint() {
    if (!S.el) return;
    var h = S.el.querySelector('.sheet-h'); if (h) h.textContent = S.view === 'form' ? (S.cals.some(function (x) { return x.id === S.cur.id; }) ? 'Edit calendar' : 'New calendar') : 'Calendar sync';
    var b = S.el.querySelector('.cs2-body'); if (b) b.innerHTML = S.view === 'form' ? formHtml() : listHtml();
  }
  function fail(e) {
    S.busy = '';
    S.err = e && e.signin ? 'Your sign-in has expired. <a href="/auth?next=' + encodeURIComponent('/?edit=1&view=more&open=calendars') + '" target="_top">Sign in again</a>, then retry.' : 'Couldn’t save — ' + esc(e && e.message || 'network error') + '. Nothing was changed.';
    paint();
  }
  function load() { return api('GET', 'calendars').then(function (j) { S.cals = j.calendars || []; S.status = j.status || {}; S.err = ''; paint(); }).catch(fail); }
  function put(list, okMsg) {
    S.busy = 'Saving and syncing…'; S.err = ''; paint();
    return api('PUT', 'calendars', list).then(function (j) {
      S.cals = j.calendars || []; S.status = j.status || {}; S.busy = ''; S.view = 'list'; S.delArm = false; paint();
      if (window.HQPull) window.HQPull(); if (okMsg) App.toast(okMsg, { icon: 'calendar' });
    }).catch(fail);
  }
  function readForm() {
    var f = function (k) { return S.el.querySelector('[data-f=' + k + ']'); };
    var whos = App.$$('[data-cs2-who].is-on', S.el).map(function (b) { return b.dataset.cs2Who; });
    return Object.assign({}, S.cur, { name: f('name').value.trim(), url: f('url').value.trim(), whos: whos, who: whos.length === 1 ? whos[0] : 'family' });
  }
  App.calSyncSheet = function () {
    S.view = 'list'; S.err = ''; S.busy = ''; S.delArm = false;
    App.sheet('<div class="sheet-pad cs2"><div class="label">Settings</div><h2 class="serif sheet-h">Calendar sync</h2><div class="cs2-body">' + listHtml() + '</div></div>', {
      cls: 'sheet--wide sheet--cs2', full: true, onClose: function () { S.el = null; },
      onMount: function (el) {
        S.el = el;
        el.addEventListener('click', function (ev) {
          var t = ev.target.closest('button'); if (!t) return;
          if (t.dataset.cs2Who) { t.classList.toggle('is-on'); return; }   // toggle in place, no repaint
          if (t.hasAttribute('data-cs2-add')) { S.cur = { id: 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: '', url: '', who: 'family', whos: [] }; S.view = 'form'; S.err = ''; S.delArm = false; paint(); return; }
          if (t.dataset.cs2Edit) { S.cur = Object.assign({}, S.cals.filter(function (x) { return x.id === t.dataset.cs2Edit; })[0]); S.view = 'form'; S.err = ''; S.delArm = false; paint(); return; }
          if (t.hasAttribute('data-cs2-back')) { S.view = 'list'; S.err = ''; paint(); return; }
          if (t.hasAttribute('data-cs2-sync')) { S.busy = 'Syncing…'; S.err = ''; paint(); api('POST', 'calendars/sync').then(function (j) { S.cals = j.calendars || S.cals; S.status = j.status || {}; S.busy = ''; paint(); if (window.HQPull) window.HQPull(); }).catch(fail); return; }
          if (t.hasAttribute('data-cs2-del')) {
            if (!S.delArm) { S.delArm = true; paint(); return; }
            var id = S.cur.id, name = S.cur.name;
            return put(S.cals.filter(function (x) { return x.id !== id; }).map(function (x) { return Object.assign({}, x); }), 'Deleted <b>' + esc(name) + '</b>');
          }
          if (t.hasAttribute('data-cs2-save')) {
            var c = readForm();
            if (!c.name) { note('Give it a name.'); return; }
            if (!/^(https?|webcal):\/\//i.test(c.url)) { S.cur = c; note('Paste a link that starts with https:// or webcal://'); return; }
            var list = S.cals.map(function (x) { return Object.assign({}, x); }), i = list.map(function (x) { return x.id; }).indexOf(c.id);
            if (i > -1) list[i] = c; else list.push(c);
            return put(list, 'Saved <b>' + esc(c.name) + '</b>');
          }
        });
        load();
      }
    });
  };
})();
