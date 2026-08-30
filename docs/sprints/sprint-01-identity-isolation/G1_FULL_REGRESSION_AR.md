# G1 — التحقق الكامل لانحدارات Sprint 1

## 1. النتيجة التنفيذية

اكتمل تحقق V-FULL على commit `5db1822cd0ab59e038804acae38bf05d201852db` في فرع `develop`. نجحت اختبارات التطبيق، والبناء غير المخزن مؤقتًا، وسلسلة قاعدة البيانات المحلية، وبناء قاعدة disposable جديدة من المهاجرات الست، ومسار إعادة تشغيل المهاجر، واختبارات الهوية وActive Workspace والعلاقات وRLS وPostgREST/RPC.

لم يُستخدم أي اتصال مستضاف أو خارجي. أُنشئت قاعدة `verix_test_g1` داخل PostgreSQL الخاص بـSupabase المحلي، ونُفذت عليها مهاجرات fresh، ثم حُذفت بعد اكتمال الأدلة. لم يُعدّل G1 سلوكًا إنتاجيًا أو مخططًا أو اختبارًا؛ الملف الجديد الوحيد هو هذا التقرير.

يجوز بدء G2. توجد نقطتا توثيق يجب على G2 إغلاقهما صراحة من دون إعادة كتابة التاريخ:

1. ملفات ADR-001 وADR-002 ومصفوفة الصلاحيات ما زالت تحمل كلمة `Proposed` رغم أن commit الاعتماد `4bd6c03` عنوانه `docs: approve Sprint 1 identity and isolation plan` وأن التنفيذ اللاحق اعتمدها.
2. نص E4 الأصلي يطلب role-aware RLS، بينما القرار النهائي المعتمد والمنفذ هو capability enforcement داخل الخادم مع PostgREST ACL deny، وإبقاء RLS لعزل المستأجر كدفاع إضافي.

لا تمثل النقطتان فشلًا وظيفيًا أو ثغرة مفتوحة في G1، لكنهما discrepancy توثيقي مطلوب تسويته في تقرير G2.

## 2. البيئة

| العنصر | القيمة |
|---|---|
| التاريخ | 2026-08-29 |
| النظام الزمني | Asia/Muscat |
| المستودع | `/Users/ismailabdullah/Developer/verix` |
| Node.js | `v24.18.0` |
| npm | `11.16.0` |
| Turborepo | `2.10.4` |
| Supabase CLI | `2.113.0` |
| psql client | `17.10` |
| PostgreSQL المحلي | `17.6` |
| قاعدة التكامل | Supabase المحلي `127.0.0.1:54322/postgres` |
| قاعدة fresh | `127.0.0.1:54322/verix_test_g1`، disposable ثم حُذفت |

## 3. حالة Git

تحقق البدء أعاد:

- الفرع: `develop`.
- HEAD: `5db1822cd0ab59e038804acae38bf05d201852db`.
- `5db1822` هو HEAD نفسه، وبالتالي موجود قطعًا في التاريخ.
- `origin/develop...HEAD = 0 0`: لا ahead ولا behind.
- `HEAD -> develop, origin/develop, origin/HEAD` على commit نفسه.
- `git status --short` كان فارغًا قبل التحقق.

الأوامر:

```bash
git status --short --branch
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
git merge-base --is-ancestor 5db1822 HEAD
git rev-list --left-right --count origin/develop...HEAD
git log -5 --oneline --decorate
```

لم يحدث commit أو push أو switch أو restore أو clean.

## 4. أوامر التطبيق الكاملة ونتائجها

| الأمر | النتيجة |
|---|---:|
| `npm test` داخل `apps/web` | `655/655`، وعدد الملفات `46/46` |
| `npm run lint` من الجذر | `3/3` مهام، صفر warnings |
| `npm run check-types` من الجذر | `3/3` مهام |
| `npm run build` من الجذر | `2/2` (`web`, `docs`)؛ النتيجة كانت cached |
| `npx turbo run build --force` من الجذر | `2/2`، `Cached: 0`، بناء فعلي كامل |

البناء الإجباري جمع تطبيق docs، و16 صفحة static في web، وكل المسارات الديناميكية، ومنها `/workspace-selection` و`/api/public/forms/contact` ومسارات العرض العام `/site/[siteId]/...`.

## 5. قاعدة fresh المعتمدة

### 5.1 تجهيز الهدف disposable

