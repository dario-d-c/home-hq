// Shared photos for the frame screensaver, stored in KV.
//   photos            → index { settings, photos:[{id,w,h,added,show,size}] }
//   photo:<id>:full   → JPEG ≤1600px (editor preview)
//   photo:<id>:s      → JPEG ≤1280px (frame slideshow)
//   photo:<id>:t      → JPEG ≤400px  (editor grid thumbnail)
const IDX = 'photos';
export const DEFAULT_SETTINGS = { idleMin: 5, secs: 12, shuffle: true, kenBurns: false };
const VARIANTS = ['full', 's', 't'];
const MAX_PHOTO = 6 * 1024 * 1024, MAX_PHOTOS = 300;

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export async function getIndex(env) {
  const v = await env.DATA_KV.get(IDX, 'json');
  return { settings: { ...DEFAULT_SETTINGS, ...(v?.settings || {}) }, photos: v?.photos || [] };
}

function cleanSettings(s = {}) {
  const n = (v, lo, hi, d) => Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d;
  return { idleMin: n(s.idleMin, 1, 240, 5), secs: n(s.secs, 4, 120, 12), shuffle: !!s.shuffle, kenBurns: !!s.kenBurns };
}

export async function handlePhotos(req, env, parts, authed) {
  // GET /api/photos (public)  |  GET /api/photo/<id>[?v=s|t|full] (public, immutable)
  if (parts[0] === 'photo' && req.method === 'GET') {
    const id = parts[1] || '', v = new URL(req.url).searchParams.get('v') || 's';
    if (!/^[a-z0-9]{6,40}$/.test(id) || !VARIANTS.includes(v)) return json({ error: 'not found' }, 404);
    const body = await env.DATA_KV.get(`photo:${id}:${v}`, 'arrayBuffer');
    if (!body) return json({ error: 'not found' }, 404);
    return new Response(body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' } });
  }
  if (req.method === 'GET') return json(await getIndex(env));
  if (!authed) return json({ error: 'bad passcode' }, 401);

  const idx = await getIndex(env);
  if (req.method === 'POST') {
    // multipart: full, s, t (JPEG blobs) + w, h
    if (idx.photos.length >= MAX_PHOTOS) return json({ error: 'Photo limit reached (' + MAX_PHOTOS + ')' }, 400);
    let form; try { form = await req.formData(); } catch { return json({ error: 'expected form data' }, 400); }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    let size = 0;
    for (const v of VARIANTS) {
      const f = form.get(v);
      if (!f || typeof f === 'string') return json({ error: 'missing ' + v }, 400);
      const buf = await f.arrayBuffer();
      const b = new Uint8Array(buf, 0, 3);
      if (buf.byteLength > MAX_PHOTO || b[0] !== 0xFF || b[1] !== 0xD8 || b[2] !== 0xFF) return json({ error: 'not a JPEG (' + v + ')' }, 400);
      if (v === 'full') size = buf.byteLength;
      await env.DATA_KV.put(`photo:${id}:${v}`, buf);
    }
    const p = { id, w: +form.get('w') || 0, h: +form.get('h') || 0, added: new Date().toISOString(), show: true, size };
    const fresh = await getIndex(env);           // re-read to reduce clobbering during multi-upload
    fresh.photos.unshift(p);
    await env.DATA_KV.put(IDX, JSON.stringify(fresh));
    return json({ photo: p, ...fresh });
  }
  if (req.method === 'PUT') {
    // { settings?, photos?: [{id, show}] } — can reorder/toggle existing photos, never add.
    let body; try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }
    if (body.settings) idx.settings = cleanSettings({ ...idx.settings, ...body.settings });
    if (Array.isArray(body.photos)) {
      const byId = new Map(idx.photos.map(p => [p.id, p]));
      const next = [];
      for (const q of body.photos) { const p = byId.get(q?.id); if (p) { next.push({ ...p, show: q.show !== false }); byId.delete(q.id); } }
      idx.photos = next.concat([...byId.values()]);   // anything not mentioned is kept
    }
    await env.DATA_KV.put(IDX, JSON.stringify(idx));
    return json(idx);
  }
  if (req.method === 'DELETE' && parts[1]) {
    const id = parts[1];
    idx.photos = idx.photos.filter(p => p.id !== id);
    await env.DATA_KV.put(IDX, JSON.stringify(idx));
    await Promise.all(VARIANTS.map(v => env.DATA_KV.delete(`photo:${id}:${v}`)));
    return json(idx);
  }
  return json({ error: 'method' }, 405);
}
