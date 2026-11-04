/* بوابة أمن المنشآت — MVP. Data access always enforced by Supabase RLS. */
(() => {
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KINDS={personnel:'تقرير مسؤول الأفراد',officers:'تقرير مسؤول الضباط',joint:'تقرير مشترك للأفراد والضباط',presidencies:'تقرير مسؤولي الرئاسات',secret:'سري للغاية — اطلاع القائد فقط'};
const STATES={new:'جديد',reviewing:'قيد المراجعة',reviewed:'تمت المراجعة',needs_more:'يحتاج استكمال'};

const ACCESS_PERMISSIONS={
 'court.manage':'إدارة مجلس القضاء',
 'police.manage':'قسم الشرطة العسكرية',
 'reports.read':'الاطلاع على التقارير العادية',
 'reports.review':'مراجعة التقارير العادية',
 'users.review':'الاطلاع على طلبات الأعضاء',
 'users.approve':'قبول الأعضاء الجدد',
 'academy.manage':'رئاسة الدورات ومتابعة التسليم'
};
const ACCESS_HINTS={
 'court.manage':'القضايا والقرارات القضائية، بعد تصريح القيادة فقط.',
 'police.manage':'تعديل العقوبات المقترحة داخل قسم الشرطة العسكرية.',
 'reports.read':'التقارير غير السرية فقط؛ لا يشمل تقارير «سري للغاية».',
 'reports.review':'إضافة ملاحظات ومراجعة التقارير غير السرية فقط.',
 'users.review':'الاطلاع على طلبات الأعضاء دون صلاحية اعتماد الحسابات.',
 'users.approve':'قبول أو رفض الطلبات الجديدة فقط، دون تغيير الرتب أو توزيع الصلاحيات.',
 'academy.manage':'إشعارات النجاح، والاطلاع على جدول الدورات وتأكيد التسليم باسمك.'
};
const ACCESS_STATES={pending:'قيد المراجعة',approved:'موافق عليه',rejected:'مرفوض'};
let accessPrefill='court.manage';

const RANKS=['جندي','جندي أول','عريف','وكيل رقيب','رقيب','رقيب أول','رئيس رقباء','ملازم','ملازم أول','نقيب','رائد','مقدم','عقيد','عميد','لواء','فريق','فريق أول'];
const cfg=window.ASF_CONFIG||{}, ready=!!(cfg.supabaseUrl&&cfg.supabaseAnonKey&&window.supabase);
const PORTAL_AUTH_REDIRECT='https://muhamid9397827.github.io/rass-academy/portal/';
const PORTAL_CONFIRMATION_REDIRECT='https://muhamid9397827.github.io/rass-academy/portal/confirmed.html';
// Snapshot the recovery intent BEFORE Supabase processes and removes the URL fragment.
const recoveryHash=new URLSearchParams(window.location.hash.replace(/^#/,'')),
      recoveryQuery=new URLSearchParams(window.location.search);
const recoveryTokenHash=recoveryHash.get('token_hash')||recoveryQuery.get('token_hash');
const recoveryLinkOpened=recoveryHash.get('type')==='recovery'||recoveryQuery.get('type')==='recovery';
let db=ready?window.ASF_AUTH.createClient():null;
let authEpoch=0,authNeedsReload=false,signingOut=false;
let user=null, profile=null, commander=false, policeHead=false, grants=[], departmentRoles=[], pageName=new URLSearchParams(location.search).get('view')==='academy-results'?'academy-results':'dashboard', draftId=null, latestReports=[], correctionSource=null, notificationChannel=null;
const toast=(m,error=false)=>{const b=$('#toast');b.textContent=m;b.className='show'+(error?' error':'');clearTimeout(toast.t);toast.t=setTimeout(()=>b.className='',5800)};
const set=(s,html)=>{$(s).innerHTML=html};
const date=d=>d?new Date(d).toLocaleString('ar-SA',{dateStyle:'short',timeStyle:'short'}):'—';
const code=n=>'RPT-'+String(n).padStart(6,'0');
const opt=(items,selected)=>items.map(([k,v])=>'<option value="'+esc(k)+'"'+(k===selected?' selected':'')+'>'+esc(v)+'</option>').join('');
const input=(name,label,value='',type='text')=>'<label>'+esc(label)+'<input name="'+esc(name)+'" type="'+type+'" value="'+esc(value)+'"></label>';
const btn=(label,act,id='',kind='ghost')=>'<button class="btn '+kind+' small" data-action="'+esc(act)+'" data-id="'+esc(id)+'">'+esc(label)+'</button>';
const badge=(s,secret=false)=>'<span class="badge '+(secret?'secret':'')+'">'+esc(s)+'</span>';
const empty=msg=>'<div class="empty">'+esc(msg)+'</div>';
const isFullName=value=>{const name=String(value||'').trim();const parts=name.split(/\s+/);return name.length<=80&&parts.length>=2&&parts.every(p=>p.length>=2&&/^\p{L}+$/u.test(p));};
const has=(permission,kind=null)=>commander||grants.some(g=>g.permission===permission&&(kind===null||g.report_kind===null||g.report_kind===kind));
const hasDeptRole=(department,role)=>commander||departmentRoles.some(r=>r.department===department&&r.role===role);
const hasDept=(department)=>commander||departmentRoles.some(r=>r.department===department);
const policeUI=window.ASF_POLICE_UI.create({db,getContext:()=>({user,commander,hasPolice:has('police.manage'),isPoliceHead:policeHead,gameName:profile?.game_name}),notify:toast});
const noticeUI=window.ASF_NOTICE_CENTER.create({db,getUser:()=>user,go:navigate,notify:toast});
$('#notificationTrigger').onclick=()=>navigate('notifications');
const commanderMfaUI=window.ASF_COMMANDER_MFA.create({db,onVerified:()=>loadIdentity(true,true),onCancel:()=>$('#signOut').click()});
const deptUI=window.ASF_DEPARTMENTS.create({
 db,
 getContext:()=>({user,commander,roles:departmentRoles,legacyAcademyManage:has('academy.manage')}),
 notify:toast,
 go:navigate,
 mountResults:mountAcademyResults
});

function showScreen(which){['welcome','authScreen','mfaScreen','verifyEmailScreen','recoveryScreen','pendingScreen','workspace'].forEach(id=>$('#'+id).hidden=id!==which);$('#notificationTrigger').hidden=which!=='workspace';window.ASF_MOBILE?.setWorkspace(which==='workspace')}
function openAcademy(){window.open('academy.html','_blank','noopener')}
$('#openAcademy').onclick=openAcademy;
const restrictedModal=$('#restrictedModal');
function showRestricted(section){
 accessPrefill=section.includes('القضاء')?'court.manage':section.includes('الدورات')?'academy.manage':'police.manage';
 $('#restrictedTitle').textContent=section+' — يتطلب تصريحًا خاصًا';
 $('#restrictedMessage').textContent='لا تملك صلاحية الدخول إلى قسم '+section+'. يمكنك إرسال طلب تصريح إلى القائد مع توضيح السبب.';
 restrictedModal.hidden=false;document.body.classList.add('modal-open');$('#requestRestrictedAccess').focus();
}
function closeRestricted(){restrictedModal.hidden=true;document.body.classList.remove('modal-open')}
$('#closeRestricted').onclick=closeRestricted;$('#ackRestricted').onclick=closeRestricted;
$('#requestRestrictedAccess').onclick=()=>{closeRestricted();navigate('access')};
restrictedModal.onclick=e=>{if(e.target===restrictedModal)closeRestricted()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!restrictedModal.hidden)closeRestricted()});
let registering=false,recoveryMode=recoveryLinkOpened;
function authForm(mode){if(signingOut)return;$('#authStatus').hidden=true;$('#authFresh').hidden=true;registering=mode==='register';showScreen('authScreen');$('#authTitle').textContent=registering?'إنشاء حساب جديد':'تسجيل الدخول';$('#registerFields').hidden=!registering;$('#authSubmit').textContent=registering?'إرسال طلب إنشاء حساب':'تسجيل الدخول';$('#authToggle').textContent=registering?'لديك حساب بالفعل؟ تسجيل الدخول':'ليس لديك حساب؟ إنشاء حساب';$('#forgotPassword').hidden=registering;
 // Do not apply new-password rules to existing accounts: HTML validation
 // otherwise silently blocks submit with no Auth request at all.
 $('#password').minLength=registering?8:0;
 $('#password').setAttribute('autocomplete',registering?'new-password':'current-password');
 ['gameName','discordId','rank','activationReason'].forEach(id=>$('#'+id).required=registering);}
$('#authFresh').onclick=()=>{
 window.ASF_AUTH.resetSessionScope();
 window.location.replace(PORTAL_AUTH_REDIRECT+'?login=1&fresh='+Date.now());
};
$('#showLogin').onclick=()=>authForm('login');$('#showRegister').onclick=()=>authForm('register');
$('#registerFromHero').onclick=()=>authForm('register');
$('#authToggle').onclick=()=>{if(!$('#authSubmit').disabled)authForm(registering?'login':'register')};
$('#forgotPassword').onclick=async()=>{
 if(!ready)return toast('ربط قاعدة البيانات غير متاح',true);
 const email=$('#email').value.trim();if(!email)return toast('أدخل بريدك الإلكتروني أولًا',true);
 const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:PORTAL_AUTH_REDIRECT});
 toast(error?'تعذر إرسال رابط الاستعادة: '+error.message:'إذا كان البريد مسجلًا، سيتم إرسال رابط استعادة كلمة المرور.',!!error);
};$('#authBack').onclick=()=>showScreen('welcome');
$('#verifyEmailLogin').onclick=()=>authForm('login');
$('#verifyEmailBack').onclick=()=>showScreen('welcome');
$('#rank').innerHTML=opt(RANKS.map(r=>[r,r]));
$('#signOut').onclick=async()=>{
 if(signingOut)return;signingOut=true;['showLogin','showRegister','registerFromHero','signOut'].forEach(id=>$('#'+id).disabled=true);
 authEpoch++;user=null;profile=null;commander=false;policeHead=false;grants=[];departmentRoles=[];latestReports=[];correctionSource=null;draftId=null;set('#page','');showScreen('welcome');$('#signOut').hidden=true;$('#sessionLabel').textContent='';
 if(notificationChannel){db.removeChannel(notificationChannel);notificationChannel=null;}
 try{const {error}=await window.ASF_AUTH.deadline(()=>db.auth.signOut(),()=>{authNeedsReload=true;window.ASF_AUTH.cancel(db)});if(error)throw error;}catch(err){
  authNeedsReload=true;window.ASF_AUTH.cancel(db);
  window.ASF_AUTH.resetSessionScope();
  toast('أُغلقت الجلسة محليًا، وتعذر تأكيد إنهائها على الخادم: '+err.message,true);
 }finally{signingOut=false;['showLogin','showRegister','registerFromHero','signOut'].forEach(id=>$('#'+id).disabled=false);}
};
$('#refreshProfile').onclick=()=>loadIdentity(true);
$('#pendingReasonForm').onsubmit=async e=>{
 e.preventDefault();
 if(!ready||!user)return toast('سجّل الدخول أولًا لاستكمال طلب التفعيل.',true);
 const p_reason=$('#pendingReason').value.trim();
 if(p_reason.length<10||p_reason.length>500)return toast('اذكر سببًا واضحًا من 10 إلى 500 حرف.',true);
 const submit=$('#submitPendingReason');submit.disabled=true;
 try{
  const {error}=await db.rpc('asf_submit_activation_reason',{p_reason});
  if(error)throw error;
  toast('تم تسجيل سبب التفعيل وإشعار القيادة.');
  await loadIdentity(true);
 }catch(err){toast('تعذر إرسال السبب: '+(err.message||'خطأ غير معروف'),true)}
 finally{submit.disabled=false}
};
// Auth transitions are serialized by Supabase's SDK. Never subscribe to auth
// events during SDK initialization: that can deadlock navigator.locks on reload
// when a stored session needs refreshing.
let authListenerBound=false;
function bindAuthListener(){
 if(authListenerBound)return;
 authListenerBound=true;
 db.auth.onAuthStateChange(event=>{
  // Keep this handler SYNCHRONOUS: calling auth/database APIs here deadlocks
  // the auth client's lock (Supabase advisory).
  if(event==='PASSWORD_RECOVERY'){
   recoveryMode=true;
   showRecoveryScreen();
  }else if(event==='SIGNED_OUT'){
   authEpoch++;user=null;commander=false;policeHead=false;profile=null;grants=[];departmentRoles=[];
   latestReports=[];correctionSource=null;draftId=null;set('#page','');
   if(notificationChannel){
    const channel=notificationChannel;notificationChannel=null;
    // Supabase callbacks run under the Auth lock. Do not call async client
    // methods from this callback; release the Realtime channel next task.
    setTimeout(()=>{try{Promise.resolve(db.removeChannel(channel)).catch(()=>{});}catch{}},0);
   }
   commanderMfaUI.reset();noticeUI.reset();
   if(!recoveryMode)showScreen('welcome');
  }
 });
}
function markAuthBlocked(){
 if(authNeedsReload)return;
 authEpoch++;authNeedsReload=true;window.ASF_AUTH.cancel(db);
}
const authDeadline=(work,ms=12000)=>window.ASF_AUTH.deadline(work,markAuthBlocked,ms);
$('#authForm').onsubmit=async e=>{
 e.preventDefault();if(!ready)return toast('يلزم إعداد Supabase أولًا. الدورات العامة متاحة.',true);
 if(authNeedsReload){
  // A cancelled client must never be reused; offer a new storage namespace.
  $('#authStatus').hidden=false;$('#authStatus').className='auth-status error';
  $('#authStatus').textContent='الجلسة القديمة متوقفة. اضغط «إعادة اتصال نظيفة» لإعادة المحاولة دون فقدان حسابك.';
  $('#authFresh').hidden=false;return;
 }
 const email=$('#email').value.trim(),password=$('#password').value,attempt=++authEpoch;
 const status=$('#authStatus');status.hidden=false;status.className='auth-status';
 status.textContent=registering?'جارٍ إنشاء الحساب…':'جارٍ التحقق من بيانات الدخول…';
 $('#authSubmit').textContent=registering?'جارٍ إنشاء الحساب…':'جارٍ تسجيل الدخول…';
 $('#authForm').setAttribute('aria-busy','true');
 $('#authToggle').disabled=true;$('#forgotPassword').disabled=true;$('#authSubmit').disabled=true;
 let passwordAccepted=false;
 try{
  if(registering){
   const game_name=$('#gameName').value.trim().replace(/\s+/g,' '),discord_id=$('#discordId').value.trim(),rank=$('#rank').value,
    activation_reason=$('#activationReason').value.trim();
   if(!isFullName(game_name))throw Error('اكتب الاسم والكنية، مثل: مجاهد ال عباد. لا يُقبل اسم واحد فقط.');
   if(!/^[0-9]{17,20}$/.test(discord_id))throw Error('معرّف Discord يجب أن يكون رقميًا من 17 إلى 20 خانة.');
   if(activation_reason.length<10||activation_reason.length>500)throw Error('سبب طلب التفعيل إلزامي ويجب أن يتراوح بين 10 و500 حرف.');
   const {data,error}=await authDeadline(()=>db.auth.signUp({email,password,
    options:{emailRedirectTo:PORTAL_CONFIRMATION_REDIRECT,data:{asf_portal:'true',game_name,discord_id,rank,activation_reason}}}),14000);
   if(attempt!==authEpoch)return;
   if(error)throw error;
   if(!data?.session){
    $('#verifyEmailMessage').textContent='إذا قُبل طلب التسجيل، ستصلك رسالة على بريدك الإلكتروني لتأكيد الحساب. افتحها، ثم ارجع لتسجيل الدخول.';
    $('#password').value='';showScreen('verifyEmailScreen');return;
   }
  }else{
   const {data,error}=await authDeadline(()=>db.auth.signInWithPassword({email,password}),14000);
   if(attempt!==authEpoch)return;
   if(error){
    const message=String(error.message||'');
    if(/email not confirmed/i.test(message))throw Error('بريدك الإلكتروني لم يتم تأكيده بعد. افتح رسالة التأكيد، ثم عد لتسجيل الدخول.');
    if(/invalid login credentials/i.test(message))throw Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    if(/rate.?limit|too many requests|429/i.test(message))throw Error('محاولات دخول كثيرة. حاول لاحقاً ولا تكرر الضغط بسرعة.');
    throw error;
   }
   if(!data?.session)throw Error('تعذر إنشاء جلسة الدخول. حاول مجددًا.');
  }
  passwordAccepted=true;
  status.textContent='تم تسجيل الدخول؛ جارٍ تحميل بيانات الحساب…';
  // A valid password must never be mistaken for failed sign-in if a
  // later profile/RPC/MFA request stalls. Bound the post-auth phase separately.
  await authDeadline(()=>loadIdentity(false,true),16000);
 }catch(err){
  const timedOut=err?.name==='AuthTimeoutError'||/abort|timeout|fetch|network|lock/i.test(String(err?.message||''));
  $('#authFresh').hidden=!timedOut;
  if(timedOut)markAuthBlocked();
  status.hidden=false;status.className='auth-status error';
  status.textContent=timedOut
   ?(passwordAccepted?'تم قبول تسجيل الدخول، لكن تحميل صلاحيات الحساب أو التحقق بخطوتين تأخر. افتح جلسة دخول جديدة بأمان.':'تأخر الاتصال بخدمة الدخول. أعد فتح تسجيل الدخول بأمان.')
   :(passwordAccepted?'تم قبول كلمة المرور، لكن تعذر تحميل الحساب: ':'')+(err.message||'تعذر تنفيذ العملية');
 }finally{
  $('#authSubmit').disabled=false;
  $('#authSubmit').textContent=authNeedsReload?'إعادة فتح تسجيل الدخول':registering?'إرسال طلب إنشاء حساب':'تسجيل الدخول';
  $('#authForm').removeAttribute('aria-busy');$('#authToggle').disabled=false;$('#forgotPassword').disabled=false;
 }
};
async function init(){
 const epoch=authEpoch;
 if(!ready){showScreen('welcome');toast('البوابة بحاجة لربط قاعدة البيانات لتفعيل الحسابات.',true);return}
 try{
  // Handle one-use recovery tokens explicitly. No auth listener is needed
  // before initial session recovery/refresh finishes.
  if(recoveryTokenHash && recoveryLinkOpened){
   window.history.replaceState(null,'',window.location.pathname);
   recoveryMode=true;showRecoveryScreen();
   const {data:recovered,error:verifyError}=await authDeadline(
    ()=>db.auth.verifyOtp({type:'recovery',token_hash:recoveryTokenHash}),14000);
   bindAuthListener();
   if(verifyError||!recovered?.user){
    $('#recoveryStatus').textContent='رابط الاستعادة منتهي الصلاحية أو مستخدم من قبل. اطلب رابطًا جديدًا.';
    $('#recoveryForm').hidden=true;
   }
   return;
  }
  const {data,error}=await authDeadline(()=>db.auth.getUser(),14000);
  if(epoch!==authEpoch)return;
  // Subscribe only AFTER initial SDK initialization, avoiding the
  // onAuthStateChange/getUser near-expiry session-lock deadlock.
  bindAuthListener();
  if(recoveryMode){
   showRecoveryScreen();
   if(error||!data?.user){
    $('#recoveryStatus').textContent='انتهت صلاحية رابط الاستعادة أو تعذر التحقق منه. ارجع إلى تسجيل الدخول واطلب رابطًا جديدًا.';
    $('#recoveryForm').hidden=true;
   }
   return;
  }
  if(data?.user){
   user=data.user;
   await authDeadline(()=>loadIdentity(),16000);
  }else if(new URLSearchParams(window.location.search).has('login')||
           new URLSearchParams(window.location.search).has('reconnect'))authForm('login');
  else showScreen('welcome');
 }catch(err){
  if(epoch!==authEpoch&&!authNeedsReload)return;
  if(!authNeedsReload)bindAuthListener();
  showScreen(recoveryMode?'recoveryScreen':'welcome');
  toast(authNeedsReload?'انتهت مهلة الاتصال بالجلسة؛ افتح تسجيل الدخول مجددًا.':'تعذر التحقق من الجلسة؛ يمكنك تجربة تسجيل الدخول من جديد.',true);
 }
}
function showRecoveryScreen(){
 showScreen('recoveryScreen');
 $('#recoveryForm').hidden=false;
 $('#recoveryStatus').textContent='أدخل كلمة مرور جديدة، ثم سجّل الدخول بها إلى البوابة.';
}
$('#recoveryBack').onclick=()=>{
 // Never use the recovery link as an ordinary sign-in. Request a fresh link if needed.
 recoveryMode=false;
 window.history.replaceState(null,'',window.location.pathname);
 authForm('login');
};
$('#recoveryForm').onsubmit=async e=>{
 e.preventDefault();
 if(!ready)return toast('خدمة تسجيل الدخول غير متاحة.',true);
 const password=$('#recoveryPassword').value,confirmation=$('#recoveryPasswordConfirm').value;
 if(password.length<8)return toast('يجب أن تتكوّن كلمة المرور من 8 أحرف على الأقل.',true);
 if(password!==confirmation)return toast('كلمتا المرور غير متطابقتين.',true);
 const submit=$('#recoverySubmit');submit.disabled=true;
 try{
  const {data:authResult,error:authError}=await db.auth.getUser();
  if(authError||!authResult?.user)throw Error('رابط الاستعادة غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا.');
  const {error}=await db.auth.updateUser({password});
  if(error)throw error;
  recoveryMode=false;
  window.history.replaceState(null,'',window.location.pathname);
  $('#recoveryForm').reset();
  await db.auth.signOut();
  authForm('login');
  toast('تم تحديث كلمة المرور. يمكنك الآن تسجيل الدخول بالكلمة الجديدة.');
 }catch(err){toast(err.message||'تعذر تحديث كلمة المرور.',true)}
 finally{submit.disabled=false}
};
async function query(name,select='*'){const {data,error}=await db.from(name).select(select);if(error)throw error;return data||[]}
async function loadIdentity(silent=false,fromAuth=false){
 const epoch=authEpoch;
 if(!ready)return;
 try{
  const {data:{user:u},error:ue}=await db.auth.getUser();if(epoch!==authEpoch)return;if(ue)throw ue;
  if(!u){showScreen('welcome');return}user=u;
  // Require commander's AAL2 before loading any internal app data.
  const {data:mfaRequired,error:mfaError}=await db.rpc('asf_commander_mfa_required');
  if(epoch!==authEpoch)return;
  if(mfaError)throw mfaError;
  if(mfaRequired===true){
   if(!db.auth.mfa)throw Error('المتصفح لا يدعم تحقق القائد؛ حدّث الصفحة.');
   const {data:assurance,error:aalError}=await db.auth.mfa.getAuthenticatorAssuranceLevel();
   if(epoch!==authEpoch)return;
   if(aalError)throw aalError;
   if(assurance?.currentLevel!=='aal2'){
    $('#sessionLabel').textContent=user.email||'القائد';$('#signOut').hidden=false;
    showScreen('mfaScreen');
    await commanderMfaUI.enter();
    return;
   }
  }
 const [{data:p,error:pe},{data:cm,error:ce},{data:dg,error:de},{data:responsibilities,error:re},{data:departmentMemberships,error:dme},{data:policeMembership,error:hme}]=await Promise.all([
    db.from('asf_profiles').select('*').eq('user_id',user.id).maybeSingle(),
    db.rpc('asf_is_commander'),
    db.from('asf_delegations').select('*').eq('user_id',user.id),
    db.from('asf_responsibilities').select('*').eq('user_id',user.id),
    db.from('asf_department_roles').select('user_id,department,role').eq('user_id',user.id),
    db.from('asf_police_heads').select('user_id').eq('user_id',user.id)
  ]);
  if(epoch!==authEpoch)return;
  if(pe||ce||de||re||dme||hme)throw pe||ce||de||re||dme||hme;
  profile=p;commander=!!cm;policeHead=!!policeMembership?.length;grants=[...(dg||[]),...(responsibilities||[])];departmentRoles=departmentMemberships||[];
  if(!notificationChannel){
    // All signed-in members can receive their own decision notices. RLS stays authoritative.
    notificationChannel=db.channel('asf-notices-'+user.id)
     .on('postgres_changes',{event:'INSERT',schema:'public',table:'asf_notifications',filter:'recipient_id=eq.'+user.id},
      payload=>{
       const notice=payload.new||{};
       toast(notice.message||'وصل إشعار جديد');
       noticeUI.refreshBadge().catch(()=>{});
       if(pageName==='notifications')noticeUI.render().catch(()=>{});
       if(notice.category==='access_decision'){
        loadIdentity(true).catch(err=>toast(err.message,true));
        return;
       }
       if(['academy_pass','academy_assigned'].includes(notice.event_kind||notice.category)){
        if(pageName==='academy-results')renderAcademyResults();
        if(pageName==='academy')renderAcademy();
       }
       if(pageName==='dashboard')renderDashboard().catch(err=>toast(err.message,true));
       if(pageName==='members'&&notice.category==='registration'&&has('users.approve'))renderMembers().catch(err=>toast(err.message,true));
       if(commander){
        if(pageName==='inbox')renderReports('inbox').catch(err=>toast(err.message,true));
        if(pageName==='members'&&notice.category==='registration')renderMembers().catch(err=>toast(err.message,true));
        if(pageName==='access-queue'&&notice.category==='access_request')renderAccessQueue().catch(err=>toast(err.message,true));
       }
      }).subscribe();
  }
  $('#sessionLabel').textContent=p?.game_name||user.email;$('#signOut').hidden=false;noticeUI.refreshBadge().catch(()=>{});
  if(commander||p?.status==='approved'){
   showScreen('workspace');$('#courtNav').hidden=!(commander||p?.court_enabled||has('court.manage'));
    $('#policeNav').hidden=!(commander||policeHead||has('police.manage'));
   $('#adminNav').hidden=!(commander||has('reports.read')||has('reports.review')||has('users.review')||has('users.approve'));
   document.querySelector('[data-page="members"]').hidden=!(commander||has('users.review')||has('users.approve'));
   document.querySelector('[data-page="changes"]').hidden=!(commander||has('users.review'));
   $('#academyReviewNav').hidden=!(commander||has('academy.manage')||hasDeptRole('training','head')||hasDeptRole('training','trainer'));
   $('#departmentNav').hidden=!(hasDept('training')||hasDept('recruitment'));
   $('#trainingCenterNav').hidden=!hasDept('training');
   $('#recruitmentCenterNav').hidden=!hasDept('recruitment');
   $('#departmentAdminNav').hidden=!commander;
   document.querySelectorAll('[data-page="delegations"],[data-page="trash"],[data-page="audit"]').forEach(n=>n.hidden=!commander);
   document.querySelector('[data-page="inbox"]').hidden=!(commander||has('reports.read')||has('reports.review'));
   document.querySelector('[data-page="access-queue"]').hidden=!commander;
   await navigate(pageName);
  }else{
   showScreen('pendingScreen');
   const missingReason=p?.status==='pending'&&String(p?.activation_reason||'').trim().length<10;
   $('#pendingText').textContent=p?.status==='rejected'?'تم رفض الطلب. تواصل مع الإدارة.':p?.status==='suspended'?'الحساب موقوف حاليًا.':missingReason?'يجب استكمال سبب طلب التفعيل قبل أن يتمكن القائد من الموافقة.':'حسابك بانتظار موافقة القائد. يمكنك دخول الدورات العامة.';
   $('#pendingReasonSection').hidden=!missingReason;
   $('#pendingReasonRecorded').hidden=p?.status!=='pending'||missingReason;
   if(missingReason)$('#pendingReason').value=String(p?.activation_reason||'');
  }
  if(!silent)toast('تم تحديث حالة الحساب');
 }catch(err){
  if(epoch!==authEpoch)return;
  const message=String(err?.message||'');
  if(err?.name==='AuthSessionMissingError'||/auth session missing|session expired|invalid jwt/i.test(message)){
   user=null;profile=null;commander=false;grants=[];
   if(notificationChannel){db.removeChannel(notificationChannel);notificationChannel=null}
   authForm('login');
   toast('انتهت جلسة تسجيل الدخول أو لم تبدأ بعد. سجّل الدخول ببريدك وكلمة المرور.',true);
   return;
  }
  if(fromAuth)throw err;
  toast('تعذر تحميل بيانات المستخدم: '+message,true);
  showScreen('welcome');
 }
}
document.querySelectorAll('.nav').forEach(n=>n.onclick=()=>navigate(n.dataset.page));
async function navigate(name){
 if(!user||!(commander||profile?.status==='approved'))return;
 window.ASF_MOBILE?.closeMenu();window.ASF_MOBILE?.setPage(name);
 pageName=name;document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.page===name));
 const titles={notifications:'مركز الإشعارات',dashboard:'لوحة التحكم',academy:'الأكاديمية والدورات','academy-results':'نتائج الدورات والتسليم','training-center':'كلية التدريب','recruitment-center':'القبول والتجنيد','department-admin':'رئاسات الأقسام',reports:'تقاريري',compose:'إنشاء تقرير',police:'الشرطة العسكرية',court:'مجلس القضاء',inbox:'التقارير الواردة',members:'إدارة المستخدمين',changes:'طلبات تعديل البيانات',delegations:'تفويض القيادات',access:'طلب تصريح ومتابعته','access-queue':'طلبات التصاريح الواردة',trash:'سلة المحذوفات',audit:'سجل العمليات',account:'الملف الشخصي'};
 set('#pageTitle','<div><h1>'+esc(titles[name]||'بوابة أمن المنشآت')+'</h1><p>المنصة الموحدة · إعدادات الصلاحيات حسب حسابك</p></div>');
 set('#page','<div class="empty">جارٍ تحميل البيانات...</div>');
 try{
  if(name==='notifications')return await noticeUI.render();
  if(name==='dashboard')return await renderDashboard();
  if(name==='academy')return await renderAcademy();
  if(name==='academy-results')return await renderAcademyResults();
  if(name==='training-center')return await deptUI.render('training');
  if(name==='recruitment-center')return await deptUI.render('recruitment');
  if(name==='department-admin'&&commander){
    await deptUI.renderAdmin();
    $('#page').insertAdjacentHTML('beforeend','<section class="section-card"><h3>رئاسة الشرطة العسكرية</h3><p class="muted">تعيين رئيس الشرطة وتوزيع رول الشرطة العسكرية ورول مجلس القضاء للأعضاء المعتمدين من مكان واحد.</p><button type="button" class="btn primary" id="openPoliceLeadership">فتح إدارة رئاسة الشرطة</button></section>');
    $('#openPoliceLeadership').onclick=async()=>{await navigate('police');const details=$('#mpLeadershipDetails');if(details){details.open=true;details.scrollIntoView({block:'start',behavior:'smooth'});}};
    return;
   }
  if(name==='reports'||name==='inbox'||name==='trash')return await renderReports(name);
  if(name==='compose')return await renderCompose();
  if(name==='police')return await renderPolice();
  if(name==='court')return await renderCourt();
  if(name==='members'&&(commander||has('users.review')||has('users.approve')))return await renderMembers();
  if(name==='changes'&&(commander||has('users.review')))return await renderChanges();
  if(name==='delegations'&&commander)return await renderDelegations();
  if(name==='access')return await renderAccessRequests();
  if(name==='access-queue'&&commander)return await renderAccessQueue();
  if(name==='audit'&&commander)return await renderAudit();
  if(name==='account')return await renderAccount();
  set('#page',empty('لا تملك صلاحية الوصول إلى هذا القسم.'));
 }catch(err){set('#page',empty('تعذر تحميل القسم: '+err.message));toast(err.message,true)}
}
async function renderDashboard(){
 const courtAllowed=commander||profile?.court_enabled||has('court.manage');
 const policeAllowed=commander||policeHead||has('police.manage');
 const canDeliver=commander||has('academy.manage')||hasDeptRole('training','head')||hasDeptRole('training','trainer');
 const cards=[
  ['compose','＋','تقرير جديد','إرسال تقرير إداري'],
  ['reports','▤','تقاريري','المتابعة والمسودات'],
  ['academy','🎓','الأكاديمية','الدورات والاختبارات'],
  ...(policeAllowed?[['police','🛡','الشرطة العسكرية','بحث المخالفات والتحقيق']]:[]),
  ...(courtAllowed?[['court','⚖','مجلس القضاء','القضايا والإنذارات']]:[]),
  ...(canDeliver?[['academy-results','✓','نتائج الدورات','التسليم والمتابعة']]:[]),
  ...(hasDept('training')?[['training-center','🎓','كلية التدريب','عمل القسم']]:[]),
  ...(hasDept('recruitment')?[['recruitment-center','🪪','القبول والتجنيد','طلبات القسم']]:[]),
  ...(commander?[['department-admin','⚙','رئاسات الأقسام','إدارة الأدوار']]:[])
 ];
 const card=([id,icon,title,description])=>'<button type="button" class="dashboard-card mp-simple-card" data-section="'+id+'"><span class="dashboard-card__icon" aria-hidden="true">'+icon+'</span><span class="dashboard-card__body"><strong>'+esc(title)+'</strong><small>'+esc(description)+'</small></span><span class="dashboard-card__action">فتح ←</span></button>';
 set('#page','<section class="mp-dashboard-welcome"><div><span class="eyebrow">مساحة عملك</span><h2>أهلًا، '+esc(profile?.game_name||'القيادة')+'</h2><p>اختر ما تحتاجه فقط؛ الأقسام التي لا تملك صلاحيتها مخفية.</p></div><span class="mp-dashboard-code">'+esc(profile?.military_code||'قيادة أمن المنشآت')+'</span></section>'+
 '<section class="mp-dashboard-top"><button class="btn primary" type="button" data-fast="compose">＋ كتابة تقرير</button><button class="btn ghost" type="button" data-fast="reports">متابعة تقاريري</button><button class="btn ghost" type="button" data-fast="academy">الدورات العامة</button></section>'+
 '<div class="section-intro"><div><h2>أدواتك</h2><p>الأعمال اليومية بالأعلى، وبقية الأقسام تجدها هنا عند الحاجة.</p></div></div>'+
 (cards.length>3?'<details class="mp-notices-panel mp-workspaces-fold"><summary>الأقسام التخصصية المتاحة <span class="badge">'+(cards.length-3)+'</span></summary><div class="dashboard-sections mp-simple-grid mp-fold-grid">'+cards.slice(3).map(card).join('')+'</div></details>':'')+
 '<div class="mp-dashboard-foot"><span>هل تحتاج صلاحية إضافية؟</span><button type="button" class="btn ghost small" id="accessDashboardShortcut">طلب وصول أو متابعة طلباتي</button></div>'+
 '<section id="dashboardNotices" class="mp-notices"></section>');
 $('#page').querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>navigate(b.dataset.section));
 $('#page').querySelectorAll('[data-fast]').forEach(b=>b.onclick=()=>navigate(b.dataset.fast));
 $('#accessDashboardShortcut').onclick=()=>navigate(commander?'access-queue':'access');
 const {data:notices,error}=await db.from('asf_notifications').select('*').order('created_at',{ascending:false}).limit(12);
 if(error||!$('#dashboardNotices'))return;
 const {count:allUnread,error:countErr}=await db.from('asf_notifications').select('id',{count:'exact',head:true}).is('read_at',null);
 const pending=countErr?(notices||[]).filter(n=>!n.read_at).length:(allUnread||0);
 $('#dashboardNotices').innerHTML='<details class="mp-notices-panel"><summary>الإشعارات <span class="badge">'+pending+' غير مقروء</span></summary><div class="mp-notices-body"><div class="row"><button type="button" class="btn ghost small" id="openNoticeCenter">فتح مركز الإشعارات</button><button type="button" class="btn ghost small" id="markAllRead">تحديد الكل كمقروء</button></div>'+
 ((notices||[]).map(n=>'<div class="notice-item">'+(n.read_at?'':'● ')+esc(n.message)+'<small class="muted">'+date(n.created_at)+'</small>'+
 (['academy_pass','academy_assigned'].includes(n.event_kind||n.category)&&canDeliver?'<button type="button" class="btn ghost small" data-open-notice="academy-results">فتح نتائج الدورات</button>':n.category==='registration'&&(commander||has('users.approve'))?'<button type="button" class="btn ghost small" data-open-notice="members">طلبات العضوية</button>':'')+'</div>').join('')||empty('لا توجد إشعارات حاليًا'))+'</div></details>';
 $('#dashboardNotices').querySelectorAll('[data-open-notice]').forEach(b=>b.onclick=()=>navigate(b.dataset.openNotice));
 $('#openNoticeCenter').onclick=()=>navigate('notifications');
 $('#markAllRead').onclick=async()=>{const {error:err}=await db.from('asf_notifications').update({read_at:new Date().toISOString()}).is('read_at',null);if(err)return toast(err.message,true);toast('تم تحديد الإشعارات كمقروءة');noticeUI.refreshBadge();renderDashboard();};
}

