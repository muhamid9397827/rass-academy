/* بوابة أمن المنشآت — MVP. Data access always enforced by Supabase RLS. */
(() => {
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KINDS={personnel:'تقرير مسؤول الأفراد',officers:'تقرير مسؤول الضباط',joint:'تقرير مشترك للأفراد والضباط',presidencies:'تقرير مسؤولي الرئاسات',secret:'سري للغاية — للقائد فقط'};
const STATES={new:'جديد',reviewing:'قيد المراجعة',reviewed:'تمت المراجعة',needs_more:'يحتاج استكمال'};
const RANKS=['جندي','جندي أول','عريف','وكيل رقيب','رقيب','رقيب أول','رئيس رقباء','ملازم','ملازم أول','نقيب','رائد','مقدم','عقيد','عميد','لواء','فريق','فريق أول'];
const cfg=window.ASF_CONFIG||{}, ready=!!(cfg.supabaseUrl&&cfg.supabaseAnonKey&&window.supabase);
let db=ready?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
let user=null, profile=null, commander=false, grants=[], pageName='dashboard', draftId=null, latestReports=[];
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
function showScreen(which){['welcome','authScreen','pendingScreen','workspace'].forEach(id=>$('#'+id).hidden=id!==which)}
function openAcademy(){window.open('academy.html','_blank','noopener')}
$('#openAcademy').onclick=openAcademy;
let registering=false;
function authForm(mode){registering=mode==='register';showScreen('authScreen');$('#authTitle').textContent=registering?'إنشاء حساب جديد':'تسجيل الدخول';$('#registerFields').hidden=!registering;$('#authSubmit').textContent=registering?'إرسال طلب إنشاء حساب':'تسجيل الدخول';$('#authToggle').textContent=registering?'لديك حساب بالفعل؟ تسجيل الدخول':'ليس لديك حساب؟ إنشاء حساب';['gameName','discordId','rank'].forEach(id=>$('#'+id).required=registering);}
$('#showLogin').onclick=()=>authForm('login');$('#showRegister').onclick=()=>authForm('register');
$('#authToggle').onclick=()=>authForm(registering?'login':'register');$('#authBack').onclick=()=>showScreen('welcome');
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
    const {data,error}=await db.auth.signUp({email,password,options:{data:{asf_portal:'true',game_name,discord_id,rank}}});if(error)throw error;
    toast(data.session?'تم إنشاء الحساب، بانتظار موافقة القائد.':'تم إرسال طلب التسجيل. تحقق من بريدك لتأكيد الحساب إن طُلب ذلك.');
    await loadIdentity();
  }else{
    const {error}=await db.auth.signInWithPassword({email,password});if(error)throw error;await loadIdentity();
  }
 }catch(err){toast(err.message||'تعذر تنفيذ العملية',true)}
 finally{$('#authSubmit').disabled=false}
};
async function init(){
 if(!ready){showScreen('welcome');toast('البوابة التجريبية بحاجة لربط قاعدة البيانات لتفعيل الحسابات.',true);return}
 const {data}=await db.auth.getUser();if(data?.user){user=data.user;await loadIdentity()}else showScreen('welcome');
 db.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){user=null;showScreen('welcome')}});
}
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
  $('#sessionLabel').textContent=p?.game_name||user.email;$('#signOut').hidden=false;
  if(commander||p?.status==='approved'){
   showScreen('workspace');$('#courtNav').hidden=!(commander||p.court_enabled);
   $('#adminNav').hidden=!(commander||has('reports.read'));
   document.querySelectorAll('[data-page="members"],[data-page="changes"],[data-page="delegations"],[data-page="trash"]').forEach(n=>n.hidden=!commander);
   document.querySelector('[data-page="inbox"]').hidden=!(commander||has('reports.read'));
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
 const titles={dashboard:'لوحة التحكم',academy:'الأكاديمية والدورات',reports:'تقاريري',compose:'إنشاء تقرير',police:'الشرطة العسكرية',court:'مجلس القضاء',inbox:'التقارير الواردة',members:'إدارة المستخدمين',changes:'طلبات تعديل البيانات',delegations:'تفويض القيادات',trash:'سلة المحذوفات',account:'الملف الشخصي'};
 set('#pageTitle','<div><h1>'+esc(titles[name]||'بوابة أمن المنشآت')+'</h1><p>المنصة الموحدة · إعدادات الصلاحيات حسب حسابك</p></div>');
 set('#page','<div class="empty">جارٍ تحميل البيانات...</div>');
 try{
  if(name==='dashboard')return renderDashboard();
  if(name==='academy')return renderAcademy();
  if(name==='reports'||name==='inbox'||name==='trash')return renderReports(name);
  if(name==='compose')return renderCompose();
  if(name==='police')return renderPolice();
  if(name==='court')return renderCourt();
  if(name==='members'&&commander)return renderMembers();
  if(name==='changes'&&commander)return renderChanges();
  if(name==='delegations'&&commander)return renderDelegations();
  if(name==='account')return renderAccount();
  set('#page',empty('لا تملك صلاحية الوصول إلى هذا القسم.'));
 }catch(err){set('#page',empty('تعذر تحميل القسم: '+err.message));toast(err.message,true)}
}
async function renderDashboard(){
 const {data:rs,error}=await db.from('asf_reports').select('id,kind,submitted_at,deleted_at',{count:'exact'}).is('deleted_at',null).limit(100);
 if(error)throw error;
 const own=(rs||[]).filter(r=>r.kind!=='secret').length;
 const info=[
 ['الكود العسكري',profile?.military_code||'القائد'],['تقارير يمكن عرضها',String(rs?.length||0)],['مجلس القضاء',commander||profile?.court_enabled?'مسموح':'غير مفعل'],['الحساب','مفعل']
 ];
 set('#page','<div class="grid four">'+info.map(([k,v])=>'<div class="metric"><div class="caption">'+esc(k)+'</div><div class="n" style="font-size:20px">'+esc(v)+'</div></div>').join('')+'</div>'+
 '<div class="grid two" style="margin-top:18px"><section class="section-card"><h3>التقارير</h3><p>إنشاء تقرير منظم أو حر، تحميل PDF، متابعة ملاحظات القائد.</p><button class="btn primary" id="dashCompose">إرسال تقرير</button></section><section class="section-card"><h3>الصلاحيات</h3><p>التقارير السرية للغاية تعرض للقائد فقط حتى مع وجود قيادات مفوضة.</p><button class="btn ghost" id="dashAccount">ملفي الشخصي</button></section></div>');
 $('#dashCompose').onclick=()=>navigate('compose');$('#dashAccount').onclick=()=>navigate('account');
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
 return '<article class="section-card"><div class="row between"><div><h3>'+esc(r.title)+'</h3><span class="muted">'+esc(code(r.report_number))+' · '+date(r.submitted_at)+' · '+esc(r.sender_name)+'</span></div>'+badge(KINDS[r.kind],secret)+'</div>'+
 '<div class="row" style="margin-top:12px">'+btn('عرض التفاصيل','detail',r.id)+btn('تنزيل PDF','pdf',r.id)+(commander?btn(mode==='trash'?'استعادة':'حذف','trash',r.id,mode==='trash'?'light':'warn'):'')+'</div></article>';
}
async function renderReports(mode){
 if(mode==='inbox'&&!has('reports.read'))return set('#page',empty('غير مصرح لك بعرض التقارير الواردة'));
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
 const {data,error}=await db.storage.from('asf-reports').download(r.pdf_path);
 if(error)return toast('ملف PDF غير جاهز أو ليس لديك صلاحية: '+error.message,true);
 const blobUrl=URL.createObjectURL(data);window.open(blobUrl,'_blank','noopener,noreferrer');setTimeout(()=>URL.revokeObjectURL(blobUrl),120000);
}
async function detailReport(r,mode){
 const {data:rev}=await db.from('asf_reviews').select('*').eq('report_id',r.id).maybeSingle();
 const content=r.mode==='free'?'<p class="muted">نص التقرير</p><div style="white-space:pre-wrap">'+esc(r.body?.text||'')+'</div>':
 ['achievements','progress','needs','notes'].map((x,i)=>'<h4>'+['الإنجازات','التقدم','الاحتياجات','الملاحظات'][i]+'</h4><p style="white-space:pre-wrap">'+esc(r.body?.[x]||'—')+'</p>').join('');
 set('#page','<div class="section-card"><div class="row between"><h3>'+esc(r.title)+'</h3>'+badge(KINDS[r.kind],r.kind==='secret')+'</div><p class="muted">'+code(r.report_number)+' · '+date(r.submitted_at)+'</p><p>'+esc(r.sender_rank)+' / '+esc(r.sender_name)+' / '+esc(r.sender_code)+'</p><hr>'+content+'<hr><b>مراجعة القائد:</b> '+esc(STATES[rev?.state]||'جديد')+'<p>'+esc(rev?.note||'لا توجد ملاحظات')+'</p><div class="row">'+btn('عرض PDF','pdf',r.id)+btn('رجوع','back')+'</div></div>'+
 (commander?'<section class="section-card"><h3>مراجعة التقرير</h3><form id="reviewForm"><label>حالة التقرير<select name="state">'+opt(Object.entries(STATES),rev?.state||'new')+'</select></label><label>الملاحظات والتوجيهات<textarea name="note" maxlength="4000">'+esc(rev?.note||'')+'</textarea></label><button class="btn primary">حفظ المراجعة</button></form></section>':''));
 $('#page').querySelector('[data-action="pdf"]').onclick=()=>downloadPdf(r);
 $('#page').querySelector('[data-action="back"]').onclick=()=>renderReports(mode);
 if(commander)$('#reviewForm').onsubmit=async e=>{
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
 const form=$('#reportForm');const toggle=()=>{$('#freeFields').hidden=$('#reportMode').value!=='free';$('#structuredFields').hidden=$('#reportMode').value==='free'};
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
   try{const pdf=await buildPdf(report);const {error:up}=await db.storage.from('asf-reports').upload(path,pdf,{contentType:'application/pdf',upsert:false});if(up)throw up;result+=' وحفظ PDF بنجاح'}
   catch(pdfError){result+=' لكن تعذّر إنشاء/رفع PDF: '+pdfError.message+'. التقرير محفوظ في قاعدة البيانات، ويجب معالجة الملف.'}
   if(draftId)await db.from('asf_drafts').delete().eq('id',draftId);draftId=null;
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
 (r.original?'<p>تصحيح مرتبط بالتقرير: '+esc(r.original)+'</p>':'')+
 '<div class="paper-footer">وثيقة إلكترونية لأغراض المحاكاة داخل سيرفر رول بلاي · رقم التقرير '+code(r.report_number)+'</div>';
 return el;
}
async function buildPdf(report){
 if(typeof window.html2pdf!=='function')throw Error('مكتبة PDF لم تُحمّل');
 return window.html2pdf().set({margin:5,filename:code(report.report_number)+'.pdf',image:{type:'jpeg',quality:0.98},html2canvas:{scale:2,useCORS:true,logging:false},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},pagebreak:{mode:['css','legacy']}}).from(renderPaper(report)).outputPdf('blob');
}
function renderPolice(){
 const data=window.MP_DATA;
 if(!data)return set('#page',empty('تعذر تحميل قواعد المخالفات من الموقع القديم'));
 const list=[...(data.standardViolations||[]),...(data.fixedViolations||[])];
 set('#page','<div class="section-card"><h3>حساب العقوبة المقترحة</h3><p>البيانات مستقاة من قائمة مخالفات الشرطة العسكرية القديمة، مع استمرار الحفاظ على الموقع الأصلي دون تعديل.</p><form id="policeForm"><label>رتبة المخالف<select name="rank">'+opt(Object.keys(data.penaltyMatrix).map(r=>[r,r]))+'</select></label>'+
 '<label>المخالفة<select name="violation">'+opt(list.map((v,i)=>[String(i),String(v.id||'')+' — '+v.text]))+'</select></label><button class="btn primary" type="submit">احتساب العقوبة</button></form><div id="policeResult" class="notice" hidden></div></div>'+
 '<section class="section-card"><h3>إحالة قضية جديدة إلى مجلس القضاء</h3><form id="caseForm"><label>الموضوع<input name="subject" required maxlength="200"></label><label>التفاصيل<textarea name="details" required maxlength="12000"></textarea></label><button class="btn ghost" type="submit">إرسال للمجلس</button></form></section>');
 $('#policeForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),v=list[Number(f.get('violation'))],rank=f.get('rank');
 const penalty=v?.calc?v.calc(rank):data.penaltyMatrix[rank]?.[v?.tier]||'تُحال للتقدير';$('#policeResult').hidden=false;$('#policeResult').textContent='العقوبة المقترحة: '+penalty;};
 $('#caseForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);
 const {error}=await db.from('asf_court_cases').insert({submitted_by:user.id,subject:String(f.get('subject')).trim(),details:String(f.get('details')).trim()});if(error)return toast(error.message,true);toast('تم إرسال القضية لمجلس القضاء');e.target.reset();};
}
async function renderCourt(){
 if(!(commander||profile?.court_enabled))return set('#page',empty('مجلس القضاء يتطلب تفعيلًا خاصًا من القائد.'));
 const [cases,decisions]=await Promise.all([query('asf_court_cases'),query('asf_court_decisions')]);
 set('#page','<div class="notice">هذا سجل قضائي جديد مستقل. السجلات القديمة تُحفظ بأرشيفها الأصلي.</div>'+
 '<div class="section-card"><h3>القضايا الواردة</h3>'+cases.map(c=>{
 const d=decisions.find(v=>v.case_id===c.id);return '<div class="section-card"><h3>'+esc(c.subject)+'</h3><p style="white-space:pre-wrap">'+esc(c.details)+'</p><p class="muted">'+date(c.created_at)+'</p><div>'+badge(d?d.outcome:'بانتظار القرار')+'</div>'+
 (!d?'<div class="row">'+btn('اعتماد','decide-yes',c.id)+btn('رفض','decide-no',c.id)+'</div>':'<p>'+esc(d.note||'')+'</p>')+'</div>'}).join('')+'</div>');
 $('#page').onclick=async e=>{const b=e.target.closest('[data-action]');if(!b||!b.dataset.action.startsWith('decide'))return;
 const note=prompt('ملاحظة القرار (اختياري)')||'';
 const {error}=await db.from('asf_court_decisions').insert({case_id:b.dataset.id,outcome:b.dataset.action==='decide-yes'?'approved':'rejected',note,decided_by:user.id});
 if(error)return toast(error.message,true);toast('تم تسجيل القرار');renderCourt();
 };
}
async function renderMembers(){
 const rows=await query('asf_profiles');rows.sort((a,b)=>a.created_at<b.created_at?1:-1);
 const actions=p=>'<div class="actions">'+(p.status!=='approved'?btn('تفعيل','approve',p.user_id,'primary'):btn('إيقاف','suspend',p.user_id,'warn'))+
 btn('تغيير الرتبة','rank',p.user_id)+btn(p.court_enabled?'إلغاء القضاء':'تفعيل القضاء',p.court_enabled?'court_off':'court_on',p.user_id)+btn('رفض','reject',p.user_id,'warn')+'</div>';
 set('#page','<div class="section-card"><h3>طلبات التفعيل وجميع الأعضاء</h3><div class="table-wrap"><table><thead><tr><th>الاسم</th><th>الرتبة</th><th>الكود</th><th>Discord ID</th><th>الحالة</th><th>إجراءات القائد</th></tr></thead><tbody>'+
 rows.map(p=>'<tr><td>'+esc(p.game_name)+'</td><td>'+esc(p.rank)+'</td><td>'+esc(p.military_code||'—')+'</td><td dir="ltr">'+esc(p.discord_id)+'</td><td>'+badge(p.status)+'</td><td>'+actions(p)+'</td></tr>').join('')+'</tbody></table></div></div>');
 $('#page').onclick=async e=>{const b=e.target.closest('button[data-action]');if(!b)return;const action=b.dataset.action;
 let arg=null;if(action==='rank'){arg=prompt('الرتبة الجديدة (من القائمة المعتمدة):',rows.find(r=>r.user_id===b.dataset.id)?.rank||'');if(!arg||!RANKS.includes(arg))return toast('الرتبة غير معتمدة',true);}
 if(['reject','suspend'].includes(action)&&!confirm('تأكيد الإجراء على الحساب؟'))return;
 const {data,error}=await db.rpc('asf_admin_action',{op:action,target:b.dataset.id,arg});if(error)return toast(error.message,true);
 toast(action==='approve'?'تم تفعيل الحساب والكود: '+data:'تم حفظ التغيير');renderMembers();};
}
async function renderChanges(){
 const rows=await query('asf_change_requests');
 set('#page','<div class="section-card"><h3>طلبات تعديل الاسم ومعرّف ديسكورد</h3><div class="table-wrap"><table><thead><tr><th>صاحب الطلب</th><th>الاسم الجديد</th><th>Discord ID</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>'+
 rows.map(r=>'<tr><td>'+esc(r.user_id)+'</td><td>'+esc(r.new_game_name)+'</td><td dir="ltr">'+esc(r.new_discord_id)+'</td><td>'+badge(r.state)+'</td><td>'+(r.state==='pending'?btn('موافقة','allow',r.id,'primary')+btn('رفض','deny',r.id,'warn'):'—')+'</td></tr>').join('')+'</tbody></table></div></div>');
 $('#page').onclick=async e=>{const b=e.target.closest('[data-action]');if(!b)return;const {error}=await db.rpc('asf_review_change',{req:b.dataset.id,allow_change:b.dataset.action==='allow'});if(error)return toast(error.message,true);toast('تمت معالجة الطلب');renderChanges()};
}
async function renderDelegations(){
 const [people,rights]=await Promise.all([query('asf_profiles'),query('asf_delegations')]);
 set('#page','<div class="notice">لا توجد صلاحية يمكنها تجاوز حصرية «سري للغاية»؛ حتى تفويض قراءة جميع التقارير لا يشمله.</div>'+
 '<div class="section-card"><h3>إضافة أو سحب صلاحيات قيادية</h3><form id="grantsForm"><label>العضو<select name="user">'+opt(people.filter(p=>p.status==='approved').map(p=>[p.user_id,p.game_name+' — '+(p.military_code||'')]))+'</select></label>'+
 '<label>الأداة<select name="feature">'+opt([['reports.read','الاطلاع على التقارير العادية'],['police.manage','إدارة الشرطة العسكرية (تجهيز مستقبلي)'],['court.manage','إدارة مجلس القضاء (تجهيز مستقبلي)'],['users.review','مراجعة المستخدمين (تجهيز مستقبلي)']])+'</select></label>'+
 '<label>تصنيف التقارير<select name="kind">'+opt([['','جميع التقارير غير السرية'],...Object.entries(KINDS).filter(([k])=>k!=='secret')])+'</select></label>'+
 '<div class="row"><button type="submit" class="btn primary" name="enable" value="true">منح</button><button type="submit" class="btn warn" name="enable" value="false">سحب</button></div></form></div>'+
 '<div class="section-card"><h3>التفويضات الحالية</h3><div class="table-wrap"><table><thead><tr><th>العضو</th><th>الصلاحية</th><th>نوع التقرير</th></tr></thead><tbody>'+
 rights.map(r=>'<tr><td>'+esc(people.find(p=>p.user_id===r.user_id)?.game_name||r.user_id)+'</td><td>'+esc(r.permission)+'</td><td>'+esc(KINDS[r.report_kind]||'الكل ما عدا السري')+'</td></tr>').join('')+'</tbody></table></div></div>');
 let submitEnable=true;$('#grantsForm').querySelectorAll('button[type="submit"]').forEach(b=>b.addEventListener('click',()=>submitEnable=b.value==='true'));
 $('#grantsForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),feature=f.get('feature'),kind=feature==='reports.read'?(f.get('kind')||null):null;
 const {error}=await db.rpc('asf_set_delegation',{target:f.get('user'),feature,kind,enabled:submitEnable});
 if(error)return toast(error.message,true);toast('تم تحديث الصلاحيات');loadIdentity(true)};
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