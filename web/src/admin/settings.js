// المظهر والإعدادات: الهوية، الألوان، الخطوط، الخلفيات، الشعار والأيقونة، الأقسام، التسجيل والمتجر، الروابط، الدفع، الأسئلة الشائعة
import { html, mount, actions, toast, busy, $, safeUrl } from '../lib/dom.js';
import { api, KINDS } from '../lib/core.js';
import { icon } from '../lib/art.js';
import { uploadImage, IMAGE_ACCEPT } from '../lib/image.js';

export default async function (main, ctx) {
  const st = ctx.state.settings;
  const site = structuredClone(st.site), social = { ...(st.social || {}) }, pay = structuredClone(st.payments || {}), faq = structuredClone(st.faq || []);
  const sw = (name, on, label) => html`<label class="switch"><input type="checkbox" name="${name}" ${on ? 'checked' : ''}> ${label}</label>`;
  const imgField = (key, label) => html`<div class="field"><span>${label}</span><div class="img-pick">${site[key] ? html`<img src="${safeUrl(site[key])}" alt="">` : ''}
    <label class="btn sm">${icon('upload')} رفع<input type="file" accept="${IMAGE_ACCEPT}" data-img="${key}" hidden></label>
    <input class="input ltr grow" name="${key}" value="${site[key] || ''}" placeholder="https://..."></div></div>`;

  function render() {
    mount(main, html`<h2>المظهر والإعدادات</h2>
    <form class="card pad" id="site"><h3>${icon('sliders')} الهوية والمظهر</h3>
      <div class="fgrid"><label class="field"><span>اسم الموقع</span><input class="input" name="name" value="${site.name}" maxlength="80" required></label>
        <label class="field"><span>الاسم بالإنجليزية</span><input class="input ltr" name="name_en" value="${site.name_en || ''}" maxlength="80"></label></div>
      <label class="field"><span>الشعار النصي (Tagline)</span><input class="input" name="tagline" value="${site.tagline || ''}" maxlength="220"></label>
      <label class="field"><span>شريط إعلان أعلى الموقع (اتركه فارغاً لإخفائه)</span><input class="input" name="announcement" value="${site.announcement || ''}" maxlength="300"></label>
      <div class="fgrid"><label class="field"><span>اللون الأساسي</span><input type="color" name="primary" value="${site.colors.primary}"></label><label class="field"><span>اللون الثانوي</span><input type="color" name="accent" value="${site.colors.accent}"></label>
        <label class="field"><span>لون الخلفية</span><input type="color" name="bg" value="${site.colors.bg}"></label>
        <label class="field"><span>الخط</span><select class="select" name="font">${[['Cairo', 'Cairo'], ['Tajawal', 'Tajawal'], ['system', 'خط النظام']].map(([v, t]) => html`<option value="${v}" ${site.font === v ? 'selected' : ''}>${t}</option>`)}</select></label>
        <label class="field"><span>الخلفية</span><select class="select" name="background">${[['network', 'شبكة رقمية متحركة'], ['grid', 'شبكة ثابتة'], ['image', 'صورة'], ['plain', 'سادة']].map(([v, t]) => html`<option value="${v}" ${site.background === v ? 'selected' : ''}>${t}</option>`)}</select></label>
        <label class="field"><span>العملة الافتراضية</span><select class="select" name="currency"><option value="USD" ${site.currency === 'USD' ? 'selected' : ''}>USD</option><option value="IQD" ${site.currency === 'IQD' ? 'selected' : ''}>IQD</option></select></label></div>
      ${imgField('logo_url', 'الشعار (يفضّل PNG شفاف مربع)')}${imgField('favicon_url', 'أيقونة المتصفح (Favicon)')}${imgField('background_url', 'صورة الخلفية (عند اختيار "صورة")')}
      <h3 class="mt">التحكم بالأقسام والتشغيل</h3><div class="row wrap gap">${Object.entries(KINDS).map(([k, v]) => sw('sec_' + k, site.sections?.[k] !== false, v.plural))}</div>
      <div class="row wrap gap">${sw('registration_enabled', site.registration_enabled !== false, 'السماح بتسجيل حسابات جديدة')}${sw('store_enabled', site.store_enabled !== false, 'تفعيل المتجر (الشراء)')}</div>
      <div class="row gap mt"><button class="btn primary">${icon('check')} حفظ المظهر</button><button type="button" class="btn ghost" data-act="preview">معاينة الألوان</button></div></form>

    <form class="card pad mt" id="social"><h3>${icon('chat')} حسابات التواصل</h3><div class="fgrid">
      ${[['tiktok', 'TikTok'], ['telegram', 'Telegram'], ['whatsapp', 'WhatsApp'], ['instagram', 'Instagram'], ['youtube', 'YouTube']].map(([k, t]) => html`<label class="field"><span>${t}</span><input class="input ltr" name="${k}" value="${social[k] || ''}" placeholder="https://"></label>`)}
      </div><button class="btn primary">حفظ الروابط</button></form>

    <form class="card pad mt" id="payments"><h3>${icon('cart')} الدفع</h3>${sw('manual', pay.manual?.enabled !== false, 'الدفع اليدوي (طلب برقم مرجعي + تأكيد من الإدارة)')}
      <label class="field"><span>تعليمات الدفع التي تظهر للمشتري</span><textarea class="input" name="instructions" maxlength="2000">${pay.manual?.instructions || ''}</textarea></label>
      <div class="list">${Object.entries(pay.gateways || {}).map(([k, g]) => html`<div class="li">${icon('lock')}<span class="grow"><b>${g.label || k}</b><span class="muted small">غير مفعّلة — تتطلب حساب تاجر رسمي ومفاتيح API تُضاف كأسرار في الخادم (لن تُفعَّل بوابة غير متاحة فعلياً).</span></span><span class="badge">معطّلة</span></div>`)}</div>
      <button class="btn primary mt">حفظ الدفع</button></form>

    <div class="card pad mt" id="faqbox"><h3>${icon('help')} الأسئلة الشائعة</h3>
      ${faq.map((x, i) => html`<div class="upl"><input class="input mb" data-faq="q" data-i="${i}" value="${x.q}" maxlength="300"><textarea class="input" data-faq="a" data-i="${i}" maxlength="3000">${x.a}</textarea>
        <div class="row end mt"><button class="btn ghost sm" data-act="fup" data-i="${i}" ${i ? '' : 'disabled'}>▲</button><button class="btn ghost sm" data-act="fdel" data-i="${i}">${icon('trash')}</button></div></div>`)}
      <div class="row gap mt"><button class="btn" data-act="fadd">${icon('plus')} سؤال جديد</button><button class="btn primary" data-act="fsave">حفظ الأسئلة</button></div></div>`);
    bind();
  }

  const save = async (key, value, btn) => {
    busy(btn, true);
    try {
      const r = await api.put('/admin/settings/' + key, { value });
      st[key] = r.value;
      if (key === 'site') { ctx.applyTheme(r.value); await ctx.refreshMe(); }
      toast('تم الحفظ ✅ (بعض التغييرات تظهر كاملة بعد إعادة تحميل الصفحة)', 'ok');
    } catch (e) { toast(e.message, 'error'); } finally { busy(btn, false); }
  };
  const readSite = (f) => {
    const d = Object.fromEntries(new FormData(f));
    return { ...site, name: d.name, name_en: d.name_en, tagline: d.tagline, announcement: d.announcement, font: d.font, background: d.background, currency: d.currency,
      colors: { primary: d.primary, accent: d.accent, bg: d.bg }, logo_url: d.logo_url || null, favicon_url: d.favicon_url || null, background_url: d.background_url || null,
      sections: Object.fromEntries(Object.keys(KINDS).map((k) => [k, !!d['sec_' + k]])), registration_enabled: !!d.registration_enabled, store_enabled: !!d.store_enabled };
  };

  function bind() {
    const sf = $('#site', main);
    sf.addEventListener('submit', (e) => { e.preventDefault(); Object.assign(site, readSite(sf)); save('site', site, sf.querySelector('.btn.primary')); });
    main.querySelectorAll('[data-img]').forEach((inp) => inp.addEventListener('change', async () => {
      try { toast('جارٍ رفع الصورة…'); const k = inp.dataset.img, url = await uploadImage(inp.files[0], k === 'favicon_url' ? { max: 256, type: 'image/png' } : { max: k === 'logo_url' ? 1024 : 1920 }); Object.assign(site, readSite(sf), { [inp.dataset.img]: url }); render(); toast('تم الرفع — اضغط حفظ المظهر', 'ok'); } catch (e) { toast(e.message, 'error'); }
    }));
    $('#social', main).addEventListener('submit', (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      const v = Object.fromEntries(Object.entries(d).filter(([, x]) => x.trim()).map(([k, x]) => [k, x.trim()]));
      save('social', v, e.target.querySelector('button'));
    });
    $('#payments', main).addEventListener('submit', (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      save('payments', { manual: { enabled: !!d.manual, instructions: d.instructions }, gateways: Object.fromEntries(Object.keys(pay.gateways || {}).map((k) => [k, { enabled: false }])) }, e.target.querySelector('.btn.primary'));
    });
    main.querySelectorAll('[data-faq]').forEach((el) => el.addEventListener('input', () => { faq[el.dataset.i][el.dataset.faq] = el.value; }));
  }

  actions(main, {
    preview: () => ctx.applyTheme(readSite($('#site', main))),
    fadd: () => { faq.push({ q: '', a: '' }); render(); },
    fdel: (b) => { faq.splice(Number(b.dataset.i), 1); render(); },
    fup: (b) => { const i = Number(b.dataset.i); [faq[i - 1], faq[i]] = [faq[i], faq[i - 1]]; render(); },
    fsave: (b) => save('faq', faq.filter((x) => x.q.trim() && x.a.trim()), b),
  });
  render();
}
