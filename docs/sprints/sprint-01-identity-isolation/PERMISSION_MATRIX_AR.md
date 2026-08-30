# مصفوفة الصلاحيات المعتمدة — Sprint 1

## الحالة والنطاق

**الحالة: Accepted — نُفذت في B6 وثُبتت في G1.** هذه المصفوفة تخص
المجالات الحالية واحتياجات Sprint 1 فقط. لا تنشئ Platform Admin ولا
Store/Commerce capabilities. `Platform Super Admin` حد مستقبلي منفصل في
Sprint 2، وليس دور `owner`.

تحفظ أعمدة «التنفيذ الحالي» و«هدف Sprint 1» لقطة Phase A التاريخية. الحالة
النهائية الموثوقة هي سجل القدرات المركزي واختبارات B6. علامة RLS في الجداول
لا تعني أن capability-aware/role-aware RLS نُفذ؛ أُغلق حد قاعدة البيانات وفق
قرار B6.2/B6.3 بسحب direct table CRUD وhelper RPC من أدوار Data API، مع بقاء
RLS لعزل Workspace فقط.

### الرموز

* **نعم:** القدرة المبدئية كاملة ضمن Workspace النشط.
* **مقيّد:** وصول إلى السجلات المسندة/انتقالات تشغيلية محددة.
* **لا:** منع افتراضي.
* **قرار:** غير محسوم بالمواصفة؛ Sprint 1 يفشل مغلقًا حتى الاعتماد.
* **مستقبلي:** Platform boundary غير منفذ.
* حالة الطبقات: **✓** مطبق، **جزئي** غير متسق، **✗** غير مطبق، **—** غير منطبق.

كل «نعم/مقيّد» يظل مشروطًا بعضوية active وActive Workspace صحيح. الأعمدة UI/Action/Service/RLS تصف **هدف Sprint 1**، لا الوضع الحالي.

## Platform Super Admin

| القدرة | الحالة |
|---|---|
| إدارة Workspaces/Stores والمنصة والتصميم والنشر والدومينات وPlatform Audit | **مستقبلي — غير منفذ في Sprint 1** |
| أي Workspace capability بسبب كونه Platform Admin | **لا تلقائيًا**؛ يحتاج boundary ودعمًا موثقًا في Sprint 2 |

## Workspace والمستخدمون

| Capability | Owner | Manager | Employee | التنفيذ الحالي | هدف Sprint 1 | UI | Action | Service | RLS | ملاحظات |
|---|---:|---:|---:|---|---|---:|---:|---:|---:|---|
| `workspace.read` | نعم | نعم | نعم | membership resolver + scoped read | context صريح | ✓ | ✓ | ✓ | ✓ | معلومات أساسية فقط للموظف |
| `workspace.settings.read` | نعم | نعم | لا | الصفحة تقرأ لكل عضو | منع employee | ✓ | ✓ | ✓ | ✓ | فصل operational عن sensitive لاحقًا |
| `workspace.settings.update` | نعم | لا | لا | owner-only Action | تثبيت | ✓ | ✓ | ✓ | ✓ | RLS الحالي لا يفرضه |
| `workspace.members.read` | نعم | نعم | لا | صفحة Team تقرأ لكل عضو | least privilege | ✓ | ✓ | ✓ | ✓ | قرار عرض directory للموظف مؤجل |
| `workspace.members.invite` | نعم | لا | لا | owner-only | تثبيت + claim آمن | ✓ | ✓ | ✓ | ✓ | الدعوة الحالية active مباشرة |
| `workspace.members.update` | نعم | لا | لا | owner-only + guards | تثبيت | ✓ | ✓ | ✓ | ✓ | منع self/last owner محفوظ |
| `workspace.members.remove` | نعم | لا | لا | owner-only + last-owner guard | تثبيت | ✓ | ✓ | ✓ | ✓ | soft delete |
| `team.read` | نعم | نعم | لا | كل عضو يرى الصفحة | توحيد مع members.read | ✓ | ✓ | ✓ | ✓ | alias domain حالي |
| `team.manage` | نعم | لا | لا | owner-only | توحيد | ✓ | ✓ | ✓ | ✓ | لا role=Platform Admin |

## CRM والخدمات والحجوزات

