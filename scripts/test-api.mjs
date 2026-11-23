// اختبار تكاملي حقيقي للواجهة الخلفية مع Neon Auth + قاعدة البيانات + التخزين
// الاستخدام: node scripts/test-api.mjs   (API_URL اختياري؛ الافتراضي الخادم المحلي)
// FULL_SECURITY=1 يفعّل اختبارات الحظر التلقائي (محلياً فقط لأنها تعتمد على x-test-ip)
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { createSql } from '../api/src/sql.js';

const API = process.env.API_URL || 'http://localhost:8787';
const AUTH = process.env.NEON_AUTH_BASE_URL;
const ORIGIN = 'http://localhost:5173';
const owner = createSql(process.env.DATABASE_URL_OWNER);
const LOCAL = API.startsWith('http://localhost');
let pass = 0, failed = 0;
const ok = (name, cond, info = '') => { cond ? pass++ : failed++; console.log(`${cond ? '✔' : '✘'} ${name}${cond ? '' : '  → ' + info}`); };
const rnd = () => Math.random().toString(36).slice(2, 8);

async function api(path, { method = 'GET', token, body, ip, origin = ORIGIN, headers = {} } = {}) {
  const h = { ...headers };
  if (origin) h.origin = origin;
  if (token) h.authorization = 'Bearer ' + token;
  if (body !== undefined) h['content-type'] = 'application/json';
  if (ip && LOCAL) h['x-test-ip'] = ip;
  const r = await fetch(API + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null;
  try { data = await r.json(); } catch { /* فارغ */ }
  return { status: r.status, data, headers: r.headers };
}

async function authUser(label) {
  const f = `/tmp/qa_${label}.json`;
  let creds = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
  if (!creds) {
    creds = { email: `qa-${label}-${rnd()}@example.com`, password: `Qa!${rnd()}${rnd()}X9` };
    const r = await fetch(`${AUTH}/sign-up/email`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify({ ...creds, name: 'QA ' + label }) });
    if (!r.ok) throw new Error('signup failed ' + r.status);
    writeFileSync(f, JSON.stringify(creds));
  }
  const r = await fetch(`${AUTH}/sign-in/email`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify(creds) });
  const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
  const t = await (await fetch(`${AUTH}/token`, { headers: { cookie, origin: ORIGIN } })).json();
  return { ...creds, token: t.token };
}

async function upload(token, productId, name, buf, extra = {}) {
  const init = await api('/admin/uploads', { method: 'POST', token, body: { product_id: productId, file_name: name, size: buf.length, mime: 'application/octet-stream', ...extra } });
  if (init.status !== 200) return { init };
  const { file_id, part_size, parts } = init.data;
  const order = parts > 1 ? [1, parts, ...Array.from({ length: parts - 2 }, (_, i) => i + 2)] : [1];
  const firstBatch = parts > 2 ? order.slice(0, 2) : order;
  const putParts = async (list) => {
    const s = await api(`/admin/uploads/${file_id}/sign`, { method: 'POST', token, body: { parts: list } });
    for (const n of list) {
      const chunk = buf.subarray((n - 1) * part_size, Math.min(n * part_size, buf.length));
      const r = await fetch(s.data.urls[n], { method: 'PUT', body: chunk, headers: { origin: ORIGIN } });
      if (!r.ok) throw new Error('part ' + n + ' ' + r.status);
    }
  };
  await putParts(firstBatch);
  const mid = await api(`/admin/uploads/${file_id}/parts`, { token });
  const rest = order.filter((n) => !mid.data.parts.some((p) => p.n === n));
  if (rest.length) await putParts(rest);
  const done = await api(`/admin/uploads/${file_id}/complete`, { method: 'POST', token });
  return { init, mid, done, file_id, parts };
}

const PK = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const big = Buffer.concat([PK, Buffer.alloc(17 * 1024 * 1024 + 1234, 7)]);
const pyFile = Buffer.from('print("hello from anon store")\n');
const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(4000, 1)]);
const fakeZip = Buffer.from('this is not a zip archive at all');

