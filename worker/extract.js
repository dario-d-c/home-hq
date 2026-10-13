// "Add from photo or text": Workers AI pulls events / chores / groceries out of a photo or pasted text.
export const MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['event', 'chore', 'grocery'] },
          title: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD (events only)' },
          endDate: { type: 'string', description: 'YYYY-MM-DD for multi-day all-day events' },
          start: { type: 'string', description: 'HH:MM 24h, empty if all day' },
          end: { type: 'string', description: 'HH:MM 24h' },
          person: { type: 'string', description: 'one of the family names, or empty' },
          location: { type: 'string' },
          notes: { type: 'string' },
          qty: { type: 'number' },
        },
        required: ['kind', 'title'],
      },
    },
  },
  required: ['items'],
};

function prompt({ today, weekday, tz, people, mode }) {
  return `You read family paperwork (school notices, lunch menus, meal plans, practice schedules, emails, shopping lists, and TRAVEL confirmations: flights, hotels, trains, rental cars, itineraries) and output items for a family dashboard.
Today is ${weekday} ${today}. Home time zone: ${tz}. Family members: ${people.join(', ') || 'unknown'}.

Reply with ONLY a JSON object, no prose:
{"travellers":["Alex","Sam"],
 "items":[{"kind":"event","title":"Soccer game","date":"2026-10-13","start":"17:30","end":"19:00","people":["Jamie"],"location":"Riverside Park","notes":"Bring shin guards"},
 {"kind":"meal","title":"Cheese pizza","date":"2026-10-14","slot":"school","people":[]},
 {"kind":"event","travel":"flight","title":"Flight B6 123 BOS → LAX","airline":"JetBlue","flight":"B6 123","from":"BOS","to":"LAX","date":"2026-11-02","start":"08:15","startTz":"America/New_York","endDate":"2026-11-02","end":"10:40","endTz":"America/Los_Angeles","confirmation":"ABC123"},
 {"kind":"event","travel":"hotel","title":"Hotel: Hilton Santa Monica","date":"2026-11-02","endDate":"2026-11-06","location":"1707 4th St, Santa Monica, CA","confirmation":"98765"},
 {"kind":"grocery","title":"Juice boxes","qty":24},
 {"kind":"chore","title":"Empty dishwasher","people":[]}]}

Rules:
- kind "event" = anything happening on a date; "meal" = a planned meal: SCHOOL LUNCH MENUS -> one meal per school day with slot "school"; family meal plans -> slot "dinner" unless clearly breakfast/brunch/lunch/snack; "grocery" = something to buy; "chore" = an undated household task.
- title: SHORT (2–6 words). Put times, places and people in their own fields, never in the title. Closures like "No school" are all-day events.
- date: YYYY-MM-DD. Read dates from the document carefully (match each column/row to ITS OWN date). Resolve relative dates against today, choosing the nearest future date. Weekly repeating items: one event per occurrence for the next 4 weeks.
- start/end: 24-hour HH:MM LOCAL time exactly as printed ("5:30pm" -> "17:30"); empty for all-day.
- people: family names this item clearly concerns (named, "for Riley", "Jamie's team"), else [].
- Travel: set "travel" to flight|hotel|train|car|other. Flights/trains: one item per leg; "startTz"/"endTz" are IANA time zones of the departure/arrival city (e.g. BOS America/New_York, YYZ America/Toronto, LAX America/Los_Angeles, LHR Europe/London); "endDate" is the arrival date (may be next day). Hotels: all-day stay from check-in date to check-out "endDate", address in location. Rental cars: one item for pick-up (with time) and one for drop-off. Always include "confirmation" when printed.
- travellers: passenger / guest names exactly as printed (empty if none).
- qty: number to buy for groceries.
${mode && mode !== 'auto' ? `Hint: the user says this is mainly ${{ event: 'calendar events', chore: 'chores', grocery: 'a shopping list', meal: 'a meal plan', travel: 'travel plans', lunch: 'a SCHOOL LUNCH MENU: output one kind "meal" item per school day with slot "school" (title = the main dish)', mealplan: 'a family meal plan (kind "meal", slot dinner unless clearly another meal)', schedule: 'a schedule, calendar or travel itinerary (kind "event")' }[mode] || mode}.` : ''}
- SPECIAL: if this is ONE RECIPE (a dish or a cocktail/drink: an ingredients list with amounts plus method/steps, e.g. a cookbook page, recipe card, recipe web page), reply ONLY {"doc":"recipe","items":[]}.
- SPECIAL: if this is a WEEKLY REPEATING menu (weekday columns MONDAY-FRIDAY with NO day numbers/dates, often a school-year title like "2026-2027 Breakfast Menus", possibly several schools), reply ONLY {"doc":"weeklymenu","items":[]}.
- SPECIAL: if this is a SCHOOL LUNCH MENU (a title like "Lunch Menu", a school name, a month grid of weekday meals, "daily beverages", "menus subject to change", "daily alternate"), reply ONLY {"doc":"lunchmenu","items":[]} — even if the user said it is a meal plan.
- SPECIAL: if this is a district/school calendar for a WHOLE SCHOOL YEAR (several month grids, legend of no-school / early-release days), reply ONLY {"doc":"schoolyear","items":[]}.
If nothing useful is found reply {"items":[]}.`;
}

