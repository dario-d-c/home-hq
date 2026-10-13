// Night mode: dim the frame between look.night.from and .to (default 9 PM – 6 AM). Tap to wake for 5 minutes.
(function () {
  'use strict';
  var wakeUntil = 0, el = null;
  function mins(hm) { var p = String(hm || '').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); }
  function isNight() {
    if (App.parent) return false;   // a signed-in parent's phone, not the wall frame
    var n = App.look && App.look.night; if (!n || n.on === false) return false;
    var now = App.now(), m = now.getHours() * 60 + now.getMinutes(), a = mins(n.from || '21:00'), b = mins(n.to || '06:00');
    return a <= b ? m >= a && m < b : m >= a || m < b;
  }
  function tick() {
    if (/[?&]preview=1/.test(location.search)) return;
    var on = isNight() && Date.now() > wakeUntil;
    if (on && !el) {
      el = document.createElement('div'); el.className = 'night-dim';
      el.innerHTML = '<div class="night-clock num"></div><div class="night-hint">Tap to wake</div>';
      el.addEventListener('click', function (e) { e.stopPropagation(); wakeUntil = Date.now() + 5 * 60000; tick(); });
      document.body.appendChild(el);
    }
    if (!on && el) { el.parentNode.removeChild(el); el = null; }
    if (el) {
      var d = (App.look.night && App.look.night.dim) || 0.25;
      el.style.background = 'rgba(0,0,0,' + (1 - d) + ')';
      el.querySelector('.night-clock').textContent = App.fmt.time(App.now());
    }
  }
  App.nightTick = tick;
  setInterval(tick, 20000); setTimeout(tick, 1500);
})();
