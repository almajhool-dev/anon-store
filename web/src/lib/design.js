// 🎨 نظام التصميم: 10 أقسام × 20 أسلوب = 200 واجهة حقيقية (تخطيط مختلف + أسلوب بصري مختلف + حركات)
// تُطبّق فوراً بدون إعادة تحميل عبر سمات data-lay/data-pack على جذر كل قسم ومتغيرات CSS (Design Tokens)
export const PACKS = [
  ['glass', 'زجاج فاخر'], ['luxury', 'داكن فاخر'], ['cyber', 'سايبربانك'], ['minimal', 'بسيط راقٍ'], ['saas', 'SaaS حديث'],
  ['apple', 'مستوحى من Apple'], ['future', 'مستقبلي 3D'], ['neon', 'نيون تقني'], ['light', 'فاتح أنيق'], ['motion', 'حركة متقدمة'],
  ['liquid', 'زجاج سائل'], ['holo', 'هولوغرافي'], ['swiss', 'سويسري'], ['editorial', 'تحريري'], ['bento', 'بينتو'],
  ['brutal', 'نيو بروتاليزم'], ['retro', 'طرفية ريترو'], ['clay', 'كلاي ناعم'], ['aurora', 'شفق قطبي'], ['mono', 'أحادي اللون'],
];
const LAY = {
  bar: 'شريط', float: 'عائم', center: 'متمركز', tall: 'ضخم', minimal: 'خفيف', split: 'مقسوم', editorial: 'مجلة', bento: 'بلاطات', backdrop: 'خلفية الشعار',
  mirror: 'معكوس', grid: 'شبكة', list: 'قائمة', scroller: 'شريط تمرير', tiles: 'لوحات', circles: 'دوائر', classic: 'كلاسيكي', overlay: 'نص فوق الصورة',
  poster: 'ملصق', cover: 'غلاف عريض', centered: 'مركزي', side: 'جانبي', stack: 'متراص', theater: 'مسرح', banner: 'لافتة', compact: 'مضغوط',
  card: 'بطاقة', full: 'ملء الشاشة', wide: 'عريض', columns: 'أعمدة', big: 'علامة كبيرة', lift: 'رفع', glow: 'توهج', shine: 'لمعة', press: 'ضغط 3D',
  sweep: 'تعبئة', outline: 'رسم الحافة', ripple: 'موجة', gradient: 'تدرج متحرك', pulse: 'نبض', jelly: 'جيلي',
};
export const SECTIONS = {
  header: ['رأس الموقع', ['bar', 'float', 'center', 'tall', 'minimal'], '/'],
  hero: ['الواجهة الرئيسية', ['split', 'center', 'editorial', 'bento', 'backdrop', 'mirror'], '/'],
  cats: ['بطاقات الأقسام', ['grid', 'bento', 'list', 'scroller', 'tiles', 'circles'], '/'],
  cards: ['بطاقات المنتجات والتطبيقات', ['classic', 'overlay', 'list', 'poster', 'minimal', 'float'], '/latest'],
  product: ['صفحة المنتج', ['split', 'cover', 'mirror', 'centered'], 'product'],
  learn: ['مشغل الكورسات والمقاطع', ['side', 'stack', 'mirror', 'theater'], 'learn'],
  account: ['الحساب الشخصي', ['classic', 'centered', 'banner', 'compact'], '/account'],
  auth: ['الدخول وإنشاء الحساب', ['card', 'split', 'full', 'wide'], '/login?dsp=1'],
  footer: ['ذيل الموقع', ['columns', 'centered', 'big', 'minimal'], '/'],
  buttons: ['الأزرار وحركاتها', ['lift', 'glow', 'shine', 'press', 'sweep', 'outline', 'ripple', 'gradient', 'pulse', 'jelly'], '/'],
};
// كل قسم يأخذ الأساليب العشرين مرة واحدة، والتخطيطات تتوزع عليها → لا تتكرر واجهة داخل نفس القسم
export const PRESETS = Object.entries(SECTIONS).flatMap(([sec, [, lays]]) => PACKS.map(([pack, pl], i) => {
  const lay = lays[i % lays.length];
  return { id: `${sec}-${lay}-${pack}`, sec, lay, pack, name: `${pl} · ${LAY[lay]}`, packLabel: pl };
}));
const BY_ID = new Map(PRESETS.map((p) => [p.id, p]));
export const preset = (id) => BY_ID.get(id) || null;

