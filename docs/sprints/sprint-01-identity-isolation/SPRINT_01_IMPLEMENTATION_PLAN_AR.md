# خطة تنفيذ Sprint 1

## قاعدة الخطة

لا يبدأ التنفيذ قبل اعتماد وثائق Phase A. كل مهمة أدناه مستقلة المراجعة، ولا تنشئ Store schema أو Platform Admin/Commerce/API/White Label.

## Phase A — الاعتماد

| Task | الهدف | الاعتماديات | الملفات المتوقعة | أثر DB | أثر أمني | الاختبارات/التحقق | معيار الإكمال | المستثنى |
|---|---|---|---|---|---|---|---|---|
| A1 | مراجعة التدقيق والمخاطر | المواصفة | docs فقط | لا | يثبت baseline | review + diff-check | findings معتمدة | fixes |
| A2 | اعتماد ADR-001 | A1 | ADR/docs | تصميم لاحق | يمنع email identity | review checklist | قرار/أسئلة محسومة | SQL |
| A3 | اعتماد ADR-002 | A1,A2 | ADR/docs | لا/قرار persistence | يمنع silent tenant | threat review | persistence/default معتمدان | Store schema |
| A4 | اعتماد matrix وthreat/RLS/test plans | A1-A3 | docs | لا | يحدد deny/default | traceability review | كل capability/تهديد له owner | implementation |

Validation: `git diff --check`. لا build/tests لهذه المرحلة الوثائقية.

## Phase B — بنية اختبار DB

| Task | الهدف | الاعتماديات | الملفات المتوقعة | أثر DB | أثر أمني | الاختبارات/الأوامر | معيار الإكمال | المستثنى |
|---|---|---|---|---|---|---|---|---|
| B1 | تصميم PostgreSQL ephemeral guard | A4 | test config/scripts/CI docs | test-only | يمنع لمس production | guard self-tests | يرفض non-test URL | production DB |
| B2 | إثبات migration bootstrap | B1 + migration decision | CI/test harness | test DB create/drop | يكشف journal gaps | canonical migrate + catalog asserts | empty DB كامل | إصلاح غير معتمد |
| B3 | RLS roles/claims harness | B2 | integration tests/fixtures | test roles/data | يقيس RLS فعليًا | direct SQL/PostgREST-style suite | actor switching موثوق | real service keys |

Validation: scoped typecheck/lint/tests، DB integration suite، `git diff --check`.

## Phase C — Immutable Identity

| Task | الهدف | الاعتماديات | الملفات المتوقعة | أثر DB | أثر أمني | الاختبارات | معيار الإكمال | المستثنى |
|---|---|---|---|---|---|---|---|---|
| C1 | تصميم migration/backfill تفصيلي | A2,B2 | migration proposal/runbook | additive مخطط | يحمي البيانات | dry-run fixture | approval قبل migration | تنفيذ فوري |
| C2 | إضافة Auth UUID تدريجيًا | C1 approval | schema + migration + metadata | additive | identity invariant | uniqueness/bootstrap | field/constraint phase صحيح | merge |
| C3 | جرد/backfill/quarantine | C2 | migration/tooling + report | data update مضبوط | يمنع mislink | D5-D7 | كل row linked أو quarantined | guessing |
| C4 | UUID-aware resolver | C2-C3 | auth/workspace/session services | lookup behavior | fail closed | unit+integration | لا email authorization | Active Workspace UX |
| C5 | email/invite/disabled flows | C4 | auth/team validators/actions/services | حسب ADR فقط | lifecycle controls | replay/change/conflict | audit + invariants | auto merge |

Validation لكل مهمة: `npm run check-types --workspace web` أو الأمر المعتمد، lint، focused/full tests، DB tests عند الحاجة، build، diff-check. لا Migration بلا موافقة صريحة منفصلة.

## Phase D — Active Workspace

| Task | الهدف | الاعتماديات | الملفات المتوقعة | أثر DB | أثر أمني | الاختبارات | معيار الإكمال | المستثنى |
|---|---|---|---|---|---|---|---|---|
| D1 | context + selection validation | A3,C4 | auth context/validators/actions | حسب persistence المعتمد | scope authority | zero/one/multi/tamper | no first-row | Store |
| D2 | persistence/revocation | D1 | cookie/session helpers | غالبًا لا | stale access | revoke/concurrency | verify every use | UI polish |
| D3 | real switcher/no-access UX | D1-D2 | layout/switcher/components | لا | لا client trust | app/navigation tests | refresh/back works | create Workspace |
| D4 | migrate callers | D1-D3 | pages/actions/services تدريجيًا | لا | consistent context | per-domain regression | لا legacy resolver fallback | domain redesign |

## Phase E — Capability Enforcement

