import assert from 'node:assert/strict';
import {processCourseMail} from './supabase/functions/asf-notify/course-mail.mjs';
const sent=[],finished=[];
const admin={rpc:async(name,args)=>name==='asf_course_email_claim_due'?{data:[{id:'first',receipt:'ACD-00000011',recipient:'reviewer-one@example.invalid',claim_at:'one'},{id:'second',receipt:'ACD-00000012',recipient:'reviewer-two@example.invalid',claim_at:'two'}]}:(finished.push(args),{data:true})};
let result=await processCourseMail(admin,{key:'test-key',from:'test@example.invalid'},async(url,options)=>{sent.push({url,options});return new Response('{}',{status:200})});
assert.equal(result.sent,2);assert.equal(finished.length,2);
for(const item of sent){const mail=JSON.parse(item.options.body);assert.equal(mail.to.length,1,'one private recipient per message');assert.match(mail.subject,/اختبار دورة ناجح/);assert.match(mail.text,/view=academy-results/);assert.ok(item.options.headers['Idempotency-Key'].startsWith('asf-course-'));assert.equal(mail.text.includes('secret_report'),false);}
result=await processCourseMail(admin,{key:'test-key',from:'test@example.invalid'},async()=>new Response('{}',{status:429}));
assert.equal(result.failed,2);assert.equal(finished.at(-1).p_error,'resend_http_429');
assert.equal((await processCourseMail({rpc:async()=>({error:{message:'unavailable'}})},{key:'test'})).markFailed,1);
console.log('PASS: private Arabic success notices, stable idempotency, permission-checked claims and retryable provider failures');
