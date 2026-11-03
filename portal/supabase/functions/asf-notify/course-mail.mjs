// Dedicated course messages. No confidential report query, title, text or PDF.
export async function processCourseMail(admin, { key, from }, fetcher = fetch) {
 const { data: items, error }=await admin.rpc('asf_course_email_claim_due',{p_limit:10});
 if(error)return {sent:0,failed:0,markFailed:1};
 let sent=0,failed=0,markFailed=0;
 for(const item of items||[]){
  let okay=false,problem='';
  if(!/^ACD-\d+$/.test(item.receipt)||typeof item.recipient!=='string'||!item.recipient.includes('@'))problem='invalid_course_delivery';
  else try{
   const response=await fetcher('https://api.resend.com/emails',{
    method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'asf-course-'+item.id},
    body:JSON.stringify({from,to:[item.recipient],subject:'اختبار دورة ناجح جديد | بوابة أمن المنشآت',
     text:'هناك اختبار جديد ناجح برقم '+item.receipt+'. يرجى الاطلاع على جدول النتائج ومراجعة تسليم الدورة.\n\nhttps://muhamid9397827.github.io/rass-academy/portal/?view=academy-results'})
   });
   okay=response.ok;if(!okay)problem='resend_http_'+response.status;
  }catch{problem='resend_connection_error'}
  const {data:marked,error:finishError}=await admin.rpc('asf_course_email_finish',{p_id:item.id,p_claim_at:item.claim_at,p_success:okay,p_error:problem||null});
  if(finishError||marked!==true)markFailed++;else if(okay)sent++;else failed++;
 }
 return {sent,failed,markFailed};
}
