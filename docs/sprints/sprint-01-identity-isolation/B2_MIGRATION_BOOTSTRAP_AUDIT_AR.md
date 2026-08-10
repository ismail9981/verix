# B2 — تدقيق قابلية إعادة بناء قاعدة البيانات من الصفر

التاريخ: 2026-08-10  
الحالة: **اكتمل التدقيق؛ بوابة reproducibility فاشلة كما هو متوقع**  
النطاق: تشخيص فقط، بلا إصلاح للتاريخ أو RLS أو schema

## 1. Executive Summary

المستودع الحالي **لا يستطيع إعادة بناء قاعدة Verix التي يتوقعها التطبيق** عبر أمره canonical `npm run db:migrate`. الأمر نفسه ينتهي بنجاح (`exit 0`) على قاعدة فارغة، لكنه يقرأ `_journal.json` ويطبق `0000` و`0001` فقط. الملفات الملتزمة `0002` إلى `0016` وعددها 15 لا تدخل في التنفيذ، فتنتج قاعدة جزئية: 14 جدولًا و15 enum، مقابل 30 جدولًا و36 enum يعرّفها schema الحالي، وبلا RLS أو policies أو helper functions أو grants لأدوار التطبيق.

هذه ليست migration-command failure ظاهرة؛ إنها **silent semantic bootstrap failure**: Drizzle يبلغ نجاحًا بينما الـcatalog لا يطابق التطبيق. أول نقطة انقطاع منطقية هي أن `0002_settings_expand.sql` غير ممثل في journal ولا يُنظر إليه أصلًا.

أظهر replay تشخيصي منفصل للملفات غير المعدلة أن `0000`–`0002` تعمل على PostgreSQL محلي عادي، ثم يفشل `0003` عند السطر 65 برسالة `role "authenticated" does not exist` وSQLSTATE `42704`. كما يفشل `rls.sql` نفسه عند السطر 13 قبل إنشاء أول helper لأن `auth.users` غير موجود، برسالة SQLSTATE `42P01`. وحتى لو وفّرت بيئة Supabase هذين الكائنين، يبقى `0003` وما بعده معتمدًا على `public.current_workspace_ids()` المنشأ فقط في ملف out-of-band غير موجود في journal.

النتيجة: لا يجوز بدء B3 على أساس أن migration bootstrap صالح. يجب أولًا اعتماد استراتيجية repair تحافظ على توافق البيئات ذات البيانات القائمة، ثم إثبات catalog parity على قاعدة جديدة وعلى نسخة آمنة ممثلة لبيئة قائمة.

## 2. Environment Used

استخدم التدقيق PostgreSQL المحلي الموجود مسبقًا؛ لم تُثبت أي حزمة أو خدمة:

| الخاصية | القيمة المثبتة |
|---|---|
| النوع | cluster محلي مؤقت ومعزول |
| الاستماع | `127.0.0.1` فقط |
| المنفذ | `55439` غير القياسي |
| قاعدة أول bootstrap | `verix_test_bootstrap` |
| قاعدة replay التشخيصي | `verix_test_sequence` |
| الأمر canonical | `npm run db:migrate` داخل `apps/web` |
| production/hosted resources | لم تُستخدم |

لم يُسجل password أو connection URL كامل. نتيجة التقرير الآلي لا تعرض إلا host وport واسم القاعدة، وتزيل URLs وusername/password من خرج العملية التابعة.

## 3. Safety Verification

قبل إنشاء/الاتصال بكل قاعدة تحقق B1 من:

* `NODE_ENV=test`.
* `VERIX_TEST_DATABASE=1`.
* وجود `TEST_DATABASE_URL` وعدم fallback إلى `DATABASE_URL`.
* host محلي مصرح.
* اسم قاعدة يحتوي `verix_test`.

`drizzle.config.ts` لا يقبل إلا `DATABASE_URL`. لذلك يشغّل harness أمر Drizzle الحالي بعد B1، ويمرر **قيمة `TEST_DATABASE_URL` التي وافق عليها الحارس** إلى child process تحت الاسم الذي تتطلبه config. لا يقرأ harness `DATABASE_URL` كمصدر ولا يستخدمه fallback، وتُستبدل متغيرات Supabase بقيم test غير قابلة للاتصال بدل تمرير قيم البيئة المحيطة.

قبل أول migrate أثبت catalog أن `public` لا يحتوي جداول Verix أو enums أو functions أو policies، وأن جدول `drizzle.__drizzle_migrations` غير موجود.

## 4. Migration Inventory