console.log('API =', API);
const admin = await authUser('admin');
const user = await authUser('user');
ok('auth: JWT issued by Neon Auth', admin.token?.split('.').length === 3 && user.token?.split('.').length === 3);

// --- عام ---
ok('health', (await api('/health')).status === 200);
const st = await api('/settings');
ok('settings public', st.status === 200 && st.data.site?.name && !st.data.owner_claim);
ok('foreign origin rejected', (await api('/health', { origin: 'https://evil.example' })).status === 403);
ok('no token → /me 401', (await api('/me')).status === 401);
ok('forged token → 401', (await api('/me', { token: admin.token.slice(0, -4) + 'AAAA', ip: '10.9.0.1' })).status === 401);

// --- الملفات الشخصية والأدوار ---
const meA = await api('/me', { token: admin.token });
ok('profile auto-created', meA.status === 200 && ['user', 'admin'].includes(meA.data.profile.role));
await owner.query(`update profiles set role = 'admin' where id = $1`, [meA.data.profile.id]);
const meU = await api('/me', { token: user.token });
ok('user profile', meU.status === 200);
ok('user → admin endpoint 403', (await api('/admin/stats', { token: user.token, ip: '10.9.0.2' })).status === 403);
ok('admin → stats 200', (await api('/admin/stats', { token: admin.token })).status === 200);
ok('admin cannot change roles (owner only)', (await api(`/admin/users/${meU.data.profile.id}/role`, { method: 'POST', token: admin.token, body: { role: 'admin' } })).status === 403);

// --- المنتجات ---
const s1 = rnd();
const paid = await api('/admin/products', { method: 'POST', token: admin.token, body: { title: 'QA أداة مدفوعة', slug: `qa-paid-${s1}`, kind: 'python', price: 10, discount_percent: 20, status: 'published', summary: 'qa' } });
const free = await api('/admin/products', { method: 'POST', token: admin.token, body: { title: 'QA أداة مجانية', slug: `qa-free-${s1}`, kind: 'apk', price: 0, status: 'published' } });
const course = await api('/admin/products', { method: 'POST', token: admin.token, body: { title: 'QA كورس', slug: `qa-course-${s1}`, kind: 'course', price: 25, status: 'published' } });
ok('admin creates products', paid.status === 200 && free.status === 200 && course.status === 200, JSON.stringify(paid.data));
ok('user cannot create product', (await api('/admin/products', { method: 'POST', token: user.token, ip: '10.9.0.3', body: { title: 'x', slug: 'x-x', kind: 'file' } })).status === 403);
ok('invalid slug rejected', (await api('/admin/products', { method: 'POST', token: admin.token, body: { title: 'bad', slug: 'Bad Slug!', kind: 'file' } })).status === 400);
const list = await api('/products?limit=10');
ok('public list shows published', list.status === 200 && list.data.items.some((p) => p.slug === `qa-paid-${s1}`));
ok('discount computed server-side', list.data.items.find((p) => p.slug === `qa-paid-${s1}`)?.final_price === 8);

// --- الرفع المجزأ + الاستكمال + الفحص ---
const up = await upload(admin.token, paid.data.id, 'tool.zip', big, { version: '2.0.0' });
ok('multipart init (3 parts × 8MB)', up.parts === 3, JSON.stringify(up.init?.data));
ok('resume: server lists uploaded parts after interruption', up.mid?.data?.parts?.length === 2, JSON.stringify(up.mid?.data));
ok('complete + magic-bytes scan passed', up.done?.status === 200 && up.done.data.scan.status === 'passed', JSON.stringify(up.done?.data));
const upFree = await upload(admin.token, free.data.id, 'script.py', pyFile);
ok('small file upload', upFree.done?.status === 200);
const upBad = await upload(admin.token, free.data.id, 'fake.zip', fakeZip);
ok('mismatched file flagged by scanner', upBad.done?.data?.scan?.status === 'flagged', JSON.stringify(upBad.done?.data));
ok('disallowed extension rejected', (await api('/admin/uploads', { method: 'POST', token: admin.token, body: { product_id: free.data.id, file_name: 'x.html', size: 10 } })).status === 400);
ok('quota/size limit enforced', (await api('/admin/uploads', { method: 'POST', token: admin.token, body: { product_id: free.data.id, file_name: 'huge.zip', size: 20 * 1024 ** 3 } })).status === 400);

