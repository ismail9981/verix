# B3 — حزمة تكامل RLS والتحقق من عزل المستأجرين

التاريخ: 2026-08-11  
الحالة: **Implemented — REVIEW_REQUIRED**  
السبرنت: Sprint 1 — Identity and Tenant Isolation Hardening

## 1. Executive Summary

أصبحت سياسات RLS الحالية قابلة للاختبار سلوكياً على Supabase المحلي الحقيقي. تعمل اختبارات المستخدمين بدور `authenticated` غير superuser وغير `BYPASSRLS`، وتضبط claim المستخدم في transaction محلية ثم تتراجع عن كل fixtures تلقائياً.

نجح العزل المباشر: لا يستطيع User A قراءة أو إدخال أو تحديث أو حذف صفوف Workspace B عبر نمط السياسة الحالي. لكن الاختبارات أثبتت أربع علاقات FK تسمح بإنشاء صف داخل Workspace A يشير إلى parent داخل Workspace B: bookings، site domains، buildings، وreservations. لا تكشف هذه الحالات صف B مباشرة، لكنها تكسر tenant referential integrity وقد تؤثر في تشغيل tenant آخر. لذلك البوابة `REVIEW_REQUIRED`، ولم يعدل B3 schema أو migration أو policy.

## 2. Scope

اقتصر التنفيذ على harness محلي، claims/roles، fixtures قابلة للتراجع، جرد policies، واختبارات عزل وسلوك. لم ينفذ immutable identity أو Active Workspace/Store أو capability enforcement أو Platform Admin.

## 3. Local Supabase Environment

- الهدف الوحيد: `127.0.0.1:54322/postgres` مع `VERIX_LOCAL_SUPABASE=verix`.
- حارس B1 يتحقق قبل الاتصال.
- لا يوجد `supabase/.temp/project-ref`، ولم ينفذ link أو remote push.
- كل بيانات B3 داخل transaction ترمى عمداً؛ لا seed دائم.
- Supabase prerequisites الثمانية: `PRESENT`.

## 4. Canonical Fingerprint Gate

يرفض `assertCanonicalRlsDatabase()` بدء الاختبارات إذا لم تكن المقارنة `ADOPTABLE` أو اختلفت البصمة أو فشل prerequisite. البصمة المتوقعة والمشاهدة:

`b84dd485f280a6fca69350787ea6bf9f658d4a84c247803c05bf51d6a5c09ee3`

## 5. Current RLS Inventory

الجرد الآلي مشتق من manifest المرجعي ويعرض كل جدول وسياسة ودور وUSING/WITH CHECK والتصنيف. الملخص:

| البند | النتيجة |
|---|---:|
| Verix tables | 30 |
| RLS enabled | 30 |
| FORCE RLS | 0 |
| policies | 30 |
| `FOR ALL` | 30 |
| membership-only | 30 |
| role-aware | 0 |

التصنيفات المستخدمة: workspace-scoped، auth-dependent، وoperational/internal. لم يظهر جدول global/platform-like حالي في canonical `public` catalog؛ Store وPlatform Admin غير موجودين بعد. لا يوجد جدول uncertain في manifest المعتمد.

## 6. Authentication Context Model

ينشئ fixture سجلات حقيقية في `auth.users` و`public.users`. داخل كل transaction ينفذ harness:

1. seed بدور database owner.
2. `SET LOCAL ROLE authenticated`.
3. `set_config('request.jwt.claim.sub', user_uuid, true)`.
4. تحقق `auth.uid()` من UUID نفسه.
5. رفض الدور إذا كان superuser أو `rolbypassrls` أو لم يكن `authenticated`.

لا تُقلد `auth.uid()` ولا تستبدل؛ تُستدعى دالة Supabase المحلية الفعلية.

## 7. Test Fixtures

الـfixtures الحتمية تشمل User A/Workspace A، User B/Workspace B، مستخدماً متعدد العضويات، non-member، manager، employee، وعضوية suspended. وتشمل سجلات ممثلة للمواقع، CRM، الخدمات والحجوزات، العقارات والوحدات والحجوزات السكنية والتنظيف، والفواتير والمدفوعات وAI conversations.

## 8. Workspace Isolation Matrix

| العملية | نفس Workspace | Workspace أخرى | النتيجة |
|---|---|---|---|
| SELECT | يظهر الصف | لا يظهر | SAFE |
| INSERT | مسموح | SQLSTATE `42501` | BLOCKED_BY_RLS |
| UPDATE row أجنبي | — | صفر صفوف | BLOCKED_BY_RLS |
| UPDATE workspace_id | — | SQLSTATE `42501` | BLOCKED_BY_RLS |
| DELETE row أجنبي | — | صفر صفوف | BLOCKED_BY_RLS |

