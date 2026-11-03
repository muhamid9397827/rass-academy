/* Department workspaces. Server RPC + RLS are authoritative, never DOM role flags. */
(() => {
'use strict';
const $=id=>document.querySelector(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=value=>value?new Date(value).toLocaleString('ar-SA',{dateStyle:'short',timeStyle:'short'}):'—';
const DEPTS={training:'كلية التدريب',recruitment:'القبول والتجنيد'};
const ROLES={head:'الرئاسة',trainer:'مدرب',member:'عضو'};
const amount='150,000';

function create({db,getContext,notify,go,mountResults}){
 const context=()=>getContext();
 const isRole=(dept,role)=>{
  const me=context();return !!me.commander||me.roles.some(r=>r.department===dept&&r.role===role);
 };
 const isAssigned=(dept,role)=>context().roles.some(r=>r.department===dept&&r.role===role);
 const isMember=dept=>context().commander||context().roles.some(r=>r.department===dept);
 const isHead=dept=>isRole(dept,'head');
 const isTrainer=dept=>isRole(dept,'trainer');
 const canOperate=dept=>isHead(dept)||isTrainer(dept)||
  (dept==='training'&&context().legacyAcademyManage);
 const alertError=err=>notify(err?.message||'تعذر تنفيذ العملية.',true);
 const badge=txt=>'<span class="dept-chip">'+esc(txt)+'</span>';
 const roleSummary=dept=>context().commander?'قيادة أمن المنشآت':context().roles.filter(r=>r.department===dept).map(r=>ROLES[r.role]).join(' · ')||'غير مصرّح';
 const hero=(dept,summary)=>'<header class="dept-hero"><div><span class="dept-eyebrow">الأقسام التخصصية / '+esc(DEPTS[dept])+'</span><h2>'+esc(DEPTS[dept])+'</h2><p>'+esc(summary)+'</p></div><span class="dept-current-role">'+esc(roleSummary(dept))+'</span></header>';
 const colHead='<h3>المكافآت المسجلة <small>150,000 لكل إجراء مستحق</small></h3>';

 async function rewardPanel(dept){
  const box=$('#departmentRewards');if(!box)return;
  box.textContent='جاري تحميل المكافآت…';
  const {data,error}=await db.from('asf_department_rewards')
   .select('id,department,subject_label,actor_id,actor_name,actor_code,amount,earned_at,paid_at,paid_by,paid_by_name')
   .eq('department',dept).order('earned_at',{ascending:false}).limit(100);
  if(error){box.textContent='تعذر تحميل المكافآت.';return}
  const ctx=context(),canPay=isHead(dept);
  const rows=(data||[]);
  const pending=rows.filter(x=>!x.paid_at);
  box.innerHTML='<div class="dept-section-title">'+colHead+badge(String(pending.length)+' بانتظار الصرف')+'</div>'+
   '<p class="dept-hint">يتم تسجيل الاستحقاق باسم المدرب الذي نفّذ الإجراء. «تم صرف المكافأة» تأشير إداري بعد الصرف الفعلي، وليس تحويلًا تلقائيًا.</p>'+
   (rows.length?'<div class="dept-reward-list">'+rows.map(r=>
    '<article class="dept-record"><div class="dept-record-head"><strong>'+esc(r.actor_name)+'</strong>'+
    '<span class="'+(r.paid_at?'dept-state-paid':'dept-state-unpaid')+'">'+(r.paid_at?'✓ تم صرف المكافأة':'بانتظار المكافأة')+'</span></div>'+
    '<div class="dept-record-description">'+esc(r.subject_label)+'</div>'+
    '<small>المكافأة: '+amount+' · الاستحقاق: '+when(r.earned_at)+(r.actor_code?' · '+esc(r.actor_code):'')+'</small>'+
    (r.paid_at?'<small>تم تأشير الصرف بواسطة '+esc(r.paid_by_name||'الرئاسة')+' — '+when(r.paid_at)+'</small>':canPay&&r.actor_id!==ctx.user?.id?
    '<button type="button" class="btn primary small" data-reward-paid="'+esc(r.id)+'">✓ تم إعطاء المكافأة</button>':'')+
    '</article>').join('')+'</div>':'<div class="dept-empty">لا توجد مكافآت مسجلة في هذا القسم بعد.</div>');
  box.querySelectorAll('[data-reward-paid]').forEach(button=>button.onclick=async()=>{
   if(!confirm('هل تم إعطاء المدرب مكافأة '+amount+' بالفعل؟ سيتم توثيق الصرف مرة واحدة فقط.'))return;
   button.disabled=true;
   const {error:err}=await db.rpc('asf_department_mark_paid',{p_reward:button.dataset.rewardPaid});
   if(err){alertError(err);button.disabled=false;return}
   notify('تم تسجيل صرف المكافأة باسم المدرب.');await rewardPanel(dept);
  });
 }

 async function rolesPanel(dept,commanderAdmin=false){
  const box=$('#departmentRolesPanel');if(!box)return;
  if(!commanderAdmin&&!isHead(dept)){box.innerHTML='';return}
  const [profiles,roles]=await Promise.all([
   db.rpc('asf_department_candidates',{p_department:dept}),
   db.from('asf_department_roles').select('user_id,department,role,granted_at').eq('department',dept).limit(600)
  ]);
  if(profiles.error||roles.error){box.textContent='تعذر عرض إدارة الأدوار.';return}
  const all=(profiles.data||[]).filter(p=>p.user_id!==context().user?.id);
  const assigned=roles.data||[];
  const selectableRoles=commanderAdmin?[['head','رئاسة القسم'],['trainer','مدرب القسم'],['member','عضو القسم']]:[['trainer','مدرب القسم']];
  box.innerHTML='<div class="dept-section-title"><h3>إدارة أدوار '+esc(DEPTS[dept])+'</h3>'+badge(commanderAdmin?'إعداد القيادة':'صلاحية الرئاسة')+'</div>'+
  '<p class="dept-hint">'+(commanderAdmin?'القائد يحدد الرئاسة والأعضاء والمدربين، كل جهة بشكل مستقل.':'رئاسة القسم تستطيع تعيين مدرب أو سحب دور المدرب ضمن قسمها فقط.')+'</p>'+
  '<form id="departmentRoleForm" class="dept-role-form"><label>العضو المعتمد<select required name="user"><option value="">اختر عضوًا</option>'+all.map(p=>'<option value="'+esc(p.user_id)+'">'+esc(p.game_name)+' — '+esc(p.military_code||p.rank)+'</option>').join('')+'</select></label>'+
  '<label>الرول<select required name="role">'+selectableRoles.map(([k,t])=>'<option value="'+k+'">'+t+'</option>').join('')+'</select></label>'+
  '<div class="dept-role-actions"><button class="btn primary" type="submit" name="enable" value="true">منح الرول</button><button class="btn ghost" type="submit" name="enable" value="false">سحب الرول</button></div></form>'+
  '<div class="dept-section-title"><h3>الأدوار الحالية</h3>'+badge(String(assigned.length))+'</div>'+
  (assigned.length?'<div class="dept-role-roster">'+assigned.map(r=>'<div class="dept-roster-item"><span>'+esc(all.find(p=>p.user_id===r.user_id)?.game_name||'عضو')+'</span>'+badge(ROLES[r.role]||r.role)+'</div>').join('')+'</div>':'<p class="dept-hint">لم تُعيّن أدوار بعد.</p>');
  box.querySelector('#departmentRoleForm').onsubmit=async event=>{
   event.preventDefault();const submit=event.submitter;if(!submit)return;
   const args=new FormData(event.currentTarget);
   const p_user=String(args.get('user')||''),p_role=String(args.get('role')||''),p_enable=submit.value==='true';
   if(!p_user)return notify('اختر عضوًا أولًا.',true);
   if(!p_enable&&!confirm('هل تريد سحب هذا الرول من العضو؟'))return;
   box.querySelectorAll('button').forEach(b=>b.disabled=true);
   const {error}=await db.rpc('asf_department_set_role',{p_user,p_department:dept,p_role,p_enable});
   if(error){alertError(error);box.querySelectorAll('button').forEach(b=>b.disabled=false);return}
   notify(p_enable?'تم منح الرول.':'تم سحب الرول.');
   await rolesPanel(dept,commanderAdmin);
  };
 }
 async function applicants(){
  const box=$('#departmentApplicants');if(!box)return;
  box.textContent='جاري تحميل طلبات القبول…';
  const {data,error}=await db.from('asf_profiles')
   .select('user_id,game_name,discord_id,rank,activation_reason,created_at,status')
   .eq('status','pending').order('created_at',{ascending:false}).limit(150);
  if(error){box.textContent='تعذر تحميل طلبات المتقدمين.';return}
  box.innerHTML='<div class="dept-section-title"><h3>المتقدمون بانتظار القبول</h3>'+badge(String((data||[]).length))+'</div>'+
  '<p class="dept-hint">قبول المتدرب يسجل اسم المدرب المسؤول. مكافأة مدرب القبول والتجنيد 150,000 عن كل قبول ناجح؛ الرئاسة تراجع الصرف بعد ذلك.</p>'+
  ((data||[]).length?'<div class="dept-record-list">'+data.map(p=>
  '<article class="dept-record"><div class="dept-record-head"><strong>'+esc(p.game_name)+'</strong><span class="dept-state-unpaid">بانتظار القبول</span></div>'+
   '<small>Discord: <b dir="ltr">'+esc(p.discord_id)+'</b> · الرتبة: '+esc(p.rank)+'</small>'+
   '<p class="dept-record-description">سبب طلب التفعيل: '+esc(p.activation_reason||'لم يذكر السبب')+'</p>'+
   (String(p.activation_reason||'').trim().length>=10?'<button class="btn primary" type="button" data-recruit="'+esc(p.user_id)+'">✓ قبول المتدرب وتسجيل اسم المقبِل</button>':
   '<span class="dept-state-unpaid">لا يمكن القبول بدون سبب التفعيل</span>')+
   '</article>').join('')+'</div>':'<div class="dept-empty">لا توجد طلبات قبول معلقة حاليًا.</div>');
  box.querySelectorAll('[data-recruit]').forEach(button=>button.onclick=async()=>{
   if(!confirm('هل تؤكد قبول هذا المتدرب وتفعيل حسابه؟ سيُسجّل اسم المنفّذ.'))return;
   button.disabled=true;
   const {error:err}=await db.rpc('asf_recruitment_accept',{p_user:button.dataset.recruit});
   if(err){alertError(err);button.disabled=false;return}
   notify('تم قبول المتدرب وتسجيل اسم المسؤول واستحقاق مكافأة المدرب إن كان يملك رول المدرب.');
   await applicants();await rewardPanel('recruitment');
  });
 }
 async function render(dept){
  if(!DEPTS[dept]||!isMember(dept)){
   $('#page').innerHTML='<div class="dept-empty">هذا القسم مخصص للأعضاء الذين لديهم رول داخل الجهة فقط.</div>';return;
  }
  const active=canOperate(dept),head=isHead(dept);
  const summary=dept==='training'?'متابعة الدورات، تأكيد تسليم رولات الناجحين، ومراجعة مكافآت المدربين.':'متابعة طلبات المتقدمين وتفعيل المقبولين، مع تسجيل المدرب ومكافأته.';
  $('#page').innerHTML=hero(dept,summary)+
    '<div class="dept-shortcuts"><div class="dept-shortcut" id="deptMyRole"><b>الرول الحالي</b><strong>'+esc(roleSummary(dept))+'</strong></div>'+
    (dept==='training'?'<button class="dept-shortcut" id="deptPublicCourses" type="button"><b>الدورات العامة</b><strong>افتح الأكاديمية ↗</strong></button>':
    '<div class="dept-shortcut"><b>القبول والتجنيد</b><strong>الأدوار وسجل القسم</strong></div>')+
    (head?'<button class="dept-shortcut" id="deptManageTrainers" type="button"><b>صلاحيات الرئاسة</b><strong>إدارة المدربين ↓</strong></button>':'')+'</div>'+
    (active?'<section class="section-card dept-section" id="departmentWork"></section>':'<section class="section-card dept-section"><h3>عضوية '+esc(DEPTS[dept])+'</h3><p class="dept-hint">أنت عضو في هذا القسم. إدارة المتدربين والمكافآت تمنح فقط للمدربين والرئاسة.</p></section>')+
    (active?'<section class="section-card dept-section" id="departmentRewards"></section>':'')+
    (head?'<section class="section-card dept-section" id="departmentRolesPanel"></section>':'');
  if(dept==='training')$('#deptPublicCourses').onclick=()=>window.open('academy.html','_blank','noopener');
  if(head)$('#deptManageTrainers').onclick=()=>$('#departmentRolesPanel')?.scrollIntoView({behavior:'smooth',block:'start'});
  if(active){
   if(dept==='training'){
    $('#departmentWork').innerHTML='<div class="dept-section-title"><h3>نتائج الدورات وتسليم الرولات</h3>'+badge('150,000 لكل تسليم مستحق')+'</div>'+
     '<p class="dept-hint">المدرب يؤكد يدويًا أن رول الدورة أُعطي للمتدرب الناجح، ويُسجّل اسمه ووقت التسليم. لا يغير هذا الزر رولات Discord تلقائيًا.</p><div id="academyResultPanel"></div>';
    mountResults();
   }else{
    $('#departmentWork').innerHTML='<div id="departmentApplicants"></div>';
    await applicants();
   }
   await rewardPanel(dept);
  }
  if(head)await rolesPanel(dept);
 }
 async function renderAdmin(){
  if(!context().commander){$('#page').textContent='إدارة رئاسة الأقسام خاصة بالقائد فقط.';return}
  // Show one department per selection so event listeners remain attached.
  $('#page').innerHTML='<header class="dept-hero"><div><span class="dept-eyebrow">توزيع أدوار القيادة</span><h2>إدارة رئاسات الأقسام</h2><p>القائد يمنح رئاسة، مدرب، أو عضو لكل جهة على حدة. ولا يمكن لرئيس جهة أن يمنح أدوار الجهة الأخرى.</p></div></header>'+
   '<section class="section-card dept-section"><label>اختر القسم<select id="departmentAdminSelect"><option value="training">كلية التدريب</option><option value="recruitment">القبول والتجنيد</option></select></label><div id="departmentRolesPanel"></div></section>';
  const choose=$('#departmentAdminSelect');
  choose.onchange=()=>rolesPanel(choose.value,true);
  await rolesPanel('training',true);
 }
 return {render,renderAdmin,isMember,isHead,isTrainer,isAssigned,rewardPanel};
}
window.ASF_DEPARTMENTS={create};
})();