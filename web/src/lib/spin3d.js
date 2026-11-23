// 🪙 عملة ثلاثية الأبعاد تُدار باللمس في كل الاتجاهات (فوق، تحت، يمين، يسار، والزوايا)
// دوران "كرة تتبّع" بالكواترنيون + زخم ناعم + رجوع تلقائي للوضع الطبيعي + وجه خلفي بنفس ألوان الأمام
// الأداء: لا فلاتر تتغير كل إطار، تحديث واحد لكل إطار شاشة، وطبقات قليلة
const D2R = Math.PI / 180, SPEED = 0.55;
const qmul = (a, b) => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];
const qaxis = (x, y, deg) => { const n = Math.hypot(x, y) || 1, h = (deg * D2R) / 2, s = Math.sin(h); return [Math.cos(h), (x / n) * s, (y / n) * s, 0]; };
const unit = (q) => { const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / n, q[1] / n, q[2] / n, q[3] / n]; };
const toCss = (q) => {
  const w = Math.min(1, Math.abs(q[0])), sg = q[0] < 0 ? -1 : 1, s = Math.sqrt(1 - w * w);
  return s < 1e-5 ? '' : `rotate3d(${((sg * q[1]) / s).toFixed(5)},${((sg * q[2]) / s).toFixed(5)},${((sg * q[3]) / s).toFixed(5)},${(2 * Math.acos(w)).toFixed(5)}rad)`;
};
// زاوية الحركة الخفيفة الحالية → كواترنيون (حتى لا تقفز العملة عند أول لمسة)
function fromCss(t) {
  const v = (t.match(/matrix3d\(([^)]+)\)/) || [])[1]?.split(',').map(Number);
  if (!v || v.length !== 16) return [1, 0, 0, 0];
  const tr = v[0] + v[5] + v[10];
  if (tr <= 0) return [1, 0, 0, 0];
  const s = Math.sqrt(tr + 1) * 2;
  return unit([s / 4, (v[6] - v[9]) / s, (v[8] - v[2]) / s, (v[1] - v[4]) / s]);
}

function setup(el, free) {
  el.setAttribute('data-x3d', '');
  if (el.tagName === 'IMG') el.draggable = false;
  const wrap = document.createElement('span'), inner = document.createElement('span');
  wrap.className = 'x3d' + (free ? ' free' : '') + (getComputedStyle(el).display === 'block' ? ' blk' : '');
  inner.className = 'x3d-in idle';
  el.replaceWith(wrap);
  wrap.append(inner);
  const copy = (cls, z, back) => {
    const e = el.cloneNode(true);
    ['data-fx', 'data-cover', 'data-x3d', 'id', 'loading'].forEach((a) => e.removeAttribute(a));
    e.classList.add(cls);
    e.setAttribute('aria-hidden', 'true');
    e.style.transform = `translateZ(calc(var(--t) * ${z}))${back ? ' rotateY(180deg)' : ''}`;
    inner.append(e);
  };
  copy('x3d-back', -0.5, true); // الوجه الخلفي: نفس الصورة ونفس الألوان
  for (const z of [-0.25, 0, 0.25]) copy('x3d-edge', z); // حافة العملة
  el.classList.add('x3d-front');
  el.style.transform = 'translateZ(calc(var(--t) * 0.5))';
  inner.append(el);
  const size = () => inner.style.setProperty('--t', `${Math.max(2, Math.min(9, (el.getBoundingClientRect().width || 100) * 0.035)).toFixed(1)}px`);
  size();
  if (el.tagName === 'IMG' && !el.complete) el.addEventListener('load', size, { once: true });

  let q = [1, 0, 0, 0], vel = null, drag = false, moved = 0, t0 = 0, tMove = 0, lx = 0, ly = 0, px = 0, py = 0, raf = 0, last = 0, eat = false;
  const apply = () => { inner.style.transform = toCss(q); };
  const frame = (now) => {
    raf = 0;
    const k = Math.min(4, last ? (now - last) / 16.67 : 1);
    last = now;
    if (drag) {
      if (px || py) {
        const deg = Math.hypot(px, py) * SPEED;
        q = unit(qmul(qaxis(-py, px, deg), q));
        vel = { x: -py, y: px, deg: deg / k };
        px = py = 0;
        apply();
      }
      return;
    }
    if (vel && vel.deg > 0.12) { q = unit(qmul(qaxis(vel.x, vel.y, vel.deg * k), q)); vel.deg *= 0.94 ** k; }
    else {
      vel = null;
      if (q[0] < 0) q = q.map((v) => -v);
      const t = 1 - 0.85 ** k;
      q = unit([q[0] + (1 - q[0]) * t, q[1] * (1 - t), q[2] * (1 - t), q[3] * (1 - t)]);
      if (q[0] > 0.99999) { q = [1, 0, 0, 0]; inner.style.transform = ''; inner.classList.add('idle'); last = 0; return; }
    }
    apply();
    raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  wrap.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    if (inner.classList.contains('idle')) { q = fromCss(getComputedStyle(inner).transform); inner.classList.remove('idle'); apply(); }
    drag = true; moved = 0; px = py = 0; vel = null; eat = false;
    lx = e.clientX; ly = e.clientY; t0 = tMove = performance.now();
    try { wrap.setPointerCapture(e.pointerId); } catch { /* غير مدعوم */ }
  });
  wrap.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - lx, dy = e.clientY - ly;
    lx = e.clientX; ly = e.clientY; moved += Math.abs(dx) + Math.abs(dy); tMove = performance.now();
    px += dx; py += free ? dy : 0; // صور القوائم: أفقي فقط حتى يبقى تمرير الصفحة سهلاً
    kick();
  });
  const end = () => {
    if (!drag) return;
    drag = false; last = 0;
    if (moved < 6 && performance.now() - t0 < 350) vel = { x: 0, y: 1, deg: 22 }; // لمسة سريعة = قلب العملة
    else { eat = moved >= 6; if (performance.now() - tMove > 90) vel = null; } // ثبّت إصبعك قبل الرفع = توقف بدون زخم
    kick();
  };
  wrap.addEventListener('pointerup', end);
  wrap.addEventListener('pointercancel', end);
  wrap.addEventListener('click', (e) => { if (eat) { eat = false; e.preventDefault(); e.stopPropagation(); } }, true);
}

export function enable3d(root = document) {
  const skip = (el) => el.closest('.x3d-edge, .x3d-back');
  root.querySelectorAll('[data-fx="coin"]:not([data-x3d])').forEach((el) => { if (!skip(el)) setup(el, true); });
  if (document.body.dataset.covers === 'coin') root.querySelectorAll('img[data-cover]:not([data-x3d])').forEach((el) => { if (!skip(el)) setup(el, false); });
}

let mo;
export function auto3d() {
  if (mo) return;
  let t = 0;
  mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => enable3d(), 60); });
  mo.observe(document.body, { childList: true, subtree: true });
  enable3d();
}
