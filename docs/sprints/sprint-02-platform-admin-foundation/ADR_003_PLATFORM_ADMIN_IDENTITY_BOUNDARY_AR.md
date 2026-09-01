# ADR-003: حد هوية وصلاحيات Platform Admin

* **الحالة:** Accepted — اعتمد في Sprint 2 A1 Architecture Approval Gate
* **السبرنت:** Sprint 2 — Platform Admin Foundation
* **القرار المتأثر:** تمثيل Platform Admin، التفويض، ومكان routes

## السياق

يملك Verix هوية Workspace مرتبطة بـSupabase UUID، وأدوارًا في `team_members`،
وActive Workspace. لا يوجد كيان Platform Admin. المواصفة تمنع اعتبار Workspace
`owner` مديرًا للمنصة، وتطلب فصل Platform capabilities ومسارات الإدارة.

يجب أن يدعم التصميم Super Admin الآن وتمييز Support Admin مستقبلًا، من دون
منح Support صلاحيات غير معتمدة أو بناء custom Workspace roles.

## القرار المعتمد

### 1. التمثيل

إنشاء جدول server-controlled مستقل مفاهيميًا باسم `platform_admins`:

| الحقل | الغرض |
|---|---|
| `id uuid primary key` | معرف actor الداخلي لسجل المنصة والتدقيق |
| `auth_user_id uuid not null unique` | الرابط الوحيد إلى Supabase Auth UUID |
| `role platform_admin_role not null` | `super_admin` أو `support_admin` |
| `status platform_admin_status not null` | `active` أو `suspended` |
| `created_at`, `updated_at` | lifecycle metadata |

لا يعتمد الجدول على `team_members`، ولا يحتاج Platform Admin إلى `users` أو
Workspace membership. الشخص نفسه يمكن أن يكون Platform Admin وWorkspace Member
فقط إذا وجدت العلاقتان مستقلتين؛ وجود الأولى لا ينشئ الثانية.

يمثل `support_admin` distinction محجوزًا فقط. mapping الخاص به في Sprint 2 هو
قائمة capabilities فارغة، ولا توجد له واجهة provisioning. أي صلاحية مستقبلية
تحتاج مصفوفة معتمدة ومهمة منفصلة.

### 2. resolver والـcontext

`resolvePlatformActor()`:

1. ينفذ `auth.getUser()`.
2. يبحث بالمساواة التامة على `platform_admins.auth_user_id`.
3. يرفض missing row، status غير active، role غير معروف، أو duplicate invariant.
4. يحسب capabilities من registry منصة مستقل.
5. يعيد `PlatformActorContext` opaque ذا runtime brand غير مصدّر.

لا يستدعي Active Workspace ولا identity email resolver، ولا يقبل actor/role من
client. cache إن استعمل يكون request-scoped فقط؛ revocation تظهر في الطلب التالي.

### 3. القدرات

Vocabulary Sprint 2 المعتمد:

```text
platform.workspaces.read
platform.workspaces.create
platform.workspaces.assign_owner
platform.workspaces.suspend
platform.workspaces.activate
platform.audit.read
```

`super_admin` يحصل عليها كلها. `support_admin` يحصل على لا شيء حتى اعتماد
مصفوفته. registry/types/helpers تبقى في ملفات `platform-*` مستقلة عن
`capabilities.ts` الخاص بالـWorkspace.

### 4. routes

يستمر Sprint 2 داخل `apps/web`، مع route group:

```text
app/(platform-admin)/admin/
├── layout.tsx
├── page.tsx
└── workspaces/
    ├── page.tsx
    ├── new/page.tsx
    └── [workspaceId]/page.tsx
```

`/admin` protected prefix في proxy للراحة، لكن layout server gate هو الحاجز
authoritative. shell/navigation مستقلان عن tenant dashboard. لا يُنشأ
`apps/admin` في Sprint 2 لأن التطبيقين سيشتركان حاليًا في Supabase session، DB،
actions، deployment، وdomain modules؛ فصل directory وحده لا يضيف security
boundary ويضاعف البنية. يعاد تقييمه عندما توجد حاجة deployment hostname/CSP/
release cadence/operational ownership مستقلة.

### 5. Bootstrap لأول Platform Super Admin

الآلية المعتمدة هي **controlled server-side bootstrap CLI** داخل المستودع، وليست
route أوServer Action أوجزءًا من startup. التنفيذ اللاحق يلتزم بالعقد الآتي:

