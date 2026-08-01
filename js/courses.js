(function () {
  "use strict";

  window.COURSES = {
    individualQualification: {
      sector: "facilities_security",
      id: "individual-qualification",
      title: "اختبار تأهيل الأفراد",
      requiredRank: "المتقدمون الجدد",
      applicantCourse: true,
      requiresRank: false,
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 15,
      questionsPerQuiz: 20,
      passingPercentage: 50,
      slideUrl: "https://docs.google.com/presentation/d/1F570rL6gb4yFE8rTNraLOwByUlob1QMmyO4w7id5jNU/embed?rm=minimal",
      description: "مسار مستقل لتأهيل المتقدمين الجدد وتحديد الرتبة المبدئية حسب نتيجة الاختبار.",
      questions: []
    },

    operations: {
      sector: "facilities_security",
      id: "operations",
      title: "دورة العمليات",
      requiredRank: "من جندي إلى جندي أول",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/1sPZamlwqbxReuBo426kltMOt78wW6NWfHpv9C-HNwHA/embed?rm=minimal",
      questions: []
    },

    militaryCharacter: {
      sector: "facilities_security",
      id: "military-character",
      title: "دورة الشخصية العسكرية",
      requiredRank: "من جندي أول إلى عريف",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/1SVPPDv5hJvP9fU5c05Aq6isSgRkdwEvzJM6v9M4zSTI/embed?rm=minimal",
      questions: []
    },

    airWing: {
      sector: "facilities_security",
      id: "air-wing",
      title: "دورة الجناح الجوي",
      requiredRank: "من عريف إلى وكيل رقيب",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/1CgwHOf4GyIbgogM9zRR0IA_kqMUr9ere2RCX7TyGrAg/embed?rm=minimal",
      questions: []
    },

    zoneOfficer: {
      sector: "facilities_security",
      id: "zone-officer",
      title: "دورة ضابط منطقة",
      requiredRank: "من رقيب أول إلى رئيس رقباء",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/1Q-ZlZLRo_vd2dcXinvt4eD_ZgZW4YZYwjWEwNuonf28/embed?rm=minimal",
      questions: []
    },

    swat: {
      sector: "facilities_security",
      id: "swat",
      title: "دورة السوات",
      requiredRank: "رئيس رقباء",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/1dW07y5vwfV6WAhohx48C8WXdfA6cihFSbte_NwnJw80/embed?rm=minimal",
      questions: []
    },

    promotionsGuide: {
      sector: "facilities_security",
      id: "promotions-guide",
      title: "دليل الترقيات",
      requiredRank: "الأفراد والضباط",
      hasQuiz: false,
      studyMinutes: 0,
      quizMinutes: 0,
      slideUrl: "https://docs.google.com/presentation/d/1nKD9kZpstydj7yT_fz4nAmy7scMN2qMz4Ki56Ed-zqM/embed?rm=minimal",
      description: "هذا الدليل مطلوب للترقية وهو للقراءة والاطلاع فقط من دون وقت محدد أو اختبار",
      questions: []
    },

    approvedReference: {
      sector: "facilities_security",
      id: "approved-reference",
      title: "المرجع المعتمد",
      requiredRank: "جميع الرتب",
      hasQuiz: false,
      studyMinutes: 0,
      quizMinutes: 0,
      slideUrl: "https://docs.google.com/presentation/d/1oeBI5tahnGt1ICyqexje5ijxgCL0iF84HkoEz-s3TFA/embed?rm=minimal",
      description: "هذا المرجع مطلوب للترقية وهو للقراءة والاطلاع فقط من دون وقت محدد أو اختبار",
      questions: []
    },

    publicSecurityOperations: {
      sector: "public_security",
      id: "public-security-operations",
      title: "دورة العمليات — الأمن العام",
      requiredRank: "جندي",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/1IUFnKNFErKvl8TkKOcdZugjnHhBDG7hBfOTz5MxoCUc/embed?rm=minimal",
      description: "مادة دورة العمليات المخصصة لمنسوبي الأمن العام.",
      questions: []
    },

    publicSecurityTrafficRoadSecurity: {
      sector: "public_security",
      id: "public-security-traffic-road-security",
      title: "دورة المرور وأمن الطرق",
      requiredRank: "جندي أول",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/document/d/1PjxrlUcCmVHbhXn0mQPQaYhibg8m2qI_HZkxYgCl_UY/preview",
      description: "مادة دورة المرور وأمن الطرق المخصصة لمنسوبي الأمن العام.",
      questions: []
    },

    publicSecurityAirSupport: {
      sector: "public_security",
      id: "public-security-air-support",
      title: "دورة الدعم الجوي",
      requiredRank: "وكيل رقيب",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/document/d/18QPGbb_s8xXrhT0uBe4T1k9JJd507uzn4ximaJtU2kA/preview",
      description: "مادة دورة الدعم الجوي المخصصة لمنسوبي الأمن العام.",
      questions: []
    },

    publicSecuritySpecialMissions: {
      sector: "public_security",
      id: "public-security-special-missions",
      title: "دورة المهمات والواجبات الخاصة",
      requiredRank: "رقيب",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/12q2FsxUv1OIqjCexIsICAEX_fNtrBb1ciRcgrHZb3Rw/embed?rm=minimal",
      description: "مادة دورة المهمات والواجبات الخاصة المخصصة لمنسوبي الأمن العام.",
      questions: []
    },

    publicSecurityNarcoticsControl: {
      sector: "public_security",
      id: "public-security-narcotics-control",
      title: "دورة مكافحة المخدرات",
      requiredRank: "رقيب أول",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/document/d/1DNH0JFrqzgtociHiUWnau0C89srCSAba4jla1kGhKb8/preview",
      description: "مادة دورة مكافحة المخدرات المخصصة لمنسوبي الأمن العام.",
      questions: []
    },

    publicSecurityZoneSupervisor: {
      sector: "public_security",
      id: "public-security-zone-supervisor",
      title: "دورة ضابط إشراف المنطقة",
      requiredRank: "رقيب أول",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/1n4ax4fP0iAhk228UP7DSZBw-xuI51uQ_keRzamO9LNk/embed?rm=minimal",
      description: "مادة دورة ضابط إشراف المنطقة المخصصة لمنسوبي الأمن العام.",
      questions: []
    },

    regimentsZoneOfficer: {
      id: "regiments-zone-officer",
      sector: "security_regiments",
      title: "دورة ضابط منطقة — الأفواج الأمنية",
      requiredRank: "جميع الرتب",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/1x4cL365QXt7Vfl1adJe7ToGel1IV9r7QHrfJoK55clo/embed?rm=minimal",
      description: "مادة تدريبية واختبار ميداني خاصان بقطاع الأفواج الأمنية.",
      questions: []
    },

    regimentsRecruitment: {
      id: "regiments-recruitment",
      sector: "security_regiments",
      title: "توظيف الأفواج الأمنية",
      requiredRank: "جميع الرتب",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/1cw7qCOUuLne3r2uzES4Pce17Usn00lyp9p6J1m7Aooo/embed?rm=minimal",
      description: "مادة تدريبية واختبار ميداني خاصان بقطاع الأفواج الأمنية.",
      questions: []
    },

    regimentsOperations: {
      id: "regiments-operations",
      sector: "security_regiments",
      title: "دورة العمليات — الأفواج الأمنية",
      requiredRank: "جميع الرتب",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/179FJ4RIqfNtvJW_KCeLobJ0_fd3TDQcgdXPtXTXkSQU/embed?rm=minimal",
      description: "مادة تدريبية واختبار ميداني خاصان بقطاع الأفواج الأمنية.",
      questions: []
    },

    regimentsPrisonTransfer: {
      id: "regiments-prison-transfer",
      sector: "security_regiments",
      title: "نقل السجون — الأفواج الأمنية",
      requiredRank: "جميع الرتب",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/1HunXm8fWHJ935Y3pdBAcRJxQsE7UFgMIXfpRrPPjp7c/embed?rm=minimal",
      description: "مادة تدريبية واختبار ميداني خاصان بقطاع الأفواج الأمنية.",
      questions: []
    },

    regimentsAirSupport: {
      id: "regiments-air-support",
      sector: "security_regiments",
      title: "دورة الدعم الجوي — الأفواج الأمنية",
      requiredRank: "جميع الرتب",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/1G22IQ-3XJ5DGgEECDRjHcP69vZf_RoEzUj-8SVlHc6A/embed?rm=minimal",
      description: "مادة تدريبية واختبار ميداني خاصان بقطاع الأفواج الأمنية.",
      questions: []
    }
  };
})();