| الملف | في journal؟ | الاعتماد والترتيب | التغيير البارز / اعتماد RLS |
|---|---:|---|---|
| `0000_slim_thunderbolts.sql` | نعم | بداية السلسلة | 14 جدولًا أساسيًا، 15 enum، FKs/indexes؛ لا RLS |
| `0001_payments_soft_delete.sql` | نعم | `0000` | حقول دفع وحذف منطقي وunique index للدفع المكتمل للحجز |
| `0002_settings_expand.sql` | لا | `settings` وenums من `0000` | توسيع إعدادات المظهر/الإشعارات/الجلسة/الحجز/الضريبة |
| `0003_website_builder.sql` | لا | `workspaces`؛ أدوار Supabase؛ helper خارجي | `sites`, `pages`, `page_sections` وRLS يعتمد `current_workspace_ids()` |
| `0004_website_publishing.sql` | لا | `sites` من `0003`؛ helper/role | `site_versions` وpublished pointer وRLS |
| `0005_rls_invoices_integrations.sql` | لا | base tables؛ helper/role | RLS وgrants لـ`invoices`, `integrations` |
| `0006_site_domains.sql` | لا | `sites`؛ helper/role | `site_domains` وdomain enums وRLS |
| `0007_domain_verification.sql` | لا | `site_domains` من `0006` | حقول verification/SSL وenumين |
| `0008_seo_fields.sql` | لا | `sites/pages` من `0003` | حقول SEO وOpen Graph |
| `0009_leads.sql` | لا | `sites/customers`؛ helper/role | `leads`, enum, indexes وRLS |
| `0010_crm_pipeline.sql` | لا | `workspaces/customers/team_members`؛ helper/role | أربع جداول CRM وثلاثة enums وRLS |
| `0011_reservations.sql` | لا | base tenant tables؛ extension؛ helper/role | `rental_units`, `reservations`, exclusion constraint وRLS |
| `0012_property_management.sql` | لا | `rental_units` من `0011`؛ helper/role | `properties`, `buildings` وإعادة تشكيل `rental_units`; يفترض بيانات صفرية قبل NOT NULL |
| `0013_housekeeping.sql` | لا | كائنات `0011/0012`؛ helper/role | `housekeeping_tasks`, ثلاثة enums، constraints وRLS |
| `0014_billing.sql` | لا | base + CRM + reservations + housekeeping؛ helper/role | billing normalization، `invoice_line_items`، triggers/functions وRLS |
| `0015_billing_actor_attribution.sql` | لا | `payments/team_members` و`0014` معنويًا | actor attribution؛ موثق بأنه طبق مباشرة على `DATABASE_URL` |
| `0016_billing_actor_immutability.sql` | لا | function وcolumn من `0014/0015` | يستبدل trigger function لحماية actor attribution |

الترتيب الاسمي `0000`–`0016` قابل للاستنتاج من الملفات، لكنه **ليس ترتيبًا قابلًا لإعادة التنفيذ عبر Drizzle** لأن metadata تنتهي عند `0001`. كما أن ترتيب RLS prerequisite بالنسبة إلى `0003` غير ممثل أصلًا.

## 5. Journal Analysis

`drizzle/meta/_journal.json` بصيغة version 7 ويحتوي entryين فقط:

1. `0000_slim_thunderbolts`
2. `0001_payments_soft_delete`

المجلد `drizzle/meta` يحتوي snapshotين مطابقين لهذين الاسمين فقط. لذلك:

* journal وsnapshots متسقان **مع بعضهما**.
* هما غير متسقين مع 17 ملف SQL ملتزم ومع schema الحالي.
* Drizzle نظر إلى entryين وكتب صفين فقط في `drizzle.__drizzle_migrations`.
* وجود ملفات SQL إضافية في المجلد لم يجعل Drizzle يطبقها.
* لا توجد metadata يمكن منها إثبات generation history أو ordering semantics للملفات `0002`–`0016`.

توجد أدلة صريحة على التطبيق اليدوي: تعليقات `0009`, `0010`, `0011`, `0012`, `0013`, `0014`, و`0015` تقول إن الملفات hand-written أو طُبقت مباشرة ضد `DATABASE_URL` بسبب history غير journaled. هذا يثبت workflow سابقًا خارج canonical migrator، لكنه لا يثبت حالة أي production catalog بعينه.

## 6. Out-of-Band RLS Analysis

`src/server/db/rls.sql` يعلن صراحة أنه out-of-band. ينشئ:

