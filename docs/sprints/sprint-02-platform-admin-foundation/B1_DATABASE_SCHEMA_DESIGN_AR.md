# B1 — تصميم قاعدة البيانات والمهاجرة لـPlatform Admin Foundation

## 1. الحالة والنطاق

- **الحالة:** Design complete — جاهز لمراجعة migration،ولا توجد migration منفذة.
- **المرجع المعماري:** ADR-003 بحالة `Accepted` بعد A1.
- **الفرع عند التدقيق:** `develop`.
- **HEAD عند التدقيق:** `ee3ac8db2c6e72ecc754a8f67760d62deeb4b87e`.
- **رأس سجل Drizzle الحالي:** `0005_postgrest_acl_hardening`،`idx=5`،وعدد
  الإدخالات `6` من `0000` إلى `0005`.

هذه الوثيقة تحدد schema وmigration contract فقط. لم تعدل Drizzle schema،ولم
تنشئ SQL أوsnapshot،ولم تطبق migration،ولم تتصل بقاعدة محلية أومستضافة.

## 2. الخلاصة التنفيذية

التصميم المعتمد لـB1 هو migration أمامية واحدة لاحقة باسم:

`0006_platform_admin_foundation`

وتضم بصورة ذرية:

1. dedicated `platform_admins` مرتبطًا مباشرة بـSupabase Auth UUID،بلا FK إلى
   `users` أو`auth.users`.
2. `workspace_status` وعمود `workspaces.status` فقط؛لا `suspended_at` أوreason
   columns.
3. dedicated append-only `platform_audit_events` مع actor integrity،system
   bootstrap exception،idempotency،وmetadata محدودة.
4. تعديل `current_workspace_ids()` لاستبعاد Workspace المعلقة والمحذوفة.
5. RLS deny-all بلا policies على جدولي المنصة،وACL revokes صريحة تحافظ على B6.3.

لا تضيف B1 FK/trigger دائريًا يفرض وجود owner membership لكل Workspace. مسار
Sprint 2 الموثوق سيولد Workspace وowner membership وsuccess audit داخل
transaction واحدة،بينما القيود الحالية تفرض owner user،وتمنع duplicate
membership،وتغلق B6.3 الكتابة المباشرة. إضافة deferred constraint trigger عامة
ستوسع نطاق التغيير وتؤثر في fixtures ومسارات تاريخية من دون حاجة مثبتة.

## 3. التدقيق الدقيق للحالة الحالية

### 3.1 `users`

التعريف الحالي في `src/server/db/schema/tables.ts`:

| العمود           | النوع         | nullable/default       | ملاحظة                       |
| ---------------- | ------------- | ---------------------- | ---------------------------- |
| `id`             | `uuid` PK     | `gen_random_uuid()`    | internal identity            |
| `auth_user_id`   | `uuid`        | nullable               | unique؛أضيف في `0004`        |
| `email`          | `text`        | not null               | unique؛ليس authorization key |
| `full_name`      | `text`        | nullable               | profile                      |
| `avatar_url`     | `text`        | nullable               | profile                      |
| `email_verified` | `boolean`     | not null،default false | profile/linkage evidence     |
| `created_at`     | `timestamptz` | not null،default now   | من `timestamps()`            |
| `updated_at`     | `timestamptz` | not null،default now   | Drizzle `$onUpdate`          |
| `deleted_at`     | `timestamptz` | nullable               | soft delete                  |

القيود ذات الصلة:

- `users_pkey(id)`.
- `users_auth_user_id_uq(auth_user_id)`؛يسمح PostgreSQL بعدة NULL values.
- `users_email_unique(email)` case-sensitive في DB.
- trigger `enforce_auth_user_id_immutability_trg` يمنع تغيير Auth UUID بعد ربطه.

لا يوجد FK من `users.auth_user_id` إلى `auth.users.id`. هذا اختيار Sprint 1
مقصود يفصل lifecycle مع تحقق خادمي مضبوط.

RLS مفعلة وغير forced. policy واحدة `workspace_access FOR ALL TO authenticated`
تستعمل `current_comember_ids()` للـ`USING` و`WITH CHECK`. ACL ما بعد B6.3 يمنع
أصلًا direct table privileges.

### 3.2 `workspaces`

الأعمدة الحالية:

| المجموعة         | الأعمدة                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| identity/owner   | `id uuid PK default gen_random_uuid()`, `owner_id uuid not null`                                     |
| core             | `name text not null`, `slug text not null unique`, `plan plan not null default 'starter'`            |
| contact/profile  | `email`, `phone`, `website`, `logo_url`, `cover_image_url` nullable؛`accent_color` default `#6D5EF9` |
| locale           | `timezone` default `america-los_angeles`, `currency` default `USD`, `language` default `en-us`       |
| lifecycle الحالي | `created_at`, `updated_at`, `deleted_at` فقط                                                         |

لا يوجد Workspace `status`. `deleted_at` ليس suspension،و`member_status` يخص
العضوية لا Workspace.

القيود/الفهارس الحالية:

