// تفاعل ثلاثي الأبعاد: المس واسحب لتدوير الصورة كعملة معدنية — زخم، استقرار ناعم، سماكة حواف، ولمسة سريعة تقلبها
const LAYERS = 6;

function setup(el) {
  el.setAttribute('data-x3d', '');
  if (el.tagName === 'IMG') el.draggable = false;
  const wrap = document.createElement('span'), inner = document.createElement('span');
  wrap.className = 'x3d' + (getComputedStyle(el).display === 'block' ? ' blk' : '');
  inner.className = 'x3d-in idle';
  el.replaceWith(wrap);
  wrap.append(inner);
  for (let i = LAYERS; i >= 1; i--) { // نسخ داكنة خلف الوجه = سماكة العملة
    const e = el.cloneNode(true);
    ['data-fx', 'data-cover', 'data-x3d', 'id'].forEach((a) => e.removeAttribute(a));
    e.classList.add('x3d-edge');
    e.setAttribute('aria-hidden', 'true');
    e.style.transform = `translateZ(${-i * 1.3}px)`;
    inner.append(e);
  }
  inner.append(el);
  let rx = 0, ry = 0, vy = 0, drag = false, moved = 0, lx = 0, ly = 0, t0 = 0, raf = 0, eat = false, last = 0;
  const draw = () => {
    inner.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    el.style.filter = `brightness(${(0.72 + 0.28 * Math.abs(Math.cos((ry * Math.PI) / 180))).toFixed(3)})`; // إضاءة حسب الزاوية
  };
  const settle = (now) => {
    if (drag) { raf = 0; return; }
    const k = Math.min(4, last ? (now - last) / 16.67 : 1); // عدد "إطارات 60Hz" منذ آخر رسم
    last = now;
    ry += vy * k; vy *= 0.955 ** k; rx *= 0.9 ** k;
    if (Math.abs(vy) < 0.25) {
      const t = Math.round(ry / 360) * 360;
      ry += (t - ry) * (1 - 0.88 ** k);
      if (Math.abs(t - ry) < 0.4 && Math.abs(rx) < 0.4) {
        rx = ry = vy = 0; inner.style.transform = ''; el.style.filter = ''; inner.classList.add('idle'); raf = 0; return;
      }
    }
    draw();
    raf = requestAnimationFrame(settle);
  };
  const go = () => { if (!raf) { last = 0; raf = requestAnimationFrame(settle); } };
  wrap.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    drag = true; moved = 0; lx = e.clientX; ly = e.clientY; t0 = performance.now(); vy = 0; eat = false;
    inner.classList.remove('idle'); cancelAnimationFrame(raf); raf = 0;
    try { wrap.setPointerCapture(e.pointerId); } catch { /* غير مدعوم */ }
  });
  wrap.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - lx, dy = e.clientY - ly;
    lx = e.clientX; ly = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    ry += dx * 0.9; vy = dx * 0.9;
    if (e.pointerType === 'mouse') rx = Math.max(-35, Math.min(35, rx - dy * 0.5)); // باللمس يبقى السحب العمودي لتمرير الصفحة
    draw();
  });
  wrap.addEventListener('pointerup', () => {
    if (!drag) return;
    drag = false;
    if (moved < 6 && performance.now() - t0 < 350) vy = 26; // لمسة سريعة = قلب العملة
    else if (moved >= 6) eat = true; // بعد السحب لا نفتح الرابط
    go();
  });
  wrap.addEventListener('pointercancel', () => { drag = false; go(); });
  wrap.addEventListener('click', (e) => { if (eat) { eat = false; e.preventDefault(); e.stopPropagation(); } }, true);
}

export function enable3d(root = document) {
  const sel = '[data-fx="coin"]:not([data-x3d])' + (document.body.dataset.covers === 'coin' ? ', img[data-cover]:not([data-x3d])' : '');
  root.querySelectorAll(sel).forEach((el) => { if (!el.closest('.x3d-edge')) setup(el); });
}

let mo;
export function auto3d() {
  if (mo) return;
  let t = 0;
  mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => enable3d(), 60); });
  mo.observe(document.body, { childList: true, subtree: true });
  enable3d();
}
