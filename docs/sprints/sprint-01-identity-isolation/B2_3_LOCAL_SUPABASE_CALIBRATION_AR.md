# B2.3 — معايرة Supabase المحلي والتحقق من البصمة المرجعية

## 1. الملخص التنفيذي

لم تتوفر بيئة Supabase محلية authoritative: لا Supabase CLI ولا Docker-compatible runtime في الجهاز أو المستودع. محاولة تثبيت الأدوات النظامية اللازمة رُفضت لأنها تغيير دائم واسع خارج المستودع، ولم يُستخدم hosted Supabase بديلاً. لذلك لا يحقق B2.3 بوابة parity النهائية ولا يفتح B2.4.

أُنجزت المعايرة غير الخاصة بـSupabase على cluster PostgreSQL 17.10 مؤقت ومعزول. أثبتت التجربة ترتيب replay التاريخي، وسلوك deparse، ودورة حياة `btree_gist` في PostgreSQL عادي، وملكية الدوال، وACL الفعلي لـ`PUBLIC EXECUTE`. انخفضت فروق المقارنة من 177 فرقاً إلى 33 تعارضاً غير آمن من دون إخفاء drift حقيقي. النتيجة النهائية: **FAIL / NOT_ADOPTABLE**.

## 2. البيئة المحلية

- الفرع: `develop`.
- Supabase CLI: غير مثبت.
- Docker وDocker Compose: غير مثبتين.
- لا يوجد `supabase/config.toml` أو stack محلي ملتزم.
- يوجد PostgreSQL Homebrew آخر على `localhost:5432`؛ لم يُستخدم أو يُفحص.
- cluster التشخيص أنشئ تحت مسار مؤقت `verix-b23.*` واستمع محلياً على المنفذ `55433` فقط.
- قاعدة التشخيص سميت `verix_test_b23` واجتازت فلسفة وحارس B1 عند تشغيل inspector.

تؤكد وثائق Supabase الرسمية أن Supabase CLI يحتاج Docker-compatible runtime لتشغيل stack المحلي: <https://supabase.com/docs/guides/local-development/cli-workflows>.

## 3. الإصدارات

- Supabase CLI: غير متاح، لذلك لا يوجد إصدار يمكن تسجيله.
- Supabase services/images: لم تبدأ، لذلك لا توجد إصدارات.
- PostgreSQL التشخيصي: `17.10 (Homebrew)`, arm64 macOS.
- `btree_gist` المتاح في PostgreSQL التشخيصي: `1.7`.

هذه الإصدارات ليست بديلاً عن إصدار PostgreSQL داخل Supabase المحلي المطلوب لاحقاً.

## 4. ضوابط السلامة

- لم يحدث `supabase login` أو `supabase link` ولم تُستخدم tokens.
- لم تُقرأ `.env` أو `apps/web/.env` ولم تُطبع connection URL أو credentials.
- كل DDL وreplay حدث داخل قاعدة `verix_test_b23` المؤقتة فقط.
- inspector استخدم `NODE_ENV=test` و`VERIX_TEST_DATABASE=1` واسم قاعدة اختبار محلياً عبر حارس B1.
- لم يُستخدم `DATABASE_URL` كـfallback.
- لم تُحدّث migration metadata.
- لم يُعدل أي SQL تاريخي أو RLS أو مخطط تطبيق.

## 5. التحقق من متطلبات Supabase

تعذر تصنيف متطلبات Supabase الفعلية إلى `PRESENT`/`ABSENT`/`PRESENT_WITH_DIFFERENT_CHARACTERISTICS` لأن stack authoritative لم يبدأ. لا تُعد الأجسام المصطنعة لتشغيل replay دليلاً على Supabase.

أضيف classifier pure يدعم الحالات الثلاث للاستخدام فور توفر observed prerequisite data. أما PostgreSQL الفارغ قبل fixture فأظهر فقط:

| المتطلب | الدليل غير authoritative |
|---|---|
| `auth` | غير موجود قبل fixture |
| `auth.users` | غير موجود قبل fixture |
| `auth.uid()` | غير موجود قبل fixture |
| `anon` | غير موجود قبل fixture |
| `authenticated` | غير موجود قبل fixture |
| `service_role` | غير موجود قبل fixture |
| `btree_gist` | متاح بإصدار 1.7 وغير مثبت قبل `0011` |
| `pg_catalog.gen_random_uuid()` | موجود ويعيد UUID |

