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

  const DIGIT_MAP = Object.freeze({
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9"
  });

  function useWesternDigits(value) {
    return String(value)
      .replace(/[٠-٩۰-۹]/g, (digit) => DIGIT_MAP[digit] || digit)
      .replace(/٪/g, "%");
  }

  function normalizeTextNode(node) {
    const normalized = useWesternDigits(node.nodeValue || "");
    if (normalized !== node.nodeValue) {
      node.nodeValue = normalized;
    }
  }

  function normalizeElement(root) {
    if (!root) {
      return;
    }

    if (root.nodeType === Node.TEXT_NODE) {
      normalizeTextNode(root);
      return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
      return;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      normalizeTextNode(node);
      node = walker.nextNode();
    }
  }

  function applyNumberDisplayPreferences() {
    const discordField = document.getElementById("trainee-discord");
    if (discordField) {
      discordField.placeholder = "829030001466671154";
    }

    normalizeElement(document.body);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "characterData") {
          normalizeTextNode(mutation.target);
          return;
        }
        mutation.addedNodes.forEach(normalizeElement);
      });
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.setTimeout(applyNumberDisplayPreferences, 0);
  }, { once: true });
})();