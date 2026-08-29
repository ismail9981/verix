# B6.3 — تشديد ACL لواجهة PostgREST

## 1. القرار التنفيذي

أُغلقت ثغرة B6.1 محليًا بمهاجرة أمامية تسحب جميع امتيازات الجداول المباشرة في مخطط `public` من دوري `anon` و`authenticated`، وتسحب تنفيذ وظائف RLS المساعدة الثلاث من `PUBLIC` و`anon` و`authenticated`. بقي Supabase Auth فعالًا، بينما أصبح مسار بيانات النطاق المعتمد هو:

`Browser → Next.js server boundary → capability enforcement → Drizzle/postgres.js → PostgreSQL`

أثبت اختبار PostgREST باستخدام JWT حقيقي لمستخدم Workspace أن التوكن صالح لدى Supabase Auth، لكن القراءة والكتابة المباشرتين واستدعاءات RPC أصبحت مرفوضة بسبب ACL. الكتالوج المحلي النهائي لا يحتوي أي grant مباشر مسجل لأدوار التطبيق، وجميع حواجز B3 وB3.2 وB4 وB5 وB6 المطلوبة نجحت.

## 2. ثغرة B6.1 الأصلية

أثبت B6.1 أن مستخدم Workspace عاديًا يستطيع استخدام JWT الخاص به مباشرة مع PostgREST لتجاوز طبقة قدرات التطبيق. شمل ذلك:

- قراءة جداول الفواتير وبنودها والمدفوعات والاستردادات.
- إنشاء الفواتير وتعديلها وحذفها مباشرة.
- قراءة Team وتغيير دور العضو إلى `owner`.
- قراءة الإعدادات وتعديلها.
- الوصول المباشر إلى جداول Website Builder المحجوزة لحدود Platform.
- عبور `owner` و`manager` لحدود Platform-only.

كانت RLS تعزل Workspace عن غيره، لكنها لا تعرف قدرات B6 داخل الـWorkspace؛ لذلك لم تكن بديلًا عن حد الخادم.

## 3. خلاصة تدقيق B6.2

خلص B6.2 إلى عدم وجود اعتماد إنتاجي مشروع على CRUD مباشر للجداول أو RPC أو Storage أو Realtime أو GraphQL. استخدام Supabase الإنتاجي المطلوب هو Auth فقط، بينما تصل Server Actions والخدمات والعرض من جهة الخادم إلى PostgreSQL عبر Drizzle/postgres.js. لذلك أمكن سحب ACL من أدوار Supabase العامة من دون منح CRUD عريض بديل.

## 4. المهاجرة وتغييرات ACL الدقيقة

أُنشئت المهاجرة الأمامية التالية بعد `0004_immutable_auth_identity`:

- `0005_postgrest_acl_hardening.sql`
- SHA-256 لملف المهاجرة: `63a166be7314de9befcc5f15582efd654b4a71a6203c74d6d806f72291524681`

تطبق المهاجرة ما يلي:

```sql
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all tables in schema public from authenticated;
```

كما تسحب `EXECUTE` من `PUBLIC` و`anon` و`authenticated` لكل من:

- `public.current_workspace_ids()`
- `public.current_comember_ids()`
- `public.current_conversation_ids()`

لم تُنقل الوظائف إلى مخطط جديد، ولم تتغير أجسامها أو سياسات RLS أو سجل القدرات أو بنية المخطط. تبقى الوظائف تفاصيل داخلية لسياسات RLS وليست سطح RPC للتطبيق.

## 5. دليل حالة قاعدة البيانات المحلية

طُبقت المهاجرة على Supabase المحلي للمستودع فقط. أعاد استعلام ACL النهائي:

- `NO_DIRECT_TABLE_GRANTS` لدوري `anon` و`authenticated` على جداول `public`.
- `false / false / false` لتنفيذ كل وظيفة مساعدة بواسطة `PUBLIC / anon / authenticated`.
- RLS مفعّل على `30/30` جدولًا.
- عدد سياسات `public` المحتفظ بها: `30`.

