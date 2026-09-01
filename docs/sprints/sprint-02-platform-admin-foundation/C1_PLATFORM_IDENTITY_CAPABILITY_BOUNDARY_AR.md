# C1 — حد هوية وصلاحيات Platform Admin

## 1. النتيجة التنفيذية

نُفذ حد Platform Admin خادمي مستقل عن Workspace RBAC. يحل الـresolver الهوية
فقط من Supabase Auth UUID الثابت،ثم يقرأ `platform_admins` عبر Drizzle الموثوق،
ويعيد حالة صريحة. لا يدخل email أوAuth metadata أوWorkspace membership أوActive
Workspace في القرار.

حصل `super_admin` النشط على قدرات Sprint 2 الست فقط،بينما بقي
`support_admin` بلا أي قدرة. أضيف runtime context opaque لا يمكن لكائن actor أو
role أوcapability مصطنع أن يجتاز فحصه. كما أضيف شرط حالة Workspace إلى Active
Workspace application boundary حتى لا يستطيع اتصال Drizzle الموثوق تجاوز معنى
التعليق الذي تفرضه RLS على أدوار Data API.

لم تُنشأ صفحات `/admin` أوactions أوservices أوbootstrap CLI،ولم تتغير migration
أوschema أوcatalog أوfingerprint.

## 2. تدقيق ما قبل التنفيذ

ثبت قبل التنفيذ:

- الفرع `develop`.
- HEAD و`origin/develop` متطابقان عند
  `ee3ac8db2c6e72ecc754a8f67760d62deeb4b87e`،ahead/behind=`0/0`.
- working tree تحتوي وثائق Sprint 2 وتنفيذ B2 المحتفظ بهما فقط؛لم يُحذف أو
  يُستعد أي جزء منهما.
- migration ledger المحلي `7/7`،وB2 verifier يعيد `ADOPTABLE`.
- بصمة B2 هي
  `9df35d82ec24c7c8e630108e0366a9c673ba42ca2d8c07e1a191e1bdfeef16cb`.
- لا يوجد Platform authorization implementation سابق يتعارض مع C1؛registry
  والـhelpers الموجودة كانت Workspace-only،وكانت تمنح أي role منصة صفراً.

## 3. Platform identity resolver

المسار `src/server/auth/platform-identity.ts` server-only،ويقبل فقط
`Pick<User,"id"> | null`. يستدعي request-scoped wrapper هوية الجلسة الموثوقة
القائم `getCurrentUser()`،ثم يبحث بالمساواة على
`platform_admins.auth_user_id`. لا توجد وسيطة Platform Admin ID أوrole،ولا lookup
بالبريد،ولا استدعاء لجداول `users` أو`team_members`.

الحالات الأربع:

| الحالة                     | المعنى                                                      |
| -------------------------- | ----------------------------------------------------------- |
| `UNAUTHENTICATED`          | لا توجد Supabase Auth identity موثوقة                       |
| `NOT_PLATFORM_ADMIN`       | UUID غير صالح،أو لا يوجد row،أو returned invariant غير صالح |
| `ACTIVE_PLATFORM_ADMIN`    | row مستقل بدور معروف وحالة active                           |
| `SUSPENDED_PLATFORM_ADMIN` | row مستقل معروف لكنه suspended                              |

البيانات المعادة محدودة إلى Platform Admin DB ID،وimmutable Auth UUID،والدور،
والحالة. يعاد الكائن frozen،ولا يعاد email أوmetadata أوWorkspace context.
فحص UUID وفحص role/status runtime يجعلان schema/adapter drift يفشل مغلقاً.

## 4. registry المنصة ومصفوفة الصلاحيات

الـregistry في `src/server/auth/platform-capabilities.ts` مستقل تماماً عن
`src/server/auth/capabilities.ts` الخاص بالـWorkspace. vocabulary المغلق هو:

```text
platform.workspaces.read
platform.workspaces.create
platform.workspaces.assign_owner
platform.workspaces.suspend
platform.workspaces.activate
platform.audit.read
```

المصفوفة المعتمدة:

| الدور/الحالة                     | القدرات الفعالة           |
| -------------------------------- | ------------------------- |
| active `super_admin`             | القدرات الست أعلاه بالضبط |
| active `support_admin`           | `[]`                      |
| suspended admin بأي دور          | `[]`                      |
| `owner` / `manager` / `employee` | `[]`                      |
| role/status/capability غير معروف | رفض/`[]`                  |

