// تشغيل سكربت بمتغيرات .env.local مع تجاوزها من ملف JSON (مثلاً فرع اختبار Neon منفصل عن الإنتاج)
// الاستخدام: NODE_USE_ENV_PROXY=1 node scripts/with-env.mjs /tmp/override.json scripts/test-api.mjs
// القيمة null في ملف التجاوز تحذف المتغير. الملف يحوي أسراراً: احفظه خارج المستودع.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const [over, script, ...rest] = process.argv.slice(2);
if (!over || !script) { console.log('usage: node scripts/with-env.mjs <override.json> <script> [args]'); process.exit(1); }
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
for (const [k, v] of Object.entries(JSON.parse(readFileSync(over, 'utf8')))) { if (v === null) delete process.env[k]; else process.env[k] = String(v); }
process.argv = [process.argv[0], resolve(script), ...rest];
await import(pathToFileURL(resolve(script)).href);
