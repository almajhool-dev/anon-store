import { play } from './transitions.js';
// خلفية الشبكة الرقمية المتحركة (Canvas خفيف) + ظهور العناصر عند التمرير
let ctx, cv, w, h, pts = [], raf = 0, dpr = 1, color = [24, 180, 255], color2 = [139, 92, 246], mode = 'network';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hex = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
const ANIM = new Set(['network', 'matrix']);
const CH = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي0123456789ABCDEF<>/{}$#';
let drops = [], bgc = [5, 6, 11], last = 0;
function matrix(t) {
  if (!reduce) raf = requestAnimationFrame(matrix);
  if (last && t - last < 50) return; // ~20 إطاراً/ث: سلس وموفّر للبطارية
  last = t;
  const fs = w < 700 ? 15 : 17, cols = Math.ceil(w / fs);
  if (drops.length !== cols) drops = Array.from({ length: cols }, () => Math.random() * -40);
  ctx.fillStyle = `rgba(${bgc[0]},${bgc[1]},${bgc[2]},.16)`;
  ctx.fillRect(0, 0, w, h);
  ctx.font = `${fs}px monospace`;
  for (let i = 0; i < cols; i++) {
    const y = drops[i] * fs, c = i % 4 ? color : color2;
    ctx.fillStyle = Math.random() > 0.97 ? '#e6f7ff' : `rgba(${c[0]},${c[1]},${c[2]},.9)`;
    ctx.fillText(CH[(Math.random() * CH.length) | 0], i * fs, y);
    drops[i] = y > h && Math.random() > 0.97 ? 0 : drops[i] + 1;
  }
}
const loop = () => (mode === 'matrix' ? matrix : frame);

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 1.75);
  w = innerWidth; h = innerHeight;
  cv.width = w * dpr; cv.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const count = Math.round(Math.min(w < 700 ? 38 : 85, (w * h) / 16000));
  pts = Array.from({ length: count }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.32, vy: (Math.random() - 0.5) * 0.32, r: Math.random() * 1.6 + 0.6 }));
}

function frame() {
  ctx.clearRect(0, 0, w, h);
  const max = w < 700 ? 110 : 140;
  for (const p of pts) {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > w) p.vx *= -1;
    if (p.y < 0 || p.y > h) p.vy *= -1;
  }
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    for (let j = i + 1; j < pts.length; j++) {
      const b = pts[j], dx = a.x - b.x, dy = a.y - b.y, d = dx * dx + dy * dy;
      if (d < max * max) {
        const t = 1 - Math.sqrt(d) / max, c = j % 3 ? color : color2;
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${t * 0.32})`;
        ctx.lineWidth = t;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},.75)`;
    ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.283); ctx.fill();
  }
  if (!reduce) raf = requestAnimationFrame(frame);
}

export function startFx() {
  cv = document.createElement('canvas');
  cv.id = 'net';
  cv.setAttribute('aria-hidden', 'true');
  document.body.prepend(cv);
  ctx = cv.getContext('2d');
  resize();
  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(resize, 200); });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (!document.hidden && ANIM.has(mode)) raf = requestAnimationFrame(loop());
  });
  if (ANIM.has(mode)) raf = requestAnimationFrame(loop());
}

export function setFxTheme(primary, accent, bgMode, bg) {
  try { color = hex(primary); color2 = hex(accent); if (bg) bgc = hex(bg); } catch { /* افتراضي */ }
  mode = bgMode || 'network';
  cancelAnimationFrame(raf);
  if (!cv) return;
  cv.style.display = ANIM.has(mode) ? 'block' : 'none';
  ctx.clearRect(0, 0, w, h); drops = []; last = 0;
  if (ANIM.has(mode)) raf = requestAnimationFrame(loop());
}

const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => {
  for (const e of es) if (e.isIntersecting) {
    e.target.classList.add('in'); io.unobserve(e.target);
    const k = document.body.dataset.reveal;
    if (k && k !== 'none') play(e.target, k);
  }
}, { rootMargin: '0px 0px -40px 0px' }) : null;
export function reveal(root = document) {
  for (const el of root.querySelectorAll('.reveal:not(.in)')) io ? io.observe(el) : el.classList.add('in');
}
// يراقب أي محتوى جديد (إعادة رسم الصفحات) حتى لا تبقى عناصر .reveal مخفية
export function autoReveal(root) {
  new MutationObserver(() => reveal(root)).observe(root, { childList: true, subtree: true });
}