الحالة authoritative لكل العناصر الثمانية: **NOT VERIFIED — BLOCKED**.

## 6. قرار `btree_gist`

التصنيف النهائي لدورة حياة Verix هو `verix_required_extension` مع `create_if_absent`:

- قيد `reservations_no_overlap_excl` مملوك لـVerix ولا يعمل بلا operator classes التي يوفرها الامتداد.
- PostgreSQL التشخيصي وفر الامتداد لكنه لم يفعله افتراضياً.
- الهجرة التاريخية `0011` هي التي نفذت `CREATE EXTENSION IF NOT EXISTS btree_gist`، فظهر في schema `public` بإصدار 1.7.
- البيئة مسؤولة عن إتاحة الامتداد؛ Verix مسؤول عن ضمان تفعيله عند bootstrap وفشل preflight بوضوح إن لم يكن متاحاً.

لم يُضف SQL جديد. يجب على Supabase المحلي لاحقاً إثبات availability/schema/permissions قبل اعتماد هذا السلوك في consolidation.

## 7. دليل تطبيع الكتالوج

أثبت خرج PostgreSQL المباشر فروق representation التالية:

- PostgreSQL يطبع الكلمات غير المقتبسة بحالة مختلفة ويزيل اقتباس identifiers العادية.
- ترتيب الأعمدة اختلف بسبب `ALTER TABLE ADD COLUMN` رغم تطابق عقد الأعمدة.
- Drizzle وSQL التاريخي أعطيا أسماء FK فيزيائية مختلفة لنفس العلاقة.
- `pg_policies` أضاف أقواساً وalias مثل `AS current_workspace_ids` وأزال `public.` المرئي بعد ربط OID.
- `pg_get_expr` لمشغل `WHEN` أزال qualifier `OLD.`.
- default كائن JSON في Drizzle احتاج تمثيل `'<json>'::jsonb` كي يطابق الكتالوج.
- checks وpartial-index predicates وexclusion constraints ما زالت تعرض casts وأقواساً وتحويلات boolean لا يجوز حذفها بتعبيرات regex واسعة.

بناءً على ذلك أصبحت normalization:

- ترتب الأعمدة بالاسم وتبقي ترتيب enum كما هو.
- تخفض حالة SQL غير المقتبس وتحذف quotes غير الضرورية مع حفظ string literals والاقتباسات الحساسة.
- تستخدم identity دلالية للـFK مبنية على أعمدة المصدر، ثم تقارن target/actions كخصائص أمن/بيانات.
- تطبع aliases المعروفة في RLS و`OLD`/`NEW` في شرط trigger بصورة محافظة.
- تطبع JSON defaults مثل PostgreSQL.

قبل المعايرة: 367 exact، و51 missing، و51 unexpected، و75 unsafe. بعد المعايرة: 469 exact، و0 missing، و0 unexpected، و33 unsafe.

## 8. نتائج `SECURITY DEFINER`

الدوال الثلاث في replay ظهرت:

- `SECURITY DEFINER = true`.
- `search_path=public` في `proconfig`.
- المالك هو دور initdb المحلي، وكان superuser و`BYPASSRLS`؛ اسمه خاص بالبيئة ولا يصلح للبصمة.
- bodies/signatures/return types تطابقت بعد التطبيع المعاير.

القاعدة المرجعية المؤكدة: يجب أن تبقى حالة definer/search path/body/signature وexecute ACL ضمن المقارنة الأمنية. اسم المالك الحرفي لا يدخل fingerprint. لكن trust policy للمالك في Supabase (الدور المقبول وخصائصه) لا يمكن حسمها من PostgreSQL Homebrew؛ يبقى ذلك blocker يتطلب local Supabase.

## 9. نتائج `PUBLIC EXECUTE` الفعلية

أثبت probe PostgreSQL 17.10:

