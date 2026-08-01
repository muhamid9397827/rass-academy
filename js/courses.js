(function () {
  "use strict";

  window.COURSES = {
    individualQualification: {
      sector: "facilities_security",
      id: "individual-qualification",
      title: "ط§ط®طھط¨ط§ط± طھط£ظ‡ظٹظ„ ط§ظ„ط£ظپط±ط§ط¯",
      requiredRank: "ط§ظ„ظ…طھظ‚ط¯ظ…ظˆظ† ط§ظ„ط¬ط¯ط¯",
      applicantCourse: true,
      requiresRank: false,
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 15,
      questionsPerQuiz: 20,
      passingPercentage: 50,
      slideUrl: "https://docs.google.com/presentation/d/1F570rL6gb4yFE8rTNraLOwByUlob1QMmyO4w7id5jNU/embed?rm=minimal",
      description: "ظ…ط³ط§ط± ظ…ط³طھظ‚ظ„ ظ„طھط£ظ‡ظٹظ„ ط§ظ„ظ…طھظ‚ط¯ظ…ظٹظ† ط§ظ„ط¬ط¯ط¯ ظˆطھط­ط¯ظٹط¯ ط§ظ„ط±طھط¨ط© ط§ظ„ظ…ط¨ط¯ط¦ظٹط© ط­ط³ط¨ ظ†طھظٹط¬ط© ط§ظ„ط§ط®طھط¨ط§ط±.",
      questions: []
    },

    operations: {
      sector: "facilities_security",
      id: "operations",
      title: "ط¯ظˆط±ط© ط§ظ„ط¹ظ…ظ„ظٹط§طھ",
      requiredRank: "ظ…ظ† ط¬ظ†ط¯ظٹ ط¥ظ„ظ‰ ط¬ظ†ط¯ظٹ ط£ظˆظ„",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/1sPZamlwqbxReuBo426kltMOt78wW6NWfHpv9C-HNwHA/embed?rm=minimal",
      questions: []
    },

    militaryCharacter: {
      sector: "facilities_security",
      id: "military-character",
      title: "ط¯ظˆط±ط© ط§ظ„ط´ط®طµظٹط© ط§ظ„ط¹ط³ظƒط±ظٹط©",
      requiredRank: "ظ…ظ† ط¬ظ†ط¯ظٹ ط£ظˆظ„ ط¥ظ„ظ‰ ط¹ط±ظٹظپ",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/1SVPPDv5hJvP9fU5c05Aq6isSgRkdwEvzJM6v9M4zSTI/embed?rm=minimal",
      questions: []
    },

    airWing: {
      sector: "facilities_security",
      id: "air-wing",
      title: "ط¯ظˆط±ط© ط§ظ„ط¬ظ†ط§ط­ ط§ظ„ط¬ظˆظٹ",
      requiredRank: "ظ…ظ† ط¹ط±ظٹظپ ط¥ظ„ظ‰ ظˆظƒظٹظ„ ط±ظ‚ظٹط¨",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/1CgwHOf4GyIbgogM9zRR0IA_kqMUr9ere2RCX7TyGrAg/embed?rm=minimal",
      questions: []
    },

    zoneOfficer: {
      sector: "facilities_security",
      id: "zone-officer",
      title: "ط¯ظˆط±ط© ط¶ط§ط¨ط· ظ…ظ†ط·ظ‚ط©",
      requiredRank: "ظ…ظ† ط±ظ‚ظٹط¨ ط£ظˆظ„ ط¥ظ„ظ‰ ط±ط¦ظٹط³ ط±ظ‚ط¨ط§ط،",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/1Q-ZlZLRo_vd2dcXinvt4eD_ZgZW4YZYwjWEwNuonf28/embed?rm=minimal",
      questions: []
    },

    swat: {
      sector: "facilities_security",
      id: "swat",
      title: "ط¯ظˆط±ط© ط§ظ„ط³ظˆط§طھ",
      requiredRank: "ط±ط¦ظٹط³ ط±ظ‚ط¨ط§ط،",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/1dW07y5vwfV6WAhohx48C8WXdfA6cihFSbte_NwnJw80/embed?rm=minimal",
      questions: []
    },

    promotionsGuide: {
      sector: "facilities_security",
      id: "promotions-guide",
      title: "ط¯ظ„ظٹظ„ ط§ظ„طھط±ظ‚ظٹط§طھ",
      requiredRank: "ط§ظ„ط£ظپط±ط§ط¯ ظˆط§ظ„ط¶ط¨ط§ط·",
      hasQuiz: false,
      studyMinutes: 0,
      quizMinutes: 0,
      slideUrl: "https://docs.google.com/presentation/d/1nKD9kZpstydj7yT_fz4nAmy7scMN2qMz4Ki56Ed-zqM/embed?rm=minimal",
      description: "ظ‡ط°ط§ ط§ظ„ط¯ظ„ظٹظ„ ظ…ط·ظ„ظˆط¨ ظ„ظ„طھط±ظ‚ظٹط© ظˆظ‡ظˆ ظ„ظ„ظ‚ط±ط§ط،ط© ظˆط§ظ„ط§ط·ظ„ط§ط¹ ظپظ‚ط· ظ…ظ† ط¯ظˆظ† ظˆظ‚طھ ظ…ط­ط¯ط¯ ط£ظˆ ط§ط®طھط¨ط§ط±",
      questions: []
    },

    approvedReference: {
      sector: "facilities_security",
      id: "approved-reference",
      title: "ط§ظ„ظ…ط±ط¬ط¹ ط§ظ„ظ…ط¹طھظ…ط¯",
      requiredRank: "ط¬ظ…ظٹط¹ ط§ظ„ط±طھط¨",
      hasQuiz: false,
      studyMinutes: 0,
      quizMinutes: 0,
      slideUrl: "https://docs.google.com/presentation/d/1oeBI5tahnGt1ICyqexje5ijxgCL0iF84HkoEz-s3TFA/embed?rm=minimal",
      description: "ظ‡ط°ط§ ط§ظ„ظ…ط±ط¬ط¹ ظ…ط·ظ„ظˆط¨ ظ„ظ„طھط±ظ‚ظٹط© ظˆظ‡ظˆ ظ„ظ„ظ‚ط±ط§ط،ط© ظˆط§ظ„ط§ط·ظ„ط§ط¹ ظپظ‚ط· ظ…ظ† ط¯ظˆظ† ظˆظ‚طھ ظ…ط­ط¯ط¯ ط£ظˆ ط§ط®طھط¨ط§ط±",
      questions: []
    },

    publicSecurityOperations: {
      sector: "public_security",
      id: "public-security-operations",
      title: "ط¯ظˆط±ط© ط§ظ„ط¹ظ…ظ„ظٹط§طھ â€” ط§ظ„ط£ظ…ظ† ط§ظ„ط¹ط§ظ…",
      requiredRank: "ط¬ظ†ط¯ظٹ",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/1IUFnKNFErKvl8TkKOcdZugjnHhBDG7hBfOTz5MxoCUc/embed?rm=minimal",
      description: "ظ…ط§ط¯ط© ط¯ظˆط±ط© ط§ظ„ط¹ظ…ظ„ظٹط§طھ ط§ظ„ظ…ط®طµطµط© ظ„ظ…ظ†ط³ظˆط¨ظٹ ط§ظ„ط£ظ…ظ† ط§ظ„ط¹ط§ظ….",
      questions: []
    },

    publicSecurityTrafficRoadSecurity: {
      sector: "public_security",
      id: "public-security-traffic-road-security",
      title: "ط¯ظˆط±ط© ط§ظ„ظ…ط±ظˆط± ظˆط£ظ…ظ† ط§ظ„ط·ط±ظ‚",
      requiredRank: "ط¬ظ†ط¯ظٹ ط£ظˆظ„",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/document/d/1PjxrlUcCmVHbhXn0mQPQaYhibg8m2qI_HZkxYgCl_UY/preview",
      description: "ظ…ط§ط¯ط© ط¯ظˆط±ط© ط§ظ„ظ…ط±ظˆط± ظˆط£ظ…ظ† ط§ظ„ط·ط±ظ‚ ط§ظ„ظ…ط®طµطµط© ظ„ظ…ظ†ط³ظˆط¨ظٹ ط§ظ„ط£ظ…ظ† ط§ظ„ط¹ط§ظ….",
      questions: []
    },

    publicSecurityAirSupport: {
      sector: "public_security",
      id: "public-security-air-support",
      title: "ط¯ظˆط±ط© ط§ظ„ط¯ط¹ظ… ط§ظ„ط¬ظˆظٹ",
      requiredRank: "ظˆظƒظٹظ„ ط±ظ‚ظٹط¨",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/document/d/18QPGbb_s8xXrhT0uBe4T1k9JJd507uzn4ximaJtU2kA/preview",
      description: "ظ…ط§ط¯ط© ط¯ظˆط±ط© ط§ظ„ط¯ط¹ظ… ط§ظ„ط¬ظˆظٹ ط§ظ„ظ…ط®طµطµط© ظ„ظ…ظ†ط³ظˆط¨ظٹ ط§ظ„ط£ظ…ظ† ط§ظ„ط¹ط§ظ….",
      questions: []
    },

    publicSecuritySpecialMissions: {
      sector: "public_security",
      id: "public-security-special-missions",
      title: "ط¯ظˆط±ط© ط§ظ„ظ…ظ‡ظ…ط§طھ ظˆط§ظ„ظˆط§ط¬ط¨ط§طھ ط§ظ„ط®ط§طµط©",
      requiredRank: "ط±ظ‚ظٹط¨",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/12q2FsxUv1OIqjCexIsICAEX_fNtrBb1ciRcgrHZb3Rw/embed?rm=minimal",
      description: "ظ…ط§ط¯ط© ط¯ظˆط±ط© ط§ظ„ظ…ظ‡ظ…ط§طھ ظˆط§ظ„ظˆط§ط¬ط¨ط§طھ ط§ظ„ط®ط§طµط© ط§ظ„ظ…ط®طµطµط© ظ„ظ…ظ†ط³ظˆط¨ظٹ ط§ظ„ط£ظ…ظ† ط§ظ„ط¹ط§ظ….",
      questions: []
    },

    publicSecurityNarcoticsControl: {
      sector: "public_security",
      id: "public-security-narcotics-control",
      title: "ط¯ظˆط±ط© ظ…ظƒط§ظپط­ط© ط§ظ„ظ…ط®ط¯ط±ط§طھ",
      requiredRank: "ط±ظ‚ظٹط¨ ط£ظˆظ„",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/document/d/1DNH0JFrqzgtociHiUWnau0C89srCSAba4jla1kGhKb8/preview",
      description: "ظ…ط§ط¯ط© ط¯ظˆط±ط© ظ…ظƒط§ظپط­ط© ط§ظ„ظ…ط®ط¯ط±ط§طھ ط§ظ„ظ…ط®طµطµط© ظ„ظ…ظ†ط³ظˆط¨ظٹ ط§ظ„ط£ظ…ظ† ط§ظ„ط¹ط§ظ….",
      questions: []
    },

    publicSecurityZoneSupervisor: {
      sector: "public_security",
      id: "public-security-zone-supervisor",
      title: "ط¯ظˆط±ط© ط¶ط§ط¨ط· ط¥ط´ط±ط§ظپ ط§ظ„ظ…ظ†ط·ظ‚ط©",
      requiredRank: "ط±ظ‚ظٹط¨ ط£ظˆظ„",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/1n4ax4fP0iAhk228UP7DSZBw-xuI51uQ_keRzamO9LNk/embed?rm=minimal",
      description: "ظ…ط§ط¯ط© ط¯ظˆط±ط© ط¶ط§ط¨ط· ط¥ط´ط±ط§ظپ ط§ظ„ظ…ظ†ط·ظ‚ط© ط§ظ„ظ…ط®طµطµط© ظ„ظ…ظ†ط³ظˆط¨ظٹ ط§ظ„ط£ظ…ظ† ط§ظ„ط¹ط§ظ….",
      questions: []
    },

    regimentsZoneOfficer: {
      id: "regiments-zone-officer",
      sector: "security_regiments",
      title: "ط¯ظˆط±ط© ط¶ط§ط¨ط· ظ…ظ†ط·ظ‚ط© â€” ط§ظ„ط£ظپظˆط§ط¬ ط§ظ„ط£ظ…ظ†ظٹط©",
      requiredRank: "ط¬ظ…ظٹط¹ ط§ظ„ط±طھط¨",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/1x4cL365QXt7Vfl1adJe7ToGel1IV9r7QHrfJoK55clo/embed?rm=minimal",
      description: "ظ…ط§ط¯ط© طھط¯ط±ظٹط¨ظٹط© ظˆط§ط®طھط¨ط§ط± ظ…ظٹط¯ط§ظ†ظٹ ط®ط§طµط§ظ† ط¨ظ‚ط·ط§ط¹ ط§ظ„ط£ظپظˆط§ط¬ ط§ظ„ط£ظ…ظ†ظٹط©.",
      questions: []
    },

    regimentsRecruitment: {
      id: "regiments-recruitment",
      sector: "security_regiments",
      title: "طھظˆط¸ظٹظپ ط§ظ„ط£ظپظˆط§ط¬ ط§ظ„ط£ظ…ظ†ظٹط©",
      requiredRank: "ط¬ظ…ظٹط¹ ط§ظ„ط±طھط¨",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/1cw7qCOUuLne3r2uzES4Pce17Usn00lyp9p6J1m7Aooo/embed?rm=minimal",
      description: "ظ…ط§ط¯ط© طھط¯ط±ظٹط¨ظٹط© ظˆط§ط®طھط¨ط§ط± ظ…ظٹط¯ط§ظ†ظٹ ط®ط§طµط§ظ† ط¨ظ‚ط·ط§ط¹ ط§ظ„ط£ظپظˆط§ط¬ ط§ظ„ط£ظ…ظ†ظٹط©.",
      questions: []
    },

    regimentsOperations: {
      id: "regiments-operations",
      sector: "security_regiments",
      title: "ط¯ظˆط±ط© ط§ظ„ط¹ظ…ظ„ظٹط§طھ â€” ط§ظ„ط£ظپظˆط§ط¬ ط§ظ„ط£ظ…ظ†ظٹط©",
      requiredRank: "ط¬ظ…ظٹط¹ ط§ظ„ط±طھط¨",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/179FJ4RIqfNtvJW_KCeLobJ0_fd3TDQcgdXPtXTXkSQU/embed?rm=minimal",
      description: "ظ…ط§ط¯ط© طھط¯ط±ظٹط¨ظٹط© ظˆط§ط®طھط¨ط§ط± ظ…ظٹط¯ط§ظ†ظٹ ط®ط§طµط§ظ† ط¨ظ‚ط·ط§ط¹ ط§ظ„ط£ظپظˆط§ط¬ ط§ظ„ط£ظ…ظ†ظٹط©.",
      questions: []
    },

    regimentsPrisonTransfer: {
      id: "regiments-prison-transfer",
      sector: "security_regiments",
      title: "ظ†ظ‚ظ„ ط§ظ„ط³ط¬ظˆظ† â€” ط§ظ„ط£ظپظˆط§ط¬ ط§ظ„ط£ظ…ظ†ظٹط©",
      requiredRank: "ط¬ظ…ظٹط¹ ط§ظ„ط±طھط¨",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/1HunXm8fWHJ935Y3pdBAcRJxQsE7UFgMIXfpRrPPjp7c/embed?rm=minimal",
      description: "ظ…ط§ط¯ط© طھط¯ط±ظٹط¨ظٹط© ظˆط§ط®طھط¨ط§ط± ظ…ظٹط¯ط§ظ†ظٹ ط®ط§طµط§ظ† ط¨ظ‚ط·ط§ط¹ ط§ظ„ط£ظپظˆط§ط¬ ط§ظ„ط£ظ…ظ†ظٹط©.",
      questions: []
    },

    regimentsAirSupport: {
      id: "regiments-air-support",
      sector: "security_regiments",
      title: "ط¯ظˆط±ط© ط§ظ„ط¯ط¹ظ… ط§ظ„ط¬ظˆظٹ â€” ط§ظ„ط£ظپظˆط§ط¬ ط§ظ„ط£ظ…ظ†ظٹط©",
      requiredRank: "ط¬ظ…ظٹط¹ ط§ظ„ط±طھط¨",
      hasQuiz: true,
      studyMinutes: 8,
      quizMinutes: 10,
      slideUrl: "https://docs.google.com/presentation/d/1G22IQ-3XJ5DGgEECDRjHcP69vZf_RoEzUj-8SVlHc6A/embed?rm=minimal",
      description: "ظ…ط§ط¯ط© طھط¯ط±ظٹط¨ظٹط© ظˆط§ط®طھط¨ط§ط± ظ…ظٹط¯ط§ظ†ظٹ ط®ط§طµط§ظ† ط¨ظ‚ط·ط§ط¹ ط§ظ„ط£ظپظˆط§ط¬ ط§ظ„ط£ظ…ظ†ظٹط©.",
      questions: []
    }
  };
})();