* `public.current_workspace_ids()`، ويعتمد على `auth.users` وعلى مطابقة البريد مع `public.users`.
* `public.current_comember_ids()`.
* `public.current_conversation_ids()`.
* grants للأدوار `authenticated` و`anon`.
* RLS/policies للجداول الأساسية المختارة.

المشكلات المثبتة:

1. plain PostgreSQL لا يملك schema/table `auth.users`؛ يفشل الملف عند أول function، SQLSTATE `42P01`.
2. plain PostgreSQL لا يملك دوري `authenticated` و`anon`؛ `0003` يفشل عند أول GRANT، SQLSTATE `42704`.
3. migrations `0003`, `0004`, `0005`, `0006`, `0009`, `0010`, `0011`, `0012`, `0013`, و`0014` تستدعي `public.current_workspace_ids()` من policy ولا تنشئه.
4. تشغيل `rls.sql` قبلها مطلوب في بيئة Supabase الحالية، لكنه ليس خطوة في package scripts أو journal.
5. `rls.sql` لا يغطي وحده كل الجداول اللاحقة؛ بعض RLS موجود داخل ملفات migrations غير journaled. وبالتالي لا `rls.sql` وحده ولا journal وحده يشكلان مصدرًا كاملًا.

## 7. First Fresh Bootstrap Result

الأمر الجاري كما هو معرف حاليًا:

```text
npm run db:migrate
```

نتيجة Drizzle:

* exit code: `0`.
* الرسالة: migrations applied successfully.
* considered/applied بحسب journal وجدول Drizzle: `0000`, `0001` فقط.
* ignored by normal process: `0002`–`0016`.
* لا PostgreSQL command error في أول canonical attempt.
* نتيجة بوابة B2: exit غير ناجح عمدًا لأن harness يرفض اعتبار bootstrap ناجحًا مع 15 ملفًا unjournaled.

## 8. Exact Failure Point

توجد نقطتا فشل مختلفتان يجب عدم خلطهما:

1. **Canonical bootstrap:** ينتهي تقنيًا بنجاح، لكن أول divergence هو عدم اعتبار `0002_settings_expand.sql`. لذلك أول object-level gap هو توسعة `settings`، ثم لا تُنشأ كل كائنات `0003` فما بعده. لا توجد SQLSTATE لأن Drizzle لم يحاول تلك الملفات.
2. **Unchanged sequential diagnostic replay:** بعد نجاح `0000`–`0002` وإنشاء جداول `0003` وتمكين RLS عليها، يفشل `0003_website_builder.sql:65` عند `GRANT ... TO authenticated`:
   * SQLSTATE: `42704` (`undefined_object`).
   * الرسالة الآمنة: `role "authenticated" does not exist`.

واختبار `rls.sql` دون اختراع Supabase stubs يفشل عند `rls.sql:13`:

* SQLSTATE: `42P01` (`undefined_table`).
* الرسالة الآمنة: `relation "auth.users" does not exist`.

بعد توفير كائنات Supabase في بيئة ممثلة، ستكون dependency التالية هي وجود helper قبل إنشاء policies في `0003`. لم يُعدل شيء لإخفاء هذه النقاط.

## 9. Partial Catalog State

| الفئة | baseline | بعد canonical migrate | قراءة النتيجة |
|---|---:|---:|---|
| public tables | 0 | 14 | جداول `0000` فقط |
| public enums | 0 | 15 | enums `0000` فقط |
| foreign keys | 0 | 24 | علاقات baseline فقط |
| indexes | 0 | 51 | تشمل PK/unique/indexes من `0000/0001` |
| unique constraints | 0 | 6 | baseline فقط؛ يوجد أيضًا partial unique index من `0001` منفصل عن هذا العد |
| RLS-enabled tables | 0 | 0 | لا RLS |
| policies | 0 | 0 | لا policies |
| public functions | 0 | 0 | لا helpers ولا billing triggers |
| grants لـ`authenticated/anon` | 0 | 0 | الأدوار غير موجودة أصلًا |
| Drizzle migration rows | 0 | 2 | يطابق journal الناقص |

الجداول الموجودة: `ai_conversations`, `ai_messages`, `bookings`, `customers`, `files`, `integrations`, `invoices`, `notifications`, `payments`, `services`, `settings`, `team_members`, `users`, `workspaces`.

## 10. Application-vs-Fresh-DB Gaps

schema الحالي يعرّف 30 جدولًا و36 enum. تفتقد القاعدة الجديدة 16 جدولًا كاملًا:

