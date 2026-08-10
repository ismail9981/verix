# B2.1 — تصميم إصلاح تاريخ المهاجرات واعتماد قواعد البيانات القائمة

التاريخ: 2026-08-10  
الحالة: **Proposed — تصميم وأدلة فقط**  
السبرنت: Sprint 1 — Identity and Tenant Isolation Hardening  
لا تمنح هذه الوثيقة موافقة على Migration أو تعديل metadata أو الاتصال بـProduction.

## 1. Executive Summary

التوصية هي **Hybrid Canonical Adoption Point**، وليست إعادة بناء التاريخ المفقود داخل Drizzle journal.

يبقى `0000` و`0001` التاريخ canonical المثبت. تحفظ ملفات `0002`–`0016` و`rls.sql` بأسمائها وchecksums بوصفها **legacy evidence**، ولا تضاف لاحقًا إلى journal على أنها migrations تاريخية مطبقة. في مهمة تنفيذية مستقلة، وبعد اعتماد catalog manifest، ينشأ migration تجميعي جديد بعد `0001` يمثل **صافي الحالة الحالية المعتمدة قبل تغييرات Sprint 1**: كل الفرق البنيوي بعد `0001` وكل كائنات Verix التطبيقية الموجودة حاليًا خارج التاريخ، بترتيب صريح وقابل لإعادة الإنتاج.

المساران منفصلان:

* **Fresh:** بيئة Supabase-compatible جديدة توفر prerequisites المملوكة لـSupabase، ثم يشغل Drizzle `0000` و`0001` وcanonical adoption migration ويثبت catalog fingerprint كاملًا.
* **Existing:** لا يشغل migration التجميعي. يفحص catalog والبيانات وledger read-only أولًا. إذا طابق manifest تمامًا، تسجل نقطة adoption المحددة فقط مع evidence؛ وإذا وجد drift، يطبق reconciliation معتمد ومخصص للحالة حتى تصل إلى exact match ثم تسجل adoption. أي unsafe conflict يوقف العملية.

كل migration بعد adoption point ينشأ طبيعيًا عبر Drizzle، يدخل journal وsnapshot في التغيير نفسه، ويختبر على fresh وadopted paths. `rls.sql` يتحول لاحقًا من مسار تشغيل يدوي إلى legacy reference بعد نقل application-owned functions/policies/grants إلى التاريخ canonical. لا تنشئ Verix مخطط Auth أو أدوار Supabase الداخلية.

هذه الاستراتيجية أكثر أمانًا من إضافة `0002`–`0016` إلى journal لأنها لا تجعل قاعدة قائمة أعيد تشكيلها يدويًا تعيد تشغيل SQL تاريخي، ولا تدعي أن Drizzle طبق migrations لم يثبت ledger تطبيقها.

## 2. Confirmed B2 Evidence

تحقق B2 محليًا، دون production connectivity، من الآتي:

1. `npm run db:migrate` انتهى بـ`exit 0` على قاعدة فارغة.
2. Drizzle قرأ فقط entries الموجودة في `_journal.json`.
3. journal يحتوي `0000_slim_thunderbolts` و`0001_payments_soft_delete` فقط.
4. يوجد 17 ملف SQL، و`0002`–`0016` غير ممثلة في journal أو snapshots.
5. نتج 14 جدولًا من أصل 30 يعرّفها application schema.
6. نتج 15 enum من أصل 36.
7. لم ينتج أي application RLS policy أو helper function أو grant متوقع لأدوار التطبيق.
8. replay منفصل غير معدل وصل إلى `0003:65` ثم فشل لأن role `authenticated` غير موجود، SQLSTATE `42704`.
9. `rls.sql:13` فشل على plain PostgreSQL لأن `auth.users` غير موجود، SQLSTATE `42P01`.
10. الدور المحلي المؤقت كان superuser و`BYPASSRLS`؛ لذلك أثبت DDL behavior لا RLS enforcement.

القراءة المحلية الحالية تؤكد أيضًا:

* `rls.sql` دخل Git بتاريخ 2026-07-10 في commit `2b67303`، قبل `0003` الذي دخل في 2026-07-11.
* السطر الثاني منه يقول إنه applied out-of-band، لكن Git لا يثبت أين أو متى شُغل فعليًا.
* تعليقات `0009`–`0015` توثق أن أجزاء من التاريخ hand-written وطُبقت مباشرة ضد `DATABASE_URL`.
* لا يوجد حاليًا `supabase/config.toml` أو local Supabase stack ملتزم في المستودع.

## 3. Supabase-Owned Prerequisites

