(function () {
  "use strict";

  if (!window.COURSES || !window.COURSES.publicSecurityOperations) {
    return;
  }

  window.COURSES.publicSecurityOperations.questions = [
    {
      id: "public-security-operations-q01",
      text: "ما الدور الأساسي لمركز العمليات؟",
      options: [
        "تنفيذ التحقيقات الجنائية",
        "القيادة والتحكم وربط القطاعات وتلقي البلاغات وتوجيه الوحدات",
        "صيانة المركبات"
      ],
      answerIndex: 1
    },
    {
      id: "public-security-operations-q02",
      text: "ما أولى مهام العمليات عند استقبال بلاغ؟",
      options: [
        "تأجيله حتى تتجمع الوحدات",
        "توجيه الوحدات بأقصى سرعة واحترافية",
        "إرساله إلى المدنيين"
      ],
      answerIndex: 1
    },
    {
      id: "public-security-operations-q03",
      text: "ماذا يجب على العمليات أن تفعل بعد تمرير البلاغ؟",
      options: [
        "مغادرة الراديو",
        "متابعة البلاغ باستمرار على الراديو",
        "انتظار تقرير مكتوب فقط"
      ],
      answerIndex: 1
    },
    {
      id: "public-security-operations-q04",
      text: "ما التصرف تجاه بلاغ غير مهم تقرر العمليات إسقاطه؟",
      options: [
        "تنفيذ قرار الإسقاط دون مجادلة",
        "مناقشته عبر الراديو",
        "إرسال كل الوحدات إليه"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-operations-q05",
      text: "متى يسمح بإعادة تحضير الأكواد عند عدم استجابة الوحدات؟",
      options: [
        "دون إذن وفي أي وقت",
        "بإذن شمال أو جنوب",
        "بعد موافقة أي جندي"
      ],
      answerIndex: 1
    },
    {
      id: "public-security-operations-q06",
      text: "كم مرة يسمح بتكرار تحضير الأكواد خلال ساعة واحدة؟",
      options: ["مرة واحدة", "ثلاث مرات", "دون حد"],
      answerIndex: 0
    },
    {
      id: "public-security-operations-q07",
      text: "هل يسمح للوحدات بالتوجه إلى البلاغات دون إذن العمليات؟",
      options: [
        "نعم دائمًا",
        "فقط عند قربها من الموقع",
        "لا، يجب أن توجهها العمليات"
      ],
      answerIndex: 2
    },
    {
      id: "public-security-operations-q08",
      text: "أين يجب أن يتمركز مسؤول العمليات؟",
      options: ["في أي منطقة يختارها", "في قسم لوس سانتوس", "داخل المستشفى"],
      answerIndex: 1
    },
    {
      id: "public-security-operations-q09",
      text: "ما الدور الأساسي لنائب العمليات؟",
      options: [
        "مساندة العمليات وتوزيع الوحدات لتغطية المناطق",
        "قيادة الميكانيكيين",
        "التحقيق مع الموقوفين"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-operations-q10",
      text: "متى يستلم نائب العمليات البلاغات ويوجه الوحدات؟",
      options: ["في غياب مسؤول العمليات", "عند وجود جميع الضباط", "بعد نهاية التقرير"],
      answerIndex: 0
    },
    {
      id: "public-security-operations-q11",
      text: "أين تسجل حالات الغفوة والدخول والخروج؟",
      options: ["عبر موجة الراديو", "في روم العمليات على Discord", "في الشات العام"],
      answerIndex: 1
    },
    {
      id: "public-security-operations-q12",
      text: "متى يحق لنائب العمليات إزالة كود وحدة غير مستجيبة؟",
      options: ["بعد دقيقتين", "بعد أكثر من 10 دقائق", "بعد ساعة"],
      answerIndex: 1
    },
    {
      id: "public-security-operations-q13",
      text: "متى يستطيع نائب العمليات مغادرة قسم لوس سانتوس؟",
      options: ["في أي وقت", "بإذن شمال أو جنوب", "بعد إبلاغ أحد المدنيين"],
      answerIndex: 1
    },
    {
      id: "public-security-operations-q14",
      text: "ماذا يعني المسمى الميداني «قيادة»؟",
      options: ["أعلى رتبة في الميدان", "قائد المرور فقط", "نائب العمليات"],
      answerIndex: 0
    },
    {
      id: "public-security-operations-q15",
      text: "ماذا يعني المسمى «حزم»؟",
      options: [
        "ثاني أعلى رتبة ميدانية ومسؤول عن الوحدات من رتبة عميد فما فوق",
        "وحدة دعم جوي",
        "وحدة من رتبة جندي"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-operations-q16",
      text: "ماذا يعني المسمى «درع»؟",
      options: [
        "المسؤول عن الهلال الأحمر",
        "ثالث أعلى رتبة ميدانية ومسؤول عن الوحدات من رتبة رائد فما فوق",
        "مسؤول الميكانيكي"
      ],
      answerIndex: 1
    },
    {
      id: "public-security-operations-q17",
      text: "من يشغل المسمى الميداني «شمال»؟",
      options: [
        "من رتبة ملازم إلى نقيب",
        "من رتبة جندي إلى عريف",
        "من رتبة عقيد فما فوق فقط"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-operations-q18",
      text: "من يحق له حمل المسمى «برق 1»؟",
      options: ["من رتبة ملازم فما فوق", "الجندي فقط", "الميكانيكي"],
      answerIndex: 0
    },
    {
      id: "public-security-operations-q19",
      text: "ما شرط «برق 2» و«برق 3»؟",
      options: [
        "رتبة رقيب إلى رئيس رقباء والحصول على دورة المهام والواجبات الخاصة",
        "رتبة جندي أول فقط",
        "الحصول على دورة المرور"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-operations-q20",
      text: "من يحق له استخدام «صقر 2» و«صقر 3»؟",
      options: [
        "وكيل رقيب إلى رئيس رقباء في الدعم الجوي",
        "ملازم فما فوق فقط",
        "أفراد المرور"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-operations-q21",
      text: "ما دور مسميات لام 10 ولام 20 ولام 30 ولام 40 ولام 50؟",
      options: [
        "الإشراف على الوحدات ضمن نطاق المنطقة",
        "نقل المصابين",
        "إصلاح المركبات"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-operations-q22",
      text: "كم تستمر دورة تقرير العمليات قبل أن تنتهي تلقائيًا؟",
      options: ["30 دقيقة", "60 دقيقة", "ساعتان"],
      answerIndex: 1
    },
    {
      id: "public-security-operations-q23",
      text: "ماذا يحدث لتسجيل الوحدة عند خروجها من المدينة؟",
      options: ["تبقى مسجلة دائمًا", "تسجل خروجها تلقائيًا", "تنتقل إلى موجة أخرى"],
      answerIndex: 1
    },
    {
      id: "public-security-operations-q24",
      text: "ما القاعدة عند تسجيل الوحدات في تقرير العمليات؟",
      options: [
        "تسجيلها في أي موقع متاح",
        "تسجيلها في موقعها الصحيح والمعتمد",
        "عدم ذكر موقعها"
      ],
      answerIndex: 1
    },
    {
      id: "public-security-operations-q25",
      text: "ما المطلوب قبل تسجيل خروج مسؤول العمليات أو نائبه؟",
      options: [
        "الخروج مباشرة",
        "أخذ إذن شمال 1 وتوجيه بديل لاستلام المهام",
        "إرسال رسالة إلى المدنيين"
      ],
      answerIndex: 1
    },
    {
      id: "public-security-operations-q26",
      text: "كيف تطرح الاستفسارات أو الاعتراضات الميدانية؟",
      options: [
        "بالنقاش المطول عبر الراديو",
        "بمقابلة مشرف المنطقة ميدانيًا أو التوجه لمركز الشرطة مع الالتزام بالمراجع",
        "في الشات العام"
      ],
      answerIndex: 1
    },
    {
      id: "public-security-operations-q27",
      text: "ما المعلومة التي يجب ذكرها قبل أي بلاغ على الراديو؟",
      options: ["الاسم الحقيقي", "الكود الميداني للوحدة", "عدد ساعات الخدمة"],
      answerIndex: 1
    },
    {
      id: "public-security-operations-q28",
      text: "ما ترتيب أولوية المناطق حسب العرض؟",
      options: [
        "لام 1، ثم 2، ثم 3، ثم 4، ثم 5",
        "لام 2، ثم 4، ثم 3، ثم 1، ثم 5",
        "لام 5، ثم 4، ثم 3، ثم 2، ثم 1"
      ],
      answerIndex: 1
    },
    {
      id: "public-security-operations-q29",
      text: "ما الموجات المخصصة للسرقات؟",
      options: ["1 و2 و3", "6 و7", "13 و14"],
      answerIndex: 0
    },
    {
      id: "public-security-operations-q30",
      text: "ماذا يترتب على الخروج من المدينة دون تسليم العمليات؟",
      options: [
        "لا يترتب شيء",
        "يعد تهربًا وظيفيًا وقد يؤدي إلى المحاكمة العسكرية",
        "تنبيه شفهي فقط"
      ],
      answerIndex: 1
    }
  ];
})();