استُخدمت credentials المحلية الافتراضية فقط. لضمان وجود Supabase Auth prerequisites مع قاعدة Verix فارغة:

1. أُنشئت `verix_test_g1` كنسخة محلية مؤقتة من قاعدة Supabase.
2. حُذفت داخل النسخة فقط مخططات Verix `public` و`drizzle` وما يتبعها.
3. أُعيد مخطط `public` وملكيته/USAGE إلى حالة Supabase prerequisite.
4. بقيت `auth.users` و`auth.uid()` والأدوار والامتدادات المحلية المطلوبة.
5. غُيّرت ملكية قاعدة الاختبار إلى دور `postgres` نفسه الذي يستخدمه migrator.

أثبت bootstrap قبل أول migration:

- جداول Verix: `0`.
- enums: `0`.
- foreign keys/indexes/policies/functions/application grants: `0`.
- سجل Drizzle: `0`.

بعد انتهاء G1 نُفذ:

```bash
drop database verix_test_g1 with (force)
```

ولم تُحذف أو تُعدّل قاعدة Supabase المحلية الأساسية.

### 5.2 حارس السلامة

```bash
npm run test:db:safety
```

النتيجة: `78/78` في `7/7` ملفات. تغطي رفض hosted URLs، ورفض fallback إلى `DATABASE_URL`، واشتراط `NODE_ENV=test` و`VERIX_TEST_DATABASE=1` وعلامة `verix_test`، وكشف project-link المستضاف.

### 5.3 fresh canonical bootstrap

```bash
NODE_ENV=test \
VERIX_TEST_DATABASE=1 \
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/verix_test_g1 \
DATABASE_URL=postgresql://placeholder:placeholder@127.0.0.1:1/placeholder \
npm run test:db:bootstrap
```

النتيجة:

- SQL migrations: `6`.
- journal tags: `6`.
- snapshots: `6`.
- ملفات SQL غير مسجلة في journal: `0`.
- migration exit code: `0`.
- جداول Verix: `30`.
- RLS enabled: `30/30`.
- policies: `30`.
- migration ledger: `6/6`.
- application-role grants: `0`.
- expected fingerprint يساوي observed fingerprint.
- catalog decision: `ADOPTABLE`.

المسار المبني فعليًا:

`0000 → 0001 → 0002_canonical_pre_sprint_1 → 0003_workspace_relationship_hardening → 0004_immutable_auth_identity → 0005_postgrest_acl_hardening`

### 5.4 إعادة التشغيل وledger/catalog

أعيد تشغيل migrator على `verix_test_g1` بالأمر نفسه مع `npm run db:migrate`. انتهى بنجاح من دون إعادة تطبيق migration. ثم نُفذ:

```bash
NODE_ENV=test \
VERIX_TEST_DATABASE=1 \
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/verix_test_g1 \
DATABASE_URL=postgresql://placeholder:placeholder@127.0.0.1:1/placeholder \
npm run test:db:acl:verify
```

النتيجة بعد rerun:

```json
{"migrationCount":6,"internalUserCount":0,"unresolvedIdentityCount":0,"grantCount":0,"fingerprint":"97ae43f970ac648de8f50e49898828ca6958ef4b4d949353ff524f1b38ee2294","adoptionDecision":"ADOPTABLE"}
```

## 6. سلسلة قاعدة البيانات المحلية

استخدمت الأوامر التالية البيئة المحروسة نفسها:

```bash
NODE_ENV=test
VERIX_TEST_DATABASE=1
VERIX_LOCAL_SUPABASE=verix
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DATABASE_URL=postgresql://placeholder:placeholder@127.0.0.1:1/placeholder
```

| الأمر | الدليل |
|---|---:|
| `npm run test:db:supabase-prerequisites` | `8/8 PRESENT` |
| `npm run test:db:rls:coverage` | `30/30` RLS، `30` membership-only policies، uncovered CRUD=`0` |
| `npm run test:db:relationships:preflight` | `40` علاقة؛ missing/cross-workspace/anomaly كلها `0` |
| `npm run test:db:relationships` | `4/4` |
| `npm run test:db:identity:preflight` | unresolved=`0`، conflict=`0`، safe=`true` |
| `npm run test:db:identity` | `11/11` في `2/2` ملفات |
| `npm run test:db:active-workspace` | `10/10` |
| `npm run test:db:rls` | `33/33` |
| `npm run test:db:postgrest` | `6/6` |
| `npm run test:db:acl:verify` | ledger `6`، grants `0`، fingerprint مطابق، `ADOPTABLE` |

