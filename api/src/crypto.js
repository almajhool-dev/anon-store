// طبقة تشفير إضافية للبيانات الخاصة (رسائل التواصل، الردود، ملاحظات الطلبات): AES-256-GCM
// المفتاح 256-bit عشوائي داخل ops.secrets — دور store_api لا يصل إليه، فحتى مع ثغرة SQL يبقى النص مشفّراً
let keyP = null;
const b64u = (u8) => Buffer.from(u8).toString('base64url');
const unb64u = (s) => new Uint8Array(Buffer.from(s, 'base64url'));
function dataKey(q) {
  // مفتاح بديل اختياري من متغير بيئة (عند تشغيل الخادم بدور store_api مباشرة)
  if (!keyP && process.env.DATA_KEY) keyP = crypto.subtle.importKey('raw', Buffer.from(process.env.DATA_KEY, 'base64'), 'AES-GCM', false, ['encrypt', 'decrypt']);
  keyP ??= q(`select encode(value, 'base64') as k from ops.secrets where name = 'data_key_v1'`)
    .then((r) => { if (!r[0]?.k) throw new Error('data_key_missing'); return crypto.subtle.importKey('raw', Buffer.from(r[0].k, 'base64'), 'AES-GCM', false, ['encrypt', 'decrypt']); })
    .catch((e) => { keyP = null; throw e; });
  return keyP;
}
export async function seal(sys, text) {
  if (text == null || text === '') return text;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await dataKey(sys), new TextEncoder().encode(String(text)));
  return `enc1:${b64u(iv)}.${b64u(new Uint8Array(ct))}`;
}
export async function open(sys, v) {
  if (typeof v !== 'string' || !v.startsWith('enc1:')) return v; // بيانات قديمة غير مشفّرة تُعرض كما هي
  try {
    const [iv, ct] = v.slice(5).split('.');
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(iv) }, await dataKey(sys), unb64u(ct)));
  } catch { return '[تعذّر فك التشفير]'; }
}
