// Pure formatting/state helpers shared by the portal and regression tests.
(function (root) {
  'use strict';
  const clean = value => String(value || '').trim().replace(/[\r\n]+/g, ' ');
  function buildInvestigation(record) {
    if (!record || ['reportNumber','investigator','accused','violationText','classification','penalty'].some(key => !clean(record[key]))) return '';
    return `تم فتح ملف تحقيق رقم : ${clean(record.reportNumber)}\n\n` +
      '`هيئه التحقيق العسكري   :   `  ' + clean(record.investigator) + '\n\n' +
      '` على العسكري :`       ' + clean(record.accused) + '\n\n' +
      '`التهمة :  `   ' + clean(record.violationText) + ' / ' + clean(record.classification) + '\n\n' +
      '`تم سماع أقواله :  `   لم يحضر الاستدعاء\n\n' +
      '`أتضح لنا أنه :   مذنب / غير مذنب  `  \n' +
      'يُرسل ملفنا هذا إلى <@&1305901086158225490>  لإصدار الحكم بحق المذكور أعلاه\n\n' +
      '`الحكم المقترح:  ` ' + clean(record.penalty);
  }
  function warningState(warning, now = Date.now()) {
    if (warning.cancelled_at) return { key: 'cancelled', label: 'ملغي', archived: true, expiresAt: null };
    const days = Number(warning.duration_days), start = Date.parse(warning.recorded_at);
    const expiresAt = Number.isFinite(start) && days > 0 ? start + days * 86400000 : null;
    const expired = expiresAt !== null && expiresAt <= now;
    return { key: expired ? 'expired' : 'active', label: expired ? 'منتهي المدة' : 'نشط', archived: expired, expiresAt };
  }
  root.ASF_WORKFLOW = Object.freeze({ buildInvestigation, warningState });
})(typeof window !== 'undefined' ? window : globalThis);
