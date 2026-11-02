// Supabase Edge Function: asf-purge — run daily through a scheduler.
// Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ASF_CRON_TOKEN.
// Deletes PRIVATE storage objects first, then DB rows older than 30 days.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
Deno.serve(async(req)=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const token=Deno.env.get('ASF_CRON_TOKEN')||'';
 const given=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');
 if(!token||token.length<24||given!==token)return new Response('Unauthorized',{status:401});
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return new Response('Missing config',{status:503});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const cutoff=new Date(Date.now()-30*86400000).toISOString();
 const {data,error}=await db.from('asf_reports').select('id,pdf_path').lt('deleted_at',cutoff).limit(100);
 if(error)return new Response('Database query failed',{status:500});
 let removed=0;
 for(const item of data||[]){
  const {error:fileError}=await db.storage.from('asf-reports').remove([item.pdf_path]);
  if(fileError)continue;
  const {error:dbError}=await db.from('asf_reports').delete().eq('id',item.id);
  if(!dbError)removed++;
 }
 return Response.json({removed,remaining:(data||[]).length===100?'more-may-remain':'none-in-batch'});
});