- `workspaces_pkey(id)`.
- `workspaces_slug_unique(slug)`.
- FK `owner_id -> users.id ON DELETE CASCADE`.
- check `workspaces_currency_iso_ck` على ثلاثة أحرف uppercase.
- index `workspaces_owner_idx(owner_id)`.

ملاحظة خطر قائمة وليست تغيير B1:hard-delete لـ`users` المالك يعمل cascade إلى
Workspace. النظام يستعمل soft delete،ولا توجد owner deletion/Workspace deletion
ضمن Sprint 2؛لذلك لا يغير B1 هذا الـFK عرضيًا.

RLS مفعلة وغير forced. policy `workspace_access FOR ALL TO authenticated` تعتمد
`id IN (current_workspace_ids())` في القراءة والكتابة.

### 3.3 `team_members`

| العمود            | التعريف                                                |
| ----------------- | ------------------------------------------------------ |
| `id`              | UUID PK default generated                              |
| `workspace_id`    | UUID not null،FK إلى `workspaces.id ON DELETE CASCADE` |
| `user_id`         | UUID not null،FK إلى `users.id ON DELETE CASCADE`      |
| `role`            | enum `member_role`،default `employee`،values `owner    | manager | employee`  |
| `status`          | enum `member_status`،default `active`،values `active   | invited | suspended` |
| profile/lifecycle | `title`, `phone`, timestamps،`deleted_at`              |

القيود والفهارس:

- unique `team_members_workspace_user_uq(workspace_id,user_id)`؛يشمل rows ذات
  soft delete،ولهذا يعاد تفعيل row القديمة بدل duplicate.
- unique `team_members_workspace_id_id_uq(workspace_id,id)` من B3.2 لدعم
  composite tenant FKs.
- indexes منفصلة على `workspace_id` و`user_id`.

لا توجد قيمة platform role هنا،ولا يضيف B1 واحدة. RLS policy هي
`workspace_access FOR ALL TO authenticated` عبر `current_workspace_ids()`.

### 3.4 دوال RLS الحالية

`current_workspace_ids()` بعد `0004` هي `STABLE SECURITY DEFINER` مع
`search_path=public`. تربط:

`auth.uid() -> users.auth_user_id -> active/non-deleted team_members`

ولا تربط `workspaces` حاليًا،لذلك لا تستطيع فحص Workspace status أوdeleted state.

`current_comember_ids()` و`current_conversation_ids()` تبنيان نطاقهما على
`current_workspace_ids()`،ومن ثم فإن تقوية الدالة الأساسية تنتشر إلى policy
`users` و`ai_messages` وبقية السياسات التابعة بلا تعديل أجسامهما.

### 3.5 RLS والـACL بعد Sprint 1

يثبت manifest `post-b6.3`:

| الكائن                    |     العدد/الحالة |
| ------------------------- | ---------------: |
| Verix tables              |               30 |
| RLS enabled               | 30/30،غير forced |
| policies                  |               30 |
| enums                     |               36 |
| constraints               |              189 |
| indexes                   |               95 |
| functions                 |               10 |
| triggers                  |                7 |
| recorded grants لـ`PUBLIC |             anon | authenticated | service_role` | 0   |

`0005_postgrest_acl_hardening` يسحب كل table privileges في `public` من `anon`
و`authenticated`،ويسحب EXECUTE على helpers الثلاثة من `PUBLIC`, `anon`,
و`authenticated`. لا تعتمد أي production feature على direct PostgREST CRUD.

RLS policies ما زالت موجودة كدفاع ثان واختبار للعزل؛الحزام المحلي يمنح privileges
مؤقتة داخل rollback transaction لاختبار semantics،ولا يعيد grants إنتاجية.

### 3.6 audit/activity الحالي

لا يوجد Platform Audit أوgeneric audit table. الموجود الأقرب:

- `crm_activities`: Workspace-scoped timeline مرتبط إلزاميًا بـCRM opportunity،
  actor هو `users.id` nullable،ويحمل timestamps وsoft delete ويمكن update/delete.
- invoices/payments تحمل attribution/immutable domain history خاصًا بالفوترة.
- structured logger/request ID ليس persistence append-only.

`crm_activities` غير صالح لإدارة المنصة لأنه tenant-readable حسب policy،مرتبط
بـopportunity،وقابل للتعديل/الحذف.

### 3.7 سجل migrations

| idx | tag                                     | الدور                                        |
| --: | --------------------------------------- | -------------------------------------------- |
|   0 | `0000_slim_thunderbolts`                | baseline أولي                                |
|   1 | `0001_payments_soft_delete`             | billing lifecycle                            |
|   2 | `0002_canonical_pre_sprint_1`           | canonical pre-Sprint-1 + RLS/grants baseline |
|   3 | `0003_workspace_relationship_hardening` | composite tenant relationships               |
|   4 | `0004_immutable_auth_identity`          | immutable Auth UUID + UUID-first RLS helper  |
|   5 | `0005_postgrest_acl_hardening`          | deny direct table/RPC access                 |

لا يعدل B1 أي migration تاريخية.

## 4. التصميم الدقيق لـ`platform_admins`

### 4.1 الأعمدة