// School-year (district) calendar: month grids with a colour/symbol legend.
const SCHOOL_TYPES = ['noschool', 'vacation', 'half', 'first', 'last', 'pd', 'conference', 'picture', 'other'];
function syPrompt({ today }) {
  const y = +today.slice(0, 4), m = +today.slice(5, 7), sy = m >= 7 ? y : y - 1;
  return `You read a school district calendar for the WHOLE SCHOOL YEAR (usually month grids, often with a colour or symbol LEGEND/KEY, and a list of notes).
Today is ${today}. Unless the page prints other years, the school year is ${sy}-${sy + 1}: August-December are ${sy}, January-July are ${sy + 1}.

FIRST find the legend/key (e.g. "X = No school", shaded = holiday, "*" or "ED" = early dismissal / half day, "PD" = professional development / no school for students). Then go through EVERY month shown and every marked day, using the legend to decide its type. Also use any text list of dates on the page.

Reply with ONLY JSON:
{"items":[{"type":"first","title":"First day of school","date":"${sy}-09-02"},
{"type":"noschool","title":"Labor Day","date":"${sy}-09-01"},
{"type":"vacation","title":"Winter break","date":"${sy}-12-24","endDate":"${sy + 1}-01-01"},
{"type":"half","title":"Early release","date":"${sy}-11-26","dismiss":"12:15"},
{"type":"pd","title":"Professional day – no school","date":"${sy + 1}-01-20"},
{"type":"conference","title":"Parent-teacher conferences","date":"${sy}-11-13"},
{"type":"picture","title":"Picture day","date":"${sy}-10-08"},
{"type":"last","title":"Last day of school","date":"${sy + 1}-06-17"}]}

Rules:
- type is one of: noschool (holiday / no school / closed), vacation (break of 2+ consecutive days: give date AND endDate = last day off), half (early release / half day), first, last, pd (teacher PD/workshop day, students off), conference, picture, other.
- Consecutive no-school weekdays that form a break -> ONE vacation item with endDate. Single days -> one item each.
- dismiss: early-release time as 24h HH:MM if printed, else "".
- title: short (2-5 words), the holiday name if printed.
- Dates YYYY-MM-DD, careful to match each mark to ITS OWN day-of-month cell in the right month.
- Never output ordinary school days or weekends. If nothing found reply {"items":[]}.`;
}