لا توجد Store capability،ولا inheritance،ولا wildcard،ولا fallback لدور tenant.
اختبار exhaustiveness يثبت تطابق مفاتيح المصفوفة مع دوري المنصة،وعدم التكرار،
وعدم تقاطع vocabulary المنصة مع Workspace registry.

## 5. authorization helpers

يوفر `src/server/auth/platform-authorize.ts` ثلاث بوابات server-only:

1. `requirePlatformAdminIdentity()` للتعرف على row منصة مستقل،بما فيه suspended؛
   هذه ليست بوابة تنفيذ capability.
2. `requireActivePlatformAdmin()` لرفض unauthenticated وtenant-only وsuspended.
3. `requirePlatformCapability(capability)` لطلب active identity وقدرة مسجلة.

تستخدم الأخطاء النوعية الرموز:

`UNAUTHENTICATED | NOT_PLATFORM_ADMIN | PLATFORM_ADMIN_SUSPENDED |
PLATFORM_CAPABILITY_DENIED`.

لا redirect داخل الطبقة المنخفضة. السياق النشط يحمل symbol brand غير مصدّر،
ويجب أن يكون مسجلاً أيضاً في module-local `WeakSet`. لذلك لا تكفي بنية object
مطابقة أوcast TypeScript أوrole claim لتجاوز runtime boundary. توفر
`assertPlatformCapability()` دفاع service-layer إضافياً للسياق المشتق من البوابة.

## 6. منع confused deputy وفصل Workspace/Platform

الضوابط المثبتة:

- resolver/helper لا يقبلان `platform_admin_id` أوrole من caller.
- وسيطة `requirePlatformCapability` الوحيدة هي capability من vocabulary مغلق؛
  لا تصبح claim موثوقة،بل يعاد اشتقاق actor/capabilities من DB في الطلب.
- unknown capability تفشل حتى لـactive Super Admin.
- email وAuth metadata،بما فيها `platform_role` مصطنع،لا تستخدم في lookup أوoutput.
- Workspace role وmembership وActive Workspace غير مستوردة في Platform boundary.
- actor `owner`/`manager`/`employee` بلا row منصة يعامل
  `NOT_PLATFORM_ADMIN`.
- actor مزدوج يحصل على Platform permission بسبب row `platform_admins` فقط؛وعند
  غياب row يبقى مرفوضاً حتى لو حمل Workspace Owner وclaimed Super Admin.
- forged ID/role/status/capability object يفشل runtime brand وWeakSet.

وبالعكس لم تضاف capabilities منصة إلى Workspace registry؛استمرت اختبارات
Workspace RBAC القائمة بلا تعديل للمصفوفة.

## 7. حد تعليق Active Workspace

اتصال Drizzle الخادمي privileged لا يعتمد RLS؛لذلك أصبح Active Workspace
resolver يقرأ `workspaces.status` ويقسم العلاقات المحتفظ بها إلى eligible وغير
eligible:

- لا تدخل إلا Workspace `active` وغير المحذوفة في options أوauto-selection أو
  explicit selection.
- signed selection المحتفظة بعضويتها لكن Workspace الخاصة بها suspended تعيد
  `INVALID_SELECTION` حتى عند وجود Workspace نشطة أخرى؛لا silent fallback.
- مستخدم لا يملك إلا memberships في Workspaces معلقة يصل `NONE`.
- mixed active+suspended يحسب active فقط في zero/one/multiple semantics.
- owner-membership materialization لا ينشئ/يعيد سياقاً من Workspace معلقة.
- membership row وSupabase session لا يتغيران.
- إعادة `status='active'` تعيد eligibility في resolution لاحق.
- compatibility service boundary `resolveAuthorizedWorkspaceInTransaction()`
  يفشل بـ`ACTIVE_WORKSPACE_NONE` ولا يسرب suspended context.

لم يتغير public website rendering أوpublic forms،ولم تنشأ suspension action.

## 8. الاختبارات والدليل

### 8.1 الاختبارات المركزة

| البوابة                                    |                النتيجة |
| ------------------------------------------ | ---------------------: |
| Platform identity/capability/authorization | `25/25` في `3/3` ملفات |
| Platform + Workspace authorization المركزة | `36/36` في `6/6` ملفات |
| Active Workspace integration               |   `14/14` في `1/1` ملف |

