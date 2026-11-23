import { defineConfig } from 'vite';
// AUTH_PROXY_TARGET: خادم المصادقة للتطوير — نفس فكرة وكيل Netlify (/api/auth) في الإنتاج
const target = process.env.AUTH_PROXY_TARGET;
export default defineConfig({
  root: 'web',
  build: { outDir: '../dist/web', emptyOutDir: true, target: 'es2020', chunkSizeWarningLimit: 700 },
  server: { port: 5173, proxy: target ? { '/api/auth': { target, changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/auth/, '') } } : undefined },
});
