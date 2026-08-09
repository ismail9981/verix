# Verix Platform Specification

## الإصدار

* اسم الوثيقة: Verix Platform Specification
* الإصدار: 1.0
* الحالة: معتمدة
* اللغة الأساسية: العربية
* نوع الوثيقة: وثيقة المنتج والمعمارية والنطاق والتنفيذ
* المشروع: Verix
* الفرع الأساسي الحالي: `develop`

## 1. قاعدة الاعتماد الإلزامية

هذه الوثيقة هي المصدر الرسمي والملزم لجميع أعمال تطوير Verix ابتداءً من الإصدار 1.0.

يجب تطبيق القواعد التالية:

1. لا يجوز إضافة ميزة غير موجودة في هذه الوثيقة.
2. لا يجوز تغيير علاقة `Platform` أو `Workspace` أو `Store` أو `Site` دون تحديث الوثيقة.
3. لا يجوز تغيير صلاحيات المستخدمين دون تحديث مصفوفة الصلاحيات واعتماد إصدار جديد.
4. لا يجوز إنشاء تطبيق أو حزمة أو نطاق جديد لمجرد التنظيم دون حاجة معمارية معتمدة.
5. لا يجوز تجاوز ترتيب السبرنتات إلا بعد توثيق سبب التغيير واعتماده.
6. لا يجوز تنفيذ مهمة من سبرنت لاحق قبل استيفاء معايير إغلاق السبرنت الحالي.
7. أي تعارض بين برومبت تنفيذي وهذه الوثيقة يُحسم لصالح هذه الوثيقة.
8. أي ميزة غير واضحة تعتبر خارج النطاق حتى يتم توثيقها.
9. لا يقوم Codex بإضافة تحسينات أو أفكار اختيارية من تلقاء نفسه.
10. أي تعديل جوهري يتطلب إصدارًا جديدًا مثل `v1.1` أو `v2.0`.

## 2. الرؤية

Verix منصة إدارة مركزية خاصة بمالك المنصة، تعمل كمحرك خلفي مخفي لتشغيل وإدارة مواقع وأنظمة العملاء.

يتم تصميم مواقع العملاء بصورة مستقلة وبهويات وتصاميم مختلفة، بينما ترتبط هذه المواقع بخدمات Verix لإدارة البيانات والعمليات.

العميل لا يحتاج إلى رؤية منصة Verix الداخلية، ولا يرى العملاء الآخرين، ولا يملك التحكم الكامل بتصميم موقعه.

يرى العميل فقط:

* موقعه الإلكتروني العام.
* لوحة تحكم مخصصة لنشاطه.
* البيانات والوحدات والصلاحيات المسموح بها.

تعمل Verix خلف الكواليس على توفير:

* المصادقة.
* المستخدمين.
* فصل العملاء.
* الصلاحيات.
* المنتجات.
* التصنيفات.
* المخزون.
* الطلبات.
* العملاء.
* محتوى النشاط.
* إدارة المواقع.
* واجهات API.
* النشر والدومينات.
* السجلات والتدقيق.
* الإدارة المركزية.

## 3. تعريف المنتج

Verix ليست منشئ مواقع ذاتي الخدمة موجّهًا للزبائن.

Verix ليست قالبًا واحدًا يعاد استخدامه بنفس الشكل لكل متجر.

Verix ليست متجرًا إلكترونيًا عامًا يظهر باسم Verix للمستخدم النهائي.

Verix هي:

> منصة تشغيل وإدارة مركزية متعددة العملاء، تدير مواقع مستقلة ومصممة خصيصًا لكل عميل، مع لوحة تشغيل محدودة الصلاحيات لصاحب النشاط.

## 4. نموذج العمل

يقدم مالك Verix خدمة تصميم وتشغيل المواقع للعملاء.

التدفق الأساسي:

1. يأتي عميل يحتاج إلى موقع إلكتروني.
2. ينشئ Platform Admin حساب العميل داخل Verix.
3. ينشئ Workspace للشركة أو العميل.
4. ينشئ Store للنشاط التجاري.
5. يحدد الوحدات والصلاحيات المتاحة.
6. يصمم مالك المنصة الموقع.
7. يربط الموقع بـ Verix.
8. يربط دومين العميل.
9. يحصل العميل على لوحة تشغيل خاصة به.
10. يدير العميل المحتوى والعمليات المسموح بها.
11. يبقى التصميم والنشر والإعدادات الحساسة تحت تحكم Platform Admin.

يمكن مستقبلًا فرض:

* رسوم إنشاء وتصميم.
* رسوم اشتراك شهرية أو سنوية.
* رسوم دعم وصيانة.
* رسوم إضافية للوحدات أو الفروع أو الموظفين.

نظام الاشتراكات الآلي ليس ضمن النسخة الأولى إلا إذا تمت إضافته لاحقًا في إصدار معتمد.

## 5. المصطلحات الرسمية

### 5.1 Platform

منصة Verix كاملة، بما فيها:

* الإدارة المركزية.
* الخدمات الخلفية.
* قاعدة البيانات.
* المصادقة.
* واجهات API.
* لوحات العملاء.
* إدارة المواقع.
* البنية التشغيلية.

### 5.2 Platform Admin

مستخدم إداري خاص بمنصة Verix، منفصل عن أعضاء Workspaces.

