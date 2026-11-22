import { defineConfig } from 'vite';
export default defineConfig({
  root: 'web',
  build: { outDir: '../dist/web', emptyOutDir: true, target: 'es2020', chunkSizeWarningLimit: 700 },
  server: { port: 5173 },
});
