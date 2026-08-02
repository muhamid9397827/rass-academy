/**
 * مستقبل مستقل لطلبات التقديم على إدارة محافظة الرس.
 * يتضمن التحكم في فتح وإغلاق التقديم من ورقة Google نفسها.
 */

const SPREADSHEET_ID = "1Vfcm_D1aQsT4qqapy_Bdd9R9KjREvU390d0PiIyt6OE";
const SHEET_NAME = "طلبات التقديم";
const SETTINGS_SHEET_NAME = "إعدادات التقديم";
const APPLICATION_TYPE = "ras_administration";
const REVIEW_STATUS = "قيد المراجعة";
const DEFAULT_MANAGER_NAME = "خيرو بن طيب";
const DEFAULT_CLOSED_MESSAGE = "التقديم مغلق الآن. راجع إعلانات فتح التقديم عبر الديسكورد.";

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "").toLowerCase();

  if (action === "status") {
    const settings = readApplicationSettings_();
    return jsonResponse_({
      result: "success",
      service: APPLICATION_TYPE,
      isOpen: settings.isOpen,
      managerName: settings.managerName,
      closedMessage: settings.closedMessage,
      updatedAt: new Date().toISOString()
    });
  }

  return jsonResponse_({
    result: "success",
    service: APPLICATION_TYPE
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const data = parseRequest_(e);
    validateRequest_(data);

    if (!readApplicationSettings_().isOpen) {
      throw new Error("التقديم مغلق حاليًا");
    }

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);

    if (!sheet) {
      throw new Error("تعذر العثور على ورقة: " + SHEET_NAME);
    }

    const requestId = clean_(data.requestId) || Utilities.getUuid();

    // يمنع تكرار نفس الطلب إذا أعاد المتصفح الإرسال.
    if (requestExists_(sheet, requestId)) {
      return jsonResponse_({
        result: "success",
        duplicate: true,
        requestId: requestId
      });
    }

    sheet.appendRow([
      new Date(),
      clean_(data.fullName),
      clean_(data.discordId),
      clean_(data.serverName),
      clean_(data.age),
      clean_(data.confidentialityPledge),
      clean_(data.experience),
      clean_(data.dailyHours),
      clean_(data.joinReason),
      clean_(data.angryPersonResponse),
      clean_(data.secretInfoResponse),
      clean_(data.unknownProblemResponse),
      clean_(data.previousPunishments),
      clean_(data.teamworkCommitment),
      clean_(data.pressureResponse),
      clean_(data.rulesAgreement),
      clean_(data.noBansDeclaration),
      REVIEW_STATUS,
      "",
      requestId
    ]);

    return jsonResponse_({
      result: "success",
      requestId: requestId
    });
  } catch (error) {
    console.error(error);
    return jsonResponse_({
      result: "error",
      message: error && error.message ? error.message : "تعذر حفظ الطلب"
    });
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("إدارة التقديم")
    .addItem("فتح التقديم", "openAdministrationApplications")
    .addItem("إغلاق التقديم", "closeAdministrationApplications")
    .addSeparator()
    .addItem("تهيئة صفحة التحكم", "setupApplicationControl")
    .addToUi();
}

function setupApplicationControl() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SETTINGS_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SETTINGS_SHEET_NAME);
  }

  sheet.getRange("A1:B4").setValues([
    ["الإعداد", "القيمة"],
    ["حالة التقديم", true],
    ["مسؤول الإدارة", DEFAULT_MANAGER_NAME],
    ["رسالة الإغلاق", DEFAULT_CLOSED_MESSAGE]
  ]);
  sheet.getRange("B2").insertCheckboxes();
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 2);
}

function openAdministrationApplications() {
  setAdministrationApplicationsStatus_(true);
  SpreadsheetApp.getActiveSpreadsheet().toast("تم فتح التقديم.", "إدارة التقديم", 4);
}

function closeAdministrationApplications() {
  setAdministrationApplicationsStatus_(false);
  SpreadsheetApp.getActiveSpreadsheet().toast("تم إغلاق التقديم.", "إدارة التقديم", 4);
}

function setAdministrationApplicationsStatus_(isOpen) {
  const sheet = getApplicationSettingsSheet_();
  sheet.getRange("B2").setValue(Boolean(isOpen));
  SpreadsheetApp.flush();
}

function readApplicationSettings_() {
  const sheet = getApplicationSettingsSheet_();
  return {
    isOpen: sheet.getRange("B2").getValue() === true,
    managerName: String(sheet.getRange("B3").getDisplayValue() || DEFAULT_MANAGER_NAME).trim(),
    closedMessage: String(sheet.getRange("B4").getDisplayValue() || DEFAULT_CLOSED_MESSAGE).trim()
  };
}

function getApplicationSettingsSheet_() {
  const sheet = SpreadsheetApp
    .openById(SPREADSHEET_ID)
    .getSheetByName(SETTINGS_SHEET_NAME);

  if (!sheet) {
    throw new Error("تعذر العثور على ورقة: " + SETTINGS_SHEET_NAME);
  }

  return sheet;
}

function parseRequest_(e) {
  if (!e) {
    throw new Error("لم تصل بيانات الطلب");
  }

  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (error) {
      // يدعم الإرسال التقليدي من النموذج عند تعذر JSON.
    }
  }

  return e.parameter || {};
}

function validateRequest_(data) {
  if (clean_(data.applicationType) !== APPLICATION_TYPE) {
    throw new Error("نوع الطلب غير صحيح");
  }

  const requiredFields = [
    ["fullName", "الاسم داخل الديسكورد"],
    ["discordId", "معرف Discord"],
    ["serverName", "الاسم داخل السيرفر"],
    ["age", "العمر الحقيقي"],
    ["confidentialityPledge", "إقرار القسم وعدم التسريب"],
    ["experience", "الخبرات"],
    ["dailyHours", "ساعات التواجد"],
    ["joinReason", "سبب الانضمام"],
    ["angryPersonResponse", "التعامل مع الشخص الغاضب"],
    ["secretInfoResponse", "التعامل مع المعلومات السرية"],
    ["unknownProblemResponse", "التعامل مع المشكلة غير المعروفة"],
    ["previousPunishments", "العقوبات السابقة"],
    ["teamworkCommitment", "العمل ضمن فريق"],
    ["pressureResponse", "التعامل مع الضغط"],
    ["rulesAgreement", "الموافقة على القوانين"],
    ["noBansDeclaration", "إقرار عدم وجود باندات"]
  ];

  requiredFields.forEach(function (field) {
    if (!clean_(data[field[0]])) {
      throw new Error("الحقل مطلوب: " + field[1]);
    }
  });

  const age = Number(data.age);
  if (!Number.isInteger(age) || age <= 20 || age > 100) {
    throw new Error("يشترط أن يكون العمر أكثر من 20 عامًا");
  }
}

function requestExists_(sheet, requestId) {
  if (!requestId || sheet.getLastRow() < 2) {
    return false;
  }

  const match = sheet
    .getRange(2, 20, sheet.getLastRow() - 1, 1)
    .createTextFinder(requestId)
    .matchEntireCell(true)
    .findNext();

  return Boolean(match);
}

function clean_(value) {
  if (value === null || value === undefined) {
    return "";
  }

  // يمنع تفسير إجابات المتقدم كصيغة داخل Google Sheets.
  const text = String(value).trim();
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function jsonResponse_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
