// Minimal ICS → event list using ical.js (handles RRULE/EXDATE/RECURRENCE-ID, VTIMEZONE, all-day).
import ICAL from 'ical.js';

const pad = n => String(n).padStart(2, '0');
const dateStr = t => `${t.year}-${pad(t.month)}-${pad(t.day)}`;

export function parseIcs(text, { from, to, max = 1500 } = {}) {
  const root = new ICAL.Component(ICAL.parse(text));
  for (const tz of root.getAllSubcomponents('vtimezone')) {
    try { ICAL.TimezoneService.register(tz); } catch {}
  }
  const vevents = root.getAllSubcomponents('vevent');
  const masters = new Map(), exceptions = [];
  for (const ve of vevents) {
    if ((ve.getFirstPropertyValue('status') || '').toUpperCase() === 'CANCELLED' && !ve.hasProperty('recurrence-id')) continue;
    const ev = new ICAL.Event(ve);
    if (ev.isRecurrenceException()) exceptions.push(ev); else masters.set(ev.uid + '|' + masters.size, ev);
  }
  for (const ex of exceptions) {
    const m = [...masters.values()].find(x => x.uid === ex.uid);
    if (m) m.relateException(ex); else masters.set(ex.uid + '|x' + masters.size, ex);
  }
  const out = [];
  const fromT = +from, toT = +to;
  const push = (ev, startT, endT, key) => {
    if ((ev.component.getFirstPropertyValue('status') || '').toUpperCase() === 'CANCELLED') return;
    const allDay = startT.isDate;
    const s = startT.toJSDate(), e = endT ? endT.toJSDate() : new Date(+s + (allDay ? 864e5 : 36e5));
    if (+e < fromT || +s > toT) return;
    const item = { id: key, title: ev.summary || '(No title)' };
    if (ev.location) item.loc = String(ev.location).slice(0, 200);
    if (ev.description) item.notes = String(ev.description).slice(0, 500);
    if (allDay) {
      item.allDay = true; item.startDate = dateStr(startT);
      let endD = endT;
      if (!endD || endD.compare(startT) <= 0) { endD = startT.clone(); endD.adjust(1, 0, 0, 0); }
      item.endDate = dateStr(endD);
    } else { item.start = s.toISOString(); item.end = e.toISOString(); }
    out.push(item);
  };
  for (const ev of masters.values()) {
    if (out.length >= max) break;
    try {
      if (!ev.startDate) continue;
      if (!ev.isRecurring()) { push(ev, ev.startDate, ev.endDate, ev.uid); continue; }
      const it = ev.iterator();
      let next, n = 0;
      while ((next = it.next()) && n++ < 3000 && out.length < max) {
        if (+next.toJSDate() > toT) break;
        const d = ev.getOccurrenceDetails(next);
        push(d.item, d.startDate, d.endDate, ev.uid + '@' + next.toString());
      }
    } catch (e) { /* skip malformed event */ }
  }
  return out;
}
