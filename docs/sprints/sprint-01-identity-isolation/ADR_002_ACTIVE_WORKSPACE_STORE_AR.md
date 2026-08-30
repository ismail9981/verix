# ADR-002: Active Workspace وActive Store الصريحان

* **الحالة:** Accepted — Active Workspace نُفذ في B5؛ F1/Active Store غير مطلوب في Sprint 1
* **السبرنت:** Sprint 1

> يحفظ هذا ADR قرار Phase A. نُفذ Active Workspace عبر cookie موقعة وآمنة
> وسياق خادمي يعيد التحقق من العضوية عند كل استخدام. لم يظهر مستهلك حقيقي
> لـActive Store؛ لذلك أغلق G1 المهمة F1 بالقرار:
> `NOT REQUIRED — no real Sprint 1 consumer`.

## السياق

`getAuthorizedWorkspace()` يختار حاليًا أقدم Workspace مملوك ثم أقدم عضوية active، أو ينشئ Workspace جديدًا. لا يوجد persisted selection، والـWorkspaceSwitcher mock. المواصفة تفرض اختيارًا صريحًا ومتحققًا، وتؤجل Store schema إلى Sprint 3.

## القرار المعتمد

### Active Workspace

Active Workspace هو server-validated scope مشتق من:

1. هوية immutable من ADR-001.
2. Workspace identifier محفوظ في cookie موقعة/مشفرة أو session claim خادمي مناسب.
3. تحقق DB من membership active وغير محذوفة وWorkspace غير محذوف عند **كل استخدام**.

التوصية هي signed, HttpOnly, Secure, SameSite cookie تحمل opaque workspace ID أو selection token قصيرًا، لأن Supabase session metadata ليست مناسبة لتحديث متكرر وقد تصبح stale، ولأن preference DB تضيف write وجدولًا قبل الحاجة. التوقيع يمنع العبث لكنه لا يغني عن membership check.

| خيار الحفظ | النتيجة |
|---|---|
| Client/localStorage | مرفوض كمصدر موثوق؛ قابل للتلاعب وغير متاح بأمان للخادم. |
| URL فقط | مفيد للروابط لكنه لا يثبت الصلاحية وقد يسرّب IDs؛ لا يكون authority. |
| Supabase user metadata/JWT | stale حتى refresh ويمزج profile بالتفويض؛ غير موصى به. |
| DB preference | متين ومتعدد الأجهزة، لكنه يحتاج تصميم/كتابة؛ خيار لاحق إن اعتمد. |
| Signed HttpOnly cookie + DB verify | موصى به للمرحلة الأولى. |

### الاختيار والسلوك

* endpoint/Server Action يستقبل candidate ID، يربطه بالمستخدم الحالي ويتحقق من active membership قبل حفظه.
* route/service لا يثق بالـcookie أو URL منفردًا.
* عند عدة Workspaces ولا selection صالح: يعرض selection-required ولا يختار الأول.
* عند Workspace واحد: القرار المطلوب هو إما مطالبة أول اختيار صريح، أو default موثق يُحفظ بعد تحقق؛ لا fallback صامت في كل طلب.
* عند صفر Workspaces: حالة onboarding/no-access صريحة. لا ينشئ resolver Tenant كأثر جانبي لمجرد lookup failure.
* عند revocation/deletion: يمسح/يبطل selection ويعيد no-access أو selector؛ لا ينتقل تلقائيًا إلى Tenant آخر أثناء mutation.
* تغيير Workspace يبطل caches ذات النطاق ويعيد التوجيه إلى route canonical مناسب.
* URL قد يحمل slug/ID للوضوح، لكن server يقارنه بالنطاق الموثوق أو يعيد 404/403/redirect آمن وفق عقد معتمد.

## اشتقاق الخادم

`getActiveWorkspaceContext()` المنفذ يعيد `{userId, workspaceId, membershipId, role, capabilities}` بعد تحقق الهوية والعضوية. Server Actions تستخرجه ولا تقبل `workspaceId` موثوقًا من client. Services تبقى scoped وتستقبل context/ID من boundary موثوق، مع guards داخلية للعمليات الحساسة.

## Active Store: العقد المستقبلي فقط

لا يوجد Store schema الآن ولا ينشئ Sprint 1 واحدًا. العقد المستقبلي:

* Active Store يجب أن ينتمي إلى Active Workspace.
* يجب التحقق أيضًا من store access/capabilities عند كل استخدام.
* Store واحد متاح: يمكن default موثقًا بعد تحقق.
* عدة Stores: selection صريح؛ لا اختيار أول صف.
* Store غير صالح/revoked/suspended: fail closed وإبطال selection.
* route/action يحصلان لاحقًا على `ActiveStoreContext` مشتق خادميًا؛ client-provided store ID candidate فقط.
* تبديل Workspace يمسح Active Store دائمًا.

لم يحتج Sprint 1 إلى interface برمجي أو extension point غير مستخدم. بقي invariant
في الوثائق فقط، بلا placeholder tables أو fake store IDs أو routes أو persistence.

## ثوابت الأمان

1. لا Active Workspace بلا immutable user identity وactive membership.
2. selection قابل للإبطال ولا يمنح صلاحية بذاته.
3. لا fallback إلى Tenant آخر أثناء فشل authorization.
4. كل query/cache key يتضمن scope الموثوق.
5. Active Store ⊂ Active Workspace.
6. UI state ليست security boundary.
7. service-role لا يتجاوز التحقق التطبيقي.

## حالات الفشل

| الحالة | السلوك |
|---|---|
| cookie مفقودة/تالفة | selection-required أو no-access، لا first row. |
| membership revoked | clear selection، 403/redirect آمن، audit. |
| Workspace deleted | invalidate ثم no-access. |
| URL يخالف active scope | 404/403 أو canonical redirect بلا كشف وجود Tenant. |
| concurrent switch | آخر اختيار متحقق فقط؛ mutations تربط بالcontext وقت التنفيذ. |
| DB unavailable | generic error؛ لا استخدام stale membership. |

## البدائل

مرفوض: أول ownership/membership، client state، query-param authority، أو JWT claim بلا إعادة تحقق. DB preference يبقى بديلًا قابلًا للاعتماد إذا تطلب multi-device continuity.

## قرارات التنفيذ والأسئلة المستقبلية

1. اعتمد Sprint 1 signed HttpOnly cookie؛ DB preference خيار مستقبلي فقط.
2. اعتمد default متحققًا ومحددًا عند وجود عضوية واحدة فقط، ولا يوجد first-row fallback عند التعدد.
3. هل routes تحمل workspace slug مستقبلًا؟
4. مدة selection token وسياسة rotation؟
5. تجربة no-workspace بعد إيقاف auto-provisioning؟
6. هل تغير العضوية يبطل selection فورًا عبر version؟

## معايير القبول

- [x] لا اختيار صامت لمستخدم متعدد العضويات.
- [x] كل selection يتحقق ويُحفظ server-side safely.
- [x] revocation يبطل الوصول في الطلب التالي.
- [x] URL/cookie manipulated لا يغير tenant.
- [x] switcher يعرض بيانات حقيقية وصلاحيات فعلية.
- [x] كل actions/services تستمد النطاق من context موثوق.
- [x] اختبارات zero/one/multiple/revoked/restore/role-change ناجحة؛ G1: B5 `10/10`.
- [x] Active Store قرار F1 فيه NOT REQUIRED، بلا schema أو implementation أو fake IDs.
