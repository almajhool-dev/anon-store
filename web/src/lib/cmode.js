// 🌗 وضع الألوان على طريقة Claude: النظام / داكن / فاتح — اختيار كل زائر يُحفظ على جهازه (design.js)
import { html, mount } from './dom.js';
import { icon } from './art.js';
import { colorMode, setColorMode } from './design.js';

// ترتيب العرض كما في Claude: «النظام» يساراً و«فاتح» يميناً (الصفحة من اليمين لليسار)
const OPTS = [['light', 'فاتح'], ['dark', 'داكن'], ['system', 'النظام']];
const ICON = { system: 'monitor', dark: 'moon', light: 'sun' };

export const modePicker = () => {
  const m = colorMode();
  return html`<section class="cm-sec"><h4 class="cm-title">${icon('moon')}<span>وضع الألوان</span></h4>
    <div class="cm" role="group" aria-label="وضع الألوان">${OPTS.map(([v, l]) => html`<button type="button" class="cm-opt" data-cmode="${v}" aria-pressed="${m === v ? 'true' : 'false'}"><span class="cm-prev cm-${v}" aria-hidden="true"><i class="cm-card"><b></b><b></b><s></s></i></span><span class="cm-lbl">${l}</span></button>`)}</div></section>`;
};

// زر الرأس (الكمبيوتر) + نافذته المنبثقة
export const modeButton = () => html`<button type="button" class="icon-btn hide-m" data-cmpop aria-expanded="false" aria-label="وضع الألوان" title="وضع الألوان">${icon(ICON[colorMode()])}</button><div class="cm-pop" hidden>${modePicker()}</div>`;

function sync() {
  const m = colorMode();
  for (const b of document.querySelectorAll('button[data-cmode]')) b.setAttribute('aria-pressed', String(b.dataset.cmode === m));
  for (const b of document.querySelectorAll('[data-cmpop]')) mount(b, icon(ICON[m]));
}
function pop(open) {
  for (const p of document.querySelectorAll('.cm-pop')) {
    p.hidden = open === undefined ? !p.hidden : !open;
    p.previousElementSibling?.setAttribute('aria-expanded', String(!p.hidden));
  }
}
function choose(v) {
  const run = () => setColorMode(v);
  // انتقال ناعم بين الوضعين حيث يدعمه المتصفح (بلا حركة لمن يفضّل تقليلها أو في الوضع الخفيف)
  if (document.startViewTransition && Number(document.body.dataset.q || 8) > 2 && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(run);
  else run();
}

let started = false;
export function startModePicker() {
  if (started) return;
  started = true;
  document.addEventListener('click', (e) => {
    const opt = e.target.closest('button[data-cmode]');
    if (opt) { if (opt.dataset.cmode !== colorMode()) choose(opt.dataset.cmode); return; }
    if (e.target.closest('[data-cmpop]')) { pop(); return; }
    if (!e.target.closest('.cm-pop')) pop(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') pop(false); });
  addEventListener('ds:mode', sync);
}