// --- التحميل ---
const dlFree = await api(`/download/${free.data.id}`, { method: 'POST', body: {} });
ok('anonymous free download → signed URL', dlFree.status === 200 && /X-Amz-Signature/.test(dlFree.data.url), JSON.stringify(dlFree.data));
if (dlFree.data?.url) {
  const r = await fetch(dlFree.data.url);
  ok('signed URL serves original file', r.status === 200 && (await r.text()) === pyFile.toString());
}
ok('paid download anon → 401', (await api(`/download/${paid.data.id}`, { method: 'POST', body: {} })).status === 401);
ok('paid download user → 402', (await api(`/download/${paid.data.id}`, { method: 'POST', token: user.token, body: {} })).status === 402);
const order = await api('/orders', { method: 'POST', token: user.token, body: { product_id: paid.data.id } });
ok('order created with server price', order.status === 200 && order.data.order.amount === 8 && order.data.order.status === 'pending', JSON.stringify(order.data));
ok('still locked while pending', (await api(`/download/${paid.data.id}`, { method: 'POST', token: user.token, body: {} })).status === 402);
ok('user cannot confirm own order', (await api(`/admin/orders/${order.data.order.id}/status`, { method: 'POST', token: user.token, ip: '10.9.0.4', body: { status: 'paid' } })).status === 403);
ok('admin confirms payment', (await api(`/admin/orders/${order.data.order.id}/status`, { method: 'POST', token: admin.token, body: { status: 'paid' } })).status === 200);
const dlPaid = await api(`/download/${paid.data.id}`, { method: 'POST', token: user.token, body: {} });
ok('paid download after purchase', dlPaid.status === 200 && dlPaid.data.size === big.length);
if (dlPaid.data?.url) {
  const r = await fetch(dlPaid.data.url, { headers: { range: 'bytes=0-3' } });
  const b = Buffer.from(await r.arrayBuffer());
  ok('range request on large file (206)', r.status === 206 && b.equals(PK));
}
const tc = await api('/checkout/test', { method: 'POST', token: admin.token, body: { product_id: course.data.id } });
ok('admin test checkout (sandbox)', tc.status === 200);
ok('user cannot use test checkout', (await api('/checkout/test', { method: 'POST', token: user.token, ip: '10.9.0.5', body: { product_id: course.data.id } })).status === 403);

// --- الكورسات ---
const l1 = await api(`/admin/products/${course.data.id}/lessons`, { method: 'POST', token: admin.token, body: { title: 'مقدمة', is_preview: true } });
const l2 = await api(`/admin/products/${course.data.id}/lessons`, { method: 'POST', token: admin.token, body: { title: 'الدرس المدفوع' } });
await upload(admin.token, course.data.id, 'intro.mp4', mp4, { lesson_id: l1.data.id });
await upload(admin.token, course.data.id, 'paid.mp4', mp4, { lesson_id: l2.data.id });
const m1 = await api(`/lessons/${l1.data.id}/media`);
ok('preview lesson streams anonymously', m1.status === 200 && m1.data.mime === 'video/mp4');
ok('paid lesson anon → 401', (await api(`/lessons/${l2.data.id}/media`)).status === 401);
ok('paid lesson user without purchase → 402', (await api(`/lessons/${l2.data.id}/media`, { token: user.token })).status === 402);
ok('admin (test purchase) streams paid lesson', (await api(`/lessons/${l2.data.id}/media`, { token: admin.token })).status === 200);
ok('progress saved', (await api(`/lessons/${l1.data.id}/progress`, { method: 'POST', token: user.token, body: { position_s: 42 } })).status === 200);
const prog = await api(`/products/${course.data.id}/progress`, { token: user.token });
ok('progress restored', prog.data?.items?.[0]?.position_s === 42);

