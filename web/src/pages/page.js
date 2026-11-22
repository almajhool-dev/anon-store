// الصفحات المخصصة التي ينشئها المدير (من نحن، الشروط، الخصوصية ...)
import { html, mount } from '../lib/dom.js';
import { icon } from '../lib/art.js';
import { richText } from '../lib/ui.js';

export default function (view, m, { state, setTitle }) {
  const p = (state.settings.pages || []).find((x) => x.slug === m[1]);
  if (!p) {
    setTitle('الصفحة غير موجودة');
    mount(view, html`<div class="container notfound"><div class="code gradient-text ltr">404</div><h2>الصفحة غير موجودة</h2><a class="btn primary" href="/">العودة للرئيسية</a></div>`);
    return;
  }
  if (p.url) { location.href = p.url; return; }
  setTitle(p.title);
  mount(view, html`<div class="container page"><h1>${p.title}</h1><div class="card pad prose reveal">${p.body ? richText(p.body) : html`<p class="muted">${icon('edit')} لا يوجد محتوى بعد.</p>`}</div></div>`);
}