`invoice_line_items`, `sites`, `pages`, `page_sections`, `site_versions`, `site_domains`, `leads`, `crm_pipelines`, `crm_stages`, `crm_opportunities`, `crm_activities`, `properties`, `buildings`, `rental_units`, `reservations`, `housekeeping_tasks`.

كما تفتقد 21 enum حاليًا مستخدمًا في schema، وتوجد gaps داخل الجداول الأربعة عشر الموجودة، منها:

* حقول `settings` الموسعة من `0002`.
* website/SEO/domain fields من `0003`–`0008`.
* billing enums، invoice snapshots/audit fields، payment ledger/refund/idempotency/actor fields، reservation payment state من `0014`–`0016`.
* billing constraints، exclusion/unique indexes، trigger functions، وcurrency normalization.

لا توجد RLS/policies/functions/grants إطلاقًا بعد canonical migrate. لذلك catalog لا يطابق توقعات التطبيق وظيفيًا أو أمنيًا، حتى للجداول الأساسية الموجودة.

## 11. Database Role Findings

الدور المثبت في **البيئة المؤقتة فقط** كان:

| الخاصية | القيمة |
|---|---:|
| `rolsuper` | true |
| `rolbypassrls` | true |
| `rolcreatedb` | true |
| `rolcreaterole` | true |
| CREATE على قاعدة الاختبار | true |

هذه الخصائص مناسبة لتشخيص DDL فقط، ولا تثبت أي شيء عن production role. كما أنها تجعل الدور غير صالح لإثبات enforcement فعلي لـRLS؛ اختبار RLS اللاحق يحتاج أدوارًا غير bypass وبـclaims ممثلة، وهو خارج B2.

## 12. Root Cause Analysis

السبب الجذري مركب:

1. توقفت metadata canonical بعد `0001` بينما استمر التطوير بملفات SQL يدوية.
2. جرى تطبيق migrations لاحقة مباشرة في بعض البيئات بحسب تعليقات الملفات، فصار catalog الفعلي المحتمل منفصلًا عن journal.
3. RLS helpers وأجزاء policies موضوعة في `rls.sql` خارج history، بينما أجزاء أخرى داخل migrations غير journaled.
4. Supabase platform prerequisites (`auth.users`, `authenticated`, `anon`) غير ممثلة في disposable plain-Postgres bootstrap.
5. بعض migrations تعتمد على افتراضات بيانات زمنية، وأوضحها `0012` الذي يحول FKs إلى NOT NULL اعتمادًا على أن `rental_units` كان فارغًا.
6. snapshots لا تصف schema الحالي، لذا لا يمكن استخدام `generate` كدليل إصلاح تلقائي آمن.

## 13. Repair Options

### A. إضافة `0002`–`0016` إلى journal/meta كما هي

قد تعيد تشغيل الملفات على قاعدة جديدة، لكنها خطرة على البيئات القائمة: timestamps/hashes/stamping غير مثبتة، بعض الملفات applied manually، وSupabase/RLS prerequisite غير محلول. لا يوصى بها دون catalog inventory واختبارات upgrade واقعية.

### B. historical baseline migration للحالة الحالية

يبني fresh DB من وصف موحد، ويمكن أن يضم functions/grants/policies بترتيب صريح. الخطر هو كيفية تمييز البيئات القائمة كـbaselined دون إعادة DDL أو إخفاء drift.

### C. forward-only reconciliation migration

يحافظ على معنى التاريخ ويضيف migration واحدة تقيس/تكمل الناقص بصورة idempotent. لكنه سيكون كبيرًا ومعقدًا، ويجب أن يتعامل مع كل حالة جزئية ومع data backfills، لا أن يفترض أن `IF NOT EXISTS` يثبت تطابق columns/constraints/functions.

### D. fresh baseline مع أرشفة legacy history

أوضح deploys الجديدة، لكنه يخلق مسارين للـfresh والـexisting environments ويحتاج عملية stamping/version cutover موثقة ومحكومة.

### E. تحويل `rls.sql` إلى migration ملتزم

ضروري للوصول إلى single source of truth، لكنه ليس إصلاحًا مستقلًا: يلزم قرار حول Supabase prerequisites وهوية helper الجديدة، خصوصًا أن Sprint 1 سيستبدل email linkage بـ`auth_user_id`.

## 14. Recommended Repair Strategy

التوصية الآمنة هي قرار baseline/reconciliation قائم على الأدلة، بالترتيب التالي في مهمة مستقلة معتمدة:

