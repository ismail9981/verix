# B4.1 — تقوية حارس الاتصال بقواعد البيانات المستضافة

**البوابة:** `PASS`  
**النطاق:** أمان اتصال أدوات قاعدة البيانات المحلية/الاختبارية فقط  
**الفرع:** `develop`

## 1. ملخص الحادث

أثناء تحقق B4 شُغّل أمر هجرة من دون متغيرات الاختبار الصريحة. حاول Drizzle الاتصال بعنوان pooler مستضاف مصدره `.env`. فشل حل المستأجر/المضيف قبل تنفيذ SQL رقم 1؛ لم تتغير قاعدة مستضافة أو إنتاجية. لا يمحو B4.1 الحادث أو يقلل منه، بل يغلق المسار الذي سمح ببدء المحاولة.

## 2. السبب الجذري

كان `apps/web/package.json` يعرّف `db:migrate` مباشرة كـ`drizzle-kit migrate`. يستورد Drizzle `drizzle.config.ts`، الذي يستورد `src/server/env.ts`، والذي يشغّل `dotenv.config()` ويختار `DATABASE_URL` من `.env`. عند غياب override محلي، وصلت قيمة pooler المستضافة إلى مُنشئ عميل Drizzle.

كانت أدوات B1 نفسها آمنة: تطلب `TEST_DATABASE_URL` ولا ترجع إلى `DATABASE_URL`. الفجوة كانت أن أمر الهجرة المباشر لا يستخدم B1 ولا مصنفاً قبل Drizzle.

## 3. فجوة الأمان السابقة

- لا توجد بوابة أمام أمر `db:migrate` الذي يكتبه المطور مباشرة.
- `drizzle.config.ts` مشروع production-aware بطبيعته، ولذلك لا يصلح وحده كحد أمان لأعمال الاختبار.
- فحص B1 سبق clients التي ينشئها test helper، لكنه لم يسبق subprocess خارجي بدأ من package script.
- لم يوجد فحص offline لعلامة ربط Supabase المستضافة.

## 4. نموذج تصنيف الوجهة

المصنف المركزي `classifyDatabaseTarget` يعيد إحدى الحالات:

- `LOCAL_SUPABASE_APPROVED`
- `LOCAL_POSTGRES_APPROVED`
- `REMOTE_FORBIDDEN`
- `PRODUCTION_LIKE_FORBIDDEN`
- `UNKNOWN_FORBIDDEN`

الافتراضي رفض. التصنيف pure ولا ينشئ socket أو client ولا يطبع URL.

## 5. الوجهات المحلية المعتمدة

- Supabase المحلي: host هو `127.0.0.1` أو `localhost`، والمنفذ `54322`، والقاعدة `postgres`، مع `VERIX_LOCAL_SUPABASE=verix`.
- PostgreSQL disposable: `localhost` أو `127.0.0.1` أو `::1`، وقاعدة يحتوي اسمها `verix_test`.
- Docker/CI: اسم خدمة DNS مفرد فقط، مثل `verix-postgres`، ومضاف صراحة إلى `TEST_DATABASE_ALLOWED_HOSTS`، مع اسم قاعدة `verix_test*`.

لا تسمح allowlist بعناوين IP أو أسماء dotted domains، ولذلك لا يمكن استخدامها للسماح الصامت بعنوان LAN أو remote.

## 6. الوجهات البعيدة الممنوعة

يُرفض قبل الاتصال:

- `*.supabase.co` و`*.supabase.com`.
- أسماء pooler وSupavisor المعروفة بالـhostname labels.
- مزودو قواعد معروفون مثل Neon/AWS/Azure/Render.
- أي public hostname غير مصرح.
- أي IPv4/LAN/private address غير loopback.
- أسماء قواعد production-like أو غير حاوية `verix_test` خارج عقد Supabase المحلي.
- URL malformed أو protocol غير PostgreSQL.

الوجهة التي حاولها B4 كانت، بصورة منقحة: **Supabase hosted transaction-pooler hostname**؛ لا يُحفظ hostname الكامل أو اسم المستخدم أو كلمة المرور في التقرير.

## 7. قواعد متغيرات البيئة

يلزم دائماً:

- `NODE_ENV=test`
- `VERIX_TEST_DATABASE=1`
- `TEST_DATABASE_URL` صريح

لا يُستخدم `DATABASE_URL` fallback. إذا ساوى `TEST_DATABASE_URL` قيمة `DATABASE_URL` يرفض. إذا وُضع `VERIX_LOCAL_SUPABASE` مع endpoint لا يطابق عقد Verix المحلي يرفض كتعارض. wrapper الهجرة يمرر URL المعتمد وحده إلى child كـ`DATABASE_URL` لأن Drizzle Kit يحتاج هذا الاسم، بعد إكمال التصنيف.

