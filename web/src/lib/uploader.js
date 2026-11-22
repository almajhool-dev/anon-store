// رافع ملفات ضخمة مجزأ وقابل للاستكمال: أجزاء متوازية مباشرة إلى التخزين عبر روابط موقعة،
// إيقاف/استكمال، إعادة محاولة تلقائية، استكمال بعد انقطاع الإنترنت أو إعادة تحميل الصفحة (بإعادة اختيار نفس الملف)
import { api } from './core.js';

const LS = 'anonup:';
const PARALLEL = ['slow-2g', '2g', '3g'].includes(navigator.connection?.effectiveType) ? 2 : 4;
// أثناء الرفع: إبقاء شاشة الهاتف مضاءة (حتى لا يوقف النظام المتصفح) وتنبيه قبل إغلاق الصفحة
const active = new Set(), IDLE = ['paused', 'done', 'error', 'canceled'];
let lock = null, asking = false;
async function keepAwake() {
  if (lock || asking || !navigator.wakeLock || document.visibilityState !== 'visible') return;
  asking = true;
  try { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } catch { /* غير مدعوم */ } finally { asking = false; }
}
function track(u) {
  if (u.state && !IDLE.includes(u.state)) active.add(u); else active.delete(u);
  if (active.size) keepAwake(); else if (lock) { lock.release().catch(() => {}); lock = null; }
}
document.addEventListener('visibilitychange', () => { if (active.size && document.visibilityState === 'visible') keepAwake(); });
addEventListener('beforeunload', (e) => { if (active.size) { e.preventDefault(); e.returnValue = ''; } });

export class Uploader {
  constructor(file, meta, onChange) {
    Object.assign(this, { file, meta, onChange, state: 'idle', done: new Set(), xhrs: new Map(), loaded: new Map(), urls: new Map(), samples: [], retry: 0, speed: 0 });
    this.fp = LS + [meta.product_id, meta.lesson_id || '', file.name, file.size, file.lastModified].join('|');
  }
  emit(state, info) { if (state) this.state = state; this.info = info; track(this); this.onChange(this); }
  get bytes() { let b = 0; for (const n of this.done) b += this.size(n); for (const v of this.loaded.values()) b += v; return Math.min(b, this.file.size); }
  get eta() { return this.speed > 0 ? (this.file.size - this.bytes) / this.speed : 0; }
  size(n) { return Math.min(this.ps, this.file.size - (n - 1) * this.ps); }

  async start() {
    this.emit('preparing');
    try {
      const saved = JSON.parse(localStorage.getItem(this.fp) || 'null');
      if (saved?.id) {
        try {
          const r = await api.get(`/admin/uploads/${saved.id}/parts`);
          Object.assign(this, { id: saved.id, ps: r.part_size, n: Math.ceil(r.size / r.part_size), resumed: true });
          r.parts.forEach((p) => this.done.add(p.n));
        } catch { localStorage.removeItem(this.fp); }
      }
      if (!this.id) {
        const r = await api.post('/admin/uploads', { ...this.meta, file_name: this.file.name, size: this.file.size, mime: this.file.type || 'application/octet-stream' });
        Object.assign(this, { id: r.file_id, ps: r.part_size, n: r.parts });
        localStorage.setItem(this.fp, JSON.stringify({ id: this.id, name: this.file.name, size: this.file.size, product: this.meta.product_id, lesson: this.meta.lesson_id || null, at: Date.now() }));
      }
    } catch (e) { return this.emit('error', e.message); }
    this.run();
  }

  run() {
    if (['paused', 'canceled', 'completing', 'done', 'error'].includes(this.state)) return;
    if (!navigator.onLine) {
      this.emit('offline');
      addEventListener('online', () => { if (this.state === 'offline') { this.state = 'uploading'; this.run(); } }, { once: true });
      return;
    }
    if (this.state !== 'uploading') this.emit('uploading');
    const todo = [];
    for (let i = 1; i <= this.n; i++) if (!this.done.has(i) && !this.xhrs.has(i)) todo.push(i);
    if (!todo.length && !this.xhrs.size) return this.finish();
    while (this.xhrs.size < PARALLEL && todo.length) this.part(todo.shift());
  }

