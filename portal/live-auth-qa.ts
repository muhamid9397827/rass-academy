// One-shot operational QA. Deploy ONLY to the existing retired QA function,
// invoke through the private database bridge, and retire immediately afterwards.
// All passwords and session tokens stay in function memory. No email confirmation
// is bypassed for a real account: these example.invalid accounts are disposable.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
Deno.serve(async request => {
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:allowed}=await admin.rpc('asf_check_email_webhook',{p_token:request.headers.get('x-asf-webhook-secret')||''});
 if(allowed!==true)return new Response('Unauthorized',{status:401});
 const ids:string[]=[],paths:string[]=[],reportIds:string[]=[],checks:string[]=[],cleanupErrors:string[]=[];
 let problem='';
 const check=(okay:boolean,name:string)=>{if(!okay)throw Error(name);checks.push(name)};
 try {
  const clients:any[]=[];
  for(let i=0;i<2;i++){
   const email='asf-qa-'+crypto.randomUUID()+'@example.invalid',password=crypto.randomUUID()+'Aa!9';
   const {data:created,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{},app_metadata:{asf_disposable_qa:true}});
   check(!error&&!!created.user,'create disposable Auth user '+i);ids.push(created.user!.id);
   const {error:profileError}=await admin.from('asf_profiles').insert({user_id:created.user!.id,game_name:'اختبار تقني '+(i?'ثان':'أول'),discord_id:'9999999999999999999'+i,rank:'جندي',status:'pending',activation_reason:'اختبار تقني مؤقت لسلامة الصلاحيات'});
   check(!profileError,'create pending profile '+i);
   const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
   const {error:loginError}=await client.auth.signInWithPassword({email,password});
   check(!loginError,'real password session '+i);clients.push(client);
   const {error:selfApprove}=await client.rpc('asf_admin_action',{op:'approve',target:ids[i],arg:null});
   check(!!selfApprove,'deny self-approval '+i);
   const {error:pendingSubmit}=await client.rpc('asf_submit_report',{p_kind:'personnel',p_mode:'free',p_title:'اختبار مؤقت',p_body:{text:'فحص حساب غير مفعل'},p_original_report_id:null,p_pdf_path:ids[i]+'/'+crypto.randomUUID()+'.pdf'});
   check(!!pendingSubmit,'deny pending report '+i);
   const {error:approved}=await admin.from('asf_profiles').update({status:'approved',military_code:'QA-'+crypto.randomUUID()}).eq('user_id',ids[i]);
   check(!approved,'approve disposable profile '+i);
  }
  const [author,other]=clients;
  for(const kind of ['personnel','secret']){
   const path=ids[0]+'/'+crypto.randomUUID()+'.pdf';paths.push(path);
   const {data:report,error}=await author.rpc('asf_submit_report',{p_kind:kind,p_mode:'free',p_title:'فحص تقني مؤقت',p_body:{text:'بيانات اختبار اصطناعية فقط'},p_original_report_id:null,p_pdf_path:path});
   check(!error&&!!report?.id,'submit '+kind+' with real session');reportIds.push(report.id);
   const bytes=new TextEncoder().encode('%PDF-1.4\n% QA disposable storage test\n'+('0'.repeat(1600))+'\n%%EOF');
   const {error:upload}=await author.storage.from('asf-reports').upload(path,new Blob([bytes],{type:'application/pdf'}),{contentType:'application/pdf'});
   check(!upload,'upload '+kind+' private file');
   const {data:finalized,error:finalError}=await author.rpc('asf_mark_pdf_ready',{p_report:report.id});
   check(!finalError&&finalized===true,'finalize '+kind+' file');
   const {data:own,error:ownError}=await author.from('asf_reports').select('id').eq('id',report.id);
   check(!ownError&&(kind==='secret'?own.length===0:own.length===1),'author visibility '+kind);
   const {data:foreign,error:foreignError}=await other.from('asf_reports').select('id').eq('id',report.id);
   check(!foreignError&&foreign.length===0,'other member cannot read '+kind);
   const {error:foreignDownload}=await other.storage.from('asf-reports').download(path);
   check(!!foreignDownload,'other member cannot download '+kind);
   const {data:ownFile,error:ownDownload}=await author.storage.from('asf-reports').download(path);
   check(kind==='secret'?!!ownDownload:!ownDownload&&!!ownFile,'author download rules '+kind);
   const {error:trash}=await author.rpc('asf_trash_report',{report:report.id,restore:false});
   check(!!trash,'member cannot delete '+kind);
  }
 } catch(error) { problem=error instanceof Error?error.message:'QA failed'; }
 finally {
  if(paths.length){const {error}=await admin.storage.from('asf-reports').remove(paths);if(error)cleanupErrors.push('storage');}
  for(const id of ids){
   const {error:reports}=await admin.from('asf_reports').delete().eq('author_id',id);if(reports)cleanupErrors.push('reports');
   const {error:audit}=await admin.from('asf_audit').delete().eq('actor_id',id);if(audit)cleanupErrors.push('audit');
   const {error:profile}=await admin.from('asf_profiles').delete().eq('user_id',id);if(profile)cleanupErrors.push('profile');
   const {error:user}=await admin.auth.admin.deleteUser(id);if(user)cleanupErrors.push('auth');
  }
 }
 return Response.json({passed:!problem&&!cleanupErrors.length,checks,problem,cleanupErrors,disposableUserIds:ids,disposableReportIds:reportIds},{status:problem||cleanupErrors.length?500:200});
});