| العمود         | النوع                   | null/default                   | القرار                                  |
| -------------- | ----------------------- | ------------------------------ | --------------------------------------- |
| `id`           | `uuid`                  | PK،default `gen_random_uuid()` | internal Platform actor ID              |
| `auth_user_id` | `uuid`                  | not null                       | رابط authorization الوحيد               |
| `role`         | `platform_admin_role`   | not null                       | `super_admin                            | support_admin` |
| `status`       | `platform_admin_status` | not null،default `active`      | `active                                 | suspended`     |
| `created_at`   | `timestamptz`           | not null،default now           | creation evidence                       |
| `updated_at`   | `timestamptz`           | not null،default now           | justified لمتابعة status/role lifecycle |

لا `email`, `workspace_id`, `user_id`, `created_by`, `deleted_at`, أوfree-form
bootstrap metadata. bootstrap attribution في audit،لا في identity row.

### 4.2 القيود والفهارس

1. PK `platform_admins_pkey(id)`.
2. unique `platform_admins_auth_user_id_uq(auth_user_id)`؛UUID واحد لا يملك أكثر
   من Platform identity،وتبقى uniqueness بعد suspension فلا re-link.
3. unique `platform_admins_id_auth_user_id_uq(id,auth_user_id)` لتكون مرجعًا
   composite لـaudit actor وتثبت أن Auth UUID snapshot يطابق actor row.
4. role/status مقيدان بالـenums؛لا check نصي مكرر.
5. trigger `enforce_platform_admin_auth_user_id_immutability_trg` يرفض أي تغيير
   لاحق لـ`auth_user_id`. أضيف هذا التفصيل التصحيحي في B2 لأن uniqueness تمنع
   التكرار لكنها لا تحقق invariant عدم إعادة الربط الذي اعتمده B1 صراحة.

لا index منفصل على role أوstatus في Sprint 2:resolver يستخدم unique Auth UUID،
ولا يوجد Admin Management list/use case. إضافة index بلا query مثبتة غير لازمة.

### 4.3 الربط بالهوية

الاختيار النهائي:يبقى `platform_admins` مستقلًا ومفتاحه التفويضي
`auth_user_id uuid` بلا FK إلى:

- `users.id`:لأن Platform-only identity لا يجب أن تدخل tenant-facing identity
  lifecycle أوتنشئ Workspace/member تلقائيًا.
- `users.auth_user_id`:لأنه nullable ويخص claim/onboarding للمستخدم الداخلي،
  بينما Platform identity مستقلة وقد تسبق `users` row.
- `auth.users.id`:لمنع coupling بين حذف Auth identity وتاريخ platform actor/
  audit،واتساقًا مع قرار B4 بعدم إنشاء cross-schema lifecycle FK.

bootstrap CLI وresolver يتحققان من `auth.users.id` خادميًا. عدم وجود FK لا يعني
عدم تحقق؛يعني أن حذف Auth user لا يمحو actor/audit ولا يعيد تعيين UUID تلقائيًا.

### 4.4 revocation

revocation في Sprint 2 هي `status='suspended'`. resolver يقبل `active` فقط،فيظهر
الإبطال في الطلب التالي. لا delete أوsoft delete أوتغيير `auth_user_id`. لا
`revoked_at` لأن `updated_at` وPlatform Audit يكفيان،ولا يوجد Admin Management
flow في هذا السبرنت.

## 5. تصميم Workspace status

### 5.1 schema change

- enum جديد `workspace_status` بالقيمتين `active`, `suspended`.
- عمود `workspaces.status workspace_status NOT NULL DEFAULT 'active'`.
- index `workspaces_status_created_at_idx(status,created_at)` لدعم Platform list
  المفلترة بالحالة والمرتبة زمنيًا.

اختير enum لأن المجموعة مغلقة وقليلة وثابتة،وهو النمط الحالي للأدوار والحالات.
لا constrained text،ولا قيم `draft|archived|deleted`.

### 5.2 ترقية البيانات

كل Workspace موجودة عند الترقية تصبح `active`. migration يجب أن تجعل backfill
صريحًا وقابلًا للمراجعة ثم تثبت `DEFAULT` و`NOT NULL`؛لا تستنتج suspension من
`deleted_at` أوmember statuses. fresh inserts التي لا تمرر status تحصل `active`.

### 5.3 الحقول المرفوضة في Sprint 2

لا تضاف:

- `suspended_at`.
- `suspended_by`.
- `suspension_reason`.
- `activated_at` أوstatus history داخل Workspace.

الحالة الحالية موجودة في `status`،ووقت آخر update في `updated_at`،والactor/
الانتقال/reason code في immutable Platform Audit. تكرارها يخلق drift بلا حاجة.

## 6. التصميم الدقيق لـ`platform_audit_events`

### 6.1 enums

| enum                         | القيم Sprint 2                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `platform_audit_actor_kind`  | `platform_admin`, `system_bootstrap`                                                                                                |
| `platform_audit_action`      | `platform_admin.bootstrap_completed`, `workspace.created`, `workspace.owner_assigned`, `workspace.suspended`, `workspace.activated` |
| `platform_audit_target_type` | `platform_admin`, `workspace`                                                                                                       |
| `platform_audit_outcome`     | `success`, `failure`                                                                                                                |

