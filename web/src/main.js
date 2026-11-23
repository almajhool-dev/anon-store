// الإقلاع: الإعدادات + الجلسة + القالب العام + الموجّه
import '@fontsource-variable/cairo';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/700.css';
import './styles.css';
import { html, mount, $, $$, toast, safeUrl } from './lib/dom.js';
import { api, auth, KINDS } from './lib/core.js';
import { icon, logo } from './lib/art.js';
import { startFx, setFxTheme, reveal, autoReveal } from './lib/fx.js';
import { getContent, SECTIONS } from './lib/content.js';
import { showIntro } from './lib/intro.js';
import { auto3d } from './lib/spin3d.js';
import { play } from './lib/transitions.js';

export const state = { settings: null, me: null, unread: 0 };
const DEFAULT_SITE = { name: 'متجر المبرمج المجهول', name_en: 'Anonymous Programmer Store', tagline: '', colors: { primary: '#18b4ff', accent: '#8b5cf6', bg: '#05060b' }, sections: {}, registration_enabled: true, store_enabled: true, currency: 'USD' };

const ROUTES = [
  [/^\/$/, () => import('./pages/home.js')],
  [/^\/(python|apk|courses|videos|files|free|paid|latest|top|search)$/, () => import('./pages/catalog.js')],
  [/^\/p\/([a-z0-9-]+)$/, () => import('./pages/product.js')],
  [/^\/learn\/([a-z0-9-]+)$/, () => import('./pages/learn.js')],
  [/^\/account$/, () => import('./pages/account.js')],
  [/^\/(login|signup|forgot)$/, () => import('./pages/auth.js')],
  [/^\/(contact|faq|claim)$/, () => import('./pages/info.js')],
  [/^\/page\/([a-z0-9-]+)$/, () => import('./pages/page.js')],
  [/^\/admin(?:\/([a-z]+))?$/, () => import('./admin/admin.js')],
];

// فيديو خلفية متحرك (يُتجاوز عند تفعيل "تقليل الحركة" أو "توفير البيانات" في الهاتف)
function bgVideo(src) {
  let v = document.getElementById('bgv');
  if (!src || matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData) { v?.remove(); return; }
  if (!v) {
    v = document.createElement('video');
    v.id = 'bgv'; v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
    document.body.prepend(v);
  }
  const u = safeUrl(src);
  if (v.getAttribute('src') !== u) v.setAttribute('src', u);
  v.play?.().catch(() => {});
}

export function applyTheme(site) {
  const s = document.documentElement.style, c = site.colors || {};
  s.setProperty('--primary', c.primary || '#18b4ff');
  s.setProperty('--accent', c.accent || '#8b5cf6');
  s.setProperty('--bg', c.bg || '#05060b');
  if (c.text && c.text !== '#e8ebf7') { s.setProperty('--text', c.text); s.setProperty('--muted', `color-mix(in srgb, ${c.text} 62%, ${c.bg || '#05060b'})`); } else { s.removeProperty('--text'); s.removeProperty('--muted'); }
  if (c.panel && c.panel !== '#0e1222') { s.setProperty('--panel', `color-mix(in srgb, ${c.panel} 80%, transparent)`); s.setProperty('--panel-2', `color-mix(in srgb, ${c.panel} 92%, transparent)`); } else { s.removeProperty('--panel'); s.removeProperty('--panel-2'); }
  document.body.dataset.pt = site.anim?.page || 'fade';
  document.body.dataset.reveal = site.anim?.reveal || 'up';
  document.body.dataset.font = site.font || 'Cairo';
  document.body.dataset.bg = site.background || 'network';
  if (site.background === 'image' && site.background_url) s.setProperty('--bg-image', `url("${safeUrl(site.background_url)}")`);
  else s.removeProperty('--bg-image');
  setFxTheme(c.primary || '#18b4ff', c.accent || '#8b5cf6', site.background || 'network', c.bg || '#05060b');
  bgVideo(site.background === 'video' ? site.background_video_url : null);
  if (site.favicon_url) $('link[rel=icon]').href = safeUrl(site.favicon_url);
  $('meta[name=theme-color]')?.setAttribute('content', c.bg || '#05060b');
}

export async function refreshMe() {
  state.me = null; state.unread = 0;
  if (auth.signedIn) {
    try { const r = await api.get('/me'); state.me = r.profile; state.unread = r.unread; } catch (e) {
      if (['banned', 'registration_closed'].includes(e.code)) { toast(e.message, 'error', 6000); await auth.signOut(); }
    }
  }
  renderHeader();
}
export const isAdmin = () => ['admin', 'owner'].includes(state.me?.role);
export const setTitle = (t) => { document.title = t ? `${t} | ${state.settings.site.name}` : `${state.settings.site.name} | ${state.settings.site.name_en || 'Anonymous Programmer'}`; };

