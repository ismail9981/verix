# B5 — سياق Active Workspace الصريح

**البوابة:** `PASS`  
**السبرنت:** Sprint 1  
**الفرع:** `develop`  
**هجرة قاعدة البيانات:** لا توجد

## 1. الملخص التنفيذي

استبدلت B5 اختيار أقدم Workspace ضمنياً بسياق خادمي صريح. يحل النظام هوية Supabase UUID الثابتة، ويحمل كل العضويات النشطة، ويتحقق من cookie موقعة ثم يعيد حالة معروفة. العضوية الوحيدة تُختار تلقائياً بعد التحقق؛ تعدد العضويات يتطلب اختياراً صريحاً؛ وعدم العضوية يعرض حالة no-access من دون إنشاء Workspace.

كل صفحات dashboard وServer Actions الموجودة تمر أصلاً عبر `getAuthorizedWorkspace()`. أبقت B5 هذا السطح المتوافق، لكنها جعلته delegate إلى `getActiveWorkspaceContext()`؛ لذلك لا تستطيع الخدمات أو FormData أو resource ID اختيار Tenant. أصبح WorkspaceSwitcher فعلياً ويعرض العضويات المسموحة فقط.

## 2. خطر الاختيار الضمني السابق

كان B4 يحل أقدم Workspace مملوك أولاً، ثم أقدم عضوية active، بناء على `created_at`. المستخدم متعدد العضويات لم يُطلب منه الاختيار، وكان switcher يعرض ثلاثة سجلات mock ولا يحفظ شيئاً. كان هذا يسمح بعملية صحيحة تقنياً في Workspace غير المقصود.

## 3. تدقيق مسارات حل Workspace

| المسار | قبل B5 | بعد B5 |
|---|---|---|
| `workspace.ts` | owner-preferred ثم first membership | compatibility facade للسياق الصريح |
| dashboard layout | session فقط | session + Active Workspace state gate |
| dashboard pages (21 مساراً) | `getAuthorizedWorkspace` الضمني | نفس الاستدعاء، لكن resolver صريح |
| Server Actions (17 مجالاً) | boundary يشتق workspace ضمنياً | boundary يعيد السياق المتحقق وقت التنفيذ |
| `requireOwner` / `requireManagerOrAbove` | role على Workspace الضمني | role على Active Workspace المتحقق |
| services | `workspaceId` من action/page | لم تتغير؛ تستقبل ID من boundary الموثوق |
| WorkspaceSwitcher | mock، لا persistence | خيارات DB حقيقية + Server Action متحقق |
| route/resource IDs | lookup scoped بالـworkspace المشتق | لا تستطيع تغيير السياق؛ تظل resource checks قائمة |
| public site/API form | Site/host أو public resource scope | خارج Active Workspace ولا تغيير |
| Middleware | session auth فقط | يحمي selector أيضاً؛ DB resolution في RSC/action |

تشمل المسارات المهاجرة analytics، bookings، business profile، CRM/pipeline، dashboard، housekeeping، invoices/payments، leads، properties/units، reservations، settings/team، website builder/preview/domain/publishing. لا يوجد service مكتشف يختار أول membership مستقلاً بعد B5.

## 4. عقد Active Workspace

الترتيب الملزم:

1. إثبات Supabase session وإحضار Auth UUID.
2. حل internal user عبر B4 immutable identity.
3. تحميل `team_members` النشطة غير المحذوفة مع Workspace غير محذوفة.
4. التحقق من cookie إن وجدت.
5. تطبيق قواعد العدد والاختيار.
6. إرجاع `WorkspaceContext` أو حالة controlled.

لا تعتبر cookie مصدراً للصلاحية. يعاد التحقق من العضوية وWorkspace في كل resolver invocation.

## 5. حالات الاختيار

- `NONE`: لا عضوية نشطة؛ لا provisioning إلا للمستخدم الجديد الذي أنشأه B4 في نفس transaction.
- `AUTO_SELECTED`: عضوية صالحة واحدة؛ stale selection لا تتغلب عليها.
- `SELECTION_REQUIRED`: أكثر من عضوية ولا اختيار صريح.
- `SELECTED`: cookie صالحة وتطابق عضوية نشطة حالية.
- `INVALID_SELECTION`: cookie تالفة أو اختيار لا يطابق عضوية حالية عند تعدد الخيارات.

