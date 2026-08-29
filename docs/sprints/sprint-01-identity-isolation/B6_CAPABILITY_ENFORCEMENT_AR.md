# B6 — الفرض المركزي للقدرات

**البوابة:** `PASS`
**السبرنت:** Sprint 1
**الفرع:** `develop`
**هجرة قاعدة البيانات:** لا توجد

## 1. Executive Summary

استبدلت B6 افتراضات الدور الموزعة بمفردات واحدة من 47 قدرة ومصفوفة ثابتة ومكتوبة الأنواع للأدوار الثلاثة المعتمدة: `owner` و`manager` و`employee`. كل طلب محمي يحل هوية Supabase الثابتة ثم Active Workspace والعضوية الحالية، وبعدها فقط يقيّم القدرة. الدور أو القدرة غير المعروفين يفشلان مغلقين.

غُطيت صفحات dashboard الاثنتان والعشرون و86 Server Action خاصة بالـWorkspace. مُنعت قدرات Website Builder والتصميم والنشر والدومينات عن جميع أدوار Workspace، ومُنع الموظف على الخادم من الفواتير والمدفوعات والاسترداد والتقارير المالية. لم تتغير RLS أو قاعدة البيانات؛ RLS تظل حد العضوية والمستأجر، بينما B6 هي حد الإجراء داخل Active Workspace.

## 2. Previous Authorization Model

كان النموذج السابق يجمع بين `getAuthorizedWorkspace()` وحده، و`requireOwner()`، و`requireManagerOrAbove()`، وفحوص `role === ...` في الصفحات والمكونات والخدمات، وإخفاء UI غير موحد. كانت customer/service/booking/payment/lead actions تعتمد العضوية فقط، وكان Website Builder والنشر والدومينات متاحاً للمستأجر. كما سمح Billing القديم للموظف بقراءة فاتورة مسندة وتسجيل دفعة، خلاف المصفوفة المعتمدة.

## 3. Authorization Inventory

| المجال               | READ                            | CREATE/UPDATE/DELETE             | التصنيف               | الوضع بعد B6                                                  |
| -------------------- | ------------------------------- | -------------------------------- | --------------------- | ------------------------------------------------------------- |
| Dashboard            | operational + financial widgets | refresh                          | OPERATIONAL/FINANCIAL | operational للجميع، المالي owner/manager فقط                  |
| Team                 | members directory               | invite/update/remove             | ADMINISTRATIVE        | manager read، owner manage                                    |
| Settings/Profile     | settings read                   | settings/profile update          | ADMINISTRATIVE        | owner update، manager read-only                               |
| Customers            | list/stats                      | create/update/archive            | PII/OPERATIONAL       | owner/manager فقط                                             |
| Leads                | list/stats                      | update/archive/convert           | PII/OPERATIONAL       | owner/manager فقط؛ public ingestion مستقل                     |
| CRM Pipeline         | assigned/all reads              | opportunities/pipeline/stages    | OPERATIONAL           | employee assigned read؛ mutations owner/manager؛ delete owner |
| Services             | list                            | create/update/archive            | OPERATIONAL           | employee read؛ owner/manager manage                           |
| Bookings             | all أو assigned                 | create/update/delete             | OPERATIONAL           | employee assigned read فقط؛ owner/manager manage              |
| Properties/Buildings | read                            | create/update/reorder/archive    | OPERATIONAL/ADMIN     | employee read؛ O/M manage؛ archive owner                      |
| Rental Units         | read                            | create/update/delete             | OPERATIONAL/ADMIN     | employee read؛ O/M manage؛ delete owner                       |
| Reservations         | all أو assigned                 | create/edit/assign/status/delete | OPERATIONAL           | employee assigned + transitions ضيقة؛ O/M full                |
| Housekeeping         | all أو assigned                 | create/edit/assign/transitions   | OPERATIONAL           | employee assigned start/complete؛ O/M full                    |
| Invoices             | list/detail/payments            | issue/payment/refund/void        | FINANCIAL             | employee denied بالكامل                                       |
| Legacy Payments      | list/stats                      | create/update/delete             | FINANCIAL             | employee denied بالكامل                                       |
| Analytics            | financial aggregates            | refresh                          | FINANCIAL             | owner/manager فقط                                             |
| Website/SEO          | draft/site/page/section         | design/template                  | PLATFORM_ONLY         | لا Workspace role                                             |
| Publishing           | versions/snapshots              | publish/unpublish/rollback       | PLATFORM_ONLY         | لا Workspace role                                             |
| Domains              | domain state                    | add/delete/verify/primary/token  | PLATFORM_ONLY         | لا Workspace role                                             |
| AI                   | current mock/client surface     | لا mutation domain حالي          | READ                  | `workspace.read`                                              |
| Public contact API   | public validated input          | lead ingestion                   | PUBLIC                | بقي خارج membership/capability model                          |

