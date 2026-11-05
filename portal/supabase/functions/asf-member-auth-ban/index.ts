// Auth ban synchronization after a transactional ASF membership change.
// This endpoint is never authorized by a browser field or by frontend flags.
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

const ORIGINS = new Set(['https://muhamid9397827.github.io','http://127.0.0.1:8000','http://localhost:8000']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cors=(origin:string|null)=>({
 'Access-Control-Allow-Origin':ORIGINS.has(origin||'')?origin!:'https://muhamid9397827.github.io',
 'Vary':'Origin',
 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
 'Access-Control-Allow-Methods':'POST, OPTIONS'
});
const response=(status:number,data:unknown,origin:string|null)=>new Response(JSON.stringify(data),{
 status,headers:{...cors(origin),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
});
const keyFrom=(name:string,legacy:string)=>{
 const plain=Deno.env.get(legacy);if(plain)return plain;
 const dict=JSON.parse(Deno.env.get(name)||'{}');
 return typeof dict.default==='string'?dict.default:null;
};

Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('Origin');
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
 if(req.method!=='POST')return response(405,{ok:false,error:'POST only'},origin);
 if(origin&&!ORIGINS.has(origin))return response(403,{ok:false,error:'Origin not allowed'},origin);
 try{
  const token=(req.headers.get('Authorization')||'').match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token||token.startsWith('sb_'))return response(401,{ok:false,error:'Member session required'},origin);
  const body=await req.json();
  const target=typeof body.target==='string'?body.target:'';
  const mode=body.mode;
  if(!UUID.test(target)||!['ban','unban'].includes(mode))
   return response(400,{ok:false,error:'Invalid member or action'},origin);
  const url=Deno.env.get('SUPABASE_URL');
  const publicKey=keyFrom('SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY');
  const adminKey=keyFrom('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!publicKey||!adminKey)throw Error('Service configuration missing');
  const actor=createClient(url,publicKey,{
   global:{headers:{Authorization:'Bearer '+token}},
   auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}
  });
  const {data:{user},error:authError}=await actor.auth.getUser(token);
  if(authError||!user)return response(401,{ok:false,error:'Unauthenticated'},origin);
  const {data:allowed,error:permissionError}=await actor.rpc('asf_auth_ban_allowed',{p_target:target,p_mode:mode});
  if(permissionError||allowed!==true)
   return response(403,{ok:false,error:'Permission denied for target status'},origin);
  const admin=createClient(url,adminKey,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
  const {error}=await admin.auth.admin.updateUserById(target,{
   ban_duration:mode==='ban'?'876000h':'none'
  });
  if(error)throw error;
  // Avoid exposing any privileged Auth user data or secret values.
  return response(200,{ok:true,mode},origin);
 }catch(err){
  console.error('ASF member Auth ban synchronization failed:',String((err as Error)?.message||err).slice(0,180));
  return response(500,{ok:false,error:'تعذر إتمام تعديل حالة الدخول في Auth'},origin);
 }
});
