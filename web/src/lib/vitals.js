// 📈 قياسات حقيقية من أجهزة الزوار (بلا مكتبات وبلا بيانات شخصية): LCP · INP · CLS · FCP · TTFB + زمن الـ API وقاعدة البيانات + أخطاء الواجهة
// تُرسل مرة واحدة عند مغادرة الصفحة عبر sendBeacon (طلب نصي بسيط بلا preflight) وتظهر للمدير في «الأداء والمراقبة»
import { API_URL } from './core.js';

const S = { lcp: 0, fcp: 0, cls: 0, inp: 0 }, errs = [], page = location.pathname;
let sent = false;
const po = (type, f, x = {}) => { try { new PerformanceObserver((l) => l.getEntries().forEach(f)).observe({ type, buffered: true, ...x }); } catch { /* غير مدعوم */ } };
const med = (a) => { a = a.filter((x) => x > 0).sort((x, y) => x - y); return a.length ? Math.round(a[a.length >> 1]) : null; };

function send() {
  if (sent || !navigator.sendBeacon) return;
  sent = true;
  const nav = performance.getEntriesByType('navigation')[0];
  const api = performance.getEntriesByType('resource').filter((r) => r.name.startsWith(API_URL) && !r.name.includes('/vitals'));
  const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  const body = {
    page, lcp: S.lcp || null, fcp: S.fcp || null, cls: Number(S.cls.toFixed(4)), inp: S.inp || null, ttfb: nav ? Math.max(0, Math.round(nav.responseStart)) : null,
    api: med(api.map((r) => r.duration)), db: med(api.map((r) => (r.serverTiming || []).find((t) => t.name === 'db')?.duration || 0)),
    heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
    mobile: matchMedia('(pointer: coarse)').matches, dev: mem <= 2 || cores <= 2 ? 'low' : mem >= 8 && cores >= 8 ? 'high' : 'mid',
    q: Number(document.body.dataset.q) || null, errors: errs,
  };
  try { navigator.sendBeacon(`${API_URL}/vitals`, JSON.stringify(body)); } catch { /* تجاهل */ }
}

export function startVitals() {
  if (window.parent !== window || navigator.webdriver) return; // معاينة الاستوديو وأدوات الأتمتة لا تُحسب
  po('largest-contentful-paint', (e) => { S.lcp = Math.round(e.startTime); });
  po('paint', (e) => { if (e.name === 'first-contentful-paint') S.fcp = Math.round(e.startTime); });
  let win = 0, first = 0, prev = 0; // CLS بنوافذ الجلسة (أقصى نافذة 5 ثوانٍ) كما تعرّفه Google
  po('layout-shift', (e) => {
    if (e.hadRecentInput) return;
    if (e.startTime - prev > 1000 || e.startTime - first > 5000) { win = 0; first = e.startTime; }
    win += e.value; prev = e.startTime; S.cls = Math.max(S.cls, win);
  });
  po('event', (e) => { if (e.interactionId) S.inp = Math.max(S.inp, Math.round(e.duration)); }, { durationThreshold: 40 });
  const err = (m, s, l) => { if (m && errs.length < 5) errs.push({ m: String(m).slice(0, 200), s: String(s || '').split('/').pop().split('?')[0].slice(0, 80), l: l || 0 }); };
  addEventListener('error', (e) => err(e.message, e.filename, e.lineno));
  addEventListener('unhandledrejection', (e) => err(e.reason?.message || e.reason, '', 0));
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') send(); });
  addEventListener('pagehide', send);
}
