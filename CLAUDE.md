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
- المصادقة من الواجهة عبر `/api/auth` (وكيل Netlify إلى Neon Auth) لتكون الكوكيز طرفاً أول؛ في التطوير `AUTH_PROXY_TARGET` لـ Vite. رموز البريد محفوظة SHA-256 (الاختبار يسترجعها بالتجربة على الفرع فقط).
- تحديد المعدل يُبطئ فقط (429) ولا يحظر (CGNAT في العراق)؛ الحظر التلقائي لأنماط الهجوم فقط.
- استوديو التصميم: الأقسام تُعلَّم بـ `data-sec`، و`lib/design.js` يضع `data-lay`/`data-pack` (الأزرار: `body[data-bpack|bfx]`) من إعداد `design` العام؛ المسودة/السجل/المفضلة في `private:design_*` ولا تُنشر إلا عبر `/admin/design/publish|restore` (مع audit). المعاينة iframe بنفس النطاق `?dsp=1` + postMessage (لذا `frame-ancestors 'self'`).
- الفخاخ: `api/src/decoys.js` (3000 مؤشر، محتوى اصطناعي فقط). قواعد Netlify في `netlify.toml` مولّدة بـ `node scripts/gen-netlify.mjs` (لا تعدّلها يدوياً، و`_redirects` فارغ عمداً). طلبات الفخاخ موقّعة JWS (`API_SIGNATURE_TOKEN` في Netlify = `ops.secrets.edge_sign_v1`) فنثق بـ `x-nf-client-connection-ip` ونحظر العنوان الحقيقي؛ بلا توقيع: تسجيل فقط.
- الأداء: `lib/vitals.js` → `/vitals` (sendBeacon نصي، يتجاهل البوتات) → `perf_samples`/`client_errors` (RLS: إدراج للجميع، قراءة للمدير). كل رد API يحمل `Server-Timing` (app/db). الجودة `body[data-q]` = أقل من (سقف المدير، قدرة الجهاز)، و`localStorage.lite` يفرض 1. الإقلاع: كاش الإعدادات `settings_v1`، والزائر غير المسجّل (`signed_in`) لا ينتظر فحص الجلسة.
- حركات الأزرار (`lib/liquid.js`): حبة نشطة تنزلق وتتمطّط في `.nav` و`.drawer nav` و`.adm-side` و`.tabs` (تتحرك فقط عند تغيّر الزر النشط)، وتلتحم بشريط حافة قائمة المدير؛ طي القائمة `.adm.rail` (localStorage `adm_rail`). المفاتيح في `site.anim.liquid|glassnav|rail` (افتراضياً مفعّلة، والشكل الأصلي بدونها) ← `body[data-lq|lqglass|lqrail]`.
- التحديثات: كل نشر يحذف ملفات النسخة السابقة ⇒ `main.js` يعيد التحميل مرة عند فشل استيراد صفحة (`vite:preloadError`، حارس 20 ث في sessionStorage)، و`lib/update.js` يقارن `__BUILD_AT__` بـ `build-stats.json` (عند التركيز/كل 5 د) فيظهر «تحديث الآن» ويصبح التنقل كاملاً. `public/boot.js` يعيد المحاولة مرة إن فشلت الحزمة الأساسية (`window.__boot`) ثم يعرض رسالة. لا تُخرج عناصر خارج الشاشة بإزاحة سالبة (RTL يجعلها تمريراً أفقياً).
- المحتوى القابل للتعديل في `settings` (`content`, `pages`) ويُدمج مع `lib/content.js`؛ أيقونة الهاتف وصورة المشاركة بمفاتيح ثابتة `media/brand/app-icon|share`. قيم jsonb تُمرَّر `JSON.stringify` (عميل sql.js يحوّل المصفوفات لمصفوفات Postgres).

## الأوامر
- `npm run dev` واجهة محلية · `node scripts/dev-api.mjs` API محلي (يقرأ `.env.local`)
- `npm run db:migrate` · `node scripts/db.mjs claim` (رمز تفعيل المالك)
- `npm run test:api` (يتطلب خادم API محلي) · `API_URL=... node scripts/smoke-prod.mjs`
- الاختبار على فرع Neon منفصل (لا على الإنتاج): `NODE_USE_ENV_PROXY=1 node scripts/with-env.mjs /tmp/branch.json scripts/dev-api.mjs` ثم نفس الأمر مع `scripts/test-api.mjs` (ملف JSON يحوي DATABASE_URL/OWNER وNEON_AUTH_* وAWS_* للفرع).
- نشر API: `npm run build:api && node scripts/publish-api.mjs` ثم تحديث `API_CODE_URL/API_CODE_SHA256` في الدالة.
- بعد تعديل الفخاخ: `node scripts/gen-netlify.mjs` (يتحقق من عدم تصادمها مع مسارات الموقع).

## قواعد
- لا تُرفع أسرار إلى Git (`.env*` مستثناة). لا بيانات تجريبية في الإنتاج.
- حدّث PROJECT_STATUS.md عند تغيّر الحالة فقط.