1. أخذ inventory read-only لـmigration table وcatalog وchecksums في كل بيئة قائمة ممثلة، دون تشغيل SQL قديم عليها.
2. تحديد canonical target catalog من schema + constraints/functions/RLS المطلوبة، مع إدخال قرار ADR-001 للهوية كي لا نثبت email-based helper كتصميم طويل الأمد.
3. إنشاء مسار fresh deterministic واحد: baseline حالي مكتمل أو reconciliation migration مكتفية ذاتيًا بعد `0001`، ويحتوي ترتيب Supabase-compatible prerequisites/functions/grants/policies صراحة.
4. إنشاء upgrade/stamping path منفصل للبيئات القائمة، مبني على catalog parity لا على افتراض أن الملف اليدوي طُبق.
5. إثبات المسارين آليًا: empty DB، ونسخ catalog fixtures تمثل الحالات الجزئية، ثم مقارنة tables/types/columns/constraints/indexes/functions/RLS/policies/grants.

لا يُنصح بإضافة entries إلى journal يدويًا فقط؛ ذلك يجعل Drizzle يشغل التاريخ، لكنه لا يحل اختلاف البيئات ولا dependency الخاصة بـRLS.

## 15. Risks of Each Repair Option

| الخيار | الخطر الأكبر |
|---|---|
| journal/meta repair فقط | إعادة تنفيذ تاريخ مطبق يدويًا أو فشل منتصف السلسلة وادعاء metadata غير مثبتة |
| historical baseline | accidental reapply على بيئة قائمة أو stamping يخفي drift |
| forward reconciliation | migration ضخمة ذات فروع كثيرة؛ `IF NOT EXISTS` قد يخفي تعريفًا مختلفًا |
| fresh baseline + legacy archive | تعقيد تشغيل مسارين واحتمال اختيار المسار الخطأ |
| RLS migration منفردة | تثبيت helper قديم أو فشل بسبب roles/auth schema دون حل schema parity |

في كل الخيارات، superuser test success لا يثبت RLS isolation، وmigration `0012` تحتاج معالجة بيانات حقيقية قبل فرض NOT NULL إن وجدت rental units قائمة.

## 16. B3 Handoff

B3 يجب ألا يبدأ بتنفيذ identity/RLS changes فوق bootstrap غير deterministic. مدخلاته المطلوبة:

* قرار معتمد: baseline أم reconciliation وكيفية ترقية البيئات القائمة.
* تعريف test-only Supabase compatibility (roles و`auth.users`/claims) أو خدمة اختبار ممثلة، بلا تقليد مضلل للإنتاج.
* canonical command واحد يبدأ من قاعدة فارغة ويصل إلى catalog متوقع بلا out-of-band SQL.
* non-superuser roles لاختبار enforcement، مع اختبار الدور المباشر وservice-role path بصورة منفصلة.
* catalog assertions تشمل columns/constraints/triggers، لا counts فقط.

الـharness المضاف في B2 قابل لإعادة الاستخدام بعد الإصلاح، ويظل الآن يفشل عمدًا عند وجود unjournaled SQL كي لا يعطي false green.

## 17. Acceptance Status

| المعيار | الحالة | الدليل |
|---|---|---|
| استخدام B1 guards | مكتمل | رفض التنفيذ قبل safety؛ target محلي باسم test-only |
| clean baseline مثبت | مكتمل | كل فئات catalog صفر قبل migrate |
| أول attempt دون repair | مكتمل | `npm run db:migrate` على الحالة الملتزمة نفسها |
| journal behavior مثبت | مكتمل | 2 entries و2 applied rows مقابل 17 SQL files |
| exact failure/dependencies | مكتمل | semantic gap عند `0002`; replay: `42704`; RLS: `42P01` |
| catalog comparison | مكتمل | 14/30 tables، 15/36 enums، و0 RLS/functions/policies |
| role inspection | مكتمل | خصائص الدور المؤقت موثقة ومحدودة النطاق |
| diagnostic automation | مكتمل | `test:db:bootstrap`؛ يفشل ولا يصلح تلقائيًا |
| migration reproducibility gate | **فاشل** | schema الناتج لا يطابق التطبيق |
| repair implemented | غير منفذ عمدًا | خارج B2 ويتطلب approval |

### Validation المسجل

* focused B1/B2 database tests: 16/16 passed.
* canonical diagnostic: اكتشف الفشل الدلالي وخرج non-zero كما صُمم.
* relevant web tests: 575/575 passed.
* root `npm run check-types`: passed (3/3 tasks).
* root `npm run lint`: passed (3/3 tasks).
* `git diff --check`: passed.
