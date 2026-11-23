// محرر محتوى الموقع: الواجهة الرئيسية، البنرات، الأقسام وصورها، المميزات، التواصل والفوتر، أيقونة الهاتف وصورة المشاركة، والصفحات والروابط
import { html, mount, actions, toast, busy, $, safeUrl, confirmBox } from '../lib/dom.js';
import { api, slugify } from '../lib/core.js';
import { icon } from '../lib/art.js';
import { getContent, SECTIONS, BRAND } from '../lib/content.js';
import { uploadImage, uploadVideo, insertAtCursor, IMAGE_ACCEPT, VIDEO_ACCEPT } from '../lib/image.js';
import { showIntro } from '../lib/intro.js';

const ICONS = ['shield', 'lock', 'play', 'cart', 'bolt', 'star', 'heart', 'gift', 'gem', 'code', 'terminal', 'phone', 'cap', 'folder', 'download', 'upload', 'chat', 'send', 'mail', 'eye', 'check', 'clock', 'chart', 'key', 'help', 'grid', 'trend', 'user', 'bell', 'music', 'list', 'disk'];
const ICON_AR = { shield: 'درع', lock: 'قفل', play: 'تشغيل', cart: 'سلة', bolt: 'برق', star: 'نجمة', heart: 'قلب', gift: 'هدية', gem: 'جوهرة', code: 'كود', terminal: 'طرفية', phone: 'هاتف', cap: 'قبعة تخرج', folder: 'مجلد', download: 'تنزيل', upload: 'رفع', chat: 'دردشة', send: 'إرسال', mail: 'بريد', eye: 'عين', check: 'علامة صح', clock: 'ساعة', chart: 'رسم بياني', key: 'مفتاح', help: 'مساعدة', grid: 'شبكة', trend: 'صعود', user: 'مستخدم', bell: 'جرس', music: 'موسيقى', list: 'قائمة', disk: 'قرص' };
const ANIMS = [['none', 'ثابتة'], ['pulse', 'نبض'], ['float', 'طفو'], ['bounce', 'قفز'], ['spin', 'دوران'], ['glow', 'توهج'], ['swing', 'تأرجح']];
const iconOpts = (cur, def) => html`${def ? html`<option value="">افتراضية</option>` : ''}${ICONS.map((n) => html`<option value="${n}" ${cur === n ? 'selected' : ''}>${ICON_AR[n] || n}</option>`)}`;
const animOpts = (cur) => ANIMS.map(([v, t]) => html`<option value="${v}" ${(cur || 'none') === v ? 'selected' : ''}>${t}</option>`);

// صورة مشاركة الرابط تُصنع تلقائياً من الشعار واسم الموقع وألوانه (1200×630)
async function shareCard(file, site) {
  const bmp = await createImageBitmap(file), W = 1200, H = 630, col = site.colors || {};
  const cv = Object.assign(document.createElement('canvas'), { width: W, height: H }), g = cv.getContext('2d');
  g.fillStyle = col.bg || '#05060b'; g.fillRect(0, 0, W, H);
  for (const [x, y, cc] of [[960, 110, col.accent || '#8b5cf6'], [160, 560, col.primary || '#18b4ff']]) {
    const gr = g.createRadialGradient(x, y, 0, x, y, 560); gr.addColorStop(0, cc + '55'); gr.addColorStop(1, cc + '00'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  const k = Math.min(360 / bmp.width, 360 / bmp.height), w = bmp.width * k, h = bmp.height * k;
  g.drawImage(bmp, W - 100 - w, (H - h) / 2, w, h); bmp.close?.();
  const font = getComputedStyle(document.body).fontFamily, x = W - 160 - w, max = x - 70;
  g.textAlign = 'right'; g.direction = 'rtl'; g.fillStyle = col.text || '#ffffff';
  g.font = `800 62px ${font}`; g.fillText(site.name || '', x, H / 2 - 8, max);
  g.font = `400 30px ${font}`; g.globalAlpha = 0.75; g.fillText(site.name_en || location.host, x, H / 2 + 46, max);
  const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.9));
  return new File([blob], 'share.jpg', { type: 'image/jpeg' });
}
const SHOW = { banners: 'البنرات الإعلانية', sections: 'بطاقات الأقسام', latest: 'أحدث المنتجات', top: 'الأكثر تحميلاً', features: 'المميزات', contact: 'قسم التواصل' };
const get = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
function set(o, p, v) { const ks = p.split('.'), last = ks.pop(); const t = ks.reduce((a, k) => (a[k] ??= {}), o); t[last] = v; }

