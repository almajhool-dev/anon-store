// رفع الصور من الهاتف أو الكمبيوتر: تصغير تلقائي وتحويل لصيغة مناسبة مع الحفاظ على الشفافية
import { api } from './core.js';

const OK = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon'];
const MAX = 8 * 1024 * 1024;
export const IMAGE_ACCEPT = 'image/*,.ico';
const isIco = (f) => /icon/.test(f.type) || /\.ico$/i.test(f.name || '');

// type: صيغة إلزامية (PNG لأيقونة الهاتف، JPEG لصورة المشاركة) — square: قص مربع من المنتصف بمقاس max بالضبط
export async function processImage(file, { max = 1920, square = false, type = null, keepIco = true } = {}) {
  if ((keepIco && isIco(file)) || (!type && /gif/.test(file.type))) {
    if (file.size > MAX) throw new Error('حجم الصورة يتجاوز 8MB');
    return file.type ? file : new File([file], file.name, { type: 'image/x-icon' });
  }
  let bmp;
  try { bmp = await createImageBitmap(file); } catch {
    if (!type && OK.includes(file.type) && file.size <= MAX) return file;
    throw new Error('صيغة الصورة غير مدعومة — استخدم PNG أو JPG');
  }
  let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
  if (square && sw !== sh) { const s = Math.min(sw, sh); sx = (sw - s) / 2; sy = (sh - s) / 2; sw = sh = s; }
  const scale = square ? max / sw : Math.min(1, max / Math.max(sw, sh));
  if (scale === 1 && sw === bmp.width && sh === bmp.height && file.size < 1.5 * 1024 * 1024 && (type ? file.type === type : OK.includes(file.type))) { bmp.close?.(); return file; }
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
  if (!out || out.type !== want) out = await blob(want === 'image/jpeg' || file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.9);
  return out;
}

const PRESET = { app_icon: { max: 512, square: true, type: 'image/png', keepIco: false }, share: { max: 1200, type: 'image/jpeg', keepIco: false } };

export async function uploadImage(file, { purpose, ...opts } = {}) {
  const img = await processImage(file, { ...(PRESET[purpose] || {}), ...opts });
  if (img.size > MAX) throw new Error('حجم الصورة يتجاوز 8MB');
  const r = await api.post('/admin/media', { mime: img.type, size: img.size, purpose });
  const put = await fetch(r.upload_url, { method: 'PUT', headers: r.headers, body: img });
  if (!put.ok) throw new Error('فشل رفع الصورة، حاول مجدداً');
  return r.public_url;
}
