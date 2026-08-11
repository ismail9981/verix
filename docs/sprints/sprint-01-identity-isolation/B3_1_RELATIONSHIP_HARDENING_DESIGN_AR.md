# B3.1 — تصميم تقوية العلاقات العابرة للـWorkspace

التاريخ: 2026-08-11  
الحالة: **Design complete — approval required**  
السبرنت: Sprint 1 — Identity and Tenant Isolation Hardening  
نوع العمل: تصميم فقط؛ لا Migration أو SQL تنفيذي أو تغيير قاعدة بيانات.

## 1. Executive Summary

راجع هذا التصميم كل مفاتيح schema الخارجية البالغ عددها 76. منها 27 علاقة مباشرة من جدول tenant إلى `workspaces(id)`، و40 علاقة بين جدولين يحمل كلاهما `workspace_id`، وثماني علاقات هوية/عضوية، وعلاقة child مشتقة النطاق بالكامل من parent.

نتيجة الجرد أوسع من B3: العلاقات الست المثبتة حياً ليست حالات منفردة، بل أمثلة من نمط عام. من العلاقات الأربعين بين جدولين tenant-scoped، ثلاث فقط تملك منعاً عاماً صالحاً على مستوى قاعدة البيانات؛ أما 37 علاقة فلا تملك قيداً تصريحياً يفرض مساواة Workspace. ست من هذه أثبتها B3 حياً، و31 علاقة إضافية تحمل الخلل البنيوي نفسه وتحتاج regression proof في B3.2.

التوصية الوحيدة هي Migration forward-only مرشحة باسم `0003_workspace_relationship_hardening` بعد canonical `0002`. تسبقها بوابة audit read-only بصفر تعارضات، ثم تضيف مفاتيح مركبة `(workspace_id, foreign_id) → (workspace_id, id)` لجميع العلاقات الأربعين، مع unique pairs على 17 parent tables. تبقى triggers المالية الحالية، وتبقى service validations كدفاع إضافي. لا تغير المهمة الأدوار أو الهوية أو Active Workspace.

## 2. B3 Evidence

- البصمة canonical: `b84dd485f280a6fca69350787ea6bf9f658d4a84c247803c05bf51d6a5c09ee3`.
- 30/30 tables مع RLS، 30 policy من نمط `FOR ALL TO authenticated`، و0 FORCE RLS.
- authenticated actor ليس superuser ولا BYPASSRLS.
- direct SELECT/INSERT/UPDATE/reassignment/DELETE عبر Workspace مرفوضة.
- ست علاقات cross-workspace نجحت: booking/customer، booking/service، domain/site، building/property، reservation/unit، reservation/customer.
- invoice/reservation، line-item/invoice، وinvoice-linked payment/invoice رفضتها triggers الحالية.
- كل fixtures تراجعت ولم تترك بيانات.

## 3. Full Relationship Inventory

### 3.1 العلاقات المباشرة إلى Tenant root

كل علاقة أدناه هي `child.workspace_id → workspaces.id`. يحمل child `workspace_id` ويحمل parent هوية tenant نفسها؛ FK الحالي يضمن النطاق مباشرة. RLS موجود على الطرفين. التصنيف لكل صف: `SAFE_BY_CONSTRAINT`.

