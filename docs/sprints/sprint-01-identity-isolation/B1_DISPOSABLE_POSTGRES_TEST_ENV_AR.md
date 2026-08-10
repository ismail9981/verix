# B1 — بيئة PostgreSQL اختبارية قابلة للإتلاف

## الحالة

تم تنفيذ بنية الأمان والاختبار الخالص الخاصة بالمهمة B1. لم يتم الاتصال بقاعدة PostgreSQL، ولم تُشغّل migrations أو SQL هدّام. إثبات الاتصال وbootstrap يبدأ في B2 بعد توفير instance اختبارية معتمدة.

## البنية المعاد استخدامها

* حزمة `postgres` المثبتة أصلًا لإنشاء client محدود عند الحاجة.
* Vitest الحالي مع config مستقل لا يغيّر suite التطبيق.
* npm workspace scripts الحالية.
* TypeScript/ESLint الحاليان.
* نمط environment validation الحالي، مع parser مستقل للاختبارات حتى لا يستورد `DATABASE_URL`.

لم تُثبت حزم جديدة ولم يُنشأ نظام موازٍ للمهاجرات.

## الإعداد

انسخ القيم المثال من `apps/web/.env.test.example` إلى ملف محلي متجاهل مثل `.env.test.local` أو صدّرها في shell:

```env
NODE_ENV=test
VERIX_TEST_DATABASE=1
TEST_DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/verix_test
TEST_DATABASE_ALLOWED_HOSTS=
```

لا يحمّل script ملف الأسرار تلقائيًا. يجب أن تكون المتغيرات موجودة في بيئة عملية الاختبار. لا تستخدم `DATABASE_URL` بدلًا من `TEST_DATABASE_URL`.

## حواجز الأمان

تستدعي كل lifecycle/destructive entry point الدالة المركزية `assertSafeTestDatabase()` قبل إنشاء client أو تشغيل callback. يلزم:

1. `NODE_ENV=test`.
2. `VERIX_TEST_DATABASE=1`.
3. وجود `TEST_DATABASE_URL` بلا fallback.
4. ألا يساوي `TEST_DATABASE_URL` قيمة `DATABASE_URL`.
5. URL صالح ببروتوكول `postgres:` أو `postgresql:`.
6. اسم قاعدة يحتوي `verix_test` ولا يكون اسمًا عامًا مثل `postgres` أو `verix` أو `production`.
7. host محلي/CI معروف، أو مضاف صراحة إلى `TEST_DATABASE_ALLOWED_HOSTS`.
8. رفض hosts ذات نمط production/Supabase/pooler/cloud المعروف قبل allowlist.
9. رسائل الخطأ ثابتة ولا تعرض username/password/full URL.

إضافة host إلى allowlist لا تتجاوز باقي الحواجز.

## التشغيل

اختبارات طبقة الأمان فقط، ولا تتصل بقاعدة:

```sh
npm run test:db:safety --workspace web
```

البنية المستقبلية:

`createTestDatabaseClient()` يتحقق ثم ينشئ postgres.js client محدودًا، و`withTestDatabase()` يغلقه دائمًا، و`runGuardedDestructiveTestDatabaseOperation()` هو المدخل الإلزامي لأي reset/drop/recreate callback مستقبلي.

## دورة الحياة المستهدفة

1. parse وحماية environment.
2. إنشاء اتصال إلى PostgreSQL اختباري مصرح فقط.
3. B2 يضيف reset/bootstrap خلف destructive guard.
4. تشغيل integration tests.
5. إغلاق client ثم إزالة instance/الحالة الاختبارية بأمان.

## CI لاحقًا

في B2 يمكن إضافة PostgreSQL service/container disposable إلى CI باسم قاعدة مثل `verix_test_ci` ومستخدم اختبار فقط، مع:

* `NODE_ENV=test` و`VERIX_TEST_DATABASE=1`.
* `TEST_DATABASE_URL` يشير إلى service، لا Supabase.
* host service مضاف صراحة إلى `TEST_DATABASE_ALLOWED_HOSTS`.
* credentials اختبارية مولدة في CI ولا production secrets.
* teardown تلقائي بانتهاء job.

لم يُعدّل CI في B1 لأن لا live integration suite أو bootstrap معتمد بعد.

## ما لم يُنفذ

* لا connectivity probe حقيقي.
* لا migration bootstrap أو إصلاح journal.
* لا reset/drop SQL.
* لا RLS/role harness.
* لا schema أو identity أو Active Workspace/Store changes.
* لا production migration أو secret usage.

## تسليم B2

على B2 توفير PostgreSQL disposable فعلي، ثم تنفيذ reset/bootstrap callback عبر guard الحالي، والتحقق من catalog/migration history. يجب ألا يغيّر B2 هذه الحواجز لتجاوز فشل الاتصال؛ بل يصلح إعداد البيئة أو يطلب قرارًا إذا تعارضت متطلبات host مع النموذج المعتمد.