| Capability | Owner | Manager | Employee | التنفيذ الحالي | هدف Sprint 1 | UI | Action | Service | RLS | ملاحظات |
|---|---:|---:|---:|---|---|---:|---:|---:|---:|---|
| `customers.read` | نعم | نعم | قرار | كل active member | employee deny حتى اعتماد scope | ✓ | ✓ | ✓ | ✓ | بيانات شخصية |
| `customers.create` | نعم | نعم | لا | كل عضو | owner/manager | ✓ | ✓ | ✓ | ✓ | legacy gap |
| `customers.update` | نعم | نعم | لا | كل عضو | owner/manager | ✓ | ✓ | ✓ | ✓ | legacy gap |
| `customers.archive` | نعم | نعم | لا | كل عضو | owner/manager | ✓ | ✓ | ✓ | ✓ | soft delete |
| `leads.read` | نعم | نعم | قرار | كل عضو | deny employee حتى scope | ✓ | ✓ | ✓ | ✓ | RLS membership-only |
| `leads.create` | نعم | نعم | لا | public form + internal flows | فصل public عن dashboard | ✓ | ✓ | ✓ | ✓ | public ingestion عقد مستقل حالي |
| `leads.update` | نعم | نعم | لا | كل عضو | owner/manager | ✓ | ✓ | ✓ | ✓ | legacy gap |
| `leads.archive` | نعم | نعم | لا | كل عضو | owner/manager | ✓ | ✓ | ✓ | ✓ | legacy gap |
| `crm.pipeline.read` | نعم | نعم | نعم | scoped؛ employee opportunities مسندة | الحفاظ على scope | ✓ | ✓ | ✓ | ✓ | pipeline metadata مع operational scope |
| `crm.pipeline.manage` | نعم | نعم | لا | owner/manager جزئي؛ protected/delete owner | تثبيت الاستثناءات | ✓ | ✓ | ✓ | ✓ | RLS لا يفرض الدور |
| `services.read` | نعم | نعم | نعم | كل عضو | السماح scoped | ✓ | ✓ | ✓ | ✓ | Service ليس Product |
| `services.manage` | نعم | نعم | لا | كل عضو | owner/manager | ✓ | ✓ | ✓ | ✓ | legacy gap |
| `bookings.read` | نعم | نعم | مقيّد | كل عضو workspace-wide | assignment scope مطلوب | ✓ | ✓ | ✓ | ✓ | لا guard مخصص حاليًا |
| `bookings.manage` | نعم | نعم | لا | كل عضو | owner/manager | ✓ | ✓ | ✓ | ✓ | transitions غير capability-aware |
| `bookings.assign` | نعم | نعم | لا | ضمن booking update بلا role gate | owner/manager | ✓ | ✓ | ✓ | ✓ | تحقق team membership مطلوب |

## Property Operations

| Capability | Owner | Manager | Employee | التنفيذ الحالي | هدف Sprint 1 | UI | Action | Service | RLS | ملاحظات |
|---|---:|---:|---:|---|---|---:|---:|---:|---:|---|
| `properties.read` | نعم | نعم | نعم | scoped لكل عضو | السماح | ✓ | ✓ | ✓ | ✓ | non-financial |
| `properties.manage` | نعم | نعم | لا | create/update O/M؛ archive owner | تثبيت exception | ✓ | ✓ | ✓ | ✓ | capability فرعية للأرشفة قد تلزم |
| `rental_units.read` | نعم | نعم | نعم | scoped لكل عضو | السماح | ✓ | ✓ | ✓ | ✓ | non-financial |
| `rental_units.manage` | نعم | نعم | لا | create/update O/M؛ delete owner | تثبيت exception | ✓ | ✓ | ✓ | ✓ | RLS membership-only |
| `reservations.read` | نعم | نعم | مقيّد | employee assigned via service | تثبيت | ✓ | ✓ | ✓ | ✓ | RLS يحتاج role/assignment |
| `reservations.manage` | نعم | نعم | مقيّد | employee transitions محددة | تثبيت narrow transitions | ✓ | ✓ | ✓ | ✓ | لا pricing/reassign للموظف |
| `reservations.assign` | نعم | نعم | لا | O/M عبر service guards | تثبيت | ✓ | ✓ | ✓ | ✓ | staffId هو team_member ID |
| `housekeeping.read` | نعم | نعم | مقيّد | employee assigned | تثبيت | ✓ | ✓ | ✓ | ✓ | service guard موجود |
| `housekeeping.manage` | نعم | نعم | مقيّد | employee start/complete own | تثبيت narrow transitions | ✓ | ✓ | ✓ | ✓ | create/edit/cancel O/M |
| `housekeeping.assign` | نعم | نعم | لا | O/M service guard | تثبيت | ✓ | ✓ | ✓ | ✓ | تحقق member in workspace |

