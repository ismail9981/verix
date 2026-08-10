# استراتيجية اختبار Sprint 1

## الهدف

إثبات identity correctness وTenant/Role isolation عبر pure، application، وPostgreSQL integration tests. الاختبارات الخالصة وحدها لا تثبت RLS.

## اختبارات Pure

* identity mapping: UUID match، missing link، duplicate/conflict، no auto-merge.
* email normalization: trim/case/Unicode policy حسب القرار؛ البريد لا يحدد authorization.
* Active Workspace: zero/one/multiple، tampered selection، deterministic canonical output دون silent fallback.
* capability evaluation لكل صف في المصفوفة.
* revoked/suspended/deleted membership.
* owner/manager/employee assignment scopes.
* active Store contract pure فقط، بلا schema.

## اختبارات Database Integration

* fresh migration bootstrap من قاعدة فارغة ثم catalog manifest.
* `auth_user_id` uniqueness/not-null phase behavior وbackfill conflicts.
* Workspace membership isolation وcross-workspace FK attempts.
* owner مقابل manager مقابل employee لكل operation class.
* direct SQL/PostgREST-style requests تحت anon/authenticated claims.
* revoked membership يفشل فورًا.
* RLS enabled/grants/functions/security-definer/search_path.
* role-aware assignment policies.
* runtime DB role وservice-role behavior في بيئة معزولة؛ يثبت bypass المتوقع ولا يستخدم production credentials.
* migration rerun/upgrade من baseline production-like، لا empty فقط.

## اختبارات التطبيق

* proxy route protection، session refresh، auth redirect وsafe callback.
* resolver UUID-only وemail change/invite claim.
* Server Actions تتجاهل/ترفض workspace ID المتلاعب.
* service queries تشمل verified scope وparent ownership.
* WorkspaceSwitcher ببيانات حقيقية، selection persisted، back/forward/refresh.
* invalid/revoked selection وno-workspace UX.
* navigation capability-aware، ولا يظهر Website Builder/financial للموظف.
* direct navigation/action invocation مرفوض حتى إن أخفى UI الرابط.
* cache isolation بين مستخدمين/Workspaces متزامنين.

## مجموعات بيانات القبول

| Dataset | التكوين والغرض |
|---|---|
| D0 | Auth user بلا internal user/Workspace: onboarding مضبوط بلا misbinding. |
| D1 | User يملك Workspace واحدًا وعضوية owner متسقة. |
| D2 | User عضو في Workspaceين بأدوار مختلفة؛ لا silent selection. |
| D3 | Owner وmanager وemployee في Workspace واحد مع records مسندة وغير مسندة. |
| D4 | Membership suspended ثم soft-deleted مع selection قديم. |
| D5 | بريدان باختلاف casing وسجل legacy مختلط الحالة. |
| D6 | Internal user بلا auth UUID صالح للـbackfill الواحد-إلى-واحد. |
| D7 | Auth UUID duplicate أو email conflict متعدد؛ quarantine/fail closed. |
| D8 | Workspace A وB ببيانات customer/financial/site/files متشابهة IDs/labels لاختبار leakage. |
| D9 | دعوة valid، expired، revoked، reused، وclaimed بواسطة identity مختلفة. |

## دورة حياة قاعدة الاختبار

1. تنشأ instance/container أو Supabase local مخصص لكل suite/run.
2. credentials مولدة للاختبار فقط مع roles منفصلة.
3. migrate من zero؛ لا `db:push`.
4. seed deterministic fixtures بلا production snapshot خام.
5. tests لا تعمل إذا hostname/DB name ليست allowlisted كاختبار.
6. teardown بعد run؛ عند الفشل تحفظ logs/catalog sanitized لا البيانات الحساسة.

## ضمانات عدم استخدام Production

* ENV guard صريح مثل test marker ورفض known production hosts.
* لا service keys حقيقية في CI.
* destructive setup محصور instance ephemeral.
* backup/staging rehearsal عملية منفصلة بموافقة.

## متطلبات CI

* job PostgreSQL/Supabase service، health check، migration bootstrap، ثم DB tests.
* pure tests تبقى سريعة ومستقلة.
* matrix لنسخة PostgreSQL/Supabase المعتمدة.
* artifacts: migration log، policy manifest، failed SQLSTATE دون secrets.
* gates: typecheck، lint، pure، DB/RLS، build، `git diff --check`.

## ثغرات البنية الحالية

CI الحالي يشغل Vitest pure فقط وبـDATABASE_URL placeholder غير متصل. لا container، لا PostgREST claims harness، ولا migration bootstrap. journal ناقص وRLS out-of-band، لذلك لا يمكن ادعاء DB coverage قبل Phase B.

## معايير الخروج

- [ ] جميع datasets مغطاة.
- [ ] fresh + upgrade migration paths ناجحان.
- [ ] UUID/link/invite/email-change tests ناجحة.
- [ ] cross-tenant وrole-denied operations تفشل في app وDB.
- [ ] revoked selection يفشل في الطلب التالي.
- [ ] Website Builder/publish/domain tenant access مرفوض.
- [ ] runtime/service roles مختبرة ومفهومة.
- [ ] لا flaky retries تخفي authorization failures.
- [ ] التقرير يصرح بأي gap متبقٍ.
