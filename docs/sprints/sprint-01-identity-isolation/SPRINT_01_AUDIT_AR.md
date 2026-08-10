# تدقيق Sprint 1: الهوية وعزل المستأجرين

## 1. الملخص التنفيذي

يعتمد Verix فعليًا على Supabase Auth للجلسة، لكنه يربط هوية Supabase بالسجل الداخلي `public.users` بواسطة البريد الإلكتروني في `src/server/auth/workspace.ts`. لا يوجد حقل يحفظ Supabase Auth User UUID. يختار `getAuthorizedWorkspace()` أقدم Workspace مملوك، ثم أقدم عضوية نشطة، ثم ينشئ Workspace جديدًا عند عدم العثور على نطاق. لذلك فإن تغيير البريد، أو اختلاف حالته، أو تعدد العضويات يمكن أن يغيّر الهوية أو النطاق بصورة غير صريحة.

`workspaces` هو جذر العزل، و`team_members` يحتوي عضوية فريدة لكل `(workspace_id,user_id)` بأدوار `owner|manager|employee` وحالات `active|invited|suspended`. الملكية ممثلة أيضًا في `workspaces.owner_id`، مما ينشئ مصدرين يجب إبقاؤهما متسقين.

الطبقة التطبيقية تشتق `workspaceId` من الجلسة في معظم Server Actions وتقيّد الاستعلامات به، وهي أساس قابل لإعادة الاستخدام. إلا أن Capability Matrix مركزية غير موجودة، والتنقل غير واعٍ بالصلاحيات، وعدة مجالات تسمح لكل عضو نشط بالكتابة. Website Builder والنشر متاحان حاليًا لأدوار Workspace، وهذا يتعارض صراحة مع المواصفة.

RLS يغطي الجداول الحالية بنمط عضوية Workspace، لا بنمط الدور/القدرة. الملف `src/server/db/rls.sql` خارج Drizzle journal ويستخدم مطابقة البريد مع `auth.users`. الأخطر أن `drizzle/meta/_journal.json` يسجل فقط `0000` و`0001` رغم وجود SQL ملتزم حتى `0016`؛ لذا لا توجد حاليًا أدلة على أن `drizzle-kit migrate` يستطيع إعادة بناء قاعدة جديدة كاملة. كما أن اتصال Drizzle المباشر يعتمد على دور `DATABASE_URL` غير موثق الخصائص وقد يتجاوز RLS.

## 2. مخطط التدفق الحالي

```text
Browser
  ├─ register/login/reset Server Action
  │    └─ @supabase/ssr anon client
  ├─ /auth/confirm
  │    └─ verifyOtp(token_hash,type) → session cookies
  └─ protected request
       ├─ proxy.ts: request-id + auth rate limit + host routing
       ├─ updateSession(): Supabase getUser() + cookie refresh + route redirect
       ├─ dashboard layout: requireUser()
       └─ page/action: getAuthorizedWorkspace()
            ├─ lower(auth email) → users.email exact lookup
            ├─ oldest owned workspace
            ├─ else oldest active membership
            └─ else create user/workspace/owner membership
                 → service(workspaceId, actor)
                      → Drizzle DATABASE_URL connection
```

لا تدخل قيمة Workspace موثوقة من WorkspaceSwitcher؛ المكوّن يعرض بيانات ثابتة ولا يحفظ اختيارًا.

## 3. الملفات التي تمت مراجعتها

* المصادقة: `src/server/auth/{client,session,middleware,workspace,authorize,rbac}.ts`، `src/server/actions/auth.ts`، `app/auth/confirm/route.ts`، نماذج `components/auth/*`، و`proxy.ts`.
* الهوية والنطاق: `src/server/db/schema/{tables,enums,relations}.ts`، `services/{workspace,team}.service.ts`، `actions/{workspace,team}.ts`.
* الواجهة: `app/(dashboard)/layout.tsx`، `components/dashboard/{workspace-switcher,nav-config,sidebar,sidebar-nav}.tsx` وصفحات المجالات المحمية.
* التفويض: `auth/rbac.ts` واختباراته، وجميع Server Actions، وعينات خدمات customer، lead، CRM، reservation، housekeeping، property، rental-unit، invoice، payment، website، domain، settings، team.
* قاعدة البيانات: `src/server/db/{db.ts,rls.sql}`، `drizzle.config.ts`، جميع `drizzle/0000..0016.sql`، snapshots و`meta/_journal.json`.
* التشغيل والاختبار: `package.json` الجذري و`apps/web/package.json`، `vitest.config.ts`، `.github/workflows/ci.yml`، `src/server/README.md`، `apps/web/README.md` والاختبارات الحالية.

