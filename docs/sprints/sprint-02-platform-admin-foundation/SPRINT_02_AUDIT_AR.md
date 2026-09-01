# تدقيق الحالة الحالية — Sprint 2 Platform Admin Foundation

## 1. بيانات التدقيق

| البند | القيمة |
|---|---|
| المصدر الملزم | `docs/architecture/VERIX_PLATFORM_SPEC_v1.0_AR.md` |
| الفرع عند التدقيق | `develop` |
| HEAD عند التدقيق | `ee3ac8db2c6e72ecc754a8f67760d62deeb4b87e` |
| التزامن مع `origin/develop` | متطابق عند بدء التدقيق |
| حالة الشجرة قبل إنشاء وثائق Sprint 2 | نظيفة |
| نوع العمل | تدقيق وتصميم وخطة فقط |

لم يُشغّل أثناء هذا العمل أي migration أو قاعدة بيانات محلية/مستضافة، ولم
تُفحص قاعدة مستضافة. النتائج أدناه مستخرجة من الكود، تاريخ migrations، واختبارات
Sprint 1 الملتزمة في المستودع.

## 2. الخلاصة التنفيذية

لا يوجد في Verix حاليًا مفهوم Platform Admin في schema أو routes أو registry.
الحد الموجود هو حد Workspace فقط: جلسة Supabase موثقة بـ`auth.getUser()`، رابط
`auth_user_id` ثابت، Active Workspace، أدوار `owner|manager|employee`، وقدرات
Workspace. لذلك لا يمكن ترقية `owner` أو إعادة استخدام `team_members` لبناء
Platform Admin من دون كسر مواصفة المنصة.

القاعدة الجيدة القابلة لإعادة الاستخدام هي المصادقة الحالية، Drizzle عبر اتصال
Postgres خادمي، نمط Server Action → service، Zod، request IDs، والاختبارات المحلية.
أما النواقص الجوهرية فهي: سجل هوية منصة، registry لقدرات المنصة، route boundary
مستقل، حالة Workspace، عمليات lifecycle ذرية، وسجل Platform Audit منفصل.

أخطر تعارض حالي هو أن `resolveActiveWorkspaceInTransaction()` ينشئ Workspace
وعضوية owner تلقائيًا لهوية جديدة. هذا المسار غير Platform-authorized وغير
مدقق، ويمكنه الالتفاف على دورة Sprint 2. يجب أن تنهي مهمة تنفيذية مستقلة هذا
السلوك قبل اعتبار Platform Workspace creation هو المسار authoritative.

## 3. الهوية والمصادقة الحاليتان

### 3.1 Supabase session boundary

- `src/server/auth/client.ts` ينشئ SSR client بالـanon key وبـHttpOnly session
  cookies؛ لا يرسل service-role key إلى العميل.
- `src/server/auth/session.ts` يستخدم `supabase.auth.getUser()`، لا يثق
  بـ`getSession()` وحده، ويخزن النتيجة داخل React request cache.
- `src/server/auth/middleware.ts` و`proxy.ts` يجددان الجلسة ويحميان prefixes
  معروفة من المستخدم غير المسجل. هذا authentication gate فقط، وليس
  authorization gate.
- `/register` والتسجيل الذاتي ما زالا متاحين، وبعد تأكيد الحساب يتجه المستخدم
  إلى `/dashboard`.

### 3.2 Internal identity

جدول `users` يحتوي:

- `id`: UUID داخلي.
- `auth_user_id`: UUID فريد nullable للحسابات القديمة/الدعوات غير المطالب بها.
- `email`: unique لكنه profile/contact attribute، وليس مفتاح authorization.
- بيانات profile وsoft delete.

`src/server/auth/identity.ts` يربط Supabase UUID أولًا. matching البريد محصور في
legacy claim موثق ومتحقق؛ التعارضات تفشل مغلقة. هذا resolver مناسب لهوية
Workspace، لكنه لا يمثل Platform Admin ولا ينبغي أن يصبح مصدر صلاحية منصة.

