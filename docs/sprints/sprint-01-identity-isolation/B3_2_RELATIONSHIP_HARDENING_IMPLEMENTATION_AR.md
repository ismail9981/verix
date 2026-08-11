# B3.2 — تقرير تنفيذ تقوية علاقات مساحات العمل

## 1. الملخص التنفيذي

**بوابة B3.2: PASS.** ثبّتت الهجرة الأمامية `0003_workspace_relationship_hardening` قيد تطابق مساحة العمل على جميع العلاقات الأربعين التي يملك فيها كل من الابن والأب عمود `workspace_id`. تمنع قاعدة البيانات الآن إدخال أو تحديث مرجع من مساحة A إلى كيان في مساحة B، مع إبقاء المفاتيح الأجنبية الأصلية وسياسات RLS وصلاحيات الأدوار دون تغيير.

نجحت اختبارات المسار الجديد، وانحدار RLS، وسلامة قاعدة البيانات، والإقلاع النظيف، وترقية قاعدة متبناة عند حالة `0002`، وإعادة تشغيل المهاجر، وفحص الأنواع، وESLint، وبناء الإنتاج. لم تُستخدم أي قاعدة مستضافة.

## 2. قرارات B3.1 المعتمدة

- التطبيق منهجي على كل علاقة tenant-to-tenant يكون فيها `workspace_id` موجوداً في الطرفين.
- الآلية هي FK مركب من `(workspace_id, foreign_id)` إلى `(workspace_id, id)`.
- أضيف الحد الأدنى اللازم من مفاتيح الأب الفريدة المركبة.
- بقيت فحوص طبقة الخدمات ومحفزات النزاهة المالية دفاعاً إضافياً.
- لا إصلاح أو حذف أو إعادة إسناد تلقائياً للبيانات غير المتسقة.
- تمييز الأدوار، وCapability Matrix، وFORCE RLS، وActive Workspace/Store، وثابت الملكية مؤجلة خارج B3.2.

## 3. جرد العلاقات المتحقق منه

أعيد اشتقاق الجرد من المخطط ولقطة Drizzle والهجرات، ولم يُنسخ رقم B3.1 دون تحقق. النتيجة هي **76 مفتاحاً أجنبياً حالياً** قبل التقوية:

| الفئة | العدد |
|---|---:|
| علاقات مباشرة إلى جذر المستأجر | 27 |
| علاقات tenant-to-tenant المستهدفة | 40 |
| علاقات الهوية/العضوية | 8 |
| علاقة أب مشتقة | 1 |
| **الإجمالي** | **76** |

لم يظهر اختلاف مادي عن جرد B3.1.

## 4. العلاقات الأربعون المستهدفة

كل علاقة تستخدم `child.workspace_id` و`parent.workspace_id`، وتشير إلى `parent.id`. كل إجراءات التحديث هي `NO ACTION`. التفاصيل الكاملة في القسم 13.

- 6 مسارات استغلال مثبتة في B3.
- 31 مساراً مكافئاً بنيوياً كان قابلاً للمرجع العابر للمساحات.
- 3 مسارات كانت محمية مسبقاً بمحفزات مالية، ثم دُعمت أيضاً بقيد FK مركب.
- 18 علاقة ذات FK nullable، منها 16 تستخدم `ON DELETE SET NULL` واثنتان تستخدمان `RESTRICT`.

## 5. نتائج الثغرات الإضافية الحية

من العلاقات الإضافية البالغ عددها 34 بعد استبعاد حالات B3 الست:

- **31 PREVIOUSLY_VULNERABLE_NOW_BLOCKED**: نجح المرجع داخل المساحة وفشل الإدخال والتحديث عبر المساحات برمز PostgreSQL `23503`.
- **3 ALREADY_SAFE**: `invoice_line_items.invoice_id` و`invoices.reservation_id` و`payments.invoice_id` كانت محمية بمحفزات اتساق مالية؛ أضيف FK مركب واختُبر أيضاً.
- **0 NOT_APPLICABLE_AFTER_SCHEMA_VERIFICATION**.
- **0 REVIEW_REQUIRED**.