لم يحدث اتصال بقاعدة مستضافة أو إنتاجية.

## 6. كتالوج وبصمة ما بعد التشديد

وُلّد الكتالوج والبصمة من قاعدة Supabase المحلية بواسطة أداة المستودع الجديدة، ولم تُكتب النتائج يدويًا:

- النطاق: `post-b6.3`
- الجداول: `30`
- القيود: `189`
- الوظائف: `10`
- المشغلات: `7`
- grants المسجلة: `0`
- البصمة: `97ae43f970ac648de8f50e49898828ca6958ef4b4d949353ff524f1b38ee2294`
- قرار المقارنة: `ADOPTABLE`
- سجل Drizzle: `6/6` مهاجرات، وآخر إدخال يطابق `0005`.

## 7. اختبار إغلاق PostgREST وRPC

تحول إثبات B6.1 إلى اختبار منع دائم ولم يُحذف. نجح `6/6` ويثبت:

1. صلاحية JWT حقيقي لأدوار Workspace: `owner` و`manager` و`employee` عبر Supabase Auth.
2. منع anon من الوصول المباشر إلى جداول النطاق.
3. منع employee من القراءة المباشرة للفواتير وبنودها والمدفوعات والاستردادات.
4. منع إنشاء الفاتورة وتعديلها وحذفها مباشرة.
5. منع الوصول أو التعديل المباشر في Team وSettings وWebsite Builder، ومنع التصعيد الذاتي إلى `owner`.
6. منع `owner` و`manager` من القراءة المباشرة لجداول Website Builder المحجوزة للمنصة.
7. منع الاستدعاء المباشر لوظائف RLS الثلاث عبر `/rest/v1/rpc/*`.

تقبل حالة RPC شكلَي المنع الصحيحين من PostgREST: خطأ PostgreSQL `42501` أو إخفاء الوظيفة غير القابلة للتنفيذ من cache الدور بخطأ `PGRST202`. في الحالتين لا تُنفذ الوظيفة ولا تُعاد بيانات.

## 8. توافق RLS والدفاع متعدد الطبقات

لم تُضعف RLS ولم تُزل أي سياسة. لأن B3 يختبر دلالات RLS بصورة مستقلة عن ACL الإنتاجي، يمنح الحزام الاختباري فقط `SELECT/INSERT/UPDATE/DELETE` والـ`EXECUTE` اللازمة لدور `authenticated` داخل معاملة rollback. هذه grants:

- موجودة في كود الاختبار فقط.
- تنفذ قبل `SET LOCAL ROLE authenticated`.
- تُلغى تلقائيًا مع rollback المقصود.
- لا تظهر في الكتالوج النهائي ولا تعيد فتح PostgREST.

نجاح B3 مع بقاء الكتالوج عند صفر grants يثبت الفصل بين اختبار دلالات RLS وحد ACL الإنتاجي.

## 9. التحقق من حد الخادم والتدفقات العامة

- B4 وB5 نجحا باستخدام مسار Drizzle/postgres.js من جهة الخادم، من دون الاعتماد على grants دور `authenticated`.
- اختبارات B6 للقدرات نجحت، بما فيها Server Actions والخدمات وتفويض الصفحات والتنقل.
- اختبارات الوحدة الكاملة تشمل host resolution وsite rendering وpublishing وSEO ومخطط نموذج lead العام.
- نجح بناء Next.js الإنتاجي وضم مسارات SSR العامة `/site/[siteId]/[[...path]]` ومسار إرسال lead `/api/public/forms/contact` ومسارات host العامة.
- ظل Supabase Auth فعالًا كما يثبته `/auth/v1/user` باستخدام JWT لكل دور اختباري.

لا توجد إضافة لاستخدام قاعدة بيانات من المتصفح، ولا تعتمد هذه التدفقات على PostgREST CRUD.

## 10. نتائج التحقق

