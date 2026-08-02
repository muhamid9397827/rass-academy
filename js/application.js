(function () {
  "use strict";

  const DEFAULTS = Object.freeze({
    isOpen: false,
    managerName: "خيرو بن طيب",
    endpoint: "",
    statusEndpoint: "",
    closedMessage: "التقديم مغلق الآن. راجع إعلانات فتح التقديم عبر الديسكورد."
  });
  const config = Object.freeze({
    ...DEFAULTS,
    ...((window.APP_CONFIG && window.APP_CONFIG.administrationApplications) || {})
  });
  const RECEIPT_KEY = "rass-administration-application:receipt";
  const STATUS_REFRESH_INTERVAL_MS = 15000;
  const elements = {};
  let isSubmitting = false;
  let statusRequest = null;
  let applicationState = {
    isOpen: false,
    isVerified: false,
    status: "checking",
    managerName: config.managerName,
    closedMessage: config.closedMessage
  };

  function cacheElements() {
    const ids = [
      "application-card",
      "application-card-status",
      "application-card-note",
      "open-application-button",
      "application-view",
      "application-back-button",
      "application-manager-name",
      "application-closed-panel",
      "application-closed-title",
      "application-closed-message",
      "administration-application-form",
      "application-age",
      "application-discord-id",
      "application-form-status",
      "application-submit-button",
      "application-success-panel",
      "application-receipt",
      "application-success-back-button",
      "progress-steps",
      "sector-indicator",
      "sector-view"
    ];

    ids.forEach((id) => {
      elements[toCamelCase(id)] = document.getElementById(id);
    });
  }

  function toCamelCase(value) {
    return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  function boot() {
    cacheElements();
    if (!elements.applicationCard || !elements.applicationView) {
      return;
    }

    applyApplicationStatus();
    bindEvents();
    restoreSubmittedReceipt();
    refreshApplicationStatus();
    window.setInterval(refreshApplicationStatus, STATUS_REFRESH_INTERVAL_MS);
  }

  function bindEvents() {
    elements.openApplicationButton.addEventListener("click", showApplicationView);
    elements.applicationBackButton.addEventListener("click", returnToHome);
    elements.applicationSuccessBackButton.addEventListener("click", returnToHome);
    elements.administrationApplicationForm.addEventListener("submit", handleApplicationSubmit);
    elements.applicationAge.addEventListener("input", () => {
      elements.applicationAge.setCustomValidity("");
    });
    elements.applicationDiscordId.addEventListener("input", () => {
      elements.applicationDiscordId.setCustomValidity("");
    });
    window.addEventListener("focus", refreshApplicationStatus);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        refreshApplicationStatus();
      }
    });
  }

  function applyApplicationStatus() {
    const isVerifiedOpen = applicationState.isVerified && applicationState.isOpen;
    elements.applicationManagerName.textContent = applicationState.managerName;
    elements.applicationClosedMessage.textContent = applicationState.closedMessage;
    elements.applicationCard.classList.toggle("is-checking", !applicationState.isVerified);
    elements.applicationCard.classList.toggle("is-closed", applicationState.isVerified && !applicationState.isOpen);
    elements.applicationCard.setAttribute("aria-busy", String(!applicationState.isVerified));
    elements.openApplicationButton.disabled = !isVerifiedOpen;

    if (!applicationState.isVerified) {
      const failed = applicationState.status === "error";
      elements.applicationCardStatus.textContent = failed
        ? "تعذر التحقق من حالة التقديم"
        : "جاري التحقق من حالة التقديم";
      elements.applicationCardStatus.classList.remove("is-open");
      elements.applicationCardNote.textContent = failed
        ? "تعذر الاتصال بخدمة التقديم. أعد تحميل الصفحة بعد قليل."
        : "يرجى الانتظار حتى يتم التحقق من حالة التقديم.";
      elements.openApplicationButton.textContent = failed ? "التقديم غير متاح حاليًا" : "جاري التحقق...";
      syncApplicationView(false, failed ? "تعذر التحقق من حالة التقديم" : "جاري التحقق من حالة التقديم");
      return;
    }

    if (applicationState.isOpen) {
      elements.applicationCardStatus.textContent = "التقديم مفتوح الآن";
      elements.applicationCardStatus.classList.add("is-open");
      elements.applicationCardNote.textContent =
        "بوابة استقبال طلبات المتقدمين الجدد لفريق الدعم والمساعدة.";
      elements.openApplicationButton.textContent = "دخول بوابة التقديم";
    } else {
      elements.applicationCardStatus.textContent = "التقديم مغلق";
      elements.applicationCardStatus.classList.remove("is-open");
      elements.applicationCardNote.textContent = applicationState.closedMessage;
      elements.openApplicationButton.textContent = "التقديم مغلق حاليًا";
    }

    syncApplicationView(isVerifiedOpen, isVerifiedOpen ? "" : "التقديم مغلق حاليًا");
  }

  function syncApplicationView(canApply, closedTitle) {
    elements.applicationClosedTitle.textContent = closedTitle || "التقديم مغلق حاليًا";
    elements.applicationClosedPanel.hidden = canApply;
    if (!elements.applicationSuccessPanel.hidden) {
      return;
    }
    elements.administrationApplicationForm.hidden = !canApply;
    elements.applicationSubmitButton.disabled = !canApply || isSubmitting;
  }

  async function refreshApplicationStatus(options = {}) {
    const failClosedWhileChecking = options && options.failClosed === true;
    if (statusRequest) {
      if (failClosedWhileChecking) {
        applicationState = { ...applicationState, isOpen: false, isVerified: false, status: "checking" };
        applyApplicationStatus();
      }
      return statusRequest;
    }

    const statusEndpoint = config.statusEndpoint || config.endpoint;
    if (!statusEndpoint) {
      applicationState = { ...applicationState, isOpen: false, isVerified: false, status: "error" };
      applyApplicationStatus();
      return false;
    }

    if (failClosedWhileChecking || !applicationState.isVerified) {
      applicationState = { ...applicationState, isOpen: false, isVerified: false, status: "checking" };
      applyApplicationStatus();
    }

    statusRequest = (async () => {
      const separator = statusEndpoint.includes("?") ? "&" : "?";
      const response = await fetch(`${statusEndpoint}${separator}action=status&t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        redirect: "follow"
      });
      if (!response.ok) {
        throw new Error(`Status request failed with ${response.status}`);
      }

      const payload = await response.json();
      if (typeof payload.isOpen !== "boolean") {
        throw new Error("Invalid application status response");
      }

      applicationState = {
        isOpen: payload.isOpen,
        isVerified: true,
        status: payload.isOpen ? "open" : "closed",
        managerName: clean(payload.managerName) || config.managerName,
        closedMessage: clean(payload.closedMessage) || config.closedMessage
      };
      applyApplicationStatus();
      return true;
    })().catch((error) => {
      applicationState = { ...applicationState, isOpen: false, isVerified: false, status: "error" };
      applyApplicationStatus();
      console.warn("Application status check failed; access remains closed.", error);
      return false;
    }).finally(() => {
      statusRequest = null;
    });

    return statusRequest;
  }

  function showApplicationView() {
    if (!applicationState.isVerified || !applicationState.isOpen) {
      return;
    }

    document.querySelectorAll(".view").forEach((view) => {
      view.hidden = true;
    });
    elements.applicationView.hidden = false;
    elements.progressSteps.hidden = true;
    elements.sectorIndicator.hidden = true;
    syncApplicationView(true, "");
    window.scrollTo({ top: 0, behavior: "smooth" });
    const heading = elements.applicationView.querySelector("h1");
    heading.tabIndex = -1;
    window.setTimeout(() => heading.focus({ preventScroll: true }), 50);
  }

  function returnToHome() {
    elements.applicationView.hidden = true;
    elements.sectorView.hidden = false;
    elements.progressSteps.hidden = true;
    elements.sectorIndicator.hidden = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleApplicationSubmit(event) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const form = elements.administrationApplicationForm;
    clearFormStatus();
    const statusConfirmed = await refreshApplicationStatus({ failClosed: true });
    if (!statusConfirmed || !applicationState.isVerified || !applicationState.isOpen) {
      showFormStatus("التقديم مغلق أو تعذر التحقق من حالته. لم يتم إرسال الطلب.", true);
      return;
    }
    if (!validateApplication(form)) {
      return;
    }
    if (!config.endpoint) {
      showFormStatus("تعذر إرسال الطلب لأن رابط الاستقبال غير مهيأ.", true);
      return;
    }

    const requestId = createRequestId();
    const payload = buildPayload(form, requestId);
    isSubmitting = true;
    elements.applicationSubmitButton.disabled = true;
    elements.applicationSubmitButton.textContent = "جاري إرسال الطلب...";

    try {
      await fetch(config.endpoint, {
        method: "POST",
        mode: "no-cors",
        keepalive: true,
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
      });

      setSessionValue(RECEIPT_KEY, requestId);
      showApplicationSuccess(requestId);
    } catch (error) {
      console.error("Administration application submission failed:", error);
      showFormStatus("تعذر إرسال الطلب. تحقق من اتصالك ثم أعد المحاولة مرة واحدة.", true);
      elements.applicationSubmitButton.disabled = false;
      elements.applicationSubmitButton.textContent = "إرسال طلب التقديم";
    } finally {
      isSubmitting = false;
    }
  }

  function validateApplication(form) {
    if (!form.reportValidity()) {
      showFormStatus("أكمل جميع الحقول المطلوبة قبل الإرسال.", true);
      return false;
    }

    const age = Number(elements.applicationAge.value);
    if (!Number.isInteger(age) || age <= 20 || age > 100) {
      elements.applicationAge.setCustomValidity("يشترط أن يكون العمر أكثر من 20 عامًا.");
      elements.applicationAge.reportValidity();
      showFormStatus("لا يستوفي العمر شرط القبول الأساسي.", true);
      return false;
    }

    const discordId = useWesternDigits(elements.applicationDiscordId.value).trim();
    if (!/^\d{15,20}$/.test(discordId)) {
      elements.applicationDiscordId.setCustomValidity("أدخل معرف Discord الرقمي الصحيح.");
      elements.applicationDiscordId.reportValidity();
      showFormStatus("تحقق من معرف Discord.", true);
      return false;
    }
    elements.applicationDiscordId.value = discordId;

    const pledge = form.elements.confidentialityPledge.value;
    if (!pledge.startsWith("نعم")) {
      showFormStatus("لا يمكن إرسال الطلب دون التعهد بالمحافظة على سرية المعلومات.", true);
      form.elements.confidentialityPledge.focus();
      return false;
    }

    return true;
  }

  function buildPayload(form, requestId) {
    const data = new FormData(form);
    return {
      applicationType: "ras_administration",
      requestId,
      fullName: clean(data.get("fullName")),
      discordId: useWesternDigits(clean(data.get("discordId"))),
      serverName: clean(data.get("serverName")),
      age: Number(data.get("age")),
      confidentialityPledge: clean(data.get("confidentialityPledge")),
      experience: clean(data.get("experience")),
      dailyHours: clean(data.get("dailyHours")),
      joinReason: clean(data.get("joinReason")),
      angryPersonResponse: clean(data.get("angryPersonResponse")),
      secretInfoResponse: clean(data.get("secretInfoResponse")),
      unknownProblemResponse: clean(data.get("unknownProblemResponse")),
      previousPunishments: clean(data.get("previousPunishments")),
      teamworkCommitment: clean(data.get("teamworkCommitment")),
      pressureResponse: clean(data.get("pressureResponse")),
      rulesAgreement: clean(data.get("rulesAgreement")),
      noBansDeclaration: clean(data.get("noBansDeclaration"))
    };
  }

  function createRequestId() {
    const randomPart = window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
    return `RAS-${Date.now().toString(36).toUpperCase()}-${randomPart.toUpperCase()}`;
  }

  function showApplicationSuccess(requestId) {
    elements.applicationReceipt.textContent = requestId;
    elements.administrationApplicationForm.hidden = true;
    elements.applicationSuccessPanel.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function restoreSubmittedReceipt() {
    const receipt = getSessionValue(RECEIPT_KEY);
    if (receipt) {
      elements.applicationReceipt.textContent = receipt;
      elements.administrationApplicationForm.hidden = true;
      elements.applicationSuccessPanel.hidden = false;
    }
  }

  function showFormStatus(message, isError) {
    elements.applicationFormStatus.hidden = false;
    elements.applicationFormStatus.textContent = message;
    elements.applicationFormStatus.classList.toggle("is-error", Boolean(isError));
  }

  function clearFormStatus() {
    elements.applicationFormStatus.hidden = true;
    elements.applicationFormStatus.textContent = "";
    elements.applicationFormStatus.classList.remove("is-error");
  }

  function useWesternDigits(value) {
    const digits = {
      "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
      "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
      "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
      "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9"
    };
    return String(value).replace(/[٠-٩۰-۹]/g, (digit) => digits[digit] || digit);
  }

  function clean(value) {
    return value == null ? "" : String(value).trim();
  }

  function getSessionValue(key) {
    try {
      return window.sessionStorage.getItem(key) || "";
    } catch {
      return "";
    }
  }

  function setSessionValue(key, value) {
    try {
      window.sessionStorage.setItem(key, String(value));
    } catch {
      // تعطّل التخزين لا يمنع فتح النموذج أو إرساله.
    }
  }

  document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