### 6.1 مسار الترقية المدعوم

- اختبار B4 `upgrades a disposable pre-B4 state without loss or ambiguous linkage` طبق SQL الترقية على fixture قبل B4 ونجح.
- اختبار B3.2 يثبت preflight، و40 composite FK، ورفض البيانات غير المتسقة قبل DDL من دون إصلاح أو حذف.
- اختبارات canonical adoption ضمن مجموعة الوحدة تثبت حالة `0000/0001`، والـadoption المطابق، وidempotent no-op، ورفض metadata أو catalog أو prerequisites المزيفة.
- أعيد تشغيل migrator بعد fresh `0000→0005` ونجح no-op مع ledger وبصمة ثابتين.

لا توجد أداة واحدة تعيد بناء بيئة hosted افتراضية؛ G1 استخدم فقط المسارات المدعومة والمثبتة محليًا.

### 6.2 ملاحظة تشغيل شفافة

شُغلت مجموعات DB المستقلة أولًا بالتوازي. تنافس B4 وB5 على fixtures/locks في القاعدة المحلية نفسها، فأعاد PostgreSQL `deadlock detected` لاختبار واحد في كل مجموعة. لم يكن الفشل assertion أمنيًا. أعيدت المجموعتان فورًا وبشكل تسلسلي وفق تكوينهما authoritative (`fileParallelism: false`)، ونجحت B4 `11/11` وB5 `10/10`. لذلك تعتمد نتيجة G1 على التشغيل التسلسلي المعزول، ويجب ألا يشغل CI مجموعات التكامل ذات fixtures المشتركة بالتوازي على قاعدة واحدة.

## 7. بصمة وACL/RLS النهائية

البصمة الحالية:

`97ae43f970ac648de8f50e49898828ca6958ef4b4d949353ff524f1b38ee2294`

أعاد probe القراءة فقط على Supabase المحلي:

- `NO_DIRECT_TABLE_GRANTS` لكل من `anon` و`authenticated` في `public`.
- `PUBLIC=false`, `anon=false`, `authenticated=false` لتنفيذ:
  - `current_workspace_ids()`
  - `current_comember_ids()`
  - `current_conversation_ids()`
- RLS مفعّل على `30/30` جدولًا.
- policies في `public`: `30`.

## 8. نتائج الانحدار الأمني

| المطلب | النتيجة | الدليل |
|---|---|---|
| لا email-based authorization | PASS | محلل B4 يبدأ بـ`auth_user_id`; تغيير البريد يحفظ user/workspace؛ بريد legacy يستخدم فقط لربط verified unlinked identity مرة واحدة. B4 `11/11`. |
| `auth_user_id` غير قابل للتغيير | PASS | unique constraint + trigger؛ اختبارات profile-email update وdirect claim والتغيير/المسح. |
| لا silent first-membership عند التعدد | PASS | B5 multiple يعيد selection-required، ويقبل اختيارًا متحققًا فقط. |
| zero/one/multiple | PASS | B5: `NONE` للصفر، auto-select للعضوية الوحيدة فقط، explicit selection للتعدد. |
| tampered/invalid selection | PASS | B5 يرفض Workspace لمستخدم آخر والمعرف التالف. |
| revocation يبطل الوصول | PASS | B5 suspended/deleted membership وmembership removal وWorkspace deletion. |
| capability registry deny-by-default | PASS | unknown role وunknown capability مرفوضان؛ الأدوار المعتمدة الثلاثة exhaustively tested. |
| UI/navigation حسب القدرات | PASS | navigation tests تخفي المالي/Team عن employee وكل Website Builder عن أدوار Workspace. |
| direct route access | PASS | page authorization يحول المنع إلى controlled not-found boundary. |
| Server Actions | PASS | direct malicious invocation يرفض financial/team/platform-only قبل validation/service. |
| service boundary | PASS | direct service tests ترفض property mutation وinvoice read قبل DB access. |
| قيود employee المالية | PASS | registry/action/service/PostgREST tests. |
| أدوار Workspace لا تعبر Platform-only Website | PASS | owner/manager/employee ممنوعون في registry/navigation/action وPostgREST. |
| PostgREST `authenticated` tables | PASS | JWT صالح، لكن reads/writes/self-escalation مرفوضة بـACL. |
| PostgREST `anon` tables | PASS | anonymous direct `sites` query مرفوضة بـACL. |
| RPC helpers | PASS | الوظائف الثلاث مرفوضة عبر `/rest/v1/rpc/*`، وprobe EXECUTE=false. |
| PostgreSQL tenant isolation | PASS | B3 `33/33`، وعلاقات B3.2 `4/4`/40 علاقة، وRLS coverage `30/30`. |