- دالة جديدة مع `proacl = NULL` قابلة للتنفيذ فعلياً بواسطة `PUBLIC`.
- `acldefault('f', owner)` يكشف grant الافتراضي حتى عندما لا يوجد ACL صريح.
- `REVOKE EXECUTE ... FROM PUBLIC` جعل `has_function_privilege('public', ..., 'execute') = false`.
- `GRANT ... TO authenticated` بعد revoke أبقى authenticated فقط مع المالك.
- replay الحالي جعل الدوال التسع كلها قابلة للتنفيذ بواسطة `PUBLIC` لأن SQL لا يسحب المنح الافتراضية.

وهذا يطابق توثيق PostgreSQL الرسمي: <https://www.postgresql.org/docs/current/sql-createfunction.html>.

عُدّل inspector ليقرأ effective ACL عبر `aclexplode(coalesce(proacl, acldefault(...)))`. أي `PUBLIC EXECUTE` غير موجود في canonical manifest أصبح `unsafe_conflict` و`NOT_ADOPTABLE`، لا مجرد unexpected drift. قرار canonical هو أن وظائف Verix لا ينبغي أن تكون executable بواسطة PUBLIC. إضافة `REVOKE` نفسها مؤجلة إلى migration B2.4 ولا تقع ضمن B2.3.

## 10. طريقة replay التشخيصي للتاريخ

المصادر المستخدمة دون تعديل:

1. fixture محلي أدنى لـ`auth`, `auth.users`, `auth.uid()` والأدوار الثلاثة كي يستطيع SQL الارتباط؛ ليس تمثيلاً لـSupabase.
2. `0000` ثم `0001`.
3. تعريفات RLS helper الثلاثة نفسها مبكراً كي تعمل policies في `0003`.
4. `0002`–`0016` بالتسلسل.
5. `src/server/db/rls.sql` كاملاً في النهاية لإعادة الوظائف والسياسات والمنح المقصودة.

محاولة replay المباشر `0000`–`0016` ثم RLS فشلت في `0003` لأن `current_workspace_ids()` غير موجودة بعد. هذا يؤكد bootstrap ordering defect الموثق ولا يصلحه.

## 11. ملخص observed manifest

بعد إزالة دوال probe وقبل cleanup:

| الفئة | observed |
|---|---:|
| Tables | 30 |
| Enums | 36 |
| Indexes | 95 |
| Constraints | 131 |
| Functions | 9 |
| Triggers | 6 |
| RLS states | 30 |
| Policies | 30 |
| Grants | 135 |

الـ135 grant تساوي 126 canonical grants مضافاً إليها تسعة effective `PUBLIC EXECUTE` grants.

## 12. فروق canonical مقابل observed

القرار: `NOT_ADOPTABLE`.

- 469 `exact_match`.
- 0 `compatible_drift`.
- 0 `missing_required_object`.
- 0 `unexpected_object`.
- 33 `unsafe_conflict`:
  - 6 partial/unique index expression representations.
  - 18 check/exclusion expression representations.
  - 9 effective `PUBLIC EXECUTE` privileges حقيقية وغير آمنة.

لم تُخفّض checks/indexes إلى compatible لأن casts/boolean grouping قد تكون دلالية. يجب معايرتها على إصدار Supabase الفعلي أو تمثيلها بنموذج AST/structured catalog أكثر أماناً.

## 13. تغييرات الأدوات

- ترتيب أعمدة deterministic وFK semantic identities.
- normalization محافظة للكلمات والاقتباس وRLS aliases وtrigger qualifiers.
- إصلاح JSON default rendering.
- effective function ACL inspection، بما فيه ACL الافتراضي الضمني.
- unsafe classification خاصة بـ`PUBLIC EXECUTE`.
- pure Supabase prerequisite classifier للحالات الثلاث المطلوبة.
- إعادة تصنيف `btree_gist` كامتداد مطلوب من Verix.

كل التغييرات تحت test/catalog tooling أو manifests/docs؛ production runtime غير معتمد عليها.

## 14. نتيجة البصمة المرجعية

- البصمة القديمة من B2.2: `2a1944223342187918c7739ed4f1be6c44e4ff6d8f54f82d35fe7da266d65979`.
- البصمة الجديدة: `487dfce4df4bba5826c02e5e7d6842feb78e670aa61c9a96cf854f2b16b3c5c3`.

