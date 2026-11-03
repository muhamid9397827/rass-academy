// Mandatory commander-only MFA screen. Authorization remains enforced by the server.
(() => {
 'use strict';
 function create({db,onVerified,onCancel}){
  const $=id=>document.getElementById(id);
  let factorId='',stage='',busy=false,active=true;
  const status=(message,bad=false)=>{const el=$('mfaStatus');el.textContent=message;el.classList.toggle('error',bad);};
  function reset(){
   active=false;factorId='';stage='';busy=false;
   $('mfaCode').value='';$('mfaQr').hidden=true;$('mfaQr').removeAttribute('src');
   $('mfaSecret').textContent='';$('mfaSecretRow').hidden=true;
   $('mfaSetup').hidden=true;$('mfaVerify').hidden=true;$('mfaStart').hidden=false;
   status('');
  }
  async function enter(){
   reset();active=true;
   $('mfaTitle').textContent='حماية حساب القائد';
   status('جارٍ فحص وسائل المصادقة...');
   const {data,error}=await db.auth.mfa.listFactors();
   if(!active)return;
   if(error){status('تعذر تحميل عوامل التحقق: '+error.message,true);return;}
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
  }
  async function beginEnrollment(){
   if(busy||stage!=='enroll')return;
   busy=true;const button=$('mfaStart');button.disabled=true;
   try{
    status('جارٍ إنشاء رمز التفعيل...');
    const {data,error}=await db.auth.mfa.enroll({factorType:'totp',friendlyName:'ASF Commander Portal'});
    if(error)throw error;
    if(!active)return;
    factorId=data?.id;
    const qr=String(data?.totp?.qr_code||'');
    if(!factorId||!qr)throw Error('لم يصل رمز التفعيل من Supabase.');
    const src=qr.startsWith('data:image/svg+xml')?qr:qr.trim().startsWith('<svg')?'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(qr):'';
    if(!src)throw Error('صيغة رمز QR غير متوقعة.');
    $('mfaQr').src=src;$('mfaQr').hidden=false;
    $('mfaSecret').textContent=String(data?.totp?.secret||'');$('mfaSecretRow').hidden=!data?.totp?.secret;
    $('mfaVerify').hidden=false;button.hidden=true;
    status('امسح رمز QR، ثم أدخل رمز المصادقة المؤقت لتفعيل الحماية.');
   }catch(e){status(e.message||'تعذر إعداد المصادقة.',true)}
   finally{busy=false;button.disabled=false}
  }
  async function verify(event){
   event.preventDefault();if(busy||!factorId)return;
   const code=$('mfaCode').value.trim();
   if(!/^\d{6}$/.test(code)){status('أدخل رمز المصادقة المكوّن من ستة أرقام.',true);return;}
   busy=true;$('mfaVerifySubmit').disabled=true;
   try{
    const c=await db.auth.mfa.challenge({factorId});
    if(c.error||!c.data?.id)throw c.error||Error('تعذر إنشاء طلب التحقق.');
    const v=await db.auth.mfa.verify({factorId,challengeId:c.data.id,code});
    if(v.error)throw v.error;
    if(!active)return;
    const level=await db.auth.mfa.getAuthenticatorAssuranceLevel();
    if(level.error||level.data?.currentLevel!=='aal2')throw level.error||Error('لم يصل تأكيد مستوى الحماية. حاول مجددًا.');
    status('تم تأكيد الرمز، جارٍ فتح حساب القائد...');
    $('mfaCode').value='';
    await onVerified();
   }catch(e){status('رمز غير صحيح أو منتهي الصلاحية: '+(e.message||'أعد المحاولة.'),true);$('mfaCode').focus();}
   finally{busy=false;$('mfaVerifySubmit').disabled=false}
  }
  $('mfaStart').onclick=beginEnrollment;
  $('mfaVerify').onsubmit=verify;
  $('mfaSignOut').onclick=()=>{reset();onCancel()};
  return {enter,reset};
 }
 window.ASF_COMMANDER_MFA=Object.freeze({create});
})();