// School lunch menu: whole document decided up front, one combined menu line per school day.
function lunchPrompt({ today }) {
  return `This image/text is a SCHOOL LUNCH MENU laid out as a calendar grid: 5 columns MON TUE WED THU FRI, one row per week. Each cell has a day number and 1-4 lines of food.
Today is ${today}. Find the month and year printed in the title (e.g. "OCT 2026"); if no year is printed use the one closest to today.

Reply with ONLY JSON. "weeks" has one array per grid ROW, top to bottom, and EVERY row has EXACTLY 5 strings in column order Mon, Tue, Wed, Thu, Fri:
{"month":"2026-10","school":"Lincoln Elementary","weeks":[
 ["", "", "", "1: Chicken Nachos, Taco Topping, Corn & Black Beans", "2: Pizza Bagels, Strawberry Spinach Salad"],
 ["5: Mandarin Orange Chicken, Rice", "6: ...", "7: ...", "8: ...", "9: ..."],
 ["12: NO SCHOOL Columbus Day", "13: ...", "14: ...", "15: ...", "16: ..."]],
 "note":"Daily beverages: 1% milk, chocolate milk. Daily alternate: yogurt meal"}

Rules:
- Each string = "<day number printed in that cell>: <all food lines of that cell joined with ', '>". Join a dish split over two lines ("Stuffed Crust Cheese" + "Pizza").
- Empty cell (before the 1st / after the last day) = "". Cell partly hidden or unreadable = "<day>: ?" or "?" — but it MUST keep its own position; never move the next cell's food into it.
- No-school / holiday cell: "<day>: NO SCHOOL <holiday name>".
- Ignore decorations and the side panel; summarise daily beverages / alternates in "note".`;
}
const pad2 = n => String(n).padStart(2, '0');
async function lunchMenu(env, content, ctx) {
  const out = await env.AI.run(MODEL, { messages: [{ role: 'system', content: lunchPrompt(ctx) }, { role: 'user', content }], max_tokens: 3000, temperature: 0.05 });
  const j = parseJson(out);
  const ym = /^\d{4}-\d{2}$/.test(j.month || '') ? j.month : ctx.today.slice(0, 7);
  const Y = +ym.slice(0, 4), M = +ym.slice(5) - 1, last = new Date(Date.UTC(Y, M + 1, 0)).getUTCDate();
  // Monday of the grid's first row = Monday of the week containing the first school day (1st, or next Monday if the 1st is a weekend)
  const first = new Date(Date.UTC(Y, M, 1)); let fd = first.getUTCDay();
  const mon0 = new Date(+first - ((fd + 6) % 7) * 864e5 + (fd === 0 || fd === 6 ? 7 * 864e5 : 0));
  const rows = (Array.isArray(j.weeks) ? j.weeks : []).filter(Array.isArray);
  // structural date for row r, col c; the printed day numbers vote on a whole-week offset (handles a skipped/extra row)
  const cells = [];
  rows.forEach((row, r) => row.slice(0, 5).forEach((txt, c) => { const t = String(txt || '').trim(); if (!t) return;
    const m = t.match(/^(\d{1,2})\s*[:.\-]?\s*(.*)$/); cells.push({ r, c, n: m ? +m[1] : null, text: (m ? m[2] : t).trim() }); }));
  const votes = {}; cells.forEach(x => { if (x.n == null) return; const st = new Date(+mon0 + (x.r * 7 + x.c) * 864e5); const off = Math.round((Date.UTC(Y, M, x.n) - +st) / (7 * 864e5)); votes[off] = (votes[off] || 0) + 1; });
  // no day numbers anywhere → it's a weekly repeating menu, not a dated month
  if (cells.length && cells.every(x => x.n == null)) return weeklyMenu(env, content, ctx);
  const off = +(Object.entries(votes).sort((a, b) => b[1] - a[1])[0] || [0])[0];
  const note = clean(j.note), items = [], seen = new Set();
  cells.forEach(x => {
    // printed day number wins when it agrees with its column's weekday; otherwise use the grid position
    let dt = x.n && x.n <= last ? new Date(Date.UTC(Y, M, x.n)) : null;
    if (!dt || dt.getUTCDay() !== x.c + 1) dt = new Date(+mon0 + ((x.r + off) * 7 + x.c) * 864e5);
    if (dt.getUTCMonth() !== M || dt.getUTCDate() > last) return;
    const date = dt.toISOString().slice(0, 10); if (seen.has(date)) return; seen.add(date);
    const ns = x.text.match(/no\s*school|holiday|closed/i);
    const text = x.text.replace(/\s*\n\s*/g, ', ');
    if (ns) items.push({ kind: 'event', school: 'noschool', title: (clean(text.replace(/no\s*school|closed/ig, '').replace(/^[\s,–-]+|[\s,–-]+$/g, '')) || 'Holiday') + ' – No school', date, endDate: '', start: '', end: '', people: [], location: '', notes: '', qty: 1, slot: 'dinner' });
    else if (text && text !== '?') items.push({ kind: 'meal', slot: 'school', title: clean(text.replace(/\?$/, '').trim()) || '?', date, endDate: '', start: '', end: '', people: [], location: '', notes: note, qty: 1 });
  });
  items.sort((a, b) => (a.date < b.date ? -1 : 1));
  return { items, travellers: [], doc: 'lunchmenu', school: clean(j.school), model: MODEL };
}