| # | Child | FK | Parent | Service validation |
|---:|---|---|---|---|
| 1 | ai_conversations | workspace_id | workspaces.id | scope من caller |
| 2 | bookings | workspace_id | workspaces.id | نعم |
| 3 | buildings | workspace_id | workspaces.id | نعم |
| 4 | crm_activities | workspace_id | workspaces.id | نعم |
| 5 | crm_opportunities | workspace_id | workspaces.id | نعم |
| 6 | crm_pipelines | workspace_id | workspaces.id | نعم |
| 7 | crm_stages | workspace_id | workspaces.id | نعم |
| 8 | customers | workspace_id | workspaces.id | نعم |
| 9 | files | workspace_id | workspaces.id | scope من caller |
| 10 | housekeeping_tasks | workspace_id | workspaces.id | نعم |
| 11 | integrations | workspace_id | workspaces.id | نعم |
| 12 | invoice_line_items | workspace_id | workspaces.id | نعم |
| 13 | invoices | workspace_id | workspaces.id | نعم |
| 14 | leads | workspace_id | workspaces.id | resolver/service |
| 15 | notifications | workspace_id | workspaces.id | scope من caller |
| 16 | page_sections | workspace_id | workspaces.id | نعم |
| 17 | pages | workspace_id | workspaces.id | نعم |
| 18 | payments | workspace_id | workspaces.id | نعم |
| 19 | properties | workspace_id | workspaces.id | نعم |
| 20 | rental_units | workspace_id | workspaces.id | نعم |
| 21 | reservations | workspace_id | workspaces.id | نعم |
| 22 | services | workspace_id | workspaces.id | نعم |
| 23 | settings | workspace_id | workspaces.id | نعم |
| 24 | site_domains | workspace_id | workspaces.id | نعم |
| 25 | site_versions | workspace_id | workspaces.id | publishing service |
| 26 | sites | workspace_id | workspaces.id | نعم |
| 27 | team_members | workspace_id | workspaces.id | team service |

### 3.2 العلاقات بين جدولين يحملان workspace_id

كل child وparent أدناه يحمل `workspace_id` مباشرة. FK الحالي أحادي على عمود ID ولا يضمن مساواة النطاق. RLS membership-only موجود على الطرفين، لكن FK checks لا تمثل same-workspace invariant. `SV` تعني أن service الحالي يتحقق أو يشتق المرجع؛ لا تجعل العلاقة آمنة أمام direct authenticated SQL.

