# C2 — حماية مسارات Platform Admin وأساس الـAdmin Shell

## 1. النتيجة التنفيذية

أضيف route group مستقل داخل `apps/web` لمساري `/admin` و`/admin/workspaces`،
مع server layout gate وpage-level gate يعتمدان حصراً على حد C1 وقدرة
`platform.workspaces.read`. لا يعتمد الدخول أوnavigation على Workspace role أو
Active Workspace أوclient state.

أضيف shell منصة محدود ومختلف بصرياً وبنيوياً عن tenant dashboard. يعرض Platform
context وبيانات الحساب الآمنة وsign out،ولا يعرض Workspace switcher أوtenant
navigation أوWorkspace role أوStore navigation. صفحة Workspaces placeholder
مقصودة فقط لإثبات navigation وdirect URL authorization؛لا تجلب بيانات ولا تنفذ
lifecycle operations.

لم تُنشأ application جديدة،ولم تتغير middleware أوmigration أوschema أوcatalog
أوtenant UI.

## 2. تدقيق ما قبل التنفيذ

ثبت قبل التعديل:

- الفرع `develop` وHEAD
  `ee3ac8db2c6e72ecc754a8f67760d62deeb4b87e`.
- تغييرات B2 وC1 غير الملتزمة بقيت موجودة ولم يحدث reset أوrestore أوclean.
- لا يوجد route سابق تحت `/admin` ولا تعارض أسماء.
- routes المصادق عليها حالياً تقع في `(dashboard)` وتستخدم server layout،ثم
  `requirePageCapability()` في الصفحات الحساسة.
- denial المعتاد للقدرات داخل الصفحات هو `notFound()` لتجنب كشف وجود resource.
- dashboard shell يمرر Active Workspace وrole إلى Workspace navigation؛لذلك لم
  يعد استخدامه مناسباً للمنصة.
- Next 16 root proxy يشغل `updateSession()` لكل request مطابق ويعيد التحقق من
  Supabase user. قائمة protected prefixes تضيف session-presence redirects فقط،
  ولا تنفذ capability authorization.

## 3. بنية routes

```text
apps/web/app/(platform-admin)/admin/
├── layout.tsx
├── page.tsx
└── workspaces/
    └── page.tsx
```

الـroute group لا يظهر في URL. أظهر production build المسارين الديناميكيين:

```text
ƒ /admin
ƒ /admin/workspaces
```

لم تُنشأ `/admin/workspaces/new` أو`[workspaceId]` لأن C2 لا تحتاجهما لإثبات
الحد،وإنشاؤهما الآن سيوسع placeholders بلا فائدة.

## 4. مسار authorization

كل request إلى route منشأ يمر بالترتيب:

1. root proxy يجدد/يتحقق من Supabase session كالمعتاد بلا Platform claims.
2. `PlatformAdminLayout` يستدعي
   `requirePlatformPageCapability("platform.workspaces.read")`.
3. helper يستدعي C1 `requirePlatformCapability()`،الذي يعيد اشتقاق Platform
   identity من immutable Auth UUID و`platform_admins` ويطلب active status وقدرة
   مسجلة.
4. denial من نوع `PlatformAuthorizationError` يتحول إلى `notFound()`.
5. بعد نجاح الحد فقط يشتق server navigation ويعرض shell.
6. كل من الصفحتين المنشأتين يكرر page-level gate قبل بناء محتواه. هذا يمنع
   الاعتماد على layout وحده،ويؤسس النمط المطلوب للصفحات التي ستجلب بيانات لاحقاً.

لا تقبل هذه السلسلة Platform Admin ID أوrole أوmembership أوcookie أوcapability
claim من client. capability المطلوبة ثابتة في server route.

## 5. سلوك الرفض

القرار هو controlled `notFound()` لكل Platform authorization denial،بما فيه
unauthenticated وtenant-only وsupport وsuspended. يتوافق ذلك مع page-capability
convention الحالية ويمنع تأكيد وجود Platform Admin hierarchy أوتمييز سبب الرفض.

لا تعرض layout أوnavigation أوplaceholder قبل نجاح capability gate. أضيفت
`robots: { index: false, follow: false }` كإشارة indexing دفاعية،وليست security
boundary.

لم يضف `/admin` إلى middleware protected prefixes. السبب أن proxy يشغل session
refresh و`getUser()` أصلاً لكل route مطابق،بينما إضافة prefix ستجعل
unauthenticated redirect قبل server gate وتنتج سلوك denial مختلفاً. Platform
identity/capability lookup يحتاج DB ويفضل بقاؤه server-owned قرب route،لا في
middleware أوcookie claims.

## 6. فصل Admin shell

`components/platform-admin/admin-shell.tsx` shell مستقل وليس wrapper للـWorkspace
dashboard. يحتوي:

- علامة `Verix Platform / Administration console` واضحة.
- Platform role مشتق من trusted context ومهيأ للعرض.
- اسم حساب Supabase الموثوق وsign out عبر `logoutAction` القائمة.
- aside/navigation منصة مستقل.
- current section داخل الصفحة وعبر `aria-current` في navigation.
- chrome وألوان منفصلة عن tenant shell.

لا يحتوي:

- Active Workspace switcher أوWorkspace ID.
- Workspace role أوtenant breadcrumbs/navigation.
- tenant settings/billing/profile links.
- Store أوCommerce أوWhite Label navigation.

لا يمرر opaque Platform context إلى Client Component؛الserver يحوله إلى
navigation DTO محدود،ويمرر role للعرض فقط بعد اكتمال authorization. الدور
المعروض ليس authorization input.

## 7. navigation المبني على capabilities