| Task | الهدف | الاعتماديات | الملفات المتوقعة | أثر DB | أثر أمني | الاختبارات | معيار الإكمال | المستثنى |
|---|---|---|---|---|---|---|---|---|
| E1 | central capability registry | A4,D1 | auth/permissions + tests | لا | deny default | matrix unit tests | trace لكل row | custom roles |
| E2 | navigation/routes | E1,D3 | nav/layout/pages | لا | يمنع exposure لا يعتمد عليه وحده | direct URL tests | permission states واضحة | White Label |
| E3 | actions/services | E1,D4 | representative domains تدريجيًا | لا | authoritative app checks | malicious invocation | كل write/read gated | feature changes |
| E4 | role-aware RLS rollout | B3,C4,E1 + RLS approval | migrations/policies/tests | نعم، forward staged | DB defense | RLS matrix | direct access مطابق | Store policies |
| E5 | Website/financial conflicts | E1-E4 | nav/routes/actions/services/policies | حسب RLS | يغلق critical conflicts | tenant direct tests | tenant design/publish/domain وemployee finance denied | Platform Admin UI |

## Phase F — Active Store preparation

| Task | الهدف | الاعتماديات | الملفات المتوقعة | أثر DB | أثر أمني | الاختبارات | معيار الإكمال | المستثنى |
|---|---|---|---|---|---|---|---|---|
| F1 | تثبيت contract/extension point فقط إذا لزم | D1 | types/docs pure فقط | لا | Store⊂Workspace invariant | pure contract tests | لا fake store IDs | tables/routes/domain |

## Phase G — التحقق والإغلاق

| Task | الهدف | الاعتماديات | الملفات المتوقعة | أثر DB | أثر أمني | الاختبارات/الأوامر | معيار الإكمال | المستثنى |
|---|---|---|---|---|---|---|---|---|
| G1 | regression كامل | B-F | tests/reports | test DB فقط | إثبات isolation | typecheck, lint, unit, DB, RLS, build, diff-check | كلها ناجحة | Sprint 2 |
| G2 | security checklist وclosure report | G1 | docs | لا | residual risks معلنة | evidence review | معايير Sprint 1 محققة | Platform Admin/Commerce |

## ترتيب Pull/Review المقترح

1. B1-B3 test infrastructure.
2. C1 approval منفصل، ثم C2-C5.
3. D1-D4.
4. E1 ثم enforcement بمجموعات مجال صغيرة؛ E4 rollout مستقل عالي الخطورة.
5. F1 فقط إن كان له مستهلك حقيقي.
6. G1-G2.

لا تجمع identity migration وRLS rewrite وActive Workspace UX في change set واحد.

## مجموعات أوامر التحقق لكل مهمة

| المهام | المجموعة | الأوامر الدنيا بعد التنفيذ |
|---|---|---|
| A1–A4 | V-DOC | `git diff --check` و`git status --short`؛ مراجعة Markdown يدويًا. |
| B1–B3 | V-DB | أمر test harness المعتمد لإنشاء DB مؤقتة، ثم canonical migrate، ثم DB/RLS integration tests، ثم `npm run check-types --workspace web` و`npm run lint --workspace web` و`git diff --check`. لا يعتمد اسم script قبل إنشاء واعتماد harness. |
| C1 | V-DOC/DRY | `git diff --check`، وأمر dry-run المعتمد ضد DB مؤقتة فقط؛ لا migration apply. |
| C2–C5 | V-SEC | `npm run check-types --workspace web`، `npm run lint --workspace web`، `npm test --workspace web`، DB identity/RLS suite المعتمدة، `npm run build --workspace web`، `git diff --check`. |
| D1–D4 | V-APP | الأوامر نفسها في V-SEC مع focused Active Workspace/application tests. |
| E1–E5 | V-PERM | الأوامر نفسها في V-SEC مع capability matrix، direct-action، وrole-aware RLS tests. |
| F1 | V-PURE | `npm run check-types --workspace web`، `npm run lint --workspace web`، focused pure tests، `git diff --check`؛ بلا DB schema. |
| G1–G2 | V-FULL | typecheck، lint، full unit/application suite، fresh+upgrade DB integration، RLS suite، production build، security checklist، و`git diff --check`. |

كل Task ID في الجداول أعلاه ملزم بالمجموعة المقابلة هنا إضافة إلى الاختبارات الخاصة المذكورة في صفه. لا يُخترع اسم script لبنية DB قبل تنفيذ B1 واعتماده.

## قائمة الإغلاق

- [ ] ADRs والمصفوفة معتمدة.
- [ ] لا email-based authorization.
- [ ] لا silent Active Workspace.
- [ ] revocation وmultiple memberships مختبرة.
- [ ] capability checks في UI/route/action/service/RLS.
- [ ] fresh DB قابل للبناء من canonical migrations.
- [ ] Tenant/Role isolation مثبت في PostgreSQL.
- [ ] Active Store عقد فقط.
- [ ] لا عمل من Sprint 2+.