| # | Child → Parent | FK | DB enforcement الحالي | Service | التصنيف |
|---:|---|---|---|---|---|
| 1 | bookings → customers | customer_id | FK existence فقط | SV صريح | VULNERABLE — مثبت B3 |
| 2 | bookings → services | service_id | FK existence فقط | SV صريح | VULNERABLE — مثبت B3 |
| 3 | bookings → team_members | staff_id | FK existence فقط | لا write path واضح | VULNERABLE |
| 4 | buildings → properties | property_id | FK existence فقط | SV + lock | VULNERABLE — مثبت B3 |
| 5 | crm_activities → crm_opportunities | opportunity_id | FK existence فقط | SV صريح | VULNERABLE |
| 6 | crm_opportunities → customers | customer_id | FK existence فقط | جزئي/مشتق | VULNERABLE |
| 7 | crm_opportunities → leads | lead_id | FK existence فقط | SV صريح | VULNERABLE |
| 8 | crm_opportunities → crm_pipelines | pipeline_id | FK existence فقط | SV | VULNERABLE |
| 9 | crm_opportunities → crm_stages | stage_id | FK existence فقط | SV | VULNERABLE |
| 10 | crm_stages → crm_pipelines | pipeline_id | FK existence فقط | SV | VULNERABLE |
| 11 | housekeeping_tasks → team_members | assigned_to | FK existence فقط | SV active member | VULNERABLE |
| 12 | housekeeping_tasks → buildings | building_id | FK existence فقط | مشتق من unit | VULNERABLE |
| 13 | housekeeping_tasks → team_members | completed_by | FK existence فقط | مشتق من actor | VULNERABLE |
| 14 | housekeeping_tasks → team_members | created_by | FK existence فقط | مشتق من actor | VULNERABLE |
| 15 | housekeeping_tasks → properties | property_id | FK existence فقط | مشتق من unit | VULNERABLE |
| 16 | housekeeping_tasks → reservations | reservation_id | FK existence فقط | SV workspace+unit | VULNERABLE |
| 17 | housekeeping_tasks → rental_units | unit_id | FK existence فقط | SV/derived | VULNERABLE |
| 18 | invoice_line_items → invoices | invoice_id | trigger يطابق Workspace | SV | SAFE_BY_DATABASE_TRIGGER |
| 19 | invoices → customers | customer_id | trigger فقط عند reservation موجودة | جزئي | VULNERABLE |
| 20 | invoices → reservations | reservation_id | trigger يطابق Workspace | SV | SAFE_BY_DATABASE_TRIGGER |
| 21 | invoices → team_members | voided_by | FK existence فقط | actor مشتق | VULNERABLE |
| 22 | invoices → team_members | written_off_by | FK existence فقط | actor مشتق | VULNERABLE |
| 23 | leads → customers | converted_customer_id | FK existence فقط | SV | VULNERABLE |
| 24 | leads → sites | site_id | FK existence فقط | site resolver | VULNERABLE |
| 25 | page_sections → pages | page_id | FK existence فقط | SV | VULNERABLE |
| 26 | page_sections → sites | site_id | FK existence فقط | مشتق/متحقق | VULNERABLE |
| 27 | pages → sites | site_id | FK existence فقط | SV | VULNERABLE |
| 28 | payments → team_members | actor_team_member_id | FK existence فقط | actor مشتق | VULNERABLE |
| 29 | payments → bookings | booking_id | FK existence فقط | SV | VULNERABLE |
| 30 | payments → customers | customer_id | FK existence فقط | مشتق جزئياً | VULNERABLE |
| 31 | payments → invoices | invoice_id | trigger يطابق Workspace | SV | SAFE_BY_DATABASE_TRIGGER |
| 32 | payments → payments | refunded_payment_id | trigger يحمي invoice path فقط | SV invoice path | VULNERABLE للـbooking path |
| 33 | rental_units → buildings | building_id | FK existence فقط | SV + lock | VULNERABLE |
| 34 | rental_units → properties | property_id | FK existence فقط | SV | VULNERABLE |
| 35 | reservations → customers | customer_id | FK existence فقط | SV صريح | VULNERABLE — مثبت B3 |
| 36 | reservations → team_members | staff_id | FK existence فقط | SV active member | VULNERABLE |
| 37 | reservations → rental_units | unit_id | FK existence فقط | SV صريح | VULNERABLE — مثبت B3 |
| 38 | site_domains → sites | site_id | FK existence فقط | SV صريح | VULNERABLE — مثبت B3 |
| 39 | site_versions → sites | site_id | FK existence فقط | publishing service | VULNERABLE |
| 40 | sites → site_versions | published_version_id | FK existence فقط | publishing service | VULNERABLE |

الخلاصة: 3 `SAFE_BY_DATABASE_TRIGGER` و37 `VULNERABLE` على مستوى DB. وجود SV يسجل defense in depth فقط.

### 3.3 العلاقات المشتقة والهوية

| # | Child → Parent | FK/ownership | الوضع | التصنيف |
|---:|---|---|---|---|
| 1 | ai_messages → ai_conversations | conversation_id؛ child بلا workspace_id | النطاق مشتق بالكامل من parent؛ RLS يستخدم conversation helper | SAFE_BY_CONSTRAINT + SAFE_BY_RLS |
| 2 | ai_conversations → users | user_id؛ user global | لا قيد membership-at-write | SERVICE_LAYER_ONLY / authorization risk |
| 3 | crm_activities → users | actor_user_id | actor مشتق غالباً؛ لا DB membership invariant | SERVICE_LAYER_ONLY |
| 4 | crm_opportunities → users | assigned_to_user_id | لا DB membership invariant | VULNERABLE authorization linkage |
| 5 | files → users | uploaded_by_id | لا DB membership invariant | UNCERTAIN lifecycle semantics |
| 6 | notifications → users | user_id | لا DB membership invariant | VULNERABLE authorization linkage |
| 7 | site_versions → users | created_by | actor مشتق؛ لا DB membership invariant | SERVICE_LAYER_ONLY |
| 8 | team_members → users | user_id | العلاقة نفسها تنشئ membership | NOT_TENANT_SCOPED؛ capability-sensitive |
| 9 | workspaces → users | owner_id | pointer ملكية بلا تطابق إلزامي مع membership | UNCERTAIN حتى قرار invariant |

