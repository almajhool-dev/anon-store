// مسارات لوحة المدير — كل مسار هنا محمي بالخادم (دور admin/owner) وبسياسات RLS في قاعدة البيانات
import { randomUUID } from 'node:crypto';
import { fail, str, int, num, uid, httpsUrl, storage, planParts, EXT, scanFile } from './lib.js';
import { KINDS, COLS } from './routes.js';

const QUOTA = Number(process.env.STORAGE_QUOTA_BYTES || 5 * 1024 ** 3);
const MAX_FILE = Number(process.env.MAX_FILE_BYTES || 10 * 1024 ** 3);
const like = (s) => (s || '').trim().slice(0, 80).replace(/[%_\\]/g, '\\$&');
const audit = (c, action, target, meta = {}) => [
  'insert into audit_log(actor_id, action, target, meta, ip) values (app_uid(), $1, $2, $3, $4)', [action, target == null ? null : String(target), meta, c.ip]];
const bigId = (v) => int(v, 1, Number.MAX_SAFE_INTEGER, 'id');
const hex = (v) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : fail(400, 'invalid_color'));
const bool = (v) => v === true;
const txt = (v, max, name = 'text') => str(v ?? '', max, { name });
// الفيديو يُعرض فقط من تخزيننا (سياسة CSP: media-src)
const ANIMS = ['none', 'coin', 'pulse', 'float', 'spin', 'bounce', 'glow', 'swing'];
const akey = (x, d) => (typeof x === 'string' && /^[a-z0-9-]{2,32}$/.test(x) ? x : d); // اسم حركة من المكتبة
const ownMedia = (v, name) => { const u = httpsUrl(v, name); if (u && !u.startsWith(storage.mediaUrl(''))) fail(400, 'invalid_' + name); return u; };
const link = (v) => {
  if (!v) return null;
  v = str(v, 300, { name: 'link' });
  return /^\/(?![/\\])[\p{L}\p{N}_\-/?=&#.%~+]*$/u.test(v) ? v : httpsUrl(v, 'link');
};
const ICONS = ['shield', 'lock', 'play', 'cart', 'bolt', 'star', 'heart', 'gift', 'gem', 'code', 'terminal', 'phone', 'cap', 'folder', 'download', 'upload', 'chat', 'send', 'mail', 'eye', 'check', 'clock', 'chart', 'key', 'help', 'grid', 'trend', 'user', 'bell', 'music', 'list', 'disk'];
const SECTION_KEYS = ['python', 'apk', 'course', 'video', 'file', 'free', 'paid', 'latest', 'top'];
const list = (v, max, name) => { if (v == null) return []; if (!Array.isArray(v) || v.length > max) fail(400, 'invalid_' + name); return v; };

function productInput(b, partial) {
  const o = {}, has = (k) => b[k] !== undefined;
  if (!partial || has('title')) o.title = str(b.title, 160, { min: 2, name: 'title' });
  if (!partial || has('slug')) {
    o.slug = str(b.slug, 81, { min: 2, name: 'slug' }).toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,80}$/.test(o.slug)) fail(400, 'invalid_slug');
  }
  if (!partial || has('kind')) o.kind = KINDS.includes(b.kind) ? b.kind : fail(400, 'invalid_kind');
  if (has('summary')) o.summary = str(b.summary, 400, { name: 'summary' });
  if (has('description')) o.description = str(b.description, 20000, { name: 'description', trim: false });
  if (has('cover_url')) o.cover_url = httpsUrl(b.cover_url, 'cover_url');
  if (has('gallery')) {
    if (!Array.isArray(b.gallery) || b.gallery.length > 12) fail(400, 'invalid_gallery');
    o.gallery = JSON.stringify(b.gallery.map((u) => httpsUrl(u, 'gallery')).filter(Boolean));
  }
  if (has('price')) o.price = num(b.price, 0, 100000000, 'price');
  if (has('currency')) o.currency = ['USD', 'IQD'].includes(b.currency) ? b.currency : fail(400, 'invalid_currency');
  if (has('discount_percent')) o.discount_percent = int(b.discount_percent, 0, 95, 'discount');
  if (has('discount_ends_at')) {
    if (!b.discount_ends_at) o.discount_ends_at = null;
    else { const d = new Date(b.discount_ends_at); if (isNaN(d)) fail(400, 'invalid_discount_ends_at'); o.discount_ends_at = d.toISOString(); }
  }
  if (has('version')) o.version = str(b.version, 40, { min: 1, name: 'version' });
  if (has('status')) o.status = ['draft', 'published', 'hidden'].includes(b.status) ? b.status : fail(400, 'invalid_status');
  if (has('featured')) o.featured = !!b.featured;
  if (has('tags')) {
    if (!Array.isArray(b.tags) || b.tags.length > 15) fail(400, 'invalid_tags');
    o.tags = b.tags.map((t) => str(t, 30, { min: 1, name: 'tag' }));
  }
  return o;
}

