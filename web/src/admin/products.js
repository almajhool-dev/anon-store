// إدارة المنتجات: إنشاء/تعديل، التسعير والخصومات والعروض المؤقتة، الصور، الملفات والإصدارات (رفع ضخم قابل للاستكمال)، الدروس
import { html, mount, actions, toast, confirmBox, promptBox, busy, $, safeUrl } from '../lib/dom.js';
import { api, fmtNum, fmtBytes, fmtDate, fmtPrice, fmtDur, slugify, KINDS } from '../lib/core.js';
import { icon } from '../lib/art.js';
import { loader, empty, cover } from '../lib/ui.js';
import { Uploader, pendingUploads, forgetUpload } from '../lib/uploader.js';
import { table } from './admin.js';

const ST = { draft: ['مسودة', ''], published: ['منشور', 'ok'], hidden: ['مخفي', 'warn'] };
const ACCEPT = '.py,.pyw,.ipynb,.txt,.md,.json,.csv,.sh,.zip,.apk,.aab,.xapk,.apks,.jar,.docx,.xlsx,.pptx,.rar,.7z,.gz,.tgz,.tar,.pdf,.mp4,.m4v,.mov,.mkv,.webm,.mp3,.wav,.exe,.msi,.doc,.xls,.ppt,.deb,.iso,.img,.bin';
const STATE_TXT = { preparing: 'تحضير…', uploading: 'جارٍ الرفع', paused: 'متوقف مؤقتاً', offline: 'بانتظار عودة الإنترنت…', retrying: 'إعادة المحاولة', completing: 'تجميع وفحص الملف…', done: 'اكتمل ✅', error: 'خطأ', canceled: 'أُلغي' };
const active = new Map();

export async function uploadImage(file) {
  if (!/^image\/(png|jpeg|webp|gif|x-icon|vnd\.microsoft\.icon)$/.test(file.type)) throw new Error('الصور المسموحة: PNG, JPG, WEBP, GIF, ICO');
  if (file.size > 8 * 1024 * 1024) throw new Error('حجم الصورة يتجاوز 8MB');
  const r = await api.post('/admin/media', { mime: file.type, size: file.size });
  const put = await fetch(r.upload_url, { method: 'PUT', headers: r.headers, body: file });
  if (!put.ok) throw new Error('فشل رفع الصورة');
  return r.public_url;
}
const localInput = (iso) => { if (!iso) return ''; const d = new Date(iso); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const fmtEta = (s) => (!s || !isFinite(s) ? '' : s > 3600 ? `${Math.floor(s / 3600)}س ${Math.floor((s % 3600) / 60)}د` : s > 60 ? `${Math.floor(s / 60)}د ${Math.floor(s % 60)}ث` : `${Math.floor(s)}ث`);

async function list(main) {
  let q = '', status = '';
  mount(main, html`<div class="row between wrap mb"><h2>المنتجات والكورسات</h2><a class="btn primary" href="/admin/products?edit=new">${icon('plus')} منتج جديد</a></div>
    <div class="toolbar"><input class="input grow" id="pq" placeholder="بحث بالاسم أو الرابط..."><div class="chips">${[['', 'الكل'], ...Object.entries(ST).map(([k, v]) => [k, v[0]])].map(([k, t]) => html`<button class="chip${k ? '' : ' active'}" data-act="st" data-v="${k}">${t}</button>`)}</div></div><div id="plist">${loader()}</div>`);
  const box = $('#plist', main);
  const draw = async () => {
    const r = await api.get(`/admin/products?q=${encodeURIComponent(q)}${status ? '&status=' + status : ''}`);
    mount(box, r.items.length ? table(['', 'المنتج', 'السعر', 'الحالة', 'ملفات', 'مبيعات', 'تحميلات', 'مشاهدات', ''], r.items.map((p) => html`<tr>
      <td><div class="thumb-sm">${cover(p)}</div></td><td><b>${p.title}</b><div class="small muted">${KINDS[p.kind]?.label} · <span class="ltr">${p.slug}</span></div></td>
      <td>${Number(p.price) ? fmtPrice(p.final_price, p.currency) : 'مجاني'}${p.discount_percent ? html` <span class="badge err">-${p.discount_percent}%</span>` : ''}</td>
      <td><span class="badge ${ST[p.status][1]}">${ST[p.status][0]}</span></td><td>${p.files}</td><td>${p.sales}</td><td>${fmtNum(p.downloads)}</td><td>${fmtNum(p.views)}</td>
      <td><div class="row"><a class="btn sm" href="/admin/products?edit=${p.id}">${icon('edit')} تعديل</a>${p.status === 'published' ? html`<a class="btn ghost sm" href="/p/${p.slug}" aria-label="عرض">${icon('eye')}</a>` : ''}</div></td></tr>`))
      : empty('لا توجد منتجات بعد — ابدأ بإضافة أول منتج', 'grid'));
  };
  $('#pq', main).addEventListener('input', (e) => { clearTimeout(main._t); main._t = setTimeout(() => { q = e.target.value.trim(); draw(); }, 400); });
  actions(main, { st: (b) => { status = b.dataset.v; main.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === b)); draw(); } });
  await draw();
}

