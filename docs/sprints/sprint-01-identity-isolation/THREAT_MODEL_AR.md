# نموذج تهديد Sprint 1

**الحالة:** Accepted ومُسوّى مع تنفيذ Sprint 1 في G2. يحتفظ الجدول بأصل
التهديد، بينما تعكس صفوف T1/T2/T5/T10/T12/T18 الضوابط النهائية المنفذة.

## المنهج والنطاق

المنهج: Assets → Actors → Trust Boundaries → Attack Paths → Controls → Residual Risk. يقتصر على الهوية وعزل Workspace والصلاحيات وRLS وقابلية إعادة البناء. لا يصمم Platform Admin أو Store/API.

## الأصول

Supabase identities، internal `users`، memberships، Workspace data، financial/customer data، sessions، Website Builder/publishing/domain controls، service-role وDATABASE_URL credentials، RLS functions/policies، files/storage paths، logs وrequest IDs.

## الجهات

Anonymous، employee، manager، Workspace owner، مستخدم متعدد Workspaces، former/revoked member، malicious client، platform operator، وخصم يملك service/database credentials.

## حدود الثقة

```text
Browser (untrusted)
  → Proxy/Supabase session boundary
  → Identity linkage boundary
  → Active Workspace/capability boundary
  → Server Actions/loaders
  → Services/Drizzle DB role
  → PostgreSQL RLS

Public host → host/site resolver → public renderer
Operator secrets → service-role/admin client → Supabase/Postgres
```

Cookie/URL/form IDs ومدخلات client كلها غير موثوقة. service-role وDB owner يتجاوزان RLS ويحتاجان controls مستقلة.

## سجل التهديدات