## 6. تصميم الفحص القبلي

يوجد فحص قبلي قابل لإعادة الاستخدام في طبقة الاختبار/الأدوات، كما تبدأ الهجرة نفسها بكتلة `DO` حتمية قبل أي DDL. يفحص كل العلاقات الأربعين بحثاً عن:

1. مرجع ابن إلى أب مفقود.
2. اختلاف `workspace_id` بين الابن والأب.
3. سلوك المراجع nullable.
4. سبعة فحوص لمسارات الملكية/التسلسل الخاصة بالعلاقات.

يعرض الفحص أعداداً ومعرّفات علاقات آمنة فقط، ولا يطبع محتوى صفوف العملاء. أي عدد غير صفري يرفع خطأ `P0001` قبل تثبيت القيود.

## 7. نتيجة البيانات الموجودة

على قاعدة Supabase المحلية عند حالة `0002`:

- العلاقات المفحوصة: 40.
- آباء مفقودون: 0.
- اختلافات مساحة العمل: 0.
- شذوذات مسار الملكية: 0.
- النتيجة: آمنة لتطبيق `0003`.

أثبت اختبار البيانات المتعمدة غير المتسقة ست حالات: أبلغ الفحص `cross_workspace=6`، ورفضت الهجرة التنفيذ قبل DDL، وبقيت الصفوف الستة دون حذف أو إصلاح أو إعادة إسناد.

## 8. استراتيجية FK المركب

أضيف لكل علاقة قيد مكمل بالشكل:

```sql
FOREIGN KEY (workspace_id, foreign_id)
REFERENCES parent (workspace_id, id)
```

تُضاف القيود أولاً بصيغة `NOT VALID` بعد نجاح الفحص القبلي، ثم تُنفذ `VALIDATE CONSTRAINT` لكل القيود الأربعين. بقيت المفاتيح الأجنبية البسيطة الأصلية، ولذلك لم توجد نافذة مؤقتة تضعف التكامل المرجعي.

## 9. قيود الأب الفريدة

أضيف **17** قيداً فقط من نوع `UNIQUE (workspace_id, id)` إلى:

`bookings`, `buildings`, `crm_opportunities`, `crm_pipelines`, `crm_stages`, `customers`, `invoices`, `leads`, `pages`, `payments`, `properties`, `rental_units`, `reservations`, `services`, `site_versions`, `sites`, `team_members`.

هذه القيود مطلوبة لقواعد FK المركبة في PostgreSQL، وهي منطقياً زائدة عن التفرد العالمي لـ`id` ولا تفرض تفرداً تجارياً جديداً.

## 10. دلالات FK القابل للقيمة NULL

حافظ التنفيذ على ملكية الصف. في علاقات `SET NULL` الست عشرة تستخدم PostgreSQL 17 الصيغة ذات العمود المحدد، بحيث يصبح عمود المعرّف الأجنبي وحده `NULL` ويبقى `workspace_id` كما هو. تحققت الاختبارات من `confdelsetcols` لكل قيد.

نجحت دلالة `NULL` الحالية في العلاقات القابلة لها، مع بقاء ثلاثة قيود CHECK سابقة خاصة بالمدفوعات (`booking_id`, `invoice_id`, `refunded_payment_id`) ترفض الحالات التي كانت ترفضها قبل B3.2 برمز `23514`؛ لم تُضعف هذه القواعد.

## 11. بنية الهجرة

