// حماية التبويبات القديمة (Skew protection): ينسخ ملفات /assets من آخر النسخ المنشورة إلى النشر الجديد
// فتجد الصفحة المفتوحة على نسخة سابقة ملفاتها ولا يظهر «Failed to fetch dynamically imported module».
// يعمل بعد vite build على Netlify (netlify.toml) — أي فشل هنا لا يُفشل النشر أبداً.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SITE = (process.env.CARRY_FROM || process.env.URL || 'https://majhool-store.netlify.app').replace(/\/$/, '');
const OUT = 'dist/web', GENS = 6; // النسخة الحالية + 5 سابقة
const statsPath = join(OUT, 'build-stats.json');

const get = async (url, ms = 15000) => {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { signal: ac.signal, headers: { 'cache-control': 'no-cache' } }); } finally { clearTimeout(t); }
};

async function main() {
  const stats = JSON.parse(readFileSync(statsPath, 'utf8'));
  const mine = readdirSync(join(OUT, 'assets')).map((f) => `assets/${f}`); // ملفات هذا البناء فقط (قبل النسخ)
  let prev = [];
  try {
    const r = await get(`${SITE}/build-stats.json`);
    const live = r.ok ? await r.json() : null;
    prev = Array.isArray(live?.gens) ? live.gens : live?.files ? [live.files.map((f) => f.file)] : [];
  } catch (e) { console.log(`carry-assets: لا نسخة منشورة سابقة (${e.message}) — تخطٍّ`); }
  const want = [...new Set(prev.slice(0, GENS - 1).flat())].filter((p) => /^assets\/[\w.-]+$/.test(p) && !existsSync(join(OUT, p)));
  let ok = 0, miss = 0;
  for (let i = 0; i < want.length; i += 8) {
    await Promise.all(want.slice(i, i + 8).map(async (p) => {
      try {
        const r = await get(`${SITE}/${p}`);
        // صفحة الموقع (SPA) تُعاد للملفات المفقودة بحالة 200: لا نحفظها كملف
        if (!r.ok || /text\/html/.test(r.headers.get('content-type') || '')) { miss++; return; }
        writeFileSync(join(OUT, p), Buffer.from(await r.arrayBuffer())); ok++;
      } catch { miss++; }
    }));
  }
  stats.gens = [mine, ...prev].slice(0, GENS);
  writeFileSync(statsPath, JSON.stringify(stats));
  console.log(`carry-assets: نُسخ ${ok} ملفاً من النسخ السابقة (تعذّر ${miss}) · أجيال محفوظة: ${stats.gens.length}`);
}
main().catch((e) => console.log(`carry-assets: تخطٍّ (${e.message})`));