لم يبق فحص role مباشر في dashboard/actions/services/validators سوى مقارنة دور target owner في ثابت last-owner داخل Team؛ هذه مقارنة سلامة ملكية وليست role→capability mapping.

## 4. Capability Vocabulary

المفردات القانونية في `CAPABILITIES` هي 47 قدرة: Workspace (7)، customers (4)، leads (4)، CRM (3)، services (2)، bookings (3)، properties (3)، rental units (3)، reservations (3)، housekeeping (3)، invoices/payments/refunds (6)، reports (2)، وWebsite Platform-only (5).

أضيفت قدرات ضيقة تحفظ الاستثناءات المعتمدة: `crm.pipeline.delete` و`properties.archive` و`rental_units.delete`. القدرات الخمس `website.*` معرفة لتصنيف الحدود واختبارها، لكنها غير ممنوحة لأي Workspace role.

## 5. Role Capability Matrix

### Owner — 42

كل القدرات غير `website.*`: Workspace/settings/members كاملة، customers/leads/CRM/services/bookings كاملة، properties وrental units بما فيها archive/delete، reservations/housekeeping كاملة، invoices/payments/refunds والتقارير التشغيلية والمالية.

### Manager — 35

`workspace.read`, `workspace.settings.read`, `workspace.members.read`؛ customers/leads كاملة؛ `crm.pipeline.read/manage` دون delete؛ services وbookings كاملة؛ properties/rental units manage دون archive/delete؛ reservations/housekeeping كاملة؛ invoices/payments/refunds والتقارير التشغيلية والمالية.

### Employee — 11

`workspace.read`, `crm.pipeline.read`, `services.read`, `bookings.read`, `properties.read`, `rental_units.read`, `reservations.read`, `reservations.manage`, `housekeeping.read`, `housekeeping.manage`, `reports.operational.read`.

`reservations.manage` و`housekeeping.manage` لا تعني وصولاً عاماً: الخدمات تبقي assignment check وانتقالات الموظف الضيقة. لا يملك الموظف customers/leads/team/settings/financial/Website capabilities.

## 6. Authorization API

- `hasCapability(context, capability)` pure، ويعيد false للدور أو القدرة غير المعروفين.
- `requireCapability(context, capability)` يرمي `AuthorizationError` مضبوطاً.
- `requireActiveWorkspaceCapability(capability)` يحل Active Workspace المتحقق ثم يفرض القدرة.
- `requirePageCapability(capability)` يحول رفض القدرة إلى `notFound()` حتى لا يكشف وجود resource خارج النطاق.
- `WorkspaceContext` و`AuthorizedWorkspace` يعرضان قائمة القدرات المشتقة لحظياً من role المتحقق.

لا تختار أي دالة capability مساحة عمل ولا تقبل role/capability من العميل.

## 7. Active Workspace Integration

التسلسل الفعلي: Supabase UUID → internal user → active membership غير محذوفة → Active Workspace صريحة → role من العضوية المختارة → `ROLE_CAPABILITIES` → الصفحة/action/service. تغير الدور يُقرأ من DB في الطلب التالي؛ لا تخزن القدرات في cookie أو localStorage.

