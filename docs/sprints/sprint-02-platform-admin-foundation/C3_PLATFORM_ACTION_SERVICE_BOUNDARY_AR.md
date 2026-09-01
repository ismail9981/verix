# C3 — حد Platform Actions وServices

## 1. النتيجة التنفيذية

أضيف backend foundation مستقل للمنصة من دون تنفيذ Workspace lifecycle أوfinal
admin UI. يتكون الحد من:

- Platform Workspace service يفرض context C1 وقدرة العملية قبل أي DB access.
- Server Action read proof يفوض أولاً،ثم يتحقق من input strict،ثم يستدعي service،
  ويعيد result/error آمنًا.
- Workspace summary read proof محدود إلى 100 صف وأربعة حقول آمنة.
- Platform Audit read proof محدود إلى 50 صفاً وبـprojection آمنة.
- internal Audit writer مشتق actor بالكامل من opaque Platform context.
- audited transaction executor يربط كل عملية مستقبلية بقدرتها وحدثها،ويجعل
  mutation وsuccess Audit داخل transaction واحدة.
- error model يفصل unauthenticated/unauthorized/invalid/not-found/conflict/
  internal بلا تسريب SQL أوstack أوPlatform identity.

لم تُنفذ create/assign-owner/suspend/activate production mutations،ولم تتغير
صفحات C2 أوWorkspace services أوmigration/schema/RLS/ACL.

## 2. تدقيق ما قبل التنفيذ

ثبت قبل التعديل:

- الفرع `develop` وHEAD
  `ee3ac8db2c6e72ecc754a8f67760d62deeb4b87e`.
- كل تغييرات B2 وC1 وC2 غير الملتزمة بقيت محفوظة.
- C1 يوفر `requirePlatformCapability()` وopaque runtime context وservice
  assertion؛C2 يستخدم page gate مستقلاً.
- Server Actions الحالية تستخدم `"use server"`،Zod،typed results،ثم service،
  لكن Workspace actions تعتمد Active Workspace capabilities ولا تصلح كحد منصة.
- Workspace services تستخدم Drizzle server connection و`db.transaction()`،
  وتعيد DTOs؛لا يجوز إعادة استخدامها global Platform read authorization.
- النمط القائم يميز `NotFoundError` ويرسل unexpected action failures إلى
  structured server logging.
- B2 schema الفعلي يتيح Workspace fields `id/name/status/created_at`،ويفرض
  Platform Audit enums/actor FK/metadata/idempotency/append-only invariants.

لم يكتشف generic admin service أوPlatform action سابق يتعارض مع C3.

## 3. Platform service flow

المسار المعتمد لكل service عام:

1. يستقبل `ActivePlatformAdminContext` صادراً من C1،لا actor ID أوrole.
2. يعيد runtime `assertPlatformCapability()` للقدرة الدقيقة قبل query/transaction.
3. يتحقق من operation-specific input؛لا table/SQL/capability string من client.
4. يستخدم Drizzle/Postgres trusted server connection.
5. يعيد DTO محدوداً أو`PlatformServiceError` مصنفاً.

`platform-workspace.service.ts` مستقل عن tenant `workspace.service.ts` وكل services
ذات `workspaceId` المشتق من Active Workspace. لا يستورد Workspace roles أو
Active Workspace ولا يملك fallback لهما.

## 4. Server Action flow

`readPlatformWorkspacesAction(input)` هو C3 direct-invocation proof وليس final UI
loader. ينفذ بالترتيب الإلزامي:

1. `requirePlatformCapability("platform.workspaces.read")`؛وهذا يعيد التحقق من
   Supabase user ثم يحل Platform identity من immutable Auth UUID عبر C1.
2. strict Zod validation لكائن فارغ فقط في proof الحالي.
3. `readPlatformWorkspaceSummaries(context)`.
4. safe discriminated result.

بذلك hidden role،`platform_admin_id`،capability claim،أوActive Workspace ID
المزيف لا يدخل validation أوservice قبل authorization. حتى Super Admin الحقيقي
يحصل على `INVALID_INPUT` عند إرسال حقول actor/role زائدة.

الـaction غير موصول بواجهة C2؛وجوده يثبت أن direct Server Action invocation لا
يتجاوز route protection. lifecycle actions لم تُنشأ.

## 5. Workspace read proof

`readPlatformWorkspaceSummaries()` يعيد فقط:

```text
id
name
status
createdAt (ISO string)
```

يستبعد soft-deleted Workspaces،ويرتب `created_at desc, id asc`،ويضع hard cap
`100` لأن pagination/filtering النهائية خارج C3. لا يقرأ أويسلسل owner ID،email،
phone،billing،memberships،Store أوأي tenant domain rows.

اختبار projection يفحص مفاتيح Drizzle select نفسها،ويضيف owner fixture متعمداً
ثم يثبت أنه لا يظهر في DTO. support وWorkspace roles يفشلون قبل `db.select()`.