المسارات في هذه الوثيقة نسبية إلى `apps/web` ما لم يذكر غير ذلك.

## 4. نتائج الهوية الحالية

| البند | الدليل والنتيجة |
|---|---|
| التسجيل | `signUpAction` يتحقق عبر Zod ثم يستدعي `supabase.auth.signUp` مع `full_name` وعودة إلى `/auth/confirm?next=/dashboard`. لا ينشئ سجلًا داخليًا فورًا. |
| تسجيل الدخول | `signInWithPassword` عبر anon client؛ الواجهة تنتقل إلى مسار آمن بعد النجاح. |
| تأكيد البريد | Route `app/auth/confirm/route.ts` يتحقق من OTP ويقبل فقط redirect نسبيًا عبر `safeRedirectPath`. |
| إعادة كلمة المرور | طلب الاستعادة لا يكشف وجود البريد؛ Route التأكيد ينشئ الجلسة، ثم `updateUser({password})`. |
| الجلسة | Cookies عبر `@supabase/ssr`، و`getCurrentUser` يستخدم `getUser()` الموثق خادميًا ومخزّنًا ضمن طلب React. |
| الخروج | `signOut()` ثم redirect إلى `/login`. |
| السجل الداخلي | `users.id` UUID داخلي، `email` unique case-sensitive، `full_name`، avatar، `email_verified`، timestamps وsoft delete. لا يوجد `auth_user_id`. |
| الربط | `resolveAuthorizedWorkspace` يخفض بريد Supabase ثم يبحث `eq(users.email,email)`. هذا ليس ربطًا immutable. |
| التطبيع | resolver و`inviteMember` يستخدمان `trim().toLowerCase()`؛ Auth validators لا تحول القيمة، وDB unique ليست case-insensitive. السجلات القديمة مختلطة الحالة قد لا تطابق `eq`. RLS يستخدم `lower` على الطرفين. |
| الدعوة | `inviteMember` ينشئ/يربط مستخدمًا داخليًا بالبريد ويضع العضوية `active` مباشرة. لا يرسل Supabase invite ولا يوجد token/claim/expiry. قيمة enum `invited` غير مستخدمة في هذا التدفق. |
| تغيير البريد | لا يوجد webhook أو flow يزامن بريد Supabase. بعد تغييره قد لا يجد resolver السجل القديم وينشئ user/Workspace جديدين. |
| الحذف/التعطيل | لا توجد سياسة موثقة تربط تعطيل auth user بحذف/تعليق السجل الداخلي؛ غياب جلسة صالحة يمنع التطبيق، لكن السجل والعضويات يبقيان. |
| الاختبارات | توجد اختبارات RBAC وsafe redirect وتدفقات pure أخرى، ولا توجد اختبارات resolver للهوية أو auth UUID أو email change/invite claim أو DB identity constraints. |

## 5. نتائج Workspace

* `workspaces.id` هو Tenant root؛ `owner_id` FK إلى `users`، مع slug فريد وsoft delete.
* `team_members` يربط user/workspace بقيود unique، ودور وحالة وsoft delete.
* الملكية مزدوجة: `workspaces.owner_id` وعضوية `team_members.role='owner'`. `ensureOwnerMembership` يحاول materialize العضوية لكنه لا يثبت تماثل المصدرين دائمًا.
* صفر عضويات/ملكية: يتم إنشاء Workspace وعضوية owner تلقائيًا عند أول resolver call.
* عضوية واحدة: تستخدم إذا كانت active وغير محذوفة.
* عضويات متعددة: يختار أقدم Workspace مملوك، وإلا أقدم Workspace بعضوية active؛ لا يسأل المستخدم ولا يسجل اختيارًا.
* العضوية `suspended` أو soft-deleted لا تستخدم، لكن selection غير مخزن، لذلك لا توجد آلية revocation واضحة لاختيار سابق.
* `WorkspaceSwitcher` mock بثلاثة Workspaces ثابتة؛ الضغط يغلق القائمة فقط، وCreate workspace بلا عمل.
* لا يوجد cookie/session/database preference لـ Active Workspace ولا URL contract.
* الصفحات وServer Actions تستدعي `getAuthorizedWorkspace()`، ثم تمرر `workspaceId` إلى services. الخدمات غالبًا تقبل ID خامًا وتفترض أن المستدعي فوضه.
* لا يوجد Store domain دائم؛ لا يجوز إضافته في Sprint 1.