// كل شعارات الموقع (الرأس، القائمة الجانبية، الفوتر) تأخذ حركة الشعار المختارة — افتراضياً عملة 3D
const brandMark = () => { const a = getContent(state).hero.logo_anim; return html`<span class="brand-mark ia-${a}" data-fx="${a}">${logo(state.settings.site.logo_url)}</span>`; };

function navItems() {
  const sec = state.settings.site.sections || {}, c = getContent(state);
  const ic = { python: 'terminal', apk: 'phone', course: 'cap', video: 'play', file: 'folder' };
  const items = [['/', 'الرئيسية', 'home'], ...Object.keys(ic).filter((k) => sec[k] !== false).map((k) => [SECTIONS[k].path, c.sections[k].nav, c.sections[k].icon || ic[k]]),
    ['/free', c.sections.free.nav, 'gift'], ['/paid', c.sections.paid.nav, 'gem']];
  for (const p of state.settings.pages || []) if (p.in_nav) items.push([p.url || '/page/' + p.slug, p.title, 'list']);
  return items;
}

function renderHeader() {
  const el = $('#hdr');
  if (!el || !state.settings) return;
  const s = state.settings.site, me = state.me;
  const ava = me ? (me.avatar ? html`<img class="avatar" src="${safeUrl(me.avatar)}" alt="" referrerpolicy="no-referrer">` : html`<span class="avatar">${(me.name || '?')[0]}</span>`) : '';
  mount(el, html`${s.announcement ? html`<div class="announce">${s.announcement}</div>` : ''}
  <div class="container">
    <a class="brand" href="/" aria-label="الرئيسية">${brandMark()}<span>${s.name}<small>${s.name_en || 'Anonymous Programmer'}</small></span></a>
    <nav class="nav" aria-label="التنقل الرئيسي">${navItems().map(([h, t]) => html`<a href="${h}">${t}</a>`)}</nav>
    <div class="hdr-actions">
      <button class="icon-btn" data-search aria-label="بحث">${icon('search')}</button>
      ${me ? html`${isAdmin() ? html`<a class="icon-btn" href="/admin" title="لوحة المدير" aria-label="لوحة المدير">${icon('shield')}</a>` : ''}
        <a class="icon-btn" href="/account#notifications" aria-label="الإشعارات">${icon('bell')}${state.unread ? html`<span class="dot">${state.unread > 99 ? '99+' : state.unread}</span>` : ''}</a>
        <a href="/account" class="hide-m" aria-label="حسابي">${ava}</a>`
    : html`<a class="btn primary sm" href="/login">${icon('user')}<span class="hide-xs"> دخول</span></a>`}
      <button class="icon-btn menu-btn" data-menu aria-label="القائمة">${icon('menu')}</button>
    </div>
  </div>
  <div class="container search-bar"><form data-sform class="row"><input class="input" name="q" placeholder="ابحث عن أداة، تطبيق، كورس..." autocomplete="off" maxlength="80"><button class="btn primary">${icon('search')}</button></form></div>`);
  mount($('#drawer nav'), html`<a class="brand" href="/">${brandMark()}<span>${s.name}</span></a><hr class="sep">
    ${navItems().map(([h, t, i]) => html`<a href="${h}">${icon(i)} ${t}</a>`)}
    <a href="/latest">${icon('bolt')} أحدث المنتجات</a><a href="/top">${icon('trend')} الأكثر تحميلاً</a>
    <a href="/contact">${icon('chat')} التواصل والدعم</a><a href="/faq">${icon('help')} الأسئلة الشائعة</a>
    ${me ? html`<a href="/account">${icon('user')} حسابي</a>${isAdmin() ? html`<a href="/admin">${icon('shield')} لوحة المدير</a>` : ''}` : html`<a href="/login">${icon('key')} تسجيل الدخول</a>`}`);
  highlight();
}

