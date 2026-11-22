// أدوات مشتركة: أخطاء، تحقق من المدخلات، JWT، مراقبة أمنية، تخزين S3
import { AwsClient } from 'aws4fetch';
import { createHash } from 'node:crypto';

const E = process.env;

// ---------- أخطاء وتحقق ----------
export class HttpError extends Error {
  constructor(status, code, extra) { super(code); this.status = status; this.code = code; this.extra = extra; }
}
export const fail = (status, code, extra) => { throw new HttpError(status, code, extra); };
export const sha = (s) => createHash('sha256').update(s).digest('hex');
export const isUuid = (s) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export const uid = (s, name = 'id') => (isUuid(s) ? s.toLowerCase() : fail(400, 'invalid_' + name));
export function str(v, max, { min = 0, name = 'field', trim = true } = {}) {
  if (v == null) v = '';
  if (typeof v !== 'string') fail(400, 'invalid_' + name);
  if (trim) v = v.trim();
  if (v.length < min || v.length > max) fail(400, 'invalid_' + name, { min, max });
  return v;
}
export function int(v, min, max, name = 'number') {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) fail(400, 'invalid_' + name);
  return n;
}
export function num(v, min, max, name = 'number') {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) fail(400, 'invalid_' + name);
  return Math.round(n * 100) / 100;
}
export function httpsUrl(v, name = 'url') {
  if (v == null || v === '') return null;
  v = str(v, 1000, { name });
  try { const u = new URL(v); if (u.protocol !== 'https:') throw 0; return u.href; } catch { return fail(400, 'invalid_' + name); }
}
export const decodeSafe = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

// ---------- التحقق من JWT الصادر من Neon Auth (EdDSA عبر JWKS) ----------
const b64 = (s) => Buffer.from(s, 'base64url');
const ISS = E.NEON_AUTH_BASE_URL ? new URL(E.NEON_AUTH_BASE_URL).origin : null;
const ALG = { EdDSA: { name: 'Ed25519' }, ES256: { name: 'ECDSA', hash: 'SHA-256' }, RS256: { name: 'RSASSA-PKCS1-v1_5' } };
let keys = new Map(), keysAt = 0, keysLoading = null;
async function loadKeys() {
  const r = await fetch(E.NEON_AUTH_JWKS_URL, { signal: AbortSignal.timeout(5000) });
  const j = await r.json();
  const m = new Map();
  for (const k of j.keys || []) {
    const imp = k.kty === 'OKP' ? { name: 'Ed25519' } : k.kty === 'EC' ? { name: 'ECDSA', namedCurve: k.crv }
      : k.kty === 'RSA' ? { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } : null;
    if (imp) { try { m.set(k.kid, await crypto.subtle.importKey('jwk', k, imp, false, ['verify'])); } catch { /* مفتاح غير مدعوم */ } }
  }
  keys = m; keysAt = Date.now();
}
export async function verifyJWT(token) {
  const p = token.split('.');
  if (p.length !== 3 || token.length > 4096) return null;
  try {
    const h = JSON.parse(b64(p[0]));
    const alg = ALG[h.alg];
    if (!alg) return null;
    if ((!keys.has(h.kid) && Date.now() - keysAt > 15000) || Date.now() - keysAt > 6 * 3600e3) {
      await (keysLoading ||= loadKeys().finally(() => { keysLoading = null; }));
    }
    const key = keys.get(h.kid);
    if (!key || !(await crypto.subtle.verify(alg, key, b64(p[2]), Buffer.from(p[0] + '.' + p[1])))) return null;
    const c = JSON.parse(b64(p[1]));
    const now = Date.now() / 1000;
    if (typeof c.exp !== 'number' || c.exp < now - 30 || (c.nbf && c.nbf > now + 30)) return null;
    if (ISS && c.iss !== ISS && c.iss !== E.NEON_AUTH_BASE_URL) return null;
    if (ISS && c.aud && ![].concat(c.aud).some((a) => a === ISS || a === E.NEON_AUTH_BASE_URL)) return null;
    return isUuid(c.sub) ? c : null;
  } catch { return null; }
}