## الفوترة والتقارير

| Capability | Owner | Manager | Employee | التنفيذ الحالي | هدف Sprint 1 | UI | Action | Service | RLS | ملاحظات |
|---|---:|---:|---:|---|---|---:|---:|---:|---:|---|
| `invoices.read` | نعم | نعم | لا | employee assigned يستطيع read | منع employee وفق النموذج المعتمد | ✓ | ✓ | ✓ | ✓ | تعارض حالي |
| `invoices.manage` | نعم | نعم | لا | O/M غالبًا؛ employee لا | تثبيت | ✓ | ✓ | ✓ | ✓ | إصدار/void/write-off |
| `payments.read` | نعم | نعم | لا | legacy payments page لكل عضو | منع employee | ✓ | ✓ | ✓ | ✓ | financial |
| `payments.manage` | نعم | نعم | لا | legacy CRUD لكل عضو؛ billing يسمح record للموظف | منع employee | ✓ | ✓ | ✓ | ✓ | تعارض حرج |
| `refunds.manage` | نعم | نعم | لا | invoice service O/M؛ legacy يحتاج مراجعة | توحيد | ✓ | ✓ | ✓ | ✓ | لا employee |
| `reports.operational.read` | نعم | نعم | مقيّد | بعض snapshots scoped | تثبيت domain scope | ✓ | ✓ | ✓ | ✓ | لا مبالغ |
| `reports.financial.read` | نعم | نعم | لا | dashboard analytics يمنع employee؛ صفحات legacy لا | توحيد | ✓ | ✓ | ✓ | ✓ | لا fetch ثم hide |

## Website

| Capability | Owner | Manager | Employee | التنفيذ الحالي | هدف Sprint 1 | UI | Action | Service | RLS | ملاحظات |
|---|---:|---:|---:|---|---|---:|---:|---:|---:|---|
| `website.content.read` | قرار | قرار | لا | builder كامل لكل عضو | deny tenant builder حتى فصل content | ✓ | ✓ | ✓ | ✓ | content UI مستقل لاحقًا |
| `website.content.update` | قرار | قرار | لا | sections لكل عضو | deny حتى عقد allowed content | ✓ | ✓ | ✓ | ✓ | لا نمنح design ضمنيًا |
| `website.design.manage` | لا | لا | لا | كل عضو يستطيع create/edit templates/pages | إزالة tenant access | ✓ | ✓ | ✓ | ✓ | Platform Admin-only مستقبلًا |
| `website.publish` | لا | لا | لا | كل عضو يستطيع publish/unpublish/rollback | إزالة tenant access | ✓ | ✓ | ✓ | ✓ | Platform Admin-only |
| `website.domain.manage` | لا | لا | لا | بعض actions owner، وبعضها كل عضو | إزالة tenant access | ✓ | ✓ | ✓ | ✓ | Platform Admin-only |

## تعارضات التنفيذ عند اعتماد المصفوفة (تاريخية)

أغلقت B6 التعارضات الستة أدناه في طبقات UI/route/action/service، ثم أغلقت
B6.3 مسار التجاوز المباشر عبر PostgREST. تبقى القائمة دليلًا على baseline
الذي قاد التنفيذ، وليست وصفًا للحالة بعد G1.

1. `NAV_ITEMS` ثابت ويعرض كل الوحدات بلا capability filtering.
2. RLS يمنح CRUD لكل authenticated member داخل Workspace، فلا يحقق أي صف role-aware.
3. customer/service/booking/payment/lead actions أوسع من المصفوفة.
4. Website Builder/publish/domain متاح Tenant-side خلافًا للمواصفة.
5. employee billing access في invoice RBAC والـlegacy payments يتعارض مع target no-financial.
6. route layout يثبت authentication فقط؛ page loaders نفسها قد تجلب بيانات قبل UI hiding.

## قاعدة التنفيذ ونتيجة الإغلاق

أُنشئ registry واحد deny-by-default للأدوار→capabilities واستُخدم في UI،
route/loaders، Server Actions، وservices. الخانات «قرار» بقيت denied. لم تُكرر
المصفوفة داخل policies؛ قاعدة البيانات تمنع أدوار `anon` و`authenticated` من
CRUD المباشر ومن RPC helpers، بينما تحافظ RLS على tenant isolation كدفاع
إضافي. أثبت G1 طبقات B6 `17/17` وPostgREST/RPC `6/6` وRLS `33/33`.