تغيرت بسبب normalization الحتمية، وترتيب الأعمدة، وFK identities، وRLS/trigger expressions، وتمثيل JSON defaults. لم تغير `btree_gist` أو ambiguity text البصمة لأن prerequisites/ambiguities خارج hash. أعادت generator البصمة نفسها عند التوليد المتكرر، كما يثبت اختبار artifact-versus-source.

## 15. بوابة parity النهائية

**FAIL — NOT_ADOPTABLE**.

السببان مستقلان وكلاهما مانع:

1. لم تعمل بيئة Supabase authoritative، لذلك prerequisites والمالك/الإصدار الفعلي غير مثبتة.
2. observed diagnostic catalog ما زال يحوي 33 unsafe conflicts، منها تسعة privileges حقيقية.

لا يجوز وصف B2.3 بأنه ناجح، ولا يجوز بدء B2.4.

## 16. الالتباسات المتبقية

1. معايرة casts/parentheses/boolean rewrites للـchecks والـpartial indexes والـexclusion constraint على PostgreSQL الخاص بـSupabase.
2. trust policy لمالك وظائف `SECURITY DEFINER` في Supabase من دون ربط البصمة باسم دور بيئي.
3. إثبات إزالة effective `PUBLIC EXECUTE` بعد consolidation على Supabase المحلي؛ الخطر نفسه مثبت بالفعل.

## 17. أثر النتائج على consolidation migration

التصميم المستقبلي يجب أن:

- يضمن `btree_gist` بـ`CREATE EXTENSION IF NOT EXISTS` مع preflight واضح.
- ينشئ RLS helper functions قبل أي policy تعتمد عليها.
- يسحب `EXECUTE` من `PUBLIC` فور إنشاء كل وظيفة Verix ثم يمنح الأدوار المقصودة فقط.
- يثبت `SECURITY DEFINER` و`search_path` وowner trust policy.
- ينتج كتالوجاً يمر بالمقارنة بعد normalization معتمدة على Supabase.

لم يُنشأ أي SQL consolidation في هذه المهمة.

## 18. متطلبات B2.4

B2.4 ممنوع البدء حتى:

1. يثبت Supabase CLI وDocker-compatible runtime بموافقة صريحة.
2. ينشأ `supabase/config.toml` محلي غير linked وتُثبت الإصدارات.
3. تصنف المتطلبات الثمانية فعلياً بالحالات الثلاث.
4. يعاد replay/inspection على local Supabase.
5. تحل 24 فروق expression من دون إخفاء semantics.
6. تعتمد owner trust policy وتثبت effective ACL بلا PUBLIC.
7. تصبح البوابة `PASS` أو يوافق المعماري صراحة على REVIEW لا يحتوي unsafe conflicts.

## 19. نتائج التحقق

- focused B2.3/B2.2 catalog tests: 21/21 ناجحة.
- B1/B2/B2.2/B2.3 database safety tests: 37/37 ناجحة في 3 ملفات.
- web unit tests: 596/596 ناجحة في 36 ملفاً.
- root `check-types`: ناجح.
- root `lint`: ناجح.
- deterministic regeneration: البصمة نفسها وSHA-256 نفسه للملفات الثلاثة في تشغيلين متتاليين.
- `git diff --check`: ناجح بعد cleanup.
- production build غير مطلوب لأن production-imported code لم يتغير.

## 20. حالة القبول

الحالة: **غير مقبول / blocked**.

اكتملت الأدلة والتعديلات الآمنة الممكنة من دون Supabase، لكن معياري authoritative local Supabase وcanonical parity لم يتحققا. يجب الاحتفاظ بالعمل لأنه يقلل false drift ويكشف ثغرة ACL حقيقية، مع إبقاء B2.4 مغلقاً.

أُوقف cluster التشخيصي وحُذف مساره وبياناته المؤقتة، وتأكد عدم وجود listener على المنفذ 55433.

---

# B2.3R Authoritative Local Supabase Re-run — 2026-08-10

يحافظ هذا القسم على نتيجة B2.3 الفاشلة أعلاه كسجل تاريخي، ويسجل إعادة التشغيل الرسمية بعد توفر البيئة المحلية.