`platformNavigationFor()` يستقبل context C1 الموثوق ويفحص كل عنصر باستخدام
runtime `hasPlatformCapability()` ذي brand وWeakSet. لا يوجد `if role ===
"super_admin"` للتحكم في الظهور.

| العنصر     | المسار              | القدرة المطلوبة            |
| ---------- | ------------------- | -------------------------- |
| Overview   | `/admin`            | `platform.workspaces.read` |
| Workspaces | `/admin/workspaces` | `platform.workspaces.read` |

لم يضف Platform Audit item لأن C2 لا تنشئ Audit route/UI؛إظهاره كرابط ميت لا
يحقق فائدة. يضاف لاحقاً فقط مع route معتمد وبقدرة `platform.audit.read`.

active Super Admin يرى العنصرين. Support Admin context له capabilities فارغة
فينتج navigation فارغاً،لكن layout نفسه يرفضه قبل العرض. forged owner/manager/
employee/super_admin objects تنتج قائمة فارغة لأنها لم تصدر من C1 boundary.

## 8. Cross-boundary isolation

الاختبارات عبر C1 helper الحقيقي أثبتت:

- active Super Admin يدخل `/admin` و`/admin/workspaces` مباشرة.
- unauthenticated وauthenticated بلا membership وOwner وManager وEmployee
  يفشلون جميعاً.
- active Support Admin يفشل لأن مصفوفته `[]`.
- suspended Super Admin يفشل قبل بناء shell.
- actor مزدوج Workspace Owner + Platform Super Admin يدخل بسبب Platform row
  فقط.
- إزالة Platform identity أوتعليقها تمنع الدخول مع بقاء Workspace Owner.
- forged `platformRole` وActive Workspace cookie/state لا يدخلان في resolver ولا
  يغيران النتيجة.
- unknown/infrastructure errors لا تحول خطأً إلى authorization denial؛تعاد إلى
  error boundary للمراقبة.

لا يوجد رابط `/admin` في tenant shell حتى للactor المزدوج. قرار C2 هو minimal
exposure:no cross-shell link. الوصول المباشر المصرح آمن،وأي account-context
switcher مستقبلي يحتاج قرار UX وأدلة authorization منفصلة.

## 9. دليل الاختبارات

### 9.1 الاختبارات المركزة

| المجموعة                                |                النتيجة |
| --------------------------------------- | ---------------------: |
| C1 identity/capability/authorization    | `25/25` في `3/3` ملفات |
| C2 page gate/direct URL/navigation      | `29/29` في `3/3` ملفات |
| Workspace page/navigation authorization |   `5/5` في `2/2` ملفين |
| Active Workspace integration            |   `14/14` في `1/1` ملف |

### 9.2 التطبيق والجودة

| البوابة                         |                                            النتيجة |
| ------------------------------- | -------------------------------------------------: |
| full web unit/application suite |                         `711/711` في `52/52` ملفاً |
| repository typecheck            |                                   PASS؛`3/3` tasks |
| repository lint                 |                     PASS؛`3/3` tasks،zero warnings |
| production build                | PASS؛`2/2` tasks؛المساران ظاهران في route manifest |
| `git diff --check`              |                                               PASS |

### 9.3 database/ACL regression

استُخدم repository-local Supabase فقط على `127.0.0.1`:

- canonical verifier:ledger=`7`،grants=`0`،`ADOPTABLE`.
- PostgREST ACL:`10/10`.
- fingerprint بقي:
  `9df35d82ec24c7c8e630108e0366a9c673ba42ca2d8c07e1a191e1bdfeef16cb`.

لم تنشأ migration،ولم تتغير schema أوRLS أوACL أوcatalog.

## 10. ملفات C2

- `apps/web/app/(platform-admin)/admin/layout.tsx`.
- `apps/web/app/(platform-admin)/admin/page.tsx`.
- `apps/web/app/(platform-admin)/admin/workspaces/page.tsx`.
- `apps/web/components/platform-admin/admin-shell.tsx`.
- `apps/web/components/platform-admin/admin-nav.tsx`.
- `apps/web/src/server/auth/platform-page-authorization.ts` واختباره.
- `apps/web/src/server/auth/platform-navigation.ts` واختباره.
- `apps/web/src/server/auth/platform-route-access.test.ts`.
- هذا التقرير.

لم يحتج `SPRINT_02_IMPLEMENTATION_PLAN_AR.md` أوADR-003 إلى تعديل factual أو
sequencing.

## 11. المخاطر المتبقية وحد المهمة

- Workspaces page placeholder بلا queries أوactions عمداً. C3 وما بعدها يجب أن
  تضع authorization في page وservice،ولا تعتمد layout وحده لحماية البيانات.
- لا يوجد account switcher أوtenant-to-admin link. هذا يقلل exposure لكنه يعني
  أن Platform Admin يستخدم direct URL في C2.
- لا يوجد Platform Audit navigation حتى تنشأ route/UI معتمدة.
- logout يعيد استخدام auth action العامة؛لا توجد Platform session منفصلة،وهذا
  يطابق قرار ADR-003 الحالي.
- Platform status/capability changes تظهر في الطلب التالي حسب request-scoped
  cache المعتمد في C1.
- لا توجد Workspace lifecycle أوPlatform Audit أوbootstrap operations في C2.

## 12. القرار

المسارات المنشأة محمية server-side في layout والصفحة،والـshell منفصل عن tenant
context،والnavigation مشتق من capabilities موثوقة،وكل actor غير المعتمد يفشل
بلا كشف Platform structure. بقيت ضمانات C1 وB2 وSprint 1 سليمة.

**C2: PASS — PLATFORM ROUTES PROTECTED**