### 3.3 ملاحظة تخص Platform Admin

إعادة استخدام `users` وحده أو إضافة `is_admin` إليه ستخلط هوية الشخص العامة مع
تفويض المنصة. كذلك استخدام Supabase `user_metadata` أو البريد غير مقبول لأنهما
ليسا مخزنًا خادميًا authoritative للصلاحيات. لا يوجد حاليًا أي `admin`,
`platform_admin`, `super_admin`, أو `support_admin` في production schema أو auth
code.

## 4. Workspace وعضوية المالك

### 4.1 schema الحالي

`workspaces` يحتوي `owner_id`, `name`, `slug`, profile fields, `plan`, timestamps،
و`deleted_at`. لا يوجد `status` عام للـWorkspace. كلمة `suspended` الحالية تخص
`team_members.status` فقط.

`team_members` يحتوي:

- `(workspace_id, user_id)` unique، حتى مع soft delete.
- `role`: `owner|manager|employee`.
- `status`: `active|invited|suspended`.
- unique مركب `(workspace_id, id)` لدعم العلاقات التابعة المقواة.

`workspaces.owner_id` وعضوية `team_members.role='owner'` مصدران يجب إبقاؤهما
متوافقين. توجد آلية في Active Workspace تضيف عضوية owner مفقودة تلقائيًا لكل
`workspaces.owner_id`، ما يؤكد أن `owner_id` ما يزال invariant فعليًا وليس حقلًا
قديمًا يمكن تجاهله.

### 4.2 الإنشاء الحالي

لا توجد Platform Workspace creation action. عند أول دخول لهوية جديدة، ينشئ
`resolveActiveWorkspaceInTransaction()` داخل transaction:

1. سجل `users` مرتبطًا بـSupabase UUID.
2. Workspace باسم/slug مشتقين من profile والبريد.
3. عضوية owner active.
4. وبعد commit يحاول إنشاء CRM pipeline افتراضيًا، لكن فشله لا يلغي Workspace.

المشكلات بالنسبة لـSprint 2:

- الإنشاء لا يتطلب Platform capability.
- لا يسجل Platform Audit.
- يتيح إنشاء Workspace خارج لوحة الإدارة.
- يربط lifecycle بزيارة `/dashboard` بدل command إداري صريح.
- post-commit pipeline side effect يمكن أن يترك provisioning جزئيًا.
- الاختبار/الكود يضع `plan: "free"` في DTO مع أن enum الحالي
  `starter|pro|business`؛ هذا دين type/domain يجب تنظيفه ضمن المسار المتأثر فقط.

### 4.3 دعوة/تعيين أعضاء حاليًا

`team.service.ts` يستطيع إنشاء `users` placeholder بالبريد وعضوية active، مع
`auth_user_id=NULL`. دورة invitation token الكاملة مؤجلة من Sprint 1. لذلك لا
ينبغي استعمال invite-by-email الحالي لتعيين المالك الأول في Sprint 2. المالك
الأولي المقترح يجب أن يكون `users.id` لخانة موجودة، غير محذوفة، ومرتبطة
بـ`auth_user_id` ثابت؛ يعيد الخادم التحقق بعد استلام candidate ID.

## 5. التفويض الحالي

### 5.1 Workspace capabilities

`src/server/auth/capabilities.ts` هو registry مغلق لأدوار Workspace. unknown role
وunknown capability يفشلان مغلقين. Website capabilities موجودة في vocabulary،
لكن كل أدوار Workspace محرومة منها عمدًا.

`requireActiveWorkspaceCapability()` يشتق Active Workspace من الجلسة ثم يتحقق
من capability. الصفحات تستخدم `requirePageCapability()` وتعيد not-found عند
المنع. Server Actions تستدعي helper قبل validation/mutation. الخدمات الحساسة
تستعمل guards إضافية، بينما خدمات القراءة/الكتابة العامة تعتمد غالبًا على أن
`workspaceId` أتى من boundary موثوق.

