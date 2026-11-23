// 🔄 اكتشاف نسخة جديدة من الموقع بعد كل نشر: عند العودة للتبويب وكل 5 دقائق.
// التبويب المفتوح من قبل النشر لا يبقى على الكود القديم: التنقل التالي يحمّل النسخة الجديدة، ويظهر شريط «تحديث الآن»
/* global __BUILD_AT__ */
const BUILD = typeof __BUILD_AT__ === 'string' ? __BUILD_AT__ : '';
let stale = false, last = 0;
export const isStale = () => stale;

function banner() {
  if (document.querySelector('.upd-bar')) return;
  const bar = document.createElement('div'), txt = document.createElement('span'), btn = document.createElement('button');
  bar.className = 'upd-bar'; bar.setAttribute('role', 'status');
  txt.textContent = 'نسخة جديدة من الموقع متاحة';
  btn.type = 'button'; btn.textContent = 'تحديث الآن';
  btn.addEventListener('click', () => location.reload());
  bar.append(txt, btn); document.body.append(bar);
}

export async function checkUpdate(force = false) {
  if (!BUILD || stale || (!force && Date.now() - last < 60000)) return stale;
  last = Date.now();
  try {
    const r = await fetch('/build-stats.json', { cache: 'no-store' });
    const at = r.ok ? (await r.json()).at : '';
    if (at && at !== BUILD) { stale = true; banner(); }
  } catch { /* بلا شبكة: نحاول لاحقاً */ }
  return stale;
}

export function startUpdates() {
  if (!BUILD || window.parent !== window) return;
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });
  addEventListener('focus', () => checkUpdate());
  setInterval(() => checkUpdate(), 5 * 60000);
}
