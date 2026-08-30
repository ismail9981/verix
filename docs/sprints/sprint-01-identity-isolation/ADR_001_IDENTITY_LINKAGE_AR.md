# ADR-001: الربط غير القابل للتغيير لهوية Supabase

* **الحالة:** Accepted — نُفذ الجوهر في B4 وثُبت نهائيًا في G1
* **السبرنت:** Sprint 1
* **النطاق:** قرار Identity linkage؛ التنفيذ الفعلي موثق في `B4_IMMUTABLE_AUTH_IDENTITY_AR.md` والهجرة `0004_immutable_auth_identity`.

> سجل القرار أدناه يحفظ صياغة Phase A الأصلية. اعتمد القرار في commit
> `4bd6c03`، ثم نُفذ الرابط UUID-first مع unique constraint وimmutability
> trigger ومحلل يفشل مغلقًا. بقي `auth_user_id` nullable عمدًا للحسابات
> الداخلية/المدعوة غير المطالَب بها؛ لا تستخدم هذه القيمة NULL لمنح authorization.

## السياق

تستخدم الجلسة `Supabase User.id` موثوقًا من `auth.getUser()`، لكن `resolveAuthorizedWorkspace` يهمله ويربط `public.users` بالبريد المخفض. جدول `users` لا يحفظ Auth UUID، والدعوة في `team.service.ts` تنشئ مستخدمًا داخليًا وعضوية active بالبريد من دون Supabase invite/claim.

البريد قابل للتغيير، وunique الحالي case-sensitive، ولا توجد مزامنة email-change أو merge policy. تغيير البريد قد يجعل resolver ينشئ user وWorkspace جديدين؛ وجود بريد متعارض قد يربط الشخص الخاطئ أو يفشل بصورة غير مضبوطة.

## المبدأ المستهدف المعتمد

يكون Supabase Auth User UUID هو الرابط الدائم الوحيد بين الهوية الموثقة والسجل الداخلي. البريد attribute قابل للتغيير والعرض/التواصل، وليس مفتاح authorization. كل resolver يفشل مغلقًا عند التعارض ولا ينفذ merge تلقائيًا.

## البدائل المدروسة

| التصميم | التقييم |
|---|---|
| الاستمرار بالبريد مع lowercase | مرفوض: لا يعالج mutability أو ownership. |
| حفظ `auth_user_id` unique nullable في `users` ثم backfill | موصى به: انتقال تدريجي واضح مع constraint نهائي. |
| جدول `user_identities` مستقل | صالح لتعدد providers/identities، لكنه تعقيد غير مثبت في v1. |
| استخدام Auth UUID نفسه كـ `users.id` | يقلل عمودًا لكنه يغير PK/FKs ومخاطره أعلى على البيانات الحالية. |
| lookup عند كل طلب إلى auth.users بالبريد | مرفوض: يبقي البريد مفتاحًا ويزيد coupling. |

## القرار المعتمد

إضافة رابط مفاهيمي `users.auth_user_id: uuid`، nullable خلال الانتقال، ثم unique وnot-null لكل حساب قابل لتسجيل الدخول بعد اكتمال backfill. لا يُقبل `auth_user_id` من client. يستخرج فقط من `getUser().id`.

يصبح resolver:

1. يتحقق من Supabase session عبر `getUser()`.
2. يبحث بـ Auth UUID.
3. إذا لم يوجد رابط، يدخل مسار claim/backfill مضبوطًا؛ لا ينشئ Workspace تلقائيًا قبل حسم التعارض.
4. يعيد internal user فقط بعد تحقق invariants.
5. يحدّث البريد المعياري كبيانات profile وفق flow منفصل، من دون تغيير الرابط.

## الحقول والقيود المفاهيمية

* `users.auth_user_id uuid`: unique؛ nullable مؤقتًا فقط.
* index/constraint يمنع UUID واحدًا من الارتباط بأكثر من user.
* سياسة موثقة للبريد normalized؛ يوصى بتمييز normalized email عن display email إن احتاج التصميم.
* لا يُحذف internal user تلقائيًا بسبب حذف auth identity.
* migration/backfill يجب أن يسجل كل ambiguous row ولا يخمّن.

كانت هذه الفقرة في Phase A موافقة على القرار لا على SQL بعينه. تمت مراجعة
التصميم التنفيذي لاحقًا في B4، ولا تعيد هذه الوثيقة كتابة تفاصيل الهجرة بعد وقوعها.

## تدفق إنشاء الحساب

1. Supabase ينشئ Auth User.
2. بعد جلسة مؤكدة، الخادم يقرأ UUID الموثوق.
3. ينشئ internal user مرتبطًا بالـUUID في transaction/idempotent operation.
4. provisioning للـWorkspace يحدث فقط وفق سياسة Active Workspace المعتمدة وبعد نجاح الربط.
5. retries تعيد السجل نفسه ولا تنشئ duplicate.

## استراتيجية ترحيل المستخدمين الحاليين

