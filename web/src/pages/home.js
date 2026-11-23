import { html, raw, mount, actions, safeUrl } from '../lib/dom.js';
import { api } from '../lib/core.js';
import { icon, art, LOGO } from '../lib/art.js';
import { grid, skeleton, errorBox } from '../lib/ui.js';
import { reveal } from '../lib/fx.js';
import { getContent, SECTIONS } from '../lib/content.js';
import { socialLinks } from '../main.js';

const ext = (u) => /^https?:/.test(u || '');
const btnLink = (u, cls, inner) => html`<a class="${cls}" href="${safeUrl(u)}" ${ext(u) ? raw('target="_blank" rel="noopener"') : ''}>${inner}</a>`;

export default async function (view, _m, { state, setTitle }) {
  setTitle('');
  const s = state.settings.site, sec = s.sections || {}, c = getContent(state), h = c.hero;
  const cats = Object.keys(SECTIONS).filter((k) => sec[k] !== false);
  const heroImg = h.image_url || s.logo_url;
  mount(view, html`
  ${c.show.banners && c.banners.length ? html`<section class="container section banners${c.banners.length > 1 ? ' slider' : ''}">${c.banners.map((b) => html`<div class="card banner-ad reveal">
    ${b.image_url ? html`<img class="ia-${b.anim || 'none'}" data-fx="${b.anim || 'none'}" src="${safeUrl(b.image_url)}" alt="" loading="lazy">` : ''}<div><h2>${b.title}</h2>${b.text ? html`<p>${b.text}</p>` : ''}${b.link ? btnLink(b.link, 'btn primary', b.button || 'اكتشف الآن') : ''}</div></div>`)}</section>` : ''}
  <section class="container hero" data-sec="hero">
    <div class="reveal">
      ${h.badge ? html`<span class="pill"><i></i> ${h.badge}</span>` : ''}
      <h1>${h.title} ${h.highlight ? html`<span class="gradient-text">${h.highlight}</span>` : ''}</h1>
      <p class="lead">${h.subtitle || s.tagline}</p>
      <div class="row wrap gap mt">${h.cta1_text ? btnLink(h.cta1_link || '/latest', 'btn primary lg', html`${icon('grid')} ${h.cta1_text}`) : ''}${h.cta2_text ? btnLink(h.cta2_link || '/free', 'btn lg', html`${icon('gift')} ${h.cta2_text}`) : ''}</div>
    </div>
    <div class="reveal"><div class="hero-logo">${heroImg ? html`<img class="ia-${h.image_anim}" data-fx="${h.image_anim}" src="${safeUrl(heroImg)}" alt="">` : html`<span class="hero-svg ia-${h.image_anim}" data-fx="${h.image_anim}">${raw(LOGO)}</span>`}</div>
      ${h.show_terminal && h.terminal?.length ? html`<div class="card terminal glow"><header><i></i><i></i><i></i></header><pre id="term"></pre></div>` : ''}</div>
  </section>
  ${c.show.sections ? html`<section class="container section"><div class="section-head"><div><h2>الأقسام</h2><p class="muted">كل ما تحتاجه في مكان واحد</p></div></div>
    <div class="cats" data-sec="cats">${cats.map((k) => { const x = c.sections[k]; return html`<a class="card cat reveal" href="${SECTIONS[k].path}"><div class="art-wrap ia-${x.anim || 'none'}" data-fx="${x.anim || 'none'}">${x.image_url ? html`<img class="art" src="${safeUrl(x.image_url)}" alt="" loading="lazy">` : art(k, x.title)}</div><div><b>${x.title}</b><span>${x.desc}</span></div></a>`; })}</div></section>` : ''}
  ${c.show.latest ? html`<section class="container section"><div class="section-head"><div><h2>${icon('bolt')} ${c.sections.latest.title}</h2></div><a class="btn ghost sm" href="/latest">عرض الكل ${icon('next')}</a></div><div id="latest">${skeleton(4)}</div></section>` : ''}
  ${c.show.top ? html`<section class="container section"><div class="section-head"><div><h2>${icon('trend')} ${c.sections.top.title}</h2></div><a class="btn ghost sm" href="/top">عرض الكل ${icon('next')}</a></div><div id="top">${skeleton(4)}</div></section>` : ''}
  ${c.show.features && c.features.length ? html`<section class="container section"><div class="features">${c.features.map((f) => html`<div class="card feature reveal">${f.image_url ? html`<img class="ic ia-${f.anim || 'none'}" data-fx="${f.anim || 'none'}" src="${safeUrl(f.image_url)}" alt="" loading="lazy">` : html`<span class="ic-wrap ia-${f.anim || 'none'}" data-fx="${f.anim || 'none'}">${icon(f.icon)}</span>`}<b>${f.title}</b><p>${f.text}</p></div>`)}</div></section>` : ''}
  ${c.show.contact ? html`<section class="container section"><div class="card pad glow reveal center"><h2 class="gradient-text">${c.contact.title}</h2><p class="muted">${c.contact.text}</p>
    <div class="row wrap center gap mt">${socialLinks(state.settings.social || {}).slice(0, 3).map(([u, i, t]) => html`<a class="btn" href="${u}" target="_blank" rel="noopener">${icon(i)} ${t}</a>`)}<a class="btn primary" href="/contact">${icon('mail')} نموذج الدعم</a></div></div></section>` : ''}`);

  const pre = view.querySelector('#term'), LINES = h.terminal || [];
  let li = 0, ci = 0, alive = true;
  const type = () => {
    if (!alive || !pre?.isConnected) return;
    if (li >= LINES.length) { pre.textContent = LINES.join('\n'); pre.insertAdjacentHTML('beforeend', '<span class="cursor"></span>'); return; }
    ci++;
    pre.textContent = LINES.slice(0, li).join('\n') + (li ? '\n' : '') + LINES[li].slice(0, ci);
    pre.insertAdjacentHTML('beforeend', '<span class="cursor"></span>');
    if (ci >= LINES[li].length) { li++; ci = 0; setTimeout(type, 380); } else setTimeout(type, 22);
  };
  if (pre) type();

  const load = async (id, q) => {
    const box = view.querySelector('#' + id);
    if (!box) return;
    try { const r = await api.get('/products?limit=8&' + q); mount(box, grid(r.items)); reveal(box); } catch (e) { mount(box, errorBox(e)); }
  };
  actions(view, { reload: () => { load('latest', 'sort=latest'); load('top', 'sort=top'); } });
  load('latest', 'sort=latest');
  load('top', 'sort=top');
  const sl = view.querySelector('.banners.slider');
  let slideT = 0;
  if (sl && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    slideT = setInterval(() => {
      const x = Math.abs(sl.scrollLeft), w = sl.clientWidth, end = x + w >= sl.scrollWidth - 8;
      sl.scrollTo({ left: (end ? 0 : x + w) * (getComputedStyle(sl).direction === 'rtl' ? -1 : 1), behavior: 'smooth' });
    }, 5000);
    sl.addEventListener('pointerdown', () => clearInterval(slideT), { once: true });
  }
  return () => { alive = false; clearInterval(slideT); };
}