1. يعمل بأمر operator صريح، ويكون `dry-run` افتراضيًا؛لا ينفذ insert من مجرد
   تشغيل التطبيق أووجود environment variable.
2. يقبل Supabase Auth UUID واحدًا فقط. لا يقبل email أوWorkspace ID أوrole؛
   تكون `super_admin` قيمة ثابتة داخل الأمر الأولي وليست input قابلة للتغيير.
3. يتحقق خادميًا من صيغة UUID ومن وجود `auth.users.id` المطابق، ولا يستخدم
   email matching أوAuth metadata.
4. يرفض إذا وجد أي سجل في `platform_admins`. إعادة التشغيل لنفس الحالة تعرض
   `already bootstrapped` بلا mutation؛وجود سجل مختلف يفشل مغلقًا. إضافة أو
   استعادة admins لاحقًا ليست bootstrap وتقع خارج Sprint 2.
5. ينشئ `platform_admins` وحدث `platform_admin.bootstrap_completed` داخل
   transaction واحدة. الحدث actor من نوع `system_bootstrap`، وtarget هو سجل
   Platform Admin الجديد؛يسجل change-ticket/reference آمنًا ولا يسجل credentials.
6. local/dev مقيد بعنوان قاعدة repository-local حسب حراس Sprint 1. production
   يتطلب flag بيئة صريحًا،مطابقة project/database fingerprint،تأكيدًا تفاعليًا
   للقيمة،وchange-ticket؛تدار credentials خارج المستودع وفق الإجراء التشغيلي.
7. لا hard-coded UUID في migration،ولا `PLATFORM_ADMIN_UUID` دائم يمنح صلاحية،
   ولا endpoint عام،ولا self-promotion.

اختير CLI لأنه reproducible وقابل للاختبار والتدقيق،مع إبقاء الفعل يدويًا
ومضبوطًا. migration-seeded UUID يخلط بيانات البيئة بتاريخ schema؛environment
bootstrap قد يعيد الترقية عند كل startup أوتسرب قيمته؛manual SQL أقل قابلية
للتكرار والتحقق والتدقيق. manual trusted DB operation يبقى break-glass recovery
خارج Sprint 2،وليس المسار العادي.

### 6. التسجيل الذاتي بعد إيقاف auto-provisioning

يبقى Supabase self-signup الحالي متاحًا في Sprint 2؛لا تنشأ invitation lifecycle
جديدة. بعد تأكيد الحساب وتسجيل الدخول:

- ينشأ/يربط `users` row وفق immutable identity resolver عند أول resolution.
- إذا لم توجد active membership،تكون النتيجة `ActiveWorkspaceResolution.NONE`؛
  لا ينشأ Workspace أوowner membership أوCRM side effect.
- يعاد المستخدم إلى `/workspace-selection` التي تعرض حالة **No active
  workspace** وتعليمات التواصل مع Verix/support. هذه هي pending/no-access UX
  المعتمدة،وليست invitation state جديدة.
- يسمح له بـauth confirmation/login/logout/password recovery/reset،الصفحات
  العامة،و`/workspace-selection`. يسمح بـ`/admin` فقط إذا كان له سجل
  `platform_admins` active وقدرة مطلوبة مستقلة.
- تمنع كل Workspace dashboard routes/actions/services،وتمنع Platform routes
  لغير Platform actor. لا تمنح session وحدها أي tenant أوplatform authority.

### 7. تعيين المالك الأول

Workspace creation يقبل owner candidate على صورة `users.id` فقط. يجب أن يكون
السجل موجودًا،غير محذوف،ومرتبطًا بـ`auth_user_id` غير NULL. يمكن للواجهة إجراء
exact email lookup للعثور على candidate وعرضه،لكن email search input فقط وليس
authorization أوtarget identity؛submission يحمل internal user UUID ويعيد الخادم
التحقق من الرابط الثابت داخل transaction.

تنشئ transaction واحدة Workspace active،وتضبط `workspaces.owner_id`،وتنشئ
عضوية `team_members` active بدور `owner`،وتكتب حدثي creation/assignment. فشل
resolution أوconstraint أوaudit يلغي العملية كاملة؛لا يسمح Workspace بلا مالك
ولو مؤقتًا. unique `(workspace_id,user_id)` يمنع duplicate membership،والـretry
يتبع idempotency contract. owner reassignment/transfer والدعوة بالبريد خارج
Sprint 2.

