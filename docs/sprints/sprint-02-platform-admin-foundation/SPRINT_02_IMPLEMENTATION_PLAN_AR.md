# الخطة التنفيذية authoritative — Sprint 2 Platform Admin Foundation

## 1. الحالة والغرض

* **الحالة:** Approved Architecture — أغلقت A1 وقُبل ADR-003؛لا تعد موافقة تنفيذ.
* **المصدر الملزم:** `docs/architecture/VERIX_PLATFORM_SPEC_v1.0_AR.md`.
* **المدخلات:** إغلاق Sprint 1 وADR-001/ADR-002 وB3/B3.2/B4/B5/B6/B6.3.
* **المخرجات المطلوبة:** حد Platform Admin مستقل، routes محمية، Workspace
  list/details/create/owner/suspend/activate، وPlatform Audit أولي.

هذه خطة فقط. أسماء migrations والملفات الجديدة أدناه **متوقعة** وليست ملفات
مصرحًا بإنشائها ضمن مهمة التخطيط الحالية.

## 2. نتيجة التدقيق التي تبني عليها الخطة

1. لا يوجد Platform Admin schema/role/route حاليًا.
2. `owner|manager|employee` كلها أدوار Workspace فقط.
3. Supabase `getUser()` وimmutable `auth_user_id` وActive Workspace منفذة.
4. capability registry الحالي Workspace-only وdeny-by-default.
5. `/website-builder` محجوب عن كل Workspace roles، لكنه ليس Platform route.
6. `workspaces` لا يحتوي status؛ `suspended` الحالي للعضوية فقط.
7. Workspace ينشأ تلقائيًا لأول login، خارج Platform authorization/audit.
8. `crm_activities` tenant CRM timeline وليس audit آمنًا للمنصة.
9. domain access production خادمي عبر Drizzle؛ B6.3 يغلق direct PostgREST CRUD.
10. الاختبارات المحلية الحالية يمكن تمديدها، لكن catalog/RLS inventories يجب أن
    تضم schema الجديدة صراحة.

التفاصيل والأدلة: `SPRINT_02_AUDIT_AR.md`.

## 3. القرارات المعمارية المعتمدة في A1

### 3.1 Platform identity

يعتمد Sprint 2 جدول `platform_admins` مستقلًا، مرتبطًا مباشرة بـimmutable
Supabase `auth_user_id`. لا يعتمد على `users`, `team_members`, Workspace owner،
البريد، أو Auth metadata.

```text
Supabase auth user UUID
  -> platform_admins.auth_user_id (unique)
  -> active platform role
  -> server-derived PlatformActorContext
  -> platform capability registry
```

الأدوار الممثلة:

- `super_admin`: منفذ Sprint 2 المصرح.
- `support_admin`: قيمة محجوزة بصفر capabilities؛ لا UI/provisioning في Sprint 2.

حالة actor: `active|suspended`. لا soft-delete لسجل actor لأنه مرجع audit. إدارة
Platform Admins خارج النطاق؛أول Super Admin فقط عبر controlled server-side
bootstrap CLI معتمد ومفصل في ADR-003.

الـADR المعتمد: `ADR_003_PLATFORM_ADMIN_IDENTITY_BOUNDARY_AR.md`.

### 3.2 authorization boundary

ملفات مفاهيمية منفصلة:

```text
src/server/auth/platform-capabilities.ts
src/server/auth/platform-identity.ts
src/server/auth/platform-authorize.ts
src/server/auth/platform-page-authorization.ts
```

العقد:

- `resolvePlatformActor()` يعيد context opaque بعد `getUser()` وDB lookup.
- `requirePlatformCapability(capability)` يفشل مغلقًا.
- `requirePlatformPageCapability(capability)` يحول denial المصادق إلى
  `notFound()` من دون كشف السطح.
- context يحمل actor ID/Auth UUID/role/capabilities وruntime brand خاص؛ لا يصدر
  factory ولا يسلسل للعميل.
- كل Platform Action يتحقق قبل validation أو service call.
- كل public platform service يعيد runtime assertion للcontext والقدرة الخاصة
  بالعملية؛ لا يقبل role أو platform admin ID منفردًا.
- Client Components تستقبل data وsafe UI booleans فقط، لا actor context أو
  authoritative role.

Capabilities Sprint 2:

| capability | الاستعمال |
|---|---|
| `platform.workspaces.read` | root/list/details |
| `platform.workspaces.create` | إنشاء Workspace |
| `platform.workspaces.assign_owner` | تعيين المالك الأول داخل transaction |
| `platform.workspaces.suspend` | active → suspended |
| `platform.workspaces.activate` | suspended → active |
| `platform.audit.read` | service/read boundary للسجل؛ UI سجل كامل ليست إلزامية هنا |

