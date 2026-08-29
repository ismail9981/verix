# B6.2 — تصميم معالجة تجاوز القدرات عبر PostgREST وتدقيق الاعتماديات

**نوع المهمة:** تصميم وتدقيق اعتماديات فقط
**السبرنت:** Sprint 1 — Identity and Tenant Isolation Hardening
**الفرع:** `develop`
**تغيير قاعدة البيانات:** لا يوجد في B6.2
**حالة B6 قبل المعالجة:** `FAIL` وفق إثبات B6.1

## 1. الملخص التنفيذي

أثبت B6.1 أن جلسة Supabase العادية تمنح مستخدم Workspace JWT صالحاً، وأن دور `authenticated` يملك `SELECT`, `INSERT`, `UPDATE`, و`DELETE` على جداول Verix الثلاثين. وبما أن سياسات RLS الحالية تختبر العضوية فقط ولا تفرق `owner` و`manager` و`employee`، يستطيع المستخدم تنفيذ عمليات تمنعها مصفوفة B6 عبر Data API مباشرة.

أعاد B6.2 تدقيق كل استعمال إنتاجي لـSupabase وكل مسار قراءة وكتابة في المستودع. النتيجة الحاسمة: **لا توجد ميزة إنتاجية واحدة تعتمد على CRUD مباشر من المتصفح أو من Supabase Data API بدور `anon` أو `authenticated`.** Supabase مستخدم للمصادقة فقط. كل بيانات Dashboard، Server Actions، الخدمات، العرض العام للمواقع، حل الدومينات، وpublic lead submission تمر عبر خادم Verix وتستخدم Drizzle/postgres.js مع `DATABASE_URL`.

لذلك التوصية هي **Option A كأساس فوري: سحب CRUD المباشر من `authenticated` والإبقاء على Server Actions/Route Handlers بوابة المجال الوحيدة**، مع جزء ضيق من Option C لإغلاق RPCs الداخلية المعروضة حالياً. لا يوجد استثناء جدولي مطلوب الآن. Role-aware RLS يبقى هدف دفاع إضافي لاحق، لكنه ليس العلاج الأقل خطراً أو الأسرع لإغلاق B6 حالياً.

## 2. سبب التصميم

B6 فرضت القدرات في UI والصفحات وServer Actions والخدمات، لكنها لم تغير ACL أو RLS. B6.1 أثبت أن هذا ليس قيداً نظرياً: JWT المستخدم نفسه يكفي لاستدعاء `/rest/v1` وتجاوز طبقات B6، بما يشمل البيانات المالية وTeam وSettings وWebsite Builder والحدود الخاصة بالمنصة.

الهدف هنا ليس إعادة تصميم RLS أو تنفيذ SQL، بل إثبات الاعتماديات التي ستتأثر بسحب Data API المباشر واختيار معمارية معالجة قابلة للتنفيذ في مهمة لاحقة معتمدة.

## 3. نطاق التدقيق

شمل التدقيق:

- كل `apps`, `packages`, Client Components، Server Components، Route Handlers، Server Actions، auth utilities، والخدمات.
- كل imports لـ`@supabase/ssr` و`@supabase/supabase-js` ومتغيرات Supabase.
- كل استعمالات `.from()`, `.rpc()`, `.storage`, Realtime channels، `fetch`, وWebSocket/EventSource.
- العرض العام للمواقع، host routing، snapshots، robots، sitemap، social image، ونموذج Contact العام.
- Drizzle/postgres.js وملفات schema والخدمات.
- Supabase المحلي: schemas المعروضة، ACL المثبتة في B6.1، functions العامة وحقوق EXECUTE.

لم يُفحص hosted أو production، ولم تُستخدم أي قاعدة خارج stack المحلي.

## 4. جرد عملاء Supabase الإنتاجيين

