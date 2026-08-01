(function () {
  "use strict";

  if (!window.COURSES || !window.COURSES.publicSecurityZoneSupervisor) {
    return;
  }

  window.COURSES.publicSecurityZoneSupervisor.questions = [
    {
      id: "public-security-zone-supervisor-q01",
      text: "ما تعريف ضابط إشراف المنطقة؟",
      options: [
        "مسؤول عن وحدات منطقته والمرجع الأول لهم داخل الميدان",
        "مسؤول عن صيانة مركبات المنطقة",
        "مفاوض السرقات فقط"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q02",
      text: "ما نطاق الرتب المسموح لها باستلام ضابط إشراف المنطقة بحسب العرض؟",
      options: [
        "من رقيب إلى رئيس رقباء",
        "من جندي إلى عريف",
        "من ملازم إلى عقيد فقط"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q03",
      text: "كل كم يجب على المشرف متابعة وجود وحدات منطقته في مواقعها؟",
      options: ["كل 15 دقيقة", "كل 60 دقيقة", "مرة واحدة يوميًا"],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q04",
      text: "أين يجب التأكد من وجود الوحدات أثناء المتابعة؟",
      options: [
        "في الميدان وليس في الموجّه",
        "في الموجّه فقط",
        "داخل مركز الشرطة فقط"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q05",
      text: "ما موقع المشرف في تسلسل المراجع لوحدات منطقته؟",
      options: [
        "هو المرجع الأول ولا يسمح بتخطيه",
        "مرجع اختياري يمكن تجاوزه دائمًا",
        "لا علاقة له بمراجع الوحدات"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q06",
      text: "ما الإجراء الصحيح عند حدوث فوضى في المنطقة؟",
      options: [
        "جمع العساكر في موقع آمن ثم إعادة توزيع وحدات المنطقة",
        "ترك الوحدات تتوزع عشوائيًا",
        "إخراج جميع الوحدات من المدينة"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q07",
      text: "كل كم يرسل ضابط إشراف المنطقة تقريره؟",
      options: ["كل 60 دقيقة", "كل 15 دقيقة", "كل 3 ساعات"],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q08",
      text: "ماذا يتضمن تقرير المنطقة؟",
      options: [
        "الملاحظات السلبية والإيجابية للمنطقة",
        "أسماء المواطنين فقط",
        "أسعار المركبات"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q09",
      text: "ماذا يفعل المشرف عند عدم وجود مسؤول عمليات أو نائب؟",
      options: [
        "يوجه وحدة لاستلام مهام العمليات",
        "يوقف جميع الوحدات",
        "يغادر المنطقة"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q10",
      text: "عن أي وحدات يكون «لام 10» مسؤولًا؟",
      options: ["وحدات لام 1", "وحدات لام 2", "وحدات لام 5"],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q11",
      text: "عن أي وحدات يكون «لام 20» مسؤولًا، ولمن الأولوية؟",
      options: [
        "وحدات لام 2، مع الأولوية لرتبة رئيس رقباء",
        "وحدات لام 1، مع الأولوية للجندي",
        "وحدات لام 4، مع الأولوية للعريف"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q12",
      text: "عن أي وحدات يكون «لام 30» مسؤولًا؟",
      options: ["وحدات لام 3", "وحدات لام 4", "وحدات لام 5"],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q13",
      text: "عن أي وحدات يكون «لام 40» مسؤولًا؟",
      options: ["وحدات لام 4", "وحدات لام 2", "وحدات لام 1"],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q14",
      text: "عن أي وحدات يكون «لام 50» مسؤولًا؟",
      options: ["وحدات لام 5", "وحدات لام 3", "وحدات لام 2"],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q15",
      text: "كيف يجب على المشرف التعامل مع وحداته؟",
      options: [
        "بفن التعامل وبث الحماس والثقة",
        "بالتهديد المستمر دون توجيه",
        "بتجاهل أخطائهم"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q16",
      text: "ما الإجراء عند عدم انصياع الوحدة بعد تحذيرها بأسلوب محترم؟",
      options: [
        "رفع كود العسكري للشرطة العسكرية مباشرة",
        "منحها ترقية",
        "تجاهل المخالفة"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q17",
      text: "من يستدعي المشرف إذا لم يستطع حل مشكلة وحداته؟",
      options: [
        "الضابط، وليس القيادة مباشرة",
        "القيادة مباشرة دائمًا",
        "أي مواطن قريب"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q18",
      text: "من يكون المسؤول الأول عن خلية إرهابية في المنطقة عند عدم وجود ضابط؟",
      options: [
        "ضابط إشراف المنطقة",
        "أحدث جندي في الميدان",
        "مسؤول الميكانيكي"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q19",
      text: "ماذا يجب على المشرف فعله عند مداهمة خلية إرهابية؟",
      options: [
        "التخطيط وتوزيع الوحدات بسرعة",
        "ترك الوحدات دون توزيع",
        "مغادرة المنطقة"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q20",
      text: "ما القاعدة المتعلقة بتسلسل المراجع؟",
      options: [
        "يمنع تخطي المراجع أو التوجه للقيادة مباشرة",
        "يجوز تخطي جميع الضباط",
        "التسلسل اختياري للمشرف"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q21",
      text: "ماذا يحدث للمشرف عند وقوع مشكلة في منطقته؟",
      options: [
        "يستدعى مباشرة ويتم التحقيق معه",
        "لا يسأل عنها",
        "ينقل المسؤولية تلقائيًا إلى العمليات"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q22",
      text: "من يتحمل المسؤولية إذا تخطى أحد أفراد المنطقة المراجع؟",
      options: [
        "ضابط إشراف المنطقة يُحاسب مباشرة",
        "المواطنون في الموقع",
        "مسؤول الميكانيكي"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q23",
      text: "ما نتيجة عدم الجدارة في استلام إشراف المنطقة؟",
      options: [
        "الحرمان من الترقية وسحب الدورة",
        "الترقية الفورية",
        "منح دورة إضافية دون إجراء"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q24",
      text: "ماذا يحدث للعقوبة عند صدور مشكلة أو شكوى صحيحة على المشرف؟",
      options: ["تضاعف العقوبة", "تلغى العقوبة", "تتحول إلى تنبيه فقط"],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q25",
      text: "كيف يجب اتخاذ القرارات عند حدوث المشاكل؟",
      options: [
        "بالهدوء واختيار القرار الصحيح",
        "بالتسرع والنقاش عبر الراديو",
        "بتجاهل المشكلة"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q26",
      text: "ماذا يترتب على التراخي وعدم القدرة على السيطرة والتنظيم؟",
      options: [
        "سحب الدورة وتأخير الترقية حتى إثبات القدرة",
        "منح رتبة أعلى",
        "إعفاء المشرف من المتابعة فقط"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q27",
      text: "أي صفة مطلوبة في ضابط إشراف المنطقة؟",
      options: [
        "القدرة على التخطيط العسكري وحل مشاكل الأفراد",
        "عدم معرفة قوانين الأمن العام",
        "تجنب الإجابة عن استفسارات الوحدات"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q28",
      text: "ما الشرط المتعلق بالدورات السابقة؟",
      options: [
        "الحصول على جميع الدورات السابقة",
        "عدم الحاجة إلى أي دورة",
        "الحصول على دورة المرور فقط"
      ],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q29",
      text: "ما الموجات المخصصة للسرقات بحسب العرض؟",
      options: ["1 و2 و3", "6 و7", "18 و19"],
      answerIndex: 0
    },
    {
      id: "public-security-zone-supervisor-q30",
      text: "متى يستطيع الراسب إعادة دورة ضابط إشراف المنطقة؟",
      options: [
        "بعد 7 أيام، ولا يستلم الإشراف قبل النجاح",
        "في اليوم نفسه مع استلام الإشراف",
        "بعد 30 يومًا مع السماح له بالإشراف"
      ],
      answerIndex: 0
    }
  ];
})();

