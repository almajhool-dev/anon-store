// الإعداد، المصادقة (Neon Auth + Google)، عميل الـ API، والتنسيق
import { createAuthClient } from '@neon/neon-js/auth';

export const API_URL = import.meta.env.VITE_API_URL || 'https://br-autumn-cake-bai4zvy6-api.compute.c-8.eu-central-1.aws.neon.tech';
// المصادقة عبر نفس نطاق الموقع (وكيل Netlify) حتى تُحفظ الجلسة على آيفون/سفاري الذي يحظر كوكيز الطرف الثالث
export const AUTH_URL = import.meta.env.VITE_AUTH_URL || `${location.origin}/api/auth`;

// ---------- المصادقة ----------
const client = createAuthClient(AUTH_URL);
let jwt = null, exp = 0, user = null, refreshing = null;
const claims = (t) => { try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { return null; } };
const take = (t) => { const c = t && t.split('.').length === 3 && claims(t); if (c?.exp) { jwt = t; exp = c.exp * 1000; } };
async function refresh() {
  try {
    const { data } = await client.getSession();
    user = data?.user || null;
    if (user) take(data.session?.token); else { jwt = null; exp = 0; }
  } catch { /* شبكة */ }
}
async function call(p) {
  const r = await p;
  if (r?.error) { const e = new Error(r.error.message || 'auth_error'); e.code = r.error.code || ''; e.status = r.error.status; throw e; }
  return r?.data;
}
export const auth = {
  get signedIn() { return !!user; },
  get user() { return user; },
  init: () => refresh().then(() => user),
  async token() {
    if (!user) return null;
    if (jwt && exp - Date.now() > 60000) return jwt;
    await (refreshing ||= refresh().finally(() => { refreshing = null; }));
    return user ? jwt : null;
  },
  invalidate() { jwt = null; exp = 0; },
  google: (next = '/account') => client.signIn.social({ provider: 'google', callbackURL: location.origin + next }),
  // الحساب بالبريد: تسجيل، دخول، رمز تأكيد، واستعادة كلمة السر برمز
  email: {
    signIn: (email, password, rememberMe = true) => call(client.signIn.email({ email, password, rememberMe })),
    signUp: (name, email, password) => call(client.signUp.email({ name, email, password })),
    sendOtp: (email, type) => call(client.emailOtp.sendVerificationOtp({ email, type })),
    verify: (email, otp) => call(client.emailOtp.verifyEmail({ email, otp })),
    reset: (email, otp, password) => call(client.emailOtp.resetPassword({ email, otp, password })),
  },
  async signOut() { try { await client.signOut(); } catch { /* تجاهل */ } user = null; jwt = null; exp = 0; },
};

// ---------- الـ API ----------
const MSG = {
  network: 'تعذر الاتصال بالخادم، تحقق من الإنترنت', rate_limited: 'طلبات كثيرة، انتظر قليلاً ثم حاول مجدداً', auth_required: 'سجّل الدخول أولاً',
  invalid_token: 'انتهت الجلسة، سجّل الدخول من جديد', forbidden: 'ليست لديك صلاحية لهذا الإجراء', banned: 'تم حظر حسابك', registration_closed: 'التسجيل مغلق حالياً',
  purchase_required: 'هذا المنتج مدفوع — يلزم الشراء أولاً', not_found: 'غير موجود', store_disabled: 'المتجر متوقف مؤقتاً', blocked: 'تم تقييد الوصول مؤقتاً لأسباب أمنية',
  file_not_found: 'لا يوجد ملف متاح لهذا المنتج بعد', review_not_allowed: 'يمكنك التقييم بعد التحميل أو الشراء', already_exists: 'موجود مسبقاً (الرابط المختصر مستخدم)',
  in_use: 'لا يمكن الحذف لوجود مبيعات مرتبطة — أخفِ المنتج بدلاً من ذلك', invalid_input: 'بيانات غير صالحة', storage_quota_exceeded: 'مساحة التخزين المجانية ممتلئة',
  file_type_not_allowed: 'نوع الملف غير مسموح', gateway_not_configured: 'بوابة الدفع غير متاحة بعد', server_error: 'خطأ في الخادم، حاول لاحقاً', payload_too_large: 'البيانات كبيرة جداً',
  invalid_claim: 'رمز التفعيل غير صحيح أو مستخدم', owner_exists: 'يوجد مالك للمتجر بالفعل', cannot_ban_self: 'لا يمكنك حظر نفسك', owner_immutable: 'لا يمكن تعديل حساب المالك',
  forbidden_ban_admin: 'حظر المدراء متاح للمالك فقط', product_is_free: 'المنتج مجاني', product_unavailable: 'المنتج غير متاح', image_type_not_allowed: 'الصور المسموحة: PNG, JPG, WEBP, GIF, ICO',
  upload_not_found: 'جلسة الرفع منتهية، ابدأ من جديد', parts_missing: 'بعض أجزاء الملف لم تُرفع بعد', cannot_block_self: 'لا يمكنك حظر عنوانك الحالي',
  file_flagged: 'الملف مُعلَّم كمشبوه، اعتمده أولاً', storage_error: 'خطأ في التخزين، حاول مجدداً', origin_not_allowed: 'مصدر الطلب غير مسموح', not_configured: 'الخادم غير مهيأ',
  user_not_found: 'المستخدم غير موجود', nothing_to_update: 'لا توجد تغييرات', bad_request: 'طلب مرفوض', invalid_slug: 'الرابط المختصر: حروف إنجليزية صغيرة وأرقام وشرطات فقط',
};
export const errMsg = (code) => MSG[code] || (code?.startsWith?.('invalid_') ? 'قيمة غير صالحة: ' + code.slice(8) : 'حدث خطأ غير متوقع');
export class ApiError extends Error { constructor(status, code, data) { super(errMsg(code)); this.status = status; this.code = code; this.data = data; } }