## 4. Confirmed Vulnerable Paths

الأشكال الفعلية كلها مباشرة كما افترض B3:

- `bookings.workspace_id` مقابل `customers.workspace_id` عبر `customer_id`.
- `bookings.workspace_id` مقابل `services.workspace_id` عبر `service_id`.
- `site_domains.workspace_id` مقابل `sites.workspace_id` عبر `site_id`; Site يحمل `workspace_id` مباشرة ولا حاجة لسلسلة غير مباشرة.
- `buildings.workspace_id` مقابل `properties.workspace_id` عبر `property_id`.
- `reservations.workspace_id` مقابل `rental_units.workspace_id` عبر `unit_id`. كما يجب أن يطابق unit نفسه property/building عبر قيوده الجديدة.
- `reservations.workspace_id` مقابل `customers.workspace_id` عبر `customer_id`.

إضافة إلى ذلك، كشف الجرد 31 علاقة direct/direct مكافئة بنيوياً وغير محمية بقيد عام. هذه findings design-level وليست ادعاء live exploit لكل صف؛ B3.2 يجب أن يحولها إلى regression cases قبل قبول migration.

## 5. Database Enforcement Options

### Composite foreign keys

الآلية الموصى بها. يضاف parent key فريد `(workspace_id,id)`، ثم FK مركب من child. هي declarative، race-safe، تعمل مع direct SQL وبصرف النظر عن RLS/bypass، وتحمي INSERT وUPDATE معاً. كون `id` PK عالمياً يجعل unique pair زائداً للفردية لكنه ضروري كـreferenced key ويصرح invariant بوضوح.

للـnullable FK مع `ON DELETE SET NULL` يجب أن يكون action المستقبلي `SET NULL (foreign_id)` فقط، لا `workspace_id`. PostgreSQL 17 يدعم column list؛ يجب إثبات SQL وDrizzle/catalog representation في prototype. لا يسمح بإسقاط lifecycle semantics الحالية.

### Constraint triggers

تستطيع lookup parent ورفض mismatch، وتناسب invariants متعددة الأعمدة مثل housekeeping unit/property/building. لكنها تزيد function/owner/search_path/ACL وتعقيد race/locking، ويمكن أن تتأثر بـRLS إن كانت invoker أو تصبح سطحاً privileged إن كانت definer. تستخدم فقط إذا تعذر تمثيل composite FK آمن، وليس الخيار الافتراضي.

### CHECK constraints

غير صالحة لعلاقة cross-row؛ PostgreSQL CHECK لا ينبغي أن يعتمد على subquery/صف parent. تصلح فقط لمقارنة أعمدة داخل الصف ولا تحل المطلوب.

### RLS WITH CHECK

يمكنها إضافة `EXISTS` على parent لكنها لا تحمي owner/service/migration BYPASS، وتكرر joins في كل write policy، وتتداخل مع role redesign المقبل. RLS الحالية تتحقق من child.workspace_id فقط. لذلك هي دفاع إضافي محتمل وليست invariant database كافياً.

### Service validation

مفيدة لرسالة خطأ domain-friendly، والتحقق من active/deleted/status، لكنها ليست race-safe ولا تحمي direct authenticated SQL. تبقى ولا تعتبر enforcement النهائي.

## 6. Recommended Enforcement Per Relationship

### العلاقات الست المثبتة