## 6. Platform Audit read/write foundation

### 6.1 القراءة

`readPlatformAuditSummaries()` يطلب `platform.audit.read` ويعيد بحد أقصى 50:

- event ID.
- action المغلق.
- target Workspace ID.
- outcome.
- occurred timestamp كـISO.

لا يعيد actor IDs أوrequest ID أوidempotency/fingerprint أوmetadata. لا توجد
Audit UI في C3.

### 6.2 writer الداخلي

`writePlatformAuditEventInTransaction()`:

- server-only وليس Server Action.
- يتطلب transaction قائمة وopaque context موثوقاً.
- يعيد فحص capability الموافقة للaction.
- يثبت `actor_kind='platform_admin'`.
- يشتق Platform Admin DB ID وAuth UUID من context؛لا يقبلهما في input.
- يقفل action vocabulary على الأحداث الأربعة.
- يقفل target type على `workspace` ويتحقق من target UUID.
- يتحقق من outcome،request ID،idempotency/fingerprint pair،والـlowercase SHA-256.
- يقبل metadata allowlist فقط:
  `reason|note|previousStatus|newStatus|noOp|errorCode|ownerUserId`.
- يحد string lengths وmetadata إلى 8 KiB،أشد من DB limit البالغ 16 KiB.
- يرفض control characters وtoken/secret keys والحقول غير المعروفة.

لا يدعم bootstrap writer؛ذلك يبقى CLI task منفصلاً. لا يوجد update/delete
helper لأن الجدول append-only.

## 7. authorization proofs للعمليات المستقبلية

المفردات الداخلية الثابتة تربط:

| العملية        | capability                         | success Audit action       |
| -------------- | ---------------------------------- | -------------------------- |
| `create`       | `platform.workspaces.create`       | `workspace.created`        |
| `assign_owner` | `platform.workspaces.assign_owner` | `workspace.owner_assigned` |
| `suspend`      | `platform.workspaces.suspend`      | `workspace.suspended`      |
| `activate`     | `platform.workspaces.activate`     | `workspace.activated`      |

`assertPlatformWorkspaceMutation()` لا ينفذ mutation؛هو authorization proof
لـE2/E3. active Super Admin يجتاز المسارات الأربعة،بينما Support وكل tenant actor
يفشل. operation غير معروفة مثل `generic_admin_query` تفشل ولا تبدأ query.

لم ينشأ generic CRUD أوadmin query أوdynamic capability helper.

## 8. transaction contract

`executeAuditedPlatformWorkspaceMutation()` يطبق العقد التالي للـservices
operation-specific المستقبلية:

```text
action: authorize exact capability
action: validate input
service: reassert exact operation capability
service: begin trusted DB transaction
service callback: perform the one domain mutation
transaction helper: derive and insert matching success Audit event
commit only after Audit insert succeeds
```

الـcallback server code وليس client input،ولا يقبل helper SQL fragments أوtable
names أوrole/capability names. operation من vocabulary مغلق وتحدد action
تلقائياً. إذا فشل mutation لا يكتب Audit success؛وإذا فشل Audit يرمي transaction
callback فلا يعاد success وتقوم DB transaction بالrollback.

لا يستخدم executor الآن في lifecycle production flow لأن create/owner/suspend/
activate خارج C3. failure Audit best-effort بعد rollback يبقى جزء F1/E2/E3 عند
وجود domain command فعلي؛denial أوvalidation المبكر يسجل في structured security
logs ولا يصنع event مزيفاً.

## 9. error model

`PlatformActionResult<T>` يفصل:

| code              | المعنى الآمن                             |
| ----------------- | ---------------------------------------- |
| `UNAUTHENTICATED` | لا توجد trusted session identity         |
| `UNAUTHORIZED`    | لا Platform row/active status/capability |
| `INVALID_INPUT`   | validation أوtyped input contract فشل    |
| `NOT_FOUND`       | target المصرح غير موجود                  |
| `CONFLICT`        | state/domain conflict                    |
| `INTERNAL`        | unexpected infrastructure/domain failure |

لا تعاد exception message الخام. authorization details تختزل إلى unauthorized،
والأخطاء غير المتوقعة تسجل server-side عبر request-correlated logger ثم يعاد نص
عام. الاختبارات حقنت SQL password/stack text وأثبتت عدم ظهوره في result.

## 10. confused-deputy controls

- لا action أوservice يقبل Platform Admin ID أوtrusted role.
- لا client capability يحدد المطلوب؛الـaction/service يثبتانه في code.
- opaque context لا يمر إلى client ولا يمكن forge بسبب C1 brand + WeakSet.
- service assertion تسبق DB access،حتى لو استدعي service مباشرة خارج action.
- لا Active Workspace أوWorkspace membership import في Platform services.
- Platform Workspace read لا يقبل arbitrary Workspace ID أوquery options.
- Audit writer لا يقبل actor fields؛extra forged actor field تجاهل وactor مشتق
  من context.
