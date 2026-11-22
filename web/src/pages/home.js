import { html, raw, mount, actions, safeUrl } from '../lib/dom.js';
import { api, KINDS } from '../lib/core.js';
import { icon, art, LOGO } from '../lib/art.js';
import { grid, skeleton, errorBox } from '../lib/ui.js';
import { reveal } from '../lib/fx.js';
import { socialLinks } from '../main.js';

const LINES = ['$ anon-store --status', '[✓] تحميل آمن عبر روابط موقّعة ومؤقتة', '[✓] ملفات وفيديوهات بجودتها الأصلية', '[✓] رفع ملفات ضخمة قابل للاستكمال', '[✓] حماية ومراقبة أمنية مستمرة', '$ welcome --user guest'];

export default async function (view, _m, { state, setTitle }) {
  setTitle('');
  const s = state.settings.site, sec = s.sections || {};
  const cats = [...Object.entries(KINDS).filter(([k]) => sec[k] !== false).map(([k, v]) => [v.path, k, v.plural, v.desc]),
    ['/free', 'free', 'المنتجات المجانية', 'حمّل مباشرة دون أي دفع'], ['/paid', 'paid', 'المنتجات المدفوعة', 'أدوات وكورسات احترافية مميزة'],
    ['/latest', 'latest', 'أحدث المنتجات', 'آخر ما أُضيف للمتجر'], ['/top', 'top', 'الأكثر تحميلاً', 'الأكثر طلباً من المستخدمين']];
  mount(view, html`
  <section class="container hero">
    <div class="reveal">
      <span class="pill"><i></i> متجر المبرمج المجهول</span>
      <h1>أدوات وتطبيقات وكورسات <span class="gradient-text">للمبرمجين وعشاق الأمن السيبراني</span></h1>
      <p class="lead">${s.tagline}</p>
      <div class="row wrap gap mt"><a class="btn primary lg" href="/latest">${icon('grid')} تصفّح المتجر</a><a class="btn lg" href="/free">${icon('gift')} المنتجات المجانية</a></div>
    </div>
    <div class="reveal"><div class="hero-logo">${s.logo_url ? html`<img src="${safeUrl(s.logo_url)}" alt="">` : raw(LOGO)}</div>
      <div class="card terminal glow"><header><i></i><i></i><i></i></header><pre id="term"></pre></div></div>
  </section>
  <section class="container section"><div class="section-head"><div><h2>الأقسام</h2><p class="muted">كل ما تحتاجه في مكان واحد</p></div></div>
    <div class="cats">${cats.map(([h, k, t, d]) => html`<a class="card cat reveal" href="${h}">${art(k, t)}<div><b>${t}</b><span>${d}</span></div></a>`)}</div></section>
  <section class="container section"><div class="section-head"><div><h2>${icon('bolt')} أحدث المنتجات</h2></div><a class="btn ghost sm" href="/latest">عرض الكل ${icon('next')}</a></div><div id="latest">${skeleton(4)}</div></section>
  <section class="container section"><div class="section-head"><div><h2>${icon('trend')} الأكثر تحميلاً</h2></div><a class="btn ghost sm" href="/top">عرض الكل ${icon('next')}</a></div><div id="top">${skeleton(4)}</div></section>
  <section class="container section"><div class="features">
    ${[['shield', 'حماية متعددة الطبقات', 'صلاحيات محمية من الخادم وقاعدة البيانات، ومراقبة لمحاولات الاختراق.'], ['lock', 'روابط تحميل موقّعة', 'كل رابط مؤقت ويصدر بعد التحقق من صلاحيتك فقط.'],
      ['play', 'جودة أصلية', 'لا ضغط للفيديوهات أو الملفات — تحصل على النسخة الأصلية.'], ['cart', 'دفع محلي في العراق', 'طلب برقم مرجعي وتأكيد سريع عبر واتساب أو تيليجرام.']]
      .map(([i, t, d]) => html`<div class="card feature reveal">${icon(i)}<b>${t}</b><p>${d}</p></div>`)}</div></section>
  <section class="container section"><div class="card pad glow reveal center"><h2>تواصل مع <span class="gradient-text">المبرمج المجهول</span></h2><p class="muted">للدعم والاستفسارات وطلبات الشراء</p>
    <div class="row wrap center gap mt">${socialLinks(state.settings.social || {}).slice(0, 3).map(([u, i, t]) => html`<a class="btn" href="${u}" target="_blank" rel="noopener">${icon(i)} ${t}</a>`)}<a class="btn primary" href="/contact">${icon('mail')} نموذج الدعم</a></div></div></section>`);

  const pre = view.querySelector('#term');
  let li = 0, ci = 0, alive = true;
  const type = () => {
    if (!alive || !pre.isConnected) return;
    if (li >= LINES.length) { pre.innerHTML = ''; pre.append(LINES.join('\n')); pre.insertAdjacentHTML('beforeend', '<span class="cursor"></span>'); return; }
    ci++;
    pre.textContent = LINES.slice(0, li).join('\n') + (li ? '\n' : '') + LINES[li].slice(0, ci);
    pre.insertAdjacentHTML('beforeend', '<span class="cursor"></span>');
    if (ci >= LINES[li].length) { li++; ci = 0; setTimeout(type, 380); } else setTimeout(type, 22);
  };
  type();

  const load = async (id, q) => {
    const box = view.querySelector('#' + id);
    try { const r = await api.get('/products?limit=8&' + q); mount(box, grid(r.items)); reveal(box); } catch (e) { mount(box, errorBox(e)); }
  };
  actions(view, { reload: () => { load('latest', 'sort=latest'); load('top', 'sort=top'); } });
  load('latest', 'sort=latest');
  load('top', 'sort=top');
  return () => { alive = false; };
}