| الملف/السطح                     | النوع                                                        | الاستعمال الفعلي                                   | Data API CRUD؟ | أثر سحب CRUD من `authenticated` |
| ------------------------------- | ------------------------------------------------------------ | -------------------------------------------------- | -------------: | ------------------------------- |
| `src/server/auth/client.ts`     | Authenticated server client عبر `@supabase/ssr` والـanon key | قراءة/كتابة session cookies واستدعاء Supabase Auth |             لا | لا أثر                          |
| `src/server/auth/middleware.ts` | Authenticated server client في Proxy                         | `auth.getUser()` وتجديد session وحماية routes      |             لا | لا أثر                          |
| `src/server/auth/session.ts`    | Auth utility                                                 | `auth.getUser()` فقط                               |             لا | لا أثر                          |
| `src/server/actions/auth.ts`    | Server Actions للمصادقة                                      | sign-in، sign-up، reset، update password، sign-out |             لا | لا أثر                          |
| `app/auth/confirm/route.ts`     | Auth Route Handler                                           | `auth.verifyOtp()`                                 |             لا | لا أثر                          |
| `src/server/lib/supabase.ts`    | Server-only service-role client                              | تعريف client فقط؛ لا مستهلك إنتاجي في المستودع     |             لا | لا أثر                          |
| Auth form Client Components     | Browser UI                                                   | تستدعي Next Server Actions فقط                     |             لا | لا أثر                          |

لا يوجد `createBrowserClient`، ولا Supabase client منشأ داخل Client Component، ولا import لـSupabase في UI المجال. ملف `.env.example` يعرض URL/anon key لأن Auth SSR يحتاجهما، ولا يجعل ذلك CRUD المباشر اعتماداً مشروعاً.

## 5. تصنيف استعمالات Supabase

| التصنيف المطلوب               | النتيجة                                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Auth only                     | موجود: login/signup/logout/reset/OTP/getUser/session refresh                                                |
| Direct PostgREST table access | **صفر استعمال إنتاجي**                                                                                      |
| RPC                           | **صفر استدعاء إنتاجي من Supabase client**؛ توجد ثلاثة helpers عامة قابلة للاستدعاء مباشرة كما يوضح القسم 11 |
| Storage                       | **غير مستخدم إنتاجياً**؛ لا upload/download/signed URL أو bucket policy في التطبيق                          |
| Realtime                      | **غير مستخدم إنتاجياً**؛ لا channel/subscribe/postgres_changes                                              |
| Server-only Supabase usage    | service-role client معرف لكنه غير مستورد من أي مسار إنتاجي                                                  |

تفعيل Storage وRealtime في `supabase/config.toml` هو توفر منصة محلية، وليس اعتماد تطبيق. `connect-src` الذي يسمح لـSupabase/WebSocket في CSP لا يثبت استعمالاً؛ يمكن مراجعته لاحقاً كتقليل surface، لكنه ليس شرط معالجة B6.

## 6. جلسة المتصفح والاعتماديات الفعلية

B6.1 أثبت أن المستخدم يملك credential قابل للاستعمال. عميل SSR يحفظ جلسة Supabase في cookies، والإعداد الافتراضي للنسخة المثبتة من `@supabase/ssr` هو `httpOnly: false`. كما أن `NEXT_PUBLIC_SUPABASE_URL` و`NEXT_PUBLIC_SUPABASE_ANON_KEY` عامان عمداً. لذلك يستطيع المستخدم نسخ token الخاص به أو تسجيل الدخول إلى Auth endpoint بنفس بياناته ثم استدعاء Data API.

هذه الحقيقة لا تتغير بسحب table CRUD: يبقى JWT ضرورياً للمصادقة، لكنه لا يعود credential للوصول المباشر إلى جداول المجال. لا تعتمد المعالجة على إخفاء URL أو anon key؛ كلاهما public by design.

## 7. مسارات Server Actions والخدمات

يوجد 22 ملف Server Action إنتاجياً، منها auth وActive Workspace و20 مجالاً. Client Components تستورد هذه Server Actions ولا تنفذ SQL أو PostgREST. التدفق المعتاد هو:

```text
Client Component
→ Next Server Action
→ immutable identity + Active Workspace + B6 capability
→ service/validator
→ Drizzle ORM
→ postgres.js DATABASE_URL
```

الخدمات والـauth context والـhosting تستورد `db`/Drizzle مباشرة. بعض Server Components الموثوقة تقرأ Drizzle مباشرة أيضاً بعد page capability gate. لا يمر أي منها عبر دور Supabase `authenticated` أو anon key.

## 8. أثر سحب `authenticated` CRUD على الخادم

سحب privileges من PostgreSQL role باسم `authenticated` لا يغير اتصال Drizzle ما دام `DATABASE_URL` يستخدم runtime role مستقلاً لا يرث `authenticated`. في Supabase المحلي الدور الحالي لـDrizzle هو `postgres` المالك/BYPASSRLS، ولذلك لا يتأثر.

