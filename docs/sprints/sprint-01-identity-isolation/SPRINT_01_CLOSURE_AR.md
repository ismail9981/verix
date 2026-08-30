# تقرير إغلاق Sprint 1 — الهوية والعزل والصلاحيات

## 1. حالة الإغلاق

**الحالة:** مغلق بعد نجاح G1 ومراجعة G2 الأمنية والتوثيقية.

أغلق Sprint 1 فجوات الهوية القابلة للتغيير، والاختيار الصامت للمستأجر،
والعلاقات العابرة لمساحات العمل، وتفاوت الصلاحيات بين طبقات التطبيق، ومسار
تجاوز القدرات عبر PostgREST. أصبحت قاعدة Verix قابلة للبناء من تاريخ canonical
واحد، وأصبح حد المجال المعتمد خادميًا عبر Drizzle/postgres.js.

لم ينفذ Sprint 1 Store domain أو Platform Admin أو Commerce أو custom roles أو
White Label. لم يحدث اتصال بقاعدة مستضافة أثناء G1/G2، ولم ينفذ G2 أي SQL أو
migration أو تعديل إنتاجي.

## 2. هدف Sprint 1

الهدف هو تأسيس حد أمان متعدد المستأجرين قبل إضافة مجالات المنصة اللاحقة:

1. ربط هوية Supabase بمعرف UUID ثابت لا بالبريد.
2. اشتقاق Active Workspace صريح ومتحقق وقابل للإبطال.
3. تطبيق مصفوفة قدرات deny-by-default على كل حدود التطبيق.
4. إثبات عزل Workspace داخل PostgreSQL وتقوية العلاقات التابعة.
5. إصلاح تاريخ المهاجرات بحيث يعيد بناء الحالة الأمنية كاملة.
6. إغلاق أي Data API يسمح بتجاوز حد الخادم.

## 3. المراحل المنفذة

| المرحلة | الحالة | الناتج |
|---|---|---|
| A — القرارات والخطط | PASS | ADR-001، ADR-002، permission matrix، threat model، RLS/test/migration plans معتمدة. |
| B — بنية DB والـRLS | PASS | حارس قاعدة disposable، catalog/fingerprint، canonical adoption، RLS harness، relationship hardening. |
| C — Immutable Identity | PASS | `auth_user_id` unique/immutable وUUID-first resolver وpreflight/conflict handling. |
| D — Active Workspace | PASS | signed HttpOnly selection، تحقق عضوية عند كل استخدام، zero/one/multiple/revocation behavior. |
| E — Capability Enforcement | PASS بالعمارة المعتمدة | registry + UI/route/action/service gates + tenant RLS + PostgREST/RPC ACL denial. |
| F — Active Store | NOT REQUIRED | لا مستهلك حقيقي؛ invariant وثائقي فقط، بلا implementation. |
| G1 — Full Regression | PASS | التطبيق وقاعدة fresh والأمان والبناء كلها ناجحة. |
| G2 — Security Closure | PASS | statuses وE4/checklist/risks سُويت ووثقت نهائيًا. |

## 4. القرارات المعمارية الكبرى

### 4.1 الهوية

العلاقة المعتمدة:

`auth.users.id → public.users.auth_user_id → Verix internal user`

- `auth_user_id` فريد وغير قابل للتغيير بعد ضبطه.
- البريد profile/contact attribute وليس authorization key.
- تغيير البريد لا يغير المستخدم أو Workspace أو memberships.
- matching البريد لا يظهر إلا كـverified one-time legacy claim لمستخدم غير
  مرتبط، ويفشل عند ambiguity/conflict؛ ليس fallback للتفويض.
- لا automatic merge أو relink.

المرجع: `ADR_001_IDENTITY_LINKAGE_AR.md`،
`B4_IMMUTABLE_AUTH_IDENTITY_AR.md`، والهجرة
`0004_immutable_auth_identity`.

### 4.2 Active Workspace

- المصدر هو signed HttpOnly cookie كمرشح اختيار، لا authority مستقل.
- يعاد التحقق من active/non-deleted membership وWorkspace عند كل استخدام.
- صفر عضويات يعطي no-access.
- عضوية واحدة تسمح بالقاعدة الموثقة للـverified single membership.
- عدة عضويات تتطلب اختيارًا صريحًا؛ لا first-row fallback.
- cookie/ID متلاعب به، revocation، deletion، suspension، أو role change تظهر
  نتيجتها في التحقق التالي.