الاختبارات المركزة لطبقات B6:

```bash
npx vitest run \
  src/server/auth/capabilities.test.ts \
  src/server/auth/navigation-capabilities.test.ts \
  src/server/auth/page-authorization.test.ts \
  src/server/actions/capability-enforcement.test.ts \
  src/server/services/capability-enforcement.test.ts
```

النتيجة: `17/17` في `5/5` ملفات.

## 9. قرار Phase F / F1

**F1: NOT REQUIRED — no real Sprint 1 consumer**

أُجري بحث في `apps` و`packages` وتدقيق diff من commit اعتماد الخطة `4bd6c03` إلى HEAD. النتيجة:

- لا `store_id` أو `storeId`.
- لا جدول `stores` أو Store schema.
- لا Active Store context أو cookie أو route أو action أو service.
- لا persistence أو fake Store UUID.
- لا مستهلك حالي يطلب extension contract برمجيًا.
- ظهور كلمة `store` في مواضع أخرى يعني cookie store أو request store أو state store أو وصف "stored"، وليس Store domain.

ADR-002 يوثق invariant المستقبلي `Active Store ⊂ Active Workspace` ويمنع placeholder implementation. هذا يكفي ما دام لا يوجد مستهلك حقيقي؛ إضافة interface الآن ستكون اختراعًا غير مستخدم ومخالفة لشرط F1.

## 10. حارس نطاق Sprint 2+

تدقيق commit range `4bd6c03..5db1822` أثبت:

| العنصر المحظور | النتيجة | الدليل |
|---|---|---|
| Store persistence/domain | غير موجود | الجداول الثلاثون بلا Store؛ لا IDs/routes/services. |
| Platform Admin UI | غير موجود | الحد موثق كمستقبلي؛ Website Builder الحالي سابق لـSprint 1، وأدوار Workspace حُجبت عنه. |
| Commerce implementation | غير موجود | لا إضافة مطابقة في diff؛ كلمة `Commerce` الحالية تصنيف template سابق وليست domain. |
| custom roles | غير موجود | registry محصور exhaustively في `owner/manager/employee`. |
| White Label | غير موجود | لا إضافة مطابقة في diff. |
| unrelated feature redesign | غير موجود | تغييرات UI ضمن Active Workspace/capability exposure؛ لا domain redesign جديد. |

## 11. E4/E5: النص الأصلي مقابل العمارة النهائية

الخطة الأصلية وصفت E4 بأنه **role-aware RLS rollout**. هذا لم يُنفذ حرفيًا، ولا يدعي G1 عكس ذلك. التقرير الحي لـRLS يبين `roleAware: false` لكل السياسات الثلاثين؛ وظيفتها هي عزل Workspace فقط.

بعد B6.1 ثبت أن role/membership-only RLS تسمح لمستخدم داخل Workspace بتجاوز قدرات التطبيق عبر JWT. اعتمد B6.2 ثم نفذ B6.3 العمارة التالية:

`Browser → Next.js capability boundary → Server Action/service → Drizzle/postgres.js → PostgreSQL`

مع:

- سحب كل table CRUD من `anon` و`authenticated`.
- سحب RPC EXECUTE للوظائف الثلاث.
- capability enforcement في UI/route/action/service.
- بقاء RLS وعلاقات Workspace دفاعًا إضافيًا لعزل Tenant.

هذه العمارة تحقق النية الأمنية لـE4/E5: لا يستطيع دور Workspace الوصول مباشرة إلى Data API أصلًا، ولذلك لا يستطيع تجاوز قيود employee المالية أو Platform-only Website. وهي لا تحقق الوصف الحرفي "capability-aware/role-aware RLS"؛ لذا يجب أن يسجل G2 أن E4 أُغلق بقرار معماري بديل معتمد، وأن يصحح أي checkbox أو عمود RLS يوحي بأن role-aware policies نُفذت.

## 12. قائمة إغلاق Sprint 1