## 8. حارس ربط مشروع Supabase

يفحص الحارس محلياً فقط `supabase/.temp/project-ref`. وجود قيمة غير فارغة يعني أن CLI مرتبط بمشروع مستضاف، فتُرفض أدوات الأمن والهجرة قبل client/subprocess. لا يشغّل الحارس `supabase link` ولا API ولا DNS. ملف branch المحلي `supabase/.branches/_current_branch` ليس project link ولا يؤدي إلى رفض.

نتيجة المستودع الحالية: لا توجد علامة `project-ref` مستضافة.

## 9. الفرض قبل الاتصال

- `createTestDatabaseClient` يصنف الوجهة ويفحص project link قبل استدعاء `postgres(...)`.
- `runCanonicalMigrationCommand` يصنف ويفحص العلامة قبل استدعاء migration runner.
- `db:migrate` أصبح wrapper يستدعي المسار نفسه؛ الأمر المجرد يرفض قبل تشغيل Drizzle حتى لو احتوى `.env` على عنوان production صالح للتطبيق.
- adoption/catalog/prerequisite/identity/relationship tools تستمر باستخدام `withTestDatabase` المركزي.

تثبت mocks أن client factory وmigration runner لا يُستدعيان عند المنع.

## 10. تنقيح بيانات الاعتماد

رسالة الرفض قد تعرض classification وhostname واسم القاعدة عند إمكان تحليلهما بأمان. لا تعرض username أو password أو query parameters أو URL كاملاً. تُستبدل connection string وأجزاؤها وPostgreSQL URLs في stdout/stderr للـchild بـ`[REDACTED]`.

## 11. اختبارات الانحدار

اجتازت safety suite **78/78** في 7 ملفات. تغطي:

- قبول `127.0.0.1` و`localhost` لـSupabase المحلي.
- قبول Docker service صريح فقط.
- رفض Supabase/pooler/Supavisor/public/LAN/malformed/production-like.
- رفض flags الناقصة و`DATABASE_URL` fallback والتناقضات.
- عدم استدعاء client constructor أو migration subprocess عند الرفض.
- تنقيح credentials وURLs.
- رفض project-link marker offline.
- استمرار حواجز B1 للعمليات التدميرية.

## 12. إعادة تحقق B4

- B4 identity/migration: **11/11**.
- B3 RLS: **33/33**.
- B3.2 relationships: **4/4**، والفحص التجميعي **40/40** آمن.
- Supabase prerequisites: جميع المتطلبات `PRESENT`.
- fresh local bootstrap `0000→0004`: ناجح، خمس هجرات وبصمة مطابقة.
- migration no-op rerun: ناجح.
- post-B4 verify: `ADOPTABLE`، البصمة `0cc36df95708af1261001284404a9262e6e05717060090a1714d682e7dfb0a79`.
- web unit suite: **637/637** في 40 ملفاً.
- typecheck وlint وproduction build و`git diff --check`: ناجحة.

فحص B2 التاريخي `test:db:catalog` يقارن عمداً قاعدة pre-Sprint-1؛ لذلك يرفض catalog ما بعد B4 بوصفه drift. هذا متوقع وليس بوابة catalog الحالية؛ تحقق post-B4 المرقم هو الدليل الملائم ونجح.

## 13. القيود المتبقية

- الحارس مخصص لأدوات local/test/database-security، ولا يمنع runtime production من استخدام `DATABASE_URL` المستضاف المشروع له.
- الأسماء المفردة في Docker allowlist تعتمد ثقة مشغل CI؛ لا تقبل dotted/IP targets.
- أوامر Supabase CLI المحلية يجب أن تظل تستخدم `--local` صراحة؛ حارس TypeScript لا يعترض CLI عشوائياً خارج package scripts.
- لا يوجد remote workflow معتمد في هذه المهمة؛ أي workflow مستقبلي يحتاج عقداً وموافقة منفصلين.

## 14. بوابة B4 النهائية

`PASS`. أصلحت B4.1 سبب `REVIEW_REQUIRED`: أصبح المسار الذي تسبب بالمحاولة يرفض قبل Drizzle والاتصال، مع دليل اختباري على عدم وصول constructors/runners. لم تتغير دلالات الهوية أو migration `0004`.

## 15. جاهزية B5

B5 غير محجوب بسبب اتصال B4. لا يبدأ إلا بطلب مستقل معتمد. لم يبدأ B4.1 Active Workspace أو capability enforcement أو FORCE RLS أو Store أو Platform Admin.