- Server Actions والخدمات تستمد النطاق من context الخادمي، لا من Workspace ID
  يثق به من client.

المرجع: `ADR_002_ACTIVE_WORKSPACE_STORE_AR.md` و
`B5_ACTIVE_WORKSPACE_CONTEXT_AR.md`.

### 4.3 القدرات

- registry مركزي deny-by-default للأدوار `owner`, `manager`, `employee`.
- unknown role وunknown capability مرفوضان.
- navigation/UI تخفي السطوح غير المصرح بها، لكنها ليست حد الأمان الوحيد.
- page authorization يمنع direct routes.
- Server Actions تتحقق قبل validation/service mutation.
- services الحساسة تتحقق أيضًا عند الاستدعاء المباشر.
- Employee ممنوع من القدرات المالية.
- كل أدوار Workspace، ومنها owner، ممنوعة من Website Builder/design/publish/domain
  المحجوزة للمنصة.

المرجع: `PERMISSION_MATRIX_AR.md` و`B6_CAPABILITY_ENFORCEMENT_AR.md`.

### 4.4 قاعدة البيانات وحد المجال

المسار المعتمد:

`Browser → Next.js capability boundary → Server Action/service → Drizzle/postgres.js → PostgreSQL`

وليس:

`Browser → Supabase PostgREST → Verix domain tables`

- RLS مفعّل على 30/30 جدولًا لعزل Tenant.
- 40 علاقة تابعة تستخدم same-workspace relational integrity؛ تمنع FK العابر.
- `anon` و`authenticated` لا يملكان direct table CRUD في `public`.
- `PUBLIC` و`anon` و`authenticated` لا يملكون EXECUTE لوظائف RLS المساعدة
  الثلاث.
- Supabase Auth باقٍ؛ سحب table/RPC ACL لا يسحب Auth.
- اتصال Drizzle/postgres.js الخادمي هو domain data boundary.

المرجع: B3/B3.2 وB6.2/B6.3 وتقارير الكتالوج.

## 5. تاريخ المهاجرات النهائي

المسار canonical النشط:

1. `0000_slim_thunderbolts`
2. `0001_payments_soft_delete`
3. `0002_canonical_pre_sprint_1`
4. `0003_workspace_relationship_hardening`
5. `0004_immutable_auth_identity`
6. `0005_postgrest_acl_hardening`

لكل migration SQL وjournal entry وsnapshot؛ لا يوجد SQL نشط خارج journal. تحفظ
الهجرات القديمة `0002–0016` تحت `drizzle/legacy/pre-canonical` كدليل تاريخي
ولا يعاد تشغيلها.

بصمة قاعدة البيانات النهائية:

`97ae43f970ac648de8f50e49898828ca6958ef4b4d949353ff524f1b38ee2294`

أثبت G1 قاعدة disposable فارغة: baseline صفر، ثم `6/6` migrations، ledger
`6/6`، grants `0`، fingerprint مطابق، وقرار `ADOPTABLE`. نجح rerun للمهاجر
كـno-op، ثم حُذفت قاعدة G1 disposable.

## 6. تسوية E4/E5

### 6.1 النص الأصلي

وصف plan الأصلي E4 بأنه `role-aware RLS rollout`، وافترض توزيع مصفوفة الدور
والقدرة داخل policies. لا يدعي تقرير الإغلاق أن هذا حدث؛ RLS الحالية
membership/tenant-aware وليست capability-aware أو role-aware.

### 6.2 سبب تغيير تفصيل التنفيذ

- B6 طبقت القدرات في التطبيق.
- B6.1 أثبت أن مستخدم Workspace يستطيع تجاوزها عبر JWT وPostgREST لأن RLS
  membership-only تسمح له داخل Workspace.
- B6.2 دققت الاعتماديات وأثبتت عدم وجود مستهلك إنتاجي مشروع لـtable CRUD أو
  RPC أو Storage أو Realtime أو GraphQL.
- B6.2 اعتمدت server boundary + ACL hardening بدل إعادة كتابة 30 policy في
  مهمة واحدة عالية المخاطر.