const field = (label, path, val, { area = false, max = 300, ltr = false, ph = '' } = {}) => html`<label class="field"><span>${label}</span>${area
  ? html`<textarea class="input" data-path="${path}" maxlength="${max}" placeholder="${ph}">${val ?? ''}</textarea>`
  : html`<input class="input${ltr ? ' ltr' : ''}" data-path="${path}" maxlength="${max}" value="${val ?? ''}" placeholder="${ph}">`}</label>`;
const imgField = (label, path, url, hint = '') => html`<div class="field"><span>${label}</span><div class="img-pick">${url ? html`<img src="${safeUrl(url)}" alt="">` : html`<span class="muted small">لا توجد صورة${hint ? ' — ' + hint : ''}</span>`}
  <label class="btn sm">${icon('upload')} ${url ? 'تغيير' : 'رفع من الجهاز'}<input type="file" accept="${IMAGE_ACCEPT}" data-img="${path}" hidden></label>${url ? html`<button type="button" class="btn ghost sm" data-act="imgdel" data-path="${path}">${icon('trash')} إزالة</button>` : ''}</div></div>`;
const listBtns = (list, i, n) => html`<div class="row end"><button type="button" class="btn ghost sm" data-act="up" data-list="${list}" data-i="${i}" ${i ? '' : 'disabled'}>▲</button>
  <button type="button" class="btn ghost sm" data-act="down" data-list="${list}" data-i="${i}" ${i < n - 1 ? '' : 'disabled'}>▼</button><button type="button" class="btn ghost sm" data-act="del" data-list="${list}" data-i="${i}">${icon('trash')}</button></div>`;