// Weekly repeating menu (same Mon-Fri every week, per school)
function weeklyPrompt({ today }) {
  return `This is a WEEKLY REPEATING school menu: weekday columns (Monday-Friday) with no dates; the same week repeats all year. There may be several schools, each with its own Mon-Fri block, and "Always available" lines.
Today is ${today}.
Reply with ONLY JSON:
{"meal":"breakfast","year":"2026-2027","schools":[{"name":"Lincoln Elementary","days":{"mon":"Cinnamon Roll, Yogurt / Cheese, Grain Variety, Fruit / Juice, Choice of Milk","tue":"...","wed":"...","thu":"...","fri":"..."},"always":"Cereal, Breakfast Bars or Yogurt Meals"}]}
Rules:
- meal: "breakfast" or "lunch" (from the title).
- One entry per school block, using the school name printed above that block (e.g. "Preschool", "Lincoln Elementary", "Middle High School"). If no school name, use "".
- days: every food line under that weekday column joined with ", " (fix obvious typos like "Chioice"). Keep each school's columns separate.
- always: the "Always available" line that belongs to that school block (the line printed under or inside it), else "".
- Ignore contact info, "menus are subject to change" and decorations.`;
}
async function weeklyMenu(env, content, ctx) {
  const out = await env.AI.run(MODEL, { messages: [{ role: 'system', content: weeklyPrompt(ctx) }, { role: 'user', content }], max_tokens: 2500, temperature: 0.05 });
  const j = parseJson(out), D = ['mon', 'tue', 'wed', 'thu', 'fri'];
  const schools = (Array.isArray(j.schools) ? j.schools : []).map(x => ({ name: clean(x && x.name), always: clean(x && x.always),
    days: Object.fromEntries(D.map((d, i) => [i + 1, clean(String((x && x.days && (x.days[d] || x.days[d.toUpperCase()])) || '').replace(/\s*\n\s*/g, ', '))])) }))
    .filter(x => Object.values(x.days).some(Boolean));
  const y = String(j.year || '').match(/(20\d\d)\s*[-–\/]\s*(20)?(\d\d)/);
  return { items: [], travellers: [], doc: 'weeklymenu', menu: { meal: j.meal === 'lunch' ? 'lunch' : 'breakfast', year: y ? `${y[1]}-${+y[1] + 1}` : '', schools }, model: MODEL };
}

function parseJson(out) {
  const r = out?.response ?? out;
  if (r && typeof r === 'object') return r;
  const s = String(r || '');
  const a = s.indexOf('{');
  if (a < 0) throw new Error('The AI reply had no JSON');
  // the model sometimes adds prose or a second object after the JSON: try each closing brace from the end
  for (let b = s.lastIndexOf('}'); b > a; b = s.lastIndexOf('}', b - 1)) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {} }
  // last resort: salvage complete item objects
  const items = (s.match(/\{[^{}]*"kind"[^{}]*\}/g) || []).map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
  if (items.length) return { items };
  throw new Error('The AI reply wasn’t readable — try again');
}

const clean = s => (typeof s === 'string' ? s.trim().slice(0, 200) : '');
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const isTime = s => /^\d{1,2}:\d{2}$/.test(s || '');

