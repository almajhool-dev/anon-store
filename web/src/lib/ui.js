// مكوّنات الواجهة المشتركة: بطاقة المنتج، السعر، النجوم، الحالات الفارغة، النص المنسق
import { html, raw, esc, safeUrl } from './dom.js';
import { icon, art } from './art.js';
import { fmtNum, fmtPrice, KINDS } from './core.js';

export const avgRating = (p) => (p.rating_count ? p.rating_sum / p.rating_count : 0);
export const stars = (v) => html`<span class="stars" aria-label="${v.toFixed(1)} من 5">${[1, 2, 3, 4, 5].map((i) => html`<i class="${i <= Math.round(v) ? 'on' : ''}">★</i>`)}</span>`;
export const saleOn = (p) => p.discount_percent > 0 && (!p.discount_ends_at || new Date(p.discount_ends_at) > new Date());
export function price(p, big = false) {
  if (!Number(p.price)) return html`<span class="price free${big ? ' big' : ''}">مجاني</span>`;
  return html`<span class="price${big ? ' big' : ''}">${saleOn(p) ? html`<s>${fmtPrice(p.price, p.currency)}</s>` : ''}<b>${fmtPrice(p.final_price ?? p.price, p.currency)}</b></span>`;
}
export const cover = (p) => (p.cover_url ? html`<img src="${safeUrl(p.cover_url)}" alt="" loading="lazy" decoding="async">` : art(p.kind, p.title));
export const card = (p) => html`<a class="card pcard reveal" href="/p/${p.slug}">
  <div class="pcover">${cover(p)}<span class="badge kind">${KINDS[p.kind]?.label || ''}</span>${saleOn(p) ? html`<span class="badge sale">-${p.discount_percent}%</span>` : ''}${p.featured ? html`<span class="badge feat" title="مميز">${icon('star')}</span>` : ''}</div>
  <div class="pbody"><h3>${p.title}</h3><p class="muted clamp2">${p.summary || ''}</p>
  <div class="pmeta">${price(p)}<span class="muted small">${icon('download')} ${fmtNum(p.downloads)}${p.rating_count ? ` · ★ ${avgRating(p).toFixed(1)}` : ''}</span></div></div></a>`;
export const empty = (msg, ic = 'grid') => html`<div class="empty card">${icon(ic)}<p>${msg}</p></div>`;
export const grid = (items, msg = 'لا توجد منتجات هنا بعد — ترقّب الإضافات القادمة') => (items.length ? html`<div class="grid">${items.map(card)}</div>` : empty(msg));
export const skeleton = (n = 4) => html`<div class="grid">${Array.from({ length: n }, () => html`<div class="card pcard sk"><div class="pcover"></div><div class="pbody"><i></i><i></i><i></i></div></div>`)}</div>`;
export const loader = () => html`<div class="center-box"><span class="spinner"></span></div>`;
export const errorBox = (e, retry = true) => html`<div class="empty card">${icon('shield')}<p>${e?.message || 'تعذر التحميل'}</p>${retry ? html`<button class="btn ghost sm" data-act="reload">إعادة المحاولة</button>` : ''}</div>`;

export function countdown(root) {
  const tick = () => {
    for (const x of root.querySelectorAll('[data-ends]')) {
      const s = Math.max(0, (new Date(x.dataset.ends) - Date.now()) / 1000);
      const p = (n) => String(Math.floor(n)).padStart(2, '0');
      x.textContent = s ? `${Math.floor(s / 86400)} يوم ${p((s % 86400) / 3600)}:${p((s % 3600) / 60)}:${p(s % 60)}` : 'انتهى العرض';
    }
  };
  tick();
  const t = setInterval(() => (root.isConnected ? tick() : clearInterval(t)), 1000);
}

// نص منسق آمن: يُهرَّب أولاً ثم تُطبَّق تنسيقات بسيطة (عناوين، قوائم، كود، روابط https)
export function richText(src = '') {
  const out = [];
  let list = null, code = null;
  const inline = (s) => s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener nofollow ugc">$1</a>');
  for (const line of esc(src).split('\n')) {
    if (line.startsWith('```')) { if (code) { out.push(`<pre><code>${code.join('\n')}</code></pre>`); code = null; } else code = []; continue; }
    if (code) { code.push(line); continue; }
    const li = line.match(/^\s*[-•*]\s+(.*)/);
    if (li) { (list ||= []).push(`<li>${inline(li[1])}</li>`); continue; }
    if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; }
    const hd = line.match(/^#{1,3}\s+(.*)/);
    if (hd) out.push(`<h3>${inline(hd[1])}</h3>`);
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push(`<ul>${list.join('')}</ul>`);
  if (code) out.push(`<pre><code>${code.join('\n')}</code></pre>`);
  return raw(out.join(''));
}
