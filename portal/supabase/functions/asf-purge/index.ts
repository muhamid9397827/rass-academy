// Supabase Edge Function: asf-purge — run daily through a scheduler.
// Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ASF_CRON_TOKEN.
// Deletes PRIVATE storage objects first, then DB rows older than 30 days.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
Deno.serve(async(req)=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const token=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return new Response('Server not configured',{status:503});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:allowed,error:authError}=await db.rpc('asf_validate_purge_token',{p_token:token});
 if(authError||allowed!==true)return new Response('Unauthorized',{status:401});
 const cutoff=new Date(Date.now()-30*86400000).toISOString();
 const {data,error}=await db.from('asf_reports').select('id,pdf_path').lt('deleted_at',cutoff).limit(100);
 if(error)return new Response('Database query failed',{status:500});
 let removed=0,failed=0,auditFailures=0;
 for(const item of data||[]){
  const {error:fileError}=await db.storage.from('asf-reports').remove([item.pdf_path]);
  if(fileError){failed++;continue;}
  const {error:dbError}=await db.from('asf_reports').delete().eq('id',item.id);
  if(dbError){failed++;continue;}
  removed++;
  // Keep a permanent deletion audit record after successful Storage + row cleanup.
  // Confidential report contents are never recorded in the audit details.
  const {error:auditError}=await db.from('asf_audit').insert({
   actor_id:null, action:'permanent_delete', target_id:item.id,
   detail:{storage_bucket:'asf-reports',storage_path:item.pdf_path}
  });
  if(auditError)auditFailures++;
 }
 return Response.json({removed,failed,auditFailures,remaining:(data||[]).length===100?'more-may-remain':'none-in-batch'},{status:auditFailures?207:200});
});