| # | التهديد/مسار الهجوم | الاحتمال | الأثر | الضوابط الحالية | النقص | تخفيف Sprint 1 | تخفيف لاحق | التحقق | الخطر المتبقي |
|---:|---|---|---|---|---|---|---|---|---|
| T1 | Email identity collision/casing يربط auth بسجل داخلي خاطئ | عالٍ | حرج | UUID-first resolver، `auth_user_id` unique/immutable، conflict fail-closed | lifecycle دعم/استرداد الرابط ليس منصة إدارية كاملة | ADR-001/B4 منفذان | support identity tooling | B4 conflict/ambiguity tests | منخفض |
| T2 | Email change يفقد الربط وينشئ Workspace جديدًا | عالٍ | حرج | UUID-first resolver؛ البريد profile فقط | مزامنة profile email التشغيلية ليست authorization | B4 منفذ | webhook/reconciliation operations | B4 email-change integration test | منخفض |
| T3 | دعوة stale/reused أو بريدها يطالب بها شخص خطأ | متوسط | عالٍ | unique membership | لا token/expiry/claim؛ تصبح active | invitation claim contract، single-use/expiry، UUID check | delivery/support controls | replay/wrong-user tests | متوسط |
| T4 | Cross-workspace read/write عبر IDOR | متوسط | حرج | session-derived Workspace؛ scoped services؛ membership RLS | selection صامت؛ بعض parent checks غير موحدة | Active context، capability/service audit، isolation tests | Store scope Sprint 3 | two-tenant action/DB tests | منخفض-متوسط |
| T5 | Employee privilege escalation عبر actions أو direct PostgREST | عالٍ | حرج | deny-by-default registry + UI/route/action/service guards + PostgREST ACL/RPC deny | runtime DB role privileged ويحتاج بقاء service guards | B6 + B6.2/B6.3 منفذة؛ role-aware RLS ليس الطبقة المختارة | أي Data API مستقبلي يحتاج مراجعة مستقلة | B6 `17/17`، PostgREST `6/6`، ACL probe | منخفض ضمن السطح الحالي |
| T6 | Manipulated Workspace ID/cookie/URL | متوسط | حرج | actions غالبًا لا تقبل workspaceId | لا active selection contract | signed selection + DB verify every use | scoped Store token | tamper tests | منخفض |
| T7 | Stale Active Workspace بعد revocation | متوسط | عالٍ | resolver يستعلم العضوية كل طلب حاليًا | future persistence قد تصبح stale | verify active membership every use؛ invalidate | event/session version | revoke-next-request test | منخفض |
| T8 | مستخدم متعدد العضويات يرسل mutation إلى Tenant غير المقصود بسبب first-row | عالٍ | عالٍ | order deterministic | غير صريح ولا محفوظ | إزالة silent fallback؛ selector required | UX improvements | multiple membership tests | منخفض |
| T9 | service-role أو DB credential misuse يتجاوز RLS | متوسط | حرج | server-only module/env | استعمال/دور غير مجرود؛ لا least privilege موثق | credential inventory، role policy، logging، tests آمنة | secret rotation/monitoring Sprint 11 | role probes في disposable DB | متوسط |
| T10 | Fresh environment يفتقد RLS/helpers/migrations | عالٍ | حرج | canonical `0000→0005` + journal/snapshots + catalog fingerprint | يلزم إبقاء fresh gate مع كل migration | B2.4 وما بعده منفذ | release gate/monitoring | G1 fresh disposable `6/6` + no-op + fingerprint | منخفض |
| T11 | Public access إلى docs/design-system/playground | متوسط | متوسط-عالٍ | apps/docs starter منفصل | access/deployment policy غير موثقة | جرد وقرار access، لا تنفيذ خارج Sprint | ADR Docs access/backlog | deployed-route scan | متوسط |
| T12 | Tenant يصل Website Builder/publish/domain | عالٍ | حرج | جميع أدوار Workspace ممنوعة في registry/nav/route/action/service وPostgREST | Platform Admin نفسه غير منفذ بعد | B6 منفذ | Platform Admin boundary مستقل في Sprint 2 | direct action/route/PostgREST tests | منخفض لمسار Tenant الحالي؛ تصميم الإدارة مؤجل |
| T13 | Mass assignment يمرر role/status/foreign IDs | متوسط | عالٍ | Zod؛ بعض FK-in-workspace asserts | capability وfield allowlists غير موحدة | validators + capability audit + parent-scope checks | per-domain hardening | malicious FormData tests | متوسط |
| T14 | Session fixation/stolen cookie | منخفض-متوسط | عالٍ | Supabase SSR، HttpOnly cookies، getUser refresh | لا session inventory/revocation tests | secure active-scope cookie؛ session refresh tests | Supabase MFA/session ops لاحقًا إذا اعتمد | fixation/rotation tests | متوسط |
| T15 | Cache sharing across Workspaces | متوسط | حرج | معظم reads request-time؛ React cache user فقط | لا cache-key audit | تضمين verified scope، clear on switch، tests | observability | concurrent tenant cache tests | منخفض-متوسط |
| T16 | Logs تكشف secrets/tokens/PII | منخفض-متوسط | عالٍ | structured logger، generic public errors | لا redaction contract شامل | logging allowlist؛ لا raw auth IDs/tokens/secrets | centralized audit/observability Sprint 11 | log capture/redaction tests | منخفض-متوسط |
| T17 | File path/object key يعبر Tenant | متوسط | عالٍ | workspace_id في files وRLS membership | storage bucket/path policy غير مدققة هنا | invariant + test plan؛ منع client-trusted path | File Storage ADR | cross-prefix upload/read tests | متوسط |
| T18 | RLS SECURITY DEFINER/helper abuse أو anon EXECUTE | متوسط | حرج | UUID join، fixed search_path، owner catalog gate، EXECUTE مسحوب من `PUBLIC`/`anon`/`authenticated` | helper functions ما زالت في schema `public` لكن غير exposed للأدوار العامة | B4 + B6.3 منفذان | DB monitoring أو internal schema إذا ظهر احتياج | catalog + RPC denial `6/6` | منخفض |

## مسارات الهجوم الأعلى أولوية عند بدء Sprint 1 (تاريخية)

1. Auth email change → UUID غير محفوظ → internal lookup miss → user/Workspace جديد.
2. Employee يستخدم anon/authenticated Supabase client مباشرة → RLS membership policy تقبل write مالي/إداري.
3. Fresh deploy يشغل journal 0000–0001 فقط → schema/policies غير مكتملة أو migrations اللاحقة تفشل لاعتمادها على helper خارج السلسلة.
4. Tenant يستدعي `publishSiteAction` مباشرة → membership كافٍ حاليًا.
5. تعدد العضويات → resolver يختار Tenant غير المقصود → mutation صحيحة تقنيًا في النطاق الخطأ.

## متطلبات التخفيف المشتركة

* fail closed، immutable identity، active scope صريح، capability checks بكل طبقة.
* لا IDs من client كمصدر authority.
* حد DB قابل لإعادة البناء: tenant-isolation RLS مع ACL deny لأدوار Data API؛
  لا ادعاء بأن role-aware RLS نُفذ.
* audit للهوية/النطاق/الصلاحيات دون أسرار.
* disposable PostgreSQL tests قبل أي rollout.

## المخاطر المقبولة مؤقتًا

Active Store يبقى غير منفذ حتى Sprint 3. Platform Admin boundary الفعلي مؤجل Sprint 2، لكن يجب في Sprint 1 منع tenant capabilities الخاصة بالتصميم/النشر حسب المصفوفة المعتمدة. أي تخفيف يتطلب مجالًا لاحقًا يسجل كخطر متبقٍ ولا يبرر توسيع Sprint 1.
