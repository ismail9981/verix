# نموذج تهديد Platform Admin — Sprint 2

## 1. النطاق والأصول

يغطي هذا النموذج الحد الجديد المعتمد معماريًا داخل `apps/web`: هوية Platform Admin،
`/admin`، أوامر Workspace lifecycle، وPlatform Audit. لا يغطي Store Domain أو
Website Management أو إدارة Platform Admins عبر UI.

الأصول المحمية:

1. صلاحية الإدارة المركزية.
2. قائمة Workspaces وتفاصيلها العابرة للمستأجرين.
3. سلامة `owner_id` وعضوية المالك.
4. حالة Workspace وتأثير التعليق/التفعيل.
5. سرية وسلامة Platform Audit.
6. ضمانات Sprint 1: immutable identity، Active Workspace، capabilities، RLS،
   وعزل PostgREST.

## 2. حدود الثقة

```text
Browser (untrusted)
  -> Supabase Auth cookies
  -> Next proxy (authentication convenience only)
  -> Platform route layout / Server Action (authoritative boundary)
  -> opaque PlatformActorContext + capability assertion
  -> platform service (re-assert capability and target invariants)
  -> Drizzle/server PostgreSQL connection
  -> platform tables + Workspace tables + append-only audit
```

- كل form fields، URL params، hidden inputs، role labels، وserialized client
  state غير موثوقة.
- `auth.getUser().id` هو هوية الجلسة الموثقة، لكن لا يمنح Platform access وحده.
- `platform_admins` server-side هو مصدر Platform role/status.
- signed Active Workspace cookie ليس له أي دور في Platform authorization.
- middleware لا يكفي؛ layout/action/service هي الحواجز authoritative.

## 3. ثوابت الأمان

1. `Workspace owner != Platform Admin` دائمًا.
2. Platform identity مشتقة من immutable Supabase UUID وسجل منصة active فقط.
3. unknown/inactive role أو capability أو identity يفشل مغلقًا.
4. Platform context لا يُنشأ من client ولا يعبر React serialization.
5. لا Platform mutation بلا تحقق action وservice وبلا audit نجاح ذري.
6. لا Workspace ينشأ بلا owner linked، owner membership active، وaudit داخل
   transaction واحدة.
7. التعليق لا يحذف memberships أوبيانات tenant؛لكنه يوقف استعمال نطاق Workspace
   المصادق في الطلب التالي ولا يغير public website/forms في Sprint 2.
8. لا direct PostgREST table/RPC path لـ`anon` أو`authenticated`.
9. Platform Audit منفصل عن tenant activity وغير قابل للتحديث أو الحذف عبر
   application API.
10. لا يوجد self-promotion أو authorization بالبريد/metadata.

## 4. مصفوفة التهديدات والضوابط