المواصفة تعتمد Supabase كمزود Auth. وتوثق Supabase رسميًا أن المشاريع الجديدة تُجهز بأدوار منها `anon`, `authenticated`, `service_role`, `authenticator`, وroles إدارية، وأن Auth user محفوظ في Auth schema. لذلك يجب الفصل بين **وجود الكائن platform-owned** وبين **منح Verix صلاحية على كائن Verix-owned**.

| الكائن | المالك/المنشئ | هل تنشئه Verix migrations؟ | عقد Fresh | عقد الاختبار |
|---|---|---:|---|---|
| schema `auth` | Supabase Auth/platform | لا | preflight assertion | Supabase local stack؛ fixture مصغر فقط لاختبار سريع |
| `auth.users` وبنيته الداخلية | Supabase Auth | لا | assert وجود العلاقة/الأعمدة المستخدمة فقط؛ تقليل coupling | يوفرها stack؛ fixture يقلد أقل surface ولا يدعي parity |
| `auth.uid()` وAuth claim semantics | Supabase | لا | assert callable/behavior في supported environment | stack هو الدليل authoritative؛ fixture يدعم السيناريوهات المطلوبة فقط |
| role `authenticated` | Supabase/PostgREST | لا | assert role exists | stack أو test-only fixture |
| role `anon` | Supabase/PostgREST | لا | assert role exists | stack أو fixture؛ لا يمنح صلاحيات بلا حاجة |
| role `service_role` | Supabase | لا | assert properties المستخدمة، ولا تعديلها | stack فقط لاختبار bypass boundary؛ لا production key |
| role `authenticator` | Supabase/PostgREST | لا | ليس dependency مباشرة في SQL الحالي؛ يثبت ضمن stack لا في baseline | stack عند اختبار PostgREST |
| Supabase Auth/storage/admin roles | Supabase | لا | خارج managed manifest إلا إذا أصبحت dependency مباشرة | لا تقلد في fixture المصغر |
| ملكية/ACLs داخل `auth` | Supabase | لا | لا تعيد Verix تعريفها | assert required access فقط |

القواعد:

* Verix لا تنشئ ولا تعدل `auth.users` أو الأدوار platform-owned في migration production.
* migration/preflight يفشل برسالة واضحة إذا كانت البيئة ليست Supabase-compatible؛ لا يحاول تحويل plain PostgreSQL إلى Supabase production.
* grants من Verix على جداول/functions في `public` إلى `authenticated` أو `anon` هي **Verix-owned policy surface**، رغم أن role نفسه Supabase-owned.
* `service_role` bypass behavior لا يستخدم بوصفه بديلًا عن authorization، ويختبر منفصلًا عن authenticated user path.
* `btree_gist` dependency يعلنها `0011` عبر `CREATE EXTENSION IF NOT EXISTS`; تمكين extension المطلوبة لتصميم Verix مسؤولية تاريخ Verix، بينما توفرها وصلاحية إنشائها جزء من contract البيئة المدعومة.
* `gen_random_uuid()` مستخدمة منذ `0000`; يجب أن يثبت preflight توفرها في PostgreSQL version المدعومة بدل افتراض extension داخلي غير موثق.

