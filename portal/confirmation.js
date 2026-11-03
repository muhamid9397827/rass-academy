/* Confirmation page only. Never treat URL parameters alone as proof of verification. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const hash=new URLSearchParams(window.location.hash.replace(/^#/,''));
 const query=new URLSearchParams(window.location.search);
 const authError=hash.get('error_description')||query.get('error_description')||hash.get('error')||query.get('error');
 const sensitive=['access_token','refresh_token','token_hash','code','error','error_code','error_description'];
 function clearTokens(){
  // Clear the transient auth callback URL only after Supabase has read it.
  const queryCopy=new URLSearchParams(window.location.search);
  for(const name of sensitive)queryCopy.delete(name);
  queryCopy.delete('type');
  const suffix=queryCopy.toString();
  window.history.replaceState(null,'',window.location.pathname+(suffix?'?'+suffix:''));
 }
 function display(state,message){
  ['checking','success','error'].forEach(id=>{$('confirmation-'+id).hidden=id!==state});
  $('confirmation-status-icon').className='confirmation-symbol confirmation-symbol-'+(state==='success'?'success':state==='error'?'error':'checking');
  if(message)$('confirmation-error-message').textContent=message;
 }
 async function verify(){
  if(!window.supabase||!window.ASF_CONFIG?.supabaseUrl||!window.ASF_CONFIG?.supabaseAnonKey){
   display('error','تعذّر الاتصال بخدمة تسجيل الدخول. ارجع إلى البوابة وحاول تسجيل الدخول.');
   clearTokens();
   return;
  }
  if(authError){
   display('error','رابط التأكيد غير صالح أو انتهت صلاحيته. إذا تأكد بريدك بالفعل، ارجع إلى البوابة وسجّل الدخول.');
   clearTokens();
   return;
  }
  try{
   const auth=window.ASF_AUTH.createClient();
   // getUser validates the session server-side, including a signup callback session.
   const {data,error}=await window.ASF_AUTH.deadline(()=>auth.auth.getUser(),()=>window.ASF_AUTH.cancel(auth));
   if(error||!data?.user)throw new Error('Unverified session');
   const confirmed=Boolean(data.user.email_confirmed_at||data.user.confirmed_at);
   if(!confirmed)throw new Error('Email not confirmed');
   display('success');
  }catch{
   display('error','ما قدرنا نتحقق من تأكيد البريد في هذه الصفحة. إذا أنهيت التأكيد سابقًا، افتح البوابة وحاول تسجيل الدخول؛ لا تنشئ حسابًا ثانيًا.');
  }finally{
   clearTokens();
  }
 }
 verify();
})();