الصفحات الحساسة تقبل `AUTO_SELECTED` أو `SELECTED` فقط، والباقي يحول إلى `/workspace-selection`.

## 6. تصميم Cookie

الاسم `verix.active-workspace`. تحمل payload محدوداً `version.workspaceUUID.expiry.signature`، ولا تحتوي role أو email أو membership أو أسرار. التوقيع HMAC-SHA256 عبر Node crypto مع مقارنة `timingSafeEqual`. المدة 30 يوماً، والخيارات:

- `HttpOnly=true`
- `Secure=true` في production
- `SameSite=Lax`
- `Path=/`
- `Max-Age=30 days`

المفتاح `ACTIVE_WORKSPACE_COOKIE_SECRET` server-only وبحد أدنى 32 محرفاً ولا توجد قيمة committed حقيقية.

## 7. تحقق الخادم

حتى بعد نجاح HMAC، يبحث resolver عن UUID المحدد داخل مجموعة العضويات الحالية. تعليق العضوية أو حذفها الناعم أو حذف Workspace يبطل الاختيار في الطلب التالي. فشل DB لا يسمح بسياق stale. مفتاح cookie يثبت integrity فقط ولا يمنح authorization.

## 8. تدفق Workspace واحد

عند عضوية واحدة يعيد resolver `AUTO_SELECTED` و`selectionSource=single_membership`. لا تظهر شاشة اختيار. cookie قديمة لWorkspace أخرى لا تغير النطاق. المستخدم الجديد المشروع فقط يحتفظ بتدفق B4: ينشئ internal user وWorkspace وowner membership مرة واحدة ذرياً، ثم يعيد `new_user_provisioning`.

## 9. تدفق Workspaces متعددة

من دون اختيار صالح يعيد `SELECTION_REQUIRED` ولا يرتب/يختار أول سجل. selector وswitcher يعرضان فقط خيارات query العضوية الحالية. بعد اختيار candidate صالح يكتب الخادم cookie ويعيد التوجيه إلى مسار same-site منقح.

## 10. تدفق صفر Workspace

المستخدم الداخلي المرتبط سابقاً الذي لا يملك عضوية active يحصل على `NONE` وصفحة “No active workspace”. لا يُنشأ Workspace بسبب فقد/إزالة العضوية. يظل provisioning محصوراً في نتيجة B4 `NEW_IDENTITY_PROVISIONED`، وplaceholder مدعو غير موثق لا يتجاوز تحقق B4.

## 11. Workspace Switcher

أزيلت بيانات Bloom/Peak/Lumen الوهمية وزر Create Workspace الوهمي. يستقبل shell خيارات `WorkspaceOption` من resolver، ويظهر الاسم والخطة والدور والاختيار الحالي. كل زر يرسل `workspaceId` candidate إلى `switchActiveWorkspaceAction`؛ action يعيد إثبات session والهوية والعضوية قبل كتابة cookie ثم يعيد تحميل المسار الحالي.

## 12. WorkspaceContext

يحتوي:

- `workspaceId`
- `internalUserId`
- `authUserId`
- `membershipId`
- `role`
- `selectionSource`

لا يحتوي Store. يمكن توسيعه لاحقاً بعقد مستقل من دون fake Store IDs أو schema مبكرة.

## 13. دمج الخدمات

لم تُكتب الخدمات من جديد: هي مصممة أصلاً لتلقي `workspaceId` وتقييد queries به. غيّرت B5 boundary المشترك الذي يمد كل صفحات/actions بهذا ID. أبقت alias `userId` في `AuthorizedWorkspace` للتوافق مع actor contracts، ويصدر من `internalUserId` الموثوق.

## 14. فرض routes وactions

dashboard layout يحل الحالة قبل رسم shell. جميع actions المحمية تستدعي `getAuthorizedWorkspace` أو authorization helpers وقت تنفيذ action، وليس وقت render. `workspaceId` الوارد من FormData غير مستخدم authority؛ resource IDs تمر إلى خدمات scoped بالـActive Workspace. مسار selector نفسه محمي بالجلسة عبر middleware وRSC.

## 15. RLS مقابل Active Workspace

RLS يبقى حد العضويات: مستخدم متعدد العضويات قد يصل تقنياً إلى A وB عبر `auth.uid()`. Active Workspace هو حد نطاق التطبيق: كل query من التطبيق تستخدم Workspace المختارة A فقط. الطبقتان مطلوبتان؛ B5 لم تقلص RLS إلى cookie ولم تغير policy أو role أو FORCE RLS.