Platform Admin ليس Tenant Owner.

### 5.3 Workspace

يمثل العميل أو الشركة أو المؤسسة المتعاقدة مع Verix.

أمثلة:

* شركة البركة للتجارة.
* Nizwa Hospitality Group.
* Ahmed Retail Company.

### 5.4 Store

يمثل نشاطًا أو متجرًا أو علامة تجارية يديرها Workspace.

قد يكون:

* مقهى.
* متجر ملابس.
* متجر عطور.
* مطعم.
* متجر إلكترونيات.
* نشاط خدمات، في إصدارات لاحقة.

### 5.5 Site

يمثل موقعًا إلكترونيًا مرتبطًا بـ Store.

`Site` ليس مرادفًا لـ `Store`.

المتجر يمثل النشاط والبيانات التشغيلية، بينما الموقع يمثل واجهة العرض المنشورة.

### 5.6 Member

مستخدم ينتمي إلى Workspace من خلال عضوية وصلاحية محددة.

### 5.7 Customer

عميل نهائي يشتري أو يحجز من أحد Stores.

### 5.8 Product

عنصر قابل للبيع داخل Store.

الخدمات الحالية في النظام لا تعتبر تلقائيًا Products.

### 5.9 Order

عملية شراء تحتوي على عنصر واحد أو أكثر من Products.

الحجز أو Reservation أو Booking لا يعتبر Order تلقائيًا.

### 5.10 Tenant

مصطلح معماري عام يشير إلى العميل المعزول داخل النظام.

المصطلح المستخدم حاليًا في النظام هو `Workspace`.

يستمر استخدام `Workspace` في قاعدة البيانات والكود حتى يصدر قرار معتمد بخلاف ذلك.

## 6. العلاقات الرسمية

العلاقات المعتمدة:

```text
Platform
└── Workspace
    ├── Workspace Members
    ├── Stores
    │   ├── Store Members or Store Access
    │   ├── Sites
    │   ├── Products
    │   ├── Categories
    │   ├── Inventory
    │   ├── Orders
    │   ├── Store Customers
    │   ├── Store Settings
    │   └── Store Activity
    ├── Shared Customers where explicitly supported
    ├── Billing
    └── Audit Events
```

القواعد:

1. Workspace واحد يمكن أن يملك عدة Stores.
2. Store واحد ينتمي إلى Workspace واحد فقط.
3. Site واحد ينتمي إلى Store واحد فقط.
4. Store يمكن أن يملك Site واحدًا أو أكثر مستقبلًا.
5. النسخة الأولى تحتاج موقعًا أساسيًا واحدًا لكل Store.
6. Product ينتمي إلى Store واحد.
7. Order ينتمي إلى Store واحد.
8. Inventory Record ينتمي إلى Store ومنتج محدد.
9. جميع البيانات التشغيلية يجب أن تحمل نطاق Workspace وStore عند الحاجة.
10. لا يجوز استخدام Site بديلًا عن Store.

## 7. أنواع المستخدمين

### 7.1 Platform Super Admin

يمثل المالك الأعلى لمنصة Verix.

الصلاحيات:

* الوصول الكامل للمنصة.
* إنشاء Workspaces.
* إنشاء Stores.
* إدارة Platform Admins.
* تعيين ملاك Workspaces.
* تفعيل وتعليق Workspaces وStores.
* إدارة الوحدات المتاحة.
* إدارة الدومينات والنشر.
* إدارة Website Builder.
* مشاهدة Audit Logs.
* تنفيذ الدعم الإداري.
* الاطلاع على حالة جميع الأنظمة.
* إدارة الإعدادات الحساسة.

### 7.2 Platform Support Admin

دور مستقبلي أو اختياري داخل نطاق الإدارة.

لا يتم تنفيذه في النسخة الأولى إلا إذا تطلب فصل الصلاحيات أثناء Sprint Platform Admin.

يجب ألا يحصل تلقائيًا على جميع صلاحيات Super Admin.

### 7.3 Workspace Owner

صاحب الشركة أو العميل.

الصلاحيات المبدئية:

* رؤية Workspace الخاص به.
* رؤية Stores المصرح بها.
* إدارة أعضاء Workspace ضمن الحدود المسموحة.
* إدارة البيانات التشغيلية المتاحة.
* عرض التقارير المسموحة.
* إدارة إعدادات النشاط غير الحساسة.

لا يملك:

* الوصول إلى Platform Admin.
* رؤية Workspaces أخرى.
* الوصول إلى Website Builder.
* تغيير القالب أو هيكل الموقع.
* إدارة أسرار API.
* تغيير إعدادات النشر الحساسة.
* الوصول إلى قاعدة البيانات أو إعدادات Verix الداخلية.

### 7.4 Manager

يدير العمليات اليومية حسب الصلاحيات المعتمدة.

يمكن أن يدير:

* المنتجات.
* الطلبات.
* المخزون.
* العملاء.
* المحتوى التشغيلي.
* التقارير المسموحة.

لا يدير:

* إعدادات المنصة.
* Website Builder.
* أسرار الربط.
* Workspaces أخرى.
* إعدادات المالك الحساسة.

### 7.5 Employee

صلاحيات تشغيل محدودة، مثل:

* مشاهدة الطلبات المسموح بها.
* تحديث حالات محددة.
* إدارة مهام يومية.
* مشاهدة بيانات تشغيلية غير مالية بحسب الدور.

