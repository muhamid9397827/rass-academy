// Supabase Edge Function: asf-notify
// Deploy with --no-verify-jwt. Require a long ASF_WEBHOOK_SECRET checked below.
// Set two Supabase Database Webhooks on INSERT asf_profiles and asf_reports.
Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed',{status:405});
  const secret=Deno.env.get('ASF_WEBHOOK_SECRET')||'';
  const provided=request.headers.get('x-asf-webhook-secret')||'';
  const enc=new TextEncoder();
  const a=enc.encode(secret),b=enc.encode(provided);
  // Do not accept empty or mismatched webhook secrets.
  let diff=a.length^b.length;
  for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a[i]||0)^(b[i]||0);
  if(secret.length<24||diff!==0)return new Response('Unauthorized',{status:401});
  let body;
  try{body=await request.json()}catch{return new Response('Bad JSON',{status:400})}
  if(body?.type!=='INSERT'||!['asf_reports','asf_profiles'].includes(body?.table))return new Response('Ignored',{status:200});
  const key=Deno.env.get('RESEND_API_KEY'),to=Deno.env.get('ASF_COMMANDER_EMAIL'),from=Deno.env.get('RESEND_FROM');
  if(!key||!to||!from)return new Response('Mail settings missing',{status:503});
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
