import { HOLIDAYS as _HOL, nextHoliday as _nextHol, cdEmoji as _cdE } from '../js/holidays.js';
window.HQHol = window.HQHol || { HOLIDAYS: _HOL, nextHoliday: _nextHol, cdEmoji: _cdE };
// Home HQ editor — a phone-first editor for the kitchen dashboard (/api/data).
if (!window.structuredClone) window.structuredClone = x => JSON.parse(JSON.stringify(x));   // iOS < 15.4
import '../js/themes.js';
import '../js/trips.js';
// same theme as the dashboard: identical tokens (incl. Evening dark when it's active), plus the editor's older variable names
const themeEditor = l => { try {
  const root = document.documentElement, key = window.HQTheme.pick(l), th = window.HQTheme.apply(root, key, l.accent, l.boldHighlight), st = root.style;
  st.setProperty('--bg', th.paper); st.setProperty('--card', th.card); st.setProperty('--muted', th.mute); st.setProperty('--next', st.getPropertyValue('--accent'));
  localStorage.setItem('hq-ed-look', JSON.stringify({ palette: l.palette, accent: l.accent, theme: l.theme, boldHighlight: l.boldHighlight }));
} catch (e) {} };
setInterval(() => { try { themeEditor(JSON.parse(localStorage.getItem('hq-ed-look') || '{}')); } catch (e) {} }, 60000);   // auto Evening at night
try { themeEditor(JSON.parse(localStorage.getItem('hq-ed-look') || '{}')); } catch (e) {}
fetch('/api/look', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(l => { if (l) themeEditor(l); }).catch(() => {});
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const KEY = 'hq-passcode';
let pass = localStorage.getItem(KEY) || '';
let data = null, cals = null;
let tab = localStorage.getItem('hq-tab') || 'events';
// deep links (iPhone widget): /edit/#calendar, #meals, #shopping, #chores, #family, #more, #widget  (or ?tab=…)
const DEEP = { countdowns: 'countdowns', wishes: 'wishes', wish: 'wishes', dates: 'dates', birthdays: 'dates', recipes: 'recipes', cocktails: 'recipes', calendar: 'events', events: 'events', meals: 'meals', food: 'meals', shopping: 'groceries', groceries: 'groceries', chores: 'chores', family: 'people', people: 'people', more: 'more', widget: 'widget', look: 'look', routine: 'routine', care: 'care', usuals: 'usuals', stores: 'stores', calendars: 'calendars', photos: 'photos', preview: 'preview' };
function deepTab() { const k = (location.hash.slice(1) || new URLSearchParams(location.search).get('tab') || '').toLowerCase(); return DEEP[k] || null; }
// embedded in the dashboard's themed sheet (?embed=1&tab=…&open=<id>|add=1|scan=1)
const EMBED = new URLSearchParams(location.search).get('embed') === '1';
if (EMBED) document.documentElement.classList.add('embed');
const toParent = type => { if (EMBED && window.parent !== window) try { window.parent.postMessage({ type }, location.origin); } catch (e) {} };
let embedDone = false;
function embedOpen() {
  if (!EMBED || embedDone || !data) return; embedDone = true;
  const q = new URLSearchParams(location.search), id = q.get('open');
  const once = !!(id || q.get('add') || q.get('scan'));
  if (once) { ['#sheet', '#ai'].forEach(sel => $(sel).addEventListener('close', () => setTimeout(() => { if (!$('#sheet').open && !$('#ai').open) toParent('hq-edit-close'); }, 50))); }
  if (q.get('scan')) { $('#aiFab').click(); return; }
  if (q.get('add') && S[tab] && S[tab].blank) { const it = S[tab].blank();
    if (tab === 'chores' && q.get('r') && ROUTINES.some(r => r[0] === q.get('r'))) it.r = [q.get('r')];
    if (q.get('date') && 'date' in it) it.date = q.get('date');
    if (q.get('slot') && 'slot' in it) it.slot = q.get('slot');
    if (tab === 'chores' && q.get('date')) it.date = q.get('date');
    openSheet(it, true); return; }
  if (id && tab === 'chores' && q.get('act') === 'delete') {
    const c = (data.chores || []).find(x => x.id === id), day = q.get('date'); if (!c) { toast('Couldn’t find that chore'); return toParent('hq-edit-close'); }
    const done = async () => { await save('chores'); toParent('hq-edit-close'); };
    const nice = day ? new Date(day + 'T12:00').toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }) : '';
    if (c.date || !day) { if (!confirm('Delete “' + c.title + '”?')) return toParent('hq-edit-close'); data.chores = data.chores.filter(x => x.id !== id); done(); return; }
    aiSheet('Delete “' + c.title + '”', `<p class="hint" style="text-align:left">This chore repeats. Skip it just on ${esc(nice)}, or delete it for good?</p>
      <div class="cards" style="display:grid;gap:8px;background:none;box-shadow:none"><button type="button" class="btn big" data-cdel="skip">Skip just ${esc(nice)}</button><button type="button" class="btn danger big" data-cdel="all">Delete the whole chore</button></div>`);
    $('#aiBody').onclick = ev => { const b = ev.target.closest('[data-cdel]'); if (!b) return;
      if (b.dataset.cdel === 'skip') c.skip = [...new Set([...(c.skip || []), day])].sort(); else data.chores = data.chores.filter(x => x.id !== id);
      $('#ai').close(); done(); };
    return;
  }
  if (id && tab === 'meals' && q.get('act')) {
    const m = (data.meals || []).find(x => x.id === id); if (!m) { toast('Couldn’t find that meal'); return toParent('hq-edit-close'); }
    const act = q.get('act');
    if (act === 'shop') { const rc = m.recipe && (data.recipes || []).find(x => x.id === m.recipe); return ingredientsSheet([{ title: m.title, ingredients: rc ? rc.ingredients : lines(String(m.ingredients || '').replace(/,/g, '\n')) }], m.title || 'Ingredients'); }
    if (act === 'delete') { if (!confirm('Delete “' + (m.title || 'this meal') + '”?')) return toParent('hq-edit-close');
      data.meals = data.meals.filter(x => x.id !== id); save('meals').then(() => toParent('hq-edit-close')); return; }
    if (act === 'recipe') { const rs = (data.recipes || []).slice().sort((a, b) => (a.kind === 'cocktail') - (b.kind === 'cocktail') || a.title.localeCompare(b.title));
      aiSheet('Choose a recipe', rs.length ? `<div class="cards">${rs.map(r => `<button type="button" class="row rcp-pick" data-pick="${esc(r.id)}" style="width:100%;text-align:left"><div class="row-main"><div class="row-text"><div class="row-title">${r.kind === 'cocktail' ? '🍸 ' : ''}${esc(r.title)}${r.id === m.recipe ? ' ✓' : ''}</div><div class="row-sub">${(r.ingredients || []).length} ingredients</div></div></div></button>`).join('')}</div>${m.recipe ? '<button type="button" class="btn big" data-pick="" style="margin-top:12px;width:100%">Remove linked recipe</button>' : ''}`
        : '<p class="hint">No recipes yet — add some under Food › Recipes.</p>');
      $('#aiBody').onclick = async ev => { const b = ev.target.closest('[data-pick]'); if (!b) return; const r = (data.recipes || []).find(x => x.id === b.dataset.pick);
        const old = m.recipe && (data.recipes || []).find(x => x.id === m.recipe);
        if (r) Object.assign(m, { recipe: r.id, title: !m.title || (old && m.title === old.title) ? r.title : m.title, link: r.url || m.link, ingredients: (r.ingredients || []).join('\n') });
        else { delete m.recipe; }
        $('#ai').close(); await save('meals'); toast(r ? 'Recipe linked ✓' : 'Recipe removed'); toParent('hq-edit-close'); };
      return; }
  }
  if (id && S[tab] && S[tab].items) {
    let it = (S[tab].items() || []).find(x => x.id === id);
    if (!it && tab === 'chores') it = (S.chores.items() || []).find(x => String(x.id).split(/[@|:]/)[0] === id || x._base === id || x.base === id);
    if (!it && Array.isArray(data[tab])) it = data[tab].find(x => x.id === id);
    if (!it && tab === 'events') it = (data.events || []).concat(data.syncedEvents || []).find(x => x.id === id);
    if (!it && tab === 'groceries') { const g = data.groceries.find(x => x.id === id); if (g) { shopSel = window.HQTrip.key(g, data.trips); it = g; } }
    if (it) openSheet(structuredClone(it), false); else toast('Couldn’t find that item');
  }
}
if (deepTab()) { tab = deepTab(); try { localStorage.setItem('hq-tab', tab); } catch (e) {} }
window.addEventListener('hashchange', () => { const t = deepTab(); if (t && t !== tab) { tab = t; try { localStorage.setItem('hq-tab', tab); } catch (e) {} if (typeof render === 'function') render(); } });

const ROUTINES = [['anytime', 'Anytime'], ['morning', 'Morning'], ['after', 'After school'], ['evening', 'Evening']];
const CATS = ['Produce', 'Bakery', 'Meat & Fish', 'Dairy & Eggs', 'Pantry', 'Frozen', 'Snacks', 'Household'];
const DEFAULT_STORES = [{ id: 'mb', name: 'Grocery store' }, { id: 'bj', name: 'Warehouse club' }, { id: 'wf', name: 'Whole Foods (delivery)' }, { id: 'any', name: 'Anywhere' }, { id: 'other', name: 'Other' }];
const BUILTIN_STORES = DEFAULT_STORES.filter(x => x.id === 'wf' || x.id === 'any');
const DEF_STORE = 'any';
const STORE_MIGRATE = { grocer: 'mb', costco: 'bj' };   // old FreshCo/Costco ids
const storesList = () => { if (!(data && data.stores && data.stores.length)) return DEFAULT_STORES;
  const st = data.stores.slice(); BUILTIN_STORES.forEach(b => { if (!st.some(x => x.id === b.id)) st.push(b); }); return st; };
