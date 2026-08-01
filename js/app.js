(function () {
  "use strict";

  const DEFAULT_CONFIG = {
    appName: "ط£ظƒط§ط¯ظٹظ…ظٹط© ط£ظ…ظ† ط§ظ„ظ…ظ†ط´ط¢طھ",
    version: "2.0.0",
    passingPercentage: 70,
    retakeHours: 24,
    questionsPerQuiz: 10,
    resultsEndpoint: "",
    submissionMode: "standard",
    allowDemoMode: false
  };

  const CONFIG = Object.freeze({ ...DEFAULT_CONFIG, ...(window.APP_CONFIG || {}) });
  const COURSE_LIST = Object.values(window.COURSES || {});
  const COURSE_MAP = new Map(COURSE_LIST.map((course) => [course.id, course]));
  const FACILITIES_SECURITY = "facilities_security";
  const SECURITY_REGIMENTS = "security_regiments";
  const PUBLIC_SECURITY = "public_security";
  const STORAGE = {
    session: "rp-academy-v2:active-session",
    lastResult: "rp-academy-v2:last-result",
    attempts: "rp-academy-v2:attempts",
    history: "rp-academy-v2:history",
    questionPools: "rp-academy-v2:question-pools",
    theme: "rp-academy-v2:theme",
    sector: "rp-academy-v2:selected-sector"
  };
  const STAGES = ["entry", "study", "quiz", "result"];
  const DEMO_MODE =
    CONFIG.allowDemoMode &&
    new URLSearchParams(window.location.search).get("demo") === "1";

  const elements = {};
  let state = createEmptyState();
  let selectedSector = "";
  let pendingSession = null;
  let studyTicker = null;
  let quizTicker = null;
  let toastTimer = null;
  let isSubmitting = false;
  let hasShownStorageWarning = false;

  function createEmptyState() {
    return {
      schemaVersion: 2,
      sessionId: "",
      stage: "entry",
      sector: "",
      trainee: null,
      courseId: "",
      questionIds: [],
      optionOrders: {},
      answers: {},
      studyStartedAt: 0,
      studyEndsAt: 0,
      quizStartedAt: 0,
      quizEndsAt: 0,
      visibilityCount: 0,
      timedOut: false,
      createdAt: 0,
      updatedAt: 0,
      result: null
    };
  }

  function cacheElements() {
    const ids = [
      "sector-view",
      "entry-view",
      "study-view",
      "quiz-view",
      "result-view",
      "global-status",
      "progress-steps",
      "sector-indicator",
      "selected-sector-label",
      "change-sector-button",
      "course-field",
      "entry-submit-button",
      "theme-button",
      "footer-version",
      "courses-count",
      "questions-count",
      "resume-banner",
      "resume-title",
      "resume-details",
      "resume-button",
      "discard-session-button",
      "trainee-form",
      "trainee-name",
      "trainee-discord",
      "rank-field",
      "trainee-rank",
      "course-select",
      "course-select-hint",
      "simulation-consent",
      "study-title",
      "study-description",
      "study-trainee-name",
      "study-trainee-meta",
      "study-timer-card",
      "study-time",
      "study-progress-bar",
      "document-title",
      "study-frame",
      "slides-link",
      "study-action-title",
      "study-action-note",
      "start-quiz-button",
      "leave-study-button",
      "quiz-title",
      "quiz-trainee-line",
      "quiz-time",
      "answered-count",
      "total-count",
      "quiz-progress-text",
      "quiz-progress-bar",
      "question-map",
      "visibility-count",
      "quiz-form",
      "quiz-submit-hint",
      "save-progress-button",
      "submit-quiz-button",
      "result-emblem",
      "result-emblem-path",
      "result-kicker",
      "result-title",
      "result-message",
      "score-ring",
      "result-percentage",
      "result-trainee",
      "result-course",
      "result-assigned-rank-row",
      "result-assigned-rank",
      "result-score",
      "result-receipt",
      "result-date",
      "result-notes",
      "submission-status",
      "submission-status-text",
      "copy-result-button",
      "print-result-button",
      "new-session-button",
      "confirm-dialog",
      "confirm-message"
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
    restoreTheme();
    migrateLegacySessions();
    selectedSector = getStoredSector();
    bindEvents();
    if (selectedSector) {
      applySectorSelection();
      checkForSavedSession();
      showView("entry");
    } else {
      showView("sector");
    }
    elements.footerVersion.textContent = DEMO_MODE
      ? "ط§ظ„ط¥طµط¯ط§ط± ط§ظ„ط«ط§ظ†ظٹ ظˆط¶ط¹ ط§ظ„ط¹ط±ط¶"
      : "ط§ظ„ط¥طµط¯ط§ط± ط§ظ„ط«ط§ظ†ظٹ";

    if (!COURSE_LIST.length) {
      showToast("طھط¹ط°ط± طھط­ظ…ظٹظ„ ط¨ظٹط§ظ†ط§طھ ط§ظ„ط¯ظˆط±ط§طھ طھط£ظƒط¯ ظ…ظ† ظˆط¬ظˆط¯ ظ…ظ„ظپ ط§ظ„ط¯ظˆط±ط§طھ", "error", 10000);
      elements.traineeForm.querySelector('button[type="submit"]').disabled = true;
    }
  }

  function bindEvents() {
    elements.themeButton.addEventListener("click", toggleTheme);
    document.querySelectorAll("[data-sector]").forEach((button) => {
      button.addEventListener("click", () => selectSector(button.dataset.sector));
    });
    elements.changeSectorButton.addEventListener("click", changeSector);
    elements.traineeForm.addEventListener("submit", handleEntrySubmit);
    elements.courseSelect.addEventListener("change", updateCourseHint);
    elements.resumeButton.addEventListener("click", resumeSavedSession);
    elements.discardSessionButton.addEventListener("click", discardSavedSession);
    elements.startQuizButton.addEventListener("click", handleStudyAction);
    elements.leaveStudyButton.addEventListener("click", leaveStudy);
    elements.saveProgressButton.addEventListener("click", () => {
      saveSession();
      showToast("طھظ… ط­ظپط¸ طھظ‚ط¯ظ…ظƒ ط¹ظ„ظ‰ ظ‡ط°ط§ ط§ظ„ط¬ظ‡ط§ط²", "success");
    });
    elements.submitQuizButton.addEventListener("click", requestQuizSubmission);
    elements.confirmDialog.addEventListener("close", () => {
      if (elements.confirmDialog.returnValue === "confirm") {
        finalizeQuiz({ timedOut: false });
      }
    });
    elements.copyResultButton.addEventListener("click", copyResultSummary);
    elements.printResultButton.addEventListener("click", () => window.print());
    elements.newSessionButton.addEventListener("click", startNewSession);

    elements.traineeForm.querySelectorAll("input, select").forEach((control) => {
      const eventName = control.tagName === "SELECT" || control.type === "checkbox" ? "change" : "input";
      control.addEventListener(eventName, () => clearFieldError(control));
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
  }

  function isKnownSector(value) {
    return (
      value === FACILITIES_SECURITY ||
      value === SECURITY_REGIMENTS ||
      value === PUBLIC_SECURITY
    );
  }

  function getSectorLabel(sector = selectedSector) {
    if (sector === SECURITY_REGIMENTS) {
      return "ط§ظ„ط£ظپظˆط§ط¬ ط§ظ„ط£ظ…ظ†ظٹط©";
    }
    if (sector === PUBLIC_SECURITY) {
      return "ط§ظ„ط£ظ…ظ† ط§ظ„ط¹ط§ظ…";
    }
    return "ط£ظ…ظ† ط§ظ„ظ…ظ†ط´ط¢طھ";
  }

  function getStoredSector() {
    try {
      const sector = window.sessionStorage.getItem(STORAGE.sector) || "";
      return isKnownSector(sector) ? sector : "";
    } catch {
      return "";
    }
  }

  function storeSector(sector) {
    try {
      window.sessionStorage.setItem(STORAGE.sector, sector);
    } catch {
      // ظٹط¨ظ‚ظ‰ ط§ظ„ظ‚ط·ط§ط¹ ظپظٹ ط­ط§ظ„ط© ط§ظ„طھط·ط¨ظٹظ‚ ط¹ظ†ط¯ طھط¹ط°ط± طھط®ط²ظٹظ† ط§ظ„ط¬ظ„ط³ط©.
    }
  }

  function clearStoredSector() {
    try {
      window.sessionStorage.removeItem(STORAGE.sector);
    } catch {
      // ط§ظ„طھط®ط²ظٹظ† ظ…ظٹط²ط© ظ…ط³ط§ط¹ط¯ط© ظˆظ„ط§ ظٹظ…ظ†ط¹ طھط¹ط°ط±ظ‡ط§ ط§ط®طھظٹط§ط± ط§ظ„ظ‚ط·ط§ط¹.
    }
  }

  function migrateLegacySessions() {
    ["session", "lastResult"].forEach((key) => {
      const saved = storageGet(STORAGE[key], null);
      if (saved && !isKnownSector(saved.sector)) {
        saved.sector = FACILITIES_SECURITY;
        storageSet(STORAGE[key], saved);
      }
    });
    const activeSession = storageGet(STORAGE.session, null);
    const lastResult = storageGet(STORAGE.lastResult, null);
    if (!getStoredSector() && (activeSession?.sector || lastResult?.sector)) {
      const legacySector = activeSession?.sector || lastResult?.sector;
      if (isKnownSector(legacySector)) {
        storeSector(legacySector);
      }
    }
  }

  function selectSector(sector) {
    if (!isKnownSector(sector)) {
      return;
    }
    selectedSector = sector;
    storeSector(sector);
    applySectorSelection();
    checkForSavedSession();
    if (selectedSector) {
      applySectorSelection();
      showView("entry");
    } else {
      showView("sector");
    }
  }

  function applySectorSelection() {
    elements.sectorIndicator.hidden = !selectedSector;
    elements.selectedSectorLabel.textContent = selectedSector
      ? `ط§ظ„ظ‚ط·ط§ط¹ ط§ظ„ظ…ط®طھط§ط±: ${getSectorLabel()}`
      : "";
    elements.courseField.hidden = false;
    elements.courseSelect.disabled = false;
    elements.entrySubmitButton.disabled = false;
    populateCourseSelect();
    updatePlatformStats();
    updateCourseHint();
  }

  function changeSector() {
    clearInterval(studyTicker);
    clearInterval(quizTicker);
    storageRemove(STORAGE.session);
    state = createEmptyState();
    state.sector = selectedSector;
    pendingSession = null;
    isSubmitting = false;
    elements.traineeForm.reset();
    clearAllErrors();
    selectedSector = "";
    clearStoredSector();
    elements.sectorIndicator.hidden = true;
    showView("sector");
  }

  function restoreTheme() {
    const saved = storageGet(STORAGE.theme, "");
    const preferred =
      saved ||
      (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark");
    document.documentElement.dataset.theme = preferred;
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    storageSet(STORAGE.theme, next);
    showToast(next === "light" ? "طھظ… طھظپط¹ظٹظ„ ط§ظ„ظ†ظ…ط· ط§ظ„ظپط§طھط­" : "طھظ… طھظپط¹ظٹظ„ ط§ظ„ظ†ظ…ط· ط§ظ„ط¯ط§ظƒظ†");
  }

  function getAvailableCourses() {
    return COURSE_LIST.filter((course) => course.sector === selectedSector);
  }

  function populateCourseSelect() {
    elements.courseSelect.querySelectorAll("optgroup").forEach((group) => group.remove());
    elements.courseSelect.value = "";

    const quizGroup = document.createElement("optgroup");
    quizGroup.label = "ط§ظ„ط¯ظˆط±ط§طھ ط§ظ„ظ…ظٹط¯ط§ظ†ظٹط©";
    const applicantGroup = document.createElement("optgroup");
    applicantGroup.label = "طھط£ظ‡ظٹظ„ ط§ظ„ظ…طھظ‚ط¯ظ…ظٹظ† ط§ظ„ط¬ط¯ط¯";
    const referenceGroup = document.createElement("optgroup");
    referenceGroup.label = "ط§ظ„ط£ط¯ظ„ط© ظˆط§ظ„ظ…ط±ط§ط¬ط¹";

    getAvailableCourses().forEach((course) => {
      const option = document.createElement("option");
      option.value = course.id;
      option.textContent = `${course.title} â€” ${course.requiredRank}`;
      const group = course.applicantCourse
        ? applicantGroup
        : course.hasQuiz
          ? quizGroup
          : referenceGroup;
      group.append(option);
    });

    if (applicantGroup.children.length) {
      elements.courseSelect.append(applicantGroup);
    }
    elements.courseSelect.append(quizGroup, referenceGroup);
  }

  function updatePlatformStats() {
    const availableCourses = getAvailableCourses();
    const quizCourses = availableCourses.filter((course) => course.hasQuiz);
    const questionCount = quizCourses.reduce((sum, course) => sum + course.questions.length, 0);
    elements.coursesCount.textContent = formatNumber(quizCourses.length);
    elements.questionsCount.textContent = formatNumber(questionCount);
  }

  function updateCourseHint() {
    const course = COURSE_MAP.get(elements.courseSelect.value);
    syncRankField(course);
    if (!course) {
      elements.courseSelectHint.textContent = "ط³طھط¸ظ‡ط± ظ…ط¯ط© ط§ظ„ط¯ط±ط§ط³ط© ظˆط§ظ„ط§ط®طھط¨ط§ط± ط¨ط¹ط¯ ط§ط®طھظٹط§ط± ط§ظ„ط¯ظˆط±ط©";
      return;
    }

    elements.courseSelectHint.textContent = course.applicantCourse
      ? `ظ…ط³ط§ط± ط§ظ„ظ…طھظ‚ط¯ظ…ظٹظ† ط§ظ„ط¬ط¯ط¯ â€” ط§ط·ظ„ط§ط¹ ${course.studyMinutes} ط¯ظ‚ط§ط¦ظ‚ â€” ط§ط®طھط¨ط§ط± ${course.questionsPerQuiz} ط³ط¤ط§ظ„ط§ظ‹ ط®ظ„ط§ظ„ ${course.quizMinutes} ط¯ظ‚ظٹظ‚ط© â€” ط§ظ„ظ†ط¬ط§ط­ ظٹط¨ط¯ط£ ظ…ظ† ${course.passingPercentage}ظھ`
      : course.hasQuiz
      ? `ط§ظ„ظپط¦ط© ${course.requiredRank} â€” ط§ط·ظ„ط§ط¹ ${course.studyMinutes} ط¯ظ‚ظٹظ‚ط© â€” ط§ط®طھط¨ط§ط± ${course.quizMinutes} ط¯ظ‚ط§ط¦ظ‚`
      : `${course.requiredRank} â€” ظ‚ط±ط§ط،ط© ظˆط§ط·ظ„ط§ط¹ ظ…ظ† ط¯ظˆظ† ط§ط®طھط¨ط§ط±`;
  }

  function syncRankField(course) {
    const requiresRank = course?.requiresRank !== false;
    elements.rankField.hidden = !requiresRank;
    elements.traineeRank.disabled = !requiresRank;
    elements.traineeRank.required = requiresRank;
    if (!requiresRank) {
      elements.traineeRank.value = "";
      clearFieldError(elements.traineeRank);
    }
  }

  function handleEntrySubmit(event) {
    event.preventDefault();
    if (!isKnownSector(selectedSector)) {
      showToast("ط§ط®طھط± ظ‚ط·ط§ط¹ظƒ ط§ظ„ط¹ط³ظƒط±ظٹ ظ‚ط¨ظ„ ط¨ط¯ط، ط§ظ„طھط¯ط±ظٹط¨", "error");
      return;
    }
    const formData = new FormData(elements.traineeForm);
    const courseId = String(formData.get("course") || "");
    const selectedCourse = COURSE_MAP.get(courseId);
    const trainee = {
      name: String(formData.get("name") || "").trim().replace(/\s+/g, " "),
      discord: normalizeDigits(String(formData.get("discord") || "").trim()),
      rank:
        selectedCourse?.requiresRank === false
          ? "ظ…طھظ‚ط¯ظ… ط¬ط¯ظٹط¯"
          : String(formData.get("rank") || "").trim()
    };

    if (!validateEntry(trainee, courseId)) {
      return;
    }

    const lock = getRetakeLock(trainee.discord, courseId);
    if (lock && !DEMO_MODE) {
      const remaining = Math.max(1, Math.ceil((lock.until - Date.now()) / 3600000));
      setFieldError(
        elements.courseSelect,
        `ظ„ط§ طھط²ط§ظ„ ظپطھط±ط© ط§ظ„ط§ظ†طھط¸ط§ط± ظپط¹ط§ظ„ط© ظˆظٹظ…ظƒظ†ظƒ ط¥ط¹ط§ط¯ط© ط§ظ„ظ…ط­ط§ظˆظ„ط© ط¨ط¹ط¯ ظ†ط­ظˆ ${formatNumber(remaining)} ط³ط§ط¹ط©`
      );
      showToast("طھط¹ط°ط± ط¨ط¯ط، ظ…ط­ط§ظˆظ„ط© ط¬ط¯ظٹط¯ط© ط®ظ„ط§ظ„ ظپطھط±ط© ط§ظ„ط§ظ†طھط¸ط§ط±", "error");
      return;
    }

    const course = COURSE_MAP.get(courseId);
    const now = Date.now();
    state = {
      ...createEmptyState(),
      sessionId: createId("SESSION"),
      stage: "study",
      sector: selectedSector,
      trainee,
      courseId,
      studyStartedAt: now,
      studyEndsAt: course.hasQuiz ? now + getStudyDuration(course) : now,
      createdAt: now,
      updatedAt: now
    };

    pendingSession = null;
    elements.resumeBanner.hidden = true;
    saveSession();
    renderStudy();
  }

  function validateEntry(trainee, courseId) {
    clearAllErrors();
    let valid = true;

    if (!isKnownSector(selectedSector)) {
      showToast("ط§ط®طھط± ظ‚ط·ط§ط¹ظƒ ط§ظ„ط¹ط³ظƒط±ظٹ ظ‚ط¨ظ„ ط¨ط¯ط، ط§ظ„طھط¯ط±ظٹط¨", "error");
      return false;
    }

    if (
      trainee.name.length < 3 ||
      trainee.name.length > 60 ||
      !/^[\p{L}\p{M}\s.'â€™-]+$/u.test(trainee.name)
    ) {
      setFieldError(elements.traineeName, "ط£ط¯ط®ظ„ ط§ط³ظ…ط§ظ‹ طµط­ظٹط­ط§ظ‹ ظ…ظ† 3 ط¥ظ„ظ‰ 60 ط­ط±ظپط§ظ‹");
      valid = false;
    }

    if (!/^\d{15,20}$/.test(trainee.discord)) {
      setFieldError(elements.traineeDiscord, "ط£ط¯ط®ظ„ ظ…ط¹ط±ظ‘ظپ Discord ط±ظ‚ظ…ظٹط§ظ‹ ظ…ظ† 15 ط¥ظ„ظ‰ 20 ط®ط§ظ†ط©");
      valid = false;
    }

    const selectedCourse = COURSE_MAP.get(courseId);
    if (selectedCourse?.requiresRank !== false && !trainee.rank) {
      setFieldError(elements.traineeRank, "ط§ط®طھط± ط§ظ„ط±طھط¨ط© ط§ظ„ط­ط§ظ„ظٹط©");
      valid = false;
    }

    if (!selectedCourse || selectedCourse.sector !== selectedSector) {
      setFieldError(elements.courseSelect, "ط§ط®طھط± ط¯ظˆط±ط© ط£ظˆ ظ…ط±ط¬ط¹ط§ظ‹ ظ…ظ† ط§ظ„ظ‚ط§ط¦ظ…ط©");
      valid = false;
    }

    if (!elements.simulationConsent.checked) {
      const error = document.getElementById("simulation-consent-error");
      error.textContent = "ظٹظ„ط²ظ… ط§ظ„ط¥ظ‚ط±ط§ط± ط¨ط£ظ† ط§ظ„ط¨ظٹط§ظ†ط§طھ طھط®طµ ط´ط®طµظٹط© ط§ظ„ظ…ط­ط§ظƒط§ط©";
      elements.simulationConsent.setAttribute("aria-invalid", "true");
      valid = false;
    }

    if (!valid) {
      const firstInvalid = elements.traineeForm.querySelector('[aria-invalid="true"]');
      firstInvalid?.focus();
      showToast("ط±ط§ط¬ط¹ ط§ظ„ط­ظ‚ظˆظ„ ط§ظ„ظ…ط­ط¯ط¯ط© ط«ظ… ط­ط§ظˆظ„ ظ…ط±ط© ط£ط®ط±ظ‰", "error");
    }

    return valid;
  }

  function setFieldError(control, message) {
    const field = control.closest(".field");
    const error = document.getElementById(`${control.id}-error`);
    field?.classList.add("is-invalid");
    control.setAttribute("aria-invalid", "true");
    if (error) {
      error.textContent = message;
      control.setAttribute("aria-describedby", error.id);
    }
  }

  function clearFieldError(control) {
    if (control.id === "simulation-consent") {
      document.getElementById("simulation-consent-error").textContent = "";
      control.removeAttribute("aria-invalid");
      return;
    }

    const field = control.closest(".field");
    const error = document.getElementById(`${control.id}-error`);
    field?.classList.remove("is-invalid");
    control.removeAttribute("aria-invalid");
    if (error) {
      error.textContent = "";
    }
  }

  function clearAllErrors() {
    elements.traineeForm.querySelectorAll("input, select").forEach(clearFieldError);
  }

  function getStudyDuration(course) {
    return DEMO_MODE ? 4000 : course.studyMinutes * 60 * 1000;
  }

  function getQuizDurat…6470 tokens truncated…"",
      answers: state.questionIds.map((questionId) => ({
        questionId,
        answerIndex: Object.prototype.hasOwnProperty.call(state.answers, questionId)
          ? Number(state.answers[questionId])
          : null
      })),
      score: result.score,
      total: result.total,
      percentage: result.percentage,
      passed: result.passed,
      timedOut: result.timedOut,
      visibilityCount: result.visibilityCount,
      completedAt: new Date(result.completedAt).toISOString(),
      simulation: true,
      demoMode: DEMO_MODE
    };
  }

  function setResultActionsDisabled(disabled) {
    elements.newSessionButton.disabled = disabled;
    elements.copyResultButton.disabled = disabled;
    elements.printResultButton.disabled = disabled;
  }

  function setSubmissionStatus(message, type) {
    elements.submissionStatus.classList.remove("is-success", "is-error");
    if (type) {
      elements.submissionStatus.classList.add(`is-${type}`);
    }
    elements.submissionStatusText.textContent = message;
  }

  async function copyResultSummary() {
    if (!state.result) {
      return;
    }

    const course = getCurrentCourse();
    const result = state.result;
    const sectorName =
      course.applicantCourse
        ? "طھط£ظ‡ظٹظ„ ط§ظ„ط£ظپط±ط§ط¯"
        : getSectorLabel(state.sector);
    const traineeLabel = course.applicantCourse ? "ط§ظ„ظ…طھظ‚ط¯ظ…" : "ط§ظ„ظ…طھط¯ط±ط¨";
    const lines = [
      `ظ†طھظٹط¬ط© ط§ظ„ط£ظƒط§ط¯ظٹظ…ظٹط© ط§ظ„طھط¯ط±ظٹط¨ظٹط© ط§ظ„ظ…ط´طھط±ظƒط© â€” ${sectorName}`,
      `${traineeLabel}: ${state.trainee.name}`,
      `Discord ID: ${state.trainee.discord}`,
      `ط§ظ„ط¯ظˆط±ط©: ${course.title}`,
      result.isReference
        ? "ط§ظ„ط­ط§ظ„ط©: طھظ… ط¥طھظ…ط§ظ… ط§ظ„ط§ط·ظ„ط§ط¹"
        : `ط§ظ„ظ†طھظٹط¬ط© ${result.score} ظ…ظ† ${result.total} ط¨ظ†ط³ط¨ط© ${result.percentage} ط¨ط§ظ„ظ…ط¦ط©`,
      result.isReference
        ? ""
        : `ط§ظ„ط­ط§ظ„ط©: ${result.passed ? "ط§ط¬طھظٹط§ط²" : "ظ„ظ… ظٹط¬طھط²"}${result.timedOut ? " â€” ط§ظ†طھظ‡ظ‰ ط§ظ„ظˆظ‚طھ" : ""}`,
      course.applicantCourse && result.passed
        ? `ط§ظ„ط±طھط¨ط© ط§ظ„ظ…ط¨ط¯ط¦ظٹط© ط§ظ„ظ…ظ‚طھط±ط­ط©: ${result.assignedRank}`
        : "",
      `ط±ظ‚ظ… ط§ظ„ظ…ط­ط§ظˆظ„ط©: ${result.receipt}`,
      `ظˆظ‚طھ ط§ظ„طھط³ظ„ظٹظ…: ${formatDate(result.completedAt)}`
    ].filter(Boolean);

    try {
      await copyText(lines.join("\n"));
      showToast("طھظ… ظ†ط³ط® ظ…ظ„ط®طµ ط§ظ„ظ†طھظٹط¬ط©", "success");
    } catch {
      showToast("طھط¹ط°ط± ط§ظ„ظ†ط³ط® ط§ظ„طھظ„ظ‚ط§ط¦ظٹ ط§ط³طھط®ط¯ظ… ط®ظٹط§ط± ط§ظ„ط·ط¨ط§ط¹ط©", "error");
    }
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const succeeded = document.execCommand("copy");
    textarea.remove();
    if (!succeeded) {
      throw new Error("copy failed");
    }
  }

  function handleVisibilityChange() {
    if (document.visibilityState !== "hidden" || state.stage !== "quiz") {
      return;
    }

    state.visibilityCount += 1;
    state.updatedAt = Date.now();
    elements.visibilityCount.textContent = formatNumber(state.visibilityCount);
    saveSession();
  }

  function handleBeforeUnload(event) {
    if (state.stage !== "quiz") {
      return;
    }
    saveSession();
    event.preventDefault();
    event.returnValue = "";
  }

  function leaveStudy() {
    const confirmed = window.confirm(
        "ط³ظٹطھظ… ط­ط°ظپ ط¬ظ„ط³ط© ط§ظ„ط§ط·ظ„ط§ط¹ ط§ظ„ط­ط§ظ„ظٹط© ظˆط§ظ„ط¹ظˆط¯ط© ط¥ظ„ظ‰ ط§ظ„ط¨ط¯ط§ظٹط© ظ‡ظ„ طھط±ظٹط¯ ط§ظ„ظ…طھط§ط¨ط¹ط©طں"
    );
    if (!confirmed) {
      return;
    }
    storageRemove(STORAGE.session);
    startNewSession();
  }

  function startNewSession() {
    clearInterval(studyTicker);
    clearInterval(quizTicker);
    state = createEmptyState();
    pendingSession = null;
    isSubmitting = false;
    storageRemove(STORAGE.lastResult);
    elements.traineeForm.reset();
    updateCourseHint();
    clearAllErrors();
    checkForSavedSession();
    showView("entry");
  }

  function checkForSavedSession() {
    const activeSession = storageGet(STORAGE.session, null);
    const lastResult = storageGet(STORAGE.lastResult, null);
    if (activeSession && !isValidSession(activeSession)) {
      storageRemove(STORAGE.session);
    }
    if (lastResult && !isValidSession(lastResult)) {
      storageRemove(STORAGE.lastResult);
    }
    const saved = isValidSession(activeSession)
      ? activeSession
      : isValidSession(lastResult)
        ? lastResult
        : null;
    if (!saved || !isValidSession(saved)) {
      elements.resumeBanner.hidden = true;
      pendingSession = null;
      return;
    }

    saved.sector = isKnownSector(saved.sector) ? saved.sector : FACILITIES_SECURITY;
    pendingSession = saved;
    const course = COURSE_MAP.get(saved.courseId);
    elements.resumeTitle.textContent = saved.stage === "result"
      ? "ظ„ط¯ظٹظƒ ظ†طھظٹط¬ط© ظ…ط­ظپظˆط¸ط©"
      : saved.stage === "quiz"
        ? "ظ„ط¯ظٹظƒ ط§ط®طھط¨ط§ط± ظ„ظ… ظٹظƒطھظ…ظ„"
        : "ظ„ط¯ظٹظƒ ظ…ط§ط¯ط© طھط¯ط±ظٹط¨ظٹط© ظ…ظپطھظˆط­ط©";
    elements.resumeDetails.textContent = course.applicantCourse
      ? `${course.title} â€” ظ…طھظ‚ط¯ظ… ط¬ط¯ظٹط¯ / ${saved.trainee.name}`
      : `${course.title} â€” ${saved.trainee.rank} / ${saved.trainee.name}`;
    elements.resumeButton.textContent = saved.stage === "result"
      ? "ط¹ط±ط¶ ط§ظ„ظ†طھظٹط¬ط©"
      : "ظ…طھط§ط¨ط¹ط© ط§ظ„ظ…ط­ط§ظˆظ„ط©";
    elements.resumeBanner.hidden = false;
  }

  function resumeSavedSession() {
    if (!pendingSession || !isValidSession(pendingSession)) {
      discardSavedSession();
      showToast("طھط¹ط°ط± ط§ط³طھط¹ط§ط¯ط© ط§ظ„ظ…ط­ط§ظˆظ„ط© ط§ظ„ظ…ط­ظپظˆط¸ط©", "error");
      return;
    }

    state = pendingSession;
    pendingSession = null;
    elements.resumeBanner.hidden = true;

    if (state.stage === "result") {
      renderResult();
      setSubmissionStatus("طھظ… ط§ط³طھط¹ط§ط¯ط© ط§ظ„ظ†طھظٹط¬ط© ط§ظ„ظ…ط­ظپظˆط¸ط© ط¹ظ„ظ‰ ظ‡ط°ط§ ط§ظ„ط¬ظ‡ط§ط²", "success");
    } else if (state.stage === "quiz") {
      if (Date.now() >= state.quizEndsAt) {
        state.stage = "quiz";
        finalizeQuiz({ timedOut: true });
      } else {
        renderQuiz();
      }
    } else {
      renderStudy();
    }
  }

  function discardSavedSession() {
    storageRemove(STORAGE.session);
    storageRemove(STORAGE.lastResult);
    pendingSession = null;
    elements.resumeBanner.hidden = true;
    showToast("طھظ… ط­ط°ظپ ط§ظ„ظ…ط­ط§ظˆظ„ط© ط§ظ„ظ…ط­ظپظˆط¸ط©");
  }

  function isValidSession(value) {
    if (
      !value ||
      value.schemaVersion !== 2 ||
      typeof value.sessionId !== "string" ||
      !value.sessionId ||
      typeof value.trainee?.name !== "string" ||
      typeof value.trainee?.discord !== "string" ||
      typeof value.trainee?.rank !== "string" ||
      !COURSE_MAP.has(value.courseId) ||
      (value.sector && !isKnownSector(value.sector)) ||
      (value.sector && COURSE_MAP.get(value.courseId).sector !== value.sector) ||
      !["study", "quiz", "result"].includes(value.stage)
    ) {
      return false;
    }

    const course = COURSE_MAP.get(value.courseId);
    if (value.stage === "study") {
      return (
        Number.isFinite(value.studyStartedAt) &&
        Number.isFinite(value.studyEndsAt) &&
        value.studyEndsAt >= value.studyStartedAt
      );
    }

    if (value.stage === "result") {
      return Boolean(
        value.result &&
          typeof value.result.receipt === "string" &&
          Number.isFinite(value.result.completedAt)
      );
    }

    if (
      !course.hasQuiz ||
      !Array.isArray(value.questionIds) ||
      !value.questionIds.length ||
      !value.optionOrders ||
      typeof value.optionOrders !== "object" ||
      !value.answers ||
      typeof value.answers !== "object" ||
      !Number.isFinite(value.quizStartedAt) ||
      !Number.isFinite(value.quizEndsAt) ||
      value.quizEndsAt < value.quizStartedAt
    ) {
      return false;
    }

    const questionMap = new Map(course.questions.map((question) => [question.id, question]));
    if (new Set(value.questionIds).size !== value.questionIds.length) {
      return false;
    }

    return value.questionIds.every((questionId) => {
      const question = questionMap.get(questionId);
      const order = value.optionOrders[questionId];
      if (
        !question ||
        !Array.isArray(order) ||
        order.length !== question.options.length ||
        new Set(order).size !== order.length ||
        order.some(
          (optionIndex) =>
            !Number.isInteger(optionIndex) ||
            optionIndex < 0 ||
            optionIndex >= question.options.length
        )
      ) {
        return false;
      }

      if (Object.prototype.hasOwnProperty.call(value.answers, questionId)) {
        const answer = Number(value.answers[questionId]);
        return Number.isInteger(answer) && answer >= 0 && answer < question.options.length;
      }
      return true;
    });
  }

  function saveSession() {
    if (!["study", "quiz"].includes(state.stage)) {
      return;
    }
    state.updatedAt = Date.now();
    if (!storageSet(STORAGE.session, state) && !hasShownStorageWarning) {
      hasShownStorageWarning = true;
      showToast(
        "طھط¹ط°ط± ط§ظ„ط­ظپط¸ ط§ظ„طھظ„ظ‚ط§ط¦ظٹ ظپظٹ ط§ظ„ظ…طھطµظپط­ ظ„ط§ طھط؛ظ„ظ‚ ط§ظ„طµظپط­ط© ط£ط«ظ†ط§ط، ط§ظ„ظ…ط­ط§ظˆظ„ط©",
        "error",
        7000
      );
    }
  }

  function saveAttemptLock() {
    if (DEMO_MODE || state.result?.isReference) {
      return true;
    }
    const attempts = storageGet(STORAGE.attempts, {});
    const key = `${state.trainee.discord}:${state.courseId}`;
    attempts[key] = {
      completedAt: state.result.completedAt,
      until: state.result.completedAt + CONFIG.retakeHours * 3600000,
      passed: state.result.passed,
      receipt: state.result.receipt
    };
    return storageSet(STORAGE.attempts, attempts);
  }

  function getRetakeLock(discord, courseId) {
    const attempts = storageGet(STORAGE.attempts, {});
    const record = attempts[`${discord}:${courseId}`];
    return record && record.until > Date.now() ? record : null;
  }

  function saveHistoryRecord() {
    const history = storageGet(STORAGE.history, []);
    history.unshift(buildResultPayload());
    return storageSet(STORAGE.history, history.slice(0, 100));
  }

  function persistLastResult() {
    state.result.localSaved = true;
    const saved = storageSet(STORAGE.lastResult, state);
    state.result.localSaved = saved;
    return saved;
  }

  function storageGet(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function storageRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ط§ظ„طھط®ط²ظٹظ† ط§ظ„ظ…ط­ظ„ظٹ ظ…ظٹط²ط© ظ…ط³ط§ط¹ط¯ط©طŒ ظˆطھط¹ط·ظ„ظ‡ ظ„ط§ ظٹظ…ظ†ط¹ طھط´ط؛ظٹظ„ ط§ظ„ظ…ظ†طµط©.
    }
  }

  function showView(stage) {
    if (stage !== "sector" && !STAGES.includes(stage)) {
      return;
    }

    const viewMap = {
      sector: elements.sectorView,
      entry: elements.entryView,
      study: elements.studyView,
      quiz: elements.quizView,
      result: elements.resultView
    };
    Object.entries(viewMap).forEach(([name, view]) => {
      view.hidden = name !== stage;
    });

    elements.progressSteps.hidden = stage === "sector";
    if (stage !== "sector") {
      state.stage = stage;
      const currentIndex = STAGES.indexOf(stage);
      document.querySelectorAll(".progress-step").forEach((step, index) => {
        step.classList.toggle("is-active", index === currentIndex);
        step.classList.toggle("is-complete", index < currentIndex);
        if (index === currentIndex) {
          step.setAttribute("aria-current", "step");
        } else {
          step.removeAttribute("aria-current");
        }
      });
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
    const heading = viewMap[stage].querySelector("h1");
    if (heading) {
      heading.tabIndex = -1;
      window.setTimeout(() => heading.focus({ preventScroll: true }), 50);
    }
  }

  function resetToEntry(message) {
    storageRemove(STORAGE.session);
    state = createEmptyState();
    showView("entry");
    showToast(message, "error", 7000);
  }

  function getCurrentCourse() {
    const course = COURSE_MAP.get(state.courseId);
    return course && course.sector === state.sector ? course : null;
  }

  function getPassingPercentage(course) {
    const coursePercentage = Number(course?.passingPercentage);
    return Number.isFinite(coursePercentage)
      ? coursePercentage
      : CONFIG.passingPercentage;
  }

  function getApplicantRank(percentage) {
    if (percentage >= 85) {
      return "ظˆظƒظٹظ„ ط±ظ‚ظٹط¨";
    }
    if (percentage >= 70) {
      return "ط¹ط±ظٹظپ";
    }
    if (percentage >= 60) {
      return "ط¬ظ†ط¯ظٹ ط£ظˆظ„";
    }
    return "ط¬ظ†ط¯ظٹ";
  }

  function getTraineeDisplay(course) {
    return course?.applicantCourse
      ? `ظ…طھظ‚ط¯ظ… ط¬ط¯ظٹط¯ / ${state.trainee.name}`
      : `${state.trainee.rank} / ${state.trainee.name}`;
  }

  function getSelectedQuestions() {
    const course = getCurrentCourse();
    if (!course) {
      return [];
    }
    const map = new Map(course.questions.map((question) => [question.id, question]));
    return state.questionIds.map((id) => map.get(id)).filter(Boolean);
  }

  function showToast(message, type = "", duration = 3200) {
    window.clearTimeout(toastTimer);
    elements.globalStatus.textContent = message;
    elements.globalStatus.classList.remove("is-success", "is-error");
    if (type) {
      elements.globalStatus.classList.add(`is-${type}`);
    }
    elements.globalStatus.hidden = false;
    toastTimer = window.setTimeout(() => {
      elements.globalStatus.hidden = true;
    }, duration);
  }

  function createId(prefix) {
    const random =
      window.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 10).toUpperCase() ||
      Math.random().toString(36).slice(2, 12).toUpperCase();
    return `${prefix}-${random}`;
  }

  function shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const randomIndex = secureRandomInt(index + 1);
      [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
    }
    return copy;
  }

  function selectQuestionsForAttempt(course, requestedCount) {
    const allIds = course.questions.map((question) => question.id);
    const validIds = new Set(allIds);
    const count = Math.min(requestedCount, allIds.length);
    const pools = storageGet(STORAGE.questionPools, {});
    const key = `${state.trainee.discord}:${course.id}`;
    const savedPool =
      pools[key] && typeof pools[key] === "object" ? pools[key] : {};
    const seenQueuedIds = new Set();
    let queue = Array.isArray(savedPool.queue)
      ? savedPool.queue.filter((id) => {
          if (!validIds.has(id) || seenQueuedIds.has(id)) {
            return false;
          }
          seenQueuedIds.add(id);
          return true;
        })
      : [];
    const selectedIds = [];

    while (selectedIds.length < count) {
      if (!queue.length) {
        queue = shuffle(allIds);
        const previousLastId = savedPool.lastSelectedId;
        if (
          !selectedIds.length &&
          previousLastId &&
          queue.length > 1 &&
          queue[0] === previousLastId
        ) {
          const replacementIndex = queue.findIndex((id) => id !== previousLastId);
          [queue[0], queue[replacementIndex]] = [
            queue[replacementIndex],
            queue[0]
          ];
        }
      }

      const nextIndex = queue.findIndex((id) => !selectedIds.includes(id));
      if (nextIndex === -1) {
        queue = [];
        continue;
      }
      selectedIds.push(queue.splice(nextIndex, 1)[0]);
    }

    pools[key] = {
      queue,
      lastSelectedId: selectedIds[selectedIds.length - 1] || "",
      updatedAt: Date.now()
    };
    storageSet(STORAGE.questionPools, pools);

    const questionMap = new Map(
      course.questions.map((question) => [question.id, question])
    );
    return selectedIds.map((id) => questionMap.get(id)).filter(Boolean);
  }

  function secureRandomInt(maxExclusive) {
    if (!window.crypto?.getRandomValues) {
      return Math.floor(Math.random() * maxExclusive);
    }
    const uintRange = 0x100000000;
    const limit = uintRange - (uintRange % maxExclusive);
    const values = new Uint32Array(1);
    do {
      window.crypto.getRandomValues(values);
    } while (values[0] >= limit);
    return values[0] % maxExclusive;
  }

  function normalizeDigits(value) {
    const arabic = "ظ ظ،ظ¢ظ£ظ¤ظ¥ظ¦ظ§ظ¨ظ©";
    const eastern = "غ°غ±غ²غ³غ´غµغ¶غ·غ¸غ¹";
    return value
      .replace(/[ظ -ظ©]/g, (digit) => String(arabic.indexOf(digit)))
      .replace(/[غ°-غ¹]/g, (digit) => String(eastern.indexOf(digit)));
  }

  function formatNumber(value) {
    return Number(value).toLocaleString("ar-SA", { useGrouping: false });
  }

  function formatDuration(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function formatDate(timestamp) {
    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(timestamp));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  document.addEventListener("DOMContentLoaded", boot, { once: true });
})();