## 8. Financial Boundary

الموظف لا يملك `invoices.*`, `payments.*`, `refunds.manage`, أو `reports.financial.read`. صفحات Analytics/Payments/Invoices ترفض مباشرة، وروابطها تختفي. Server Actions المالية ترفض قبل validation أو service call. خدمة invoice نفسها تفرض القدرة على reads/mutations/aggregates، وDashboard لا يشغل queries المالية أصلاً عند غياب القدرة. أزيل استثناء employee المسند من invoice scope وتسجيل الدفعة.

## 9. Team Permissions

`workspace.members.read` للمالك والمدير. `invite/update/remove` للمالك فقط. UI المدير read-only، والاستدعاء المباشر يرفض قبل الخدمة. بقيت حواجز عدم تعديل الذات وعدم إزالة/خفض آخر owner. لا يستطيع employee رؤية directory أو تصعيد نفسه، ولا يستطيع manager تنفيذ owner-only mutation.

## 10. Settings Permissions

المالك والمدير يقرآن الإعدادات؛ المالك وحده يحدثها. manager يحصل على fieldset read-only ولا يرى save/reset. Business Profile يستخدم القدرة نفسها لتحديث Workspace، بينما services داخل الصفحة تستخدم `services.manage`، لذلك يستطيع manager إدارة الخدمات من دون امتلاك إعدادات المالك.

## 11. CRM/Operational Permissions

customers وleads محجوبان عن employee لأن المصفوفة تسجل employee كـ«قرار» ويفشل مغلقاً. CRM pipeline يبقي employee على السجلات المسندة فقط؛ manager/owner يديران. لا يتم تشغيل self-healing pipeline أو تحميل customer/team option directories للموظف. services read للموظف وmanage للمالك/المدير.

## 12. Property/Reservation Permissions

property/building/unit reads متاحة للأدوار الثلاثة؛ mutations owner/manager مع archive/delete للمالك فقط. Reservation وHousekeeping employees يرون السجلات المسندة ويستخدمون transitions الضيقة الحالية؛ create/reassign/full edit/cancel تتطلب قدرات O/M. الخيارات الحساسة الخاصة بالعملاء والفريق لا تُحمّل للموظف.

Bookings أصبحت scoped بالـ`membershipId`: الموظف يرى الحجوزات المسندة فقط، وإحصاءاته على النطاق نفسه، ولا تُحمّل له قوائم customers/services المستخدمة في mutation forms.

## 13. Billing Permissions

المالك والمدير يملكان invoice/payment/refund capabilities. الموظف denied قبل query في `listInvoices` و`listPayments` وinvoice detail helpers، وقبل كل action. تقارير revenue/outstanding/recent payments تتطلب `reports.financial.read` في service نفسها.

## 14. Platform-only Boundary

`website.content.read`, `website.content.update`, `website.design.manage`, `website.publish`, و`website.domain.manage` غير ممنوحة لأي Workspace role. اختفى nav، وكل من builder page وdraft preview و16 Website Actions وخمس Domain Actions يرفض خادمياً حتى owner. Public renderer وpublic contact ingestion لم يتغيرا. لم يُنفذ Platform Admin؛ إعادة إتاحة هذه الوظائف تنتظر حد Sprint 2/10 منفصلاً.

## 15. Route Enforcement

كل 22 `page.tsx` داخل `(dashboard)` تستدعي `requirePageCapability` قبل data fetch. Direct URL غير المصرح به ينتج not-found مضبوطاً. layout يبقي auth + Active Workspace gate. لا يعتمد أي route على nav hiding.

## 16. Action Enforcement

كل 86 Workspace-sensitive exported Server Actions في 20 ملفاً تستخدم `requireActiveWorkspaceCapability`. Auth actions وActive Workspace switch مستثناة عمداً: الأولى public/session lifecycle، والثانية تتحقق من identity وmembership ولا تمثل domain capability. validation يحدث بعد capability في العمليات الحساسة، ولا يقبل action role أو capability أو workspace authority من FormData.