لا يجوز افتراض اسم أو خصائص runtime role المستضاف من المستودع. قبل rollout مستقبلي يجب تنفيذ probe read-only معتمد لكل بيئة يثبت:

1. `current_user` لاتصال `DATABASE_URL` ليس `authenticated` ولا `anon`.
2. لا يرث runtime role أياً منهما.
3. يملك privileges اللازمة لكل services الحالية.
4. migration role وruntime role موثقان، حتى لو بقي الفصل الكامل مهمة hardening لاحقة.

هذه preflight تشغيلية وليست dependency application جديدة.

## 9. Server Components وDashboard

كل صفحات Dashboard تقرأ عبر services أو Drizzle على الخادم. B6 أضافت page capability gate قبل fetch. بعض الصفحات تستورد `db` مباشرة لتحميل options scoped بعد gate؛ هذه أيضاً server-side ولا تعتمد PostgREST.

النتيجة: سحب CRUD المباشر لا يغير rendering أو loading أو Server Action mutations أو capability decisions.

## 10. العرض العام والنماذج العامة

### Public site rendering

- host resolution يقرأ `site_domains` و`sites` عبر Drizzle في `proxy.ts`.
- public page وrobots/sitemap/social metadata تقرأ published `site_versions.snapshot` عبر server service.
- المتصفح يستلم HTML/snapshot-rendered UI، وليس Supabase credential خاصاً بقراءة الجداول.

### Public Contact form

- المتصفح يستدعي فقط `/api/public/forms/contact` عبر same-origin `fetch`.
- Route Handler يتحقق من host/site/published snapshot/form/rate limits.
- `createLeadFromPublicSubmission` يكتب `leads` عبر Drizzle.
- لا يحتاج `anon` إلى INSERT على `leads` أو SELECT على sites/versions.

إذن لا يوجد public/anonymous table grant مطلوب. الإبقاء على public form داخل Verix route هو التصميم الصحيح لأنه يحافظ على validation، rate limiting، trusted tenant derivation، والأخطاء العامة.

## 11. الجداول والـviews والـfunctions المعروضة

### الجداول

الجداول الثلاثون المملوكة لـVerix تحصل حالياً على CRUD كامل لدور `authenticated`: `ai_conversations`, `ai_messages`, `bookings`, `buildings`, `crm_activities`, `crm_opportunities`, `crm_pipelines`, `crm_stages`, `customers`, `files`, `housekeeping_tasks`, `integrations`, `invoice_line_items`, `invoices`, `leads`, `notifications`, `page_sections`, `pages`, `payments`, `properties`, `rental_units`, `reservations`, `services`, `settings`, `site_domains`, `site_versions`, `sites`, `team_members`, `users`, و`workspaces`.

`anon` و`service_role` لا يملكان table CRUD في الحالة canonical الحالية. runtime `postgres` المحلي يملك كل privileges بصفته owner. لا توجد view تطبيقية يعتمد عليها المتصفح.

### Functions/RPC

PostgREST يعرض schema `public`. ثلاثة RLS helpers في `public` تمنح EXECUTE إلى `anon` و`authenticated`:

- `current_workspace_ids()`
- `current_comember_ids()`
- `current_conversation_ids()`

لا يستدعي التطبيق أياً منها عبر RPC؛ تستعملها policies فقط. لكنها قابلة للاستدعاء يدوياً عبر `/rest/v1/rpc/*`. خصوصاً `current_comember_ids()` يمكن أن يكشف identifiers لدليل الفريق لموظف تمنعه B6 من `workspace.members.read`.

لذلك معالجة table ACL وحدها لا تكفي لإعلان Data API surface مغلقاً بالكامل. في migration المستقبلية الموصى بها يجب سحب EXECUTE المباشر من `anon` و`authenticated` لهذه helpers ما دامت لا توجد table grants تحتاجها. البديل الأطول أجلاً هو نقل helpers التي تحتاجها RLS إلى schema داخلية غير معروضة عبر PostgREST ومنح EXECUTE الضيق هناك.

Trigger functions الأخرى و`enforce_auth_user_id_immutability()` لا تمنح EXECUTE لأدوار التطبيق، ولا يوجد RPC إنتاجي مشروع.

## 12. الاعتماديات الشرعية المباشرة

