(function () {
  "use strict";

  if (!window.COURSES || !window.COURSES.publicSecurityTrafficRoadSecurity) {
    return;
  }

  window.COURSES.publicSecurityTrafficRoadSecurity.questions = [
    {
      id: "public-security-traffic-road-security-q01",
      text: "بأي جهة ترتبط الإدارة العامة للمرور إداريًا وماليًا؟",
      options: ["مديرية الأمن العام", "وزارة الصحة", "الدفاع المدني"],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q02",
      text: "متى يتم تفعيل قطاع المرور وأمن الطرق بحسب الدورة؟",
      options: [
        "عند وجود 3 إلى 5 عساكر من الأمن العام",
        "عند وجود 8 إلى 10 عساكر من الأمن العام",
        "عند وجود 15 عسكريًا على الأقل"
      ],
      answerIndex: 1
    },
    {
      id: "public-security-traffic-road-security-q03",
      text: "ما إحدى مهام المرور تجاه قرارات الجهات العليا المختصة؟",
      options: [
        "تنفيذها ومتابعتها",
        "تعليقها حتى نهاية الشهر",
        "تحويلها إلى القطاعات المدنية"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q04",
      text: "ماذا يصدر المرور وفق نظام المرور وتعديلاته لتحقيق المصلحة العامة؟",
      options: [
        "التعاميم والتعليمات",
        "الأحكام الطبية",
        "تصاريح البناء"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q05",
      text: "ما المهمة المرتبطة بالمركبات ورخص القيادة؟",
      options: [
        "تسجيل المركبات وإصدار رخص القيادة بأنواعها",
        "بيع المركبات المصادرة",
        "إصلاح جميع المركبات المدنية"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q06",
      text: "ما دور المرور تجاه المخالفات المرورية؟",
      options: [
        "تحصيل المخالفات والفصل فيها في إدارات المرور",
        "إسقاط جميع المخالفات تلقائيًا",
        "تحويل المخالفات إلى المستشفى"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q07",
      text: "ما مسؤولية المسمى الميداني «سير»؟",
      options: [
        "ضابط مرور يشرف على الوحدات ويتابع المشرفين ويسجل الملاحظات",
        "فرد يرصد المخالفات فقط",
        "مسؤول عن الدوريات الطبية"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q08",
      text: "ما الرتبة المطلوبة لحمل المسمى «سير»؟",
      options: ["جندي أول فما فوق", "ملازم فما فوق", "رئيس رقباء فقط"],
      answerIndex: 1
    },
    {
      id: "public-security-traffic-road-security-q09",
      text: "ما وصف المسمى الميداني «ميم»؟",
      options: [
        "فرد تابع لشعبة المرور يرصد المخالفين بشكل عام",
        "ضابط مسؤول عن أمن الطرق",
        "مشرف على الحملات الجنائية"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q10",
      text: "من يحق له استخدام المسمى «ميم»؟",
      options: ["جندي أول فما فوق", "ملازم فما فوق فقط", "عقيد فما فوق"],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q11",
      text: "ما مسؤولية المسمى الميداني «ساهر»؟",
      options: [
        "الإشراف على وحدات أمن الطرق ومتابعة سير العمل الميداني",
        "إصدار رخص القيادة فقط",
        "قيادة الدوريات السرية دون إشراف"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q12",
      text: "ما وصف المسمى الميداني «عين»؟",
      options: [
        "فرد تابع لأمن الطرق يرصد المخالفين ويتأكد من سلامة السير",
        "ضابط مرور من رتبة ملازم فقط",
        "مسؤول عن تحصيل الرسوم الإدارية"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q13",
      text: "ما القاعدة الأساسية للمسمى «سري»؟",
      options: [
        "دورية سرية للمراقبة المرورية ولا تبادر أو تشارك في إطلاق النار إلا للضرورة",
        "دورية هجومية للحالات الجنائية فقط",
        "دورية مدنية مسموح لها بالمشاركة في كل اشتباك"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q14",
      text: "ممن يؤخذ إذن تفعيل الحملة الأمنية؟",
      options: [
        "من سير، وفي غيابه ممن ينوب عنه وفق الشرط المحدد",
        "من أي فرد موجود في الميدان",
        "من مسؤول الميكانيكي"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q15",
      text: "ما الحد الأدنى لرتبة من ينوب عن «سير» في إعطاء إذن الحملة عند غيابه؟",
      options: ["وكيل رقيب", "رئيس رقباء", "جندي أول"],
      answerIndex: 1
    },
    {
      id: "public-security-traffic-road-security-q16",
      text: "متى يتم تفعيل الحملات الأمنية؟",
      options: [
        "عند اكتفاء الوحدات في الميدان",
        "عند عدم وجود أي وحدة ميدانية",
        "بعد انتهاء جميع البلاغات اليومية فقط"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q17",
      text: "ما رتبة مشرف الحملة الأمنية؟",
      options: ["ملازم فما فوق", "جندي أول فما فوق", "عريف فقط"],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q18",
      text: "على ماذا تركز الحملات الأمنية؟",
      options: [
        "المخالفات والبلاغات المرورية مثل السرعة والتفحيط وقطع الإشارات",
        "بلاغات المستشفيات فقط",
        "أعمال صيانة الطرق والمركبات"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q19",
      text: "ما العدد الأساسي لأفراد الحملة الأمنية؟",
      options: [
        "4 وحدات دورية ومشرف",
        "وحدتان من دون مشرف",
        "8 وحدات سرية فقط"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q20",
      text: "لمن تكون أولوية التعامل مع الحالات الجنائية؟",
      options: [
        "للأمن العام والمهمات والواجبات الخاصة وأمن الطرق",
        "للدوريات السرية المرورية فقط",
        "لأي وحدة مدنية قريبة"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q21",
      text: "متى يسمح بالخروج بالدورية السرية للمرور؟",
      options: [
        "ضمن حملة مرورية فقط",
        "في أي وقت دون حملة",
        "للانتقال الشخصي خارج الميدان"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q22",
      text: "ما الرتبة المسموح لها بالخروج بالدورية السرية؟",
      options: ["ملازم فما فوق", "جندي أول فما فوق", "عريف فما فوق"],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q23",
      text: "ما الألوان المسموحة للدوريات السرية؟",
      options: ["الأسود أو الأبيض", "الأحمر أو الأزرق", "أي لون يختاره الفرد"],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q24",
      text: "ما حكم تغيير الشكل الخارجي للدورية السرية مثل الكفرات والجنوط ولون الدخان؟",
      options: ["ممنوع", "مسموح بإذن أي فرد", "إلزامي قبل كل حملة"],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q25",
      text: "كم وحدة مرور رسمية يجب أن تكون في الميدان للسماح بالدورية السرية؟",
      options: ["وحدة واحدة", "3 وحدات", "5 وحدات"],
      answerIndex: 1
    },
    {
      id: "public-security-traffic-road-security-q26",
      text: "ماذا تفعل الدوريات السرية عند نقص الدوريات الرسمية؟",
      options: [
        "ترجع لسد النقص",
        "تغادر المدينة",
        "تستمر سرية من دون تغيير"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q27",
      text: "ما ضابط الزي والتظليل في دوريات المرور السرية؟",
      options: [
        "التظليل من 0 إلى 3 مع الالتزام بزي المرور الرسمي ومنع الملابس المدنية",
        "تظليل كامل مع السماح بالملابس المدنية",
        "لا توجد ضوابط للزي أو التظليل"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q28",
      text: "ما التصرف عند عدم توفر وحدات القطاعات ذات الأولوية للحالة الجنائية؟",
      options: [
        "تباشر وحدة المرور مع مراعاة جدول المخالفات وتثبيت السجلات الجنائية",
        "تسقط الحالة نهائيًا",
        "تكتفي بإغلاق الطريق دون مباشرة"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q29",
      text: "كيف تتصرف وحدة المرور عند بلاغ سرقة بنك أو منشأة تجارية؟",
      options: [
        "لا تتوجه إلا عند طلبها، وتكون خط الدفاع الأخير وتنظم السير وتشارك بوحدة في المطاردة",
        "تتوجه مباشرة وتقود الاقتحام",
        "تغادر المنطقة حتى انتهاء البلاغ"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-traffic-road-security-q30",
      text: "متى يسمح بسحب رخصة القيادة؟",
      options: [
        "عند ارتكاب عدة مخالفات مرورية جسيمة مثل طلب المطاردة أو التفحيط والصدم العشوائي",
        "عند أول مخالفة بسيطة دائمًا",
        "بناءً على رغبة أي وحدة دون سبب"
      ],
      answerIndex: 0
    }
  ];
})();