لا يحصل على بيانات مالية أو إدارية إلا إذا نصت مصفوفة الصلاحيات المعتمدة على ذلك.

## 8. الفصل بين Platform Admin وWorkspace Roles

يجب أن يكون Platform Admin منفصلًا منطقيًا وأمنيًا عن عضوية Workspace.

القواعد:

1. لا يجوز استخدام دور `owner` الحالي كبديل لـ Platform Admin.
2. Platform Admin لا يُشتق من عضوية Workspace.
3. يجب أن توجد آلية تحقق صريحة من صلاحيات المنصة.
4. يجب حماية مسارات Platform Admin بصورة مستقلة.
5. يجب تسجيل العمليات الإدارية الحساسة.
6. يجب ألا يتمكن Workspace Owner من الوصول إلى مسارات الإدارة المركزية حتى عبر طلب مباشر.
7. يجب ألا يظهر Platform Admin في قائمة موظفي العميل إلا إذا أضيف كعضو فعلي لأغراض موثقة.

## 9. نموذج التحكم بالتصميم

مالك Verix هو المتحكم بالتصميم.

العميل لا يستخدم Website Builder.

### Platform Admin يتحكم في:

* القالب.
* بنية الصفحات.
* ترتيب الأقسام.
* تصميم Header.
* تصميم Hero.
* تصميم المنتجات.
* الألوان.
* الخطوط.
* الحركات.
* المسافات.
* الصور الأساسية.
* الصفحات.
* SEO المتقدم.
* الدومين.
* النشر.
* الإصدارات.
* Custom CSS إذا تمت الموافقة عليه مستقبلًا.

### العميل يتحكم في:

* المنتجات.
* الأسعار.
* المخزون.
* صور المنتجات.
* الطلبات.
* العروض.
* معلومات النشاط.
* بيانات التواصل.
* أوقات العمل.
* المحتوى النصي المسموح.
* الموظفين والصلاحيات المسموحة.
* البيانات التشغيلية المرتبطة بوحداته.

### قاعدة أساسية

المحتوى منفصل عن التصميم.

يستطيع العميل تعديل البيانات دون تغيير هيكل أو جودة التصميم.

## 10. مصير Website Builder الحالي

Website Builder الحالي لا يُحذف.

يصبح أداة داخلية خاصة بـ Platform Admin.

يُحتفظ بالأجزاء القابلة لإعادة الاستخدام:

* Pages.
* Sections.
* Templates.
* Themes.
* Versions.
* Publishing.
* Domains.
* SEO.
* Public Renderer.
* Host Routing.
* Published Snapshots.

القواعد:

1. لا يصل العميل إلى Website Builder.
2. لا تظهر روابط Website Builder في تنقل العميل.
3. جميع عمليات التصميم والنشر تحتاج صلاحية Platform Admin.
4. يمكن للعميل تعديل المحتوى المسموح من لوحة تشغيل مستقلة.
5. لا يتم تنفيذ محرر حر يشبه Webflow في النسخة الأولى.
6. لا يُعاد بناء Website Builder من الصفر ما لم يثبت عجزه عن دعم المتطلبات المعتمدة.

## 11. مواقع العملاء

موقع العميل قد يكون:

1. موقعًا منشورًا من Public Renderer الموجود داخل Verix.
2. مشروعًا مستقلاً مثل Next.js مرتبطًا بـ Verix API.

يجب أن يدعم التصميم النهائي كلا الخيارين دون خلط البيانات بالواجهة.

### الموقع المستقل

مثال مفاهيمي:

```env
VERIX_API_URL=https://api.example.com
VERIX_STORE_ID=store_xxxxx
VERIX_PUBLIC_KEY=pk_xxxxx
```

هذه الأسماء أمثلة مفاهيمية وليست عقد API نهائيًا.

لا يتم اعتماد مفاتيح أو آلية توثيق نهائية إلا في External API ADR.

### قواعد مواقع العملاء

* كل موقع يحمل هوية العميل.
* لا يظهر اسم Verix إلا إذا قرر مالك المنصة ذلك.
* الموقع لا يحصل على صلاحيات إدارة داخلية.
* المفاتيح العامة لا تمنح الوصول إلى عمليات خاصة.
* الطلبات العامة تخضع للتحقق، تحديد المعدل، ومنع التكرار.
* الموقع لا يحدد Workspace أو Store بصورة موثوقة اعتمادًا على مدخل قابل للتلاعب فقط.
* الخادم هو المسؤول عن اشتقاق النطاق الموثوق.

## 12. White Label

لوحة العميل يجب أن تدعم الهوية البيضاء تدريجيًا.

العناصر:

* اسم النشاط.
* الشعار.
* اللون الرئيسي.
* Favicon.
* صورة أو هوية تسجيل الدخول.
* اسم لوحة الإدارة.
* بيانات الدعم.
* رابط الموقع.
* الوحدات الظاهرة.
* عناصر التنقل.

القواعد:

1. العميل لا يرى Workspaces أو Stores غير التابعة له.
2. يمكن أن تستخدم لوحة مشتركة ديناميكية بدل إنشاء تطبيق منفصل لكل عميل.
3. لا يُسمح للهوية البيضاء بإخفاء معلومات قانونية أو أمنية مطلوبة.
4. White Label الكامل يتم بعد تقوية الهوية والصلاحيات.
5. لا يتم نسخ لوحة التحكم برمجيًا لكل عميل.