| السطح                 |                                   `anon` مباشر |      `authenticated` مباشر | القرار                              |
| --------------------- | ---------------------------------------------: | -------------------------: | ----------------------------------- |
| جداول المجال الثلاثون |                                             لا |                         لا | سحب CRUD                            |
| Public renderer       |                                             لا |                         لا | يبقى Drizzle server-side            |
| Public lead form      |                                             لا |                         لا | يبقى Route Handler + Drizzle        |
| Auth endpoints        | يستخدم anon key لبروتوكول Auth، لا table grant | JWT للجلسة، لا table grant | لا تغيير                            |
| RLS helper RPCs       |                                      لا اعتماد |                  لا اعتماد | سحب direct EXECUTE أو نقلها داخلياً |
| Storage               |                                             لا |                         لا | لا استثناء                          |
| Realtime              |                                             لا |                         لا | لا استثناء                          |
| GraphQL/Data API      |                                             لا |                         لا | يغلق تلقائياً مع ACL الجدول         |

**العدد الحالي للاستثناءات المطلوبة: صفر.**

## 13. Option A — سحب CRUD وفرض Server Boundary

### التصميم

- `REVOKE SELECT, INSERT, UPDATE, DELETE` من `authenticated` على كل جداول Verix managed.
- تأكيد عدم امتلاك `anon` و`service_role` grants عامة، وعدم منح future tables تلقائياً.
- سحب EXECUTE المباشر من helpers العامة الثلاثة أو نقلها إلى schema غير معروضة في مرحلة لاحقة.
- تبقى Auth API والجلسة كما هي.
- كل domain read/write يمر عبر Server Component/Action/Route Handler ثم B6 والخدمات وDrizzle.

### المزايا

- يغلق bypass المثبت عند أقرب حد وبأقل مساحة تغيير.
- لا يكرر Capability Matrix في 30 policy معقدة.
- متوافق مع التطبيق الحالي بلا إعادة كتابة UI أو services.
- fail-closed: أي client جديد لا يحصل Data API تلقائياً.
- يغلق PostgREST وGraphQL المبنيين على PostgreSQL ACL معاً.

### العيوب

- RLS الحالية تصبح دفاعاً خاملاً لمسار `authenticated` ما لم تمنح الاختبارات صلاحية مؤقتة لفحصها.
- اتصال Drizzle privileged يبقى محتاجاً service scoping واختبارات B6؛ ACL لا تحمي من خطأ داخل الخادم.
- أي عميل خارجي غير موجود في المستودع يعتمد Data API سيتعطل؛ لذلك يلزم deployment inventory/telemetry check قبل rollout.

## 14. Option B — RLS واعية بالقدرات

### التصميم

تفصل policies حسب SELECT/INSERT/UPDATE/DELETE، وتقرأ role الحالية وتطبق صلاحيات owner/manager/employee وassignment rules لكل domain.

### المزايا

- defense-in-depth حتى عند Data API المباشر.
- يحقق هدف المواصفة طويل الأجل لـrole-aware RLS.
- يسمح بتجارب browser/realtime مباشرة مستقبلاً إذا كانت مقصودة.

### المخاطر

- يكرر منطق 47 capability داخل SQL، مع خطر drift عن registry TypeScript.
- assignment transitions والفوترة وPlatform-only rules تحتاج policies/functions كثيرة ومعقدة.
- لا يوجد حالياً مستهلك يبرر هذا التعقيد العاجل.
- rollout أوسع وأعلى خطراً، ويحتاج migration/policy design واختبارات role-operation لكل جدول.
- لا يحل runtime owner/BYPASSRLS أو service-role misuse.

### الحكم

ليس الخيار الأول لإغلاق B6. يبقى مرحلة defense-in-depth مستقلة بعد فصل runtime/migration roles وعندما يوجد use case فعلي لـData API أو عند تنفيذ خطة RLS الرسمية كاملة.

## 15. Option C — Grants/Views/RPCs انتقائية

### التصميم

يبدأ من deny-all ثم يمنح فقط view أو RPC محدداً بعقد DTO وتفويض داخلي. يناسب public read أو Realtime محدوداً عندما يعتمد لاحقاً.

### المزايا

- أصغر output surface من table CRUD.
- يمكن تثبيت filtering وoperation contract داخل قاعدة البيانات.
- يمنع mass assignment على أعمدة الجدول الخام.

### المخاطر

