# B2 — تنفيذ مهاجرة Platform Admin Foundation والتحقق المحلي

## 1. النتيجة التنفيذية

نُفذت مهاجرة Drizzle canonical واحدة:

`apps/web/drizzle/0006_platform_admin_foundation.sql`

وطابقت قاعدة Supabase المحلية والـfresh disposable database الكتالوج النهائي
نفسه. نجحت مسارات fresh والترقية من `0005`،وثبت عزل جدولي المنصة عن
`anon|authenticated|service_role`،وبقي Supabase Auth ومسار Drizzle الخادمي
عاملين. لم تُنشأ واجهات أوroutes أوactions أوservices أوbootstrap CLI أوStore
schema،ولم يحدث اتصال مستضاف أوcommit أوpush أوbranch switch.

## 2. pre-audit

قبل أي تعديل ثبت الآتي:

- الفرع `develop`.
- HEAD و`origin/develop` كلاهما
  `ee3ac8db2c6e72ecc754a8f67760d62deeb4b87e`.
- working tree احتوت فقط مجلد وثائق Sprint 2 غير المتتبع المتوقع.
- migration journal انتهى عند `0005_postgrest_acl_hardening` بعدد `6/6`.
- post-B6.3 verifier أعاد `ADOPTABLE` وgrants=`0` والبصمة:
  `97ae43f970ac648de8f50e49898828ca6958ef4b4d949353ff524f1b38ee2294`.

لم تُستبدل أوتُحذف أي وثيقة Sprint 2 موجودة.

## 3. مسؤوليات `0006`

المهاجرة الأمامية تنفذ بالترتيب:

1. إنشاء enums السبعة:
   - `platform_admin_role`.
   - `platform_admin_status`.
   - `platform_audit_action`.
   - `platform_audit_actor_kind`.
   - `platform_audit_outcome`.
   - `platform_audit_target_type`.
   - `workspace_status`.
2. إنشاء `platform_admins` بقيود الهوية المركبة.
3. إنشاء `platform_audit_events` بكل checks/FK/indexes المعتمدة.
4. إضافة `workspaces.status`،ثم backfill صريح إلى `active`،ثم default وNOT NULL.
5. إنشاء index `workspaces_status_created_at_idx(status,created_at)`.
6. منع تغيير `platform_admins.auth_user_id` عبر trigger.
7. منع كل UPDATE/DELETE على Platform Audit عبر trigger append-only.
8. استبدال `current_workspace_ids()` بجسم يربط Workspace ويشترط
   `status='active'` و`deleted_at IS NULL`.
9. تمكين RLS على جدولي المنصة بلا policies.
10. تطبيق targeted revokes على الجدولين والدوال الجديدة،وإعادة schema-wide
    revoke من `anon` و`authenticated`،وإعادة revoke للدالة المقواة.

لا تحتوي المهاجرة بيانات bootstrap أوAuth UUID ثابتًا أوStore domain.

## 4. Drizzle schema والـmetadata

تزامنت التعريفات authoritative في:

- `src/server/db/schema/enums.ts`.
- `src/server/db/schema/tables.ts`.
- `src/server/db/schema/relations.ts`.
- `src/server/db/schema/index.ts` عبر exports القائمة.

أضيفت inferred select/insert types لـPlatform Admin وPlatform Audit. ولدت أداة
Drizzle المعتمدة:

- `drizzle/meta/0006_snapshot.json`.
- إدخال journal بالـ`idx=6` والـtag
  `0006_platform_admin_foundation`.

أعاد `npx drizzle-kit check` النتيجة `Everything's fine`،وعدد SQL/journal/
snapshot النهائي `7/7/7` بلا migration غير مسجلة.

## 5. schema النهائي

### 5.1 `platform_admins`

- UUID PK مولد.
- `auth_user_id uuid NOT NULL` وفريد.
- unique مركب `(id,auth_user_id)` لدعم actor integrity.
- role مغلق:`super_admin|support_admin`.
- status مغلق:`active|suspended`،default active.
- `created_at|updated_at`.
- لا email أوuser/workspace/team FK أوsoft delete.
- trigger يرفض rebind لـAuth UUID بـSQLSTATE `23514`.

### 5.2 Workspace lifecycle

- `workspaces.status workspace_status NOT NULL DEFAULT 'active'`.
- القيمتان فقط `active|suspended`.
- لا suspension timestamp/reason columns.
- index `(status,created_at)`.