- transaction executor لا يقبل SQL/table names أوdynamic action.
- Workspace registry يرفض Platform capability runtime،والـPlatform boundary يرفض
  owner/manager/employee objects.
- Support context حقيقي لكنه zero-capability،لذلك يفشل قبل query/transaction.

النمط المستقبلي للtargeted operation هو:

`authorized opaque context + validated Workspace UUID + operation-specific service`.

## 11. malicious invocation evidence

اختبارات direct action شملت:

- unauthenticated.
- authenticated بلا membership.
- Workspace Owner/Manager/Employee.
- active Support Admin.
- suspended Super Admin.
- forged role وPlatform Admin ID وcapability.
- stale Active Workspace ID.
- route-bypass direct function invocation.

كلها أعادت `UNAUTHENTICATED` أو`UNAUTHORIZED` ولم تستدع read service. actor
المصرح وحده وصل service،والحقول الزائدة رُفضت strict بعد authorization.

## 12. دليل الاختبارات

### 12.1 الاختبارات المركزة

| المجموعة                                               |                النتيجة |
| ------------------------------------------------------ | ---------------------: |
| C1 Platform identity/capability/authorization          | `25/25` في `3/3` ملفات |
| C2 route/direct URL/navigation                         | `29/29` في `3/3` ملفات |
| C3 actions/services/audit/transaction                  | `50/50` في `4/4` ملفات |
| Workspace action/service/page/navigation authorization | `11/11` في `4/4` ملفات |
| Active Workspace integration                           |   `14/14` في `1/1` ملف |

### 12.2 full application والجودة

| البوابة              |                        النتيجة |
| -------------------- | -----------------------------: |
| full web suite       |     `761/761` في `56/56` ملفاً |
| repository typecheck |               PASS؛`3/3` tasks |
| repository lint      | PASS؛`3/3` tasks،zero warnings |
| production build     |               PASS؛`2/2` tasks |
| `git diff --check`   |                           PASS |

### 12.3 database security

استخدمت الاختبارات repository-local Supabase فقط على `127.0.0.1`:

| المجموعة               |                           النتيجة |
| ---------------------- | --------------------------------: |
| Platform DB foundation |                           `11/11` |
| tenant RLS             |                           `34/34` |
| PostgREST ACL          |                           `10/10` |
| canonical verifier     | ledger=`7`،grants=`0`،`ADOPTABLE` |

بقي fingerprint:

`9df35d82ec24c7c8e630108e0366a9c673ba42ca2d8c07e1a191e1bdfeef16cb`

## 13. ملفات C3

- `apps/web/src/server/actions/platform-action-result.ts`.
- `apps/web/src/server/actions/platform-workspace.ts` واختباره.
- `apps/web/src/server/services/platform-errors.ts`.
- `apps/web/src/server/services/platform-workspace.service.ts` واختباره.
- `apps/web/src/server/services/platform-audit.service.ts` واختباره.
- `apps/web/src/server/services/platform-mutation.ts` واختباره.
- هذا التقرير.

لم يحتج Sprint 2 implementation plan أوADR-003 إلى factual sequencing correction؛
C3 أنشأ foundation فقط وترك E1/E2/E3/F1 production/UI work في مهامها اللاحقة.

## 14. المخاطر المتبقية وحد المهمة

- Workspace read proof capped وليس final pagination/search/details model.
- Audit read proof internal ولا توجد Audit page.
- writer/transaction executor غير مستخدمين في production mutation بعد؛E2/E3 يجب
  أن يضيفا operation-specific validation،locking/idempotency/concurrency tests.
- failure Audit after rollback لم ينفذ لأن لا domain mutation موجودة في C3.
- idempotent retry semantics الفعلية تحتاج operation service وDB integration في
  E2/E3؛C3 يتحقق من pair/fingerprint ولا يقرر replay result.
- not-found/conflict mappings موجودة لكن read proof الحالي لا ينتجها عادة؛تستخدم
  في targeted services اللاحقة.
- أي service جديد يجب أن يعيد capability assertion ولا يعتمد action وحده.
- لا final Workspace list/details/create/suspend UI أوbootstrap/Store work في C3.

## 15. القرار

حد action/service مستقل،مغلق افتراضياً،ومثبت ضد direct invocation وWorkspace
fallback والـconfused-deputy inputs. القراءة محدودة،والـAudit actor مشتق خادمياً،
والعقد الذري يمنع success mutation بلا success Audit. بقيت ضمانات B2/C1/C2
وWorkspace security سليمة.

**C3: PASS — PLATFORM ACTION/SERVICE BOUNDARY VERIFIED**