هذا الحد صالح كنمط، لكنه لا يصلح لإضافة Platform capabilities في registry نفسه؛
Platform authorization لا يملك Active Workspace أصلًا.

### 5.2 Active Workspace

Active Workspace محفوظ كـsigned HttpOnly cookie غير authoritative. كل طلب يعيد
فحص identity وactive membership وsoft-deleted state. لكنه لا يستطيع فحص
Workspace suspension لعدم وجود الحقل. `current_workspace_ids()` في PostgreSQL
يفحص user linkage وmembership active فقط، ولا يفحص حالة Workspace.

## 6. routes والواجهات الحالية

### 6.1 هيكل التطبيق

كل التنفيذ في `apps/web` حاليًا:

- `(auth)`: login/register/reset.
- `(dashboard)`: لوحة Workspace وصفحات العمليات.
- `(public)`: عرض المواقع العامة.
- `api/public/forms/contact`: public lead submission.
- routes مساعدة للمصادقة، robots/sitemap، design system، وplayground.

لا يوجد `/admin` أو route group خاص بالمنصة. `PROTECTED_PREFIXES` لا يتضمن
`/admin` حاليًا.

### 6.2 Website Builder كسطح admin-like

المسار الحالي `/website-builder` داخل `(dashboard)`، ويستدعي
`requirePageCapability("website.design.manage")`. registry لا يمنح هذه القدرة لأي
Workspace role، لذلك owner/manager/employee لا يستطيعون الوصول حاليًا. الاختبار
`navigation-capabilities.test.ts` يثبت إخفاءه للجميع.

هذا سطح محجوب وليس Platform Admin implementation: ما زال يعتمد Active Workspace
ولا يوجد Platform actor. نقله/تفعيله للإدارة يقع ضمن **Platform Website
Management** المؤجل، وليس ضمن Sprint 2.

### 6.3 navigation

`DashboardShell` و`NAV_ITEMS` مبنيان على role/capabilities الخاصة بالـWorkspace.
إضافة روابط Platform Admin إليهما ستسرّب حالة المنصة وتخلط الحدود. يلزم shell
وnav منفصلان، مع إعادة استخدام primitives البصرية فقط.

## 7. البيانات والخدمات

- كل domain services تستخدم Drizzle/postgres.js خادميًا عبر `DATABASE_URL`.
- Supabase client في production يستخدم أساسًا Auth؛ B6.3 سحب CRUD المباشر على
  جداول `public` من `anon` و`authenticated` وسحب EXECUTE عن helpers الداخلية.
- migration `0005_postgrest_acl_hardening.sql` هو one-time revoke للجداول الموجودة؛
  كل جدول جديد في Sprint 2 يحتاج REVOKE صريحًا واختبار catalog/PostgREST حتى لا
  يعتمد الأمان على default privileges البيئية.
- تطبيق الخادم يستخدم اتصالًا مميزًا واحدًا حاليًا. لا يوجد runtime DB role
  محدود منفصل عن migration owner؛ يبقى هذا خطرًا تشغيليًا موثقًا من Sprint 1،
  ولا يجوز علاجه عرضيًا داخل Sprint 2.

## 8. التدقيق والنشاط الحاليان

### 8.1 الموجود

- `crm_activities`: timeline خاص بـCRM opportunity، يحمل `workspace_id`، ويظهر
  للمستأجر وفق صلاحيات CRM. يقبل update/complete/soft-delete.
- structured logger و`x-request-id`: مفيدان للربط التشغيلي، لكنهما ليسا سجلًا
  دائمًا append-only.
- جداول invoices/payments تحمل حقول attribution خاصة بالمجال، وليست سجل منصة
  عامًا.

### 8.2 القرار الناتج من التدقيق