async function req(method, path, body) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  const t = await auth.token();
  if (t) headers.authorization = 'Bearer ' + t;
  let r;
  try { r = await fetch(API_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); } catch { throw new ApiError(0, 'network'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { if (r.status === 401 && data.error === 'invalid_token') auth.invalidate(); throw new ApiError(r.status, data.error || 'server_error', data); }
  if (method !== 'GET' && /^\/admin\/(settings|design)\b/.test(path)) dispatchEvent(new Event('settings:changed')); // main.js يحدّث نسخة الجهاز
  return data;
}
export const api = {
  get: (p) => req('GET', p), post: (p, b = {}) => req('POST', p, b), patch: (p, b) => req('PATCH', p, b),
  put: (p, b) => req('PUT', p, b), del: (p) => req('DELETE', p),
};

// ---------- التنسيق ----------
const nf = new Intl.NumberFormat('en-US');
export const fmtNum = (n) => nf.format(n || 0);
export function fmtBytes(b) {
  if (!b) return '\u20660 B\u2069';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'], i = Math.min(4, Math.floor(Math.log(b) / Math.log(1024)));
  return `\u2066${(b / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}\u2069`;
}
export const fmtPrice = (v, cur) => (cur === 'IQD' ? `${fmtNum(Math.round(v))} د.ع` : `$${Number(v).toFixed(2).replace(/\.00$/, '')}`);
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('ar-IQ-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('ar-IQ-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export function ago(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return 'الآن';
  if (s < 3600) return `قبل ${Math.floor(s / 60)} دقيقة`;
  if (s < 86400) return `قبل ${Math.floor(s / 3600)} ساعة`;
  return `قبل ${Math.floor(s / 86400)} يوم`;
}
export const fmtDur = (s) => { s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
export const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export const KINDS = {
  python: { label: 'أداة Python', plural: 'أدوات Python', path: '/python', desc: 'سكربتات وأدوات Python جاهزة للأتمتة والأمن والتحليل.' },
  apk: { label: 'تطبيق Android', plural: 'تطبيقات Android', path: '/apk', desc: 'تطبيقات APK مجرّبة وآمنة لأجهزة أندرويد.' },
  course: { label: 'كورس', plural: 'الكورسات التعليمية', path: '/courses', desc: 'كورسات مقسّمة لدروس مع حفظ تقدّمك تلقائياً.' },
  video: { label: 'فيديو', plural: 'الفيديوهات', path: '/videos', desc: 'فيديوهات تعليمية بجودتها الأصلية دون ضغط.' },
  file: { label: 'ملف / مشروع', plural: 'الملفات والمشاريع', path: '/files', desc: 'مشاريع كاملة وملفات مصدرية ومستندات مفيدة.' },
};