القيم مغلقة عمدًا؛أي Platform action مستقبلية تحتاج migration ومراجعة audit/
threat contract بدل كتابة event نصي عشوائي.

### 6.2 الأعمدة

| العمود                    | النوع                        | null/default          | الغرض                                     |
| ------------------------- | ---------------------------- | --------------------- | ----------------------------------------- |
| `id`                      | `uuid`                       | PK،default generated  | event ID                                  |
| `actor_kind`              | `platform_audit_actor_kind`  | not null              | actor صريح                                |
| `actor_platform_admin_id` | `uuid`                       | nullable              | NULL فقط للsystem bootstrap               |
| `actor_auth_user_id`      | `uuid`                       | nullable              | immutable actor snapshot                  |
| `action`                  | `platform_audit_action`      | not null              | action vocabulary                         |
| `target_type`             | `platform_audit_target_type` | not null              | polymorphic target class                  |
| `target_id`               | `uuid`                       | nullable              | إلزامي للsuccess؛قد يغيب لفشل create مبكر |
| `outcome`                 | `platform_audit_outcome`     | not null              | success/failure                           |
| `request_id`              | `text`                       | not null              | correlation فقط؛1–128 حرفًا               |
| `idempotency_key`         | `uuid`                       | nullable              | operation replay key                      |
| `request_fingerprint`     | `text`                       | nullable              | SHA-256 hex للvalidated canonical input   |
| `metadata`                | `jsonb`                      | not null،default `{}` | allowlisted object فقط،حد 16 KiB          |
| `occurred_at`             | `timestamptz`                | not null،default now  | immutable event time                      |

لا `updated_at` أو`deleted_at`. لا raw email/name/request body/error/stack.

### 6.3 القيود

1. PK على `id`.
2. composite FK
   `(actor_platform_admin_id,actor_auth_user_id) ->
platform_admins(id,auth_user_id) ON DELETE RESTRICT`.
3. actor check:
   - `platform_admin`:actor ID وAuth UUID كلاهما non-null،والaction ليست bootstrap.
   - `system_bootstrap`:كلا actor fields NULL،action هي bootstrap،outcome success،
     target type `platform_admin`،وtarget ID non-null.
4. success target check:كل `outcome='success'` يملك `target_id`.
5. idempotency pair check:`idempotency_key` و`request_fingerprint` كلاهما NULL
   أوكلاهما non-null.
6. fingerprint check عند وجوده:64 lowercase hex characters.
7. request ID length check:بين 1 و128.
8. metadata check:`jsonb_typeof(metadata)='object'` وserialized size لا تتجاوز
   16 KiB.

`target_id` polymorphic ولذلك لا يملك FK عامًا. success services تتحقق من target
داخل transaction؛bootstrap target هو admin row المنشأ في transaction نفسها.

### 6.4 الفهارس

1. `platform_audit_events_occurred_at_idx(occurred_at DESC)` للقائمة العامة.
2. `platform_audit_events_actor_occurred_idx(actor_platform_admin_id,
occurred_at DESC)` مع predicate actor non-null.
3. `platform_audit_events_target_occurred_idx(target_type,target_id,
occurred_at DESC)` لتاريخ Workspace/admin.
4. `platform_audit_events_action_occurred_idx(action,occurred_at DESC)` للبحث
   التشغيلي حسب action.
5. unique partial `platform_audit_events_success_idempotency_uq` على
   `(actor_platform_admin_id,action,idempotency_key)` عندما actor non-null،key
   non-null،وoutcome success.
6. unique partial `platform_audit_events_bootstrap_once_uq(action)` عندما action
   bootstrap وoutcome success؛يمنع أكثر من bootstrap success event.

لا تمنع failure events retry لاحقًا:فهرس idempotency الفريد يخص success فقط.
الخدمة تقارن `request_fingerprint` عند replay؛same key/different input يرفض.

### 6.5 append-only والـmetadata

function/trigger جديدان يرفضان كل `UPDATE` و`DELETE` على الجدول،بلا استثناء
للتطبيق. تصحيح event يكون event جديدًا مستقبلًا بعد اعتماد action،لا mutation.

الـmetadata يمر عبر allowlist لكل action:

- bootstrap:`environment`, `change_ticket`, database/project fingerprint فقط.
- owner assignment:`owner_user_id`؛لا email.
- status:`previous_status`, `new_status`, `reason_code`, `change_ticket` عند الحاجة.
- failure:`error_code` مصنف فقط.
- create:لا Workspace contact/profile PII؛target ID وaction يغطيان الأساس.

ممنوع passwords،tokens،cookies،JWT،API/service keys،credentials،raw request
bodies،stack traces،email،phone،customer data،أوfree-form secrets. `request_id`
غير موثوق للتفويض ولا يغير actor/target.

### 6.6 success/failure policy

- success events الخمسة المطلوبة محفوظة في الجدول.
- Workspace success event في transaction نفسها مع mutation؛فشل audit يلغي
  domain mutation.