function renderAcademy(){
 const courses=Object.values(window.COURSES||{}).filter(c=>c.sector==='facilities_security');
 set('#page','<div class="notice">الدورات متاحة للجميع بدون تسجيل دخول.</div><div class="grid three">'+courses.map(c=>'<section class="section-card"><h3>'+esc(c.title)+'</h3><p>'+esc(c.requiredRank||'')+'</p><a class="btn ghost" href="academy.html" target="_blank" rel="noopener">فتح دورة الأكاديمية</a></section>').join('')+'</div><button class="btn primary" id="allCourses">دخول الأكاديمية</button>');
 $('#allCourses').onclick=openAcademy;
 if(commander||has('academy.manage')){
  $('#page').insertAdjacentHTML('beforeend','<div id="academyResultPanel"></div>');mountAcademyResults();
 }
}
function renderAcademyResults(){
 if(!commander&&!has('academy.manage')&&!hasDeptRole('training','head')&&!hasDeptRole('training','trainer'))return set('#page',empty('نتائج الدورات متاحة فقط لرئاسة كلية التدريب أو مدربيها المصرّح لهم.'));
 set('#page','<div id="academyResultPanel"></div>');mountAcademyResults();
}
function mountAcademyResults(){
 const panel=$('#academyResultPanel');if(!panel)return;
 panel.innerHTML='<section class="section-card" style="margin-top:20px"><h3>نتائج الدورات والتسليم</h3><p class="muted">نفس نتيجة الاختبار تنتقل من النجاح إلى تأكيد تسليم الدورة. التأكيد يسجّل اسمك ووقت الإجراء، ولا يمنح رتبة أو صلاحية تلقائيًا.</p><details class="notice course-notice-flow"><summary>إشعارات النتائج والربط مع جدول Google</summary><p>عند حفظ اختبار ناجح في البوابة، يصل إشعار داخل الموقع إلى القائد ومسؤولي الدورات المفوّضين، ثم تُرسل نسخة النتيجة إلى جدول Google المرتبط. الإشعار لا يعني تأكيد وصول نسخة Google؛ حالة النسخة تظهر في عمودها أدناه.</p><p>تأكيد التسليم واسم المسؤول ووقته محفوظة في هذا السجل داخل الموقع. الإضافة اليدوية إلى Google لا تولّد إشعارًا في البوابة.</p><a class="btn ghost small" id="courseGoogleSheet" href="https://docs.google.com/spreadsheets/d/1PC5iXwHWyFT4kd7qa6oa_JL1-r3F_anv3fPniF8rfdM/edit" target="_blank" rel="noopener noreferrer">فتح جدول Google المرتبط</a></details><form id="academyResultsFilter" class="grid two"><label>الاسم أو Discord أو الإيصال<input name="search" maxlength="60"></label><label>حالة المتابعة<select name="state"><option value="pending">ناجحون بانتظار التسليم</option><option value="delivered">تم تسليم الدورة</option><option value="all" selected>جميع النتائج</option></select></label><label>مسار التأهيل<select name="track"><option value="all">كل الاختبارات</option><option value="qualification">تأهيل المتقدمين الجدد</option><option value="courses">دورات الأفراد</option></select></label><button class="btn ghost" type="submit">بحث وتحديث</button></form><div id="academyResultsRows" aria-live="polite"></div></section>';
 const demoHost=document.createElement('section');
 demoHost.id='academyDemoPanel';
 demoHost.className='section-card';
 demoHost.style.marginTop='16px';
 panel.prepend(demoHost);
 window.ASF_ACADEMY_DEMO?.mount(demoHost);
 let offset=0,term='',filter='all',track='all',generation=0;
 const load=async()=>{
  const rows=$('#academyResultsRows');if(!rows)return;const request=++generation;rows.textContent='جاري تحميل النتائج…';
  let q=db.from('asf_academy_results').select('id,receipt,course_id,trainee_name,trainee_rank,discord_id,course_title,score,total,percentage,passed,received_at,legacy_status,delivered_at,delivered_by_name,delivered_by_code',{count:'exact'}).eq('is_test',false).order('received_at',{ascending:false});
  if(track==='qualification')q=q.eq('course_id','individual-qualification');
  if(track==='courses')q=q.neq('course_id','individual-qualification');
  if(filter==='pending')q=q.eq('passed',true).is('delivered_at',null);
  if(filter==='delivered')q=q.not('delivered_at','is',null);
  if(term)q=/^\d{15,20}$/.test(term)?q.eq('discord_id',term):/^ACD-\d+$/.test(term)?q.eq('receipt',term):q.ilike('trainee_name','%'+term.replace(/[%_\\]/g,'')+'%');
  const {data,error,count}=await q.range(offset,offset+49);
  if(!rows.isConnected||request!==generation)return;
  if(error){rows.textContent='تعذر تحميل سجل النتائج. أعد المحاولة.';return;}
  const rewardResponse=await db.from('asf_department_rewards')
   .select('id,subject_id,actor_id,actor_name,amount,paid_at,paid_by_name').eq('department','training')
   .order('earned_at',{ascending:false}).limit(200);
  const rewardByResult=new Map((rewardResponse.data||[]).map(reward=>[reward.subject_id,reward]));
  const canReviewReward=commander||hasDeptRole('training','head');
  const rewardCell=r=>{
   const reward=rewardByResult.get(r.id);
   if(!r.delivered_at)return 'لم يسلم الرول بعد';
   if(!reward)return 'لا يوجد استحقاق ظاهر';
   if(reward.paid_at)return '<span class="dept-state-paid">✓ تم إعطاء المكافأة</span><small>بواسطة '+esc(reward.paid_by_name||'الرئاسة')+'</small>';
   return '<span class="dept-state-unpaid">150,000 بانتظار الصرف</span>'+
    (canReviewReward&&reward.actor_id!==user.id?'<button class="btn primary small" data-course-reward="'+esc(reward.id)+'">✓ تم إعطاء المكافأة</button>':'');
  };
  const sync={pending:'قيد المتابعة',confirmed:'مؤكد',unconfirmed:'غير مؤكد',failed:'تعذر الإرسال'};
  rows.innerHTML='<p class="muted">'+esc(count??data?.length??0)+' نتيجة</p>'+(data?.length?'<div class="table-scroll"><table><thead><tr><th>الإيصال والتاريخ</th><th>المتدرّب</th><th>الدورة</th><th>النتيجة</th><th>تسليم الرول للمتدرب</th><th>المدرب ووقت الإجراء</th><th>مكافأة المدرب</th><th>نسخة الجدول القديم</th></tr></thead><tbody>'+data.map(r=>'<tr><td>'+esc(r.receipt)+'<br>'+date(r.received_at)+'</td><td>'+esc(r.trainee_name)+'<br>'+esc(r.trainee_rank)+'<br>'+esc(r.discord_id)+'</td><td>'+esc(r.course_title)+'</td><td>'+esc(r.score)+' / '+esc(r.total)+' · '+esc(r.percentage)+'%<br>'+badge(r.passed?'اجتياز':'رسوب')+'</td><td>'+(r.delivered_at?'<span class="course-delivered">✓ تم تسليم الرول (توثيق يدوي)</span>':r.passed?'<button class="btn primary small" data-deliver-result="'+esc(r.id)+'">✓ تم إعطاء رول الدورة</button>':badge('غير مجتاز'))+'</td><td>'+esc(r.delivered_by_name||'—')+(r.delivered_by_code?'<br>'+esc(r.delivered_by_code):'')+(r.delivered_at?'<br>'+date(r.delivered_at):'')+'</td><td class="dept-reward-cell">'+rewardCell(r)+'</td><td>'+esc(sync[r.legacy_status]||'غير مؤكد')+'</td></tr>').join('')+'</tbody></table></div>':empty('لا توجد نتائج مطابقة'))+'<div class="row"><button class="btn ghost small" id="academyResultsPrev" '+(offset===0?'disabled':'')+'>السابق</button><button class="btn ghost small" id="academyResultsNext" '+(offset+50>=(count??data?.length??0)?'disabled':'')+'>التالي</button></div>';
  $('#academyResultsPrev').onclick=()=>{offset=Math.max(0,offset-50);load()};$('#academyResultsNext').onclick=()=>{offset+=50;load()};
  rows.querySelectorAll('[data-course-reward]').forEach(button=>button.onclick=async()=>{
   if(!confirm('تأكيد صرف مكافأة 150,000 للمدرب بالفعل؟ لا يمكن تكرار التأشير.'))return;
   button.disabled=true;
   const {error:err}=await db.rpc('asf_department_mark_paid',{p_reward:button.dataset.courseReward});
   if(err){toast(err.message||'تعذر تأكيد المكافأة',true);button.disabled=false;return}
   toast('تم تسجيل صرف مكافأة المدرب.');await load();
   if($('#departmentRewards'))await deptUI.rewardPanel('training');
  });
  rows.querySelectorAll('[data-deliver-result]').forEach(button=>button.onclick=async()=>{
   if(!confirm('هل أعطيت المتدرب رول الدورة فعليًا؟ سيُحفظ اسمك ووقت الإجراء في السجل، وقد ينشأ استحقاق 150,000 للمدرب. لا يعد هذا منحًا تلقائيًا لرول Discord.'))return;
   button.disabled=true;
   try{const {data:result,error}=await db.rpc('asf_confirm_academy_delivery',{p_result:button.dataset.deliverResult});if(error)throw error;
    toast((result.already_delivered?'سبق تأكيد التسليم بواسطة ':'تم تأكيد التسليم باسم ')+result.delivered_by_name);await load();
     if($('#departmentRewards'))await deptUI.rewardPanel('training');
   }catch(err){toast(err.message||'تعذر تأكيد التسليم',true);button.disabled=false;}
  });
 };
 $('#academyResultsFilter').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);term=String(f.get('search')||'').trim();filter=String(f.get('state'));track=String(f.get('track')||'all');offset=0;load()};load();
}
function cardReport(r,mode){
 const secret=r.kind==='secret',revealed=mode==='inbox'||mode==='trash'||!secret;
 return '<article class="section-card"><div class="row between"><div><h3>'+esc(r.title)+'</h3><span class="muted">'+esc(code(r.report_number))+' · '+date(r.submitted_at)+' · '+esc(r.sender_name)+'</span></div>'+badge(KINDS[r.kind],secret)+(r.pdf_ready_at?'':badge('PDF قيد الإكمال'))+'</div>'+
 '<div class="row" style="margin-top:12px">'+btn('عرض التفاصيل','detail',r.id)+btn('تنزيل PDF','pdf',r.id)+(commander?btn(mode==='trash'?'استعادة':'حذف','trash',r.id,mode==='trash'?'light':'warn'):'')+'</div></article>';
}
async function renderReports(mode){
 if(mode==='inbox'&&!has('reports.read')&&!has('reports.review'))return set('#page',empty('غير مصرح لك بعرض التقارير الواردة'));
 if(mode==='trash'&&!commander)return set('#page',empty('سلة المحذوفات خاصة بالقائد'));
 let q=db.from('asf_reports').select('*').order('submitted_at',{ascending:false}).limit(300);
 if(mode==='reports')q=q.eq('author_id',user.id).is('deleted_at',null);
 else if(mode==='trash')q=q.not('deleted_at','is',null);
 else q=q.is('deleted_at',null);
 const {data,error}=await q;if(error)throw error;latestReports=data||[];
 const filters='<div class="row" style="margin-bottom:15px"><input id="searchReports" placeholder="بحث بالاسم أو العنوان أو رقم التقرير" style="max-width:420px"><select id="kindReports" style="max-width:250px">'+opt([['','جميع الأنواع'],...Object.entries(KINDS)])+'</select></div>';
 set('#page',(mode==='trash'?'<div class="notice danger-note">سلة المحذوفات: يمكن استعادة التقرير خلال 30 يومًا. الحذف النهائي للملف يتطلب مهمة خادم مجدولة.</div>':'')+filters+'<div id="reportCards">'+(latestReports.map(r=>cardReport(r,mode)).join('')||empty('لا توجد تقارير بعد'))+'</div>');
 const update=()=>{
  const s=$('#searchReports').value.toLowerCase().trim(),kind=$('#kindReports').value;
  const items=latestReports.filter(r=>(!kind||r.kind===kind)&&(!s||[r.sender_name,r.sender_code,r.title,code(r.report_number)].some(v=>String(v).toLowerCase().includes(s))));
  set('#reportCards',items.map(r=>cardReport(r,mode)).join('')||empty('لا توجد نتائج مطابقة'));
 };
 $('#searchReports').oninput=update;$('#kindReports').onchange=update;
 $('#reportCards').onclick=async e=>{
  const b=e.target.closest('button[data-action]');if(!b)return;
  const r=latestReports.find(x=>x.id===b.dataset.id);if(!r)return;
  if(b.dataset.action==='detail')return detailReport(r,mode);
  if(b.dataset.action==='pdf')return downloadPdf(r);
  if(b.dataset.action==='trash'&&commander){
   if(!confirm(mode==='trash'?'استعادة التقرير من سلة المحذوفات؟':'نقل التقرير إلى سلة المحذوفات؟'))return;
   const {error}=await db.rpc('asf_trash_report',{report:r.id,restore:mode==='trash'});if(error)return toast(error.message,true);
   toast('تم حفظ الإجراء');return renderReports(mode);
  }
 };
}
async function downloadPdf(r){
 let {data,error}=await db.storage.from('asf-reports').download(r.pdf_path);
 const mayRepair=commander||(profile?.status==='approved'&&r.author_id===user?.id&&r.kind!=='secret');
 if(error && mayRepair && r.deleted_at===null){
  try{
   const pdf=await buildPdf(r);
   const {error:uploadError}=await db.storage.from('asf-reports').upload(r.pdf_path,pdf,{contentType:'application/pdf',upsert:false});
   if(uploadError)throw uploadError;
   data=pdf;error=null;
   toast('أُعيد إنشاء ملف PDF من بيانات التقرير المحفوظة.');
  }catch(repairError){toast('تعذر إصلاح ملف PDF: '+repairError.message,true)}
 }
 if(error)return toast('ملف PDF غير جاهز أو ليس لديك صلاحية: '+error.message,true);
 if(!r.pdf_ready_at && r.deleted_at===null){
  const {data:ready,error:markError}=await db.rpc('asf_mark_pdf_ready',{p_report:r.id});
  if(markError||!ready)toast('الملف متاح للقراءة لكن تعذر تحديث حالة حفظه',true);
 }
 const blobUrl=URL.createObjectURL(data);
 const opened=window.open(blobUrl,'_blank','noopener,noreferrer');
 if(!opened){
  const link=document.createElement('a');link.href=blobUrl;link.download=code(r.report_number)+'.pdf';link.click();
 }
 setTimeout(()=>URL.revokeObjectURL(blobUrl),120000);
}
async function detailReport(r,mode){
 const [currentReview,historyResult]=await Promise.all([
  db.from('asf_reviews').select('*').eq('report_id',r.id).maybeSingle(),
  db.from('asf_review_history').select('*').eq('report_id',r.id).order('created_at',{ascending:false}).limit(100)
 ]);
 if(currentReview.error||historyResult.error)return toast((currentReview.error||historyResult.error).message,true);
 const rev=currentReview.data,history=historyResult.data||[];
 const historyBlock='<section class="section-card"><h3>سجل مراجعات التقرير</h3>'+
   (history.map(h=>'<div style="padding:12px;border-bottom:1px solid var(--line)"><div class="row between"><b>'+esc(STATES[h.state]||h.state)+'</b><span class="muted">'+date(h.created_at)+'</span></div>'+
    '<p style="white-space:pre-wrap;margin:6px 0">'+esc(h.note||'بدون ملاحظات')+'</p></div>').join('')||empty('لم تُسجل مراجعات حتى الآن'))+'</section>';
 const content=r.mode==='free'?'<p class="muted">نص التقرير</p><div style="white-space:pre-wrap">'+esc(r.body?.text||'')+'</div>':
 ['achievements','progress','needs','notes'].map((x,i)=>'<h4>'+['الإنجازات','التقدم','الاحتياجات','الملاحظات'][i]+'</h4><p style="white-space:pre-wrap">'+esc(r.body?.[x]||'—')+'</p>').join('');
 set('#page','<div class="section-card"><div class="row between"><h3>'+esc(r.title)+'</h3>'+badge(KINDS[r.kind],r.kind==='secret')+'</div><p class="muted">'+code(r.report_number)+' · '+date(r.submitted_at)+'</p><p>'+esc(r.sender_rank)+' / '+esc(r.sender_name)+' / '+esc(r.sender_code)+'</p><hr>'+content+'<hr><b>مراجعة القائد:</b> '+esc(STATES[rev?.state]||'جديد')+'<p>'+esc(rev?.note||'لا توجد ملاحظات')+'</p><div class="row">'+btn('عرض PDF','pdf',r.id)+(mode==='reports'&&r.kind!=='secret'?btn('تقديم تصحيح','correct',r.id):'')+btn('رجوع','back')+'</div></div>'+
 historyBlock+((commander||has('reports.review',r.kind))?'<section class="section-card"><h3>مراجعة التقرير</h3><form id="reviewForm"><label>حالة التقرير<select name="state">'+opt(Object.entries(STATES),rev?.state||'new')+'</select></label><label>الملاحظات والتوجيهات<textarea name="note" maxlength="4000">'+esc(rev?.note||'')+'</textarea></label><button class="btn primary">حفظ المراجعة</button></form></section>':''));
 $('#page').querySelector('[data-action="pdf"]').onclick=()=>downloadPdf(r);
 $('#page').querySelector('[data-action="back"]').onclick=()=>renderReports(mode);
 const fix=$('#page').querySelector('[data-action="correct"]');if(fix)fix.onclick=()=>{correctionSource=r;draftId=null;navigate('compose')};
 if(commander||has('reports.review',r.kind))$('#reviewForm').onsubmit=async e=>{
  e.preventDefault();const f=new FormData(e.currentTarget);
  const {error}=await db.rpc('asf_review_report',{report:r.id,new_state:f.get('state'),new_note:f.get('note')});
  if(error)return toast(error.message,true);toast('تم حفظ الملاحظات');detailReport(r,mode);
 };
}
async function renderCompose(){
 if(!profile){toast('أكمل ملف القائد العسكري أولًا',true);return navigate('account');}
 const {data:drafts,error}=await db.from('asf_drafts').select('*').order('updated_at',{ascending:false}).limit(30);if(error)throw error;
 set('#page','<div class="section-card"><div class="row between"><h3>تقرير إداري جديد</h3><span class="badge secret">التقرير السري متاح لجميع الرتب</span></div>'+
 '<form id="reportForm"><div class="grid two"><label>نوع التقرير<select name="kind" id="reportKind">'+opt(Object.entries(KINDS).map(([kind,label])=>[kind,kind==='secret'?'تقرير سري — لجميع الرتب':label]))+'</select></label><label>صيغة التقرير<select name="mode" id="reportMode">'+opt([['structured','تقرير منظم'],['free','تقرير حر']])+'</select></label></div>'+
 '<aside id="secretReportGuidance" class="secret-report-guidance" aria-labelledby="secretReportHeading" hidden><h4 id="secretReportHeading">مساحة خاصة تصل إلى القيادة</h4><p>متاح للأفراد والضباط من جميع الرتب، بعد تفعيل الحساب.</p><p class="secret-report-privacy"><u>لا يطّلع على هذا التقرير إلا القائد نفسه، ولا يطّلع عليه أي شخص آخر.</u></p><p>بعض الملاحظات تستحق أن تصل في نطاق أضيق. يتيح هذا المسار إيصال ما يستدعي عناية القيادة من معلومات أو مستجدات، بخصوصية تحفظ سياقها وتمنحها ما تستحق من اهتمام.</p><p class="secret-report-reward">قد تُمنح مكافأة للتقرير السري تتراوح بين <strong>500 ألف و5 ملايين</strong>، بحسب أهمية المعلومات وتقدير القائد.</p><small>بعد الإرسال لا يتاح للمرسل إعادة فتح التقرير أو تنزيل ملفه.</small></aside>'+
 input('title','عنوان التقرير')+
 '<div id="structuredFields">'+['achievements','progress','needs','notes'].map((x,i)=>'<label>'+['الإنجازات','التقدم','الاحتياجات','الملاحظات'][i]+'<textarea name="'+x+'" maxlength="9000"></textarea></label>').join('')+'</div>'+
 '<div id="freeFields" hidden><label>نص التقرير<textarea name="text" maxlength="18000" rows="10"></textarea></label></div>'+
 '<label>رقم النسخة الأصلية للتصحيح (UUID اختياري)<input name="original" placeholder="اتركه فارغًا للتقرير الجديد"></label>'+
 '<div class="row"><button class="btn primary" type="submit">إرسال وقفل التقرير</button><button class="btn ghost" type="button" id="saveDraft">حفظ مسودة</button></div></form></div>'+
 '<section class="section-card"><h3>مسوداتي</h3><div class="row">'+(drafts||[]).map(d=>btn(d.title||'مسودة بدون عنوان','load',d.id)).join('')+'</div></section>');
 const form=$('#reportForm');
 if(correctionSource){form.elements.kind.value=correctionSource.kind;form.elements.original.value=correctionSource.id;form.elements.title.value='تصحيح: '+correctionSource.title;}
 const toggle=()=>{$('#freeFields').hidden=$('#reportMode').value!=='free';$('#structuredFields').hidden=$('#reportMode').value==='free';$('#secretReportGuidance').hidden=$('#reportKind').value!=='secret'};
 $('#reportMode').onchange=toggle;$('#reportKind').onchange=toggle;toggle();
 const collect=()=>{const f=new FormData(form),mode=f.get('mode'),body=mode==='free'?{text:String(f.get('text')||'')}:
 Object.fromEntries(['achievements','progress','needs','notes'].map(x=>[x,String(f.get(x)||'')]));
 return {kind:f.get('kind'),mode,title:String(f.get('title')||'').trim(),body,original:String(f.get('original')||'').trim()||null}};
 const save=async()=>{const v=collect();const row={author_id:user.id,kind:v.kind,mode:v.mode,title:v.title,body:v.body,updated_at:new Date().toISOString()};if(draftId)row.id=draftId;
 const {data,error}=await db.from('asf_drafts').upsert(row).select('id').single();if(error)throw error;draftId=data.id;toast('حُفظت المسودة')};
 $('#saveDraft').onclick=async()=>{try{await save()}catch(e){toast(e.message,true)}};
 $('#page').querySelectorAll('[data-action="load"]').forEach(b=>b.onclick=()=>{
  const d=drafts.find(x=>x.id===b.dataset.id);if(!d)return;draftId=d.id;
  form.elements.kind.value=d.kind;form.elements.mode.value=d.mode;form.elements.title.value=d.title;
  ['achievements','progress','needs','notes','text'].forEach(x=>{if(form.elements[x])form.elements[x].value=d.body?.[x]||''});toggle();toast('تم تحميل المسودة');
 });
 form.onsubmit=async e=>{
  e.preventDefault();const v=collect();if(v.title.length<3||!Object.values(v.body).some(s=>String(s).trim()))return toast('أدخل العنوان ومحتوى التقرير',true);
  if(v.original&&!/^[0-9a-f-]{36}$/i.test(v.original))return toast('معرّف النسخة الأصلية غير صحيح',true);
  if(v.kind==='secret'&&!confirm('بعد الإرسال لن تتمكن حتى أنت من عرض هذا التقرير السري. المتلقي الوحيد هو القائد. متابعة؟'))return;
  const submit=form.querySelector('[type="submit"]');submit.disabled=true;
  try{
   const path=user.id+'/'+crypto.randomUUID()+'.pdf';
   const {data,error}=await db.rpc('asf_submit_report',{p_kind:v.kind,p_mode:v.mode,p_title:v.title,p_body:v.body,p_original_report_id:v.original,p_pdf_path:path});
   if(error)throw error;
   const report={...v,report_number:data.report_number,submitted_at:data.submitted_at,sender_name:profile.game_name,sender_rank:profile.rank,sender_code:profile.military_code};
   let result='تم اعتماد إرسال التقرير '+code(data.report_number);
   try{const pdf=await buildPdf(report);const {error:up}=await db.storage.from('asf-reports').upload(path,pdf,{contentType:'application/pdf',upsert:false});if(up)throw up;
    const {data:confirmed,error:confirmError}=await db.rpc('asf_mark_pdf_ready',{p_report:data.id});
    if(confirmError||!confirmed)throw Error('تم رفع PDF لكن تعذر تأكيد حفظه');
    result+=' وحفظ PDF بنجاح'}
   catch(pdfError){result+=' لكن تعذّر إنشاء/رفع PDF: '+pdfError.message+'. التقرير محفوظ في قاعدة البيانات، ويجب معالجة الملف.'}
   if(draftId)await db.from('asf_drafts').delete().eq('id',draftId);draftId=null;correctionSource=null;
   toast(result,result.includes('تعذّر'));form.reset();toggle();
   // Confidential sender does not retain read access even after submitting.
   if(v.kind!=='secret')navigate('reports');
  }catch(err){toast(err.message,true)}
  finally{submit.disabled=false}
 };
}
function renderPaper(r){
 const sections=r.mode==='free'?'<h4>نص التقرير</h4><div class="paper-body">'+esc(r.body.text||'')+'</div>':
 ['achievements','progress','needs','notes'].map((k,i)=>'<h4>'+['الإنجازات','التقدم','الاحتياجات','الملاحظات'][i]+'</h4><div class="paper-body">'+esc(r.body[k]||'—')+'</div>').join('');
 const el=document.createElement('article');el.className='report-paper';
 el.innerHTML='<div style="display:flex;justify-content:space-between"><b>بوابة أمن المنشآت<br>القيادة العامة</b><b style="font-size:30px">◆</b></div><h2>تقرير إداري رسمي</h2><div style="text-align:center">'+esc(KINDS[r.kind])+(r.kind==='secret'?'<p><span class="stamp">سري للغاية</span></p>':'')+'</div>'+
 '<div class="paper-meta"><div>رقم التقرير: <b>'+code(r.report_number)+'</b></div><div>تاريخ الإرسال: '+esc(date(r.submitted_at))+'</div><div>اسم المرسل: '+esc(r.sender_name)+'</div><div>الرتبة: '+esc(r.sender_rank)+'</div><div>الكود: '+esc(r.sender_code)+'</div><div>الجهة المستلمة: القائد</div></div>'+
 '<h3>الموضوع: '+esc(r.title)+'</h3>'+sections+
 (r.original||r.original_report_id?'<p>تصحيح مرتبط بالتقرير: '+esc(r.original||r.original_report_id)+'</p>':'')+
 '<div class="paper-footer">وثيقة إلكترونية لأغراض المحاكاة داخل سيرفر رول بلاي · رقم التقرير '+code(r.report_number)+'</div>';
 return el;
}
async function buildPdf(report){
 if(typeof window.html2pdf!=='function')throw Error('مكتبة PDF لم تُحمّل');
 return window.html2pdf().set({margin:5,filename:code(report.report_number)+'.pdf',image:{type:'jpeg',quality:0.98},html2canvas:{scale:2,useCORS:true,logging:false},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},pagebreak:{mode:['css','legacy']}}).from(renderPaper(report)).outputPdf('blob');
}
async function renderPolice(){return policeUI.render();}
async function renderCourt(){
 if(!(commander||profile?.court_enabled||has('court.manage')))return set('#page',empty('مجلس القضاء يتطلب تفعيلًا خاصًا من القائد.'));
 const [cases,decisions,warnings]=await Promise.all([query('asf_court_cases'),query('asf_court_decisions'),query('asf_court_warnings')]);
 cases.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
 warnings.sort((a,b)=>String(b.recorded_at).localeCompare(String(a.recorded_at)));
 set('#page','<div class="notice">سجل قضائي جديد مستقل؛ لم يتم نقل أو تعديل إنذارات الأرشيف القديم.</div>'+
 '<div class="section-card"><h3>القضايا الواردة</h3>'+ (cases.map(c=>{
  const d=decisions.find(v=>v.case_id===c.id);return '<div class="section-card"><h3>'+esc(c.subject)+'</h3><p style="white-space:pre-wrap">'+esc(c.details)+'</p><p class="muted">'+date(c.created_at)+'</p><div>'+badge(d?(d.outcome==='approved'?'معتمدة':'مرفوضة'):'بانتظار القرار')+'</div>'+
  (!d?'<div class="row">'+btn('اعتماد','decide-yes',c.id)+btn('رفض','decide-no',c.id)+'</div>':'<p>'+esc(d.note||'')+'</p>')+'</div>'}).join('')||empty('لا توجد قضايا بعد'))+'</div>'+
 '<div class="section-card"><h3>تسجيل إنذار قضائي</h3><form id="warningForm">'+
 '<div class="grid two">'+input('player_name','اسم العسكري الكامل')+input('player_rank','الرتبة')+input('player_code','الكود العسكري')+'<label>Discord ID للبحث الدقيق<input name="player_discord_id" required inputmode="numeric" pattern="[0-9]{15,22}" maxlength="22" placeholder="المعرّف الرقمي"></label>'+
 '<label>درجة الإنذار<select name="warning_level">'+opt([['شفهي','شفهي'],['وظيفي','وظيفي'],['نهائي','نهائي'],['إجراء آخر','إجراء آخر']])+'</select></label>'+
 '<label>مدة الإنذار بالأيام (اختياري)<input name="duration_days" type="number" min="0" max="3650"></label>'+
 '<label>رقم القضية المرتبطة (اختياري)<select name="case_id">'+opt([['','بدون قضية'],...cases.map(c=>[c.id,c.subject])])+'</select></label></div>'+
 '<label>المخالفة<textarea name="offense" required minlength="4" maxlength="4000"></textarea></label>'+
 '<label>العقوبة<textarea name="punishment" required minlength="3" maxlength="4000"></textarea></label>'+
 '<button class="btn primary" type="submit">تثبيت الإنذار في السجل</button></form></div>'+
 '<div class="section-card"><div class="row between"><h3>السجل القضائي والإنذارات</h3>'+badge(String(warnings.length)+' سجل')+'</div>'+
 '<div class="mp-court-lookup"><h4>استعلام سريع عن إنذارات عسكري</h4><p class="muted">أدخل الاسم الكامل ومعرّف Discord معًا لعرض الإنذارات النشطة. السجلات القديمة دون معرّف لا تظهر في الاستعلام المزدوج.</p><form id="warningLookupForm" class="grid two"><label>اسم العسكري الكامل<input name="player" required maxlength="80" placeholder="الاسم والكنية"></label><label>Discord ID<input name="discord" required inputmode="numeric" pattern="[0-9]{15,22}" maxlength="22"></label><button class="btn primary" type="submit">بحث عن الإنذارات النشطة</button></form><div id="warningLookupResult" aria-live="polite"></div></div><input id="warningSearch" placeholder="ابحث بالاسم أو الكود أو Discord أو الرتبة أو المخالفة">'+
 '<div class="row"><label>السجل<select id="warningScope"><option value="active">الإنذارات النشطة</option><option value="archive">الأرشيف: المنتهية والملغاة</option><option value="all">جميع السجلات</option></select></label></div><div id="warningRows"></div></div>');
 $('#page').onclick=async e=>{
  const b=e.target.closest('[data-action]');if(!b)return;
  if(b.dataset.action.startsWith('decide')){
   const note=prompt('ملاحظة القرار (اختياري)')||'';
   const {error}=await db.from('asf_court_decisions').insert({case_id:b.dataset.id,outcome:b.dataset.action==='decide-yes'?'approved':'rejected',note,decided_by:user.id});
   if(error)return toast(error.message,true);toast('تم تسجيل القرار');return renderCourt();
  }
  if(b.dataset.action==='cancel-warning'){
   const reason=prompt('اذكر سبب إلغاء الإنذار بالتفصيل:');if(!reason)return;
   const {error}=await db.rpc('asf_cancel_warning',{p_warning:b.dataset.id,p_reason:reason});
   if(error)return toast(error.message,true);toast('تم إلغاء الإنذار وتسجيل العملية');return renderCourt();
  }
 };
 const filterWarnings=()=>{
  const text=String($('#warningSearch').value||'').trim().toLowerCase(),scope=$('#warningScope').value;
  const matches=warnings.filter(w=>{const state=window.ASF_WORKFLOW.warningState(w);return(scope==='all'||(scope==='archive'?state.archived:!state.archived))&&[w.player_name,w.player_discord_id,w.player_code,w.player_rank,w.offense,w.punishment].some(z=>String(z||'').toLowerCase().includes(text))});
  set('#warningRows',matches.map(w=>courtWarningCard(w)).join('')||empty('لا توجد نتائج'));
 };
 $('#warningSearch').oninput=filterWarnings;$('#warningScope').onchange=filterWarnings;filterWarnings();
 $('#warningLookupForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),full=String(f.get('player')||'').trim(),discord=String(f.get('discord')||'').trim();
  if(!isFullName(full)||!/^[0-9]{15,22}$/.test(discord))return toast('أدخل الاسم والكنية ومعرّف Discord الرقمي.',true);
  const same=window.ASF_POLICE_UI.norm(full);const found=warnings.filter(w=>!window.ASF_WORKFLOW.warningState(w).archived&&w.player_discord_id===discord&&window.ASF_POLICE_UI.norm(w.player_name)===same);
  set('#warningLookupResult','<p class="muted">'+found.length+' إنذار نشط مطابق</p>'+ (found.map(w=>courtWarningCard(w)).join('')||empty('لا توجد إنذارات نشطة مطابقة.')));
 };
 $('#warningForm').onsubmit=async e=>{
  e.preventDefault();const f=new FormData(e.target);
  if(!isFullName(f.get('player_name')))return toast('اكتب اسم العسكري والكنية، ولا تستخدم اسمًا واحدًا.',true);
  const discord=String(f.get('player_discord_id')||'').trim();if(!/^[0-9]{15,22}$/.test(discord))return toast('معرّف Discord غير صحيح.',true);
  const row={recorded_by:user.id,player_name:String(f.get('player_name')).trim(),player_discord_id:discord||null,player_rank:String(f.get('player_rank')).trim(),player_code:String(f.get('player_code')).trim(),warning_level:f.get('warning_level'),
   offense:String(f.get('offense')).trim(),punishment:String(f.get('punishment')).trim(),duration_days:f.get('duration_days')===''?null:Number(f.get('duration_days')),case_id:f.get('case_id')||null};
  const {error}=await db.from('asf_court_warnings').insert(row);if(error)return toast(error.message,true);
  toast('تم تثبيت الإنذار');return renderCourt();
 };
}
function courtWarningCard(w){
 const state=window.ASF_WORKFLOW.warningState(w);
 return '<div class="section-card"><div class="row between"><b>'+esc(w.player_name)+' — '+esc(w.player_rank)+'</b>'+badge(state.label)+'</div>'+
 '<p class="muted">'+esc(w.player_code||'بدون كود')+(w.player_discord_id?' · Discord: '+esc(w.player_discord_id):'')+' · '+date(w.recorded_at)+' · '+esc(w.warning_level)+'</p>'+
 '<p><b>المخالفة:</b> '+esc(w.offense)+'</p><p><b>العقوبة:</b> '+esc(w.punishment)+'</p>'+
 (state.expiresAt?'<p class="muted">نهاية المدة: '+date(state.expiresAt)+'</p>':'')+
 (w.cancelled_at?'<p class="muted">أُلغي بتاريخ '+date(w.cancelled_at)+'؛ السبب: '+esc(w.cancellation_reason)+'</p>':state.archived?'':btn('إلغاء الإنذار','cancel-warning',w.id,'warn'))+'</div>';
}
async function renderMembers(){
 const rows=await query('asf_profiles');rows.sort((a,b)=>a.created_at<b.created_at?1:-1);
 const hasReason=p=>String(p.activation_reason||'').trim().length>=10;
 const admission=p=>p.status==='pending'&&(commander||has('users.approve'))?(hasReason(p)?btn('تفعيل','approve',p.user_id,'primary'):'<span class="activation-missing">بانتظار سبب التفعيل</span>')+btn('رفض','reject',p.user_id,'warn'):'—';
 const actions=p=>!commander?admission(p):'<div class="actions">'+(p.status!=='approved'?(hasReason(p)?btn('تفعيل','approve',p.user_id,'primary'):'<span class="activation-missing">بانتظار سبب التفعيل</span>'):btn('إيقاف','suspend',p.user_id,'warn'))+
 btn('تغيير الرتبة','rank',p.user_id)+btn(p.court_enabled?'إلغاء القضاء':'تفعيل القضاء',p.court_enabled?'court_off':'court_on',p.user_id)+btn('رفض','reject',p.user_id,'warn')+'</div>';
 set('#page','<div class="section-card"><h3>طلبات التفعيل وجميع الأعضاء</h3><p class="muted">سبب طلب التفعيل إلزامي. لن يسمح النظام باعتماد أي حساب غير معتمد لم يقدّم سببًا واضحًا.</p><div class="table-wrap"><table><thead><tr><th>الاسم</th><th>الرتبة</th><th>الكود</th><th>Discord ID</th><th>سبب طلب التفعيل</th><th>الحالة</th><th>إجراءات القائد</th></tr></thead><tbody>'+
 rows.map(p=>'<tr><td>'+esc(p.game_name)+'</td><td>'+esc(p.rank)+'</td><td>'+esc(p.military_code||'—')+'</td><td dir="ltr">'+esc(p.discord_id)+'</td><td><div class="member-reason">'+(hasReason(p)?esc(p.activation_reason):'<span class="activation-missing">لم يُذكر السبب</span>')+'</div></td><td>'+badge(p.status)+'</td><td>'+actions(p)+'</td></tr>').join('')+'</tbody></table></div></div>');
 $('#page').onclick=async e=>{if(!commander&&!has('users.approve'))return;const b=e.target.closest('button[data-action]');if(!b)return;const action=b.dataset.action;
 let arg=null;if(action==='rank'){arg=prompt('الرتبة الجديدة (من القائمة المعتمدة):',rows.find(r=>r.user_id===b.dataset.id)?.rank||'');if(!arg||!RANKS.includes(arg))return toast('الرتبة غير معتمدة',true);}
 if(['reject','suspend'].includes(action)&&!confirm('تأكيد الإجراء على الحساب؟'))return;
 const {data,error}=await db.rpc('asf_admin_action',{op:action,target:b.dataset.id,arg});if(error)return toast(error.message,true);
 toast(action==='approve'?'تم تفعيل الحساب والكود: '+data:'تم حفظ التغيير');renderMembers();};
}
async function renderChanges(){
 const rows=await query('asf_change_requests');
 set('#page','<div class="section-card"><h3>طلبات تعديل الاسم ومعرّف ديسكورد</h3><div class="table-wrap"><table><thead><tr><th>صاحب الطلب</th><th>الاسم الجديد</th><th>Discord ID</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>'+
 rows.map(r=>'<tr><td>'+esc(r.user_id)+'</td><td>'+esc(r.new_game_name)+'</td><td dir="ltr">'+esc(r.new_discord_id)+'</td><td>'+badge(r.state)+'</td><td>'+(r.state==='pending'&&commander?btn('موافقة','allow',r.id,'primary')+btn('رفض','deny',r.id,'warn'):'—')+'</td></tr>').join('')+'</tbody></table></div></div>');
 $('#page').onclick=async e=>{if(!commander)return;const b=e.target.closest('[data-action]');if(!b)return;const {error}=await db.rpc('asf_review_change',{req:b.dataset.id,allow_change:b.dataset.action==='allow'});if(error)return toast(error.message,true);toast('تمت معالجة الطلب');renderChanges()};
}
async function renderAudit(){
 if(!commander)return set('#page',empty('سجل العمليات مخصص للقائد فقط.'));
 const {data:logs,error}=await db.from('asf_audit').select('*').order('created_at',{ascending:false}).limit(200);
 if(error)throw error;
 const actorIds=[...new Set((logs||[]).map(x=>x.actor_id).filter(Boolean))];
 const {data:users}=actorIds.length?await db.from('asf_profiles').select('user_id,game_name,military_code').in('user_id',actorIds):{data:[]};
 const actors=new Map((users||[]).map(p=>[p.user_id,p]));
 const names={approve:'تفعيل عضو',suspend:'إيقاف عضو',reject:'رفض عضو',rank:'تعديل رتبة',court_on:'منح القضاء',court_off:'سحب القضاء',
 delegation:'تعديل صلاحية',review:'مراجعة تقرير',restore:'استعادة تقرير',trash:'حذف إلى السلة',
 access_requested:'طلب تصريح',access_reviewed:'قرار تصريح',police_rule_override:'تعديل عقوبة',court_warning_cancel:'إلغاء إنذار',pdf_finalized:'تأكيد ملف PDF',permanent_delete:'حذف نهائي تلقائي',profile_change:'تعديل بيانات',academy_delivered:'تأكيد تسليم دورة',activation_reason_submitted:'استكمال سبب التفعيل',commander_profile_init:'ملف القائد'};
 set('#page','<section class="section-card"><h3>سجل الإجراءات الإدارية</h3>'+
 '<p>يُعرض للقائد فقط، ويحتفظ بتاريخ التعديلات دون منح صلاحية حذف السجل.</p>'+
 '<input id="auditSearch" placeholder="بحث بالعملية أو المستخدم أو السجل" style="margin-bottom:15px">'+
 '<div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>المسؤول</th><th>الإجراء</th><th>المرجع</th></tr></thead><tbody id="auditRows"></tbody></table></div></section>');
 const paint=()=>{
  const q=$('#auditSearch').value.toLowerCase().trim();
  const shown=(logs||[]).filter(x=>{
   const actor=actors.get(x.actor_id);
   return [x.action,names[x.action],x.target_id,actor?.game_name,actor?.military_code].some(v=>String(v||'').toLowerCase().includes(q));
  });
  set('#auditRows',shown.map(x=>{
   const a=actors.get(x.actor_id);
   return '<tr><td>'+date(x.created_at)+'</td><td>'+esc(x.actor_id?a?.game_name||'حساب مؤرشف':'النظام تلقائيًا')+'</td><td>'+esc(names[x.action]||x.action)+'</td><td title="'+esc(x.target_id)+'">'+esc(String(x.target_id).slice(0,36))+'</td></tr>';
  }).join('')||'<tr><td colspan="4">لا توجد عمليات مطابقة</td></tr>');
 };
 $('#auditSearch').oninput=paint;paint();
}
async function renderDelegations(){
 if(!commander)return set('#page',empty('التفويضات مخصصة للقائد فقط.'));
 const [people,existing,responsibilities]=await Promise.all([query('asf_profiles'),query('asf_delegations'),query('asf_responsibilities')]);
 const rights=[...existing,...responsibilities];
 const eligible=people.filter(p=>p.status==='approved'&&p.user_id!==user.id);
 set('#page','<div class="notice danger-note">التقارير «سري للغاية» حصرية للقائد. لا يوجد تفويض يمنح قراءتها أو تنزيل ملفاتها.</div><section class="section-card"><h3>توزيع المسؤوليات والصلاحيات</h3><p class="muted">اختر شخصًا أو عدة أشخاص، وحدد مسؤولياتهم بشكل مستقل. تفعيل الحساب أولًا شرط لمنحه تفويضًا.</p><form id="grantsForm"><fieldset class="delegation-fieldset"><legend>الأعضاء المعتمدون</legend><div class="delegation-choices">'+(eligible.map(p=>'<label class="delegation-choice"><input type="checkbox" name="users" value="'+esc(p.user_id)+'"><span>'+esc(p.game_name)+'<small>'+esc(p.military_code||p.rank)+'</small></span></label>').join('')||empty('لا يوجد أعضاء معتمدون آخرون بعد.'))+'</div></fieldset><fieldset class="delegation-fieldset"><legend>المسؤوليات المستقلة</legend><div class="delegation-choices">'+Object.entries(ACCESS_PERMISSIONS).map(([key,label])=>'<label class="delegation-choice"><input type="checkbox" name="features" value="'+esc(key)+'"><span>'+esc(label)+'<small>'+esc(ACCESS_HINTS[key]||'')+'</small></span></label>').join('')+'</div></fieldset><label>تصنيف التقارير<select name="kind" id="delegationReportKind">'+opt([['','جميع التقارير غير السرية'],...Object.entries(KINDS).filter(([k])=>k!=='secret')])+'</select></label><p class="muted">التصنيف يخص صلاحيات قراءة ومراجعة التقارير فقط.</p><div class="row"><button type="submit" class="btn primary" name="enable" value="true">منح المحدد</button><button type="submit" class="btn warn" name="enable" value="false">سحب المحدد</button></div></form></section><section class="section-card"><h3>التفويضات الحالية</h3><div class="table-wrap"><table><thead><tr><th>العضو</th><th>المسؤولية</th><th>التصنيف</th></tr></thead><tbody>'+rights.map(r=>'<tr><td>'+esc(people.find(p=>p.user_id===r.user_id)?.game_name||r.user_id)+'</td><td>'+esc(ACCESS_PERMISSIONS[r.permission]||r.permission)+'</td><td>'+esc(['reports.read','reports.review'].includes(r.permission)?KINDS[r.report_kind]||'جميع التقارير غير السرية':'تفويض مستقل')+'</td></tr>').join('')+'</tbody></table></div></section>');
 const form=$('#grantsForm');let enable=true;
 form.querySelectorAll('button[type="submit"]').forEach(button=>button.onclick=()=>enable=button.value==='true');
 form.onsubmit=async e=>{
  e.preventDefault();const f=new FormData(form),users=f.getAll('users'),features=f.getAll('features');
  if(!users.length||!features.length)return toast('اختر الأعضاء والمسؤوليات المطلوبة أولًا.',true);
  const buttons=form.querySelectorAll('button[type="submit"]');buttons.forEach(b=>b.disabled=true);
  try{const {error}=await db.rpc('asf_set_delegations',{p_users:users,p_features:features,p_kind:f.get('kind')||null,p_enabled:enable});if(error)throw error;toast('تم تحديث المسؤوليات المحددة');await loadIdentity(true);}
  catch(err){toast(err.message,true);buttons.forEach(b=>b.disabled=false);}
 };
}

