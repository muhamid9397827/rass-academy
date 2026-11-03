// Supabase Edge Function — durable, private commander notification outbox.
// Only the trusted database bridge may invoke; never includes report text or PDF.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
Deno.serve(async (request) => {
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!service)return new Response('Server configuration unavailable',{status:503});
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const provided=request.headers.get('x-asf-webhook-secret')||'';
 const {data:valid,error:authError}=await admin.rpc('asf_check_email_webhook',{p_token:provided});
 if(authError||valid!==true)return new Response('Unauthorized',{status:401});
 let body;
 try{body=await request.json()}catch{return new Response('Bad JSON',{status:400})}
 if(body?.type!=='process_outbox')return new Response('Ignored',{status:200});
 const key=Deno.env.get('RESEND_API_KEY');
 if(!key)return Response.json({status:'email_provider_not_configured',queued_notifications_preserved:true},{status:202});
 const from=Deno.env.get('RESEND_FROM')?.trim()||'onboarding@resend.dev';
 const {data:recipient,error:recipientError}=await admin.rpc('asf_commander_email_for_delivery');
 if(recipientError||typeof recipient!=='string'||!recipient.includes('@'))
  return new Response('Verified commander email unavailable',{status:503});
 const {data:items,error:claimError}=await admin.rpc('asf_email_claim_due',{p_limit:15});
 if(claimError)return new Response('Unable to claim pending emails',{status:503});
 let sent=0,failed=0,markFailed=0;
 for(const item of items||[]){
  const isSecret=item.category==='secret_report';
  const subject=item.category==='registration'?'بوابة أمن المنشآت — طلب تفعيل جديد':
   isSecret?'بوابة أمن المنشآت — تقرير سري جديد':'بوابة أمن المنشآت — تقرير جديد';
  const message=item.category==='registration'?
   'تم إنشاء حساب جديد، راجع طلبات التفعيل من لوحة القائد.':
   isSecret?'ورد تقرير سري للغاية. سجّل الدخول إلى لوحة القائد للاطلاع عليه.':
   'ورد تقرير إداري جديد. سجّل الدخول إلى لوحة القائد لمراجعته.';
  let okay=false,problem='';
  try{
   const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json',
     'Idempotency-Key':'asf-'+item.id},
    body:JSON.stringify({from,to:[recipient],subject,text:message})
   });
   okay=response.ok;
   if(!okay)problem='resend_http_'+response.status;
  }catch{problem='resend_connection_error'}
  const {data:marked,error:markError}=await admin.rpc('asf_email_finish',{
   p_id:item.id,p_claim_at:item.claim_at,p_success:okay,p_error:problem||null});
  if(markError||marked!==true){markFailed++;continue}
  if(okay)sent++;else failed++;
 }
 return Response.json({status:'processed',sent,failed,markFailed,claimed:(items||[]).length},
  {status:markFailed?207:200});
});