// --- التقييمات والمفضلة والإشعارات والرسائل ---
ok('review allowed after purchase', (await api(`/reviews/${paid.data.id}`, { method: 'POST', token: user.token, body: { rating: 5, body: 'ممتاز' } })).status === 200);
const det = await api(`/products/qa-paid-${s1}`, { token: user.token });
ok('rating aggregated + me.access', det.data?.product?.rating_count === 1 && det.data.me.access === true, JSON.stringify(det.data?.me));
ok('review blocked without access', (await api(`/reviews/${course.data.id}`, { method: 'POST', token: user.token, body: { rating: 1 } })).status === 403);
ok('favorite toggle', (await api(`/favorites/${free.data.id}`, { method: 'POST', token: user.token })).data?.favorite === true);
const lib = await api('/me/library', { token: user.token });
ok('library: purchases/downloads/favorites', lib.data?.purchases?.length >= 1 && lib.data.downloads.length >= 1 && lib.data.favorites.length >= 1);
ok('broadcast notification', (await api('/admin/notifications', { method: 'POST', token: admin.token, body: { title: 'QA إشعار', body: 'test' } })).status === 200);
ok('user sees unread notifications', (await api('/me', { token: user.token })).data?.unread >= 2);
ok('contact form', (await api('/messages', { method: 'POST', body: { name: 'QA', subject: 'سؤال', body: 'رسالة تجريبية', t: 4000 } })).status === 200);
ok('admin inbox', (await api('/admin/messages', { token: admin.token })).data?.items?.some((m) => m.subject === 'سؤال'));

// --- الإعدادات ---
ok('invalid color rejected', (await api('/admin/settings/site', { method: 'PUT', token: admin.token, body: { value: { ...st.data.site, colors: { primary: 'red', accent: '#000000', bg: '#000000' } } } })).status === 400);
ok('unavailable gateway cannot be enabled', (await api('/admin/settings/payments', { method: 'PUT', token: admin.token, body: { value: { manual: { enabled: true }, gateways: { zaincash: { enabled: true } } } } })).status === 400);
const closed = await api('/admin/settings/site', { method: 'PUT', token: admin.token, body: { value: { ...st.data.site, registration_enabled: false } } });
const newbie = await authUser('newbie');
ok('registration toggle blocks new accounts', closed.status === 200 && (await api('/me', { token: newbie.token })).data?.error === 'registration_closed');
await api('/admin/settings/site', { method: 'PUT', token: admin.token, body: { value: { ...st.data.site, registration_enabled: true } } });

// --- الحظر وصلاحيات قاعدة البيانات ---
ok('ban user', (await api(`/admin/users/${meU.data.profile.id}/ban`, { method: 'POST', token: admin.token, body: { reason: 'qa' } })).status === 200);
ok('banned user locked out', (await api('/me', { token: user.token })).data?.error === 'banned');
ok('admin cannot ban self', (await api(`/admin/users/${meA.data.profile.id}/ban`, { method: 'POST', token: admin.token, body: {} })).status === 403);
ok('unban user', (await api(`/admin/users/${meU.data.profile.id}/ban`, { method: 'POST', token: admin.token, body: { banned: false } })).status === 200);
// نفس مسار الإنتاج: اتصال المالك + set local role store_api (أو اتصال store_api المباشر إن وُجد)
const rls = process.env.STORE_DB_URL ? createSql(process.env.STORE_DB_URL) : null;
const asApi = (q) => (rls ? rls.batch(q) : owner.batch([['set local role store_api'], ...q]));
const leak = (await asApi([["select set_config('app.uid', $1, true)", [meU.data.profile.id]], ['select count(*)::int as n from purchases where user_id <> app_uid()']])).at(-1);
ok('RLS: user cannot read others purchases (DB level)', leak[0].n === 0);
let denied = false;
try { await asApi([["select set_config('app.uid', $1, true)", [meU.data.profile.id]], [`update profiles set role = 'admin' where id = app_uid()`]]); } catch { denied = true; }
ok('DB trigger blocks self-promotion to admin', denied);