- الهوية: `0003_workspace_relationship_hardening`.
- المسار: `0000 → 0001 → 0002_canonical_pre_sprint_1 → 0003_workspace_relationship_hardening`.
- SHA-256 لملف SQL: `d987db2ce241437bd69c48f2f0d225f70eb2af2ada71cb46a86480b4a4424921`.
- الترتيب: preflight، ثم 17 قيد UNIQUE، ثم 40 FK بصيغة `NOT VALID`، ثم التحقق من القيود الأربعين.
- لم تُعدّل هجرة تاريخية، ولم يُعد استخدام `0003_website_builder.sql` المؤرشف.

## 12. إصلاحات استغلال B3 المثبتة

رفضت قاعدة البيانات الإدخال والتحديث العابرين للمساحات برمز FK `23503` في جميع الحالات التالية:

| الحالة | INSERT | UPDATE |
|---|---|---|
| Booking A → Customer B | مرفوض | مرفوض |
| Booking A → Service B | مرفوض | مرفوض |
| SiteDomain A → Site B | مرفوض | مرفوض |
| Building A → Property B | مرفوض | مرفوض |
| Reservation A → Unit B | مرفوض | مرفوض |
| Reservation A → Customer B | مرفوض | مرفوض |

نُفذت هذه الإثباتات عبر مسار قاعدة مميز يستطيع الوصول إلى FK، وليس بالاعتماد على منع RLS.

## 13. مصفوفة العلاقات الأربعين الكاملة

الرموز: `B3-fixed` مسار مثبت سابقاً، و`blocked` مسار بنيوي أصبح محظوراً، و`already-safe+hardened` مسار كان محمياً بمحفز وأصبح محمياً أيضاً بالـFK. نجح same-workspace وفشل cross-workspace INSERT وUPDATE لكل صف. دلالة الحذف أدناه مطابقة للكتالوج الحي.

| # | الابن.العمود → الأب.id | Nullability | ON DELETE | التصنيف |
|---:|---|---|---|---|
| 1 | `bookings.customer_id → customers.id` | NOT NULL | CASCADE | B3-fixed |
| 2 | `bookings.service_id → services.id` | NOT NULL | NO ACTION | B3-fixed |
| 3 | `bookings.staff_id → team_members.id` | NULL | SET NULL | blocked |
| 4 | `buildings.property_id → properties.id` | NOT NULL | RESTRICT | B3-fixed |
| 5 | `crm_activities.opportunity_id → crm_opportunities.id` | NOT NULL | CASCADE | blocked |
| 6 | `crm_opportunities.customer_id → customers.id` | NULL | SET NULL | blocked |
| 7 | `crm_opportunities.lead_id → leads.id` | NULL | SET NULL | blocked |
| 8 | `crm_opportunities.pipeline_id → crm_pipelines.id` | NOT NULL | CASCADE | blocked |
| 9 | `crm_opportunities.stage_id → crm_stages.id` | NOT NULL | RESTRICT | blocked |
| 10 | `crm_stages.pipeline_id → crm_pipelines.id` | NOT NULL | CASCADE | blocked |
| 11 | `housekeeping_tasks.assigned_to → team_members.id` | NULL | SET NULL | blocked |
| 12 | `housekeeping_tasks.building_id → buildings.id` | NOT NULL | RESTRICT | blocked |
| 13 | `housekeeping_tasks.completed_by → team_members.id` | NULL | SET NULL | blocked |
| 14 | `housekeeping_tasks.created_by → team_members.id` | NULL | SET NULL | blocked |
| 15 | `housekeeping_tasks.property_id → properties.id` | NOT NULL | RESTRICT | blocked |
| 16 | `housekeeping_tasks.reservation_id → reservations.id` | NULL | RESTRICT | blocked |
| 17 | `housekeeping_tasks.unit_id → rental_units.id` | NOT NULL | RESTRICT | blocked |
| 18 | `invoice_line_items.invoice_id → invoices.id` | NOT NULL | CASCADE | already-safe+hardened |
| 19 | `invoices.customer_id → customers.id` | NULL | SET NULL | blocked |
| 20 | `invoices.reservation_id → reservations.id` | NULL | RESTRICT | already-safe+hardened |
| 21 | `invoices.voided_by → team_members.id` | NULL | SET NULL | blocked |
| 22 | `invoices.written_off_by → team_members.id` | NULL | SET NULL | blocked |
| 23 | `leads.converted_customer_id → customers.id` | NULL | SET NULL | blocked |
| 24 | `leads.site_id → sites.id` | NOT NULL | CASCADE | blocked |
| 25 | `page_sections.page_id → pages.id` | NOT NULL | CASCADE | blocked |
| 26 | `page_sections.site_id → sites.id` | NOT NULL | CASCADE | blocked |
| 27 | `pages.site_id → sites.id` | NOT NULL | CASCADE | blocked |
| 28 | `payments.actor_team_member_id → team_members.id` | NULL | SET NULL | blocked |
| 29 | `payments.booking_id → bookings.id` | NULL | SET NULL | blocked |
| 30 | `payments.customer_id → customers.id` | NULL | SET NULL | blocked |
| 31 | `payments.invoice_id → invoices.id` | NULL | SET NULL | already-safe+hardened |
| 32 | `payments.refunded_payment_id → payments.id` | NULL | RESTRICT | blocked |
| 33 | `rental_units.building_id → buildings.id` | NOT NULL | RESTRICT | blocked |
| 34 | `rental_units.property_id → properties.id` | NOT NULL | RESTRICT | blocked |
| 35 | `reservations.customer_id → customers.id` | NOT NULL | CASCADE | B3-fixed |
| 36 | `reservations.staff_id → team_members.id` | NULL | SET NULL | blocked |
| 37 | `reservations.unit_id → rental_units.id` | NOT NULL | RESTRICT | B3-fixed |
| 38 | `site_domains.site_id → sites.id` | NOT NULL | CASCADE | B3-fixed |
| 39 | `site_versions.site_id → sites.id` | NOT NULL | CASCADE | blocked |
| 40 | `sites.published_version_id → site_versions.id` | NULL | SET NULL | blocked |

