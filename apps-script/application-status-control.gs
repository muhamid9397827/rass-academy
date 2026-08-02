/*
 * أضف هذا الملف إلى مشروع Google Apps Script الخاص بنتائج تقديم إدارة الرس.
 * لا تغيّر دالة doPost الحالية؛ فهي تستمر في استقبال الطلبات كما هي.
 */

const APPLICATION_SETTINGS_SHEET = "إعدادات التقديم";

function setupApplicationControl() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(APPLICATION_SETTINGS_SHEET);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(APPLICATION_SETTINGS_SHEET);
  }

  sheet.getRange("A1:B4").setValues([
    ["الإعداد", "القيمة"],
    ["حالة التقديم", true],
    ["مسؤول الإدارة", "خيرو بن طيب"],
    ["رسالة الإغلاق", "التقديم مغلق الآن. راجع إعلانات فتح التقديم عبر الديسكورد."]
  ]);
  sheet.getRange("B2").insertCheckboxes();
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 2);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("إدارة التقديم")
    .addItem("فتح التقديم", "openAdministrationApplications")
    .addItem("إغلاق التقديم", "closeAdministrationApplications")
    .addSeparator()
    .addItem("إنشاء صفحة التحكم", "setupApplicationControl")
    .addToUi();
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

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "").toLowerCase();

  if (action === "status") {
    const settings = readApplicationSettings_();
    return applicationStatusJsonResponse_({
      result: "success",
      service: "ras_administration",
      isOpen: settings.isOpen,
      managerName: settings.managerName,
      closedMessage: settings.closedMessage,
      updatedAt: new Date().toISOString()
    });
  }

  return applicationStatusJsonResponse_({
    result: "success",
    service: "ras_administration"
  });
}

function readApplicationSettings_() {
  const sheet = getApplicationSettingsSheet_();
  return {
    isOpen: sheet.getRange("B2").getValue() === true,
    managerName: String(sheet.getRange("B3").getDisplayValue() || "خيرو بن طيب").trim(),
    closedMessage: String(
      sheet.getRange("B4").getDisplayValue() ||
      "التقديم مغلق الآن. راجع إعلانات فتح التقديم عبر الديسكورد."
    ).trim()
  };
}

function getApplicationSettingsSheet_() {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(APPLICATION_SETTINGS_SHEET);

  if (!sheet) {
    throw new Error("شغّل setupApplicationControl مرة واحدة لإنشاء صفحة إعدادات التقديم.");
  }

  return sheet;
}

function applicationStatusJsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