كلها لـ`super_admin` فقط في Sprint 2. unknown role/capability = deny.

### 3.3 route architecture

التوصية: البقاء داخل `apps/web` باستخدام `(platform-admin)` وURL `/admin`:

```text
apps/web/app/(platform-admin)/admin/
├── layout.tsx                  # server authorization + PlatformAdminShell
├── loading.tsx
├── error.tsx
├── page.tsx                    # root مختصر وروابط آمنة
└── workspaces/
    ├── page.tsx                # list/search/pagination/status
    ├── new/page.tsx            # create + owner
    └── [workspaceId]/page.tsx  # details + lifecycle controls
```

مع مكونات مستقلة تحت `components/platform-admin/`. يمكن إعادة استخدام
`@repo/ui` والمكونات المحايدة، لا tenant shell/nav.

لا ينشأ `apps/admin` الآن: لا deployment أو hostname أو secrets أو ownership
تشغيلي مستقل مثبت. الفصل الشكلي لا يمنع استدعاء shared server code، بينما layout
والaction/service gates تحقق boundary الفعلي. يعاد فتح القرار إذا احتاجت الإدارة
CSP/session policy/deployment/release cadence مستقلة.

يضاف `/admin` إلى proxy protected prefixes، لكن ذلك defense-in-depth فقط. login
يحفظ `redirectTo` الآمن، ثم كل destination يعيد تفويضه server-side. لا تحول
الجلسة المصادق عليها تلقائيًا إلى `/dashboard` إذا كان الطلب الأصلي `/admin`.

### 3.4 Workspace lifecycle

#### الحالات

`workspace_status = active|suspended` فقط. لا `draft`, `deleted`, `archived`، ولا
Store status في هذا السبرنت. `deleted_at` لا يستخدم كبديل للتعليق ولا تبنى عملية
حذف.

#### create + owner invariants

1. actor active Super Admin بقدرتي create وassign owner.
2. input validated: name/slug/profile fields المحدودة + owner candidate ID +
   idempotency key؛ لا status/actor/role من client.
3. owner هو `users.id` موجود، غير محذوف، وله `auth_user_id` غير NULL وفريد.
4. لا يعتمد التعيين على email؛ email يعرض فقط.
5. السماح للشخص نفسه بعضوية في Workspaces أخرى مقصود في نموذج multi-workspace،
   لكن UI يعرض هذا بوضوح؛ membership من Workspace أخرى لا يعاد استخدامها.
6. transaction واحدة تنشئ Workspace active، وowner membership active، وتكتب
   `workspace.created` و`workspace.owner_assigned`.
7. `workspaces.owner_id` يساوي `team_members.user_id` لعضوية owner الجديدة.
8. unique `(workspace_id,user_id)` يمنع duplicate membership، وunique slug يمنع
   duplicate tenant slug.
9. idempotency key ثابت للمحاولة، وفهرس audit فريد على actor/action/key. عند retry
   يرجع target السابق؛إعادة المفتاح مع payload مختلف تفشل،وأي duplicate
   transaction منافسة تتراجع بالكامل.
10. لا CRM/site/default Store side effects داخل transaction Sprint 2. Store
    ممنوع، وCRM initialization إن بقي مطلوبًا يحتاج مهمة لاحقة مستقلة وآمنة.

يوقف auto Workspace provisioning في Active Workspace. الهوية الجديدة قد تنشئ
`users` row ثم ترى حالة no-access، لكنها لا تصبح owner ولا ينشأ tenant كأثر
جانبي. هذا ضروري لجعل المسار الإداري authoritative ومدققًا.

يبقى self-signup الحالي،لكن المستخدم المؤكد بلا membership ينتهي إلى
`ActiveWorkspaceResolution.NONE` و`/workspace-selection` بحالة **No active
workspace**. يسمح له بمسارات auth/account والصفحات العامة وهذا المسار فقط؛كل
Workspace dashboard وPlatform route مرفوضة ما لم توجد علاقة مستقلة مناسبة. لا
ينشئ Sprint 2 invitation/pending schema جديدة.

يجوز exact email lookup في واجهة Super Admin لاكتشاف linked candidate،لكن
submission والـtransaction تعتمدان `users.id` وتعيدان التحقق من non-null immutable
`auth_user_id`. email ليس authorization key،وفشل resolution يمنع إنشاء Workspace
كله. لا توجد ownerless intermediate state،وowner reassignment خارج Sprint 2.

#### suspend/activate invariants

- transition الوحيدان: `active -> suspended` و`suspended -> active`.
- suspend reason إلزامي ومحدد الطول؛ activation note اختياري. كلاهما metadata
  allowlisted في audit.
- service يقفل Workspace row (`FOR UPDATE`) أو يستخدم atomic expected-status
  predicate؛ لا lost update.