- authorized command يصل إلى domain operation ثم يفشل بعد rollback:يجوز writer
  مستقل best-effort أن يضيف `failure` مع safe error code وtarget إن عُرف.
- authorization denial،unknown actor،Support/tenant attempt،malformed input،
  وearly validation failure تبقى structured application/security logs،لا rows
  في Platform Audit.
- فشل bootstrap قبل transaction/insert يبقى operator/security log؛لا يدعي
  `bootstrap_completed` نجاحًا لم يحدث.

## 7. invariant إنشاء Workspace الذري

### 7.1 transaction contract

الخدمة المستقبلية تنفذ الخطوات التالية داخل transaction واحدة:

1. تستقبل `PlatformActorContext` خادميًا وتتحقق من create وassign-owner
   capabilities قبل transaction.
2. تأخذ advisory transaction lock مشتقًا من actor + operation key.
3. تبحث عن success audit سابق لنفس actor/action/key:
   - fingerprint مطابق:تعيد target السابق بلا write.
   - fingerprint مختلف:ترفض key reuse.
4. تحل owner بواسطة `users.id`،وتتحقق أن row غير محذوف و`auth_user_id` non-null،
   وأن `auth.users.id` المطابق موجود. لا email authorization.
5. تولد Workspace UUID خادميًا وتدرج Workspace `active` مع `owner_id` الصحيح.
6. تدرج `team_members` row لنفس Workspace/user،بدور `owner` وحالة `active`.
7. تدرج success events `workspace.created` و`workspace.owner_assigned` بنفس
   operation key/fingerprint وtarget Workspace؛event التعيين يحمل owner user ID
   في metadata.
8. commit.

أي failure في 4–7 يعمل rollback للجميع. لا يسجل success event خارج transaction،
ولا post-commit CRM/Site/Store provisioning داخل هذا الأمر.

### 7.2 القيود المستخدمة

- `workspaces.owner_id NOT NULL` وFK إلى user موجود.
- unique Workspace slug.
- `team_members` FKs إلى Workspace/user.
- unique `(workspace_id,user_id)` يمنع duplicate owner membership.
- audit actor composite FK يثبت actor/Auth UUID.
- success idempotency index يمنع duplicate committed operation.

لا constraint جديدة تضمن عالميًا أن كل `workspaces.owner_id` يملك owner
membership. السبب:

1. ضمان Sprint 2 مطلوب لمسار الإنشاء المعتمد،وتحققه transaction واختبار fault
   injection.
2. Data API مغلقة؛writes تمر عبر trusted server boundary.
3. deferred cyclic constraint trigger ستغير كل seeds/legacy/internal tooling،
   وتحتاج preflight وعقد owner transfer أوسع وهو خارج النطاق.

إذا ظهر writer ثان أوowner transfer،يعاد تقييم deferred invariant كتصميم مستقل.

## 8. Workspace suspension عبر الطبقات

### 8.1 schema

المطلوب DB فقط هو enum + `workspaces.status` + index. memberships والبيانات لا
تتغير. activation تعيد `status='active'` فقط؛لا mass update.

### 8.2 resolver/application

ليست SQL migration behavior،لكنها شرط إغلاق لاحق:

- Active Workspace query تضيف `workspaces.status='active'` بجانب non-deleted.
- selection المعلقة تصبح invalid؛لا fallback صامت.
- كل tenant page/action/service يستعمل context المعاد التحقق منه.
- Platform Admin read/lifecycle service يعمل عبر Platform context لاActive
  Workspace.
- public site renderer/forms لا تضيف status filter في Sprint 2.

### 8.3 RLS

يجب أن يستبدل `current_workspace_ids()` داخل `0006` بحيث يربط `workspaces w`
ويشترط:

- `w.id = tm.workspace_id`.
- `w.status = 'active'`.
- `w.deleted_at IS NULL`.
- مع الشروط الحالية:immutable user link،active/non-deleted membership،وuser غير
  محذوف.

هذا التعديل ضروري رغم ACL لأن:

1. يحافظ على defense-in-depth إذا اختبر/منح role مقيد مستقبلًا.
2. يجعل كل policies التابعة تستبعد stale suspended Workspace.
3. يمنع RLS harness من إعطاء نتيجة أمنية تناقض application resolver.

لا تتغير policies نفسها. لا تستخدم RLS لإعطاء Platform Admin global access.

## 9. وضع RLS المعتمد

| الكائن                  | RLS                | policies                  | الوصول الفعلي                                                           |
| ----------------------- | ------------------ | ------------------------- | ----------------------------------------------------------------------- |
| `platform_admins`       | enabled،not forced | صفر                       | trusted server DB فقط بعد Platform authorization                        |
| `platform_audit_events` | enabled،not forced | صفر                       | trusted server writer/read service فقط                                  |
| `workspaces`            | enabled كما هو     | `workspace_access` كما هي | tenant scope عبر helper المقوى؛Platform service عبر server connection   |
| `team_members`          | enabled كما هو     | `workspace_access` كما هي | tenant scope عبر helper المقوى؛Platform creation transaction عبر server |

