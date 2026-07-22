(function () {
  "use strict";

  if (!window.COURSES || !window.COURSES.regimentsRecruitment) {
    throw new Error("تعذر تحميل دورة توظيف الأفواج الأمنية");
  }

  window.COURSES.regimentsRecruitment.questions = [
  {
    "id": "regiments-recruitment-q01",
    "text": "ما المهمة الأساسية لقطاع الأفواج الأمنية؟",
    "options": [
      "تسجيل دخول الوحدات فقط",
      "الحفاظ على النظام والأمن في المجتمع",
      "إدارة كراج الميكانيكي"
    ],
    "answerIndex": 1
  },
  {
    "id": "regiments-recruitment-q02",
    "text": "من يتولى توجيه الوحدات وتنظيم الميدان عبر الراديو؟",
    "options": [
      "العمليات 2",
      "نائب العمليات",
      "شهاب"
    ],
    "answerIndex": 0
  },
  {
    "id": "regiments-recruitment-q03",
    "text": "بأي تطبيق يحدّث نائب العمليات التوزيعات؟",
    "options": [
      "الراديو",
      "كراج الميكانيكي",
      "تطبيق الدسكورد"
    ],
    "answerIndex": 2
  },
  {
    "id": "regiments-recruitment-q04",
    "text": "ما الذي يسجله نائب العمليات للوحدات؟",
    "options": [
      "الحضور فقط",
      "الدخول والخروج",
      "الخروج فقط"
    ],
    "answerIndex": 1
  },
  {
    "id": "regiments-recruitment-q05",
    "text": "ما الموجة رقم 20 وفق العرض؟",
    "options": [
      "الأفواج الأمنية التدريب",
      "الأفواج الأمنية مكافحة الإرهاب",
      "الأفواج الأمنية"
    ],
    "answerIndex": 2
  },
  {
    "id": "regiments-recruitment-q06",
    "text": "إلى ماذا تشير الموجة رقم 16؟",
    "options": [
      "الأفواج الأمنية مكافحة الإرهاب",
      "الأفواج الأمنية",
      "الأفواج الأمنية التدريب"
    ],
    "answerIndex": 0
  },
  {
    "id": "regiments-recruitment-q07",
    "text": "إلى ماذا تشير الموجة رقم 17؟",
    "options": [
      "الأفواج الأمنية مكافحة الإرهاب",
      "الأفواج الأمنية التدريب",
      "كراج الميكانيكي"
    ],
    "answerIndex": 1
  },
  {
    "id": "regiments-recruitment-q08",
    "text": "ما رتبة سيف المسؤول عن الميدان وجميع أفراد وقطاعات الأفواج؟",
    "options": [
      "نقيب",
      "رقيب",
      "مقدم"
    ],
    "answerIndex": 2
  },
  {
    "id": "regiments-recruitment-q09",
    "text": "من المسؤول الميداني عن ضباط الأفواج الأمنية؟",
    "options": [
      "سهم",
      "سيف",
      "شهاب"
    ],
    "answerIndex": 0
  },
  {
    "id": "regiments-recruitment-q10",
    "text": "ما رتبة المسؤول الميداني المسمى سهم؟",
    "options": [
      "رقيب",
      "نقيب",
      "مقدم"
    ],
    "answerIndex": 1
  },
  {
    "id": "regiments-recruitment-q11",
    "text": "ما الرتبة المحددة لضباط الأفواج تحت مسمى شهاب؟",
    "options": [
      "ملازم وأعلى",
      "رقيب إلى رئيس رقباء",
      "نقيب فقط"
    ],
    "answerIndex": 0
  },
  {
    "id": "regiments-recruitment-q12",
    "text": "من هم المسؤولون الميدانيون عن أفراد مدينة لوس سانتوس ضمن لام 10 إلى لام 50؟",
    "options": [
      "ملازم وأعلى",
      "نقيب فقط",
      "رقيب إلى رئيس رقباء"
    ],
    "answerIndex": 2
  },
  {
    "id": "regiments-recruitment-q13",
    "text": "إلى أي دورية تشير لام 19 إلى لام 11؟",
    "options": [
      "دورية لام 2",
      "دورية لام 1",
      "دورية لام 5"
    ],
    "answerIndex": 1
  },
  {
    "id": "regiments-recruitment-q14",
    "text": "إلى أي دورية تشير لام 29 إلى لام 21؟",
    "options": [
      "دورية لام 1",
      "دورية لام 4",
      "دورية لام 2"
    ],
    "answerIndex": 2
  },
  {
    "id": "regiments-recruitment-q15",
    "text": "إلى أي دورية تشير لام 39 إلى لام 31؟",
    "options": [
      "دورية لام 3",
      "دورية لام 5",
      "دورية لام 1"
    ],
    "answerIndex": 0
  },
  {
    "id": "regiments-recruitment-q16",
    "text": "إلى أي دورية تشير لام 49 إلى لام 41؟",
    "options": [
      "دورية لام 3",
      "دورية لام 4",
      "دورية لام 2"
    ],
    "answerIndex": 1
  },
  {
    "id": "regiments-recruitment-q17",
    "text": "إلى أي دورية تشير لام 59 إلى لام 51؟",
    "options": [
      "دورية لام 3",
      "دورية لام 4",
      "دورية لام 5"
    ],
    "answerIndex": 2
  },
  {
    "id": "regiments-recruitment-q18",
    "text": "إلى أي دورية تشير سين 19 إلى سين 11؟",
    "options": [
      "دورية سين 1",
      "دورية سين 2",
      "دورية باء 1"
    ],
    "answerIndex": 0
  },
  {
    "id": "regiments-recruitment-q19",
    "text": "إلى أي دورية تشير سين 29 إلى سين 21؟",
    "options": [
      "دورية باء 1",
      "دورية سين 2",
      "دورية سين 1"
    ],
    "answerIndex": 1
  },
  {
    "id": "regiments-recruitment-q20",
    "text": "إلى أي دورية تشير باء 19 إلى باء 11؟",
    "options": [
      "دورية سين 2",
      "دورية لام 1",
      "دورية باء 1"
    ],
    "answerIndex": 2
  },
  {
    "id": "regiments-recruitment-q21",
    "text": "من المسؤول الميداني عن أفراد مدينة ساندي شور؟",
    "options": [
      "رقيب إلى رئيس رقباء ضمن سين 10 إلى 20",
      "ملازم وأعلى ضمن شهاب",
      "نقيب ضمن سهم"
    ],
    "answerIndex": 0
  },
  {
    "id": "regiments-recruitment-q22",
    "text": "من المسؤول الميداني عن أفراد مدينة بليتو؟",
    "options": [
      "سين 10 إلى 20",
      "لام 10 إلى 50",
      "باء 10"
    ],
    "answerIndex": 2
  },
  {
    "id": "regiments-recruitment-q23",
    "text": "كيف يجب أن تكون البلاغات عبر الراديو؟",
    "options": [
      "طويلة ومفصلة دائماً",
      "مختصرة واحترافية ومنظمة",
      "بكود العسكري فقط"
    ],
    "answerIndex": 1
  },
  {
    "id": "regiments-recruitment-q24",
    "text": "ما الذي يحق للعمليات فعله مع البلاغ الطويل جداً؟",
    "options": [
      "مقاطعة البلاغ",
      "تكراره عبر الراديو",
      "تأجيله إلى نهاية المناوبة"
    ],
    "answerIndex": 0
  },
  {
    "id": "regiments-recruitment-q25",
    "text": "ما الحد الأدنى بين البلاغ والبلاغ التالي؟",
    "options": [
      "10 ثوانٍ",
      "3 ثوانٍ",
      "دقيقة واحدة"
    ],
    "answerIndex": 1
  },
  {
    "id": "regiments-recruitment-q26",
    "text": "ما الصيغة الواردة للخروج من الموجة للتعامل مع مواطن أو للراحة؟",
    "options": [
      "من سيف للعمليات خروج دون سبب",
      "من شهاب للعمليات إجازة",
      "من لام 10 للعمليات راحة مع ذكر السبب"
    ],
    "answerIndex": 2
  },
  {
    "id": "regiments-recruitment-q27",
    "text": "بأي مسمى تكون البلاغات في الميدان؟",
    "options": [
      "بالمسمى الميداني",
      "بكود العسكري",
      "باسم المدينة فقط"
    ],
    "answerIndex": 0
  },
  {
    "id": "regiments-recruitment-q28",
    "text": "ما أحد الحالات التي يسمح فيها بمقاطعة البلاغات؟",
    "options": [
      "تغيير موقع التوزيع",
      "تهديد مباشر على حياة الأفراد",
      "طلب إجازة"
    ],
    "answerIndex": 1
  },
  {
    "id": "regiments-recruitment-q29",
    "text": "متى يسمح بمغادرة موقع التوزيع؟",
    "options": [
      "عند الرغبة في تبديل الدورية",
      "بعد مرور ثلاث ثوانٍ",
      "عند حدوث سرقة أو إطلاق نار وبعد توجيه العمليات"
    ],
    "answerIndex": 2
  },
  {
    "id": "regiments-recruitment-q30",
    "text": "متى تتم مباشرة السرقات والبلاغات الجنائية؟",
    "options": [
      "بعد أخذ إذن من العمليات",
      "بعد انتهاء المناوبة",
      "دون الرجوع إلى العمليات"
    ],
    "answerIndex": 0
  }
];
})();
