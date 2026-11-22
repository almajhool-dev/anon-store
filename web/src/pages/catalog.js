import { html, mount, actions, debounce, safeUrl } from '../lib/dom.js';
import { getContent } from '../lib/content.js';
import { api, KINDS } from '../lib/core.js';
import { icon, art } from '../lib/art.js';
import { grid, skeleton, errorBox, card, empty } from '../lib/ui.js';
import { reveal } from '../lib/fx.js';

const PAGES = {
  python: { kind: 'python' }, apk: { kind: 'apk' }, courses: { kind: 'course' }, videos: { kind: 'video' }, files: { kind: 'file' },
  free: { filter: 'free', title: 'المنتجات المجانية', desc: 'حمّل مباشرة دون أي دفع.', art: 'free' },
  paid: { filter: 'paid', title: 'المنتجات المدفوعة', desc: 'منتجات احترافية — التحميل بعد تأكيد الشراء من الخادم.', art: 'paid' },
  latest: { sort: 'latest', title: 'أحدث المنتجات', desc: 'آخر ما أُضيف إلى المتجر.', art: 'latest' },
  top: { sort: 'top', title: 'الأكثر تحميلاً', desc: 'المنتجات الأكثر طلباً.', art: 'top' },
  search: { title: 'نتائج البحث', desc: 'ابحث في جميع أقسام المتجر.', art: 'python' },
};

export default async function (view, m, { state, setTitle }) {
  const cfg = PAGES[m[1]];
  const key = cfg.kind || (m[1] === 'search' ? null : m[1]);
  const sc = key ? getContent(state).sections[key] : null;
  const title = sc?.title || cfg.title, desc = sc?.desc || cfg.desc;
  setTitle(title);
  if (cfg.kind && state.settings.site.sections?.[cfg.kind] === false) {
    mount(view, html`<div class="container page">${empty('هذا القسم غير متاح حالياً')}</div>`);
    return;
  }
  const q = new URLSearchParams(location.search);
  const st = { q: q.get('q') || '', filter: cfg.filter || '', sort: cfg.sort || 'latest', kind: cfg.kind || '', offset: 0, items: [], total: 0 };
  mount(view, html`<div class="container page">
    <div class="banner reveal">${sc?.image_url ? html`<img class="art" src="${safeUrl(sc.image_url)}" alt="">` : art(cfg.art || cfg.kind, title)}<div><h1>${title}</h1><p>${desc}</p></div></div>
    <div class="toolbar">
      <input class="input grow" id="q" placeholder="ابحث في ${title}..." value="${st.q}" maxlength="80">
      ${cfg.filter ? '' : html`<div class="chips">${[['', 'الكل'], ['free', 'مجاني'], ['paid', 'مدفوع']].map(([v, t]) => html`<button class="chip${st.filter === v ? ' active' : ''}" data-act="filter" data-v="${v}">${t}</button>`)}</div>`}
      ${cfg.kind ? '' : html`<select class="select" id="kind" aria-label="القسم"><option value="">كل الأقسام</option>${Object.entries(KINDS).map(([kk, v]) => html`<option value="${kk}">${v.plural}</option>`)}</select>`}
      ${cfg.sort ? '' : html`<select class="select" id="sort" aria-label="الترتيب"><option value="latest">الأحدث</option><option value="top">الأكثر تحميلاً</option><option value="views">الأكثر مشاهدة</option><option value="rating">الأعلى تقييماً</option><option value="price_asc">السعر: الأقل</option><option value="price_desc">السعر: الأعلى</option></select>`}
    </div>
    <p class="muted small" id="count"></p><div id="list">${skeleton(8)}</div>
    <div class="center mt"><button class="btn hide" data-act="more" id="more">تحميل المزيد</button></div></div>`);
  const list = view.querySelector('#list'), more = view.querySelector('#more');

  async function load(append = false) {
    if (!append) { st.offset = 0; mount(list, skeleton(8)); }
    const p = new URLSearchParams({ limit: '24', offset: String(st.offset), sort: st.sort });
    if (st.kind) p.set('kind', st.kind);
    if (st.filter) p.set('filter', st.filter);
    if (st.q) p.set('q', st.q);
    try {
      const r = await api.get('/products?' + p);
      st.items = append ? st.items.concat(r.items) : r.items;
      st.total = r.total;
      if (append) list.querySelector('.grid')?.insertAdjacentHTML('beforeend', r.items.map(card).join(''));
      else mount(list, grid(st.items, st.q ? 'لا توجد نتائج مطابقة لبحثك' : undefined));
      view.querySelector('#count').textContent = st.total ? `${st.total} منتج` : '';
      more.classList.toggle('hide', st.items.length >= st.total);
      reveal(list);
    } catch (e) { mount(list, errorBox(e)); }
  }
  actions(view, {
    filter: (b) => { st.filter = b.dataset.v; view.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === b)); load(); },
    more: () => { st.offset = st.items.length; load(true); },
    reload: () => load(),
  });
  view.querySelector('#q').addEventListener('input', debounce((e) => {
    st.q = e.target.value.trim();
    if (m[1] === 'search') history.replaceState(null, '', '/search?q=' + encodeURIComponent(st.q));
    load();
  }, 400));
  view.querySelector('#kind')?.addEventListener('change', (e) => { st.kind = e.target.value; load(); });
  view.querySelector('#sort')?.addEventListener('change', (e) => { st.sort = e.target.value; load(); });
  load();
}
