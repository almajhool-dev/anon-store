// يولّد قواعد Netlify في netlify.toml: وكيل المصادقة + فخاخ الخداع (موقّعة JWS لنثق بعنوان العميل) + توجيه SPA
// المصدر الوحيد للفخاخ: api/src/decoys.js — شغّله بعد أي تعديل عليها: node scripts/gen-netlify.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { decoyRoutes, DECOY_COUNT } from '../api/src/decoys.js';
const API = 'https://br-autumn-cake-bai4zvy6-api.compute.c-8.eu-central-1.aws.neon.tech';
const AUTH = 'https://ep-square-breeze-bawdktqt.neonauth.c-8.eu-central-1.aws.neon.tech/neondb/auth';
const MARK = '# ===== قواعد مولّدة تلقائياً بـ scripts/gen-netlify.mjs — لا تعدّلها يدوياً =====';
const { prefixes, exact } = decoyRoutes();
const rule = (from, to, signed) => `[[redirects]]\n  from = "${from}"\n  to = "${to}"\n  status = 200\n${signed ? '  force = true\n  signed = "API_SIGNATURE_TOKEN"\n' : ''}`;
const rules = [rule('/api/auth/*', `${AUTH}/:splat`), ...exact.map((p) => rule(p, `${API}/trap${p}`, true)), ...prefixes.map((p) => rule(`${p}/*`, `${API}/trap${p}/:splat`, true)), rule('/*', '/index.html')];
const base = readFileSync('netlify.toml', 'utf8').split(MARK)[0].trimEnd();
writeFileSync('netlify.toml', `${base}\n\n${MARK}\n# ${DECOY_COUNT} مؤشر خداع · ${exact.length + prefixes.length} قاعدة فخ\n${rules.join('\n')}`);
console.log('rules', rules.length);
