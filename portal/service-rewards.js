// Police and judicial merit rewards. Only server-verified completed cases count.
// The UI never grants a bonus or marks payment directly; RPC authorization is authoritative.
(() => {
 'use strict';
 const $=selector=>document.querySelector(selector);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));
 const fmt=t=>t?new Date(t).toLocaleString('ar-SA',{dateStyle:'short',timeStyle:'short'}):'—';
 const amount=n=>new Intl.NumberFormat('en-US').format(Number(n||0));
 function create({db,getContext,notify}){
  let generation=0;
  async function mount(department){
   if(!['police','court'].includes(department))return;
   const main=$('#page');if(!main)return;
   const prior=$('#serviceRewardsPanel');if(prior)prior.remove();
   const host=document.createElement('section');
   host.id='serviceRewardsPanel';host.className='section-card';host.style.marginTop='20px';
   main.append(host);
   const current=++generation,ctx=getContext(),myId=ctx.user?.id;
   const label=department==='police'?'الشرطة العسكرية':'مجلس القضاء';
   const rewardAmount=department==='police'?100000:150000;
   const canPay=ctx.commander||(department==='police'&&ctx.policeHead);
   host.innerHTML='<h3>مكافآت جهود '+label+'</h3><p class="muted">مكافأة '+amount(rewardAmount)+
    ' عن كل قضية موثقة صدر فيها قرار قضائي: تُسجّل للشرطة العسكرية لمُحيل القضية، ولمجلس القضاء لصاحب القرار. لا تُحسب المسودات أو العمليات المتكررة. الصرف توثيق يدوي مستقل من رئاسة مخولة، ولا يمكن لأي شخص تأكيد مكافأته لنفسه.</p><div id="serviceRewardsBody">جارٍ تحميل الاستحقاقات…</div>';
   const [rewardsRes,casesRes,decisionsRes]=await Promise.all([
    db.from('asf_service_rewards').select('id,case_id,subject_label,actor_id,actor_name,amount,earned_at,paid_at,paid_by_name').eq('department',department).order('earned_at',{ascending:false}).limit(100),
    db.from('asf_court_cases').select('id,subject,submitted_by,created_at').order('created_at',{ascending:false}).limit(120),
    db.from('asf_court_decisions').select('case_id,decided_by,decided_at').limit(120)
   ]);
   if(current!==generation||!host.isConnected)return;
   const box=host.querySelector('#serviceRewardsBody');
   if(rewardsRes.error){box.textContent='تعذر تحميل المكافآت: '+rewardsRes.error.message;return;}
   const rewards=rewardsRes.data||[];
   const decided=new Map((decisionsRes.data||[]).map(row=>[row.case_id,row]));
   const claimable=(casesRes.data||[]).filter(c=>{
    const d=decided.get(c.id);
    return d&&(department==='police'?c.submitted_by===myId:d.decided_by===myId)&&!rewards.some(r=>r.case_id===c.id);
   });
   box.innerHTML='<div class="row between"><strong>سجل المكافآت</strong><span class="muted">'+rewards.filter(r=>!r.paid_at).length+' بانتظار الصرف</span></div>'+
    (rewards.length?rewards.map(r=>
     '<article class="dept-record" style="margin:12px 0;padding:14px;border:1px solid var(--line);border-radius:12px"><strong>'+esc(r.actor_name)+'</strong> — '+esc(r.subject_label)+
     '<p class="muted">المكافأة: '+amount(r.amount)+' · '+fmt(r.earned_at)+'</p>'+
     (r.paid_at?'<p>✓ تم تأكيد صرف المكافأة بواسطة '+esc(r.paid_by_name||'الرئاسة')+' — '+fmt(r.paid_at)+'</p>':
     '<p>بانتظار اعتماد الصرف</p>'+(canPay&&r.actor_id!==myId?'<button type="button" class="btn primary small" data-service-pay="'+esc(r.id)+'">✓ تم إعطاء المكافأة</button>':''))+'</article>'
    ).join(''):'<p class="muted">لم تُسجّل استحقاقات لهذا القسم بعد.</p>')+
    (claimable.length?'<h4>قضايا مكتملة تستحق تسجيل مكافأة</h4>'+claimable.map(c=>
     '<article class="dept-record" style="margin:12px 0;padding:14px;border:1px solid var(--line);border-radius:12px">'+
     '<strong>'+esc(c.subject)+'</strong><p class="muted">القضية لها قرار قضائي مسجّل؛ لم تُسجل لها مكافأة من قبل.</p>'+
     '<button type="button" class="btn ghost small" data-service-claim="'+esc(c.id)+'">تسجيل استحقاق '+amount(rewardAmount)+'</button></article>'
    ).join(''):'');
   box.querySelectorAll('[data-service-claim]').forEach(button=>button.onclick=async()=>{
    if(!confirm('تسجيل مكافأة افتراضية مستحقة للقضية بعد التحقق من القرار القضائي؟ لا يعني صرفها فعلياً.'))return;
    button.disabled=true;
    const {error}=await db.rpc('asf_service_reward_claim',{p_case:button.dataset.serviceClaim,p_department:department});
    if(error){notify(error.message||'تعذر حفظ الاستحقاق',true);button.disabled=false;return;}
    notify('تم تسجيل الاستحقاق وينتظر تأكيد الصرف.');await mount(department);
   });
   box.querySelectorAll('[data-service-pay]').forEach(button=>button.onclick=async()=>{
    if(!confirm('هل تم صرف المكافأة فعلياً؟ سيُحفظ اسمك وتوقيت التأكيد.'))return;
    button.disabled=true;
    const {error}=await db.rpc('asf_service_reward_mark_paid',{p_reward:button.dataset.servicePay});
    if(error){notify(error.message||'تعذر تأكيد المكافأة',true);button.disabled=false;return;}
    notify('تم توثيق صرف المكافأة باسم المسؤول.');await mount(department);
   });
  }
  return {mount};
 }
 window.ASF_SERVICE_REWARDS=Object.freeze({create});
})();