اختيار zero policies لجدولي المنصة مقصود. لا policy تستخدم `auth.uid()` لمنح
Platform access،ولا RLS policy عالمية أوservice RPC. حتى لو أعطى اختبار محلي
table privilege مؤقتًا لـ`authenticated`،RLS يجب أن يعيد صفر rows ويرفض writes.

اتصال Drizzle الخادمي الحالي privileged ويعمل operationally خارج tenant RLS.
الأمان هنا هو:

`getUser() -> platform_admins lookup -> opaque PlatformActorContext ->
capability gate في action/service -> scoped transaction`

لذلك يمنع استدعاء platform service بسياق client أوWorkspace context،وتبقى
اختبارات action/service إلزامية. فصل runtime/migration DB roles تحسين لاحق لا
يغير تصميم B1 ولا يبرر فتح ACL.

## 10. توافق B6.3 والـACL

المهاجرة المستقبلية يجب أن تتضمن صراحة،من دون grant مقابل:

1. سحب كل table privileges على `platform_admins` و`platform_audit_events` من
   `PUBLIC`, `anon`, `authenticated`, و`service_role`.
2. إعادة schema-wide revoke على كل `public` tables من `anon` و`authenticated`
   كحزام ضد default privileges البيئية،مع بقاء targeted revoke أعلاه واضحًا.
3. سحب EXECUTE على append-only وPlatform Auth UUID immutability trigger functions
   من `PUBLIC`, `anon`, `authenticated`, و`service_role`.
4. بعد `CREATE OR REPLACE current_workspace_ids()`،إعادة سحب EXECUTE منها من
   الأدوار الأربعة؛لا تعتمد المهاجرة على بقاء ACL القديم ضمنيًا.
5. لا public RPC للbootstrap أوPlatform queries،ولا view أوGRANT أوStorage/
   Realtime exposure.

لا يوصى بـ`ALTER DEFAULT PRIVILEGES` في B1 لأن أثره خاص بدور منشئ الكائن ويختلف
بين بيئات Supabase. قاعدة Verix العملية هي explicit revoke في كل migration
منشئة لجدول،ثم catalog gate. تغيير default-owner workflow يحتاج preflight
تشغيلي مستقل.

### catalog/fingerprint

بعد التنفيذ المحلي فقط،ينشأ scope جديد `post-s2-b1` بدل تعديل manifest تاريخي:

- توسيع union في `catalog-manifest.ts` وinspector callers للـscope الجديد.
- generator وverifier جديدان أوparameterization مكافئ؛لا overwrite لأدلة B6.3.
- manifest/fingerprint مولدان من local DB،لا مكتوبان يدويًا.
- migration ledger يجب أن يكون `7/7` وآخر hash/timestamp يطابق `0006`.
- التوقعات المصححة بعد B2:32 table،43 enum،RLS على 32 table،30 policy،12
  function،9 triggers،و`grants=0`. كان تقدير 11/8 في مراجعة B1 قد أغفل function
  وtrigger اللازمين لإنفاذ immutable `platform_admins.auth_user_id` في DB. أعداد
  constraints/indexes النهائية تؤخذ من generated
  catalog وتطابق التصميم أعلاه لأن backing-index representation أداة الكتالوج
  هي المرجع.
- verifier يثبت جسم `current_workspace_ids()` الجديد،zero policies للجدولين،
  actor/append constraints،ACL،وعدم ظهور legacy objects.
- PostgREST regression يضيف الجدولين لكل anon/owner/manager/employee JWT.

## 11. Bootstrap persistence

### 11.1 resolve والـguard

CLI المعتمد لاحقًا:

1. يقرأ Auth UUID argument فقط ويطبّق حراس البيئة/confirmation في ADR-003.
2. يبدأ transaction ويأخذ advisory xact lock ثابتًا
   `verix:platform-admin-bootstrap` لمنع سباق first-run بلا row يمكن قفلها.
3. يتحقق exact من وجود `auth.users.id = target_uuid`؛لا email/metadata.
4. يعد `platform_admins` rows داخل القفل:
   - صفر:يكمل.
   - سجل واحد مطابق وقد سبق bootstrap success:يبلغ already bootstrapped بلا write.
   - أي سجل آخر أوحالة جزئية غير متوقعة:يفشل مغلقًا ويطلب break-glass review.

### 11.2 transaction

داخل transaction نفسها:

1. يدرج `platform_admins` بدور `super_admin` وحالة `active`؛role ليست CLI input.
2. يدرج `platform_admin.bootstrap_completed`:
   - `actor_kind='system_bootstrap'`.
   - actor ID/Auth UUID كلاهما NULL.
   - `target_type='platform_admin'`.
   - `target_id` هو admin ID المنشأ.
   - `outcome='success'`.
   - request/correlation ID مولد خادميًا وmetadata allowlisted.
3. commit؛أي فشل audit يلغي admin insert.

لا circular FK:bootstrap event لا يدعي أن admin الجديد هو actor؛هو target فقط،
والsystem actor exception مقيد بالـcheck. بعد ذلك كل domain event يستخدم composite
FK إلى admin row.

### 11.3 re-bootstrap/revocation

