// Real weather (Open-Meteo via /api/weather, cached by the Worker). Replaces the sample weather helpers once loaded.
(function () {
  'use strict';
  var D = window.DATA;
  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function icon(code, day) {
    if (code >= 51 && code <= 67 || code >= 80 && code <= 82 || code >= 95) return 'rain';
    if (code >= 71 && code <= 77 || code === 85 || code === 86) return 'cloud';
    if (code === 3 || code === 45 || code === 48) return 'cloud';
    if (code === 2 || code === 1 && !day) return 'partly';
    return day === false ? 'moon' : 'sun';
  }
  function label(code) { return (D.wx && D.wx.codes && D.wx.codes[code]) || ''; }
  function hourIdx(d) { var k = ymd(d) + 'T' + ('0' + d.getHours()).slice(-2) + ':00'; var H = D.wx.hourly; for (var i = 0; i < H.length; i++) if (H[i].t === k) return i; return -1; }
  function hlabel(h) { return (h % 12 || 12) + (h >= 12 ? 'p' : 'a'); }

  var sampleNow = App.weatherNow, sampleHourly = App.hourly;
  App.weatherNow = function () {
    if (!D.wx) return sampleNow();
    var now = App.now(), i = hourIdx(now), H = D.wx.hourly, c = D.wx.current, today = App.wxDay(now) || {};
    var wet = -1; for (var j = Math.max(0, i); j < Math.min(H.length, i + 12); j++) if (H[j].p >= 50) { wet = j; break; }
    var summary, advice;
    if (wet === i && i > -1) { var k = i; while (k < H.length && H[k].p >= 50) k++; summary = 'Rain likely until ' + hlabel(+H[Math.min(k, H.length - 1)].t.slice(11, 13)); advice = 'Umbrella weather'; }
    else if (wet > -1) { summary = 'Rain likely from ' + hlabel(+H[wet].t.slice(11, 13)); advice = 'Grab a rain jacket'; }
    else { summary = label(c.code) || 'Dry'; advice = c.feels < 40 ? 'Coat weather' : c.feels < 58 ? 'Jacket weather' : c.feels > 82 ? 'Stay cool' : 'Light layers'; }
    return { temp: c.t, cond: icon(c.code, c.day), label: label(c.code), hi: today.hi, lo: today.lo, summary: summary, advice: advice + ' · wind ' + c.wind + ' mph', hour: now.getHours() };
  };
  App.hourly = function (count) {
    if (!D.wx) return sampleHourly(count);
    var i = Math.max(0, hourIdx(App.now())), out = [];
    D.wx.hourly.slice(i, i + count).forEach(function (h, n) { out.push({ h: +h.t.slice(11, 13), t: h.temp, c: icon(h.code, h.day), p: h.p, label: n === 0 ? 'Now' : hlabel(+h.t.slice(11, 13)) }); });
    return out;
  };
  App.wxDay = function (d) { if (!D.wx) return null; var k = ymd(d); return D.wx.daily.filter(function (x) { return x.d === k; })[0] || null; };
  // small tappable badge: icon + high (used on calendar day headers)
  App.wxBadge = function (d, small) {
    if (!D.wx || App.look && App.look.tiles && App.look.tiles.weather === false) return '';
    var w = App.wxDay(d); if (!w) return '';
    return '<button class="wxb' + (small ? ' wxb--s' : '') + '" data-wx="' + w.d + '" aria-label="Weather">' + App.icon(icon(w.code, true), small ? 16 : 20) + '<b>' + w.hi + '°</b>' + (small ? '' : '<span>' + w.lo + '°</span>') + (w.p >= 40 && !small ? '<em>' + w.p + '%</em>' : '') + '</button>';
  };
  App.wxSheet = function (k) {
    if (!D.wx) return;
    var w = D.wx.daily.filter(function (x) { return x.d === k; })[0]; if (!w) return;
    var hrs = D.wx.hourly.filter(function (h) { return h.t.slice(0, 10) === k && +h.t.slice(11, 13) >= 6; });
    var p = k.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
    var tmin = Math.min.apply(null, hrs.map(function (h) { return h.temp; })), tmax = Math.max.apply(null, hrs.map(function (h) { return h.temp; }));
    App.sheet('<div class="sheet-pad wxs"><div class="label">' + App.esc(D.wx.place || 'Weather') + ' · ' + App.fmt.rel(d) + '</div>' +
      '<h2 class="serif sheet-h">' + App.icon(icon(w.code, true), 40) + ' ' + w.hi + '° <i>/ ' + w.lo + '°</i></h2>' +
      '<p class="wxs-say">' + App.esc(label(w.code)) + ' · rain ' + w.p + '% · wind up to ' + w.wind + ' mph · sunset ' + App.fmt.time(new Date(w.set)) + '</p>' +
      '<div class="wxs-hours">' + hrs.map(function (h) {
        var lift = tmax === tmin ? 0 : Math.round((h.temp - tmin) / (tmax - tmin) * 40);
        return '<div class="wxs-h' + (h.p >= 50 ? ' is-wet' : '') + '"><span>' + hlabel(+h.t.slice(11, 13)) + '</span>' + App.icon(icon(h.code, h.day), 22) +
          '<b style="margin-bottom:' + lift + 'px">' + h.temp + '°</b><i style="height:' + Math.max(2, h.p * 0.5) + 'px"></i><small>' + h.p + '%</small><small>' + h.wind + '</small></div>';
      }).join('') + '</div><p class="wxs-key">Bars: chance of rain · bottom row: wind mph</p></div>', { cls: 'sheet--wide' });
  };
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-wx]');
    if (!t) return; e.stopPropagation(); e.preventDefault(); App.wxSheet(t.dataset.wx);
  }, true);

  function load() {
    if (/[?&]demo=1/.test(location.search)) return;
    var key = window.HQFrameKey && window.HQFrameKey(), h = {}; if (key) h['x-frame-key'] = key;
    fetch('/api/weather', { headers: h, credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.hourly) { D.wx = j; App.emit('data'); App.rerender && App.rerender(); } }).catch(function () {});
  }
  setTimeout(load, 300); setInterval(load, 20 * 60000);
})();