// مكتبة الخطوط: ذاتية الاستضافة (CSP) — Cairo بكل الأوزان 200–1000 وTajawal بأوزان 200–900 تُحمَّل عند الحاجة فقط + خطوط الجهاز
export const FONTS_AR = { cairo: ["'Cairo Variable', 'Cairo'", 'Cairo — عصري (افتراضي)'], tajawal: ["'Tajawal'", 'Tajawal — نظيف أنيق'], system: ["system-ui, 'Segoe UI', Tahoma", 'خط الجهاز — الأسرع'], naskh: ["'Noto Naskh Arabic', 'Geeza Pro', 'Times New Roman', serif", 'نسخ كلاسيكي (خط الجهاز)'] };
export const FONTS_EN = { same: ['', 'نفس الخط العربي'], system: ["system-ui, -apple-system, 'Segoe UI', Roboto", 'System UI'], mono: ["ui-monospace, 'SF Mono', Menlo, Consolas, monospace", 'Monospace — تقني'], serif: ["Georgia, 'Times New Roman', serif", 'Serif — كلاسيكي'] };
export const FONTS_HEAD = { same: ['', 'نفس خط النص'], cairo: ["'Cairo Variable', 'Cairo'", 'Cairo'], tajawal: ["'Tajawal'", 'Tajawal'], naskh: [FONTS_AR.naskh[0], 'نسخ كلاسيكي — فاخر'], serif: ["Georgia, 'Noto Naskh Arabic', 'Geeza Pro', serif", 'Serif فاخر'], mono: [FONTS_EN.mono[0], 'Mono — سايبر'], system: [FONTS_AR.system[0], 'خط الجهاز'] };
export const DEFAULT_TOKENS = { font_ar: 'cairo', font_en: 'same', font_head: 'same', hw: 'auto', hs: 'normal', quality: 'auto', radius: 12, scale: 1, space: 1, glass: 1, stroke: 2, motion: 'normal', mode: 'dark' };
// مستويات الجودة: السقف من لوحة التحكم، والجهاز الضعيف ينزل تلقائياً، والزائر يستطيع فرض «الوضع الخفيف»
export const QUALITY = [['auto', 'تلقائي حسب الجهاز (موصى به)'], ['low', 'LOW — أخف ما يمكن'], ['medium', 'MEDIUM'], ['high', 'HIGH'], ['very_high', 'VERY HIGH'], ['premium', 'PREMIUM'], ['ultra', 'ULTRA'], ['ultra_max', 'ULTRA MAX'], ['ultra_maximum', 'ULTRA MAXIMUM — كل المؤثرات']];
const QL = { low: 1, medium: 2, high: 3, very_high: 4, premium: 5, ultra: 6, ultra_max: 7, ultra_maximum: 8, auto: 8 };
export const lite = () => { try { return localStorage.getItem('lite') === '1'; } catch { return false; } };
export function deviceCap() {
  const n = navigator, c = n.connection || {}, mem = n.deviceMemory, cores = n.hardwareConcurrency || 8;
  if (c.saveData || /(^|-)2g$/.test(c.effectiveType || '') || matchMedia('(prefers-reduced-motion: reduce)').matches || (mem && mem <= 1)) return 1;
  if ((mem && (mem <= 2 || cores <= 4)) || cores <= 2 || c.effectiveType === '3g') return 2;
  if (mem && mem <= 4) return 4;
  return mem >= 8 && cores >= 8 ? 8 : 6;
}
export const initQuality = () => { document.body.dataset.q = String(lite() ? 1 : deviceCap()); };
let tj = null; // أوزان Tajawal الإضافية (موجودة محلياً، تُحمَّل عند اختيار الخط فقط)
const loadTajawal = () => (tj ??= Promise.all([import('@fontsource/tajawal/200.css'), import('@fontsource/tajawal/300.css'), import('@fontsource/tajawal/500.css'), import('@fontsource/tajawal/800.css'), import('@fontsource/tajawal/900.css')]).catch(() => { tj = null; }));
// تصاميم كاملة بنقرة: أسلوب موحّد للأقسام العشرة + خطوط وأوزان وحركة مناسبة
export const BUNDLES = [
  ['pro', 'PRO', 'saas', { font_ar: 'cairo', font_en: 'system', font_head: 'same', hw: '700', hs: 'normal', radius: 10, motion: 'normal' }],
  ['max', 'MAX', 'bento', { font_ar: 'tajawal', font_en: 'same', font_head: 'same', hw: '800', hs: 'normal', radius: 18, motion: 'normal' }],
  ['ultra', 'ULTRA', 'liquid', { font_ar: 'cairo', font_en: 'same', font_head: 'same', hw: '900', hs: 'gradient', radius: 22, motion: 'strong' }],
  ['premium', 'PREMIUM', 'luxury', { font_ar: 'tajawal', font_en: 'serif', font_head: 'serif', hw: '700', hs: 'normal', radius: 4, motion: 'normal' }],
  ['elite', 'ELITE', 'apple', { font_ar: 'tajawal', font_en: 'system', font_head: 'same', hw: '700', hs: 'normal', radius: 24, motion: 'normal' }],
  ['future', 'FUTURE', 'future', { font_ar: 'cairo', font_en: 'same', font_head: 'same', hw: '800', hs: 'glow', radius: 16, motion: 'strong' }],
  ['cyber', 'CYBER', 'cyber', { font_ar: 'cairo', font_en: 'mono', font_head: 'mono', hw: '900', hs: 'glow', radius: 0, motion: 'normal' }],
  ['enterprise', 'ENTERPRISE', 'swiss', { font_ar: 'cairo', font_en: 'system', font_head: 'same', hw: '700', hs: 'normal', radius: 6, motion: 'normal' }],
];

