# B2.4 — الهجرة المرجعية ونقطة التبنّي الهجينة

التاريخ: 2026-08-11  
الحالة: **Implemented — PASS**  
السبرنت: Sprint 1 — Identity and Tenant Isolation Hardening

## 1. Executive Summary

نُفذت استراتيجية **Hybrid Canonical Adoption Point** المعتمدة. أصبح المسار النشط يحتوي `0000` و`0001` وهجرة واحدة جديدة `0002_canonical_pre_sprint_1`. تحفظ ملفات `0002–0016` القديمة خارج المسار التنفيذي وبالبايت نفسه. يصل fresh Supabase إلى بصمة B2.3R، بينما لا تنفذ قاعدة قائمة الهجرة التجميعية؛ تُفحص read-only أولًا ثم تسجل نقطة `0002` فقط داخل transaction محروسة.

النتيجة الرسمية: **PASS**. لم تنفذ أي خطوة على hosted أو production.

## 2. Approved Hybrid Strategy

المسارات الثلاثة هي:

- Fresh: Supabase prerequisites → active `0000` → active `0001` → canonical `0002` → fingerprint gate.
- Existing: prerequisite/catalog/owner/ACL/ledger inspection → exact fingerprint → atomic canonical ledger adoption فقط.
- Future: migration واحدة forward-only بعد `0002` لكل تغيير مع SQL وjournal وsnapshot متسقة.

لا توجد إعادة بناء مزيفة لتاريخ `0002–0016` ولا replay له على قاعدة قائمة.

## 3. Legacy Migration Preservation

نقلت ملفات SQL القديمة، مع أسمائها وترتيبها، إلى:

`apps/web/drizzle/legacy/pre-canonical/`

يوثق `README.md` داخل المجلد SHA-256 لكل ملف. أثبت اختبار آلي الملفات الخمسة عشر وقيمها. تطابقت hashes قبل النقل وبعده، لذلك لم يتغير أي محتوى تاريخي. وجودها تحت subdirectory يمنع `readMigrationFiles()` وDrizzle Kit من تفسيرها كخطوات نشطة.

## 4. Active Migration Topology

التسلسل القديم الفعلي:

```text
active/journaled: 0000 → 0001
active directory but unjournaled: 0002 … 0016
out-of-band: src/server/db/rls.sql
```

التسلسل الجديد:

```text
active/journaled/snapshotted:
0000_slim_thunderbolts
→ 0001_payments_soft_delete
→ 0002_canonical_pre_sprint_1

audit-only, non-executable:
drizzle/legacy/pre-canonical/0002 … 0016
```

يفحص `readMigrationInventory()` الآن ثلاثة SQL نشطة، ثلاثة journal tags، ثلاثة snapshots، وصفر ملفات نشطة غير journaled.

## 5. Canonical Consolidation Migration

الهوية:

- tag: `0002_canonical_pre_sprint_1`
- journal index: `2`
- `created_at`/`when`: `1786429954973`
- SHA-256: `290370ce736be8110ffeb44f4cb2bd4ccaacaae0a0417b19534c2d8efaa9335b`

ولّدت Drizzle البنية المنظمة كـdelta بعد snapshot `0001`. أضيفت يدويًا فقط surfaces التي لا يمثلها snapshot: prerequisite assertions، `btree_gist`، exclusion/circular FK، functions، triggers، RLS، policies، والمنح الفعلية. لم تكن الهجرة concatenation للتاريخ القديم ولم تحتوي data replay تاريخيًا.

## 6. Supabase Prerequisites

تتحقق الهجرة قبل DDL من `auth`, `auth.users`, `auth.uid()`, `anon`, `authenticated`, `service_role`, و`pg_catalog.gen_random_uuid()`. فاحص B2.3R الخارجي يثبت أيضًا الخصائص التفصيلية. لا تنشئ Verix أي object أو role مملوكًا لـSupabase.

التحقق الحي النهائي: 8/8 `PRESENT`.

## 7. btree_gist Handling

