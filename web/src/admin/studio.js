// 🎨 Ultimate Design Studio — 200 واجهة، معاينة حية بأحجام الشاشات، مسودة ثم نشر، تراجع واستعادة، مفضلة، مقارنة، تصميم للهاتف، نسخ احتياطي
import { html, mount, toast, busy, $, raw, confirmBox } from '../lib/dom.js';
import { api } from '../lib/core.js';
import { icon, art, LOGO } from '../lib/art.js';
import { card } from '../lib/ui.js';
import { PRESETS, PACKS, SECTIONS, preset, FONTS_AR, FONTS_EN, FONTS_HEAD, QUALITY, BUNDLES, DEFAULT_TOKENS, applyDesign } from '../lib/design.js';

const A = (p) => raw(`data-sec="${p.sec}" data-ds-fixed${p.lay ? ` data-lay="${p.lay}" data-pack="${p.pack}"` : ''}`);
const ORIG = (sec) => ({ id: '', sec, lay: '', pack: '' }); // الشكل الأصلي (بلا أي أسلوب)
const fake = (i) => ({ slug: 'demo', kind: ['python', 'apk', 'course'][i], title: ['أداة فحص الشبكات', 'تطبيق الحماية', 'دورة بايثون الاحترافية'][i], summary: 'وصف مختصر يظهر هنا', price: i ? 9.99 : 0, currency: 'USD', downloads: 1200 + i * 340, discount_percent: i === 1 ? 20 : 0, featured: i === 2 });
const L = raw(LOGO);
// نماذج مصغّرة حقيقية لكل قسم (نفس مكونات الموقع وأصنافه) — تُرسم داخل البطاقة بمقياس مصغّر
const MOCK = {
  header: (p) => html`<header class="hdr" ${A(p)}><div class="container"><a class="brand">${L}<span>متجر المبرمج<small>Anonymous Store</small></span></a><nav class="nav"><a>الرئيسية</a><a>أدوات</a><a>تطبيقات</a><a>كورسات</a></nav><div class="hdr-actions"><span class="icon-btn">${icon('search')}</span><span class="btn primary sm">دخول</span></div></div></header>`,
  hero: (p) => html`<section class="hero" ${A(p)}><div><span class="pill"><i></i> متجر المبرمج</span><h1>أدوات وكورسات <span class="gradient-text">للمحترفين</span></h1><p class="lead">واجهة حديثة تعرض منتجاتك بأسلوب فاخر</p><div class="row gap"><span class="btn primary lg">تصفح المتجر</span><span class="btn lg">مجاني</span></div></div><div class="reveal"><div class="hero-logo">${L}</div></div></section>`,
  cats: (p) => html`<div class="cats" ${A(p)}>${[['python', 'أدوات Python'], ['apk', 'تطبيقات'], ['course', 'كورسات'], ['video', 'فيديوهات']].map(([k, t]) => html`<a class="card cat"><div class="art-wrap">${art(k, t)}</div><div><b>${t}</b><span>وصف القسم</span></div></a>`)}</div>`,
  cards: (p) => html`<div class="grid">${[0, 1, 2].map((i) => raw(String(card(fake(i))).replace('data-sec="cards"', String(A(p))).replace('reveal', '')))}</div>`,
  product: (p) => html`<div class="page" ${A(p)}><div class="split"><div class="card media">${art('apk', '')}</div><div class="card pad"><h2>تطبيق الحماية</h2><p class="muted">مميزات المنتج ووصفه الكامل</p><span class="btn primary">تحميل الآن</span></div></div></div>`,
  learn: (p) => html`<div class="page" ${A(p)}><div class="split"><div class="card player"><div class="ds-video"></div><div class="player-bar"><span class="btn sm">−10</span><span class="btn sm">+10</span></div></div><div class="card lessons">${[1, 2, 3, 4].map((n) => html`<div class="lesson ${n === 1 ? 'on' : ''}"><span class="num">${n}</span> الدرس ${n}</div>`)}</div></div></div>`,
  account: (p) => html`<div class="page" ${A(p)}><div class="card profile"><span class="avatar">م</span><div class="grow"><h2>اسم المستخدم</h2><p class="muted small">user@mail.com</p></div><span class="badge">مستخدم</span></div><div class="row gap"><span class="btn sm primary">المشتريات</span><span class="btn sm">التحميلات</span><span class="btn sm">المفضلة</span></div></div>`,
  auth: (p) => html`<section class="auth" ${A(p)}><div class="a-stage"><div class="a-card"><div class="a-logo">${L}</div><h1 class="a-title">مرحباً <span>بعودتك</span></h1><div class="a-form"><div class="a-in">${icon('mail')}<input placeholder=" " tabindex="-1"><label>البريد الإلكتروني</label></div><div class="a-in">${icon('lock')}<input placeholder=" " tabindex="-1"><label>كلمة السر</label></div><span class="a-btn">تسجيل الدخول</span></div></div></div></section>`,
  footer: (p) => html`<footer class="ftr" ${A(p)}><div class="container"><div class="cols"><div><a class="brand">${L}<span>متجر المبرمج<small>Store</small></span></a><p class="muted small">نبذة قصيرة عن المتجر</p></div><div><h4>الأقسام</h4><a>أدوات</a><a>تطبيقات</a></div><div><h4>الدعم</h4><a>تواصل</a><a>الأسئلة</a></div><div><h4>تابعنا</h4><a>تيليجرام</a><a>تيك توك</a></div></div><div class="copy"><span>© 2026 جميع الحقوق محفوظة</span></div></div></footer>`,
  buttons: (p) => html`<div class="ds-btns" data-bpack="${p.pack}" data-bfx="${p.lay}"><span class="btn primary lg">زر أساسي</span><span class="btn lg">زر ثانوي</span><span class="btn ghost lg">شفاف</span></div>`,
};
const DEV = { mobile: [390, 780, 'هاتف'], tablet: [820, 1000, 'تابلت'], desktop: [1280, 820, 'كمبيوتر'] };