async function editor(main, ctx, id) {
  let p, files = [], lessons = [];
  const load = async () => { const r = await api.get('/admin/products/' + id); p = r.product; files = r.files; lessons = r.lessons; };
  if (id) await load();
  else p = { kind: 'python', status: 'draft', price: 0, currency: ctx.state.settings.site.currency || 'USD', discount_percent: 0, version: '1.0.0', gallery: [], tags: [], featured: false, title: '', slug: '', summary: '', description: '' };
  let gallery = [...(p.gallery || [])];

  function render() {
    const media = ['course', 'video'].includes(p.kind);
    const pend = id ? pendingUploads(id).filter((u) => ![...active.values()].some((a) => a.fp === u.key)) : [];
    mount(main, html`<div class="row between wrap mb"><h2>${id ? 'تعديل: ' + p.title : 'منتج جديد'}</h2><div class="row"><a class="btn ghost sm" href="/admin/products">${icon('back')} كل المنتجات</a>${id && p.status === 'published' ? html`<a class="btn ghost sm" href="/p/${p.slug}">${icon('eye')} معاينة</a>` : ''}</div></div>
    <form id="pform" class="card pad">
      <div class="fgrid"><label class="field"><span>العنوان *</span><input class="input" name="title" required minlength="2" maxlength="160" value="${p.title}"></label>
        <label class="field"><span>الرابط المختصر (إنجليزي)</span><input class="input ltr" name="slug" maxlength="81" pattern="[a-z0-9][a-z0-9\\-]{1,80}" value="${p.slug}" placeholder="يُولَّد تلقائياً"></label>
        <label class="field"><span>القسم</span><select class="select" name="kind">${Object.entries(KINDS).map(([k, v]) => html`<option value="${k}" ${p.kind === k ? 'selected' : ''}>${v.label}</option>`)}</select></label>
        <label class="field"><span>الحالة</span><select class="select" name="status">${Object.entries(ST).map(([k, v]) => html`<option value="${k}" ${p.status === k ? 'selected' : ''}>${v[0]}</option>`)}</select></label></div>
      <label class="field"><span>وصف قصير</span><input class="input" name="summary" maxlength="400" value="${p.summary}"></label>
      <label class="field"><span>الوصف الكامل</span><textarea class="input" name="description" rows="8" maxlength="20000">${p.description}</textarea><small>يدعم: ## عنوان، - نقطة، \`كود\`، **غامق**، وروابط https</small></label>
      <div class="fgrid"><label class="field"><span>السعر (0 = مجاني)</span><input class="input ltr" name="price" type="number" min="0" step="0.01" value="${p.price}"></label>
        <label class="field"><span>العملة</span><select class="select" name="currency"><option value="USD" ${p.currency === 'USD' ? 'selected' : ''}>دولار USD</option><option value="IQD" ${p.currency === 'IQD' ? 'selected' : ''}>دينار عراقي IQD</option></select></label>
        <label class="field"><span>نسبة الخصم %</span><input class="input ltr" name="discount_percent" type="number" min="0" max="95" value="${p.discount_percent}"></label>
        <label class="field"><span>ينتهي العرض في (اختياري)</span><input class="input ltr" name="discount_ends_at" type="datetime-local" value="${localInput(p.discount_ends_at)}"></label></div>
      <div class="fgrid"><label class="field"><span>الإصدار</span><input class="input ltr" name="version" maxlength="40" value="${p.version}"></label>
        <label class="field"><span>وسوم (مفصولة بفواصل)</span><input class="input" name="tags" value="${(p.tags || []).join(', ')}"></label></div>
      <label class="switch"><input type="checkbox" name="featured" ${p.featured ? 'checked' : ''}> منتج مميز</label>
      <div class="field"><span>صورة الغلاف</span><div class="img-pick">${p.cover_url ? html`<img src="${safeUrl(p.cover_url)}" alt="">` : ''}<label class="btn sm">${icon('upload')} رفع صورة<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-img="cover" hidden></label>
        <input class="input ltr grow" name="cover_url" value="${p.cover_url || ''}" placeholder="أو ألصق رابط https"></div></div>
      <div class="field"><span>معرض الصور</span><div class="img-pick">${gallery.map((u, i) => html`<span class="row"><img src="${safeUrl(u)}" alt=""><button type="button" class="btn ghost sm" data-act="gdel" data-i="${i}" aria-label="حذف">${icon('x')}</button></span>`)}
        <label class="btn sm">${icon('plus')} إضافة صور<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple data-img="gallery" hidden></label></div></div>
      <div class="row wrap gap mt"><button class="btn primary lg">${icon('check')} ${id ? 'حفظ التغييرات' : 'إنشاء المنتج'}</button>${id ? html`<button type="button" class="btn danger" data-act="delp">${icon('trash')} حذف المنتج</button>` : ''}</div>
    </form>
    ${id ? html`
    <div class="card pad mt"><h3>${icon('upload')} ${media ? 'ملفات مرفقة (اختياري)' : 'ملفات المنتج والإصدارات'}</h3>
      <p class="muted small">رفع مجزأ مباشر للتخزين: إيقاف/استكمال، استكمال تلقائي بعد انقطاع الإنترنت، ودون أي ضغط. حتى 10GB للملف. عند إعادة تحميل الصفحة أعد اختيار نفس الملف ليكمل من حيث توقف.</p>
      <div class="fgrid"><label class="field"><span>رقم إصدار الملف</span><input class="input ltr" id="upver" placeholder="${p.version}"></label><label class="field"><span>ملاحظات التحديث</span><input class="input" id="upnotes" maxlength="4000" placeholder="ما الجديد في هذا الإصدار؟"></label></div>
      <label class="drop" id="drop">${icon('upload')}<p><b>اسحب الملفات هنا أو اضغط للاختيار</b></p><p class="muted small">Python, APK, ZIP, RAR, 7Z, PDF, DOCX, XLSX, MP4, MOV, MKV ...</p><input type="file" multiple accept="${ACCEPT}" data-up="product"></label>
      ${pend.length ? html`<div class="mt">${pend.map((u) => html`<div class="upl"><div class="row between"><span><b class="ltr">${u.name}</b> <span class="muted small">(${fmtBytes(u.size)})</span> — رفع غير مكتمل${u.lesson ? ' (فيديو درس)' : ''}</span><span class="row"><span class="small muted">أعد اختيار نفس الملف للاستكمال</span><button class="btn ghost sm" data-act="forget" data-k="${u.key}" data-id="${u.id}">إلغاء نهائي</button></span></div></div>`)}</div>` : ''}
      <div id="ups"></div>
      ${files.filter((f) => f.purpose === 'product').length ? html`<h4 class="mt">الملفات المرفوعة</h4>${table(['الملف', 'الإصدار', 'الحجم', 'الفحص', '', 'التاريخ', ''], files.filter((f) => f.purpose === 'product').map((f) => html`<tr>
        <td class="ltr small">${f.file_name}</td><td class="ltr">${f.version || '—'}</td><td>${fmtBytes(f.size_bytes)}</td>
        <td>${f.status === 'uploading' ? html`<span class="badge warn">قيد الرفع</span>` : html`<span class="badge ${f.scan_status === 'passed' ? 'ok' : f.scan_status === 'flagged' ? 'err' : ''}" title="${f.scan_detail || ''}">${{ passed: 'سليم', flagged: 'مشبوه', pending: '—' }[f.scan_status]}</span>`}</td>
        <td>${f.is_current ? html`<span class="badge info">الحالي</span>` : ''}</td><td class="small">${fmtDate(f.created_at)}</td>
        <td>${f.status === 'ready' ? html`<div class="row">${f.is_current ? '' : html`<button class="btn sm" data-act="cur" data-id="${f.id}">تعيين كحالي</button>`}${f.scan_status === 'flagged' ? html`<button class="btn sm" data-act="approve" data-id="${f.id}">اعتماد</button>` : ''}
          <button class="btn ghost sm" data-act="fedit" data-id="${f.id}" aria-label="تعديل">${icon('edit')}</button><button class="btn ghost sm" data-act="fdel" data-id="${f.id}" aria-label="حذف">${icon('trash')}</button></div>` : ''}</td></tr>`))}` : ''}
    </div>
    ${media ? html`<div class="card pad mt"><h3>${icon('list')} الدروس (${lessons.length})</h3>
      <form class="row wrap" id="lform"><input class="input grow" name="title" placeholder="عنوان الدرس الجديد" required maxlength="200"><label class="switch"><input type="checkbox" name="is_preview"> درس مجاني (معاينة)</label><button class="btn primary">${icon('plus')} إضافة</button></form>
      <div class="list mt">${lessons.map((l, i) => html`<div class="li"><span class="badge">${i + 1}</span><span class="grow"><b>${l.title}</b><span class="muted small">${l.video_name ? html`${icon('play')} <span class="ltr">${l.video_name}</span> · ${fmtBytes(l.video_size)}` : 'بدون فيديو'}${l.duration_s ? ' · ' + fmtDur(l.duration_s) : ''}</span></span>
        ${l.is_preview ? html`<span class="badge ok">مجاني</span>` : ''}
        <div class="row"><button class="btn ghost sm" data-act="up" data-i="${i}" ${i ? '' : 'disabled'} aria-label="أعلى">▲</button><button class="btn ghost sm" data-act="down" data-i="${i}" ${i < lessons.length - 1 ? '' : 'disabled'} aria-label="أسفل">▼</button>
        <label class="btn sm">${icon('upload')} ${l.video_name ? 'استبدال الفيديو' : 'رفع فيديو'}<input type="file" accept="video/*,.mkv,.mov" data-up="lesson" data-lesson="${l.id}" hidden></label>
        <button class="btn ghost sm" data-act="ledit" data-id="${l.id}" aria-label="تعديل">${icon('edit')}</button><button class="btn ghost sm" data-act="lprev" data-id="${l.id}">${l.is_preview ? 'جعله مدفوعاً' : 'جعله مجانياً'}</button><button class="btn ghost sm" data-act="ldel" data-id="${l.id}" aria-label="حذف">${icon('trash')}</button></div></div>`)}</div></div>` : ''}` : html`<p class="muted mt">احفظ المنتج أولاً لتتمكن من رفع الملفات والدروس.</p>`}`);
    for (const u of active.values()) if (u.meta.product_id === id) { $('#ups', main).insertAdjacentHTML('beforeend', `<div class="upl" id="u-${u.uid}"></div>`); u.onChange = paint; paint(u); }
    bind();
  }

  function paint(u) {
    const el = main.querySelector('#u-' + u.uid);
    if (!el) return;
    const pct = u.file.size ? Math.floor((u.bytes / u.file.size) * 100) : 0;
    const st = STATE_TXT[u.state] + (u.state === 'retrying' ? ` خلال ${u.info}ث` : u.state === 'error' ? `: ${u.info}` : '') + (u.state === 'done' && u.info ? ` — فحص: ${u.info.status === 'passed' ? 'سليم' : 'مشبوه'} (${u.info.detail})` : '');
    mount(el, html`<div class="row between"><span><b class="ltr">${u.file.name}</b> <span class="muted small">${u.label || ''} ${fmtBytes(u.file.size)}${u.resumed ? ' · استكمال' : ''}</span></span>
      <span class="row">${['uploading', 'retrying', 'offline'].includes(u.state) ? html`<button class="btn ghost sm" data-act="upause" data-u="${u.uid}">${icon('pause')} إيقاف</button>` : ''}
      ${['paused', 'error'].includes(u.state) ? html`<button class="btn sm" data-act="uresume" data-u="${u.uid}">${icon('play')} استكمال</button>` : ''}
      ${!['done', 'canceled', 'completing'].includes(u.state) ? html`<button class="btn ghost sm" data-act="ucancel" data-u="${u.uid}">${icon('x')}</button>` : ''}</span></div>
      <div class="progress"><i></i></div><div class="row between small muted"><span>${st}</span><span class="ltr">${pct}% · ${fmtBytes(u.bytes)} / ${fmtBytes(u.file.size)}${u.state === 'uploading' && u.speed ? ` · ${fmtBytes(u.speed)}/s · ${fmtEta(u.eta)}` : ''}</span></div>`);
    el.querySelector('.progress i').style.width = pct + '%';
    if (u.state === 'done' || u.state === 'canceled') {
      active.delete(u.uid);
      if (u.state === 'done') { toast(`اكتمل رفع ${u.file.name}`, 'ok'); setTimeout(() => load().then(render), 600); }
    }
  }

  async function startUpload(file, lessonId, label) {
    const meta = { product_id: id };
    if (lessonId) meta.lesson_id = lessonId;
    else { const v = $('#upver', main)?.value.trim(); const n = $('#upnotes', main)?.value.trim(); if (v) meta.version = v; if (n) meta.notes = n; }
    const u = new Uploader(file, meta, paint);
    u.uid = Math.random().toString(36).slice(2, 9);
    u.label = label;
    if ([...active.values()].some((a) => a.fp === u.fp)) return toast('هذا الملف قيد الرفع بالفعل', 'warn');
    active.set(u.uid, u);
    $('#ups', main).insertAdjacentHTML('beforeend', `<div class="upl" id="u-${u.uid}"></div>`);
    u.start();
    if (lessonId && file.type.startsWith('video/')) {
      const vid = document.createElement('video'), url = URL.createObjectURL(file);
      vid.preload = 'metadata';
      vid.onloadedmetadata = () => { URL.revokeObjectURL(url); if (isFinite(vid.duration)) api.patch('/admin/lessons/' + lessonId, { duration_s: Math.round(vid.duration) }).catch(() => {}); };
      vid.src = url;
    }
  }

  function bind() {
    const form = $('#pform', main);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form)), b = form.querySelector('.btn.primary');
      const slug = (f.slug || '').trim() || slugify(f.title) || 'p-' + Math.random().toString(36).slice(2, 8);
      const body = { title: f.title.trim(), slug, kind: f.kind, status: f.status, summary: f.summary, description: f.description, price: Number(f.price || 0), currency: f.currency,
        discount_percent: Number(f.discount_percent || 0), discount_ends_at: f.discount_ends_at ? new Date(f.discount_ends_at).toISOString() : null, version: f.version || '1.0.0',
        tags: f.tags.split(',').map((s) => s.trim()).filter(Boolean), featured: !!f.featured, cover_url: f.cover_url.trim() || null, gallery };
      busy(b, true);
      try {
        if (id) { await api.patch('/admin/products/' + id, body); toast('تم الحفظ', 'ok'); await load(); render(); }
        else { const r = await api.post('/admin/products', body); toast('تم إنشاء المنتج — يمكنك الآن رفع الملفات', 'ok'); ctx.go('/admin/products?edit=' + r.id, true); }
      } catch (er) { toast(er.message, 'error'); busy(b, false); }
    });
    form.querySelector('[name=title]').addEventListener('input', (e) => { const s = form.querySelector('[name=slug]'); if (!id && !s.dataset.touched) s.value = slugify(e.target.value); });
    form.querySelector('[name=slug]').addEventListener('input', (e) => { e.target.dataset.touched = '1'; });
    main.querySelectorAll('[data-img]').forEach((inp) => inp.addEventListener('change', async () => {
      const list = [...inp.files];
      try {
        for (const file of list) {
          toast('جارٍ رفع الصورة…');
          const url = await uploadImage(file);
          if (inp.dataset.img === 'cover') { form.querySelector('[name=cover_url]').value = url; p.cover_url = url; } else gallery.push(url);
        }
        p.gallery = gallery;
        Object.assign(p, Object.fromEntries(new FormData(form)), { featured: form.featured.checked, cover_url: form.cover_url.value, gallery, tags: form.tags.value.split(',').map((s) => s.trim()).filter(Boolean) });
        render();
        toast('تم رفع الصورة — اضغط حفظ لتثبيت التغييرات', 'ok');
      } catch (e) { toast(e.message, 'error'); }
    }));
    main.querySelectorAll('[data-up]').forEach((inp) => inp.addEventListener('change', () => {
      const l = lessons.find((x) => x.id === inp.dataset.lesson);
      for (const file of inp.files) startUpload(file, inp.dataset.lesson, l ? `درس: ${l.title} ·` : '');
      inp.value = '';
    }));
    const drop = $('#drop', main);
    if (drop) {
      ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('over')));
      drop.addEventListener('drop', (e) => { e.preventDefault(); for (const file of e.dataTransfer.files) startUpload(file); });
    }
    $('#lform', main)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try { await api.post(`/admin/products/${id}/lessons`, { title: f.get('title'), is_preview: !!f.get('is_preview') }); await load(); render(); } catch (er) { toast(er.message, 'error'); }
    });
  }

  const reorder = async (i, d) => {
    const ids = lessons.map((l) => l.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    try { await api.post(`/admin/products/${id}/lessons/order`, { ids }); await load(); render(); } catch (e) { toast(e.message, 'error'); }
  };
  const fileOp = async (fid, body, msg) => { try { await api.patch('/admin/files/' + fid, body); toast(msg, 'ok'); await load(); render(); } catch (e) { toast(e.message, 'error'); } };

  actions(main, {
    gdel: (b) => { gallery.splice(Number(b.dataset.i), 1); p.gallery = gallery; render(); toast('اضغط حفظ لتثبيت التغيير'); },
    delp: async () => {
      if (!(await confirmBox('حذف المنتج وجميع ملفاته نهائياً؟ (المنتجات التي عليها مبيعات تُخفى بدلاً من الحذف)', { danger: true, ok: 'حذف نهائي' }))) return;
      try { await api.del('/admin/products/' + id); toast('تم الحذف', 'ok'); ctx.go('/admin/products', true); } catch (e) { toast(e.message, 'error'); }
    },
    upause: (b) => active.get(b.dataset.u)?.pause(),
    uresume: (b) => active.get(b.dataset.u)?.resume(),
    ucancel: async (b) => { const u = active.get(b.dataset.u); if (u && (await confirmBox('إلغاء الرفع؟', { danger: true }))) await u.cancel(); },
    forget: async (b) => {
      if (!(await confirmBox('إلغاء هذا الرفع غير المكتمل نهائياً؟', { danger: true }))) return;
      forgetUpload(b.dataset.k);
      try { await api.del('/admin/uploads/' + b.dataset.id); } catch { /* منتهي */ }
      await load(); render();
    },
    cur: (b) => fileOp(b.dataset.id, { is_current: true }, 'أصبح هذا الإصدار هو الحالي'),
    approve: async (b) => { if (await confirmBox('اعتماد ملف مُعلَّم كمشبوه؟ تأكد من مصدره أولاً.', { danger: true, ok: 'اعتماد' })) fileOp(b.dataset.id, { scan_status: 'passed' }, 'تم الاعتماد'); },
    fedit: async (b) => {
      const f = files.find((x) => x.id === b.dataset.id);
      const version = await promptBox('رقم الإصدار', { value: f.version || '' });
      if (version === null) return;
      const notes = await promptBox('ملاحظات التحديث', { value: f.notes || '', multiline: true });
      if (notes === null) return;
      fileOp(f.id, { version, notes }, 'تم الحفظ');
    },
    fdel: async (b) => { if (!(await confirmBox('حذف الملف نهائياً من التخزين؟', { danger: true, ok: 'حذف' }))) return; try { await api.del('/admin/files/' + b.dataset.id); toast('تم الحذف', 'ok'); await load(); render(); } catch (e) { toast(e.message, 'error'); } },
    up: (b) => reorder(Number(b.dataset.i), -1),
    down: (b) => reorder(Number(b.dataset.i), 1),
    ledit: async (b) => {
      const l = lessons.find((x) => x.id === b.dataset.id);
      const title = await promptBox('عنوان الدرس', { value: l.title });
      if (!title) return;
      const description = await promptBox('وصف الدرس', { value: l.description, multiline: true });
      if (description === null) return;
      try { await api.patch('/admin/lessons/' + l.id, { title, description }); await load(); render(); } catch (e) { toast(e.message, 'error'); }
    },
    lprev: async (b) => { const l = lessons.find((x) => x.id === b.dataset.id); try { await api.patch('/admin/lessons/' + l.id, { is_preview: !l.is_preview }); await load(); render(); } catch (e) { toast(e.message, 'error'); } },
    ldel: async (b) => { if (!(await confirmBox('حذف الدرس وفيديو الدرس نهائياً؟', { danger: true, ok: 'حذف' }))) return; try { await api.del('/admin/lessons/' + b.dataset.id); await load(); render(); } catch (e) { toast(e.message, 'error'); } },
  });
  render();
}

export default async function (main, ctx) {
  const edit = new URLSearchParams(location.search).get('edit');
  return edit ? editor(main, ctx, edit === 'new' ? null : edit) : list(main, ctx);
}
