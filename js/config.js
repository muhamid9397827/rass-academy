(function () {
  "use strict";

  window.APP_CONFIG = Object.freeze({
    appName: "أكاديمية أمن المنشآت",
    version: "2.0.0",
    environment: "simulation",
    passingPercentage: 80,
    retakeHours: 24,
    questionsPerQuiz: 10,

    /*
     * رابط Google Apps Script المستخدم في النسخة السابقة
     * يحافظ هذا الوضع على أسماء الحقول الحالية في جدول النتائج
     */
    resultsEndpoint: "https://script.google.com/macros/s/AKfycbzyImNuPcy9wUTkx3XuKtw-jH4tjrokhIWcQD4aYqrXBSoRR-WIqgqtsyixmE03jFFktw/exec",
    submissionMode: "google-apps-script",

    /*
     * وضع العرض للاختبار المحلي:
     * أضف ?demo=1 إلى الرابط لتقليل المؤقتات إلى ثوانٍ معدودة.
     * لا يؤثر هذا على الرابط العادي المنشور للمتدربين.
     */
    allowDemoMode: false
  });
})();