## 9. Positive Access Tests

User A رأى بياناته فقط عبر 16 مجالاً ممثلاً: workspaces/team، sites/domains، customers/leads/CRM، services/bookings، properties/buildings/units/reservations/housekeeping، invoices/payments. كما نجحت عمليات insert/update/delete داخل Workspace A.

## 10. Cross-workspace Denial Tests

أثبتت الاختبارات المباشرة عدم إمكان رؤية Workspace B في تسعة مجالات ممثلة، ورفض insert، وإخفاء update/delete، ورفض نقل صف مملوك إلى Workspace B. لا يوجد direct row escape مثبت.

## 11. Membership-State Results

- active: يرى Workspace العضوية.
- suspended: لا يعيد `current_workspace_ids()` أي Workspace.
- absent: لا وصول.
- multiple active memberships: يرى Workspace A وB معاً؛ لا يختبر B3 اختيار Active Workspace.
- soft-deleted membership: helper الحالي يستبعده بواسطة `tm.deleted_at is null` وفق تعريفه وفحص catalog.

## 12. Role-Level Findings

`owner`, `manager`, و`employee` نفذوا CRUD نفسه على customers داخل Workspace A. هذا متوقع من baseline الحالي لأن كل policies membership-only و`FOR ALL`. لا يثبت B3 capability enforcement؛ الفرق بين الأدوار في الخدمات لا ينعكس في RLS حالياً.

## 13. Ownership Dual-Source Findings

1. تطابق `owner_id` وowner membership: وصول ناجح.
2. وجود `owner_id` بلا active membership: لا وصول؛ `owner_id` لا تستخدمه RLS.
3. owner membership مع `owner_id` مختلف: الوصول مسموح للعضوية.
4. عدة owner-role rows: schema يسمح بها، وكل owner active يصل.

المصدر الفعلي لـRLS هو `team_members` فقط، بينما services قد تتعامل مع `workspaces.owner_id`. يلزم قرار لاحق لتوحيد invariant؛ لم يُعدّل B3 الملكية.

## 14. service_role/BYPASSRLS Findings

- `service_role`: `rolbypassrls=true`.
- canonical ACL الحالي: لا `SELECT` مباشر لـservice_role على جداول Verix، لذلك direct query يفشل `42501` قبل الاستفادة من bypass.
- في fixture مؤقتة داخل transaction مُنح SELECT ثم أثبت الاختبار أن service_role يرى Workspaces الاثنين متجاوزاً RLS.
- مسارات authenticated تتحقق صراحة أنها ليست service_role ولا bypass-capable.

هذا يثبت bypass semantics ويكشف أيضاً أن عبارة “service-role reads Verix tables” ليست صحيحة مع ACL canonical الحالي دون grant إضافي. أي تغيير ACL يحتاج قراراً مستقلاً.

## 15. FORCE RLS Findings

كل الجداول الثلاثين تملك RLS enabled ولا يملك أي منها FORCE RLS. مالك الجداول واتصال `postgres` المحلي يحمل `BYPASSRLS` ويرى Workspaces الاثنين. عملياً، اتصال Drizzle عبر `DATABASE_URL` قد يتجاوز RLS بحسب دوره، فتظل service scoping طبقة أمن إلزامية. قرار FORCE RLS ودور runtime يحتاجان مراجعة منفصلة؛ لم يُفعّل FORCE في B3.

## 16. Policy Coverage

تغطي الاختبارات الأنماط الأربعة الحالية:

| النمط | الجداول الممثلة | الدليل |
|---|---|---|
| `workspace_id IN current_workspace_ids()` | أغلب الجداول | CRUD + domains matrix |
| workspace primary key | workspaces | membership/ownership tests |
| `id IN current_comember_ids()` | users | cross-workspace user denial + helper output |
| conversation parent helper | ai_messages | cross-workspace conversation/message denial |

لا توجد policy غير مجرودة. لكن التغطية تثبت الشكل المشترك ولا تدعي تنفيذ كل CRUD على كل جدول على حدة.

## 17. Indirect Relationship Tests