## 17. Service Enforcement

حد enforcement الرئيسي هو page/action الذي يمرر Workspace ID المشتقة فقط. أضيف defense-in-depth مباشر إلى booking/property/building/rental-unit/reservation/housekeeping/invoice/dashboard services، مع بقاء record-assignment/state-machine guards. خدمات legacy read والمساعدة ليست endpoints؛ تستدعى بعد boundary موثق. أي caller جديد ملزم بتمرير `WorkspaceContext` أو استخدام authorization boundary، ولا يجوز استدعاء service الخام من route/action جديد.

## 18. API Enforcement

لا توجد Workspace-authenticated API routes حالياً. المسار الوحيد تحت `app/api` هو public contact form؛ بقي على نموذج public-input validation/rate/security ولا يُجبر على membership. External Client API مؤجل Sprint 7.

## 19. UI Permission Integration

كل NavItem يحمل `Capability` typed ويصفى عبر `hasCapability`. أزيلت مقارنات role المباشرة من dashboard UI؛ property/reservation/housekeeping/invoice action visibility تستخدم registry نفسها. Team/Bookings/Settings/Business Profile حصلت على read-only states مشتقة خادمياً من نفس القدرات. UI convenience فقط، والخادم يعيد الفرض مستقلاً.

## 20. Confused-Deputy Tests

اختبار DB يثبت manager في A وowner في B: اختيار A لا يمنح `workspace.settings.update`، والاختيار الصريح B يمنحها. candidate/resource B لا يغير A، والقدرات تقرأ role من context المختارة فقط.

## 21. Membership/Role Change Tests

اختبار التكامل يثبت manager→employee ثم employee→manager ويعيد resolver في كل مرة، فتتغير `reports.financial.read` فوراً. اختبارات B5 تثبت أن suspended/deleted membership وWorkspace المحذوفة تفشل قبل capability evaluation.

## 22. RLS vs Workspace vs Capability

- **RLS:** هل هوية Auth عضو tenant صالح؟ وتمنع عبور Workspace مباشرة.
- **Active Workspace:** أي Workspace يعمل الطلب داخلها؟
- **Capability:** ماذا يسمح لدور العضوية الحالية أن يفعل داخل تلك Workspace؟

RLS الحالية membership-only و`FOR ALL`; لم تحولها B6 إلى role policies ولم تفعل FORCE RLS. لذلك التطبيق يفرض least privilege، وRLS تبقى tenant boundary كما هو معتمد لهذه المهمة.

## 23. Coverage Matrix

| Operation                     | Capability                        | Server enforcement           | Allowed                               | Tests                       |
| ----------------------------- | --------------------------------- | ---------------------------- | ------------------------------------- | --------------------------- |
| dashboard operational         | `reports.operational.read`        | page + scoped services       | O/M/E                                 | capability + B5             |
| dashboard/analytics financial | `reports.financial.read`          | page/action/service          | O/M                                   | validator/action            |
| members read/manage           | `workspace.members.*`             | page/actions/team guards     | read O/M؛ manage O                    | direct action + RBAC        |
| settings read/update          | `workspace.settings.*`            | page/actions                 | read O/M؛ update O                    | matrix/direct helper        |
| customers/leads               | domain CRUD capabilities          | page/actions                 | O/M                                   | matrix + full suite         |
| CRM                           | `crm.pipeline.read/manage/delete` | page/actions/scoped services | scoped E؛ manage O/M؛ delete O        | matrix/scope tests          |
| services                      | `services.read/manage`            | page/actions                 | read O/M/E؛ manage O/M                | matrix/full suite           |
| bookings                      | `bookings.read/manage/assign`     | page/action/service          | scoped E؛ O/M manage                  | capability + service scope  |
| property/unit                 | read/manage/archive/delete        | page/action/service          | E read؛ O/M manage؛ owner destructive | direct service + validators |
| reservation/housekeeping      | read/manage/assign                | page/action/service          | scoped E؛ O/M full                    | scope/state tests           |
| invoices/payments/refunds     | financial capabilities            | page/action/service          | O/M                                   | direct action/service/RBAC  |
| website/domain/publish        | `website.*`                       | page/actions                 | none                                  | matrix + direct action      |
| public contact                | public contract                   | public route/service         | anonymous                             | existing public tests       |