function contentEditor(main, ctx) {
  const st = ctx.state.settings;
  const c = structuredClone(getContent(ctx.state));
  let v = Date.now();
  const draw = () => {
    const h = c.hero, site = ctx.state.settings.site || {};
    mount(main, html`<h2>محتوى الموقع</h2><p class="muted small">كل نص وصورة في الصفحة الرئيسية والأقسام قابلة للتعديل. الصور تُرفع من الهاتف مباشرة وتُصغَّر تلقائياً. لا تنسَ الضغط على «حفظ» بالأسفل.</p>
    <div class="card pad"><h3>${icon('star')} هوية الموقع: الاسم والشعار</h3>
      <div class="fgrid"><label class="field"><span>اسم الموقع</span><input class="input" id="id-name" maxlength="80" value="${site.name || ''}"></label><label class="field"><span>الاسم بالإنجليزي</span><input class="input ltr" id="id-name-en" maxlength="80" value="${site.name_en || ''}"></label></div>
      <label class="field"><span>الوصف المختصر</span><input class="input" id="id-tagline" maxlength="220" value="${site.tagline || ''}"></label>
      <button type="button" class="btn sm" data-act="identity">${icon('check')} حفظ الاسم والوصف</button>
      <div class="field mt"><span>شعار الموقع — يظهر أعلى الموقع وفي الواجهة الرئيسية</span><div class="img-pick">${site.logo_url ? html`<img src="${safeUrl(site.logo_url)}" alt="" class="sq">` : html`<span class="muted small">الشعار الافتراضي</span>`}
        <label class="btn primary sm">${icon('upload')} تغيير الشعار<input type="file" accept="${IMAGE_ACCEPT}" data-logo hidden></label></div></div>
      <label class="switch"><input type="checkbox" id="logo-all" checked> استخدم نفس الشعار لأيقونة المتصفح وأيقونة الهاتف وصورة مشاركة الرابط</label>
      <details class="mt"><summary>أيقونة الهاتف وصورة المشاركة بشكل منفصل</summary>
      <div class="field"><span>أيقونة الموقع على شاشة الهاتف (تُقص مربعة تلقائياً)</span><div class="img-pick"><img src="${BRAND.appIcon}?v=${v}" alt="" class="sq"><label class="btn sm">${icon('upload')} تغيير الأيقونة<input type="file" accept="${IMAGE_ACCEPT}" data-brand="app_icon" hidden></label></div></div>
      <div class="field"><span>صورة المشاركة (تظهر عند إرسال رابط الموقع في واتساب وتيليجرام — يفضّل 1200×630)</span><div class="img-pick"><img src="${BRAND.share}?v=${v}" alt=""><label class="btn sm">${icon('upload')} تغيير الصورة<input type="file" accept="${IMAGE_ACCEPT}" data-brand="share" hidden></label></div></div>
      <p class="muted small">واتساب يحتفظ بمعاينة الرابط القديمة لبعض الوقت، والمشاركات الجديدة تظهر بالصورة الجديدة.</p></details>
      <p class="muted small">الألوان والثيمات والخطوط والخلفيات والحركات في تبويب <a href="/admin/settings">«المظهر والإعدادات»</a>.</p></div>

    <div class="card pad mt"><h3>${icon('play')} شاشة الدخول المتحركة</h3>
      <label class="switch"><input type="checkbox" data-path="intro.enabled" ${c.intro.enabled ? 'checked' : ''}> تفعيل شاشة دخول متحركة عند فتح الموقع</label>
      <div class="field"><span>صورة أو GIF متحرك أو فيديو قصير MP4 (اتركه فارغاً ليظهر شعارك بحركة تلقائية)</span><div class="img-pick">${c.intro.media_url ? (c.intro.media_type === 'video' ? html`<video src="${safeUrl(c.intro.media_url)}" muted loop autoplay playsinline></video>` : html`<img src="${safeUrl(c.intro.media_url)}" alt="">`) : html`<span class="muted small">الشعار المتحرك</span>`}
        <label class="btn sm">${icon('upload')} صورة/GIF<input type="file" accept="${IMAGE_ACCEPT}" data-img="intro.media_url" hidden></label>
        <label class="btn sm">${icon('play')} فيديو<input type="file" accept="${VIDEO_ACCEPT}" data-vid="intro.media_url" hidden></label>
        ${c.intro.media_url ? html`<button type="button" class="btn ghost sm" data-act="imgdel" data-path="intro.media_url">${icon('trash')} إزالة</button>` : ''}</div></div>
      <div class="fgrid">${field('نص يظهر مع الحركة', 'intro.text', c.intro.text, { max: 80, ph: 'أهلاً بك في متجر المبرمج المجهول' })}
        <label class="field"><span>مدة الظهور</span><select class="select" data-path="intro.duration">${[2, 3, 4, 5, 6].map((n) => html`<option value="${n}" ${Number(c.intro.duration) === n ? 'selected' : ''}>${n} ثوانٍ</option>`)}</select></label></div>
      <div class="row wrap gap"><label class="switch"><input type="checkbox" data-path="intro.every_visit" ${c.intro.every_visit ? 'checked' : ''}> تظهر في كل مرة يفتح فيها الزائر الموقع</label>
        <button type="button" class="btn ghost sm" data-act="intro">${icon('eye')} معاينة</button></div></div>

    <div class="card pad mt"><div class="row between wrap"><h3>${icon('star')} البنرات الإعلانية (أعلى الصفحة الرئيسية — تتحرك تلقائياً إذا أكثر من واحد)</h3><button type="button" class="btn sm" data-act="add" data-list="banners">${icon('plus')} بنر جديد</button></div>
      ${c.banners.length ? c.banners.map((b, i) => html`<div class="upl">${imgField('صورة البنر', `banners.${i}.image_url`, b.image_url)}
        <div class="fgrid">${field('العنوان', `banners.${i}.title`, b.title, { max: 120 })}${field('نص الزر', `banners.${i}.button`, b.button, { max: 40, ph: 'اكتشف الآن' })}</div>
        ${field('النص', `banners.${i}.text`, b.text, { area: true })}${field('الرابط (صفحة داخلية مثل /p/اسم-المنتج أو رابط https)', `banners.${i}.link`, b.link, { ltr: true })}${listBtns('banners', i, c.banners.length)}</div>`)
      : html`<p class="muted small">لا توجد بنرات — أضف بنراً لعرض عرض أو كورس جديد.</p>`}</div>

    <div class="card pad mt"><h3>${icon('home')} الواجهة الرئيسية</h3>
      ${field('الشارة الصغيرة', 'hero.badge', h.badge, { max: 60 })}<div class="fgrid">${field('العنوان', 'hero.title', h.title, { max: 120 })}${field('الجزء الملوّن من العنوان', 'hero.highlight', h.highlight, { max: 120 })}</div>
      ${field('الوصف (يُستخدم الشعار النصي إن تُرك فارغاً)', 'hero.subtitle', h.subtitle, { area: true })}
      <div class="fgrid">${field('نص الزر الأول', 'hero.cta1_text', h.cta1_text, { max: 40 })}${field('رابط الزر الأول', 'hero.cta1_link', h.cta1_link, { ltr: true })}${field('نص الزر الثاني', 'hero.cta2_text', h.cta2_text, { max: 40 })}${field('رابط الزر الثاني', 'hero.cta2_link', h.cta2_link, { ltr: true })}</div>
      ${imgField('الصورة الكبيرة بجانب العنوان', 'hero.image_url', h.image_url, 'يظهر شعار الموقع')}
      <label class="switch"><input type="checkbox" data-path="hero.show_terminal" ${h.show_terminal ? 'checked' : ''}> إظهار نافذة الأوامر المتحركة</label>
      <label class="field"><span>أسطر نافذة الأوامر (سطر لكل جملة)</span><textarea class="input ltr" data-path="hero.terminal" rows="6">${(h.terminal || []).join('\n')}</textarea></label></div>

    <div class="card pad mt"><h3>${icon('grid')} الأقسام: الأسماء والأوصاف والصور</h3>${Object.keys(SECTIONS).map((k) => html`<div class="upl"><b>${SECTIONS[k].nav}</b>
      <div class="fgrid">${field('الاسم في القائمة', `sections.${k}.nav`, c.sections[k].nav, { max: 30 })}${field('العنوان', `sections.${k}.title`, c.sections[k].title, { max: 60 })}</div>
      ${field('الوصف', `sections.${k}.desc`, c.sections[k].desc, { max: 200 })}<div class="fgrid"><label class="field"><span>أيقونة القائمة</span><select class="select" data-path="sections.${k}.icon">${iconOpts(c.sections[k].icon, true)}</select></label><label class="field"><span>حركة الصورة</span><select class="select" data-path="sections.${k}.anim">${animOpts(c.sections[k].anim)}</select></label></div>${imgField('صورة القسم (مصغّرة)', `sections.${k}.image_url`, c.sections[k].image_url, 'تُستخدم الرسمة الافتراضية')}</div>`)}</div>

    <div class="card pad mt"><div class="row between wrap"><h3>${icon('check')} المميزات</h3><button type="button" class="btn sm" data-act="add" data-list="features" ${c.features.length >= 8 ? 'disabled' : ''}>${icon('plus')} ميزة</button></div>
      ${c.features.map((f, i) => html`<div class="upl"><div class="fgrid"><label class="field"><span>الأيقونة</span><select class="select" data-path="features.${i}.icon">${iconOpts(f.icon)}</select></label><label class="field"><span>الحركة</span><select class="select" data-path="features.${i}.anim">${animOpts(f.anim)}</select></label>
        ${field('العنوان', `features.${i}.title`, f.title, { max: 60 })}</div>${field('النص', `features.${i}.text`, f.text, { max: 200 })}${imgField('أو صورة/GIF متحرك كأيقونة (اختياري)', `features.${i}.image_url`, f.image_url)}${listBtns('features', i, c.features.length)}</div>`)}</div>

    <div class="card pad mt"><h3>${icon('eye')} إظهار وإخفاء أجزاء الصفحة الرئيسية</h3><div class="row wrap gap">${Object.entries(SHOW).map(([k, t]) => html`<label class="switch"><input type="checkbox" data-path="show.${k}" ${c.show[k] ? 'checked' : ''}> ${t}</label>`)}</div></div>

    <div class="card pad mt"><h3>${icon('chat')} قسم التواصل والفوتر</h3><div class="fgrid">${field('عنوان قسم التواصل', 'contact.title', c.contact.title, { max: 80 })}${field('نص قسم التواصل', 'contact.text', c.contact.text)}</div>
      ${field('نبذة في الفوتر', 'footer.about', c.footer.about, { area: true, max: 400 })}${field('نص حقوق النشر', 'footer.text', c.footer.text, { max: 200 })}</div>
    <div class="savebar"><button class="btn primary lg block" data-act="save">${icon('check')} حفظ كل التغييرات</button></div>`);
  };

  main.addEventListener('input', (e) => {
    const p = e.target.dataset.path;
    if (!p) return;
    set(c, p, e.target.type === 'checkbox' ? e.target.checked : p === 'hero.terminal' ? e.target.value.split('\n').map((x) => x.trimEnd().slice(0, 90)).filter(Boolean).slice(0, 8) : p === 'intro.duration' ? Number(e.target.value) : e.target.value);
  });
  main.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.dataset.path && t.type === 'checkbox') set(c, t.dataset.path, t.checked);
    if (!t.files?.length) return;
    try {
      toast('جارٍ رفع الصورة…');
      if ('logo' in t.dataset) {
        // شعار واحد يغيّر كل شيء: أعلى الموقع، الواجهة، أيقونة المتصفح، أيقونة الهاتف، وصورة المشاركة
        const f = t.files[0], all = $('#logo-all', main)?.checked;
        const s = { ...ctx.state.settings.site, logo_url: await uploadImage(f, { max: 1024 }) };
        if (all) {
          s.favicon_url = await uploadImage(f, { max: 256, type: 'image/png' });
          await uploadImage(f, { purpose: 'app_icon' });
          await uploadImage(await shareCard(f, s), { purpose: 'share' });
          v = Date.now();
        }
        const r = await api.put('/admin/settings/site', { value: s });
        ctx.state.settings.site = r.value; ctx.applyTheme?.(r.value); ctx.renderHeader?.();
        toast('تم تغيير الشعار ✅ — ظاهر الآن في الموقع للجميع', 'ok');
      } else if (t.dataset.brand) { await uploadImage(t.files[0], { purpose: t.dataset.brand }); v = Date.now(); toast('تم تحديث الصورة ✅', 'ok'); }
      else if (t.dataset.vid) { set(c, t.dataset.vid, await uploadVideo(t.files[0])); if (t.dataset.vid === 'intro.media_url') c.intro.media_type = 'video'; toast('تم رفع الفيديو — اضغط «حفظ كل التغييرات»', 'ok'); }
      else { set(c, t.dataset.img, await uploadImage(t.files[0])); if (t.dataset.img === 'intro.media_url') c.intro.media_type = 'image'; toast('تم الرفع — اضغط «حفظ كل التغييرات»', 'ok'); }
      draw();
    } catch (er) { toast(er.message, 'error'); }
  });
  actions(main, {
    intro: () => showIntro(c.intro, ctx.state.settings.site, { force: true }),
    identity: async (b) => {
      busy(b, true);
      try {
        const s = { ...ctx.state.settings.site, name: $('#id-name', main).value.trim(), name_en: $('#id-name-en', main).value.trim(), tagline: $('#id-tagline', main).value.trim() };
        const r = await api.put('/admin/settings/site', { value: s });
        ctx.state.settings.site = r.value; ctx.renderHeader?.();
        toast('تم حفظ الاسم ✅ — ظاهر للزوار الآن', 'ok');
      } catch (er) { toast(er.message, 'error'); } finally { busy(b, false); }
    },
    imgdel: (b) => { set(c, b.dataset.path, null); draw(); },
    add: (b) => { c[b.dataset.list].push(b.dataset.list === 'banners' ? { image_url: null, title: 'عنوان البنر', text: '', button: '', link: '' } : { icon: 'star', title: 'ميزة جديدة', text: '' }); draw(); },
    del: async (b) => { if (await confirmBox('حذف هذا العنصر؟', { danger: true, ok: 'حذف' })) { c[b.dataset.list].splice(Number(b.dataset.i), 1); draw(); } },
    up: (b) => { const a = c[b.dataset.list], i = Number(b.dataset.i); [a[i - 1], a[i]] = [a[i], a[i - 1]]; draw(); },
    down: (b) => { const a = c[b.dataset.list], i = Number(b.dataset.i); [a[i + 1], a[i]] = [a[i], a[i + 1]]; draw(); },
    save: async (b) => {
      busy(b, true);
      try { const r = await api.put('/admin/settings/content', { value: c }); st.content = r.value; await ctx.refreshMe(); toast('تم الحفظ ✅ — التغييرات ظاهرة الآن للزوار', 'ok'); }
      catch (er) { toast(er.message, 'error'); } finally { busy(b, false); }
    },
  });
  draw();
}