## 14. انحدار RLS

نجح جناح B3 الحي بالكامل: **33/33**. بقي منع SELECT/INSERT/UPDATE/إعادة إسناد workspace/DELETE عبر المساحات، ومنع غير الأعضاء والموقوفين وفق السياسة الحالية، وحراس اختبار service role كما كانوا. لم تتغير دلالات سياسات RLS.

## 15. انحدار أمان الدوال المساعدة

نجحت اختبارات مالك `SECURITY DEFINER`، و`search_path` المقيد، وغياب `PUBLIC EXECUTE`، وACLs، وتصنيف `service_role`/`BYPASSRLS`. لم تُعدل الدوال المساعدة.

## 16. نتيجة الإقلاع النظيف

نجح `supabase db reset --local --no-seed` ثم المسار القانوني ذو الهجرات الأربع دون SQL يدوي. تحقق الممهّد الآلي من قاعدة فارغة، و4 ملفات SQL نشطة، و4 سجلات journal، و4 snapshots، و4 سجلات ledger، والكتالوج والبصمة اللاحقين لـB3.2.

بعد الإقلاع نجح فحص العلاقات، واختبارات العلاقات الأربعين، وانحدار RLS.

## 17. نتيجة ترقية قاعدة متبناة

أُنشئت قاعدة محلية مؤقتة تمثل `0002` مع ledger قبل التبني. كانت نتيجة dry-run هي `ADOPTABLE` مع تطابق 493 عنصراً وبصمة `0002` الدقيقة. سجلت آلية التبني `0002` فقط، ثم نفذ المهاجر العادي `0003`. طابق الكتالوج النهائي مسار الإقلاع النظيف.

حُذفت قاعدة الاختبار المؤقتة المقصودة بعد التحقق. لم تُعامل `0003` كهجرة متبناة؛ نُفذت فعلياً.

## 18. نتيجة إعادة تشغيل الهجرة