لا توجد capability بلا matrix test، ولا Workspace dashboard page بلا route gate، ولا sensitive Workspace Action بلا capability gate، ولا UI role matrix ثانية.

## 24. Security Findings

- أغلقت ثغرة employee invoice/payment المباشرة.
- أغلقت tenant Website Builder/publish/domain actions وdirect URLs.
- أغلقت legacy customer/service/booking/payment/lead write paths عبر action boundaries.
- حُصر booking employee بالمسند ومنع option-directory leakage.
- القدرات unknown وrole unknown fail closed.
- لا HIGH/CRITICAL application authorization bypass معروف بعد الاختبارات.

## 25. Deferred Ownership Invariant

يبقى `workspaces.owner_id` وowner membership تمثيلين قد ينحرفان. B6 تستخدم role العضوية الحالية المتحققة كما اعتمد Sprint 1. عمليات team تحافظ last-owner/self guards، لكن exactly-one matching owner invariant وtransfer lifecycle مهمة مستقلة؛ لم تغير B6 schema أو الملكية.

## 26. Remaining Risks

- RLS role-equivalence باقية عمداً؛ authenticated direct PostgREST within-tenant لا تفرض capability حتى rollout RLS المعتمد لاحقاً.
- runtime Drizzle role قد يتجاوز RLS؛ service scoping يبقى إلزامياً.
- service modules الداخلية ليست public boundary؛ أي caller جديد قد يتجاوز B6 إذا خالف قاعدة page/action/context، لذلك يجب أن تفشل مراجعة الكود عند ذلك.
- CRM opportunity value جزء من domain pipeline المعتمد للـemployee assigned read؛ إذا اعتبره المنتج financial reporting لاحقاً يلزم قرار matrix جديد قبل تغييره.
- owner dual-source، suspended co-member helper، وPlatform Admin implementation مؤجلة كما سبق.

## 27. Next-phase Prerequisites

يمكن بدء المهمة المعتمدة التالية فقط بعد مراجعة B6. Platform Admin يحتاج boundary وهوية/capabilities مستقلة ولا يعيد استخدام owner. أي role-aware RLS migration تحتاج موافقة منفصلة. Active Store وStore schema يبقيان خارج B6.

## 28. Acceptance Criteria

نتائج التحقق النهائية: 46 ملف unit و655 اختباراً ناجحاً؛ وحزم Local Supabase المعتمدة ناجحة (Database Safety ‏78/78، B3 RLS ‏33/33، B3.2 Relationships ‏4/4، B4 Identity ‏11/11، B5/B6 Active Workspace ‏10/10). كما نجحت typecheck وlint بلا تحذيرات، ونجح production build، و`git diff --check` نظيف.

- [x] registry typed واحد، 47 capability، وثلاثة roles فقط.
- [x] unknown role/capability denied.
- [x] 22/22 dashboard pages خادمية capability-aware.
- [x] 86/86 Workspace Server Actions capability-aware.
- [x] employee financial access denied في page/action/service.
- [x] team escalation owner-only مع self/last-owner guards.
- [x] confused-deputy وrole-change وrevocation مثبتة.
- [x] Website/design/publish/domain denied لكل Workspace role.
- [x] UI والخادم يستخدمان vocabulary نفسها.
- [x] B3/B3.2/B4/B5 regressions ناجحة.
- [x] unit/typecheck/lint/build/diff-check ناجحة.
- [x] لا migration أو custom roles أو Platform Admin أو Active Store أو Store schema أو FORCE RLS.