تنفذ الهجرة:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;
```

ثم تنشئ `reservations_no_overlap_excl` مع `daterange(..., '[)')` واستبعاد الحالات `cancelled` و`no_show` والسجلات المحذوفة. بقي التصنيف `verix_required_extension / create_if_absent`.

## 8. Function Security and ACLs

تنتج الهجرة تسع وظائف Verix:

- ثلاث RLS helpers بـ`SECURITY DEFINER`, `STABLE`, و`search_path=public`.
- ست trigger functions بـinvoker semantics.

تسحب `ALL PRIVILEGES` صراحة من `PUBLIC`, `anon`, `authenticated`, و`service_role` على الوظائف التسع، ثم تمنح `EXECUTE` فقط على helpers الثلاثة إلى `anon` و`authenticated`. النتيجة 0 `PUBLIC EXECUTE`. يبقى owner الحرفي خارج البصمة، لكن `trusted_privileged_owner` إلزامي في الفحص.

## 9. RLS Canonicalization

تمكّن RLS على الجداول الثلاثين، من دون `FORCE RLS`، وتنشئ ثلاثين policy باسم `workspace_access` مطابقة لمرجع B2.3R. تنفذ helpers قبل أي policy تعتمد عليها. يبقى `rls.sql` دون تعديل بوصفه evidence تاريخيًا، ولم يعد خطوة bootstrap.

تسحب الهجرة table privileges الافتراضية من `anon`, `authenticated`, و`service_role` ثم تمنح CRUD إلى `authenticated` فقط على الجداول الموجودة وقت النقطة المرجعية. النتيجة 126 effective grants.

## 10. Drizzle Journal Repair

أنشأ Drizzle Kit entry رسميًا بصيغة journal version 7 و`0002_snapshot.json` مرتبطًا بـ`0001_snapshot.json`. لم يُدخل أي entry لـlegacy `0002–0016`. وظائف/RLS/grants ليست في snapshot لأنها خارج surface Drizzle schema، لكنها موجودة في SQL النشطة والmanifest.

## 11. Fresh Bootstrap Flow

الخطوات المثبتة:

1. `supabase db reset --local --no-seed` على المشروع غير المرتبط.
2. فحص local prerequisites.
3. `npm run db:migrate` من `apps/web` بالقيمة المحلية المحمية.
4. فحص ledger كامل.
5. توليد observed manifest read-only.
6. مقارنة fingerprint والـ493 object identities.
7. تشغيل migrate مرة ثانية ثم إعادة الفحص.

لم يستخدم `db:push` أو SQL يدوي لبناء fresh catalog.

## 12. Fresh Bootstrap Evidence

نجح المسار النشط وأنتج:

| الفئة            | العدد |
| ---------------- | ----: |
| Tables           |    30 |
| Columns          |   417 |
| Enums            |    36 |
| Indexes          |    95 |
| Constraints      |   131 |
| Functions        |     9 |
| Triggers         |     6 |
| RLS states       |    30 |
| Policies         |    30 |
| Effective grants |   126 |

المقارنة: 493 exact، وصفر compatible/missing/unexpected/unsafe.

## 13. No-op Rerun Evidence

نجح `npm run db:migrate` للمرة الثانية. بقي ledger بثلاثة صفوف وبنفس hashes وtimestamps، ولم ينفذ DDL مكررًا. بقي fingerprint مطابقًا للمرجع.

## 14. Existing Database Adoption Flow

الأمر الافتراضي `db:adopt:dry-run` لا يكتب شيئًا. يجمع prerequisites وobserved manifest وowner trust وeffective ACLs وledger، ثم يقارن بالمرجع.

التطبيق المحلي الصريح `db:adopt:local` يتطلب أيضًا:

```text
VERIX_CANONICAL_ADOPTION=APPLY_B2_4
```

ويعمل فقط بعد B1 environment validation. لا يستدعي migrator ولا يقرأ consolidation SQL للتنفيذ.

## 15. Fingerprint Gate

البصمة الوحيدة المقبولة:

`b84dd485f280a6fca69350787ea6bf9f658d4a84c247803c05bf51d6a5c09ee3`

أي prerequisite غير `PRESENT`، أو fingerprint مختلفة، أو قرار غير `ADOPTABLE` يرفض التبنّي. يغطي ذلك missing/unexpected/unsafe، `PUBLIC EXECUTE`، owner غير موثوق، وpolicy مختلفة.

## 16. Ledger Adoption Semantics

يجب أن يحتوي ledger قبل adoption صفّي `0000/0001` الدقيقين فقط:

| Migration | Hash                                                               |    `created_at` |
| --------- | ------------------------------------------------------------------ | --------------: |
| `0000`    | `654195b19ec4b4b35cae3004a425465ed4d46dcd5d34240ebab35313b1b80791` | `1783644761151` |
| `0001`    | `759b7fdba2e949a110332937008899a6560a99d575ce46b5bbe13fae28214e16` | `1783667676350` |

داخل transaction واحدة:

1. `pg_advisory_xact_lock` خاص بـB2.4.
2. lock على `drizzle.__drizzle_migrations` لمنع migrator متزامن.
3. إعادة الفحص الكامل.
4. insert لصف canonical `0002` فقط.
5. إعادة fingerprint والledger postconditions.
6. commit عند النجاح؛ أي فرق يرمي error ويؤدي إلى rollback.

## 17. Adoption Dry-run

على fixture canonical ذات `0000/0001` فقط أعاد dry-run:

- status: `ADOPTABLE`
- wouldAdopt: `true`
- comparison: `ADOPTABLE`
- fingerprints: متطابقتان
- ledger: `READY_FOR_ADOPTION`

لم يتغير schema أو ledger في dry-run.

## 18. Failure/Abort Conditions

يرفض المسار عند:

- prerequisite غائب أو بخصائص مختلفة.
- missing object أو unexpected object أو unsafe conflict.
- policy/RLS/ACL/owner trust مختلف.
- effective `PUBLIC EXECUTE`.
- fingerprint غير مطابقة.
- ledger مفقود، معدل، يحوي legacy entries مزيفة، أو يحوي migration أحدث.
- غياب confirmation الصريحة في apply.
- فشل postcondition أو تغير fingerprint داخل نافذة transaction.

## 19. Test Coverage

أضيفت اختبارات لـactive topology، hashes ملفات legacy، catalog-success-after-process-success، exact adoption، missing object، unsafe policy، `PUBLIC EXECUTE`، untrusted owner، incorrect ledger، already-adopted idempotency، non-canonical fingerprint، وSupabase prerequisite drift.

الاختبار الحي أثبت dry-run ثم insert وحيد ثم `ALREADY_ADOPTED` في المحاولة التالية مع fingerprint ثابتة.

## 20. Rollback Strategy

- فشل fresh: transaction migration تُرجع DDL، ثم يعاد reset للfixture فقط.
- فشل dry-run: لا mutation.
- فشل adoption قبل commit: rollback تلقائي للصف.
- بعد adoption الناجح: لا تحذف ledger يدويًا في بيئة حقيقية؛ توقف deploy وتراجع evidence/runbook.
- لا down migration عامة ولا replay للlegacy. الإنتاج يحتاج backup وrestore rehearsal وموافقة منفصلة.

## 21. Production Safety

أدوات B2.4 تستعمل `TEST_DATABASE_URL` فقط ولا fallback إلى `DATABASE_URL`. يحظر B1 hosts الإنتاجية ويحتاج marker أو local Supabase identity الدقيقة. لا توجد package command قادرة على adoption production ضمنيًا؛ apply يحتاج flag وconfirmation. لم يجر اتصال أو تعديل hosted/production في هذه المهمة.

## 22. Remaining Risks

- أي تغيير مستقبلي للهجرة canonical بعد adoption محظور؛ يجب إنشاء migration جديدة.
- Drizzle يقرر pending migrations عبر `created_at`؛ لذلك حماية ledger/fingerprint تبقى release gate إلزامية.
- Supabase owner/default-ACL behavior قد يتغير مع version؛ inspector والاختبارات يجب أن يبقيا gate لكل upgrade.
- B2.4 يثبت catalog isolation baseline، لا behavior الكامل لـrole-aware RLS؛ ذلك يبقى ضمن B3 وفق الخطة.

## 23. B3 Readiness Impact

B3 غير محظور من جهة migration reproducibility. يوجد الآن fresh canonical path، adopted upgrade fixture، وظائف وسياسات migration-managed، وبيئة Supabase محلية يمكن تشغيل actor/RLS tests عليها. لا يعني ذلك بدء identity أو Active Workspace في B2.4.

## 24. Acceptance Criteria

- [x] active history coherent بثلاث migrations.
- [x] legacy SQL محفوظ exact وخارج active track.
- [x] fresh Supabase bootstrap نجح.
- [x] fingerprint المرجعية تطابقت.
- [x] rerun no-op نجح.
- [x] function ACLs مطابقة ولا PUBLIC EXECUTE.
- [x] dry-run read-only نجح.
- [x] explicit local adoption سجل canonical point فقط.
- [x] idempotent re-adoption نجح.
- [x] unsafe drift والledger غير الصحيح مرفوضان بالاختبارات.
- [x] لا hosted/production ولا identity/Active Workspace scope.
