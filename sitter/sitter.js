import '../js/themes.js';
window.HQTheme.applyLight(document.documentElement, {});
fetch('/api/look').then(r => r.ok ? r.json() : null).then(l => { if (l) window.HQTheme.applyLight(document.documentElement, l); }).catch(() => {});
// Babysitter view: today's care timeline (next highlighted), bedtimes for everyone, notes, emergency contacts.
// Auth: ?t=<sitter token> (shareable, revocable), or the frame key / edit passcode already on this device.
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const q = new URLSearchParams(location.search);
const FRAME = q.get('frame') === '1';
if (q.get('t')) localStorage.setItem('hq-sitter-token', q.get('t'));
const token = q.get('t') || localStorage.getItem('hq-sitter-token') || '';
const headers = () => {
  const h = { 'content-type': 'application/json' };
  if (FRAME && localStorage.getItem('hq-frame-key')) h['x-frame-key'] = localStorage.getItem('hq-frame-key');
  else if (token) h['x-sitter-token'] = token;
  else if (localStorage.getItem('hq-passcode')) h['x-passcode'] = localStorage.getItem('hq-passcode');
  return h;
};
if (FRAME) document.body.classList.add('frame');
const pad = n => String(n).padStart(2, '0');
const dstr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const at = (hm) => { const [h, m] = hm.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d; };
const fmt = hm => at(hm).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const TYPE = { feed: '🍼 Feed', nap: '😴 Nap', bed: '🌙 Bedtime', wake: '☀️ Wake up', meds: '💊 Medicine', other: '📝' };
let state = null, pid = localStorage.getItem('hq-sitter-pid') || '';

async function load() {
  try {
    const r = await fetch('/api/care', { headers: headers(), cache: 'no-store' });
    if (r.status === 401) { $('#app').innerHTML = `<div class="empty"><h1>Link expired</h1><p class="muted">Ask the parents for a new babysitter link.</p></div>`; return; }
    state = await r.json(); render();
  } catch { if (!state) $('#app').innerHTML = '<p class="muted">Can’t connect — check Wi-Fi.</p>'; }
}
function render() {
  const { care, people, log } = state, today = dstr(new Date()), now = new Date();
  const withCare = people.filter(p => care.people[p.id] && (care.people[p.id].items.length || care.people[p.id].notes || care.people[p.id].contacts));
  if (!withCare.find(p => p.id === pid)) pid = withCare[0]?.id || '';
  const p = people.find(x => x.id === pid), c = p ? care.people[p.id] : null;
  const done = (log[today] || {})[pid] || {};
  const items = c ? c.items.slice().sort((a, b) => a.time.localeCompare(b.time)) : [];
  const nextIdx = items.findIndex(i => !done[i.id] && at(i.end || i.time) >= new Date(+now - 15 * 60000));
  const wd = now.getDay();
  const beds = people.map(x => ({ x, bed: x.sleep.find(s => s.type === 'bed' && (s.days || []).includes(wd)), wake: x.sleep.find(s => s.type === 'wake' && (s.days || []).includes((wd + 1) % 7)) })).filter(b => b.bed);
  const phones = s => esc(s).replace(/(\+?\d[\d\s().-]{6,}\d)/g, m => `<a href="tel:${m.replace(/[^\d+]/g, '')}">${m}</a>`);
  const left = `
    <header><h1>${p ? esc(p.name) + '’s day' : 'Babysitter info'}</h1><div class="date">${now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })} · ${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
    ${withCare.length > 1 ? `<div class="who">${withCare.map(x => `<button data-pid="${x.id}" class="${x.id === pid ? 'on' : ''}" style="--c:${esc(x.color)}">${esc(x.name)}</button>`).join('')}</div>` : ''}</header>`;
  const timeline = c ? `<section><h2>Today’s schedule</h2><div class="tl">${items.map((i, n) => {
    const d = done[i.id];
    return `<div class="it ${d ? 'done' : ''} ${n === nextIdx ? 'next' : ''} ${at(i.end || i.time) < now ? 'past' : ''}">
      <div class="t">${fmt(i.time)}${i.end ? `<small>to ${fmt(i.end)}</small>` : ''}</div>
      <div class="x"><b>${esc(i.label || TYPE[i.type])}</b>${i.label ? `<span>${TYPE[i.type]}</span>` : ''}${i.notes ? `<span>${esc(i.notes)}</span>` : ''}
        ${d ? `<em>✓ Done ${new Date(d.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</em>` : ''}</div>
      <button class="done-btn" data-item="${i.id}" data-undo="${d ? 1 : ''}">${d ? '✓' : 'Done'}</button></div>`;
  }).join('') || '<p class="muted">No schedule yet.</p>'}</div></section>` : `<div class="empty"><h1>Nothing here yet</h1><p class="muted">The parents haven’t added a care schedule.</p></div>`;
  const right = `${beds.length ? `<section><h2>Bedtimes tonight</h2><div class="beds">${beds.map(b => `<div class="bed"><i style="background:${esc(b.x.color)}"></i><b>${esc(b.x.name)}</b>${fmt(b.bed.start)}${b.wake ? `<span class="muted" style="font-size:16px">&nbsp;· up ${fmt(b.wake.start)}</span>` : ''}</div>`).join('')}</div></section>` : ''}
    ${c && c.notes ? `<section><h2>Good to know</h2><div class="card">${esc(c.notes)}</div></section>` : ''}
    ${c && c.contacts ? `<section><h2>Emergency contacts</h2><div class="card contacts">${phones(c.contacts)}</div></section>` : ''}`;
  $('#app').innerHTML = left + `<div>${timeline}</div><div>${right}</div>` + (FRAME ? '<button class="close" id="close">Close</button>' : '');
}
document.addEventListener('click', async ev => {
  const w = ev.target.closest('[data-pid]'); if (w) { pid = w.dataset.pid; localStorage.setItem('hq-sitter-pid', pid); return render(); }
  if (ev.target.closest('#close')) { parent.postMessage({ type: 'hq-sitter-close' }, location.origin); return; }
  const b = ev.target.closest('[data-item]'); if (!b) return;
  b.disabled = true;
  const r = await fetch('/api/care/log', { method: 'POST', headers: headers(), body: JSON.stringify({ pid, item: b.dataset.item, date: dstr(new Date()), at: new Date().toISOString(), undo: !!b.dataset.undo }) });
  if (r.ok) { state.log = (await r.json()).log; render(); } else b.disabled = false;
});
load(); setInterval(load, 60000);