مراجع الملكية والسلوك: [Supabase Postgres Roles](https://supabase.com/docs/guides/database/postgres/roles)، [Supabase Auth Users](https://supabase.com/docs/guides/auth/users)، و[Supabase Local Development](https://supabase.com/docs/guides/local-development/overview).

## 4. Verix-Owned Database Objects

يجب أن يعيد التاريخ الذي تتحكم به Verix إنتاج:

* جداول `public` الثلاثين الحالية وكل columns/defaults/nullability/identity behavior.
* 36 enum الحالية وترتيب labels.
* PKs وFKs وunique/check/exclusion constraints وvalidation/deferrability.
* indexes العادية والجزئية والفريدة وتعابيرها/predicates.
* extension enablement المطلوبة مباشرة لتصميم Verix مثل `btree_gist`، ضمن ما تسمح به Supabase.
* helper functions في `public`: حاليًا `current_workspace_ids`, `current_comember_ids`, `current_conversation_ids`، ثم بدائلها المعتمدة في ADR-001.
* RLS enable/force state، policies و`USING`/`WITH CHECK`، وgrants على Verix objects.
* billing trigger functions/triggers من `0014` وreplacement من `0016`.
* أي comments أو ownership/search-path/security-definer attributes تدخل في security contract.
* Drizzle migration ledger state وversioned catalog manifest الخاص بنقطة adoption.

لا تكفي Drizzle TypeScript schema وحدها؛ فهي لا تمثل كامل functions/triggers/RLS/grants أو كل operational history. والملفات الموجودة خارج journal لا تكفي لأنها غير قابلة للتنفيذ canonical.

## 5. Historical Migration Timeline

مصطلح idempotent أدناه يعني replay syntactic تقريبي فقط؛ `IF NOT EXISTS` لا يثبت تطابق تعريف موجود، ولذلك لا يعني adoption-safe.

| التسلسل | الملف | Snapshot/meta | التغييرات والاعتماديات | Supabase/RLS prerequisite | replay risk |
|---:|---|---|---|---|---|
| 0 | `0000_slim_thunderbolts.sql` | نعم | 14 base tables، 15 enums، FKs/indexes | لا RLS؛ `gen_random_uuid()` | **غير idempotent**؛ يفشل فورًا على types/tables قائمة |
| 1 | `0001_payments_soft_delete.sql` | نعم | payment fields وpartial unique index | لا | **غير idempotent**؛ duplicate columns/index |
| 2 | `0002_settings_expand.sql` | لا | حذف legacy settings وإضافة settings جديدة | base types/table | جزئيًا repeatable، لكن أول تشغيل يحذف columns/data وقد يخفي drift |
| 3 | `0003_website_builder.sql` | لا | `sites/pages/page_sections`, indexes, RLS | `authenticated` + `current_workspace_ids()` | `IF NOT EXISTS` لا يصلح تعريفًا مختلفًا؛ policy يعاد إسقاطها |
| 4 | `0004_website_publishing.sql` | لا | version enum/table، theme/published FK، RLS | objects من 0003 + role/helper | DO/IF EXISTS جزئي؛ constraints القائمة المختلفة قد تبقى |
| 5 | `0005_rls_invoices_integrations.sql` | لا | RLS/grants/policies لجدولين base | role/helper | يعيد policy membership-wide وقد يتراجع عن policy أحدث |
| 6 | `0006_site_domains.sql` | لا | domain enums/table/indexes/RLS | 0003 + role/helper | جزئي؛ definitions القائمة لا تتحقق |
| 7 | `0007_domain_verification.sql` | لا | verification/SSL enums/columns/indexes + data update | 0006 | repeatable جزئيًا؛ UPDATE له أثر بيانات و`IF NOT EXISTS` يخفي type/default drift |
| 8 | `0008_seo_fields.sql` | لا | SEO columns على sites/pages | 0003 | repeatable شكليًا؛ لا يثبت column definition |
| 9 | `0009_leads.sql` | لا | lead enum/table/indexes/RLS | 0003 + base + role/helper | موثق manual؛ يعيد policy قديمة |
| 10 | `0010_crm_pipeline.sql` | لا | 3 enums و4 CRM tables/indexes/RLS | 0009/base + role/helper | موثق direct apply؛ partial create لا يثبت parity |
| 11 | `0011_reservations.sql` | لا | `btree_gist`, units/reservations، exclusion constraint، RLS | extension privilege + role/helper | existing table مختلف قد يفوّت constraint؛ extension/role failure |
| 12 | `0012_property_management.sql` | لا | properties/buildings، إسقاط unit status، FKs/NOT NULL، RLS | 0011 + role/helper | **عالٍ**؛ يفترض `rental_units` فارغًا قبل NOT NULL ويحذف status/type |
| 13 | `0013_housekeeping.sql` | لا | 3 enums، task table، partial unique index، RLS | 0011/0012 + role/helper | جزئي؛ table موجودة ناقصة لا تُصلح |
| 14 | `0014_billing.sql` | لا | enum evolution، currency/data normalization، constraints، line items، 6 trigger functions/triggers، RLS | عدة domains سابقة + role/helper | **عالٍ**؛ data writes وconstraint recreation وfinancial trigger semantics |
| 15 | `0015_billing_actor_attribution.sql` | لا | actor FK/index على payments | 0014/base | شكليًا repeatable؛ column موجود بتعريف مختلف لا يُكتشف |
| 16 | `0016_billing_actor_immutability.sql` | لا | `CREATE OR REPLACE` لدالة immutability | function من 0014 + column من 0015 | يعيد تعريف security/business logic؛ يفشل إذا prerequisites ناقصة |

الترتيب الاسمي والـGit chronology يدعمان `0000→0016`، لكن لا توجد Drizzle metadata تثبت timestamps/hashes/transaction boundaries لـ`0002`–`0016`. لا يجوز اختراعها بوصفها تاريخًا حدث فعليًا.

## 6. RLS Historical Dependency

دخل `rls.sql` في Git مع corpus الجداول الأساسية بتاريخ 2026-07-10، ثم دخل `0003` في اليوم التالي مع policies تستدعي `current_workspace_ids()`. هذا يجعل ترتيب النية المرجح:

```text
0000 → 0001 → 0002 تقريبًا → rls.sql out-of-band → 0003 … 0016
```

لكن هذا **استنتاج Git** لا migration ledger. العبارة داخل الملف تثبت أنه كان خارج Drizzle، ولا تثبت catalogs التي استقبلته.

ملكية محتواه:

* Supabase-owned dependencies: `auth.users`, `auth.uid()`, roles.
* Verix-owned: functions الثلاث في `public`, execute grants عليها، RLS enablement، table grants، و12 policies أساسية.
* `0003`, `0004`, `0005`, `0006`, `0009`, `0010`, `0011`, `0012`, `0013`, `0014` تعتمد على helper خارجي.

كل Verix-owned content يجب أن يصبح migration-managed. يبقى الملف لاحقًا read-only legacy reference مع checksum وملاحظة superseded؛ لا يبقى خطوة runbook ولا يُحذف قبل catalog parity واعتماد archival.

## 7. Drizzle Journal and Metadata Analysis

النسخة المثبتة من `drizzle-orm` تقرأ `_journal.json` entry-by-entry، تحمل ملف `${tag}.sql`، تقسمه على statement breakpoints، وتحسب SHA-256 لمحتوى SQL. PostgreSQL migrator ينشئ `drizzle.__drizzle_migrations` ويحفظ `hash` و`created_at`، لكنه يقرر التنفيذ بمقارنة **آخر `created_at`** مع `journalEntry.when`.

الآثار المهمة:

1. SQL غير الموجود في journal لا يقرأ.
2. الـhash محفوظ لكنه ليس في هذا الإصدار equality gate يمنع تعديل ملف سبق تطبيقه.
3. إضافة entries تاريخية ذات `when` أعلى من آخر ledger تجعل قاعدة قائمة تعيد تشغيلها، حتى لو كانت objects موجودة يدويًا.
4. تزوير `when` أقل من آخر ledger قد يجعلها تُتخطى في بعض البيئات وتُطبق في أخرى، ولا يمثل حقيقة تاريخية.
5. snapshotان الحاليان صالحان فقط لخط `0000/0001`. لا يمكن استنتاج snapshots المفقودة بصورة موثوقة من SQL اليدوي وحده.
6. snapshot جديد لنقطة adoption يمكن إنشاؤه بأداة Drizzle المثبتة من schema الحالي بعد تثبيت target manifest؛ functions/RLS/grants تبقى في SQL/manifest لأن snapshot لا يغطيها كلها.

ما يمكن إعادة بنائه بأمان:

* hashes للملفات legacy كما هي اليوم، بوصفها evidence لا ledger truth.
* manifest للحالة النهائية من schema + SQL + disposable catalog مثبت.
* entry/snapshot **جديدان** لنقطة adoption المستقبلية بعد `0001`.

ما لا يمكن إعادة بنائه بلا دليل بيئي:

* `when`, applied order، أو hashes التاريخية الفعلية لـ`0002`–`0016` في production.
* الادعاء بأن ملفًا يدويًا معينًا طبق كاملًا أو مرة واحدة.
* policy/function definitions الفعلية في قاعدة قائمة دون catalog inspection.

## 8. Option A Evaluation — Reconstruct Historical Drizzle Journal

تقنيًا يمكن إضافة entries للملفات، لكن ذلك لا يعيد الحقيقة التاريخية:

* fresh database قد يحاول الملفات بالترتيب بعد توفير Supabase prerequisites وhelper.
* existing database ذات schema مطبق يدويًا وledger ينتهي `0001` ستعتبر كل entry الجديدة pending.
* `0000/0001` غير idempotent، والملفات اللاحقة idempotent جزئيًا فقط.
* `0012` و`0014` تحملان أخطار data/financial semantics، وإعادة policy قد توسع صلاحيات.
* لا توجد snapshots أو timestamps أصلية يمكن استرجاعها.

الحكم: **مرفوض كاستراتيجية مباشرة**. لا يصبح مقبولًا إلا مع adoption mechanism يمنع replay بعد fingerprint؛ وعندها لا توجد فائدة من الادعاء بسبعة عشر حدثًا تاريخيًا بدل adoption point واحدة صادقة.

## 9. Option B Evaluation — New Canonical Baseline

Baseline كامل من empty DB يعطي fresh determinism ويجمع application-owned RLS، لكنه يحتاج إما migration directory/ledger جديدين أو آلية تمنع `0000/0001` من التنفيذ معه. كما يحتاج existing environments إلى stamping خاص ولا يمكن تشغيله عليها.

المزايا: وصف واحد واضح للحالة الحالية، واختبار fresh بسيط.  
المخاطر: مساران للـledger، config/custom runner إضافي، وصعوبة future generation إذا لم يثبت snapshot lineage.

الحكم: صالح نظريًا، لكنه أكثر تعقيدًا من consolidation بعد `0001` لأن أول migrationين مثبتان بالفعل ويعيدان base سليمة.

## 10. Option C Evaluation — Forward-Only Reconciliation

يمكن migration مستقبلية ضخمة أن تفحص/تنشئ الناقص. لكنها يجب أن تتعامل مع عدد كبير من الحالات الجزئية وتعريفات متعارضة وdata backfills. `IF NOT EXISTS` وحده يعطي false green.

يمكنها حل fresh bootstrap فقط إذا احتوت **كل صافي الفرق بعد `0001`**، أي تصبح عمليًا canonical consolidation migration. أما سلسلة إصلاحات صغيرة تفترض objects قائمة فلن تحل fresh.

الحكم: مفيدة لإصلاح drift معروف في existing environments، وليست وحدها خطة adoption عامة.

## 11. Option D Evaluation — Hybrid Strategy

المكونات:

1. تثبيت checksums للتاريخ legacy ونقله مستقبلًا إلى archive غير executable.
2. Supabase prerequisite preflight وبيئة اختبار ممثلة.
3. versioned canonical catalog manifest.
4. consolidation migration جديدة بعد snapshot `0001` تمثل صافي pre-Sprint-1 schema + application-owned RLS.
5. fresh path يشغلها؛ existing path يصل إلى fingerprint نفسه ثم يسجل adoption دون تشغيلها.
6. كل المستقبل forward-only من adoption point.

المزايا: لا replay، fresh deterministic، ledger صادق على مستوى نقطة تبنٍّ، ومسار مستقبل واحد.  
المخاطر: cutover يحتاج تنسيقًا صارمًا؛ أي بيئة لم تعتمد قبل نشر migration قد تحاول تشغيلها؛ adoption stamping حساس ويحتاج transaction/evidence/approval.

الحكم: **الخيار الموصى به**.

## 12. Additional Option — Dual Migration Tracks

يمكن استخدام directory/ledger كامل جديد للـfresh baseline مع إبقاء ledger legacy للـexisting upgrade. يدعم فصلًا واضحًا لكنه يضاعف tooling وCI/runbooks ويزيد احتمال تشغيل track خاطئ. لا توجد حاليًا حاجة نشر تبرر ذلك، لذلك لا يوصى به إلا إذا أثبت prototype أن Drizzle لا يستطيع إنشاء consolidation snapshot آمن بعد `0001`.

## 13. Existing Database Adoption Design

### 13.1 مرحلة read-only evidence

لكل بيئة، وبهوية صريحة، ينتج inspector manifest JSON مرتبًا وثابتًا دون أسرار أو data values:

* PostgreSQL version، database identity masked، current role attributes.
* extensions المطلوبة وversions/schemas.
* tables/views/sequences ضمن managed schemas.
* columns بالترتيب: type/typmod/null/default/identity/generated/collation.
* enums labels وترتيبها.
* PK/FK/unique/check/exclusion definitions، validated/deferrable state.
* indexes عبر normalized `pg_get_indexdef` وpredicates.
* functions عبر normalized signature، language، volatility، security-definer، owner، config/search_path، وbody hash.
* triggers وتعريفاتها/enabled state.
* `relrowsecurity` و`relforcerowsecurity`.
* policies: command/roles/permissive/qual/with-check.
* schema/table/sequence/function grants وdefault privileges ذات الصلة.
* object owners حيث تؤثر في RLS/security-definer.
* `drizzle.__drizzle_migrations`: id/hash/created_at، وأي ledger آخر معروف.
* data-safety invariants منفصلة: row counts، nulls قبل NOT NULL، orphan FKs، enum values، duplicate candidates، وfinancial constraints؛ بلا raw PII.

ينتج SHA-256 للـcanonical JSON مع `manifest_version`, PostgreSQL/Drizzle versions، وlegacy file checksums.

### 13.2 تصنيف الفرق

| التصنيف | التعريف | الإجراء |
|---|---|---|
| exact match | كل managed object وsecurity attribute يطابق target | مؤهل لـadoption approval |
| compatible drift | اختلاف قابل للإضافة/التضييق بلا فقد بيانات، لكنه ليس target | لا stamp؛ reconciliation مستقل ثم إعادة الفحص |
| missing object | object مطلوب غير موجود | لا stamp؛ forward creation/backfill معتمد |
| unexpected object | object داخل managed scope غير موجود في target | review؛ allowlist فقط إن كان extension/platform-owned مثبتًا |
| unsafe conflict | نفس الاسم بتعريف/نوع/دلالة مختلفة، data invariant مكسور، policy أوسع، أو ledger متناقض | abort وعزل البيئة وخطة مخصصة |

لا يعتبر count أو اسم object وحده exact match. ولا يسمح compatible drift بتسجيل adoption حتى يصبح exact match.

### 13.3 adoption transaction المفاهيمية

بعد backup/restore rehearsal وchange window:

1. acquire advisory lock خاص بالـadoption ومنع deploy/migration متزامن.
2. إعادة fingerprint داخل النافذة ومقارنته بالـapproved digest.
3. التحقق من أن لا migration أحدث من adoption point موجودة.
4. تسجيل **entry نقطة adoption الجديدة فقط** بالـhash و`created_at` الرسميين؛ لا entries مزيفة لـ`0002`–`0016`.
5. تسجيل evidence ID/digest/actor/time في artifact تدقيق معتمد أو سجل adoption مخصص تقرر ملكيته لاحقًا.
6. commit ثم تشغيل canonical migrator؛ يجب أن يكون no-op.
7. إعادة fingerprint، smoke reads، وRLS catalog assertions.

إذا لم تكن قاعدة موجودة exact match، تطبق حزمة reconciliation مخصصة للحالة في مراحل additive/data/constraint، ثم تعاد الخطوات من البداية. لا branching migration عام على production.

## 14. Fresh Database Bootstrap Contract

### البيئة الرسمية

الهدف الرسمي هو **مشروع Supabase جديد أو Supabase local stack متوافق مع النسخة المعتمدة**، لا plain PostgreSQL مجهول. plain PostgreSQL + fixture يبقى fast diagnostic فقط.

### prerequisites قبل Verix migrate

* `auth` schema، `auth.users`, `auth.uid()` behavior المطلوب.
* `anon`, `authenticated`, `service_role` بالأدوار/خصائص Supabase المدعومة.
* PostgreSQL version وextension availability/privileges المعتمدة.
* migration role منفصل وموثق الصلاحيات؛ لا production service key في CI.

### ما تنشئه Verix

`0000`, `0001`, ثم adoption consolidation وكل application tables/types/indexes/constraints/extensions enablement/functions/triggers/RLS/policies/grants.

### أمر الإثبات المستقبلي

يبقى entry point المفاهيمي B1-guarded مثل `npm run test:db:bootstrap --workspace web`، لكنه لا ينجح إلا إذا:

1. preflight Supabase prerequisites ناجح.
2. canonical `npm run db:migrate` exit 0.
3. ledger entries/hashes/timestamps متوقعة.
4. full catalog fingerprint يساوي manifest.
5. rerun migrate no-op ويحافظ على fingerprint.
6. لاحقًا B3 يثبت RLS behavior بأدوار non-bypass.

exit 0 وحده لا يمثل نجاحًا.

## 15. RLS Canonicalization Design

1. يفصل prerequisite assertion (`auth.*` وroles) عن DDL المملوك لـVerix.
2. يدخل المحتوى الحالي المملوك لـVerix في consolidation migration كي يعاد بناء pre-Sprint-1 state بلا خطوة يدوية.
3. يثبت function owner و`SECURITY DEFINER`, volatility، signature، و`search_path` صراحة في manifest.
4. يثبت grants وRLS/policies كتعريفات normalized، لا counts.
5. يحتفظ `rls.sql` مؤقتًا legacy evidence؛ بعد parity وapproval ينقل إلى archive أو يوسم superseded ولا يشغل.
6. تغييرات ADR-001 اللاحقة (UUID linkage) وrole-aware policies تكون migrations forward منفصلة؛ لا تعاد كتابة consolidation migration بعد تطبيقها.
7. يختبر B3 authenticated/anon/runtime/service paths، cross-tenant denial، revocation، والـowners الذين قد يتجاوزون RLS.

هذا لا يعتمد membership-wide policy كتصميم نهائي؛ هو baseline صادق للحالة السابقة، ثم تتحرك Sprint 1 للأمام بمهاجرات مراجعة مستقلة.

## 16. Recommended Strategy

### Fresh environments

Supabase-compatible stack → prerequisite assertion → `0000` → `0001` → canonical consolidation/adoption migration → full fingerprint → no-op rerun. لا legacy SQL يدوي.

### Existing environments

read-only fingerprint + data invariants → classification → exact match أو reconciliation approved → adoption transaction تسجل نقطة التجميع فقط → canonical no-op + parity. لا replay لـ`0002`–`0016` أو baseline.

### Future migrations

كل تغيير بعد النقطة يولّد entry وSQL وsnapshot معًا، ولا يعدل migration مطبقة. CI يختبر fresh path وupgrade من adopted fixture. custom SQL الخاص بـRLS/functions يعيش داخل migration نفسه ويظهر في catalog manifest.

### Test environments

طبقتان:

* B1 plain PostgreSQL guarded + minimal compatibility fixture لاختبارات سريعة، يخلق test-only roles/auth surface فقط بعد B1 ولا يستخدم production secrets.
* Supabase local stack pinned بوصفه release/security gate authoritative للـAuth roles/functions/PostgREST/RLS. إن تعذر تشغيله في CI، لا يدعى Supabase parity؛ تبقى البوابة معلقة.

## 17. Exact Implementation Phases

كل مرحلة change set منفصل وتتطلب موافقة قبل التالية:

| المرحلة | العمل المستقبلي | Gate |
|---:|---|---|
| 1 | تجميد legacy checksums وكتابة managed-object manifest schema فقط | review؛ لا DB write |
| 2 | إنشاء Supabase local compatibility contract/fixture تحت B1 | tests تثبت prereqs ولا تقلد production ownership |
| 3 | بناء schema fingerprint inspector read-only واختباره على catalogs مصغرة | deterministic output + secret/PII redaction |
| 4 | جرد read-only لكل existing environment المصرح بها | signed reports؛ لا reconciliation |
| 5 | اعتماد target pre-Sprint-1 catalog وقرار archive/tag/naming | owner/security/database approval |
| 6 | prototype على disposable فقط: نقل legacy خارج active track وإنشاء consolidation SQL + snapshot جديد | fresh parity + review لكل DDL/data statement |
| 7 | تصميم واختبار reconciliation packages للحالات الفعلية المكتشفة | staging restore، row invariants، lock timing |
| 8 | fresh Supabase bootstrap validation + rerun/no-op + manifest | 100% catalog parity |
| 9 | existing staging adoption rehearsal، بما فيه exact ledger stamping | backup restore drill + no replay |
| 10 | production adoption لكل بيئة بنافذة وموافقة مستقلة | abort gates + post-fingerprint |
| 11 | تفعيل future Drizzle workflow وCI fresh+upgrade gates | لا out-of-band SQL |
| 12 | نقل `rls.sql` وlegacy SQL إلى حالة archive/superseded بعد parity | approval؛ checksums محفوظة |

لا تبدأ C2 identity migration أو B3 RLS harness الكامل قبل اكتمال المراحل المطلوبة في قسم B3.

## 18. Rollback and Failure Strategy

* أي read-only fingerprint failure: لا تغيير؛ أصلح الأداة/الصلاحية ثم أعد.
* أي drift/unsafe conflict: abort؛ لا stamp ولا auto-fix.
* fresh failure: destroy disposable instance وأعد من empty بعد إصلاح migration في مراجعة جديدة.
* reconciliation failure قبل commit: rollback transaction إن كان DDL يسمح؛ وإلا استعادة disposable/staging وراجع الخطة.
* production: backup مشفر + restore drill قبل النافذة، statement/lock timeouts، advisory lock، ومراقبة connections.
* adoption entry failure: transaction rollback. بعد commit لا تحذف entry يدويًا إذا طبقت migration مستقبلية؛ يلزم runbook وتحقيق ledger.
* rollback التطبيق لا يعيد email-based authorization بعد الانتقال الأمني، ولا يحذف روابط identity صحيحة.
* لا down migration destructive عامة. عند تعذر rollback الآمن تكون الاستعادة من backup هي last resort المعتمدة.

## 19. Production Safety Requirements

1. موافقة صريحة باسم البيئة والنافذة والـartifact digest.
2. لا raw `DATABASE_URL`, passwords, service keys، أو PII في reports/logs.
3. اتصال read-only للجرد؛ migration role لا يستخدم قبل approval.
4. inventory للدور: owner, `rolsuper`, `rolbypassrls`, memberships, ACLs.
5. backup وrestore verification، لا مجرد وجود backup.
6. staging rehearsal من snapshot منزوعة الحساسية/محمية تمثل الحجم والانحراف.
7. counts، FK orphans، null/duplicate/enum/financial invariants قبل وبعد.
8. lock estimate وtimeouts وabort thresholds.
9. منع deploys المتزامنة ومستخدم واحد مخول للadoption.
10. لا `db:push`, SQL editor hotfix، أو journal edit يدوي غير موثق.
11. كل بيئة تعتمد منفردة؛ نجاح بيئة لا يثبت الأخرى.
12. لا تشغيل consolidation على existing database مهما بدا idempotent.

## 20. Test Requirements

* B1 guard rejection قبل أي fixture/reset/connect.
* fixture contract tests لأسماء/خصائص roles و`auth.uid()` surface المستخدمة.
* fingerprint golden tests لكل object category وnormalization/versioning.
* fresh bootstrap على Supabase-compatible empty instance.
* expected 30-table/36-enum pre-Sprint-1 manifest، مع columns/constraints لا counts فقط.
* ledger hash/timestamp assertions وsecond-run no-op.
* upgrade fixtures: ledger `0000/0001` + exact current catalog، partial 0002، partial 0003، missing RLS، divergent policy/function، و0012 data conflict.
* adoption refuses missing/unexpected/unsafe objects and never invokes migration first.
* reconciliation idempotency حيث صممت صراحة، مع data preservation.
* function/trigger body hashes، owners/search paths، RLS/grants/policies.
* B3 behavioral matrix كـanon/authenticated/non-bypass/runtime/service، cross-tenant وrevocation.
* secret/PII redaction tests وتقارير قابلة للتدقيق.
* CI: fresh + adopted upgrade، typecheck/lint/tests/diff-check؛ production connectivity ممنوعة.

## 21. Decisions Requiring Approval

1. اعتماد Hybrid Canonical Adoption Point بدل historical journal repair.
2. اعتماد أن canonical migration الجديدة تمثل **صافي delta بعد `0001`** لا full second ledger.
3. تحديد الاسم/رقم entry ووقت adoption الرسمي وكيف تحفظ legacy files خارج active migration directory.
4. اعتماد target manifest الدقيق، بما فيه هل current email-based RLS يدخل baseline مؤقتًا قبل استبداله بـADR-001.
5. اعتماد Supabase local CLI stack بوابة authoritative والنسخة المثبتة.
6. اعتماد حدود minimal plain-Postgres fixture وعدم اعتباره Supabase parity.
7. اعتماد migration/runtime/service roles وخصائصها المطلوبة.
8. اعتماد مكان تخزين adoption evidence وهل يحتاج جدول `schema_adoptions` أم artifact خارجيًا موقعًا.
9. اعتماد قواعد compatible drift وallowlist للكائنات platform-owned/unexpected.
10. اعتماد reconciliation وbackup/restore/rollout لكل existing environment بعد جردها.
11. اعتماد توقيت أرشفة `rls.sql` والlegacy SQL.

## 22. B3 Prerequisites

قبل B3 الكامل يجب توفر:

* fresh canonical bootstrap ناجح مع fingerprint، لا exit code فقط.
* test-only Supabase roles/Auth claims contract تحت B1.
* non-superuser/non-bypass actor switching موثوق.
* current RLS functions/policies/grants migration-managed أو fixture واضح المصدر مؤقتًا.
* عدم الحاجة إلى تشغيل `rls.sql` يدويًا.
* قرار migration/runtime/service role boundaries.
* adopted upgrade fixture يمثل قاعدة قائمة.

يمكن تطوير fixture/fingerprint كمهام تمهيدية معتمدة، لكن لا تنفذ identity/RBAC/Website permissions في B2.1.

## 23. Acceptance Criteria

- [x] أدلة B2 تحققت من repository.
- [x] Supabase-owned وVerix-owned مفصولان.
- [x] timeline `0000`–`0016` موثق مع dependencies/idempotency/replay risk/meta.
- [x] تاريخ واعتماد `rls.sql` موثق مع حدود ما يثبته Git.
- [x] Options A–D وdual-track البديل مقيمة.
- [x] توصية واحدة تفصل fresh/existing/future/test paths.
- [x] adoption لا يسجل migrations عميانيًا ويabort عند unsafe conflict.
- [x] fresh success معرف بـcatalog/ledger/no-op assertions، لا exit 0.
- [x] RLS canonical ownership مصمم دون امتلاك Supabase internals.
- [x] مراحل التنفيذ والrollback وproduction gates والقرارات موثقة.
- [x] لا repair أو migration أو journal/snapshot/RLS/schema change نُفذ في B2.1.
