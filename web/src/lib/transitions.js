// مكتبة 100 حركة انتقال مختلفة (Web Animations API — سلسة على كرت الشاشة وآمنة مع سياسة CSP)
// كل حركة تنتهي بالشكل الطبيعي للعنصر، فلا يحدث قفز عند نهايتها
const E = { out: 'cubic-bezier(.22,1,.36,1)', back: 'cubic-bezier(.34,1.56,.64,1)', soft: 'cubic-bezier(.25,.8,.25,1)', io: 'cubic-bezier(.65,0,.35,1)' };
const L = [];
const N = { opacity: 1, transform: 'none', filter: 'none' };
const add = (k, label, group, from, opt = {}) => L.push({ k, label, group, frames: Array.isArray(from) ? from : [{ opacity: 0, ...from }, { ...N, ...(opt.to || {}) }], dur: opt.dur || 650, ease: opt.ease || E.out });
const P = 'perspective(900px) ';

// 1) تلاشي وانزلاق (11)
let g = 'تلاشي وانزلاق';
add('fade', 'تلاشي ناعم', g, {}, { dur: 500 });
for (const [k, l, t] of [['up', 'من الأسفل', 'translateY(40px)'], ['down', 'من الأعلى', 'translateY(-40px)'], ['left', 'من اليسار', 'translateX(-50px)'], ['right', 'من اليمين', 'translateX(50px)']]) {
  add(`slide-${k}`, `انزلاق ${l}`, g, { transform: t });
  add(`slide-${k}-far`, `انزلاق بعيد ${l}`, g, { transform: t.replace(/-?\d+px/, (v) => `${parseInt(v, 10) * 3}px`) }, { dur: 800 });
}
add('fade-up-scale', 'صعود مع تكبير خفيف', g, { transform: 'translateY(30px) scale(.96)' });
add('drift', 'انجراف مائل', g, { transform: 'translate(-24px, 24px) rotate(-2deg)' });

// 2) تكبير وتصغير (12)
g = 'تكبير وتصغير';
add('zoom-in', 'تكبير', g, { transform: 'scale(.85)' });
add('zoom-out', 'تصغير', g, { transform: 'scale(1.15)' });
add('pop', 'قفزة', g, { transform: 'scale(.6)' }, { ease: E.back });
add('puff', 'نفخة ضبابية', g, { transform: 'scale(1.6)', filter: 'blur(8px)' });
add('shrink', 'انكماش', g, { transform: 'scale(1.3)' });
for (const [k, l, o] of [['tl', 'أعلى اليسار', 'top left'], ['tr', 'أعلى اليمين', 'top right'], ['bl', 'أسفل اليسار', 'bottom left'], ['br', 'أسفل اليمين', 'bottom right']]) {
  add(`zoom-${k}`, `تكبير من ${l}`, g, [{ opacity: 0, transform: 'scale(.4)', transformOrigin: o }, { ...N, transformOrigin: o }]);
}
add('zoom-blur', 'تكبير مع ضباب', g, { transform: 'scale(.9)', filter: 'blur(10px)' });
add('stretch-x', 'تمدد أفقي', g, { transform: 'scaleX(0)' }, { ease: E.back });
add('stretch-y', 'تمدد عمودي', g, { transform: 'scaleY(0)' }, { ease: E.back });

