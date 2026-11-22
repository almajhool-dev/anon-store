// يبني حزمة الدالة: dist/api/index.mjs ثم dist/api.zip (الملف الذي يُرفع إلى Neon Functions)
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { statSync, rmSync } from 'node:fs';
await build({ entryPoints: ['api/src/index.js'], bundle: true, platform: 'node', target: 'node22', format: 'esm', minify: true, legalComments: 'none', outfile: 'dist/api/index.mjs' });
rmSync('dist/api.zip', { force: true });
execSync('zip -q -9 -j dist/api.zip dist/api/index.mjs');
const s = statSync('dist/api.zip').size;
console.log(`bundle ${statSync('dist/api/index.mjs').size} B, zip ${s} B, base64 ~${Math.ceil(s / 3) * 4} chars`);