| التهديد | سيناريو الهجوم | الضبط المقترح | استراتيجية التحقق |
|---|---|---|---|
| Workspace owner ينتحل Platform Admin | owner يزور `/admin` أو يرسل action مباشرة | resolver يبحث عن `auth_user_id` في `platform_admins` active؛ لا يفحص `team_members` | route/action tests بمالك حقيقي، وتأكيد 404/denial وصفر writes |
| tenant role escalation | manager/employee يغير role في payload أو cookie | Platform role لا يقبل من client؛ registry منصة منفصل | payload fuzzing لكل Workspace role؛ unknown roles deny |
| forged client platform state | Client Component يرسل `role=super_admin` أو actor ID | context opaque ومشتق خادميًا بعد `getUser()`؛ لا يمر إلى العميل | invoke action مع حقول إضافية ومع actor UUID مسروق؛ لا أثر |
| direct URL access | مستخدم مصادق يتجاوز nav | `(platform-admin)/admin/layout.tsx` ينفذ server gate قبل render | اختبارات `/admin`, list, detail, create لكل actor |
| direct Server Action invocation | استدعاء action endpoint بلا تحميل الصفحة | كل action يبدأ `requirePlatformCapability()` قبل parsing/service | malicious action tests، ومراقبة أن validator/service غير مستدعيين عند المنع |
| direct service misuse | مسار خادمي جديد يستدعي service بلا gate | كل public platform service يطلب opaque context ويعيد assertion للقدرة | unit tests تستعمل context بقدرة ناقصة/role غير معروف؛ fail before query |
| horizontal Workspace modification | Super/tenant يبدل target ID أو slug للوصول لمستأجر آخر | Platform action يملك global capability صريحة؛ tenant action لا يملك platform context؛ service يقيد target ID ويعيد 404 generic | target A/B integration tests، وtenant ID swapping |
| تعيين مالك خاطئ من Workspace آخر | استعمال `team_member.id` من Workspace آخر كمالك | الإدخال `users.id` فقط؛ إعادة تحقق user linked/non-deleted؛ إنشاء membership جديدة للـWorkspace الجديد؛ لا نسخ membership | cross-workspace member fixture، wrong ID/not linked/deleted tests |
| owner assignment بالبريد | email متغير/متعارض يمنح ownership | لا email authorization؛ candidate هو internal UUID مرتبط بـAuth UUID ثابت | email-change/duplicate-case tests؛ لا fallback بالبريد |
| duplicate owner membership | retry/concurrency ينشئ عضويتين | unique `(workspace_id,user_id)` + transaction + idempotency key | طلبان متزامنان بنفس المفتاح؛ Workspace وmembership وaudit واحدة |
| provisioning جزئي | Workspace ينشأ ثم تفشل العضوية/audit | transaction واحدة لكل rows الإلزامية؛ لا post-commit domain provisioning داخل Sprint 2 | inject failure عند membership/audit وتأكيد rollback كامل |
| تعليق غير مصرح | owner/manager/Support يرسل suspend | capability `platform.workspaces.suspend` لـSuper فقط في Sprint 2 | matrix/action/service tests لكل actor |
| reactivation غير مصرح | actor يرسل activate أو يغير status مباشرة | capability منفصلة + server DB only + Data API ACL | tests + authenticated PostgREST PATCH denied |
| lost update/status race | suspend وactivate متزامنان | row lock أو atomic expected-status predicate؛ idempotency key؛ transition validation | concurrency test وstale expected-status test |
| Active Workspace stale بعد التعليق | cookie موقعة بقيت صالحة | active resolver و`current_workspace_ids()` يفحصان `workspaces.status='active'` كل طلب | تعليق workspace محدد ثم إعادة استعمال cookie/JWT؛ denial في الطلب التالي |
| انتقال صامت لمستأجر آخر | بعد تعليق selected Workspace يتحول المستخدم تلقائيًا لعضوية أخرى | selection الصريح الملغى ينتج invalid/selection-required؛ لا fallback أثناء mutation | multi-membership suspension test |
| suspended user يستمر عبر service | service مصادق يستعمل workspace ID قديمًا | tenant actions تشتق context من resolver وRLS helper يستبعد Workspace المعلقة | direct page/action/service وRLS integration tests |
| audit tampering | actor يعدل/يحذف event لإخفاء action | جدول append-only بلا update/delete API؛ trigger يمنعها؛ ACL deny؛ لا soft delete | SQL integration تحت runtime role وPostgREST role؛ update/delete denied |
| audit omission | mutation تنجح بلا event | success event في transaction نفسها؛ failure rolls back domain state | fault injection وتأكيد equivalence بين state وsuccess audit |
| audit data leakage | tenant يقرأ أسماء Workspaces/actors/metadata | جدول منفصل، RLS deny-all، ACL deny، لا tenant route/service/export | owner/manager/employee/anon SELECT عبر PostgREST وSQL role denied |
| audit secret leakage | metadata تحتوي token/email كامل/request body | allowlist metadata، UUID/request ID، reason codes؛ لا raw payload/secrets | schema/service unit tests + snapshot redaction assertions |
| self-promotion | مستخدم ينشئ/يعدل `platform_admins` أو metadata | لا admin CRUD في Sprint 2؛ explicit bootstrap runbook بـAuth UUID؛ ACL/RLS deny | INSERT/UPDATE PostgREST denied؛ no action endpoint; metadata test |
| Support Admin overgrant | role مستقبلي يرث كل صلاحيات Super | mapping صريح `support_admin: []` في Sprint 2 | matrix asserts zero capabilities وكل routes/actions denied |
| leaked admin state إلى tenant UI | shared nav أو hydration payload يكشف admin role | shell/nav منفصلان؛ client يحصل safe booleans اللازمة فقط؛ لا context/actor IDs | RSC payload/component tests، tenant nav snapshot |
| confused deputy | tenant action يستدعي platform service بمعرف من tenant context | نوع context opaque ذو runtime brand؛ registries/types منفصلة؛ لا conversion helper | compile-time tests حيث ممكن + runtime forged-object rejection |
| stale authorization بعد revocation | admin session/cache يستمر بعد status suspension | resolver query per request؛ React cache request-scoped فقط؛ mutation يعيد resolver عند invocation | revoke between requests ثم route/action deny؛ لا long-lived global cache |
| session fixation/redirect | login redirect يدفع admin/tenant لمسار غير مسموح | `safe-redirect` + destination authorization؛ layout يعيد التحقق | external/protocol-relative redirect tests + unauthorized `/admin` redirect test |
| hosted/client Supabase bypass | JWT ينفذ CRUD مباشرة | B6.3 ACL يبقى؛ كل جداول Sprint 2 تسحب privileges صراحة؛ no public RPC | local Supabase REST tests للـanon/authenticated بكل الجداول/functions الجديدة |
| RLS policy يعرض Platform tables | policy خاطئة تربطها بـWorkspace | RLS enabled دون policies لـapplication roles، ولا `workspace_id` مزيف | catalog assertions: enabled, zero permissive policies, ACL deny |
| privileged DB confused deputy | generic server route يستعمل `DATABASE_URL` وينفذ بلا auth | حصر platform writes في modules server-only؛ opaque actor/assertions؛ code review inventory | import/entry-point audit وservice tests؛ فصل runtime role خطر لاحق |
| denial via suspension | Super Admin يعلق Workspace بالخطأ أو retry عكسي | confirmation، reason إلزامي، row lock، حالة واضحة، activation عكسية، audit | UI/action validation + lifecycle integration tests |
| public surface shutdown غير مقصود | status filter جديد يوقف renderer أوcontact form رغم غياب هذا المطلب | لا يربط Sprint 2 public renderer/forms بـWorkspace suspension؛Website shutdown قرار لاحق | renderer وcontact regression لموقع منشور مع Workspace suspended |

