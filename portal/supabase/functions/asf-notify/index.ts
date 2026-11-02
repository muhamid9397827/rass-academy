// Supabase Edge Function: asf-notify
// Deploy with --no-verify-jwt. Requests are authorized using a separate token
// held in private database table app_private.asf_email_bridge_key.
// Migration 15 installs minimal-data DB triggers for signup and report events.
Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed',{status:405});
  const provided=request.headers.get('x-asf-webhook-secret')||'';
  const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!service)return new Response('Server configuration unavailable',{status:503});
  const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.57.0');
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:valid,error:checkError}=await admin.rpc('asf_check_email_webhook',{p_token:provided});
  if(checkError||valid!==true)return new Response('Unauthorized',{status:401});
  let body;
  try{body=await request.json()}catch{return new Response('Bad JSON',{status:400})}
  if(body?.type!=='INSERT'||!['asf_reports','asf_profiles'].includes(body?.table))return new Response('Ignored',{status:200});
  const key=Deno.env.get('RESEND_API_KEY'),to=Deno.env.get('ASF_COMMANDER_EMAIL'),from=Deno.env.get('RESEND_FROM');
  if(!key||!to||!from)return Response.json({status:'email_provider_not_configured'},{status:202});
  const secretReport=body.table==='asf_reports'&&body.record?.kind==='secret';
  // Confidential reports: no title, name, rank, body, or PDF emailed.
  const subject=body.table==='asf_profiles'?'بوابة أمن المنشآت — طلب تفعيل جديد':
    secretReport?'بوابة أمن المنشآت — تقرير سري جديد':'بوابة أمن المنشآت — تقرير جديد';
  const text=body.table==='asf_profiles'?
    'تم إنشاء حساب جديد، راجع طلبات التفعيل من لوحة القائد.':
    secretReport?'ورد تقرير سري للغاية. سجّل الدخول إلى لوحة القائد للاطلاع عليه.':
    'ورد تقرير جديد. سجّل الدخول إلى لوحة القائد لمراجعته وتنزيل PDF.';
  try{
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
      body:JSON.stringify({from,to:[to],subject,text})
    });
    if(!response.ok)return new Response('Mail delivery failed',{status:502});
    return new Response('Notified',{status:200});
  }catch{return new Response('Delivery unavailable',{status:502})}
});