// 3) ثلاثي الأبعاد (17)
g = 'ثلاثي الأبعاد';
add('flip-x', 'قلب عمودي', g, { transform: P + 'rotateX(90deg)' }, { dur: 750 });
add('flip-x-back', 'قلب عمودي عكسي', g, { transform: P + 'rotateX(-90deg)' }, { dur: 750 });
add('flip-y', 'قلب أفقي', g, { transform: P + 'rotateY(90deg)' }, { dur: 750 });
add('flip-y-back', 'قلب أفقي عكسي', g, { transform: P + 'rotateY(-90deg)' }, { dur: 750 });
for (const [k, l, t] of [['left', 'من اليسار', 'rotateY(25deg) translateX(-40px)'], ['right', 'من اليمين', 'rotateY(-25deg) translateX(40px)'], ['up', 'من الأسفل', 'rotateX(-25deg) translateY(40px)'], ['down', 'من الأعلى', 'rotateX(25deg) translateY(-40px)']]) add(`tilt-${k}`, `ميلان ${l}`, g, { transform: P + t });
add('rise', 'نهوض منظوري', g, [{ opacity: 0, transform: P + 'rotateX(35deg) translateY(60px)', transformOrigin: 'bottom' }, { ...N, transformOrigin: 'bottom' }], { dur: 800 });
add('drop-3d', 'هبوط منظوري', g, [{ opacity: 0, transform: P + 'rotateX(-35deg) translateY(-60px)', transformOrigin: 'top' }, { ...N, transformOrigin: 'top' }], { dur: 800 });
add('door-left', 'باب يُفتح يساراً', g, [{ opacity: 0, transform: P + 'rotateY(100deg)', transformOrigin: 'left' }, { ...N, transformOrigin: 'left' }], { dur: 850 });
add('door-right', 'باب يُفتح يميناً', g, [{ opacity: 0, transform: P + 'rotateY(-100deg)', transformOrigin: 'right' }, { ...N, transformOrigin: 'right' }], { dur: 850 });
add('cube-left', 'مكعب يسار', g, [{ opacity: 0, transform: P + 'rotateY(-70deg) translateX(-30%)', transformOrigin: 'right' }, { ...N, transformOrigin: 'right' }], { dur: 800, ease: E.io });
add('cube-right', 'مكعب يمين', g, [{ opacity: 0, transform: P + 'rotateY(70deg) translateX(30%)', transformOrigin: 'left' }, { ...N, transformOrigin: 'left' }], { dur: 800, ease: E.io });
add('card-flip', 'بطاقة تنقلب', g, { transform: P + 'rotateY(180deg) scale(.6)' }, { dur: 900 });
add('swing-top', 'تأرجح من الأعلى', g, [{ opacity: 0, transform: P + 'rotateX(-70deg)', transformOrigin: 'top' }, { ...N, transformOrigin: 'top' }], { ease: E.back, dur: 850 });
add('swing-bottom', 'تأرجح من الأسفل', g, [{ opacity: 0, transform: P + 'rotateX(70deg)', transformOrigin: 'bottom' }, { ...N, transformOrigin: 'bottom' }], { ease: E.back, dur: 850 });

// 4) دوران (10)
g = 'دوران';
add('rotate-in', 'دوران خفيف', g, { transform: 'rotate(-12deg) scale(.9)' });
add('rotate-in-cw', 'دوران خفيف مع العقارب', g, { transform: 'rotate(12deg) scale(.9)' });
add('spin-in', 'لفّة', g, { transform: 'rotate(-180deg) scale(.4)' }, { dur: 800 });
add('spin-in-cw', 'لفّة مع العقارب', g, { transform: 'rotate(180deg) scale(.4)' }, { dur: 800 });
add('spiral', 'حلزون', g, { transform: 'rotate(-540deg) scale(0)' }, { dur: 950 });
add('newspaper', 'جريدة دوّارة', g, { transform: 'rotate(720deg) scale(0)' }, { dur: 1000 });
add('roll-left', 'تدحرج من اليسار', g, { transform: 'translateX(-100%) rotate(-120deg)' }, { dur: 850 });
add('roll-right', 'تدحرج من اليمين', g, { transform: 'translateX(100%) rotate(120deg)' }, { dur: 850 });
add('pivot-left', 'محور الزاوية اليسرى', g, [{ opacity: 0, transform: 'rotate(-90deg)', transformOrigin: 'bottom left' }, { ...N, transformOrigin: 'bottom left' }], { ease: E.back, dur: 800 });
add('pivot-right', 'محور الزاوية اليمنى', g, [{ opacity: 0, transform: 'rotate(90deg)', transformOrigin: 'bottom right' }, { ...N, transformOrigin: 'bottom right' }], { ease: E.back, dur: 800 });