- كل view/RPC يصبح API أماناً يحتاج versioning واختبارات ومراقبة.
- `SECURITY DEFINER` يضيف مخاطر owner/search_path/input scoping.
- قد يكرر Server Actions بلا فائدة حالية.

### الحكم

لا استثناء مطلوب اليوم. يستخدم فقط لاحقاً عند وجود حالة معتمدة لا تستطيع Server Action/Route Handler تلبيتها، وبعد contract وthreat review منفصلين. الجزء الوحيد المطلوب مع Option A الآن هو **إزالة RPC exposure غير المقصودة** للـRLS helpers، لا إنشاء RPC جديد.

## 16. التوصية النهائية

التوصية هي **Server-boundary architecture: Option A الآن، مع hardening ضيق للـRPC surface من Option C، وOption B مؤجل كدفاع إضافي معتمد**.

الأسباب:

1. التطبيق مبني فعلياً على Server Actions وDrizzle؛ ACL الحالية لا تخدم feature بل تخلق bypass فقط.
2. B6 هي المصدر المركزي للقدرات، وإجبار كل domain access عبرها يمنع ازدواج policy logic الفوري.
3. public rendering وpublic forms تعملان أصلاً خلف server boundary آمنة.
4. لا Storage أو Realtime أو browser CRUD يحتاج استثناء.
5. revoke شامل أبسط في المراجعة والrollback من 30 policy role-aware في خطوة واحدة.
6. التصميم fail-closed للميزات المستقبلية: لا grant جديد بلا dependency وعقد واختبار.

## 17. الأثر المتوقع

- Auth login/signup/reset/OTP/session refresh: لا تغيير.
- Dashboard reads والمutations: لا تغيير متوقع.
- Active Workspace وB6 capabilities: لا تغيير.
- Public sites وSEO/host routing: لا تغيير.
- Contact lead ingestion: لا تغيير.
- direct `/rest/v1` وGraphQL domain requests من anon/authenticated: تصبح blocked by ACL.
- RPC helpers العامة: تصبح غير قابلة للاستدعاء مباشرة بعد companion revoke.
- Supabase Studio/operator access: يعتمد operator/admin role، لا `authenticated`؛ يتحقق في rehearsal.
- أي automation خارج المستودع يستخدم JWT المستخدم وData API: سيتعطل، وهو سلوك أمني مقصود ما لم يعتمد كاستثناء رسمي.

## 18. خطة Migration المستقبلية — غير منفذة هنا

مهمة تنفيذ مستقلة وموافق عليها يجب أن:

1. تأخذ catalog/ACL/function snapshot read-only لكل بيئة مصرح بها.
2. تثبت runtime/migration role membership وprivileges قبل التغيير.
3. تجرد أي consumer خارجي أو deployment integration غير موجود في Git.
4. تنشئ forward migration جديدة بعد رأس التاريخ الحالي؛ لا تعدل `0002` أو أي migration مطبقة.
5. تسحب CRUD من `authenticated` على managed tables وتثبت deny لـ`anon` و`service_role` بلا use case.
6. تسحب EXECUTE المباشر للـhelpers الثلاثة من `anon` و`authenticated`، أو تنقلها إلى schema غير معروضة في migration لاحقة إذا احتاجت role-aware RLS.
7. تضبط default privileges/creation workflow كي لا تعود broad grants مع الجداول المستقبلية.
8. تجدد catalog manifest/fingerprint والـACL expectations.
9. تطبق على fresh local Supabase ثم adopted local fixture ثم no-op rerun.
10. لا تطبق على hosted/production إلا بموافقة وbackup/rehearsal/rollback منفصلة.

لا ينفذ B6.2 أياً من هذه الخطوات.

## 19. خطة اختبارات الانحدار

### ACL/Data API

- owner/manager/employee JWTs تحصل من Auth بصورة طبيعية.
- كل table CRUD مباشر يعيد `BLOCKED_BY_TABLE_ACL` لكل دور Workspace.
- anon table CRUD يبقى blocked.
- RPC helpers الثلاثة لا تستدعى مباشرة.
- لا يمكن GraphQL تجاوز ACL نفسها.
- Auth endpoints تبقى ناجحة.

### B3 وB3.2

- B3 production-mode matrix تتغير لتتوقع ACL denial أولاً.
- للحفاظ على proof أن RLS نفسها لم تنحرف، يمنح harness فقط داخل transaction/fixture محلية permission مؤقتة لدور probe غير production أو لـ`authenticated`، ثم يعيد اختبارات cross-tenant وmembership-state ويعمل rollback.
- B3.2 composite-FK tests وpreflight تبقى كما هي لأنها تختبر constraints عبر DB harness، لا browser grants.