## 13. المصادقة والهوية

Supabase يبقى مزود المصادقة الحالي في النسخة المعتمدة.

المشكلة الحالية:

ربط هوية Supabase بالمستخدم الداخلي عن طريق البريد الإلكتروني ليس كافيًا.

الهدف:

* إضافة ارتباط غير قابل للتغيير باستخدام Supabase Auth User UUID.
* منع الاعتماد الدائم على البريد بوصفه معرف الهوية.
* توثيق تحديث البريد.
* توثيق الدعوات.
* توثيق حالات دمج الحسابات.
* منع إنشاء ارتباطات غير صحيحة.

لا يتم تعديل الهوية قبل إنشاء واعتماد Identity ADR ضمن السبرنت المخصص.

## 14. Active Workspace وActive Store

يمكن لمستخدم واحد أن ينتمي إلى أكثر من Workspace إذا سمحت عضوياته بذلك.

القواعد:

1. لا يختار النظام أول Workspace بصورة صامتة بوصفه حلًا دائمًا.
2. يجب أن يكون Active Workspace صريحًا.
3. يجب التحقق من عضوية المستخدم قبل تعيين Active Workspace.
4. يجب دعم التبديل الآمن بين Workspaces.
5. يجب تحديد Active Store داخل Workspace عند الحاجة.
6. يجب منع استخدام Store لا ينتمي إلى Active Workspace.
7. يجب ألا يعتمد العزل على حالة واجهة المستخدم فقط.

## 15. طبقات الأمان والعزل

يجب تطبيق العزل في جميع الطبقات التالية:

1. Immutable Auth Identity.
2. Explicit Active Workspace.
3. Explicit Active Store where required.
4. Capability and permission checks.
5. Workspace-scoped service queries.
6. Store-scoped service queries.
7. Role-aware RLS.
8. API authentication and authorization.
9. Platform Admin boundary.
10. Audit logging.
11. Secure domain and site resolution.
12. Safe file-storage paths.

لا تعتبر الواجهة الأمامية طبقة أمان.

إخفاء زر لا يساوي منع العملية.

## 16. Row Level Security

الوضع الحالي يحتاج إلى تقوية.

المتطلبات:

* سياسات RLS قابلة لإعادة الإنشاء من الصفر.
* عدم الاعتماد على خطوات SQL يدوية غير موثقة.
* تطبيق صلاحيات الأدوار، وليس عضوية Workspace فقط.
* اختبار Tenant Isolation.
* اختبار Role Isolation.
* منع الوصول المباشر غير المصرح به عبر Supabase/PostgREST.
* توثيق الأدوار التي قد تتجاوز RLS.
* عدم افتراض أن Service Layer وحدها كافية.

لا يتم تعديل RLS بصورة جزئية أو عشوائية.

يجب تنفيذها وفق خطة معتمدة واختبارات قبول.

## 17. الصلاحيات

يجب إنشاء Capability Matrix مركزية.

أمثلة لقدرات مستقبلية:

```text
platform.workspaces.read
platform.workspaces.create
platform.workspaces.suspend
platform.stores.create
platform.stores.publish
platform.audit.read

workspace.members.read
workspace.members.manage
workspace.settings.read
workspace.settings.update

store.products.read
store.products.create
store.products.update
store.products.archive
store.inventory.read
store.inventory.update
store.orders.read
store.orders.update_status
store.customers.read
store.reports.read

site.content.read
site.content.update
site.design.manage
site.publish
site.domain.manage
```

القواعد:

1. لا تعتمد الصلاحيات فقط على أسماء الأدوار.
2. الأدوار تجمع Capabilities.
3. يجب تطبيق الصلاحيات في UI وServer Actions وServices وRLS وAPI.
4. Platform Capabilities منفصلة عن Workspace Capabilities.
5. `site.design.manage` و`site.publish` تبقيان لـ Platform Admin في النسخة الأولى.

## 18. الوحدات الأساسية المعتمدة للنسخة الأولى

الوحدات الجديدة المعتمدة:

### 18.1 Platform Administration

* قائمة Workspaces.
* إنشاء Workspace.
* مشاهدة Workspace.
* تفعيل أو تعليق Workspace.
* إنشاء Store.
* تعيين Workspace Owner.
* مشاهدة حالة Stores.
* تحديد الوحدات المتاحة.
* إدارة أساسية للدومين والنشر.
* سجل إداري أساسي.

### 18.2 Store Management

* Store Profile.
* Store Status.
* Store Members or Store Access.
* Store Settings.
* Currency.
* Locale.
* Timezone.
* Contact Information.
* Business Hours.

### 18.3 Categories

* إنشاء تصنيف.
* تعديل تصنيف.
* ترتيب التصنيفات عند الحاجة.
* تفعيل أو أرشفة التصنيف.

### 18.4 Products

* إنشاء منتج.
* تعديل منتج.
* اسم.
* وصف.
* صور.
* سعر.
* SKU اختياري.
* حالة النشر.
* تصنيف.
* حالة الأرشفة.

### 18.5 Inventory

* كمية المخزون.
* حالة التوفر.
* تعديلات المخزون.
* منع القيم غير الصحيحة.
* سجل تغييرات أساسي.
* عزل المخزون حسب Store.