### 5.3 `platform_audit_events`

يتضمن actor kind،actor Platform ID/Auth UUID snapshot،closed action/target/outcome
vocabularies،target،request correlation،idempotency UUID،SHA-256 fingerprint،
JSON object metadata محدودة بـ16 KiB،وoccurred timestamp.

تفرض DB:

- composite actor FK مع `ON DELETE RESTRICT`.
- system bootstrap exception محددة بدقة.
- actor طبيعي كامل وغير bootstrap.
- target لكل success.
- idempotency key/fingerprint pair.
- lowercase 64-hex fingerprint.
- request ID بطول 1–128.
- object metadata بالحجم المحدد.
- unique successful actor/action/key.
- bootstrap success واحد فقط.
- رفض كل UPDATE/DELETE.

## 6. تصحيح B1 الموثق

ذكر B1 أن `platform_admins.auth_user_id` immutable،لكن قائمة DDL المقدرة لم
تتضمن وسيلة DB تمنع UPDATE. uniqueness تمنع UUID مكررًا فقط ولا تمنع إعادة ربط
row إلى UUID جديد. لذلك أضيف function/trigger ضيقان للimmutability،وحُدث تقرير B1
ليشرح التصحيح صراحة.

نتيجة ذلك أن العدد الفعلي الصحيح هو `12 functions/9 triggers` بدل التقدير
`11/8`. لم تُغير schema لتطابق عدداً تقديرياً،ولم يتغير قرار معماري آخر.

## 7. تحقق bootstrap والـactor FK

اختبار محلي داخل rollback transaction أنشأ أول Super Admin ثم حدث:

`platform_admin.bootstrap_completed`

داخل transaction نفسها. استخدم الحدث:

- `actor_kind='system_bootstrap'`.
- actor ID/Auth UUID كلاهما NULL.
- admin الجديد target غير NULL.
- outcome success.

نجح الإدراجان ذرياً. لا circular FK لأن admin هو target لاactor. كما نجح حدث
Platform actor بزوج ID/Auth صحيح،وفشل الزوج غير المتطابق بـ`23503`. وفشلت أشكال
system/domain والsuccess بلا target غير الصحيحة بـ`23514`.

مجموعة Platform foundation: `11/11` في `1/1` ملف.

## 8. قرار `service_role` والـACL

### 8.1 الدليل قبل المهاجرة

أنشئ table probe داخل transaction ثم rollback قبل `0006`. أظهرت
`has_table_privilege` عدم وجود SELECT/INSERT/UPDATE/DELETE افتراضي لـ:

- `anon`.
- `authenticated`.
- `service_role`.

وهذا يطابق precedent الكتالوج post-B6.3 ذي grants=`0`. لذلك لم تكن المهاجرة
تعالج grant قائمًا،لكن targeted revoke بقي حزاماً صريحاً ضد اختلاف default ACL
بين البيئات.

### 8.2 الدليل بعد المهاجرة

- catalog verifier أثبت صفر grants للأدوار الأربعة المراقبة.
- `has_table_privilege` أثبت صفر CRUD على الجدولين للأدوار الثلاثة.
- `has_function_privilege` أثبت عدم تنفيذ الدوال الجديدة و
  `current_workspace_ids()` للأدوار الثلاثة.
- PostgREST رفض SELECT/INSERT/UPDATE/DELETE على الجدولين عبر service key.
- `admin.auth.admin.listUsers()` نجح بنفس service key؛Supabase Auth لم يتعطل.
- اختبارات postgres.js الموثوقة أدرجت admin/audit rows بنجاح؛Drizzle/Postgres
  لا يعتمد PostgREST أوACL دور `service_role`.

القرار النهائي:الإبقاء على revoke الصريح من `service_role` آمن ومفيد،ولا توجد
حالة production في المستودع تحتاج Data API CRUD بهذا الدور.

## 9. Workspace suspension وRLS

مجموعة tenant RLS: `34/34` في `1/1` ملف. الحالة الجديدة أثبتت بالتسلسل:

1. Workspace active وmembership active يظهران في `current_workspace_ids()`،
   ويظهر tenant row المشروع.