// --- الأمان ---
ok('SQLi in query blocked', (await api("/products?kind=python' OR '1'='1", { ip: '10.0.0.11' })).status === 400);
ok('XSS in path blocked', (await api('/products/%3Cscript%3Ealert(1)%3C%2Fscript%3E', { ip: '10.0.0.12' })).status === 400);
ok('traversal blocked', (await api('/products/..%2F..%2Fetc%2Fpasswd', { ip: '10.0.0.13' })).status === 400);
ok('scanner path logged (404)', (await api('/wp-admin/setup.php', { ip: '10.0.0.14' })).status === 404);
ok('attack tool UA blocked', (await api('/health', { ip: '10.0.0.15', headers: { 'user-agent': 'sqlmap/1.8' } })).status === 403);
ok('owner claim with bad token rejected', (await api('/admin/claim', { method: 'POST', token: user.token, ip: '10.0.0.16', body: { token: 'x'.repeat(32) } })).status === 403);
if (LOCAL) {
  let got429 = false;
  for (let i = 0; i < 70 && !got429; i++) got429 = (await api('/track', { method: 'POST', ip: '10.0.0.20', body: { path: '/' } })).status === 429;
  ok('rate limiting returns 429', got429);
  for (let i = 0; i < 3; i++) await api(`/products?q=1&kind=x' union select password from users--${i}`, { ip: '10.0.0.21' });
  ok('repeated attacks → automatic IP block', (await api('/health', { ip: '10.0.0.21' })).data?.error === 'blocked');
  ok('normal visitor unaffected', (await api('/health', { ip: '10.0.0.22' })).status === 200);
  const sec = await api('/admin/security', { token: admin.token });
  ok('security dashboard lists events + block', sec.data?.events?.length > 3 && sec.data.blocks.some((b) => b.ip === '10.0.0.21'));
  ok('admin unblocks IP', (await api('/admin/security/block/10.0.0.21', { method: 'DELETE', token: admin.token })).status === 200 && (await api('/health', { ip: '10.0.0.21' })).status === 200);
  const n = await api('/admin/notifications', { token: admin.token });
  ok('admin alerted about high-severity events', n.data?.items?.some((x) => x.kind === 'security'));
}
ok('audit log records admin actions', (await api('/admin/audit', { token: admin.token })).data?.items?.length > 5);

