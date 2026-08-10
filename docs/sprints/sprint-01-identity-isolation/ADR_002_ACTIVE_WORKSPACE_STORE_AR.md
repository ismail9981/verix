# ADR-002: Active Workspace وActive Store الصريحان

* **الحالة:** Proposed
* **السبرنت:** Sprint 1

## السياق

`getAuthorizedWorkspace()` يختار حاليًا أقدم Workspace مملوك ثم أقدم عضوية active، أو ينشئ Workspace جديدًا. لا يوجد persisted selection، والـWorkspaceSwitcher mock. المواصفة تفرض اختيارًا صريحًا ومتحققًا، وتؤجل Store schema إلى Sprint 3.

## القرار المقترح

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

`getActiveWorkspaceContext()` المستقبلي يعيد `{userId, workspaceId, membershipId, role, capabilities}` بعد تحقق الهوية والعضوية. Server Actions تستخرجه ولا تقبل `workspaceId` موثوقًا من client. Services تبقى scoped وتستقبل context/ID من boundary موثوق، مع guards داخلية للعمليات الحساسة.

## Active Store: العقد المستقبلي فقط

لا يوجد Store schema الآن ولا ينشئ Sprint 1 واحدًا. العقد المستقبلي:

* Active Store يجب أن ينتمي إلى Active Workspace.
* يجب التحقق أيضًا من store access/capabilities عند كل استخدام.
* Store واحد متاح: يمكن default موثقًا بعد تحقق.
* عدة Stores: selection صريح؛ لا اختيار أول صف.
* Store غير صالح/revoked/suspended: fail closed وإبطال selection.
* route/action يحصلان لاحقًا على `ActiveStoreContext` مشتق خادميًا؛ client-provided store ID candidate فقط.
* تبديل Workspace يمسح Active Store دائمًا.

Sprint 1 يستطيع فقط تثبيت أسماء المفاهيم/interfaces في الوثائق وتصميم extension point في Active Workspace؛ لا placeholder tables أو fake store IDs أو routes.

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

## أسئلة مفتوحة

1. signed cookie أم DB preference؟
2. هل يسمح default موثق عند Workspace واحد؟
3. هل routes تحمل workspace slug مستقبلًا؟
4. مدة selection token وسياسة rotation؟
5. تجربة no-workspace بعد إيقاف auto-provisioning؟
6. هل تغير العضوية يبطل selection فورًا عبر version؟

## معايير القبول

- [ ] لا اختيار صامت لمستخدم متعدد العضويات.
- [ ] كل selection يتحقق ويُحفظ server-side safely.
- [ ] revocation يبطل الوصول في الطلب التالي.
- [ ] URL/cookie manipulated لا يغير tenant.
- [ ] switcher يعرض بيانات حقيقية وصلاحيات فعلية.
- [ ] كل actions/services تستمد النطاق من context موثوق.
- [ ] اختبارات zero/one/multiple/revoked/concurrent ناجحة.
- [ ] Active Store موثق كعقد فقط، بلا schema أو implementation.