  async signed(n) {
    const c = this.urls.get(n);
    if (c && c.exp > Date.now()) return c.u;
    const want = [];
    for (let i = n; i <= this.n && want.length < 30; i++) if (!this.done.has(i)) want.push(i);
    const r = await api.post(`/admin/uploads/${this.id}/sign`, { parts: want });
    for (const [k, u] of Object.entries(r.urls)) this.urls.set(Number(k), { u, exp: Date.now() + 50 * 60e3 });
    return this.urls.get(n).u;
  }

  async part(n) {
    this.xhrs.set(n, null);
    let url;
    try { url = await this.signed(n); } catch (e) { this.xhrs.delete(n); return this.fail(e); }
    if (this.state !== 'uploading') { this.xhrs.delete(n); return; }
    const x = new XMLHttpRequest();
    this.xhrs.set(n, x);
    x.open('PUT', url);
    x.timeout = 15 * 60e3;
    x.upload.onprogress = (e) => { this.loaded.set(n, e.loaded); this.tick(); };
    x.onload = () => {
      this.xhrs.delete(n); this.loaded.delete(n);
      if (x.status >= 200 && x.status < 300) { this.done.add(n); this.retry = 0; this.tick(); this.run(); }
      else { this.urls.delete(n); this.fail(new Error('part_' + x.status)); }
    };
    x.onerror = x.ontimeout = () => { this.xhrs.delete(n); this.loaded.delete(n); this.fail(new Error('network')); };
    x.send(this.file.slice((n - 1) * this.ps, n * this.ps));
  }

  fail(e) {
    if (['paused', 'canceled', 'error'].includes(this.state)) return;
    if (['upload_not_found', 'forbidden', 'auth_required', 'invalid_token'].includes(e?.code)) {
      this.abortAll(); localStorage.removeItem(this.fp);
      return this.emit('error', e.message);
    }
    this.retry++;
    const wait = Math.min(30000, 1000 * 2 ** Math.min(this.retry, 5));
    this.emit('retrying', Math.round(wait / 1000));
    clearTimeout(this.rt);
    this.rt = setTimeout(() => { if (this.state === 'retrying') { this.state = 'uploading'; this.run(); } }, wait);
  }

  tick() {
    const now = Date.now(), b = this.bytes;
    this.samples.push([now, b]);
    while (this.samples.length > 2 && now - this.samples[0][0] > 6000) this.samples.shift();
    const [t0, b0] = this.samples[0];
    this.speed = now - t0 > 400 ? (b - b0) / ((now - t0) / 1000) : this.speed;
    this.onChange(this);
  }

  abortAll() { for (const x of this.xhrs.values()) x?.abort(); this.xhrs.clear(); this.loaded.clear(); clearTimeout(this.rt); }
  pause() { this.abortAll(); this.emit('paused'); }
  resume() { if (['paused', 'error', 'retrying'].includes(this.state)) { this.retry = 0; this.state = 'uploading'; this.samples = []; this.run(); } }
  async cancel() {
    this.abortAll(); this.emit('canceled');
    localStorage.removeItem(this.fp);
    if (this.id) { try { await api.del(`/admin/uploads/${this.id}`); } catch { /* منتهية */ } }
  }
  async finish() {
    this.emit('completing');
    try {
      const r = await api.post(`/admin/uploads/${this.id}/complete`);
      localStorage.removeItem(this.fp);
      this.emit('done', r.scan);
    } catch (e) {
      if (e.code === 'parts_missing') {
        const r = await api.get(`/admin/uploads/${this.id}/parts`);
        this.done = new Set(r.parts.map((p) => p.n));
        this.state = 'uploading';
        return this.run();
      }
      this.emit('error', e.message);
    }
  }
}

export function pendingUploads(productId) {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k.startsWith(LS)) continue;
    try { const v = JSON.parse(localStorage.getItem(k)); if (v.product === productId) out.push({ key: k, ...v }); } catch { /* تالف */ }
  }
  return out;
}
export const forgetUpload = (key) => localStorage.removeItem(key);
