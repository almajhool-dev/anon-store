// فحص سريع للنظام المنشور (لا يستخدم اختبارات الحظر حتى لا يُحظر عنوان المختبِر)
// الاستخدام: API_URL=https://...-api... node scripts/smoke-prod.mjs
import { readFileSync } from 'node:fs';
const API = process.env.API_URL, AUTH = process.env.NEON_AUTH_BASE_URL, O = 'https://majhool-store.netlify.app';
let pass = 0, failed = 0;
const ok = (n, c, i = '') => { c ? pass++ : failed++; console.log(`${c ? '✔' : '✘'} ${n}${c ? '' : '  → ' + String(i).slice(0, 200)}`); };
const call = async (p, { method = 'GET', token, body, origin = O } = {}) => {
  const h = { origin }; if (token) h.authorization = 'Bearer ' + token; if (body) h['content-type'] = 'application/json';
  const r = await fetch(API + p, { method, headers: h, body: body && JSON.stringify(body) });
  return { s: r.status, h: r.headers, d: await r.json().catch(() => null) };
};
async function token(label) {
  const creds = JSON.parse(readFileSync(`/tmp/qa_${label}.json`, 'utf8'));
  const r = await fetch(`${AUTH}/sign-in/email`, { method: 'POST', headers: { 'content-type': 'application/json', origin: O }, body: JSON.stringify(creds) });
  const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
  return (await (await fetch(`${AUTH}/token`, { headers: { cookie, origin: O } })).json()).token;
}
let h;
for (let i = 0; i < 6; i++) { h = await call('/health'); if (h.s === 200) break; await new Promise((r) => setTimeout(r, 4000)); }
ok('health (loader verified + started)', h.s === 200, h.s);
ok('security headers', h.h.get('x-content-type-options') === 'nosniff' && /frame-ancestors/.test(h.h.get('content-security-policy') || '') && h.h.get('strict-transport-security'));
ok('CORS allows site origin', h.h.get('access-control-allow-origin') === O);
ok('CORS rejects foreign origin', (await call('/health', { origin: 'https://evil.example' })).s === 403);
ok('settings', (await call('/settings')).d?.site?.name);
ok('products list', Array.isArray((await call('/products')).d?.items));
const A = await token('admin'), U = await token('user');
ok('admin /me', (await call('/me', { token: A })).d?.profile?.role === 'admin');
ok('user /me', (await call('/me', { token: U })).s === 200);
const diag = await call('/admin/diag', { token: A });
ok('real client IP seen by API', /^\d+\.\d+\.\d+\.\d+$/.test(diag.d?.ip || ''), JSON.stringify(diag.d));
ok('admin stats', (await call('/admin/stats', { token: A })).s === 200);
const t = Date.now().toString(36);
const free = await call('/admin/products', { method: 'POST', token: A, body: { title: 'QA prod free', slug: `qa-prod-${t}`, kind: 'file', price: 0, status: 'published' } });
const i = await call('/admin/uploads', { method: 'POST', token: A, body: { product_id: free.d.id, file_name: 'readme.txt', size: 12 } });
const sg = await call(`/admin/uploads/${i.d.file_id}/sign`, { method: 'POST', token: A, body: { parts: [1] } });
await fetch(sg.d.urls[1], { method: 'PUT', body: 'hello prod!\n' });
const done = await call(`/admin/uploads/${i.d.file_id}/complete`, { method: 'POST', token: A });
ok('upload via deployed API', done.d?.scan?.status === 'passed', JSON.stringify(done.d));
const dl = await call(`/download/${free.d.id}`, { method: 'POST', body: {} });
ok('anonymous download signed URL', dl.s === 200 && (await (await fetch(dl.d.url)).text()) === 'hello prod!\n');
ok('user cannot hit admin', (await call('/admin/stats', { token: U })).s === 403);
ok('SQLi blocked', (await call("/products?kind=x' OR '1'='1")).s === 400);
ok('site trap → synthetic decoy (logged, unsigned = no block)', (await call('/trap/server-status')).s === 200);
const sec = await call('/admin/security', { token: A });
ok('security events recorded', sec.d?.events?.some((e) => e.kind === 'sqli') && sec.d.events.some((e) => e.kind === 'path_scan_site'));
ok('cleanup product', (await call(`/admin/products/${free.d.id}`, { method: 'DELETE', token: A })).s === 200);
console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
