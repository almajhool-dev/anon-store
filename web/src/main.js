// الإقلاع: الإعدادات + الجلسة + القالب العام + الموجّه
import '@fontsource-variable/cairo';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/700.css';
import './styles.css';
import { html, mount, $, $$, toast, safeUrl } from './lib/dom.js';
import { api, auth, KINDS } from './lib/core.js';
import { icon, logo } from './lib/art.js';
import { startFx, setFxTheme, reveal, autoReveal } from './lib/fx.js';

export const state = { settings: null, me: null, unread: 0 };
const DEFAULT_SITE = { name: 'متجر المبرمج المجهول', name_en: 'Anonymous Programmer Store', tagline: '', colors: { primary: '#18b4ff', accent: '#8b5cf6', bg: '#05060b' }, sections: {}, registration_enabled: true, store_enabled: true, currency: 'USD' };

const ROUTES = [
  [/^\/$/, () => import('./pages/home.js')],
  [/^\/(python|apk|courses|videos|files|free|paid|latest|top|search)$/, () => import('./pages/catalog.js')],
  [/^\/p\/([a-z0-9-]+)$/, () => import('./pages/product.js')],
  [/^\/learn\/([a-z0-9-]+)$/, () => import('./pages/learn.js')],
  [/^\/account$/, () => import('./pages/account.js')],
  [/^\/(contact|faq|login|claim)$/, () => import('./pages/info.js')],
  [/^\/admin(?:\/([a-z]+))?$/, () => import('./admin/admin.js')],
];

export function applyTheme(site) {
  const s = document.documentElement.style, c = site.colors || {};
  s.setProperty('--primary', c.primary || '#18b4ff');
  s.setProperty('--accent', c.accent || '#8b5cf6');
  s.setProperty('--bg', c.bg || '#05060b');
  document.body.dataset.font = site.font || 'Cairo';
  document.body.dataset.bg = site.background || 'network';
  if (site.background === 'image' && site.background_url) s.setProperty('--bg-image', `url("${safeUrl(site.background_url)}")`);
  else s.removeProperty('--bg-image');
  setFxTheme(c.primary || '#18b4ff', c.accent || '#8b5cf6', site.background || 'network');
  if (site.favicon_url) $('link[rel=icon]').href = safeUrl(site.favicon_url);
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

function navItems() {
  const sec = state.settings.site.sections || {};
  const short = { python: 'Python', apk: 'Android APK', course: 'الكورسات', video: 'الفيديوهات', file: 'الملفات والمشاريع' };
  return [['/', 'الرئيسية', 'home'], ...Object.entries(KINDS).filter(([k]) => sec[k] !== false).map(([k, v]) => [v.path, short[k], { python: 'terminal', apk: 'phone', course: 'cap', video: 'play', file: 'folder' }[k]]),
    ['/free', 'المجانية', 'gift'], ['/paid', 'المدفوعة', 'gem']];
}

function renderHeader() {
  const el = $('#hdr');
  if (!el || !state.settings) return;
  const s = state.settings.site, me = state.me;
  const ava = me ? (me.avatar ? html`<img class="avatar" src="${safeUrl(me.avatar)}" alt="" referrerpolicy="no-referrer">` : html`<span class="avatar">${(me.name || '?')[0]}</span>`) : '';
  mount(el, html`${s.announcement ? html`<div class="announce">${s.announcement}</div>` : ''}
  <div class="container">
    <a class="brand" href="/" aria-label="الرئيسية">${logo(s.logo_url)}<span>${s.name}<small>${s.name_en || 'Anonymous Programmer'}</small></span></a>
    <nav class="nav" aria-label="التنقل الرئيسي">${navItems().map(([h, t]) => html`<a href="${h}">${t}</a>`)}</nav>
    <div class="hdr-actions">
      <button class="icon-btn" data-search aria-label="بحث">${icon('search')}</button>
      ${me ? html`${isAdmin() ? html`<a class="icon-btn hide-m" href="/admin" title="لوحة المدير" aria-label="لوحة المدير">${icon('shield')}</a>` : ''}
        <a class="icon-btn" href="/account#notifications" aria-label="الإشعارات">${icon('bell')}${state.unread ? html`<span class="dot">${state.unread > 99 ? '99+' : state.unread}</span>` : ''}</a>
        <a href="/account" class="hide-m" aria-label="حسابي">${ava}</a>`
    : html`<a class="btn primary sm" href="/login">${icon('user')}<span class="hide-xs"> دخول</span></a>`}
      <button class="icon-btn menu-btn" data-menu aria-label="القائمة">${icon('menu')}</button>
    </div>
  </div>
  <div class="container search-bar"><form data-sform class="row"><input class="input" name="q" placeholder="ابحث عن أداة، تطبيق، كورس..." autocomplete="off" maxlength="80"><button class="btn primary">${icon('search')}</button></form></div>`);
  mount($('#drawer nav'), html`<a class="brand" href="/">${logo(s.logo_url)}<span>${s.name}</span></a><hr class="sep">
    ${navItems().map(([h, t, i]) => html`<a href="${h}">${icon(i)} ${t}</a>`)}
    <a href="/latest">${icon('bolt')} أحدث المنتجات</a><a href="/top">${icon('trend')} الأكثر تحميلاً</a>
    <a href="/contact">${icon('chat')} التواصل والدعم</a><a href="/faq">${icon('help')} الأسئلة الشائعة</a>
    ${me ? html`<a href="/account">${icon('user')} حسابي</a>${isAdmin() ? html`<a href="/admin">${icon('shield')} لوحة المدير</a>` : ''}` : html`<a href="/login">${icon('key')} تسجيل الدخول</a>`}`);
  highlight();
}

function renderLayout() {
  const s = state.settings.site, so = state.settings.social || {};
  mount($('#app'), html`<header id="hdr" class="hdr"></header><div id="drawer" class="drawer"><nav aria-label="القائمة"></nav></div>
  <main id="view" tabindex="-1"></main>
  <footer class="ftr"><div class="container">
    <div class="cols">
      <div><a class="brand" href="/">${logo(s.logo_url)}<span>${s.name}<small>${s.name_en || ''}</small></span></a><p class="muted small mt">${s.tagline}</p>
        <div class="socials">${socialLinks(so).map(([u, ic, t]) => html`<a class="icon-btn" href="${u}" target="_blank" rel="noopener" aria-label="${t}">${icon(ic)}</a>`)}</div></div>
      <div><h4>الأقسام</h4>${Object.values(KINDS).map((k) => html`<a href="${k.path}">${k.plural}</a>`)}</div>
      <div><h4>المتجر</h4><a href="/latest">أحدث المنتجات</a><a href="/top">الأكثر تحميلاً</a><a href="/free">المنتجات المجانية</a><a href="/paid">المنتجات المدفوعة</a></div>
      <div><h4>الدعم</h4><a href="/contact">التواصل والدعم</a><a href="/faq">الأسئلة الشائعة</a><a href="/account">حسابي</a></div>
    </div>
    <div class="copy"><span>© ${new Date().getFullYear()} المبرمج المجهول — جميع الحقوق محفوظة</span><span class="ltr">Anonymous Programmer Store</span></div>
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
      cleanup = await mod.default(view, m, { state, go, refreshMe, setTitle, isAdmin, applyTheme });
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
  renderLayout();
  await refreshMe();
  if (!settings) toast('تعذر الاتصال بالخادم حالياً — بعض الميزات قد لا تعمل', 'warn', 6000);
  render(false);
})();