2. بعد suspension تبقى membership نفسها active وموجودة.
3. الدالة تعيد صفراً للWorkspace المعلقة.
4. query تستخدم Workspace/row IDs القديمة كما لو كان السياق stale تعيد صفراً.
5. بعد activation تعود الدالة والوصول المشروع عندما تنجح شروط الهوية والعضوية.

تستبعد الدالة أيضاً Workspace المحذوفة كما اعتمد B1. لا تغير المهاجرة published
site rendering أوpublic forms؛مجموعة public-site/public-form المركزة نجحت
`159/159` في `14/14` ملفاً،والبناء شمل routes العامة بنجاح.

مهم:اتصال Drizzle الخادمي privileged يتجاوز RLS. فلترة `workspaces.status` في
Active Workspace resolver/gates التطبيقية تبقى مهمة Sprint 2 لاحقة قبل إتاحة
suspension action. لا توجد suspension action في B2،ولم يوسع هذا التنفيذ نطاق
database foundation إلى application authorization.

## 10. عزل Platform tables وPostgREST

- RLS enabled وغير forced على الجدولين.
- policy count لكل جدول يساوي صفراً.
- لا tenant FK في `platform_admins`.
- null/duplicate Auth UUID مرفوضان.
- القيم غير الصحيحة للأدوار والحالات والأفعال/targets/outcomes مرفوضة بالـenum.
- suspended admin row يبقى ولا يحرر UUID.
- actor/reference integrity وmetadata/request/idempotency checks نجحت.
- UPDATE وDELETE في audit رفضا بـ`55000`.
- anon وJWT employee authenticated رُفضت لهما العمليات الأربع على الجدولين.
- اختبار B6.3 الموسع أثبت JWT owner/manager/employee صالحة لدى Auth،ثم أثبت
  Data API/RPC denial. النتيجة `10/10` في `1/1` ملف.

لم تنشأ view أوpublic RPC أوStorage/Realtime path.

## 11. fresh migration

أنشئت قاعدة disposable محلية باسم `verix_test_b2_fresh` داخل PostgreSQL الخاص
بـSupabase المحلي،مع Supabase prerequisites الدنيا فقط. أثبت baseline صفر Verix
tables وledger صفر،ثم طبق:

`0000 → 0001 → 0002 → 0003 → 0004 → 0005 → 0006`

النتيجة:

- migration exit code `0`.
- SQL/journal/snapshot=`7/7/7`.
- unjournaled SQL=`0`.
- ledger=`7/7` وآخر hash/timestamp مطابقان لـ`0006`.
- catalog=`ADOPTABLE` والبصمة مطابقة.
- migrator rerun نجح no-op وبقي ledger `7`.

حُذفت قاعدة fresh بعد جمع الدليل.

## 12. upgrade من `0005`

أنشئت قاعدة disposable محلية `verix_test_b2_upgrade`،وطبق عليها `0000→0005`
فقط. قبل `0006` أضيفت fixtures ممثلة:

- مستخدمان مرتبطان بـAuth.
- Workspace اثنتان.
- عضويتان active بأدوار owner وmanager.

شغل verifier المهاجرة canonical ثم قارن snapshots للحقول الموجودة قبل الترقية.
النتيجة:

- ledger=`7`.
- existing Workspaces=`2`.
- active بعد backfill=`2/2`.
- users/workspaces/memberships data preserved=`true`.
- Platform Admin rows=`0`.
- Platform Audit rows=`0`.

لم يقع data loss أوbootstrap ضمني. حُذفت قاعدة upgrade والـtemporary six-file
migration fixture بعد التحقق.

## 13. الكتالوج والبصمة النهائية

ولد generator الجديد من قاعدة Supabase المحلية فقط:

- `post-s2-b1.json`.
- `post-s2-b1.fingerprint.json`.

| العنصر      | الفعلي |
| ----------- | -----: |
| tables      |     32 |
| enums       |     43 |
| indexes     |    102 |
| constraints |    200 |
| functions   |     12 |
| triggers    |      9 |
| RLS enabled |     32 |
| policies    |     30 |
| grants      |      0 |

البصمة authoritative:

`9df35d82ec24c7c8e630108e0366a9c673ba42ca2d8c07e1a191e1bdfeef16cb`

الفرق الوحيد عن تقدير B1 في الفئات المحددة هو function/trigger الإضافيان
للimmutability،وقد وثق تصحيحه في B1.

## 14. انحدارات Sprint 1

