// نقطة دخول الواجهة الخلفية (Neon Function): توجيه + حماية + مصادقة + أخطاء موحّدة
import { createSql } from './sql.js';
import { seal, open } from './crypto.js';
import { HttpError, verifyJWT, inspect, isProbe, isAttackTool, BOT_UA, rate, strike, clearStrikes, once, sha, decodeSafe } from './lib.js';
import userRoutes from './routes.js';
import adminRoutes from './admin.js';

const E = process.env;
// الاتصال: إما دور store_api مباشرة، أو اتصال Neon المحقون مع النزول الإجباري لدور store_api في كل معاملة
const DB_URL = E.STORE_DB_URL || E.DATABASE_URL;
const sql = DB_URL ? createSql(DB_URL) : null;
const PRE = E.STORE_DB_URL ? [] : [['set local role store_api']];
const sys = async (t, p) => { const r = await sql.batch([...PRE, [t, p]]); return r[r.length - 1]; };
// استعلامات بصلاحية المالك لجداول ops فقط (مفتاح التشفير وسجل أجهزة المدير) — store_api لا يصل إليها أبداً
const ownerQ = async (t, p) => (await sql.batch([[t, p]]))[0];
const SALT = E.VISITOR_SALT || sha(`${DB_URL}:visitor`);
// تنبيه المالك عند دخول لوحة التحكم من جهاز/متصفح جديد (حماية من سرقة الجلسة)
const seenDev = new Set();
async function adminDevice(c) {
  try {
    const ua = String(c.ua || '').replace(/[\d._]+/g, '').slice(0, 300);
    const h = sha(`${ua}|${SALT}`).slice(0, 32), k = `${c.uid}:${h}`;
    if (seenDev.has(k)) return;
    seenDev.add(k);
    const r = await ownerQ(`insert into ops.admin_devices(uid, ua_hash, ua) values ($1, $2, $3)
      on conflict (uid, ua_hash) do update set last_seen = now()
      returning (xmax = 0) as fresh, (select count(*)::int from ops.admin_devices where uid = $1) as before`, [c.uid, h, ua.slice(0, 200)]);
    if (r[0]?.fresh && r[0].before > 0) await c.secLog('admin_new_device', 'high', { ua: ua.slice(0, 160) });
  } catch { /* لا نعطّل اللوحة إن فشل التسجيل */ }
}
const ORIGINS = new Set((E.ALLOWED_ORIGINS || 'https://majhool-store.netlify.app').split(',').map((s) => s.trim()).filter(Boolean));
const SEC = {
  'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY',
  'strict-transport-security': 'max-age=31536000; includeSubDomains', 'cross-origin-resource-policy': 'cross-origin',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
};

const routes = [];
const add = (method, path, auth, handler, opt = {}) => {
  const keys = [];
  const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, auth, handler, ...opt });
};
userRoutes(add);
adminRoutes(add);

// ---- ذاكرة مؤقتة: عناوين محظورة + إعدادات ----
const blocked = new Set();
let blocksAt = 0;
async function refreshBlocks() {
  if (Date.now() - blocksAt < 30000) return;
  blocksAt = Date.now();
  try {
    const rows = await sys('select ip from ip_blocks where blocked_until is null or blocked_until > now()');
    blocked.clear();
    rows.forEach((r) => blocked.add(r.ip));
  } catch (e) { console.error('blocks', e.message); }
}
const settingsCache = new Map();
async function getSetting(key) {
  const c = settingsCache.get(key);
  if (c && c.at > Date.now() - 60000) return c.v;
  const r = await sys('select value from settings where key = $1', [key]);
  const v = r[0]?.value ?? null;
  settingsCache.set(key, { v, at: Date.now() });
  return v;
}

function dbFor(uidv) {
  const pre = [...PRE, ["select set_config('app.uid', $1, true)", [uidv || '']]], n = pre.length;
  return {
    all: async (t, p) => (await sql.batch([...pre, [t, p]]))[n],
    one: async (t, p) => (await sql.batch([...pre, [t, p]]))[n][0] || null,
    tx: async (list) => (await sql.batch([...pre, ...list])).slice(n),
  };
}

const DB_ERR = {
  auth_required: 401, registration_closed: 403, no_access: 403, forbidden: 403, forbidden_role_change: 403, forbidden_ban: 403,
  forbidden_ban_admin: 403, owner_immutable: 403, cannot_ban_self: 403, invalid_claim: 403, owner_exists: 409,
  product_unavailable: 404, file_not_found: 404, auth_user_missing: 401, profile_missing: 404, product_is_free: 400, invalid_status: 400,
};

