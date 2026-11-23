# CLAUDE.md — دليل مختصر للمشروع

## البنية
- `web/` واجهة Vite + JavaScript خام (بلا إطار)، RTL. قوالب آمنة عبر `html\`\`` في `lib/dom.js` (هروب تلقائي) — لا تستخدم innerHTML لبيانات المستخدم خارجها.
- `api/` دالة Neon (Node 24). `api/src/*` تُحزَّم بـ esbuild في `dist/api/index.mjs`.
- `db/` ترحيلات SQL مرقّمة. RLS مفعّل على كل الجداول.

## قرارات أساسية
- كل طلب API يمر بـ: CORS → حظر IP → كشف أنماط الهجوم → تحديد المعدل → JWT (Neon Auth, EdDSA/JWKS) → ensure_profile → صلاحيات.
- قاعدة البيانات: كل استعلام عبر `c.db` (يضبط `set local role store_api` + `app.uid`). **لا تستخدم `sql.query` مباشرة في المسارات** (ستعمل بصلاحيات المالك وتتجاوز RLS).
- استثناء موثّق: `ownerQ` في index.js لجداول `ops` فقط (مفتاح تشفير AES-256-GCM للرسائل والردود والملاحظات + سجل أجهزة المدير)؛ لا تستخدمه في المسارات.
- صلاحيات المدير تُفحص في الخادم وتُفرض أيضاً بسياسات RLS ومشغّلات (profiles_guard).
- التخزين: Neon Object Storage (S3). الرفع المجزأ مباشرة من المتصفح بروابط موقعة؛ التحميل بروابط GET موقعة (15 دقيقة، الفيديو 4 ساعات).
- النشر بلا أسرار: الدالة تستخدم `DATABASE_URL` المحقون من Neon، والمُحمِّل يتحقق من SHA-256 للحزمة.
- تحديد المعدل يُبطئ فقط (429) ولا يحظر (CGNAT في العراق)؛ الحظر التلقائي لأنماط الهجوم فقط.
- المحتوى القابل للتعديل في `settings` (`content`, `pages`) ويُدمج مع `lib/content.js`؛ أيقونة الهاتف وصورة المشاركة بمفاتيح ثابتة `media/brand/app-icon|share`. قيم jsonb تُمرَّر `JSON.stringify` (عميل sql.js يحوّل المصفوفات لمصفوفات Postgres).

## الأوامر
- `npm run dev` واجهة محلية · `node scripts/dev-api.mjs` API محلي (يقرأ `.env.local`)
- `npm run db:migrate` · `node scripts/db.mjs claim` (رمز تفعيل المالك)
- `npm run test:api` (يتطلب خادم API محلي) · `API_URL=... node scripts/smoke-prod.mjs`
- الاختبار على فرع Neon منفصل (لا على الإنتاج): `NODE_USE_ENV_PROXY=1 node scripts/with-env.mjs /tmp/branch.json scripts/dev-api.mjs` ثم نفس الأمر مع `scripts/test-api.mjs` (ملف JSON يحوي DATABASE_URL/OWNER وNEON_AUTH_* وAWS_* للفرع).
- نشر API: `npm run build:api && node scripts/publish-api.mjs` ثم تحديث `API_CODE_URL/API_CODE_SHA256` في الدالة.

## قواعد
- لا تُرفع أسرار إلى Git (`.env*` مستثناة). لا بيانات تجريبية في الإنتاج.
- حدّث PROJECT_STATUS.md عند تغيّر الحالة فقط.
