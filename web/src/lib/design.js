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

export const FONTS_AR = { cairo: "'Cairo Variable', 'Cairo'", tajawal: "'Tajawal'", system: "system-ui, 'Segoe UI', Tahoma", naskh: "'Noto Naskh Arabic', 'Geeza Pro', 'Times New Roman', serif" };
export const FONTS_EN = { same: '', system: "system-ui, -apple-system, 'Segoe UI', Roboto", mono: "ui-monospace, 'SF Mono', Menlo, monospace", serif: "Georgia, 'Times New Roman', serif" };
export const DEFAULT_TOKENS = { font_ar: 'cairo', font_en: 'same', radius: 12, scale: 1, space: 1, glass: 1, stroke: 2, motion: 'normal', mode: 'dark' };

let cur = {}, mo = null, mq = matchMedia('(max-width: 760px)'), dark = matchMedia('(prefers-color-scheme: dark)');
const map = () => (cur.mobile_on && mq.matches ? { ...(cur.sections || {}), ...(cur.mobile || {}) } : cur.sections || {});

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
  if (cur.tokens && (t.font_ar !== 'cairo' || t.font_en !== 'same')) { r.setProperty('--ds-font', [FONTS_EN[t.font_en], FONTS_AR[t.font_ar] || FONTS_AR.cairo, 'system-ui, sans-serif'].filter(Boolean).join(', ')); b.dataset.dsfont = '1'; }
  else { r.removeProperty('--ds-font'); delete b.dataset.dsfont; }
  b.dataset.motion = t.motion;
  b.dataset.mode = t.mode === 'auto' ? (dark.matches ? 'dark' : 'light') : t.mode;
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
  dark.addEventListener?.('change', () => { if (cur.tokens?.mode === 'auto') applyDesign(cur); });
  // معاينة داخل استوديو التصميم (نافذة مضمّنة من نفس الموقع فقط)
  if (window.parent !== window && new URLSearchParams(location.search).has('dsp')) {
    addEventListener('message', (e) => { if (e.origin === location.origin && e.data?.type === 'ds') applyDesign(e.data.design); });
    parent.postMessage({ type: 'ds-ready' }, location.origin);
  }
}