let cur = {}, mo = null, mq = matchMedia('(max-width: 760px)'), dark = matchMedia('(prefers-color-scheme: dark)');
const map = () => (cur.mobile_on && mq.matches ? { ...(cur.sections || {}), ...(cur.mobile || {}) } : cur.sections || {});
const PREVIEW = window.parent !== window && new URLSearchParams(location.search).has('dsp');

// 🌗 وضع الألوان (مثل Claude): اختيار الزائر على جهازه (النظام/داكن/فاتح) يتقدّم على الافتراضي الذي يضبطه المدير في الاستوديو.
// public/boot.js يقرأ نفس المفتاحين قبل أول رسم فلا يومض الوضع الخطأ.
export const MODES = ['system', 'dark', 'light'];
const store = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* تخزين غير متاح */ } };
export function userMode() {
  if (PREVIEW) return ''; // معاينة الاستوديو تعرض مسودة المدير كما هي
  try { const v = localStorage.getItem('cmode'); return MODES.includes(v) ? v : ''; } catch { return ''; }
}
const siteMode = (t) => (t.mode === 'auto' ? 'system' : t.mode === 'light' ? 'light' : 'dark');
export const colorMode = () => userMode() || siteMode({ ...DEFAULT_TOKENS, ...(cur.tokens || {}) });
export function setColorMode(m) {
  store('cmode', MODES.includes(m) ? m : '');
  applyDesign(cur);
}
function applyMode(t) {
  const want = userMode() || siteMode(t), mode = want === 'system' ? (dark.matches ? 'dark' : 'light') : want;
  const b = document.body, h = document.documentElement;
  if (!PREVIEW) store('cmode_site', siteMode(t));
  if (b.dataset.mode !== mode) { b.dataset.mode = mode; h.dataset.mode = mode; h.style.colorScheme = mode; }
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = mode === 'light' ? '#f5f7fb' : meta.dataset.dark || '#05060b'; // لون شريط المتصفح يتبع الوضع
  if (b.dataset.modePref !== want) { b.dataset.modePref = want; dispatchEvent(new CustomEvent('ds:mode', { detail: want })); }
}