- تكرار نفس operation key يعيد النتيجة السابقة ولا يكرر event. طلب target state
  نفسه بمفتاح جديد هو success no-op واضح:لا يغير row،ويكتب event واحدًا
  `outcome='success'` مع `metadata.no_op=true` والحالتين السابقة/الجديدة. reuse
  لنفس المفتاح مع target/payload مختلف يفشل مغلقًا.
- memberships والبيانات تبقى كما هي عند التعليق؛ لا status mass-update ولا حذف.
- Supabase Auth والجلسة لا تلغيان لأن المستخدم قد ينتمي إلى Workspace أخرى.
- Active Workspace resolver يستبعد Workspace المعلقة في الطلب التالي. إذا كانت
  cookie تشير إليها، تصبح invalid/selection-required؛ لا switching صامت داخل
  mutation.
- `current_workspace_ids()` يضم فقط Workspaces active كدفاع RLS.
- tenant Server Actions/pages والخدمات ذات السياق المصادق تتوقف عبر Active
  Workspace. published client websites وpublic rendering/forms الحالية لا تتغير
  في Sprint 2؛المواصفة لا تطلب shutdown عامًا. unpublish أوتعطيل public operations
  قرار Platform Website Management لاحق.

### 3.5 Platform Audit

القرار: جدول منفصل `platform_audit_events`، لا `crm_activities`.

الحد الأدنى المعتمد معماريًا؛تفاصيل SQL الدقيقة تراجع في B1:

| العمود | النوع/القيد | الغرض |
|---|---|---|
| `id` | UUID PK | event identity |
| `actor_kind` | `platform_admin|system_bootstrap` | نوع actor الصريح |
| `actor_platform_admin_id` | UUID FK restrict nullable | مطلوب لكل domain event،NULL فقط للbootstrap |
| `actor_auth_user_id` | UUID nullable | immutable actor snapshot؛مطلوب مع Platform actor |
| `action_type` | enum/text check | vocabulary مغلق للأحداث المطلوبة |
| `target_type` | enum/text check | `workspace`, `workspace_owner`, `platform_admin_bootstrap` عند الحاجة |
| `target_id` | UUID nullable حسب event | target |
| `outcome` | `success|failure` | النتيجة |
| `request_id` | text | log correlation، ليس authorization input |
| `idempotency_key` | UUID nullable | retry correlation/uniqueness |
| `metadata` | JSONB not null default `{}` | allowlisted reason/previous/new status، بلا أسرار |
| `occurred_at` | timestamptz default now | timestamp immutable |

لا `updated_at` ولا `deleted_at`. index على `(occurred_at desc)`,
`(actor_platform_admin_id, occurred_at)`, `(target_type,target_id,occurred_at)`،
وفهرس unique جزئي لـ`(actor_platform_admin_id,action_type,idempotency_key)` عندما
لا يكون المفتاح NULL.

الأحداث الإلزامية:

```text
workspace.created
workspace.owner_assigned
workspace.suspended
workspace.activated
```

success audit ذري مع mutation. failure بعد actor resolution ووصول command صحيح
إلى domain operation يسجل best-effort في transaction منفصلة بعد rollback،مع
error code آمن. denial بلا Platform actor،malformed requests،وform validation
المبكر تسجل في structured security logs فقط؛لا actor منصة موثوقًا لصف audit.
حدث bootstrap يستخدم `actor_kind='system_bootstrap'` ويستهدف admin الجديد،مع
check constraints تفرض actor fields على كل event عادي وتمنع actor مبهمًا.

الجدول append-only: trigger يرفض UPDATE/DELETE، لا service لها، RLS enabled بلا
policy لـData API، وREVOKE ALL صريح من `PUBLIC`, `anon`, `authenticated`. القراءة
الخادمية تتطلب `platform.audit.read`، ولا تعرض في tenant UI.

## 4. تغييرات قاعدة البيانات/RLS المحتملة

لا يكتب SQL إلا في B1 المستقلة بعد اعتماد ADR والخطة. migration المتوقعة التالية بعد `0005` يجب أن
تولد عبر Drizzle ثم تراجع يدويًا؛ اسمها المفاهيمي `0006_platform_admin_foundation`.

