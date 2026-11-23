// محتوى الموقع القابل للتعديل من لوحة المدير + القيم الافتراضية
import { KINDS } from './core.js';

export const SECTIONS = {
  python: { path: '/python', nav: 'Python' }, apk: { path: '/apk', nav: 'Android APK' }, course: { path: '/courses', nav: 'الكورسات' },
  video: { path: '/videos', nav: 'الفيديوهات' }, file: { path: '/files', nav: 'الملفات والمشاريع' }, free: { path: '/free', nav: 'المجانية' },
  paid: { path: '/paid', nav: 'المدفوعة' }, latest: { path: '/latest', nav: 'الأحدث' }, top: { path: '/top', nav: 'الأكثر تحميلاً' },
};
const EXTRA = {
  free: ['المنتجات المجانية', 'حمّل مباشرة دون أي دفع'], paid: ['المنتجات المدفوعة', 'أدوات وكورسات احترافية مميزة'],
  latest: ['أحدث المنتجات', 'آخر ما أُضيف للمتجر'], top: ['الأكثر تحميلاً', 'الأكثر طلباً من المستخدمين'],
};
export const DEFAULT_CONTENT = {
  intro: { enabled: false, media_type: 'image', media_url: null, text: '', duration: 3, every_visit: false },
  hero: { image_anim: 'coin', logo_anim: 'none',
    badge: 'متجر المبرمج المجهول', title: 'أدوات وتطبيقات وكورسات', highlight: 'للمبرمجين وعشاق الأمن السيبراني', subtitle: '',
    cta1_text: 'تصفّح المتجر', cta1_link: '/latest', cta2_text: 'المنتجات المجانية', cta2_link: '/free', image_url: null, show_terminal: true,
    terminal: ['$ anon-store --status', '[✓] تحميل آمن عبر روابط موقّعة ومؤقتة', '[✓] ملفات وفيديوهات بجودتها الأصلية', '[✓] رفع ملفات ضخمة قابل للاستكمال', '[✓] حماية ومراقبة أمنية مستمرة', '$ welcome --user guest'],
  },
  sections: Object.fromEntries(Object.keys(SECTIONS).map((k) => [k, { title: KINDS[k]?.plural || EXTRA[k][0], nav: SECTIONS[k].nav, desc: KINDS[k]?.desc || EXTRA[k][1], image_url: null }])),
  features: [
    { icon: 'shield', title: 'حماية متعددة الطبقات', text: 'صلاحيات محمية من الخادم وقاعدة البيانات، ومراقبة لمحاولات الاختراق.' },
    { icon: 'lock', title: 'روابط تحميل موقّعة', text: 'كل رابط مؤقت ويصدر بعد التحقق من صلاحيتك فقط.' },
    { icon: 'play', title: 'جودة أصلية', text: 'لا ضغط للفيديوهات أو الملفات — تحصل على النسخة الأصلية.' },
    { icon: 'cart', title: 'دفع محلي في العراق', text: 'طلب برقم مرجعي وتأكيد سريع عبر واتساب أو تيليجرام.' },
  ],
  banners: [],
  show: { banners: true, sections: true, latest: true, top: true, features: true, contact: true },
  contact: { title: 'تواصل مع المبرمج المجهول', text: 'للدعم والاستفسارات وطلبات الشراء' },
  footer: { text: 'المبرمج المجهول — جميع الحقوق محفوظة', about: '' },
};

const merge = (d, v = {}) => { const o = { ...d }; for (const k in v) if (v[k] !== '' && v[k] != null) o[k] = v[k]; return o; };
export function getContent(state) {
  const c = state.settings.content || {};
  return {
    hero: merge(DEFAULT_CONTENT.hero, c.hero),
    sections: Object.fromEntries(Object.keys(SECTIONS).map((k) => [k, merge(DEFAULT_CONTENT.sections[k], c.sections?.[k])])),
    features: c.features?.length ? c.features : DEFAULT_CONTENT.features,
    banners: c.banners || [],
    show: { ...DEFAULT_CONTENT.show, ...(c.show || {}) },
    contact: merge(DEFAULT_CONTENT.contact, c.contact),
    footer: merge(DEFAULT_CONTENT.footer, c.footer),
    intro: merge(DEFAULT_CONTENT.intro, c.intro),
    covers_anim: c.covers_anim || 'none',
  };
}
export const BRAND = {
  appIcon: 'https://br-autumn-cake-bai4zvy6.storage.c-8.eu-central-1.aws.neon.tech/media/brand/app-icon',
  share: 'https://br-autumn-cake-bai4zvy6.storage.c-8.eu-central-1.aws.neon.tech/media/brand/share',
};
