// شاشة الدخول المتحركة: صورة/GIF/فيديو يرفعه المالك أو الشعار بحركة تلقائية — تختفي تلقائياً أو بلمسة
import { html, mount, raw, safeUrl } from './dom.js';
import { LOGO } from './art.js';

export function showIntro(i, site = {}, { force = false } = {}) {
  if (!i || (!i.enabled && !force)) return;
  if (!force) { try { if (!i.every_visit && sessionStorage.getItem('intro_seen')) return; sessionStorage.setItem('intro_seen', '1'); } catch { /* التخزين غير متاح */ } }
  document.querySelector('.intro')?.remove();
  const el = document.createElement('div');
  el.className = 'intro';
  const media = i.media_url
    ? (i.media_type === 'video' ? html`<video src="${safeUrl(i.media_url)}" muted autoplay playsinline></video>` : html`<img src="${safeUrl(i.media_url)}" alt="">`)
    : html`<div class="intro-logo">${site.logo_url ? html`<img src="${safeUrl(site.logo_url)}" alt="">` : raw(LOGO)}</div>`;
  mount(el, html`${media}${i.text ? html`<p class="intro-text">${i.text}</p>` : ''}<span class="intro-skip">اضغط للتخطي</span>`);
  document.body.append(el);
  const v = el.querySelector('video');
  if (v) { v.muted = true; v.play?.().catch(() => {}); }
  let gone = false;
  const done = () => { if (gone) return; gone = true; el.classList.add('out'); setTimeout(() => el.remove(), 500); };
  el.addEventListener('click', done);
  setTimeout(done, Math.min(8, Math.max(1, Number(i.duration) || 3)) * 1000);
}