function renderLayout() {
  const s = state.settings.site, so = state.settings.social || {}, c = getContent(state);
  const fpages = (state.settings.pages || []).filter((p) => p.in_footer);
  mount($('#app'), html`<header id="hdr" class="hdr"></header><div id="drawer" class="drawer"><nav aria-label="القائمة"></nav></div>
  <main id="view" tabindex="-1"></main>
  <footer class="ftr"><div class="container">
    <div class="cols">
      <div><a class="brand" href="/">${brandMark()}<span>${s.name}<small>${s.name_en || ''}</small></span></a><p class="muted small mt">${c.footer.about || s.tagline}</p>
        <div class="socials">${socialLinks(so).map(([u, ic, t]) => html`<a class="icon-btn" href="${u}" target="_blank" rel="noopener" aria-label="${t}">${icon(ic)}</a>`)}</div></div>
      <div><h4>الأقسام</h4>${Object.keys(KINDS).filter((k) => s.sections?.[k] !== false).map((k) => html`<a href="${SECTIONS[k].path}">${c.sections[k].title}</a>`)}</div>
      <div><h4>المتجر</h4><a href="/latest">أحدث المنتجات</a><a href="/top">الأكثر تحميلاً</a><a href="/free">المنتجات المجانية</a><a href="/paid">المنتجات المدفوعة</a></div>
      <div><h4>الدعم</h4><a href="/contact">التواصل والدعم</a><a href="/faq">الأسئلة الشائعة</a><a href="/account">حسابي</a>${fpages.map((p) => html`<a href="${p.url || '/page/' + p.slug}">${p.title}</a>`)}</div>
    </div>
    <div class="copy"><span>© ${new Date().getFullYear()} ${c.footer.text}</span><span class="ltr">Anonymous Programmer Store</span></div>
  </div></footer>`);
  renderHeader();
  autoReveal($('#view'));
  const hdr = $('#hdr'), drawer = $('#drawer');
  hdr.addEventListener('click', (e) => {
    if (e.target.closest('[data-menu]')) drawer.classList.add('open');
    if (e.target.closest('[data-search]')) { const b = $('.search-bar', hdr); b.classList.toggle('open'); $('input', b).focus(); }
  });
  hdr.addEventListener('submit', (e) => {
    if (!e.target.matches('[data-sform]')) return;
    e.preventDefault();
    const q = new FormData(e.target).get('q').trim();
    if (q) go('/search?q=' + encodeURIComponent(q));
  });
  drawer.addEventListener('click', (e) => { if (e.target === drawer || e.target.closest('a')) drawer.classList.remove('open'); });
}

export const socialLinks = (so) => [[so.tiktok, 'music', 'TikTok'], [so.telegram, 'send', 'Telegram'], [so.whatsapp, 'chat', 'WhatsApp'], [so.instagram, 'eye', 'Instagram'], [so.youtube, 'play', 'YouTube']]
  .filter(([u]) => u).map(([u, i, t]) => [safeUrl(u), i, t]);

function highlight() {
  const p = location.pathname;
  $$('.nav a, .drawer nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === p));
}

let navId = 0, cleanup = null, trackT;
export async function go(path, replace = false) {
  history[replace ? 'replaceState' : 'pushState'](null, '', path);
  await render(true);
}
async function render(scroll) {
  const id = ++navId, view = $('#view'), path = location.pathname;
  $('#drawer')?.classList.remove('open');
  $('.search-bar')?.classList.remove('open');
  for (const [re, load] of ROUTES) {
    const m = path.match(re);
    if (!m) continue;
    try {
      const mod = await load();
      if (id !== navId) return;
      if (typeof cleanup === 'function') cleanup();
      cleanup = null;
      view.innerHTML = '';
      if (scroll) scrollTo({ top: 0 });
      cleanup = await mod.default(view, m, { state, go, refreshMe, setTitle, isAdmin, applyTheme, renderHeader });
      play(view, state.settings.site.anim?.page || 'fade'); // حركة الانتقال بين الصفحات (مكتبة 100 حركة)
    } catch (e) {
      console.error(e);
      if (id === navId) mount(view, html`<div class="container page"><div class="empty card">${icon('shield')}<p>${e.message || 'تعذر تحميل الصفحة'}</p><a class="btn ghost sm" href="/">الرئيسية</a></div></div>`);
    }
    return finish();
  }
  setTitle('الصفحة غير موجودة');
  mount(view, html`<div class="container notfound"><div class="code gradient-text ltr">404</div><h2>الصفحة غير موجودة</h2><p class="muted">ربما تم نقلها أو أن الرابط غير صحيح.</p><a class="btn primary" href="/">العودة للرئيسية</a></div>`);
  finish();
}
function finish() {
  highlight();
  reveal($('#view'));
  clearTimeout(trackT);
  trackT = setTimeout(() => api.post('/track', { path: location.pathname }).catch(() => {}), 800);
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || a.target || a.hasAttribute('download') || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin) return;
  e.preventDefault();
  if (u.pathname + u.search !== location.pathname + location.search) go(u.pathname + u.search + u.hash);
  else if (u.hash) document.getElementById(u.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
});
addEventListener('popstate', () => render(false));

(async function boot() {
  startFx();
  const [settings] = await Promise.all([api.get('/settings').catch(() => null), auth.init().catch(() => null)]);
  state.settings = { social: {}, faq: [], payments: {}, ...(settings || {}) };
  state.settings.site = { ...DEFAULT_SITE, ...(state.settings.site || {}) };
  applyTheme(state.settings.site);
  showIntro(getContent(state).intro, state.settings.site);
  document.body.dataset.covers = getContent(state).covers_anim;
  auto3d();
  renderLayout();
  await refreshMe();
  if (!settings) toast('تعذر الاتصال بالخادم حالياً — بعض الميزات قد لا تعمل', 'warn', 6000);
  render(false);
})();