## 16. منع Confused Deputy

أثبت الاختبار أن اختيار A مع candidate/resource Workspace B يبقي `WorkspaceContext.workspaceId=A` لمستخدم عضو في الاثنين. لا يحدث switch إلا من action المخصص بعد validation. resource من B أثناء A لا يجتاز service query المقيد بـA. query/form IDs ليست authority.

## 17. سلوك تغير العضوية

- suspended/deleted membership: لا تدخل الخيارات؛ selection تبطل.
- Workspace deleted: لا تدخل الخيارات؛ selection تبطل.
- restored membership: تعود ضمن الخيارات؛ ومع تعدد الخيارات تتطلب selection صالحاً.
- إضافة عضوية ثانية: ينتقل missing selection من auto إلى `SELECTION_REQUIRED`.
- multiple→one: يسمح `AUTO_SELECTED` للوحيدة المتبقية، حتى إن أشارت cookie للعضوية المحذوفة.

## 18. الطلبات القديمة والمتزامنة

تبديل tab يغير cookie للطلبات اللاحقة. tab قديم لا يملك authority مستقلة؛ عند إرسال action يحل الخادم cookie والعضوية الحالية من جديد. إذا تغيرت العضوية بين render/action يفشل/يعاد الاختيار. آخر switch متحقق يحدد cookie، ولا يستطيع resource ID في طلب stale إعادة التبديل.

## 19. التسجيل

يسجل النظام `workspace.selected` و`workspace.selection_refused` عبر logger الموجود، باستخدام أول ثمانية أحرف فقط من Auth/Workspace UUID. لا يسجل cookie أو signature أو secret. لا يوجد audit table عام مناسب بعد؛ لم تستخدم CRM activity.

## 20. حد Active Store

لم تنشئ B5 Active Store أو Store schema أو resolver. الشرط المستقبلي: أي StoreContext يجب أن يكون تابعاً لـWorkspaceContext الحالية ويعاد التحقق منه. تغيير Workspace يجب أن يبطل Active Store عندما تعتمد B6/B3 المناسبة ذلك.

## 21. الاختبارات

- B5 DB integration: **9/9**.
- cookie unit: **2/2** ضمن full suite.
- B4 identity: **11/11**.
- B3 RLS: **33/33**.
- B3.2 relationships: **4/4**.
- database safety: **78/78**.
- web unit: **639/639** عبر 41 ملفاً.
- typecheck، lint، production build، `git diff --check`: ناجحة.

## 22. المخاطر المتبقية

- cookie preference جهازية وليست DB preference متعددة الأجهزة، وفق ADR.
- غياب secret/ضعفه يمنع الاختيار المتعدد fail-closed؛ deployment يجب أن يضبطه.
- RLS يسمح كل العضويات النشطة عمداً؛ code paths مستقبلية يجب أن تستخدم WorkspaceContext.
- لا توجد صفحة support/recovery متقدمة لحالة NONE.
- role-aware capabilities وActive Store خارج النطاق.

## 23. متطلبات B6 السابقة

السياق الصريح جاهز للمرحلة التالية. يجب أن تستخدم أي طبقة Active Store مستقبلية `WorkspaceContext.workspaceId` بوصفه parent موثوقاً، وأن تمسح اختيار Store عند switch. لا تبدأ B6 إلا بطلب مستقل معتمد.

## 24. معايير القبول

| المعيار | النتيجة |
|---|---|
| إلغاء اختيار multi-workspace الضمني | PASS |
| auto-selection للعضوية الوحيدة بعد تحقق | PASS |
| cookie موقعة مع DB revalidation | PASS |
| tamper/stale/revocation rejection | PASS |
| switcher حقيقي وauthorized-only | PASS |
| request/resource ID لا يبدل السياق | PASS |
| B3/B3.2/B4 regressions | PASS |
| لا HIGH/CRITICAL context confusion معروف | PASS |
| tests/typecheck/lint/build | PASS |

نُفذ B5 فقط. لا هجرة جديدة، ولا Active Store أو capability system أو FORCE RLS أو Store schema أو Platform Admin، ولم يحدث اتصال hosted أو تعديل production أو commit أو branch switch.