async function renderAccessRequests(){
 const {data:rows,error}=await db.from('asf_access_requests').select('*').order('created_at',{ascending:false}).limit(80);
 if(error)throw error;
 const options=Object.entries(ACCESS_PERMISSIONS).filter(([feature])=>!['users.approve','academy.manage'].includes(feature)).map(([feature,label])=>
  '<option value="'+esc(feature)+'">'+esc(label)+'</option>').join('');
 const form=commander
 ? '<div class="notice">حساب القائد يراجع جميع طلبات الأعضاء من صفحة «مراجعة طلبات التصاريح».</div><button class="btn primary" id="openAccessQueue" type="button">فتح طلبات الأعضاء</button>'
 : '<form id="accessRequestForm" class="access-request-form"><label>الصلاحية المطلوبة<select id="accessPermission" name="permission" required>'+options+'</select></label>'+
   '<p id="accessPermissionHint" class="muted"></p>'+
   '<label>سبب طلب التصريح<textarea name="reason" rows="3" required minlength="8" maxlength="400" placeholder="اذكر سبب الحاجة إلى الصلاحية والمهام التي ستستخدمها فيها."></textarea></label>'+
   '<div class="row between access-actions"><small class="muted">الحد الأقصى 3 طلبات خلال 24 ساعة. الطلب لا يمنح أي صلاحية قبل موافقة القائد.</small><button class="btn primary" id="sendAccessRequest" type="submit">إرسال الطلب للقائد</button></div></form>';
 set('#page','<div class="access-workflow"><section class="section-card"><div class="access-heading"><span class="eyebrow">طلبات الصلاحيات</span><h3>طلب تصريح جديد</h3><p>تقدر تطلب الصلاحيات الإدارية المطلوبة، والقرار للقائد فقط. «سري للغاية» لا يمكن تفويضه لأي شخص.</p></div>'+form+'</section>'+
 '<section class="section-card"><h3>سجل طلباتي</h3><div class="access-request-list">'+
 ((rows||[]).map(r=>'<article class="access-request-item"><div class="row between"><strong>'+esc(ACCESS_PERMISSIONS[r.permission]||r.permission)+'</strong><span class="access-state access-state-'+esc(r.status)+'">'+esc(ACCESS_STATES[r.status]||r.status)+'</span></div>'+
 '<p>'+esc(r.reason)+'</p><small class="muted">تاريخ الطلب: '+date(r.created_at)+'</small>'+
 (r.reviewed_at?'<div class="access-review-note">القرار بتاريخ '+date(r.reviewed_at)+(r.decision_note?' — '+esc(r.decision_note):'')+'</div>':'')+'</article>').join('')||empty('ما أرسلت أي طلب تصريح بعد.'))+'</div></section></div>');
 if(commander){$('#openAccessQueue').onclick=()=>navigate('access-queue');return}
 const select=$('#accessPermission'),hint=$('#accessPermissionHint'),formElement=$('#accessRequestForm');
 if(accessPrefill && ACCESS_PERMISSIONS[accessPrefill])select.value=accessPrefill;
 accessPrefill='';
 const updateHint=()=>{hint.textContent=ACCESS_HINTS[select.value]||''};
 select.onchange=updateHint;updateHint();
 formElement.onsubmit=async e=>{
  e.preventDefault();
  const submit=$('#sendAccessRequest');
  const formData=new FormData(formElement);
  const p_permission=String(formData.get('permission')||'');
  const p_reason=String(formData.get('reason')||'').trim();
  if(!ACCESS_PERMISSIONS[p_permission]||p_reason.length<8||p_reason.length>400)
   return toast('حدد الصلاحية وأدخل سببًا من 8 إلى 400 حرف.',true);
  submit.disabled=true;
  try{
   const {error:err}=await db.rpc('asf_request_access',{p_permission,p_reason});
   if(err)throw err;
   toast('تم إرسال طلب التصريح للقائد، ويمكنك متابعة حالته هنا.');
   await renderAccessRequests();
  }catch(err){toast('تعذر إرسال الطلب: '+(err.message||'خطأ غير معروف'),true)}
  finally{if(submit.isConnected)submit.disabled=false}
 };
}
async function renderAccessQueue(){
 if(!commander)return set('#page',empty('مراجعة طلبات التصاريح خاصة بالقائد فقط.'));
 const [requestResult,profileResult]=await Promise.all([
  db.from('asf_access_requests').select('*').order('created_at',{ascending:false}).limit(200),
  db.from('asf_profiles').select('user_id,game_name,rank,military_code')
 ]);
 if(requestResult.error||profileResult.error)throw requestResult.error||profileResult.error;
 const people=new Map((profileResult.data||[]).map(p=>[p.user_id,p]));
 const requests=requestResult.data||[];
 requests.sort((a,b)=>Number(b.status==='pending')-Number(a.status==='pending') ||
  new Date(b.created_at)-new Date(a.created_at));
 const pending=requests.filter(r=>r.status==='pending').length;
 set('#page','<div class="access-workflow"><section class="section-card"><div class="access-heading"><span class="eyebrow">قيادة أمن المنشآت</span><h3>طلبات التصاريح '+badge(String(pending)+' بانتظار القرار')+'</h3><p>لا يُمنح أي تفويض حتى توافق عليه بنفسك. الموافقة تسجَّل وتُرسل للعضو إشعارًا، و«سري للغاية» تبقى للقائد فقط.</p></div></section>'+
 '<section class="access-request-list">'+
 (requests.map(r=>{
  const p=people.get(r.user_id);
  return '<article class="section-card access-request-item"><div class="row between"><div><strong>'+esc(p?.game_name||'عضو')+' <small class="muted">'+esc(p?.military_code||'')+'</small></strong><p>'+esc(ACCESS_PERMISSIONS[r.permission]||r.permission)+'</p></div><span class="access-state access-state-'+esc(r.status)+'">'+esc(ACCESS_STATES[r.status]||r.status)+'</span></div>'+
   '<p class="access-reason">'+esc(r.reason)+'</p><small class="muted">تاريخ الطلب: '+date(r.created_at)+'</small>'+
   (r.status==='pending'?'<form class="access-decision-form" data-access-request="'+esc(r.id)+'"><label>ملاحظة القرار (اختياري)<input type="text" name="note" maxlength="400" placeholder="توضيح يُرسل لصاحب الطلب"></label><div class="row"><button class="btn primary" type="submit" name="decision" value="approve">الموافقة ومنح التصريح</button><button class="btn warn" type="submit" name="decision" value="reject">رفض الطلب</button></div></form>':
   '<div class="access-review-note">تمت المراجعة '+date(r.reviewed_at)+(r.decision_note?' — '+esc(r.decision_note):'')+'</div>')+'</article>';
 }).join('')||empty('لا توجد طلبات تصاريح.'))+'</section></div>');
 $('#page').querySelectorAll('.access-decision-form').forEach(form=>{
  form.onsubmit=async e=>{
   e.preventDefault();
   if(!commander)return;
   const p_allow=e.submitter?.value==='approve',p_request=form.dataset.accessRequest,p_note=String(new FormData(form).get('note')||'').trim();
   if(p_allow&&!confirm('الموافقة ستمنح هذه الصلاحية للعضو. هل تؤكد؟'))return;
   form.querySelectorAll('button').forEach(b=>b.disabled=true);
   try{
    const {error:err}=await db.rpc('asf_review_access_request',{p_request,p_allow,p_note});
    if(err)throw err;
    toast(p_allow?'تمت الموافقة ومنح التصريح وإشعار العضو.':'تم رفض الطلب وإشعار العضو.');
    await renderAccessQueue();
   }catch(err){toast('تعذر معالجة الطلب: '+(err.message||'خطأ غير معروف'),true);
    form.querySelectorAll('button').forEach(b=>b.disabled=false);}
  };
 });
}

