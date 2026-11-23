import { defineConfig } from 'vite';
import { brotliCompressSync } from 'node:zlib';
// عنوان الـ API الافتراضي للإنتاج (يُستخدم أيضاً في تحميل الإعدادات المسبق داخل index.html)
const BUILD_AT = new Date().toISOString(); // رقم النسخة: يُضمَّن في الكود ويُكتب في build-stats.json لاكتشاف النشر الجديد
process.env.VITE_API_URL ||= 'https://br-autumn-cake-bai4zvy6-api.compute.c-8.eu-central-1.aws.neon.tech';
// AUTH_PROXY_TARGET: خادم المصادقة للتطوير — نفس فكرة وكيل Netlify (/api/auth) في الإنتاج
const target = process.env.AUTH_PROXY_TARGET;
// أحجام ملفات البناء الحقيقية (خام + Brotli) → build-stats.json تعرضه لوحة الأداء
const buildStats = () => ({
  name: 'build-stats', apply: 'build',
  generateBundle(_, bundle) {
    const files = Object.values(bundle).filter((f) => /\.(js|css|woff2)$/.test(f.fileName)).map((f) => {
      const b = Buffer.from(f.type === 'chunk' ? f.code : f.source);
      return { file: f.fileName, kb: Number((b.length / 1024).toFixed(1)), br: /\.woff2$/.test(f.fileName) ? null : Number((brotliCompressSync(b).length / 1024).toFixed(1)), entry: Boolean(f.isEntry) };
    });
    this.emitFile({ type: 'asset', fileName: 'build-stats.json', source: JSON.stringify({ at: BUILD_AT, files }) });
  },
});
export default defineConfig({
  root: 'web',
  plugins: [buildStats()],
  define: { __BUILD_AT__: JSON.stringify(BUILD_AT) },
  build: { outDir: '../dist/web', emptyOutDir: true, target: 'es2020', chunkSizeWarningLimit: 700 },
  server: { port: 5173, proxy: target ? { '/api/auth': { target, changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/auth/, '') } } : undefined },
});
