// Major (US) holidays for countdowns — shared by the dashboard, editor and worker widget.
const nth = (y, m, wd, n) => { const d = new Date(Date.UTC(y, m, 1)); const off = (wd - d.getUTCDay() + 7) % 7; return Date.UTC(y, m, 1 + off + (n - 1) * 7); };
const last = (y, m, wd) => { const d = new Date(Date.UTC(y, m + 1, 0)); return Date.UTC(y, m, d.getUTCDate() - ((d.getUTCDay() - wd + 7) % 7)); };
function easter(y) { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
  i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return Date.UTC(y, mo - 1, da); }
export const HOLIDAYS = [
  ['newyear', 'New Year’s Day', '🥂', y => Date.UTC(y, 0, 1)], ['valentines', 'Valentine’s Day', '💌', y => Date.UTC(y, 1, 14)], ['stpatricks', 'St. Patrick’s Day', '☘️', y => Date.UTC(y, 2, 17)],
  ['easter', 'Easter', '🌷', easter], ['mothers', 'Mother’s Day', '💐', y => nth(y, 4, 0, 2)], ['memorial', 'Memorial Day', '🇺🇸', y => last(y, 4, 1)], ['fathers', 'Father’s Day', '👔', y => nth(y, 5, 0, 3)],
  ['july4', 'Fourth of July', '🎆', y => Date.UTC(y, 6, 4)], ['labor', 'Labor Day', '🏖️', y => nth(y, 8, 1, 1)], ['halloween', 'Halloween', '🎃', y => Date.UTC(y, 9, 31)],
  ['thanksgiving', 'Thanksgiving', '🦃', y => nth(y, 10, 4, 4)], ['christmas', 'Christmas', '🎄', y => Date.UTC(y, 11, 25)], ['nye', 'New Year’s Eve', '✨', y => Date.UTC(y, 11, 31)],
];
const ymd = t => new Date(t).toISOString().slice(0, 10);
// next occurrence on/after `today` ('YYYY-MM-DD')
export function nextHoliday(key, today) { const h = HOLIDAYS.find(x => x[0] === key); if (!h) return null; const y = +today.slice(0, 4);
  for (const yy of [y, y + 1]) { const d = ymd(h[3](yy)); if (d >= today) return { key, title: h[1], emoji: h[2], date: d }; } return null; }
export const cdEmoji = t => /vacation|trip|disney|beach|cruise|holiday|island|resort|florida|hawaii/i.test(t || '') ? '🌴' : /camp|hike/i.test(t || '') ? '🏕️' : /party/i.test(t || '') ? '🎉' : /game|match|tournament/i.test(t || '') ? '🏆' : '⏳';
