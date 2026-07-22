(function () {
  "use strict";

  const DEFAULT_CONFIG = {
    appName: "أكاديمية أمن المنشآت",
    version: "2.0.0",
    passingPercentage: 80,
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
      ? "الإصدار الثاني وضع العرض"
      : "الإصدار الثاني";

    if (!COURSE_LIST.length) {
      showToast("تعذر تحميل بيانات الدورات تأكد من وجود ملف الدورات", "error", 10000);
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
      showToast("تم حفظ تقدمك على هذا الجهاز", "success");
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
    return value === FACILITIES_SECURITY || value === SECURITY_REGIMENTS;
  }

  function getSectorLabel(sector = selectedSector) {
    return sector === SECURITY_REGIMENTS ? "الأفواج الأمنية" : "أمن المنشآت";
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
      // يبقى القطاع في حالة التطبيق عند تعذر تخزين الجلسة.
    }
  }

  function clearStoredSector() {
    try {
      window.sessionStorage.removeItem(STORAGE.sector);
    } catch {
      // التخزين ميزة مساعدة ولا يمنع تعذرها اختيار القطاع.
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
      ? `القطاع المختار: ${getSectorLabel()}`
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
    showToast(next === "light" ? "تم تفعيل النمط الفاتح" : "تم تفعيل النمط الداكن");
  }

  function getAvailableCourses() {
    return COURSE_LIST.filter((course) => course.sector === selectedSector);
  }

  function populateCourseSelect() {
    elements.courseSelect.querySelectorAll("optgroup").forEach((group) => group.remove());
    elements.courseSelect.value = "";

    const quizGroup = document.createElement("optgroup");
    quizGroup.label = "الدورات الميدانية";
    const referenceGroup = document.createElement("optgroup");
    referenceGroup.label = "الأدلة والمراجع";

    getAvailableCourses().forEach((course) => {
      const option = document.createElement("option");
      option.value = course.id;
      option.textContent = `${course.title} — ${course.requiredRank}`;
      (course.hasQuiz ? quizGroup : referenceGroup).append(option);
    });

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
    if (!course) {
      elements.courseSelectHint.textContent = "ستظهر مدة الدراسة والاختبار بعد اختيار الدورة";
      return;
    }

    elements.courseSelectHint.textContent = course.hasQuiz
      ? `الفئة ${course.requiredRank} — اطلاع ${course.studyMinutes} دقيقة — اختبار ${course.quizMinutes} دقائق`
      : `${course.requiredRank} — قراءة واطلاع من دون اختبار`;
  }

  function handleEntrySubmit(event) {
    event.preventDefault();
    if (!isKnownSector(selectedSector)) {
      showToast("اختر قطاعك العسكري قبل بدء التدريب", "error");
      return;
    }
    const formData = new FormData(elements.traineeForm);
    const trainee = {
      name: String(formData.get("name") || "").trim().replace(/\s+/g, " "),
      discord: normalizeDigits(String(formData.get("discord") || "").trim()),
      rank: String(formData.get("rank") || "").trim()
    };
    const courseId = String(formData.get("course") || "");

    if (!validateEntry(trainee, courseId)) {
      return;
    }

    const lock = getRetakeLock(trainee.discord, courseId);
    if (lock && !DEMO_MODE) {
      const remaining = Math.max(1, Math.ceil((lock.until - Date.now()) / 3600000));
      setFieldError(
        elements.courseSelect,
        `لا تزال فترة الانتظار فعالة ويمكنك إعادة المحاولة بعد نحو ${formatNumber(remaining)} ساعة`
      );
      showToast("تعذر بدء محاولة جديدة خلال فترة الانتظار", "error");
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
      showToast("اختر قطاعك العسكري قبل بدء التدريب", "error");
      return false;
    }

    if (
      trainee.name.length < 3 ||
      trainee.name.length > 60 ||
      !/^[\p{L}\p{M}\s.'’-]+$/u.test(trainee.name)
    ) {
      setFieldError(elements.traineeName, "أدخل اسماً صحيحاً من 3 إلى 60 حرفاً");
      valid = false;
    }

    if (!/^\d{15,20}$/.test(trainee.discord)) {
      setFieldError(elements.traineeDiscord, "أدخل معرّف Discord رقمياً من 15 إلى 20 خانة");
      valid = false;
    }

    if (!trainee.rank) {
      setFieldError(elements.traineeRank, "اختر الرتبة الحالية");
      valid = false;
    }

    const selectedCourse = COURSE_MAP.get(courseId);
    if (!selectedCourse || selectedCourse.sector !== selectedSector) {
      setFieldError(elements.courseSelect, "اختر دورة أو مرجعاً من القائمة");
      valid = false;
    }

    if (!elements.simulationConsent.checked) {
      const error = document.getElementById("simulation-consent-error");
      error.textContent = "يلزم الإقرار بأن البيانات تخص شخصية المحاكاة";
      elements.simulationConsent.setAttribute("aria-invalid", "true");
      valid = false;
    }

    if (!valid) {
      const firstInvalid = elements.traineeForm.querySelector('[aria-invalid="true"]');
      firstInvalid?.focus();
      showToast("راجع الحقول المحددة ثم حاول مرة أخرى", "error");
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

  function getQuizDuration(course) {
    return DEMO_MODE ? 90000 : course.quizMinutes * 60 * 1000;
  }

  function renderStudy() {
    const course = getCurrentCourse();
    if (!course || !state.trainee) {
      resetToEntry("تعذر استعادة بيانات الدورة");
      return;
    }

    showView("study");
    elements.studyTitle.textContent = course.title;
    elements.studyDescription.textContent =
      course.description || `الفئة المستهدفة ${course.requiredRank}`;
    elements.studyTraineeName.textContent = state.trainee.name;
    elements.studyTraineeMeta.textContent = `${state.trainee.rank} • ${state.trainee.discord}`;
    elements.documentTitle.textContent = course.title;
    elements.studyFrame.title = `العرض التدريبي: ${course.title}`;
    elements.studyFrame.src = course.slideUrl;
    elements.slidesLink.href = course.slideUrl;

    clearInterval(studyTicker);

    if (!course.hasQuiz) {
      elements.studyTimerCard.hidden = true;
      elements.studyActionTitle.textContent = "المادة جاهزة للاطلاع";
      elements.studyActionNote.textContent = "بعد إنهاء القراءة اضغط لإتمام الاطلاع";
      elements.startQuizButton.disabled = false;
      elements.startQuizButton.firstChild.textContent = "إتمام الاطلاع ";
      return;
    }

    elements.studyTimerCard.hidden = false;
    elements.startQuizButton.firstChild.textContent = "بدء الاختبار ";
    updateStudyTimer();
    studyTicker = window.setInterval(updateStudyTimer, 500);
  }

  function updateStudyTimer() {
    const course = getCurrentCourse();
    if (!course || !course.hasQuiz || state.stage !== "study") {
      clearInterval(studyTicker);
      return;
    }

    const remaining = Math.max(0, state.studyEndsAt - Date.now());
    const total = Math.max(1, state.studyEndsAt - state.studyStartedAt);
    const elapsedPercent = clamp(((total - remaining) / total) * 100, 0, 100);

    elements.studyTime.textContent = formatDuration(remaining);
    elements.studyProgressBar.style.width = `${elapsedPercent}%`;

    if (remaining <= 0) {
      clearInterval(studyTicker);
      elements.studyTime.textContent = "00:00";
      elements.startQuizButton.disabled = false;
      elements.studyActionTitle.textContent = "أصبحت جاهزاً للاختبار";
      elements.studyActionNote.textContent = "تأكد من فهم المادة ثم ابدأ عندما تكون مستعداً";
    } else {
      elements.startQuizButton.disabled = true;
      elements.studyActionTitle.textContent = "أكمل مدة الاطلاع أولاً";
      elements.studyActionNote.textContent = `يتبقى ${formatDuration(remaining)} قبل تفعيل زر الاختبار`;
    }
  }

  function handleStudyAction() {
    const course = getCurrentCourse();
    if (!course) {
      return;
    }

    if (!course.hasQuiz) {
      completeReference();
      return;
    }

    if (Date.now() < state.studyEndsAt && !DEMO_MODE) {
      showToast("لم تنتهِ مدة الاطلاع بعد", "error");
      return;
    }

    startQuiz();
  }

  function startQuiz() {
    const course = getCurrentCourse();
    if (!course?.hasQuiz) {
      return;
    }

    const now = Date.now();
    if (!state.questionIds.length) {
      const questionCount = Math.min(CONFIG.questionsPerQuiz, course.questions.length);
      const selected = selectQuestionsForAttempt(course, questionCount);
      state.questionIds = selected.map((question) => question.id);
      state.optionOrders = {};
      selected.forEach((question) => {
        state.optionOrders[question.id] = shuffle(
          question.options.map((_, originalIndex) => originalIndex)
        );
      });
    }

    state.stage = "quiz";
    state.quizStartedAt ||= now;
    state.quizEndsAt ||= now + getQuizDuration(course);
    state.updatedAt = now;
    saveSession();
    renderQuiz();
  }

  function renderQuiz() {
    const course = getCurrentCourse();
    const questions = getSelectedQuestions();
    if (!course || !questions.length) {
      resetToEntry("تعذر استعادة أسئلة المحاولة");
      return;
    }

    showView("quiz");
    elements.quizTitle.textContent = `اختبار ${course.title}`;
    elements.quizTraineeLine.textContent = `${state.trainee.rank} / ${state.trainee.name}`;
    elements.totalCount.textContent = formatNumber(questions.length);
    elements.visibilityCount.textContent = formatNumber(state.visibilityCount);
    elements.quizForm.replaceChildren();
    elements.questionMap.replaceChildren();

    questions.forEach((question, index) => {
      elements.quizForm.append(createQuestionCard(question, index));
      elements.questionMap.append(createQuestionMapButton(question, index));
    });

    updateQuizProgress();
    clearInterval(quizTicker);
    updateQuizTimer();
    quizTicker = window.setInterval(updateQuizTimer, 500);
  }

  function createQuestionCard(question, index) {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "question-card";
    fieldset.id = `question-${question.id}`;

    const legend = document.createElement("legend");
    const number = document.createElement("span");
    number.className = "question-number";
    number.textContent = formatNumber(index + 1);
    const text = document.createElement("span");
    text.textContent = question.text;
    legend.append(number, text);

    const optionsList = document.createElement("div");
    optionsList.className = "options-list";

    const optionOrder =
      state.optionOrders[question.id] ||
      question.options.map((_, originalIndex) => originalIndex);

    optionOrder.forEach((originalIndex) => {
      const label = document.createElement("label");
      label.className = "option-control";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = `answer-${question.id}`;
      input.value = String(originalIndex);
      input.checked = Number(state.answers[question.id]) === originalIndex;
      input.addEventListener("change", () => {
        state.answers[question.id] = originalIndex;
        state.updatedAt = Date.now();
        fieldset.classList.remove("is-missing");
        saveSession();
        updateQuizProgress();
      });

      const radio = document.createElement("span");
      radio.className = "option-control__radio";
      radio.setAttribute("aria-hidden", "true");

      const optionText = document.createElement("span");
      optionText.textContent = question.options[originalIndex];
      label.append(input, radio, optionText);
      optionsList.append(label);
    });

    fieldset.append(legend, optionsList);
    return fieldset;
  }

  function createQuestionMapButton(question, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "question-map__button";
    button.dataset.questionId = question.id;
    button.textContent = formatNumber(index + 1);
    button.setAttribute("aria-label", `الانتقال إلى السؤال ${index + 1}`);
    if (Object.prototype.hasOwnProperty.call(state.answers, question.id)) {
      button.classList.add("is-answered");
    }
    button.addEventListener("click", () => {
      document.getElementById(`question-${question.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
    return button;
  }

  function updateQuizProgress() {
    const questions = getSelectedQuestions();
    const answered = questions.filter((question) =>
      Object.prototype.hasOwnProperty.call(state.answers, question.id)
    ).length;
    const percent = questions.length ? Math.round((answered / questions.length) * 100) : 0;

    elements.answeredCount.textContent = formatNumber(answered);
    elements.quizProgressText.textContent = `${formatNumber(percent)}٪`;
    elements.quizProgressBar.style.width = `${percent}%`;
    elements.quizProgressBar.parentElement.setAttribute("aria-valuenow", String(percent));

    questions.forEach((question) => {
      const mapButton = elements.questionMap.querySelector(
        `[data-question-id="${question.id}"]`
      );
      const isAnswered = Object.prototype.hasOwnProperty.call(state.answers, question.id);
      mapButton?.classList.toggle("is-answered", isAnswered);
      mapButton?.classList.remove("is-missing");
    });
  }

  function updateQuizTimer() {
    if (state.stage !== "quiz") {
      clearInterval(quizTicker);
      return;
    }

    const remaining = Math.max(0, state.quizEndsAt - Date.now());
    elements.quizTime.textContent = formatDuration(remaining);

    if (remaining <= 60000) {
      elements.quizTime.style.color = "var(--danger)";
    } else {
      elements.quizTime.style.color = "";
    }

    if (remaining <= 0 && !isSubmitting) {
      clearInterval(quizTicker);
      state.timedOut = true;
      showToast("انتهى وقت الاختبار وتم تسليم الإجابات الحالية", "error", 6000);
      finalizeQuiz({ timedOut: true });
    }
  }

  function requestQuizSubmission() {
    if (isSubmitting) {
      return;
    }

    const questions = getSelectedQuestions();
    const unanswered = questions.filter(
      (question) => !Object.prototype.hasOwnProperty.call(state.answers, question.id)
    );

    document.querySelectorAll(".question-card").forEach((card) => {
      card.classList.remove("is-missing");
    });
    document.querySelectorAll(".question-map__button").forEach((button) => {
      button.classList.remove("is-missing");
    });

    if (unanswered.length) {
      unanswered.forEach((question) => {
        document.getElementById(`question-${question.id}`)?.classList.add("is-missing");
        elements.questionMap
          .querySelector(`[data-question-id="${question.id}"]`)
          ?.classList.add("is-missing");
      });
      document.getElementById(`question-${unanswered[0].id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
      showToast(
        `بقي ${formatNumber(unanswered.length)} من الأسئلة دون إجابة`,
        "error",
        5000
      );
      return;
    }

    elements.confirmMessage.textContent =
      "سيتم اعتماد هذه الإجابات وحفظ المحاولة هل تريد المتابعة؟";
    if (typeof elements.confirmDialog.showModal === "function") {
      elements.confirmDialog.showModal();
    } else if (window.confirm("هل أنت متأكد من تسليم إجاباتك؟")) {
      finalizeQuiz({ timedOut: false });
    }
  }

  async function finalizeQuiz({ timedOut }) {
    if (isSubmitting || state.stage !== "quiz") {
      return;
    }
    isSubmitting = true;
    elements.submitQuizButton.disabled = true;
    clearInterval(quizTicker);
    if (elements.confirmDialog.open) {
      elements.confirmDialog.close("timeout");
    }

    const course = getCurrentCourse();
    const questions = getSelectedQuestions();
    const score = questions.reduce((total, question) => {
      return total + (Number(state.answers[question.id]) === question.answerIndex ? 1 : 0);
    }, 0);
    const rawPercentage = questions.length ? (score / questions.length) * 100 : 0;
    const percentage = Math.round(rawPercentage);
    const passed = rawPercentage >= CONFIG.passingPercentage;
    const completedAt = Date.now();

    state.timedOut = Boolean(timedOut);
    state.stage = "result";
    state.result = {
      receipt: createId("RP"),
      score,
      total: questions.length,
      percentage,
      passed,
      timedOut: Boolean(timedOut),
      completedAt,
      visibilityCount: state.visibilityCount,
      localSaved: false
    };
    state.updatedAt = completedAt;

    saveAttemptLock();
    saveHistoryRecord();
    persistLastResult();
    storageRemove(STORAGE.session);
    renderResult();
    setResultActionsDisabled(true);
    try {
      await submitResult();
    } finally {
      isSubmitting = false;
      setResultActionsDisabled(false);
    }
  }

  async function completeReference() {
    if (isSubmitting || state.stage !== "study") {
      return;
    }
    isSubmitting = true;
    elements.startQuizButton.disabled = true;
    const now = Date.now();
    state.stage = "result";
    state.result = {
      receipt: createId("READ"),
      score: 0,
      total: 0,
      percentage: null,
      passed: true,
      isReference: true,
      timedOut: false,
      completedAt: now,
      visibilityCount: 0,
      localSaved: false
    };
    state.updatedAt = now;
    saveHistoryRecord();
    persistLastResult();
    storageRemove(STORAGE.session);
    renderResult();
    setResultActionsDisabled(true);
    try {
      await submitResult();
    } finally {
      isSubmitting = false;
      setResultActionsDisabled(false);
    }
  }

  function renderResult() {
    const course = getCurrentCourse();
    const result = state.result;
    if (!course || !result) {
      resetToEntry("تعذر عرض نتيجة المحاولة");
      return;
    }

    showView("result");
    const isReference = Boolean(result.isReference);
    const passed = result.passed;

    elements.resultEmblem.classList.toggle("is-failed", !passed);
    elements.scoreRing.classList.toggle("is-failed", !passed);
    elements.resultEmblemPath.setAttribute(
      "d",
      passed ? "m14 25 7 7 14-17" : "M16 16l16 16M32 16 16 32"
    );

    if (isReference) {
      elements.resultKicker.textContent = "اكتمل الاطلاع";
      elements.resultTitle.textContent = "تم إتمام قراءة المرجع";
      elements.resultMessage.textContent = "يمكنك الآن العودة إلى القائمة الرئيسية";
      elements.scoreRing.hidden = true;
    } else {
      elements.scoreRing.hidden = false;
      elements.resultKicker.textContent = result.timedOut ? "انتهى وقت الاختبار" : "اكتمل الاختبار";
      elements.resultTitle.textContent = passed
        ? "أحسنت، تم اجتياز الدورة"
        : "لم تحقق درجة الاجتياز";
      elements.resultMessage.textContent = passed
        ? "تم حفظ نتيجتك ويمكنك نسخ الملخص ومشاركته"
        : `درجة الاجتياز المطلوبة ${formatNumber(CONFIG.passingPercentage)}٪ راجع المادة وحاول بعد انتهاء فترة الانتظار`;
      elements.resultPercentage.textContent = `${formatNumber(result.percentage)}٪`;
      elements.scoreRing.style.setProperty(
        "--score-angle",
        `${clamp(result.percentage, 0, 100) * 3.6}deg`
      );
    }

    elements.resultTrainee.textContent = `${state.trainee.rank} / ${state.trainee.name}`;
    elements.resultCourse.textContent = course.title;
    elements.resultScore.textContent = isReference
      ? "اطلاع مكتمل"
      : `${formatNumber(result.score)} من ${formatNumber(result.total)}`;
    elements.resultReceipt.textContent = result.receipt;
    elements.resultDate.textContent = formatDate(result.completedAt);
    elements.resultNotes.textContent = result.visibilityCount
      ? `${formatNumber(result.visibilityCount)} ملاحظة تبديل نافذة`
      : "لا توجد ملاحظات";
    setSubmissionStatus("جاري حفظ النتيجة", "");
  }

  async function submitResult() {
    const payload = buildResultPayload();
    const submittedSessionId = state.sessionId;
    const submittedResult = state.result;

    if (submittedResult.isReference) {
      setSubmissionStatus(
        submittedResult.localSaved
          ? "تم إتمام الاطلاع وحفظه محليا دون إرساله إلى سجل الاختبارات"
          : "تم إتمام الاطلاع وتعذر حفظه محليا",
        submittedResult.localSaved ? "success" : "error"
      );
      return;
    }

    if (!CONFIG.resultsEndpoint) {
      if (submittedResult.localSaved) {
        setSubmissionStatus(
          "تم حفظ النتيجة محلياً على هذا الجهاز ولم يتم ربط خادم النتائج بعد",
          "success"
        );
      } else {
        setSubmissionStatus(
          "تعذر الحفظ المحلي انسخ النتيجة أو اطبعها قبل مغادرة الصفحة",
          "error"
        );
      }
      return;
    }

    if (CONFIG.submissionMode === "google-apps-script") {
      try {
        await fetch(CONFIG.resultsEndpoint, {
          method: "POST",
          mode: "no-cors",
          keepalive: true,
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify(payload)
        });

        if (state.sessionId === submittedSessionId) {
          setSubmissionStatus(
            submittedResult.localSaved
              ? "تم إرسال النتيجة إلى سجل الإدارة وحفظ نسخة محلية"
              : "تم إرسال النتيجة إلى سجل الإدارة",
            "success"
          );
        }
      } catch (error) {
        console.error("Google Apps Script submission failed:", error);
        if (state.sessionId === submittedSessionId) {
          setSubmissionStatus(
            submittedResult.localSaved
              ? "تم حفظ النتيجة محليا لكن تعذر إرسالها إلى سجل الإدارة"
              : "تعذر حفظ النتيجة وإرسالها إلى سجل الإدارة",
            "error"
          );
        }
      }
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(CONFIG.resultsEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json().catch(() => ({}));
      if (data.receipt) {
        submittedResult.receipt = String(data.receipt);
        if (state.sessionId === submittedSessionId && state.result === submittedResult) {
          elements.resultReceipt.textContent = submittedResult.receipt;
          storageSet(STORAGE.lastResult, state);
        }
      }
      if (state.sessionId === submittedSessionId) {
        setSubmissionStatus("تم حفظ النتيجة ورفعها إلى سجل الإدارة", "success");
      }
    } catch (error) {
      console.error("Result submission failed:", error);
      if (state.sessionId === submittedSessionId) {
        setSubmissionStatus(
          submittedResult.localSaved
            ? "تم الحفظ محلياً لكن تعذر رفع النتيجة احتفظ برقم المحاولة وأبلغ الإدارة"
            : "تعذر الحفظ المحلي ورفع النتيجة انسخ الملخص أو اطبعه الآن",
          "error"
        );
      }
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function buildResultPayload() {
    const course = getCurrentCourse();
    const result = state.result;
    return {
      name: state.trainee.name,
      rank: state.trainee.rank,
      discord: state.trainee.discord,
      courseName: course.title,
      score: result.score,
      total: result.total,
      percentage: result.percentage,
      status: result.passed ? "اجتياز" : "رسوب",
      schemaVersion: 2,
      sessionId: state.sessionId,
      receipt: result.receipt,
      trainee: {
        name: state.trainee.name,
        rank: state.trainee.rank,
        discord: state.trainee.discord
      },
      course: {
        id: course.id,
        title: course.title
      },
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
    const lines = [
      "نتيجة أكاديمية أمن المنشآت — محاكاة رول بلاي",
      `المتدرب: ${state.trainee.rank} / ${state.trainee.name}`,
      `Discord ID: ${state.trainee.discord}`,
      `الدورة: ${course.title}`,
      result.isReference
        ? "الحالة: تم إتمام الاطلاع"
        : `النتيجة ${result.score} من ${result.total} بنسبة ${result.percentage} بالمئة`,
      result.isReference
        ? ""
        : `الحالة: ${result.passed ? "اجتياز" : "لم يجتز"}${result.timedOut ? " — انتهى الوقت" : ""}`,
      `رقم المحاولة: ${result.receipt}`,
      `وقت التسليم: ${formatDate(result.completedAt)}`
    ].filter(Boolean);

    try {
      await copyText(lines.join("\n"));
      showToast("تم نسخ ملخص النتيجة", "success");
    } catch {
      showToast("تعذر النسخ التلقائي استخدم خيار الطباعة", "error");
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
        "سيتم حذف جلسة الاطلاع الحالية والعودة إلى البداية هل تريد المتابعة؟"
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
      ? "لديك نتيجة محفوظة"
      : saved.stage === "quiz"
        ? "لديك اختبار لم يكتمل"
        : "لديك مادة تدريبية مفتوحة";
    elements.resumeDetails.textContent = `${course.title} — ${saved.trainee.rank} / ${saved.trainee.name}`;
    elements.resumeButton.textContent = saved.stage === "result"
      ? "عرض النتيجة"
      : "متابعة المحاولة";
    elements.resumeBanner.hidden = false;
  }

  function resumeSavedSession() {
    if (!pendingSession || !isValidSession(pendingSession)) {
      discardSavedSession();
      showToast("تعذر استعادة المحاولة المحفوظة", "error");
      return;
    }

    state = pendingSession;
    pendingSession = null;
    elements.resumeBanner.hidden = true;

    if (state.stage === "result") {
      renderResult();
      setSubmissionStatus("تم استعادة النتيجة المحفوظة على هذا الجهاز", "success");
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
    showToast("تم حذف المحاولة المحفوظة");
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
        "تعذر الحفظ التلقائي في المتصفح لا تغلق الصفحة أثناء المحاولة",
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
      // التخزين المحلي ميزة مساعدة، وتعطله لا يمنع تشغيل المنصة.
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
    const arabic = "٠١٢٣٤٥٦٧٨٩";
    const eastern = "۰۱۲۳۴۵۶۷۸۹";
    return value
      .replace(/[٠-٩]/g, (digit) => String(arabic.indexOf(digit)))
      .replace(/[۰-۹]/g, (digit) => String(eastern.indexOf(digit)));
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