| التغيير | القيد/index | السبب | RLS/العزل | B6.3 interaction |
|---|---|---|---|---|
| enum `platform_admin_role` | `super_admin`,`support_admin` | distinction مستقل | لا صلة بـWorkspace | لا grant |
| enum `platform_admin_status` | `active`,`suspended` | revocation fail-closed | server-only | لا grant |
| table `platform_admins` | PK،unique `auth_user_id`،role/status indexes | هوية المنصة | RLS enabled،zero Data API policies | REVOKE ALL explicit |
| enum `workspace_status` | `active`,`suspended` | lifecycle مغلق | يدخل Active Workspace/RLS | لا direct mutation |
| `workspaces.status` | not null default active + index `(status,created_at)` | list/filter/enforcement | tenant يرى active فقط عبر context | authenticated CRUD يبقى revoked |
| optional status attribution | `status_changed_at`, `status_changed_by` FK | current-state attribution سريع | لا يغني عن audit | server-only writes |
| table `platform_audit_events` | PK/FKs/actor-kind checks/indexes/idempotency unique | سجل منفصل دائم + system bootstrap event | RLS enabled بلا tenant policies؛append-only trigger | explicit revoke + REST denial test |
| update `current_workspace_ids()` | join `workspaces`, `status='active'`, non-deleted | منع RLS scope المعلق | يحافظ على tenant boundary | EXECUTE يبقى revoked عن app roles وفق B6.3 |
| append-only function/trigger | reject UPDATE/DELETE | audit tamper resistance | لا SECURITY DEFINER غير لازم | revoke function execute إذا exposeable |

اعتبارات migration:

1. backfill كل Workspace موجودة إلى `active` قبل/مع NOT NULL/default.
2. لا hard-code Super Admin UUID/email داخل migration.
3. لا FK مباشر إلى `auth.users` مطلوب؛ التطبيق يتحقق من UUID عبر Auth session،
   كما أن فصل lifecycle يقلل coupling. uniqueness محلي إلزامي.
4. إذا أضيف `status_changed_by` يكون nullable للصفوف القديمة و`ON DELETE
   RESTRICT`؛ Platform Admin records لا تحذف في Sprint 2.
5. snapshot/catalog post-Sprint-2 جديد، وتوسيع verifier ليجرد privileges لكل
   table/function جديدة؛ لا تعديل baseline التاريخي باعتباره الحالة الجديدة.
6. الاختبارات على repository-local Supabase فقط، مع hosted connection guard.
7. لا GRANT لـ`anon` أو`authenticated` ولا RPC عام.

## 5. Tenant lockout contract

### الصفحات والتنقل

- unauthenticated `/admin/*`: redirect login آمن مع `redirectTo` محلي.
- authenticated non-platform actor: not-found/deny؛ لا redirect إلى admin root.
- owner/manager/employee/no-membership/suspended tenant كلهم non-platform ما لم
  توجد لهم `platform_admins` relation مستقلة active.
- tenant navigation لا يحتوي Admin link ولا receives admin state.
- platform shell لا يعرض tenant navigation أو Active Workspace switcher.

### Actions/services/routes

- direct action invocation يتحقق أولًا، ثم validation.
- malformed IDs/fields لا تغير ترتيب التفويض ولا تكشف validation details لغير
  المصرح.
- service يستلزم opaque actor ويعيد capability assertion.
- أي Route Handler platform مستقبلي يستخدم نفس resolver ويعيد generic denial؛
  لا يوجد API عام جديد في Sprint 2.
- platform targets لا تؤخذ من Active Workspace cookie.
- tenant services لا تكتسب global query helpers لمجرد وجود Platform Admin؛ تنشأ
  services منصة مستقلة.

### حالات مختلطة

وجود Workspace membership وPlatform row للشخص نفسه ينتج صلاحيتين مستقلتين:
`/admin` يستخدم Platform context، و`/dashboard` يستخدم Active Workspace. لا تحويل
تلقائي بينهما ولا inheritance. Platform-only actor لا يحصل Workspace تلقائيًا.

## 6. استراتيجية الاختبارات

### 6.1 fixtures الإلزامية

- active Platform Super Admin.
- suspended/revoked Platform Super Admin.
- reserved Platform Support Admin بصفر capabilities.
- Workspace Owner.
- Manager.
- Employee.
- authenticated user بلا memberships.
- unauthenticated request.
- actor مزدوج: Super Admin + Workspace Member، لإثبات الفصل.
- Workspace active وأخرى suspended، ومستخدم متعدد العضويات.

### 6.2 مجموعات التحقق

