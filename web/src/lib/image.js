// رفع الصور والفيديو من الهاتف أو الكمبيوتر: تصغير الصور الثابتة تلقائياً، وحفظ حركة GIF/WebP/APNG كما هي
import { api } from './core.js';

const OK = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon'];
const MAX_ANIM = 15 * 1024 * 1024, MAX_VIDEO = 40 * 1024 * 1024;
export const IMAGE_ACCEPT = 'image/*,.ico';
export const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime';
// صورة متحركة؟ GIF دائماً، WebP بوجود ANIM، و PNG بوجود acTL (APNG)
async function animated(f) {
  if (/gif/.test(f.type)) return true;
  if (!/png|webp/.test(f.type)) return false;
  const s = new TextDecoder('latin1').decode(await f.slice(0, 256 * 1024).arrayBuffer());
  return /png/.test(f.type) ? s.includes('acTL') : s.includes('ANIM');
}
const isIco = (f) => /icon/.test(f.type) || /\.ico$/i.test(f.name || '');

// type: صيغة إلزامية (PNG لأيقونة الهاتف، JPEG لصورة المشاركة) — square: قص مربع من المنتصف بمقاس max بالضبط
export async function processImage(file, { max = 1920, square = false, type = null, keepIco = true } = {}) {
  if ((keepIco && isIco(file)) || (!type && await animated(file))) {
    if (file.size > MAX_ANIM) throw new Error('حجم الصورة المتحركة يتجاوز 15MB — صغّرها أو استخدم فيديو MP4');
    return file.type ? file : new File([file], file.name, { type: 'image/x-icon' });
  }
  let bmp;
  try { bmp = await createImageBitmap(file); } catch {
    if (!type && OK.includes(file.type) && file.size <= MAX_ANIM) return file;
    throw new Error('صيغة الصورة غير مدعومة — استخدم PNG أو JPG');
  }
  let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
  if (square && sw !== sh) { const s = Math.min(sw, sh); sx = (sw - s) / 2; sy = (sh - s) / 2; sw = sh = s; }
  const scale = square ? max / sw : Math.min(1, max / Math.max(sw, sh));
  // نُبقي الأصل فقط إن كان صغيراً فعلاً (PNG الكبير يُحوَّل لـ WebP أصغر بعشرات المرات)
  if (scale === 1 && sw === bmp.width && sh === bmp.height && file.size < (file.type === 'image/png' ? 100 : 300) * 1024 && (type ? file.type === type : OK.includes(file.type))) { bmp.close?.(); return file; }
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(sw * scale)); cv.height = Math.max(1, Math.round(sh * scale));
  const g = cv.getContext('2d');
  g.imageSmoothingQuality = 'high';
  if (type === 'image/jpeg') { g.fillStyle = '#05060b'; g.fillRect(0, 0, cv.width, cv.height); } // JPEG بلا شفافية
  g.drawImage(bmp, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
  bmp.close?.();
  const blob = (t, q) => new Promise((r) => cv.toBlob(r, t, q));
  const want = type || 'image/webp';
  let out = await blob(want, 0.9);
  if (!out || out.type !== want) {
    // متصفح لا يرمّز WebP (مثل Safari القديم): JPEG للصور المعتمة (أصغر بكثير)، وPNG فقط عند وجود شفافية
    const alpha = want !== 'image/jpeg' && (() => { try { const d = g.getImageData(0, 0, cv.width, cv.height).data; for (let i = 3; i < d.length; i += 28) if (d[i] < 250) return true; } catch { return true; } return false; })();
    out = await blob(want === 'image/jpeg' || !alpha ? 'image/jpeg' : 'image/png', 0.88);
  }
  return !type && out && out.size >= file.size && OK.includes(file.type) && scale === 1 ? file : out;
}

const PRESET = { app_icon: { max: 512, square: true, type: 'image/png', keepIco: false }, share: { max: 1200, type: 'image/jpeg', keepIco: false } };

async function put(blob, purpose) {
  const r = await api.post('/admin/media', { mime: blob.type, size: blob.size, purpose });
  const res = await fetch(r.upload_url, { method: 'PUT', headers: r.headers, body: blob });
  if (!res.ok) throw new Error('فشل الرفع، تحقق من الإنترنت وحاول مجدداً');
  return r.public_url;
}

export async function uploadImage(file, { purpose, ...opts } = {}) {
  const img = await processImage(file, { ...(PRESET[purpose] || {}), ...opts });
  if (img.size > MAX_ANIM) throw new Error('حجم الصورة يتجاوز 15MB');
  return put(img, purpose);
}

export async function uploadVideo(file) {
  if (!/^video\/(mp4|webm|quicktime)$/.test(file.type)) throw new Error('صيغة الفيديو غير مدعومة — استخدم MP4');
  if (file.size > MAX_VIDEO) throw new Error('حجم الفيديو يتجاوز 40MB — استخدم مقطعاً أقصر');
  return put(file);
}

// إدراج نص (مثل ![](رابط صورة)) مكان المؤشر في مربع النص مع تحديث الحالة
export function insertAtCursor(ta, text) {
  const a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? a;
  ta.value = ta.value.slice(0, a) + text + ta.value.slice(b);
  ta.selectionStart = ta.selectionEnd = a + text.length;
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}