### B4

- UUID identity، email-change، conflict، trigger immutability، وfresh/adopted migration tests تبقى ناجحة.
- Auth SSR/OTP/login regression يثبت أن Auth لا يعتمد `public` table grants.
- أي اختبار authenticated مباشر إلى `users` يصنف إلى: ACL production expectation، وRLS/trigger proof تحت test-only transactional grant عند الحاجة.

### B5

- zero/one/multiple Workspace، switch، tamper، revocation، deletion، confused deputy، وrole-change تبقى عبر Drizzle/server context.
- لا يُقبل أي fallback إلى PostgREST في switcher أو selector.

### B6

- 47-capability matrix و22 page gates و86 action gates تبقى ناجحة.
- direct action/service denial tests تبقى.
- يضاف acceptance: app path المسموح ينجح، وJWT المباشر لنفس العملية يفشل ACL.
- Website Builder يظل denied لكل Workspace role في التطبيق، ويصبح denied كذلك عند Data API.

### تشغيل عام

- database safety، canonical bootstrap، relationship, identity, Active Workspace, capability suites.
- typecheck، lint، full unit، `git diff --check`، وproduction build في مهمة التنفيذ.
- فحص عدم بقاء fixtures أو grants مؤقتة بعد الاختبارات.

## 20. Rollback وفشل التنفيذ المستقبلي

- إذا اكتشف preflight اعتماداً إنتاجياً غير موثق: توقف قبل migration وارجع إلى `NEEDS ADDITIONAL DEPENDENCY WORK`.
- إذا فشل Auth بعد revoke: rollback transaction/restore ACL فقط بعد تحديد grant غير المتوقع؛ لا توسع grants العامة عشوائياً.
- إذا فشل public renderer/form: يصلح runtime role أو server path؛ لا يمنح anon table CRUD كحل سريع.
- إذا احتاج use case واحد direct access: يصمم view/RPC ضيق، لا يعاد `GRANT ... ON ALL TABLES`.
- rollback يجب ألا يعيد membership-wide direct CRUD إلا كإجراء incident مؤقت وموافق عليه مع expiry ومراقبة.

## 21. المخاطر والقرارات المطلوبة قبل التنفيذ

- runtime DB role المستضاف غير مثبت لأن hosted access ممنوع؛ يلزم probe مصرح قبل rollout.
- integrations خارج Git لا يمكن إثبات غيابها من repository؛ يلزم owner/deployment inventory.
- helper functions العامة Surface مستقل يجب إغلاقه مع table ACL.
- RLS الحالية ستظل membership-only؛ عدم وجود table grants يمنع استغلالها من Data API، لكنه لا يحولها إلى role-aware.
- اتصال Drizzle privileged يبقى معتمداً على B5/B6/service scoping؛ فصل runtime/migration roles وFORCE RLS يبقيان قرارات مستقلة.
- أي Storage/Realtime/External API مستقبلي يحتاج capability contract ولا يعيد broad authenticated grants.

## 22. نتيجة تدقيق الاعتماديات

| السؤال                                               | النتيجة                                          |
| ---------------------------------------------------- | ------------------------------------------------ |
| هل يوجد browser Supabase data client؟                | لا                                               |
| هل يوجد direct production `.from()` عبر Supabase؟    | لا                                               |
| هل يوجد production RPC/Storage/Realtime؟             | لا                                               |
| هل Server Actions تستخدم Drizzle؟                    | نعم                                              |
| هل public renderer يستخدم Drizzle؟                   | نعم                                              |
| هل public form يستخدم Verix Route Handler + Drizzle؟ | نعم                                              |
| هل Auth يحتاج table CRUD؟                            | لا                                               |
| هل يوجد جدول يحتاج grant مباشر؟                      | لا                                               |
| هل توجد RPC exposure غير مقصودة؟                     | نعم، helpers الثلاثة؛ يجب إغلاقها مع المعالجة    |
| هل يمكن بدء تصميم/تنفيذ ACL migration مستقلة؟        | نعم، بعد preflight الأدوار والاعتماديات الخارجية |

## 23. القرار الصريح

SAFE TO PROCEED WITH ACL HARDENING
