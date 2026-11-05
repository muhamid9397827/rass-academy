/* Unified administrative access center. Only server RPCs decide who may grant roles. */
(() => {
 'use strict';
 const $=selector=>document.querySelector(selector);
 const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const SECTIONS={
  training:{name:'كلية التدريب',staff:'مدرب كلية التدريب',head:'رئاسة كلية التدريب',key:'training_trainer'},
  recruitment:{name:'القبول والتجنيد',staff:'مدرب القبول والتجنيد',head:'رئاسة القبول والتجنيد',key:'recruitment_trainer'},
  police:{name:'الشرطة العسكرية',staff:'عامل الشرطة العسكرية',head:'رئاسة الشرطة العسكرية',key:'police_staff'},
  court:{name:'مجلس القضاء العسكري',staff:'عامل مجلس القضاء',head:'رئاسة مجلس القضاء العسكري',key:'court_staff'}
 };
 const STATUS={
  pending:['قيد المراجعة','pending'],approved:['مفعّل','approved'],
  rejected:['مرفوض','rejected'],suspended:['ملغى التفعيل','suspended']
 };
 const norm=value=>String(value??'').normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g,'').toLowerCase().trim();
 function create({db,getContext,notify}){
  let members=[],filter='pending',search='',busy=false;
  const ctx=()=>getContext();
  const canStaff=section=>{
   const c=ctx();
   return c.commander||section==='training'&&c.trainingHead||
    section==='recruitment'&&c.recruitmentHead||
    section==='police'&&c.policeHead;
  };
  const canDeactivate=()=>ctx().commander||ctx().trainingHead||ctx().recruitmentHead||ctx().policeHead||ctx().courtHead;
  const statusTag=value=>{
   const [title,key]=STATUS[value]||[value,'pending'];
   return '<span class="ac-status ac-'+esc(key)+'">'+esc(title)+'</span>';
  };
  const hasLeadership=p=>p.training_head||p.recruitment_head||p.police_head||p.court_head;
  function head(){
   const stat=key=>members.filter(p=>p.status===key).length;
   return '<header class="ac-hero"><div><span class="ac-eyebrow">الإدارة الموحدة · إدارة الوصول</span>'+
    '<h2>مركز العضويات والصلاحيات</h2><p>مكان واحد لتفعيل الأعضاء وإدارة العاملين في الأقسام الأربعة. الرئاسات تُعيَّن من القائد فقط.</p></div>'+
    '<div class="ac-hero-summary"><strong>'+stat('pending')+'</strong><small>طلبات تنتظر القرار</small></div></header>'+
    '<div class="ac-kpis">'+[['approved','حساب مفعّل'],['pending','طلب جديد'],['suspended','إلغاء تفعيل'],['rejected','طلب مرفوض']].map(([k,title])=>
     '<button type="button" class="ac-kpi'+(filter===k?' active':'')+'" data-ac-filter="'+k+'"><strong>'+stat(k)+'</strong><span>'+title+'</span></button>').join('')+'</div>'+
    '<section class="section-card ac-content"><div class="ac-toolbar">'+
    '<label>بحث عن عسكري<input type="search" id="acSearch" placeholder="الاسم أو الكود أو Discord ID" autocomplete="off" value="'+esc(search)+'"></label>'+
    '<label>عرض الحسابات<select id="acFilter">'+Object.entries(STATUS).map(([key,[label]])=>'<option value="'+key+'"'+(key===filter?' selected':'')+'>'+esc(label)+'</option>').join('')+'<option value="all"'+(filter==='all'?' selected':'')+'>جميع الحسابات</option></select></label></div>'+
    '<div class="ac-help">منح وسحب الرولات يخص البوابة فقط ولا يغيّر رولات Discord تلقائيًا. إلغاء العضوية يسحب صلاحيات البوابة ويطلب حظر تسجيل الدخول في Auth.</div>'+
    '<div id="acFeedback" aria-live="polite"></div><div id="acRows" class="ac-member-list"></div></section>';
  }
  function controls(p){
   if(p.status==='pending'){
    return '<div class="ac-account-actions">'+
     (String(p.activation_reason||'').trim().length>=10?
      '<button type="button" class="btn primary small" data-ac-action="approve" data-ac-user="'+esc(p.user_id)+'">✓ تفعيل العضوية</button>':
      '<span class="ac-note">بانتظار سبب طلب التفعيل</span>')+
     '<button type="button" class="btn warn small" data-ac-action="reject" data-ac-user="'+esc(p.user_id)+'">رفض الطلب</button></div>';
   }
   if(p.status==='approved'){
    return canDeactivate()&&!(!ctx().commander&&hasLeadership(p))?
     '<div class="ac-account-actions"><button type="button" class="btn warn small" data-ac-action="suspend" data-ac-user="'+esc(p.user_id)+'">إلغاء التفعيل وسحب الصلاحيات</button></div>':
     '<span class="ac-note">هذا الحساب محمي من إلغاء التفعيل عبر تفويض آخر.</span>';
   }
   return ctx().commander&&String(p.activation_reason||'').trim().length>=10?
    '<button type="button" class="btn ghost small" data-ac-action="approve" data-ac-user="'+esc(p.user_id)+'">إعادة التفعيل · القائد</button>':
    '<span class="ac-note">مغلق — إعادة التفعيل لدى القائد فقط</span>';
  }
  function staffRoles(p){
   if(p.status!=='approved')return '';
   const options=Object.entries(SECTIONS).filter(([key])=>canStaff(key));
   if(!options.length)return '';
   return '<div class="ac-role-list">'+options.map(([section,role])=>{
    const enabled=!!p[role.key];
    return '<button type="button" class="ac-role-toggle'+(enabled?' on':'')+'" aria-pressed="'+enabled+'"'+
     ' data-ac-staff="'+section+'" data-ac-user="'+esc(p.user_id)+'" data-ac-enable="'+!enabled+'">'+
     '<span class="ac-role-icon">'+(enabled?'✓':'+')+'</span><span>'+esc(role.staff)+'</span>'+
     '<small>'+(enabled?'مفعّل · اضغط للسحب':'غير مفعّل · اضغط للمنح')+'</small></button>';
   }).join('')+'</div>';
  }
  function card(p){
   const headNames=Object.entries(SECTIONS).filter(([key])=>p[key+'_head']).map(([,x])=>x.head);
   return '<article class="ac-member" data-ac-card="'+esc(p.user_id)+'"><div class="ac-member-main">'+
    '<div class="ac-avatar" aria-hidden="true">'+esc(String(p.game_name||'؟').trim()[0]||'؟')+'</div>'+
    '<div class="ac-details"><div class="ac-name"><strong>'+esc(p.game_name)+'</strong>'+statusTag(p.status)+'</div>'+
    '<div class="ac-meta"><span>'+esc(p.rank||'—')+'</span><span>'+esc(p.military_code||'بلا كود')+'</span><span dir="ltr">'+esc(p.discord_id||'')+'</span></div>'+
    (headNames.length?'<div class="ac-leadership">'+headNames.map(x=>'<span>★ '+esc(x)+'</span>').join('')+'</div>':'')+'</div></div>'+
    (p.status==='pending'?'<p class="ac-reason">سبب طلب التفعيل: '+esc(p.activation_reason||'لم يُقدَّم بعد')+'</p>':'')+
    '<div class="ac-bottom">'+staffRoles(p)+controls(p)+'</div></article>';
  }
  function paint(){
   const area=$('#acRows');if(!area)return;
   const q=norm(search);
   const list=members.filter(p=>(filter==='all'||p.status===filter)&&
    norm([p.game_name,p.rank,p.military_code,p.discord_id].join(' ')).includes(q));
   area.innerHTML=list.length?list.map(card).join(''):'<div class="empty">لا توجد حسابات مطابقة لهذا البحث.</div>';
   area.querySelectorAll('button[data-ac-staff]').forEach(button=>button.onclick=()=>performStaff(button));
   area.querySelectorAll('button[data-ac-action]').forEach(button=>button.onclick=()=>performStatus(button));
   $('#acFilter').value=filter;
   $('#acSearch').value=search;
   document.querySelectorAll('[data-ac-filter]').forEach(b=>b.classList.toggle('active',b.dataset.acFilter===filter));
  }
  async function reload(){
   const {data,error}=await db.rpc('asf_management_directory');
   if(error)throw error;
   members=data||[];
   if($('#acRows')){const hero=$('.ac-hero-summary');if(hero)hero.querySelector('strong').textContent=members.filter(p=>p.status==='pending').length;
    document.querySelectorAll('[data-ac-filter]').forEach(b=>{b.querySelector('strong').textContent=members.filter(p=>p.status===b.dataset.acFilter).length;});
    paint();}
  }
  async function withBusy(fn){
   if(busy)return;
   busy=true;document.querySelectorAll('#page [data-ac-user]').forEach(b=>b.disabled=true);
   try{await fn();}catch(error){notify(error.message||'تعذر حفظ التغيير',true)}
   finally{busy=false;document.querySelectorAll('#page [data-ac-user]').forEach(b=>b.disabled=false);}
  }
  async function performStaff(button){
   const id=button.dataset.acUser,section=button.dataset.acStaff,enable=button.dataset.acEnable==='true';
   if(!canStaff(section))return notify('لا تملك صلاحية توزيع هذا الرول.',true);
   if(!enable&&!confirm('هل تؤكد سحب رول '+SECTIONS[section].staff+'؟'))return;
   await withBusy(async()=>{
    const {error}=await db.rpc('asf_management_set_staff',{p_user:id,p_section:section,p_enable:enable});
    if(error)throw error;
    await reload();
    notify(enable?'تم منح الرول وتحديث حالة العضو.':'تم سحب الرول وتحديث حالة العضو.');
   });
  }
  async function syncAuthBan(target,mode){
   // Never let a read/render error skip Auth synchronization after the DB transition.
   try{
    const {data,error}=await db.functions.invoke('asf-member-auth-ban',{body:{target,mode}});
    return !error&&data?.ok===true;
   }catch(_error){return false;}
  }
  async function performStatus(button){
   const id=button.dataset.acUser,action=button.dataset.acAction,p=members.find(m=>m.user_id===id);
   if(!p)return;
   const question=action==='suspend'?'إلغاء تفعيل '+p.game_name+' وسحب جميع صلاحياته داخل البوابة؟':
     action==='reject'?'رفض طلب '+p.game_name+' وإغلاق الوصول؟':
     'تأكيد '+(p.status==='pending'?'تفعيل':'إعادة تفعيل')+' '+p.game_name+'؟';
   if(!confirm(question))return;
   await withBusy(async()=>{
    const oldStatus=p.status;
    const {error}=await db.rpc('asf_admin_action',{op:action,target:id,arg:null});
    if(error)throw error;
    const isBan=action==='suspend'||action==='reject';
    const shouldSync=isBan||oldStatus==='suspended'||oldStatus==='rejected';
    // This must happen immediately after the committed status change: a failed
    // directory read must never prevent the security-relevant Auth ban/unban.
    const authOk=!shouldSync||await syncAuthBan(id,isBan?'ban':'unban');
    // Keep the affected member visible in its new status instead of silently
    // removing the row from the pending queue after approving/rejecting it.
    filter=action==='approve'?'approved':action==='reject'?'rejected':'suspended';
    let refreshed=true;
    try{await reload();}catch(_error){refreshed=false;}
    const feedback=$('#acFeedback');
    if(!authOk){
     notify(isBan?'تم إلغاء صلاحيات البوابة وتحديث حالة الحساب، لكن تعذر تأكيد حظره من Supabase Auth؛ يجب إتمام الحظر.':
      'تم تحديث عضوية البوابة، لكن تعذر تأكيد رفع الحظر من Supabase Auth.',true);
     if(feedback)feedback.textContent='تنبيه: يحتاج حظر أو رفع حظر Supabase Auth إلى إعادة المحاولة من المسؤول.';
    }else if(!refreshed){
     notify('تم حفظ قرار العضوية ومزامنة Auth، لكن تعذر تحديث القائمة. أعد فتح المركز للتحقق.',true);
    }else{
     notify(action==='approve'?'تم تفعيل العضوية وتحديث حالة الحساب.':action==='reject'?'تم رفض الطلب وإغلاق صلاحيات البوابة.':'تم إلغاء التفعيل وسحب الصلاحيات وتأكيد حظر Auth.');
    }
   });
  }
  async function render(){
   if(!ctx().canManageMembers&&!ctx().commander&&!ctx().canApprove)return $('#page').textContent='هذا القسم للقيادة والقبول المفوض فقط.';
   $('#page').innerHTML='<div class="section-card">جاري تحميل العضويات والصلاحيات…</div>';
   try{
    const {data,error}=await db.rpc('asf_management_directory');
    if(error)throw error;
    members=data||[];
    // Delegated admissions see pending requests only.
    if(!ctx().canManageMembers&&!ctx().commander)filter='pending';
    $('#page').innerHTML=head();
    $('#acSearch').oninput=e=>{search=e.target.value;paint()};
    $('#acFilter').onchange=e=>{filter=e.target.value;paint()};
    document.querySelectorAll('[data-ac-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.acFilter;paint()});
    paint();
   }catch(error){$('#page').textContent='تعذر تحميل مركز العضويات: '+(error.message||'خطأ غير معروف');throw error}
  }
  async function renderHeads(){
   if(!ctx().commander)return $('#page').textContent='تعيين الرئاسات مخصص للقائد فقط.';
   const {data,error}=await db.rpc('asf_management_directory');if(error)throw error;
   members=data||[];
   const approved=members.filter(p=>p.status==='approved');
   $('#page').innerHTML='<header class="ac-hero"><div><span class="ac-eyebrow">إدارة القيادة العليا</span><h2>توزيع رئاسات الأقسام</h2>'+
    '<p>القائد وحده يعيّن رؤساء كلية التدريب والقبول والتجنيد والشرطة العسكرية ومجلس القضاء العسكري. العاملون والمدربون يُدارون من مركز العضويات.</p></div></header>'+
    '<section class="section-card ac-content"><label>ابحث عن عضو معتمد<input id="acHeadSearch" type="search" placeholder="الاسم أو الكود"></label>'+
    '<div id="acHeadRows" class="ac-member-list"></div></section>';
   const draw=()=>{
    const q=norm($('#acHeadSearch').value);
    const list=approved.filter(p=>norm([p.game_name,p.military_code,p.rank].join(' ')).includes(q)).slice(0,75);
    $('#acHeadRows').innerHTML=list.map(p=>'<article class="ac-member"><div class="ac-name"><strong>'+esc(p.game_name)+'</strong>'+statusTag(p.status)+'</div>'+
     '<div class="ac-meta">'+esc(p.rank)+' · '+esc(p.military_code)+'</div>'+
     '<div class="ac-role-list">'+Object.entries(SECTIONS).map(([key,section])=>{
      const enabled=!!p[key+'_head'];
      return '<button type="button" class="ac-role-toggle'+(enabled?' on':'')+'" data-head-user="'+esc(p.user_id)+'" data-head-section="'+key+'" data-head-enable="'+!enabled+'" aria-pressed="'+enabled+'">'+
       '<span class="ac-role-icon">'+(enabled?'✓':'+')+'</span><span>'+esc(section.head)+'</span><small>'+(enabled?'سحب الرئاسة':'تعيين الرئاسة')+'</small></button>';
     }).join('')+'</div></article>').join('')||'<div class="empty">لا يوجد أعضاء معتمدون مطابقون.</div>';
    $('#acHeadRows').querySelectorAll('[data-head-user]').forEach(button=>button.onclick=async()=>{
     if(busy)return;
     const target=button.dataset.headUser,section=button.dataset.headSection,enable=button.dataset.headEnable==='true';
     if(!confirm((enable?'تعيين ':'سحب ')+SECTIONS[section].head+'؟'))return;
     busy=true;button.disabled=true;
     try{
      const {error:err}=await db.rpc('asf_management_set_head',{p_user:target,p_section:section,p_enable:enable});
      if(err)throw err;
      const {data:updated,error:readError}=await db.rpc('asf_management_directory');
      if(readError)throw readError;
      members=updated||[];
      approved.splice(0,approved.length,...members.filter(member=>member.status==='approved'));
      draw();notify('تم تحديث رئاسة القسم وتوثيق الإجراء.');
     }catch(error){notify(error.message||'تعذر تعديل الرئاسة',true);button.disabled=false}
     finally{busy=false;}
    });
   };
   $('#acHeadSearch').oninput=draw;draw();
  }
  return {render,renderHeads};
 }
 window.ASF_MEMBER_CENTER=Object.freeze({create});
})();