| العلاقة | الآلية الموصى بها |
|---|---|
| Booking → Customer | composite FK `(workspace_id,customer_id)` → `customers(workspace_id,id)`؛ إبقاء `assertRefsInWorkspace` |
| Booking → Service | composite FK `(workspace_id,service_id)` → `services(workspace_id,id)`؛ إبقاء service check |
| SiteDomain → Site | composite FK `(workspace_id,site_id)` → `sites(workspace_id,id)`؛ إبقاء `assertSiteInWorkspace` |
| Building → Property | composite FK `(workspace_id,property_id)` → `properties(workspace_id,id)`؛ إبقاء lock/check |
| Reservation → Unit | composite FK `(workspace_id,unit_id)` → `rental_units(workspace_id,id)`؛ وتطبيق القيود نفسها داخل hierarchy |
| Reservation → Customer | composite FK `(workspace_id,customer_id)` → `customers(workspace_id,id)` |

### النمط الكامل

لا يوصى بإصلاح الست فقط وترك 31 نسخة مكافئة. تضيف B3.2 composite keys لكل العلاقات الأربعين في قسم 3.2. تبقى triggers الثلاثة لأنها تفرض أيضاً قواعد مالية أوسع. العلاقات إلى users تحتاج design منفصل لعمر membership؛ لا تدخل migration العلائقية الأولى بلا قرار.

Parent tables المطلوبة لمفاتيح `(workspace_id,id)` وعددها 17: bookings، buildings، crm_opportunities، crm_pipelines، crm_stages، customers، invoices، leads، pages، payments، properties، rental_units، reservations، services، site_versions، sites، team_members.

## 7. Existing Data Preflight Design

لكل علاقة direct/direct ينفذ audit read-only بالشكل المفاهيمي:

```sql
select count(*)
from child c
join parent p on p.id = c.foreign_id
where c.foreign_id is not null
  and c.workspace_id is distinct from p.workspace_id;
```

القواعد:

1. التقرير يعرض relation name وcount فقط افتراضياً؛ IDs تذهب إلى artifact مقيد عند الحاجة ولا يطبع PII.
2. شرط البدء: صفر mismatches في العلاقات الأربعين.
3. orphan لا يفترض أنه ممكن مع FK validated، لكنه يفحص منفصلاً ويصنف `missing_parent`.
4. التصنيفات: `cross_workspace_link`, `missing_parent`, `ownership_membership_conflict`, و`actor_membership_missing` للمرحلة اللاحقة.
5. أي count غير صفر يمنع migration؛ لا delete أو reassignment أو اختيار parent تلقائي.
6. الإصلاح الآلي مرفوض لأن workspace الصحيح قرار بيانات/تدقيق. reconciliation لكل صف يحتاج owner/domain approval وbackup ثم إعادة audit.
7. migration نفسها تعيد preflight داخل transaction قبل DDL كي لا تعتمد على تقرير stale.
8. تضاف constraints كـ`NOT VALID` إن كان lock/volume يستدعي ذلك؛ تمنع writes الجديدة فوراً، ثم `VALIDATE CONSTRAINT` فقط بعد صفر conflicts. لا يعلن النجاح قبل validation الكامل.

## 8. Role-equivalence Decision

تساوي owner/manager/employee داخل Workspace ليس direct tenant-isolation escape؛ هو capability/least-privilege deficiency عالية الخطورة داخل tenant. قرار B3.1: لا تغير role policies أو grants. إصلاح العلاقات مستقل عن الأدوار وينطبق على كل role وعلى BYPASS connections أيضاً. role differentiation يؤجل إلى Capability Matrix/E4 ولا يخلط مع B3.2.

## 9. Ownership Invariant Decision

التوصية لـSprint 1: **both must agree** مع `workspaces.owner_id` بوصفه pointer authoritative، وعضوية واحدة materialized active/non-deleted بدور owner للمستخدم نفسه كي يعمل RLS.

الثوابت المطلوبة:

- exactly one owner-role membership لكل Workspace في v1.
- `owner_membership.user_id = workspaces.owner_id`.
- لا suspend/delete/soft-delete لعضوية المالك قبل transfer ناجح.
- transfer transaction تقفل Workspace، تنشئ/تفعّل owner membership الجديدة، تحدث `owner_id`، وتخفض/تعالج القديمة وفق قرار product، ثم تتحقق من invariant.
- onboarding ينشئ Workspace والعضوية المتطابقة في transaction واحدة.
- orphaned `owner_id` يمنعه FK الحالي، لكن اختلاف الدور/الحالة يحتاج audit/enforcement جديداً.