| التحقق | النتيجة |
|---|---:|
| تطبيق `0005` على Supabase المحلي | نجح |
| B3 RLS | `33/33` |
| B3.2 relationship isolation | `4/4` |
| B4 immutable identity | `11/11` |
| B5 active workspace | `10/10` |
| B6 capability tests المركزة | `17/17` |
| B6.3 PostgREST/RPC | `6/6` |
| اختبارات web الكاملة | `655/655` في `46/46` ملفًا |
| Drizzle schema/migration check | نجح |
| كتالوج/بصمة/ledger B6.3 | نجح، `ADOPTABLE` |
| Type checking الكامل | `3/3` مهام |
| Lint الكامل | `3/3` مهام، بلا warnings |
| Production build | `2/2` (`web`, `docs`) |
| `git diff --check` | نجح |

### ملاحظات شفافة عن محاولات التحقق

- رفض `test:db:bootstrap` التشغيل لأن قاعدته المقصودة يجب أن تكون disposable وفارغة قبل أي جدول Verix، بينما الهدف هنا قاعدة Supabase المحلية التي طُبقت عليها المهاجرات بالفعل. لم تُنفذ إعادة ضبط مدمرة لإخفاء هذا الشرط. غُطي فحص المخطط والمهاجرات بدلًا منه بنجاح عبر `drizzle-kit check` ومدقق B6.3 الذي تحقق من الكتالوج والبصمة والـledger وهويات المهاجرات.
- فشلت محاولة build الأولى داخل sandbox لأن Turbopack مُنع من فتح منفذ worker محلي (`Operation not permitted`). أُعيد الأمر نفسه خارج هذا القيد البيئي، ونجح بناء `web` و`docs` كاملًا.
- كانت خدمة Docker متوقفة في بداية التحقق؛ شُغلت محليًا ثم بدأ Supabase المحلي بنجاح. لا تمثل هذه الحالات فشلًا وظيفيًا أو أمنيًا في B6.3.

## 11. الملفات الخاصة بـ B6.3

- المهاجرة وبياناتها: `apps/web/drizzle/0005_postgrest_acl_hardening.sql`، و`meta/_journal.json`، و`meta/0005_snapshot.json`.
- أدوات الكتالوج: `generate-post-acl-catalog.ts` و`verify-post-acl-database.ts`.
- ناتج الكتالوج: `post-b6.3.json` و`post-b6.3.fingerprint.json`.
- اختبار المنع: `direct-capability-bypass.integration.test.ts` و`vitest.postgrest.config.ts`.
- توافق RLS: `rls-harness.ts` و`tenant-isolation.integration.test.ts` و`identity-resolver.integration.test.ts`.
- جرد المهاجرات والبوابة: `migration-bootstrap.ts` و`migration-bootstrap.test.ts`.
- تسجيل أوامر التحقق وأنواع scope: `apps/web/package.json` و`catalog-manifest.ts`.

حُفظت جميع تغييرات B6/B6.1/B6.2 السابقة والتغييرات غير المرتبطة، ولم يحدث restore أو clean أو commit.

## 12. المخاطر المتبقية والمتابعة

- المهاجرة تسحب صلاحيات الجداول الحالية. يجب أن تظل كل مهاجرة تنشئ جدولًا جديدًا deny-by-default، وأن يستمر مدقق الكتالوج واختبار PostgREST في منع أي grant عرضي مستقبلًا.
- اتصال PostgreSQL الخاص بالخادم ذو صلاحيات واسعة؛ لذا تبقى طبقة capabilities وحدود Workspace في Server Actions والخدمات حواجز إلزامية. تغطيها اختبارات B3–B6 الحالية.
- إذا أضيف مستقبلًا استخدام Storage أو Realtime أو RPC أو GraphQL، فيحتاج قرارًا أمنيًا مستقلًا واختبارات tenant/capability قبل فتح أي امتياز.
- بقاء وظائف RLS في `public` مقبول حاليًا لأنها غير قابلة للتنفيذ للأدوار العامة؛ يجب إبقاء منع RPC ضمن الانحدارات الدائمة.

B6 SECURITY GATE: PASS