### 8. معنى Workspace suspension

`workspace.status='suspended'` يعني **تعليق وصول Workspace المصادق عليه**،لا
حذف Workspace ولا إلغاء Supabase identity:

- Active Workspace resolver يستبعده ويعتبر selection cookie القديمة invalid.
- لا يقع fallback صامت إلى Workspace أخرى أثناء الطلب؛يعود المستخدم إلى اختيار
  صريح أوno-access.
- dashboard pages وdirect URLs وServer Actions وWorkspace-scoped services تفشل
  مغلقة عبر السياق الخادمي؛RLS helper يستبعد Workspace المعلقة كدفاع إضافي.
- memberships والسجلات التشغيلية تبقى من دون تعديل أوحذف.
- Supabase session تبقى صالحة لأن المستخدم قد يملك Workspace أخرى أوPlatform
  identity مستقلة.
- Platform Super Admin يبقى قادرًا على رؤية Workspace المعلقة وتفعيلها. التفعيل
  يعيد eligibility للعضويات active في الطلب التالي،ولا يختارها بصمت عند التعدد.
- **لا يؤثر التعليق في Sprint 2 على published client website أوpublic forms/
  public rendering الحالية.** المواصفة لا تطلب shutdown للموقع؛unpublish أو
  تعطيل public operations قرار Platform Website Management لاحق منفصل.

### 9. Platform Audit

`platform_audit_events` حد منفصل عن `crm_activities`،append-only بلا
`updated_at`/`deleted_at`. لا توجد application operation للتحديث أوالحذف،ويمنع
DB trigger كلاهما. الكتابة فقط من server-side audit writer عبر Drizzle؛
`PUBLIC`, `anon`, و`authenticated` بلا CRUD/EXECUTE مباشر.

- القراءة فقط لـactive Super Admin يحمل `platform.audit.read` عبر service خادمية.
  Workspace roles وSupport Admin لا يقرؤون السجل مطلقًا في Sprint 2.
- أحداث Workspace الناجحة (`created`, `owner_assigned`, `suspended`,
  `activated`) تكتب في transaction نفسها؛فشل success audit يلغي mutation.
- فشل command بعد نجاح Platform authorization والوصول إلى domain operation
  يمكن تسجيله `outcome='failure'` best-effort بعد rollback،بـerror code مصنف فقط.
- فشل authorization،وform validation المبكر،والطلبات المشوهة تسجل في structured
  application/security logs،لا `platform_audit_events`،لعدم وجود actor منصة
  موثوق أوcommand صالح.
- كل domain event يحمل actor kind،Platform Admin ID وimmutable Auth UUID،action،
  target type/ID،outcome،timestamp،request ID،ومفاتيح metadata allowlisted. حدث
  bootstrap الاستثنائي يحمل `actor_kind='system_bootstrap'` وtarget admin.
- يمنع تخزين passwords،tokens،cookies،API/service keys،raw request bodies،stack
  traces،أوPII غير اللازمة. email لا يخزن في metadata؛المعرفات الثابتة وreason/
  status codes المحدودة تكفي.

### 10. Support Admin

قد توجد قيمة identity role باسم `support_admin`،لكن mapping المعتمد لها في
Sprint 2 هو `[]`. لذلك لا تدخل `/admin`،ولا تستدعي Platform Actions أوservices،
ولا تقرأ Platform Audit. لا provisioning UI لها. أي قدرة مستقبلية تتطلب مصفوفة
وADR/task معتمدين؛لا inheritance من `super_admin`.

### 11. الفصل بين capability registries

Platform capabilities لها vocabulary وregistry وtypes وresolver/helpers مستقلة
عن Workspace capabilities. لا Workspace role يطابق Platform role أويمرر Platform
capability،ولا يوجد conversion/fallback بين السياقين. الحالة authoritative
خادمية،والـunknown role/capability/context يفشل مغلقًا. Client Components تحصل
على display state/booleans مشتقة فقط،لا role أوcontext موثوق.

## البدائل المدروسة