لا يمكن استخدام `crm_activities` لـPlatform Audit: نطاقه tenant، بنيته مرتبطة
بـopportunity، قابل للتعديل/الحذف، وظهوره للمستأجر سيسرّب عمليات حساسة. يلزم
`platform_audit_events` مستقل، server-only، append-only، بلا Workspace RLS policy
وبلا وصول Data API لـ`anon` أو`authenticated`.

## 9. ما يمكن إعادة استخدامه

- Supabase Auth session و`getUser()`.
- رابط UUID الثابت ومبادئ ADR-001، لا email authorization.
- نمط registry مغلق وdeny-by-default، مع registry منصة منفصل.
- نمط route layout server gate وServer Actions + Zod + typed results.
- Drizzle transactions وPostgres constraints/advisory locks عند الحاجة.
- request IDs وstructured logging مع منع الأسرار.
- local disposable DB harness، catalog manifests، RLS/PostgREST tests.
- `@repo/ui` والمكونات الذرية المحايدة بصريًا.

## 10. ما لا ينبغي إعادة استخدامه كحد منصة

- `team_members.role='owner'` أو أي Workspace role.
- Active Workspace كشرط Platform Admin.
- `users.email` أو Supabase metadata/app client state.
- tenant `DashboardShell`/`NAV_ITEMS` كـadmin navigation.
- `crm_activities` كسجل منصة.
- Website Builder الحالي كدليل على وجود admin boundary.
- soft delete بدل Workspace suspension.
- service-role Supabase client أو direct PostgREST لتنفيذ Platform CRUD.

## 11. فجوات لازمة لـSprint 2

1. dedicated platform identity persistence وربط immutable Auth UUID.
2. Platform role/status وحالة revocation.
3. platform capability vocabulary/registry مستقل.
4. opaque server-derived `PlatformActorContext`.
5. `/admin` route group/layout/shell وصفحات root/list/details/create.
6. Workspace lifecycle status enforcement في authenticated app boundary وRLS helper.
7. transaction موحدة لـWorkspace + owner membership + audit.
8. suspend/activate commands آمنة ومتزامنة ومدققة.
9. Platform Audit منفصل ومحمي من التعديل.
10. bootstrap/runbook مضبوط لأول Super Admin؛ لا self-promotion أو email grant.
11. وقف Workspace auto-provisioning غير المدقق.
12. test fixtures ومصفوفة منع شاملة لكل tenant actors.

## 12. المخاطر وتسوية A1

| الموضوع | الخطر | التوصية |
|---|---|---|
| التسجيل الذاتي | يستمر تكوين هويات بلا Workspace بعد إيقاف auto-provision | حسم A1:يبقى signup،ويظهر no-access في `/workspace-selection` بلا tenant creation |
| أول Super Admin | لا توجد واجهة آمنة لإنشاء أول سجل | حسم A1:controlled one-time server-side CLI،UUID-only،dry-run ومدقق؛لا UI self-promotion |
| Support Admin | المواصفة لا تحدد مصفوفته | حسم A1:role محجوز بصفر capabilities ولا `/admin` أوprovisioning UI |
| Workspace suspension | لا تحدد المواصفة أثرها على الموقع المنشور | حسم A1:تعليق authenticated Workspace access فقط؛public site/forms لا تتغير وWebsite shutdown مؤجل |
| owner onboarding | invite lifecycle غير مكتمل | Sprint 2 يقبل فقط internal user مرتبطًا بـimmutable Auth UUID؛ الدعوات خارج النطاق |
| runtime DB privilege | اتصال الخادم واسع الامتياز | لا توسيع المشكلة؛ platform services محصورة، ACL/RLS defense-in-depth، وفصل DB roles مهمة تشغيلية لاحقة |

حسم ADR-003 Accepted هذه النقاط في A1. تبقى owner invitation lifecycle وفصل
runtime/migration DB roles أعمالًا مؤجلة،لكن لا تمثلان blocker معماريًا لـB1.