let off = null; // إزالة مستمعي النافذة عند فتح الاستوديو من جديد
export default async function (main, ctx) {
  off?.();
  document.body.classList.add('ds-on'); // أزرار المعاينات المصغّرة لا تتأثر بتصميم الأزرار المنشور
  let S;
  try { S = await api.get('/admin/design'); } catch (e) { mount(main, html`<div class="empty card">${icon('shield')}<p>${e.message}</p></div>`); return; }
  let draft = structuredClone(S.draft || {}), favs = new Set(S.favs || []), sec = 'hero', q = '', packF = '', favOnly = false, device = 'mobile', target = 'desktop', cmpId = null, saveT = 0;
  draft.sections ||= {}; draft.mobile ||= {}; draft.tokens = { ...DEFAULT_TOKENS, ...(draft.tokens || {}) };
  if (draft.mobile_on) device = 'desktop'; // المعاينة تتبع الجهاز الذي أعدّل تصميمه
  const same = () => JSON.stringify(draft) === JSON.stringify({ ...S.published, tokens: { ...DEFAULT_TOKENS, ...(S.published?.tokens || {}) }, sections: S.published?.sections || {}, mobile: S.published?.mobile || {} });
  const selMap = () => (target === 'mobile' ? draft.mobile : draft.sections);
  const chosen = (s) => selMap()[s] || (target === 'mobile' ? draft.sections[s] : null);
  let previewPath = { product: '/', learn: '/' };
  api.get('/products?limit=1&sort=new').then((r) => { const p = r.items?.[0]; if (p) previewPath.product = `/p/${p.slug}`; }).catch(() => {});
  api.get('/products?limit=1&kind=course').then((r) => { const p = r.items?.[0]; if (p) previewPath.learn = `/learn/${p.slug}`; }).catch(() => {});

  const save = () => {
    clearTimeout(saveT);
    saveT = setTimeout(async () => {
      try { await api.put('/admin/design/draft', { design: draft, favs: [...favs] }); $('#ds-state', main).textContent = same() ? 'لا تغييرات غير منشورة' : '● مسودة محفوظة — لم تُنشر بعد'; } catch (e) { toast(e.message, 'error'); }
    }, 350);
    pushPreview();
  };
  const list = () => PRESETS.filter((p) => p.sec === sec && (!packF || p.pack === packF) && (!favOnly || favs.has(p.id)) && (!q || p.name.includes(q) || p.id.includes(q)));
  const item = (p) => html`<div class="card ds-item ${chosen(sec) === p.id ? 'on' : ''} ${cmpId === p.id ? 'cmp' : ''}" data-pick="${p.id}"><div class="ds-thumb"><div class="ds-scale">${MOCK[p.sec](p)}</div></div>
    <div class="ds-meta"><b>${p.name}</b><div class="row wrap"><span class="badge">${p.packLabel}</span><button type="button" class="btn ghost sm" data-fav="${p.id}" aria-label="مفضلة">${favs.has(p.id) ? '★' : '☆'}</button><button type="button" class="btn ghost sm" data-cmp="${p.id}">قارن</button></div></div></div>`;
  // تحديث خفيف بلا إعادة رسم (المعاينة الحية تبقى محمّلة وتتغير فوراً)
  const refresh = () => {
    main.querySelectorAll('.ds-item').forEach((el) => { el.classList.toggle('on', el.dataset.orig ? !chosen(sec) : chosen(sec) === el.dataset.pick); el.classList.toggle('cmp', cmpId === el.dataset.pick); const f = el.querySelector('[data-fav]'); if (f) f.textContent = favs.has(el.dataset.pick) ? '★' : '☆'; });
    main.querySelectorAll('[data-sec-tab]').forEach((b) => { const sm = b.querySelector('small'), id = chosen(b.dataset.secTab); if (sm) sm.textContent = id ? ' · ' + (preset(id)?.packLabel || '') : ' · الحالي'; });
  };
  const origItem = () => (packF || favOnly || (q && !'الشكل الأصلي original'.includes(q)) ? '' : html`<div class="card ds-item ds-orig ${chosen(sec) ? '' : 'on'}" data-orig="1"><div class="ds-thumb"><div class="ds-scale">${MOCK[sec](ORIG(sec))}</div></div>
    <div class="ds-meta"><b>↺ الشكل الأصلي</b><div class="row wrap"><span class="badge">كما كان قبل الاستوديو</span></div></div></div>`);
  const fit = () => main.querySelectorAll('.ds-thumb').forEach((t) => t.firstElementChild.style.setProperty('--k', String(t.clientWidth / 900)));

  function draw() {
    const t = draft.tokens;
    const sel = (k, label, opts) => html`<label class="field"><span>${label}</span><select class="select" data-tok="${k}">${opts.map(([v, l]) => html`<option value="${v}" ${String(t[k]) === v ? 'selected' : ''}>${l}</option>`)}</select></label>`;
    mount(main, html`<h2>${icon('star')} Ultimate Design Studio</h2>
      <p class="muted small">${PRESETS.length} واجهة جاهزة: ${Object.keys(SECTIONS).length} أقسام × ${PACKS.length} أسلوباً، لكل واجهة تخطيط وأسلوب وحركات مختلفة. اختياراتك تُحفظ كمسودة ولا يراها الزوار حتى تضغط «نشر».</p>
      <div class="card pad row wrap gap between"><b id="ds-state">${same() ? 'لا تغييرات غير منشورة' : '● مسودة محفوظة — لم تُنشر بعد'}</b>
        <div class="row wrap gap"><button class="btn primary" data-act="publish">${icon('check')} نشر للجميع</button><button class="btn ghost" data-act="discard">تجاهل المسودة</button><button class="btn ghost" data-act="reset-all">↺ الشكل الأصلي للموقع</button>
        <button class="btn ghost" data-act="export">${icon('download')} نسخة احتياطية</button><label class="btn ghost">${icon('upload')} استيراد<input type="file" accept="application/json" id="ds-import" hidden></label></div></div>
      <div class="card pad mt"><b>${icon('star')} تصميم كامل بنقرة واحدة</b> <span class="muted small">أسلوب موحّد للأقسام العشرة مع الخطوط والأوزان المناسبة — يذهب للمسودة أولاً</span><div class="row wrap gap mt">${BUNDLES.map(([k, l]) => html`<button class="btn sm ds-bundle" data-bundle="${k}">${l}</button>`)}</div></div>
      <div class="tabs ds-secs mt">${Object.entries(SECTIONS).map(([k, [l]]) => html`<button class="btn sm ${k === sec ? 'primary' : ''}" data-sec-tab="${k}">${l}<small>${chosen(k) ? ' · ' + (preset(chosen(k))?.packLabel || '') : ' · الحالي'}</small></button>`)}</div>
      <div class="row wrap gap">
        <input class="input" id="ds-q" placeholder="ابحث باسم الواجهة أو الأسلوب" value="${q}">
        <select class="select" id="ds-pack"><option value="">كل الأساليب (${PACKS.length})</option>${PACKS.map(([k, l]) => html`<option value="${k}" ${packF === k ? 'selected' : ''}>${l}</option>`)}</select>
        <label class="switch"><input type="checkbox" id="ds-fav" ${favOnly ? 'checked' : ''}> المفضلة فقط</label>
        <label class="switch"><input type="checkbox" id="ds-mob" ${draft.mobile_on ? 'checked' : ''}> تصميم مختلف للهاتف</label>
        ${draft.mobile_on ? html`<select class="select" id="ds-target"><option value="desktop" ${target === 'desktop' ? 'selected' : ''}>أعدّل: الكمبيوتر</option><option value="mobile" ${target === 'mobile' ? 'selected' : ''}>أعدّل: الهاتف</option></select>` : ''}
        <button class="btn ghost sm" data-act="reset-sec">↺ الأصلي لهذا القسم</button>
      </div>
      <div class="ds-layout mt"><div class="ds-grid">${origItem()}${list().map(item)}</div>
        <div class="ds-side card pad"><div class="row wrap gap between"><b>معاينة حية</b><div class="row gap">${Object.entries(DEV).map(([k, [, , l]]) => html`<button class="btn sm ${device === k ? 'primary' : ''}" data-dev="${k}">${l}</button>`)}</div></div>
          ${cmpId ? html`<div class="ds-cmp"><div><p>المختار: ${preset(chosen(sec))?.name || 'التصميم الحالي'}</p><div class="ds-frame" id="fA"></div></div><div><p>للمقارنة: ${preset(cmpId)?.name}</p><div class="ds-frame" id="fB"></div><button class="btn sm primary block mt" data-pick="${cmpId}">اعتماد هذا</button></div></div>` : html`<div class="ds-frame" id="fA"></div>`}
          <p class="muted small">المعاينة تعرض المسودة فقط — الموقع لا يتغير للزوار قبل النشر.</p></div></div>
      <details class="card pad mt" open><summary>${icon('sliders')} تخصيص عام: الخطوط والأزرار والأحجام والمسافات والشفافية والأيقونات والحركة والوضع</summary>
        <div class="fgrid mt">
          ${sel('font_ar', 'خط النص العربي', Object.entries(FONTS_AR).map(([k, [, l]]) => [k, l]))}
          ${sel('font_en', 'خط النص الإنجليزي', Object.entries(FONTS_EN).map(([k, [, l]]) => [k, l]))}
          ${sel('font_head', 'خط العناوين', Object.entries(FONTS_HEAD).map(([k, [, l]]) => [k, l]))}
          ${sel('hw', 'سُمك العناوين', [['auto', 'حسب الأسلوب'], ['200', 'Thin 200'], ['300', 'Light 300'], ['400', 'Regular 400'], ['600', 'SemiBold 600'], ['700', 'Bold 700'], ['800', 'ExtraBold 800'], ['900', 'Black 900']])}
          ${sel('hs', 'شكل العناوين', [['normal', 'عادي'], ['outline', 'مفرّغ (Outlined)'], ['gradient', 'متدرّج'], ['glow', 'متوهّج'], ['shadow3d', 'ظل ثلاثي الأبعاد']])}
          ${sel('quality', 'جودة المؤثرات (السقف)', QUALITY)}
          <label class="field"><span>استدارة الأزرار: <b>${t.radius}px</b></span><input type="range" min="0" max="32" step="1" value="${t.radius}" data-tok="radius"></label>
          <label class="field"><span>حجم النصوص: <b>${Math.round(t.scale * 100)}%</b></span><input type="range" min="0.85" max="1.25" step="0.05" value="${t.scale}" data-tok="scale"></label>
          <label class="field"><span>المسافات: <b>${Math.round(t.space * 100)}%</b></span><input type="range" min="0.75" max="1.5" step="0.05" value="${t.space}" data-tok="space"></label>
          <label class="field"><span>الشفافية: <b>${Math.round(t.glass * 100)}%</b></span><input type="range" min="0.3" max="1" step="0.05" value="${t.glass}" data-tok="glass"></label>
          <label class="field"><span>سُمك الأيقونات</span><select class="select" data-tok="stroke">${[[1.5, 'رفيع'], [2, 'عادي'], [2.5, 'عريض']].map(([v, l]) => html`<option value="${v}" ${Number(t.stroke) === v ? 'selected' : ''}>${l}</option>`)}</select></label>
          <label class="field"><span>الحركة</span><select class="select" data-tok="motion">${[['normal', 'عادية'], ['strong', 'قوية'], ['off', 'إيقاف الحركات']].map(([v, l]) => html`<option value="${v}" ${t.motion === v ? 'selected' : ''}>${l}</option>`)}</select></label>
          <label class="field"><span>الوضع</span><select class="select" data-tok="mode">${[['dark', 'ليلي'], ['light', 'نهاري'], ['auto', 'حسب جهاز الزائر']].map(([v, l]) => html`<option value="${v}" ${t.mode === v ? 'selected' : ''}>${l}</option>`)}</select></label>
        </div><button class="btn ghost sm mt" type="button" data-act="reset-tokens">↺ القيم الأصلية للخطوط والأحجام والجودة</button><p class="muted small">الجودة سقف أعلى: الأجهزة الضعيفة تنزل تلقائياً لتبقى سريعة، والزائر يستطيع تفعيل «الوضع الخفيف» من ذيل الموقع. الألوان والخلفيات وحركات الانتقال (100 حركة) في تبويب «المظهر والإعدادات».</p></details>
      <details class="card pad mt"><summary>${icon('clock')} سجل النشر والاستعادة (${S.history.length})</summary>
        ${S.history.length ? S.history.map((h, i) => html`<div class="row between wrap mt"><span class="small">${new Date(h.at).toLocaleString('ar-IQ')} — <span class="ltr">${h.by || ''}</span> · ${Object.keys(h.design?.sections || {}).length} أقسام مخصّصة${h.look ? ' · مع الألوان' : ''}</span><button class="btn ghost sm" data-restore="${i}">استعادة ونشر</button></div>`) : html`<p class="muted small mt">لا يوجد نشر سابق بعد.</p>`}</details>`);
    requestAnimationFrame(fit);
    frames();
  }

  // ---------- المعاينة الحية ----------
  const designFor = (id) => { const d = structuredClone(draft); if (id !== undefined) { const m = target === 'mobile' ? (d.mobile ||= {}) : d.sections; if (id) m[sec] = id; else delete m[sec]; } return d; };
  function frames() {
    const path = SECTIONS[sec][2];
    const url = (path === 'product' || path === 'learn' ? previewPath[path] : path);
    const src = url + (url.includes('?') ? '&' : '?') + 'dsp=1';
    [['fA', undefined], ['fB', cmpId]].forEach(([id, alt]) => {
      const box = $('#' + id, main);
      if (!box) return;
      const [w, h] = DEV[device], k = box.clientWidth / w; // الإطار بعرض العمود، والصفحة الحقيقية مصغّرة بداخله
      box.style.height = `${h * k}px`;
      const f = document.createElement('iframe');
      f.title = 'معاينة'; f.src = src; f.width = String(w); f.height = String(h); f.style.transform = `scale(${k})`;
      f.dataset.alt = alt === undefined ? '' : alt;
      box.replaceChildren(f);
    });
  }
  function pushPreview() {
    main.querySelectorAll('.ds-frame iframe').forEach((f) => f.contentWindow?.postMessage({ type: 'ds', design: f.dataset.alt ? designFor(f.dataset.alt) : draft }, location.origin));
  }
  const onMsg = (e) => { if (e.origin === location.origin && e.data?.type === 'ds-ready') pushPreview(); };
  addEventListener('message', onMsg);

  // ---------- الأحداث ----------
  main.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-pick],[data-fav],[data-cmp],[data-sec-tab],[data-dev],[data-act],[data-restore],[data-bundle],[data-orig]');
    if (!b) return;
    if (b.dataset.orig) { delete selMap()[sec]; save(); toast('رجع هذا القسم لشكله الأصلي — في المسودة', 'ok'); if (cmpId) { cmpId = null; return draw(); } return refresh(); }
    if (b.dataset.bundle) {
      const [, label, pack, tok] = BUNDLES.find((z) => z[0] === b.dataset.bundle);
      for (const k of Object.keys(SECTIONS)) { const p = PRESETS.find((z) => z.sec === k && z.pack === pack); if (p) draft.sections[k] = p.id; }
      draft.tokens = { ...draft.tokens, ...tok }; cmpId = null; save();
      toast(`تم تطبيق تصميم ${label} على كل الأقسام — في المسودة`, 'ok'); return draw();
    }
    if (b.dataset.fav) { e.stopPropagation(); favs.has(b.dataset.fav) ? favs.delete(b.dataset.fav) : favs.add(b.dataset.fav); save(); return favOnly ? draw() : refresh(); }
    if (b.dataset.cmp) { e.stopPropagation(); cmpId = cmpId === b.dataset.cmp ? null : b.dataset.cmp; return draw(); }
    if (b.dataset.pick) { selMap()[sec] = b.dataset.pick; save(); toast(`تم اختيار «${preset(b.dataset.pick).name}» — في المسودة`, 'ok'); if (cmpId) { cmpId = null; return draw(); } return refresh(); }
    if (b.dataset.secTab) { sec = b.dataset.secTab; cmpId = null; return draw(); }
    if (b.dataset.dev) { device = b.dataset.dev; return frames(); }
    if (b.dataset.restore) {
      if (!(await confirmBox('استعادة هذا التصميم ونشره للجميع؟'))) return;
      busy(b, true);
      try { const r = await api.post('/admin/design/restore', { index: Number(b.dataset.restore) }); Object.assign(S, { published: r.published, history: r.history }); draft = structuredClone(r.published); draft.tokens = { ...DEFAULT_TOKENS, ...draft.tokens }; if (r.site) { ctx.state.settings.site = r.site; ctx.applyTheme(r.site); } applyDesign(r.published); toast('تمت الاستعادة والنشر ✅', 'ok'); draw(); }
      catch (er) { toast(er.message, 'error'); busy(b, false); }
      return;
    }
    const act = b.dataset.act;
    if (act === 'reset-tokens') { draft.tokens = { ...DEFAULT_TOKENS }; save(); toast('رجعت الخطوط والأحجام والجودة للقيم الأصلية — في المسودة', 'ok'); return draw(); }
    if (act === 'reset-all') {
      if (!(await confirmBox('إرجاع الموقع كاملاً لشكله الأصلي للجميع الآن؟ (الأقسام، الأزرار، الخطوط، الألوان، الخلفية، الحركات). النصوص والصور والمنتجات لا تتأثر، وتقدر ترجع للشكل الحالي من «سجل النشر».'))) return;
      busy(b, true);
      try {
        const r = await api.post('/admin/design/reset', {});
        Object.assign(S, { published: r.published, history: r.history }); draft = structuredClone(r.published); draft.tokens = { ...DEFAULT_TOKENS, ...draft.tokens }; cmpId = null;
        ctx.state.settings.site = r.site; ctx.applyTheme(r.site); applyDesign(r.published);
        toast('رجع الموقع لشكله الأصلي ✅ — والشكل السابق محفوظ في السجل', 'ok'); draw();
      } catch (er) { toast(er.message, 'error'); busy(b, false); }
      return;
    }
    if (act === 'reset-sec') { delete selMap()[sec]; save(); return refresh(); }
    if (act === 'publish') {
      busy(b, true);
      try { clearTimeout(saveT); await api.put('/admin/design/draft', { design: draft, favs: [...favs] }); const r = await api.post('/admin/design/publish', {}); Object.assign(S, { published: r.published, history: r.history }); applyDesign(r.published); toast('تم النشر ✅ — التصميم ظاهر للزوار الآن', 'ok'); draw(); }
      catch (er) { toast(er.message, 'error'); busy(b, false); }
    }
    if (act === 'discard') { if (!(await confirmBox('تجاهل كل تغييرات المسودة والرجوع للمنشور؟'))) return; draft = structuredClone(S.published || {}); draft.sections ||= {}; draft.mobile ||= {}; draft.tokens = { ...DEFAULT_TOKENS, ...(draft.tokens || {}) }; save(); draw(); }
    if (act === 'export') {
      const blob = new Blob([JSON.stringify({ app: 'anon-store-design', at: new Date().toISOString(), published: S.published, draft, favs: [...favs] }, null, 2)], { type: 'application/json' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `design-backup-${new Date().toISOString().slice(0, 10)}.json` });
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
  });
  main.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'ds-q') { q = t.value.trim(); const g = $('.ds-grid', main); mount(g, html`${origItem()}${list().map(item)}`); requestAnimationFrame(fit); return; }
    if (t.dataset.tok) { const k = t.dataset.tok; draft.tokens[k] = ['radius', 'scale', 'space', 'glass', 'stroke'].includes(k) ? Number(t.value) : t.value; const lb = t.closest('label')?.querySelector('span b'); if (lb) lb.textContent = k === 'radius' ? `${t.value}px` : `${Math.round(t.value * 100)}%`; save(); }
  });
  main.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.id === 'ds-pack') { packF = t.value; return draw(); }
    if (t.id === 'ds-fav') { favOnly = t.checked; return draw(); }
    if (t.id === 'ds-mob') { draft.mobile_on = t.checked; target = 'desktop'; if (t.checked) device = 'desktop'; save(); return draw(); }
    if (t.id === 'ds-target') { target = t.value; device = target === 'mobile' ? 'mobile' : 'desktop'; return draw(); }
    if (t.id === 'ds-import' && t.files?.[0]) {
      try {
        const j = JSON.parse(await t.files[0].text()), d = j.draft || j.published || j;
        if (!d || typeof d !== 'object' || (!d.sections && !d.tokens)) throw new Error('ملف غير صالح');
        draft = { sections: {}, mobile: {}, ...d, tokens: { ...DEFAULT_TOKENS, ...(d.tokens || {}) } };
        (j.favs || []).forEach((x) => favs.add(x)); save(); draw(); toast('تم استيراد النسخة كمسودة — راجعها ثم انشر', 'ok');
      } catch (er) { toast(er.message || 'ملف غير صالح', 'error'); }
    }
  });
  addEventListener('resize', fit);
  off = () => { removeEventListener('message', onMsg); removeEventListener('resize', fit); };
  draw();
  return off;
}
