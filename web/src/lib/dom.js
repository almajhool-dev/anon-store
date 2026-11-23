// قوالب HTML آمنة (هروب تلقائي ضد XSS) + أدوات الواجهة: إشعارات، نوافذ، تأكيد
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(String(s ?? ''));
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
export const esc = (v) => String(v).replace(/[&<>"'`]/g, (c) => MAP[c]);
const val = (v) => (v == null || v === false ? '' : v instanceof Raw ? v.s : Array.isArray(v) ? v.map(val).join('') : esc(v));
export const html = (s, ...v) => new Raw(s.reduce((a, str, i) => a + str + (i < v.length ? val(v[i]) : ''), ''));
export const mount = (el, content) => { el.innerHTML = val(content); return el; };
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

export function safeUrl(u) {
  try {
    const x = new URL(u, location.origin);
    return x.protocol === 'https:' || x.origin === location.origin ? x.href : '#';
  } catch { return '#'; }
}

export function actions(el, map) {
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (t && el.contains(t) && map[t.dataset.act]) { e.preventDefault(); map[t.dataset.act](t, e); }
  });
}

export const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// أخطاء تقنية بالإنجليزية ← رسائل عربية مفهومة (لا يرى الزائر رسالة متصفح خام أبداً)
export const CHUNK_ERR = /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Failed to load module script/i;
const NET_ERR = /Failed to fetch|NetworkError|Load failed|Network request failed/i;
export function errText(e) {
  const m = String(e?.message ?? e ?? '');
  if (CHUNK_ERR.test(m)) return 'صدرت نسخة جديدة من الموقع — حدّث الصفحة لإكمال التصفح.';
  if (NET_ERR.test(m)) return 'تعذّر الاتصال بالخادم — تحقّق من الإنترنت ثم أعد المحاولة.';
  return m || 'حدث خطأ غير متوقع — أعد المحاولة.';
}
// صفحة من نسخة قديمة لم تعد ملفاتها موجودة: إعادة تحميل واحدة تجلب النسخة الجديدة
// (حارس 20 ث، وبلا تخزين جلسة لا نعيد تلقائياً منعاً لحلقة لا تنتهي)
export function recoverChunk(e) {
  if (!CHUNK_ERR.test(String(e?.message ?? e ?? ''))) return false;
  try { if (Date.now() - Number(sessionStorage.getItem('chunk_reload') || 0) < 20000) return false; sessionStorage.setItem('chunk_reload', String(Date.now())); } catch { return false; }
  location.reload();
  return true;
}

let toastBox;
export function toast(msg, type = 'info', ms = 3800) {
  if (!toastBox) { toastBox = document.createElement('div'); toastBox.className = 'toasts'; toastBox.setAttribute('role', 'status'); document.body.append(toastBox); }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = /^err/.test(type) ? errText(msg) : msg;
  toastBox.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}

export function modal(content, { wide = false, onClose } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true"><button class="modal-x" aria-label="إغلاق" data-close>×</button><div class="modal-body"></div></div>`;
  mount(wrap.querySelector('.modal-body'), content);
  const close = () => { wrap.classList.remove('show'); document.removeEventListener('keydown', esc_); setTimeout(() => wrap.remove(), 200); onClose?.(); };
  const esc_ = (e) => { if (e.key === 'Escape') close(); };
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', esc_);
  document.body.append(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));
  return { el: wrap.querySelector('.modal-body'), close };
}

export function confirmBox(msg, { ok = 'تأكيد', danger = false } = {}) {
  return new Promise((res) => {
    let done = false;
    const m = modal(html`<h3 class="m-title">${msg}</h3><div class="row end gap"><button class="btn ghost" data-no>إلغاء</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${ok}</button></div>`,
      { onClose: () => { if (!done) res(false); } });
    m.el.querySelector('[data-yes]').onclick = () => { done = true; res(true); m.close(); };
    m.el.querySelector('[data-no]').onclick = () => { done = true; res(false); m.close(); };
  });
}

export function promptBox(title, { value = '', placeholder = '', multiline = false, ok = 'حفظ' } = {}) {
  return new Promise((res) => {
    let done = false;
    const field = multiline ? html`<textarea class="input" rows="5" placeholder="${placeholder}">${value}</textarea>` : html`<input class="input" value="${value}" placeholder="${placeholder}">`;
    const m = modal(html`<h3 class="m-title">${title}</h3>${field}<div class="row end gap mt"><button class="btn ghost" data-no>إلغاء</button><button class="btn primary" data-yes>${ok}</button></div>`,
      { onClose: () => { if (!done) res(null); } });
    const inp = m.el.querySelector('.input');
    inp.focus();
    m.el.querySelector('[data-yes]').onclick = () => { done = true; res(inp.value); m.close(); };
    m.el.querySelector('[data-no]').onclick = () => { done = true; res(null); m.close(); };
  });
}

export function busy(btn, on) {
  if (!btn) return;
  btn.disabled = on;
  btn.classList.toggle('loading', on);
}