// --- محتوى الموقع والصفحات وأيقونات الهاتف (لوحة المالك) ---
{
  const content = {
    hero: { badge: 'شارة', title: 'عنوان QA', highlight: 'ملون', subtitle: 'وصف', cta1_text: 'ابدأ', cta1_link: '/p/دورة-بايثون', cta2_text: 'تواصل', cta2_link: 'https://t.me/HIKR7', image_url: null, show_terminal: true, terminal: ['$ scan', '[ok] done'] },
    sections: { python: { title: 'أدوات', nav: 'بايثون', desc: 'وصف', image_url: 'https://example.com/a.webp' } },
    features: [{ icon: 'bolt', title: 'سريع', text: 'نص' }, { icon: 'bad-icon', title: 'x', text: '' }],
    banners: [{ image_url: null, title: 'عرض', text: 'نص', button: 'اشترِ', link: '/paid' }],
    show: { banners: true, features: false }, contact: { title: 'تواصل', text: 'نص' }, footer: { text: 'حقوق', about: 'نبذة' },
  };
  const put = await api('/admin/settings/content', { method: 'PUT', token: admin.token, body: { value: content } });
  const v = put.data?.value;
  ok('content: owner saves site content (Arabic internal link ok)', put.status === 200 && v.hero.cta1_link === '/p/دورة-بايثون' && v.sections.apk && v.features[1].icon === 'shield' && v.show.features === false, JSON.stringify(put.data).slice(0, 200));
  const pub = await api('/settings');
  ok('content: visible to visitors via /settings', pub.data?.content?.hero?.title === 'عنوان QA' && pub.data?.content?.banners?.length === 1, JSON.stringify(pub.data).slice(0, 160));
  for (const [name, bad] of [['javascript link', { banners: [{ title: 't', link: 'javascript:alert(1)' }] }], ['protocol-relative link', { hero: { cta1_link: '//evil.com' } }], ['backslash link', { hero: { cta1_link: '/\\evil.com' } }], ['http image', { hero: { image_url: 'http://evil.com/x.png' } }], ['too many banners', { banners: Array(7).fill({ title: 't' }) }]]) {
    const r = await api('/admin/settings/content', { method: 'PUT', token: admin.token, body: { value: { ...content, ...bad } } });
    ok(`content: rejects ${name}`, r.status === 400, r.status);
  }
  ok('content: normal user cannot change content', (await api('/admin/settings/content', { method: 'PUT', token: user.token, body: { value: content }, ip: '198.51.100.23' })).status === 403);
  const pages = [{ slug: 'about', title: 'من نحن', body: '## مرحباً\n- نقطة', in_nav: true, in_footer: true }, { slug: 'tg', title: 'قناتنا', url: 'https://t.me/HIKR7', in_footer: true }];
  const pp = await api('/admin/settings/pages', { method: 'PUT', token: admin.token, body: { value: pages } });
  ok('pages: owner creates pages and links', pp.status === 200 && pp.data.value.length === 2 && pp.data.value[1].url === 'https://t.me/HIKR7' && pp.data.value[0].in_nav === true, JSON.stringify(pp.data).slice(0, 160));
  ok('pages: public via /settings', (await api('/settings')).data?.pages?.[0]?.slug === 'about');
  for (const [name, bad] of [['invalid slug', [{ slug: 'من', title: 'صفحة' }]], ['duplicate slug', [{ slug: 'a1', title: 'صفحة' }, { slug: 'a1', title: 'صفحة' }]]]) {
    ok(`pages: rejects ${name}`, (await api('/admin/settings/pages', { method: 'PUT', token: admin.token, body: { value: bad } })).status === 400);
  }
  const icon = await api('/admin/media', { method: 'POST', token: admin.token, body: { mime: 'image/png', size: 2048, purpose: 'app_icon' } });
  ok('media: phone icon signs fixed brand key', icon.status === 200 && /\/media\/brand\/app-icon\?v=\d+$/.test(icon.data.public_url) && icon.data.upload_url.includes('brand/app-icon'), JSON.stringify(icon.data).slice(0, 160));
  ok('media: brand icon rejects gif', (await api('/admin/media', { method: 'POST', token: admin.token, body: { mime: 'image/gif', size: 2048, purpose: 'app_icon' } })).status === 400);
  const share = await api('/admin/media', { method: 'POST', token: admin.token, body: { mime: 'image/jpeg', size: 4096, purpose: 'share' } });
  ok('media: share image signs brand/share', share.status === 200 && share.data.public_url.includes('/brand/share'));
  const webp = await api('/admin/media', { method: 'POST', token: admin.token, body: { mime: 'image/webp', size: 4096 } });
  ok('media: generic webp image allowed', webp.status === 200 && !webp.data.public_url.includes('/brand/'), webp.status);
  ok('media: normal user cannot upload images', (await api('/admin/media', { method: 'POST', token: user.token, body: { mime: 'image/png', size: 10 }, ip: '198.51.100.23' })).status === 403);
  const st = await api('/admin/stats', { token: admin.token });
  ok('stats: visitor totals present', ['visitors_30d', 'visits_total', 'pageviews_total'].every((k) => typeof st.data?.[k] === 'number'), JSON.stringify(st.data).slice(0, 200));
  // --- وسائط متحركة/فيديو، خلفيات، شاشة الدخول، أنواع ملفات جديدة ---
  const vid = await api('/admin/media', { method: 'POST', token: admin.token, body: { mime: 'video/mp4', size: 30 * 1024 * 1024 } });
  ok('media: background/intro video (30MB mp4) allowed', vid.status === 200 && vid.data.public_url.includes('/vid/'), JSON.stringify(vid.data).slice(0, 120));
  ok('media: video over 40MB rejected', (await api('/admin/media', { method: 'POST', token: admin.token, body: { mime: 'video/mp4', size: 41 * 1024 * 1024 } })).status === 400);
  ok('media: unknown video type rejected', (await api('/admin/media', { method: 'POST', token: admin.token, body: { mime: 'video/x-msvideo', size: 1000 } })).status === 400);
  ok('media: animated GIF up to 15MB allowed', (await api('/admin/media', { method: 'POST', token: admin.token, body: { mime: 'image/gif', size: 12 * 1024 * 1024 } })).status === 200);
  const site0 = (await api('/settings')).data.site;
  const own = vid.data.public_url;
  const putSite = (x) => api('/admin/settings/site', { method: 'PUT', token: admin.token, body: { value: { ...site0, ...x } } });
  ok('site: matrix animated background accepted', (await putSite({ background: 'matrix' })).data?.value?.background === 'matrix');
  ok('site: external background video rejected (CSP-safe)', (await putSite({ background: 'video', background_video_url: 'https://evil.example/v.mp4' })).status === 400);
  const vs = await putSite({ background: 'video', background_video_url: own });
  ok('site: own-storage background video accepted', vs.status === 200 && vs.data.value.background_video_url === own, JSON.stringify(vs.data).slice(0, 160));
  await putSite({});
  const intro = (x) => api('/admin/settings/content', { method: 'PUT', token: admin.token, body: { value: { ...content, intro: { enabled: true, text: 'أهلاً', duration: 3, ...x } } } });
  ok('intro: animated GIF intro accepted', (await intro({ media_type: 'image', media_url: 'https://example.com/a.gif' })).data?.value?.intro?.enabled === true);
  ok('intro: external intro video rejected', (await intro({ media_type: 'video', media_url: 'https://evil.example/v.mp4' })).status === 400);
  ok('intro: own-storage intro video accepted', (await intro({ media_type: 'video', media_url: own })).data?.value?.intro?.media_type === 'video');
  ok('intro: duration out of range rejected', (await intro({ duration: 30 })).status === 400);
  const xz = Buffer.concat([Buffer.from([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]), Buffer.alloc(4000, 1)]);
  const upXz = await upload(admin.token, free.data.id, 'system.tar.xz', xz);
  ok('upload: complete system archive (.tar.xz) accepted + scanned', upXz.done?.status === 200 && upXz.done?.data?.scan?.status !== 'flagged', JSON.stringify(upXz.done?.data || upXz.init?.data).slice(0, 160));
  const ipa = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(3000, 2)]);
  ok('upload: iOS .ipa accepted', (await upload(admin.token, free.data.id, 'app.ipa', ipa)).done?.status === 200);
  const dl = await api(`/download/${free.data.id}`, { method: 'POST', body: {} });
  ok('download link valid ≥15 min (longer for big files)', dl.status === 200 && dl.data.expires_in >= 900, JSON.stringify(dl.data).slice(0, 120));
  // --- تشفير البيانات الخاصة + تنبيه جهاز جديد + ثيمات وحركات وأيقونات ---
  const secret = 'رسالة سرية للتشفير 987';
  ok('contact message accepted', (await api('/messages', { method: 'POST', token: user.token, body: { name: 'QA', email: 'qa-secret@example.com', subject: 'تشفير', body: secret, t: 4000 }, ip: '198.51.100.41' })).status === 200);
  const [row] = await owner.query(`select id, body, email from messages order by id desc limit 1`);
  ok('message stored encrypted at rest (AES-256-GCM)', row?.body?.startsWith('enc1:') && row?.email?.startsWith('enc1:') && !row.body.includes('سرية'), JSON.stringify(row).slice(0, 120));
  const am = (await api('/admin/messages', { token: admin.token })).data?.items?.find((m) => String(m.id) === String(row?.id));
  ok('admin reads decrypted message', am?.body === secret && am?.email === 'qa-secret@example.com', JSON.stringify(am).slice(0, 120));
  const rp = await api(`/admin/messages/${row?.id}/reply`, { method: 'POST', token: admin.token, body: { reply: 'رد سري 555' } });
  const [rr] = await owner.query(`select reply from messages where id = $1`, [row?.id]);
  const un = (await api('/me/notifications', { token: user.token })).data?.items?.find((n) => n.body === 'رد سري 555');
  ok('reply encrypted in DB, readable by the user', rp.status === 200 && rr?.reply?.startsWith('enc1:') && !!un, `${rp.status} ${String(rr?.reply).slice(0, 20)} ${!!un}`);
  let keyHidden = false;
  try { await owner.batch([['set local role store_api'], ['select value from ops.secrets']]); } catch { keyHidden = true; }
  ok('store_api role cannot read the encryption key', keyHidden);
  await api('/me', { token: admin.token, headers: { 'user-agent': 'Mozilla/5.0 (QA-Tablet; Linux) Firefox/120.0' } });
  const [dev] = await owner.query(`select count(*)::int as n from security_events where kind = 'admin_new_device'`);
  ok('owner alerted on admin login from a new device', dev?.n > 0, JSON.stringify(dev));
  const th = await putSite({ colors: { ...site0.colors, text: '#f7e9eb', panel: '#1a0b0e' }, anim: { page: 'zoom', reveal: 'flip' } });
  ok('site: text/card colors + page/reveal animations saved', th.data?.value?.colors?.panel === '#1a0b0e' && th.data.value.anim.page === 'zoom' && th.data.value.anim.reveal === 'flip', JSON.stringify(th.data).slice(0, 160));
  ok('site: invalid color rejected', (await putSite({ colors: { ...site0.colors, text: 'red;}' } })).status === 400);
  await putSite({});
  const ci = await api('/admin/settings/content', { method: 'PUT', token: admin.token, body: { value: { ...content, features: [{ icon: 'bolt', title: 'سريع', text: '', anim: 'pulse', image_url: 'https://example.com/i.gif' }], sections: { python: { title: 'أدوات', nav: 'بايثون', desc: '', icon: 'code', anim: 'float' } } } } });
  ok('content: animated feature icons + section icons saved', ci.data?.value?.features?.[0]?.anim === 'pulse' && ci.data.value.sections.python.icon === 'code' && ci.data.value.sections.python.anim === 'float', JSON.stringify(ci.data).slice(0, 160));
  if (LOCAL) {
    ok('honeypot path form → 404', (await api('/trap/wp-admin/setup.php', { ip: '203.0.113.77' })).status === 404);
    const [ev] = await owner.query(`select * from security_events order by created_at desc limit 1`);
    ok('honeypot logs scanned path', JSON.stringify(ev || {}).includes('/wp-admin/setup.php'), JSON.stringify(ev).slice(0, 200));
  }
}

// --- التنظيف عبر واجهة المدير نفسها ---
for (const p of [free.data, course.data]) await api(`/admin/products/${p.id}`, { method: 'DELETE', token: admin.token });
const delPaid = await api(`/admin/products/${paid.data.id}`, { method: 'DELETE', token: admin.token });
ok('product with sales cannot be hard-deleted (hide instead)', delPaid.status === 409);
console.log(`\n${pass} passed, ${failed} failed`);
writeFileSync('/tmp/qa_state.json', JSON.stringify({ paid: paid.data.id, s1 }));
process.exit(failed ? 1 : 0);