- B6.3 سحبت direct table privileges وسحبت helper RPC EXECUTE وأثبتت المنع.

### 6.3 حكم الإغلاق

العمارة النهائية **تحقق النية الأمنية لـE4/E5**:

- لا يستطيع Workspace JWT الوصول إلى جداول المجال مباشرة، لذلك لا يمكنه
  تجاوز Employee financial أو Platform-only Website rules.
- المسار الخادمي يطبق capabilities قبل DB.
- RLS والعلاقات تبقيان tenant-isolation defense-in-depth.

لكنها **لا تحقق وصف role-aware RLS الحرفي**. هذا التفصيل superseded بقرار
B6.2/B6.3 المعتمد، ووُسِم كذلك في الخطة وRLS plan وpermission matrix بدل إعادة
كتابة التاريخ.

## 7. Phase F / F1

`F1: NOT REQUIRED — no real Sprint 1 consumer`

تدقيق G1 أثبت:

- لا `store_id` أو `storeId`.
- لا Store table/schema.
- لا Active Store cookie/context.
- لا Store routes/actions/services/domain behavior.
- لا fake Store UUID.
- لا persistence مبكر.

يظل invariant المستقبلي `Active Store ⊂ Active Workspace` موثقًا في ADR-002
والمواصفة. لا يُنشأ contract برمجي غير مستخدم لمجرد إغلاق checklist.

## 8. أدلة G1 الكاملة

| التحقق | النتيجة |
|---|---:|
| Unit/application | `655/655`، الملفات `46/46` |
| Database safety | `78/78`، الملفات `7/7` |
| B3 RLS | `33/33` |
| B3.2 relationships | `4/4`؛ preflight لـ40 علاقة بلا anomaly |
| B4 identity | `11/11` |
| B5 Active Workspace | `10/10` |
| B6 capability enforcement | `17/17`، الملفات `5/5` |
| B6.3 PostgREST/RPC denial | `6/6` |
| fresh canonical migrations | `6/6` + rerun no-op |
| Supabase prerequisites | `8/8 PRESENT` |
| catalog/fingerprint | `ADOPTABLE`، grants `0`، fingerprint مطابق |
| type checking | `3/3` tasks |
| lint | `3/3` tasks، صفر warnings |
| forced production build | `2/2` (`web`, `docs`)، cache bypass |
| diff hygiene | PASS |

المرجع التفصيلي: `G1_FULL_REGRESSION_AR.md`.

## 9. قائمة الإغلاق الأمنية النهائية

| المعيار | الحالة | الدليل |
|---|---|---|
| ADRs وpermission matrix معتمدة | PASS | commit `4bd6c03` + statuses المسواة في G2 + تنفيذ B4–B6. |
| لا email-based authorization | PASS | UUID-first resolver، immutable constraint/trigger، B4 `11/11`. |
| لا silent Active Workspace | PASS | multiple يحتاج explicit choice؛ B5 `10/10`. |
| revocation وmultiple memberships مختبرة | PASS | suspend/delete/remove/restore/role-change/zero/one/multiple. |
| capabilities في UI/route/action/service/database boundary | PASS | B6 `17/17`; ACL/PostgREST/RPC `6/6`; database deny مع tenant RLS. |
| fresh DB من canonical migrations | PASS | disposable baseline صفر → `0000→0005`، ledger/fingerprint مطابقان. |
| Tenant/Role isolation في PostgreSQL | PASS | RLS `33/33` و30/30؛ 40 relationships؛ zero direct grants. |
| Active Store contract/F1 | NOT REQUIRED | لا مستهلك حقيقي ولا artifact؛ invariant وثائقي فقط. |
| لا Sprint 2+ work | PASS | لا Store/Platform Admin/Commerce/custom roles/White Label implementation. |

## 10. الفصل عن Platform

- Workspace owner ليس Platform Admin.
- لا دور Platform Admin في registry الحالي.
- Website Builder/design/template/publish/domain capabilities مصنفة
  `PLATFORM_ONLY` ومرفوضة لكل أدوار Workspace.
- لا تظهر الروابط في navigation، وتمنع routes/actions/services والـData API.
- Platform Admin authentication/authorization/UI/audit model مؤجل إلى Sprint 2
  ويجب أن يكون مستقلًا عن membership role.