شغلت المجموعات بالتسلسل لتجنب fixture/lock contention:

| البوابة                                 |                              النتيجة |
| --------------------------------------- | -----------------------------------: |
| database safety/catalog/bootstrap units |                      78/78،7/7 ملفات |
| Supabase prerequisites                  |                          8/8 PRESENT |
| historical tenant RLS coverage          |      30/30 policies،uncovered CRUD=0 |
| relationship preflight                  | 40 relationships،كل anomaly counts=0 |
| relationship integration                |                          4/4،1/1 ملف |
| immutable identity                      |                      11/11،2/2 ملفات |
| Active Workspace                        |                        10/10،1/1 ملف |
| tenant RLS + suspension                 |                        34/34،1/1 ملف |
| Platform foundation                     |                        11/11،1/1 ملف |
| PostgREST/Auth/RPC                      |                        10/10،1/1 ملف |

إجمالي مجموعات Vitest DB/security أعلاه:`158/158` في `14/14` ملفاً. ويتحقق
capability enforcement ضمن مجموعة التطبيق الكاملة أدناه. لم تُضعف اختبارات B3
أوB3.2 أوB4 أوB5 أوB6؛تغير gate المحلي فقط ليطلب catalog post-0006 الجديد،مع
بقاء manifests التاريخية وبصماتها immutable.

## 15. تحقق التطبيق

| الأمر                      |                 النتيجة |
| -------------------------- | ----------------------: |
| web unit/application tests |     657/657،46/46 ملفاً |
| repository typecheck       |               3/3 tasks |
| repository lint            | 3/3 tasks،zero warnings |
| uncached production build  |      2/2 tasks،Cached 0 |
| Drizzle check              |                    PASS |
| `git diff --check`         |                    PASS |

فشل build أول داخل sandbox لأن Turbopack مُنع من إنشاء worker/binding local
port بـ`EPERM`. أعيد الأمر نفسه خارج قيد sandbox ونجح uncached كاملاً؛ليس خطأ
source أوschema.

## 16. tooling والملفات

أضيف:

- migration وsnapshot `0006`.
- generator/verifier للcatalog النهائي.
- verifier قابل لإعادة التشغيل لمسار `0005→0006` على disposable DB مجهزة.
- Vitest config ومجموعة Platform foundation.
- manifests post-Sprint-2.
- هذا التقرير.

وحدث:

- Drizzle enums/tables/relations/types.
- journal وpackage scripts.
- migration bootstrap latest-catalog gate/inventory.
- catalog scope مع filters تحفظ pre-Sprint-1 manifest immutable.
- RLS harness/suspension regression.
- PostgREST regression.
- B1 لتوثيق تصحيح immutability فقط.

## 17. المخاطر المتبقية وحدود B2

1. `postgres`/runtime DB role privileged ويتجاوز RLS؛كل Platform service مستقبلية
   يجب أن تفرض PlatformActorContext/capability قبل Drizzle كما يطلب ADR-003.
2. Active Workspace application query لا تستهلك Workspace status بعد؛يجب إغلاق
   ذلك قبل تنفيذ suspension UI/action. DB RLS مغلق الآن،لكن RLS وحدها لا تقيد
   اتصال server privileged.
3. metadata size/type مضمونة في DB،أما per-action allowlist ومنع PII/secrets
   فمسؤولية writer service المستقبلية واختباراتها.
4. owner/database-operator يستطيع تجاوز RLS وappend trigger بتغيير schema؛هذا
   trust boundary تشغيلي وليس client boundary.
5. public sites/forms بقيت عاملة عمداً حسب B1؛suspension لا تعني unpublish في
   Sprint 2.

لا تمثل هذه النقاط فشلاً لمهاجرة database foundation،لكنها شروط إلزامية للمهام
التطبيقية اللاحقة ولا يجوز اعتبار `0006` وحدها authorization layer كاملة.

## 18. الحالة النهائية

- canonical migration applied locally ومثبتة fresh وupgrade.
- main repository-local Supabase ledger=`7/7`.
- disposable targets والملفات المؤقتة أزيلت.
- لا hosted/production access.
- لا commit أوpush أوbranch switch أوrestore أوclean.
- working tree يحتفظ بوثائق Sprint 2 السابقة وتغييرات B2 المقصودة فقط.

`B2: PASS — DATABASE FOUNDATION VERIFIED`