async function handle(req) {
  const url = new URL(req.url);
  const origin = req.headers.get('origin');
  const allowed = origin && (ORIGINS.has(origin) || (E.ALLOW_LOCALHOST === '1' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)));
  const cors = allowed ? {
    'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS', 'access-control-max-age': '600',
  } : {};
  const c = {
    req, url, method: req.method, path: url.pathname.replace(/\/+$/, '') || '/',
    ip: (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || '0.0.0.0', // المنصة تستبدل هذا الرأس بعنوان العميل الحقيقي
    ua: (req.headers.get('user-agent') || '').slice(0, 300), uid: null, profile: null, cache: null,
    blocked, getSetting, settingsCache, seal: (t) => seal(ownerQ, t), open: (t) => open(ownerQ, t),
  };
  const out = (status, data, headers = {}) => new Response(data == null ? null : JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SEC, ...cors, ...headers },
  });
  if (req.method === 'OPTIONS') return out(allowed ? 204 : 403, null);
  if (!sql) return out(503, { error: 'not_configured' });
  if (origin && !allowed) return out(403, { error: 'origin_not_allowed' });

  c.secLog = async (kind, sev, detail = {}) => {
    if (!once(`${c.ip}|${kind}`, sev === 'low' ? 300e3 : 60e3)) return;
    try {
      await sys('select log_security($1,$2,$3,$4,$5,$6,$7,$8)', [c.ip, kind, sev, c.method, (c.path + url.search).slice(0, 500), c.ua, c.uid, detail]);
    } catch (e) { console.error('seclog', e.message); }
  };
  c.penalize = async (weight, reason, sev = 'high') => {
    if (strike(c.ip, weight) < 10) return;
    clearStrikes(c.ip);
    blocked.add(c.ip);
    try { await sys('select auto_block($1,$2,$3,$4)', [c.ip, reason, sev, 15]); } catch (e) { console.error('block', e.message); }
    await c.secLog('auto_block', 'high', { reason });
  };
  c.unblock = (ip) => { blocked.delete(ip); clearStrikes(ip); };

  // مصيدة مسارات الفحص الممررة من Netlify (/wp-admin، /.env ...): تسجيل فقط، لأن العنوان الظاهر هو عنوان Netlify
  if (c.path === '/trap' || c.path.startsWith('/trap/')) {
    await c.secLog('path_scan_site', 'medium', { path: (c.path.slice(5) || url.searchParams.get('p') || '').slice(0, 300), via: req.headers.get('x-nf-request-id') ? 'netlify' : 'direct' });
    return out(404, { error: 'not_found' });
  }
  await refreshBlocks();
  const auth = req.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null;

  // 1) العناوين المحظورة (يُستثنى المدير الموثّق حتى لا يُقفل على نفسه)
  if (blocked.has(c.ip)) {
    const claims = token && await verifyJWT(token);
    const ok = claims && (await dbFor(claims.sub).one('select app_is_admin() as a'))?.a;
    if (!ok) return out(403, { error: 'blocked' });
  }
  // 2) أدوات الهجوم المعروفة
  if (isAttackTool(c.ua)) {
    await c.secLog('attack_tool', 'high', { ua: c.ua });
    await c.penalize(5, 'attack_tool');
    return out(403, { error: 'forbidden' });
  }
  // 3) فحص المسار والاستعلام بحثاً عن أنماط الاستغلال
  const qs = new URLSearchParams(url.search);
  const q = qs.get('q') || '';
  qs.delete('q');
  const hit = inspect(decodeSafe(url.pathname) + ' ' + [...qs].map(([k, v]) => `${k}=${v}`).join('&'));
  if (hit) {
    await c.secLog(hit.kind, hit.sev, { where: 'url' });
    await c.penalize(hit.sev === 'critical' ? 10 : 4, hit.kind, hit.sev);
    return out(400, { error: 'bad_request' });
  }
  if (q && inspect(q)) await c.secLog('suspicious_search', 'medium', { q: q.slice(0, 120) });

  // 4) مطابقة المسار
  let route, m;
  for (const r of routes) { if (r.method === req.method && (m = r.re.exec(c.path))) { route = r; break; } }
  if (!route) {
    if (isProbe(c.path)) { await c.secLog('path_scan', 'medium', {}); await c.penalize(2, 'path_scan', 'medium'); }
    return out(404, { error: 'not_found' });
  }
  c.params = Object.fromEntries(route.keys.map((k, i) => [k, decodeSafe(m[i + 1])]));

  // 5) تحديد المعدل
  // تحديد المعدل يُبطئ فقط (429) ولا يحظر: كثير من مستخدمي شبكات الهاتف في العراق يتشاركون نفس العنوان (CGNAT)
  if (!rate(`g|${c.ip}`, 600)) {
    if (once(`rl|${c.ip}`, 10000)) await c.secLog('rate_limit', 'medium', { bucket: 'global' });
    return out(429, { error: 'rate_limited' }, { 'retry-after': '60' });
  }
  if (route.rl && !rate(`${route.rl[0]}|${c.ip}`, route.rl[1], route.rl[2] || 60000)) {
    if (once(`rl|${route.rl[0]}|${c.ip}`, 10000)) await c.secLog('rate_limit', 'low', { bucket: route.rl[0] });
    return out(429, { error: 'rate_limited' }, { 'retry-after': String(Math.ceil((route.rl[2] || 60000) / 1000)) });
  }

  // 6) المصادقة
  if (route.auth !== 'none' && token) {
    const claims = await verifyJWT(token);
    if (claims) c.uid = claims.sub;
    else if (route.auth !== 'optional') {
      await c.secLog('auth_fail', 'medium', {});
      await c.penalize(0.5, 'auth_fail', 'medium');
      return out(401, { error: 'invalid_token' });
    }
  }
  if (['user', 'admin', 'owner'].includes(route.auth) && !c.uid) return out(401, { error: 'auth_required' });
  c.db = dbFor(c.uid);
  if (c.uid) {
    try { c.profile = await c.db.one('select * from ensure_profile()'); if (['admin', 'owner'].includes(c.profile?.role)) await adminDevice(c); } catch (e) {
      if (route.auth === 'optional' && /registration_closed/.test(e.message)) { c.uid = null; c.db = dbFor(null); }
      else if (/registration_closed/.test(e.message)) return out(403, { error: 'registration_closed' });
      else throw e;
    }
    if (c.profile?.banned) {
      if (route.auth === 'optional') { c.uid = null; c.profile = null; c.db = dbFor(null); }
      else return out(403, { error: 'banned', reason: c.profile.ban_reason });
    }
  }
  const role = c.profile?.role;
  if ((route.auth === 'admin' && !['admin', 'owner'].includes(role)) || (route.auth === 'owner' && role !== 'owner')) {
    await c.secLog('forbidden_admin', 'high', { role });
    await c.penalize(3, 'forbidden_admin');
    return out(403, { error: 'forbidden' });
  }
  c.visitor = sha(`${c.ip}|${c.ua}|${new Date().toISOString().slice(0, 10)}|${SALT}`).slice(0, 32);
  c.isBot = BOT_UA.test(c.ua);

  // 7) جسم الطلب (JSON فقط، 64KB كحد أقصى)
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const len = Number(req.headers.get('content-length') || 0);
    if (len > 65536) return out(413, { error: 'payload_too_large' });
    const text = await req.text();
    if (text.length > 65536) return out(413, { error: 'payload_too_large' });
    if (text) {
      if (!/application\/json/i.test(req.headers.get('content-type') || '')) return out(415, { error: 'json_required' });
      try { c.body = JSON.parse(text); } catch { return out(400, { error: 'invalid_json' }); }
      if (route.auth !== 'admin' && route.auth !== 'owner') {
        const found = inspect(text);
        if (found) await c.secLog('suspicious_body', 'medium', { kind: found.kind });
      }
    } else c.body = {};
  }

  // 8) التنفيذ
  const data = await route.handler(c);
  return out(200, data ?? { ok: true }, c.cache && !c.uid ? { 'cache-control': c.cache } : {});
}

