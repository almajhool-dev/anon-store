// ⚡ الأداء والمراقبة: قياسات حقيقية من زوار الموقع + حالة الخوادم الحية + حجم الملفات + الأخطاء + الفخاخ
import { html, mount } from '../lib/dom.js';
import { api } from '../lib/core.js';
import { icon } from '../lib/art.js';

const V = { lcp: ['LCP — ظهور المحتوى الرئيسي', 2500, 4000], inp: ['INP — سرعة الاستجابة للمس', 200, 500], cls: ['CLS — ثبات التصميم', 0.1, 0.25], fcp: ['FCP — أول ظهور', 1800, 3000], ttfb: ['TTFB — استجابة الخادم', 800, 1800] };
const g = (k, v) => (v == null ? '' : v <= V[k][1] ? 'good' : v <= V[k][2] ? 'mid' : 'bad');
const f = (k, v) => (v == null ? '—' : k === 'cls' ? Number(v).toFixed(3) : v >= 1000 ? `${(v / 1000).toFixed(2)} ث` : `${Math.round(v)} ms`);
const ms = (v) => (v == null ? '—' : `${Math.round(v)} ms`);
const kb = (v) => (v >= 1024 ? `${(v / 1024).toFixed(2)} MB` : `${Math.round(v)} KB`);
const DEV = { low: 'ضعيف', mid: 'متوسط', high: 'قوي' };
const sum = (a, k) => a.reduce((t, x) => t + (x[k] || 0), 0);

