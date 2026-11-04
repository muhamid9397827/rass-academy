// Organized member-only notification inbox; Supabase RLS authorizes every row.
(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const classify=n=>{
 const k=n.event_kind||n.category||'';
 if(k.startsWith('academy'))return ['الدورات','🎓','academy-results','academy'];
 if(k==='access_decision')return ['قرار طلب الوصول','🛡','access','access'];
 if(k==='access_request')return ['طلب تصريح','🛡','access-queue','access'];
 if(k==='secret_report')return ['تقرير سري وارد','🔒','inbox','reports'];
 if(k==='report_received')return ['تم استلام تقريرك','✅','reports','reports'];
 if(k==='report')return ['تقرير جديد','📄','inbox','reports'];
 if(k==='registration')return ['طلب عضوية','👤','members','account'];
 if(k==='account_change')return ['تعديل بيانات','✎','changes','account'];
 return ['إشعار إداري','🔔','account','account'];
};
const tabs=[['all','الكل'],['unread','غير المقروءة'],['academy','الدورات'],['access','التصاريح'],['reports','التقارير'],['account','الحساب']];
function create({db,getUser,go,notify}){
 const trigger=document.getElementById('notificationTrigger'),counter=document.getElementById('notificationCount');
 let data=[],filter='all',version=0;
 function reset(){version++;data=[];filter='all';counter.hidden=true;counter.textContent='';}
 async function refreshBadge(){
  const u=getUser();if(!u){reset();return}
  const current=version;
  const {count,error}=await db.from('asf_notifications').select('id',{count:'exact',head:true}).is('read_at',null);
  if(error||current!==version||getUser()?.id!==u.id)return;
  counter.hidden=!count;counter.textContent=count>99?'99+':String(count||0);
  trigger.setAttribute('aria-label','مركز الإشعارات'+(count?'، '+count+' غير مقروء':''));
 }
 async function mark(id){
  const query=db.from('asf_notifications').update({read_at:new Date().toISOString()}).is('read_at',null);
  const {error}=await (id?query.eq('id',id):query);
  if(error){notify('تعذر تحديث الإشعارات: '+error.message,true);return false}
  const when=new Date().toISOString();data=data.map(n=>!id||n.id===id?{...n,read_at:n.read_at||when}:n);
  draw();refreshBadge();return true;
 }
 function draw(){
  const filters=document.getElementById('noticeFilters'),list=document.getElementById('noticeList');if(!filters||!list)return;
  filters.innerHTML=tabs.map(([k,label])=>'<button type="button" class="notice-filter'+(filter===k?' active':'')+'" data-tab="'+k+'" aria-pressed="'+(filter===k)+'">'+label+'</button>').join('');
  filters.querySelectorAll('button').forEach(b=>b.onclick=()=>{filter=b.dataset.tab;draw()});
  const rows=data.filter(n=>filter==='all'||(filter==='unread'?!n.read_at:classify(n)[3]===filter));
  list.innerHTML=rows.map(n=>{
   const [name,icon,to]=classify(n),unread=!n.read_at,stamp=new Date(n.created_at).toLocaleString('ar-SA',{dateStyle:'medium',timeStyle:'short'});
   return '<article class="notice-entry'+(unread?' unread':'')+'"><span class="notice-entry-icon" aria-hidden="true">'+icon+'</span><div class="notice-entry-content"><div class="notice-entry-top"><strong>'+name+'</strong>'+(unread?'<span class="notice-dot" title="غير مقروء"></span>':'')+'</div><p>'+esc(n.message)+'</p><small>'+esc(stamp)+'</small><div class="notice-entry-actions"><button type="button" class="btn ghost small" data-open="'+to+'" data-id="'+esc(n.id)+'">فتح القسم</button>'+(unread?'<button type="button" class="btn ghost small" data-read="'+esc(n.id)+'">تحديد كمقروء</button>':'')+'</div></div></article>';
  }).join('')||'<div class="empty">لا توجد إشعارات في هذا التصنيف.</div>';
  list.querySelectorAll('[data-read]').forEach(b=>b.onclick=()=>{b.disabled=true;mark(b.dataset.read).then(ok=>{if(!ok)b.disabled=false})});
  list.querySelectorAll('[data-open]').forEach(b=>b.onclick=async()=>{const id=b.dataset.id;if(data.find(n=>n.id===id&&!n.read_at))await mark(id);go(b.dataset.open)});
 }
 async function render(){
  if(!getUser())return;
  const page=document.getElementById('page'),current=version;
  page.innerHTML='<section class="section-card notice-center-heading"><div><span class="eyebrow">متابعة الإجراءات</span><h2>مركز الإشعارات</h2><p class="muted">الإشعارات الواردة لحسابك فقط، مع انتقال مباشر إلى الأقسام.</p></div><button class="btn ghost" type="button" id="noticeMarkAll">تحديد الكل كمقروء</button></section><div id="noticeFilters" class="notice-filters" role="group" aria-label="تصفية الإشعارات"></div><div id="noticeList" class="notice-center-list">جارٍ التحميل...</div><p class="muted notice-center-foot">يعرض أحدث 100 إشعار.</p>';
  const {data:items,error}=await db.from('asf_notifications').select('id,category,event_kind,message,created_at,read_at').order('created_at',{ascending:false}).limit(100);
  if(current!==version||!page.isConnected)return;
  if(error){page.querySelector('#noticeList').textContent='تعذر تحميل الإشعارات: '+error.message;return}
  data=items||[];draw();
  page.querySelector('#noticeMarkAll').onclick=async e=>{e.currentTarget.disabled=true;await mark();if(e.currentTarget.isConnected)e.currentTarget.disabled=false};
 }
 return {render,refreshBadge,reset};
}
window.ASF_NOTICE_CENTER={create};
})();