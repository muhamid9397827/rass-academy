/* ASF operational task ledger: no client-side authorization shortcuts. */
(() => {
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
const dates=v=>v?new Date(v).toLocaleString('ar-SA',{dateStyle:'short',timeStyle:'short'}):'—';
const labels={new:'جديدة',in_progress:'قيد التنفيذ',blocked:'متوقفة',done:'مكتملة'};
const priorities={normal:'عادية',high:'عالية',urgent:'عاجلة'};
function create({db,getContext,notify}){
 const $=s=>document.querySelector(s);
 const ctx=()=>getContext();
 let allTasks=[],allReports=[],reportReceipts=[],leadershipPeople=[];
 async function loadTasks(){
  const {data,error}=await db.from('asf_operations_tasks')
   .select('id,title,description,created_by,created_by_name,assigned_to,assigned_to_name,priority,status,reference_code,created_at,updated_at,completed_at')
   .order('updated_at',{ascending:false}).limit(200);
  if(error)throw error;
  allTasks=data||[];
 }
 async function loadReports(){
  const {data,error}=await db.from('asf_reports')
   .select('id,report_number,kind,title,submitted_at,author_id')
   .is('deleted_at',null).order('submitted_at',{ascending:false}).limit(35);
  if(error){allReports=[];reportReceipts=[];return;}
  allReports=data||[];
  const ids=allReports.map(r=>r.id);
  if(!ids.length)return;
  const res=await db.from('asf_report_receipts').select('report_id,received_at,last_opened_at').in('report_id',ids).limit(250);
  reportReceipts=res.data||[];
 }
 function taskCard(t){
  const status=labels[t.status]||t.status;
  return '<article class="section-card asf-task-card" data-task-card="'+esc(t.id)+'">'+
   '<div class="row between"><div><strong>'+esc(t.title)+'</strong><p class="muted">'+esc(t.reference_code||t.id.slice(0,8))+' · '+dates(t.created_at)+'</p></div><span class="badge">'+esc(status)+' · '+esc(priorities[t.priority]||t.priority)+'</span></div>'+
   (t.description?'<p style="white-space:pre-wrap">'+esc(t.description)+'</p>':'')+
   '<p class="muted">أنشأها: '+esc(t.created_by_name)+' · المكلف: '+esc(t.assigned_to_name)+' · آخر تحديث: '+dates(t.updated_at)+'</p>'+
   '<div class="row"><button type="button" class="btn ghost small" data-task-history="'+esc(t.id)+'">سجل الإجراءات</button>'+
   '<button type="button" class="btn primary small" data-task-edit="'+esc(t.id)+'">تحديث الحالة</button></div>'+
   '<div id="taskDetails-'+esc(t.id)+'"></div></article>';
 }
 function paintTasks(){
  const host=$('#operationsTasks');if(!host)return;
  const q=String($('#operationsSearch')?.value||'').trim().toLowerCase();
  const status=$('#operationsStatus')?.value||'all';
  const visible=allTasks.filter(t=>(status==='all'||t.status===status)&&
   (!q||[t.title,t.description,t.assigned_to_name,t.created_by_name,t.reference_code,t.id].some(s=>String(s||'').toLowerCase().includes(q))));
  host.innerHTML=visible.map(taskCard).join('')||'<div class="empty">لا توجد مهام مطابقة ضمن صلاحياتك.</div>';
  host.querySelectorAll('[data-task-history]').forEach(b=>b.onclick=async()=>{
   const el=document.getElementById('taskDetails-'+b.dataset.taskHistory);
   if(!el)return;
   if(el.dataset.expanded==='1'){el.innerHTML='';el.dataset.expanded='0';return;}
   el.textContent='جاري تحميل سجل المهمة…';
   const {data,error}=await db.from('asf_operations_task_events')
    .select('action,actor_name,previous_status,next_status,note,created_at')
    .eq('task_id',b.dataset.taskHistory).order('created_at',{ascending:false}).limit(100);
   if(!el.isConnected)return;
   el.dataset.expanded='1';
   el.innerHTML=error?'<p>'+esc(error.message)+'</p>':
    '<div class="notice" style="margin-top:12px"><h4>تاريخ إجراءات المهمة</h4>'+
    (data||[]).map(e=>'<p><strong>'+esc(e.actor_name)+'</strong> · '+dates(e.created_at)+' · '+
     esc(e.action==='created'?'أنشأ المهمة':(labels[e.previous_status]||'')+' ← '+(labels[e.next_status]||''))+
     (e.note?'<br>'+esc(e.note):'')+'</p>').join('')+'</div>';
  });
  host.querySelectorAll('[data-task-edit]').forEach(b=>b.onclick=()=>{
   const el=document.getElementById('taskDetails-'+b.dataset.taskEdit),t=allTasks.find(x=>x.id===b.dataset.taskEdit);
   if(!el||!t)return;
   el.dataset.expanded='1';
   el.innerHTML='<form class="asf-task-update" style="margin-top:12px"><label>الحالة الجديدة<select name="status">'+
    Object.entries(labels).map(([k,v])=>'<option value="'+k+'"'+(t.status===k?' selected':'')+'>'+v+'</option>').join('')+
    '</select></label><label>ملاحظة الإجراء (اختياري)<textarea name="note" maxlength="1000" rows="2"></textarea></label>'+
    '<button class="btn primary" type="submit">تثبيت التحديث باسم المسؤول</button></form>';
   el.querySelector('form').onsubmit=async event=>{
    event.preventDefault();
    const button=event.target.querySelector('button'),form=new FormData(event.target);
    button.disabled=true;
    const {error}=await db.rpc('asf_update_operation_task',{p_task:t.id,p_status:String(form.get('status')),p_note:String(form.get('note')||'')});
    if(error){notify(error.message,true);button.disabled=false;return;}
    notify('تم تسجيل حالة المهمة واسم المنفّذ في سجل العمليات.');
    await render();
   };
  });
 }
 function paintReports(){
  const host=$('#operationsReports');if(!host)return;
  host.innerHTML=allReports.length?
   '<div class="table-scroll"><table><thead><tr><th>رقم التقرير</th><th>الموضوع</th><th>تاريخ التقديم</th><th>التتبع</th></tr></thead><tbody>'+
   allReports.map(r=>{
    const rs=reportReceipts.filter(x=>x.report_id===r.id);
    const received=rs.filter(x=>x.received_at).length,opened=rs.filter(x=>x.last_opened_at).length;
    return '<tr><td>RPT-'+String(r.report_number).padStart(6,'0')+'</td><td>'+esc(r.title)+'</td><td>'+dates(r.submitted_at)+'</td>'+
     '<td>'+(received?'تم الاستلام من '+received+' جهة/مسؤول':opened?'تم فتحه من '+opened+' جهة/مسؤول':'لم يُسجل استلام بعد')+'</td></tr>';
   }).join('')+'</tbody></table></div>':
   '<p class="muted">لا توجد تقارير ظاهرة ضمن صلاحيات هذا الحساب.</p>';
 }
 async function diagnostics(){
  const host=$('#operationsDiagnostics');if(!host)return;
  host.textContent='جارٍ فحص الاتصالات الأساسية…';
  const out=[];
  try{
   const {data,error}=await db.auth.getUser();
   out.push(['جلسة الدخول',!error&&!!data?.user,error?'تعذر التحقق من الجلسة':'التحقق من الهوية']);
  }catch(error){out.push(['جلسة الدخول',false,error.message]);}
  try{
   const {error}=await db.from('asf_profiles').select('status').eq('user_id',ctx().user.id).maybeSingle();
   out.push(['قاعدة بيانات العضويات',!error,error?.message||'الاتصال والقراءة يعملان']);
  }catch(error){out.push(['قاعدة بيانات العضويات',false,error.message]);}
  try{
   const {error}=await db.from('asf_operations_tasks').select('id').limit(1);
   out.push(['مركز المهام',!error,error?.message||'القراءة ضمن الصلاحيات تعمل']);
  }catch(error){out.push(['مركز المهام',false,error.message]);}
  if(!host.isConnected)return;
  host.innerHTML=out.map(([label,ok,detail])=>'<p><strong>'+(ok?'✓ ':'⚠ ')+esc(label)+'</strong> — '+esc(ok?'متصل':'تعذر الاتصال')+'<small class="muted"> · '+esc(detail)+'</small></p>').join('')+
   '<small class="muted">هذا فحص اتصال أساسي، ولا يثبت جاهزية إرسال البريد أو تحمل أعداد كبيرة من المستخدمين.</small>';
 }
 const memberSections=p=>[
  (p.training_head||p.training_trainer)&&'training',
  (p.recruitment_head||p.recruitment_trainer)&&'recruitment',
  (p.police_head||p.police_staff)&&'police',
  (p.court_head||p.court_staff)&&'court'
 ].filter(Boolean);
 const sectionNames={training:'كلية التدريب',recruitment:'القبول والتجنيد',police:'الشرطة العسكرية',court:'مجلس القضاء'};
 async function showCommanderStats(){
  const host=$('#operationsLeadershipStats');if(!host||!ctx().commander)return;
  const count=async query=>{try{const {count,error}=await query;return error?'غير متاح':String(count??'غير متاح')}catch{return 'غير متاح'}};
  const [results,newReports,serviceRewards,departmentRewards]=await Promise.all([
   count(db.from('asf_academy_results').select('id',{count:'exact',head:true})),
   count(db.from('asf_reviews').select('report_id',{count:'exact',head:true}).eq('state','new')),
   count(db.from('asf_service_rewards').select('id',{count:'exact',head:true}).is('paid_at',null)),
   count(db.from('asf_department_rewards').select('id',{count:'exact',head:true}).is('paid_at',null))
  ]);
  if(!host.isConnected)return;
  const pendingRewards=serviceRewards==='غير متاح'||departmentRewards==='غير متاح'?'غير متاح':String(Number(serviceRewards)+Number(departmentRewards));
  const values=[
   ['أعضاء معتمدون',leadershipPeople.filter(p=>p.status==='approved').length],
   ['طلبات تفعيل معلقة',leadershipPeople.filter(p=>p.status==='pending').length],
   ['نتائج الاختبارات',results],['تقارير جديدة',newReports],
   ['مهام مفتوحة',allTasks.filter(t=>t.status!=='done').length],['مكافآت قيد الصرف',pendingRewards]
  ];
  host.innerHTML=values.map(([label,value])=>'<div class="section-card"><strong style="font-size:25px">'+esc(value)+'</strong><p class="muted">'+esc(label)+'</p></div>').join('');
 }
 function showPeopleDirectory(){
  const host=$('#operationsPeopleResults');if(!host)return;
  const search=String($('#operationsPeopleSearch')?.value||'').trim().toLowerCase();
  const section=$('#operationsPeopleSection')?.value||'all',rank=$('#operationsPeopleRank')?.value||'all';
  const status=$('#operationsPeopleStatus')?.value||'all';
  const matches=leadershipPeople.filter(p=>
   (status==='all'||p.status===status)&&(rank==='all'||p.rank===rank)&&
   (section==='all'||memberSections(p).includes(section))&&
   (!search||[p.game_name,p.rank,p.military_code].some(x=>String(x||'').toLowerCase().includes(search)))
  );
  host.innerHTML='<p class="muted">'+matches.length+' نتيجة ضمن '+leadershipPeople.length+' حسابًا إداريًا ظاهرًا للقائد</p>'+(
   matches.length?'<div class="table-scroll"><table><thead><tr><th>الاسم</th><th>الرتبة</th><th>الكود</th><th>الحالة</th><th>الأقسام</th></tr></thead><tbody>'+matches.slice(0,100).map(p=>
    '<tr><td>'+esc(p.game_name)+'</td><td>'+esc(p.rank||'—')+'</td><td>'+esc(p.military_code||'—')+'</td><td>'+esc(p.status||'—')+'</td><td>'+esc(memberSections(p).map(x=>sectionNames[x]).join('، ')||'عضو عام')+'</td></tr>'
   ).join('')+'</tbody></table></div>':'<div class="empty">لا توجد نتائج مطابقة.</div>');
 }
 async function showRecentAudit(){
  const host=$('#operationsRecentAudit');if(!host||!ctx().commander)return;
  const {data,error}=await db.from('asf_audit').select('action,target_id,created_at').order('created_at',{ascending:false}).limit(12);
  if(!host.isConnected)return;
  host.innerHTML=error?'<p class="muted">تعذر تحميل سجل الإجراءات.</p>':(data||[]).map(row=>
   '<p><strong>'+esc(row.action)+'</strong> · '+dates(row.created_at)+'<small class="muted"> · '+esc(row.target_id||'—')+'</small></p>'
  ).join('')||'<p class="muted">لا توجد إجراءات مسجلة.</p>';
 }
 async function render(){
  const c=ctx();
  if(!c.user||(!c.commander&&c.profile?.status!=='approved'))throw Error('حساب معتمد مطلوب');
  const page=$('#page');if(!page)return;
  await Promise.all([loadTasks(),loadReports()]);
  if(!page.isConnected)return;
  const canCreate=!!c.commander;
  let people=[];
  if(canCreate){
   const directory=await db.rpc('asf_management_directory');
   leadershipPeople=!directory.error&&Array.isArray(directory.data)?directory.data:[];
   if(!leadershipPeople.length){
    const fallback=await db.from('asf_profiles').select('user_id,game_name,military_code,rank,status').order('game_name').limit(350);
    leadershipPeople=fallback.data||[];
   }
   people=leadershipPeople.filter(p=>p.status==='approved');
  }
  const ranks=[...new Set(leadershipPeople.map(p=>p.rank).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  page.innerHTML=(canCreate?'<section class="section-card"><h3>مؤشرات القيادة</h3><div class="grid three" id="operationsLeadershipStats">جاري تحميل المؤشرات…</div><p class="muted">تُحسب المؤشرات من السجلات التي تسمح قاعدة البيانات للقائد بقراءتها.</p></section>':'')+
   '<section class="section-card"><h3>مركز العمليات — متابعة المعاملات</h3><p class="muted">تُعرض فقط المهام والتقارير المسموح لحسابك بالاطلاع عليها. تظهر حالة التقرير تلقائيًا بعد تسجيل فتحه أو استلامه، وتبقى الموافقة الرسمية إجراءً مستقلًا.</p><div id="operationsReports"></div></section>'+
   '<section class="section-card"><div class="row between"><h3>مركز المهام</h3><span class="badge">'+allTasks.length+' مهمة ظاهرة</span></div>'+
    '<p class="muted">كل تحديث يُسجّل باسم صاحبه وتوقيته، ولا يمكن للموظف إعادة فتح مهمة مكتملة دون القائد.</p>'+
    '<div class="row"><input id="operationsSearch" type="search" placeholder="بحث بالاسم أو الموضوع أو مرجع المعاملة" style="max-width:400px"><select id="operationsStatus">'+
    '<option value="all">جميع الحالات</option>'+Object.entries(labels).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></div>'+
    '<div id="operationsTasks"></div></section>'+
   (canCreate?'<section class="section-card"><h3>دليل الأعضاء الإداري</h3><p class="muted">بحث وتصفية للقائد فقط؛ لا يعرض البريد أو أسرار المصادقة.</p><div class="grid three"><label>بحث<input id="operationsPeopleSearch" type="search" placeholder="الاسم أو الرتبة أو الكود"></label><label>القسم<select id="operationsPeopleSection"><option value="all">كل الأقسام</option>'+Object.entries(sectionNames).map(([key,label])=>'<option value="'+key+'">'+label+'</option>').join('')+'</select></label><label>الرتبة<select id="operationsPeopleRank"><option value="all">كل الرتب</option>'+ranks.map(value=>'<option value="'+esc(value)+'">'+esc(value)+'</option>').join('')+'</select></label><label>الحالة<select id="operationsPeopleStatus"><option value="all">كل الحالات</option><option value="approved">مفعّل</option><option value="pending">قيد المراجعة</option><option value="suspended">ملغى التفعيل</option><option value="rejected">مرفوض</option></select></label></div><div id="operationsPeopleResults"></div></section>':'')+
   (canCreate?'<section class="section-card"><h3>آخر إجراءات النظام</h3><div id="operationsRecentAudit">جاري تحميل السجل…</div></section>':'')+
   (canCreate?'<section class="section-card"><h3>تكليف مهمة جديدة</h3><form id="operationsCreate"><label>عنوان المهمة<input name="title" required minlength="4" maxlength="180"></label>'+
    '<label>وصف وتوجيهات<textarea name="description" maxlength="4000" rows="3"></textarea></label><div class="grid two">'+
    '<label>المكلف<select name="assignee" required>'+people.map(p=>'<option value="'+esc(p.user_id)+'">'+esc(p.game_name)+' — '+esc(p.military_code||'')+'</option>').join('')+'</select></label>'+
    '<label>الأولوية<select name="priority">'+Object.entries(priorities).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></label></div>'+
    '<label>مرجع المعاملة (اختياري)<input name="reference" maxlength="100" placeholder="مثال: RPT-000123 أو رقم القضية"></label>'+
    '<p class="muted">لا تضع تفاصيل تقارير «سري للغاية» داخل مهام موجهة لأعضاء آخرين.</p>'+
    '<button class="btn primary" type="submit">إسناد المهمة وتوثيقها</button></form></section>':'')+
   '<section class="section-card"><div class="row between"><h3>الحالة الصحية وتشخيص الأعطال</h3><button type="button" class="btn ghost small" id="operationsHealthRefresh">إعادة الفحص</button></div><div id="operationsDiagnostics" aria-live="polite"></div></section>';
  paintReports();paintTasks();$('#operationsSearch').oninput=paintTasks;$('#operationsStatus').onchange=paintTasks;
  $('#operationsHealthRefresh').onclick=diagnostics;diagnostics();
  if(canCreate){
   showCommanderStats();showPeopleDirectory();showRecentAudit();
   ['operationsPeopleSearch','operationsPeopleSection','operationsPeopleRank','operationsPeopleStatus'].forEach(id=>$('#'+id).oninput=showPeopleDirectory);
   $('#operationsCreate').onsubmit=async e=>{
    e.preventDefault();const form=new FormData(e.target),button=e.target.querySelector('[type="submit"]');
    button.disabled=true;
    try{
     const {error}=await db.rpc('asf_create_operation_task',{
      p_title:String(form.get('title')||'').trim(),p_description:String(form.get('description')||''),
      p_assignee:String(form.get('assignee')||''),p_priority:String(form.get('priority')||'normal'),
      p_reference_code:String(form.get('reference')||'')
     });
     if(error)throw error;
     notify('تم إسناد المهمة وإرسال الإشعار للمكلف.');await render();
    }catch(error){notify(error.message,true);button.disabled=false;}
   };
  }
 }
 return {render};
}
window.ASF_OPERATIONS={create};
})();