// 5) ارتداد ومرونة (19)
g = 'ارتداد ومرونة';
add('bounce-in', 'ارتداد', g, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1.1)', offset: 0.5 }, { transform: 'scale(.95)', offset: 0.75 }, N], { dur: 800, ease: E.soft });
for (const [k, l, a, b] of [['up', 'من الأسفل', 'translateY(120px)', 'translateY(-14px)'], ['down', 'من الأعلى', 'translateY(-120px)', 'translateY(14px)'], ['left', 'من اليسار', 'translateX(-120px)', 'translateX(14px)'], ['right', 'من اليمين', 'translateX(120px)', 'translateX(-14px)']]) {
  add(`bounce-${k}`, `ارتداد ${l}`, g, [{ opacity: 0, transform: a }, { opacity: 1, transform: b, offset: 0.6 }, { transform: b.replace(/-?\d+px/, (v) => `${-parseInt(v, 10) / 3}px`), offset: 0.8 }, N], { dur: 850, ease: E.soft });
}
add('elastic', 'مطاطي', g, [{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1.25)', offset: 0.4 }, { transform: 'scale(.85)', offset: 0.6 }, { transform: 'scale(1.08)', offset: 0.8 }, N], { dur: 900, ease: E.soft });
add('elastic-x', 'مطاطي أفقي', g, [{ opacity: 0, transform: 'scaleX(0)' }, { opacity: 1, transform: 'scaleX(1.2)', offset: 0.45 }, { transform: 'scaleX(.9)', offset: 0.7 }, N], { dur: 850, ease: E.soft });
add('elastic-y', 'مطاطي عمودي', g, [{ opacity: 0, transform: 'scaleY(0)' }, { opacity: 1, transform: 'scaleY(1.2)', offset: 0.45 }, { transform: 'scaleY(.9)', offset: 0.7 }, N], { dur: 850, ease: E.soft });
add('rubber', 'شريط مطاطي', g, [{ opacity: 0, transform: 'scale3d(1,1,1)' }, { opacity: 1, transform: 'scale3d(1.25,.75,1)', offset: 0.3 }, { transform: 'scale3d(.75,1.25,1)', offset: 0.45 }, { transform: 'scale3d(1.15,.85,1)', offset: 0.6 }, { transform: 'scale3d(.95,1.05,1)', offset: 0.8 }, N], { dur: 900, ease: E.soft });
add('jello', 'جيلي', g, [{ opacity: 0, transform: 'skew(-12deg, -12deg)' }, { opacity: 1, transform: 'skew(6deg, 6deg)', offset: 0.35 }, { transform: 'skew(-3deg, -3deg)', offset: 0.6 }, { transform: 'skew(1.5deg, 1.5deg)', offset: 0.8 }, N], { dur: 900, ease: E.soft });
add('tada', 'تادا', g, [{ opacity: 0, transform: 'scale(.9) rotate(-3deg)' }, { opacity: 1, transform: 'scale(1.1) rotate(3deg)', offset: 0.3 }, { transform: 'scale(1.1) rotate(-3deg)', offset: 0.5 }, { transform: 'scale(1.1) rotate(3deg)', offset: 0.7 }, N], { dur: 900, ease: E.soft });
add('heartbeat', 'نبض قلب', g, [{ opacity: 0, transform: 'scale(.8)' }, { opacity: 1, transform: 'scale(1.15)', offset: 0.25 }, { transform: 'scale(.95)', offset: 0.45 }, { transform: 'scale(1.1)', offset: 0.65 }, N], { dur: 900, ease: E.soft });
add('wobble', 'اهتزاز', g, [{ opacity: 0, transform: 'translateX(-25%) rotate(-5deg)' }, { opacity: 1, transform: 'translateX(20%) rotate(3deg)', offset: 0.3 }, { transform: 'translateX(-10%) rotate(-3deg)', offset: 0.55 }, { transform: 'translateX(5%) rotate(2deg)', offset: 0.75 }, N], { dur: 900, ease: E.soft });
for (const [k, l, t] of [['up', 'من الأسفل', 'translateY(120px)'], ['down', 'من الأعلى', 'translateY(-120px)'], ['left', 'من اليسار', 'translateX(-120px)'], ['right', 'من اليمين', 'translateX(120px)']]) {
  add(`back-${k}`, `رجوع ${l}`, g, [{ opacity: 0, transform: `${t} scale(.7)` }, { opacity: 0.7, transform: 'scale(.7)', offset: 0.7 }, N], { dur: 850 });
}
add('drop-bounce', 'سقوط وارتداد', g, [{ opacity: 0, transform: 'translateY(-200px)' }, { opacity: 1, transform: 'translateY(0)', offset: 0.55 }, { transform: 'translateY(-24px)', offset: 0.72 }, { transform: 'translateY(0)', offset: 0.86 }, { transform: 'translateY(-6px)', offset: 0.93 }, N], { dur: 1000, ease: 'ease-out' });
add('jelly-pop', 'فقاعة جيلي', g, [{ opacity: 0, transform: 'scale(.3) skew(10deg)' }, { opacity: 1, transform: 'scale(1.08) skew(-4deg)', offset: 0.6 }, N], { dur: 750, ease: E.soft });

// 6) كشف وقصّ (16)
g = 'كشف وقصّ';
const clip = (k, l, a, b, o = {}) => add(k, l, g, [{ clipPath: a, opacity: 0.4 }, { clipPath: b, opacity: 1 }], { dur: o.dur || 800, ease: o.ease || E.io });
clip('circle', 'دائرة من المنتصف', 'circle(0% at 50% 50%)', 'circle(150% at 50% 50%)');
for (const [k, l, at] of [['tl', 'أعلى اليسار', '0% 0%'], ['tr', 'أعلى اليمين', '100% 0%'], ['bl', 'أسفل اليسار', '0% 100%'], ['br', 'أسفل اليمين', '100% 100%']]) clip(`circle-${k}`, `دائرة من ${l}`, `circle(0% at ${at})`, `circle(150% at ${at})`);
clip('diamond', 'ماسة', 'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)', 'polygon(50% -50%, 150% 50%, 50% 150%, -50% 50%)');
for (const [k, l, a] of [['wipe-right', 'مسح لليمين', 'inset(0 100% 0 0)'], ['wipe-left', 'مسح لليسار', 'inset(0 0 0 100%)'], ['wipe-up', 'مسح للأعلى', 'inset(100% 0 0 0)'], ['wipe-down', 'مسح للأسفل', 'inset(0 0 100% 0)']]) clip(k, l, a, 'inset(0 0 0 0)');
clip('curtain-x', 'ستارة أفقية', 'inset(0 50% 0 50%)', 'inset(0 0 0 0)');
clip('curtain-y', 'ستارة عمودية', 'inset(50% 0 50% 0)', 'inset(0 0 0 0)');
clip('iris', 'عدسة', 'inset(40% 40% 40% 40% round 50%)', 'inset(0 0 0 0 round 0%)');
clip('slit', 'شق رفيع', 'inset(0 49% 0 49%)', 'inset(0 0 0 0)', { ease: 'cubic-bezier(.86,0,.07,1)' });
clip('triangle', 'مثلث', 'polygon(50% 0%, 50% 0%, 50% 0%)', 'polygon(50% -120%, 220% 160%, -120% 160%)');
clip('corner-wipe', 'مسح قطري', 'polygon(0% 0%, 0% 0%, 0% 0%)', 'polygon(0% 0%, 220% 0%, 0% 220%)');

// 7) تأثيرات سينمائية (15)
g = 'تأثيرات سينمائية';
add('blur-in', 'ضباب', g, { filter: 'blur(20px)' }, { dur: 700 });
add('blur-up', 'ضباب صاعد', g, { filter: 'blur(12px)', transform: 'translateY(30px)' });
add('focus', 'تركيز العدسة', g, { filter: 'blur(16px) brightness(1.8)' }, { dur: 800 });
add('glitch', 'جليتش رقمي', g, [{ opacity: 0, transform: 'translate(-6px, 2px) skewX(12deg)', filter: 'hue-rotate(90deg)' }, { opacity: 1, transform: 'translate(5px, -2px) skewX(-8deg)', filter: 'hue-rotate(-60deg)', offset: 0.25 }, { transform: 'translate(-3px, 1px)', filter: 'hue-rotate(40deg)', offset: 0.5 }, { transform: 'translate(2px, 0)', filter: 'none', offset: 0.75 }, N], { dur: 600, ease: 'linear' });
add('lightspeed-left', 'سرعة الضوء من اليسار', g, [{ opacity: 0, transform: 'translateX(-100%) skewX(30deg)' }, { opacity: 1, transform: 'skewX(-20deg)', offset: 0.6 }, { transform: 'skewX(5deg)', offset: 0.8 }, N], { dur: 750, ease: 'ease-out' });
add('lightspeed-right', 'سرعة الضوء من اليمين', g, [{ opacity: 0, transform: 'translateX(100%) skewX(-30deg)' }, { opacity: 1, transform: 'skewX(20deg)', offset: 0.6 }, { transform: 'skewX(-5deg)', offset: 0.8 }, N], { dur: 750, ease: 'ease-out' });
add('skew-left', 'ميل من اليسار', g, { transform: 'translateX(-40px) skewX(25deg)' });
add('skew-right', 'ميل من اليمين', g, { transform: 'translateX(40px) skewX(-25deg)' });
add('unfold', 'انبساط', g, [{ opacity: 0, transform: 'scaleY(.02) scaleX(0)' }, { opacity: 1, transform: 'scaleY(.02) scaleX(1)', offset: 0.45 }, N], { dur: 900, ease: E.io });
add('fold', 'طيّ معكوس', g, [{ opacity: 0, transform: 'scaleX(.02) scaleY(0)' }, { opacity: 1, transform: 'scaleX(.02) scaleY(1)', offset: 0.45 }, N], { dur: 900, ease: E.io });
add('flash', 'وميض', g, [{ opacity: 0, filter: 'brightness(3)' }, { opacity: 1, filter: 'brightness(2)', offset: 0.3 }, { opacity: 0.5, offset: 0.5 }, N], { dur: 700, ease: 'ease-out' });
add('hue', 'تحوّل ألوان', g, { filter: 'hue-rotate(180deg) saturate(2)' }, { dur: 800 });
add('float', 'طفو هادئ', g, { transform: 'translateY(24px)' }, { dur: 1000, ease: E.soft });
add('typewriter', 'آلة كاتبة', g, [{ clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0)' }], { dur: 900, ease: 'steps(14, end)' });
add('cinematic', 'سينمائي', g, { transform: 'scale(1.08)', filter: 'blur(6px) brightness(.4)' }, { dur: 1100, ease: E.soft });

export const TRANSITIONS = L;
const MAP = new Map(L.map((t) => [t.k, t]));
const LEGACY = { slide: 'slide-left', zoom: 'zoom-in', flip: 'flip-x', up: 'slide-up' }; // أسماء الإعدادات القديمة
export const resolveKey = (k) => (MAP.has(LEGACY[k] || k) ? LEGACY[k] || k : null);
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.body?.dataset.motion === 'off';

export function play(el, key, { dur, delay = 0 } = {}) {
  const t = MAP.get(LEGACY[key] || key);
  if (!t || !el?.animate || reduce()) return null;
  return el.animate(t.frames, { duration: dur || t.dur, easing: t.ease, delay, fill: 'backwards' });
}

// خيارات القائمة مجمّعة حسب النوع (للوحة التحكم)
export function optionGroups() {
  const out = new Map();
  for (const t of L) { if (!out.has(t.group)) out.set(t.group, []); out.get(t.group).push(t); }
  return [...out];
}
