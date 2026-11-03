export class SubmissionError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const ranks = ['جندي','جندي أول','عريف','وكيل رقيب','رقيب','رقيب أول','رئيس رقباء','ملازم','ملازم أول','نقيب','رائد','مقدم','عقيد','عميد','لواء','فريق','فريق أول'];
export function gradeSubmission(payload, catalog) {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) throw new SubmissionError('مفاتيح التصحيح الخاصة غير متاحة.',503);
  if (!payload || payload.simulation !== true || payload.demoMode !== false) throw new SubmissionError('هذه المحاولة غير قابلة للاعتماد.');
  const sessionId = payload.sessionId;
  if (typeof sessionId !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(sessionId)) throw new SubmissionError('معرّف المحاولة غير صحيح.');
  const courseId = payload.course?.id, course = Object.hasOwn(catalog, courseId) ? catalog[courseId] : null;
  if (!course) throw new SubmissionError('الدورة غير متاحة في أكاديمية أمن المنشآت.');
  const name = String(payload.trainee?.name || '').trim().replace(/\s+/g, ' ');
  const discord = String(payload.trainee?.discord || '');
  const rank = course.applicant ? 'متقدم جديد' : payload.trainee?.rank;
  if (name.length < 5 || name.length > 60 || name.split(/\s+/).length<2 || !name.split(/\s+/).every(part=>part.replace(/[.'’-]/g,'').length>=2) || !/^[\p{L}\p{M}\s.'’-]+$/u.test(name)) throw new SubmissionError('أدخل الاسم والكنية للمتدرب؛ الاسم المفرد غير مقبول.');
  if (!/^\d{15,20}$/.test(discord) || (!course.applicant && !ranks.includes(rank))) throw new SubmissionError('بيانات المتدرّب غير صحيحة.');
  if (!Array.isArray(payload.answers) || payload.answers.length !== course.count) throw new SubmissionError('عدد إجابات المحاولة غير صحيح.');
  const seen = new Set();
  let score = 0;
  const answers = payload.answers.map(value => {
    const question = Object.hasOwn(course.questions, value?.questionId) ? course.questions[value.questionId] : null;
    if (!question || seen.has(value.questionId)) throw new SubmissionError('الأسئلة غير صحيحة أو مكررة.');
    seen.add(value.questionId);
    const answer = value.answerIndex;
    if (answer !== null && (!Number.isInteger(answer) || answer < 0 || answer >= question.options)) throw new SubmissionError('إحدى الإجابات غير صحيحة.');
    if (answer === question.answer) score++;
    return { questionId: value.questionId, answerIndex: answer };
  }).sort((a, b) => a.questionId.localeCompare(b.questionId));
  const total = course.count, percentage = Math.round(score / total * 100), passed = score * 100 >= total * course.passing;
  const assignedRank = course.applicant && passed ? (percentage >= 85 ? 'وكيل رقيب' : percentage >= 70 ? 'عريف' : percentage >= 60 ? 'جندي أول' : 'جندي') : '';
  const visibilityCount = payload.visibilityCount;
  if (!Number.isInteger(visibilityCount) || visibilityCount < 0 || visibilityCount > 100000) throw new SubmissionError('بيانات المحاولة غير صحيحة.');
  return { sessionId, courseId, courseTitle: course.title, name, discord, rank, score, total, percentage, passed,
    passingPercentage: course.passing, assignedRank, answers, visibilityCount, timedOut: payload.timedOut === true,
    status: course.applicant ? (passed ? 'مؤهل' : 'غير مؤهل') : (passed ? 'اجتياز' : 'رسوب'), applicant: course.applicant };
}

export function legacyPayload(result, receipt) {
  return { name: result.name, rank: result.assignedRank || (result.applicant ? 'غير مؤهل' : result.rank),
    discord: result.discord, courseName: result.courseTitle, score: result.score, total: result.total,
    percentage: result.percentage, status: result.status, sector: result.applicant ? 'individual_qualification' : 'facilities_security',
    sectorName: result.applicant ? 'تأهيل الأفراد' : 'أمن المنشآت', receipt, sessionId: result.sessionId,
    visibilityCount: result.visibilityCount, simulation: true, demoMode: false };
}