## 5. سلوك lockout المتوقع

| actor/state | `/admin` | Platform Action | Platform Service | Workspace dashboard |
|---|---|---|---|---|
| unauthenticated | redirect آمن إلى login | authentication denial | لا context | redirect login |
| authenticated بلا Platform row | not-found/deny | deny قبل validation | لا context | حسب عضوياته فقط |
| Workspace owner | not-found/deny | deny | forged context مرفوض | مسموح ضمن Workspace active وقدراته |
| manager | not-found/deny | deny | مرفوض | حسب capabilities |
| employee | not-found/deny | deny | مرفوض | حسب capabilities |
| no-membership user | not-found/deny | deny | مرفوض | no-access؛ لا auto Workspace |
| Support Admin المحجوز | deny كامل لكل `/admin` routes | deny لكل mutations | صفر capabilities | فقط إن كان Workspace member فعليًا في سياق tenant المستقل |
| active Super Admin | حسب platform capabilities | مسموح حسب capability | مسموح بسياق opaque | لا Workspace access تلقائيًا |
| suspended/revoked Platform Admin | deny في الطلب التالي | deny | context القديم لا يعاد استخدامه بين الطلبات | عضوياته الفعلية فقط إن وجدت |
| عضو Workspace معلقة | deny إلا إذا له Platform row مستقل active | deny إلا بالهوية المستقلة | tenant context غير صالح | Workspace معلقة غير متاحة |

عدم وجود navigation ليس control. لا يُرجع 403 مفصل يكشف وجود Platform route
للمستخدم المصادق غير المصرح؛ يوصى بـ`notFound()` للصفحات، وtyped generic error
للـactions، و401/404 مناسب للـRoute Handlers المستقبلية.

## 6. Platform Audit وحالات الفشل

### 6.1 success

تسجل `workspace.created`, `workspace.owner_assigned`, `workspace.suspended`,
و`workspace.activated` داخل transaction نفسها مع mutation. إنشاء Workspace ينتج
حدثين لأن creation وowner assignment حقيقتان مستقلتان مطلوبتان في المواصفة.

### 6.2 failure/denial

- فشل domain بعد حل Platform actor: يسجل event منفصلًا `outcome='failure'`
  best-effort بعد rollback، مع `error_code` allowlisted وrequest ID؛ لا raw error.
- denial قبل وجود Platform actor: لا يمنح المهاجم write إلى audit. يسجل structured
  security log فقط، ويمكن لاحقًا ingestion إلى SIEM.
- لا يجوز أن يحوّل فشل تسجيل failure event عملية فاشلة أصلًا إلى نجاح، ولا أن
  يسمح بنجاح mutation إذا فشل success audit.

## 7. المخاطر المتبقية

1. اتصال `DATABASE_URL` المميز يمكنه تجاوز RLS وقد يستطيع مالك قاعدة البيانات
   تعطيل trigger؛ فصل runtime/migration roles هو التحسين الأقوى لاحقًا.
2. أول Super Admin يحتاج إجراء bootstrap تشغيلي قوي؛ compromise في هذا الإجراء
   يساوي compromise للمنصة.
3. Supabase session revocation الفوري مرتبط بسلوك Auth token؛ Platform status
   يعوض ذلك لأن كل طلب يعيد فحص جدول المنصة.
4. audit داخل قاعدة التطبيق ليس WORM خارجيًا؛ export/retention خارجيان خارج
   Sprint 2.
5. حسم A1 إبقاء public site/forms بلا تغيير أثناء التعليق؛أي operational shutdown
   مستقبلي يحتاج Platform Website Management threat-model update مستقلًا.

## 8. بوابة قبول أمنية

- [ ] كل actor غير Super Admin يفشل في كل route/action/service حساس.
- [ ] Support Admin المحجوز لا يرث أي capability.
- [ ] لا client field يؤثر في actor role/capabilities.
- [ ] direct action invocation يفشل قبل parsing أو query.
- [ ] create + owner + success audit ذرية وidempotent.
- [ ] suspension تبطل Active Workspace في الطلب التالي بلا tenant fallback.
- [ ] suspension لا تدخل shutdown عرضيًا على public rendering/forms.
- [ ] Platform Audit غير ظاهر ولا قابل للتعديل لـtenant/anon/authenticated.
- [ ] كل جداول/functions Sprint 2 محمية بـACL regression.
- [ ] B3/B3.2/B4/B5/B6/B6.3 regressions تمر دون إضعاف.