## 1. Environment Verification

- Docker Desktop engine يعمل بإصدار `29.7.2`.
- Supabase CLI مثبت repository-local بإصدار `2.113.0`.
- لا يوجد `supabase/.temp/project-ref` ولم ينفذ `supabase link`.
- لم توجد متغيرات production/hosted Supabase في بيئة العملية.
- PostgreSQL المحلي الرسمي: `17.6`، image `supabase/postgres:17.6.1.158`.
- المنافذ المحلية: API `54321`، DB `54322`، Studio `54323`، Mailpit `54324`، Analytics `54327`.
- سجلت إصدارات الخدمات من container metadata من دون قراءة keys أو passwords.

## 2. Supabase Prerequisite Results

شغّل `test:db:supabase-prerequisites` الفاحص read-only والمصنف الحالي. النتيجة:

| المتطلب | النتيجة | الدليل |
|---|---|---|
| `auth` | PRESENT | schema موجود |
| `auth.users` | PRESENT | relation موجودة و`id`,`email` ضمن أعمدتها |
| `auth.uid()` | PRESENT | يعيد UUID وstable |
| `anon` | PRESENT | role موجود |
| `authenticated` | PRESENT | role موجود |
| `service_role` | PRESENT | role موجود و`BYPASSRLS=true` |
| `btree_gist` | PRESENT | capability 1.7 متاحة |
| `pg_catalog.gen_random_uuid()` | PRESENT | الدالة موجودة وتعيد UUID |

تعامل `requiredColumns` كعقد subset؛ وجود أعمدة Supabase إضافية ليس characteristic drift.

## 3. btree_gist Final Decision

بقي القرار `verix_required_extension / create_if_absent`:

- fresh local Supabase وفر `btree_gist` 1.7 لكنه لم يثبته.
- `0011` هو الذي فعّله، وظهر بعد replay في schema `public` وملكية `supabase_admin`.
- المستقبل يجب أن يحتوي `CREATE EXTENSION IF NOT EXISTS btree_gist` لأن قيد Verix يعتمد عليه.
- schema/location ليست جزءاً من بصمة Verix؛ availability prerequisite، والقيد نفسه يدخل البصمة.

## 4. Expression Calibration

قبل B2.3R بقيت 6 فروق partial-index و18 فرق check/exclusion. أظهر PostgreSQL 17.6 الرسمي:

- casts نوعية مضافة إلى string literals.
- أقواس زائدة حول boolean terms.
- `NOT IN` deparsed إلى `<> ALL (ARRAY[...])`.
- dependency columns داخل `pg_constraint.conkey` للـCHECK لا يوفرها Drizzle.

التطبيع النهائي:

- يزيل casts المضافة إلى literals فقط؛ cast العمود أو التعبير يبقى دلالياً.
- يحلل `AND`/`OR`/`NOT` مع precedence ويحفظ grouping المؤثر.
- يوحد `NOT IN` و`<> ALL ARRAY` في exclusion evidence.
- يستبعد CHECK dependency-column metadata من المقارنة لأن definition هو العقد الدلالي.

أضيفت regression tests لكل شكل، ومنها اختبار أن `(a OR b) AND c` لا يساوي `a OR b AND c`. النتيجة بعد المعايرة: **0 unsafe expression conflicts**.

## 5. SECURITY DEFINER Owner Policy

الدوال الثلاث يملكها `postgres` المحلي: `rolsuper=false`, `rolbypassrls=true`, `rolcanlogin=true`، مع `SECURITY DEFINER=true` و`search_path=public`.

القاعدة الصريحة:

- `trusted_privileged_owner`: دور إداري معروف في Supabase (`postgres` أو `supabase_admin`) وله superuser أو BYPASSRLS.
- `untrusted_application_owner`: `anon`/`authenticated`/`service_role` أو login role عادي بلا privilege إداري.
- `unknown_owner`: دور آخر لا يثبت أنه trusted أو untrusted.
- الدوال invoker تصنف `not_applicable`.

اسم الدور الحرفي لا يدخل fingerprint؛ التصنيف portable يدخل. أي قيمة غير `trusted_privileged_owner` لدالة definer المرجعية تختلف عن canonical وتنتج `unsafe_conflict`.

