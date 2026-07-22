(function () {
  "use strict";

  if (!window.COURSES || !window.COURSES.regimentsPrisonTransfer) {
    throw new Error("تعذر تحميل دورة نقل السجون للأفواج الأمنية");
  }

  window.COURSES.regimentsPrisonTransfer.questions = [
  {
    "id": "regiments-prison-transfer-q01",
    "text": "ما طبيعة دورة نقل السجون؟",
    "options": [
      "دليل للترقيات",
      "دورة تدريبية متخصصة",
      "مادة خاصة بكراج الميكانيكي"
    ],
    "answerIndex": 1
  },
  {
    "id": "regiments-prison-transfer-q02",
    "text": "لأي مهمة تؤهل دورة نقل السجون الأفراد؟",
    "options": [
      "حماية المجرمين لنقلهم إلى السجن المركزي",
      "تدريب الوحدات على الراديو",
      "إدارة تقارير العمليات"
    ],
    "answerIndex": 0
  },
  {
    "id": "regiments-prison-transfer-q03",
    "text": "وفق ماذا يتم التعامل مع المجرمين في الدورة؟",
    "options": [
      "موجات الأمن العام",
      "خريطة محافظة الرس",
      "القائمة واللائحة"
    ],
    "answerIndex": 2
  },
  {
    "id": "regiments-prison-transfer-q04",
    "text": "ما الذي يُعطى للمجرم وفق ما ورد في تعريف الدورة؟",
    "options": [
      "راحة ميدانية",
      "التهمة المناسبة",
      "رتبة عسكرية"
    ],
    "answerIndex": 1
  },
  {
    "id": "regiments-prison-transfer-q05",
    "text": "ما الجانب الذي يتعلم المتدرب أساسيات التعامل معه؟",
    "options": [
      "المشاكل البرمجية",
      "إجراءات الترقيات",
      "المواقف الأمنية"
    ],
    "answerIndex": 2
  },
  {
    "id": "regiments-prison-transfer-q06",
    "text": "ما الالتزام المذكور ضمن أهداف المتدرب؟",
    "options": [
      "البروتوكولات العسكرية",
      "موجة التدريب",
      "مواعيد الكراج"
    ],
    "answerIndex": 0
  },
  {
    "id": "regiments-prison-transfer-q07",
    "text": "ما الغرض من إعداد عناصر الدورة؟",
    "options": [
      "إدارة القطاع الآخر",
      "العمل الميداني بكفاءة عالية",
      "كتابة قوانين جديدة"
    ],
    "answerIndex": 1
  },
  {
    "id": "regiments-prison-transfer-q08",
    "text": "من أي رتبة يسمح بالتقديم إلى نقل السجون؟",
    "options": [
      "عريف فما فوق",
      "ملازم فقط",
      "وكيل رقيب فما فوق"
    ],
    "answerIndex": 2
  },
  {
    "id": "regiments-prison-transfer-q09",
    "text": "ما مدة عدم تفعيل وحدة نقل السجون التي تؤدي لسحب الدورة مباشرة؟",
    "options": [
      "3 أسابيع",
      "أسبوع واحد",
      "5 أسابيع"
    ],
    "answerIndex": 0
  },
  {
    "id": "regiments-prison-transfer-q10",
    "text": "كم مرة على الأقل يجب التفاعل في الدورة؟",
    "options": [
      "مرة واحدة شهرياً",
      "مرة واحدة أسبوعياً",
      "كل يوم"
    ],
    "answerIndex": 1
  },
  {
    "id": "regiments-prison-transfer-q11",
    "text": "ما الإجراء عند عدم التفاعل في الدورة؟",
    "options": [
      "إنزال تحذير",
      "إضافة رتبة",
      "إلغاء التحضير"
    ],
    "answerIndex": 0
  },
  {
    "id": "regiments-prison-transfer-q12",
    "text": "ما الإجراء عند تكرار عدم التفاعل؟",
    "options": [
      "تغيير موقع الوحدة",
      "تسجيل راحة تلقائية",
      "سحب الدورة"
    ],
    "answerIndex": 2
  },
  {
    "id": "regiments-prison-transfer-q13",
    "text": "إلى من يجب إبلاغ التحركات المشبوهة التي تحاول تهريب المجرمين؟",
    "options": [
      "كراج الميكانيكي",
      "العمليات فوراً",
      "قطاع آخر"
    ],
    "answerIndex": 1
  },
  {
    "id": "regiments-prison-transfer-q14",
    "text": "ما نوع التحركات التي يجب إبلاغ العمليات عنها؟",
    "options": [
      "تحركات تدريبية",
      "تحركات تبديل الموجة",
      "تحركات تحاول تهريب المجرمين"
    ],
    "answerIndex": 2
  },
  {
    "id": "regiments-prison-transfer-q15",
    "text": "متى يسمح باستخدام السلاح؟",
    "options": [
      "في حالة التهديد المباشر",
      "عند الوصول إلى السجن",
      "عند عدم التفاعل الأسبوعي"
    ],
    "answerIndex": 0
  },
  {
    "id": "regiments-prison-transfer-q16",
    "text": "كم شخصاً يجب أن يكون في كل شاحنة نقل سجون؟",
    "options": [
      "شخص واحد",
      "شخصان",
      "ثلاثة أشخاص"
    ],
    "answerIndex": 1
  },
  {
    "id": "regiments-prison-transfer-q17",
    "text": "ما الدوران المطلوبان في شاحنة نقل السجون؟",
    "options": [
      "قائد وسهم",
      "ضابط منطقة ومرافق",
      "سائق ومرافق سائق"
    ],
    "answerIndex": 2
  },
  {
    "id": "regiments-prison-transfer-q18",
    "text": "متى يمنع نقل المجرمين؟",
    "options": [
      "إلا أثناء حالات الضرورة القصوى",
      "إلا بعد الراحة",
      "إلا عند تغيير الرتبة"
    ],
    "answerIndex": 0
  },
  {
    "id": "regiments-prison-transfer-q19",
    "text": "ما المثال المذكور للضرورة القصوى في نقل المجرمين؟",
    "options": [
      "طلب من كراج الميكانيكي",
      "أمر من القيادة بتوجيههم إلى السجن المركزي",
      "تبديل موجة التدريب"
    ],
    "answerIndex": 1
  },
  {
    "id": "regiments-prison-transfer-q20",
    "text": "ما الحالة التي يحق فيها التعامل مع جميع المجرمين؟",
    "options": [
      "تأخر التحضير",
      "انتهاء الدورة",
      "وجود خلية إرهابية"
    ],
    "answerIndex": 2
  },
  {
    "id": "regiments-prison-transfer-q21",
    "text": "ما الممنوع أثناء حمل المجرمين؟",
    "options": [
      "الوقوف",
      "تسجيل الوحدات",
      "إبلاغ العمليات"
    ],
    "answerIndex": 0
  },
  {
    "id": "regiments-prison-transfer-q22",
    "text": "إلى أين يوجه المقبوض عليهم جميعاً؟",
    "options": [
      "الكراج أو الميناء",
      "موجة التدريب أو العمليات",
      "السجن المركزي أو المركز الرئيسي"
    ],
    "answerIndex": 2
  },
  {
    "id": "regiments-prison-transfer-q23",
    "text": "وفق ماذا يُسجن المجرمون بعد القبض عليهم؟",
    "options": [
      "رغبة السائق",
      "الأنظمة والقوانين",
      "موجة القطاع"
    ],
    "answerIndex": 1
  },
  {
    "id": "regiments-prison-transfer-q24",
    "text": "كم سلاحاً يتم سحبه من المجرمين؟",
    "options": [
      "سلاح واحد فقط",
      "سلاحان",
      "جميع الأسلحة"
    ],
    "answerIndex": 0
  },
  {
    "id": "regiments-prison-transfer-q25",
    "text": "من يختار السلاح الذي يتم سحبه؟",
    "options": [
      "المجرم",
      "العسكري",
      "القيادة فقط"
    ],
    "answerIndex": 1
  },
  {
    "id": "regiments-prison-transfer-q26",
    "text": "أين يمنع إنزال المجرمين والتعامل معهم؟",
    "options": [
      "في السجن المركزي",
      "في المركز الرئيسي",
      "في منطقة غير آمنة"
    ],
    "answerIndex": 2
  },
  {
    "id": "regiments-prison-transfer-q27",
    "text": "من يتعامل مع المجرمين وفق التعليمات؟",
    "options": [
      "السائق ومرافقه فقط",
      "جميع الوحدات في الموقع",
      "أي فرد من القطاع"
    ],
    "answerIndex": 0
  },
  {
    "id": "regiments-prison-transfer-q28",
    "text": "ما العقوبة عند إثبات تهريب مجرم على الفرد؟",
    "options": [
      "إنزال تحذير فقط",
      "فصله من القطاع بشكل فوري",
      "نقله إلى موجة التدريب"
    ],
    "answerIndex": 1
  },
  {
    "id": "regiments-prison-transfer-q29",
    "text": "ما الإجراء بشأن السلاح الآخر بعد سحب سلاح واحد؟",
    "options": [
      "يُسحب بعد التحضير",
      "يُنقل إلى المرافق",
      "لا يتم سحب سلاح آخر"
    ],
    "answerIndex": 2
  },
  {
    "id": "regiments-prison-transfer-q30",
    "text": "ما الفعل الذي يؤدي إثباته إلى الفصل الفوري من القطاع؟",
    "options": [
      "تهريب مجرم",
      "التفاعل الأسبوعي",
      "توجيه المقبوض عليهم للسجن"
    ],
    "answerIndex": 0
  }
];
})();