- وجود أي admin row،حتى suspended،يغلق bootstrap.
- suspension لا تتيح CLI لإنشاء بديل.
- لا hard delete/reuse/relink.
- recovery من فقد كل admins active هي break-glass procedure خارج Sprint 2،
  وليست bypass تلقائيًا أوenvironment re-grant.

## 12. بنية migration المقترحة

### القرار:مهاجرة واحدة

الاسم:`0006_platform_admin_foundation`.

المسؤوليات المرتبة داخلها:

1. إنشاء enums السبعة:
   `platform_admin_role`, `platform_admin_status`, `workspace_status`,
   `platform_audit_actor_kind`, `platform_audit_action`,
   `platform_audit_target_type`, `platform_audit_outcome`.
2. إنشاء `platform_admins` وقيوده.
3. إضافة/backfill/تثبيت `workspaces.status` وإنشاء index.
4. إنشاء `platform_audit_events` وقيوده وفهارسه.
5. إنشاء Platform Auth UUID immutability function/trigger.
6. إنشاء append-only function/trigger.
7. استبدال `current_workspace_ids()` بالجسم المقوى.
8. تمكين RLS على الجدولين بلا policies.
9. تطبيق targeted/schema-wide revokes وإعادة function revokes.

لماذا واحدة:الكائنات مترابطة ويجب ألا توجد حالة applied تسمح بهوية منصة بلا
audit أوWorkspace suspension بلا RLS helper. حجم التغيير محدود ومراجع،وPostgres/
Drizzle migration transaction تمنح all-or-nothing. تقسيمها سيخلق intermediate
catalog غير قابل للاستعمال ويزيد ledger/rollback combinations بلا فائدة.

لا تحتوي migration bootstrap data،email،Auth UUID،Store،أوapplication behavior.

## 13. أمان الترقية وfresh build

### 13.1 fresh canonical database

- تطبق `0000`…`0006` بالترتيب على disposable DB.
- تنشأ Workspaces fixtures القديمة `active` افتراضيًا.
- لا تنشأ Platform Admin أوaudit rows تلقائيًا.
- catalog النهائي يطابق `post-s2-b1`،والledger `7/7`.

### 13.2 upgrade من `0005`

- preflight read-only يعد Workspaces،NULL/invalid state غير موجود لأن العمود جديد،
  ويتحقق من عدم وجود أسماء objects متعارضة غير canonical.
- كل Workspace موجودة backfill إلى `active`;existing owner/members/data untouched.
- new platform tables فارغة.
- replace helper يبدأ استبعاد deleted/suspended فور commit.
- public sites/forms لا تعتمد helper وتبقى بلا تغيير.
- failure في أي DDL/function/revoke يعمل rollback كامل للمهاجرة.

### 13.3 idempotency

SQL الخام ليس scriptًا يعاد تشغيله يدويًا بـ`IF NOT EXISTS`. Drizzle ledger هو
مصدر exactly-once:

- أول migrator run يطبق `0006` ويسجل hash/timestamp.
- run ثان عبر migrator يرى ledger ويكون no-op.
- raw re-execution غير مدعومة ومتوقع أن تفشل بدل إخفاء catalog drift.
- verifier يرفض ledger row إضافية أوhash مختلفًا.

### 13.4 fixture/test impact

- معظم `insert workspaces` الحالية لا تحتاج تعديل بسبب default active.
- اختبارات suspension تضيف status صريحًا حيث يلزم.
- test schema imports/types تتوسع بالجدولين/enums والعلاقات/row types.
- historical manifests (`canonical-pre-sprint-1`, `post-b3.2`, `post-b4`,
  `post-b6.3`) لا تعدل.
- RLS expected behavior يضاف له Workspace-level suspension؛membership suspension
  tests تبقى مستقلة.

## 14. اختبارات DB المطلوبة قبل موافقة التنفيذ

### 14.1 schema/constraints

- `platform_admins.auth_user_id` not null وفريد؛duplicate UUID يرفض.
- `super_admin` و`support_admin` يقبلان؛أي role أخرى ترفض.
- `active` و`suspended` يقبلان؛invalid status يرفض.
- suspended admin row يبقى ويمنع re-use لـAuth UUID.
- لا FK/column إلى Workspace/team/email.
- Workspace insert بلا status ينتج active؛suspended persists؛invalid يرفض.
- existing Workspace upgrade rows كلها active.

### 14.2 audit integrity

- valid Platform actor success event يقبل مع composite actor/Auth pair صحيح.
- mismatched actor ID/Auth UUID يرفض بالـFK.
- valid system bootstrap event يقبل؛system actor مع domain action أوfailure يرفض.
- Platform actor مع bootstrap action يرفض.
- success بلا target يرفض؛failure المبكر بلا target يقبل.
- invalid action/target/outcome يرفض.
- metadata non-object أوأكبر من 16 KiB يرفض.
- malformed request ID/fingerprint أوidempotency half-pair يرفض.
- duplicate successful actor/action/key يرفض؛failure لا يحجز success retry.
- bootstrap success ثان يرفض.
- UPDATE وDELETE يرفضان عبر trigger؛INSERT يبقى مسموحًا للtrusted test role.

### 14.3 atomic create/bootstrap

