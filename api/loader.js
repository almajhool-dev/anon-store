// مُحمِّل الدالة: يجلب حزمة الواجهة الخلفية من التخزين ويتحقق من بصمتها SHA-256 قبل تشغيلها (منع أي تلاعب)
// التحديث: ارفع حزمة جديدة ثم حدّث API_CODE_URL و API_CODE_SHA256 (نشر إعدادات فقط)
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const { API_CODE_URL, API_CODE_SHA256 } = process.env;
let app, loading;
async function load() {
  const r = await fetch(API_CODE_URL, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('code_fetch_' + r.status);
  const code = Buffer.from(await r.arrayBuffer());
  if (createHash('sha256').update(code).digest('hex') !== API_CODE_SHA256) throw new Error('integrity_check_failed');
  try {
    app = (await import('data:text/javascript;base64,' + code.toString('base64'))).default;
  } catch {
    const f = join(tmpdir(), `api-${API_CODE_SHA256.slice(0, 12)}.mjs`);
    await writeFile(f, code);
    app = (await import(pathToFileURL(f).href)).default;
  }
}
export default {
  async fetch(req) {
    try { if (!app) await (loading ||= load().finally(() => { loading = null; })); } catch (e) {
      console.error('loader', e.message);
      return new Response('{"error":"starting"}', { status: 503, headers: { 'content-type': 'application/json', 'retry-after': '5' } });
    }
    return app.fetch(req);
  },
};
