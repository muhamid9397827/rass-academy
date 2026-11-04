// Mandatory commander-only MFA screen. Authorization always stays server-enforced.
(() => {
 'use strict';
 function create({db,onVerified,onCancel}){
  const $=id=>document.getElementById(id);
  let factorId='',stage='',busy=false,active=false,generation=0;
  const status=(message,bad=false)=>{const el=$('mfaStatus');el.textContent=message;el.classList.toggle('error',bad);};
  const bounded=(task)=>window.ASF_AUTH.deadline(task,()=>{},12000);
  const valid=step=>active&&generation===step;
  function failure(message){
   status(message,true);
   $('mfaRetry').hidden=false;
  }
  function reset(){
   generation++;active=false;factorId='';stage='';busy=false;
   $('mfaCode').value='';$('mfaQr').hidden=true;$('mfaQr').removeAttribute('src');
   $('mfaSecret').textContent='';$('mfaSecretRow').hidden=true;
   $('mfaSetup').hidden=true;$('mfaVerify').hidden=true;$('mfaStart').hidden=false;
   $('mfaVerifySubmit').disabled=false;$('mfaStart').disabled=false;
   $('mfaRetry').hidden=true;status('');
  }
  async function enter(){
   reset();active=true;const step=generation;
   $('mfaTitle').textContent='حماية حساب القائد';
   status('جارٍ فحص وسائل المصادقة...');
   try{
    const {data,error}=await bounded(()=>db.auth.mfa.listFactors());
    if(!valid(step))return;
    if(error)throw error;
    const verified=(data?.totp||[]).filter(f=>f.status==='verified');
    if(verified.length){
     stage='challenge';factorId=verified[0].id;
     $('mfaTitle').textContent='التحقق بخطوتين';
     $('mfaVerify').hidden=false;
     status('افتح تطبيق المصادقة الخاص بحساب البوابة وأدخل الرمز الحالي.');
    }else{
     stage='enroll';$('mfaSetup').hidden=false;
     status('هذه أول مرة تحمي فيها حساب القائد داخل البوابة. أضف تطبيق مصادقة مستقلًا قبل فتح لوحة القيادة.');
    }
   }catch(e){if(valid(step))failure('تعذر فحص وسائل الحماية: '+(e.message||'أعد فتح الصفحة بأمان.'));}
  }
  async function beginEnrollment(){
   if(busy||stage!=='enroll')return;
   busy=true;const step=generation,button=$('mfaStart');button.disabled=true;
   try{
    status('جارٍ إنشاء رمز التفعيل...');
    const {data,error}=await bounded(()=>db.auth.mfa.enroll({factorType:'totp',friendlyName:'ASF Commander Portal'}));
    if(!valid(step))return;
    if(error)throw error;
    factorId=data?.id;
    const qr=String(data?.totp?.qr_code||'');
    if(!factorId||!qr)throw Error('لم يصل رمز التفعيل من Supabase.');
    const src=qr.startsWith('data:image/svg+xml')?qr:qr.trim().startsWith('<svg')?'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(qr):'';
    if(!src)throw Error('صيغة رمز QR غير متوقعة.');
    $('mfaQr').src=src;$('mfaQr').hidden=false;
    $('mfaSecret').textContent=String(data?.totp?.secret||'');$('mfaSecretRow').hidden=!data?.totp?.secret;
    $('mfaVerify').hidden=false;button.hidden=true;
    status('امسح رمز QR، ثم أدخل رمز المصادقة المؤقت لتفعيل الحماية.');
   }catch(e){if(valid(step))failure('تعذر إعداد تطبيق المصادقة: '+(e.message||'أعد فتح الصفحة.'));}
   finally{if(valid(step)){busy=false;button.disabled=false;}}
  }
  async function verify(event){
   event.preventDefault();if(busy||!factorId)return;
   const code=$('mfaCode').value.trim();
   if(!/^\d{6}$/.test(code)){status('أدخل رمز المصادقة المكوّن من ستة أرقام.',true);return;}
   busy=true;const step=generation;let serverVerified=false;$('mfaVerifySubmit').disabled=true;
   try{
    status('جارٍ التحقق من الرمز...');
    const c=await bounded(()=>db.auth.mfa.challenge({factorId}));
    if(!valid(step))return;
    if(c.error||!c.data?.id)throw c.error||Error('تعذر إنشاء طلب التحقق.');
    const v=await bounded(()=>db.auth.mfa.verify({factorId,challengeId:c.data.id,code}));
    if(!valid(step))return;
    if(v.error)throw v.error;
    serverVerified=true;
    const level=await bounded(()=>db.auth.mfa.getAuthenticatorAssuranceLevel());
    if(!valid(step))return;
    if(level.error||level.data?.currentLevel!=='aal2')throw level.error||Error('لم يصل تأكيد مستوى الحماية.');
    status('تم تأكيد الرمز، جارٍ فتح حساب القائد...');
    $('mfaCode').value='';
    await window.ASF_AUTH.deadline(()=>onVerified(),()=>{},16000);
   }catch(e){
    if(valid(step)){
     if(serverVerified)failure('تم تأكيد الرمز، لكن تحميل حساب القائد تأخر. أعد فتح الصفحة لاستكمال الدخول بأمان.');
     else status('تعذر التحقق من الرمز: '+(e.message||'أعد المحاولة.'),true);
     if(!serverVerified)$('mfaCode').focus();
    }
   }finally{if(valid(step)){busy=false;$('mfaVerifySubmit').disabled=false;}}
  }
  $('mfaStart').onclick=beginEnrollment;
  $('mfaVerify').onsubmit=verify;
  $('mfaRetry').onclick=()=>window.location.reload();
  $('mfaSignOut').onclick=()=>{reset();onCancel()};
  return {enter,reset};
 }
 window.ASF_COMMANDER_MFA=Object.freeze({create});
})();