| بند الإغلاق | الحالة | الدليل |
|---|---|---|
| ADRs ومصفوفة الصلاحيات معتمدة | PASS مع discrepancy توثيقي | commit `4bd6c03` هو `docs: approve Sprint 1 identity and isolation plan` ويضيف الوثائق الثمانية؛ metadata الداخلية ما زالت `Proposed` ويجب تسويتها في G2. |
| لا email-based authorization | PASS | B4 UUID-first + identity tests `11/11` + UUID-based RLS helper. |
| لا silent Active Workspace | PASS | B5 `10/10`؛ multiple يتطلب explicit choice. |
| revocation وmultiple memberships مختبرة | PASS | B5 حالات suspension/deletion/removal/restore/role-change/multiple. |
| capability checks عبر UI/route/action/service/database boundary | PASS بالعمارة المعتمدة | B6 `17/17`; PostgREST `6/6`; DB boundary يغلق direct CRUD/RPC كليًا، وRLS tenant-only defense-in-depth. ليس role-aware RLS حرفيًا. |
| fresh DB قابل للبناء من canonical migrations | PASS | baseline صفر → `0000..0005`، ledger `6/6`، fingerprint مطابق، rerun ناجح. |
| Tenant/Role isolation مثبت في PostgreSQL | PASS | B3 `33/33`، RLS `30/30`، B3.2 `40` علاقة/`4/4`، ACL grants=`0`. |
| Active Store contract-only/غير مطلوب بلا مستهلك | NOT REQUIRED | لا مستهلك ولا Store artifacts؛ ADR-002 يوثق invariant المستقبلي فقط. |
| لا Sprint 2+ work | PASS | commit-range/schema/routes/roles audit بلا Store/Platform Admin/Commerce/custom roles/White Label. |

## 13. المخاطر المتبقية

1. دور PostgreSQL الذي يستخدمه الخادم privileged/BYPASSRLS محليًا؛ لذلك تبقى capability checks وworkspace scoping داخل الخادم حواجز أساسية. يلزم probe موثق لكل بيئة مستقبلية وفصل runtime/migration roles عندما يعتمد تصميمه.
2. RLS الحالية ليست role-aware. إذا أُعيد منح Data API لأي دور مستقبلًا، لا يجوز الاعتماد على السياسات الحالية لتطبيق capabilities؛ يلزم تصميم جديد واختبارات قبل grant.
3. مهاجرة B6.3 تسحب grants من الجداول الحالية؛ يجب أن تمنع مراجعة كل migration جديدة default grants العرضية وأن تبقى fingerprint/PostgREST regressions بوابة إصدار.
4. ربط البريد القديم في B4 مسار claim انتقالي لمستخدم غير مرتبط ومؤكد فقط؛ ليس authorization عاديًا، لكنه يحتاج بقاء اختبارات ambiguity/conflict وعدم التحول إلى fallback.
5. lifecycle الدعوات وsecurity audit log الدائم ليسا مكتملين كمنظومة منصة؛ لا يفتح ذلك bypass مثبتًا في Sprint 1، ويجب ألا يتوسع ضمن G2.
6. تشغيل مجموعات DB ذات fixtures مشتركة بالتوازي على قاعدة واحدة قد يسبب deadlock؛ CI يجب أن يشغلها تسلسليًا أو يعزل قاعدة لكل suite.
7. تسميات `Proposed` وعبارات E4/RLS القديمة تحتاج closure reconciliation في G2 حتى تتطابق الوثائق مع القرار المنفذ.

## 14. نظافة diff والحالة النهائية

قبل إنشاء هذا التقرير:

```bash
git status --short
git diff --check
```

كان الأمران بلا مخرجات. بعد إنشاء التقرير، التغيير المتوقع والمفسر الوحيد هو:

`?? docs/sprints/sprint-01-identity-isolation/G1_FULL_REGRESSION_AR.md`

سيُعاد تشغيل الأمرين بعد كتابة التقرير لإثبات عدم وجود whitespace errors أو تغييرات إضافية. لم يحدث commit أو push.

## 15. قرار الانتقال

يجوز لـG2 البدء لإنتاج security checklist/closure report النهائي، مع معالجة discrepancy حالة ADR/matrix وتوثيق استبدال E4 الحرفي بقرار B6.2/B6.3. لا توجد حاجة لتنفيذ F1 أو أي عمل Sprint 2.

G1: PASS — READY FOR G2 CLOSURE
