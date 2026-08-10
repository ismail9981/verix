# خطة RLS وقابلية إعادة إنتاج المهاجرات

## الحالة

خطة **Proposed** بلا SQL تنفيذي. لم تُنشأ أو تُشغّل Migration.

## الوضع الحالي

* Drizzle schema في `src/server/db/schema/`، config في `drizzle.config.ts`، والمخرجات في `drizzle/`.
* scripts: `db:generate`، `db:migrate`، `db:push`، `db:studio`، `db:seed`.
* SQL files موجودة من `0000` إلى `0016`.
* `meta/_journal.json` يسجل `0000` و`0001` فقط، وsnapshots موجودة لهما فقط.
* `src/server/db/rls.sql` out-of-band وينشئ helpers/policies للجداول الأساسية.
* `0003` وما بعده ينشئ policies تعتمد على `public.current_workspace_ids()`، مع أن helper ليس dependency ممثلة في journal.
* جميع policies تقريبًا `FOR ALL TO authenticated` وmembership-only.
* `db.ts` يستخدم `DATABASE_URL` مباشرة؛ دور الاتصال وخصائص `BYPASSRLS`/ownership غير موثقة.
* `supabaseAdmin` يستخدم service-role المصرح بأنه يتجاوز RLS.

## رسم الاعتماد

```text
auth.users + public.users + team_members
  └─ current_workspace_ids()
       ├─ current_comember_ids() → users policy
       ├─ current_conversation_ids() → ai_messages policy
       └─ workspace_access policies
            ├─ base tables (rls.sql)
            └─ domain tables (0003..0014)

schema 0000..0016
  → grants
  → helper functions
  → policies
  → role/capability policies
```

الترتيب الحالي غير reproducible لأن helper خارج السلسلة وjournal ناقص.

## المصدر canonical المقترح

يكون تسلسل Drizzle migrations الملتزم + journal/snapshots المتسقة هو المصدر الوحيد لبناء schema وfunctions/grants/policies. يبقى `rls.sql` مرجع جرد مؤقتًا ثم يُؤرشف/يُزال فقط بمهمة معتمدة بعد إثبات migration parity. لا تستخدم `db:push` أو manual SQL لبناء production.

## استراتيجية الإدخال في مهاجرات قابلة للتكرار

1. **Freeze وجرد:** احسب checksum لكل SQL، journal، catalog production/staging؛ لا تعديل.
2. **تحديد الحقيقة الفعلية:** قارن Drizzle journal table وPostgres catalog والملفات؛ لا تفترض أن وجود ملف يعني تطبيقه.
3. **قرار baseline:** اعتماد طريقة آمنة لإصلاح journal/metadata أو إنشاء baseline forward migration؛ لا يعاد تشغيل migrations تاريخية على production عشوائيًا.
4. **Dependency migration:** أدخل helpers/grants قبل أي policy تعتمد عليها، مع idempotency فقط حيث يقرها التصميم.
5. **Identity transition:** helper ينتقل من email join إلى immutable auth UUID بعد ADR-001/backfill.
6. **Policy redesign:** policies منفصلة حسب operation وcapability/assignment بدل `FOR ALL`.
7. **Parity test:** migrate empty DB، قارن schema/catalog/policies مع manifest معتمد.
8. **Staging rehearsal:** نسخة بيانات منزوعة الحساسية، query plans، lock timing، rollback checkpoints.
9. **Production rollout:** backup، نافذة، monitoring، verify ثم إزالة المسار out-of-band لاحقًا.

## مبادئ policies

* membership active + non-deleted شرط أساسي، لا قدرة.
* role/capability يحدد SELECT/INSERT/UPDATE/DELETE منفصلة.
* `WITH CHECK` يمنع تغيير `workspace_id` أو FK إلى نطاق آخر.
* assignment-scoped employee policies تحتاج مقارنة actor membership بالسجل.
* الجداول التابعة بلا workspace_id تستخدم parent chain موثقًا.
* SECURITY DEFINER functions: owner مقيد، `search_path` ثابت، input محدود، وEXECUTE لأقل roles؛ لا grant للanon بلا حاجة.
* Platform capabilities منفصلة مستقبلًا؛ لا يعامل owner كـPlatform Admin.
* RLS defense-in-depth؛ service scoping/capability checks تبقى إلزامية.

## Capability checks

يفضل أن تكون SQL helpers صغيرة وقابلة للاختبار مثل active membership/role، مع policy واضحة بدل dynamic permission text غير المفهرس، ما لم يثبت احتياج capability storage. يجب ألا تستدعي policies التطبيق أو تثق بـJWT metadata mutable. تفاصيل SQL تؤجل للتصميم التنفيذي.

## أدوار قاعدة البيانات

يلزم جرد `current_user`، table/function owners، grants، `rolbypassrls`، PostgREST `anon/authenticated`، migration role، runtime role، وservice role. Runtime Drizzle إذا تجاوز RLS يجب أن يعامل كـprivileged backend مع scoping واختبارات إلزامية، أو يعتمد least-privilege role وفق قرار. Migration role منفصل عن runtime. لا تستخدم service-role لمعاملات المستخدم العادية.

## التسلسل الآمن

1. Backup + restore verification.
2. Additive identity field/constraints تدريجيًا.
3. Backfill/quarantine.
4. Deploy UUID-aware app dual-read مضبوط.
5. Create new helpers بجانب القديمة.
6. Add policies باسم جديد واختبر roles.
7. Switch grants/policies في transaction أو مراحل قصيرة.
8. Deploy UUID-only + active scope/capabilities.
9. إزالة legacy helpers فقط بعد telemetry window.
10. إثبات fresh bootstrap.

لا يعتمد هذا الترتيب نهائيًا قبل ADR approval وcatalog inspection.

## التوافق والـRollback

* migrations additive أولًا وتدعم الإصدار الحالي والجديد خلال rollout.
* لا drop/rename مبكر.
* policy rollback قد يعيد ثغرة؛ rollback المفضل إلى policy آمنة deny-by-default، لا membership-wide.
* backfill identity لا يعكس عبر حذف روابط صحيحة.
* DDL/enum/data transformations قد لا تكون reversible؛ backup والاستعادة هما last resort.

## تحقق قاعدة قابلة للإتلاف

لكل CI/rehearsal:

1. PostgreSQL/Supabase-compatible instance غير production.
2. apply canonical migrations من empty.
3. assert all 29 current tables، FKs، constraints، functions، grants، RLS enabled/policies.
4. seed acceptance dataset متعدد Workspaces/roles.
5. execute as anon/authenticated/runtime/service roles.
6. prove cross-tenant and forbidden-role operations fail.
7. teardown كامل.

## سلامة بيانات Production

* inventory counts قبل/بعد، duplicate identity report، orphan FK report.
* encrypted backup وrestore drill.
* staging من snapshot منزوعة PII حيث أمكن.
* lock/timeouts وخطة إيقاف.
* لا manual hotfix غير مسجل.
* logs لا تحتوي UUID/token mappings غير الضرورية.

## معايير القبول

- [ ] catalog الحالي وmigration history موثقان.
- [ ] journal/files divergence محسوم بخطة معتمدة.
- [ ] empty DB يصل للحالة النهائية بأمر canonical واحد.
- [ ] لا dependency على `rls.sql` يدوي.
- [ ] role-aware tests تثبت owner/manager/employee وrevocation/cross-tenant.
- [ ] runtime/service/migration roles موثقة ومختبرة.
- [ ] backup، staging، rollback/fail-safe gates معتمدة.
- [ ] production data counts/invariants محفوظة.