function stamp(root = document) {
  const m = map();
  const els = root.querySelectorAll ? [...root.querySelectorAll('[data-sec]:not([data-ds-fixed])')] : [];
  if (root.matches?.('[data-sec]:not([data-ds-fixed])')) els.push(root);
  for (const el of els) {
    const p = preset(m[el.dataset.sec]);
    if (p) { if (el.dataset.lay !== p.lay) el.dataset.lay = p.lay; if (el.dataset.pack !== p.pack) el.dataset.pack = p.pack; }
    else { delete el.dataset.lay; delete el.dataset.pack; }
  }
}

export function applyDesign(d) {
  cur = d && typeof d === 'object' ? d : {};
  const t = { ...DEFAULT_TOKENS, ...(cur.tokens || {}) }, r = document.documentElement.style, b = document.body;
  r.setProperty('--fs-scale', t.scale); r.setProperty('--space', t.space); r.setProperty('--r-btn', `${t.radius}px`);
  r.setProperty('--ic-stroke', t.stroke); r.setProperty('--surface-a', t.glass);
  const body = [(FONTS_EN[t.font_en] || FONTS_EN.same)[0], (FONTS_AR[t.font_ar] || FONTS_AR.cairo)[0], 'system-ui, sans-serif'].filter(Boolean).join(', ');
  if (cur.tokens && (t.font_ar !== 'cairo' || t.font_en !== 'same')) { r.setProperty('--ds-font', body); b.dataset.dsfont = '1'; } else { r.removeProperty('--ds-font'); delete b.dataset.dsfont; }
  const head = (FONTS_HEAD[t.font_head] || FONTS_HEAD.same)[0];
  if (head) { r.setProperty('--ds-head-font', `${head}, ${body}`); b.dataset.dshead = '1'; } else { r.removeProperty('--ds-head-font'); delete b.dataset.dshead; }
  if (t.hw && t.hw !== 'auto') { r.setProperty('--hw', t.hw); b.dataset.hw = '1'; } else { r.removeProperty('--hw'); delete b.dataset.hw; }
  if (t.hs && t.hs !== 'normal') b.dataset.hs = t.hs; else delete b.dataset.hs;
  if (t.font_ar === 'tajawal' || t.font_head === 'tajawal') loadTajawal();
  b.dataset.motion = t.motion;
  applyMode(t);
  const q = String(lite() ? 1 : Math.min(QL[t.quality] || 8, deviceCap()));
  if (b.dataset.q !== q) { b.dataset.q = q; dispatchEvent(new CustomEvent('ds:q', { detail: Number(q) })); }
  const btn = preset(map().buttons);
  if (btn) { b.dataset.bpack = btn.pack; b.dataset.bfx = btn.lay; } else { delete b.dataset.bpack; delete b.dataset.bfx; }
  stamp(document);
}
export const currentDesign = () => cur;

export function startDesign(d) {
  applyDesign(d);
  if (mo) return;
  mo = new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) stamp(n); });
  mo.observe(document.body, { childList: true, subtree: true });
  mq.addEventListener?.('change', () => applyDesign(cur));
  dark.addEventListener?.('change', () => { if (colorMode() === 'system') applyDesign(cur); });
  addEventListener('storage', (e) => { if (e.key === 'cmode') applyDesign(cur); }); // تغيير الوضع من تبويب آخر
  // معاينة داخل استوديو التصميم (نافذة مضمّنة من نفس الموقع فقط)
  if (window.parent !== window && new URLSearchParams(location.search).has('dsp')) {
    addEventListener('message', (e) => { if (e.origin === location.origin && e.data?.type === 'ds') applyDesign(e.data.design); });
    parent.postMessage({ type: 'ds-ready' }, location.origin);
  }
}