| المجموعة | حالات أساسية |
|---|---|
| platform identity unit | UUID lookup، missing/inactive/unknown role، email/metadata ignored، duplicate invariant |
| platform capability matrix | Super grants الستة؛ Support/unknown/tenant roles صفر؛ unknown capability denied |
| route tests | root/list/detail/new لكل actor، direct URL، safe redirect، not-found leakage behavior |
| malicious Server Action | forged role/actor/target، malformed payload، invocation بلا page، authorization قبل validation/service |
| service layer | opaque context brand، capability per method، no query before deny، target not-found generic |
| create/owner transaction | linked owner،unlinked/deleted/not-found reject،unique slug،rollback injection،two audits،duplicate/retry/concurrency |
| suspend/activate | transitions،reason validation،stale expected status،concurrency،members retained،events correct |
| Active Workspace revocation | selected suspended invalid next request،multi-tenant no silent fallback،reactivation restores eligibility |
| public surfaces | suspension لا تغير published rendering أوpublic forms في Sprint 2؛regression يثبت عدم إدخال shutdown عرضي |
| Platform Audit integration | actor/action/target/time/metadata/outcome،atomic success،failure handling،ordering/pagination،no secrets |
| audit tamper | runtime application path لا update/delete؛ trigger rejects؛ tenant cannot read |
| local DB/RLS | schema constraints،workspace status in helper،cross-tenant isolation،platform tables deny-all direct roles |
| PostgREST ACL | anon/authenticated SELECT/INSERT/UPDATE/DELETE وRPC attempts denied لكل الجديد والقديم |
| Sprint 1 regression | identity B4،Active Workspace B5،relationships B3.2،RLS B3،capabilities B6،ACL B6.3 |
| quality gates | unit suite،DB suites،`check-types`, `lint`, production `build`, `git diff --check` |

### 6.3 أوامر البوابة المتوقعة

تحدد الأسماء النهائية أثناء التنفيذ. الحد الأدنى:

```text
npm test --workspace=web
npm run test:db:canonical --workspace=web
npm run test:db:relationships --workspace=web
npm run test:db:identity --workspace=web
npm run test:db:active-workspace --workspace=web
npm run test:db:rls --workspace=web
npm run test:db:postgrest --workspace=web
npm run test:db:acl:verify --workspace=web
npm run check-types
npm run lint
npm run build
git diff --check
```

لا تستخدم أي DB URL قبل مرور hosted guard وإثبات `127.0.0.1`/repository-local
stack. لا تنفذ tests أو migrations على hosted Supabase.

## 7. تفكيك Sprint 2 إلى مهام مرتبة

### A1 — Architecture and ADR Approval

- **الهدف:** اعتماد ADR-003، semantics التعليق، self-registration/provisioning،
  owner eligibility، وbootstrap channel.
- **dependencies:** وثائق هذه المهمة ومراجعة بشرية.
- **expected files:** هذه الوثائق فقط وقد تحدث بعد review.
- **DB impact:** لا شيء.
- **security impact:** يمنع تنفيذ نموذج ملتبس أو overgrant Support.
- **tests:** document consistency و`git diff --check`.
- **completion:** **مكتمل:** ADR-003 أصبح Accepted والقرارات الثمانية حُسمت.
- **excluded:** production code،migration،Store.

### B1 — Platform Schema and Migration Design Review

- **الهدف:** تصميم schema diff وpreflight/rollback/catalog plan دون تطبيق hosted.
- **dependencies:** A1.
- **expected files:** `schema/enums.ts`, `schema/tables.ts`, `schema/relations.ts`،
  migration `0006_*` وmeta لاحقًا، DB test fixtures/verifiers.
- **DB impact:** enums،`platform_admins`،Workspace status،audit table/trigger/helper.
- **security impact:** RLS deny-all وexplicit ACL revokes،append-only audit.
- **required tests:** migration bootstrap fresh،catalog diff،constraint/RLS/ACL
  integration،hosted guard.
- **completion:** SQL reviewed؛ fresh local replay reproduces exact catalog؛ لا
  direct role privilege.
- **excluded:** UI/actions،bootstrap data،hosted apply.

### B2 — Platform Identity Resolver and Bootstrap Contract

- **الهدف:** immutable UUID resolver،status/role fail-closed،opaque context،
  وتنفيذ controlled first-admin CLI بالعقد المعتمد:dry-run،UUID-only،one-time،
  environment fingerprint/confirmation،وbootstrap audit ذري.
- **dependencies:** B1.
- **expected files:** `auth/platform-identity.ts`،validators/scripts/runbook
  narrowly approved،unit/integration tests.
- **DB impact:** reads/inserts `platform_admins` only through approved server path.
- **security impact:** يمنع email/metadata/Workspace-derived admin وself-promotion.
- **required tests:** active/missing/suspended/unknown/concurrent bootstrap/relink
  refusal؛ redacted logging.
- **completion:** only exact active Auth UUID resolves؛ bootstrap idempotent ويمنع
  overwrite، ولا client endpoint.
- **excluded:** Platform Admin management UI،Support provisioning،Workspace roles.

### C1 — Platform Capability and Authorization Boundary

- **الهدف:** registry منفصل،helpers،opaque branding،service assertion contract.
- **dependencies:** B2.
- **expected files:** `platform-capabilities.ts`, `platform-authorize.ts`,
  `platform-page-authorization.ts` واختباراتها.