## 11. المخاطر المتبقية الحقيقية

هذه البنود ليست blockers لإغلاق Sprint 1 ولا تفويضًا لتنفيذها الآن:

1. **Store مستقبلًا:** يحتاج Active Store context وعزل Workspace+Store وpolicies
   وعلاقات واختبارات منفصلة قبل أي persistence.
2. **Platform Admin مستقبلًا:** يحتاج هوية وحد صلاحيات ومسارات وتدقيقًا مستقلًا؛
   لا يعاد استخدام Workspace owner.
3. **Data APIs مستقبلًا:** أي PostgREST/GraphQL/Realtime/Storage أو client-side DB
   access يحتاج dependency/security review وgrants/RLS/tests صريحة قبل الفتح.
4. **Custom roles مستقبلًا:** تحتاج توسيع/إعادة تصميم mapping والاختبارات؛ registry
   الحالي مغلق على الأدوار الثلاثة المعتمدة.
5. **Commerce/White Label:** خارج Sprint 1 ولم ينفذ؛ يحتاج سبرنتاته وقراراته.
6. **Privileged server DB role:** حد الخادم مسؤول عن capabilities وworkspace
   scoping؛ يلزم توثيق وفصل runtime/migration roles في rollout بيئي مستقبلي.
7. **Future tables:** يجب أن تبقى deny-by-default وألا ترث grants تعرضها لـData
   API؛ fingerprint وPostgREST regressions بوابة مستمرة.
8. **Invitation lifecycle:** لا يوجد token lifecycle كامل؛ placeholder email لا
   يمنح جلسة أو authorization، والتوسعة تحتاج مهمة معتمدة مستقلة.

## 12. العناصر المؤجلة صراحة إلى Sprint 2+

- Platform Super Admin وSupport Admin boundaries/UI.
- Store persistence وActive Store implementation.
- Products/Categories/Inventory/Orders/Commerce.
- custom roles والـrole editor.
- White Label capabilities.
- Platform audit/operations UI.
- أي API عام أو client Data API جديد.

لا يبدأ أي بند تلقائيًا بسبب هذا الإغلاق؛ يبقى ترتيب المواصفة ملزمًا.

## 13. تسوية حالة الوثائق

| الوثيقة | الحالة بعد G2 |
|---|---|
| ADR-001 | Accepted؛ core identity منفذ، invitation lifecycle مؤجل بوضوح. |
| ADR-002 | Accepted؛ Active Workspace منفذ، F1 NOT REQUIRED. |
| Permission Matrix | Accepted؛ app capabilities منفذة وRLS/ACL interpretation صريح. |
| RLS Migration Plan | Accepted historical baseline؛ canonical/tenant RLS منفذان، role-aware detail superseded. |
| Threat Model | Accepted ومحدث للضوابط النهائية ذات الصلة. |
| Implementation Plan | Closed؛ E4 وF1 وchecklist مسواة. |
| CLAUDE.md | Tenancy/auth guidance محدثة إلى UUID + Active Workspace + B6 boundary. |

لم تُعدل تقارير B1–B6 التاريخية لمجرد إزالة كلمات مثل Proposed/Pending من
سياقها الزمني. وجودها هناك يصف قرارًا أو حالة وقت التقرير ولا يناقض هذا
الإغلاق.

## 14. Git والحالة التشغيلية

- الفرع: `develop`.
- HEAD عند بدء G2: `5db1822cd0ab59e038804acae38bf05d201852db`.
- العلاقة مع `origin/develop`: `0 ahead / 0 behind` قبل تغييرات تقارير G1/G2.
- بدأ G2 مع تغيير واحد فقط: `G1_FULL_REGRESSION_AR.md`.
- G2 يغير وثائق فقط؛ لا production code أو migration أو database.
- لم يحدث commit أو push.
- سيبقى working tree محتويًا تقرير G1 وتغييرات G2 بانتظار مراجعة المالك.

## 15. القرار النهائي

تحققت كل معايير Sprint 1 المطلوبة أو صُنفت NOT REQUIRED وفق شرطها المعتمد.
أُغلقت فجوة B6.1 فعليًا، وسُويت E4 من دون ادعاء role-aware RLS، ولم يتسرب
عمل Sprint 2 إلى الإغلاق.

SPRINT 1: CLOSED — PASS
