// 💧 حركات الأزرار والقوائم (مثل Glassy Sidebar): حبة نشطة تنزلق وتتمطّط بين العناصر ثم تلتحم بحافة القائمة
// تعمل على قائمة الرأس، قائمة الهاتف الجانبية، قائمة لوحة المدير، وكل مجموعات التبويبات .tabs
// تُفعَّل وتُطفأ من «المظهر والإعدادات» (body[data-lq]) وتحترم مستوى الجودة وتقليل الحركة
const GROUPS = '.nav, .drawer nav, .adm-side, .tabs';
const ACTIVE = '.active, .primary, [aria-current="page"], [aria-selected="true"]';
const mem = new Map(); // آخر موضع لكل مجموعة — لأن بعض القوائم يُعاد رسمها عند التنقل
// أي تغيّر في مقاس القائمة أو أزرارها (تحميل الخط، تغيّر الرأس بعد الدخول...) يعيد ضبط الحبة فوراً
const ro = 'ResizeObserver' in window ? new ResizeObserver(() => refreshLiquid(false)) : null;
const seen = new WeakSet();
const flag = (k) => document.body.dataset[k] === '1';
const lvl = () => Number(document.body.dataset.q) || 4;
const anims = (el) => (el.getAnimations ? el.getAnimations() : []); // متصفحات قديمة بلا getAnimations
const css = (g) => ({ left: `${g.x}px`, top: `${g.y}px`, width: `${g.w}px`, height: `${g.h}px` });
const keyOf = (box, i) => (box.classList.contains('adm-side') ? 'adm' : box.classList.contains('nav') ? 'nav' : box.closest('.drawer') ? 'drawer' : `tabs:${location.pathname}:${i}`);
// على الكمبيوتر تلتحم حبة لوحة المدير بالشريط الأبيض على حافة القائمة (كما في الفيديو)، وفي وضع الطي تبقى دائرة حول الأيقونة
const joins = (box) => box.classList.contains('adm-side') && matchMedia('(min-width: 961px)').matches && !box.closest('.adm.rail');

function update(box, i, animate) {
  const items = [...box.children].filter((c) => c.matches('a, button') && !c.matches('.lq-rail-btn'));
  const act = items.find((c) => c.matches(ACTIVE));
  let pill = box.querySelector(':scope > .lq-pill');
  if (!act || items.length < 2 || !box.offsetWidth) { pill?.remove(); box.classList.remove('lq', 'lq-join'); return; }
  const j = joins(box);
  const to = { x: j ? 0 : act.offsetLeft, y: act.offsetTop, w: j ? act.offsetLeft + act.offsetWidth : act.offsetWidth, h: act.offsetHeight };
  box.classList.add('lq'); box.classList.toggle('lq-join', j);
  if (ro) for (const el of [box, ...items]) if (!seen.has(el)) { seen.add(el); ro.observe(el); }
  const fresh = !pill, key = keyOf(box, i);
  if (fresh) { pill = document.createElement('i'); pill.className = 'lq-pill'; pill.setAttribute('aria-hidden', 'true'); box.prepend(pill); }
  const idx = items.indexOf(act);
  let from = fresh ? mem.get(key) : pill.lqg;
  // نقرة جديدة أثناء الحركة: تنطلق الحبة من موضعها الظاهر الآن لا من هدفها السابق (بلا قفزة)
  if (!fresh && from && from.idx !== idx && anims(pill).length) {
    const r = pill.getBoundingClientRect(), b = box.getBoundingClientRect();
    from = { x: r.left - b.left - box.clientLeft + box.scrollLeft, y: r.top - b.top - box.clientTop + box.scrollTop, w: r.width, h: r.height, idx: from.idx };
  }
  const g0 = pill.lqg, same = g0 && g0.x === to.x && g0.y === to.y && g0.w === to.w && g0.h === to.h;
  mem.set(key, { ...to, idx }); pill.lqg = { ...to, idx };
  if (!same) Object.assign(pill.style, css(to)); // لا كتابة بلا تغيير (أي تعديل في الصفحة يستدعي التحديث)
  // الحركة فقط عند تغيّر الزر النشط؛ تغيّر التخطيط وحده يضبط الحبة مباشرة
  if (!animate || !from || from.idx === idx || !to.w || !to.h || !pill.animate || lvl() <= 1 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // الحركة بـ transform فقط (على المركِّب لا على المعالج): تبقى سلسة حتى أثناء رسم محتوى الصفحة الجديدة
  const T = (g) => `translate(${g.x - to.x}px, ${g.y - to.y}px) scale(${g.w / to.w}, ${g.h / to.h})`;
  const dx = Math.abs(to.x - from.x), dy = Math.abs(to.y - from.y), grid = dx > 4 && dy > 4;
  const frames = [{ transform: T(from) }];
  // قائمة أفقية أو عمودية: تمطّط تصل فيه الحافة الأمامية أولاً فتغطي العنصرين ثم تلحقها الخلفية؛ في الشبكات (حركة قطرية) انزلاق مباشر
  if (!grid) frames.push({ offset: 0.42, transform: T(dy >= dx
    ? { x: to.x, w: to.w, y: Math.min(from.y, to.y), h: dy + (to.y > from.y ? to.h : from.h) }
    : { y: to.y, h: to.h, x: Math.min(from.x, to.x), w: dx + (to.x > from.x ? to.w : from.w) }) });
  frames.push({ transform: 'none' });
  anims(pill).forEach((a) => a.cancel());
  pill.classList.add('lq-moving');
  const an = pill.animate(frames, { duration: lvl() === 2 ? 220 : grid ? 320 : 420, easing: 'cubic-bezier(.65,0,.35,1)' });
  an.onfinish = () => { if (!anims(pill).length) pill.classList.remove('lq-moving'); };
}

let raf = 0, wantAnim = false;
export function refreshLiquid(animate = true) {
  wantAnim ||= animate;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    const on = flag('lq'), a = wantAnim;
    wantAnim = false;
    document.querySelectorAll(GROUPS).forEach((box, i) => {
      if (on) update(box, i, a);
      else { box.querySelector(':scope > .lq-pill')?.remove(); box.classList.remove('lq', 'lq-join'); }
    });
  });
}

// تتبّع مستمر أثناء طي/فتح القائمة حتى تبقى الحبة ملتصقة بالعنصر
function follow(ms) {
  const end = performance.now() + ms;
  const tick = () => { document.querySelectorAll('.adm-side').forEach((b, i) => flag('lq') && update(b, i, false)); if (performance.now() < end) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
export const railOn = () => { try { return localStorage.getItem('adm_rail') === '1'; } catch { return false; } };

export function startLiquid() {
  new MutationObserver((ms) => {
    if (ms.some((m) => (m.type === 'childList' ? [...m.addedNodes].some((n) => n.nodeType === 1 && !n.classList.contains('lq-pill')) : m.target.parentElement?.matches(GROUPS)))) refreshLiquid(true);
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-current', 'aria-selected'] });
  addEventListener('resize', () => refreshLiquid(false));
  document.fonts?.ready.then(() => refreshLiquid(false));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-rail]')) return;
    const a = document.querySelector('.adm');
    if (!a) return;
    const on = a.classList.toggle('rail');
    try { localStorage.setItem('adm_rail', on ? '1' : '0'); } catch { /* تجاهل */ }
    follow(520);
  });
  refreshLiquid(false);
}