- **DB impact:** لا تغيير جديد.
- **security impact:** deny-by-default في page/action/service،Support صفر.
- **required tests:** full actor/capability matrix،forged context،direct invocation.
- **completion:** لا import أو mapping بين Workspace roles وPlatform roles؛ كل
  unknown denied.
- **excluded:** custom roles،Support matrix،UI.

### C2 — Retire Unauthorised Workspace Auto-Provisioning

- **الهدف:** جعل Platform lifecycle هو مسار Workspace creation الوحيد، وحالة
  no-access صريحة للمستخدم الجديد.
- **dependencies:** A1،C1؛سلوك التسجيل/no-access معتمد ولا يحتاج قرارًا إضافيًا.
- **expected files:** `active-workspace.ts`, auth redirect/no-access UX،اختبارات
  Active Workspace/identity،وقد يتأثر `crm-pipeline` initialization.
- **DB impact:** لا schema جديد؛ يمنع writes التلقائية.
- **security impact:** يغلق مسار إنشاء غير مدقق ويحمي Platform-only identities من
  عضوية tenant تلقائية.
- **required tests:** new identity no Workspace،existing memberships unchanged،
  Platform-only dashboard no provisioning،Sprint 1 B4/B5 regressions.
- **completion:** لا Workspace/owner membership ينشآن من resolver أو page load.
- **excluded:** invitation lifecycle،Store،CRM redesign.

### D1 — Platform Route and Shell Foundation

- **الهدف:** `/admin` root وlayout/loading/error،shell/nav مستقلان.
- **dependencies:** C1.
- **expected files:** `(platform-admin)/admin/*`,
  `components/platform-admin/*`, `proxy.ts`, auth redirect tests.
- **DB impact:** reads identity only.
- **security impact:** direct URL server gate؛لا admin state في tenant nav.
- **required tests:** all actor route matrix،safe redirects،RSC/client boundary،
  accessibility loading/error/denied states.
- **completion:** Super يرى shell؛كل الآخرين fail closed؛proxy ليس control الوحيد.
- **excluded:** Workspace screens،Website Builder،`apps/admin`.

### E1 — Platform Workspace Read Model

- **الهدف:** paginated/filterable Workspace list وتفاصيل آمنة.
- **dependencies:** D1،B1.
- **expected files:** `platform-workspace.service.ts`, validators،list/detail pages
  ومكونات العرض.
- **DB impact:** read indexes فقط كما اعتمد B1.
- **security impact:** global reads فقط بقدرة منصة؛لا إعادة استخدام tenant service.
- **required tests:** authorization before query،pagination/search limits،not-found،
  active/suspended display،query-count/performance.
- **completion:** list/detail states (loading/empty/error/not-found) واضحة وبلا N+1.
- **excluded:** edit/delete،Store counts إذا تتطلب Store schema.

### E2 — Atomic Workspace Creation and Initial Owner

- **الهدف:** create + owner membership + events ذريًا وidempotent.
- **dependencies:** C2،E1،F1 audit writer foundation أو تنفيذ جزء writer قبله.
- **expected files:** platform workspace action/service/validator،`new/page.tsx`,
  form components،transaction tests.
- **DB impact:** writes workspaces/team_members/audit؛لا Store rows.
- **security impact:** linked owner verification،capabilities مزدوجة،cross-workspace
  candidate safety.
- **required tests:** كل invariants،rollback،retry،concurrency،forged actor/owner،
  no email authorization.
- **completion:** state and two success events all-or-nothing؛retry لا يكرر.
- **excluded:** owner invitation،owner transfer،CRM/Website/Store defaults.

### E3 — Workspace Suspension and Activation Enforcement

- **الهدف:** lifecycle commands وإنفاذ lockout الشامل المحدد.
- **dependencies:** B1،E1،F1 writer.
- **expected files:** platform actions/services/validators،detail controls،
  `active-workspace.ts` وRLS/helper tests.
- **DB impact:** status updates + audit،helper migration ضمن B1.
- **security impact:** immediate next-request revocation وno silent tenant fallback؛
  public website behavior يبقى خارج معنى suspension في Sprint 2.
- **required tests:** transitions/retry/race/tenant denial/Active Workspace،public
  surface non-regression،RLS/PostgREST regressions.
- **completion:** suspended Workspace غير قابل للاستعمال tenant-side،members retained،
  activation تعيد eligibility،وكل تغيير مدقق.
- **excluded:** logout global،unpublish site،delete Workspace.

### F1 — Platform Audit Boundary

- **الهدف:** append-only writer/read service،success atomicity،safe failure logging.
- **dependencies:** B1،C1.
- **expected files:** `platform-audit.service.ts`, event types/validators،tests؛لا
  tenant CRM files إلا منع accidental reuse.
- **DB impact:** writes/reads audit table فقط.
- **security impact:** no tenant exposure/tamper،metadata allowlist.
- **required tests:** required events،atomic rollback،failure outcome،redaction،
  update/delete/ACL/RLS denial،pagination authorization.
