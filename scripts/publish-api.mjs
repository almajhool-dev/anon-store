// ينشر حزمة الواجهة الخلفية إلى التخزين (media/sys) ويجهّز حزمة المُحمِّل الصغيرة + الإعدادات العامة
import { readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { build } from 'esbuild';
import { AwsClient } from 'aws4fetch';
const E = process.env;
const code = readFileSync('dist/api/index.mjs');
const sha = createHash('sha256').update(code).digest('hex');
const url = `${E.AWS_ENDPOINT_URL_S3.replace(/\/$/, '')}/media/sys/api-${sha.slice(0, 16)}.mjs`;
const s3 = new AwsClient({ accessKeyId: E.AWS_ACCESS_KEY_ID, secretAccessKey: E.AWS_SECRET_ACCESS_KEY, service: 's3', region: E.AWS_REGION });
const put = await s3.fetch(url, { method: 'PUT', body: code, headers: { 'content-type': 'text/javascript; charset=utf-8' } });
if (!put.ok) throw new Error('upload failed ' + put.status);
const check = await fetch(url);
const ok = createHash('sha256').update(Buffer.from(await check.arrayBuffer())).digest('hex') === sha;
await build({ entryPoints: ['api/loader.js'], bundle: true, platform: 'node', target: 'node22', format: 'esm', minify: true, outfile: 'dist/loader/index.mjs' });
rmSync('dist/loader.zip', { force: true });
execSync('zip -q -9 -j dist/loader.zip dist/loader/index.mjs');
const env = { API_CODE_URL: url, API_CODE_SHA256: sha, ALLOWED_ORIGINS: 'https://majhool-store.netlify.app' };
if (E.NEON_API_KEY) {
  // نشر إعدادات فقط عبر Neon API (المُحمِّل نفسه لا يتغير)
  const fd = new FormData();
  fd.set('environment', JSON.stringify(env));
  const r = await fetch(`https://console.neon.tech/api/v2/projects/${E.NEON_PROJECT_ID}/branches/${E.NEON_BRANCH_ID}/functions/api/deployments`, { method: 'POST', headers: { authorization: `Bearer ${E.NEON_API_KEY}` }, body: fd });
  console.log('neon deploy', r.status);
  if (!r.ok) process.exit(1);
} else {
  console.log(JSON.stringify({ public_check: ok, env }));
  console.log(readFileSync('dist/loader.zip').toString('base64'));
}
