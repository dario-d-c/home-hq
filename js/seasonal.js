// Seasonal touches — subtle, warm, auto by date. Look setting `season`: auto | off | halloween | thanksgiving | christmas | winter.
// Also: the Christmas wish lists sheet (App.wishSheet), opened from More in December.
(function () {
  var D = window.DATA, H = document.documentElement, cur = null, layer = null, snow = null;
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  function auto(d) {
    var m = d.getMonth(), day = d.getDate();
    if (m === 9) return 'halloween';
    if (m === 10) return 'thanksgiving';
    if (m === 11 || (m === 0 && day === 1)) return 'christmas';
    if (m === 0 || m === 1) return 'winter';
    return null;
  }
  function pick() {
    var q = (location.search.match(/[?&]season=(\w+)/) || [])[1];
    var s = q || (App.look && App.look.season) || 'auto';
    if (s === 'off' || s === 'none') return null;
    return s === 'auto' ? auto(new Date()) : s;
  }
  App.season = function () { return cur; };

  var C = '#a7744a';   // warm earthy line colour, all art is thin-line + low opacity
  function svg(w, h, body, cls) { return '<svg class="' + cls + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' + body + '</svg>'; }
  var WEB = svg(120, 120, '<path d="M120 0L2.0 0.0M120 0L6.0 30.5M120 0L17.8 59.0M120 0L36.6 83.4M120 0L61.0 102.2M120 0L89.5 114.0M120 0L120.0 118.0M92.0 0.0Q95.8 3.2 93.0 7.2Q97.4 9.3 95.8 14.0Q100.6 14.9 100.2 19.8Q105.1 19.4 106.0 24.2Q110.7 22.6 112.8 27.0Q116.8 24.2 120.0 28.0M70.0 0.0Q76.7 5.7 71.7 12.9Q79.7 16.7 76.7 25.0Q85.4 26.6 84.6 35.4Q93.4 34.6 95.0 43.3Q103.3 40.3 107.1 48.3Q114.3 43.3 120.0 50.0M46.0 0.0Q56.0 8.4 48.5 19.2Q60.4 24.7 55.9 37.0Q68.8 39.3 67.7 52.3Q80.7 51.2 83.0 64.1Q95.3 59.6 100.8 71.5Q111.6 64.0 120.0 74.0M22.0 0.0Q35.2 11.2 25.3 25.4Q41.0 32.7 35.1 49.0Q52.2 52.1 50.7 69.3Q67.9 67.8 71.0 84.9Q87.3 79.0 94.6 94.7Q108.8 84.8 120.0 98.0" fill="none" stroke="' + C + '" stroke-width=".7"/>' +
      '<path d="M86 0V46" stroke="' + C + '" stroke-width=".6"/><g fill="' + C + '"><ellipse cx="86" cy="51" rx="3" ry="3.8"/><circle cx="86" cy="46" r="2"/></g>' +
      '<path d="M83.5 49l-5-3M83.5 51.5h-6M83.5 54l-5 3M88.5 49l5-3M88.5 51.5h6M88.5 54l5 3" stroke="' + C + '" stroke-width=".6" fill="none"/>', 'ss-web');
  var GHOST = '<path d="M20 4c-9 0-15 7-15 16v22l5-4 5 4 5-4 5 4 5-4 5 4V20C35 11 29 4 20 4z" fill="#fffaf2" stroke="' + C + '" stroke-width=".8"/><circle cx="15" cy="19" r="1.6" fill="' + C + '"/><circle cx="25" cy="19" r="1.6" fill="' + C + '"/>';
  var LEAF = '<path d="M20 2C9 10 6 24 14 36c2-9 5-16 10-22-3 7-5 14-6 22 10-5 13-20 2-34z" fill="none" stroke="' + C + '" stroke-width="1"/>';
  var BOUGH = svg(160, 40, '<g fill="#7d8c66" opacity=".85"><ellipse cx="0.0" cy="6.0" rx="5" ry="1.6" transform="rotate(50 0.0 6.0)"/><ellipse cx="5.0" cy="7.4" rx="5" ry="1.6" transform="rotate(-20 5.0 7.4)"/><ellipse cx="10.0" cy="8.7" rx="5" ry="1.6" transform="rotate(50 10.0 8.7)"/><ellipse cx="15.0" cy="10.1" rx="5" ry="1.6" transform="rotate(-20 15.0 10.1)"/><ellipse cx="20.0" cy="11.4" rx="5" ry="1.6" transform="rotate(49 20.0 11.4)"/><ellipse cx="25.0" cy="12.6" rx="5" ry="1.6" transform="rotate(-21 25.0 12.6)"/><ellipse cx="30.0" cy="13.8" rx="5" ry="1.6" transform="rotate(48 30.0 13.8)"/><ellipse cx="35.0" cy="14.9" rx="5" ry="1.6" transform="rotate(-23 35.0 14.9)"/><ellipse cx="40.0" cy="15.9" rx="5" ry="1.6" transform="rotate(46 40.0 15.9)"/><ellipse cx="45.0" cy="16.8" rx="5" ry="1.6" transform="rotate(-25 45.0 16.8)"/><ellipse cx="50.0" cy="17.6" rx="5" ry="1.6" transform="rotate(44 50.0 17.6)"/><ellipse cx="55.0" cy="18.3" rx="5" ry="1.6" transform="rotate(-28 55.0 18.3)"/><ellipse cx="60.0" cy="18.9" rx="5" ry="1.6" transform="rotate(41 60.0 18.9)"/><ellipse cx="65.0" cy="19.4" rx="5" ry="1.6" transform="rotate(-30 65.0 19.4)"/><ellipse cx="70.0" cy="19.7" rx="5" ry="1.6" transform="rotate(38 70.0 19.7)"/><ellipse cx="75.0" cy="19.9" rx="5" ry="1.6" transform="rotate(-33 75.0 19.9)"/><ellipse cx="80.0" cy="20.0" rx="5" ry="1.6" transform="rotate(35 80.0 20.0)"/><ellipse cx="85.0" cy="19.9" rx="5" ry="1.6" transform="rotate(-37 85.0 19.9)"/><ellipse cx="90.0" cy="19.7" rx="5" ry="1.6" transform="rotate(32 90.0 19.7)"/><ellipse cx="95.0" cy="19.4" rx="5" ry="1.6" transform="rotate(-40 95.0 19.4)"/><ellipse cx="100.0" cy="18.9" rx="5" ry="1.6" transform="rotate(29 100.0 18.9)"/><ellipse cx="105.0" cy="18.3" rx="5" ry="1.6" transform="rotate(-42 105.0 18.3)"/><ellipse cx="110.0" cy="17.6" rx="5" ry="1.6" transform="rotate(26 110.0 17.6)"/><ellipse cx="115.0" cy="16.8" rx="5" ry="1.6" transform="rotate(-45 115.0 16.8)"/><ellipse cx="120.0" cy="15.9" rx="5" ry="1.6" transform="rotate(24 120.0 15.9)"/><ellipse cx="125.0" cy="14.9" rx="5" ry="1.6" transform="rotate(-47 125.0 14.9)"/><ellipse cx="130.0" cy="13.8" rx="5" ry="1.6" transform="rotate(22 130.0 13.8)"/><ellipse cx="135.0" cy="12.6" rx="5" ry="1.6" transform="rotate(-49 135.0 12.6)"/><ellipse cx="140.0" cy="11.4" rx="5" ry="1.6" transform="rotate(21 140.0 11.4)"/><ellipse cx="145.0" cy="10.1" rx="5" ry="1.6" transform="rotate(-50 145.0 10.1)"/><ellipse cx="150.0" cy="8.7" rx="5" ry="1.6" transform="rotate(20 150.0 8.7)"/><ellipse cx="155.0" cy="7.4" rx="5" ry="1.6" transform="rotate(-50 155.0 7.4)"/><ellipse cx="160.0" cy="6.0" rx="5" ry="1.6" transform="rotate(20 160.0 6.0)"/></g><g fill="#b35a45"><circle cx="50" cy="20" r="2.4"/><circle cx="55" cy="22" r="2"/><circle cx="108" cy="20" r="2.3"/></g><g fill="#c9a14a"><circle cx="80" cy="24" r="1.6"/><circle cx="132" cy="15" r="1.4"/><circle cx="24" cy="14" r="1.4"/></g>', 'ss-bough');

  function decorate(s) {
    if (layer) layer.remove(); layer = null;
    if (!s) return;
    layer = document.createElement('div'); layer.className = 'season-layer'; layer.setAttribute('aria-hidden', 'true');
    if (s === 'halloween') layer.innerHTML = WEB + [1, 2, 3].map(function (i) { return svg(40, 46, GHOST, 'ss-ghost g' + i); }).join('');
    if (s === 'thanksgiving') layer.innerHTML = [1, 2, 3].map(function (i) { return svg(40, 40, LEAF, 'ss-leaf l' + i); }).join('');
    if (s === 'christmas') layer.innerHTML = BOUGH;
    document.body.appendChild(layer);
  }

  // ---- gentle snow: few flakes, ~24fps, pauses when hidden, off for reduced motion
  function startSnow(n) {
    stopSnow(); if (RM && RM.matches) return;
    var cv = document.createElement('canvas'); cv.className = 'season-snow'; cv.setAttribute('aria-hidden', 'true'); document.body.appendChild(cv);
    var g = cv.getContext('2d'), W, Hh, fl = [], last = 0, raf = 0;
    function size() { W = cv.width = innerWidth; Hh = cv.height = innerHeight; }
    size(); addEventListener('resize', size);
    for (var i = 0; i < n; i++) fl.push({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 2.2, v: .12 + Math.random() * .25, d: Math.random() * 6 });
    function tick(t) {
      raf = requestAnimationFrame(tick);
      if (t - last < 42) return; var dt = Math.min(3, (t - last) / 42); last = t;
      g.clearRect(0, 0, W, Hh); g.fillStyle = H.classList.contains('dark') ? 'rgba(255,255,255,.85)' : 'rgba(150,168,186,.75)';
      fl.forEach(function (f) { f.y += f.v * dt / Hh * 4; f.d += .01 * dt; if (f.y > 1.02) { f.y = -.02; f.x = Math.random(); }
        g.beginPath(); g.arc((f.x + Math.sin(f.d) * .01) * W, f.y * Hh, f.r, 0, 6.283); g.fill(); });
    }
    function vis() { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(tick); }
    document.addEventListener('visibilitychange', vis); vis();
    snow = { stop: function () { cancelAnimationFrame(raf); removeEventListener('resize', size); document.removeEventListener('visibilitychange', vis); cv.remove(); } };
  }
  function stopSnow() { if (snow) snow.stop(); snow = null; }

  function apply() {
    var s = pick();
    if (s === cur) return;
    if (cur) H.classList.remove('season-' + cur);
    cur = s; if (s) H.classList.add('season-' + s);
    decorate(s);
    var phone = H.classList.contains('is-phone');
    if (s === 'christmas') startSnow(phone ? 9 : 22); else if (s === 'winter') startSnow(phone ? 5 : 12); else stopSnow();
    var m = document.querySelector('.em-more'); if (m && App.moreSheet) {}   // More sheet rebuilds on open
  }
  App.applySeason = apply;
  apply(); setInterval(apply, 60000);
  window.addEventListener('message', function (e) { if (e.data && e.data.type === 'hq-look') setTimeout(apply, 50); });
  if (RM && RM.addEventListener) RM.addEventListener('change', function () { var s = cur; cur = null; if (s) H.classList.remove('season-' + s); apply(); });

  // ---- Wish lists (year-round, per person, occasion-tagged). Christmas list = the Christmas view.
  var OCC = [['christmas', 'Christmas'], ['birthday', 'Birthday'], ['anytime', 'Anytime'], ['all', 'All']];
  function people() {
    var fam = (D.people || []).map(function (p) { return { key: p.id, name: p.name }; }), seen = {};
    fam.forEach(function (p) { seen[p.name.toLowerCase()] = 1; });
    var others = [];
    (D.wishes || []).forEach(function (w) { var n = !(w.who || w.kid) || /^o:/.test(w.who || '') ? (w.whoName || '') : ''; if (n && !seen[n.toLowerCase()]) { seen[n.toLowerCase()] = 1; others.push({ key: 'o:' + n, name: n }); } });
    return fam.concat(others);
  }
  function whoKey(w) { var k = w.who || w.kid; return k && !/^o:/.test(k) ? k : 'o:' + (w.whoName || ''); }
  App.wishSheet = function (o) {
    o = o || {};
    var occ = o.occasion || (o.who ? 'all' : (cur === 'christmas' || new Date().getMonth() === 11) ? 'christmas' : 'all');
    var hide = !App.parent || (App.look && App.look.wishHide !== false);
    var whoSel = o.who ? (people().filter(function (p) { return p.key === o.who || (o.name && p.name === o.name); })[0] || {}).key : null;
    function body() {
      var W = (D.wishes || []).filter(function (w) { return occ === 'all' || (w.occasion || 'christmas') === occ || (occ !== 'all' && w.occasion === 'anytime'); });
      var list = people().filter(function (p) { return !whoSel || p.key === whoSel; });
      return '<div class="seg wl-occ">' + OCC.map(function (x) { return '<button data-wl-occ="' + x[0] + '" class="' + (x[0] === occ ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>' +
        '<div class="wl">' + list.map(function (k) {
          var mine = W.filter(function (w) { return whoKey(w) === k.key; });
          if (!mine.length && !whoSel && D.people.every(function (p) { return p.id !== k.key || p.role === 'parent'; })) return '';
          return '<section class="wl-kid"><h3 class="serif">' + App.esc(k.name) + '</h3>' + (mine.length ? '<ul>' + mine.map(function (w) {
            var got = !hide && w.got;
            return '<li class="' + (got ? 'is-got' : '') + '">' + (w.image ? '<img src="' + App.esc(w.image) + '" alt="" referrerpolicy="no-referrer" loading="lazy">' : '<i class="wl-dot"></i>') +
              '<span>' + App.esc(w.name) + (occ === 'all' && w.occasion ? ' <small class="wl-tag">' + App.esc(w.occasion) + '</small>' : '') + (w.link ? ' <a href="' + App.esc(w.link) + '" target="_blank" rel="noopener">link ↗</a>' : '') + '</span>' + (got ? '<b>✓ got it</b>' : '') + '</li>';
          }).join('') + '</ul>' : '<p class="wl-none">Nothing yet</p>') + '</section>';
        }).join('') + '</div>' + (whoSel ? '<button class="btn-ghost wl-all" data-wl-all>Everyone’s lists</button>' : '');
    }
    var title = occ === 'christmas' && !whoSel ? 'Christmas wish lists' : 'Wish lists';
    App.sheet('<div class="sheet-pad"><div class="label">Wish lists</div><h2 class="serif sheet-h">' + title + '</h2><div class="wl-body">' + body() + '</div>' +
      (App.parent ? '<button class="btn-ghost wl-edit" data-wl-edit>✎ Edit wish lists</button>' : '') + '</div>', { cls: 'sheet--wish', onMount: function (el) {
        el.addEventListener('click', function (ev) {
          var t = ev.target.closest('[data-wl-occ]'); if (t) { occ = t.dataset.wlOcc; el.querySelector('.wl-body').innerHTML = body(); el.querySelector('.sheet-h').textContent = occ === 'christmas' && !whoSel ? 'Christmas wish lists' : 'Wish lists'; return; }
          if (ev.target.closest('[data-wl-all]')) { whoSel = null; el.querySelector('.wl-body').innerHTML = body(); return; }
          if (ev.target.closest('[data-wl-edit]')) { App.closeSheet(); setTimeout(function () { App.editEmbed('tab=wishes', 'Wish lists'); }, 60); }
        });
      } });
  };
  document.addEventListener('click', function (ev) { var b = ev.target.closest('[data-wish-who]'); if (!b || App.editMode) return; ev.preventDefault(); App.wishSheet({ who: b.dataset.wishWho, name: b.dataset.wishName }); });
})();