لا يشمل الإصدار الأول إدارة مستودعات متعددة إلا بعد اعتمادها.

### 18.6 Orders

* إنشاء طلب من موقع العميل.
* Order Items.
* بيانات العميل.
* إجمالي الطلب.
* عملة الطلب.
* حالات الطلب المعتمدة.
* عرض الطلبات.
* تحديث الحالة.
* سجل تغييرات الحالة.
* حماية من الطلبات المتكررة حسب العقد المعتمد.

### 18.7 Store Customers

* حفظ العملاء المرتبطين بالطلبات.
* البحث الأساسي.
* معلومات التواصل المسموحة.
* تاريخ طلبات العميل.
* عزل العملاء حسب النطاق المعتمد.

### 18.8 External API

* Versioned API.
* Public read endpoints.
* Secure order creation.
* Private dashboard endpoints where needed.
* Schema validation.
* Authentication.
* Authorization.
* Rate limiting.
* Idempotency.
* Error contract.
* Key rotation strategy.
* Auditability.

لا يتم تنفيذ API قبل اعتماد External API ADR.

### 18.9 Client Dashboard

* Dashboard.
* Products.
* Categories.
* Inventory.
* Orders.
* Customers.
* Store Information.
* Business Hours.
* Team where authorized.
* Reports الأساسية.

لا يظهر فيها:

* Platform Workspaces.
* Platform Stores الأخرى.
* Website Builder.
* أسرار API.
* إعدادات النشر الحساسة.
* Platform Audit Logs.
* قاعدة البيانات.
* إعدادات Verix الداخلية.

## 19. الوحدات الحالية

يحتوي Verix حاليًا على وحدات أخرى مثل:

* CRM.
* Leads.
* Pipelines.
* Services.
* Bookings.
* Properties.
* Rental Units.
* Reservations.
* Housekeeping.
* Invoices.
* Payments.
* Website Builder.

هذه الوحدات لا تُحذف تلقائيًا.

القواعد:

1. تبقى محفوظة أثناء تطوير Commerce.
2. لا يتم دمج Booking وReservation وOrder بلا قرار Domain واضح.
3. لا يتم اعتبار Service مساويًا لـ Product.
4. لا يتم اعتبار Reservation مساويًا لـ Order.
5. لا يتم توسيع هذه الوحدات ضمن مشروع Commerce إلا إذا كانت ضرورية مباشرة.
6. أي إعادة تنظيم لهذه المجالات تحتاج وثيقة أو ADR منفصلة.

## 20. ما هو خارج نطاق النسخة الأولى

الميزات التالية خارج النطاق:

* تطبيقات الهاتف.
* بوابات دفع فعلية جديدة.
* تكامل الشحن.
* نظام محاسبة كامل.
* تعدد المستودعات.
* Marketplace.
* نظام بائعين متعددين.
* AI Website Generation.
* محرر تصميم حر للعميل.
* سحب وإفلات كامل شبيه بـ Webflow.
* إدارة POS.
* تكامل Booking.com.
* تكامل ERP.
* تكامل WhatsApp API الرسمي.
* برامج ولاء.
* اشتراكات متجر آلية.
* ضرائب دولية متقدمة.
* تعدد عملات متقدم داخل الطلب الواحد.
* قواعد بيانات منفصلة لكل عميل.
* Custom Roles كاملة.
* متجر تطبيقات أو Plugins.
* إعادة كتابة Verix من الصفر.
* نقل جميع المجالات إلى Microservices.
* تقسيم مبكر للحزم دون حاجة فعلية.

## 21. استراتيجية المعمارية

المبدأ:

> Harden first, separate only when justified, and extend through stable domain boundaries.

القواعد:

1. لا تتم إعادة كتابة Monolith الحالي لمجرد الوصول إلى شكل نظري.
2. يبقى `apps/web` كما هو في البداية.
3. لا تتم إعادة تسميته إلى `apps/marketing`.
4. يمكن استخراج Marketing لاحقًا بعد ثبات الحدود.
5. يمكن إنشاء `apps/admin` فقط عندما تعتمد حدود Platform Admin ويكون الفصل مفيدًا أمنيًا وتشغيليًا.
6. يمكن إنشاء `apps/api` فقط عندما تبرر متطلبات النشر أو الأمان ذلك.
7. يمكن البدء بـ Versioned Route Handlers داخل التطبيق الحالي إذا اعتمد External API ADR هذا الخيار.
8. لا تُنشأ حزمة مشتركة إلا عند وجود استخدام مشترك حقيقي ومستقر.
9. لا تُنقل قاعدة البيانات إلى Package مستقل قبل وجود أكثر من مستهلك فعلي يحتاجها.
10. يجب تجنب Coupling بين Dashboard وMarketing Components.

## 22. البنية المستهدفة المفاهيمية

هذه بنية مستهدفة وليست أمرًا فوريًا لإنشاء جميع المجلدات:

```text
apps/
├── web/                 # التطبيق الحالي حتى اعتماد فصل جديد
├── admin/               # محتمل لاحقًا للإدارة المركزية
├── marketing/           # محتمل لاحقًا بعد الاستخراج
├── api/                 # محتمل لاحقًا إذا تطلب النشر
└── docs/                # توثيق ومكتبة مكونات داخلية

packages/
├── ui/
├── permissions/
├── api-contracts/
├── observability/
├── auth/
└── db/
```