function settingInput(key, v) {
  if (!v || typeof v !== 'object') fail(400, 'invalid_value');
  if (key === 'site') {
    const s = v.sections || {};
    return {
      name: str(v.name, 80, { min: 2, name: 'name' }), name_en: str(v.name_en ?? '', 80, { name: 'name_en' }),
      tagline: str(v.tagline ?? '', 220, { name: 'tagline' }),
      colors: { primary: hex(v.colors?.primary), accent: hex(v.colors?.accent), bg: hex(v.colors?.bg), text: v.colors?.text ? hex(v.colors.text) : '#e8ebf7', panel: v.colors?.panel ? hex(v.colors.panel) : '#0e1222' },
      font: ['Cairo', 'Tajawal', 'system'].includes(v.font) ? v.font : 'Cairo',
      anim: { page: akey(v.anim?.page, 'fade'), reveal: akey(v.anim?.reveal, 'up'), auth: akey(v.anim?.auth, 'morph') },
      background: ['network', 'matrix', 'grid', 'image', 'video', 'plain'].includes(v.background) ? v.background : 'network',
      background_url: httpsUrl(v.background_url, 'background_url'), background_video_url: ownMedia(v.background_video_url, 'background_video_url'), logo_url: httpsUrl(v.logo_url, 'logo_url'),
      favicon_url: httpsUrl(v.favicon_url, 'favicon_url'), announcement: str(v.announcement ?? '', 300, { name: 'announcement' }),
      registration_enabled: v.registration_enabled !== false, store_enabled: v.store_enabled !== false,
      sections: Object.fromEntries(KINDS.map((k) => [k, s[k] !== false])),
      currency: ['USD', 'IQD'].includes(v.currency) ? v.currency : 'USD',
    };
  }
  if (key === 'social') {
    const o = {};
    for (const k of ['tiktok', 'telegram', 'whatsapp', 'instagram', 'youtube']) if (v[k]) o[k] = httpsUrl(v[k], k);
    return o;
  }
  if (key === 'payments') {
    const g = v.gateways || {};
    for (const k of Object.keys(g)) if (g[k]?.enabled) fail(400, 'gateway_not_configured', { gateway: k });
    return {
      manual: { enabled: v.manual?.enabled !== false, instructions: str(v.manual?.instructions ?? '', 2000, { name: 'instructions' }) },
      gateways: { zaincash: { enabled: false, label: 'زين كاش' }, fib: { enabled: false, label: 'First Iraqi Bank' }, qicard: { enabled: false, label: 'Qi Card' } },
    };
  }
  if (key === 'content') {
    const h = v.hero || {}, show = v.show || {};
    return {
      hero: { image_anim: ANIMS.includes(h.image_anim) ? h.image_anim : 'coin', logo_anim: ANIMS.includes(h.logo_anim) ? h.logo_anim : 'coin', badge: txt(h.badge, 60), title: txt(h.title, 120), highlight: txt(h.highlight, 120), subtitle: txt(h.subtitle, 300),
        cta1_text: txt(h.cta1_text, 40), cta1_link: link(h.cta1_link), cta2_text: txt(h.cta2_text, 40), cta2_link: link(h.cta2_link),
        image_url: httpsUrl(h.image_url, 'image_url'), show_terminal: h.show_terminal !== false, terminal: list(h.terminal, 8, 'terminal').map((x) => txt(x, 90)) },
      sections: Object.fromEntries(SECTION_KEYS.map((k) => { const x = v.sections?.[k] || {}; return [k, { title: txt(x.title, 60), nav: txt(x.nav, 30), desc: txt(x.desc, 200), image_url: httpsUrl(x.image_url, 'image_url'), icon: ICONS.includes(x.icon) ? x.icon : null, anim: ANIMS.includes(x.anim) ? x.anim : 'none' }]; })),
      features: list(v.features, 8, 'features').map((x) => ({ icon: ICONS.includes(x?.icon) ? x.icon : 'shield', title: txt(x?.title, 60), text: txt(x?.text, 200), image_url: httpsUrl(x?.image_url, 'image_url'), anim: ANIMS.includes(x?.anim) ? x.anim : 'none' })),
      banners: list(v.banners, 6, 'banners').map((x) => ({ anim: ANIMS.includes(x?.anim) ? x.anim : 'none', image_url: httpsUrl(x?.image_url, 'image_url'), title: txt(x?.title, 120), text: txt(x?.text, 300), button: txt(x?.button, 40), link: link(x?.link) })),
      show: Object.fromEntries(['banners', 'sections', 'latest', 'top', 'features', 'contact'].map((k) => [k, show[k] !== false])),
      covers_anim: ANIMS.includes(v.covers_anim) ? v.covers_anim : 'none',
      contact: { title: txt(v.contact?.title, 80), text: txt(v.contact?.text, 300) },
      footer: { text: txt(v.footer?.text, 200), about: txt(v.footer?.about, 400) },
      intro: { enabled: v.intro?.enabled === true, media_type: v.intro?.media_type === 'video' ? 'video' : 'image',
        media_url: v.intro?.media_type === 'video' ? ownMedia(v.intro?.media_url, 'intro_media') : httpsUrl(v.intro?.media_url, 'intro_media'),
        text: txt(v.intro?.text, 80), duration: int(v.intro?.duration ?? 3, 1, 8, 'duration'), every_visit: v.intro?.every_visit === true },
      version: Date.now(),
    };
  }
  if (key === 'pages') {
    const seen = new Set();
    return list(v, 30, 'pages').map((x) => {
      const slug = str(x?.slug, 40, { min: 2, name: 'slug' }).toLowerCase();
      if (!/^[a-z0-9-]{2,40}$/.test(slug) || seen.has(slug)) fail(400, 'invalid_slug');
      seen.add(slug);
      return { slug, title: str(x?.title, 80, { min: 2, name: 'title' }), body: str(x?.body ?? '', 20000, { name: 'body', trim: false }), url: link(x?.url), in_nav: bool(x?.in_nav), in_footer: x?.in_footer !== false };
    });
  }
  if (key === 'faq') {
    if (!Array.isArray(v) || v.length > 40) fail(400, 'invalid_faq');
    return v.map((x) => ({ q: str(x?.q, 300, { min: 2, name: 'question' }), a: str(x?.a, 3000, { min: 2, name: 'answer' }) }));
  }
  return fail(400, 'invalid_key');
}