function renderAccount(){
 if(!profile && commander){
  set('#page','<div class="section-card"><h3>إكمال الملف العسكري للقائد</h3><p class="muted">حساب القيادة مرتبط ببريدك المؤكد. لإصدار كود ASF العسكري وتفعيل إمكانية إرسال التقارير، أدخل بيانات شخصيتك داخل اللعبة مرة واحدة.</p><form id="leaderSetup"><label>اسمك داخل اللعبة<input name="game_name" required minlength="2" maxlength="80"></label><label>Discord User ID<input name="discord_id" required pattern="[0-9]{17,20}" inputmode="numeric" dir="ltr"></label><label>الرتبة<select name="rank">'+opt(RANKS.map(r=>[r,r]))+'</select></label><button class="btn primary">اعتماد ملف القائد وإصدار الكود العسكري</button></form></div>');
  $('#leaderSetup').onsubmit=async e=>{
   e.preventDefault();let f=new FormData(e.currentTarget);
   const fullName=String(f.get('game_name')).trim();if(!isFullName(fullName))return toast('يجب إدخال الاسم والكنية، لا يُقبل الاسم المفرد.',true);
   const {data,error}=await db.rpc('asf_commander_profile_setup',{p_name:fullName,p_discord:String(f.get('discord_id')).trim(),p_rank:f.get('rank')});
   if(error)return toast(error.message,true);toast('تم إنشاء الملف العسكري للقائد: '+data);await loadIdentity(true);
  };return;
 }
 if(!profile)return set('#page',empty('الملف العسكري غير موجود.'));
 set('#page','<div class="grid two"><div class="section-card"><h3>بطاقتي الرقمية</h3><p>الاسم: <b>'+esc(profile.game_name)+'</b></p><p>الرتبة: <b>'+esc(profile.rank)+'</b></p><p>الكود العسكري: <b>'+esc(profile.military_code||'—')+'</b></p><p>Discord ID: <b dir="ltr">'+esc(profile.discord_id)+'</b></p><p>حالة الحساب: '+badge(profile.status)+'</p></div>'+
 '<div class="section-card"><h3>طلب تعديل بيانات</h3><p>طلب تغيير الاسم أو Discord ID يخضع لموافقة القائد، ولا يؤثر على البيانات الحالية قبل قبول الطلب.</p><form id="changeForm">'+input('name','الاسم الجديد',profile.game_name)+input('discord','معرّف Discord الجديد',profile.discord_id)+'<button type="submit" class="btn primary">إرسال طلب التعديل</button></form></div></div>');
 $('#changeForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);
 const fullName=String(f.get('name')).trim();if(!isFullName(fullName))return toast('اكتب الاسم والكنية في طلب التعديل.',true);
 const {error}=await db.from('asf_change_requests').insert({user_id:user.id,new_game_name:fullName,new_discord_id:String(f.get('discord')).trim()});
 if(error)return toast(error.message,true);toast('تم إرسال طلب التعديل إلى القائد');};
}

init();
})();