export default async function perf(main) {
  mount(main, html`<div class="empty card"><div class="spinner"></div></div>`);
  let d, b;
  try { [d, b] = await Promise.all([api.get('/admin/perf'), fetch('/build-stats.json').then((r) => (r.ok ? r.json() : null)).catch(() => null)]); } catch (e) { mount(main, html`<div class="empty card">${icon('shield')}<p>${e.message}</p></div>`); return; }
  const s = d.summary || {}, sv = d.server || {}, files = b?.files || [];
  const js = files.filter((x) => x.file.endsWith('.js')), css = files.filter((x) => x.file.endsWith('.css')), fonts = files.filter((x) => x.file.endsWith('.woff2')), entry = js.find((x) => x.entry);
  const maxL = Math.max(1, ...d.days.map((x) => x.lcp || 0)), hits = d.decoys.hits.reduce((t, x) => t + x.n, 0);
  const row = (x) => html`<td class="${g('lcp', x.lcp)}-t">${f('lcp', x.lcp)}</td><td class="${g('inp', x.inp)}-t">${f('inp', x.inp)}</td><td class="${g('cls', x.cls)}-t">${f('cls', x.cls)}</td>`;
  mount(main, html`<h2>${icon('bolt')} الأداء والمراقبة</h2>
    <p class="muted small">قياسات حقيقية من متصفحات زوار موقعك خلال آخر 7 أيام (المئين 75 كما تعتمده Google) — <b>${s.n || 0}</b> زيارة مقاسة. ${s.n ? '' : 'تظهر الأرقام بعد أول زيارات حقيقية.'}</p>
    <div class="kpis">${Object.keys(V).map((k) => html`<div class="card kpi ${g(k, s[k])}"><span>${V[k][0]}</span><b>${f(k, s[k])}</b><small>الهدف ≤ ${k === 'cls' ? V[k][1] : f(k, V[k][1])}</small></div>`)}
      <div class="card kpi"><span>زمن الـ API من أجهزة الزوار</span><b>${ms(s.api_ms)}</b><small>منه قاعدة البيانات: ${ms(s.db_ms)}</small></div>
      <div class="card kpi"><span>ذاكرة الصفحة (متصفحات كروم)</span><b>${s.heap_mb ? `${s.heap_mb} MB` : '—'}</b><small>المئين 75</small></div></div>
    <div class="split mt">
      <div class="card pad"><h3>${icon('chart')} الاتجاه اليومي (14 يوماً)</h3>${d.days.length ? html`<table class="ptbl"><tr><th>اليوم</th><th>زيارات</th><th>LCP</th><th></th><th>INP</th><th>CLS</th></tr>${d.days.map((x) => html`<tr><td class="ltr">${x.day.slice(5)}</td><td>${x.n}</td><td class="${g('lcp', x.lcp)}-t">${f('lcp', x.lcp)}</td><td><div class="pbar" data-w="${Math.round(((x.lcp || 0) / maxL) * 100)}"></div></td><td class="${g('inp', x.inp)}-t">${f('inp', x.inp)}</td><td class="${g('cls', x.cls)}-t">${f('cls', x.cls)}</td></tr>`)}</table>` : html`<p class="muted small">لا توجد بيانات بعد.</p>`}</div>
      <div class="card pad"><h3>${icon('shield')} حالة الخوادم (فحص حي الآن)</h3><table class="ptbl">
        <tr><td>الواجهة الخلفية (API)</td><td class="good-t">تعمل · ${sv.node || ''}</td></tr>
        <tr><td>قاعدة البيانات</td><td class="${sv.db_ms < 150 ? 'good' : sv.db_ms < 400 ? 'mid' : 'bad'}-t">${ms(sv.db_ms)}</td></tr>
        <tr><td>التخزين</td><td class="${sv.storage?.ok ? 'good' : 'bad'}-t">${sv.storage ? `${sv.storage.ok ? 'متاح' : 'مشكلة'} · ${ms(sv.storage.ms)}` : '—'}</td></tr>
        <tr><td>ذاكرة نسخة الخادم</td><td>${sv.rss_mb} MB (heap ${sv.heap_mb} MB)</td></tr>
        <tr><td>عمر النسخة الحالية</td><td>${Math.round((sv.uptime_s || 0) / 60)} دقيقة</td></tr></table>
        <button class="btn sm mt" type="button" data-reload>${icon('refresh')} تحديث</button></div></div>
    <div class="split mt">
      <div class="card pad"><h3>${icon('grid')} حسب نوع الجهاز</h3>${d.byDevice.length ? html`<table class="ptbl"><tr><th>الجهاز</th><th>زيارات</th><th>LCP</th><th>INP</th><th>CLS</th></tr>${d.byDevice.map((x) => html`<tr><td>${DEV[x.device] || x.device} · ${x.mobile ? 'هاتف' : 'كمبيوتر'}</td><td>${x.n}</td>${row(x)}</tr>`)}</table>` : html`<p class="muted small">لا توجد بيانات بعد.</p>`}
        <h3 class="mt">أبطأ الصفحات</h3>${d.pages.length ? html`<table class="ptbl"><tr><th>الصفحة</th><th>زيارات</th><th>LCP</th><th>INP</th><th>CLS</th></tr>${d.pages.map((x) => html`<tr><td class="ltr">${x.page}</td><td>${x.n}</td>${row(x)}</tr>`)}</table>` : html`<p class="muted small">—</p>`}</div>
      <div class="card pad"><h3>${icon('clock')} زمن المسارات على الخادم (هذه النسخة)</h3>${sv.routes?.length ? html`<table class="ptbl"><tr><th>المسار</th><th>طلبات</th><th>p50</th><th>p95</th></tr>${sv.routes.map((x) => html`<tr><td class="ltr small">${x.route}</td><td>${x.n}</td><td>${ms(x.p50)}</td><td>${ms(x.p95)}</td></tr>`)}</table>` : html`<p class="muted small">لا طلبات بعد على هذه النسخة.</p>`}</div></div>
    <div class="split mt">
      <div class="card pad"><h3>${icon('disk')} حجم ملفات الموقع (من البناء الفعلي)</h3>${b ? html`<table class="ptbl">
        <tr><td>JavaScript الأولي</td><td>${entry ? `${kb(entry.kb)} (Brotli ${kb(entry.br)})` : '—'}</td></tr>
        <tr><td>كل JavaScript (يُحمَّل عند الحاجة)</td><td>${kb(sum(js, 'kb'))} في ${js.length} ملفاً (Brotli ${kb(sum(js, 'br'))})</td></tr>
        <tr><td>CSS</td><td>${kb(sum(css, 'kb'))} (Brotli ${kb(sum(css, 'br'))})</td></tr>
        <tr><td>الخطوط</td><td>${fonts.length} ملفاً · ${kb(sum(fonts, 'kb'))} — يحمّل الزائر ما يحتاجه فقط</td></tr>
        <tr><td>تاريخ البناء</td><td>${new Date(b.at).toLocaleString('ar-IQ')}</td></tr></table>` : html`<p class="muted small">ملف إحصاءات البناء غير متاح.</p>`}</div>
      <div class="card pad"><h3>${icon('shield')} الفخاخ (مؤشرات الخداع)</h3><p class="small"><b>${d.decoys.total}</b> مؤشر خداع معزول مفعّل — <b>${hits}</b> ضربة خلال 7 أيام.</p><table class="ptbl"><tr><th>الفئة</th><th>ضربات</th><th>عناوين</th></tr>${d.decoys.cats.map((x) => { const h = d.decoys.hits.find((y) => y.cat === x.k || (x.k === 'ip' && y.cat === 'decoy_canary')); return html`<tr><td>${x.label}</td><td>${h?.n || 0}</td><td>${h?.ips || 0}</td></tr>`; })}</table></div></div>
    <div class="card pad mt"><h3>${icon('log')} أخطاء الواجهة عند الزوار (7 أيام)</h3>${d.errors.length ? html`<table class="ptbl"><tr><th>الرسالة</th><th>الملف</th><th>مرات</th><th>آخر مرة</th></tr>${d.errors.map((x) => html`<tr><td class="ltr small">${x.msg}</td><td class="ltr small">${x.src}${x.line ? `:${x.line}` : ''}</td><td>${x.n}</td><td class="small">${new Date(x.last).toLocaleString('ar-IQ')}</td></tr>`)}</table>` : html`<p class="muted small">لا أخطاء مسجّلة.</p>`}</div>`);
  main.querySelectorAll('.pbar').forEach((e) => e.style.setProperty('--w', `${e.dataset.w}%`));
  main.querySelector('[data-reload]')?.addEventListener('click', () => perf(main));
}
