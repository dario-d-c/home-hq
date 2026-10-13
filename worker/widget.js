import { nextHoliday, cdEmoji } from '../js/holidays.js';
// Compact read-only summary for the iPhone (Scriptable) widget: GET /api/widget?t=<widget token>
import { THEMES } from './themes-data.js';
const TZ = 'America/New_York';
const NAMES = { work: 'Work', school: 'School', daycare: 'Daycare', commute: 'On the way', activity: 'Activity', bed: 'Bedtime', wake: 'Wake up', other: '' };
const OFF = ['noschool', 'vacation', 'pd'], OFFTYPES = ['work', 'school', 'daycare', 'commute', 'activity'];
const fmtP = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
function wall(d) { const p = {}; fmtP.formatToParts(d).forEach(x => { p[x.type] = x.value; }); return { ymd: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) }; }
const toMin = hm => { const m = /^(\d\d):(\d\d)/.exec(hm || ''); return m ? +m[1] * 60 + +m[2] : null; };
const hm12 = m => { const h = Math.floor(m / 60) % 24, mm = m % 60; return (h % 12 || 12) + (mm ? ':' + String(mm).padStart(2, '0') : '') + (h < 12 ? ' AM' : ' PM'); };
const addDay = (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const wdOf = ymd => new Date(ymd + 'T12:00:00Z').getUTCDay();
const longDate = ymd => new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' });

function occursOn(e, ymd) {
  const s = wall(new Date(e.start)), r = e.repeat;
  if (!r || !r.freq) {
    if (e.allDay) { const end = wall(new Date(e.end || e.start)); return s.ymd <= ymd && (ymd < end.ymd || (ymd === s.ymd)); }
    return s.ymd === ymd;
  }
  if (ymd < s.ymd || (r.until && ymd > r.until) || (e.skip || []).includes(ymd)) return false;
  const [y, m, d] = ymd.split('-').map(Number), [sy, sm, sd] = s.ymd.split('-').map(Number);
  if (r.freq === 'daily') return true;
  if (r.freq === 'weekly') return (r.days && r.days.length ? r.days : [s.wd]).includes(wdOf(ymd));
  if (r.freq === 'monthly') return d === sd;
  if (r.freq === 'yearly') return d === sd && m === sm;
  return false;
}
function schoolDay(events, ymd, pid) {
  const r = { off: null, half: null };
  events.forEach(e => {
    if (!e.school || (e.people && e.people.length && !e.people.includes(pid)) || !occursOn({ ...e, allDay: true }, ymd)) return;
    if (OFF.includes(e.school)) r.off = e; else if (e.school === 'half') r.half = e;
  });
  return r;
}
function routineOn(p, ymd, events) {
  const wd = wdOf(ymd), sd = schoolDay(events, ymd, p.id), off = (p.dayoff || []).find(x => x.from <= ymd && ymd <= x.to);
  return (p.routine || []).filter(b => (b.days || []).includes(wd) && b.start && !(b.skip || []).includes(ymd) && !(sd.off && b.type === 'school') && !(off && OFFTYPES.includes(b.type)))
    .map(b => { const ov = b.over && b.over[ymd]; let s = toMin(ov ? ov.start : b.start), e = toMin(ov ? ov.end : b.end);
      if (!ov && b.type === 'school' && sd.half && sd.half.dismiss) e = toMin(sd.half.dismiss); return { b, s, e }; })
    .sort((a, b) => a.s - b.s);
}
const label = b => b.label || NAMES[b.type] || 'Busy';
function whereIs(p, today, tomorrow, now, events) {
  if (p.late && p.late.date === today && toMin(p.late.until) > now) return 'Running late · home ~' + hm12(toMin(p.late.until));
  const list = routineOn(p, today, events), blocks = list.filter(x => x.e != null && x.b.type !== 'bed' && x.b.type !== 'wake');
  const bed = list.find(x => x.b.type === 'bed'), wake = list.find(x => x.b.type === 'wake'), tw = routineOn(p, tomorrow, events).find(x => x.b.type === 'wake');
  const cur = blocks.find(x => x.s <= now && x.e > now);
  if (cur) return cur.b.type === 'commute' ? 'On the way · home ~' + hm12(cur.e) : label(cur.b) + ' until ' + hm12(cur.e);
  if (bed && now >= bed.s) return 'Asleep' + (tw ? ' · up ' + hm12(tw.s) : '');
  if (wake && now < wake.s) return 'Asleep · up ' + hm12(wake.s);
  const next = blocks.find(x => x.s > now);
  if (next && next.s - now < 180) return 'Home · ' + label(next.b) + ' at ' + hm12(next.s);
  if (bed && now >= 900) return 'Home · bed ' + hm12(bed.s);
  return p.status || 'Home';
}

const h2r = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), r2h = c => '#' + c.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const x = h2r(a), y = h2r(b); return r2h(x.map((v, i) => v + (y[i] - v) * t)); };
// same family-colour treatment as the frame (Look & layout → Family colours)
function personColor(c, i, mode, t) {
  if (!/^#[0-9a-f]{6}$/i.test(c || '')) return t.deep;
  if (mode === 'theme') return t.people[i % t.people.length];
  if (mode === 'original') return c;
  const r = h2r(c), g = (r[0] + r[1] + r[2]) / 3; let o = mix(c, r2h([g, g, g]), 0.4); o = mix(o, t.deep, 0.15); return t.dark ? mix(o, '#FFFFFF', 0.12) : o;
}
export function widgetSummary(data, synced, look, wx, nowDate = new Date()) {
  const t = THEMES[look.theme === 'dark' ? 'evening' : look.palette] || THEMES.oat;
  const W = wall(nowDate), today = W.ymd, tomorrow = addDay(today, 1), now = W.min;
  const people = (data.people || []).map((p, i) => ({ ...p, color: personColor(p.color, i, look.people || 'soft', t) })), pc = Object.fromEntries(people.map(p => [p.id, p.color]));
  // dedupe synced events that arrive from several calendars (same uid + start), merging people
  const seen = new Map(), syn = [];
  (synced.events || []).forEach(e => { const k = (String(e.id).split(':').slice(2).join(':') || e.title) + '|' + (e.start || e.startDate);
    const x = seen.get(k); if (!x) { const c = { ...e, people: [...(e.people || [])] }; seen.set(k, c); syn.push(c); return; }
    if (!x.people.length) return; if (!(e.people || []).length) { x.people = []; return; } e.people.forEach(id => { if (!x.people.includes(id)) x.people.push(id); }); });
  const events = (data.events || []).concat(syn);
  // next events (today remaining, then tomorrow), skipping school-calendar markers (shown as banners)
  const list = [];
  [today, tomorrow].forEach((d, di) => events.forEach(e => {
    if (e.school || !e.start || !occursOn(e, d)) return;
    const sw = wall(new Date(e.start)), ew = e.end ? wall(new Date(e.end)) : null;
    const s = e.allDay ? -1 : sw.min, en = e.allDay ? 1440 : (ew ? (e.repeat ? ew.min : (ew.ymd > d ? 1440 : ew.min)) : s + 60);
    if (di === 0 && !e.allDay && en <= now) return;
    list.push({ title: e.title || '', day: di === 0 ? 'today' : 'tomorrow', allDay: !!e.allDay, time: e.allDay ? 'All day' : hm12(s), sort: di * 2000 + s,
      colors: (e.people && e.people.length ? e.people : []).map(id => pc[id]).filter(Boolean).slice(0, 4), countdown: !!e.countdown });
  }));
  list.sort((a, b) => a.sort - b.sort);
  const kids = people.filter(p => p.school);
  const banners = [];
  [[today, 'Today'], [tomorrow, 'Tomorrow']].forEach(([d, word]) => {
    const groups = {};
    kids.forEach(k => { const sd = schoolDay(events, d, k.id), e = sd.off || sd.half; if (!e) return;
      const key = (sd.off ? 'No school' : 'Early release' + (e.dismiss ? ' ' + hm12(toMin(e.dismiss)) : '')); (groups[key] = groups[key] || []).push(k.name); });
    Object.entries(groups).forEach(([k, names]) => banners.push(`${word}: ${k} – ${names.join(', ')}`));
  });
  // birthdays & anniversaries within the reminder window (family birthdays + the dates list)
  const win = Math.max(0, Math.min(60, +look.bdayDays || 7)), upcoming = [];
  const srcs = (data.people || []).filter(p => p.birthday).map(p => ({ name: p.name, kind: 'birthday', date: p.birthday })).concat((data.dates || []).map(d => ({ name: d.name, kind: d.kind || 'birthday', date: d.date })));
  srcs.forEach(x => { const m = /^(\d{4}|-)-?(\d\d)-(\d\d)$/.exec(x.date || ''); if (!m) return;
    const y0 = +today.slice(0, 4); for (const y of [y0, y0 + 1]) { const ymd = `${y}-${m[2]}-${m[3]}`, inDays = Math.round((Date.parse(ymd) - Date.parse(today)) / 864e5);
      if (inDays < 0 || inDays > win) continue; const n = /^\d{4}$/.test(m[1]) ? y - +m[1] : null;
      upcoming.push({ name: x.name, kind: x.kind, date: ymd, inDays, turning: n }); break; } });
  upcoming.sort((a, b) => a.inDays - b.inDays);
  upcoming.forEach(u => banners.push(`${u.kind === 'anniversary' ? '🥂' : '🎂'} ${u.name}${u.kind === 'anniversary' ? '’s anniversary' + (u.turning ? ` (${u.turning} yrs)` : '') : u.turning ? ' turns ' + u.turning : '’s birthday'} ${u.inDays === 0 ? 'today' : u.inDays === 1 ? 'tomorrow' : 'in ' + u.inDays + ' days'}`));
  // opt-in countdowns (events with countdown, chosen birthdays/anniversaries and holidays), soonest first
  const cdOn = new Set((data.countdowns || []).map(c => c.id)), cds = [], dd = d => Math.round((Date.parse(d) - Date.parse(today)) / 864e5);
  (data.events || []).forEach(e => { if (!e.countdown || !e.start) return; const d = wall(new Date(e.start)).ymd; if (d >= today && dd(d) <= 366) cds.push({ title: e.title || '', emoji: e.emoji || cdEmoji(e.title), date: d, inDays: dd(d) }); });
  (data.people || []).filter(p => p.birthday).map(p => ({ id: 'b:' + p.id, name: p.name, kind: 'birthday', date: p.birthday }))
    .concat((data.dates || []).filter(d => !d.pid).map(d => ({ id: 'b:d:' + d.id, name: d.name, kind: d.kind || 'birthday', date: d.date }))).forEach(x => {
      if (!cdOn.has(x.id)) return; const m = /(\d\d)-(\d\d)$/.exec(x.date || ''); if (!m) return; const y = +today.slice(0, 4); let d = `${y}-${m[1]}-${m[2]}`; if (d < today) d = `${y + 1}-${m[1]}-${m[2]}`;
      cds.push({ title: x.name + (x.kind === 'anniversary' ? '’s anniversary' : '’s birthday'), emoji: x.kind === 'anniversary' ? '🥂' : '🎂', date: d, inDays: dd(d) }); });
  cdOn.forEach(id => { if (!id.startsWith('h:')) return; const h = nextHoliday(id.slice(2), today); if (h) cds.push({ title: h.title, emoji: h.emoji, date: h.date, inDays: dd(h.date) }); });
  cds.sort((a, b) => a.inDays - b.inDays);
  // meals
  const meals = data.meals || [];
  const dinner = meals.find(m => m.date === today && m.slot === 'dinner');
  const school = kids.map(k => {
    const sd = schoolDay(events, today, k.id), wd = wdOf(today);
    if (sd.off || wd === 0 || wd === 6) return null;
    const choice = (data.lunch || []).find(l => l.date === today && l.pid === k.id);
    const lunch = meals.find(m => m.date === today && m.slot === 'school' && (!m.for || !m.for.length || m.for.includes(k.id)));
    const wk = (data.menus || []).filter(m => !m.kids || !m.kids.length || m.kids.includes(k.id));
    const bf = wk.find(m => m.meal === 'breakfast'), wl = wk.find(m => m.meal === 'lunch');
    return { name: k.name, color: k.color, lunch: choice && choice.choice === 'home' ? 'Packed lunch' : (lunch ? lunch.title : wl && wl.days ? wl.days[wd] || null : null),
      breakfast: bf && bf.days ? bf.days[wd] || null : null };
  }).filter(Boolean);
  // chores remaining for the current slot
  const h = Math.floor(now / 60), slot = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  const chores = (data.chores || []).filter(c => !(c.skip || []).includes(today) && (c.date ? c.date === today : !(Array.isArray(c.days) && c.days.length) || c.days.includes(wdOf(today)))).filter(c => (c.r || []).includes(slot) && !(c.doneSlots && c.doneSlots[slot] === today)).length;
  const dly = wx && wx.daily && wx.daily.find(x => x.d === today);
  const code = wx && wx.current ? wx.current.code : null;
  return {
    updated: nowDate.toISOString(), date: today, dateLabel: longDate(today), weekday: longDate(today).split(',')[0], time: hm12(now),
    weather: wx && wx.current ? { now: wx.current.t, hi: dly ? dly.hi : null, lo: dly ? dly.lo : null, code, icon: sfIcon(code, wx.current.day), text: (wx.codes && wx.codes[code]) || '', rain: dly ? dly.p : null } : null,
    next: list.slice(0, 4).map(({ sort, ...x }) => x),
    banners, celebrations: upcoming, countdowns: cds.slice(0, 6), dinner: dinner ? dinner.title : null, school,
    people: people.map(p => ({ name: p.name, color: p.color, where: whereIs(p, today, tomorrow, now, events) })),
    chores: { slot, left: chores },
    shopping: (() => { const trips = (data.trips || []).slice().sort((a, b) => (a.date || '9999') < (b.date || '9999') ? -1 : 1);
      const nt = trips.find(x => x.date && x.date >= today) || trips[0] || null, known = new Set(trips.map(x => x.id));
      const left = (data.groceries || []).filter(g => !g.done && (!g.trip || !known.has(g.trip) || (nt && g.trip === nt.id))).length;
      const st = nt && (data.stores || []).find(x => x.id === nt.store);
      const label = nt ? (nt.name || (st ? st.name : 'Shopping')) + (nt.date ? ' · ' + new Date(nt.date + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }) : '') : null;
      return { trip: label, left }; })(),
    theme: { name: t.name, dark: !!t.dark, paper: t.paper, card: t.card, ink: t.ink, mute: t.mute, deep: t.deep, onDeep: t.onDeep, accent: look.accent && look.accent !== '#111111' ? look.accent : t.accent, line: t.line },
  };
}
function sfIcon(c, day) {
  if (c == null) return 'cloud';
  if (c === 0) return day ? 'sun.max.fill' : 'moon.stars.fill';
  if (c <= 2) return day ? 'cloud.sun.fill' : 'cloud.moon.fill';
  if (c === 3) return 'cloud.fill';
  if (c <= 48) return 'cloud.fog.fill';
  if (c <= 67 || (c >= 80 && c <= 82)) return 'cloud.rain.fill';
  if (c <= 77 || c === 85 || c === 86) return 'cloud.snow.fill';
  return 'cloud.bolt.rain.fill';
}