// ---------- المراقبة الأمنية ----------
const RULES = [
  ['rce', 'critical', /(\$\{jndi:|\$\{env:|;\s*(cat|ls|id|whoami|uname|wget|curl)\b|\|\s*(sh|bash|nc)\b|`[^`]{1,80}`|\$\([^)]{1,80}\))/i],
  ['sqli', 'high', /(\bunion\b[\s\S]{0,40}\bselect\b|\bselect\b[\s\S]{0,80}\bfrom\b[\s\S]{0,40}\b(information_schema|pg_catalog|pg_shadow|pg_user|mysql\.user|sqlite_master)\b|'\s*(or|and)\s+'?\w*'?\s*=\s*'?\w*|\b(pg_sleep|sleep|benchmark)\s*\(|\bwaitfor\s+delay\b|;\s*(drop|alter|truncate|insert|delete|update|create)\s+\w)/i],
  ['xss', 'high', /(<\s*\/?\s*script\b|javascript\s*:|\bon(error|load|mouseover|focus|click|toggle)\s*=|<\s*(iframe|svg|img|body|object|embed)\b[^>]*\bon\w+\s*=|document\.cookie)/i],
  ['traversal', 'high', /(\.\.[/\\]|%2e%2e|%252e|\/etc\/(passwd|shadow|hosts)|\/proc\/self|c:\\windows)/i],
];
const PROBE = /(\/\.env|\/\.git|\/\.svn|\/\.aws|\/\.ssh|wp-admin|wp-login|wp-content|wp-includes|xmlrpc\.php|phpmyadmin|\/pma\b|\.php\b|\.aspx?\b|\.jsp\b|\/cgi-bin|\/actuator|\/server-status|\/config\.(json|ya?ml|php)|\/\.ds_store|\/admin\.php)/i;
const BAD_UA = /(sqlmap|nikto|nmap|masscan|zgrab|acunetix|nuclei|dirbuster|gobuster|ffuf|wpscan|hydra|netsparker|havij|jaeles|whatweb|nessus|openvas|feroxbuster|arachni|w3af|commix|xsstrike|dirsearch)/i;
export const BOT_UA = /(bot|crawl|spider|slurp|headless|curl|wget|python|go-http|java\/|axios|node-fetch|okhttp|postman|insomnia|scrapy|httpclient)/i;
export const inspect = (text) => { for (const [kind, sev, re] of RULES) if (re.test(text)) return { kind, sev }; return null; };
export const isProbe = (path) => PROBE.test(path);
export const isAttackTool = (ua) => BAD_UA.test(ua || '');

const buckets = new Map(), strikes = new Map(), logged = new Map();
export function rate(key, limit, windowMs = 60000) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset <= now) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); }
  return ++b.n <= limit;
}
export function strike(ip, weight) {
  const now = Date.now();
  let s = strikes.get(ip);
  if (!s || s.reset <= now) { s = { n: 0, reset: now + 600e3 }; strikes.set(ip, s); }
  s.n += weight;
  return s.n;
}
export const clearStrikes = (ip) => strikes.delete(ip);
export function once(key, ms) {
  const now = Date.now();
  if ((logged.get(key) || 0) > now) return false;
  logged.set(key, now + ms);
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const m of [buckets, strikes]) for (const [k, v] of m) if (v.reset <= now) m.delete(k);
  for (const [k, t] of logged) if (t <= now) logged.delete(k);
}, 60000).unref?.();

// ---------- التخزين (S3 متوافق — Neon Object Storage) ----------
const s3 = new AwsClient({
  accessKeyId: E.AWS_ACCESS_KEY_ID || 'missing', secretAccessKey: E.AWS_SECRET_ACCESS_KEY || 'missing',
  service: 's3', region: E.AWS_REGION || 'eu-central-1',
});
const EP = (E.AWS_ENDPOINT_URL_S3 || '').replace(/\/+$/, '');
const ek = (k) => k.split('/').map(encodeURIComponent).join('/');
const ourl = (bucket, key, q = '') => `${EP}/${bucket}/${ek(key)}${q}`;
const xml = (t, tag) => [...t.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => m[1]);
async function call(method, url, body, headers) {
  const r = await s3.fetch(url, { method, body, headers });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new HttpError(502, 'storage_error', { status: r.status, code: xml(t, 'Code')[0] });
  }
  return r;
}
async function presign(url, method, expires, headers) {
  const u = new URL(url);
  u.searchParams.set('X-Amz-Expires', String(expires));
  return (await s3.sign(u.href, { method, headers, aws: { signQuery: true, allHeaders: !!headers } })).url;
}
const asciiName = (n) => n.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');

export const storage = {
  async initMultipart(key, mime) {
    const t = await (await call('POST', ourl('files', key, '?uploads'), undefined, { 'content-type': mime })).text();
    return xml(t, 'UploadId')[0] || fail(502, 'storage_error');
  },
  signPart: (key, uploadId, n) => presign(ourl('files', key, `?partNumber=${n}&uploadId=${encodeURIComponent(uploadId)}`), 'PUT', 3600),
  async listParts(key, uploadId) {
    const out = [];
    let marker = 0;
    for (let i = 0; i < 20; i++) {
      const q = `?uploadId=${encodeURIComponent(uploadId)}&max-parts=1000${marker ? `&part-number-marker=${marker}` : ''}`;
      const t = await (await call('GET', ourl('files', key, q))).text();
      for (const p of xml(t, 'Part')) out.push({ n: +xml(p, 'PartNumber')[0], etag: `"${xml(p, 'ETag')[0].replace(/&quot;|&#34;|"/g, '')}"`, size: +xml(p, 'Size')[0] });
      if (!/<IsTruncated>true<\/IsTruncated>/.test(t)) break;
      marker = +xml(t, 'NextPartNumberMarker')[0];
    }
    return out;
  },
  async complete(key, uploadId, parts) {
    const body = '<CompleteMultipartUpload>' + parts.map((p) => `<Part><PartNumber>${p.n}</PartNumber><ETag>${p.etag.replace(/[<>&]/g, '')}</ETag></Part>`).join('') + '</CompleteMultipartUpload>';
    const t = await (await call('POST', ourl('files', key, `?uploadId=${encodeURIComponent(uploadId)}`), body)).text();
    if (/<Error>/.test(t)) fail(409, 'upload_incomplete', { code: xml(t, 'Code')[0] });
  },
  abort: (key, uploadId) => call('DELETE', ourl('files', key, `?uploadId=${encodeURIComponent(uploadId)}`)).catch(() => null),
  async head(key) {
    const r = await s3.fetch(ourl('files', key), { method: 'HEAD' });
    return r.ok ? { size: Number(r.headers.get('content-length')), type: r.headers.get('content-type') } : null;
  },
  async readStart(key, n = 4096) {
    const r = await call('GET', ourl('files', key), undefined, { range: `bytes=0-${n - 1}` });
    return new Uint8Array(await r.arrayBuffer());
  },
  del: (bucket, key) => call('DELETE', ourl(bucket, key)).catch(() => null),
  signGet(key, { name, inline = false, type, expires = 900 }) {
    const q = new URLSearchParams();
    q.set('response-content-disposition', `${inline ? 'inline' : 'attachment'}; filename="${asciiName(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    if (type) q.set('response-content-type', type);
    return presign(ourl('files', key, '?' + q), 'GET', expires);
  },
  signMediaPut: (key, type, size) => presign(ourl('media', key), 'PUT', 600, { 'content-type': type, 'content-length': String(size) }),
  mediaUrl: (key) => ourl('media', key),
};

// ---------- الرفع: خطة الأجزاء وفحص الملفات ----------
export function planParts(size) {
  let ps = 8 * 1024 * 1024;
  while (Math.ceil(size / ps) > 9000) ps *= 2;
  return { partSize: ps, parts: Math.max(1, Math.ceil(size / ps)) };
}
export const EXT = {
  py: 'text', pyw: 'text', ipynb: 'text', txt: 'text', md: 'text', json: 'text', csv: 'text', sh: 'text',
  zip: 'zip', apk: 'zip', aab: 'zip', xapk: 'zip', apks: 'zip', jar: 'zip', docx: 'zip', xlsx: 'zip', pptx: 'zip',
  rar: 'rar', '7z': '7z', gz: 'gz', tgz: 'gz', tar: 'tar', pdf: 'pdf',
  mp4: 'mp4', m4v: 'mp4', mov: 'mp4', mkv: 'mkv', webm: 'mkv', mp3: 'mp3', wav: 'wav',
  exe: 'mz', msi: 'ole', doc: 'ole', xls: 'ole', ppt: 'ole', deb: 'ar', iso: 'any', img: 'any', bin: 'any',
  whl: 'zip', ipa: 'zip', apkm: 'zip', epub: 'zip', xz: 'xz', txz: 'xz', bz2: 'bz2', tbz2: 'bz2', zst: 'zst', appimage: 'elf', so: 'elf',
  yml: 'text', yaml: 'text', toml: 'text', ini: 'text', cfg: 'text', sql: 'text', bat: 'text', ps1: 'text', log: 'text',
  m4a: 'mp4', ogg: 'ogg', flac: 'flac', dmg: 'any', obb: 'any',
};
const at = (b, s, e) => String.fromCharCode(...b.slice(s, e));
const SIG = {
  zip: (b) => b[0] === 0x50 && b[1] === 0x4b && [3, 5, 7].includes(b[2]),
  rar: (b) => at(b, 0, 4) === 'Rar!',
  '7z': (b) => b[0] === 0x37 && b[1] === 0x7a && b[2] === 0xbc && b[3] === 0xaf,
  gz: (b) => b[0] === 0x1f && b[1] === 0x8b,
  tar: (b) => b.length > 262 && at(b, 257, 262) === 'ustar',
  pdf: (b) => at(b, 0, 4) === '%PDF',
  mp4: (b) => ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip'].includes(at(b, 4, 8)),
  mkv: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3,
  mp3: (b) => at(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
  wav: (b) => at(b, 0, 4) === 'RIFF' && at(b, 8, 12) === 'WAVE',
  mz: (b) => b[0] === 0x4d && b[1] === 0x5a,
  ole: (b) => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0,
  ar: (b) => at(b, 0, 7) === '!<arch>',
  xz: (b) => b[0] === 0xfd && at(b, 1, 5) === '7zXZ',
  bz2: (b) => at(b, 0, 3) === 'BZh',
  zst: (b) => b[0] === 0x28 && b[1] === 0xb5 && b[2] === 0x2f && b[3] === 0xfd,
  elf: (b) => b[0] === 0x7f && at(b, 1, 4) === 'ELF',
  ogg: (b) => at(b, 0, 4) === 'OggS',
  flac: (b) => at(b, 0, 4) === 'fLaC',
  text: (b) => !b.includes(0),
  any: () => true,
};
export function scanFile(ext, bytes) {
  const t = EXT[ext];
  if (!t) return { status: 'flagged', detail: 'نوع ملف غير مسموح' };
  if (!SIG[t](bytes)) return { status: 'flagged', detail: `محتوى الملف لا يطابق امتداده (.${ext})` };
  const detail = t === 'any' ? 'لا توجد بصمة معروفة لهذا النوع — تم القبول' : (t === 'mz' || t === 'ole') ? 'ملف تنفيذي/مكتبي — تأكد من مصدره' : 'البصمة مطابقة للامتداد';
  return { status: 'passed', detail };
}
