// Login, two modes:
//  1. Cloudflare Access (recommended): set ACCESS_TEAM_DOMAIN (https://<team>.cloudflareaccess.com) and ACCESS_AUD
//     (the application's Audience tag). Access protects /auth (one-time PIN email login); its CF_Authorization cookie
// (sent on every path of this host) is verified here against the team's signing keys.
//  2. Simple passcode (fallback when Access is not configured): /auth shows a passcode form (EDIT_PASSCODE secret)
//     and sets a signed session cookie.
export const accessOn = env => !!(env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD);
const teamOf = env => String(env.ACCESS_TEAM_DOMAIN).replace(/\/+$/, '').replace(/^(?!https?:\/\/)/, 'https://');
let certs = null, certsAt = 0;
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
async function keys(TEAM, force) {
  if (!certs || force || Date.now() - certsAt > 3600e3) {
    const r = await fetch(TEAM + '/cdn-cgi/access/certs');
    certs = (await r.json()).keys || []; certsAt = Date.now();
  }
  return certs;
}
export function cookie(req, name) {
  const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : '';
}
// → email of the signed-in family member, or ''
export async function accessUser(req, env) {
  if (!accessOn(env)) return '';
  const TEAM = teamOf(env), AUD = String(env.ACCESS_AUD).trim();
  const tok = req.headers.get('cf-access-jwt-assertion') || cookie(req, 'CF_Authorization');
  if (!tok || tok.split('.').length !== 3) return '';
  try {
    const [h, p, s] = tok.split('.');
    const head = JSON.parse(new TextDecoder().decode(b64u(h))), body = JSON.parse(new TextDecoder().decode(b64u(p)));
    const aud = Array.isArray(body.aud) ? body.aud : [body.aud];
    if (!aud.includes(AUD) || body.iss !== TEAM || !(body.exp * 1000 > Date.now())) return '';
    let jwk = (await keys(TEAM)).find(k => k.kid === head.kid);
    if (!jwk) jwk = (await keys(TEAM, true)).find(k => k.kid === head.kid);
    if (!jwk) return '';
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(s), new TextEncoder().encode(h + '.' + p));
    return ok ? (body.email || 'service') : '';
  } catch (e) { return ''; }
}

// ---- passcode mode session cookie: HMAC(EDIT_PASSCODE, 'hq-session')
async function sig(env) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(env.EDIT_PASSCODE).toLowerCase()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const b = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('hq-session-v1')));
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
}
export async function passUser(req, env) {
  if (!env.EDIT_PASSCODE) return '';
  const c = cookie(req, 'hq_pass');
  return c && c === await sig(env) ? 'passcode' : '';
}
export async function passCookie(env) {
  return `hq_pass=${await sig(env)}; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax`;
}