function pagesEditor(main, ctx) {
  const st = ctx.state.settings;
  const pages = structuredClone(st.pages || []);
  const draw = () => mount(main, html`<h2>الصفحات والروابط</h2><p class="muted small">أنشئ صفحات مثل «من نحن» و«الشروط» و«سياسة الخصوصية»، أو أضف روابط لأي مكان، واختر ظهورها في القائمة العلوية أو الفوتر.</p>
    ${pages.map((p, i) => html`<div class="card pad mt"><div class="fgrid">${field('العنوان', `${i}.title`, p.title, { max: 80 })}${field('الرابط المختصر (إنجليزي)', `${i}.slug`, p.slug, { max: 40, ltr: true })}</div>
      ${field('رابط بدل المحتوى (اختياري — اتركه فارغاً لصفحة نصية)', `${i}.url`, p.url, { ltr: true, ph: 'https://... أو /courses' })}
      ${p.url ? '' : field('محتوى الصفحة (يدعم ## عنوان، - نقطة، **غامق**، روابط https، وصور/GIF بزر الإدراج)', `${i}.body`, p.body, { area: true, max: 20000 })}${p.url ? '' : html`<label class="btn ghost sm">${icon('upload')} إدراج صورة أو GIF<input type="file" accept="${IMAGE_ACCEPT}" data-ins="${i}" hidden></label>`}
      <div class="row wrap gap"><label class="switch"><input type="checkbox" data-path="${i}.in_nav" ${p.in_nav ? 'checked' : ''}> في القائمة العلوية</label><label class="switch"><input type="checkbox" data-path="${i}.in_footer" ${p.in_footer !== false ? 'checked' : ''}> في الفوتر</label>
      ${p.url ? '' : html`<a class="btn ghost sm" href="/page/${p.slug}" target="_blank" rel="noopener">${icon('eye')} معاينة</a>`}</div>${listBtns('pages', i, pages.length)}</div>`)}
    <div class="row gap mt"><button class="btn" data-act="add">${icon('plus')} صفحة أو رابط جديد</button></div>
    <div class="savebar"><button class="btn primary lg block" data-act="save">${icon('check')} حفظ الصفحات</button></div>`);
  main.addEventListener('input', (e) => {
    const p = e.target.dataset.path;
    if (!p) return;
    const [i, k] = p.split('.');
    pages[i][k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (k === 'title' && !pages[i]._slugTouched && !pages[i]._saved) { const sl = slugify(e.target.value).slice(0, 40); if (/^[a-z0-9-]{2,40}$/.test(sl)) pages[i].slug = sl; const s = main.querySelector(`[data-path="${i}.slug"]`); if (s) s.value = pages[i].slug; }
    if (k === 'slug') pages[i]._slugTouched = true;
  });
  main.addEventListener('change', (e) => { const p = e.target.dataset.path; if (p && e.target.type === 'checkbox') { const [i, k] = p.split('.'); pages[i][k] = e.target.checked; } });
  main.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.dataset.ins == null || !t.files?.length) return;
    try { toast('جارٍ رفع الصورة…'); const url = await uploadImage(t.files[0]); const ta = main.querySelector(`[data-path="${t.dataset.ins}.body"]`); if (ta) insertAtCursor(ta, `\n![](${url})\n`); toast('تمت إضافة الصورة — اضغط «حفظ الصفحات»', 'ok'); } catch (er) { toast(er.message, 'error'); }
    t.value = '';
  });
  actions(main, {
    add: () => { pages.push({ title: 'صفحة جديدة', slug: 'page-' + Math.random().toString(36).slice(2, 6), body: '', url: '', in_nav: false, in_footer: true }); draw(); },
    del: async (b) => { if (await confirmBox('حذف هذه الصفحة؟', { danger: true, ok: 'حذف' })) { pages.splice(Number(b.dataset.i), 1); draw(); } },
    up: (b) => { const i = Number(b.dataset.i); [pages[i - 1], pages[i]] = [pages[i], pages[i - 1]]; draw(); },
    down: (b) => { const i = Number(b.dataset.i); [pages[i + 1], pages[i]] = [pages[i], pages[i + 1]]; draw(); },
    save: async (b) => {
      busy(b, true);
      try {
        const used = new Set();
        const value = pages.map(({ _slugTouched, _saved, ...p }) => {
          let s = String(p.slug || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
          if (s.length < 2) s = 'page-' + Math.random().toString(36).slice(2, 6);
          while (used.has(s)) s = s.slice(0, 34) + '-' + Math.random().toString(36).slice(2, 5);
          used.add(s);
          return { ...p, slug: s, title: (p.title || '').trim() || 'صفحة', url: (p.url || '').trim() || null };
        });
        const r = await api.put('/admin/settings/pages', { value });
        st.pages = r.value; pages.forEach((p) => { p._saved = true; });
        await ctx.refreshMe();
        toast('تم حفظ الصفحات ✅ (الفوتر يتحدث بعد إعادة تحميل الصفحة)', 'ok');
      } catch (er) { toast(er.message, 'error'); } finally { busy(b, false); }
    },
  });
  pages.forEach((p) => { p._saved = true; });
  draw();
}

export default (main, ctx, mode) => (mode === 'pages' ? pagesEditor(main, ctx) : contentEditor(main, ctx));
