// خادم محلي يغلّف دالة Neon لاختبارها (يحاكي x-forwarded-for عبر x-test-ip)
import http from 'node:http';
const { default: app } = await import('../api/src/index.js');
http.createServer(async (req, res) => {
  const chunks = [];
  for await (const ch of req) chunks.push(ch);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string' && k !== 'x-forwarded-for') headers.set(k, v);
  headers.set('x-forwarded-for', req.headers['x-test-ip'] || '127.0.0.1');
  const r = await app.fetch(new Request('http://localhost:8787' + req.url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }));
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(8787, () => console.log('api on http://localhost:8787'));