تغطي actor matrix:unauthenticated،authenticated بلا membership،Workspace
Owner/Manager/Employee،active/suspended Support،active/suspended Super،والactor
المزدوج. وتغطي malicious UUID/metadata/role/capability/context paths،unknown
vocabulary،schema drift،وحالات suspension والمزج والreactivation.

### 8.2 application quality gates

| البوابة                         |                                               النتيجة |
| ------------------------------- | ----------------------------------------------------: |
| full web unit/application suite |                            `682/682` في `49/49` ملفاً |
| repository typecheck            | PASS؛`3/3` tasks،ومنها `next typegen` و`tsc --noEmit` |
| repository lint                 |                        PASS؛`3/3` tasks،zero warnings |
| production build                |                            PASS؛docs وweb `2/2` tasks |
| `git diff --check`              |                                                  PASS |

واجه البناء أولاً منع sandbox لربط internal Turbopack local port،ثم نجح الأمر
نفسه خارج ذلك القيد. هذا فشل بيئة تشغيل لا فشل source أوbuild،ولم يتصل بخدمة
مستضافة.

### 8.3 database security regression

كل الأوامر استخدمت repository-local Supabase فقط على `127.0.0.1` مع حراس
Sprint 1:

| البوابة                |                           النتيجة |
| ---------------------- | --------------------------------: |
| Platform foundation DB |                           `11/11` |
| Workspace/tenant RLS   |                           `34/34` |
| PostgREST ACL          |                           `10/10` |
| canonical verifier     | ledger=`7`،grants=`0`،`ADOPTABLE` |

أعاد verifier counts نفسها:tables=`32`،enums=`43`،indexes=`102`،
constraints=`200`،functions=`12`،triggers=`9`،RLS=`32`،policies=`30`،والبصمة
المعتمدة نفسها:

`9df35d82ec24c7c8e630108e0366a9c673ba42ca2d8c07e1a191e1bdfeef16cb`

وبذلك بقيت Platform tables ممنوعة عبر PostgREST،وبقي Workspace suspension في
RLS،ولم تتغير migration/schema/catalog.

## 9. الملفات الخاصة بـC1

- `apps/web/src/server/auth/platform-identity.ts` واختباره.
- `apps/web/src/server/auth/platform-capabilities.ts` واختباره.
- `apps/web/src/server/auth/platform-authorize.ts` واختباره.
- `apps/web/src/server/auth/active-workspace.ts`.
- `apps/web/src/test/database/active-workspace/active-workspace.integration.test.ts`.
- هذا التقرير.

لم يحتج `SPRINT_02_IMPLEMENTATION_PLAN_AR.md` إلى تصحيح sequencing،ولم يكتشف
تناقض يستدعي تعديل ADR-003.

## 10. المخاطر المتبقية وحد المهمة

- لا يوجد consumer UI/action/service للمنصة في C1؛كل consumer لاحق يجب أن يبدأ
  بـ`requirePlatformCapability` ويعيد التحقق في service boundary.
- `requirePlatformAdminIdentity()` يميز suspended لأغراض التعرف فقط؛يحظر استخدامه
  وحده كauthorization gate،والتنفيذ الفعلي يجب أن يستخدم active/capability helper.
- request-scoped cache يعني أن suspension أوrole change يظهر في الطلب التالي؛
  لا توجد صلاحية مخزنة في cookie أوclient state.
- أي service خادمية مستقبلية تتجاوز Active Workspace helper قد تتجاوز تعليق
  التطبيق بسبب اتصال DB الموثوق؛المسار الطبيعي صار آمناً،وتبقى مراجعة كل service
  جديدة إلزامية.
- إدارة lifecycle،Platform Audit writer/UI،bootstrap،والـ`/admin` routes مهام
  Sprint 2 لاحقة وليست نواقص ضمن C1.

## 11. القرار

حد هوية وصلاحيات المنصة منفصل،مغلق افتراضياً،ومثبت ضد Workspace escalation
والـconfused-deputy paths. كما أصبح مسار Active Workspace الموثوق يحترم تعليق
Workspace مع بقاء session وmembership،وظلت ضمانات B2 وSprint 1 سليمة.

**C1: PASS — PLATFORM AUTHORIZATION BOUNDARY VERIFIED**