- **completion:** E2/E3 لا تملك success path بلا event؛tenant cannot read/write.
- **excluded:** SIEM/export/retention dashboard الكامل.

### G1 — Full Regression Verification

- **الهدف:** تشغيل كل مجموعات التطبيق/DB/security/build على local-only stack.
- **dependencies:** B–F مكتملة ومراجعة.
- **expected files:** تقرير `G1_FULL_REGRESSION_AR.md` فقط عند التحقق.
- **DB impact:** disposable/local tests فقط؛لا hosted.
- **security impact:** إثبات عدم تراجع Sprint 1.
- **required tests:** كل القسم 6،مع النتائج والأعداد والبيئة/HEAD.
- **completion:** كل gate PASS أو blocker موثق؛working tree inventory واضح.
- **excluded:** fixes غير مرتبطة أو Sprint 3.

### G2 — Security Checklist and Sprint Closure

- **الهدف:** مراجعة threat model/ADR/spec/evidence وإغلاق Sprint 2.
- **dependencies:** G1 PASS.
- **expected files:** `SPRINT_02_CLOSURE_AR.md` وتحديث statuses المعتمدة فقط.
- **DB impact:** لا شيء.
- **security impact:** إثبات lockout/audit/ACL وعدم scope creep.
- **required tests:** لا إعادة عشوائية؛تحقق الأدلة و`git diff --check`،وأي targeted
  rerun إذا تغير الكود بعد G1.
- **completion:** checklist كامل،risks/deferrals صريحة،review sign-off.
- **excluded:** Sprint 3 kickoff أو production rollout.

## 8. ترتيب الاعتماد والتنفيذ

```text
A1
 -> B1 -> B2 -> C1
              -> D1 -> E1
 -> C2 -----------------> E2
       C1 -> F1 --------> E2/E3
       B1 --------------> E3
 E1 + E2 + E3 + F1 -> G1 -> G2
```

لا تدمج B1 migration مع UI، ولا E2 create مع E3 status، ولا G1 مع إصلاحات غير
مخططة. كل مهمة تقف للمراجعة قبل التالية.

## 9. خارج النطاق صراحة

- Store schema/domain.
- Active Store implementation.
- Store membership/access.
- products/categories.
- inventory.
- orders/commerce.
- Store-to-Site association.
- White Label.
- custom Workspace roles أو role editor.
- Platform Website Management أو نقل/تفعيل Website Builder.
- domain/publishing administration.
- Workspace deletion/archival أو owner transfer بعد الإنشاء.
- Platform Admin management UI وSupport permissions.
- external/public admin API أو RPC.
- إنشاء `apps/admin`, `apps/api`, أو packages جديدة بلا مستهلكين مثبتين.
- unrelated dashboard/marketing redesigns.
- hosted database apply/rollout.

## 10. مخاطر التنفيذ وضوابطها

| الخطر | الأثر | المعالجة داخل Sprint 2 |
|---|---|---|
| بقاء auto-provisioning | bypass كامل للـPlatform create/audit | C2 قبل E2 closure |
| خلط registries | owner قد يرث منصة أو admin يرث tenant | ملفات/types/contexts منفصلة واختبارات negative |
| middleware-only auth | direct action bypass | layout + action + service gates |
| new table defaults | إعادة فتح PostgREST | explicit revokes + catalog/REST tests لكل migration |
| status غير مطبق في authenticated boundary | مستخدم معلق يستمر | Active Workspace + RLS helper + action/service tests؛public surfaces لا تدخل في status في Sprint 2 |
| transaction جزئية | tenant بلا owner/audit | transaction واحدة وfault injection |
| Support overgrant | سلطة غير معتمدة | role محجوز بصفر capabilities |
| audit قابل للتعديل/الظهور | إخفاء actions أو تسريب cross-tenant | separate append-only server-only table |
| owner placeholder | ownership قبل immutable claim | linked Auth UUID required |
| privileged runtime DB | bypass داخلي محتمل | server-only modules/assertions؛لا توسيع grants؛risk مؤجل موثق |
| login redirect الحالي `/dashboard` | Platform-only actor يدخل tenant provisioning | safe destination logic + C2 no auto-provision |
| query N+1 في list | تدهور مع عدد tenants | aggregate/pagination query bounded واختبار query plan عند الحاجة |

## 11. سجل قرارات A1 المعتمدة

1. `platform_admins` مستقل ومرتبط مباشرة بـimmutable Auth UUID.
2. `support_admin` role قد يوجد،لكن capabilities صفر ولا يصل `/admin`.
3. `/admin` route group معزول داخل `apps/web`؛لا `apps/admin` الآن.
4. Workspace auto-provisioning يتوقف؛self-signup يبقى وينتهي no-access عند عدم
   وجود membership.