const STORES_OPTS = () => storesList().map(x => [x.id, x.name]);
const storeName = id => (storesList().find(x => x.id === (STORE_MIGRATE[id] || id)) || { name: '' }).name;
const EMOJI = ['✅', '🛏️', '🪥', '🎒', '📚', '🧺', '🍽️', '🗑️', '🐶', '🪴', '🧹', '🚿'];
const SWATCH = ['#2D5BFF', '#E4007C', '#00A36C', '#FFB000', '#7C3AED', '#EF4444', '#0EA5E9', '#111111'];
const pad = n => String(n).padStart(2, '0');
const dstr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const tstr = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const ymd = s => { const p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const person = id => data.people.find(p => p.id === id) || { name: id === 'any' ? 'Anyone' : 'Family', color: '#16161A' };
const fmtTime = d => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const ICON_PATH = { edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4', camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z', image: 'M4 5h16v14H4zM8 11a2 2 0 100-4 2 2 0 000 4zM20 16l-5-5-8 8',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6', paste: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12h6M9 16h4', chev: 'M9 6l6 6-6 6', sparkle: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z' };
const ico = (k, n = 22) => `<svg class="ic" width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${ICON_PATH[k]}"/></svg>`;
const ICO = { edit: ico('edit', 16) };
const progressHtml = (msg, i, n) => `<div class="reading"><div class="reading-bar"><i style="width:${n ? Math.round(100 * (i - 1 + .35) / n) : 35}%"></i></div><p>${msg}</p>
  <div class="skel"><span></span><span></span><span class="short"></span></div><div class="skel"><span></span><span class="short"></span></div><div class="skel"><span></span><span></span></div></div>`;
const TRASH = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
const CHECK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const ICON = { countdowns: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>', wishes: '<path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0"/>', dates: '<path d="M4 21h16M5 21v-7h14v7M5 17c2 1.5 4-1.5 7 0s5-1.5 7 0M12 14v-4M12 7c-1-1 0-2.5 0-3.5 1.4 1 1.2 2.6 0 3.5z"/>', recipes: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11"/>',
  food: '<path d="M4 3v8a3 3 0 0 0 6 0V3M7 3v18M17 21V3c-2 1-3.5 3.5-3.5 7s1.5 4 3.5 4"/>',
  meals: '<path d="M4 3v8a3 3 0 0 0 6 0V3M7 3v18M17 21V3c-2 1-3.5 3.5-3.5 7s1.5 4 3.5 4"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  look: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1.1.2-2.2 1.4-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15.5" cy="8" r="1.2"/>',
  widget: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="18" height="8" rx="2"/>',
  preview: '<rect x="2" y="5" width="20" height="13" rx="2"/><path d="M8 21h8M12 18v3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  photos: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/>',
  events: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  chores: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M7.5 12l3 3 6-6"/>',
  groceries: '<path d="M3 4h2.2l2.3 11h10.8L21 8H6.5"/><circle cx="10" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.6c2.6.2 4.4 1.9 5 5.4"/>',
  calendars: '<path d="M4 4v6h6"/><path d="M20 20v-6h-6"/><path d="M5.6 15a8 8 0 0 0 13.4 3L20 14M4 10l1-4a8 8 0 0 1 13.4 3"/>',
};
const svg = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;

function toast(t) { const el = $('#toast'); el.onclick = null; el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2200); }
function status(t) { $('#status').textContent = t || ''; }

async function api(method, path, body) {
  const r = await fetch('/api/' + path, { method, headers: { 'content-type': 'application/json', 'x-passcode': pass }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (r.status === 401) { lock('That passcode didn’t work.'); throw new Error('unauthorized'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
  return j;
}
async function save(section) {
  status('Saving…');
  try { data = await api('PUT', 'data/' + section, data[section]); render(); toParent('hq-saved'); status('Saved ✓'); setTimeout(() => status(''), 2000); }
  catch (e) { status(''); toast('Couldn’t save — ' + e.message); }
}

// ---------------------------------------------------------------- form helpers
const field = (label, inner) => `<label class="field"><span>${label}</span>${inner}</label>`;
const input = (n, label, v, extra = '') => field(label, `<input name="${n}" value="${esc(v)}" ${extra}>`);
const select = (n, label, v, opts) => field(label, `<select name="${n}">${opts.map(([k, t]) => `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`);
const toggle = (n, label, on) => `<label class="switch">${label}<input type="checkbox" name="${n}" ${on ? 'checked' : ''}></label>`;
const chips = (n, label, opts, chosen, multi) => `<div class="field"><span>${label}</span><div class="chips" data-chips="${n}" data-multi="${multi ? 1 : ''}">${opts.map(([k, t, c]) =>
  `<button type="button" class="chip ${chosen.includes(k) ? 'on' : ''}" data-v="${esc(k)}">${c ? `<i style="background:${esc(c)}"></i>` : ''}${esc(t)}</button>`).join('')}</div></div>`;
const chipVal = (f, n) => [...f.querySelectorAll(`[data-chips="${n}"] .chip.on`)].map(b => b.dataset.v);
const stepper = (n, label, v, min = 0, max = 99) => field(label, `<div class="stepper" data-min="${min}" data-max="${max}"><button type="button" data-step="-1" aria-label="Less">−</button><output name="${n}">${v ?? 0}</output><button type="button" data-step="1" aria-label="More">+</button></div>`);
const peopleOpts = (withAny) => [...data.people.map(p => [p.id, p.name, p.color]), ...(withAny ? [[withAny, withAny === 'any' ? 'Anyone' : 'Everyone', '#16161A']] : [])];

// ---------------------------------------------------------------- sections
const S = {
  events: {
    label: 'Calendar', noun: 'event', emoji: '📅', emptyText: 'Add birthdays, practices and appointments — or sync a calendar.',
    items: () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const manual = data.events.map(e => ({ ...e, _s: new Date(e.start), _e: new Date(e.end) }));
      const synced = (data.syncedEvents || []).map(e => ({ ...e, _s: e.allDay ? ymd(e.startDate) : new Date(e.start), _e: e.allDay ? ymd(e.endDate) : new Date(e.end) }));
      return [...manual, ...synced].filter(e => e._e > today || (e.repeat && (!e.repeat.until || ymd(e.repeat.until) >= today))).sort((a, b) => a._s - b._s || (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0)).slice(0, 300);
    },
    group: e => {
      const t = new Date(); t.setHours(0, 0, 0, 0); const d = new Date(e._s); d.setHours(0, 0, 0, 0);
      const diff = Math.round((d - t) / 864e5);
      if (diff <= 0) return 'Today';
      if (diff === 1) return 'Tomorrow';
      return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    },
    row: e => {
      const all = !e.people || !e.people.length || e.people.length >= data.people.length;
      const who = all ? 'Everyone' : e.people.map(id => person(id).name).join(', ');
      const RF = { daily: 'Every day', weekly: 'Every ' + ((e.repeat || {}).days || []).map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join('/'), monthly: 'Monthly', yearly: 'Yearly' };
      const when = (e.repeat ? '🔁 ' + RF[e.repeat.freq] + ' · ' : '') + (e.countdown ? '⏳ ' : '') + (e.allDay ? 'All day' : `${fmtTime(e._s)} – ${fmtTime(e._e)}`);
      return { lead: `<span class="dot" style="background:${esc(all ? '#16161A' : person(e.people[0]).color)}"></span>`,
        title: esc(e.title) + (e.readOnly ? `<span class="badge">${esc(e.cal || 'Synced')}</span>` : ''), sub: esc([when, who, e.loc].filter(Boolean).join(' · ')) };
    },
    blank: () => { const s = new Date(); s.setMinutes(0, 0, 0); s.setHours(s.getHours() + 1); return { id: uid('e'), title: '', people: [], start: s.toISOString(), end: new Date(+s + 36e5).toISOString() }; },
    fields: e => {
      const s = new Date(e.start), en = new Date(e.end), endDay = e.allDay ? new Date(+en - 864e5) : en;
      return `${input('title', 'What', e.title, 'required placeholder="e.g. Soccer game" autocomplete="off"')}
      ${toggle('allDay', 'All day', e.allDay)}
      <div class="two wrap-two">${field('Starts', `<input type="date" name="sd" value="${dstr(s)}" required>`)}${field('<span class="tm">Time</span>', `<input class="tm" type="time" name="st" value="${tstr(s)}">`)}</div>
      <div class="two wrap-two">${field('Ends', `<input type="date" name="ed" value="${dstr(endDay)}" required>`)}${field('<span class="tm">Time</span>', `<input class="tm" type="time" name="et" value="${tstr(en)}">`)}</div>
      ${chips('people', 'Who (none = everyone)', peopleOpts(), e.people || [], true)}
      <div class="conflict" hidden></div>
      ${input('loc', 'Where', e.loc, 'placeholder="Optional"')}
      ${field('Repeats', `<select name="freq">${[['', 'Never'], ['daily', 'Every day'], ['weekly', 'Every week'], ['monthly', 'Every month'], ['yearly', 'Every year']].map(([k, t]) => `<option value="${k}" ${((e.repeat || {}).freq || '') === k ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
      <div class="rep-more">
        ${chips('rdays', 'On', [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']].map(([v, t]) => [String(v), t]), ((e.repeat || {}).days || [s.getDay()]).map(String), true)}
        <div class="two wrap-two">${field('Until (optional)', `<input type="date" name="until" value="${esc((e.repeat || {}).until || '')}">`)}${field('Skip one date', `<input type="date" name="skipadd">`)}</div>
        ${(e.skip || []).length ? `<p class="hint" style="text-align:left">Skipped: ${e.skip.map(x => `<button type="button" class="chip small-chip" data-unskip="${esc(x)}">${esc(ymd(x).toLocaleDateString([], { month: 'short', day: 'numeric' }))} ✕</button>`).join(' ')}</p>` : ''}
        <input type="hidden" name="skip" value="${esc((e.skip || []).join(','))}">
      </div>
      ${toggle('countdown', 'Countdown on the Today screen (“Disney in 12 days”)', e.countdown)}
      ${field('Notes', `<textarea name="notes" rows="2" placeholder="Optional">${esc(e.notes)}</textarea>`)}`;
    },
    read: (f, e) => {
      const allDay = f.allDay.checked;
      let start = new Date(`${f.sd.value}T${allDay ? '00:00' : f.st.value || '09:00'}`);
      let end = new Date(`${f.ed.value || f.sd.value}T${allDay ? '00:00' : f.et.value || '10:00'}`);
      if (allDay) end = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
      if (end <= start) end = new Date(+start + (allDay ? 864e5 : 36e5));
      const freq = f.freq.value, skip = f.skip.value.split(',').filter(Boolean).concat(f.skipadd.value ? [f.skipadd.value] : []);
      const rdays = chipVal(f, 'rdays').map(Number);
      const out = { ...e, title: f.title.value.trim(), allDay: allDay || undefined, start: start.toISOString(), end: end.toISOString(),
        people: chipVal(f, 'people'), loc: f.loc.value.trim(), notes: f.notes.value.trim(), countdown: f.countdown.checked || undefined,
        repeat: freq ? clean({ freq, days: freq === 'weekly' ? (rdays.length ? rdays : [start.getDay()]) : undefined, until: f.until.value || undefined }) : undefined,
        skip: freq && skip.length ? [...new Set(skip)].sort() : undefined };
      delete out._s; delete out._e;
      return clean(out);
    },
    mount: f => {
      const sync = () => f.querySelectorAll('.tm').forEach(el => { el.closest('.field').style.opacity = f.allDay.checked ? .35 : 1; el.closest('.field').querySelector('input').disabled = f.allDay.checked; });
      f.allDay.addEventListener('change', sync); sync();
      // weekly days follow the event's date until the user picks days themselves
      let customDays = !!(current && current.item && current.item.repeat && current.item.repeat.days);
      const syncDays = () => { if (customDays || !f.sd.value) return; const wd = String(ymd(f.sd.value).getDay());
        f.querySelectorAll('[data-chips="rdays"] .chip').forEach(c => c.classList.toggle('on', c.dataset.v === wd)); };
      const rep = () => { f.querySelector('.rep-more').hidden = !f.freq.value; f.querySelector('[data-chips="rdays"]').closest('.field').hidden = f.freq.value !== 'weekly'; syncDays(); };
      f.freq.addEventListener('change', rep); f.sd.addEventListener('change', syncDays); rep();
      f.querySelector('[data-chips="rdays"]').addEventListener('click', () => { customDays = true; });
      f.addEventListener('click', ev => { const u = ev.target.closest('[data-unskip]'); if (u) { f.skip.value = f.skip.value.split(',').filter(x => x && x !== u.dataset.unskip).join(','); u.remove(); } });
      // conflict hint: someone already busy at that time
      const check = () => {
        const box = f.querySelector('.conflict'); if (!f.sd.value) return;
        const allDay = f.allDay.checked, s0 = new Date(`${f.sd.value}T${allDay ? '00:00' : f.st.value || '09:00'}`), e0 = new Date(`${f.ed.value || f.sd.value}T${allDay ? '23:59' : f.et.value || '10:00'}`);
        const who = chipVal(f, 'people'), ids = who.length ? who : data.people.map(p => p.id);
        const selfId = current && current.item && current.item.id;
        const cands = [];
        for (let d = new Date(s0.getFullYear(), s0.getMonth(), s0.getDate()); d <= e0; d.setDate(d.getDate() + 1)) cands.push(...occurOn(new Date(d), selfId, ids));
        const hits = cands.concat((data.syncedEvents || []).filter(x => !x.allDay)).filter(x => !x.allDay && x.id !== selfId && new Date(x.start) < e0 && new Date(x.end) > s0 && (!x.people || !x.people.length || x.people.some(id => ids.includes(id))));
        box.hidden = !hits.length || allDay;
        box.innerHTML = hits.slice(0, 3).map(x => `⚠️ <b>${esc((x.people && x.people.length ? x.people : ids).filter(id => ids.includes(id)).map(id => person(id).name).join(', ') || 'Someone')}</b> already has <b>${esc(x.title)}</b> ${fmtTime(new Date(x.start))}–${fmtTime(new Date(x.end))}`).join('<br>');
      };
      ['sd', 'st', 'ed', 'et', 'allDay'].forEach(n => f[n].addEventListener('change', check)); f.addEventListener('click', ev => { if (ev.target.closest('.chip')) setTimeout(check, 0); }); check();
      f.sd.addEventListener('change', () => { if (f.ed.value < f.sd.value) f.ed.value = f.sd.value; });
      f.st.addEventListener('change', () => { if (f.sd.value === f.ed.value && f.et.value <= f.st.value) { const [h, m] = f.st.value.split(':'); f.et.value = `${pad(Math.min(23, +h + 1))}:${m}`; } });
    },
  },
  chores: {
    label: 'Chores', noun: 'chore', emoji: '🧹', sortable: true, tick: 'done', emptyText: 'Add jobs like “Empty the trash” or “Feed the dog” and tick them off here or on the screen.',
    // One row per time slot; ticking is per slot and per day (doneSlots[slot] = 'YYYY-MM-DD').
    // Several people → one row per person per slot, each with its own tick (doneSlots['slot|person']).
    items: () => data.chores.flatMap(c => times(c).flatMap(slot => whos(c).map(pid => ({ ...c, id: c.id + '@' + slot + (whos(c).length > 1 ? '@' + pid : ''), _base: c.id, _slot: slot, _pid: pid, done: slotDone(c, slot, pid) })))),
    group: c => (ROUTINES.find(r => r[0] === c._slot) || [, 'Other'])[1],
    groupOrder: ROUTINES.map(r => r[1]),
    row: c => ({ title: `${esc(c.emoji || '')} ${esc(c.title)}`, sub: esc([person(c._pid || 'any').name + (whos(c).length > 1 ? ' (each)' : ''), c.stars ? '★'.repeat(Math.min(c.stars, 5)) : '', times(c).length > 1 ? times(c).map(t => (ROUTINES.find(r => r[0] === t) || [, t])[1]).join(' + ') : ''].filter(Boolean).join(' · ')) }),
    blank: () => ({ id: uid('c'), r: ['after'], who: 'any', title: '', emoji: '✅', stars: 1 }),
    fields: c => `${input('title', 'Chore', c.title, 'required placeholder="e.g. Empty the trash" autocomplete="off"')}
      <div class="field"><span>Icon</span><div style="display:flex;gap:10px;align-items:center"><input name="emoji" value="${esc(c.emoji)}" style="width:64px;font-size:26px;text-align:center" maxlength="4"><div class="emojis">${EMOJI.map(x => `<button type="button" data-emoji="${x}">${x}</button>`).join('')}</div></div></div>
      ${chips('who', 'Who — tap to pick one or more (none = anyone)', peopleOpts(), whos(c).filter(x => x !== 'any'), true)}
      <p class="hint" style="text-align:left;margin:-6px 4px 12px">Each person picked gets their own copy to tick off and earns their own stars.</p>
      ${chips('r', 'When — pick one or more', ROUTINES, times(c), true)}
      ${stepper('stars', 'Stars earned', c.stars, 0, 5)}
      ${select('rep', 'Which days', c.date ? 'once' : (c.days && c.days.length ? 'days' : 'daily'), [['daily', 'Every day'], ['days', 'Certain days of the week'], ['once', 'Just once']])}
      <div class="ch-days" ${c.days && c.days.length && !c.date ? '' : 'hidden'}>${chips('cdays', 'Days', [['1', 'Mon'], ['2', 'Tue'], ['3', 'Wed'], ['4', 'Thu'], ['5', 'Fri'], ['6', 'Sat'], ['0', 'Sun']], (c.days || []).map(String), true)}</div>
      <div class="ch-once" ${c.date ? '' : 'hidden'}>${field('Date', `<input type="date" name="cdate" value="${esc(c.date || '')}">`)}</div>
      ${(c.skip || []).length ? `<p class="hint" style="text-align:left">Skipped: ${c.skip.map(d => `<button type="button" class="chip" data-unskipc="${d}">${esc(new Date(d + 'T12:00').toLocaleDateString([], { month: 'short', day: 'numeric' }))} ✕</button>`).join(' ')}</p><input type="hidden" name="cskip" value="${esc(c.skip.join(','))}">` : '<input type="hidden" name="cskip" value="">'}`,
    mountDays: f => { const sync = () => { f.querySelector('.ch-days').hidden = f.rep.value !== 'days'; f.querySelector('.ch-once').hidden = f.rep.value !== 'once'; if (f.rep.value === 'once' && !f.cdate.value) f.cdate.value = today(); };
      f.rep.addEventListener('change', sync);
      f.addEventListener('click', ev => { const u = ev.target.closest('[data-unskipc]'); if (u) { f.cskip.value = f.cskip.value.split(',').filter(x => x && x !== u.dataset.unskipc).join(','); u.remove(); } }); },
    read: (f, c) => {
      const r = ROUTINES.map(x => x[0]).filter(k => chipVal(f, 'r').includes(k));
      const ids = data.people.map(p => p.id).filter(id => chipVal(f, 'who').includes(id));
      const who = ids.length > 1 ? ids : ids[0] || 'any';
      const multiBefore = whos(c).length > 1, multiNow = ids.length > 1;
      const doneSlots = {}; Object.entries(c.doneSlots || {}).forEach(([k, v]) => { const [sl, pid] = k.split('|');
        if (!r.includes(sl) || multiBefore !== multiNow) return; if (pid && !ids.includes(pid)) return; doneSlots[k] = v; });
      const rep = f.rep.value, days = rep === 'days' ? chipVal(f, 'cdays').map(Number) : undefined, skip = f.cskip.value.split(',').filter(Boolean);
      return clean({ id: c.id, title: f.title.value.trim(), emoji: f.emoji.value.trim(), stars: +f.stars.value || 0, r, who, doneSlots: Object.keys(doneSlots).length ? doneSlots : undefined, doneBy: c.doneBy,
        days: days && days.length ? days : undefined, date: rep === 'once' ? (f.cdate.value || today()) : undefined, skip: skip.length ? skip : undefined });
    },
    validate: f => chipVal(f, 'r').length > 0 || 'Pick at least one time of day',
    mount: f => { f.querySelectorAll('[data-emoji]').forEach(b => b.onclick = () => { f.emoji.value = b.dataset.emoji; }); S.chores.mountDays(f); },
  },
  groceries: {
    label: 'Shopping', noun: 'item', emoji: '🛒', sortable: true, tick: 'done', emptyText: 'Add what you need and tick items off in the store.',
    items: () => data.groceries.filter(g => window.HQTrip.key(g, data.trips) === curTrip()),
    group: g => g.done ? 'In the cart ✓' : g.cat || 'Other',
    groupOrder: [...CATS, 'Other', 'In the cart ✓'],
    row: g => ({ title: esc(g.name) + (g.qty > 1 ? ` <span style="color:var(--muted)">×${g.qty}</span>` : ''), sub: esc([storeName(g.store), g.note].filter(Boolean).join(' · ')) }),
    trash: true,
    blank: () => ({ id: uid('g'), name: '', cat: 'Produce', qty: 1, store: DEF_STORE, done: false, note: '', trip: curTrip() === 'any' ? undefined : curTrip() }),
    fields: g => `${input('name', 'Item', g.name, 'required placeholder="e.g. Milk" autocomplete="off"')}
      ${stepper('qty', 'How many', g.qty || 1, 1, 99)}
      ${select('cat', 'Aisle', g.cat, CATS.map(c => [c, c]))}
      ${chips('store', 'Store', STORES_OPTS(), [STORE_MIGRATE[g.store] || g.store], false)}
      ${input('note', 'Note', g.note, 'placeholder="Optional, e.g. 2 litres"')}
      ${toggle('done', 'In the cart', g.done)}`,
    read: (f, g) => clean({ id: g.id, trip: g.trip, name: f.name.value.trim(), qty: Math.max(1, +f.qty.value || 1), store: chipVal(f, 'store')[0] || DEF_STORE, cat: f.cat.value, note: f.note.value.trim(), done: f.done.checked }),
  },
  people: {
    label: 'Family', noun: 'person', emoji: '👨‍👩‍👧‍👦', sortable: true, emptyText: 'Add the people in your home.',
    items: () => data.people,
    row: p => ({ lead: `<span class="avatar" style="background:${esc(p.color)};color:${esc(p.ink || '#fff')}">${esc((p.name || '?')[0])}</span>`,
      title: esc(p.name), sub: esc([p.role === 'parent' ? 'Parent' : 'Child', (p.routine || []).length ? `${p.routine.length} routine block${p.routine.length > 1 ? 's' : ''}` : 'No routine yet', `★ ${data.stars?.[p.id] ?? 0}`].filter(Boolean).join(' · ')) }),
    blank: () => ({ id: uid('p'), name: '', color: SWATCH[data.people.length % SWATCH.length], home: true, status: 'Home' }),
    fields: p => `${input('name', 'Name', p.name, 'required autocomplete="off"')}
      ${chips('role', 'Role', [['parent', '🧑 Parent'], ['child', '🧒 Child']], [p.role || 'child'], false)}
      ${field('Birthday (optional — adds a yearly event + countdown)', `<input type="date" name="birthday" value="${esc(p.birthday || '')}">`)}
      ${toggle('school', 'Attends school (shows School lunch)', p.school === true || (p.school !== false && (p.routine || []).some(b => b.type === 'school')))}
      ${stepper('stars', 'Star count', data.stars?.[p.id] ?? 0, 0, 9999)}
      ${chips('color', 'Colour', SWATCH.map(c => [c, ' ', c]), [p.color], false)}`,
    read: (f, p) => {
      const c = chipVal(f, 'color')[0] || p.color, rgb = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
      const light = rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 > 170;
      data.stars = { ...(data.stars || {}), [p.id]: +f.stars.value || 0 };
      return clean({ ...p, name: f.name.value.trim(), role: chipVal(f, 'role')[0] || p.role || 'child', school: f.school.checked, birthday: f.birthday && f.birthday.value || undefined, home: p.home ?? true, status: p.status || 'Home', color: c, rgb: rgb.join(' '), ink: light ? '#111111' : '#FFFFFF' });
    },
    after: () => save('stars'),
  },
  calendars: {
    label: 'Sync', title: 'Calendars', noun: 'calendar', emoji: '🔄', emptyText: 'Link a Google, iCloud or Outlook calendar and its events will show on the screen automatically.',
    items: () => cals?.calendars || [],
    row: c => {
      const st = cals?.status?.[c.id];
      const badge = !st ? '' : st.ok ? `<span class="badge ok">${st.count} events</span>` : '<span class="badge err">Problem</span>';
      const w = calWho(c);
      return { lead: w.length ? `<span class="dots">${w.map(id => `<span class="dot" style="background:${esc(person(id).color)}"></span>`).join('')}</span>` : '<span class="dot" style="background:#16161A"></span>',
        title: esc(c.name) + badge, sub: esc([w.length ? w.map(id => person(id).name).join(', ') : 'Everyone', st && !st.ok ? st.error : st ? 'Synced ' + new Date(st.fetched).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Not synced yet'].join(' · ')) };
    },
    blank: () => ({ id: uid('k'), name: '', url: '', who: 'family' }),
    fields: c => `${input('name', 'Name', c.name, 'required placeholder="e.g. Sam’s work" autocomplete="off"')}
      ${field('Secret iCal link', `<textarea name="url" rows="3" required placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" autocapitalize="off" autocorrect="off" spellcheck="false">${esc(c.url)}</textarea>`)}
      ${chips('who', 'Whose calendar (pick one or more · none = everyone)', peopleOpts(), calWho(c), true)}
      <p class="hint">The link is kept private — only people with the passcode can see it. Events refresh every 15 minutes and can’t be edited here.</p>`,
    read: (f, c) => { const w = chipVal(f, 'who'); return { ...c, id: c.id, name: f.name.value.trim(), url: f.url.value.trim(), who: w.length === 1 ? w[0] : 'family', whos: w }; },
    validate: f => /^(https?|webcal):\/\//i.test(f.url.value.trim()) || 'Paste a link that starts with https:// or webcal://',
  },
};
// synced calendar people: new whos[] (multi), falling back to the older single who
function calWho(c) { return Array.isArray(c.whos) && c.whos.length ? c.whos : c.who && c.who !== 'family' ? [c.who] : []; }
S.photos = {
  label: 'Photos', title: 'Photos', noun: 'photo', emoji: '🖼️',
  items: () => photos?.photos || [],
  fields: p => `<img class="sheet-photo" src="/api/photo/${esc(p.id)}?v=full" alt="">
    ${toggle('show', 'Show in screensaver', p.show !== false)}
    <p class="hint">Added ${esc(new Date(p.added).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }))}</p>`,
  read: (f, p) => ({ ...p, show: f.show.checked }),
};
// ---------------------------------------------------------------- meals (part of the Food tab)
const MEALS = [['dinner', 'Dinner', '🍝'], ['breakfast', 'Breakfast', '🥣'], ['brunch', 'Brunch', '🥞'], ['lunch', 'Lunch', '🥪'], ['snack', 'Snack / note', '🍎'], ['school', 'School lunch menu', '🏫']];
const EXTRA_ORDER = ['breakfast', 'brunch', 'lunch', 'snack'];
S.meals = {
  label: 'Meals', title: 'Food', noun: 'meal', emoji: '🍽️',
  items: () => data.meals || [],
  blank: () => ({ id: uid('m'), date: mealDay || today(), slot: 'dinner', title: '' }),
  fields: m => `${input('title', 'What’s cooking', m.title, 'required placeholder="e.g. Tacos" autocomplete="off"')}
    ${field('Day', `<input type="date" name="date" value="${esc(m.date)}" required>`)}
    ${chips('slot', 'Meal', MEALS.map(x => [x[0], x[2] + ' ' + x[1]]), [m.slot], false)}
    ${chips('for', 'For — none = everyone', peopleOpts(), m.for || [], true)}
    ${chips('cook', 'Who’s cooking (optional)', peopleOpts(), m.cook ? [m.cook] : [], false)}
    ${field('Ingredients — one per line', `<textarea name="ingredients" rows="4" placeholder="Tortillas&#10;Ground beef&#10;Cheese">${esc(m.ingredients || '')}</textarea>`)}
    ${input('link', 'Recipe link', m.link, 'type="url" inputmode="url" placeholder="https://…" autocomplete="off"')}
    ${field('Notes', `<textarea name="notes" rows="2">${esc(m.notes || '')}</textarea>`)}
    <button type="button" class="btn big" data-meal-shop style="margin-top:6px">🛒 Add ingredients to shopping</button>`,
  read: (f, m) => clean({ id: m.id, title: f.title.value.trim(), date: f.date.value || m.date, slot: chipVal(f, 'slot')[0] || 'dinner',
    for: chipVal(f, 'for').length ? chipVal(f, 'for') : undefined, cook: chipVal(f, 'cook')[0], ingredients: f.ingredients.value.trim(), link: f.link.value.trim(), notes: f.notes.value.trim(), recipe: m.recipe }),
  validate: f => !!f.date.value || 'Pick a day',
  mount: f => { const b = f.querySelector('[data-meal-shop]'); if (b) b.onclick = () => { const rc = current && current.item.recipe && (data.recipes || []).find(x => x.id === current.item.recipe);
    return ingredientsSheet([{ title: f.title.value, ingredients: rc ? rc.ingredients : lines(f.ingredients.value.replace(/,/g, '\n')) }], f.title.value || 'Ingredients'); };
  },
};
let mealWeek = null, mealDay = null;
function weekStart(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addIngredients(meals) {
  const have = new Set(data.groceries.filter(g => !g.done).map(g => (g.name || '').toLowerCase()));
  let n = 0;
  meals.forEach(m => String(m.ingredients || '').split(/\n|,/).map(x => x.trim()).filter(Boolean).forEach(name => {
    if (have.has(name.toLowerCase())) return; have.add(name.toLowerCase());
    data.groceries.push({ id: uid('g'), name: name.slice(0, 80), cat: 'Pantry', qty: 1, store: 'grocer', done: false }); n++;
  }));
  if (n) save('groceries');
  return n;
}
// Children who go to school: role Child and either the 'Attends school' switch or a School block in their routine.
const schoolKids = () => (data.people || []).filter(p => p.role !== 'parent' && (p.school === true || (p.school !== false && (p.routine || []).some(b => b.type === 'school'))));
const lunchOf = (ds, pid) => ((data.lunch || []).find(x => x.id === ds + ':' + pid) || {}).choice || 'school';
function setLunch(ds, pid, choice) {
  data.lunch = (data.lunch || []).filter(x => x.id !== ds + ':' + pid && x.date >= dstr(addDays(new Date(), -14)));
  data.lunch.push({ id: ds + ':' + pid, date: ds, pid, choice });
  save('lunch');
}
// Always-visible School lunch block (weekdays): menu item + big School/Home toggle per school kid.
// Weekly repeating school menus (data.menus): { id, meal: 'breakfast'|'lunch', school, days: {1..5: text}, always, year, kids: [ids] }
const WDN = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
function menuInYear(m, d) {
  const y = +String(m.year || '').slice(0, 4); if (!y) return true;
  let a = new Date(y, 7, 1), b = new Date(y + 1, 6, 1); const A = a, B = b;
  (data.events || []).forEach(e => { const s = new Date(e.start); if (s < A || s >= B || !e.school) return; const day = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    if (e.school === 'first' && (a === A || day < a)) a = day;
    if (/last day of school/i.test(e.title || '') && !/snow/i.test(e.title || '')) { const n = new Date(day.getTime() + 864e5); if (b === B || n < b) b = n; } });
  return d >= a && d < b;
}
function weeklyFor(pid, d, meal) {
  const w = d.getDay(); if (w < 1 || w > 5 || schoolDay(dstr(d), pid).off) return null;
  const p = person(pid);
  return (data.menus || []).find(m => m.meal === meal && m.days && m.days[w] && menuInYear(m, d) && ((m.kids || []).includes(pid) || (p.schoolName && p.schoolName === m.school))) || null;
}
const kidSchool = p => p.schoolName || '';
function lunchSection(days, item) {
  const kids = schoolKids(), tday = today();
  const children = (data.people || []).filter(p => p.role !== 'parent'), on = new Set(kids.map(p => p.id));
  const whoRow = `<div class="chips lunch-who"><span class="hint">Goes to school:</span>${children.map(p => `<button type="button" class="chip ${on.has(p.id) ? 'on' : ''}" data-school-kid="${p.id}">${on.has(p.id) ? '✓ ' : ''}${esc(p.name)}</button>`).join('')}</div>`;
  if (!kids.length) {
    return `<section class="school-card"><header><h3>School</h3></header><p class="muted"><b>Which kids go to school?</b> Tap to mark them — then you’ll see their school breakfast, lunch menu and a School / Home lunch switch for each school day.</p>
      ${children.length ? whoRow : '<p class="hint">Add children in Family first.</p>'}</section>`;
  }
  // weekend + viewing this week → show the upcoming school week instead of the one just past
  const now = new Date(), wkend = now.getDay() === 0 || now.getDay() === 6;
  if (wkend && dstr(days[0]) <= dstr(now) && dstr(now) <= dstr(days[6])) { const mon = addDays(now, now.getDay() === 6 ? 2 : 1); days = [0, 1, 2, 3, 4].map(i => addDays(mon, i)); }
  const wk = days.filter(d => d.getDay() >= 1 && d.getDay() <= 5);
  const schools = [...new Set((data.menus || []).map(m => m.school).filter(Boolean))];
  const schoolRow = `<div class="kid-schools">${kids.map(p => `<button type="button" class="kid-school" data-kid-school="${p.id}"><i style="background:${esc(p.color)}"></i>${esc(p.name)} <span>${esc(kidSchool(p) || 'Set school')}</span>${ICO.edit}</button>`).join('')}</div>`;
  const menus = (data.menus || []);
  const menuList = menus.length ? `<div class="menu-list">${menus.map(m => `<div class="menu-tpl"><div><b>${m.meal === 'lunch' ? 'Lunch' : 'Breakfast'} menu · ${esc(m.school || 'School')}</b><small>Repeats every school week${m.year ? ' · ' + esc(m.year) : ''} · for ${esc((m.kids || []).map(id => person(id).name).join(', ') || 'kids at ' + m.school)}</small>
      <details><summary>Show week</summary>${[1, 2, 3, 4, 5].map(w => `<p><em>${WDN[w]}</em> ${esc(m.days[w] || '—')}</p>`).join('')}${m.always ? `<p><em>Always</em> ${esc(m.always)}</p>` : ''}</details></div>
      <button type="button" class="trash" data-del-menu="${esc(m.id)}" aria-label="Remove menu">${TRASH}</button></div>`).join('')}</div>` : '';
  const dayRow = d => {
    const ds = dstr(d), menu = data.meals.filter(m => m.date === ds && m.slot === 'school'), off = schoolDay(ds, kids[0].id).off;
    const bk = {}; kids.forEach(p => { const m = weeklyFor(p.id, d, 'breakfast'); if (m) (bk[m.id] = bk[m.id] || { m, who: [] }).who.push(p.name); });
    const wl = !menu.length && weeklyFor(kids[0].id, d, 'lunch');
    return `<div class="lunch-day ${ds === tday ? 'is-today' : ''}"><div class="lunch-dh"><span class="date-pill"><b>${d.toLocaleDateString([], { weekday: 'short' })}</b>${d.getDate()}</span>
      <div class="lunch-menu">${off ? `<p class="muted" style="margin:0">${esc(off.title)}${/no school/i.test(off.title) ? '' : ' — no school'}</p>` : `
        ${Object.values(bk).map(x => `<div class="mrow"><em>Breakfast</em><span>${esc(x.m.days[d.getDay()])}${Object.keys(bk).length > 1 ? ` <small>(${esc(x.who.join(', '))})</small>` : ''}</span></div>`).join('')}
        <div class="mrow"><em>Lunch</em><span>${menu.length ? menu.map(item).join('') : wl ? esc(wl.days[d.getDay()]) : `<button type="button" class="meal-item empty" data-meal-new="${ds}|school">+ Menu</button>`}</span></div>`}</div></div>
      ${off ? '' : `<div class="lunch-kids">${kids.filter(p => !schoolDay(ds, p.id).off).map(p => { const c = lunchOf(ds, p.id); return `<button type="button" class="lunch-kid big ${c}" data-lunch="${ds}|${p.id}" style="--c:${esc(p.color)}"><i></i>${esc(p.name)}<em>${c === 'home' ? 'Home lunch' : 'School lunch'}</em></button>`; }).join('')}</div>`}</div>`;
  };
  return `<section class="school-card"><header><h3>School</h3><span class="muted">${esc(fmtRange(wk))}</span></header>
    ${whoRow}${schoolRow}${calLinkRow(kids)}
    ${wk.map(dayRow).join('')}
    ${menuList ? `<div class="group"><span>Repeating menus</span></div>${menuList}` : ''}</section>`;
}
function calLinkRow(kids) {
  const names = [...new Set(kids.map(kidSchool).filter(Boolean))], links = data.schools || [];
  const mine = links.filter(x => !names.length || !x.name || names.includes(x.name));
  return `<div class="cal-links">${mine.map(x => `<div class="cal-link">${ico('file', 18)}<div><b>${esc(x.name || 'School')} calendar</b><small>${esc(x.url.replace(/^https?:\/\//, '').slice(0, 42))}…${x.checked ? ' · checked ' + new Date(x.checked).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}</small></div>
      <button type="button" class="btn small-btn" data-cal-check="${esc(x.url)}" data-school="${esc(x.name || '')}">Check for updates</button><button type="button" class="trash" data-cal-del="${esc(x.url)}" aria-label="Remove link">${TRASH}</button></div>`).join('')}
    <button type="button" class="link" data-cal-add>${mine.length ? '+ Another calendar link' : '+ Add school calendar link (Google Doc, Sheet, web page, PDF or .ics)'}</button></div>`;
}
// Everything that happens on one date for the clash check: one-off events, repeating events expanded, and weekly routines
function occurOn(day, selfId, ids) {
  const k = dstr(day), out = [];
  (data.events || []).forEach(e => {
    if (e.id === selfId) return;
    const s0 = new Date(e.start), e0 = new Date(e.end), r = e.repeat;
    if (!r || !r.freq) { out.push(e); return; }
    const first = new Date(s0.getFullYear(), s0.getMonth(), s0.getDate()); if (day < first || (r.until && k > r.until) || (e.skip || []).includes(k)) return;
    const diff = Math.round((day - first) / 864e5), every = Math.max(1, +r.every || 1);
    const ok = r.freq === 'daily' ? diff % every === 0 : r.freq === 'weekly' ? (r.days && r.days.length ? r.days : [s0.getDay()]).includes(day.getDay()) && Math.floor((diff + first.getDay()) / 7) % every === 0
      : r.freq === 'monthly' ? day.getDate() === s0.getDate() : r.freq === 'yearly' ? day.getDate() === s0.getDate() && day.getMonth() === s0.getMonth() : false;
    if (!ok) return;
    const st = new Date(day.getFullYear(), day.getMonth(), day.getDate(), s0.getHours(), s0.getMinutes());
    out.push({ ...e, start: st.toISOString(), end: new Date(+st + (e0 - s0)).toISOString() });
  });
  (data.people || []).filter(p => ids.includes(p.id)).forEach(p => (p.routine || []).forEach(b => {
    if (!b.end || !b.start || ['bed', 'wake'].includes(b.type) || !(b.days || []).includes(day.getDay()) || (b.skip || []).includes(k) || (b.type === 'school' && schoolDay(k, p.id).off)) return;
    if (['work', 'school', 'daycare', 'commute', 'activity'].includes(b.type) && (p.dayoff || []).some(x => x.from <= k && k <= x.to)) return;
    const ov = b.over && b.over[k], [h1, m1] = (ov ? ov.start : b.start).split(':'), [h2, m2] = (ov && ov.end ? ov.end : b.end).split(':');
    out.push({ id: 'rt:' + b.id, title: (b.label || b.type) + ' (routine)', people: [p.id], start: new Date(day.getFullYear(), day.getMonth(), day.getDate(), +h1, +m1).toISOString(), end: new Date(day.getFullYear(), day.getMonth(), day.getDate(), +h2, +m2).toISOString() });
  }));
  return out;
}
const toMin = hm => { const [h, m] = hm.split(':'); return +h * 60 + +m; };
const fromMin = n => { n = Math.max(0, Math.min(1439, n)); return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); };
const fmtRange = wk => wk.length ? `${wk[0].toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${wk[wk.length - 1].toLocaleDateString([], { month: 'short', day: 'numeric' })}` : '';
function renderMeals(seg) {
  data.meals = data.meals || [];
  if (!mealWeek) mealWeek = weekStart(new Date());
  const days = [...Array(7)].map((_, i) => addDays(mealWeek, i)), end = days[6];
  const fmt = d => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const tday = today(), kidsAtSchool = schoolKids();
  const item = m => `<button type="button" class="meal-item" data-meal="${m.id}"><b>${esc(m.title)}</b>${m.for || m.cook ? `<small>${esc([m.for ? m.for.map(id => person(id).name).join(', ') : '', m.cook ? 'cook: ' + person(m.cook).name : ''].filter(Boolean).join(' · '))}</small>` : ''}</button>`;
  const html = days.map(d => {
    const ds = dstr(d), list = data.meals.filter(m => m.date === ds), wk = d.getDay() >= 1 && d.getDay() <= 5;
    const dinner = list.filter(m => m.slot === 'dinner' || !m.slot);
    const extras = list.filter(m => EXTRA_ORDER.includes(m.slot)).sort((a, b) => EXTRA_ORDER.indexOf(a.slot) - EXTRA_ORDER.indexOf(b.slot));
    const menu = list.filter(m => m.slot === 'school');
    const row = (lbl, body) => `<div class="meal-slot"><span class="meal-lbl">${lbl}</span><div class="meal-list">${body}</div></div>`;
    const school = false ? row('🏫 School lunch', `${menu.length ? menu.map(item).join('') : `<button type="button" class="meal-item empty" data-meal-new="${ds}|school">+ Add menu item</button>`}
      <div class="lunch-kids">${kidsAtSchool.map(p => { const c = lunchOf(ds, p.id); return `<button type="button" class="lunch-kid ${c}" data-lunch="${ds}|${p.id}" style="--c:${esc(p.color)}"><i></i>${esc(p.name)}: ${c === 'home' ? '🏠 Home' : '🏫 School'}</button>`; }).join('')}</div>`) : '';
    return `<div class="meal-day ${ds === tday ? 'is-today' : ''}"><div class="meal-head"><b>${d.toLocaleDateString([], { weekday: 'long' })}</b><span>${fmt(d)}${ds === tday ? ' · Today' : ''}</span>
      <button type="button" class="link" data-meal-new="${ds}|extra">+ Add meal</button></div>
      ${row('🍝 Dinner', dinner.length ? dinner.map(item).join('') : `<button type="button" class="meal-item empty" data-meal-new="${ds}|dinner">+ Add dinner</button>`)}
      ${extras.map(m => row((MEALS.find(x => x[0] === m.slot) || [, 'Meal', '🍽️'])[2] + ' ' + (MEALS.find(x => x[0] === m.slot) || [, 'Meal'])[1], item(m))).join('')}
      ${school}</div>`;
  }).join('');
  const thisWeek = data.meals.filter(m => m.date >= dstr(mealWeek) && m.date <= dstr(end));
  $('#list').innerHTML = seg + `<div class="week-nav"><button type="button" class="btn" data-week="-1" aria-label="Previous week">‹</button>
    <div><b>${fmt(mealWeek)} – ${fmt(end)}</b><button type="button" class="link" data-week="0">This week</button></div>
    <button type="button" class="btn" data-week="1" aria-label="Next week">›</button></div>
    <button type="button" class="btn big rcp-link" data-tab-go="recipes">📖 Recipes &amp; cocktails</button>
    ${scanHint()}
    ${lunchSection(days, item)}
    <div class="group"><span>🍝 Dinners</span></div>
    <div id="mealDays">${html}</div>
    <div class="meal-actions"><button type="button" class="btn big" id="copyWeek">📋 Copy last week’s meals</button>
    <button type="button" class="btn big" id="shopRecipes" ${thisWeek.some(m => m.ingredients || m.recipe) ? '' : 'disabled'}>🛒 This week’s groceries from recipes</button>
    <button type="button" class="btn big" data-tab-go="recipes">📖 Recipes &amp; cocktails</button></div>`;
}
$('#list').addEventListener('click', ev => {
  if (tab !== 'meals') return;
  let t;
  if ((t = ev.target.closest('[data-week]'))) { const d = +t.dataset.week; mealWeek = d ? addDays(mealWeek, 7 * d) : weekStart(new Date()); render(); return; }
  if ((t = ev.target.closest('[data-meal]'))) { const m = data.meals.find(x => x.id === t.dataset.meal); if (m) openSheet(structuredClone(m), false); return; }
  if ((t = ev.target.closest('[data-cal-add]'))) { const u = prompt('Paste the school calendar link (Google Doc, Google Sheet, web page, PDF or .ics):'); if (!u || !u.trim()) return;
    const sch = schoolKids().map(kidSchool).find(Boolean) || ''; return scanYearLink(u.trim(), sch); }
  if ((t = ev.target.closest('[data-cal-check]'))) return scanYearLink(t.dataset.calCheck, t.dataset.school);
  if ((t = ev.target.closest('[data-cal-del]'))) { if (!confirm('Remove this calendar link? (Events already added stay.)')) return; data.schools = (data.schools || []).filter(x => x.url !== t.dataset.calDel); save('schools'); render(); return; }
  if ((t = ev.target.closest('[data-kid-school]'))) { const p = data.people.find(x => x.id === t.dataset.kidSchool); if (!p) return;
    const known = [...new Set((data.menus || []).map(m => m.school).filter(Boolean))];
    const v = prompt(`Which school does ${p.name} go to?` + (known.length ? `\n(e.g. ${known.join(', ')})` : ''), p.schoolName || ''); if (v === null) return;
    p.schoolName = v.trim() || undefined; if (!p.schoolName) delete p.schoolName; save('people'); render(); return; }
  if ((t = ev.target.closest('[data-del-menu]'))) { const m = (data.menus || []).find(x => x.id === t.dataset.delMenu); if (!m || !confirm(`Remove the ${m.meal} menu for ${m.school || 'school'}?`)) return;
    data.menus = data.menus.filter(x => x !== m); save('menus'); render(); toast('Menu removed'); return; }
  if ((t = ev.target.closest('[data-school-kid]'))) { const p = data.people.find(x => x.id === t.dataset.schoolKid); if (p) { const was = schoolKids().some(k => k.id === p.id); p.school = !was; save('people'); render(); toast(p.name + (was ? ' doesn’t go to school' : ' goes to school ✓')); } return; }
  if ((t = ev.target.closest('[data-lunch]'))) { const [d, pid] = t.dataset.lunch.split('|'); setLunch(d, pid, lunchOf(d, pid) === 'home' ? 'school' : 'home'); render(); return; }
  if ((t = ev.target.closest('[data-meal-new]'))) { const [d, slot] = t.dataset.mealNew.split('|'); mealDay = d;
    const taken = data.meals.filter(m => m.date === d).map(m => m.slot);
    const pick = slot === 'extra' ? (taken.includes('dinner') ? (new Date(d + 'T12:00').getDay() % 6 === 0 ? 'brunch' : 'breakfast') : 'dinner') : slot;
    openSheet({ ...S.meals.blank(), date: d, slot: pick }, true); return; }
  if (ev.target.closest('#copyWeek')) {
    const from = dstr(addDays(mealWeek, -7)), to = dstr(addDays(mealWeek, -1));
    const src = data.meals.filter(m => m.date >= from && m.date <= to);
    if (!src.length) return toast('Nothing planned last week');
    const exists = new Set(data.meals.map(m => m.date + m.slot + m.title));
    let n = 0;
    src.forEach(m => { const d = dstr(addDays(ymd(m.date), 7)); if (exists.has(d + m.slot + m.title)) return; data.meals.push({ ...m, id: uid('m'), date: d }); n++; });
    if (!n) return toast('Already copied');
    render(); save('meals'); toast(`Copied ${n} meal${n > 1 ? 's' : ''} ✓`); return;
  }
  if (ev.target.closest('#shopWeek')) {
    const a = dstr(mealWeek), b = dstr(addDays(mealWeek, 6));
    const n = addIngredients(data.meals.filter(m => m.date >= a && m.date <= b));
    toast(n ? `Added ${n} item${n > 1 ? 's' : ''} to shopping ✓` : 'Everything’s already on the list');
  }
});
// swipe left/right on the week to change weeks
(() => { let x0 = null, y0 = 0; const L = $('#list');
  L.addEventListener('touchstart', e => { if (tab !== 'meals') return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  L.addEventListener('touchend', e => { if (tab !== 'meals' || x0 == null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy)) { mealWeek = addDays(mealWeek, dx < 0 ? 7 : -7); render(); } }, { passive: true });
})();
const SCANS = { grocery: '📷 Scan a shopping list', lunch: '📷 Scan school lunch menu', mealplan: '📷 Scan a meal plan', schedule: '📷 Scan a schedule or itinerary', schoolyear: '📷 Scan school year calendar' };
const scanBtn = (mode, cls = 'big') => `<label class="btn ${cls} scan-btn">${SCANS[mode]}<input type="file" accept="image/*" data-scan="${mode}" ${mode === 'schoolyear' ? 'multiple' : ''} hidden></label>`;
function scanHint() {
  try { if (localStorage.getItem('hq-scan-tip')) return ''; } catch (e) {}
  return `<div class="scan-tip"><span>Tip: tap ✨ at the bottom right to scan anything — lunch menus, school calendars, travel, shopping lists, practice emails.</span><button type="button" data-scanhint aria-label="Dismiss tip">✕</button></div>`;
}
let shopSel = null;
const tripById = id => (data.trips || []).find(t => t.id === id);
function curTrip() { if (shopSel === 'any' || tripById(shopSel)) return shopSel; const n = window.HQTrip.next(data.trips); return n ? n.id : 'any'; }
const tripCount = k => data.groceries.filter(g => !g.done && window.HQTrip.key(g, data.trips) === k).length;
const tripName = t => window.HQTrip.label(t, storesList());
function shopTools() {
  const k = curTrip(), t = tripById(k), list = window.HQTrip.sorted(data.trips), us = data.usuals || [];
  const doneN = data.groceries.filter(g => g.done && window.HQTrip.key(g, data.trips) === k).length;
  const tabs = list.map(x => [x.id, tripName(x)]).concat([['any', 'Anytime']]);
  return scanHint() + `<div class="trip-tabs">${tabs.map(([id, l]) => `<button type="button" class="trip-tab ${id === k ? 'on' : ''}" data-trip-sel="${esc(id)}">${esc(l)} <b>${tripCount(id)}</b></button>`).join('')}<button type="button" class="trip-tab add" data-trip-new>＋ Trip</button></div>
    <div class="trip-card"><div class="trip-ttl"><span>${t ? (t === window.HQTrip.next(data.trips) ? 'Next shopping trip' : 'Upcoming trip') : 'No date'}</span><b>${esc(t ? tripName(t) : 'Anytime list')}</b>
      <small>${tripCount(k)} to get${t && t.repeat ? ' · repeats ' + (t.repeat === 'weekly' ? 'weekly' : 'every 2 weeks') : ''}</small></div>
      <div class="trip-acts"><button type="button" class="btn primary" data-trip-plan>🧺 Plan this trip</button>${t ? `<button type="button" class="btn" data-trip-finish>✓ Finish trip</button><button type="button" class="btn" data-trip-edit>Edit</button>` : ''}</div></div>
    <div class="group"><span>Usual items · staples catalog (${us.length})</span><button type="button" class="link" data-tab-go="usuals">Manage</button></div>
    ${data.groceries.length ? `<div class="shop-actions">${doneN ? `<button type="button" class="btn" id="clearChecked">🧹 Clear ${doneN} checked</button>` : ''}
      <button type="button" class="btn" id="selToggle">${selMode ? 'Cancel' : '☑︎ Select'}</button>
      ${selMode ? `<button type="button" class="btn danger" id="delSelected" ${selected.size ? '' : 'disabled'}>Delete ${selected.size || ''}</button>` : ''}</div>` : ''}`;
}
async function saveShop() { await save('trips'); await save('groceries'); }
function aiSheet(title, html) { $('#aiTitle').textContent = title; $('#aiGo').hidden = true; $('#aiBody').innerHTML = html; $('#ai').showModal(); }
function tripSheet(t) {
  const isNew = !t; t = t || { id: uid('t'), date: dstr(addDays(new Date(), (6 - new Date().getDay() + 7) % 7 || 7)), store: storesList()[0].id, repeat: 'weekly' };
  aiSheet(isNew ? 'New shopping trip' : 'Edit trip', `<div class="cards trip-form" data-trip-id="${esc(t.id)}" data-new="${isNew ? 1 : ''}">
    <label class="field"><span>Date</span><input type="date" id="tpDate" value="${esc(t.date || '')}"></label>
    <label class="field"><span>Store</span><select id="tpStore">${storesList().map(x => `<option value="${esc(x.id)}" ${x.id === t.store ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
    <label class="field"><span>Name (optional)</span><input id="tpName" value="${esc(t.name || '')}" placeholder="e.g. Big weekly shop"></label>
    <label class="field"><span>Repeats</span><select id="tpRep">${[['', 'One-off'], ['weekly', 'Every week'], ['biweekly', 'Every 2 weeks']].map(([v, l]) => `<option value="${v}" ${(t.repeat || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <button type="button" class="btn primary big" data-trip-save>Save trip</button>${isNew ? '' : '<button type="button" class="btn danger big" data-trip-del>Delete trip (items move to Anytime)</button>'}`);
}
function planSheet() {
  const k = curTrip(), t = tripById(k), on = new Set(data.groceries.filter(g => !g.done && window.HQTrip.key(g, data.trips) === k).map(g => g.name.toLowerCase()));
  const us = data.usuals || [], byStore = {};
  us.forEach(u => { const st = u.store || 'other'; (byStore[st] = byStore[st] || {}); (byStore[st][u.cat || 'Other'] = byStore[st][u.cat || 'Other'] || []).push(u); });
  const order = Object.keys(byStore).sort((a, b) => (a === (t && t.store) ? -1 : b === (t && t.store) ? 1 : 0));
  aiSheet('Plan: ' + (t ? tripName(t) : 'Anytime'), `<p class="hint" style="text-align:left;margin:0 4px 10px">Tick the staples you need this time. Ticked items go on this trip’s list.</p>
    ${us.length ? order.map(st => `<div class="group"><span>${esc(storeName(st) || 'Other store')}</span></div><div class="cards plan-list">${Object.keys(byStore[st]).sort((a, b) => CATS.indexOf(a) - CATS.indexOf(b)).map(c => `<div class="plan-cat">${esc(c)}</div>` + byStore[st][c].map(u => `<label class="plan-row"><input type="checkbox" data-plan-u="${esc(u.id)}" ${on.has(u.name.toLowerCase()) ? 'checked disabled' : ''}><span>${esc(u.name)}${u.qty > 1 ? ' ×' + u.qty : ''}</span>${on.has(u.name.toLowerCase()) ? '<em>on list</em>' : ''}</label>`).join('')).join('')}</div>`).join('')
      : '<p class="hint">No usual items yet — add your staples under Usual items.</p>'}
    <div class="group"><span>One-off items</span></div><div class="cards"><label class="field"><span>One per line</span><textarea id="planOne" rows="3" placeholder="Birthday candles&#10;Batteries"></textarea></label></div>
    <button type="button" class="btn primary big" data-plan-go>Add to ${esc(t ? tripName(t) : 'Anytime')}</button>`);
}
document.addEventListener('click', async ev => {
  let x;
  if ((x = ev.target.closest('[data-trip-sel]'))) { shopSel = x.dataset.tripSel; render(); return; }
  if (ev.target.closest('[data-trip-new]')) return tripSheet(null);
  if (ev.target.closest('[data-trip-edit]')) return tripSheet(structuredClone(tripById(curTrip())));
  if (ev.target.closest('[data-trip-plan]')) return planSheet();
  if (ev.target.closest('[data-trip-save]')) {
    const box = $('.trip-form'), id = box.dataset.tripId, t = tripById(id) || { id };
    Object.assign(t, { date: $('#tpDate').value || null, store: $('#tpStore').value, name: $('#tpName').value.trim() || undefined, repeat: $('#tpRep').value || undefined });
    if (!tripById(id)) data.trips.push(t);
    shopSel = id; $('#ai').close(); render(); await save('trips'); toast('Trip saved ✓'); return;
  }
  if (ev.target.closest('[data-trip-del]')) {
    const id = $('.trip-form').dataset.tripId; if (!confirm('Delete this trip? Its items move to Anytime.')) return;
    data.trips = data.trips.filter(t => t.id !== id); data.groceries.forEach(g => { if (g.trip === id) delete g.trip; });
    shopSel = null; $('#ai').close(); render(); await saveShop(); return;
  }
  if (ev.target.closest('[data-plan-go]')) {
    const k = curTrip(), t = tripById(k); let n = 0;
    const add = (name, u) => { name = name.trim(); if (!name) return; const ex = data.groceries.find(g => window.HQTrip.key(g, data.trips) === k && g.name.toLowerCase() === name.toLowerCase());
      if (ex) { if (ex.done) { ex.done = false; n++; } return; }
      data.groceries.push(clean({ id: uid('g'), name, cat: (u && u.cat) || 'Other', qty: (u && u.qty) || 1, store: (u && u.store) || DEF_STORE, done: false, trip: k === 'any' ? undefined : k })); n++; };
    document.querySelectorAll('[data-plan-u]:checked:not(:disabled)').forEach(c => { const u = data.usuals.find(z => z.id === c.dataset.planU); if (u) add(u.name, u); });
    ($('#planOne').value || '').split('\n').forEach(l => add(l));
    $('#ai').close(); render(); if (n) { await save('groceries'); toast(`Added ${n} item${n > 1 ? 's' : ''} ✓`); } return;
  }
  if (ev.target.closest('[data-trip-finish]')) {
    const t = tripById(curTrip()); if (!t) return;
    const got = data.groceries.filter(g => g.trip === t.id && g.done), left = data.groceries.filter(g => g.trip === t.id && !g.done);
    let msg = `Finish ${tripName(t)}? ${got.length} got-it item${got.length === 1 ? '' : 's'} will be cleared.`;
    if (t.repeat) msg += ` The next trip is scheduled ${t.repeat === 'weekly' ? 'a week' : 'two weeks'} later` + (left.length ? `; ${left.length} unticked item${left.length === 1 ? '' : 's'} carry over.` : '.');
    else msg += left.length ? ` ${left.length} unticked item${left.length === 1 ? '' : 's'} move to Anytime.` : '';
    if (!confirm(msg)) return;
    data.groceries = data.groceries.filter(g => !got.includes(g));
    if (t.repeat && t.date) t.date = dstr(addDays(ymd(t.date), t.repeat === 'weekly' ? 7 : 14));
    else if (t.repeat) t.date = dstr(addDays(new Date(), 7));
    else { data.trips = data.trips.filter(z => z !== t); left.forEach(g => delete g.trip); shopSel = null; }
    render(); await saveShop(); toast('Trip finished ✓'); return;
  }
});
const shopFooter = () => `<p class="hint"><button type="button" class="link" data-tab-go="stores">Edit stores</button> · Tip: press and hold an item to select several.</p>`;
function addUsual(u) {
  const g = data.groceries.find(x => x.name.toLowerCase() === u.name.toLowerCase());
  if (g && !g.done) g.qty = (g.qty || 1) + 1;
  else if (g) { g.done = false; g.qty = u.qty || 1; }
  else data.groceries.push(clean({ id: uid('g'), name: u.name, cat: u.cat || 'Other', qty: u.qty || 1, store: u.store || DEF_STORE, done: false }));
  render(); save('groceries');
}
const foodSeg = () => `<div class="seg-ctl"><button type="button" data-tab-go="meals" class="${tab === 'meals' ? 'on' : ''}">🍽️ Meals</button><button type="button" data-tab-go="groceries" class="${tab === 'groceries' ? 'on' : ''}">🛒 Shopping</button></div>`;
S.food = { label: 'Food', title: 'Food', noun: '' };

S.usuals = {
  label: 'Usual items', title: 'Usual items', noun: 'usual item', emoji: '⭐', sortable: true, trash: true,
  emptyText: 'Your staples catalog — things you buy often. Adding here never puts them on a list; use “Plan this trip” to pick what you need.',
  items: () => data.usuals || [],
  row: u => ({ title: esc(u.name) + (u.qty > 1 ? ` <span style="color:var(--muted)">×${u.qty}</span>` : ''), sub: esc([u.cat, storeName(u.store)].filter(Boolean).join(' · ')) }),
  blank: () => ({ id: uid('u'), name: '', cat: 'Produce', qty: 1, store: DEF_STORE }),
  fields: u => `${input('name', 'Item', u.name, 'required placeholder="e.g. Milk" autocomplete="off"')}
    ${stepper('qty', 'Usual amount', u.qty || 1, 1, 99)}
    ${select('cat', 'Aisle', u.cat, CATS.map(c => [c, c]))}
    ${chips('store', 'Store', STORES_OPTS(), [u.store], false)}`,
  read: (f, u) => clean({ id: u.id, name: f.name.value.trim(), qty: Math.max(1, +f.qty.value || 1), cat: f.cat.value, store: chipVal(f, 'store')[0] || DEF_STORE }),
};
S.stores = {
  label: 'Stores', title: 'Stores', noun: 'store', emoji: '🏪', sortable: true, trash: true, emptyText: 'Add the stores you shop at.',
  items: () => { if (!data.stores || !data.stores.length || BUILTIN_STORES.some(b => !data.stores.some(x => x.id === b.id))) data.stores = storesList().map(x => ({ ...x })); return data.stores; },
  row: x => ({ title: esc(x.name), sub: esc(`${(data.groceries || []).filter(g => !g.done && (STORE_MIGRATE[g.store] || g.store) === x.id).length} on the list`) }),
  blank: () => ({ id: uid('s'), name: '' }),
  fields: x => input('name', 'Store name', x.name, 'required placeholder="e.g. Trader Joe’s" autocomplete="off"'),
  read: (f, x) => ({ id: x.id, name: f.name.value.trim() }),
};

// ---------------------------------------------------------------- wish lists (year-round, per person, occasion-tagged)
const OCC = [['christmas', '🎄 Christmas'], ['birthday', '🎂 Birthday'], ['anytime', '✨ Anytime']];
const wishWhoKey = w => { const k = w.who || w.kid; return k && !/^o:/.test(k) ? k : 'o:' + (w.whoName || ''); };
function wishPeople() {
  const fam = (data.people || []).map(p => ({ key: p.id, name: p.name })), seen = new Set(fam.map(p => p.name.toLowerCase())), out = [...fam];
  [...(data.wishes || []).filter(w => wishWhoKey(w).startsWith('o:')).map(w => w.whoName), ...(data.dates || []).filter(d => !d.pid).map(d => d.name)]
    .forEach(n => { if (n && !seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); out.push({ key: 'o:' + n, name: n }); } });
  return out;
}
let wishWho = localStorage.getItem('hq-wwho') || '', wishOcc = localStorage.getItem('hq-wocc') || 'all';
const curWho = () => (wishPeople().find(k => k.key === wishWho) || (data.people || []).find(p => p.role !== 'parent') && { key: (data.people || []).find(p => p.role !== 'parent').id } || wishPeople()[0] || {}).key;
S.wishes = {
  label: 'Wish lists', title: 'Wish lists', noun: 'wish', emoji: '🎁', trash: true,
  emptyText: 'Add what someone is hoping for — Christmas, birthday or anytime — with a link or photo. Tick “Got it” when it’s bought; while “Hide got-it marks” is on, the frame never shows them.',
  items: () => (data.wishes || []).filter(w => wishWhoKey(w) === curWho() && (wishOcc === 'all' || (w.occasion || 'christmas') === wishOcc)),
  row: w => ({ title: (w.got ? '✓ ' : '') + esc(w.name), sub: esc([(OCC.find(o => o[0] === (w.occasion || 'christmas')) || [, ''])[1], w.got ? 'Got it' : '', w.link && (() => { try { return new URL(w.link).hostname.replace(/^www\./, ''); } catch { return ''; } })(), w.note].filter(Boolean).join(' · ')) }),
  blank: () => { const k = curWho(), o = wishPeople().find(p => p.key === k); return { id: uid('w'), who: k, whoName: k && k.startsWith('o:') ? o && o.name : undefined, occasion: wishOcc === 'all' ? (new Date().getMonth() >= 9 ? 'christmas' : 'anytime') : wishOcc, name: '', got: false }; },
  fields: w => `${chips('who', 'For', [...wishPeople().map(k => [k.key, k.name]), ['new', '＋ Someone else']], [wishWhoKey(w)], false)}
    <div class="wl-newwho" hidden>${input('whoName', 'Their name', '', 'placeholder="e.g. Grandma Jo" autocomplete="off"')}</div>
    ${chips('occasion', 'Occasion', OCC, [w.occasion || 'christmas'], false)}
    ${input('name', 'Wish', w.name, 'required placeholder="e.g. LEGO Botanical set" autocomplete="off"')}
    ${input('link', 'Link (optional)', w.link, 'type="url" inputmode="url" placeholder="https://…" autocomplete="off"')}
    ${input('image', 'Photo link (optional)', w.image, 'type="url" inputmode="url" autocomplete="off"')}
    ${field('Notes', `<textarea name="note" rows="2" placeholder="Size, colour…">${esc(w.note || '')}</textarea>`)}
    <label class="switch">Got it (parents only)<input type="checkbox" name="got" ${w.got ? 'checked' : ''}></label>`,
  validate: f => (chipVal(f, 'who')[0] === 'new' && !f.whoName.value.trim()) ? 'Please add their name' : true,
  read: (f, w) => { let who = chipVal(f, 'who')[0] || wishWhoKey(w), whoName;
    if (who === 'new') { whoName = f.whoName.value.trim(); who = 'o:' + whoName; } else if (who.startsWith('o:')) whoName = who.slice(2);
    wishWho = who; localStorage.setItem('hq-wwho', who);
    return clean({ id: w.id, who, whoName, occasion: chipVal(f, 'occasion')[0] || 'christmas', name: f.name.value.trim(), link: f.link.value.trim(), image: f.image.value.trim(), note: f.note.value.trim(), got: f.got.checked }); },
  mount: f => { const c = f.querySelector('[data-chips="who"]'); c && c.addEventListener('click', () => setTimeout(() => { f.querySelector('.wl-newwho').hidden = chipVal(f, 'who')[0] !== 'new'; }, 0)); },
};
let lookLoading = false;
function needLook() { if (!look && !lookLoading) { lookLoading = true; api('GET', 'look').then(l => { look = l; render(); }).catch(() => {}); } }
function wishTools() {
  needLook(); const L = look || {};
  return `<button type="button" class="link back" data-tab-go="more">‹ More</button>
    <div class="seg-ctl wl-seg" style="overflow-x:auto">${wishPeople().map(k => `<button type="button" data-wwho="${esc(k.key)}" class="${k.key === curWho() ? 'on' : ''}">${esc(k.name)}</button>`).join('')}</div>
    <div class="seg-ctl wl-seg">${[['all', 'All'], ...OCC].map(([k, t]) => `<button type="button" data-wocc="${k}" class="${k === wishOcc ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div class="cards"><label class="switch">Hide got-it marks on the frame<input type="checkbox" id="wishHide" ${L.wishHide !== false ? 'checked' : ''}></label></div>`;
}
document.addEventListener('click', ev => { let t;
  if ((t = ev.target.closest('[data-wwho]'))) { wishWho = t.dataset.wwho; localStorage.setItem('hq-wwho', wishWho); render(); }
  if ((t = ev.target.closest('[data-wocc]'))) { wishOcc = t.dataset.wocc; localStorage.setItem('hq-wocc', wishOcc); render(); } });
document.addEventListener('change', async ev => { if (ev.target.id === 'wishHide') { look = { ...(look || {}), wishHide: ev.target.checked }; await saveLookNow(); }
  if (ev.target.id === 'bdayDays') { look = { ...(look || {}), bdayDays: +ev.target.value }; await saveLookNow(); } });

// ---------------------------------------------------------------- birthdays & anniversaries
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function nextOf(md) { const n = new Date(); n.setHours(0, 0, 0, 0); const [m, d] = md.split('-').map(Number); let x = new Date(n.getFullYear(), m - 1, d); if (x < n) x = new Date(n.getFullYear() + 1, m - 1, d); return x; }
const mdOf = date => (/(\d\d)-(\d\d)$/.exec(date || '') || []).slice(1).join('-');
S.dates = {
  label: 'Birthdays', title: 'Birthdays & anniversaries', noun: 'date', emoji: '🎂', trash: true,
  emptyText: 'Add birthdays and anniversaries for family and friends. They repeat on the calendar every year and show on Today ahead of time. Family birthdays set under Family show up too.',
  items: () => (data.dates || []).slice().sort((a, b) => nextOf(mdOf(a.date)) - nextOf(mdOf(b.date))),
  row: d => { const nx = nextOf(mdOf(d.date)), y = /^(\d{4})/.exec(d.date || ''), n = y ? nx.getFullYear() - +y[1] : null, days = Math.round((nx - new Date().setHours(0, 0, 0, 0)) / 864e5);
    return { title: (d.kind === 'anniversary' ? '🥂 ' : '🎂 ') + esc(d.name), sub: esc([nx.toLocaleDateString([], { month: 'long', day: 'numeric' }), n ? (d.kind === 'anniversary' ? n + ' years' : 'turns ' + n) : '', days === 0 ? 'today' : 'in ' + days + ' days'].filter(Boolean).join(' · ')) }; },
  blank: () => ({ id: uid('d'), name: '', kind: 'birthday', date: '' }),
  fields: d => { const m = /^(\d{4}|-)-?(\d\d)-(\d\d)$/.exec(d.date || '') || [];
    return `${chips('kind', 'Type', [['birthday', '🎂 Birthday'], ['anniversary', '🥂 Anniversary']], [d.kind || 'birthday'], false)}
    ${input('name', 'Name', d.name, 'required placeholder="e.g. Grandma Jo, or Mom & Dad" autocomplete="off"')}
    <div class="row2">${select('month', 'Month', m[2] || '', [['', 'Month'], ...MONTHS.map((x, i) => [String(i + 1).padStart(2, '0'), x])])}
    ${input('day', 'Day', m[3] ? String(+m[3]) : '', 'inputmode="numeric" placeholder="e.g. 14"')}
    ${input('year', 'Year (optional)', /^\d{4}$/.test(m[1] || '') ? m[1] : '', 'inputmode="numeric" placeholder="Shows age turning"')}</div>
    ${select('pid', 'Family member (optional)', d.pid || '', [['', '— Not in the family list —'], ...(data.people || []).map(p => [p.id, p.name])])}
    ${field('Notes', `<textarea name="note" rows="2">${esc(d.note || '')}</textarea>`)}`; },
  validate: f => { const dd = +f.day.value; if (!f.month.value) return 'Please pick a month'; if (!(dd >= 1 && dd <= 31)) return 'Please add the day'; if (f.year.value && !/^\d{4}$/.test(f.year.value.trim())) return 'Year should be 4 digits'; return true; },
  read: (f, d) => clean({ id: d.id, kind: chipVal(f, 'kind')[0] || 'birthday', name: f.name.value.trim(), date: `${f.year.value.trim() || '-'}-${f.month.value}-${String(+f.day.value).padStart(2, '0')}`, pid: f.pid.value || undefined, note: f.note.value.trim() }),
};
function datesTools() {
  needLook(); const L = look || {}, v = L.bdayDays != null ? L.bdayDays : 7;
  return `<button type="button" class="link back" data-tab-go="more">‹ More</button>
    <div class="cards"><label class="field"><span>Show on Today ahead of time</span><select id="bdayDays">${[0, 1, 3, 7, 14, 30].map(n => `<option value="${n}" ${n === v ? 'selected' : ''}>${n === 0 ? 'Only on the day' : n + ' day' + (n > 1 ? 's' : '') + ' ahead'}</option>`).join('')}</select></label></div>
    <button type="button" class="btn big" data-tab-go="wishes" style="width:100%;margin:6px 0 10px">🎁 Wish lists</button>`;
}

// ---------------------------------------------------------------- countdowns (opt-in)
function renderCountdowns() {
  const on = new Set((data.countdowns || []).map(c => c.id)), H = window.HQHol, t = today();
  const days = d => { const n = Math.round((new Date(d + 'T00:00') - new Date(t + 'T00:00')) / 864e5); return n === 0 ? 'today' : `in ${n} day${n === 1 ? '' : 's'}`; };
  const sw = (id, title, sub) => `<label class="switch cd-sw"><span><b>${esc(title)}</b><small>${esc(sub)}</small></span><input type="checkbox" data-cd="${esc(id)}" ${on.has(id) ? 'checked' : ''}></label>`;
  const nextMd = date => { const m = /(\d\d)-(\d\d)$/.exec(date || ''); if (!m) return null; let y = +t.slice(0, 4), d = `${y}-${m[1]}-${m[2]}`; if (d < t) d = `${y + 1}-${m[1]}-${m[2]}`; return d; };
  const evs = (data.events || []).filter(e => e.countdown && e.start && String(e.start).slice(0, 10) >= t).sort((a, b) => String(a.start) < String(b.start) ? -1 : 1);
  const bd = [...(data.people || []).filter(p => p.birthday).map(p => ({ id: 'b:' + p.id, name: p.name + '’s birthday', date: p.birthday })),
    ...(data.dates || []).filter(d => !d.pid).map(d => ({ id: 'b:d:' + d.id, name: d.name + (d.kind === 'anniversary' ? '’s anniversary' : '’s birthday'), date: d.date }))].map(x => ({ ...x, next: nextMd(x.date) })).filter(x => x.next).sort((a, b) => a.next < b.next ? -1 : 1);
  const hol = H ? H.HOLIDAYS.map(h => H.nextHoliday(h[0], t)).filter(Boolean).sort((a, b) => a.date < b.date ? -1 : 1) : [];
  $('#list').innerHTML = `<button type="button" class="link back" data-tab-go="more">‹ More</button>
    <p class="hint" style="text-align:left;margin:4px 4px 12px">Only what you switch on counts down. Today shows one small pill — tap it to see the next. Past ones hide on their own.</p>
    <div class="group"><span>Events</span></div><div class="cards">${evs.length ? evs.map(e => `<div class="row"><div class="row-main" data-cd-ev="${esc(e.id)}"><div class="row-text"><div class="row-title">⏳ ${esc(e.title)}</div><div class="row-sub">${esc(new Date(e.start).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ' + days(String(e.start).slice(0, 10)))} · tap to edit</div></div><span class="chev">›</span></div></div>`).join('') : '<p class="hint" style="padding:12px">No event countdowns yet — open any event and switch on “Countdown on the Today screen”.</p>'}</div>
    <div class="group"><span>Birthdays & anniversaries</span></div><div class="cards">${bd.length ? bd.map(x => sw(x.id, x.name, new Date(x.next + 'T12:00').toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ' + days(x.next))).join('') : '<p class="hint" style="padding:12px">Add birthdays under Family or Birthdays & anniversaries.</p>'}</div>
    <div class="group"><span>Holidays</span></div><div class="cards">${hol.map(h => sw('h:' + h.key, h.emoji + ' ' + h.title, new Date(h.date + 'T12:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + days(h.date))).join('')}</div>`;
}
document.addEventListener('change', async ev => { const c = ev.target.closest('[data-cd]'); if (!c) return;
  data.countdowns = (data.countdowns || []).filter(x => x.id !== c.dataset.cd); if (c.checked) data.countdowns.push({ id: c.dataset.cd });
  await save('countdowns'); });
document.addEventListener('click', ev => { const r = ev.target.closest('[data-cd-ev]'); if (!r) return; const e = (data.events || []).find(x => x.id === r.dataset.cdEv); if (!e) return; tab = 'events'; render(); openSheet(e, false); });

// ---------------------------------------------------------------- recipes (meals + cocktails)
let recipeKind = localStorage.getItem('hq-rkind') || 'meal';
const PANTRY = /\b(salt|pepper|black pepper|kosher salt|olive oil|vegetable oil|canola oil|cooking spray|water|ice|ice cubes|sugar|flour|all-purpose flour|baking soda|baking powder|vanilla|cinnamon|paprika|cumin|oregano|garlic powder|onion powder|chili powder|red pepper flakes|bay leaves?|thyme|nonstick spray|simple syrup|bitters)\b/i;
const UNIT = '(?:cups?|c\\.|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|fl\\.? ?oz|lbs?|pounds?|g|grams?|kg|ml|l|liters?|pinch(?:es)?|dash(?:es)?|cloves?|cans?|packages?|pkgs?|sticks?|slices?|bunch(?:es)?|heads?|sprigs?|handfuls?|large|medium|small|parts?|jiggers?|shots?|splash(?:es)?|whole|pieces?)';
function ingName(line) {
  let s = String(line).replace(/\([^)]*\)/g, ' ').replace(/[½¼¾⅓⅔⅛]/g, ' ').trim();
  s = s.replace(new RegExp('^[\\d\\s./–-]+(?:' + UNIT + '\\.?\\s+(?:of\\s+)?)?', 'i'), '').replace(new RegExp('^' + UNIT + '\\s+(?:of\\s+)?', 'i'), '');
  s = s.split(/,| – | - |;| for (?:serving|garnish)| to taste/i)[0].replace(/\b(fresh(ly)?|chopped|minced|diced|sliced|grated|shredded|softened|melted|divided|optional|finely|roughly|ground|large|medium|small|peeled|boneless|skinless)\b/gi, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s ? s[0].toUpperCase() + s.slice(1, 60) : '';
}
const GUESS = [[/apple|banana|berr|lemon|lime|orange|onion|garlic|potato|tomato|lettuce|spinach|carrot|celery|pepper|herb|basil|cilantro|parsley|mint|avocado|cucumber|mushroom|ginger|scallion|zucchini|broccoli/i, 'Produce'],
  [/milk|cheese|butter|cream|yogurt|egg/i, 'Dairy & Eggs'], [/chicken|beef|pork|turkey|sausage|bacon|salmon|shrimp|fish|lamb|steak/i, 'Meat & Fish'], [/bread|bun|roll|tortilla|bagel|pita/i, 'Bakery'], [/frozen/i, 'Frozen']];
const guessCat = n => (GUESS.find(([re]) => re.test(n)) || [, 'Pantry'])[1];
function ingredientsSheet(sources, title) {
  // sources: [{ title, ingredients: [lines] }] → merged by cleaned name
  const seen = new Map();
  sources.forEach(src => (src.ingredients || []).forEach(line => { const n = ingName(line); if (!n) return; const k = n.toLowerCase();
    if (!seen.has(k)) seen.set(k, { name: n, lines: [], from: new Set() }); const e = seen.get(k); e.lines.push(String(line)); e.from.add(src.title); }));
  const k = curTrip(), onList = new Set(data.groceries.filter(g => !g.done && window.HQTrip.key(g, data.trips) === k).map(g => g.name.toLowerCase()));
  const rows = [...seen.values()];
  if (!rows.length) return toast('No ingredients to add');
  aiSheet(title || 'Add ingredients', `<p class="hint" style="text-align:left;margin:0 4px 10px">Untick what you already have. Pantry basics start unticked${sources.length > 1 ? ' · duplicates across recipes are merged' : ''}.</p>
    <div class="cards rcp-ing">${rows.map((r, i) => { const on = onList.has(r.name.toLowerCase()), pantry = PANTRY.test(r.name);
      return `<label class="rv-row rcp-row"><input type="checkbox" data-ing="${i}" ${on || pantry ? '' : 'checked'} ${on ? 'disabled' : ''}><span><b>${esc(r.name)}</b><small>${esc(on ? 'Already on the list' : r.lines.length > 1 ? r.lines.length + '× · ' + r.lines.join(' · ') : r.lines[0])}</small></span></label>`; }).join('')}</div>
    <div class="group"><span>Store</span></div>
    <div class="chips" id="rcpStore">${storesList().map(s => `<button type="button" class="chip ${s.id === DEF_STORE ? 'on' : ''}" data-st="${esc(s.id)}">${esc(s.name)}</button>`).join('')}</div>
    <button type="button" class="btn primary big" id="rcpAdd" style="margin-top:14px">Add to shopping</button>`);
  $('#rcpStore').onclick = ev => { const b = ev.target.closest('[data-st]'); if (!b) return; $('#rcpStore').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); };
  $('#rcpAdd').onclick = async () => {
    const st = ($('#rcpStore .chip.on') || {}).dataset?.st || DEF_STORE; let n = 0;
    document.querySelectorAll('[data-ing]:checked:not(:disabled)').forEach(c => { const r = rows[+c.dataset.ing];
      const ex = data.groceries.find(g => g.name.toLowerCase() === r.name.toLowerCase() && window.HQTrip.key(g, data.trips) === k);
      if (ex) { if (ex.done) { ex.done = false; n++; } return; }
      const u = (data.usuals || []).find(z => z.name.toLowerCase() === r.name.toLowerCase());
      data.groceries.push(clean({ id: uid('g'), name: r.name, cat: (u && u.cat) || guessCat(r.name), qty: 1, store: st, done: false, trip: k === 'any' ? undefined : k, note: sources.length === 1 ? undefined : [...r.from].join(', ').slice(0, 80) })); n++; });
    $('#ai').close(); if (n) { await save('groceries'); toast(`Added ${n} to shopping ✓`); } else toast('Nothing new to add');
  };
}
function planRecipe(r) {
  const d = new Date(); const def = dstr(d);
  aiSheet('Plan ' + r.title, `<div class="cards"><label class="field"><span>${r.kind === 'cocktail' ? 'Day' : 'Dinner on'}</span><input type="date" id="rcpDate" value="${def}"></label></div>
    <button type="button" class="btn primary big" id="rcpPlan" style="margin-top:12px">Add to meal plan</button>`);
  $('#rcpPlan').onclick = async () => {
    const date = $('#rcpDate').value || def;
    data.meals = data.meals || [];
    data.meals.push(clean({ id: uid('m'), date, slot: r.kind === 'cocktail' ? 'snack' : 'dinner', title: r.title, recipe: r.id, link: r.url || undefined, ingredients: (r.ingredients || []).join('\n') }));
    $('#ai').close(); await save('meals'); toast(`Planned for ${new Date(date + 'T12:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ✓`);
  };
}
function importRecipeSheet() {
  aiSheet('Add a recipe', `<div class="cards"><label class="field"><span>Paste a recipe link</span><input id="rcpUrl" type="url" inputmode="url" placeholder="https://…" autocomplete="off"></label></div>
    <button type="button" class="btn primary big" id="rcpFetch" style="margin-top:12px">Get recipe</button>
    <p class="hint" style="margin-top:14px">Or tap <b>✨ Scan</b> for a photo, PDF or pasted text — recipes and cocktails are detected automatically.</p>
    <button type="button" class="btn big" id="rcpBlank" style="margin-top:6px">Type it in</button>`);
  $('#rcpBlank').onclick = () => { $('#ai').close(); openSheet(S.recipes.blank(), true); };
  $('#rcpFetch').onclick = async () => {
    const url = $('#rcpUrl').value.trim(); if (!url) return toast('Paste a link first');
    $('#aiBody').innerHTML = progressHtml('Reading the recipe…');
    try { const j = await api('POST', 'recipe-import', { url }); openRecipeDraft(j.recipe); }
    catch (e) { toast('Couldn’t get that recipe — ' + e.message); importRecipeSheet(); }
  };
}
function openRecipeDraft(rc) {
  $('#ai').close();
  if (!rc) return toast('No recipe found');
  recipeKind = rc.kind === 'cocktail' ? 'cocktail' : 'meal'; localStorage.setItem('hq-rkind', recipeKind);
  tab = 'recipes'; render();
  openSheet({ ...S.recipes.blank(), ...rc, id: uid('r') }, true);
}
const lines = v => String(v || '').split(/\n+/).map(x => x.trim()).filter(Boolean);
S.recipes = {
  label: 'Recipes', title: 'Recipes', noun: 'recipe', emoji: '📖', trash: true,
  emptyText: 'Save recipes from a link, a photo of a cookbook page, a PDF or pasted text. Then add the ingredients to shopping or plan them for dinner.',
  items: () => (data.recipes || []).filter(r => (r.kind || 'meal') === recipeKind).sort((a, b) => a.title.localeCompare(b.title)),
  row: r => ({ title: (r.kind === 'cocktail' ? '🍸 ' : '') + esc(r.title), sub: esc([r.kind === 'cocktail' ? [r.method, r.glass].filter(Boolean).join(' · ') : r.servings && 'Serves ' + r.servings, (r.ingredients || []).length + ' ingredients', r.url && new URL(r.url).hostname.replace(/^www\./, '')].filter(Boolean).join(' · ')) }),
  blank: () => ({ id: uid('r'), kind: recipeKind, title: '', ingredients: [], steps: [] }),
  fields: r => `${r.image ? `<img class="rcp-img" src="${esc(r.image)}" alt="" referrerpolicy="no-referrer">` : ''}
    ${chips('kind', 'Type', [['meal', '🍽️ Meal'], ['cocktail', '🍸 Cocktail']], [r.kind || 'meal'], false)}
    ${input('title', 'Name', r.title, 'required placeholder="e.g. Chicken tikka masala" autocomplete="off"')}
    ${r.id && (data.recipes || []).some(x => x.id === r.id) ? `<div class="rcp-acts"><button type="button" class="btn big" data-rcp-shop>🛒 Add ingredients to shopping</button><button type="button" class="btn big" data-rcp-plan>📅 Plan for ${r.kind === 'cocktail' ? 'a day' : 'dinner'}</button></div>` : ''}
    <div class="rcp-cocktail" ${r.kind === 'cocktail' ? '' : 'hidden'}>${input('glass', 'Glass', r.glass, 'placeholder="e.g. Coupe, rocks"')}${input('garnish', 'Garnish', r.garnish, 'placeholder="e.g. Lime wheel"')}
      ${chips('method', 'Method', [['shaken', 'Shaken'], ['stirred', 'Stirred'], ['built', 'Built'], ['blended', 'Blended']], r.method ? [r.method] : [], false)}</div>
    <div class="rcp-meal" ${r.kind === 'cocktail' ? 'hidden' : ''}>${input('servings', 'Servings', r.servings, 'inputmode="numeric" placeholder="e.g. 4"')}</div>
    ${field(r.kind === 'cocktail' ? 'Spirits & ingredients — one per line' : 'Ingredients — one per line', `<textarea name="ingredients" rows="7" placeholder="2 cups rice&#10;1 lb chicken thighs">${esc((r.ingredients || []).join('\n'))}</textarea>`)}
    ${field('Steps — one per line', `<textarea name="steps" rows="6">${esc((r.steps || []).join('\n'))}</textarea>`)}
    ${input('url', 'Source link', r.url, 'type="url" inputmode="url" placeholder="https://…" autocomplete="off"')}
    ${input('image', 'Photo link (optional)', r.image, 'type="url" inputmode="url" autocomplete="off"')}
    ${field('Notes', `<textarea name="notes" rows="2">${esc(r.notes || '')}</textarea>`)}`,
  read: (f, r) => { const kind = chipVal(f, 'kind')[0] || 'meal'; recipeKind = kind; localStorage.setItem('hq-rkind', kind);
    return clean({ id: r.id, kind, title: f.title.value.trim(), url: f.url.value.trim(), image: f.image.value.trim(), servings: kind === 'meal' ? f.servings.value.trim() : undefined,
      ingredients: lines(f.ingredients.value), steps: lines(f.steps.value), notes: f.notes.value.trim(),
      glass: kind === 'cocktail' ? f.glass.value.trim() : undefined, garnish: kind === 'cocktail' ? f.garnish.value.trim() : undefined, method: kind === 'cocktail' ? chipVal(f, 'method')[0] : undefined, time: r.time }); },
  mount: f => {
    const kc = f.querySelector('[data-chips="kind"]'); if (kc) kc.addEventListener('click', () => setTimeout(() => { const c = (chipVal(f, 'kind')[0] || 'meal') === 'cocktail';
      f.querySelector('.rcp-cocktail').hidden = !c; f.querySelector('.rcp-meal').hidden = c; }, 0));
    const cur = () => S.recipes.read(f, current.item);
    const b1 = f.querySelector('[data-rcp-shop]'); if (b1) b1.onclick = () => { const r = cur(); ingredientsSheet([r], r.title); };
    const b2 = f.querySelector('[data-rcp-plan]'); if (b2) b2.onclick = () => planRecipe(cur());
  },
};
function recipeTools() {
  const all = data.recipes || [], n = k => all.filter(r => (r.kind || 'meal') === k).length;
  return `<button type="button" class="link back" data-tab-go="meals">‹ Meals</button>
    <div class="seg-ctl"><button type="button" data-rkind="meal" class="${recipeKind === 'meal' ? 'on' : ''}">🍽️ Meals${n('meal') ? ' ' + n('meal') : ''}</button><button type="button" data-rkind="cocktail" class="${recipeKind === 'cocktail' ? 'on' : ''}">🍸 Cocktails${n('cocktail') ? ' ' + n('cocktail') : ''}</button></div>
    <button type="button" class="btn big rcp-import" data-rcp-import>🔗 Add from a link</button>`;
}
document.addEventListener('click', ev => {
  let t;
  if ((t = ev.target.closest('[data-rkind]'))) { recipeKind = t.dataset.rkind; localStorage.setItem('hq-rkind', recipeKind); render(); return; }
  if (ev.target.closest('[data-rcp-import]')) return importRecipeSheet();
  if (ev.target.closest('#shopRecipes')) {
    const end = dstr(addDays(mealWeek, 6)), wk = (data.meals || []).filter(m => m.date >= dstr(mealWeek) && m.date <= end);
    const src = wk.map(m => { const r = m.recipe && (data.recipes || []).find(x => x.id === m.recipe); return r ? { title: r.title, ingredients: r.ingredients } : m.ingredients ? { title: m.title, ingredients: lines(m.ingredients.replace(/,/g, '\n')) } : null; }).filter(Boolean);
    if (!src.length) return toast('No planned meals with recipes or ingredients this week');
    return ingredientsSheet(src, 'This week’s groceries');
  }
});

S.more = { label: 'More', title: 'More', noun: '' };
S.countdowns = { label: 'Countdowns', title: 'Countdowns', noun: '' };
S.look = { label: 'Look', title: 'Look & layout', noun: '' };
S.preview = { label: 'Preview', title: 'Frame preview', noun: '' };
S.widget = { label: 'Widget', title: 'iPhone widget', noun: '' };
const ORDER = ['events', 'chores', 'food', 'people', 'more'];
const FOOD = ['meals', 'groceries', 'usuals', 'stores', 'recipes'];
const SUB = ['photos', 'calendars', 'look', 'preview', 'widget'];
const FAM = ['routine', 'care'];
let photos = null;
const today = () => dstr(new Date());
function times(c) { const r = Array.isArray(c.r) ? c.r : c.r ? [c.r] : []; return r.length ? r : ['after']; }
function whos(c) { return Array.isArray(c.who) ? (c.who.length ? c.who : ['any']) : [c.who || 'any']; }
const dkey = (c, slot, pid) => whos(c).length > 1 ? slot + '|' + pid : slot;
function slotDone(c, slot, pid) { if (c.doneSlots) return c.doneSlots[dkey(c, slot, pid)] === today(); return !!c.done && !Array.isArray(c.r) && c.r === slot; }   // legacy: done + single r
function clean(o) { Object.keys(o).forEach(k => (o[k] === undefined || o[k] === '') && delete o[k]); return o; }

// ---------------------------------------------------------------- render
function normShop() {
  if (!data) return;
  if (!Array.isArray(data.stores) || !data.stores.length) data.stores = structuredClone(DEFAULT_STORES);
  if (!Array.isArray(data.usuals)) data.usuals = [];
  if (!Array.isArray(data.recipes)) data.recipes = [];
  if (!Array.isArray(data.wishes)) data.wishes = [];
  if (!Array.isArray(data.dates)) data.dates = [];
  if (!Array.isArray(data.countdowns)) data.countdowns = [];
  if (!Array.isArray(data.trips)) data.trips = [];
  (data.groceries || []).forEach(g => { if (STORE_MIGRATE[g.store]) g.store = STORE_MIGRATE[g.store]; });
}
let selMode = false, selected = new Set(), lastRemoved = null;
function render() {
  normShop();
  const s = S[tab];
  $('#tabs').innerHTML = ORDER.map(k => { const on = k === tab || (k === 'more' && (SUB.includes(tab) || tab === 'wishes' || tab === 'dates' || tab === 'countdowns')) || (k === 'food' && FOOD.includes(tab)) || (k === 'people' && FAM.includes(tab)); return `<button type="button" data-tab="${k}" class="${on ? 'on' : ''}" aria-current="${on ? 'page' : 'false'}">${svg(k)}<span>${S[k].label}</span></button>`; }).join('');
  $('#title').textContent = s.title || s.label;
  if (FOOD.includes(tab)) $('#title').textContent = 'Food';
  const canAdd = ['dates', 'wishes', 'recipes', 'usuals', 'stores', 'meals', 'events', 'chores', 'groceries', 'people', 'photos', 'calendars', 'routine', 'care'].includes(tab);
  $('#add').hidden = !canAdd;
  $('#aiFab').hidden = !['events', 'chores', 'groceries', 'meals', 'recipes'].includes(tab);
  $('#addLabel').textContent = tab === 'photos' ? 'Add photos' : 'Add ' + s.noun;
  const back = SUB.includes(tab) ? `<button type="button" class="link back" data-tab-go="more">‹ More</button>` : '';
  if (tab === 'more') return renderMore();
  if (tab === 'countdowns') { if (!data) return; return renderCountdowns(); }
  if (tab === 'routine') { if (!data) return; return renderRoutine(); }
  if (tab === 'care') { if (!data) return; return renderCare(); }
  if (tab === 'meals') { if (!data) { $('#list').innerHTML = '<p class="hint">Loading…</p>'; return; } return renderMeals(foodSeg()); }
  if (tab === 'look') return renderLook(back);
  if (tab === 'preview') return renderPreview(back);
  if (tab === 'widget') return renderWidget(back);
  if (tab === 'photos') { renderPhotos(); $('#list').insertAdjacentHTML('afterbegin', back); return; }
  if (!data || (tab === 'calendars' && !cals)) { $('#list').innerHTML = '<p class="hint">Loading…</p>'; return; }
  const items = s.items();
  let html = '';
  if (!items.length) {
    html = `<div class="empty"><div class="big-emoji">${s.emoji}</div><h3>No ${s.label === 'Family' ? 'people' : s.noun + 's'} yet</h3><p>${esc(s.emptyText)}</p><button type="button" class="btn primary big" data-add>＋ Add ${s.noun}</button></div>`;
  } else {
    const groups = new Map();
    items.forEach(it => { const g = s.group ? s.group(it) : ''; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(it); });
    const keys = [...groups.keys()];
    if (s.groupOrder) keys.sort((a, b) => (s.groupOrder.indexOf(a) + 1 || 99) - (s.groupOrder.indexOf(b) + 1 || 99));
    html = keys.map(g => (g ? `<div class="group"><span>${esc(g)}</span><span>${groups.get(g).length}</span></div>` : '<div style="height:10px"></div>') + '<div class="cards">' + groups.get(g).map(it => {
      const r = s.row(it), ro = it.readOnly, on = s.tick && it[s.tick];
      return `<div class="row ${on ? 'done' : ''}" data-id="${esc(it.id)}">${ro ? '' : '<button type="button" class="row-del" data-del>Delete</button>'}
        <div class="row-main" data-open>${selMode && tab === 'groceries' ? `<button type="button" class="selbox ${selected.has(it.id) ? 'on' : ''}" data-sel aria-label="Select">${CHECK}</button>` : s.tick ? `<button type="button" class="tick ${on ? 'on' : ''}" data-tick aria-label="${on ? 'Mark not done' : 'Mark done'}">${CHECK}</button>` : r.lead || ''}
        <div class="row-text"><div class="row-title">${r.title}</div>${r.sub ? `<div class="row-sub">${r.sub}</div>` : ''}</div>${(s.trash || ['chores', 'events'].includes(tab)) && !ro && !selMode ? `<button type="button" class="trash" data-del aria-label="Delete">${TRASH}</button>` : '<span class="chev">›</span>'}</div></div>`;
    }).join('') + '</div>').join('');
    if (s.tick) html += `<p class="hint">Tap the circle to tick off. Tap 🗑 or swipe left to delete.</p>`;
    else if (!['calendars'].includes(tab)) html += `<p class="hint">Tap to edit. Tap 🗑 or swipe left to delete.</p>`;
    if (tab === 'calendars') html += `<button type="button" class="btn big" id="syncNow" style="margin-top:16px">🔄 Sync now</button>`;
  }
  if (tab === 'groceries') html = foodSeg() + shopTools() + html + shopFooter();
  if (tab === 'events') html = scanHint() + html;
  if (tab === 'recipes') html = recipeTools() + html;
  if (tab === 'wishes') html = wishTools() + html;
  if (tab === 'dates') html = datesTools() + html;
  if (tab === 'usuals' || tab === 'stores') html = `<button type="button" class="link back" data-tab-go="groceries">‹ Shopping</button>` + html;
  if (tab === 'people' && data.people.length) html += famMenu();
  if (tab === 'calendars') html = `<button type="button" class="link back" data-tab-go="more">‹ More</button>` + html + helpHtml();
  $('#list').innerHTML = html;
}

function helpHtml() {
  return `<div class="help"><div class="group" style="margin:14px 0 4px">How to find your calendar link</div>
  <details><summary>Google Calendar</summary><ol>
    <li>On a computer, open <b>calendar.google.com</b> (the phone app can’t show this link).</li>
    <li>On the left, point at the calendar → <b>⋮</b> → <b>Settings and sharing</b>.</li>
    <li>Scroll to <b>Integrate calendar</b> and copy <b>Secret address in iCal format</b>.</li>
    <li>Send it to your phone (e.g. email it to yourself), then paste it here.</li></ol></details>
  <details><summary>iPhone / iCloud Calendar</summary><ol>
    <li>Open the <b>Calendar</b> app → <b>Calendars</b> at the bottom.</li>
    <li>Tap the <b>ⓘ</b> next to the calendar → turn on <b>Public Calendar</b>.</li>
    <li>Tap <b>Share Link…</b> → <b>Copy</b>, then paste it here (it starts with webcal://).</li>
    <li>Note: anyone with that link can view the calendar, so keep it private.</li></ol></details>
  <details><summary>Outlook / Microsoft 365</summary><ol>
    <li>On outlook.com: <b>Settings</b> → <b>Calendar</b> → <b>Shared calendars</b>.</li>
    <li>Under <b>Publish a calendar</b>, pick the calendar, choose <b>Can view all details</b>, <b>Publish</b>.</li>
    <li>Copy the <b>ICS</b> link and paste it here.</li></ol></details></div>`;
}

// ---------------------------------------------------------------- sheet
let current = null;
function openSheet(item, isNew) {
  const s = S[tab]; current = { item, isNew };
  const ro = item.readOnly;
  $('#formTitle').textContent = ro ? 'Synced event' : (isNew ? 'New ' : 'Edit ') + s.noun;
  $('#saveBtn').hidden = !!ro; $('#saveBottom').hidden = !!ro;
  $('#fields').innerHTML = ro ? readOnlyHtml(item) : s.fields(item);
  const list = s.items();
  $('#extra').innerHTML = !ro && !isNew && s.sortable && list.length > 1 ? `<div class="order"><button type="button" class="btn" data-move="-1">↑ Move up</button><button type="button" class="btn" data-move="1">↓ Move down</button></div>` : '';
  $('#del').hidden = isNew || !!ro;
  $('#del').textContent = 'Delete ' + s.noun;
  const f = $('#form');
  f.querySelectorAll('[data-chips]').forEach(box => box.addEventListener('click', ev => {
    const b = ev.target.closest('.chip'); if (!b) return;
    if (!box.dataset.multi && ['type', 'slot', 'color', 'role'].includes(box.dataset.chips) && b.classList.contains('on')) return;   // required choices stay picked
    if (box.dataset.multi || b.classList.contains('on')) b.classList.toggle('on'); else box.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b));   // tap a selected chip again to clear it
  }));
  f.querySelectorAll('.stepper').forEach(st => st.addEventListener('click', ev => {
    const b = ev.target.closest('[data-step]'); if (!b) return;
    const o = st.querySelector('output'); o.value = Math.min(+st.dataset.max, Math.max(+st.dataset.min, (+o.value || 0) + +b.dataset.step)); o.textContent = o.value;
  }));
  if (!ro && s.mount) s.mount(f);
  $('#sheet').showModal();
  $('#sheet .sheet-body').scrollTop = 0;
  // Focus synchronously inside the tap (iOS only opens the keyboard for focus() during a user gesture;
  // a delayed focus() leaves the field "focused" without a keyboard and later taps don't open it).
  if (isNew) { const first = f.querySelector('input:not([type=checkbox]), textarea'); try { first?.focus({ preventScroll: true }); } catch {} }
}
function readOnlyHtml(e) {
  const when = e.allDay ? `${e._s.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · All day`
    : `${e._s.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · ${fmtTime(e._s)} – ${fmtTime(e._e)}`;
  return `<div class="field"><span>What</span>${esc(e.title)}</div><div class="field"><span>When</span>${esc(when)}</div>
    ${e.loc ? `<div class="field"><span>Where</span>${esc(e.loc)}</div>` : ''}${e.notes ? `<div class="field"><span>Notes</span>${esc(e.notes)}</div>` : ''}
    <p class="readonly-note">This event comes from the synced calendar “${esc(e.cal || '')}”. Change it in that calendar app — the screen updates within 15 minutes.</p>`;
}
const closeSheet = () => { $('#sheet').close(); current = null; };
$('#cancel').onclick = closeSheet;
// Close on a tap on the backdrop only if the tap also *started* there (keyboard dismissals and
// text-selection drags on iOS can otherwise end on the backdrop and close the sheet mid-typing).
let downOnBackdrop = false;
$('#sheet').addEventListener('pointerdown', ev => { downOnBackdrop = ev.target === $('#sheet'); });
$('#sheet').addEventListener('click', ev => { if (ev.target === $('#sheet') && downOnBackdrop && !document.activeElement?.matches('input,textarea,select')) closeSheet(); });

// Keep sheets above the on-screen keyboard: size them to the *visual* viewport and scroll the focused field into view.
function fitViewport() {
  const vv = window.visualViewport; if (!vv) return;
  const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  document.documentElement.style.setProperty('--vvh', vv.height + 'px');
  document.documentElement.style.setProperty('--kb', kb + 'px');
}
if (window.visualViewport) { visualViewport.addEventListener('resize', fitViewport); visualViewport.addEventListener('scroll', fitViewport); fitViewport(); }
document.addEventListener('focusin', ev => {
  if (!ev.target.matches('dialog input, dialog textarea, dialog select')) return;
  // scroll only the sheet's own body (scrollIntoView also scrolls the parent page when embedded → jumps/flicker on iOS)
  setTimeout(() => { fitViewport(); const box = ev.target.closest('.sheet-body'); if (!box) return; const r = ev.target.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (r.top < b.top + 8 || r.bottom > b.bottom - 8) box.scrollTo({ top: box.scrollTop + (r.top - b.top) - b.height / 3, behavior: 'auto' }); }, 300);
});

$('#form').addEventListener('submit', async ev => {
  ev.preventDefault();
  const f = $('#form'), s = S[tab], { item } = current;
  const first = [...f.querySelectorAll('[required]')].find(x => !x.value.trim());
  if (first) { first.focus(); toast('Please fill in ' + (first.closest('.field')?.querySelector('span')?.textContent || 'the name')); return; }
  const v = s.validate ? s.validate(f) : true;
  if (v !== true) { toast(v); return; }
  const next = s.read(f, item);
  closeSheet();
  if (tab === 'photos') return savePhotos({ photos: photos.photos.map(p => p.id === next.id ? { id: p.id, show: next.show } : { id: p.id, show: p.show !== false }) });
  if (tab === 'calendars') return saveCalendars(list => { const i = list.findIndex(x => x.id === next.id); if (i >= 0) list[i] = next; else list.push(next); });
  if (tab === 'routine') { const p = famPerson(), L = p.routine = p.routine || [], i = L.findIndex(x => x.id === next.id); if (i >= 0) L[i] = next; else L.push(next); render(); return save('people'); }
  if (tab === 'care') { const c = careOf(), i = c.items.findIndex(x => x.id === next.id); if (i >= 0) c.items[i] = next; else c.items.push(next); render(); return saveCare(); }
  const list = data[tab], i = list.findIndex(x => x.id === item.id);
  if (i >= 0) list[i] = next; else list.push(next);
  render(); await save(tab); if (s.after) s.after();
});
$('#del').onclick = () => { const id = current.item.id; closeSheet(); remove(id); };
$('#extra').addEventListener('click', ev => {
  const b = ev.target.closest('[data-move]'); if (!b) return;
  const list = data[tab], i = list.findIndex(x => x.id === current.item.id), j = i + +b.dataset.move;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]]; closeSheet(); render(); save(tab);
});

function remove(id) {
  // plain lists: delete straight away with an Undo toast (no confirm dialog)
  if (Array.isArray(data[tab]) && !['photos', 'calendars', 'routine', 'care', 'people'].includes(tab)) {
    const i = data[tab].findIndex(x => x.id === id); if (i < 0) return render();
    const [gone] = data[tab].splice(i, 1); lastRemoved = { sec: tab, item: gone, i };
    render(); save(tab); return undoToast('Deleted “' + (gone.title || gone.name || 'item') + '”');
  }
  if (!confirm(`Delete this ${S[tab].noun}?`)) { render(); return; }
  if (tab === 'photos') return deletePhoto(id);
  if (tab === 'calendars') return saveCalendars(list => list.splice(list.findIndex(x => x.id === id), 1));
  if (tab === 'routine') { const p = famPerson(); p.routine = (p.routine || []).filter(x => x.id !== id); render(); return save('people'); }
  if (tab === 'care') { const c = careOf(); c.items = c.items.filter(x => x.id !== id); render(); return saveCare(); }
  data[tab] = data[tab].filter(x => x.id !== id); render(); save(tab);
}

async function saveCalendars(mutate) {
  const list = (cals?.calendars || []).map(c => ({ ...c }));
  mutate(list);
  status('Saving and syncing…');
  try { cals = await api('PUT', 'calendars', list); data = await api('GET', 'data'); render(); status('Saved ✓'); setTimeout(() => status(''), 2000); }
  catch (e) { status(''); toast('Couldn’t save — ' + e.message); }
}

// ---------------------------------------------------------------- list interactions
$('#list').addEventListener('click', ev => {
  if (ev.target.closest('[data-add]')) return openSheet(S[tab].blank(), true);
  if (ev.target.closest('[data-ai]')) return openAi();
  const go = ev.target.closest('[data-tab-go]');
  if (go) { if (go.dataset.pid) { famPid = go.dataset.pid; localStorage.setItem('hq-fam', famPid); } tab = go.dataset.tabGo; if (tab === 'care') care = null; if (FOOD.includes(tab)) localStorage.setItem('hq-food', tab); localStorage.setItem('hq-tab', tab); render(); $('#list').scrollTop = 0; if (tab === 'calendars') loadCals(); if (tab === 'photos') loadPhotos(); if (tab === 'look' || tab === 'preview') loadLook(); return; }
  if (ev.target.closest('#syncNow')) { status('Syncing…'); api('POST', 'calendars/sync').then(async c => { cals = c; data = await api('GET', 'data'); render(); status('Synced ✓'); }).catch(e => toast(e.message)); return; }
  if (ev.target.closest('#lockBtn')) { if (signedIn) { location.href = '/cdn-cgi/access/logout'; return; } return lock(''); }
  const row = ev.target.closest('.row'); if (!row) return;
  const id = row.dataset.id;
  const baseId = tab === 'chores' ? id.split('@')[0] : id;
  if (ev.target.closest('[data-del]')) return remove(baseId);
  if (row.classList.contains('open')) { closeSwipe(row); return; }
  const it = S[tab].items().find(x => x.id === id); if (!it) return;
  if (tab === 'chores' && it._base) {
    const c = data.chores.find(x => x.id === it._base);
    if (ev.target.closest('[data-tick]')) {
      const ds = { ...(c.doneSlots || {}) }; if (!c.doneSlots && c.done && !Array.isArray(c.r)) ds[c.r] = today();
      const k = dkey(c, it._slot, it._pid);
      if (ds[k] === today()) delete ds[k]; else ds[k] = today();
      c.doneSlots = ds; delete c.done; if (!Object.keys(ds).length) delete c.doneBy;
      render(); save(tab); return;
    }
    if (ev.target.closest('[data-open]')) return openSheet(structuredClone(c), false);
  }
  if (ev.target.closest('[data-tick]')) { it[S[tab].tick] = !it[S[tab].tick]; if (!it.done) delete it.doneBy; render(); save(tab); return; }
  if (ev.target.closest('[data-open]')) openSheet(structuredClone(it), false);
});

// swipe-left to reveal Delete (full swipe deletes, with Undo). Real iOS Safari: touchmove must be non-passive
// so we can stop the page/scroller from taking over once the gesture is clearly horizontal; touchcancel resets.
let sw = null;
function closeSwipe(row) { row.classList.remove('open'); row.querySelector('.row-main').style.transform = ''; }
function swipeEnd(cancel) {
  if (!sw) return;
  const { row } = sw; row.classList.remove('swiping');
  if (sw.lock === 'x' && !cancel) {
    const x = sw.base + sw.dx, full = x < -Math.min(220, row.offsetWidth * 0.55);
    if (full) { const id = row.dataset.id; row.querySelector('.row-main').style.transform = 'translateX(-100%)'; sw = null; setTimeout(() => remove(id.split('@')[0]), 150); return; }
    const open = x < -48;
    row.classList.toggle('open', open); row.querySelector('.row-main').style.transform = open ? 'translateX(-96px)' : '';
    const swallow = e => { e.stopPropagation(); e.preventDefault(); };   // ignore the click that may end a swipe
    row.querySelector('.row-main').addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => row.querySelector('.row-main')?.removeEventListener('click', swallow, { capture: true }), 400);
  } else if (cancel) closeSwipe(row);
  sw = null;
}
$('#list').addEventListener('touchstart', ev => {
  if (ev.touches.length > 1) return;
  const row = ev.target.closest('.row'); if (!row || !row.querySelector('.row-del') || ev.target.closest('.row-del, input, textarea')) return;
  document.querySelectorAll('.row.open').forEach(r => r !== row && closeSwipe(r));
  sw = { row, x: ev.touches[0].clientX, y: ev.touches[0].clientY, dx: 0, base: row.classList.contains('open') ? -96 : 0, lock: null };
}, { passive: true });
$('#list').addEventListener('touchmove', ev => {
  if (!sw) return;
  const dx = ev.touches[0].clientX - sw.x, dy = ev.touches[0].clientY - sw.y;
  if (sw.lock === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) sw.lock = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
  if (sw.lock === 'y') { sw = null; return; }
  if (sw.lock !== 'x') return;
  if (ev.cancelable) ev.preventDefault();   // keep iOS from scrolling / rubber-banding mid-swipe
  sw.dx = dx; sw.row.classList.add('swiping');
  sw.row.querySelector('.row-main').style.transform = `translateX(${Math.min(0, sw.base + dx)}px)`;
}, { passive: false });
$('#list').addEventListener('touchend', () => swipeEnd(false));
$('#list').addEventListener('touchcancel', () => swipeEnd(true));
// tap anywhere else closes an open row
document.addEventListener('touchstart', ev => { if (!ev.target.closest('.row.open')) document.querySelectorAll('.row.open').forEach(closeSwipe); }, { passive: true });

$('#tabs').addEventListener('click', ev => {
  const b = ev.target.closest('[data-tab]'); if (!b) return;
  tab = b.dataset.tab; if (tab === 'food') tab = localStorage.getItem('hq-food') || 'meals'; localStorage.setItem('hq-tab', tab); render(); $('#list').scrollTop = 0;
  if (tab === 'calendars') loadCals();
  if (tab === 'photos') loadPhotos();
});
$('#aiFab').onclick = () => openAi();
$('#add').onclick = () => tab === 'photos' ? $('#photoInput').click() : openSheet(S[tab].blank(), true);

// ---------------------------------------------------------------- auth + loading
function lock(msg) {
  // login expired → sign in again. Embedded in a dashboard sheet: never navigate the frame itself (it reloaded the
  // whole dashboard inside the sheet → flicker/zoom loop); ask for a top-level sign-in instead.
  if (signedIn && EMBED) { toast('Your sign-in has expired'); $('#list').innerHTML = '<p class="hint">Your sign-in has expired. <a href="/auth?next=%2F%3Fedit%3D1" target="_top">Sign in again</a></p>'; return; }
  if (signedIn) { location.href = '/auth?next=/edit/'; return; }
  pass = ''; localStorage.removeItem(KEY);
  $('#app').hidden = true; $('#login').hidden = false; $('#loginErr').textContent = msg || '';
}
async function loadCals() { try { cals = await api('GET', 'calendars'); if (tab === 'calendars') render(); } catch (e) { if (tab === 'calendars') $('#list').innerHTML = `<p class="hint">${esc(e.message)}</p>`; } }
async function reload() {
  try { data = await api('GET', 'data'); render(); embedOpen(); } catch (e) { if (e.message !== 'unauthorized') status('Offline — ' + e.message); }
  if (tab === 'calendars') loadCals();
  if (tab === 'photos') loadPhotos();
}
async function unlock() { $('#login').hidden = true; $('#app').hidden = false; if (!S[tab]) tab = 'events'; if (tab === 'look' || tab === 'preview') loadLook(); render(); await reload(); }

$('#loginForm').onsubmit = async ev => {
  ev.preventDefault();
  pass = $('#pass').value.trim();
  try {
    const r = await fetch('/api/auth', { method: 'POST', headers: { 'x-passcode': pass } });
    if (!r.ok) throw new Error(r.status === 401 ? 'That passcode didn’t work.' : 'Server error — try again');
    localStorage.setItem(KEY, pass); unlock();
  } catch (e) { $('#loginErr').textContent = e.message; }
};
document.addEventListener('visibilitychange', () => { if (!document.hidden && pass && !$('#sheet').open) reload(); });
// Signed in with the family login (Cloudflare Access) → no passcode needed. Passcode stays as a fallback.
let signedIn = '';
fetch('/api/me', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null).then(me => {
  if (me && me.email) { signedIn = me.email; unlock(); } else if (pass) unlock(); else lock('');
});


// ---------------------------------------------------------------- add from photo or text (Workers AI)
const KIND = { event: 'events', chore: 'chores', grocery: 'groceries', meal: 'meals' };
const KIND_LABEL = [['event', '📅 Calendar'], ['meal', '🍽️ Meal'], ['chore', '🧹 Chore'], ['grocery', '🛒 Shopping']];
const TRAVEL_ICON = { flight: '✈️', hotel: '🏨', train: '🚆', car: '🚗', other: '🧳' };
let ai = null;

async function scanFile(mode, file) {
  ai = { image: '', items: null, mode };
  renderAiInput(); $('#ai').showModal();
  try { ai.image = await downscale(file, 1280); } catch (e) { renderAiInput(); return toast('Couldn’t read that photo'); }
  runAi();
}
$('#list').addEventListener('change', ev => { const i = ev.target.closest('[data-scan]'); if (i && i.files[0] && i.dataset.scan === 'schoolyear') { scanYear([...i.files]); i.value = ''; return; } if (i && i.files[0]) { scanFile(i.dataset.scan, i.files[0]); i.value = ''; } });
$('#list').addEventListener('click', ev => { if (ev.target.closest('[data-scanhint]')) { try { localStorage.setItem('hq-scan-tip', '1'); } catch (e) {} render(); } });
const AIMODES = [['auto', '✨ Auto-detect'], ['grocery', '🛒 Shopping list'], ['lunch', '🏫 School lunch menu'], ['schoolyear', '📆 School year calendar'], ['schedule', '✈️ Schedule / itinerary / travel'], ['mealplan', '🍝 Meal plan'], ['other', '📝 Other']];
function openAi() {
  ai = { image: '', files: [], items: null, mode: { events: 'schedule', groceries: 'grocery' }[tab] || 'auto' };
  renderAiInput();
  $('#ai').showModal();
}
function renderAiInput() {
  $('#aiTitle').textContent = 'Scan or paste anything';
  $('#aiGo').textContent = 'Read it'; $('#aiGo').hidden = false;
  $('#aiBody').innerHTML = `
    <div class="pick pick3">
      <label>${ico('camera', 28)}Take photo<input type="file" accept="image/*" capture="environment" data-file></label>
      <label>${ico('image', 28)}Choose photos<input type="file" accept="image/*" multiple data-file></label>
      <label>${ico('file', 28)}Choose file / PDF<input type="file" accept="application/pdf,.pdf,image/*" multiple data-pdf></label>
      <button type="button" data-paste>${ico('paste', 28)}Paste text</button>
    </div>
    ${ai.pages && ai.pages.length ? `<p class="hint">📄 ${ai.pages.length} page${ai.pages.length > 1 ? 's' : ''} ready${ai.pdfNote ? ' · ' + esc(ai.pdfNote) : ''} <button type="button" class="link" data-clearpdf>Remove</button></p>` : ''}
    ${ai.files.length > 1 ? `<p class="hint">${ai.files.length} photos selected</p>` : ''}
    ${ai.image ? `<img class="preview" src="${ai.image}" alt="Selected photo"><button type="button" class="link" data-clearimg>Remove photo</button>` : ''}
    ${field('Text (email, message, schedule)', `<textarea id="aiText" rows="4" placeholder="Paste an email or message here…">${esc(ai.text || '')}</textarea>`)}
    ${chips('aimode', 'What is it? (optional — Auto-detect works for anything)', AIMODES, [ai.mode], false)}
    <p class="hint">Nothing is added until you review it on the next screen.</p>`;
  const body = $('#aiBody');
  body.querySelectorAll('[data-file]').forEach(inp => inp.onchange = async () => {
    const fs = [...inp.files]; if (!fs.length) return;
    ai.text = $('#aiText').value; ai.files = fs;
    if (ai.mode === 'schoolyear') return scanYear(fs);
    try { ai.image = await downscale(fs[0], 1280); renderAiInput(); } catch (e) { toast('Couldn’t read that photo'); }
  });
  body.querySelector('[data-pdf]').onchange = async ev => {
    const fs = [...ev.target.files]; if (!fs.length) return;
    ai.text = $('#aiText').value;
    $('#aiBody').innerHTML = progressHtml('Opening file…');
    try { await loadFiles(fs); } catch (e) { toast(e.message || 'Couldn’t open that file'); }
    if (ai.mode === 'schoolyear' && ai.pages.length) return scanYear(ai.pages.map(p => p.blob));
    renderAiInput();
  };
  body.querySelector('[data-clearpdf]')?.addEventListener('click', () => { ai.pages = []; ai.pdfNote = ''; renderAiInput(); });
  body.querySelector('[data-paste]').onclick = async () => {
    const t = $('#aiText');
    try { const c = await navigator.clipboard.readText(); if (c) t.value = c; } catch (e) {}
    t.focus();
  };
  body.querySelector('[data-clearimg]')?.addEventListener('click', () => { ai.text = $('#aiText').value; ai.image = ''; ai.files = []; renderAiInput(); });
  body.querySelector('[data-chips=aimode]').addEventListener('click', ev => {
    const b = ev.target.closest('.chip'); if (!b) return;
    body.querySelectorAll('[data-chips=aimode] .chip').forEach(x => x.classList.toggle('on', x === b)); ai.mode = b.dataset.v;
    if (ai.mode === 'schoolyear' && ai.files.length) scanYear(ai.files);
  });
}
// ---- PDFs: pdf.js (legacy build, lazy-loaded). Each page → its text layer + a JPEG (max 1600px) for vision.
const PDF_MAX_PAGES = 12;
let pdfjs = null;
async function loadPdfjs() {
  if (pdfjs) return pdfjs;
  try { pdfjs = await import(/* @vite-ignore */ '/pdfjs/pdf.min.mjs'); pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs'; return pdfjs; }
  catch (e) { throw new Error('PDFs can’t be opened on this device — take a screenshot of each page instead'); }
}
const canvasBlob = (c, q) => new Promise(res => c.toBlob(res, 'image/jpeg', q));
async function pdfPages(file, budget) {
  const lib = await loadPdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const out = [], n = Math.min(doc.numPages, budget);
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    // rebuild lines from the text layer (items sharing a baseline)
    // pdf.js can hand back one item per glyph — rebuild word runs by baseline + x gap
    const runs = []; let cur = null;
    tc.items.slice().filter(t => t.str !== '').sort((a, b) => (Math.round(b.transform[5]) - Math.round(a.transform[5])) || (a.transform[4] - b.transform[4])).forEach(t => {
      const x = t.transform[4], y = t.transform[5], w = t.width || 0, fs = Math.abs(t.transform[0]) || 10;
      if (cur && Math.abs(cur.y - y) < 2 && x - (cur.x + cur.w) > -2 && x - (cur.x + cur.w) < fs * 0.6) { cur.s += (x - (cur.x + cur.w) > fs * 0.2 && !/\s$/.test(cur.s) && t.str[0] !== ' ' ? ' ' : '') + t.str; cur.w = x + w - cur.x; }
      else runs.push(cur = { s: t.str, x, y, w });
    });
    runs.forEach(r => { r.s = r.s.replace(/\s+/g, ' ').trim(); });
    const items = runs.filter(r => r.s);
    let text = '', lastY = null;
    items.forEach(r => { text += (lastY !== null && Math.abs(r.y - lastY) > 2 ? '\n' : (text ? '   ' : '')) + r.s; lastY = r.y; });
    const v1 = page.getViewport({ scale: 1 }), k = Math.min(3, 1600 / Math.max(v1.width, v1.height)), vp = page.getViewport({ scale: k });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: g, viewport: vp }).promise;
    const blob = await canvasBlob(c, 0.82);
    out.push({ text: text.trim(), image: c.toDataURL('image/jpeg', 0.82), blob, items });
    $('#aiBody').innerHTML = progressHtml(`Opening ${esc(file.name)} — page ${i} of ${n}…`, i, n);
  }
  return { pages: out, total: doc.numPages };
}
async function loadFiles(files) {
  ai.pages = []; ai.pdfNote = ''; let skipped = 0;
  for (const f of files) {
    const left = PDF_MAX_PAGES - ai.pages.length; if (left <= 0) { skipped++; continue; }
    if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
      const { pages, total } = await pdfPages(f, left); ai.pages.push(...pages); skipped += total - pages.length;
    } else ai.pages.push({ text: '', image: await downscale(f, 1280), blob: f });
  }
  // text-heavy pages: the text layer is cheaper and more accurate, so drop the image (keep it for grids / scans)
  ai.pages.forEach(p => { const words = p.text.split(/\s+/).length, gridish = /\b(mon|tue|wed|thu|fri)\b/i.test(p.text) && /\b\d{1,2}\b.*\b\d{1,2}\b/.test(p.text);
    if (words > 60 && !gridish) p.image = ''; });
  if (skipped) ai.pdfNote = `only the first ${PDF_MAX_PAGES} pages are read`;
}
function downscale(file, max) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject; img.src = url;
  });
}
async function runAi() {
  ai.text = $('#aiText')?.value || '';
  if (!ai.image && !ai.text.trim() && !(ai.pages && ai.pages.length)) return toast('Add a photo, PDF or some text first');
  if (ai.mode === 'schoolyear' && ai.pages && ai.pages.length) return scanYear(ai.pages.map(p => p.blob));
  if (ai.mode === 'schoolyear' && ai.files && ai.files.length) return scanYear(ai.files);
  $('#aiGo').hidden = true;
  $('#aiBody').innerHTML = progressHtml('Reading… this usually takes 10–20 seconds');
  const now = new Date();
  try {
    // one call per PDF page (text layer + page image), otherwise a single call; results merged
    const pages = ai.pages && ai.pages.length ? ai.pages : [{ text: '', image: ai.image }];
    const wk = ai.mode !== 'schoolyear' && weeklyFromPdf(pages); if (wk) { ai.weekly = wk; return renderWeekly(); }
    const r = { items: [], travellers: [] };
    for (let i = 0; i < pages.length; i++) {
      if (pages.length > 1) $('#aiBody').innerHTML = progressHtml(`Reading page ${i + 1} of ${pages.length}…`, i + 1, pages.length);
      const pg = await api('POST', 'extract', { text: [ai.text, pages[i].text].filter(Boolean).join('\n\n').slice(0, 8000), image: pages[i].image || '', mode: ai.mode === 'other' ? 'auto' : ai.mode, today: dstr(now),
        weekday: now.toLocaleDateString('en-US', { weekday: 'long' }), tz: Intl.DateTimeFormat().resolvedOptions().timeZone, people: data.people.map(p => p.name) });
      if (pg.doc === 'schoolyear') { r.doc = 'schoolyear'; break; }
      if (pg.doc === 'weeklymenu') { ai.weekly = pg.menu; return renderWeekly(); }
      if (pg.doc === 'recipe') return openRecipeDraft(pg.recipe);
      r.items.push(...(pg.items || [])); r.travellers.push(...(pg.travellers || [])); r.doc = r.doc || pg.doc; r.school = r.school || pg.school;
    }
    r.travellers = [...new Set(r.travellers)];
    if (r.doc === 'schoolyear' && ai.pages && ai.pages.length) return scanYear(ai.pages.map(p => p.blob).filter(Boolean));
    // Auto-detect spotted a whole school-year calendar → school-year flow (all selected photos)
    if (r.doc === 'schoolyear' && ai.image) return scanYear(ai.files && ai.files.length ? ai.files : [await (await fetch(ai.image)).blob()]);
    const toId = n => (data.people.find(p => p.name === n) || {}).id;
    ai.items = r.items.map(it => ({ ...it, on: true, people: (it.people || []).map(toId).filter(Boolean) }));
    ai.travellers = (r.travellers || []).map(toId).filter(Boolean); ai.doc = r.doc; ai.school = r.school;
    // school lunch menus are for the kids who go to school — the AI's per-item guesses don't apply
    ai.bulkWho = null;
    if (r.doc === 'lunchmenu') { const kids = schoolKids().map(p => p.id); ai.bulkWho = kids; ai.items.forEach(it => { it.people = kids.slice(); }); }
    if (ai.items.some(i => i.travel)) { const guess = ai.travellers.length ? ai.travellers : [...new Set(ai.items.flatMap(i => i.travel ? i.people : []))]; ai.travellers = guess; ai.items.forEach(i => { if (i.travel || !i.people.length) i.people = guess.slice(); }); }
    else ai.travellers = null;
    renderReview();
  } catch (e) { toast('Couldn’t read it — ' + e.message); renderAiInput(); }
}
// local wall-clock time in an IANA zone → Date (for flights departing/arriving in other zones)
function zoned(date, time, tz) {
  if (!tz) return new Date(`${date}T${time}`);
  const [y, mo, d] = date.split('-').map(Number), [h, mi] = time.split(':').map(Number);
  const want = Date.UTC(y, mo - 1, d, h, mi);
  const off = t => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(t)).map(x => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - t; };
  let t = want - off(want); t = want - off(t);
  return new Date(t);
}
const pchips = (sel, attr) => `<div class="chips small" ${attr}>${data.people.map(p => `<button type="button" class="chip ${sel.includes(p.id) ? 'on' : ''}" data-v="${p.id}"><i style="background:${esc(p.color)}"></i>${esc(p.name)}</button>`).join('')}</div>`;
const BULK = [['school', '🏫 School lunch'], ['dinner', '🍝 Dinner'], ['event', '📅 Calendar'], ['grocery', '🛒 Shopping'], ['chore', '🧹 Chore']];
$('#aiBody').addEventListener('click', ev => {
  const b = ev.target.closest('[data-bulk]'); if (!b || !ai || !ai.items || ai.sy) return;
  const k = b.dataset.bulk;
  ai.items.forEach(it => { if (it.school === 'noschool' && (k === 'school' || k === 'dinner')) return;   // keep no-school days as calendar
    if (k === 'school' || k === 'dinner') { it.kind = 'meal'; it.slot = k; } else it.kind = k; });
  renderReview(); toast('Changed all ✓');
});
const SECTION_NAME = { meal: 'Meals', event: 'Calendar', grocery: 'Shopping', chore: 'Chores' };
function reviewSummary() {
  const n = ai.items.length, lunches = ai.items.filter(i => i.kind === 'meal' && i.slot === 'school');
  if (ai.doc === 'lunchmenu' && lunches.length) { const d = ymd(lunches[0].date); return `Found ${lunches.length} school lunches for ${d.toLocaleDateString([], { month: 'short', year: 'numeric' })}`; }
  if (ai.travellers) return `Found ${n} travel item${n > 1 ? 's' : ''}`;
  return `Found ${n} item${n > 1 ? 's' : ''}`;
}
function renderReview() {
  const sel = ai.items.filter(i => i.on), n = sel.length;
  $('#aiTitle').textContent = 'Review'; $('#aiGo').hidden = true;
  if (!ai.items.length) {
    $('#aiBody').innerHTML = `<div class="empty nice"><div class="empty-ic">${ico('sparkle', 34)}</div><h3>Nothing found</h3><p>Try a sharper, straight-on photo — or paste the text instead.</p><button type="button" class="btn big" data-back>Try again</button></div>`;
    return;
  }
  ai.open = ai.open || new Set();
  const kinds = new Set(sel.map(i => i.kind)), kind1 = kinds.size === 1 ? [...kinds][0] : null;
  const typeOn = k => sel.length && sel.every(i => k === 'school' ? i.kind === 'meal' && i.slot === 'school' : k === 'dinner' ? i.kind === 'meal' && i.slot === 'dinner' : i.kind === k);
  const opt = (list, v) => list.map(([k, t]) => `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(t)}</option>`).join('');
  const tinfo = it => it.travel ? `<div class="row-sub" style="margin-top:6px">${esc([TRAVEL_ICON[it.travel] + ' ' + it.travel, it.flight || it.airline, it.from && it.to ? it.from + ' → ' + it.to : '', it.confirmation ? 'Conf ' + it.confirmation : ''].filter(Boolean).join(' · '))}</div>` : '';
  const pill = it => { if (!it.date) return `<span class="date-pill none">${it.kind === 'grocery' ? '🛒' : '—'}</span>`; const d = ymd(it.date); return `<span class="date-pill"><b>${d.toLocaleDateString([], { weekday: 'short' })}</b>${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>`; };
  const summary = `<div class="rv-sum">
    <div class="rv-head"><h3>${esc(reviewSummary())}</h3>${ai.school ? `<span class="badge-soft">${ico('file', 14)} ${esc(ai.school)}</span>` : ''}</div>
    <div class="rv-field"><span>Type</span><div class="seg-scroll">${BULK.map(([k, t]) => `<button type="button" class="segbtn ${typeOn(k) ? 'on' : ''}" data-bulk="${k}">${t.replace(/^\S+\s/, '')}</button>`).join('')}</div></div>
    ${ai.travellers ? `<div class="rv-field"><span>Who’s travelling</span>${pchips(ai.travellers, 'data-travellers')}</div>` : `<div class="rv-field"><span>For</span>${pchips(ai.bulkWho || [], 'data-bulkwho')}</div>`}
    <div class="rv-sel"><button type="button" class="link" data-allsel="1">Select all</button><button type="button" class="link" data-allsel="0">Select none</button><span>${n} of ${ai.items.length} selected</span></div></div>`;
  const rows = ai.items.map((it, i) => { const open = ai.open.has(i);
    return `<div class="rv-row ${it.on ? 'on' : 'off'} ${open ? 'open' : ''}" data-i="${i}">
      <div class="rv-main"><input type="checkbox" data-f="on" ${it.on ? 'checked' : ''} aria-label="Include">${pill(it)}<span class="rv-t">${esc(it.title)}${it.kind === 'event' && it.start ? ` <small>${esc(it.start)}</small>` : ''}</span><button type="button" class="rv-x" data-expand aria-label="Edit">${ico('chev', 18)}</button></div>
      ${open ? `<div class="rv-edit">
        <input type="text" data-f="title" value="${esc(it.title)}" aria-label="Title">
        <div class="mini"><select data-f="kind">${opt(KIND_LABEL, it.kind)}</select>${it.kind === 'meal' ? `<select data-f="slot">${opt(MEALS.map(m => [m[0], m[1]]), it.slot)}</select>` : '<span></span>'}</div>
        ${it.kind !== 'grocery' ? pchips(it.people || [], 'data-ipeople') : ''}
        ${it.kind === 'event' ? `<div class="mini three"><input type="date" data-f="date" value="${esc(it.date)}"><input type="time" data-f="start" value="${esc(it.start)}" aria-label="Start time"><input type="time" data-f="end" value="${esc(it.end)}" aria-label="End time"></div>${tinfo(it)}` : ''}
        ${it.kind === 'meal' ? `<div class="mini"><input type="date" data-f="date" value="${esc(it.date)}"><span></span></div>` : ''}
        ${it.kind === 'grocery' ? `<div class="mini"><input type="number" inputmode="numeric" min="1" data-f="qty" value="${it.qty || 1}" aria-label="Quantity"><span></span></div>` : ''}
        ${it.notes ? `<p class="muted small">${esc(it.notes)}</p>` : ''}</div>` : ''}</div>`; }).join('');
  const cnt = {}; sel.forEach(i => { cnt[i.kind] = (cnt[i.kind] || 0) + 1; }); const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
  const label = n ? `Add ${n} to ${top && cnt[top] >= n * 0.7 ? SECTION_NAME[top] : 'the dashboard'}` : 'Nothing selected';
  $('#aiBody').innerHTML = summary + `<div class="rv-list">${rows}</div><button type="button" class="link" data-back style="margin:12px 0 4px">← Start over</button>
    <div class="rv-foot"><button type="button" class="btn primary big" data-addall ${n ? '' : 'disabled'}>${esc(label)}</button></div>`;
  $('#aiBody').oninput = $('#aiBody').onchange = ev => {
    const box = ev.target.closest('[data-i]'); if (!box) return;
    const it = ai.items[+box.dataset.i], f = ev.target.dataset.f; if (!f) return;
    it[f] = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
    if (f === 'on' || f === 'kind' || f === 'slot') renderReview();
  };
}
$('#aiBody').addEventListener('click', ev => {
  if (!ai || ai.sy) return;
  if (ev.target.closest('[data-addall]')) return $('#aiGo').onclick();
  if (ai.weekly && ev.target.closest('[data-wsave]')) return saveWeekly();
  const ws = ev.target.closest('[data-wschool]'); if (ws && ai.weekly) { ai.wSchool = ws.dataset.wschool; return renderWeekly(); }
  const wk = ev.target.closest('[data-wkids] .chip'); if (wk && ai.weekly) { const id = wk.dataset.v; ai.wKids = ai.wKids.includes(id) ? ai.wKids.filter(x => x !== id) : [...ai.wKids, id]; ev.stopPropagation(); return renderWeekly(); }
  if (!ai.items) return;
  const a = ev.target.closest('[data-allsel]'); if (a) { ai.items.forEach(i => { i.on = a.dataset.allsel === '1'; }); return renderReview(); }
  const x = ev.target.closest('[data-expand]') || (ev.target.closest('.rv-t, .date-pill') && ev.target.closest('.rv-main'));
  if (x) { const i = +ev.target.closest('[data-i]').dataset.i; ai.open.has(i) ? ai.open.delete(i) : ai.open.add(i); renderReview(); }
}, true);

// ---- weekly repeating menu review (e.g. school breakfast for the year)
// Read a weekly repeating menu straight from a PDF's text layer: weekday header rows give the columns,
// each header row starts a school block. Exact and instant when the PDF has real text.
function weeklyFromPdf(pages) {
  const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'], schools = []; let meal = 'breakfast', year = '';
  for (const pg of pages) {
    const its = pg.items || []; if (!its.length) continue;
    const all = its.map(t => t.s).join(' ');
    if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/i.test(all)) continue;   // dated → not weekly
    if (/lunch/i.test(all) && !/breakfast/i.test(all)) meal = 'lunch';
    const y = all.match(/\b(20\d\d)\s*[-–\/]\s*(20)?\d\d\b/); if (y) year = `${y[1]}-${+y[1] + 1}`;
    const heads = its.filter(t => DAYS.includes(t.s.toUpperCase().replace(/[^A-Z]/g, '')));
    const rows = []; heads.forEach(h => { let r = rows.find(r => Math.abs(r.y - h.y) < 4); if (!r) rows.push(r = { y: h.y, cols: [] }); r.cols[DAYS.indexOf(h.s.toUpperCase().replace(/[^A-Z]/g, ''))] = h; });
    rows.filter(r => r.cols.filter(Boolean).length === 5).sort((a, b) => b.y - a.y).forEach((r, i, arr) => {
      const next = arr[i + 1] ? arr[i + 1].y : -1e9, mid = c => c.x + c.w / 2, span = (mid(r.cols[4]) - mid(r.cols[0])) / 4;
      const left = mid(r.cols[0]) - span * 0.6, right = mid(r.cols[4]) + span * 0.6;
      const label = its.filter(t => t.y > r.y + 2 && t.y < r.y + 40 && t.x < r.cols[0].x + 10 && !/menu|food service/i.test(t.s)).sort((a, b) => a.y - b.y)[0];
      const block = its.filter(t => t.y < r.y - 2 && t.y > next + 30 && !heads.includes(t));
      const alw = block.find(t => /always available/i.test(t.s));
      const days = {};
      r.cols.forEach((c, d) => {
        const lines = block.filter(t => t !== alw && mid(t) > left && mid(t) < right && Math.abs(mid(t) - mid(c)) < span / 2).sort((a, b) => b.y - a.y).map(t => t.s);
        const merged = []; lines.forEach(l => { const prev = merged[merged.length - 1]; if (prev && (/[&\/,]$|\bw\/$/i.test(prev) || /^[a-z]/.test(l))) merged[merged.length - 1] = prev + ' ' + l; else merged.push(l); });
        days[d + 1] = merged.join(', ').replace(/\bChioice\b/g, 'Choice');
      });
      if (Object.values(days).filter(Boolean).length >= 3) schools.push({ name: label ? label.s : '', days, always: alw ? alw.s.replace(/^.*always available:?\s*/i, '') : '' });
    });
  }
  if (!year) { const n = new Date(), y0 = n.getMonth() >= 6 ? n.getFullYear() : n.getFullYear() - 1; year = `${y0}-${y0 + 1}`; }   // title cropped away → current school year
  return schools.length ? { meal, year, schools } : null;
}
function renderWeekly() {
  const w = ai.weekly, schools = w.schools || [];
  $('#aiTitle').textContent = 'Review'; $('#aiGo').hidden = true;
  if (!schools.length) { $('#aiBody').innerHTML = `<div class="empty nice"><div class="empty-ic">${ico('sparkle', 34)}</div><h3>Couldn’t read the menu</h3><p>Try a clearer photo or the PDF.</p><button type="button" class="btn big" data-back>Try again</button></div>`; return; }
  const kids = schoolKids();
  if (!ai.wKids) ai.wKids = kids.map(p => p.id);
  if (!ai.wSchool) {
    const norm = x => String(x || '').toLowerCase().replace(/[^a-z]/g, '');
    const known = [...kids.map(p => p.schoolName), localStorage.getItem('hq-last-school')].filter(Boolean).map(norm);
    ai.wSchool = (schools.find(x => known.some(k => k && (norm(x.name).includes(k) || k.includes(norm(x.name))))) || schools[0]).name;
  }
  const sc = schools.find(x => x.name === ai.wSchool) || schools[0];
  const mealName = w.meal === 'lunch' ? 'lunch' : 'breakfast';
  $('#aiBody').innerHTML = `<div class="rv-sum">
      <div class="rv-head"><h3>Found a weekly ${mealName} menu</h3><span class="badge-soft">Repeats every school week${w.year ? ' · ' + esc(w.year) : ''}</span></div>
      ${schools.length > 1 ? `<div class="rv-field"><span>Which school?</span><div class="seg-scroll">${schools.map(x => `<button type="button" class="segbtn ${x.name === sc.name ? 'on' : ''}" data-wschool="${esc(x.name)}">${esc(x.name || 'School')}</button>`).join('')}</div></div>` : ''}
      <div class="rv-field"><span>For</span>${pchips(ai.wKids, 'data-wkids')}</div></div>
    <div class="rv-list week-prev">${[1, 2, 3, 4, 5].map(d => `<div class="rv-row on"><div class="rv-main"><span class="date-pill"><b>${WDN[d]}</b>every</span><span class="rv-t">${esc(sc.days[d] || '—')}</span></div></div>`).join('')}
      ${sc.always ? `<div class="rv-row on"><div class="rv-main"><span class="date-pill none">∞</span><span class="rv-t"><small>Always available</small> ${esc(sc.always)}</span></div></div>` : ''}</div>
    <p class="muted small" style="margin:12px 4px">Shown on school days only — skips weekends and no-school days.</p>
    <button type="button" class="link" data-back>← Start over</button>
    <div class="rv-foot"><button type="button" class="btn primary big" data-wsave ${ai.wKids.length ? '' : 'disabled'}>Save ${mealName} menu for ${esc(ai.wKids.map(id => person(id).name).join(' & ') || '…')}</button></div>`;
}
async function saveWeekly() {
  const w = ai.weekly, sc = w.schools.find(x => x.name === ai.wSchool) || w.schools[0];
  if (!ai.wKids.length) return toast('Pick who it’s for');
  data.menus = (data.menus || []).filter(m => !(m.meal === w.meal && m.school === sc.name));
  data.menus.push(clean({ id: uid('mn'), meal: w.meal, school: sc.name, days: sc.days, always: sc.always || undefined, year: w.year || undefined, kids: ai.wKids.slice() }));
  const body = { menus: data.menus };
  if (sc.name) { let touched = false; ai.wKids.forEach(id => { const p = data.people.find(x => x.id === id); if (p && !p.schoolName) { p.schoolName = sc.name; touched = true; } }); if (touched) body.people = data.people; try { localStorage.setItem('hq-last-school', sc.name); } catch (e) {} }
  $('#ai').close(); ai = null; status('Saving…');
  try { data = await api('PUT', 'data', body); render(); status('Saved ✓'); setTimeout(() => status(''), 2000); toast('Menu saved ✓'); } catch (e) { status(''); toast('Couldn’t save — ' + e.message); }
}
$('#aiBody').addEventListener('click', ev => {
  const c = ev.target.closest('.chip'); if (!c || !ai || !ai.items) return;
  const id = c.dataset.v;
  if (c.closest('[data-bulkwho]')) {   // "Who's it for?" — sets every ticked item to exactly this set
    ai.bulkWho = ai.bulkWho || [];
    ai.bulkWho = ai.bulkWho.includes(id) ? ai.bulkWho.filter(x => x !== id) : [...ai.bulkWho, id];
    ai.items.forEach(it => { if (it.on && it.kind !== 'grocery') it.people = ai.bulkWho.slice(); });
    renderReview(); return;
  }
  if (c.closest('[data-travellers]')) {
    const on = !ai.travellers.includes(id);
    ai.travellers = on ? [...ai.travellers, id] : ai.travellers.filter(x => x !== id);
    ai.items.forEach(it => { it.people = on ? [...new Set([...(it.people || []), id])] : (it.people || []).filter(x => x !== id); });
    renderReview(); return;
  }
  const box = c.closest('[data-i]'); if (!box || !c.closest('[data-ipeople]')) return;
  const it = ai.items[+box.dataset.i]; it.people = it.people.includes(id) ? it.people.filter(x => x !== id) : [...it.people, id];
  c.classList.toggle('on');
});
$('#aiBody').addEventListener('click', ev => { if (ev.target.closest('[data-back]')) { ai.items = null; renderAiInput(); } });
$('#aiCancel').onclick = () => { $('#ai').close(); ai = null; };
$('#aiGo').onclick = async () => {
  if (ai && ai.sy) return addSchoolYear();
  if (!ai.items) return runAi();
  const picked = ai.items.filter(i => i.on && i.title.trim());
  if (!picked.length) return toast('Nothing selected');
  const bad = picked.find(i => (i.kind === 'event' || i.kind === 'meal') && !i.date);
  if (bad) return toast(`Pick a date for “${bad.title}”`);
  const touched = new Set();
  for (const it of picked) {
    const ppl = it.people || [];
    if (it.kind === 'event') {
      const allDay = !it.start;
      let start, end;
      if (allDay) {
        start = new Date(`${it.date}T00:00`);
        // hotels: check-out day is exclusive (you leave that morning)
        const last = it.endDate && it.endDate >= it.date ? it.endDate : it.date;
        end = new Date(ymd(last).getTime() + (it.travel === 'hotel' && last > it.date ? 0 : 864e5));
      } else {
        start = zoned(it.date, it.start, it.startTz);
        end = it.end ? zoned(it.endDate && it.endDate >= it.date ? it.endDate : it.date, it.end, it.endTz || it.startTz) : new Date(+start + 36e5);
        if (end <= start) end = new Date(+start + 36e5);
      }
      const extra = it.travel ? [it.airline && it.flight ? `${it.airline} ${it.flight}` : it.flight || it.airline, it.from && it.to ? `${it.from} → ${it.to}` : '',
        it.endTz && it.end ? `Arrives ${it.end} local (${it.endTz})` : '', it.confirmation ? `Confirmation: ${it.confirmation}` : ''].filter(Boolean).join('\n') : '';
      if (it.school) { data.events.push(clean({ id: uid('e'), title: (SY[it.school] || SY.other)[0] + ' ' + it.title.trim(), allDay: true, start: new Date(`${it.date}T00:00`).toISOString(), end: new Date(ymd(it.endDate && it.endDate >= it.date ? it.endDate : it.date).getTime() + 864e5).toISOString(),
        people: ppl.length ? ppl : schoolKids().map(p => p.id), school: it.school, cat: 'school' })); touched.add('events'); continue; }
      data.events.push(clean({ id: uid('e'), title: (it.travel ? TRAVEL_ICON[it.travel] + ' ' : '') + it.title.trim(), allDay: allDay || undefined, start: start.toISOString(), end: end.toISOString(),
        people: ppl, loc: it.location || (it.travel === 'flight' && it.from ? it.from : undefined), notes: [extra, it.notes].filter(Boolean).join('\n') }));
    } else if (it.kind === 'meal') {
      data.meals = data.meals || [];
      data.meals.push(clean({ id: uid('m'), date: it.date || today(), slot: it.slot || 'dinner', title: it.title.trim(), for: ppl.length ? ppl : undefined, notes: it.notes }));
    } else if (it.kind === 'chore') {
      data.chores.push({ id: uid('c'), r: ['anytime'], who: ppl.length > 1 ? ppl : ppl[0] || 'any', title: it.title.trim(), emoji: '✅', stars: 1 });
    } else {
      data.groceries.push(clean({ id: uid('g'), name: it.title.trim(), cat: 'Pantry', qty: Math.max(1, +it.qty || 1), store: 'grocer', done: false, note: it.notes }));
    }
    touched.add(KIND[it.kind]);
  }
  if (ai.doc === 'lunchmenu' && ai.school) {
    try { localStorage.setItem('hq-last-school', ai.school); } catch (e) {}
    (ai.bulkWho || []).forEach(id => { const p = data.people.find(x => x.id === id); if (p && !p.schoolName) { p.schoolName = ai.school; touched.add('people'); } });
  }
  $('#ai').close(); ai = null;
  status('Saving…');
  try {
    const body = {}; touched.forEach(sec => { body[sec] = data[sec]; });
    data = await api('PUT', 'data', body); render(); status('Saved ✓'); setTimeout(() => status(''), 2000);
  } catch (e) { status(''); return toast('Couldn’t save — ' + e.message); }
  toast(`Added ${picked.length} item${picked.length > 1 ? 's' : ''} ✓`);
};


// ---------------------------------------------------------------- school-year calendar scan
const SY = { noschool: ['🏖️', 'No school'], vacation: ['🌴', 'Vacation'], half: ['🕛', 'Half day'], first: ['🎒', 'First day'], last: ['🎉', 'Last day'], pd: ['🧑‍🏫', 'PD day (no school)'], conference: ['🗣️', 'Conferences'], picture: ['📸', 'Picture day'], other: ['🏫', 'School'] };
const OFF = ['noschool', 'vacation', 'pd'];
// is there a no-school / half-day school event for this kid on this date?
function schoolDay(ds, pid) {
  const hit = (data.events || []).filter(e => e.school && e.allDay && (!e.people || !e.people.length || e.people.includes(pid)) && dstr(new Date(e.start)) <= ds && ds < dstr(new Date(e.end)));
  return { off: hit.find(e => OFF.includes(e.school)), half: hit.find(e => e.school === 'half') };
}
// School calendar link: Google Doc / Sheet / web page / PDF → school-year review; .ics → normal calendar sync
async function scanYearLink(url, school) {
  ai = { sy: true, items: null, mode: 'schoolyear' };
  $('#aiTitle').textContent = 'School year calendar'; $('#aiGo').hidden = true; $('#ai').showModal();
  $('#aiBody').innerHTML = progressHtml('Fetching the calendar link…');
  let r; try { r = await api('POST', 'fetch-link', { url }); } catch (e) { $('#aiBody').innerHTML = `<div class="empty nice"><div class="empty-ic">${ico('file', 34)}</div><h3>Couldn’t open the link</h3><p>${esc(e.message)}</p><button type="button" class="btn big" data-back>OK</button></div>`; return; }
  if (r.kind === 'ics') { $('#ai').close(); ai = null; toast('That’s a calendar feed — add it as a synced calendar'); location.hash = ''; tab = 'calendars'; render(); openSheet({ id: uid('k'), name: (school || 'School') + ' calendar', url: r.url, who: 'family' }, true); return; }
  let chunks = [];
  if (r.kind === 'pdf') {
    const bin = atob(r.b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const pages = await pdfPages(new File([u8], 'calendar.pdf', { type: 'application/pdf' }));
    chunks = pages.map(p => p.text && p.text.length > 200 ? { text: p.text.slice(0, 7500) } : p.blob);
  } else {
    let cur = ''; r.text.split('\n').forEach(l => { if ((cur + l).length > 6500) { chunks.push({ text: cur }); cur = ''; } cur += l + '\n'; }); if (cur.trim()) chunks.push({ text: cur });
  }
  return scanYear(chunks, { url, school: school || '' });
}
async function scanYear(files, link) {
  ai = { sy: true, items: null, mode: 'schoolyear', link };
  $('#aiTitle').textContent = 'School year calendar'; $('#aiGo').hidden = true; $('#ai').showModal();
  const all = [], errs = [];
  for (let i = 0; i < files.length; i++) {   // one AI call per photo/page (chunked), merged below
    $('#aiBody').innerHTML = progressHtml(`Reading page ${i + 1} of ${files.length}… (about 20–40 seconds each)`, i + 1, files.length);
    try {
      const f = files[i], body = f && f.text ? { text: f.text } : { image: await downscale(f, 1600) };
      const r = await api('POST', 'extract', { ...body, mode: 'schoolyear', today: today(), tz: 'America/New_York' });
      all.push(...(r.items || []));
    } catch (e) { errs.push(`Page ${i + 1}: ${e.message}`); }
  }
  if (!ai) return;
  const seen = new Set(), kids = schoolKids().map(p => p.id);
  ai.items = all.filter(it => { const k = it.date + '|' + it.school; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.date < b.date ? -1 : 1)
    .map(it => { const dup = (data.events || []).some(e => e.allDay && dstr(new Date(e.start)) === it.date && (e.school === it.school || e.title.replace(/^\S+ /, '').toLowerCase() === it.title.toLowerCase()));
      return { ...it, dup, on: !dup }; });
  ai.kids = kids; ai.errs = errs;
  renderSchoolReview();
}
function renderSchoolReview() {
  const n = ai.items.filter(i => i.on).length;
  $('#aiTitle').textContent = 'Review school year'; $('#aiGo').hidden = false; $('#aiGo').textContent = n ? `Add ${n}` : 'Add';
  if (!ai.items.length) { $('#aiBody').innerHTML = `<div class="empty"><div class="big-emoji">🤔</div><h3>Nothing found</h3><p>${esc(ai.errs.join(' · ') || 'Try a sharper photo of each page, straight on.')}</p></div>`; return; }
  const children = data.people.filter(p => p.role !== 'parent');
  const months = {}; ai.items.forEach((it, i) => { const k = it.date.slice(0, 7); (months[k] = months[k] || []).push([it, i]); });
  const fd = d => ymd(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  $('#aiBody').innerHTML = `
    <div class="ai-who"><b>Which kids does this apply to?</b>
      <div class="chips" data-sykids>${children.map(p => `<button type="button" class="chip ${ai.kids.includes(p.id) ? 'on' : ''}" data-v="${p.id}">${esc(p.name)}</button>`).join('')}</div>
      ${ai.kids.length ? '' : '<p class="hint" style="text-align:left;margin:4px 0 0">Pick at least one child.</p>'}</div>
    ${ai.errs.length ? `<p class="hint" style="color:#B42318">${esc(ai.errs.join(' · '))}</p>` : ''}
    <div class="shop-actions"><button type="button" class="btn" data-syall="1">Select all</button><button type="button" class="btn" data-syall="0">Select none</button></div>
    ${Object.keys(months).sort().map(k => `<div class="group"><span>${ymd(k + '-01').toLocaleDateString([], { month: 'long', year: 'numeric' })}</span></div><div class="card">
      ${months[k].map(([it, i]) => `<label class="sy-row ${it.dup ? 'dup' : ''}"><input type="checkbox" data-syi="${i}" ${it.on ? 'checked' : ''}>
        <span class="sy-ico">${(SY[it.school] || SY.other)[0]}</span><span class="sy-t"><b>${esc(it.title)}</b>
        <small>${fd(it.date)}${it.endDate ? ' – ' + fd(it.endDate) : ''} · ${(SY[it.school] || SY.other)[1]}${it.dismiss ? ' · out at ' + hm12(it.dismiss) : ''}${it.dup ? ' · already on calendar' : ''}</small></span></label>`).join('')}</div>`).join('')}`;
}
const hm12 = t => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`; };
$('#aiBody').addEventListener('change', ev => { if (!ai || !ai.sy) return; const c = ev.target.closest('[data-syi]'); if (c) { ai.items[+c.dataset.syi].on = c.checked; $('#aiGo').textContent = `Add ${ai.items.filter(i => i.on).length}`; } });
$('#aiBody').addEventListener('click', ev => {
  if (!ai || !ai.sy) return;
  const a = ev.target.closest('[data-syall]'); if (a) { ai.items.forEach(i => { i.on = a.dataset.syall === '1'; }); renderSchoolReview(); return; }
  const k = ev.target.closest('[data-sykids] .chip'); if (k) { const id = k.dataset.v; ai.kids = ai.kids.includes(id) ? ai.kids.filter(x => x !== id) : [...ai.kids, id]; renderSchoolReview(); ev.stopPropagation(); }
}, true);
async function addSchoolYear() {
  const picked = ai.items.filter(i => i.on);
  if (!picked.length) return toast('Nothing selected');
  if (!ai.kids.length) return toast('Pick which kids this applies to');
  picked.forEach(it => {
    const last = it.endDate && it.endDate >= it.date ? it.endDate : it.date;
    const ico = (SY[it.school] || SY.other)[0];
    data.events.push(clean({ id: uid('e'), title: `${ico} ${it.title}`, allDay: true, start: new Date(`${it.date}T00:00`).toISOString(), end: new Date(ymd(last).getTime() + 864e5).toISOString(),
      people: ai.kids.slice(), school: it.school, dismiss: it.dismiss || undefined, cat: 'school', notes: it.dismiss ? `Early dismissal ${hm12(it.dismiss)}` : undefined }));
  });
  const body = { events: data.events };
  if (ai.link) { data.schools = (data.schools || []).filter(x => x.url !== ai.link.url && (!ai.link.school || x.name !== ai.link.school)); data.schools.push({ id: uid('sc'), name: ai.link.school, url: ai.link.url, checked: new Date().toISOString() }); body.schools = data.schools; }
  $('#ai').close(); ai = null; status('Saving…');
  try { data = await api('PUT', 'data', body); render(); status('Saved ✓'); setTimeout(() => status(''), 2000); toast(`Added ${picked.length} school dates ✓`); }
  catch (e) { status(''); toast('Couldn’t save — ' + e.message); }
}

// ---------------------------------------------------------------- photos + screensaver settings
async function loadPhotos() {
  try { photos = await (await fetch('/api/photos', { cache: 'no-store' })).json(); if (tab === 'photos') render(); }
  catch (e) { if (tab === 'photos') $('#list').innerHTML = `<p class="hint">Couldn’t load photos</p>`; }
}
function renderPhotos() {
  if (!photos) { $('#list').innerHTML = '<p class="hint">Loading…</p>'; return; }
  const st = photos.settings, list = photos.photos, on = list.filter(p => p.show !== false).length;
  const step = (k, label, v, min, max, unit) => `<div class="set-row"><span>${label}</span><div class="stepper" data-set="${k}" data-min="${min}" data-max="${max}">
    <button type="button" data-step="-1" aria-label="Less">−</button><output>${v}</output><small>${unit}</small><button type="button" data-step="1" aria-label="More">+</button></div></div>`;
  $('#list').innerHTML = `
    <div class="group"><span>Screensaver</span><span>${on} of ${list.length} showing</span></div>
    <div class="cards settings">
      ${step('idleMin', 'Start after', st.idleMin, 1, 240, 'min')}
      ${step('secs', 'Each photo', st.secs, 4, 120, 'sec')}
      <label class="switch">Shuffle<input type="checkbox" data-set="shuffle" ${st.shuffle ? 'checked' : ''}></label>
      <label class="switch">Slow zoom (Ken Burns)<input type="checkbox" data-set="kenBurns" ${st.kenBurns ? 'checked' : ''}></label>
    </div>
    <div class="group"><span>Photos</span><span>${list.length}</span></div>
    ${list.length ? `<div class="pgrid">${list.map(p => `<button type="button" class="ptile ${p.show === false ? 'off' : ''}" data-photo="${esc(p.id)}" aria-label="Photo options">
        <img loading="lazy" src="/api/photo/${esc(p.id)}?v=t" alt=""><span class="pbadge">${p.show === false ? 'Hidden' : '✓'}</span></button>`).join('')}</div>
      <p class="hint">Tap a photo to hide it from the screensaver or delete it.</p>`
    : `<div class="empty"><div class="big-emoji">🖼️</div><h3>No photos yet</h3><p>Add family photos from your camera roll — they’ll play on the kitchen screen when nobody’s using it.</p><button type="button" class="btn primary big" data-addphotos>＋ Add photos</button></div>`}
    <input type="file" id="photoInput" accept="image/*" multiple hidden>`;
}
let setTimer = null;
$('#list').addEventListener('click', ev => {
  if (tab !== 'photos') return;
  if (ev.target.closest('[data-addphotos]')) { $('#photoInput').click(); return; }
  const stp = ev.target.closest('[data-set] [data-step]');
  if (stp) {
    const box = stp.closest('[data-set]'), o = box.querySelector('output');
    const v = Math.min(+box.dataset.max, Math.max(+box.dataset.min, (+o.textContent || 0) + +stp.dataset.step * (box.dataset.set === 'idleMin' && +o.textContent >= 10 ? 5 : 1)));
    o.textContent = v; photos.settings[box.dataset.set] = v;
    clearTimeout(setTimer); setTimer = setTimeout(() => savePhotos({ settings: photos.settings }), 600);
    return;
  }
  const t = ev.target.closest('[data-photo]');
  if (t) { const p = photos.photos.find(x => x.id === t.dataset.photo); if (p) openSheet({ ...p }, false); }
});
$('#list').addEventListener('change', ev => {
  if (tab === 'photos' && ev.target.matches('input[type=checkbox][data-set]')) { photos.settings[ev.target.dataset.set] = ev.target.checked; savePhotos({ settings: photos.settings }); }
  if (ev.target.id === 'photoInput') uploadPhotos([...ev.target.files]);
});
async function savePhotos(body) {
  status('Saving…');
  try {
    const r = await fetch('/api/photos', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-passcode': pass }, body: JSON.stringify(body) });
    if (r.status === 401) return lock('That passcode didn’t work.');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    photos = await r.json(); render(); status('Saved ✓'); setTimeout(() => status(''), 1500);
  } catch (e) { status(''); toast('Couldn’t save — ' + e.message); }
}
async function deletePhoto(id) {
  status('Deleting…');
  try {
    const r = await fetch('/api/photos/' + encodeURIComponent(id), { method: 'DELETE', headers: { 'x-passcode': pass } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    photos = await r.json(); render(); status('Deleted'); setTimeout(() => status(''), 1500);
  } catch (e) { status(''); toast('Couldn’t delete — ' + e.message); }
}
// Decode (incl. HEIC on iPhone, EXIF orientation applied), resize to 3 JPEG sizes, upload one by one.
async function decode(file) {
  if (window.createImageBitmap) { try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch {} }
  return await new Promise((res, rej) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { res(i); }; i.onerror = () => rej(new Error('Unsupported image')); i.src = u; });
}
function jpeg(img, max, q) {
  const w0 = img.width || img.naturalWidth, h0 = img.height || img.naturalHeight, k = Math.min(1, max / Math.max(w0, h0));
  const c = document.createElement('canvas'); c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(b => r({ blob: b, w: c.width, h: c.height }), 'image/jpeg', q));
}
async function uploadPhotos(files) {
  files = files.filter(f => /^image\//.test(f.type) || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name));
  let ok = 0;
  for (let i = 0; i < files.length; i++) {
    status(`Uploading ${i + 1} of ${files.length}…`);
    try {
      const img = await decode(files[i]);
      const full = await jpeg(img, 1600, 0.82), s = await jpeg(img, 1280, 0.8), t = await jpeg(img, 400, 0.75);
      if (img.close) img.close();
      const fd = new FormData();
      fd.append('full', full.blob, 'full.jpg'); fd.append('s', s.blob, 's.jpg'); fd.append('t', t.blob, 't.jpg');
      fd.append('w', full.w); fd.append('h', full.h);
      const r = await fetch('/api/photos', { method: 'POST', headers: { 'x-passcode': pass }, body: fd });
      if (r.status === 401) return lock('That passcode didn’t work.');
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
      photos = { settings: j.settings, photos: j.photos }; ok++; render();
    } catch (e) { toast(`Couldn’t add ${files[i].name || 'a photo'} — ${e.message}`); }
  }
  status(ok ? `Added ${ok} photo${ok > 1 ? 's' : ''} ✓` : ''); setTimeout(() => status(''), 2500);
}


// ---------------------------------------------------------------- More menu
// ---------- iPhone widget (Scriptable) ----------
let wtok, wscript = '';
async function loadWidget() {
  try { wtok = await api('GET', 'widget-token'); } catch (e) { wtok = { error: e.message }; }
  wscript = '';
  if (wtok && wtok.token) { try { const r = await fetch('/widget/HomeHQ.js', { credentials: 'same-origin', headers: { 'x-passcode': pass } }); if (r.ok) { const t = await r.text(); if (t.indexOf('const TOKEN') > -1) wscript = t; } } catch (e) {} }
  if (tab === 'widget') render();
}
function renderWidget(back) {
  if (wtok === undefined) { $('#list').innerHTML = back + '<p class="hint">Loading…</p>'; loadWidget(); return; }
  const has = wtok && wtok.token, step = (n, h, b) => `<div class="w-step"><b>${n}</b><div><div class="w-h">${h}</div>${b ? `<div class="w-b">${b}</div>` : ''}</div></div>`;
  // Scriptable's documented scheme only takes scriptName (it creates/opens an empty script; it can't carry the code)
  const open = 'scriptable:///add?scriptName=' + encodeURIComponent('Home HQ');
  $('#list').innerHTML = back + `<div class="w-hero"><div class="w-mock"><i></i><i></i><i></i></div><p>Today at a glance on your iPhone home screen and Lock Screen: weather, what’s next, who’s where, meals and chores, in your frame’s colours.</p></div>
    <div class="group"><span>Widget key</span></div>
    <div class="cards"><div class="field"><span>${has ? 'Active · made ' + esc(new Date(wtok.created).toLocaleDateString()) : 'No widget key yet'}</span>
      <div class="w-tok">${has ? esc(wtok.token.slice(0, 6)) + '••••••••' : 'Make one to get your script'}</div>
      <div class="w-btns"><button type="button" class="btn primary" id="wNew">${has ? 'Regenerate' : 'Make widget key'}</button>${has ? '<button type="button" class="btn" id="wOff">Revoke</button>' : ''}</div>
      <p class="hint" style="text-align:left;margin:8px 0 0">Read-only: it can see today’s summary but can’t change anything. Regenerate or revoke any time; old widgets stop updating.</p></div></div>
    <div class="group"><span>Set it up (2 minutes)</span></div>
    <div class="cards w-steps">
      ${step(1, 'Install <a href="https://apps.apple.com/app/scriptable/id1405459188">Scriptable</a> (free) from the App Store', 'Open it once.')}
      ${step(2, 'Copy your script', has ? `<div class="w-btns"><button type="button" class="btn primary" id="wCopy">${wscript ? 'Copy script' : 'Loading script…'}</button><button type="button" class="btn" id="wShow">Show script</button></div>
        <span>Copy didn’t work? Tap <b>Show script</b>, then <b>Select all</b> and Copy — or <a href="/widget/HomeHQ.js" target="_blank" rel="noopener">open the script as text</a>.</span>
        <div id="wBox" class="w-box" hidden><textarea readonly rows="8" spellcheck="false" autocapitalize="off" autocorrect="off"></textarea><button type="button" class="btn" id="wSelAll">Select all</button></div>` : 'Make a widget key first.')}
      ${step(3, 'Paste it into Scriptable', has ? `<div class="w-btns"><a class="btn" href="${esc(open)}">Open Scriptable (new “Home HQ” script)</a></div><span>Paste into the new script (or tap <b>+</b> in Scriptable and paste), make sure it’s named <b>Home HQ</b>, then tap ▶︎ to preview.</span>` : '')}
      ${step(4, 'Add the widget', 'Long-press your home screen → <b>Edit</b> → <b>Add Widget</b> → <b>Scriptable</b> → pick Small, Medium or Large → <b>Add Widget</b>.')}
      ${step(5, 'Choose the script', 'Long-press the new widget → <b>Edit Widget</b> → Script: <b>Home HQ</b>. Leave the other options as they are; tapping the widget opens the dashboard.')}
      ${step(6, 'Lock Screen (optional)', 'Long-press the Lock Screen → <b>Customize</b> → Lock Screen → add a Scriptable widget → choose <b>Home HQ</b>. Shows your next event.')}
    </div>
    <p class="hint">Refreshes about every 15 minutes (iOS decides exactly when). If you’re offline it shows the last copy.</p>`;
}
function renderMore() {
  const item = (k, label, sub, color) => `<div class="row"><div class="row-main" data-tab-go="${k}"><span class="ico" style="background:${color}">${svg(k)}</span>
    <div class="row-text"><div class="row-title">${label}</div><div class="row-sub">${sub}</div></div><span class="chev">›</span></div></div>`;
  $('#list').innerHTML = `<div style="height:12px"></div><div class="cards menu">
    ${item('countdowns', 'Countdowns', 'Pick what counts down on Today', '#8A5A36')}
    ${item('wishes', 'Wish lists', 'Christmas, birthday and anytime wishes', '#B35A45')}
    ${item('dates', 'Birthdays & anniversaries', 'Yearly dates and Today reminders', '#C9A14A')}
    ${item('recipes', 'Recipes & cocktails', 'Saved recipes, add to shopping', '#6F7F5A')}
    ${item('photos', 'Photos', 'Family photos for the screensaver', '#0EA5E9')}
    ${item('calendars', 'Calendar sync', 'Google, iCloud and Outlook calendars', '#12B76A')}
    ${item('look', 'Look & layout', 'Theme, colours, text size, what shows', '#7C3AED')}
    ${item('preview', 'Preview the frame', 'See exactly what the kitchen screen shows', '#F59E0B')}
    ${item('widget', 'iPhone widget', 'Today at a glance on your home screen', '#8A5A36')}
  </div>
  <div style="height:18px"></div><div class="cards menu">
    <div class="row"><div class="row-main" id="lockBtn"><span class="ico" style="background:#6E6A64">${svg('lock')}</span><div class="row-text"><div class="row-title">${signedIn ? 'Sign out' : 'Lock this phone'}</div><div class="row-sub">${signedIn ? 'Signed in as ' + esc(signedIn) : 'You’ll need the passcode again'}</div></div></div></div>
  </div>`;
}

// ---------------------------------------------------------------- Look & layout
const DEFAULT_LOOK = { theme: 'light', palette: 'oat', people: 'soft', boldHighlight: false, accent: '#111111', fontScale: 1, startView: 'home', calendarMode: 'day', routinesOnCal: false, weekStart: 'mon', season: 'auto', wishHide: true, bdayDays: 7, clock24: false, routineOnCalendar: false, choresView: 'all', orientation: 'auto',
  sections: { calendar: true, tasks: true, meals: true, shopping: true, photos: false, control: false, agents: false },
  tiles: { weather: true, people: true, photo: false, meals: true, chores: true, shopping: true, status: false },
  wx: { place: 'New York, NY', lat: 40.7128, lon: -74.006 }, night: { on: true, from: '21:00', to: '06:00', dim: 0.25 },
  sideOrder: ['meals', 'photo', 'chores', 'shopping', 'status'] };
const ACCENTS = ['#111111', '#8A5A36', '#5F7A4A', '#3C6E91', '#8C6F7A', '#8E3341', '#B07A2E', '#2D5BFF'];
let look = null, lookTimer = null;
async function saveLookNow() { try { if (!look || !look.palette) look = { ...(await api('GET', 'look')), ...(look || {}) }; look = await api('PUT', 'look', look); status('Saved ✓'); setTimeout(() => status(''), 2000); } catch (e) { toast('Couldn’t save — ' + e.message); } }
async function loadLook() {
  try { look = await (await fetch('/api/look', { cache: 'no-store' })).json(); } catch { look = structuredClone(DEFAULT_LOOK); }
  if (tab === 'look' || tab === 'preview') render();
}
function pushPreview() {
  document.querySelectorAll('iframe.pv').forEach(f => { try { f.contentWindow.postMessage({ type: 'hq-look', look }, location.origin); } catch {} });
}
function lookChanged() {
  pushPreview();
  status('Saving…');
  clearTimeout(lookTimer);
  lookTimer = setTimeout(async () => {
    try { look = await api('PUT', 'look', look); status('Saved ✓ — the frame updates within a minute'); setTimeout(() => status(''), 2500); }
    catch (e) { status(''); toast('Couldn’t save — ' + e.message); }
  }, 700);
}
function previewBox(view, h) {
  return `<div class="pv-wrap" data-pv style="height:${h || 0}px"><iframe class="pv" title="Frame preview" src="/?preview=1#${view || 'home'}" loading="eager"></iframe></div>`;
}
function fitPreviews() {
  document.querySelectorAll('[data-pv]').forEach(w => {
    const k = w.clientWidth / 1280; w.style.height = Math.round(800 * k) + 'px';
    w.querySelector('iframe').style.transform = `scale(${k})`;
  });
}
window.addEventListener('resize', () => { fitPreviews(); fitFull(); });
function wirePreviews() {
  fitPreviews();
  document.querySelectorAll('iframe.pv').forEach(f => f.addEventListener('load', () => setTimeout(pushPreview, 300)));
}
function renderLook(back) {
  if (!look) { $('#list').innerHTML = back + '<p class="hint">Loading…</p>'; loadLook(); return; }
  const L = look;
  const chipRow = (key, label, opts, val) => `<div class="field"><span>${label}</span><div class="chips" data-look="${key}">${opts.map(([k, t]) =>
    `<button type="button" class="chip ${String(val) === String(k) ? 'on' : ''}" data-v="${esc(k)}">${esc(t)}</button>`).join('')}</div></div>`;
  const sw = (group, k, label, on) => `<label class="switch">${label}<input type="checkbox" data-look-bool="${group}.${k}" ${on ? 'checked' : ''}></label>`;
  const names = { meals: 'Meals tile', photo: 'Photo tile', chores: 'Chores tile', shopping: 'Shopping tile', status: 'Home status tile' };
  $('#list').innerHTML = back + `
    <div class="group"><span>Live preview</span></div>${previewBox(L.startView === 'home' ? 'home' : L.startView)}
    <div class="group"><span>Appearance</span></div>
    <div class="cards look-sec">
      <div class="field"><span>Colour theme</span><div class="th-grid">${Object.keys(window.HQ_THEMES).map(k => { const t = window.HQ_THEMES[k]; return `<button type="button" class="th-card ${(L.palette || 'oat') === k ? 'on' : ''}" data-palette="${k}" style="background:${t.paper};color:${t.ink}">
        <span class="th-mini"><i style="background:${t.deep};color:${t.onDeep}">Rest of today</i><b style="background:${t.card}"></b><b style="background:${t.card}"></b></span>
        <span class="th-dots">${t.people.slice(0, 5).map(c => `<i style="background:${c}"></i>`).join('')}</span>
        <span class="th-name">${esc(t.name)}${k === 'oat' ? ' <small style="color:' + t.mute + '">default</small>' : ''}</span></button>`; }).join('')}</div></div>
      ${chipRow('theme', 'Dark mode', [['light', 'Off'], ['auto', 'Evening at night'], ['dark', 'Always Evening']], L.theme)}
      ${chipRow('boldHighlight', '“Rest of today” card', [['false', 'Soft tint'], ['true', 'Bold highlight']], !!L.boldHighlight)}
      ${chipRow('people', 'Family colours', [['soft', 'Softened'], ['theme', 'Match theme'], ['original', 'Original']], L.people || 'soft')}
      <div class="field"><span>Accent colour</span><div class="swatches">${ACCENTS.map(c => `<button type="button" data-accent="${c}" class="${L.accent === c ? 'on' : ''}" style="background:${c === '#111111' ? (window.HQ_THEMES[L.palette] || window.HQ_THEMES.oat).accent : c}" aria-label="${c === '#111111' ? 'Theme accent' : 'Colour ' + c}">${c === '#111111' ? '<em>Theme</em>' : ''}</button>`).join('')}</div></div>
      ${chipRow('fontScale', 'Text size', [['0.9', 'Smaller'], ['1', 'Normal'], ['1.1', 'Larger'], ['1.2', 'Largest']], L.fontScale)}
    </div>
    <div class="group"><span>Screens</span></div>
    <div class="cards look-sec">
      ${chipRow('startView', 'Start screen (and where it returns when idle)', [['home', 'Today'], ['calendar', 'Calendar'], ['tasks', 'Chores'], ['meals', 'Meals'], ['shopping', 'Shopping']], L.startView)}
      ${sw('sections', 'calendar', 'Calendar screen', L.sections.calendar)}
      ${sw('sections', 'tasks', 'Chores screen', L.sections.tasks)}
      ${sw('sections', 'meals', 'Meals screen', L.sections.meals)}
      ${sw('sections', 'shopping', 'Shopping screen', L.sections.shopping)}
    </div>
    <div class="group"><span>Today screen</span></div>
    <div class="cards look-sec">
      ${sw('tiles', 'people', 'Where’s everyone (from routines)', L.tiles.people)}
      ${sw('tiles', 'meals', 'Today’s meals tile', L.tiles.meals)}
      ${sw('tiles', 'chores', 'Chores tile', L.tiles.chores)}
      ${sw('tiles', 'shopping', 'Shopping tile', L.tiles.shopping)}
      <div class="field"><span>Right-hand column order</span></div>
      ${L.sideOrder.map((k, i) => `<div class="order-row"><span>${names[k]}</span><button type="button" data-ord="${i}" data-d="-1" ${i ? '' : 'disabled'} aria-label="Move up">↑</button><button type="button" data-ord="${i}" data-d="1" ${i < L.sideOrder.length - 1 ? '' : 'disabled'} aria-label="Move down">↓</button></div>`).join('')}
    </div>
    <div class="group"><span>Calendar</span></div>
    <div class="cards look-sec">
      ${chipRow('calendarMode', 'Opens on', [['day', 'Today'], ['3day', '3 days'], ['week', 'Week'], ['month', 'Month']], L.calendarMode)}
      ${chipRow('choresView', 'Chores screen opens on', [['all', 'All day (3 rows)'], ['now', 'Current time of day']], L.choresView)}
      ${chipRow('orientation', 'Screen orientation', [['auto', 'Auto (rotate)'], ['landscape', 'Always landscape'], ['portrait', 'Always portrait']], L.orientation)}
      ${chipRow('season', 'Seasonal touches', [['auto', 'Auto by date'], ['off', 'Off'], ['halloween', '🎃 Halloween'], ['thanksgiving', '🍂 Thanksgiving'], ['christmas', '🎄 Christmas'], ['winter', '❄️ Winter']], L.season || 'auto')}
      ${chipRow('weekStart', 'Month starts on', [['mon', 'Monday'], ['sun', 'Sunday']], L.weekStart)}
      <label class="switch">24-hour clock<input type="checkbox" data-look-bool="clock24" ${L.clock24 ? 'checked' : ''}></label>
      <label class="switch">Show routines on calendar<input type="checkbox" data-look-bool="routinesOnCal" ${L.routinesOnCal ? 'checked' : ''}></label>
    </div>
    <div class="group"><span>Weather</span></div>
    <div class="cards look-sec">
      ${sw('tiles', 'weather', 'Show weather (Today tile + calendar)', L.tiles.weather !== false)}
      <label class="field"><span>Place name</span><input data-look-field="wx.place" value="${esc((L.wx || {}).place || 'New York, NY')}"></label>
      <div class="mini"><label class="field"><span>Latitude</span><input inputmode="decimal" data-look-field="wx.lat" value="${esc((L.wx || {}).lat ?? 42.725)}"></label><label class="field"><span>Longitude</span><input inputmode="decimal" data-look-field="wx.lon" value="${esc((L.wx || {}).lon ?? -70.991)}"></label></div>
      <p class="hint" style="text-align:left">Forecast from Open-Meteo, refreshed every 30 minutes.</p>
    </div>
    <div class="group"><span>Night mode</span></div>
    <div class="cards look-sec">
      ${sw('night', 'on', 'Dim the screen at night (tap to wake)', (L.night || {}).on !== false)}
      <div class="mini"><label class="field"><span>From</span><input type="time" data-look-field="night.from" value="${esc((L.night || {}).from || '21:00')}"></label><label class="field"><span>Until</span><input type="time" data-look-field="night.to" value="${esc((L.night || {}).to || '06:00')}"></label></div>
      ${chipRow('nightDim', 'How dim', [['0.4', 'A little'], ['0.25', 'Dim'], ['0.12', 'Very dim']], String((L.night || {}).dim ?? 0.25))}
    </div>
    <button type="button" class="btn big" id="resetLook" style="margin-top:24px">↺ Reset to default look</button>
    <p class="hint">Changes save automatically and show on the kitchen screen within a minute.</p>`;
  wirePreviews();
}
$('#list').addEventListener('click', ev => {
  if (tab !== 'look' || !look) return;
  const chip = ev.target.closest('[data-look] .chip');
  if (chip) {
    const key = chip.closest('[data-look]').dataset.look; let v = chip.dataset.v;
    if (key === 'fontScale') v = +v;
    if (key === 'boldHighlight') v = v === 'true';
    if (key === 'nightDim') { look.night = { ...(look.night || {}), dim: +v }; chip.parentNode.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === chip)); lookChanged(); return; }
    look[key] = v; chip.parentNode.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === chip)); lookChanged(); return;
  }
  const pal = ev.target.closest('[data-palette]');
  if (pal) { look.palette = pal.dataset.palette; if (look.palette === 'evening' && look.theme === 'auto') {} themeEditor(look); lookChanged(); render(); return; }
  const a = ev.target.closest('[data-accent]');
  if (a) { look.accent = a.dataset.accent; themeEditor(look); document.querySelectorAll('[data-accent]').forEach(x => x.classList.toggle('on', x === a)); lookChanged(); return; }
  const o = ev.target.closest('[data-ord]');
  if (o) { const i = +o.dataset.ord, j = i + +o.dataset.d, arr = look.sideOrder; [arr[i], arr[j]] = [arr[j], arr[i]]; lookChanged(); render(); return; }
  if (ev.target.closest('#resetLook')) {
    if (!confirm('Reset the frame to the default look?')) return;
    look = structuredClone(DEFAULT_LOOK); render(); pushPreview();
    api('PUT', 'look', { reset: true }).then(l => { look = l; status('Reset ✓'); setTimeout(() => status(''), 2000); }).catch(e => toast(e.message));
  }
});
$('#list').addEventListener('change', ev => {
  const f = ev.target.closest('[data-look-field]');
  if (f && look) { const [g, k] = f.dataset.lookField.split('.'); look[g] = { ...(look[g] || {}), [k]: k === 'lat' || k === 'lon' ? +f.value : f.value }; lookChanged(); return; }
  const t = ev.target.closest('[data-look-bool]'); if (!t || !look) return;
  const [g, k] = t.dataset.lookBool.split('.');
  if (k) look[g] = { ...look[g], [k]: t.checked }; else look[g] = t.checked;
  lookChanged();
});

// ---------------------------------------------------------------- Preview
let pvView = 'home';
function renderPreview(back) {
  if (!look) { loadLook(); }
  const views = [['home', 'Today'], ['calendar', 'Calendar'], ['tasks', 'Chores'], ['meals', 'Meals'], ['shopping', 'Shopping']];
  $('#list').innerHTML = back + `<p class="hint" style="text-align:left;margin:10px 4px">This is the live kitchen screen. Taps here are only a preview — nothing is saved and the screensaver won’t start.</p>
    <div class="chips" id="pvViews" style="margin:0 0 12px">${views.map(([k, t]) => `<button type="button" class="chip ${k === pvView ? 'on' : ''}" data-pvview="${k}">${t}</button>`).join('')}</div>
    ${previewBox(pvView)}
    <button type="button" class="btn primary big" id="pvFull" style="margin-top:16px">⤢ Full screen (landscape)</button>`;
  wirePreviews();
}
$('#list').addEventListener('click', ev => {
  if (tab !== 'preview') return;
  const v = ev.target.closest('[data-pvview]');
  if (v) { pvView = v.dataset.pvview; document.querySelectorAll('[data-pvview]').forEach(x => x.classList.toggle('on', x === v));
    document.querySelectorAll('iframe.pv').forEach(f => { try { f.contentWindow.postMessage({ type: 'hq-look', look, view: pvView }, location.origin); } catch {} }); return; }
  if (ev.target.closest('#pvFull')) openFull();
});
function openFull() {
  const d = document.createElement('div'); d.className = 'pv-full'; d.id = 'pvFullBox';
  d.innerHTML = `<iframe class="pv" title="Frame preview full screen" src="/?preview=1#${pvView}"></iframe><button type="button" class="btn primary pv-close" id="pvClose">Done</button>`;
  document.body.appendChild(d);
  d.querySelector('iframe').addEventListener('load', () => setTimeout(pushPreview, 300));
  d.querySelector('#pvClose').onclick = () => d.remove();
  fitFull();
}
function fitFull() {
  const d = document.getElementById('pvFullBox'); if (!d) return;
  const vw = window.innerWidth, vh = window.innerHeight, portrait = vh > vw;
  const k = portrait ? Math.min(vw / 800, vh / 1280) : Math.min(vw / 1280, vh / 800);
  d.querySelector('iframe').style.transform = `translate(-50%, -50%) ${portrait ? 'rotate(90deg) ' : ''}scale(${k})`;
}


// ---------------------------------------------------------------- weekly routines + care (Family tab)
const RTYPES = [['work', '💼 Work'], ['school', '🏫 School'], ['daycare', '🧸 Daycare'], ['commute', '🚗 Commute'], ['activity', '⚽ Activity'], ['wake', '☀️ Wake up'], ['bed', '🌙 Bedtime'], ['other', '📌 Other']];
const RCOLOR = { work: '#2D5BFF', school: '#00A36C', daycare: '#F59E0B', commute: '#9CA3AF', activity: '#E4007C', other: '#7C3AED', bed: '#111827', wake: '#F59E0B' };
const WD = [['1', 'Mon'], ['2', 'Tue'], ['3', 'Wed'], ['4', 'Thu'], ['5', 'Fri'], ['6', 'Sat'], ['0', 'Sun']];
const CTYPES = [['feed', '🍼 Feed'], ['nap', '😴 Nap'], ['wake', '☀️ Wake up'], ['bed', '🌙 Bedtime'], ['meds', '💊 Medicine'], ['other', '📝 Other']];
let famPid = localStorage.getItem('hq-fam') || '', care = null, sitter = null;
const kids = () => data.people.filter(p => p.role !== 'parent');
const famPerson = () => data.people.find(p => p.id === famPid) || data.people[0];
const careOf = () => { const id = famPerson().id; care.people[id] = care.people[id] || { items: [], notes: '', contacts: '' }; return care.people[id]; };
const tlabel = t => (RTYPES.find(x => x[0] === t) || [, ''])[1];
const daysText = d => { const s = [...d].map(Number).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)); const k = s.join(',');
  if (k === '1,2,3,4,5') return 'Mon–Fri'; if (k === '6,0') return 'Weekends'; if (s.length === 7) return 'Every day'; return s.map(x => WD.find(w => +w[0] === x)[1]).join(', '); };
const t12 = hm => { if (!hm) return ''; const [h, m] = hm.split(':').map(Number); return `${h % 12 || 12}${m ? ':' + pad(m) : ''}${h < 12 ? 'am' : 'pm'}`; };
function famMenu() {
  const row = (k, p, sub) => `<div class="row"><div class="row-main" data-tab-go="${k}" data-pid="${p.id}"><span class="avatar" style="background:${esc(p.color)};color:${esc(p.ink || '#fff')}">${esc(p.name[0])}</span>
    <div class="row-text"><div class="row-title">${esc(p.name)}</div><div class="row-sub">${esc(sub)}</div></div><span class="chev">›</span></div></div>`;
  return `<div class="group"><span>🗓 Weekly routines</span></div><div class="cards menu">${data.people.map(p => row('routine', p, (p.routine || []).length ? (p.routine || []).map(b => b.label || tlabel(b.type).slice(2).trim()).filter((v, i, a) => a.indexOf(v) === i).join(', ') : 'Tap to add work, school, bedtime…')).join('')}</div>
    <div class="group"><span>🍼 Care schedule &amp; babysitter</span></div><div class="cards menu">${kids().map(p => row('care', p, 'Feeds, naps, notes, emergency contacts')).join('') || '<p class="hint">Set someone’s role to Child to add a care schedule.</p>'}</div>`;
}
S.routine = {
  label: 'Routine', title: 'Weekly routine', noun: 'routine block',
  items: () => famPerson()?.routine || [],
  blank: () => ({ id: uid('r'), type: 'work', days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', label: '' }),
  fields: b => `${chips('type', 'Type', RTYPES, [b.type], false)}
    ${input('label', 'Label (optional)', b.label, 'placeholder="e.g. Office, Grade 3, Swim class" autocomplete="off"')}
    ${chips('days', 'Days — tap to pick', WD, (b.days || []).map(String), true)}
    <div class="two">${field('Start', `<input type="time" name="start" value="${esc(b.start)}" required>`)}${field('End <small>(not for bed/wake)</small>', `<input type="time" name="end" value="${esc(b.end || '')}">`)}</div>
    ${toggle('skipToday', 'Skip today only', (b.skip || []).includes(today()))}
    <p class="hint" style="text-align:left">Tip: add a <b>Commute</b> block after work (e.g. 5:15–5:45) and the frame shows “home ~5:45”. One-off changes? Just add a calendar event.</p>`,
  read: (f, b) => { const t = chipVal(f, 'type')[0] || 'other'; const skip = (b.skip || []).filter(d => d >= today() && d !== today()); if (f.skipToday.checked) skip.push(today());
    return clean({ id: b.id, type: t, label: f.label.value.trim(), days: chipVal(f, 'days').map(Number), start: f.start.value, end: ['bed', 'wake'].includes(t) ? undefined : f.end.value || undefined, skip: skip.length ? skip : undefined, over: b.over && Object.keys(b.over).length ? b.over : undefined }); },
  validate: f => chipVal(f, 'days').length > 0 || 'Pick at least one day',
};
S.care = {
  label: 'Care', title: 'Care schedule', noun: 'care item',
  items: () => care ? careOf().items : [],
  blank: () => ({ id: uid('k'), type: 'feed', time: '', end: '', label: '', notes: '' }),
  fields: i => `${chips('type', 'Type', CTYPES, [i.type], false)}
    <div class="two">${field('Time', `<input type="time" name="time" value="${esc(i.time)}" required>`)}${field('Until <small>(naps)</small>', `<input type="time" name="end" value="${esc(i.end || '')}">`)}</div>
    ${input('label', 'What', i.label, 'placeholder="e.g. Bottle 180ml, Nap in crib" autocomplete="off"')}
    ${field('Notes for the sitter', `<textarea name="notes" rows="3" placeholder="e.g. Warm to body temperature, burp halfway">${esc(i.notes || '')}</textarea>`)}`,
  read: (f, i) => clean({ id: i.id, type: chipVal(f, 'type')[0] || 'other', time: f.time.value, end: f.end.value || undefined, label: f.label.value.trim(), notes: f.notes.value.trim() }),
};
function weekVisual(list) {
  const H0 = 6, H1 = 22, span = (H1 - H0) * 60, pct = hm => { const [h, m] = hm.split(':').map(Number); return Math.max(0, Math.min(100, ((h * 60 + m) - H0 * 60) / span * 100)); };
  return `<div class="wk">${WD.map(([d, n]) => `<div class="wk-col"><div class="wk-d">${n}</div><div class="wk-bar">${[8, 12, 16, 20].map(h => `<i class="wk-h" style="top:${pct(pad(h) + ':00')}%"></i>`).join('')}${list.filter(b => (b.days || []).includes(+d)).map(b =>
    b.end ? `<span class="wk-b" style="top:${pct(b.start)}%;height:${Math.max(2, pct(b.end) - pct(b.start))}%;background:${RCOLOR[b.type]}"></span>` : `<span class="wk-l" style="top:${pct(b.start)}%;background:${RCOLOR[b.type]}"></span>`).join('')}</div></div>`).join('')}
    <div class="wk-axis">${[8, 12, 16, 20].map(h => `<span style="top:${pct(pad(h) + ':00')}%">${h % 12 || 12}${h < 12 ? 'a' : 'p'}</span>`).join('')}</div></div>`;
}
function personTabs(k) {
  return `<button type="button" class="link back" data-tab-go="people">‹ Family</button><div class="chips" style="margin:6px 0 10px">${(k === 'care' ? kids() : data.people).map(p => `<button type="button" class="chip ${p.id === famPerson().id ? 'on' : ''}" data-tab-go="${k}" data-pid="${p.id}"><i style="background:${esc(p.color)}"></i>${esc(p.name)}</button>`).join('')}</div>`;
}
function renderRoutine() {
  const p = famPerson(); famPid = p.id; localStorage.setItem('hq-fam', famPid);
  $('#title').textContent = p.name + '’s week';
  const list = (p.routine || []).slice().sort((a, b) => a.start.localeCompare(b.start));
  const rows = list.map(b => `<div class="row" data-id="${b.id}"><button type="button" class="row-del" data-del>Delete</button><div class="row-main" data-open>
    <span class="avatar" style="background:${RCOLOR[b.type]}">${tlabel(b.type).split(' ')[0]}</span>
    <div class="row-text"><div class="row-title">${esc(b.label || tlabel(b.type).slice(2).trim())}${(b.skip || []).includes(today()) ? ' <small class="badge">skipped today</small>' : ''}</div>
    <div class="row-sub">${esc(daysText(b.days || []))} · ${t12(b.start)}${b.end ? '–' + t12(b.end) : ''}</div></div><span class="chev">›</span></div></div>`).join('');
  const tdy = today(), fd = k => ymd(k).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const exc = []; list.forEach(b => { (b.skip || []).filter(k => k >= tdy).forEach(k => exc.push([k, b, 'skip'])); Object.keys(b.over || {}).filter(k => k >= tdy).forEach(k => exc.push([k, b, 'over'])); });
  exc.sort((a, b) => a[0] < b[0] ? -1 : 1);
  const offs = (p.dayoff || []).filter(x => x.to >= tdy);
  const extras = list.length ? `<div class="group"><span>Days off</span></div><div class="cards dayoff">
      ${offs.map((x, i) => `<div class="exc-row"><div><b>${esc(x.label || 'Day off')}</b><small>${fd(x.from)}${x.to !== x.from ? ' – ' + fd(x.to) : ''} · work/school/activities skipped</small></div><button type="button" class="link" data-offdel="${esc(x.from)}|${esc(x.to)}">Remove</button></div>`).join('')}
      <div class="mini three"><input type="date" id="offFrom" aria-label="From"><input type="date" id="offTo" aria-label="To"><input id="offLabel" placeholder="Vacation" aria-label="Label"></div>
      <button type="button" class="btn big" id="offAdd">＋ Add days off</button></div>
    <div class="group"><span>One-day changes</span></div><div class="cards dayexc">
      ${exc.map(([k, b, t]) => `<div class="exc-row"><div><b>${esc(b.label || tlabel(b.type).slice(2).trim())}</b><small>${fd(k)} · ${t === 'skip' ? 'skipped' : 'changed to ' + t12(b.over[k].start) + (b.over[k].end ? '–' + t12(b.over[k].end) : '')}</small></div><button type="button" class="link" data-excdel="${esc(b.id)}|${k}|${t}">Restore</button></div>`).join('') || '<p class="hint" style="text-align:left">Skip or change a block on one date:</p>'}
      <div class="mini three"><select id="excBlock">${list.map(b => `<option value="${esc(b.id)}">${esc(b.label || tlabel(b.type).slice(2).trim())}</option>`).join('')}</select><input type="date" id="excDate" value="${tdy}"><input type="time" id="excStart" aria-label="New start (optional)"></div>
      <div class="two"><button type="button" class="btn" id="excSkip">Skip that day</button><button type="button" class="btn" id="excChange">Change start that day</button></div></div>` : '';
  $('#list').innerHTML = personTabs('routine') + (list.length ? weekVisual(list) : '') + extras +
    (list.length ? `<div class="cards">${rows}</div>
      <div class="group"><span>Copy a day</span></div><div class="cards copyday">
        ${chips('cfrom', 'From', WD, ['1'], false)}${chips('cto', 'To', WD, [], true)}
        <button type="button" class="btn primary big" id="copyDay">Copy</button></div>`
    : `<div class="empty"><div class="big-emoji">🗓</div><h3>No routine yet</h3><p>Add the usual week for ${esc(p.name)} — e.g. <b>Work Mon–Fri 9–5</b>, <b>Commute 5:15–5:45</b>, <b>School 8:30–3:15</b>, <b>Bedtime 7:30</b> on school nights. The frame then shows where everyone is.</p>
       <button type="button" class="btn primary big" id="addEmpty">＋ Add routine block</button></div>`);
}
function bindFam() {
  $('#list').addEventListener('click', ev => {
    const ch = ev.target.closest('.copyday [data-chips] .chip');
    if (ch) { const box = ch.parentNode; if (box.dataset.multi) ch.classList.toggle('on'); else box.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === ch)); return; }
    if (tab === 'routine' && ev.target.closest('#copyDay')) {
      const f = $('#list'), from = +chipVal(f, 'cfrom')[0], to = chipVal(f, 'cto').map(Number).filter(d => d !== from);
      if (!to.length) return toast('Pick the days to copy to');
      const p = famPerson(); let n = 0;
      (p.routine || []).forEach(b => { if (!(b.days || []).includes(from)) return; to.forEach(d => { if (!b.days.includes(d)) { b.days.push(d); n++; } }); });
      if (!n) return toast('Nothing new to copy'); render(); save('people'); toast('Copied ✓'); return;
    }
    if (tab === 'routine') {
      const p = famPerson(); let t;
      if (ev.target.closest('#offAdd')) { const a = $('#offFrom').value, b = $('#offTo').value || a; if (!a || b < a) return toast('Pick the dates');
        p.dayoff = [...(p.dayoff || []), { from: a, to: b, label: $('#offLabel').value.trim() || undefined }].map(x => clean(x)); render(); save('people'); return toast('Days off added ✓'); }
      if ((t = ev.target.closest('[data-offdel]'))) { const [a, b] = t.dataset.offdel.split('|'); p.dayoff = (p.dayoff || []).filter(x => !(x.from === a && x.to === b)); if (!p.dayoff.length) delete p.dayoff; render(); save('people'); return; }
      if ((t = ev.target.closest('[data-excdel]'))) { const [id, k, kind] = t.dataset.excdel.split('|'), b = p.routine.find(x => x.id === id); if (!b) return;
        if (kind === 'skip') { b.skip = b.skip.filter(x => x !== k); if (!b.skip.length) delete b.skip; } else { delete b.over[k]; if (!Object.keys(b.over).length) delete b.over; } render(); save('people'); return toast('Restored'); }
      const ex = ev.target.closest('#excSkip, #excChange');
      if (ex) { const b = p.routine.find(x => x.id === $('#excBlock').value), k = $('#excDate').value; if (!b || !k) return;
        if (ex.id === 'excSkip') b.skip = [...new Set([...(b.skip || []), k])].sort();
        else { const st = $('#excStart').value; if (!st) return toast('Pick the new start time'); const dur = b.end ? (toMin(b.end) - toMin(b.start)) : 0;
          b.over = { ...(b.over || {}), [k]: clean({ start: st, end: b.end ? fromMin(toMin(st) + dur) : undefined }) }; }
        render(); save('people'); return toast('Saved for ' + ymd(k).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ✓'); }
    }
    if ((tab === 'routine' || tab === 'care') && ev.target.closest('#addEmpty')) return openSheet(S[tab].blank(), true);
    if (tab !== 'care') return;
    let t;
    if (ev.target.closest('#saveNotes')) { const c = careOf(); c.notes = $('#careNotes').value; c.contacts = $('#careContacts').value; return saveCare(true); }
    if (ev.target.closest('#sitterNew')) { if (sitter?.token && !confirm('Make a new link? The old link will stop working.')) return; return api('POST', 'sitter-link').then(r => { sitter = r; render(); toast('New babysitter link ready'); }); }
    if (ev.target.closest('#sitterOff')) { if (!confirm('Turn off the babysitter link? It will stop working right away.')) return; return api('DELETE', 'sitter-link').then(r => { sitter = r; render(); toast('Link turned off'); }); }
    if (ev.target.closest('#sitterCopy')) { const u = sitterUrl(); (navigator.share ? navigator.share({ title: 'Babysitter info', url: u }) : navigator.clipboard.writeText(u).then(() => toast('Link copied'))).catch(() => {}); return; }
  });
}
bindFam();
const sitterUrl = () => sitter?.token ? `${location.origin}/sitter/?t=${sitter.token}` : '';
async function loadCare() {
  try { const r = await api('GET', 'care'); care = r.care; care.log = r.log; sitter = await api('GET', 'sitter-link'); if (tab === 'care') render(); }
  catch (e) { toast('Couldn’t load care info'); }
}
async function saveCare(msg) {
  status('Saving…');
  try { const { log } = care; const r = await api('PUT', 'care', { people: care.people }); care = r.care; care.log = log; if (tab === 'care') render(); status('Saved ✓'); setTimeout(() => status(''), 2000); if (msg) toast('Saved ✓'); }
  catch (e) { status(''); toast('Couldn’t save — ' + e.message); }
}
function renderCare() {
  if (famPerson().role === 'parent' && kids().length) famPid = kids()[0].id;
  const p = famPerson(); famPid = p.id; localStorage.setItem('hq-fam', famPid);
  $('#title').textContent = p.name + '’s care';
  if (!care) { $('#list').innerHTML = personTabs('care') + '<p class="hint">Loading…</p>'; loadCare(); return; }
  const c = careOf(), items = c.items.slice().sort((a, b) => a.time.localeCompare(b.time));
  const log = (care.log || {})[today()]?.[p.id] || {};
  const beds = (p.routine || []).filter(b => b.type === 'bed' || b.type === 'wake');
  $('#list').innerHTML = personTabs('care') + `
    <div class="group"><span>Daily schedule</span><span>${items.length}</span></div>
    ${items.length ? `<div class="cards">${items.map(i => `<div class="row" data-id="${i.id}"><button type="button" class="row-del" data-del>Delete</button><div class="row-main" data-open>
      <span class="ctime">${t12(i.time)}${i.end ? `<small>–${t12(i.end)}</small>` : ''}</span>
      <div class="row-text"><div class="row-title">${esc(i.label || (CTYPES.find(x => x[0] === i.type) || [, ''])[1])}</div><div class="row-sub">${esc((CTYPES.find(x => x[0] === i.type) || [, ''])[1])}${log[i.id] ? ` · ✓ done ${new Date(log[i.id].at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} (${log[i.id].by})` : ''}</div></div><span class="chev">›</span></div></div>`).join('')}</div>`
    : `<div class="empty"><div class="big-emoji">🍼</div><h3>No care schedule yet</h3><p>Add the usual day — e.g. <b>Feed 7:00</b>, <b>Nap 9:30–11:00</b>, <b>Medicine 12:00</b>, <b>Bedtime 7:00</b>. A babysitter sees it as a timeline with what’s next.</p><button type="button" class="btn primary big" id="addEmpty">＋ Add care item</button></div>`}
    ${beds.length ? `<p class="hint" style="text-align:left">Bedtimes &amp; wake-ups come from the weekly routine and show on the sitter page for everyone.</p>` : ''}
    <div class="group"><span>Good to know</span></div>
    <div class="cards" style="padding:12px 14px">
      ${field('Notes (allergies, how they fall asleep, comfort items)', `<textarea id="careNotes" rows="4" placeholder="e.g. Allergic to peanuts. Falls asleep with white noise and the blue bunny.">${esc(c.notes)}</textarea>`)}
      ${field('Emergency contacts — one per line', `<textarea id="careContacts" rows="3" placeholder="e.g. Grandma Ana – 416 555 0123&#10;Dr. Lee (paediatrician) – 416 555 0199">${esc(c.contacts)}</textarea>`)}
      <button type="button" class="btn primary big" id="saveNotes">Save notes</button>
    </div>
    <div class="group"><span>Babysitter link</span></div>
    <div class="cards" style="padding:14px">
      ${sitter?.token ? `<p style="margin:0 0 10px">Anyone with this link can see today’s schedules, notes and contacts, and tick things off. It doesn’t give editing access.</p>
        <div class="linkbox">${esc(sitterUrl())}</div>
        <button type="button" class="btn primary big" id="sitterCopy" style="margin-top:10px">Share / copy link</button>
        <div class="two" style="margin-top:10px"><button type="button" class="btn" id="sitterNew">New link</button><button type="button" class="btn danger" id="sitterOff">Turn off</button></div>`
      : `<p style="margin:0 0 10px">Create a private link for your babysitter — a simple, large-text page with today’s schedule, bedtimes, notes and contacts.</p><button type="button" class="btn primary big" id="sitterNew">Create babysitter link</button>`}
    </div>`;
}


// ---------------------------------------------------------------- shopping: quick delete, clear checked, multi-select
$('#list').addEventListener('click', ev => {
  if (tab !== 'groceries') return;
  let t;
  if ((t = ev.target.closest('[data-usual]'))) { const u = data.usuals.find(x => x.id === t.dataset.usual); if (u) addUsual(u); return; }
  if (ev.target.closest('#clearChecked')) {
    const gone = data.groceries.filter(g => g.done && window.HQTrip.key(g, data.trips) === curTrip()); if (!gone.length) return;
    data.groceries = data.groceries.filter(g => !gone.includes(g)); lastRemoved = gone; render(); save('groceries'); undoToast(`Cleared ${gone.length} checked`); return;
  }
  if (ev.target.closest('#selToggle')) { selMode = !selMode; selected.clear(); render(); return; }
  if (ev.target.closest('#delSelected')) {
    const gone = data.groceries.filter(g => selected.has(g.id)); if (!gone.length) return;
    data.groceries = data.groceries.filter(g => !selected.has(g.id)); lastRemoved = gone; selMode = false; selected.clear(); render(); save('groceries'); undoToast(`Deleted ${gone.length}`); return;
  }
  if (selMode && (t = ev.target.closest('.row'))) { ev.stopImmediatePropagation(); const id = t.dataset.id; selected.has(id) ? selected.delete(id) : selected.add(id); render(); return; }
}, true);
function undoToast(msg) {
  toast(msg + ' — tap here to undo');
  const el = $('#toast'); el.onclick = () => { if (!lastRemoved) return;
    if (Array.isArray(lastRemoved)) { data.groceries.push(...lastRemoved); lastRemoved = null; el.hidden = true; render(); save('groceries'); return; }
    const { sec, item, i } = lastRemoved; lastRemoved = null; data[sec].splice(Math.min(i, data[sec].length), 0, item); el.hidden = true; render(); save(sec); };
}
// long-press a shopping row to start selecting
(() => { let timer = null;
  $('#list').addEventListener('touchstart', e => { if (tab !== 'groceries' || selMode) return; const r = e.target.closest('.row'); if (!r) return;
    timer = setTimeout(() => { selMode = true; selected = new Set([r.dataset.id]); render(); if (navigator.vibrate) navigator.vibrate(20); }, 550); }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach(k => $('#list').addEventListener(k, () => clearTimeout(timer), { passive: true }));
})();

// Copy must happen synchronously inside the tap on iOS Safari: the script text is prefetched when the page opens.
function execCopy(txt) {
  const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.contentEditable = 'true';
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;';
  document.body.appendChild(ta);
  let ok = false;
  try {
    const r = document.createRange(); r.selectNodeContents(ta); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);   // iOS selection trick
    ta.select(); ta.setSelectionRange(0, txt.length);
    ok = document.execCommand('copy');
  } catch (e) { ok = false; }
  ta.remove(); try { window.getSelection().removeAllRanges(); } catch (e) {}
  return ok;
}
function copyScript() {
  if (!wscript) { toast('Still loading the script — try again in a moment'); loadWidget(); return; }
  const done = () => toast('✓ Script copied — now paste it into a new Scriptable script');
  // 1) legacy copy first: fully synchronous, works in iOS Safari, home-screen apps and most in-app browsers
  if (execCopy(wscript)) return done();
  // 2) async Clipboard API (called inside the same tap)
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try { navigator.clipboard.writeText(wscript).then(done, () => { toast('Couldn’t copy automatically — select the script below'); showScriptBox(); }); return; } catch (e) {}
  }
  toast('Couldn’t copy automatically — select the script below'); showScriptBox();
}
function showScriptBox() {
  const box = $('#wBox'); if (!box) return;
  box.hidden = false; box.querySelector('textarea').value = wscript || 'Loading…';
  box.scrollIntoView({ block: 'center' }); selectScriptBox();
}
function selectScriptBox() {
  const ta = $('#wBox textarea'); if (!ta) return;
  ta.focus(); ta.setSelectionRange(0, ta.value.length);
  try { if (document.execCommand('copy')) toast('✓ Script copied'); else toast('Selected — tap and hold, then Copy'); } catch (e) { toast('Selected — tap and hold, then Copy'); }
}

// iPhone widget page buttons (own listener: copy must run synchronously in the tap)
document.addEventListener('click', ev => {
  if (tab !== 'widget') return;
    if (ev.target.closest('#wNew')) { if (wtok?.token && !confirm('Make a new widget key? Widgets using the old one stop updating until you paste the new script.')) return; return api('POST', 'widget-token').then(() => loadWidget()).then(() => toast('Widget key ready — copy the script')); }
    if (ev.target.closest('#wOff')) { if (!confirm('Revoke the widget key? Widgets stop updating right away.')) return; return api('DELETE', 'widget-token').then(() => loadWidget()).then(() => toast('Widget key revoked')); }
    if (ev.target.closest('#wCopy')) { copyScript(); return; }
    if (ev.target.closest('#wShow')) { showScriptBox(); return; }
    if (ev.target.closest('#wSelAll')) { selectScriptBox(); return; }
});