نجح تشغيل المهاجر مرة أخرى كعملية no-op: لم تُعد الهجرة، ولم تتكرر القيود، وبقي ledger بأربع هجرات، وبقيت البصمة والاختبارات مطابقة.

## 19. كتالوج وبصمة ما بعد 0003

| العنصر | العدد/القيمة |
|---|---:|
| الجداول | 30 |
| الأعمدة | 417 |
| أنواع enum | 36 |
| الفهارس الصريحة | 95 |
| القيود | 188 |
| المفاتيح الأجنبية | 116 |
| الدوال | 9 |
| المحفزات | 6 |
| جداول RLS | 30 |
| السياسات | 30 |
| المنح | 126 |

- بصمة التبني القانونية عند `0002`، ولم تتغير دلالتها: `b84dd485f280a6fca69350787ea6bf9f658d4a84c247803c05bf51d6a5c09ee3`.
- بصمة الحالة الحالية بعد `0003`: `29319410f324190cdd7a15977091ceeebfb01804db8b9a497522238ebe04db00`.

## 20. حالة ثابت الملكية

لم يُنفذ تصميم ملكية جديد. بقي `workspaces.owner_id` المؤشر السلطوي الحالي، ونجحت اختبارات عدم الانحدار الخاصة بإنشاء مساحة العمل وعضوية المالك وسلوك RLS الحالي. ثابت المالك/العضوية الكامل ما زال قراراً وتنفيذاً مؤجلاً.

## 21. عمل القدرات المؤجل

تمييز `owner` و`manager` و`employee` ومصفوفة القدرات خارج نطاق B3.2. لم تتغير صلاحيات الأدوار ولم يُنشأ نظام Capability.

## 22. حالة FORCE RLS

لم يُفعّل `FORCE ROW LEVEL SECURITY`. يبقى ذلك مؤجلاً حتى فصل أدوار التشغيل واعتماد القرار الأمني المرتبط به.

## 23. حالة العضو المشارك الموقوف

لم تتغير دالة `current_comember_ids()` أو دلالتها. بقي سلوك العضو المشارك الموقوف ضمن العمل المؤجل، مع نجاح انحدار السياسة الحالية.

## 24. المخاطر

- قواعد FK الجديدة تثبت تطابق مساحة العمل المباشر، لكنها لا تستبدل قواعد الاتساق التجاري الأعمق؛ تبقى فحوص الخدمات والمحـفزات ضرورية.
- حواجز `service_role` و`BYPASSRLS` تعتمد على فصل أدوار التشغيل مستقبلاً؛ لم يوسع B3.2 صلاحياتهما.
- ثابت الملكية، ودلالات co-member الموقوف، وCapability Matrix، وFORCE RLS ما زالت قرارات منفصلة معروفة.
- يجب تشغيل الفحص القبلي على كل بيئة حقيقية لاحقاً بموافقة منفصلة؛ لم تُفحص أو تُعدل أي بيئة مستضافة في هذه المهمة.

لا توجد ثغرة ربط مستأجرين بدرجة CRITICAL أو HIGH باقية ضمن العلاقات الأربعين.

## 25. بوابة قبول B3.2

**PASS**

- 40/40 قيود workspace مركبة مثبتة ومتحقق منها.
- 40/40 إدخالات صحيحة داخل المساحة نجحت.
- 40/40 إدخالات عابرة للمساحات رُفضت.
- 40/40 هجمات تحديث عابرة للمساحات رُفضت.
- 17/17 قيود أب فريدة موجودة.
- 6/6 استغلالات B3 مغلقة في INSERT وUPDATE.
- الفحص القبلي والإقلاع النظيف ومسار التبني وإعادة التشغيل نجحت.
- RLS: 33/33؛ اختبارات سلامة قاعدة البيانات: 64/64؛ وحدة web: 623/623.
- فحص الأنواع، lint، بناء الإنتاج، و`git diff --check` نجحت.

