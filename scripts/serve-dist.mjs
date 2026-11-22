// خادم محلي لاختبار البناء بنفس رؤوس الأمان (CSP...) الخاصة بالإنتاج + توجيه SPA
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
const root = 'dist/web', extra = process.env.EXTRA_CONNECT || '';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain', '.png': 'image/png' };
const hdr = {};
let cur;
for (const line of readFileSync(join(root, '_headers'), 'utf8').split('\n')) {
  if (!line.trim()) continue;
  if (!line.startsWith(' ')) { cur = line.trim(); hdr[cur] = {}; continue; }
  const i = line.indexOf(':'); hdr[cur][line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
http.createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join(root, path);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  const h = { ...hdr['/*'], 'content-type': types[extname(file)] || 'application/octet-stream' };
  h['Content-Security-Policy'] = h['Content-Security-Policy'].replace("connect-src 'self'", `connect-src 'self' ${extra}`).replace('upgrade-insecure-requests', '');
  delete h['Strict-Transport-Security'];
  res.writeHead(200, h);
  res.end(readFileSync(file));
}).listen(5173, () => console.log('dist on http://localhost:5173'));
