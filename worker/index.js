import { accessUser, accessOn, passUser, passCookie, cookie } from './access.js';
import SEED from './seed.json';
import { parseIcs } from './ics.js';
import { importRecipe } from './recipe.js';
import { extract } from './extract.js';
import { handlePhotos } from './photos.js';
import { widgetSummary } from './widget.js';
import WIDGET_SCRIPT from './widget-script.js';

const KEY = 'data', CAL_KEY = 'calendars', SYNC_KEY = 'synced';
const SECTIONS = ['people', 'events', 'chores', 'groceries', 'meals', 'lunch', 'menus', 'schools', 'usuals', 'stores', 'stars', 'trips', 'recipes', 'wishes', 'dates', 'countdowns'];
const FRAME_SECTIONS = ['chores', 'groceries', 'events', 'stars', 'lunch'];   // lunch = daily school/home lunch taps
const MAX_BYTES = 512 * 1024;
const STALE_MS = 20 * 60 * 1000;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

async function load(env) {
  const v = await env.DATA_KV.get(KEY, 'json');
  return v || { ...SEED, updated: null };
}

function eq(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
const ACC = new WeakMap();   // request → Access email (set in fetch)
function authed(req, env) {
  if (ACC.get(req)) return true;
  const got = req.headers.get('x-passcode') || '';
  return !!env.EDIT_PASSCODE && eq(got.trim().toLowerCase(), String(env.EDIT_PASSCODE).toLowerCase());
}
// The frame authenticates with a long random FRAME_KEY (saved once via /?key=...).
function frameAuthed(req, env) {
  const got = req.headers.get('x-frame-key') || new URL(req.url).searchParams.get('key') || cookie(req, 'hq_frame') || '';
  return !!env.FRAME_KEY && eq(got.trim(), String(env.FRAME_KEY));
}

function valid(section, v) {
  if (section === 'stars') return v && typeof v === 'object' && !Array.isArray(v);
  if (!Array.isArray(v)) return false;
  return v.every(x => x && typeof x === 'object' && typeof x.id === 'string');
}

// ------------------------------------------------------------------ calendar sync
async function getCalendars(env) { return (await env.DATA_KV.get(CAL_KEY, 'json')) || []; }
async function getSynced(env) { return (await env.DATA_KV.get(SYNC_KEY, 'json')) || { updated: null, feeds: {}, events: [] }; }

export async function syncCalendars(env, fetcher = fetch) {
  const cals = await getCalendars(env);
  const now = Date.now(), from = new Date(now - 31 * 864e5), to = new Date(now + 120 * 864e5);
  const prev = await getSynced(env);
  const feeds = {}, events = [];
  await Promise.all(cals.map(async cal => {
    try {
      const url = cal.url.trim().replace(/^webcal:\/\//i, 'https://');
      const r = await fetcher(url, { headers: { 'user-agent': 'HomeHQ-Calendar/1.0', accept: 'text/calendar,*/*' }, cf: { cacheTtl: 300 } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const text = await r.text();
      if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('Not an iCal feed (check the link)');
      const list = parseIcs(text, { from, to });
      list.forEach(e => {
        e.id = 'cal:' + cal.id + ':' + e.id;
        e.people = Array.isArray(cal.whos) && cal.whos.length ? cal.whos.slice() : cal.who && cal.who !== 'family' ? [cal.who] : [];
        e.readOnly = true; e.cal = cal.name;
        events.push(e);
      });
      feeds[cal.id] = { ok: true, count: list.length, fetched: new Date().toISOString() };
    } catch (err) {
      // keep the last good events for this feed if it temporarily fails
      (prev.events || []).filter(e => e.id.startsWith('cal:' + cal.id + ':')).forEach(e => events.push(e));
      feeds[cal.id] = { ok: false, error: String(err.message || err).slice(0, 200), fetched: new Date().toISOString(), count: prev.feeds?.[cal.id]?.count || 0 };
    }
  }));
  const synced = { updated: new Date().toISOString(), feeds, events };
  await env.DATA_KV.put(SYNC_KEY, JSON.stringify(synced));
  return synced;
}

function validCalendars(v) {
  return Array.isArray(v) && v.length <= 20 && v.every(c => c && typeof c.id === 'string' && typeof c.name === 'string' &&
    typeof c.url === 'string' && /^(https?|webcal):\/\//i.test(c.url.trim()) && c.url.length < 2000);
}

// ------------------------------------------------------------------ look & layout (frame appearance)
const LOOK_KEY = 'look';
export const DEFAULT_LOOK = {
  theme: 'light', palette: 'oat', people: 'soft', boldHighlight: false, accent: '#111111', fontScale: 1, startView: 'home', calendarMode: 'day',
  weekStart: 'mon', clock24: false, routineOnCalendar: false, routinesOnCal: false, choresView: 'all', orientation: 'auto', season: 'auto', wishHide: true, bdayDays: 7,
  sections: { calendar: true, tasks: true, meals: true, shopping: true, photos: false, control: false, agents: false },
  tiles: { weather: true, people: true, photo: false, meals: true, chores: true, shopping: true, status: false },
  sideOrder: ['meals', 'photo', 'chores', 'shopping', 'status'],
  wx: { place: 'New York, NY', lat: 40.7128, lon: -74.006 },
  night: { on: true, from: '21:00', to: '06:00', dim: 0.25 },
};
async function getLook(env) {
  const v = (await env.DATA_KV.get(LOOK_KEY, 'json')) || {};
  return { ...DEFAULT_LOOK, ...v, sections: { ...DEFAULT_LOOK.sections, ...(v.sections || {}) }, tiles: { ...DEFAULT_LOOK.tiles, ...(v.tiles || {}) } };
}
function cleanLook(l) {
  const pick = (v, ok, d) => ok.includes(v) ? v : d;
  const bools = (o, d) => Object.fromEntries(Object.keys(d).map(k => [k, o && k in o ? !!o[k] : d[k]]));
  const order = Array.isArray(l.sideOrder) ? l.sideOrder.filter(x => DEFAULT_LOOK.sideOrder.includes(x)) : [];
  DEFAULT_LOOK.sideOrder.forEach(x => { if (!order.includes(x)) order.push(x); });
  return {
    theme: pick(l.theme, ['light', 'dark', 'auto'], 'light'),
    palette: pick(l.palette, ['oat', 'sage', 'harbor', 'mushroom', 'cranberry', 'evening'], 'oat'),
    people: pick(l.people, ['soft', 'theme', 'original'], 'soft'),
    boldHighlight: l.boldHighlight === true,
    accent: /^#[0-9a-f]{6}$/i.test(l.accent || '') ? l.accent : DEFAULT_LOOK.accent,
    fontScale: Math.min(1.3, Math.max(0.85, +l.fontScale || 1)),
    startView: pick(l.startView, ['home', 'calendar', 'tasks', 'meals', 'shopping'], 'home'),
    calendarMode: pick(l.calendarMode, ['day', '3day', 'week', 'month'], 'day'),
    weekStart: pick(l.weekStart, ['mon', 'sun'], 'mon'),
    clock24: !!l.clock24,
    routineOnCalendar: !!l.routineOnCalendar,
    routinesOnCal: !!l.routinesOnCal,
    choresView: pick(l.choresView, ['all', 'now'], 'all'),
    orientation: pick(l.orientation, ['auto', 'landscape', 'portrait'], 'auto'),
    season: pick(l.season, ['auto', 'off', 'halloween', 'thanksgiving', 'christmas', 'winter'], 'auto'),
    wishHide: l.wishHide !== false,
    bdayDays: Math.max(0, Math.min(60, Math.round(+l.bdayDays) || (l.bdayDays === 0 ? 0 : 7))),
    sections: bools(l.sections, DEFAULT_LOOK.sections),
    tiles: bools(l.tiles, DEFAULT_LOOK.tiles),
    sideOrder: order,
    wx: { place: String((l.wx && l.wx.place) || DEFAULT_LOOK.wx.place).slice(0, 60),
      lat: Math.max(-90, Math.min(90, +(l.wx && l.wx.lat) || DEFAULT_LOOK.wx.lat)), lon: Math.max(-180, Math.min(180, +(l.wx && l.wx.lon) || DEFAULT_LOOK.wx.lon)) },
    night: { on: !(l.night && l.night.on === false), from: HM_RE.test(l.night && l.night.from) ? l.night.from : '21:00', to: HM_RE.test(l.night && l.night.to) ? l.night.to : '06:00',
      dim: Math.min(0.8, Math.max(0.05, +(l.night && l.night.dim) || 0.25)) },
  };
}
const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ------------------------------------------------------------------ weather (Open-Meteo, no key) — cached in KV for 30 min
const WX_CODES = { 0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog', 51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorms', 96: 'Thunderstorms', 99: 'Thunderstorms' };
export async function getWeather(env, force) {
  const look = await getLook(env), { lat, lon, place } = look.wx;
  const key = `wx:${lat.toFixed(3)},${lon.toFixed(3)}`;
  const cached = await env.DATA_KV.get(key, 'json');
  if (cached && !force && Date.now() - Date.parse(cached.fetched) < 30 * 60000) return cached;
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=America%2FNew_York&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&forecast_days=8`
    + '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day,relative_humidity_2m'
    + '&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,is_day'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset';
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error('open-meteo ' + r.status);
    const j = await r.json(), H = j.hourly, Dy = j.daily, R = Math.round;
    const out = { fetched: new Date().toISOString(), place, lat, lon, codes: WX_CODES,
      current: { t: R(j.current.temperature_2m), feels: R(j.current.apparent_temperature), code: j.current.weather_code, wind: R(j.current.wind_speed_10m), day: !!j.current.is_day, hum: j.current.relative_humidity_2m },
      hourly: H.time.map((t, i) => ({ t, temp: R(H.temperature_2m[i]), p: H.precipitation_probability[i] || 0, code: H.weather_code[i], wind: R(H.wind_speed_10m[i]), day: !!H.is_day[i] })),
      daily: Dy.time.map((d, i) => ({ d, hi: R(Dy.temperature_2m_max[i]), lo: R(Dy.temperature_2m_min[i]), code: Dy.weather_code[i], p: Dy.precipitation_probability_max[i] || 0, wind: R(Dy.wind_speed_10m_max[i]), rise: Dy.sunrise[i], set: Dy.sunset[i] })) };
    await env.DATA_KV.put(key, JSON.stringify(out));
    return out;
  } catch (e) { if (cached) return { ...cached, stale: true }; throw e; }
}

// ------------------------------------------------------------------ care schedules + babysitter link
// care: { people: { [pid]: { items:[{id,time,end,type,label,notes}], notes, contacts } } } — not in the public /api/data.
// Readable with the passcode, the frame key, or the sitter token (?t= / x-sitter-token). Sitter can log 'done'.
const CARE_KEY = 'care', LOG_KEY = 'carelog', SITTER_KEY = 'sitter', WIDGET_KEY = 'widget';
async function widgetAuthed(req, env) {
  const t = (req.headers.get('x-widget-token') || new URL(req.url).searchParams.get('t') || '').trim();
  if (!t) return false;
  const s = await env.DATA_KV.get(WIDGET_KEY, 'json');
  return !!(s && s.token && eq(t, s.token));
}
async function sitterAuthed(req, env) {
  const t = (req.headers.get('x-sitter-token') || new URL(req.url).searchParams.get('t') || '').trim();
  if (!t) return false;
  const s = await env.DATA_KV.get(SITTER_KEY, 'json');
  return !!(s && s.token && eq(t, s.token));
}
function newToken() { const b = crypto.getRandomValues(new Uint8Array(12)); return [...b].map(x => x.toString(36).padStart(2, '0')).join('').slice(0, 20); }
function cleanCare(c) {
  const out = { people: {} };
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  const tm = v => /^\d{2}:\d{2}$/.test(v || '') ? v : '';
  Object.entries((c && c.people) || {}).slice(0, 12).forEach(([pid, v]) => {
    out.people[str(pid, 40)] = {
      items: (Array.isArray(v.items) ? v.items : []).slice(0, 60).filter(i => i && typeof i.id === 'string' && tm(i.time)).map(i => ({
        id: str(i.id, 40), time: tm(i.time), end: tm(i.end), type: ['feed', 'nap', 'bed', 'meds', 'wake', 'other'].includes(i.type) ? i.type : 'other',
        label: str(i.label, 120), notes: str(i.notes, 500) })),
      notes: str(v.notes, 4000), contacts: str(v.contacts, 2000),
    };
  });
  return out;
}
async function handleCare(req, env, parts) {
  const pass = authed(req, env);
  if (parts[0] === 'sitter-link') {
    if (!pass) return json({ error: 'bad passcode' }, 401);
    let s = (await env.DATA_KV.get(SITTER_KEY, 'json')) || {};
    if (req.method === 'POST') { s = { token: newToken(), created: new Date().toISOString() }; await env.DATA_KV.put(SITTER_KEY, JSON.stringify(s)); }
    else if (req.method === 'DELETE') { s = {}; await env.DATA_KV.delete(SITTER_KEY); }
    return json({ token: s.token || null, created: s.created || null });
  }
  const reader = pass || frameAuthed(req, env) || await sitterAuthed(req, env);
  if (!reader) return json({ error: 'not allowed' }, 401);
  const log = (await env.DATA_KV.get(LOG_KEY, 'json')) || {};
  if (parts[1] === 'log' && req.method === 'POST') {
    let b; try { b = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }
    const day = /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : null;
    if (!day || typeof b.pid !== 'string' || typeof b.item !== 'string') return json({ error: 'bad log entry' }, 400);
    log[day] = log[day] || {}; log[day][b.pid] = log[day][b.pid] || {};
    if (b.undo) delete log[day][b.pid][b.item];
    else log[day][b.pid][b.item] = { at: typeof b.at === 'string' ? b.at.slice(0, 40) : new Date().toISOString(), by: pass ? 'parent' : frameAuthed(req, env) ? 'frame' : 'sitter', note: typeof b.note === 'string' ? b.note.slice(0, 200) : undefined };
    Object.keys(log).sort().slice(0, -14).forEach(k => delete log[k]);   // keep two weeks
    await env.DATA_KV.put(LOG_KEY, JSON.stringify(log));
    return json({ ok: true, log });
  }
  if (req.method === 'PUT') {
    if (!pass) return json({ error: 'bad passcode' }, 401);
    let b; try { b = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }
    await env.DATA_KV.put(CARE_KEY, JSON.stringify(cleanCare(b)));
  }
  if (req.method !== 'GET' && req.method !== 'PUT') return json({ error: 'method' }, 405);
  const care = (await env.DATA_KV.get(CARE_KEY, 'json')) || { people: {} };
  const data = (await env.DATA_KV.get('data', 'json')) || {};
  // everyone's bedtimes / wake-ups from weekly routines, for the sitter view
  const people = (data.people || []).filter(p => p.role !== 'parent').map(p => ({ id: p.id, name: p.name, color: p.color, ink: p.ink, role: p.role || 'child',
    sleep: (p.routine || []).filter(b => b.type === 'bed' || b.type === 'wake').map(b => ({ type: b.type, days: b.days, start: b.start })) }));
  return json({ care, people, log });
}

// ------------------------------------------------------------------ API
export async function handleApi(req, env, ctx) {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/\/+$/, '').split('/').slice(2); // after /api

  if (parts[0] === 'auth') {
    if (req.method !== 'POST') return json({ error: 'method' }, 405);
    return authed(req, env) ? json({ ok: true }) : json({ error: 'bad passcode' }, 401);
  }

  if (parts[0] === 'care' || parts[0] === 'sitter-link') return handleCare(req, env, parts);

  // iPhone widget: a separate read-only token, managed only by a signed-in parent (not the frame key)
  if (parts[0] === 'widget-token') {
    if (!authed(req, env)) return json({ error: 'sign in required' }, 401);
    let s = (await env.DATA_KV.get(WIDGET_KEY, 'json')) || {};
    if (req.method === 'POST') { s = { token: newToken() + newToken(), created: new Date().toISOString() }; await env.DATA_KV.put(WIDGET_KEY, JSON.stringify(s)); }
    else if (req.method === 'DELETE') { s = {}; await env.DATA_KV.delete(WIDGET_KEY); }
    return json({ token: s.token || null, created: s.created || null });
  }
  if (parts[0] === 'widget') {
    if (req.method !== 'GET') return json({ error: 'read only' }, 405);
    if (!authed(req, env) && !(await widgetAuthed(req, env))) return json({ error: 'bad widget token' }, 401);
    const [data, synced, look] = await Promise.all([load(env), getSynced(env), getLook(env)]);
    let wx = null; try { wx = await getWeather(env); } catch {}
    return json(widgetSummary(data, synced, look, wx));
  }

  if (parts[0] === 'weather') {
    if (!authed(req, env) && !frameAuthed(req, env)) return json({ error: 'sign in required' }, 401);
    try { return json(await getWeather(env, req.method === 'POST')); } catch (e) { return json({ error: 'weather unavailable' }, 502); }
  }

  if (parts[0] === 'look') {
    if (req.method === 'GET') return json(await getLook(env));
    if (req.method !== 'PUT') return json({ error: 'method' }, 405);
    if (!authed(req, env)) return json({ error: 'bad passcode' }, 401);
    let body; try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }
    const look = body && body.reset ? {} : cleanLook({ ...(await getLook(env)), ...body });
    await env.DATA_KV.put(LOOK_KEY, JSON.stringify(look));
    return json(await getLook(env));
  }

  if (parts[0] === 'photos' || parts[0] === 'photo') return handlePhotos(req, env, parts, authed(req, env));

  // Fetch a school calendar link server-side (Google Doc/Sheet, web page, PDF, .ics) for the school-year importer
  if (parts[0] === 'fetch-link') {
    if (req.method !== 'POST') return json({ error: 'method' }, 405);
    if (!authed(req, env)) return json({ error: 'bad passcode' }, 401);
    let url; try { url = new URL(String((await req.json()).url || '').trim().replace(/^webcal:/i, 'https:')); } catch { return json({ error: 'That doesn’t look like a link' }, 400); }
    if (!/^https?:$/.test(url.protocol)) return json({ error: 'Only http(s) links' }, 400);
    let m;
    if (/\.ics$/i.test(url.pathname) || /\/ical\//.test(url.pathname)) return json({ kind: 'ics', url: url.href });
    if (url.hostname === 'docs.google.com' && (m = url.pathname.match(/^\/document\/d\/([\w-]+)/))) url = new URL(`https://docs.google.com/document/d/${m[1]}/export?format=txt`);
    else if (url.hostname === 'docs.google.com' && (m = url.pathname.match(/^\/spreadsheets\/d\/([\w-]+)/))) url = new URL(`https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${url.hash.match(/gid=\d+/) ? '&' + url.hash.match(/gid=\d+/)[0] : ''}`);
    else if (url.hostname === 'drive.google.com' && (m = url.pathname.match(/\/file\/d\/([\w-]+)/))) url = new URL(`https://drive.google.com/uc?export=download&id=${m[1]}`);
    let r; try { r = await fetch(url.href, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 HomeDashboard' }, signal: AbortSignal.timeout(20000) }); } catch (e) { return json({ error: 'Couldn’t reach that link' }, 502); }
    if (!r.ok) return json({ error: r.status === 401 || r.status === 403 ? 'That link isn’t public — share it as “Anyone with the link”' : `The link returned ${r.status}` }, 502);
    const ct = (r.headers.get('content-type') || '').toLowerCase(), buf = await r.arrayBuffer();
    if (buf.byteLength > 12 * 1024 * 1024) return json({ error: 'File too large' }, 413);
    const head = new TextDecoder().decode(buf.slice(0, 64));
    if (/text\/calendar/.test(ct) || head.startsWith('BEGIN:VCALENDAR')) return json({ kind: 'ics', url: url.href });
    if (/pdf/.test(ct) || head.startsWith('%PDF')) { let bin = ''; const u8 = new Uint8Array(buf); for (let i = 0; i < u8.length; i += 32768) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return json({ kind: 'pdf', b64: btoa(bin) }); }
    let text = new TextDecoder().decode(buf);
    if (/html/.test(ct) || /^\s*<(!doctype|html)/i.test(text)) text = text.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '’');
    // drop calendar-grid noise (lines that are just day numbers / weekday letters)
    text = text.split(/\r?\n/).map(l => l.replace(/[\t ]+/g, ' ').trim()).filter(l => l && !/^(\d{1,2}|[SMTWF]|Th|Su|Sa)$/i.test(l)).join('\n');
    return json({ kind: 'text', text: text.slice(0, 60000), url: url.href });
  }

  if (parts[0] === 'recipe-import') {
    if (req.method !== 'POST') return json({ error: 'method' }, 405);
    if (!authed(req, env)) return json({ error: 'bad passcode' }, 401);
    try { return json(await importRecipe(env, await req.json())); } catch (e) { return json({ error: e.message || 'Import failed' }, e.status || 500); }
  }

  if (parts[0] === 'extract') {
    if (req.method !== 'POST') return json({ error: 'method' }, 405);
    if (!authed(req, env)) return json({ error: 'bad passcode' }, 401);
    const text = await req.text();
    if (text.length > 6 * 1024 * 1024) return json({ error: 'Photo too large' }, 413);
    let body; try { body = JSON.parse(text); } catch { return json({ error: 'invalid json' }, 400); }
    try { return json(await extract(env, body)); }
    catch (e) { return json({ error: e.message || 'AI failed' }, e.status || 502); }
  }

  if (parts[0] === 'calendars') {
    if (!authed(req, env)) return json({ error: 'bad passcode' }, 401);
    if (req.method === 'GET') return json({ calendars: await getCalendars(env), status: (await getSynced(env)).feeds });
    if (req.method === 'POST' && parts[1] === 'sync') { const s = await syncCalendars(env); return json({ calendars: await getCalendars(env), status: s.feeds }); }
    if (req.method === 'PUT') {
      let body; try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }
      if (!validCalendars(body)) return json({ error: 'invalid calendars (need name + https/webcal link)' }, 400);
      // additive: keep any extra fields already stored on a calendar (e.g. owner), add whos[] for multi-person calendars
      const prevCals = await getCalendars(env), byId = Object.fromEntries(prevCals.map(c => [c.id, c]));
      await env.DATA_KV.put(CAL_KEY, JSON.stringify(body.map(c => {
        const whos = Array.isArray(c.whos) ? c.whos.filter(x => typeof x === 'string').slice(0, 12) : null;
        const out = { ...(byId[c.id] || {}), id: c.id, name: c.name.slice(0, 80), url: c.url.trim(), who: c.who || 'family' };
        if (whos) out.whos = whos; else delete out.whos;   // the client is the source of truth for who; other stored fields (e.g. owner) are kept
        return out;
      })));
      const s = await syncCalendars(env);
      return json({ calendars: await getCalendars(env), status: s.feeds });
    }
    return json({ error: 'method' }, 405);
  }

  // The frame may edit ONE person's weekly routine (+ today's running-late override) — nothing else about people.
  if (parts[0] === 'routine' && parts[1]) {
    if (req.method !== 'PUT') return json({ error: 'method' }, 405);
    if (!authed(req, env) && !frameAuthed(req, env)) return json({ error: 'bad passcode' }, 401);
    let body; try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }
    const HM = /^([01]\d|2[0-3]):[0-5]\d$/, DAY = /^\d{4}-\d\d-\d\d$/, TYPES = ['work', 'school', 'daycare', 'commute', 'activity', 'bed', 'wake', 'other'];
    const r = body && body.routine;
    const ok = Array.isArray(r) && r.length <= 40 && r.every(b => b && typeof b.id === 'string' && b.id.length < 40 && TYPES.includes(b.type) && HM.test(b.start) && (b.end == null || HM.test(b.end))
      && Array.isArray(b.days) && b.days.length && b.days.every(d => Number.isInteger(d) && d >= 0 && d <= 6) && (b.label == null || (typeof b.label === 'string' && b.label.length <= 60))
      && (b.skip == null || (Array.isArray(b.skip) && b.skip.length <= 60 && b.skip.every(x => DAY.test(x))))
      && (b.over == null || (typeof b.over === 'object' && !Array.isArray(b.over) && Object.keys(b.over).length <= 60 && Object.entries(b.over).every(([k, v]) => DAY.test(k) && v && HM.test(v.start) && (v.end == null || HM.test(v.end))))));
    const off = body.dayoff == null ? undefined : body.dayoff;
    if (off !== undefined && !(Array.isArray(off) && off.length <= 50 && off.every(x => x && DAY.test(x.from) && DAY.test(x.to) && x.from <= x.to && (x.label == null || (typeof x.label === 'string' && x.label.length <= 60)))))
      return json({ error: 'invalid days off' }, 400);
    const late = body.late == null ? null : body.late;
    if (!ok || (late && !(DAY.test(late.date) && HM.test(late.until)))) return json({ error: 'invalid routine' }, 400);
    const data = await load(env), p = (data.people || []).find(x => x.id === decodeURIComponent(parts[1]));
    if (!p) return json({ error: 'unknown person' }, 404);
    p.routine = r.map(b => { const o = { id: b.id, type: b.type, label: b.label || undefined, days: [...new Set(b.days)].sort(), start: b.start }; if (b.end) o.end = b.end; if (b.skip && b.skip.length) o.skip = b.skip; if (b.over && Object.keys(b.over).length) o.over = Object.fromEntries(Object.entries(b.over).map(([k, v]) => [k, v.end ? { start: v.start, end: v.end } : { start: v.start }])); return o; });
    if (off !== undefined) { if (off.length) p.dayoff = off.map(x => ({ from: x.from, to: x.to, label: x.label || undefined })); else delete p.dayoff; }
    if (late) p.late = { date: late.date, until: late.until }; else delete p.late;
    data.updated = new Date().toISOString();
    await env.DATA_KV.put(KEY, JSON.stringify(data));
    return json({ ok: true, person: { id: p.id, routine: p.routine, late: p.late || null, dayoff: p.dayoff || [] } });
  }

  if (parts[0] !== 'data') return json({ error: 'not found' }, 404);

  if (req.method === 'GET' && parts.length === 1) {
    const [data, synced] = await Promise.all([load(env), getSynced(env)]);
    const cals = await getCalendars(env);
    if (cals.length && (!synced.updated || Date.now() - Date.parse(synced.updated) > STALE_MS) && ctx) ctx.waitUntil(syncCalendars(env));
    // wish lists: kids looking at the frame never receive "got it" marks while the parent hide option is on
    if (Array.isArray(data.wishes) && !authed(req, env) && (await getLook(env)).wishHide !== false) data.wishes = data.wishes.map(({ got, ...w }) => w);
    return json({ ...data, syncedEvents: synced.events || [], syncedAt: synced.updated });
  }

  if (req.method === 'PUT' || req.method === 'POST' || req.method === 'DELETE') {
    const full = authed(req, env), frame = !full && req.method === 'PUT' && frameAuthed(req, env);
    if (!full && !frame) return json({ error: 'bad passcode' }, 401);
    const allowed = full ? SECTIONS : FRAME_SECTIONS;
    if (req.method === 'DELETE' && parts[1] === 'reset') {
      await env.DATA_KV.delete(KEY);
      return json(await load(env));
    }
    const text = await req.text();
    if (text.length > MAX_BYTES) return json({ error: 'too large' }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: 'invalid json' }, 400); }
    const data = await load(env);
    const strip = (s, v) => s === 'events' ? v.filter(e => !e.readOnly && !String(e.id).startsWith('cal:')) : v;
    if (parts[1]) {
      if (!SECTIONS.includes(parts[1])) return json({ error: 'unknown section' }, 404);
      if (!allowed.includes(parts[1])) return json({ error: 'forbidden' }, 403);
      if (!valid(parts[1], body)) return json({ error: 'invalid ' + parts[1] }, 400);
      data[parts[1]] = strip(parts[1], body);
    } else {
      for (const s of SECTIONS) if (s in body) {
        if (!allowed.includes(s)) return json({ error: 'forbidden ' + s }, 403);
        if (!valid(s, body[s])) return json({ error: 'invalid ' + s }, 400);
        data[s] = strip(s, body[s]);
      }
    }
    data.updated = new Date().toISOString();
    await env.DATA_KV.put(KEY, JSON.stringify(data));
    const synced = await getSynced(env);
    return json({ ...data, syncedEvents: synced.events || [], syncedAt: synced.updated });
  }
  return json({ error: 'method' }, 405);
}

// Pages/files anyone may load (no family data in them): built JS/CSS, icons, manifests, the sitter page shell.
const PUBLIC = /^\/(assets\/|pdfjs\/|icon-[\w-]+\.png$|[\w.-]+\.webmanifest$|sitter(\/|$)|favicon)/;
const FRAME_COOKIE = k => `hq_frame=${encodeURIComponent(k)}; Path=/; Max-Age=315360000; Secure; HttpOnly; SameSite=Lax`;
// "/" without login: frames that saved their key in localStorage come back with ?key=, everyone else → login
const BOOT = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Home HQ</title>
<body style="font:18px system-ui;background:#F6F3EE;color:#111;display:grid;place-items:center;height:100vh;margin:0"><p>Loading…</p>
<script>var k='';try{k=localStorage.getItem('hq-frame-key')||''}catch(e){}
location.replace(k?'/?key='+encodeURIComponent(k):'/auth?next='+encodeURIComponent(location.pathname+location.search));</script>`;

const EDIT_FWD = `<!doctype html><meta name="viewport" content="width=device-width"><title>Home HQ</title><p style="font:18px system-ui;text-align:center;margin-top:40vh">Opening Home HQ…</p>
<script>var h=(location.hash||'').slice(1).split('?')[0],V={events:'calendar',calendar:'calendar',chores:'chores',meals:'meals',groceries:'shopping',shopping:'shopping',today:'today'};
location.replace(!h?'/?edit=1':V[h]?'/?edit=1&view='+V[h]:'/?edit=1&view=more&open='+encodeURIComponent(h));</script>`;

const LOGIN = (next, bad, ready) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Home HQ · Sign in</title>
<body style="font:17px system-ui;background:#F6F3EE;color:#111;display:grid;place-items:center;min-height:100vh;margin:0">
<form method="post" action="/auth?next=${encodeURIComponent(next)}" style="background:#fff;padding:28px;border-radius:18px;box-shadow:0 8px 30px rgba(0,0,0,.08);width:min(340px,86vw)">
<h1 style="font-size:24px;margin:0 0 6px">Home HQ</h1>${ready ? `<p style="margin:0 0 16px;color:#555">Enter the family passcode.</p>
<input name="passcode" type="password" autocomplete="current-password" autofocus required style="width:100%;box-sizing:border-box;font-size:18px;padding:12px;border:1px solid #ccc;border-radius:10px">
${bad ? '<p style="color:#b00020;margin:10px 0 0">That passcode didn’t work.</p>' : ''}
<button style="margin-top:16px;width:100%;font-size:17px;padding:12px;border:0;border-radius:10px;background:#111;color:#fff">Sign in</button>`
  : `<p style="color:#555">No login is set up yet. Add an <b>EDIT_PASSCODE</b> secret to this Worker (Cloudflare dashboard → Workers → your worker → Settings → Variables and Secrets), or set up Cloudflare Access. See the README.</p>`}
</form>`;

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url), path = url.pathname;
    const user = (await accessUser(req, env)) || (await passUser(req, env)) || (env.DEV_NO_LOGIN === '1' ? 'dev@local' : '');
    if (user) ACC.set(req, user);
    // Passcode mode (no Cloudflare Access configured): /auth is our own small login page
    if (!accessOn(env) && path === '/auth' && !user) {
      const next = url.searchParams.get('next') || '/?edit=1';
      const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/?edit=1';
      let bad = false;
      if (req.method === 'POST') {
        const f = await req.formData().catch(() => null), got = String((f && f.get('passcode')) || '');
        if (env.EDIT_PASSCODE && eq(got.trim().toLowerCase(), String(env.EDIT_PASSCODE).toLowerCase())) {
          return new Response(null, { status: 303, headers: { Location: new URL(safe, url).href, 'Set-Cookie': await passCookie(env) } });
        }
        bad = true;
      }
      return new Response(LOGIN(safe, bad, !!env.EDIT_PASSCODE), { status: bad ? 401 : 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    // Access already checked the login on /auth; send them on to where they were going
    if (path === '/auth/me') return json({ email: user || null });
    if (path === '/auth' || path.startsWith('/auth/')) {
      const next = url.searchParams.get('next') || '/?edit=1';
      return Response.redirect(new URL(next.startsWith('/') && !next.startsWith('//') ? next : '/?edit=1', url).href, 302);
    }
    if (path === '/api/me') return user ? json({ email: user }) : json({ error: 'not signed in' }, 401);
    if (path.startsWith('/api/')) {
      // reads need a login, the frame key or the passcode; care/sitter endpoints do their own token checks
      const open = /^\/api\/(care|sitter-link|auth|widget)(\/|$)/.test(path);
      if (!open && !user && !frameAuthed(req, env) && !authed(req, env)) return json({ error: 'sign in required' }, 401);
      return handleApi(req, env, ctx);
    }
    if (path === '/widget/HomeHQ.js') {
      // the Scriptable script, with this family's widget token baked in (signed-in parents only)
      if (!user && !authed(req, env)) return Response.redirect(new URL('/auth?next=/widget/HomeHQ.js', url).href, 302);
      const s = (await env.DATA_KV.get(WIDGET_KEY, 'json')) || {};
      const body = WIDGET_SCRIPT.replace('__WIDGET_TOKEN__', s.token || '').replace('__ORIGIN__', url.origin);
      return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'content-disposition': 'inline; filename="HomeHQ.js"' } });
    }
    // one app: the old /edit/ address forwards to the dashboard (edit mode); the hash is mapped client-side.
    // The dashboard's own edit sheets still load /edit/?embed=1 inside a frame.
    if ((path === '/edit' || path === '/edit/' || path === '/edit/index.html') && !url.searchParams.has('embed')) {
      return new Response(EDIT_FWD, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    if (PUBLIC.test(path)) return env.ASSETS.fetch(req);
    const key = url.searchParams.get('key');
    if (key && env.FRAME_KEY && eq(key.trim(), String(env.FRAME_KEY))) {
      // frame link: serve the page and remember the key in a cookie (photos <img> and reloads)
      const r = await env.ASSETS.fetch(new Request(new URL('/', url), req));
      const out = new Response(r.body, r); out.headers.append('Set-Cookie', FRAME_COOKIE(key.trim())); out.headers.set('Cache-Control', 'no-store');
      return out;
    }
    const isFrame = frameAuthed(req, env) && (path === '/' || path === '/index.html');
    if (user || isFrame) { const r = await env.ASSETS.fetch(req); const out = new Response(r.body, r); out.headers.set('Cache-Control', 'no-store'); return out; }
    if (path === '/' || path === '/index.html') return new Response(BOOT, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    return Response.redirect(new URL('/auth?next=' + encodeURIComponent(path + url.search), url).href, 302);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(getWeather(env).catch(() => {}));
    ctx.waitUntil(syncCalendars(env));
  },
};