إنشاء أي عنصر من هذه العناصر يحتاج إلى مهمة معتمدة في السبرنت المناسب.

## 23. API Contract Principles

يجب أن يحدد External API ADR:

* Versioning.
* Base paths.
* Public versus private endpoints.
* Site and Store identification.
* Credential model.
* Request signing if needed.
* OAuth or API keys if adopted.
* Key scopes.
* Key rotation.
* CORS.
* Rate limiting.
* Idempotency.
* Pagination.
* Error format.
* DTOs.
* Input validation.
* Output filtering.
* Logging.
* Revocation.
* Abuse protection.

لا يجوز أن يثق API في `store_id` المرسل دون تحقق من بيانات الاعتماد.

## 24. نموذج بيانات Commerce المبدئي

هذا نموذج مفاهيمي، ولا يمثل مخطط قاعدة بيانات نهائيًا:

```text
workspaces
stores
store_memberships or store_access
sites
categories
products
product_images
inventory_items
inventory_adjustments
orders
order_items
order_status_events
store_customers
store_settings
audit_events
api_clients
api_keys
```

قبل إنشاء الجداول يجب إعداد Database Design تفصيلي يتضمن:

* المفاتيح.
* العلاقات.
* القيود.
* Unique Constraints.
* Indexes.
* Soft Deletion.
* Money representation.
* Timezone handling.
* RLS.
* Audit requirements.

## 25. Money وCurrency

القواعد:

1. لا تستخدم Floating Point لتخزين الأموال.
2. يجب استخدام نموذج الأموال الحالي القائم على أصغر وحدة نقدية أو نموذج معتمد مكافئ.
3. كل Order يحمل Currency واضحة.
4. يجب عدم جمع قيم بعملات مختلفة.
5. يجب منع تحويلات ضمنية غير موثقة.
6. يجب تجنب PostgreSQL 32-bit casts للمجاميع المالية.
7. أي دعم لتحويل العملات خارج النطاق الأول.

## 26. الوقت والتاريخ

القواعد:

* Workspace وStore يحتاجان Timezone واضحة.
* عمليات اليوم والتقارير تعتمد على توقيت النشاط.
* التخزين الزمني يكون متسقًا.
* Calendar dates لا تفسر بصورة قد تغير اليوم حسب بيئة الخادم.
* النطاقات تستخدم Exclusive End عند ملاءمتها.
* لا يتم افتراض UTC بوصفه عرضًا نهائيًا للعميل، رغم إمكان استخدامه للتخزين.

## 27. الملفات والصور

يجب أن تضمن بنية التخزين:

* فصل مسارات Workspaces.
* فصل مسارات Stores.
* التحقق من نوع وحجم الملفات.
* عدم كشف مسارات داخلية حساسة.
* صلاحيات رفع وحذف واضحة.
* عدم السماح لموقع عام برفع ملفات إدارية دون توثيق مناسب.
* إدارة Product Images.
* إدارة Brand Assets.
* Audit عند العمليات الحساسة.

تفاصيل التخزين تحتاج تصميمًا قبل التنفيذ.

## 28. Audit Log

يجب إنشاء سجل تدقيق عام غير مساوي لـ CRM Activity.

يجب أن يسجل تدريجيًا:

* إنشاء Workspace.
* تعليق Workspace.
* إنشاء Store.
* تغيير Store Status.
* تغيير الصلاحيات.
* إنشاء أو إلغاء مفاتيح API.
* عمليات النشر.
* تغيير الدومين.
* تحديث الطلبات الحساسة.
* تعديلات المخزون.
* عمليات الدعم الإداري.
* العمليات المالية الحساسة عند الحاجة.

كل حدث يحتاج:

* Actor.
* Actor Type.
* Workspace.
* Store إن وجد.
* Action.
* Target Type.
* Target ID.
* Timestamp.
* Metadata آمنة.
* Request ID عند توفره.

لا تُسجل الأسرار أو كلمات المرور أو المفاتيح الخام.

## 29. المراقبة والأخطاء

يستمر استخدام:

* Structured Logging.
* Request IDs.
* Generic Public Errors.
* Internal Error Context.
* Security Headers.
* CSP.
* Validation.

يجب مستقبلًا إضافة:

* Platform-level health visibility.
* API request metrics.
* Audit-event monitoring.
* Failed integration monitoring.
* Safe support diagnostics.

## 30. قواعد الواجهة

### Platform Admin UI

* هوية Verix.
* وصول مركزي.
* Workspaces.
* Stores.
* Domains.
* Publishing.
* Modules.
* Audit.
* Platform Status.

### Client UI

* هوية العميل.
* تنقل مبني على Capabilities.
* لا يعرض الوحدات غير المفعلة.
* لا يعرض وظائف ممنوعة ثم يعتمد فقط على رفض الخادم.
* حالات Loading وEmpty وError وPermission واضحة.
* متجاوب.
* قابل للوصول.
* لا يكرر لوحة مستقلة برمجيًا لكل عميل.

## 31. قواعد جودة التنفيذ

كل مهمة تنفيذية يجب أن:

1. تكون ضمن سبرنت واحد.
2. تحل هدفًا واحدًا واضحًا.
3. تحدد الملفات المتوقعة.
4. لا تجري تغييرات جانبية.
5. تضيف اختبارات مناسبة.
6. تمر عبر TypeScript.
7. تمر عبر ESLint.
8. تمر عبر الاختبارات.
9. تمر عبر Production Build عندما يكون ذلك ممكنًا.
10. تمر عبر `git diff --check`.
11. لا تجري Migration دون موافقة صريحة.
12. لا تنشئ Commit إلا عندما يُطلب ذلك.
13. لا تبدأ مهمة تالية قبل مراجعة الحالية.

## 32. استراتيجية الاختبارات

يجب أن تشمل طبقات الاختبار تدريجيًا:

* Unit Tests.
* Validator Tests.
* Permission Tests.
* Service Tests.
* Database Integration Tests.
* Migration Bootstrap Tests.
* RLS Tests.
* Tenant Isolation Tests.
* API Contract Tests.
* API Authorization Tests.
* End-to-End Tests.
* Build Validation.

الاختبارات الخالصة وحدها لا تكفي لإثبات عزل البيانات.

يجب توفير PostgreSQL تجريبي قابل للتخلص منه في السبرنت الأمني المناسب.

## 33. السبرنتات الرسمية

### Sprint 0 — Documentation and Architecture Approval

الأهداف:

* إنشاء هذه الوثيقة.
* توثيق النظام الحالي.
* اعتماد المصطلحات.
* اعتماد العلاقات.
* اعتماد النطاق.
* اعتماد قواعد التغيير.
* إنشاء ADR backlog.
* منع التطوير الجديد حتى اعتماد الوثيقة.

معيار الإغلاق:

* الوثيقة موجودة.
* تمت مراجعتها.
* لا توجد تناقضات مع القرارات المعتمدة.
* تم Commit الوثيقة.
* تم إعلانها Source of Truth.

### Sprint 1 — Identity and Tenant Isolation Hardening

الأهداف:

* Identity ADR.
* Immutable Supabase identity linkage.
* Active Workspace model.
* Active Store model الأساسي.
* Threat Model.
* Permission Matrix.
* Role-aware enforcement plan.
* Migration/RLS reproducibility plan.
* اختبارات عزل مبدئية.

لا يتضمن:

* Products.
* Orders.
* Inventory.
* External commerce API.

معيار الإغلاق:

* الهوية والعزل موثقان ومطبقان وفق النطاق.
* لا توجد آلية اختيار Workspace صامتة غير آمنة.
* اختبارات الأمان المحددة ناجحة.

### Sprint 2 — Platform Admin Foundation

الأهداف:

* فصل Platform Admin.
* حماية مسارات الإدارة.
* قائمة Workspaces.
* تفاصيل Workspace.
* إنشاء Workspace.
* تعيين المالك.
* تعليق وتفعيل Workspace.
* Platform Audit مبدئي.

معيار الإغلاق:

* Tenant user لا يصل إلى Platform Admin.
* Platform actions مسجلة.
* الاختبارات والصلاحيات ناجحة.

### Sprint 3 — Store Domain Foundation

الأهداف:

* تصميم Store Domain.
* إنشاء Store.
* ربطه بـ Workspace.
* Store Status.
* Store Settings.
* Store Access.
* Active Store.
* Currency وLocale وTimezone.

معيار الإغلاق:

* Workspace يدعم عدة Stores.
* لا توجد بيانات Store خارج نطاق Workspace.
* الاختبارات والعزل ناجحان.

### Sprint 4 — Categories and Products

الأهداف:

* Categories.
* Products.
* Product Images الأساسية.
* Status.
* Archive.
* Dashboard UI.
* Capabilities.
* RLS.

معيار الإغلاق:

* CRUD آمن.
* العميل يرى Store المصرح به فقط.
* الصور والبيانات معزولة.
* الاختبارات ناجحة.

### Sprint 5 — Inventory

الأهداف:

* Inventory model.
* Stock quantity.
* Availability.
* Adjustments.
* Basic history.
* Permission enforcement.

معيار الإغلاق:

* لا توجد قيم مخزون غير صحيحة.
* كل تعديل مسجل.
* العزل والصلاحيات ناجحة.

### Sprint 6 — Orders

الأهداف:

* Order model.
* Order items.
* Customer snapshot.
* Status workflow.
* Totals.
* Currency.
* Internal dashboard creation/testing.
* Status events.

معيار الإغلاق:

* الحسابات صحيحة.
* الانتقالات محكومة.
* الطلبات معزولة حسب Store.
* الاختبارات ناجحة.

### Sprint 7 — External API Contract and Security

الأهداف:

* External API ADR.
* Versioned contracts.
* API client credentials.
* Public product/category reads.
* Secure order creation.
* Rate limiting.
* Idempotency.
* Key rotation model.
* API logs.
* Contract tests.

معيار الإغلاق:

* لا يمكن لموقع الوصول إلى Store آخر.
* المفاتيح قابلة للإلغاء.
* الطلبات المتكررة معالجة.
* العقود والاختبارات ناجحة.

### Sprint 8 — First Independent Client Website

الأهداف:

* إنشاء أول موقع متجر قهوة مستقل.
* تصميم مخصص.
* ربطه بـ Verix API.
* عرض التصنيفات والمنتجات.
* إنشاء طلب.
* اختبار تغييرات البيانات.
* ربط بيئة تطوير آمنة.