export default {
  async fetch(req) {
    try {
      return await handle(req);
    } catch (e) {
      const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SEC };
      const origin = req.headers.get('origin');
      if (origin && (ORIGINS.has(origin) || (E.ALLOW_LOCALHOST === '1' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)))) Object.assign(headers, { 'access-control-allow-origin': origin, vary: 'Origin' });
      if (e instanceof HttpError) return new Response(JSON.stringify({ error: e.code, ...(e.extra || {}) }), { status: e.status, headers });
      const code = e.message || '';
      let status = DB_ERR[code] || 500, error = DB_ERR[code] ? code : 'server_error';
      if (e.code === '23505') { status = 409; error = 'already_exists'; }
      else if (e.code === '23503') { status = 409; error = 'in_use'; }
      else if (['23514', '22P02', '22001', '22007', '22008', '23502'].includes(e.code)) { status = 400; error = 'invalid_input'; }
      else if (e.code === '42501') {
        status = 403; error = 'forbidden';
        try {
          const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
          await sys('select log_security($1,$2,$3,$4,$5,$6,$7,$8)', [ip, 'db_policy_denied', 'high', req.method, new URL(req.url).pathname, req.headers.get('user-agent') || '', null, { msg: code.slice(0, 120) }]);
        } catch { /* تجاهل */ }
      }
      if (status === 500) console.error('error', e.code || '', code.slice(0, 300));
      return new Response(JSON.stringify({ error }), { status, headers });
    }
  },
};