## 6. نتائج التفويض

* الأدوات المركزية الحالية محدودة: `assertOwnerRole`، `assertManagerOrOwnerRole`، وحراس مخصصون لـ CRM/reservations/housekeeping/billing.
* Dashboard layout وmiddleware يتحققان من authentication فقط، لا capabilities.
* navigation ثابت لكل المستخدمين ويعرض Website Builder، Payments، Invoices، Team، Settings للجميع.
* Team وSettings وتحديث Business Profile owner-only على Server Action.
* Property/rental-unit/reservation/housekeeping/invoice تحتوي حراسًا أفضل في services بحسب actor.
* customer/service/booking/payment legacy actions تستدعي `getAuthorizedWorkspace` فقط؛ أي عضو active يستطيع عمليات الكتابة الموجودة.
* lead actions تسمح لكل عضو، مع بعض CRM checks عند إنشاء opportunity.
* website actions، بما فيها create/update sections وpublish/unpublish/rollback، تعتمد على العضوية فقط. بعض domain mutations owner-only وبعضها لأي عضو.
* RLS يمنح authenticated SELECT/INSERT/UPDATE/DELETE ويختبر membership فقط؛ employee يمكنه نظريًا الكتابة مباشرة عبر PostgREST ضمن Workspace حتى لو رفض التطبيق.
* النتيجة: enforcement غير متسق بين UI وroute/action/service/RLS ولا توجد capability vocabulary مركزية.

## 7. نتائج RLS والمهاجرات

* `rls.sql` ينشئ SECURITY DEFINER helpers: `current_workspace_ids` و`current_comember_ids` و`current_conversation_ids` مع `search_path=public`.
* `current_workspace_ids` يربط `auth.users` بـ `public.users` عبر البريد، ثم العضوية active.
* يمنح EXECUTE إلى `authenticated, anon`، بينما policies موجهة إلى authenticated.
* يغطي الملف الأساسي: workspaces، team_members، users، customers، services، bookings، payments، files، settings، notifications، ai_conversations، ai_messages.
* migrations اللاحقة تضيف RLS إلى sites/pages/sections/versions/domains، invoices/integrations/line_items، leads/CRM، properties/buildings/units/reservations/housekeeping.
* policies كلها تقريبًا `FOR ALL` وmembership-only؛ لا يوجد فصل read/write أو role capability.
* `rls.sql` مصرح بأنه out-of-band وليس في journal. Migration `0003` وما بعدها تعتمد على `current_workspace_ids()`، لذلك fresh bootstrap يحتاج خطوة غير ممثلة.
* `meta/_journal.json` يحتوي entry لـ `0000` و`0001` فقط، رغم التزام `0002..0016`. لا يمكن اعتبار ملفات SQL غير المسجلة قابلة للتطبيق تلقائيًا بواسطة `drizzle-kit migrate`.
* أوامر المشروع هي generate/migrate/push/studio/seed، لكن لا توجد bootstrap runbook أو DB integration CI.
* `db.ts` يتصل مباشرة عبر `DATABASE_URL`. خصائص الدور غير موثقة أو مفحوصة، وقد يكون owner/service role يتجاوز RLS؛ services تعتمد عندها على scoping اليدوي.
* `supabaseAdmin` يستخدم service-role ويتجاوز RLS؛ لم يظهر استخدام واسع له في التدفقات المفحوصة، لكن المفتاح أصل عالي الحساسية.
* الاختبارات الحالية pure؛ `schema.test.ts` يختبر بعض enums/constraints شكليًا ولا يشغل PostgreSQL أو migrations أو policies.

## 8. المخاطر الحرجة

1. **Identity takeover/misbinding عبر البريد:** البريد mutable وليس معرفًا دائمًا؛ تغيير البريد أو تعارضه قد ينشئ/يربط سجلًا غير صحيحًا.
2. **عدم قابلية إعادة بناء DB:** journal ناقص وRLS helper خارج السلسلة، لذلك fresh environment قد يفتقد schema أو policies.
3. **RLS لا يفرض الدور:** grants واسعة و`FOR ALL` membership policies تسمح لعضو منخفض الدور بتجاوز application RBAC عبر مسار Supabase مباشر.
4. **Website Builder والنشر متاحان لمستأجري Workspace:** تعارض مباشر مع نموذج Platform Admin المعتمد.