| البديل | النتيجة |
|---|---|
| اعتبار Workspace owner Platform Admin | مرفوض صراحة؛ يخرق tenant isolation |
| إضافة `is_platform_admin` إلى `users` | مرفوض؛ boolean لا يدعم role/status ويخلط الهوية tenant/platform |
| إضافة platform role إلى `team_members` | مرفوض؛ يجعل صلاحية المنصة تابعة لـWorkspace |
| Supabase `user_metadata` | مرفوض؛ client/profile state وقابل للـstaleness وليس سجل authorization خادميًا مناسبًا |
| Supabase `app_metadata` فقط | أفضل من user metadata لكنه يربط التفويض بـJWT stale/عمليات Auth Admin ولا يوفر audit/lifecycle محليين |
| allowlist بريد/متغير بيئة | مرفوض؛ email mutable ويصعب التدقيق/الإبطال المتسق |
| migration-seeded Super Admin UUID | مرفوض؛يمزج بيانات كل بيئة بتاريخ schema وغير مناسب لـUUID مختلف بين local/production |
| environment-configured bootstrap UUID عند startup | مرفوض؛قد يعيد منح الصلاحية تلقائيًا ويحوّل config دائمًا إلىauthorization source |
| manual trusted SQL كمسار عادي | مرفوض؛أقل قابلية للتكرار والتحقق والتدقيق؛يبقى break-glass خارج Sprint 2 |
| controlled server-side bootstrap CLI | معتمد؛UUID-only وdry-run وone-time وذري ومدقق ولا يفتح application endpoint |
| جدول platform memberships عام | صالح إذا وجدت عدة platform organizations؛ لا حاجة مثبتة الآن، و`platform_admins` أصغر |
| ربط `platform_admins.user_id -> users.id` | صالح، لكنه يجبر Platform-only identity على tenant-facing internal user lifecycle بلا حاجة؛ direct immutable Auth UUID أوضح |
| إنشاء `apps/admin` فورًا | مؤجل؛ لا قيمة أمان مستقلة ما دام DB/session/deployment مشتركًا |

## النتائج

### الإيجابية

- حد مستقل وقابل للإبطال وفاشل مغلقًا.
- لا email أو Workspace role authorization.
- يدعم distinction المستقبلي بلا overgrant.
- يمكن فصل `apps/admin` لاحقًا دون تغيير نموذج البيانات.
- يحافظ على B6.3 لأن كل data access خادمي عبر Drizzle.

### الكلفة/السلبيات

- جدولان/enums ومهاجرة جديدة لاحقًا ضمن B1 بعد تفويضها المستقل.
- runbook حساس لأول admin.
- نفس Auth user قد يملك علاقات tenant/platform مستقلة، ما يحتاج UX واضحًا.
- runtime DB connection المميز يبقى حدًا عالي الثقة.

## القرارات المكملة المعتمدة

1. يوقف Sprint 2 Workspace auto-provisioning عند أول login؛ المستخدم الجديد يصبح
   no-access حتى تعيينه عبر دورة معتمدة.
2. Workspace owner الأول يجب أن يكون `users` row مرتبطًا بـ`auth_user_id` غير
   nullable؛ invitation lifecycle غير المنجز لا يُستعمل.
3. suspension لا تلغي Supabase Auth،بل تبطل Workspace access المصادق؛published
   site وpublic flows الحالية لا تتغير في Sprint 2.
4. إدارة Platform Admins وSupport capability matrix خارج Sprint 2.

## معايير اعتماد ADR

- [x] dedicated `platform_admins` المباشر بـAuth UUID.
- [x] role/status values: `super_admin|support_admin` و`active|suspended`.
- [x] Support Admin محجوز بصفر capabilities ولا يدخل `/admin`.
- [x] `/admin` داخل `apps/web`؛لا `apps/admin` في Sprint 2.
- [x] automatic Workspace provisioning يتوقف؛self-signup ينتهي بـno-access.
- [x] bootstrap هو controlled server-side one-time CLI بالـAuth UUID.
- [x] المالك linked identity،والإنشاء/العضوية/audit ذرية بلا ownerless state.
- [x] suspension تعطل authenticated Workspace access ولا تطفئ public website.
- [x] Platform Audit منفصل،append-only،server-only،ولا يراه tenant.
- [x] Platform capability registry منفصل وfail-closed.

اعتماد هذا ADR موافقة على الحدود والعقود أعلاه،وليس موافقة على SQL أوmigration
أوproduction implementation بعينه. تبدأ B1 فقط بمهمة مستقلة بعد A1.
