// Colour themes (Look & layout → Theme). Shared by the frame, the editor, the sitter page and the screensaver.
// Every palette keeps body text ≥ 4.5:1 on paper/card and on-deep text ≥ 4.5:1 on the highlight card.
(function () {
  'use strict';
  var T = {
    oat: { name: 'Oat & Walnut', dark: false, paper: '#F3EBDD', paper2: '#E9DDC8', card: '#FBF6EC', raised: '#FFFDF8', ink: '#2E2118', ink2: '#4A3A2C', mute: '#6F5B47', line: '#E2D5BF', rule: '#CDBBA0', deep: '#5B4130', onDeep: '#F8EFE0', chip: '#EFE4D2', accent: '#8A5A36',
      people: ['#A65A3A', '#5E7A4C', '#3F6A86', '#B07A2E', '#8A4E66', '#6A5A8E', '#4F7D74'] },
    sage: { name: 'Sage Garden', dark: false, paper: '#F1EFE4', paper2: '#E3E4D2', card: '#FAF9F1', raised: '#FFFFF8', ink: '#22291F', ink2: '#3B4536', mute: '#5E6855', line: '#DADBC6', rule: '#BFC3A6', deep: '#4A5D40', onDeep: '#F4F2E6', chip: '#E6E8D6', accent: '#5F7A4A',
      people: ['#5E7A4C', '#A0663E', '#46708A', '#8E7A32', '#7D5470', '#5B6B9A', '#3F7F6E'] },
    harbor: { name: 'Harbor', dark: false, paper: '#EFEEE8', paper2: '#E1E4E2', card: '#F9F8F4', raised: '#FFFFFC', ink: '#1C2833', ink2: '#34475A', mute: '#596877', line: '#D7DCDC', rule: '#B9C4C8', deep: '#2F4E68', onDeep: '#F2EFE6', chip: '#E3E7E6', accent: '#3C6E91',
      people: ['#3C6E91', '#B0704A', '#5A7E5C', '#8A6AA0', '#A85D5D', '#C08A3A', '#3E8584'] },
    mushroom: { name: 'Mushroom', dark: false, paper: '#EEE9E4', paper2: '#E2D9D2', card: '#F8F5F2', raised: '#FFFDFB', ink: '#2D2628', ink2: '#4A3F42', mute: '#6C6164', line: '#DDD3CC', rule: '#C5B8B0', deep: '#5E4F52', onDeep: '#F7F1EC', chip: '#E7DFD8', accent: '#8C6F7A',
      people: ['#8C6F7A', '#7A7A52', '#5D7189', '#A07052', '#6E5E8E', '#5F8070', '#A3685E'] },
    cranberry: { name: 'Cranberry Hearth', dark: false, paper: '#F5EEE4', paper2: '#EBDFD2', card: '#FCF8F2', raised: '#FFFDF9', ink: '#2B1A1C', ink2: '#4B2E31', mute: '#735856', line: '#E5D6C8', rule: '#D0B9A8', deep: '#6E2A35', onDeep: '#FAEFE6', chip: '#EEDFD2', accent: '#8E3341',
      people: ['#8E3341', '#4F7A5A', '#3E6688', '#B07434', '#6B4E80', '#9C5A3C', '#3F7D7A'] },
    evening: { name: 'Evening', dark: true, paper: '#1F1A17', paper2: '#2A2420', card: '#2B2521', raised: '#342D28', ink: '#F1E7D8', ink2: '#DCCFBC', mute: '#B3A493', line: '#3A322C', rule: '#4E443B', deep: '#4A3A2E', onDeep: '#F6ECDC', chip: '#3A312A', accent: '#D6A46A',
      people: ['#D08A62', '#9DB57E', '#82A9C6', '#D9B35E', '#C58BA6', '#A99BD0', '#7FBDB0'] }
  };
  function hex2rgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function rgb2hex(c) { return '#' + c.map(function (x) { return ('0' + Math.max(0, Math.min(255, Math.round(x))).toString(16)).slice(-2); }).join(''); }
  function lum(h) { var c = hex2rgb(h).map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
  function mix(a, b, t) { var x = hex2rgb(a), y = hex2rgb(b); return rgb2hex(x.map(function (v, i) { return v + (y[i] - v) * t; })); }
  function inkFor(bg, th) { return lum(bg) > 0.33 ? th.ink : th.onDeep; }
  window.HQ_THEMES = T;
  window.HQTheme = {
    list: T, mix: mix, lum: lum,
    // which palette is active: auto → Evening at night; legacy 'dark' → Evening
    pick: function (look) {
      look = look || {};
      var t = look.theme, p = T[look.palette] ? look.palette : 'oat';
      if (t === 'dark') return 'evening';
      if (t === 'auto') { var h = new Date().getHours(); if (h >= 19 || h < 7) return 'evening'; }
      return p;
    },
    apply: function (root, key, accent, bold) {
      var th = T[key] || T.oat, s = root.style;
      var map = { '--paper': th.paper, '--paper-2': th.paper2, '--card': th.card, '--raised': th.raised, '--ink': th.ink, '--ink-2': th.ink2, '--mute': th.mute, '--line': th.line,
        '--rule': th.rule, '--deep': th.deep, '--on-deep': th.onDeep, '--chip': th.chip, '--accent': accent && accent !== '#111111' ? accent : th.accent,
        '--shadow': th.dark ? '0 1px 2px rgba(0,0,0,.3), 0 6px 18px rgba(0,0,0,.25)' : '0 1px 2px rgba(60,40,20,.06), 0 6px 18px rgba(60,40,20,.07)' };
      for (var k in map) s.setProperty(k, map[k]);
      s.setProperty('--ink-rgb', hex2rgb(th.ink).join(' '));
      var acc = map['--accent'], D = th.dark;
      var soft = {
        '--head': D ? th.ink : mix(th.ink, th.deep, 0.35),                     // clock + headings: warm deep tone, not near-black
        '--tint': mix(acc, th.paper, D ? 0.72 : 0.84),                          // active nav pill / selected chips
        '--tint-ink': D ? th.ink : mix(acc, th.ink, 0.45),
        '--hl-bg': bold ? th.deep : mix(mix(th.deep, acc, 0.5), th.card, D ? 0.55 : 0.78),    // highlight card
        '--hl-ink': bold ? th.onDeep : (D ? th.ink : th.deep),
        '--hl-sub': bold ? th.onDeep : (D ? th.ink2 : mix(th.deep, th.ink, 0.4)),
        '--pastel-1': mix(acc, th.card, D ? 0.7 : 0.86), '--pastel-2': mix(th.people[1], th.card, D ? 0.7 : 0.86), '--pastel-3': mix(th.people[2], th.card, D ? 0.7 : 0.86),
        '--warn': D ? '#E2A36B' : mix('#B4532A', th.ink, 0.15), '--bad': D ? '#E39B8F' : mix('#A33A2E', th.ink, 0.1),
        '--ok': D ? '#9DBB86' : mix('#4F7A4A', th.ink, 0.1), '--wet': D ? '#9DB3C6' : mix('#4C6E8C', th.mute, 0.35), '--icon': th.mute
      };
      for (var k2 in soft) s.setProperty(k2, soft[k2]);
      root.classList.toggle('hl-bold', !!bold);
      root.setAttribute('data-theme', th.dark ? 'dark' : 'light');
      root.setAttribute('data-palette', key);
      return th;
    },
    // family colours: 'original' | 'soft' (eased toward the theme) | 'theme' (palette by position)
    person: function (p, idx, mode, key) {
      var th = T[key] || T.oat;
      if (!p || !p.color || p.id === 'family') return { color: th.deep, ink: th.onDeep };
      var c = p.color;
      if (mode === 'theme') c = th.people[idx % th.people.length];
      else if (mode !== 'original') {
        // soften: pull 40% toward grey (desaturate), then a touch toward the theme's deep tone for warmth
        var r = hex2rgb(c), g = (r[0] + r[1] + r[2]) / 3;
        c = mix(c, rgb2hex([g, g, g]), 0.4); c = mix(c, th.deep, 0.15);
        if (th.dark) c = mix(c, '#FFFFFF', 0.12);
      }
      return { color: c, ink: inkFor(c, th) };
    },
    rgb: function (h) { return hex2rgb(h).join(' '); },
    // editor + sitter: always the light version of the chosen palette (Evening → Oat), with its accent
    applyLight: function (root, look) {
      look = look || {}; var key = T[look.palette] && !T[look.palette].dark ? look.palette : 'oat', th = T[key], s = root.style;
      var acc = look.accent && look.accent !== '#111111' ? look.accent : (T[look.palette] || th).dark ? th.accent : th.accent;
      var map = { '--bg': th.paper, '--card': th.card, '--ink': th.ink, '--muted': th.mute, '--line': th.line, '--accent': acc, '--next': acc, '--deep': th.deep, '--on-deep': th.onDeep, '--chip': th.chip };
      for (var k in map) s.setProperty(k, map[k]);
      root.setAttribute('data-palette', key);
      return th;
    }
  };
})();