| الهجوم | النتيجة | التصنيف |
|---|---|---|
| Booking A → Customer/Service B | نجح | VULNERABLE |
| SiteDomain A → Site B | نجح | VULNERABLE |
| Building A → Property B | نجح | VULNERABLE |
| Reservation A → Unit/Customer B | نجح | VULNERABLE |
| Invoice A → Reservation B | رفضه trigger/RLS visibility | BLOCKED_BY_CONSTRAINT |
| InvoiceLineItem A → Invoice B | رفضه trigger | BLOCKED_BY_CONSTRAINT |
| Payment A → Invoice B | رفضه trigger | BLOCKED_BY_CONSTRAINT |

السبب في الحالات الضعيفة: `WITH CHECK` يتحقق من `workspace_id` في الصف الجديد، بينما FK أحادي لا يثبت أن parent يحمل Workspace نفسها.

## 18. Helper Function Security

الدوال الثلاث `SECURITY DEFINER`, `STABLE`, و`search_path=public`، بمالك `trusted_privileged_owner`. لا `PUBLIC EXECUTE`، والتنفيذ متاح لـanon/authenticated فقط كما يحدد manifest. السلوك:

- `current_workspace_ids`: active فقط، ويمنع suspended/non-member.
- `current_conversation_ids`: يعيد المحادثات في كل العضويات النشطة فقط.
- `current_comember_ids`: يعيد كل team member غير soft-deleted داخل Workspace المصرح بها، بما فيهم suspended؛ ولذلك ملف المستخدم المعلق يبقى مرئياً لزملائه الحاليين.

## 19. Vulnerabilities/Gaps Found

1. أربع cross-workspace parent-link paths مثبتة.
2. RLS لا يميز owner/manager/employee في أي جدول.
3. `current_comember_ids` لا يشترط membership status للصف المستهدف.
4. `owner_id` وowner membership قابلان للتناقض والتعدد.
5. لا FORCE RLS، واتصال owner/BYPASS يعتمد على service scoping.
6. service_role bypass موجود لكن canonical table ACL يمنع وصوله المباشر، خلاف الافتراض التشغيلي المطلوب اختباره.

## 20. Severity Classification

| النتيجة | الشدة | السبب |
|---|---|---|
| cross-workspace booking/domain/property/reservation links | HIGH | تكسر tenant referential integrity وقد تؤثر في تشغيل tenant آخر عند معرفة UUID |
| membership-only writes لكل الأدوار | HIGH architectural gap | direct same-tenant escalation؛ إصلاحها ضمن capability/RLS rollout اللاحق |
| owner dual-source drift | HIGH design risk | authority غير موحد ولا توجد consistency constraints |
| owner/runtime bypass بلا FORCE | HIGH operational risk | RLS لا يحمي اتصالاً elevated |
| suspended co-member profile visibility | MEDIUM | helper لا يرشح حالة العضو المستهدف |
| service_role بلا table ACL | MEDIUM compatibility decision | آمن افتراضياً لكنه لا يحقق admin-query expectation |

لا يوجد direct cross-workspace row read/update/delete escape مثبت، ولا CRITICAL غير مصنف. لكن HIGH indirect-linkage findings تحتاج قراراً قبل الانتقال.

## 21. Recommended Follow-up

يطلب approval لمهمة RLS/schema hardening منفصلة تقيّم composite tenant FKs أو constraint triggers لكل علاقة، وتضيف regression expectations من “VULNERABLE” إلى “BLOCKED”. كما يلزم قرار صريح حول runtime/service-role grants، FORCE RLS، owner invariant، وحالة suspended co-members. لا تخلط هذه الإصلاحات مع immutable identity أو capability redesign.

## 22. B3 Acceptance Gate

`REVIEW_REQUIRED` لأن harness والـauthenticated direct isolation يعملان، لكن indirect tenant-linkage وrole/ownership/runtime decisions مهمة ولم يُعتمد إصلاحها. لا يبدأ العمل التالي قبل مراجعة هذه النتائج.

## 23. B4 Prerequisites

- اعتماد شدة ومسار إصلاح العلاقات الأربع.
- تحديد ما إذا كان إصلاح tenant-consistent parent linkage يحدث قبل B4 أو ضمن migration مستقلة.
- اعتماد semantics وصول service_role ودور `DATABASE_URL` الفعلي.
- قرار FORCE RLS موثق.
- قرار owner source-of-truth وحالة suspended co-member visibility.
- إبقاء بصمة pre-Sprint-1 دون تعديل؛ أي إصلاح DB يكون migration forward جديدة بموافقة صريحة.

## Validation Evidence

- focused B3 live suite: 33/33.
- coverage inventory: 30/30 policies، 4/4 policy shapes.
- كل fixture transaction تراجع؛ لا بيانات B3 دائمة.
- production build غير مطلوب لأن production-imported code لم يتغير.