معيار الإغلاق:

* الموقع يعمل دون ظهور Verix للزائر.
* المنتجات تأتي من Verix.
* الطلب يصل إلى Store الصحيح.
* لا توجد أسرار خاصة في العميل.
* الاختبارات الأساسية ناجحة.

### Sprint 9 — White-Label Client Dashboard

الأهداف:

* Store branding.
* Dynamic navigation.
* Module visibility.
* Client login identity.
* Product/order/inventory views.
* إزالة روابط التصميم والنشر.
* تحسين حالات الصلاحية.

معيار الإغلاق:

* العميل يرى هويته.
* لا يرى Website Builder.
* لا يرى Platform Admin.
* لا يرى بيانات Store آخر.

### Sprint 10 — Platform Website Management

الأهداف:

* تحويل Website Builder إلى أداة Platform Admin مؤكدة.
* Store-to-Site association.
* Content bindings.
* Publishing controls.
* Domain controls.
* Versions and rollback review.
* Restrict client access.

معيار الإغلاق:

* Platform Admin يتحكم بالتصميم.
* العميل يعدل المحتوى المسموح فقط.
* النشر والدومين محميان.

### Sprint 11 — Audit, Observability, and Operational Hardening

الأهداف:

* Audit coverage.
* Integration logs.
* API monitoring.
* Security review.
* Database integration tests.
* RLS tests.
* Migration bootstrap tests.
* Operational documentation.

معيار الإغلاق:

* العزل مثبت باختبارات قاعدة بيانات.
* إعادة إنشاء قاعدة البيانات موثقة.
* العمليات الحساسة قابلة للتدقيق.

### Sprint 12 — MVP Release Readiness

الأهداف:

* Full regression.
* Production build.
* Deployment checklist.
* Security checklist.
* Backup and recovery notes.
* First-client onboarding checklist.
* Support procedures.
* Release notes.

معيار الإغلاق:

* جميع السبرنتات المطلوبة مغلقة.
* لا توجد مشكلات أمنية حرجة مفتوحة.
* أول عميل يمكن إدخاله وفق خطوات موثقة.

## 34. ADR Backlog

يجب إنشاء ADRs مستقبلية للمواضيع التالية:

1. Identity Linkage.
2. Active Workspace and Store.
3. Platform Admin Boundary.
4. Capability and Permission Model.
5. RLS and Migration Reproducibility.
6. Store Domain and Cardinality.
7. External API Deployment Boundary.
8. API Credential Model.
9. Money and Currency.
10. File Storage.
11. Audit Logging.
12. Website Builder Access.
13. Client Website Integration.
14. Marketing Extraction.
15. Docs and Design-System Access.

لا تنشئ ADRs تنفيذية الآن إلا إذا كانت وثائق فارغة ضمن Backlog. الأفضل تسجيل القائمة فقط في الوثيقة الرئيسية.

## 35. سياسة تغيير النطاق

لتعديل الوثيقة:

1. تحديد سبب التغيير.
2. تحديد الأقسام المتأثرة.
3. تحديد أثر قاعدة البيانات.
4. تحديد أثر الأمان.
5. تحديد أثر API.
6. تحديد أثر الواجهات.
7. تحديد أثر السبرنتات.
8. إصدار نسخة جديدة.
9. مراجعة النسخة.
10. اعتمادها قبل التنفيذ.

أمثلة:

* تعديل توضيحي غير جوهري: `v1.0.1`.
* إضافة ميزة صغيرة: `v1.1`.
* تغيير بنية رئيسية: `v2.0`.

## 36. تعليمات Codex الدائمة

عند تنفيذ أي مهمة مستقبلية، يجب على Codex:

* قراءة هذه الوثيقة أولًا.
* قراءة `CLAUDE.md`.
* تحديد السبرنت الحالي.
* تحديد المتطلب المرتبط بالمهمة.
* رفض توسيع النطاق من تلقاء نفسه.
* ذكر أي تعارض قبل التعديل.
* عدم تنفيذ ميزة من سبرنت لاحق.
* عدم اعتبار التحسينات الاختيارية مطلوبة.
* عدم حذف الوظائف الحالية إلا بقرار معتمد.
* عدم إجراء Migration بلا تعليمات صريحة.
* تقديم تقرير بالملفات والاختبارات والقيود.

## 37. معايير اعتماد الوثيقة

تعتبر الوثيقة معتمدة عندما:

* تكون محفوظة في المسار المحدد.
* تتم مراجعة محتواها.
* لا يضيف Codex قرارات جديدة.
* يتم Commit الوثيقة برسالة واضحة.
* يكون Git working tree نظيفًا.
* يتم إعلان الإصدار `v1.0` مصدرًا رسميًا للمشروع.

## 38. البيان النهائي

اعتبارًا من اعتماد هذه الوثيقة:

> Verix منصة إدارة وتشغيل مركزية متعددة العملاء. يدير Platform Admin تصميم مواقع العملاء ونشرها، بينما يدير العميل محتوى نشاطه وعملياته فقط من لوحة تحكم محدودة ومعزولة. مواقع العملاء مستقلة في الهوية والتصميم، لكنها تعتمد على خدمات Verix الخلفية الآمنة.

أي عمل يخالف هذا البيان أو يتجاوز السبرنت المعتمد يعتبر خارج النطاق.