لا يوصى بحذف أحد التمثيلين الآن: pointer مفيد لملكية domain، وmembership ضرورية لـRLS. أي دعم multiple owners مستقبلاً يحتاج تحديث المواصفة؛ لا يفترضه B3.1. enforcement التفصيلي للملكية مهمة منفصلة عن migration relationships لأن lifecycle/transfer يحتاج قراراً تطبيقياً واختبارات.

## 10. FORCE RLS Decision

القرار: **DEFER pending runtime-role separation**.

تمكين FORCE الآن سيكسر التطبيق المحتمل: `db.ts` يستخدم `DATABASE_URL` واحداً بلا claim switching، وlocal equivalent هو `postgres` مالك/BYPASS. إذا أصبح هذا الاتصال subject to RLS من دون `auth.uid()` transaction context فستعود queries tenant-facing بصفر صفوف أو تفشل. كما يجب ألا تخضع migration/admin jobs للدور نفسه.

لا يعني التأجيل قبول الاعتماد الدائم على bypass. الشرط قبل FORCE:

1. فصل `DATABASE_MIGRATION_URL` عن `DATABASE_RUNTIME_URL`.
2. runtime role: NOLOGIN/NOSUPERUSER/NOBYPASSRLS أو login محمي، ليس مالك الجداول، وبأقل grants.
3. عقد موثق لتمرير auth identity/tenant context لكل transaction أو إبقاء service-only backend role مع guards مثبتة؛ لا claims مشتركة على pool.
4. اختبار pooling يثبت `SET LOCAL` وعدم تسرب claims بين requests.
5. migration/background/admin roles مستقلة ومحددة.
6. startup/predeploy role probe يسجل الاسم والخصائص بلا credentials ويرفض drift غير المعتمد.

## 11. Runtime Database Role Findings

- repository يقرأ URL واحدة من `DATABASE_URL` وينشئ postgres.js pool؛ لا يفصل migration/runtime.
- لا يسجل code خصائص الدور عند startup.
- local authoritative role `postgres` ليس superuser لكنه `BYPASSRLS` ويملك الجداول.
- Drizzle server queries لا تضبط `role authenticated` أو JWT claims؛ normal service queries تعتمد عملياً على privileged connection ثم scoping يدوي.
- `prepare:false` يدعم transaction pooler، لكن أي claim switching مستقبلي يجب أن يكون transaction-local؛ session state غير مقبول مع pooling.
- لا دليل repository يسمح باستنتاج role production؛ production لم يُفحص ولا يجوز افتراضه.

## 12. service_role Policy

`service_role` أصل عالي الحساسية له BYPASSRLS. السياسة المقترحة:

| النشاط | service_role |
|---|---|
| Supabase Auth admin operations المصرح بها | مسموح داخل module server-only ضيق |
| migration/schema DDL | غير موصى؛ migration role منفصل |
| bootstrap/adoption | role تشغيل مستقل وبموافقة، لا tenant request |
| background job متعدد tenants | فقط إذا كان system job موثقاً، scope صريح، audit/idempotency |
| Platform Admin المستقبلي | لا تلقائياً؛ boundary/capability/audit مستقل |
| tenant-facing server request | ممنوع افتراضياً |
| browser/client | ممنوع مطلقاً |

الحواجز: module allowlist، لا export إلى client، no raw key logging، rotation، structured audit، explicit workspace filters حتى مع bypass، code ownership review، واختبار يفشل إذا مسار authenticated يستخدم bypass role. canonical ACL الحالي لا يمنح service_role tables؛ لا يضاف grant عام بلا use case معتمد.

## 13. Suspended Co-member Finding

`current_comember_ids()` يعيد كل `team_members` غير soft-deleted داخل Workspace متاحة، ولا يشترط status للعضو المستهدف. النتيجة هي ظهور `public.users` profile للعضو suspended لزملائه active.

