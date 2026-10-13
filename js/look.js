// Look & layout settings from /api/look, applied on boot (cached) and on every 60s refresh.
// In preview mode (/?preview=1, used by the editor) the editor can push unsaved settings via postMessage.
(function () {
  var CACHE = 'hq-look-v2';
  try { localStorage.removeItem('hq-look'); } catch (e) {}
  var PREVIEW = /[?&]preview=1/.test(location.search);
  var FS = { '--fs-clock': 150, '--fs-hero': 76, '--fs-xl': 56, '--fs-l': 34, '--fs-m': 24, '--fs-body': 20, '--fs-label': 15, '--fs-min': 14 };
  var DEFAULT = { theme: 'light', palette: 'oat', people: 'soft', boldHighlight: false, accent: '#111111', fontScale: 1, startView: 'home', calendarMode: 'day', routinesOnCal: false, weekStart: 'mon', season: 'auto', wishHide: true, bdayDays: 7, clock24: false, routineOnCalendar: false, choresView: 'all', orientation: 'auto',
    sections: { calendar: true, tasks: true, meals: true, shopping: true, photos: false, control: false, agents: false },
    tiles: { weather: true, people: true, photo: false, meals: true, chores: true, shopping: true, status: false },
    sideOrder: ['meals', 'photo', 'chores', 'shopping', 'status'],
    wx: { place: 'New York, NY', lat: 40.7128, lon: -74.006 }, night: { on: true, from: '21:00', to: '06:00', dim: 0.25 } };
  var lastJson = '';
  App.preview = PREVIEW;

  function merge(l) {
    l = l || {};
    var out = {};
    for (var k in DEFAULT) out[k] = l[k] != null ? l[k] : DEFAULT[k];
    out.sections = Object.assign({}, DEFAULT.sections, l.sections || {});
    out.tiles = Object.assign({}, DEFAULT.tiles, l.tiles || {});
    return out;
  }
  try { App.look = merge(JSON.parse(localStorage.getItem(CACHE) || 'null')); } catch (e) { App.look = merge(null); }

  function dark() {
    var t = App.look.theme;
    if (t === 'auto') { var h = new Date().getHours(); return h >= 19 || h < 7; }
    return t === 'dark';
  }

  function applyRoot() {
    // sample-only screens (old photos, home controls, AI agents) are always hidden
    App.look.sections = Object.assign({}, App.look.sections, { photos: false, control: false, agents: false });
    var L = App.look, root = document.documentElement;
    var key = window.HQTheme.pick(L);
    if (key !== App.themeKey) { App.themeKey = key; window.HQTheme.apply(root, key, L.accent, L.boldHighlight); if (App.rerender && App.current) setTimeout(App.rerender, 0); }
    else window.HQTheme.apply(root, key, L.accent, L.boldHighlight);
    for (var k in FS) root.style.setProperty(k, Math.round(FS[k] * (+L.fontScale || 1)) + 'px');
    // sidebar sections
    App.$$('.rail-item').forEach(function (b) {
      var v = b.dataset.go; if (v === 'home') return;
      b.style.display = L.sections[v] === false ? 'none' : '';
    });
    if (App.current && App.current !== 'home' && L.sections[App.current] === false) App.go(L.startView || 'home');
  }

  // Today screen tiles: hide/show and order the right-hand column; widen the header row to fill gaps.
  function layoutHome() {
    var el = document.querySelector('.home'); if (!el) return;
    // weather / photo / home-status tiles only have sample data: always hidden until real sources exist
    var T = Object.assign({}, App.look.tiles, { weather: !!(window.DATA.wx && App.look.tiles.weather !== false), photo: false, status: false });
    var w = el.querySelector('.h-weather'), p = el.querySelector('.h-presence'), c = el.querySelector('.h-clock');
    if (w) w.style.display = T.weather ? '' : 'none';
    if (p) p.style.display = T.people ? '' : 'none';
    if (c) c.style.gridColumn = T.weather ? (T.people ? '1 / 5' : '1 / 7') : (T.people ? '1 / 9' : '1 / 13');
    if (w) w.style.gridColumn = T.people ? '5 / 9' : '7 / 13';
    var side = el.querySelector('.h-side'); if (!side) return;
    var meals = side.querySelector('.h-meals'), photo = side.querySelector('.h-photo'), chores = side.querySelector('.h-chores'), duo = side.querySelector('.h-duo');
    var shop = side.querySelector('.h-shop'), status = side.querySelector('.h-status');
    photo.style.display = T.photo ? '' : 'none';
    if (meals) meals.style.display = T.meals ? '' : 'none';
    chores.style.display = T.chores ? '' : 'none';
    shop.style.display = T.shopping ? '' : 'none';
    status.style.display = T.status ? '' : 'none';
    duo.style.display = T.shopping || T.status ? '' : 'none';
    duo.style.gridTemplateColumns = T.shopping && T.status ? '1fr 1fr' : '1fr';
    // order: shopping+status share the duo row; its position follows whichever of them comes first
    var order = App.look.sideOrder || DEFAULT.sideOrder;
    var rank = function (k) { var i = order.indexOf(k); return i < 0 ? 9 : i; };
    var items = [['meals', meals, rank('meals')], ['photo', photo, rank('photo')], ['chores', chores, rank('chores')], ['duo', duo, Math.min(rank('shopping'), rank('status'))]]
      .filter(function (x) { return x[1].style.display !== 'none'; })
      .sort(function (a, b) { return a[2] - b[2]; });
    side.style.display = 'flex'; side.style.flexDirection = 'column';
    items.forEach(function (x, i) {
      x[1].style.order = i;
      // photo (or the first tile when there's no photo) takes the spare height
      var grow = x[0] === 'photo' || (!T.photo && i === 0);
      x[1].style.flex = grow ? '1 1 0' : x[0] === 'chores' ? '0 0 142px' : x[0] === 'meals' ? '0 0 auto' : '0 0 150px';
      x[1].style.minHeight = '0';
    });
    if (shop.style.display !== 'none' && status.style.display !== 'none') { shop.style.order = rank('shopping') < rank('status') ? 0 : 1; status.style.order = 1 - shop.style.order; }
  }

  function hookViews() {
    var home = App.views && App.views.home;
    if (home && !home._lookHooked) {
      var orig = home.show;
      home.show = function () { var r = orig.apply(this, arguments); layoutHome(); return r; };
      home._lookHooked = true;
    }
    var cal = App.views && App.views.calendar;
    if (cal && !cal._lookHooked) {
      var o2 = cal.show, first = true;
      cal.show = function (el) {
        var r = o2.apply(this, arguments);
        if (first) { first = false; var m = App.look.calendarMode; if (m && m !== 'day') { var b = el.querySelector('[data-mode="' + m + '"]'); if (b) b.click(); } }
        return r;
      };
      cal._lookHooked = true;
    }
  }

  function apply(l, fromServer) {
    var json = JSON.stringify(l);
    if (json === lastJson) return;
    lastJson = json;
    App.look = merge(l);
    if (fromServer && !PREVIEW) { try { localStorage.setItem(CACHE, json); } catch (e) {} }
    applyRoot();
    if (App.fit) App.fit();
    // re-render views so time format / week start / tiles take effect
    if (App.views) Object.keys(App.views).forEach(function (k) { App.views[k]._dirty = true; });
    if (App.current) { try { App.rerender(); } catch (e) {} }
    layoutHome();
  }

  function load() {
    if (PREVIEW && App._previewLook) return;
    fetch('/api/look', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (l) { if (l) apply(l, true); }).catch(function () {});
  }

  applyRoot();
  App.on('ready', function () { hookViews(); layoutHome(); applyRoot(); });
  hookViews();
  window.addEventListener('load', function () { load(); setInterval(load, 60000); setInterval(applyRoot, 60000); /* auto theme */ });
  if (PREVIEW) {
    window.addEventListener('message', function (e) {
      if (e.origin !== location.origin || !e.data || e.data.type !== 'hq-look') return;
      App._previewLook = true; apply(e.data.look, false);
      if (e.data.view && App.views[e.data.view]) App.go(e.data.view);
    });
  }
})();