export async function extract(env, body) {
  const { text = '', image = '', mode = 'auto' } = body;
  if (!text.trim() && !image) throw Object.assign(new Error('Add a photo or some text'), { status: 400 });
  if (image && !/^data:image\/(jpeg|png|webp);base64,/.test(image)) throw Object.assign(new Error('Unsupported image'), { status: 400 });
  const ctx = {
    today: isDate(body.today) ? body.today : new Date().toISOString().slice(0, 10),
    weekday: clean(body.weekday) || '', tz: clean(body.tz) || 'America/New_York',
    people: Array.isArray(body.people) ? body.people.map(clean).filter(Boolean).slice(0, 12) : [], mode,
  };
  const content = [{ type: 'text', text: (text.trim() ? 'Text:\n' + text.slice(0, 8000) : 'Read the attached image.') }];
  if (image) content.push({ type: 'image_url', image_url: { url: image } });
  // text layer says "weekday columns + a school year + no dates" → weekly repeating menu, no guessing
  const weeklyText = /\bmon(day)?\b[\s\S]*\bfri(day)?\b/i.test(text) && /\b20\d\d\s*[-–\/]\s*(20)?\d\d\b/.test(text) && /\bmenus?\b/i.test(text)
    && !/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\b\d{1,2}\/\d{1,2}\b/i.test(text)
    && (text.match(/(^|\s)([1-9]|[12]\d|3[01])(?=\s|$)/g) || []).length < 10;   // a dated month grid has lots of day numbers
  if (weeklyText && mode !== 'schoolyear') return weeklyMenu(env, content, ctx);
  if (mode === 'lunch') return lunchMenu(env, content, ctx);
  if (mode === 'recipe') { const { aiRecipe, finish } = await import('./recipe.js'); const a = await aiRecipe(env, { text, image }); return { doc: 'recipe', recipe: a.title ? finish(a) : null, items: [] }; }
  const out = await env.AI.run(MODEL, {
    messages: [{ role: 'system', content: mode === 'schoolyear' ? syPrompt(ctx) : prompt(ctx) }, { role: 'user', content }],
    max_tokens: mode === 'schoolyear' ? 4096 : 2048, temperature: 0.1,
  });
  const parsed = parseJson(out);
  // the whole document is a school lunch menu → dedicated pass, every item becomes school lunch
  if (parsed.doc === 'recipe' && mode !== 'schoolyear') { const { aiRecipe, finish } = await import('./recipe.js'); const a = await aiRecipe(env, { text, image }); if (a.title) return { doc: 'recipe', recipe: finish(a), items: [] }; }
  if (parsed.doc === 'weeklymenu' && mode !== 'schoolyear') return weeklyMenu(env, content, ctx);
  if (parsed.doc === 'lunchmenu' && mode !== 'schoolyear') return lunchMenu(env, content, ctx);
  const names = Object.fromEntries(ctx.people.map(n => [n.toLowerCase(), n]));
  // match a printed name ("SMITH/SAM MS", "Sam Smith") to a family first name
  const match = raw => { const t = clean(raw).toLowerCase(); if (!t) return ''; if (names[t]) return names[t];
    const words = t.split(/[^a-z]+/).filter(Boolean); const hit = ctx.people.find(n => words.includes(n.toLowerCase())); return hit || ''; };
  const many = v => [...new Set((Array.isArray(v) ? v : v ? [v] : []).map(match).filter(Boolean))];
  const isTz = z => { try { if (!z) return false; new Intl.DateTimeFormat('en', { timeZone: z }); return true; } catch { return false; } };
  if (mode === 'schoolyear') {
    const items = (Array.isArray(parsed.items) ? parsed.items : []).slice(0, 150).map(it => {
      const type = SCHOOL_TYPES.includes(it.type) ? it.type : 'other';
      return { kind: 'event', school: type, title: clean(it.title) || type, date: isDate(it.date) ? it.date : '',
        endDate: isDate(it.endDate) && it.endDate > it.date ? it.endDate : '', dismiss: isTime(it.dismiss) ? it.dismiss.padStart(5, '0') : '' };
    }).filter(it => it.date);
    return { items, model: MODEL };
  }
  const travellers = many(parsed.travellers);
  const items = (Array.isArray(parsed.items) ? parsed.items : []).slice(0, 60).map(it => {
    const travel = ['flight', 'hotel', 'train', 'car', 'other'].includes(it.travel) ? it.travel : '';
    const out = {
      kind: ['event', 'chore', 'grocery', 'meal'].includes(it.kind) ? it.kind : 'event',
      title: clean(it.title),
      date: isDate(it.date) ? it.date : '',
      endDate: isDate(it.endDate) ? it.endDate : '',
      start: isTime(it.start) ? it.start.padStart(5, '0') : '',
      end: isTime(it.end) ? it.end.padStart(5, '0') : '',
      people: many(it.people ?? it.person),
      location: clean(it.location), notes: clean(it.notes),
      qty: Math.max(1, Math.min(99, Math.round(+it.qty) || 1)),
      slot: ['breakfast', 'brunch', 'lunch', 'dinner', 'snack', 'school'].includes(it.slot) ? it.slot : 'dinner',
    };
    if (travel) {
      Object.assign(out, { travel, startTz: isTz(it.startTz) ? it.startTz : '', endTz: isTz(it.endTz) ? it.endTz : '',
        airline: clean(it.airline), flight: clean(it.flight), from: clean(it.from), to: clean(it.to), confirmation: clean(it.confirmation) });
      if (!out.people.length) out.people = travellers.slice();
    }
    // the user picked a specific scan type: route everything there
    if (mode === 'grocery') out.kind = 'grocery';
    if (mode === 'lunch') { out.kind = 'meal'; out.slot = 'school'; }
    if (mode === 'mealplan') out.kind = 'meal';
    return out;
  }).filter(it => it.title);
  return { items, travellers, doc: parsed.doc === 'schoolyear' && mode === 'auto' ? 'schoolyear' : undefined, model: MODEL };
}
