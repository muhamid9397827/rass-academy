/* بوابة أمن المنشآت — MVP. Data access always enforced by Supabase RLS. */
(() => {
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KINDS={personnel:'تقرير مسؤول الأفراد',officers:'تقرير مسؤول الضباط',joint:'تقرير مشترك للأفراد والضباط',presidencies:'تقرير مسؤولي الرئاسات',secret:'سري للغاية — للقائد فقط'};
const STATES={new:'جديد',reviewing:'قيد المراجعة',reviewed:'تمت المراجعة',needs_more:'يحتاج استكمال'};

const ACCESS_PERMISSIONS={
 'court.manage':'إدارة مجلس القضاء',
 'police.manage':'إدارة إجراءات الشرطة العسكرية',
 'reports.read':'الاطلاع على التقارير العادية',
 'reports.review':'مراجعة التقارير العادية',
 'users.review':'الاطلاع على طلبات الأعضاء'
};
const ACCESS_HINTS={
 'court.manage':'القضايا والقرارات القضائية، بعد تصريح القيادة فقط.',
 'police.manage':'تعديل العقوبات المقترحة داخل قسم الشرطة العسكرية.',
 'reports.read':'التقارير غير السرية فقط؛ لا يشمل تقارير «سري للغاية».',
 'reports.review':'إضافة ملاحظات ومراجعة التقارير غير السرية فقط.',
 'users.review':'الاطلاع على طلبات الأعضاء وتعديل البيانات دون صلاحية اعتماد الحسابات.'
};
const ACCESS_STATES={pending:'قيد المراجعة',approved:'موافق عليه',rejected:'مرفوض'};
let accessPrefill='court.manage';

const RANKS=['جندي','جندي أول','عريف','وكيل رقيب','رقيب','رقيب أول','رئيس رقباء','ملازم','ملازم أول','نقيب','رائد','مقدم','عقيد','عميد','لواء','فريق','فريق أول'];
const cfg=window.ASF_CONFIG||{}, ready=!!(cfg.supabaseUrl&&cfg.supabaseAnonKey&&window.supabase);
const PORTAL_AUTH_REDIRECT='https://muhamid9397827.github.io/rass-academy/portal/';
// Snapshot the recovery intent BEFORE Supabase processes and removes the URL fragment.
const recoveryHash=new URLSearchParams(window.location.hash.replace(/^#/,'')),
      recoveryQuery=new URLSearchParams(window.location.search);
const recoveryTokenHash=recoveryHash.get('token_hash')||recoveryQuery.get('token_hash');
const recoveryLinkOpened=recoveryHash.get('type')==='recovery'||recoveryQuery.get('type')==='recovery';
let db=ready?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
let user=null, profile=null, commander=false, grants=[], pageName='dashboard', draftId=null, latestReports=[], correctionSource=null, notificationChannel=null;
const toast=(m,error=false)=>{const b=$('#toast');b.textContent=m;b.className='show'+(error?' error':'');clearTimeout(toast.t);toast.t=setTimeout(()=>b.className='',5800)};
const set=(s,html)=>{$(s).innerHTML=html};
const date=d=>d?new Date(d).toLocaleString('ar-SA',{dateStyle:'short',timeStyle:'short'}):'—';
const code=n=>'RPT-'+String(n).padStart(6,'0');
const opt=(items,selected)=>items.map(([k,v])=>'<option value="'+esc(k)+'"'+(k===selected?' selected':'')+'>'+esc(v)+'</option>').join('');
const input=(name,label,value='',type='text')=>'<label>'+esc(label)+'<input name="'+esc(name)+'" type="'+type+'" value="'+esc(value)+'"></label>';
const btn=(label,act,id='',kind='ghost')=>'<button class="btn '+kind+' small" data-action="'+esc(act)+'" data-id="'+esc(id)+'">'+esc(label)+'</button>';
const badge=(s,secret=false)=>'<span class="badge '+(secret?'secret':'')+'">'+esc(s)+'</span>';
const empty=msg=>'<div class="empty">'+esc(msg)+'</div>';
const has=(permission,kind=null)=>commander||grants.some(g=>g.permission===permission&&(kind===null||g.report_kind===null||g.report_kind===kind));
function showScreen(which){['welcome','authScreen','verifyEmailScreen','recoveryScreen','pendingScreen','workspace'].forEach(id=>$('#'+id).hidden=id!==which)}
function openAcademy(){window.open('academy.html','_blank','noopener')}
$('#openAcademy').onclick=openAcademy;
const restrictedModal=$('#restrictedModal');
function showRestricted(section){
 accessPrefill=section.includes('القضاء')?'court.manage':'police.manage';
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
function authForm(mode){registering=mode==='register';showScreen('authScreen');$('#authTitle').textContent=registering?'إنشاء حساب جديد':'تسجيل الدخول';$('#registerFields').hidden=!registering;$('#authSubmit').textContent=registering?'إرسال طلب إنشاء حساب':'تسجيل الدخول';$('#authToggle').textContent=registering?'لديك حساب بالفعل؟ تسجيل الدخول':'ليس لديك حساب؟ إنشاء حساب';$('#forgotPassword').hidden=registering;['gameName','discordId','rank'].forEach(id=>$('#'+id).required=registering);}
$('#showLogin').onclick=()=>authForm('login');$('#showRegister').onclick=()=>authForm('register');
$('#authToggle').onclick=()=>authForm(registering?'login':'register');
$('#forgotPassword').onclick=async()=>{
 if(!ready)return toast('ربط قاعدة البيانات غير متاح',true);
 const email=$('#email').value.trim();if(!email)return toast('أدخل بريدك الإلكتروني أولًا',true);
 const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:PORTAL_AUTH_REDIRECT});
 toast(error?'تعذر إرسال رابط الاستعادة: '+error.message:'إذا كان البريد مسجلًا، سيتم إرسال رابط استعادة كلمة المرور.',!!error);
};$('#authBack').onclick=()=>showScreen('welcome');
$('#verifyEmailLogin').onclick=()=>authForm('login');
$('#verifyEmailBack').onclick=()=>showScreen('welcome');
$('#rank').innerHTML=opt(RANKS.map(r=>[r,r]));
$('#signOut').onclick=async()=>{if(db)await db.auth.signOut();user=null;profile=null;commander=false;grants=[];showScreen('welcome');$('#signOut').hidden=true;$('#sessionLabel').textContent='';};
$('#refreshProfile').onclick=()=>loadIdentity(true);
$('#authForm').onsubmit=async e=>{
 e.preventDefault();if(!ready)return toast('يلزم إعداد Supabase أولًا. الدورات العامة متاحة.',true);
 const email=$('#email').value.trim(),password=$('#password').value;
 $('#authSubmit').disabled=true;
 try{
  if(registering){
    const game_name=$('#gameName').value.trim(),discord_id=$('#discordId').value.trim(),rank=$('#rank').value;
    if(!/^[0-9]{17,20}$/.test(discord_id))throw Error('معرّف Discord يجب أن يكون رقميًا من 17 إلى 20 خانة.');
    const {data,error}=await db.auth.signUp({email,password,options:{emailRedirectTo:PORTAL_AUTH_REDIRECT,data:{asf_portal:'true',game_name,discord_id,rank}}});
    if(error)throw error;
    if(!data?.session){
      // With email confirmation enabled Supabase returns a user but NO session.
      // Never call getUser() or loadIdentity() before email verification/sign-in.
      $('#verifyEmailMessage').textContent='إذا قُبل طلب التسجيل، ستصلك رسالة على بريدك الإلكتروني لتأكيد الحساب. افتحها، ثم ارجع لتسجيل الدخول.';
      $('#password').value='';
      showScreen('verifyEmailScreen');
      return;
    }
    await loadIdentity();
  }else{
    const {data,error}=await db.auth.signInWithPassword({email,password});
    if(error){
      const message=String(error.message||'');
      if(/email not confirmed/i.test(message))throw Error('بريدك الإلكتروني لم يتم تأكيده بعد. افتح رسالة التأكيد، ثم عد لتسجيل الدخول.');
      if(/invalid login credentials/i.test(message))throw Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      throw error;
    }
    if(!data?.session)throw Error('تعذر إنشاء جلسة الدخول. حاول مجددًا.');
    await loadIdentity();
  }
 }catch(err){toast(err.message||'تعذر تنفيذ العملية',true)}
 finally{$('#authSubmit').disabled=false}
};
async function init(){
 if(!ready){showScreen('welcome');toast('البوابة بحاجة لربط قاعدة البيانات لتفعيل الحسابات.',true);return}
 // Subscribe before checking the session: Supabase may complete the recovery redirect immediately.
 db.auth.onAuthStateChange((event,session)=>{
  if(event==='PASSWORD_RECOVERY'){
   recoveryMode=true;
   showRecoveryScreen();
   return;
  }
  if(event==='SIGNED_OUT'){
   user=null;commander=false;profile=null;grants=[];
   if(notificationChannel){db.removeChannel(notificationChannel);notificationChannel=null;}
   if(!recoveryMode)showScreen('welcome');
  }
 });
 try{
  // For commander recovery links sent through Resend without Supabase's SMTP.
  // Token hashes are one-use; clear the URL before exchanging for an Auth session.
  if(recoveryTokenHash && recoveryLinkOpened){
   window.history.replaceState(null,'',window.location.pathname);
   recoveryMode=true;
   showRecoveryScreen();
   const {data:recovered,error:verifyError}=await db.auth.verifyOtp({
    type:'recovery',token_hash:recoveryTokenHash
   });
   if(verifyError || !recovered?.user){
    $('#recoveryStatus').textContent='رابط الاستعادة منتهي الصلاحية أو مستخدم من قبل. اطلب رابطًا جديدًا.';
    $('#recoveryForm').hidden=true;
   }
   return;
  }
  const {data,error}=await db.auth.getUser();
  if(recoveryMode){
   showRecoveryScreen();
   if(error||!data?.user){
    $('#recoveryStatus').textContent='انتهت صلاحية رابط الاستعادة أو تعذر التحقق منه. ارجع إلى تسجيل الدخول واطلب رابطًا جديدًا.';
    $('#recoveryForm').hidden=true;
   }
   return;
  }
  if(data?.user){user=data.user;await loadIdentity()}else showScreen('welcome');
 }catch(err){
  showScreen(recoveryMode?'recoveryScreen':'welcome');
  toast('تعذر التحقق من جلسة تسجيل الدخول.',true);
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
async function loadIdentity(silent=false){
 if(!ready)return;
 try{
  const {data:{user:u},error:ue}=await db.auth.getUser();if(ue)throw ue;
  if(!u){showScreen('welcome');return}user=u;
  const [{data:p,error:pe},{data:cm,error:ce},{data:dg,error:de}]=await Promise.all([
    db.from('asf_profiles').select('*').eq('user_id',user.id).maybeSingle(),
    db.rpc('asf_is_commander'),
    db.from('asf_delegations').select('*').eq('user_id',user.id)
  ]);
  if(pe||ce||de)throw pe||ce||de;
  profile=p;commander=!!cm;grants=dg||[];
  if(!notificationChannel){
    // All signed-in members can receive their own decision notices. RLS stays authoritative.
    notificationChannel=db.channel('asf-notices-'+user.id)
     .on('postgres_changes',{event:'INSERT',schema:'public',table:'asf_notifications',filter:'recipient_id=eq.'+user.id},
      payload=>{
       const notice=payload.new||{};
       toast(notice.message||'وصل إشعار جديد');
       if(notice.category==='access_decision'){
        loadIdentity(true).catch(err=>toast(err.message,true));
        return;
       }
       if(commander){
        if(pageName==='dashboard')renderDashboard().catch(err=>toast(err.message,true));
        if(pageName==='inbox')renderReports('inbox').catch(err=>toast(err.message,true));
        if(pageName==='members'&&notice.category==='registration')renderMembers().catch(err=>toast(err.message,true));
        if(pageName==='access-queue'&&notice.category==='access_request')renderAccessQueue().catch(err=>toast(err.message,true));
       }
      }).subscribe();
  }
  $('#sessionLabel').textContent=p?.game_name||user.email;$('#signOut').hidden=false;
  if(commander||p?.status==='approved'){
   showScreen('workspace');$('#courtNav').hidden=!(commander||p?.court_enabled||has('court.manage'));
   $('#adminNav').hidden=!(commander||has('reports.read')||has('reports.review')||has('users.review'));
   document.querySelectorAll('[data-page="members"],[data-page="changes"]').forEach(n=>n.hidden=!(commander||has('users.review')));
   document.querySelectorAll('[data-page="delegations"],[data-page="trash"],[data-page="audit"]').forEach(n=>n.hidden=!commander);
   document.querySelector('[data-page="inbox"]').hidden=!(commander||has('reports.read')||has('reports.review'));
   document.querySelector('[data-page="access-queue"]').hidden=!commander;
   await navigate(pageName);
  }else{
   showScreen('pendingScreen');$('#pendingText').textContent=p?.status==='rejected'?'تم رفض الطلب. تواصل مع الإدارة.':p?.status==='suspended'?'الحساب موقوف حاليًا.':'الحساب بانتظار موافقة القائد. يمكنك دخول الدورات العامة من الصفحة الرئيسية.';
  }
  if(!silent)toast('تم تحديث حالة الحساب');
 }catch(err){toast('تعذر تحميل بيانات المستخدم: '+err.message,true);showScreen('welcome')}
}
document.querySelectorAll('.nav').forEach(n=>n.onclick=()=>navigate(n.dataset.page));
async function navigate(name){
 if(!user||!(commander||profile?.status==='approved'))return;
 pageName=name;document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.page===name));
 const titles={dashboard:'لوحة التحكم',academy:'الأكاديمية والدورات',reports:'تقاريري',compose:'إنشاء تقرير',police:'الشرطة العسكرية',court:'مجلس القضاء',inbox:'التقارير الواردة',members:'إدارة المستخدمين',changes:'طلبات تعديل البيانات',delegations:'تفويض القيادات',access:'طلب تصريح ومتابعته','access-queue':'طلبات التصاريح الواردة',trash:'سلة المحذوفات',audit:'سجل العمليات',account:'الملف الشخصي'};
 set('#pageTitle','<div><h1>'+esc(titles[name]||'بوابة أمن المنشآت')+'</h1><p>المنصة الموحدة · إعدادات الصلاحيات حسب حسابك</p></div>');
 set('#page','<div class="empty">جارٍ تحميل البيانات...</div>');
 try{
  if(name==='dashboard')return renderDashboard();
  if(name==='academy')return renderAcademy();
  if(name==='reports'||name==='inbox'||name==='trash')return renderReports(name);
  if(name==='compose')return renderCompose();
  if(name==='police')return renderPolice();
  if(name==='court')return renderCourt();
  if(name==='members'&&(commander||has('users.review')))return renderMembers();
  if(name==='changes'&&(commander||has('users.review')))return renderChanges();
  if(name==='delegations'&&commander)return renderDelegations();
  if(name==='access')return renderAccessRequests();
  if(name==='access-queue'&&commander)return renderAccessQueue();
  if(name==='audit'&&commander)return renderAudit();
  if(name==='account')return renderAccount();
  set('#page',empty('لا تملك صلاحية الوصول إلى هذا القسم.'));
 }catch(err){set('#page',empty('تعذر تحميل القسم: '+err.message));toast(err.message,true)}
}
async function renderDashboard(){
 const {data:rs,error}=await db.from('asf_reports').select('id,kind,submitted_at,deleted_at',{count:'exact'}).is('deleted_at',null).limit(100);
 if(error)throw error;
 const own=(rs||[]).filter(r=>r.kind!=='secret').length;
 const courtAllowed=commander||profile?.court_enabled||has('court.manage');
 const info=[
 ['الكود العسكري',profile?.military_code||'القائد'],['تقارير يمكن عرضها',String(rs?.length||0)],['مجلس القضاء',courtAllowed?'مسموح':'غير مفعل'],['الحساب','مفعل']
 ];
 const sectionCard=(id,icon,title,text,allowed=true,label='دخول القسم')=>'<button class="dashboard-card'+(allowed?'':' is-restricted')+'" data-section="'+id+'" type="button" aria-label="'+esc(title+(allowed?'':' — لا تملك صلاحية الدخول'))+'"><span class="dashboard-card__icon" aria-hidden="true">'+icon+'</span><span class="dashboard-card__body"><span class="dashboard-card__label">قسم البوابة</span><strong>'+esc(title)+'</strong><small>'+esc(text)+'</small></span>'+(allowed?'<span class="dashboard-card__action">'+esc(label)+' <b aria-hidden="true">←</b></span>':'<span class="restricted-overlay"><span class="lock-icon" aria-hidden="true">🔒</span><span class="restricted-badge">مقيّد</span><b>لا تملك صلاحية الدخول</b><small>يتطلب تصريحًا خاصًا</small></span>')+'</button>';
 set('#page','<section class="user-welcome"><div><span class="eyebrow">مرحبًا بعودتك</span><h2>'+esc(profile?.game_name||'قائد أمن المنشآت')+'</h2><p>يمكنك متابعة أعمالك والوصول إلى الأقسام المصرّح بها من لوحة التحكم.</p></div><div class="identity-chips"><span><small>الرتبة</small><b>'+esc(profile?.rank||'القيادة')+'</b></span><span><small>الكود العسكري</small><b dir="ltr">'+esc(profile?.military_code||'—')+'</b></span></div></section>'+
 '<div class="grid four dashboard-metrics">'+info.map(([k,v])=>'<div class="metric"><div class="caption">'+esc(k)+'</div><div class="n">'+esc(v)+'</div></div>').join('')+'</div>'+
 '<div class="section-intro"><div><span class="eyebrow">مساحة العمل</span><h2>أقسام البوابة</h2></div><p>اختر القسم المطلوب للمتابعة</p></div><div class="dashboard-sections">'+
 sectionCard('reports','▤','التقارير','إنشاء التقارير ومتابعة المراجعات')+
 sectionCard('court','⚖','مجلس القضاء','القضايا والقرارات والسجل القضائي',courtAllowed)+
 sectionCard('police','🛡','الشرطة العسكرية','اللوائح واحتساب العقوبات')+
 sectionCard('academy','🎓','الأكاديمية والتأهيل','الدورات والمسارات التدريبية')+'</div>');
 $('#page').querySelectorAll('.dashboard-card').forEach(card=>card.onclick=()=>{if(card.classList.contains('is-restricted'))showRestricted(card.querySelector('strong')?.textContent||'القسم');else navigate(card.dataset.section)});
 $('#page').insertAdjacentHTML('beforeend','<div class="access-shortcut"><div><strong>التصاريح والصلاحيات</strong><p>'+(commander?'راجع طلبات أعضاء القطاع واتخذ قرارك.':'تحتاج صلاحية إضافية؟ قدّم طلبًا إلى القائد وتابع الرد هنا.')+'</p></div><button type="button" class="btn ghost" id="accessDashboardShortcut">'+(commander?'مراجعة الطلبات':'طلب تصريح')+'</button></div>');
 $('#accessDashboardShortcut').onclick=()=>navigate(commander?'access-queue':'access');
 if(commander){
  const {data:notices,error:nerr}=await db.from('asf_notifications').select('*').order('created_at',{ascending:false}).limit(20);
  if(!nerr){
   const unread=(notices||[]).filter(n=>!n.read_at);
   $('#page').insertAdjacentHTML('beforeend','<section class="section-card" style="margin-top:18px"><div class="row between"><h3>إشعارات القائد '+badge(String(unread.length)+' غير مقروء')+'</h3><button class="btn ghost small" id="markAllRead">تعليم كمقروء</button></div>'+
   ((notices||[]).map(n=>'<div style="padding:10px;border-bottom:1px solid var(--line)">'+(n.read_at?'':'● ') +esc(n.message)+'<span class="muted" style="float:left">'+date(n.created_at)+'</span></div>').join('')||empty('لا توجد إشعارات'))+'</section>');
   $('#markAllRead').onclick=async()=>{const {error}=await db.from('asf_notifications').update({read_at:new Date().toISOString()}).is('read_at',null);if(error)return toast(error.message,true);toast('تم تعليم الإشعارات كمقروءة');renderDashboard();};
  }
 }
}
function renderAcademy(){
 const courses=Object.values(window.COURSES||{}).filter(c=>c.sector==='facilities_security');
 set('#page','<div class="notice">الدورات متاحة للجميع بدون تسجيل دخول. تم دمج واجهة أكاديمية أمن المنشآت ودوراتها العامة مع الاحتفاظ بآلية الاختبارات الحالية.</div>'+
 '<div class="grid three">'+courses.map(c=>'<section class="section-card"><h3>'+esc(c.title)+'</h3><p>'+esc(c.requiredRank||'')+'</p><a class="btn ghost" href="academy.html" target="_blank" rel="noopener">فتح دورة الأكاديمية</a></section>').join('')+'</div>'+
 '<button class="btn primary" id="allCourses">دخول الأكاديمية</button>');
 $('#allCourses').onclick=openAcademy;
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
 set('#page','<div class="section-card"><div class="row between"><h3>تقرير إداري جديد</h3><span class="badge secret">السري للغاية: لا يراه بعد الإرسال إلا القائد</span></div>'+
 '<form id="reportForm"><div class="grid two"><label>نوع التقرير<select name="kind" id="reportKind">'+opt(Object.entries(KINDS))+'</select></label><label>صيغة التقرير<select name="mode" id="reportMode">'+opt([['structured','تقرير منظم'],['free','تقرير حر']])+'</select></label></div>'+
 input('title','عنوان التقرير')+
 '<div id="structuredFields">'+['achievements','progress','needs','notes'].map((x,i)=>'<label>'+['الإنجازات','التقدم','الاحتياجات','الملاحظات'][i]+'<textarea name="'+x+'" maxlength="9000"></textarea></label>').join('')+'</div>'+
 '<div id="freeFields" hidden><label>نص التقرير<textarea name="text" maxlength="18000" rows="10"></textarea></label></div>'+
 '<label>رقم النسخة الأصلية للتصحيح (UUID اختياري)<input name="original" placeholder="اتركه فارغًا للتقرير الجديد"></label>'+
 '<div class="row"><button class="btn primary" type="submit">إرسال وقفل التقرير</button><button class="btn ghost" type="button" id="saveDraft">حفظ مسودة</button></div></form></div>'+
 '<section class="section-card"><h3>مسوداتي</h3><div class="row">'+(drafts||[]).map(d=>btn(d.title||'مسودة بدون عنوان','load',d.id)).join('')+'</div></section>');
 const form=$('#reportForm');
 if(correctionSource){form.elements.kind.value=correctionSource.kind;form.elements.original.value=correctionSource.id;form.elements.title.value='تصحيح: '+correctionSource.title;}
 const toggle=()=>{$('#freeFields').hidden=$('#reportMode').value!=='free';$('#structuredFields').hidden=$('#reportMode').value==='free'};
 $('#reportMode').onchange=toggle;toggle();
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
async function renderPolice(){
 const data=window.MP_DATA;
 if(!data)return set('#page',empty('تعذر تحميل قواعد مخالفات الشرطة العسكرية'));
 const list=[...(data.standardViolations||[]),...(data.fixedViolations||[])];
 const overrides=await query('asf_police_overrides');
 const ranks=Object.keys(data.penaltyMatrix);
 const mayManage=commander||has('police.manage');
 const penaltyFor=(v,rank)=>{
  const custom=overrides.find(o=>o.rule_key===v.key&&o.rank_key===rank);
  return custom?.penalty||(v?.calc?v.calc(rank):data.penaltyMatrix[rank]?.[v?.tier])||'تُحال للتقدير';
 };
 set('#page','<div class="section-card"><h3>حساب العقوبة المقترحة</h3><p>القواعد الأصلية محفوظة؛ التعديلات القيادية تظهر في البوابة فقط.</p><form id="policeForm"><label>رتبة المخالف<select name="rank">'+opt(ranks.map(r=>[r,r]))+'</select></label>'+
 '<label>المخالفة<select name="violation">'+opt(list.map((v,i)=>[String(i),String(v.id||'')+' — '+v.text]))+'</select></label><button class="btn primary" type="submit">احتساب العقوبة</button></form><div id="policeResult" class="notice" hidden></div></div>'+
 (mayManage?'<section class="section-card"><h3>إدارة العقوبات المقترحة</h3><p>يمكنك تغيير العقوبة لمخالفة ورتبة محددتين. لا تتغير ملفات الشرطة العسكرية القديمة، ويمكن العودة إلى العقوبة الأصلية.</p><form id="policeAdminForm"><label>المخالفة<select name="rule">'+opt(list.map(v=>[v.key,String(v.id||'')+' — '+v.text]))+'</select></label>'+
 '<label>الرتبة<select name="rank">'+opt(ranks.map(r=>[r,r]))+'</select></label>'+
 '<label>العقوبة المقترحة<textarea name="penalty" maxlength="500" required></textarea></label><div class="row"><button class="btn primary" name="action" value="save" type="submit">حفظ التعديل</button><button class="btn ghost" name="action" value="reset" type="submit">استعادة العقوبة الأصلية</button></div></form></section>':'')+
 '<section class="section-card"><h3>إحالة قضية جديدة إلى مجلس القضاء</h3><form id="caseForm"><label>الموضوع<input name="subject" required maxlength="200"></label><label>التفاصيل<textarea name="details" required maxlength="12000"></textarea></label><button class="btn ghost" type="submit">إرسال للمجلس</button></form></section>');
 $('#policeForm').onsubmit=e=>{
  e.preventDefault();const f=new FormData(e.target),v=list[Number(f.get('violation'))],rank=f.get('rank');
  $('#policeResult').hidden=false;$('#policeResult').textContent='العقوبة المقترحة: '+penaltyFor(v,rank);
 };
 if(mayManage){
  const form=$('#policeAdminForm'),sync=()=>{
   const rule=list.find(v=>v.key===form.elements.rule.value);
   form.elements.penalty.value=penaltyFor(rule,form.elements.rank.value);
  };
  form.elements.rule.onchange=sync;form.elements.rank.onchange=sync;sync();
  form.onsubmit=async e=>{
   e.preventDefault();const sender=e.submitter||document.activeElement;
   const erase=sender?.value==='reset',f=new FormData(form);
   const {error}=await db.rpc('asf_set_police_override',{p_key:f.get('rule'),p_rank:f.get('rank'),p_penalty:erase?'':String(f.get('penalty')||'').trim()});
   if(error)return toast(error.message,true);
   toast(erase?'تمت استعادة العقوبة الأصلية':'تم تحديث العقوبة المقترحة');renderPolice();
  };
 }
 $('#caseForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);
 const {error}=await db.from('asf_court_cases').insert({submitted_by:user.id,subject:String(f.get('subject')).trim(),details:String(f.get('details')).trim()});
 if(error)return toast(error.message,true);toast('تم إرسال القضية لمجلس القضاء');e.target.reset();
 };
}
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
 '<div class="grid two">'+input('player_name','اسم العسكري')+input('player_rank','الرتبة')+input('player_code','الكود العسكري')+
 '<label>درجة الإنذار<select name="warning_level">'+opt([['شفهي','شفهي'],['وظيفي','وظيفي'],['نهائي','نهائي'],['إجراء آخر','إجراء آخر']])+'</select></label>'+
 '<label>مدة الإنذار بالأيام (اختياري)<input name="duration_days" type="number" min="0" max="3650"></label>'+
 '<label>رقم القضية المرتبطة (اختياري)<select name="case_id">'+opt([['','بدون قضية'],...cases.map(c=>[c.id,c.subject])])+'</select></label></div>'+
 '<label>المخالفة<textarea name="offense" required minlength="4" maxlength="4000"></textarea></label>'+
 '<label>العقوبة<textarea name="punishment" required minlength="3" maxlength="4000"></textarea></label>'+
 '<button class="btn primary" type="submit">تثبيت الإنذار في السجل</button></form></div>'+
 '<div class="section-card"><div class="row between"><h3>السجل القضائي والإنذارات</h3>'+badge(String(warnings.length)+' سجل')+'</div>'+
 '<input id="warningSearch" placeholder="ابحث بالاسم أو الكود أو الرتبة أو المخالفة">'+
 '<div id="warningRows">'+(warnings.map(w=>courtWarningCard(w)).join('')||empty('لا توجد إنذارات بعد'))+'</div></div>');
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
 $('#warningSearch').oninput=e=>{
  const text=String(e.target.value||'').trim().toLowerCase();
  const matches=warnings.filter(w=>[w.player_name,w.player_code,w.player_rank,w.offense,w.punishment].some(z=>String(z||'').toLowerCase().includes(text)));
  set('#warningRows',matches.map(w=>courtWarningCard(w)).join('')||empty('لا توجد نتائج'));
 };
 $('#warningForm').onsubmit=async e=>{
  e.preventDefault();const f=new FormData(e.target);
  const row={recorded_by:user.id,player_name:String(f.get('player_name')).trim(),player_rank:String(f.get('player_rank')).trim(),player_code:String(f.get('player_code')).trim(),warning_level:f.get('warning_level'),
   offense:String(f.get('offense')).trim(),punishment:String(f.get('punishment')).trim(),duration_days:f.get('duration_days')===''?null:Number(f.get('duration_days')),case_id:f.get('case_id')||null};
  const {error}=await db.from('asf_court_warnings').insert(row);if(error)return toast(error.message,true);
  toast('تم تثبيت الإنذار');return renderCourt();
 };
}
function courtWarningCard(w){
 return '<div class="section-card"><div class="row between"><b>'+esc(w.player_name)+' — '+esc(w.player_rank)+'</b>'+badge(w.cancelled_at?'ملغي':'نشط')+'</div>'+
 '<p class="muted">'+esc(w.player_code||'بدون كود')+' · '+date(w.recorded_at)+' · '+esc(w.warning_level)+'</p>'+
 '<p><b>المخالفة:</b> '+esc(w.offense)+'</p><p><b>العقوبة:</b> '+esc(w.punishment)+'</p>'+
 (w.cancelled_at?'<p class="muted">أُلغي بتاريخ '+date(w.cancelled_at)+'؛ السبب: '+esc(w.cancellation_reason)+'</p>':btn('إلغاء الإنذار','cancel-warning',w.id,'warn'))+'</div>';
}
async function renderMembers(){
 const rows=await query('asf_profiles');rows.sort((a,b)=>a.created_at<b.created_at?1:-1);
 const actions=p=>!commander?'—':'<div class="actions">'+(p.status!=='approved'?btn('تفعيل','approve',p.user_id,'primary'):btn('إيقاف','suspend',p.user_id,'warn'))+
 btn('تغيير الرتبة','rank',p.user_id)+btn(p.court_enabled?'إلغاء القضاء':'تفعيل القضاء',p.court_enabled?'court_off':'court_on',p.user_id)+btn('رفض','reject',p.user_id,'warn')+'</div>';
 set('#page','<div class="section-card"><h3>طلبات التفعيل وجميع الأعضاء</h3><div class="table-wrap"><table><thead><tr><th>الاسم</th><th>الرتبة</th><th>الكود</th><th>Discord ID</th><th>الحالة</th><th>إجراءات القائد</th></tr></thead><tbody>'+
 rows.map(p=>'<tr><td>'+esc(p.game_name)+'</td><td>'+esc(p.rank)+'</td><td>'+esc(p.military_code||'—')+'</td><td dir="ltr">'+esc(p.discord_id)+'</td><td>'+badge(p.status)+'</td><td>'+actions(p)+'</td></tr>').join('')+'</tbody></table></div></div>');
 $('#page').onclick=async e=>{if(!commander)return;const b=e.target.closest('button[data-action]');if(!b)return;const action=b.dataset.action;
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
 access_requested:'طلب تصريح',access_reviewed:'قرار تصريح',police_rule_override:'تعديل عقوبة',court_warning_cancel:'إلغاء إنذار',pdf_finalized:'تأكيد ملف PDF',permanent_delete:'حذف نهائي تلقائي',profile_change:'تعديل بيانات',commander_profile_init:'ملف القائد'};
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
 const [people,rights]=await Promise.all([query('asf_profiles'),query('asf_delegations')]);
 set('#page','<div class="notice">لا توجد صلاحية يمكنها تجاوز حصرية «سري للغاية»؛ حتى تفويض قراءة جميع التقارير لا يشمله.</div>'+
 '<div class="section-card"><h3>إضافة أو سحب صلاحيات قيادية</h3><form id="grantsForm"><label>العضو<select name="user">'+opt(people.filter(p=>p.status==='approved').map(p=>[p.user_id,p.game_name+' — '+(p.military_code||'')]))+'</select></label>'+
 '<label>الأداة<select name="feature">'+opt([['reports.read','الاطلاع على التقارير العادية'],['reports.review','مراجعة التقارير وإرسال ملاحظات عليها'],['police.manage','تعديل العقوبات المقترحة بالشرطة العسكرية'],['court.manage','صلاحية مجلس القضاء وإدارة السجلات'],['users.review','الاطلاع على طلبات التسجيل وتعديل البيانات']])+'</select></label>'+
 '<label>تصنيف التقارير<select name="kind">'+opt([['','جميع التقارير غير السرية'],...Object.entries(KINDS).filter(([k])=>k!=='secret')])+'</select></label>'+
 '<div class="row"><button type="submit" class="btn primary" name="enable" value="true">منح</button><button type="submit" class="btn warn" name="enable" value="false">سحب</button></div></form></div>'+
 '<div class="section-card"><h3>التفويضات الحالية</h3><div class="table-wrap"><table><thead><tr><th>العضو</th><th>الصلاحية</th><th>نوع التقرير</th></tr></thead><tbody>'+
 rights.map(r=>'<tr><td>'+esc(people.find(p=>p.user_id===r.user_id)?.game_name||r.user_id)+'</td><td>'+esc(r.permission)+'</td><td>'+esc(KINDS[r.report_kind]||'الكل ما عدا السري')+'</td></tr>').join('')+'</tbody></table></div></div>');
 let submitEnable=true;$('#grantsForm').querySelectorAll('button[type="submit"]').forEach(b=>b.addEventListener('click',()=>submitEnable=b.value==='true'));
 $('#grantsForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),feature=f.get('feature'),kind=['reports.read','reports.review'].includes(feature)?(f.get('kind')||null):null;
 const {error}=await db.rpc('asf_set_delegation',{target:f.get('user'),feature,kind,enabled:submitEnable});
 if(error)return toast(error.message,true);toast('تم تحديث الصلاحيات');loadIdentity(true)};
}

async function renderAccessRequests(){
 const {data:rows,error}=await db.from('asf_access_requests').select('*').order('created_at',{ascending:false}).limit(80);
 if(error)throw error;
 const options=Object.entries(ACCESS_PERMISSIONS).map(([feature,label])=>
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
   const {data,error}=await db.rpc('asf_commander_profile_setup',{p_name:String(f.get('game_name')).trim(),p_discord:String(f.get('discord_id')).trim(),p_rank:f.get('rank')});
   if(error)return toast(error.message,true);toast('تم إنشاء الملف العسكري للقائد: '+data);await loadIdentity(true);
  };return;
 }
 if(!profile)return set('#page',empty('الملف العسكري غير موجود.'));
 set('#page','<div class="grid two"><div class="section-card"><h3>بطاقتي الرقمية</h3><p>الاسم: <b>'+esc(profile.game_name)+'</b></p><p>الرتبة: <b>'+esc(profile.rank)+'</b></p><p>الكود العسكري: <b>'+esc(profile.military_code||'—')+'</b></p><p>Discord ID: <b dir="ltr">'+esc(profile.discord_id)+'</b></p><p>حالة الحساب: '+badge(profile.status)+'</p></div>'+
 '<div class="section-card"><h3>طلب تعديل بيانات</h3><p>طلب تغيير الاسم أو Discord ID يخضع لموافقة القائد، ولا يؤثر على البيانات الحالية قبل قبول الطلب.</p><form id="changeForm">'+input('name','الاسم الجديد',profile.game_name)+input('discord','معرّف Discord الجديد',profile.discord_id)+'<button type="submit" class="btn primary">إرسال طلب التعديل</button></form></div></div>');
 $('#changeForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);
 const {error}=await db.from('asf_change_requests').insert({user_id:user.id,new_game_name:String(f.get('name')).trim(),new_discord_id:String(f.get('discord')).trim()});
 if(error)return toast(error.message,true);toast('تم إرسال طلب التعديل إلى القائد');};
}

init();
})();