- create Workspace ينتج owner row وowner membership وeventين فقط.
- inject failure في membership/أي success audit يلغي Workspace وكل rows.
- concurrent same-key requests تنتج Workspace واحدة؛different fingerprint يرفض.
- owner not found/deleted/unlinked/Auth row missing يلغي كل العملية.
- bootstrap concurrent runs تنتج admin/event واحدين.
- existing/suspended admin يمنع re-bootstrap.
- bootstrap audit failure يلغي admin insert.

### 14.4 suspension/RLS

- active membership + active Workspace تظهر في `current_workspace_ids()`.
- نفس membership مع suspended Workspace تختفي.
- reactivation تعيدها.
- deleted Workspace تختفي.
- multi-workspace actor لا يرى المعلقة،ولا يحصل stale selected scope.
- `current_comember_ids()` وconversation/tenant policies ترث المنع.
- B3 cross-tenant وmembership status tests كلها تمر.

### 14.5 RLS/ACL/PostgREST

- RLS enabled وzero policies على platform tables.
- test-only temporary grant + `SET LOCAL ROLE authenticated` لا يقرأ/يكتب
  platform tables بسبب RLS.
- manifest يسجل grants صفرًا.
- anon وJWT حقيقي لكل owner/manager/employee لا يستطيعان SELECT/INSERT/UPDATE/
  DELETE على الجدولين.
- authenticated لا ينفذ append trigger function أوRLS helpers كـRPC.
- Supabase Auth endpoints تبقى ناجحة.

### 14.6 migration/catalog regression

- fresh disposable migration `0000`…`0006` PASS.
- adopted local fixture at `0005` + representative Workspace/member rows يرقى
  إلى `0006` PASS بلا data loss.
- migrator rerun no-op وledger/hash exact.
- generated `post-s2-b1` manifest/fingerprint يطابق observed catalog.
- expected 32 tables/43 enums/32 RLS/30 policies/12 functions/9 triggers/0 grants
  بعد تصحيح immutability أعلاه.
- B3،B3.2،B4،B5،B6،B6.3 DB/security regressions تمر.
- Drizzle schema/migration check،typecheck،lint،build،و`git diff --check` ضمن بوابة
  التنفيذ اللاحقة.

كل اختبارات DB على repository-local/disposable Supabase فقط،مع hosted guard.

## 15. rollback/debug contract

- قبل التطبيق:backup/checkpoint وcatalog/ledger snapshot للبيئة المصرح بها لاحقًا.
- failure أثناء migration:transaction rollback؛لا partial schema.
- بعد نجاحها:الـrollback المفضل forward-fix،لأن إزالة status/audit قد تفقد دليلًا
  أمنيًا. لا drop يدويًا في production.
- rollback تطبيقي يمكنه الرجوع لإصدار لا يستعمل platform tables مع إبقاء schema؛
  لا يعيد grants ولا يحذف audit.
- إذا انحرف catalog أوACL:توقف،لا تمنح authenticated/anon كحل مؤقت.

## 16. Scope guard

لا يقدم التصميم:

- Store schema أوActive Store.
- Store membership/access أوStore-to-Site.
- products/categories/inventory/orders.
- Commerce أوExternal API.
- Platform Website Management أوpublic-site suspension.
- custom Workspace roles.
- Platform Admin management UI أوSupport capabilities.
- White Label.
- hosted rollout أوbootstrap data.

## 17. القرارات النهائية وغياب blockers

| القرار                        | النتيجة                                                           |
| ----------------------------- | ----------------------------------------------------------------- |
| Platform identity persistence | independent `platform_admins.auth_user_id`،unique،بلا FK خارجي    |
| Platform revocation           | `platform_admin_status='suspended'`،لا delete/relink              |
| Workspace lifecycle           | enum `active                                                      | suspended` وعمود واحد فقط |
| status history/reason         | Platform Audit،لا Workspace columns زائدة                         |
| Platform Audit                | dedicated append-only table + actor integrity/system bootstrap    |
| owner invariant               | trusted transaction + existing constraints؛لا cyclic trigger جديد |
| suspension RLS                | تقوية `current_workspace_ids()` بـactive/non-deleted Workspace    |
| Platform RLS                  | enabled،zero policies،server-only                                 |
| ACL                           | explicit revokes،zero catalog grants،لا RPC جديد                  |
| migration sequence            | migration واحدة `0006_platform_admin_foundation`                  |
| bootstrap circularity         | system actor + new admin target داخل transaction                  |

لا توجد database design decision مادية متبقية. B1 لا تمنح إذن إنشاء migration؛
المهمة التالية يجب أن تبدأ بمراجعة هذا التصميم وتفويض تنفيذي مستقل.

لم يكشف التدقيق حاجة إلى تغيير dependencies أوtask sequence في
`SPRINT_02_IMPLEMENTATION_PLAN_AR.md`،لذلك لم تعدل الخطة في B1. الأسماء الدقيقة
للأعمدة/enums والقرار بحذف status-attribution columns الاختيارية في هذه الوثيقة
هي refinement المقصود لمرحلة B1،لا توسعة للنطاق.