هذا ليس cross-tenant escape، لكنه authorization/privacy gap متوسط. predicate المستقبلي الأدنى:

```text
tm.status = 'active' AND tm.deleted_at IS NULL
```

يجب أولاً تحديد إن كانت Team UI تحتاج عرض suspended accounts للإدارة. إن احتاج owner ذلك، لا توسع helper العام؛ أنشئ policy/capability owner-specific لاحقاً. لا يدخل التغيير migration العلائقية إلا بموافقة صريحة، ويفضل مع role-aware RLS phase.

## 14. Proposed Forward Migration Scope

الاسم المرشح: `0003_workspace_relationship_hardening`.

النطاق فقط:

1. assertions للـcanonical `0002`/prerequisites المطلوبة.
2. in-transaction zero-conflict preflight للعلاقات الأربعين.
3. 17 unique constraints/indexes على parent `(workspace_id,id)`.
4. 40 composite FKs مع delete/update semantics مطابقة للحالية، وبـ`SET NULL (foreign_id)` للـnullable references.
5. إبقاء FKs الأحادية فقط إلى أن يثبت replacement؛ الحالة النهائية لا تحمل constraints متضاربة أو lifecycle مختلفاً.
6. validation كامل وcatalog manifest جديد لما بعد `0003`.
7. لا policy/helper/role/auth/ownership/FORCE change.

SQL يولد أو يضاف وفق Drizzle-supported metadata في B3.2. لا تعدل canonical `0002` أو legacy evidence. إذا لم يمثل Drizzle partial `SET NULL`، يبقى SQL custom داخل migration مع inspector/golden manifest؛ لا يخفض invariant ليناسب الأداة.

## 15. Regression Test Plan

- كل 33 اختبارات B3 تبقى ناجحة.
- الحالات الست المثبتة تتحول من success إلى SQLSTATE constraint violation.
- كل واحدة من العلاقات الـ31 الإضافية structurally vulnerable تحصل على INSERT/UPDATE regression أو matrix-generated equivalent.
- العلاقات الثلاث trigger-protected تبقى مرفوضة ويستمر business error حيث يلزم.
- same-workspace INSERT/UPDATE لكل policy shape وعلاقة ينجح.
- UPDATE من parent محلي إلى foreign parent يرفض.
- nullable references وON DELETE SET NULL لا تمسح workspace_id.
- CASCADE/RESTRICT semantics لا تتغير.
- preflight fixture لكل relation يكتشف mismatch ويوقف migration.
- clean fixture يهاجر ويصبح كل constraint validated.
- fresh Supabase: `0000→0001→0002→0003` ثم fingerprint جديدة معتمدة.
- upgrade من adopted `0002` يعمل، والمرة الثانية no-op.
- B1/B2/B2.2/B2.3/B2.4/B3 suites، full web، typecheck، lint، diff-check.
- لا fixture residue، ولا PUBLIC EXECUTE أو owner trust regression.

## 16. Rollback/Failure Strategy

- audit غير صفر: توقف بلا write.
- failure قبل commit: rollback DDL كله حيث تسمح transaction.
- `NOT VALID` لا يعتبر اكتمالاً؛ deploy التطبيق لا يسبق validation gate.
- لا إصلاح data تلقائي. reconciliation منفصل، backup، evidence، approval، ثم إعادة audit.
- rollback constraints بعد نجاح deploy قد يعيد ثغرة؛ لا ينفذ تلقائياً. rollback التطبيق يجب أن يبقى compatible مع constraints الأشد.
- dropping new composite FKs لا يمس data لكنه security regression ويحتاج incident approval.
- unique parent pairs لا تغير cardinality لأن `id` PK؛ يمكن حذفها فقط مع FKs التابعة وبخطة واضحة.
- لا down migration destructive ولا تعديل ledger يدوياً.

## 17. Immediate vs Deferred Work