## 9. المخاطر العالية

* الاختيار الصامت لأول Workspace عند تعدد العضويات.
* إنشاء Workspace جديد تلقائيًا عند فشل identity match، فيحوّل خلل الهوية إلى بيانات جديدة بدل fail closed.
* اتصال DB قد يتجاوز RLS دون ضمانات/توثيق.
* الدعوات الداخلية تصبح active بلا claim موثق أو expiry.
* ازدواج `owner_id` ودور owner قد ينحرف.
* navigation يعرض وظائف محظورة، وصفحات كثيرة لا تفرض capability عند route boundary.
* خدمات تقبل `workspaceId` خامًا وتعتمد على صحة caller.

## 10. المخاطر المتوسطة

* unique للبريد case-sensitive مع تطبيع غير مركزي.
* لا توجد آلية واضحة لتحديث البريد، دمج الحسابات، أو تعطيل auth user.
* لا يوجد audit عام لمحاولات تغيير النطاق أو الهوية/الدعوة.
* لا توجد اختبارات cache isolation أو file-path tenancy أو session revocation.
* READMEs قديمة؛ `src/server/README.md` يصف auth/services بأنها فارغة.
* حماية route قائمة prefixes وقد تنسى route جديدًا؛ dashboard layout يوفر defense in depth داخل المجموعة فقط.

## 11. الأسس القابلة لإعادة الاستخدام

* Supabase SSR cookies و`getUser()` server validation.
* `safeRedirectPath` في callback.
* request IDs، auth rate limiting، structured logger، وإخفاء نتيجة reset request.
* `getAuthorizedWorkspace` كنقطة تجميع قابلة للاستبدال بعقد Active Workspace صريح.
* workspace-scoped service signatures وFKs وsoft deletion.
* unique membership وقواعد منع self mutation/last owner.
* حراس RBAC pure واختباراتهم، وحراس actor المخصصة للمجالات الحديثة.
* RLS helper/policy corpus الحالي كمدخل جرد، لا كمصدر نهائي.

## 12. التعارضات مع المواصفة المعتمدة

1. الربط بالبريد يخالف Immutable Supabase UUID linkage.
2. الاختيار الصامت يخالف Explicit Active Workspace.
3. Website Builder/publish/domain متاح لأدوار Workspace بينما يجب أن يبقى Platform Admin-only.
4. RLS membership-only يخالف role-aware RLS وCapability Matrix.
5. RLS/out-of-journal migrations تخالف reproducibility.
6. `CLAUDE.md` القديم يصف Website Builder بأنه core product tenant feature؛ المرجع الرسمي الجديد يحسم التعارض لصالح المواصفة.
7. لا يوجد Platform Admin boundary، لكن تنفيذه مؤجل Sprint 2؛ Sprint 1 يوثق المنع ولا ينشئ الدور.

## 13. قرارات مطلوبة قبل التنفيذ

* اعتماد ADR-001: مكان `auth_user_id`، uniqueness، backfill، وحالات التعارض.
* اعتماد منع auto-merge وسياسة الحسابات المتعارضة.
* اعتماد ADR-002 واختيار persistence لـ Active Workspace.
* تحديد ما إذا كان أول Workspace واحد يختار صراحة أم يسمح default موثقًا.
* اعتماد Capability Matrix، وبخاصة صلاحيات manager/employee في legacy domains.
* تحديد DB role الفعلي للتطبيق وPostgREST roles.
* اعتماد المصدر canonical للمهاجرات وRLS وكيفية إصلاح journal دون تعريض production.
* اعتماد test PostgreSQL lifecycle ونسخ احتياطي/staging gate.

## 14. حدود Sprint 1 الموصى بها

يقتصر Sprint 1 على اعتماد ADRs والخطط، تجهيز اختبار PostgreSQL قابل للإتلاف، ثم تنفيذ immutable identity وActive Workspace وcapability enforcement وRLS sequencing المعتمد. Active Store يبقى عقدًا فقط. لا يتم إنشاء Platform Admin أو Store schema أو Commerce/API/White Label، ولا يعاد تصميم Website Builder.
