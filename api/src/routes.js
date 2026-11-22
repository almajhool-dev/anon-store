// مسارات الزوار والمستخدمين
import { fail, str, int, uid, inspect, decodeSafe, isProbe, storage } from './lib.js';

export const KINDS = ['python', 'apk', 'course', 'video', 'file'];
export const COLS = `p.id, p.slug, p.kind, p.title, p.summary, p.cover_url, p.price, effective_price(p) as final_price, p.currency,
  p.discount_percent, p.discount_ends_at, p.version, p.downloads, p.views, p.rating_sum, p.rating_count, p.featured, p.tags, p.published_at, p.status`;
const SORTS = {
  latest: 'p.published_at desc nulls last', top: 'p.downloads desc, p.published_at desc', views: 'p.views desc',
  rating: '(p.rating_sum::float / nullif(p.rating_count, 0)) desc nulls last, p.rating_count desc',
  price_asc: 'effective_price(p) asc', price_desc: 'effective_price(p) desc',
};
const like = (s) => (s || '').trim().slice(0, 80).replace(/[%_\\]/g, '\\$&');
const PUBLIC_SETTINGS = ['site', 'social', 'payments', 'faq'];

export default function (add) {
  add('GET', '/health', 'none', () => ({ ok: true, time: new Date().toISOString() }));

  add('GET', '/settings', 'none', async (c) => {
    const rows = await c.db.all('select key, value from settings where key = any($1)', [PUBLIC_SETTINGS]);
    c.cache = 'public, max-age=60';
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  });

  add('GET', '/products', 'optional', async (c) => {
    const q = c.url.searchParams;
    const kind = q.get('kind') || null;
    if (kind && !KINDS.includes(kind)) fail(400, 'invalid_kind');
    const filter = ['free', 'paid', 'featured'].includes(q.get('filter')) ? q.get('filter') : null;
    const sort = SORTS[q.get('sort')] || SORTS.latest;
    const limit = int(q.get('limit') || 24, 1, 48, 'limit'), offset = int(q.get('offset') || 0, 0, 100000, 'offset');
    const rows = await c.db.all(`select ${COLS}, count(*) over()::int as total from products p where p.status = 'published'
      and ($1::text is null or p.kind = $1)
      and ($2::text is null or ($2 = 'free' and p.price = 0) or ($2 = 'paid' and p.price > 0) or ($2 = 'featured' and p.featured))
      and ($3 = '' or p.title ilike '%' || $3 || '%' or p.summary ilike '%' || $3 || '%' or $3 = any(p.tags))
      order by ${sort} limit $4 offset $5`, [kind, filter, like(q.get('q')), limit, offset]);
    c.cache = 'public, max-age=30';
    return { items: rows.map(({ total, ...r }) => r), total: rows[0]?.total || 0 };
  }, { rl: ['list', 150] });

  add('GET', '/products/:slug', 'optional', async (c) => {
    if (!/^[a-z0-9][a-z0-9-]{1,80}$/.test(c.params.slug)) fail(404, 'not_found');
    const p = await c.db.one(`select ${COLS}, p.description, p.gallery from products p where p.slug = $1`, [c.params.slug]);
    if (!p) fail(404, 'not_found');
    const [files, lessons, reviews, me] = await c.db.tx([
      [`select id, version, file_name, size_bytes, mime, notes, is_current, created_at from files
        where product_id = $1 and status = 'ready' and purpose = 'product' and scan_status <> 'flagged' order by created_at desc limit 20`, [p.id]],
      [`select id, position, title, description, duration_s, is_preview, video_file_id is not null as has_video from lessons
        where product_id = $1 order by position, created_at`, [p.id]],
      ['select * from public_reviews($1, 30)', [p.id]],
      [`select has_access($1) as access, can_review($1) as can_review,
        exists(select 1 from favorites where product_id = $1 and user_id = app_uid()) as favorite,
        (select json_build_object('id', id, 'status', status, 'reference', reference) from purchases
          where product_id = $1 and user_id = app_uid() and status in ('pending','paid','test') limit 1) as purchase`, [p.id]],
      ['select record_view($1, $2)', [p.id, c.visitor]],
    ]);
    return { product: p, files, lessons, reviews, me: { ...me[0], signed_in: !!c.uid } };
  }, { rl: ['detail', 120] });

  add('POST', '/track', 'none', async (c) => {
    const path = typeof c.body?.path === 'string' ? c.body.path.slice(0, 300) : '/';
    const d = decodeSafe(path);
    if (isProbe(d)) await c.secLog('client_probe', 'low', { path });
    else if (inspect(d)) await c.secLog('client_suspicious_path', 'medium', { path });
    if (!c.isBot) await c.db.one('select track_visit($1)', [c.visitor]);
    return { ok: true };
  }, { rl: ['track', 60] });

  // مصيدة مسارات الفحص الممررة من Netlify (wp-admin, .env ...): تسجيل فقط دون حظر لأن العنوان الحقيقي غير مضمون
  add('GET', '/trap', 'none', async (c) => {
    await c.secLog('path_scan_site', 'medium', { path: (c.url.searchParams.get('p') || '').slice(0, 300), via: c.req.headers.get('x-nf-request-id') ? 'netlify' : 'direct' });
    fail(404, 'not_found');
  }, { rl: ['trap', 30] });

  add('POST', '/messages', 'optional', async (c) => {
    const b = c.body || {};
    if (b.website || typeof b.t !== 'number' || b.t < 2500) { await c.secLog('bot_form', 'low', {}); return { ok: true }; }
    const name = str(b.name, 100, { min: 1, name: 'name' });
    const email = b.email ? str(b.email, 200, { name: 'email' }) : null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'invalid_email');
    const subject = str(b.subject, 200, { min: 2, name: 'subject' });
    const body = str(b.body, 5000, { min: 5, name: 'body' });
    await c.db.one('insert into messages(user_id, name, email, subject, body, ip) values ($1, $2, $3, $4, $5, $6)', [c.uid, name, email, subject, body, c.ip]);
    return { ok: true };
  }, { rl: ['msg', 5, 600000] });

  // ---------- المستخدم ----------
  add('GET', '/me', 'user', async (c) => {
    const n = await c.db.one(`select count(*)::int as unread from notifications n
      where not exists (select 1 from notification_reads r where r.notification_id = n.id and r.user_id = app_uid())`);
    const { id, email, name, avatar, role, created_at } = c.profile;
    return { profile: { id, email, name, avatar, role, created_at }, unread: n.unread };
  });

  add('PATCH', '/me', 'user', async (c) => {
    await c.db.one('update profiles set name = $1 where id = app_uid()', [str(c.body?.name, 60, { min: 2, name: 'name' })]);
    return { ok: true };
  }, { rl: ['me', 20] });

  add('GET', '/me/library', 'user', async (c) => {
    const [purchases, downloads, favorites] = await c.db.tx([
      [`select b.id, b.status, b.reference, b.amount, b.currency, b.created_at, b.paid_at, p.slug, p.title, p.kind, p.cover_url
        from purchases b left join products p on p.id = b.product_id where b.user_id = app_uid() order by b.created_at desc limit 100`],
      [`select d.created_at, p.slug, p.title, p.kind, f.file_name, f.version from downloads d
        left join products p on p.id = d.product_id left join files f on f.id = d.file_id where d.user_id = app_uid() order by d.created_at desc limit 100`],
      [`select ${COLS} from favorites v join products p on p.id = v.product_id where v.user_id = app_uid() order by v.created_at desc limit 100`],
    ]);
    return { purchases, downloads, favorites };
  });

  add('GET', '/me/notifications', 'user', async (c) => ({
    items: await c.db.all(`select n.id, n.kind, n.title, n.body, n.created_at,
      exists(select 1 from notification_reads r where r.notification_id = n.id and r.user_id = app_uid()) as read
      from notifications n order by n.created_at desc limit 50`),
  }));

  add('POST', '/me/notifications/read', 'user', async (c) => {
    await c.db.one('insert into notification_reads(user_id, notification_id) select app_uid(), n.id from notifications n on conflict do nothing');
    return { ok: true };
  });

  add('POST', '/favorites/:id', 'user', async (c) => {
    const id = uid(c.params.id);
    const [del] = await c.db.tx([['delete from favorites where user_id = app_uid() and product_id = $1 returning product_id', [id]]]);
    if (del.length) return { favorite: false };
    await c.db.one('insert into favorites(user_id, product_id) values (app_uid(), $1)', [id]);
    return { favorite: true };
  }, { rl: ['fav', 60] });

  add('POST', '/reviews/:id', 'user', async (c) => {
    const id = uid(c.params.id);
    const rating = int(c.body?.rating, 1, 5, 'rating');
    const body = str(c.body?.body ?? '', 1500, { name: 'body' });
    if (!(await c.db.one('select can_review($1) as ok', [id])).ok) fail(403, 'review_not_allowed');
    await c.db.one(`insert into reviews(user_id, product_id, rating, body) values (app_uid(), $1, $2, $3)
      on conflict (user_id, product_id) do update set rating = excluded.rating, body = excluded.body, created_at = now()`, [id, rating, body]);
    return { ok: true };
  }, { rl: ['review', 10] });

  add('DELETE', '/reviews/:id', 'user', async (c) => {
    await c.db.one('delete from reviews where product_id = $1 and user_id = app_uid()', [uid(c.params.id)]);
    return { ok: true };
  });

  add('POST', '/orders', 'user', async (c) => {
    const id = uid(c.body?.product_id, 'product_id');
    if ((await c.getSetting('site'))?.store_enabled === false) fail(403, 'store_disabled');
    let order = await c.db.one(`select id, status, reference, amount, currency from purchases
      where user_id = app_uid() and product_id = $1 and status in ('pending','paid','test')`, [id]);
    if (!order) order = await c.db.one('insert into purchases(user_id, product_id) values (app_uid(), $1) returning id, status, reference, amount, currency', [id]);
    const pay = await c.getSetting('payments');
    return { order, instructions: pay?.manual?.instructions || '', contacts: await c.getSetting('social') };
  }, { rl: ['order', 10] });

  add('POST', '/orders/:id/cancel', 'user', async (c) => {
    const r = await c.db.one(`update purchases set status = 'cancelled' where id = $1 and user_id = app_uid() and status = 'pending' returning id`, [uid(c.params.id)]);
    return r ? { ok: true } : fail(404, 'not_found');
  }, { rl: ['order', 10] });

  add('POST', '/checkout/test', 'admin', async (c) => {
    const id = uid(c.body?.product_id, 'product_id');
    const [, ins] = await c.db.tx([
      [`update purchases set status = 'cancelled', note = 'استبدال بطلب تجريبي' where user_id = app_uid() and product_id = $1 and status = 'pending'`, [id]],
      [`insert into purchases(user_id, product_id, status) select app_uid(), $1, 'test'
        where not exists (select 1 from purchases where user_id = app_uid() and product_id = $1 and status in ('paid','test')) returning id, status, reference`, [id]],
      ["insert into audit_log(actor_id, action, target) values (app_uid(), 'checkout.test', $1)", [id]],
    ]);
    return { ok: true, order: ins[0] || null };
  }, { rl: ['order', 10] });

  add('POST', '/download/:id', 'optional', async (c) => {
    const id = uid(c.params.id);
    const fid = c.body?.file_id ? uid(c.body.file_id, 'file_id') : null;
    const a = await c.db.one('select has_access($1) as ok, (select price from products where id = $1) as price', [id]);
    if (!a.ok) {
      if (a.price == null) fail(404, 'not_found');
      fail(c.uid ? 402 : 401, c.uid ? 'purchase_required' : 'auth_required');
    }
    const f = await c.db.one('select * from record_download($1, $2, $3)', [id, fid, c.visitor]);
    return { url: await storage.signGet(f.object_key, { name: f.file_name, expires: 900 }), file_name: f.file_name, size: f.size_bytes, expires_in: 900 };
  }, { rl: ['dl', 30] });

  add('GET', '/lessons/:id/media', 'optional', async (c) => {
    const m = await c.db.one('select * from lesson_media($1)', [uid(c.params.id)]);
    if (!m) fail(c.uid ? 402 : 401, c.uid ? 'purchase_required' : 'auth_required');
    const type = /x-matroska|mkv/.test(m.mime) ? 'video/webm' : /quicktime/.test(m.mime) ? 'video/mp4' : /^video\//.test(m.mime) ? m.mime : 'video/mp4';
    return { url: await storage.signGet(m.object_key, { name: 'video', inline: true, type, expires: 4 * 3600 }), mime: type, expires_in: 14400 };
  }, { rl: ['media', 60] });

  add('POST', '/lessons/:id/progress', 'user', async (c) => {
    const pos = int(Math.floor(Number(c.body?.position_s) || 0), 0, 172800, 'position');
    await c.db.one(`insert into lesson_progress(user_id, lesson_id, position_s, completed) values (app_uid(), $1, $2, $3)
      on conflict (user_id, lesson_id) do update set position_s = excluded.position_s,
      completed = lesson_progress.completed or excluded.completed, updated_at = now()`, [uid(c.params.id), pos, c.body?.completed === true]);
    return { ok: true };
  }, { rl: ['progress', 60] });

  add('GET', '/products/:id/progress', 'user', async (c) => ({
    items: await c.db.all(`select lp.lesson_id, lp.position_s, lp.completed from lesson_progress lp join lessons l on l.id = lp.lesson_id
      where l.product_id = $1 and lp.user_id = app_uid()`, [uid(c.params.id)]),
  }));

  add('POST', '/admin/claim', 'user', async (c) => {
    const token = str(c.body?.token, 100, { min: 20, name: 'token' });
    try { await c.db.one('select claim_owner($1) as ok', [token]); } catch (e) {
      if (/invalid_claim/.test(e.message)) { await c.secLog('owner_claim_fail', 'high', {}); await c.penalize(3, 'claim_fail'); }
      throw e;
    }
    return { ok: true };
  }, { rl: ['claim', 5, 600000] });
}