5. المالك الأول linked internal identity؛email lookup فقط وليس authorization؛
   لا ownerless Workspace ولا reassignment في Sprint 2.
6. bootstrap هو controlled one-time server-side CLI،dry-run وUUID-only ومدقق؛
   لا migration seed أوenv auto-grant أوmanual SQL عادي.
7. Workspace suspension تمنع authenticated Workspace access وتحتفظ بالجلسة/
   memberships،ولا تطفئ published website أوpublic forms في Sprint 2.
8. Platform Audit منفصل وappend-only؛success ذري،domain failure best-effort،
   authorization failures في security logs.
9. Platform capability registry مستقل بالكامل وfail-closed.
10. operation keys idempotent؛same-key replay لا يكرر،payload mismatch يرفض،
    وnew-key same-state status command يسجل success no-op صريحًا.

لا توجد blockers معمارية متبقية لـB1. كل مهمة تنفيذية ما زالت تحتاج تفويضها
المنفصل ومراجعتها،ولا تمنح A1 موافقة migration أوproduction change.

## 12. قائمة إغلاق Sprint 2

### الهوية والحدود

- [ ] Platform Admin ممثل بعلاقة مستقلة مرتبطة بـimmutable `auth_user_id`.
- [ ] لا اشتقاق من Workspace membership أو `owner`.
- [ ] لا authorization بالبريد أو metadata أو client state.
- [ ] Platform registry منفصل وdeny-by-default.
- [ ] Support Admin لا يرث Super Admin capabilities.
- [ ] revocation/suspension للـPlatform actor نافذة في الطلب التالي.

### routes/actions/services

- [ ] `/admin` وكل descendants تفشل مغلقة لغير Platform actor.
- [ ] unauthenticated وowner وmanager وemployee وno-membership ممنوعون.
- [ ] tenant navigation لا يعرض Platform Admin ولا يسرب حالته.
- [ ] كل Platform Action تتحقق قبل validation/mutation.
- [ ] كل Platform service تعيد capability/context assertion.
- [ ] direct/malformed/forged action invocations لا تكتب ولا تكشف تفاصيل.

### Workspace lifecycle

- [ ] auto-provisioning غير الإداري متوقف.
- [ ] list/details/create screens والحالات loading/empty/error/not-found مكتملة.
- [ ] create + linked owner + owner membership + audit ذرية.
- [ ] unique/idempotency/concurrency invariants مثبتة.
- [ ] لا تعيين owner بالبريد أو placeholder غير مرتبط.
- [ ] active/suspended transitions فقط؛لا delete صامت.
- [ ] suspension تحتفظ بالمستخدمين والبيانات وتبطل tenant access.
- [ ] Active Workspace stale لا ينتقل تلقائيًا لمستأجر آخر.
- [ ] public rendering/forms مثبت عدم تغيرها بسبب suspension في Sprint 2.

### Audit وقاعدة البيانات

- [ ] كل create/owner/suspend/activate success مسجل.
- [ ] actor/action/target/time/outcome/request/idempotency/metadata صحيحة وآمنة.
- [ ] Platform Audit منفصل وغير ظاهر للمستأجر وغير قابل للتعديل/الحذف.
- [ ] RLS/platform tables fail closed،ولا policies مباشرة لـauthenticated.
- [ ] explicit ACL revokes لكل table/function جديدة.
- [ ] direct PostgREST anon/authenticated attempts كلها denied.
- [ ] migration fresh replay/catalog/rollback plan ناجح محليًا.

### regressions والنطاق

- [ ] B3 RLS isolation يمر.
- [ ] B3.2 relationship hardening يمر.
- [ ] B4 immutable identity يمر.
- [ ] B5 Active Workspace يمر بعد تحديث behavior المعتمد.
- [ ] B6 capability enforcement يمر.
- [ ] B6.3 PostgREST ACL يمر بلا grant جديد.
- [ ] unit/integration/route/action/service suites تمر.
- [ ] `check-types`, `lint`, production `build`, و`git diff --check` تمر.
- [ ] لا hosted Supabase access أو migration apply غير مصرح.
- [ ] لا Store/Active Store/products/inventory/orders/commerce/White Label.
- [ ] لا Website Management أو unrelated redesign.

## 13. تعريف الجاهزية

أصبحت A1 وADR-003 معتمدتين ولا يوجد blocker معماري لـB1. تنفذ كل task التالية
كمجموعة صغيرة مستقلة بعد تفويضها. Sprint 2 لا يغلق حتى يثبت G1/G2 أن tenant user لا يصل إلى
Platform Admin، وأن كل Platform mutation المطلوبة مدققة، وأن ضمانات Sprint 1
بقيت كاملة.