## 26. جاهزية B4

**B4 غير محجوب من جهة بوابة ربط المستأجرين في B3.2.** يمكن الانتقال إليه فقط وفق نطاقه وموافقاته الخاصة؛ لا يعني هذا اعتماد الأعمال المؤجلة المذكورة أعلاه.

## ملفات التنفيذ والتحقق

### ملفات أُنشئت

- `apps/web/drizzle/0003_workspace_relationship_hardening.sql`
- `apps/web/drizzle/meta/0003_snapshot.json`
- `apps/web/vitest.relationships.config.ts`
- `apps/web/scripts/test-database-relationships.ts`
- `apps/web/scripts/generate-post-hardening-catalog.ts`
- `apps/web/scripts/verify-post-hardening-database.ts`
- `apps/web/src/test/database/relationships/relationship-inventory.ts`
- `apps/web/src/test/database/relationships/relationship-preflight.ts`
- `apps/web/src/test/database/relationships/relationship-fixtures.ts`
- `apps/web/src/test/database/relationships/relationship-inventory.test.ts`
- `apps/web/src/test/database/relationships/workspace-relationships.integration.test.ts`
- `apps/web/src/test/database/catalog/manifests/post-b3.2.json`
- `apps/web/src/test/database/catalog/manifests/post-b3.2.fingerprint.json`
- هذا التقرير.

### ملفات عُدلت

- `apps/web/drizzle/meta/_journal.json`
- `apps/web/package.json`
- `apps/web/scripts/test-database-catalog.ts`
- `apps/web/src/server/db/schema/tables.ts`
- `apps/web/src/test/database/catalog/catalog-manifest.ts`
- `apps/web/src/test/database/catalog/catalog-normalize.ts`
- `apps/web/src/test/database/catalog/postgres-catalog-inspector.ts`
- `apps/web/src/test/database/catalog/repository-canonical-manifest.ts`
- `apps/web/src/test/database/migration-bootstrap.test.ts`
- `apps/web/src/test/database/migration-bootstrap.ts`
- `apps/web/src/test/database/rls/rls-fixtures.ts`
- `apps/web/src/test/database/rls/rls-harness.ts`
- `apps/web/src/test/database/rls/tenant-isolation.integration.test.ts`

### الاختبارات المضافة أو الموسعة

- اختبار ثابت للجرد: 76 FK مصنفة، و40 هدفاً، و17 مفتاح أب.
- جناح حي جدولي يغطي لكل علاقة من الأربعين: نجاح same-workspace، ورفض cross-workspace INSERT، ورفض UPDATE attack، وتطابق إجراءات الحذف والتحديث وحالة validation.
- اختبار nullable لكل العلاقات القابلة، بما فيها CHECK semantics السابقة للمدفوعات.
- اختبار فشل preflight بست حالات متعمدة مع إثبات عدم الإصلاح أو الحذف.
- تحديث اختبارات B3 الستة لتتوقع رفض FK المباشر.
- تحديث اختبارات bootstrap/catalog/RLS لتوقع الحالة القانونية بعد `0003` دون تغيير مرجع التبني عند `0002`.

## تأكيدات النطاق والحالة

- نُفذ نطاق B3.2 فقط.
- لم تُعدل الهجرات التاريخية، ولم تتغير دلالات `0002` القانونية.
- لم تُنشأ سجلات legacy journal مصطنعة.
- لم يُستخدم Supabase مستضاف، ولم تُربط البيئة بمشروع مستضاف، ولم تُعدل قاعدة إنتاج.
- لم يبدأ `auth_user_id` أو Active Workspace أو Active Store.
- لم يُنشأ Capability system، ولم يُفعّل FORCE RLS.
- لم يبدأ Platform Admin أو Store schema.
- لم يُنشأ commit ولم يحدث push.
- بقي الفرع `develop` دون تبديل.