async function uploading(c) {
  const f = await c.db.one(`select id, product_id, lesson_id, purpose, object_key, file_name, size_bytes, version, upload_id, part_size
    from files where id = $1 and status = 'uploading'`, [uid(c.params.id)]);
  return f || fail(404, 'upload_not_found');
}

export default function (add) {
  // ---------- الإحصاءات ----------
  add('GET', '/admin/stats', 'admin', async (c) => {
    const [[s], top, series] = await c.db.tx([
      [`select (select count(*) from profiles)::int as users,
        (select count(*) from profiles where created_at > now() - interval '7 days')::int as users_7d,
        (select count(*) from visits where day = current_date)::int as visitors_today,
        (select count(distinct visitor) from visits where day > current_date - 7)::int as visitors_7d,
        (select count(*) from visits where last_seen > now() - interval '5 minutes')::int as active_now,
        (select coalesce(sum(hits), 0) from visits where day = current_date)::int as pageviews_today,
        (select count(*) from downloads)::int as downloads_total,
        (select count(*) from downloads where created_at >= current_date)::int as downloads_today,
        (select count(*) from purchases where status = 'paid')::int as sales,
        (select coalesce(json_agg(json_build_object('currency', currency, 'total', t)), '[]') from
          (select currency, sum(amount) t from purchases where status = 'paid' group by currency) x) as revenue,
        (select count(*) from purchases where status = 'pending')::int as pending_orders,
        (select count(*) from messages where status = 'new')::int as new_messages,
        (select count(*) from products where status = 'published')::int as products,
        (select count(*) from security_events where created_at > now() - interval '24 hours' and severity in ('high','critical'))::int as threats_24h,
        (select count(*) from ip_blocks where blocked_until is null or blocked_until > now())::int as active_blocks,
        (select coalesce(sum(size_bytes), 0) from files where status in ('ready','uploading'))::float8 as storage_used,
        (select count(*) from visits where day > current_date - 30)::int as visitors_30d,
        (select count(*) from visits)::int as visits_total,
        (select coalesce(sum(hits), 0) from visits)::int as pageviews_total`],
      [`select p.id, p.slug, p.title, p.kind, p.views, p.downloads from products p order by p.views desc limit 6`],
      [`select d::date as day, (select count(*) from visits v where v.day = d::date)::int as visitors,
        (select count(*) from downloads w where w.created_at::date = d::date)::int as downloads
        from generate_series(current_date - 13, current_date, interval '1 day') d order by 1`],
    ]);
    return { ...s, storage_quota: QUOTA, top_viewed: top, series };
  });

  add('GET', '/admin/diag', 'admin', (c) => ({
    ip: c.ip, ua: c.ua,
    headers: Object.fromEntries([...c.req.headers].filter(([k]) => /forwarded|real-ip|nf-|cf-|via/.test(k))),
  }));

  // ---------- المنتجات ----------
  add('GET', '/admin/products', 'admin', async (c) => {
    const q = c.url.searchParams;
    const status = ['draft', 'published', 'hidden'].includes(q.get('status')) ? q.get('status') : null;
    return {
      items: await c.db.all(`select ${COLS}, p.created_at, p.updated_at,
        (select count(*) from files f where f.product_id = p.id and f.status = 'ready')::int as files,
        (select count(*) from purchases b where b.product_id = p.id and b.status = 'paid')::int as sales
        from products p where ($1 = '' or p.title ilike '%' || $1 || '%' or p.slug ilike '%' || $1 || '%') and ($2::text is null or p.status = $2)
        order by p.updated_at desc limit 300`, [like(q.get('q')), status]),
    };
  });

  add('GET', '/admin/products/:id', 'admin', async (c) => {
    const id = uid(c.params.id);
    const [p, files, lessons] = await c.db.tx([
      ['select p.*, effective_price(p) as final_price from products p where id = $1', [id]],
      [`select id, version, file_name, size_bytes, mime, notes, is_current, scan_status, scan_detail, status, purpose, lesson_id, created_at, completed_at
        from files where product_id = $1 and status <> 'deleted' order by created_at desc`, [id]],
      [`select l.*, f.file_name as video_name, f.size_bytes as video_size from lessons l left join files f on f.id = l.video_file_id
        where l.product_id = $1 order by l.position, l.created_at`, [id]],
    ]);
    return p[0] ? { product: p[0], files, lessons } : fail(404, 'not_found');
  });

  add('POST', '/admin/products', 'admin', async (c) => {
    const o = productInput(c.body || {}, false);
    o.created_by = c.uid;
    const k = Object.keys(o);
    const [r] = await c.db.tx([
      [`insert into products (${k.join(', ')}) values (${k.map((_, i) => '$' + (i + 1)).join(', ')}) returning id, slug`, k.map((x) => o[x])],
      audit(c, 'product.create', o.slug, { title: o.title }),
    ]);
    return r[0];
  });

  add('PATCH', '/admin/products/:id', 'admin', async (c) => {
    const id = uid(c.params.id);
    const o = productInput(c.body || {}, true);
    const k = Object.keys(o);
    if (!k.length) fail(400, 'nothing_to_update');
    const [r] = await c.db.tx([
      [`update products set ${k.map((x, i) => `${x} = $${i + 2}`).join(', ')} where id = $1 returning id, slug, status`, [id, ...k.map((x) => o[x])]],
      audit(c, 'product.update', id, { fields: k }),
    ]);
    return r[0] || fail(404, 'not_found');
  });

  add('DELETE', '/admin/products/:id', 'admin', async (c) => {
    const id = uid(c.params.id);
    const files = await c.db.all(`select object_key, upload_id, status from files where product_id = $1`, [id]);
    const [r] = await c.db.tx([['delete from products where id = $1 returning slug', [id]], audit(c, 'product.delete', id, { files: files.length })]);
    if (!r[0]) fail(404, 'not_found');
    for (const f of files) {
      if (f.status === 'uploading' && f.upload_id) await storage.abort(f.object_key, f.upload_id);
      else if (f.status === 'ready') await storage.del('files', f.object_key);
    }
    return { ok: true };
  });

  // ---------- الملفات والرفع المجزأ القابل للاستكمال ----------
  add('POST', '/admin/uploads', 'admin', async (c) => {
    const b = c.body || {};
    const name = str(b.file_name, 255, { min: 3, name: 'file_name' }).replace(/[\\/\x00-\x1f]/g, '_');
    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    if (!EXT[ext]) fail(400, 'file_type_not_allowed', { ext });
    const size = int(b.size, 1, MAX_FILE, 'size');
    const mime = /^[\w.+-]+\/[\w.+-]+$/.test(b.mime || '') ? b.mime : 'application/octet-stream';
    const productId = uid(b.product_id, 'product_id');
    const lessonId = b.lesson_id ? uid(b.lesson_id, 'lesson_id') : null;
    const [[usage], [prod], lesson] = await c.db.tx([
      [`select coalesce(sum(size_bytes), 0)::float8 as used from files where status in ('ready','uploading')`],
      ['select id from products where id = $1', [productId]],
      ['select id from lessons where id = $1 and product_id = $2', [lessonId, productId]],
    ]);
    if (!prod) fail(404, 'product_not_found');
    if (lessonId && !lesson.length) fail(404, 'lesson_not_found');
    if (usage.used + size > QUOTA) fail(413, 'storage_quota_exceeded', { used: usage.used, quota: QUOTA });
    const safe = name.normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(-120) || 'file';
    const key = `p/${productId}/${randomUUID()}/${safe}`;
    const uploadId = await storage.initMultipart(key, mime);
    const { partSize, parts } = planParts(size);
    const version = b.version ? str(b.version, 40, { name: 'version' }) : null;
    const notes = b.notes ? str(b.notes, 4000, { name: 'notes' }) : null;
    const [r] = await c.db.tx([
      [`insert into files(product_id, lesson_id, purpose, object_key, file_name, mime, size_bytes, version, notes, upload_id, part_size, uploaded_by)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, app_uid()) returning id`,
      [productId, lessonId, lessonId ? 'lesson' : 'product', key, name, mime, size, version, notes, uploadId, partSize]],
      audit(c, 'upload.start', name, { size, product: productId }),
    ]);
    return { file_id: r[0].id, part_size: partSize, parts };
  }, { rl: ['upinit', 30] });

  add('POST', '/admin/uploads/:id/sign', 'admin', async (c) => {
    const f = await uploading(c);
    const list = Array.isArray(c.body?.parts) ? c.body.parts : [];
    if (!list.length || list.length > 100) fail(400, 'invalid_parts');
    const max = Math.ceil(f.size_bytes / f.part_size);
    const urls = {};
    for (const n of list) { const k = int(n, 1, max, 'part'); urls[k] = await storage.signPart(f.object_key, f.upload_id, k); }
    return { urls };
  }, { rl: ['upsign', 600] });

  add('GET', '/admin/uploads/:id/parts', 'admin', async (c) => {
    const f = await uploading(c);
    return { parts: await storage.listParts(f.object_key, f.upload_id), part_size: f.part_size, size: f.size_bytes, file_name: f.file_name };
  }, { rl: ['upsign', 600] });

  add('POST', '/admin/uploads/:id/complete', 'admin', async (c) => {
    const f = await uploading(c);
    const parts = (await storage.listParts(f.object_key, f.upload_id)).sort((a, b) => a.n - b.n);
    const expected = Math.ceil(f.size_bytes / f.part_size);
    const total = parts.reduce((s, p) => s + p.size, 0);
    if (parts.length !== expected) fail(409, 'parts_missing', { have: parts.length, expected });
    if (total !== f.size_bytes) fail(409, 'size_mismatch', { total, expected: f.size_bytes });
    await storage.complete(f.object_key, f.upload_id, parts);
    const head = await storage.head(f.object_key);
    if (!head || head.size !== f.size_bytes) fail(500, 'verify_failed');
    const s = scanFile(f.file_name.split('.').pop().toLowerCase(), await storage.readStart(f.object_key, 4096));
    const list = [['update files set status = $2, upload_id = null, completed_at = now(), scan_status = $3, scan_detail = $4 where id = $1', [f.id, 'ready', s.status, s.detail]]];
    if (f.purpose === 'product' && s.status === 'passed') {
      list.push([`update files set is_current = (id = $1) where product_id = $2 and purpose = 'product' and status = 'ready'`, [f.id, f.product_id]]);
      if (f.version) list.push(['update products set version = $2 where id = $1', [f.product_id, f.version]]);
    }
    if (f.purpose === 'lesson' && s.status === 'passed') list.push(['update lessons set video_file_id = $2 where id = $1', [f.lesson_id, f.id]]);
    list.push(audit(c, 'upload.complete', f.file_name, { size: f.size_bytes, scan: s.status }));
    await c.db.tx(list);
    return { ok: true, scan: s };
  }, { rl: ['upinit', 30] });

  add('DELETE', '/admin/uploads/:id', 'admin', async (c) => {
    const f = await uploading(c);
    await storage.abort(f.object_key, f.upload_id);
    await c.db.tx([[`update files set status = 'aborted', upload_id = null where id = $1`, [f.id]], audit(c, 'upload.abort', f.file_name)]);
    return { ok: true };
  });

  add('PATCH', '/admin/files/:id', 'admin', async (c) => {
    const id = uid(c.params.id), b = c.body || {};
    const f = await c.db.one(`select id, product_id, purpose, status, scan_status from files where id = $1`, [id]);
    if (!f || f.status !== 'ready') fail(404, 'not_found');
    const list = [];
    if (b.version !== undefined) list.push(['update files set version = $2 where id = $1', [id, b.version ? str(b.version, 40, { name: 'version' }) : null]]);
    if (b.notes !== undefined) list.push(['update files set notes = $2 where id = $1', [id, b.notes ? str(b.notes, 4000, { name: 'notes' }) : null]]);
    if (b.scan_status === 'passed' && f.scan_status === 'flagged') list.push([`update files set scan_status = 'passed', scan_detail = 'اعتمده المدير يدوياً' where id = $1`, [id]]);
    if (b.is_current === true && f.purpose === 'product') {
      if (f.scan_status === 'flagged' && b.scan_status !== 'passed') fail(409, 'file_flagged');
      list.push([`update files set is_current = (id = $1) where product_id = $2 and purpose = 'product' and status = 'ready'`, [id, f.product_id]]);
    }
    if (!list.length) fail(400, 'nothing_to_update');
    await c.db.tx([...list, audit(c, 'file.update', id, b)]);
    return { ok: true };
  });

  add('DELETE', '/admin/files/:id', 'admin', async (c) => {
    const id = uid(c.params.id);
    const f = await c.db.one(`select object_key, status from files where id = $1 and status = 'ready'`, [id]);
    if (!f) fail(404, 'not_found');
    await c.db.tx([
      [`update files set status = 'deleted', is_current = false where id = $1`, [id]],
      ['update lessons set video_file_id = null where video_file_id = $1', [id]],
      audit(c, 'file.delete', id),
    ]);
    await storage.del('files', f.object_key);
    return { ok: true };
  });

  add('POST', '/admin/media', 'admin', async (c) => {
    const MAP = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
    const type = c.body?.mime;
    if (!MAP[type]) fail(400, 'image_type_not_allowed');
    const video = type.startsWith('video/');
    // صور متحركة (GIF/WebP) حتى 15MB، وفيديو الخلفية/شاشة الدخول حتى 40MB
    const size = int(c.body?.size, 1, (video ? 40 : 15) * 1024 * 1024, 'size');
    // صور الهوية الثابتة (أيقونة الهاتف وصورة المشاركة) لها مسار ثابت تشير إليه index.html
    const brand = { app_icon: 'brand/app-icon', share: 'brand/share' }[c.body?.purpose];
    if (brand && !['image/png', 'image/jpeg', 'image/webp'].includes(type)) fail(400, 'image_type_not_allowed');
    const key = brand || `${video ? 'vid' : 'img'}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${MAP[type]}`;
    await c.db.tx([audit(c, 'media.upload', key, { size, type })]);
    return { upload_url: await storage.signMediaPut(key, type, size), public_url: storage.mediaUrl(key) + (brand ? `?v=${Date.now()}` : ''), headers: { 'content-type': type } };
  }, { rl: ['media', 30] });

  add('GET', '/admin/storage', 'admin', async (c) => {
    const [[u], files] = await c.db.tx([
      [`select coalesce(sum(size_bytes) filter (where status = 'ready'), 0)::float8 as used,
        coalesce(sum(size_bytes) filter (where status = 'uploading'), 0)::float8 as reserved,
        count(*) filter (where status = 'ready')::int as files from files`],
      [`select f.id, f.file_name, f.size_bytes, f.status, f.scan_status, f.purpose, f.created_at, f.version, p.title, p.slug
        from files f left join products p on p.id = f.product_id where f.status in ('ready','uploading') order by f.created_at desc limit 300`],
    ]);
    return { ...u, quota: QUOTA, max_file: MAX_FILE, files };
  });

  // ---------- الدروس ----------
  add('POST', '/admin/products/:id/lessons', 'admin', async (c) => {
    const pid = uid(c.params.id), b = c.body || {};
    const [r] = await c.db.tx([
      [`insert into lessons(product_id, title, description, duration_s, is_preview, position)
        values ($1, $2, $3, $4, $5, coalesce((select max(position) + 1 from lessons where product_id = $1), 0)) returning id`,
      [pid, str(b.title, 200, { min: 1, name: 'title' }), str(b.description ?? '', 5000, { name: 'description' }), int(b.duration_s ?? 0, 0, 86400, 'duration'), bool(b.is_preview)]],
      audit(c, 'lesson.create', pid),
    ]);
    return r[0];
  });

  add('PATCH', '/admin/lessons/:id', 'admin', async (c) => {
    const id = uid(c.params.id), b = c.body || {};
    const sets = [], vals = [id];
    if (b.title !== undefined) { vals.push(str(b.title, 200, { min: 1, name: 'title' })); sets.push(`title = $${vals.length}`); }
    if (b.description !== undefined) { vals.push(str(b.description, 5000, { name: 'description' })); sets.push(`description = $${vals.length}`); }
    if (b.duration_s !== undefined) { vals.push(int(b.duration_s, 0, 86400, 'duration')); sets.push(`duration_s = $${vals.length}`); }
    if (b.is_preview !== undefined) { vals.push(bool(b.is_preview)); sets.push(`is_preview = $${vals.length}`); }
    if (!sets.length) fail(400, 'nothing_to_update');
    const [r] = await c.db.tx([[`update lessons set ${sets.join(', ')} where id = $1 returning id`, vals], audit(c, 'lesson.update', id)]);
    return r[0] || fail(404, 'not_found');
  });

  add('DELETE', '/admin/lessons/:id', 'admin', async (c) => {
    const id = uid(c.params.id);
    const vids = await c.db.all(`select object_key from files where lesson_id = $1 and status = 'ready'`, [id]);
    const [r] = await c.db.tx([['delete from lessons where id = $1 returning id', [id]], audit(c, 'lesson.delete', id)]);
    if (!r[0]) fail(404, 'not_found');
    for (const v of vids) await storage.del('files', v.object_key);
    return { ok: true };
  });

  add('POST', '/admin/products/:id/lessons/order', 'admin', async (c) => {
    const ids = Array.isArray(c.body?.ids) ? c.body.ids.map((x) => uid(x)) : fail(400, 'invalid_ids');
    await c.db.tx([[`update lessons l set position = x.ord from unnest($2::uuid[]) with ordinality as x(id, ord)
      where l.id = x.id and l.product_id = $1`, [uid(c.params.id), ids]]]);
    return { ok: true };
  });

  // ---------- المستخدمون ----------
  add('GET', '/admin/users', 'admin', async (c) => ({
    items: await c.db.all(`select id, email, name, avatar, role, banned, ban_reason, created_at, last_seen,
      (select count(*) from purchases b where b.user_id = profiles.id and b.status = 'paid')::int as purchases,
      (select count(*) from downloads d where d.user_id = profiles.id)::int as downloads
      from profiles where ($1 = '' or email ilike '%' || $1 || '%' or name ilike '%' || $1 || '%') order by created_at desc limit 300`, [like(c.url.searchParams.get('q'))]),
  }));

  add('POST', '/admin/users/:id/ban', 'admin', async (c) => {
    const id = uid(c.params.id), banned = c.body?.banned !== false;
    const reason = banned ? str(c.body?.reason ?? '', 300, { name: 'reason' }) || null : null;
    const [r] = await c.db.tx([['update profiles set banned = $2, ban_reason = $3 where id = $1 returning id', [id, banned, reason]], audit(c, banned ? 'user.ban' : 'user.unban', id, { reason })]);
    return r[0] ? { ok: true } : fail(404, 'not_found');
  });

  add('POST', '/admin/users/:id/role', 'owner', async (c) => {
    const id = uid(c.params.id), role = ['user', 'admin'].includes(c.body?.role) ? c.body.role : fail(400, 'invalid_role');
    const [r] = await c.db.tx([['update profiles set role = $2 where id = $1 returning id', [id, role]], audit(c, 'user.role', id, { role })]);
    return r[0] ? { ok: true } : fail(404, 'not_found');
  });

  // ---------- الطلبات والمبيعات ----------
  add('GET', '/admin/orders', 'admin', async (c) => {
    const st = ['pending', 'paid', 'test', 'cancelled', 'refunded'].includes(c.url.searchParams.get('status')) ? c.url.searchParams.get('status') : null;
    const items = await c.db.all(`select b.id, b.status, b.reference, b.amount, b.currency, b.provider, b.note, b.created_at, b.paid_at,
        p.title, p.slug, pr.email, pr.name from purchases b left join products p on p.id = b.product_id left join profiles pr on pr.id = b.user_id
        where ($1::text is null or b.status = $1) order by b.created_at desc limit 300`, [st]);
    for (const o of items) o.note = await c.open(o.note);
    return { items };
  });

  add('POST', '/admin/orders/:id/status', 'admin', async (c) => {
    const id = uid(c.params.id), st = ['paid', 'cancelled', 'refunded'].includes(c.body?.status) ? c.body.status : fail(400, 'invalid_status');
    const note = c.body?.note ? await c.seal(str(c.body.note, 1000, { name: 'note' })) : null;
    const [r] = await c.db.tx([
      [`update purchases set status = $2, paid_at = case when $2 = 'paid' then now() else paid_at end, note = coalesce($3, note)
        where id = $1 returning user_id, reference, (select title from products where id = product_id) as title`, [id, st, note]],
      audit(c, 'order.' + st, id, { note: note ? 'encrypted' : null }),
    ]);
    const o = r[0] || fail(404, 'not_found');
    const msg = { paid: ['تم تأكيد طلبك ✅', `تم تأكيد الدفع للطلب ${o.reference} (${o.title || ''}). التحميل متاح الآن من صفحة المنتج.`],
      cancelled: ['تم إلغاء الطلب', `تم إلغاء الطلب ${o.reference}.`], refunded: ['تم استرجاع المبلغ', `تم استرجاع مبلغ الطلب ${o.reference}.`] }[st];
    await c.db.one(`insert into notifications(user_id, kind, title, body, created_by) values ($1, 'order', $2, $3, app_uid())`, [o.user_id, msg[0], msg[1]]);
    return { ok: true };
  });

  // ---------- الرسائل والإشعارات ----------
  add('GET', '/admin/messages', 'admin', async (c) => {
    const items = await c.db.all(`select m.id, m.name, m.email, m.subject, m.body, m.status, m.reply, m.replied_at, m.created_at, pr.email as account_email
      from messages m left join profiles pr on pr.id = m.user_id order by m.created_at desc limit 300`);
    for (const m of items) { m.email = await c.open(m.email); m.body = await c.open(m.body); m.reply = await c.open(m.reply); }
    return { items };
  });

  add('POST', '/admin/messages/:id/reply', 'admin', async (c) => {
    const id = bigId(c.params.id), reply = str(c.body?.reply, 5000, { min: 1, name: 'reply' });
    const [r] = await c.db.tx([
      [`update messages set reply = $2, status = 'replied', replied_at = now() where id = $1 returning user_id, subject`, [id, await c.seal(reply)]],
      audit(c, 'message.reply', id),
    ]);
    const m = r[0] || fail(404, 'not_found');
    if (m.user_id) await c.db.one(`insert into notifications(user_id, kind, title, body, created_by) values ($1, 'message', $2, $3, app_uid())`, [m.user_id, 'رد على: ' + m.subject.slice(0, 150), await c.seal(reply)]);
    return { ok: true, notified: !!m.user_id };
  });

  add('POST', '/admin/messages/:id/status', 'admin', async (c) => {
    const st = ['read', 'closed', 'new'].includes(c.body?.status) ? c.body.status : fail(400, 'invalid_status');
    await c.db.one('update messages set status = $2 where id = $1', [bigId(c.params.id), st]);
    return { ok: true };
  });

  add('GET', '/admin/notifications', 'admin', async (c) => {
    const items = await c.db.all(`select n.id, n.kind, n.title, n.body, n.for_admins, n.created_at, pr.email from notifications n
      left join profiles pr on pr.id = n.user_id order by n.created_at desc limit 150`);
    for (const n of items) n.body = await c.open(n.body);
    return { items };
  });

  add('POST', '/admin/notifications', 'admin', async (c) => {
    const title = str(c.body?.title, 200, { min: 2, name: 'title' }), body = str(c.body?.body ?? '', 4000, { name: 'body' });
    let to = null;
    if (c.body?.email) {
      const u = await c.db.one('select id from profiles where lower(email) = lower($1)', [str(c.body.email, 200, { name: 'email' })]);
      to = u ? u.id : fail(404, 'user_not_found');
    }
    await c.db.tx([
      [`insert into notifications(user_id, kind, title, body, created_by) values ($1, $2, $3, $4, app_uid())`, [to, to ? 'message' : 'info', title, body]],
      audit(c, 'notification.send', to || 'all', { title }),
    ]);
    return { ok: true };
  }, { rl: ['notify', 30] });

  add('DELETE', '/admin/notifications/:id', 'admin', async (c) => {
    await c.db.tx([['delete from notifications where id = $1', [bigId(c.params.id)]], audit(c, 'notification.delete', c.params.id)]);
    return { ok: true };
  });

  // ---------- الإعدادات والمظهر ----------
  add('PUT', '/admin/settings/:key', 'admin', async (c) => {
    const key = c.params.key, v = settingInput(key, c.body?.value);
    await c.db.tx([
      ['insert into settings(key, value, updated_at) values ($1, $2, now()) on conflict (key) do update set value = excluded.value, updated_at = now()', [key, JSON.stringify(v)]],
      audit(c, 'settings.update', key),
    ]);
    c.settingsCache.delete(key); c.settingsCache.delete('__public');
    return { ok: true, value: v };
  });

  // ---------- الأمان ----------
  add('GET', '/admin/security', 'admin', async (c) => {
    const sev = ['low', 'medium', 'high', 'critical'].includes(c.url.searchParams.get('severity')) ? c.url.searchParams.get('severity') : null;
    const [events, blocks, summary] = await c.db.tx([
      ['select * from security_events where ($1::text is null or severity = $1) order by created_at desc limit 300', [sev]],
      ['select * from ip_blocks where blocked_until is null or blocked_until > now() order by created_at desc'],
      [`select kind, severity, count(*)::int as n from security_events where created_at > now() - interval '24 hours' group by 1, 2 order by n desc limit 20`],
    ]);
    return { events, blocks, summary, your_ip: c.ip };
  });

  add('POST', '/admin/security/block', 'admin', async (c) => {
    const ip = str(c.body?.ip, 64, { min: 3, name: 'ip' });
    if (!/^[0-9a-f:.]+$/i.test(ip)) fail(400, 'invalid_ip');
    if (ip === c.ip) fail(400, 'cannot_block_self');
    const minutes = c.body?.minutes == null ? null : int(c.body.minutes, 1, 525600, 'minutes');
    const reason = str(c.body?.reason || 'حظر يدوي', 300, { name: 'reason' });
    await c.db.tx([
      [`insert into ip_blocks(ip, reason, severity, blocked_until, created_by) values ($1, $2, 'manual',
        case when $3::int is null then null else now() + make_interval(mins => $3::int) end, $4)
        on conflict (ip) do update set reason = excluded.reason, severity = 'manual', blocked_until = excluded.blocked_until, created_by = excluded.created_by`, [ip, reason, minutes, c.uid]],
      audit(c, 'security.block', ip, { minutes, reason }),
    ]);
    c.blocked.add(ip);
    return { ok: true };
  });

  add('DELETE', '/admin/security/block/:ip', 'admin', async (c) => {
    const ip = str(c.params.ip, 64, { min: 3, name: 'ip' });
    await c.db.tx([['delete from ip_blocks where ip = $1', [ip]], audit(c, 'security.unblock', ip)]);
    c.unblock(ip);
    return { ok: true };
  });

  add('GET', '/admin/audit', 'admin', async (c) => ({
    items: await c.db.all(`select a.id, a.action, a.target, a.meta, a.ip, a.created_at, pr.email as actor from audit_log a
      left join profiles pr on pr.id = a.actor_id order by a.created_at desc limit 300`),
  }));
}
