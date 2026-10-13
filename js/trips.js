// Shopping trips: data.trips = [{id, date:'YYYY-MM-DD'|null, store, name, repeat:'weekly'|'biweekly'|null}].
// Grocery items carry trip:<id>; items without a (known) trip are on the 'Anytime' list.
(function () {
  'use strict';
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  var T = window.HQTrip = {
    sorted: function (trips) { return (trips || []).slice().sort(function (a, b) { return (a.date || '9999') < (b.date || '9999') ? -1 : (a.date || '9999') > (b.date || '9999') ? 1 : 0; }); },
    next: function (trips) { var t = today(), s = T.sorted(trips); return s.filter(function (x) { return x.date && x.date >= t; })[0] || s[0] || null; },
    key: function (g, trips) { return g.trip && (trips || []).some(function (t) { return t.id === g.trip; }) ? g.trip : 'any'; },
    // frame list = next trip + anytime items
    onNext: function (g, trips) { var n = T.next(trips), k = T.key(g, trips); return k === 'any' || (n && k === n.id); },
    label: function (t, stores) {
      if (!t) return '';
      var st = (stores || []).filter(function (s) { return s.id === t.store; })[0];
      var d = t.date ? new Date(t.date + 'T12:00:00') : null;
      return (t.name || (st ? st.name : 'Shopping')) + (d ? ' · ' + d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '');
    }
  };
})();