1. نسخ احتياطي وجرد: internal users، auth users، casing، deleted rows، duplicates، memberships.
2. dry-run matching بالبريد normalized فقط كاقتراح backfill.
3. auto-backfill فقط عند تطابق واحد-إلى-واحد غير ملتبس ومع أدلة متفق عليها.
4. quarantine للتطابق صفر/متعدد/متعارض؛ لا merge ولا Workspace creation.
5. مراجعة يدوية موثقة للتعارضات.
6. نشر resolver dual-read مؤقت مضبوط metrics، ثم UUID-only.
7. فرض القيود النهائية بعد تحقق coverage وrollback checkpoint.

## تغيير البريد

تغيير بريد Supabase لا يغير `auth_user_id` أو memberships. يجب تحديث البريد الداخلي عبر event/webhook أو reconciliation موثق ومصادق عليه، مع uniqueness check وaudit. عند فشل المزامنة تبقى الهوية صالحة بالـUUID ولا يعاد provisioning. لا تعتمد صلاحية الجلسة على تطابق البريد.

## Claim الدعوة

الدعوة تنشئ invitation state لا عضوية active غير مطالَب بها. token قصير العمر، single-use، مربوط بالـWorkspace والعضوية والبريد المقصود دون اعتباره إثبات الهوية الوحيد. بعد Supabase authentication يؤكد الخادم claim، يربط UUID بالسجل الصحيح أو يوقف التعارض، ثم يفعّل membership. إعادة الاستخدام/انتهاء/إلغاء الدعوة يفشل مغلقًا ويسجل.

## التكرار والدمج

* UUID مرتبط بسجل آخر: conflict، لا overwrite.
* بريد موجود مع UUID آخر: conflict، لا link ولا merge.
* user داخلي بلا UUID وتطابق وحيد: claim فقط وفق قواعد backfill/دعوة.
* **لا automatic account merge.** الدمج، إن اعتمد لاحقًا، عملية دعم عالية الحساسية بأدلة وaudit وrollback منفصل.

## حذف أو تعطيل Auth User

الجلسة غير الصالحة تمنع الدخول. يبقى internal user والـaudit references. يلزم reconciliation يعلّم الحساب disabled/needs-review حسب قرار لاحق، ولا يعيد تعيين memberships أو UUID. إعادة إنشاء Auth User جديد لا يرث الحساب تلقائيًا.

## التسجيل والتدقيق

تسجل أحداث: identity_link_created، backfill، conflict، invite_claimed/rejected، email_sync، auth_disabled، ومحاولة relink. تشمل actor/request ID وinternal/auth IDs بعد masking المناسب، ولا تسجل tokens أو passwords أو raw service keys.

## ثوابت الأمان

1. session UUID فقط يحدد الهوية.
2. UUID واحد ↔ internal user واحد.
3. البريد لا يمنح membership.
4. لا merge/relink تلقائي.
5. كل conflict يفشل قبل اختيار Workspace.
6. كل write حساس idempotent وauditable.
7. service-role لا يصل client ولا يستخدم لتجاوز قواعد claim.

## البدائل المرفوضة

خفض البريد وحده، الثقة في metadata، إنشاء Workspace عند lookup failure، mutation المباشر لـPK، والدمج التلقائي.

## اعتبارات Rollback

قبل not-null يمكن rollback إلى dual-read مع إبقاء العمود والبيانات. بعد UUID-only لا يجوز الرجوع إلى email authorization؛ rollback يكون إلى إصدار UUID-aware سابق. إزالة constraint أو روابط صحيحة مخاطرة عالية وتتطلب backup. Migration rollback قد لا يعيد حسابات merged، ولهذا الدمج ممنوع.

## أسئلة تشغيلية/مستقبلية غير حاجبة لإغلاق Sprint 1

1. هل يبقى البريد unique عالميًا أم يسمح بأكثر من identity provider مستقبلًا؟
2. ما قناة invitation وتسليم token؟
3. من يراجع conflicts وبأي runbook؟
4. ما lifecycle لتعطيل internal user؟
5. هل Supabase webhook موثوق أم reconciliation دوري/عند الطلب؟
6. هل self-registration يبقى مسموحًا بعد نموذج Platform Admin في Sprint 2؟

## معايير القبول

- [x] اعتماد التصميم والحقول/القيود المفاهيمية.
- [x] dry-run/preflight ينتج تقريرًا بلا تغيير.
- [x] كل هوية قابلة لتسجيل الدخول مرتبطة UUID فريدًا أو تفشل مغلقًا؛ وتبقى placeholders غير المطالَب بها NULL عمدًا.
- [x] email change لا يغير internal identity أو Workspace.
- [ ] invitation token lifecycle الكامل مؤجل؛ البريد في placeholder لا يمنح جلسة أو authorization.
- [x] duplicate/conflict يفشل بلا merge/provisioning.
- [x] اختبارات unit وDB integration وcatalog ناجحة؛ G1: B4 `11/11`.
- [x] لا يبقى email lookup في authorization بعد الإغلاق؛ المطابقة القديمة الوحيدة claim انتقالي verified لمرة واحدة.
