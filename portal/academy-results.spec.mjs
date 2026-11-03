import assert from 'node:assert/strict';
import { gradeSubmission, legacyPayload } from './supabase/functions/asf-academy-results/grading.mjs';
import { createHandler } from './supabase/functions/asf-academy-results/handler.mjs';
// Synthetic keys only: actual marking keys never enter the public Git repository.
const courseIds=['individual-qualification','operations','military-character','air-wing','zone-officer','swat'];
const catalog=Object.fromEntries(courseIds.map(id=>{
 const applicant=id==='individual-qualification';
 return [id,{title:id,applicant,count:applicant?20:10,passing:applicant?50:70,
  questions:Object.fromEntries(Array.from({length:applicant?50:30},(_,i)=>[id+'-q'+String(i+1).padStart(2,'0'),{answer:i%3,options:3}]))}];
}));

function fixture(id = 'operations') {
  const course = catalog[id];
  return { sessionId: 'SESSION-11111111-2222-4333-8444-555555555555', course: { id },
    trainee: { name: 'اختبار تقني', rank: 'جندي', discord: '999000000000000001' },
    answers: Object.entries(course.questions).slice(0, course.count).map(([questionId, q]) => ({ questionId, answerIndex: q.answer })),
    percentage: 0, passed: false, score: 0, visibilityCount: 0, timedOut: false, simulation: true, demoMode: false };
}
for (const id of Object.keys(catalog)) {
  const payload = fixture(id), result = gradeSubmission(payload,catalog);
  assert.equal(result.percentage, 100, 'server calculates scores instead of trusting supplied grade');
  assert.equal(result.passed, true);
  assert.equal(legacyPayload(result, 'ACD-00000001').receipt, 'ACD-00000001');
}
const failed = fixture();
failed.answers.forEach(a => { a.answerIndex = null; });
failed.percentage = 100; failed.passed = true;
assert.equal(gradeSubmission(failed,catalog).score, 0, 'forged success is ignored');
assert.equal(gradeSubmission(failed,catalog).passed, false);
const duplicate = fixture(); duplicate.answers[1] = duplicate.answers[0];
assert.throws(() => gradeSubmission(duplicate,catalog), /مكررة/);
assert.throws(() => gradeSubmission({ ...fixture(), demoMode: true },catalog));
assert.throws(() => gradeSubmission({ ...fixture(), answers: fixture().answers.slice(1) },catalog));
assert.throws(() => gradeSubmission({ ...fixture(), course: { id: 'public-security-operations' } },catalog));
const passAt70 = fixture();
passAt70.answers.slice(7).forEach(a => { a.answerIndex = null; });
assert.equal(gradeSubmission(passAt70,catalog).passed, true, '70% boundary preserved');
const applicant = fixture('individual-qualification');
applicant.answers.slice(10).forEach(a => { a.answerIndex = null; });
assert.equal(gradeSubmission(applicant,catalog).assignedRank, 'جندي', 'existing applicant 50% rule preserved');

let rows = new Map(), forwards = 0, mode = 'html', failure = null;const trace=[];
const admin = { rpc: async (name, args) => {
  trace.push(name);
  if (name === 'asf_private_academy_catalog') return { data: catalog, error: null };
  if (failure) return { data: null, error: { message: failure } };
  if (name === 'asf_mark_academy_legacy_sync') { rows.get(args.p_session).legacy_status = args.p_status; return { error: null }; }
  let row = rows.get(args.p_result.sessionId);
  if (row) return { data: { ...row, inserted: false }, error: null };
  row = { receipt: 'ACD-00000001', received_at: '2026-11-03T15:00:00Z', legacy_status: 'pending' };
  rows.set(args.p_result.sessionId, row);
  return { data: { ...row, inserted: true }, error: null };
} };
const handler = createHandler({ admin, salt: 'test-only-salt', fetcher: async (_url, options) => {
  trace.push('forward_google_sheet');forwards++; const payload = JSON.parse(options.body);
  return mode === 'html' ? new Response('<html>Google redirect</html>') : Response.json({ success: true, receipt: payload.receipt });
} });
const request = (payload = fixture(), origin = 'https://muhamid9397827.github.io') => new Request('https://example.invalid/results', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(payload) });
let response = await handler(request());
let data = await response.json();
assert.equal(response.status, 200);
assert.equal(data.saved, true);
assert.deepEqual(trace.slice(0,4),['asf_private_academy_catalog','asf_store_academy_result','forward_google_sheet','asf_mark_academy_legacy_sync'],'authoritative result and its database notification are created before the legacy Sheet request');
assert.equal(data.legacyStatus, 'unconfirmed', 'HTTP 200 HTML must not claim Sheet confirmation');
assert.equal(response.headers.get('access-control-allow-origin'), 'https://muhamid9397827.github.io');
await handler(request());
assert.equal(forwards, 1, 'retrying an accepted submission never duplicates a legacy POST');
rows.clear(); mode = 'json';
data = await (await handler(request())).json();
assert.equal(data.legacyStatus, 'confirmed', 'receipt-matching acknowledgment confirms the legacy copy');
failure = 'retake_wait'; assert.equal((await handler(request())).status, 409);
failure = 'rate_limit'; assert.equal((await handler(request())).status, 429);
failure = 'db_unavailable'; assert.equal((await handler(request())).status, 503);
failure = null;
assert.equal((await handler(request(fixture(), 'https://attacker.invalid'))).status, 403);
assert.equal((await handler(new Request('https://example.invalid', { method: 'POST', body: 'x'.repeat(17000) }))).status, 413);
assert.equal((await handler(new Request('https://example.invalid', { method: 'POST', body: '{broken' }))).status, 400);
console.log('PASS: six course banks, server grading, boundaries, strict receipts, retries, rate errors and CORS');

assert.throws(()=>gradeSubmission(fixture(),null),/مفاتيح التصحيح/);
const unavailable=createHandler({admin:{rpc:async()=>({data:null,error:{message:'offline'}})},salt:'test-salt'});
assert.equal((await unavailable(request())).status,503,'server refuses insecure fallback when private keys unavailable');
