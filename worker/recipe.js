// Recipes: import from a link (JSON-LD Recipe schema, else Workers AI over the page text), or from text / a photo.
import { MODEL } from './extract.js';

const SPIRITS = /\b(gin|vodka|rum|tequila|mezcal|whiske?y|bourbon|rye|scotch|brandy|cognac|vermouth|campari|aperol|bitters|liqueur|triple sec|cointreau|amaro|chartreuse|absinthe|prosecco|champagne|simple syrup)\b/i;
const str = v => (typeof v === 'string' ? v : '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '’').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const list = v => (Array.isArray(v) ? v : v ? [v] : []);
export function isCocktail(r, hint = '') {
  const cat = [hint, r.category, r.keywords, r.title].join(' ');
  if (/cocktail|mocktail|\bdrinks?\b|martini|margarita|spritz|negroni|old fashioned|mojito|daiquiri|sour\b/i.test(cat)) return true;
  const ing = r.ingredients || [];
  return ing.length > 0 && ing.length <= 9 && ing.filter(i => SPIRITS.test(i)).length >= 1 && !/\b(bake|oven|skillet|simmer|roast)\b/i.test((r.steps || []).join(' '));
}
function steps(v) {
  const out = [];
  list(v).forEach(s => {
    if (typeof s === 'string') str(s).split(/\n+|(?<=\.)\s+(?=\d+\.)/).forEach(x => x && out.push(x));
    else if (s && s['@type'] === 'HowToSection') steps(s.itemListElement).forEach(x => out.push(x));
    else if (s && (s.text || s.name)) out.push(str(s.text || s.name));
  });
  return out.filter(Boolean).slice(0, 60);
}
function image(v) { const x = list(v)[0]; return typeof x === 'string' ? x : x && (x.url || x.contentUrl) || ''; }
function findRecipe(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n); if (r) return r; } return null; }
  const t = list(node['@type']).join(' ');
  if (/\bRecipe\b/.test(t)) return node;
  return findRecipe(node['@graph']) || findRecipe(node.mainEntity) || null;
}
export function fromJsonLd(html) {
  const blocks = html.match(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const b of blocks) {
    let j; try { j = JSON.parse(b.replace(/^<script[^>]*>|<\/script>$/gi, '').trim()); } catch { continue; }
    const r = findRecipe(j); if (!r) continue;
    const out = {
      title: str(r.name), image: image(r.image), servings: str(list(r.recipeYield).map(String).find(x => /\d/.test(x)) || list(r.recipeYield)[0] || ''),
      ingredients: list(r.recipeIngredient || r.ingredients).map(str).filter(Boolean).slice(0, 80), steps: steps(r.recipeInstructions),
      notes: str(r.description).slice(0, 600), category: list(r.recipeCategory).join(' '), keywords: list(r.keywords).join(' '),
      time: str(r.totalTime || ''),
    };
    if (out.title && (out.ingredients.length || out.steps.length)) return out;
  }
  return null;
}
const PROMPT = `You read ONE recipe (a dish or a cocktail/drink) from a web page, a photo of a cookbook page or recipe card, or pasted text.
Reply with ONLY JSON:
{"kind":"meal"|"cocktail","title":"…","servings":"4","ingredients":["2 cups flour","1 tsp salt"],"steps":["Preheat the oven…","…"],"notes":"",
 "glass":"","garnish":"","method":"shaken|stirred|built|blended|"}
Rules: ingredients exactly as written, one per item, with amounts. steps in order, one per item, no numbering. kind "cocktail" for any mixed drink / cocktail / mocktail (fill glass, garnish, method when given). If there is no recipe reply {"title":""}.`;
export async function aiRecipe(env, { text = '', image: img = '' }) {
  const content = [{ type: 'text', text: text ? 'Recipe source:\n' + text.slice(0, 12000) : 'Read the recipe in the attached image.' }];
  if (img) content.push({ type: 'image_url', image_url: { url: img } });
  const out = await env.AI.run(MODEL, { messages: [{ role: 'system', content: PROMPT }, { role: 'user', content }], max_tokens: 2500, temperature: 0.1 });
  const raw = typeof out === 'string' ? out : out.response && typeof out.response === 'object' ? JSON.stringify(out.response) : String(out.response || '');
  let j = {}; try { j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch {}
  return { title: str(j.title), servings: str(String(j.servings || '')), ingredients: list(j.ingredients).map(x => str(String(x))).filter(Boolean).slice(0, 80),
    steps: list(j.steps).map(x => str(String(x))).filter(Boolean).slice(0, 60), notes: str(j.notes || ''), kind: j.kind === 'cocktail' ? 'cocktail' : 'meal',
    glass: str(j.glass || ''), garnish: str(j.garnish || ''), method: ['shaken', 'stirred', 'built', 'blended'].includes(j.method) ? j.method : '' };
}
export function finish(r, extra = {}) {
  const kind = r.kind === 'cocktail' || isCocktail(r) ? 'cocktail' : 'meal';
  if (kind === 'cocktail') {
    const ing = [];
    (r.ingredients || []).forEach(l => { const m = String(l).match(/^\s*garnish(?:es)?\s*[:\-–]\s*(.+)$/i); if (m) r.garnish = r.garnish || m[1].trim(); else ing.push(l); });
    r.ingredients = ing;
    const st = (r.steps || []).join(' ');
    if (!r.method) { const m = st.match(/\b(shake|stir|blend|build)/i); if (m) r.method = { shake: 'shaken', stir: 'stirred', blend: 'blended', build: 'built' }[m[1].toLowerCase()]; }
    if (!r.glass) { const g = st.match(/\b(coupe|nick ?(?:&|and) ?nora|martini|rocks|old[- ]fashioned|highball|collins|copper mug|margarita|hurricane|wine|flute|julep|tiki|double rocks)\b(?:\s+glass)?/i); if (g) r.glass = g[1][0].toUpperCase() + g[1].slice(1).toLowerCase(); }
    if (!r.garnish) { const g = st.match(/garnish (?:with )?(?:an? )?([^.]+)/i); if (g) r.garnish = g[1].trim().slice(0, 60); }
  }
  return { kind, title: r.title.slice(0, 120), url: extra.url || '', image: /^https?:\/\//.test(r.image || '') ? r.image : '', servings: r.servings || '',
    ingredients: r.ingredients || [], steps: r.steps || [], notes: r.notes || '', glass: r.glass || '', garnish: r.garnish || '', method: r.method || '', time: r.time || '' };
}
export async function importRecipe(env, body) {
  if (body.url) {
    let u; try { u = new URL(String(body.url).trim()); } catch { throw Object.assign(new Error('That doesn’t look like a link'), { status: 400 }); }
    if (!/^https?:$/.test(u.protocol)) throw Object.assign(new Error('Only http(s) links'), { status: 400 });
    let r; try { r = await fetch(u.href, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', accept: 'text/html,*/*' }, signal: AbortSignal.timeout(15000) }); }
    catch { throw Object.assign(new Error('Couldn’t reach that link'), { status: 502 }); }
    if (!r.ok) throw Object.assign(new Error(`The link returned ${r.status}`), { status: 502 });
    const html = (await r.text()).slice(0, 3000000);
    const ld = fromJsonLd(html);
    if (ld) return { recipe: finish(ld, { url: u.href }), via: 'schema' };
    const og = (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) || [])[1] || '';
    const text = html.replace(/<(script|style|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n');
    const a = await aiRecipe(env, { text });
    if (!a.title) throw Object.assign(new Error('Couldn’t find a recipe on that page'), { status: 422 });
    a.image = og; return { recipe: finish(a, { url: u.href }), via: 'ai' };
  }
  if (!String(body.text || '').trim() && !body.image) throw Object.assign(new Error('Add a link, a photo or some text'), { status: 400 });
  const a = await aiRecipe(env, body);
  if (!a.title) throw Object.assign(new Error('Couldn’t find a recipe in that'), { status: 422 });
  return { recipe: finish(a), via: 'ai' };
}