## 6. PUBLIC EXECUTE Security Result

طُبق في target التشخيصي فقط `REVOKE EXECUTE ... FROM PUBLIC` على وظائف Verix التسع:

- helpers الثلاثة: PUBLIC=false، و`anon=true`, `authenticated=true` وفق SQL الحالي.
- trigger functions الست: PUBLIC=false ولا grant لأي application role؛ owner فقط.

كما أزيلت default table privileges التي منحتها Supabase تلقائياً، ثم أعيد منح CRUD فقط لـ`authenticated` على الجداول الثلاثين. لا يستخدم التطبيق الحالي `supabaseAdmin` مع جداول Verix، لذلك لا يوجد مبرر لمنح `anon` أو `service_role` table access في الحالة pre-Sprint-1.

النتيجة: **0 unexpected PUBLIC EXECUTE** و126 effective grants مطابقة للمرجع. يجب على B2.4 إنتاج REVOKE/GRANT نفسها داخل consolidation؛ لم يعدل B2.3R SQL الإنتاجي.

## 7. Observed Catalog

| الفئة | العدد |
|---|---:|
| Tables | 30 |
| Columns | 417 |
| Enums | 36 |
| Indexes | 95 |
| Constraints | 131 |
| Functions | 9 |
| Triggers | 6 |
| RLS states | 30 |
| Policies | 30 |
| Effective grants | 126 |

## 8. Canonical Comparison

- `exact_match`: 493
- `compatible_drift`: 0
- `missing_required_object`: 0
- `unexpected_object`: 0
- `unsafe_conflict`: 0
- differences: فارغة

## 9. Fingerprint Result

- بصمة B2.3 السابقة: `487dfce4df4bba5826c02e5e7d6842feb78e670aa61c9a96cf854f2b16b3c5c3`.
- بصمة B2.3R الجديدة: `b84dd485f280a6fca69350787ea6bf9f658d4a84c247803c05bf51d6a5c09ee3`.
- observed fingerprint يساوي canonical fingerprint حرفياً.

أسباب التغيير: owner trust classification، وتطبيع boolean/casts/exclusion المعتمد رسمياً. تغيير prerequisite/ambiguity text وحده لا يدخل hash.

## 10. Final Adoption Gate

**PASS / ADOPTABLE**.

تحققت المتطلبات الثمانية، وصار expression drift صفراً، وثبت owner policy، وأزيل PUBLIC execute، ولا يوجد missing/unexpected/unsafe drift، والبصمة حتمية.

## 11. Remaining Risks

- الـreplay ترتيب تشخيصي لا يصلح canonical migration history؛ B2.4 يجب أن ينشئ adoption SQL مستقلاً.
- Supabase default privileges تستلزم REVOKE صريحاً للجداول والدوال، لا الاعتماد على defaults المتغيرة بين الإصدارات.
- parser يغطي التراكيب الحالية؛ أي SQL جديد يحتاج fixture/regression test.
- literal owner allowlist policy يجب أن تبقى متزامنة مع إصدارات Supabase المدعومة، بينما fingerprint يخزن التصنيف فقط.

لا توجد ambiguity مفتوحة تمنع adoption gate الحالي.

## 12. B2.4 Readiness

B2.4 **غير محظور الآن** ويمكن أن يبدأ ضمن موافقة مستقلة. يجب أن يستخدم target والبصمة الحالية، وينشئ helpers قبل policies، ويفعّل `btree_gist`، ويثبت owner/search_path، ويسحب default privileges، ثم يثبت fresh وadopted paths ضد local Supabase.

نتائج التحقق النهائية لـB2.3R:

- focused catalog: 29/29.
- B1/B2/B2.2/B2.3/B2.3R database tooling: 47/47 في 3 ملفات.
- web unit tests: 606/606 في 36 ملفاً.
- root `check-types`: ناجح.
- root `lint`: ناجح.
- prerequisite live gate: 8/8 PRESENT.
- live catalog gate: PASS / ADOPTABLE، 493/493 exact.
- deterministic regeneration و`git diff --check`: ناجحان.