### Immediate tenant-isolation fixes — قبل B4

- approve B3.2.
- preflight كل 40 direct/direct relations.
- تطبيق composite invariants لجميعها، لا الست فقط.
- توسيع B3 matrix لكل علاقة إضافية.
- fresh/adopted/no-op/catalog/security proof.

### Deferred capability work

- owner/manager/employee differentiated CRUD.
- team invitation/member-management capability.
- Website Builder/financial role restrictions.
- owner-only suspended-member directory إن اعتمد.

### Deferred identity work

- `auth_user_id` وUUID-only resolver.
- email/invite claim/reconciliation.
- user-reference membership lifecycle حيث يعتمد على immutable identity decision.

### Deferred Active Workspace work

- explicit selection، persistence، revocation، وmulti-workspace UX.
- لا تدخل هذه المفاهيم في composite FK design.

### Operational runtime hardening

- migration/runtime role separation.
- startup role assertions، pool-local context tests، secret boundaries.
- FORCE RLS decision بعد prototype.

## 18. Required Approval Decisions

1. اعتماد إصلاح systemic لكل العلاقات الأربعين بدل الست المثبتة فقط.
2. اعتماد composite FK + 17 parent unique pairs كآلية أساسية.
3. اعتماد `SET NULL (foreign_id)` للـnullable composite FKs وcustom SQL عند قصور Drizzle.
4. اعتماد zero-conflict gate ومنع auto-reconciliation.
5. اعتماد أن role equivalence لا يتغير في B3.2.
6. اعتماد owner invariant: pointer + exactly one matching active owner membership، في task مستقلة.
7. اعتماد تأجيل FORCE حتى فصل runtime role.
8. اعتماد service_role allowlist/no tenant-request policy.
9. تحديد توقيت helper suspended-member fix.
10. اعتماد أن 6 user/member-sensitive links تحتاج design lifecycle منفصل ولا تُخلط عشوائياً بالمفاتيح الأربعين.

## 19. B3.2 Implementation Prerequisites

- مراجعة inventory الـ76 والـ40 المرشحة.
- prototype disposable يثبت composite FK و`ON DELETE SET NULL (foreign_id)` على PostgreSQL/Supabase 17.6.
- أسماء constraints النهائية وDrizzle snapshot/custom SQL plan.
- audit tool read-only B1-guarded مع redacted output.
- fixture clean وfixture mismatch لكل relation.
- lock/time estimates، statement/lock timeouts، وupgrade rehearsal.
- موافقة صريحة جديدة على migration/schema changes؛ هذه الوثيقة لا تمنحها.

## 20. B4 Unblock Criteria

B4 يبقى blocked حتى:

- B3.2 معتمد ومنفذ.
- كل 40 relation preflight صفر ثم constraints validated.
- الست المثبتة والـ31 الإضافية مرفوضة cross-workspace.
- same-workspace وdelete lifecycle ناجحة.
- fresh/adopted/no-op fingerprint gates ناجحة.
- لا direct أو indirect HIGH tenant escape مفتوح.
- قرارات runtime/ownership تسجل كمهام ذات gates واضحة، حتى إن بقي تنفيذها اللاحق خارج B3.2.

## 21. Acceptance Criteria

- [x] كل 76 FK جُردت؛ 49 non-root حُللت فردياً.
- [x] الست findings تحققت من schema والخدمات.
- [x] 31 علاقة إضافية مكافئة سُجلت بلا ادعاء live proof.
- [x] آليات composite/trigger/CHECK/RLS/service قُيمت.
- [x] توصية واحدة تحدد 40 composite invariants و17 parent keys.
- [x] preflight وfailure/rollback بلا data auto-fix.
- [x] role/identity/Active Workspace مفصولة عن الإصلاح الفوري.
- [x] ownership وFORCE/runtime/service_role/helper decisions موثقة.
- [x] لا Migration أو schema أو RLS أو helper أو DB write.
- [ ] approval لـB3.2 غير ممنوح بعد.
