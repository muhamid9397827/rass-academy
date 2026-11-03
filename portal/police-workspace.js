/* Military police workspace — compact search workflow with scoped leadership controls. */
(() => {
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').normalize('NFKD').toLowerCase().replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();
const nameOk=v=>{const parts=String(v||'').trim().split(/\s+/);return parts.length>=2&&parts.every(p=>p.length>=2&&/^\p{L}+$/u.test(p))&&String(v).trim().length<=80;};
const data=()=>window.MP_DATA||{standardViolations:[],fixedViolations:[],penaltyMatrix:{}};
const asDate=()=>new Date().toISOString().slice(0,10).replaceAll('-','');
const tiers=[['all','الكل'],['t1','الأولى'],['t2','الثانية'],['t3','الثالثة'],['t4','الرابعة'],['t5','الخامسة'],['t6','السادسة'],['t7','السابعة']];
function create({db,getContext,notify}){
 const $=s=>document.querySelector(s);
 const R=()=>getContext();
 const label=p=>p==='police'?'رول الشرطة العسكرية':p==='court'?'رول مجلس القضاء':'رئاسة الشرطة العسكرية';
 async function leadership(){
  const area=$('#mpLeadershipBody');if(!area)return;
  area.innerHTML='<p class="muted">جاري تحميل الأعضاء والصلاحيات…</p>';
  const {data:members,error}=await db.rpc('asf_police_directory');
  if(!area.isConnected)return;
  if(error){area.textContent='تعذر تحميل أعضاء القسم: '+error.message;return}
  const all=(members||[]),canSetHead=!!R().commander;
  area.innerHTML='<p class="muted">الرئاسة تستطيع منح وسحب رول الشرطة العسكرية ورول مجلس القضاء فقط. القائد وحده يعيّن رئاسة الشرطة العسكرية. هذه صلاحيات للبوابة ولا تغيّر رولات Discord.</p>'+
   '<label>ابحث عن عضو بالاسم أو الكود<input id="mpRoleSearch" type="search" autocomplete="off" placeholder="ابحث عن عضو معتمد"></label><div id="mpRoleMembers" class="mp-role-members"></div>';
  const draw=()=>{
   const q=norm($('#mpRoleSearch').value);
   const found=all.filter(p=>norm([p.game_name,p.rank,p.military_code].join(' ')).includes(q)).slice(0,40);
   $('#mpRoleMembers').innerHTML=found.map(p=>{
    const controls=[['police',p.police_role],['court',p.court_role],...(canSetHead?[['head',p.police_head]]:[])];
    return '<article class="mp-role-person"><div><strong>'+esc(p.game_name)+'</strong><small>'+esc(p.rank||'')+' · '+esc(p.military_code||'—')+'</small></div><div class="mp-role-buttons">'+controls.map(([role,enabled])=>
     '<button type="button" class="btn small '+(enabled?'ghost':'primary')+'" data-mp-user="'+esc(p.user_id)+'" data-mp-role="'+role+'" data-mp-enable="'+(!enabled)+'">'+(enabled?'سحب ':'منح ')+label(role)+'</button>').join('')+'</div></article>';
   }).join('')||'<div class="empty">لا يوجد عضو مطابق.</div>';
   $('#mpRoleMembers').querySelectorAll('[data-mp-user]').forEach(button=>button.onclick=async()=>{
    const target=button.dataset.mpUser,role=button.dataset.mpRole,enable=button.dataset.mpEnable==='true';
    if(!enable&&!confirm('هل تؤكد سحب '+label(role)+' من هذا العضو؟'))return;
    button.disabled=true;
    const args=role==='head'?{p_user:target,p_enable:enable}:{p_user:target,p_role:role,p_enable:enable};
    const {error:err}=await db.rpc(role==='head'?'asf_police_set_head':'asf_police_set_role',args);
    if(err){notify(err.message||'تعذر تحديث الرول',true);button.disabled=false;return}
    notify('تم '+(enable?'منح ':'سحب ')+label(role)+' وتوثيق العملية.');
    await leadership();
   });
  };
  $('#mpRoleSearch').oninput=draw;draw();
 }
 async function render(){
  const ctx=R();
  if(!ctx.commander&&!ctx.hasPolice&&!ctx.isPoliceHead)throw Error('هذا القسم لا يظهر إلا لأصحاب الصلاحية.');
  const rules=data(),all=[...rules.standardViolations,...rules.fixedViolations],ranks=Object.keys(rules.penaltyMatrix);
  const displayRanks=[['جندي','جندي'],['جندي أول','جندي اول'],['عريف','عريف + وكيل رقيب'],['وكيل رقيب','عريف + وكيل رقيب'],['رقيب','رقيب + رقيب اول'],['رقيب أول','رقيب + رقيب اول'],['رئيس رقباء','رئيس رقباء'],['ملازم','ملازم'],['ملازم أول','ملازم اول'],['نقيب فما فوق','نقيب فما فوق']].filter(([_,key])=>ranks.includes(key));
  const {data:overrides,error}=await db.from('asf_police_overrides').select('rule_key,rank_key,penalty');
  if(error)throw error;
  const canModify=ctx.commander||ctx.hasPolice||ctx.isPoliceHead,canLead=ctx.commander||ctx.isPoliceHead;
  const penaltyFor=(v,rank)=>{
   const match=(overrides||[]).find(x=>x.rule_key===v?.key&&x.rank_key===rank);
   return match?.penalty||(v?.calc?v.calc(rank):rules.penaltyMatrix[rank]?.[v?.tier])||'تقديري — يُرفع للقيادة';
  };
  $('#page').innerHTML='<div class="mp-intro"><strong>الشرطة العسكرية</strong><p>ابحث عن المخالفة واختر الرتبة، وستظهر العقوبة فورًا. بقية الأدوات متاحة بالأسفل عند الحاجة.</p></div>'+
  '<section class="section-card mp-calculator"><div class="mp-section-heading"><span>1</span><div><h3>بحث المخالفات والعقوبات</h3><p>ابحث برقم البند أو بكلمة من المخالفة بدل تصفّح قوائم طويلة.</p></div></div>'+
  '<div class="mp-kind-tabs"><button type="button" data-mp-kind="standard" class="active" aria-pressed="true">بنود الدرجات</button><button type="button" data-mp-kind="fixed" aria-pressed="false">المخالفات الثابتة</button></div>'+
  '<div id="mpTierFilters" class="mp-tier-chips">'+tiers.map(([key,name])=>'<button type="button" data-tier="'+key+'" class="'+(key==='all'?'active':'')+'" aria-pressed="'+(key==='all')+'">'+name+'</button>').join('')+'</div>'+
  '<label>بحث سريع<input type="search" id="violationSearch" autocomplete="off" placeholder="مثال: 3-19 أو كشف الهوية"></label>'+
  '<div class="row between mp-results-heading"><strong>المخالفات المطابقة</strong><span id="violationCount" class="badge" aria-live="polite"></span></div><div id="policeViolationList" class="mp-violations"></div>'+
  '<form id="policeForm" class="mp-penalty-form"><label>رتبة العسكري<select name="rank">'+displayRanks.map(([label,key])=>'<option value="'+esc(key)+'">'+esc(label)+'</option>').join('')+'</select></label><label>المخالفة المختارة<select name="violation"></select></label><button type="submit" class="btn ghost">حساب العقوبة</button></form>'+
  '<div class="mp-penalty-result" id="policeResult" aria-live="polite"></div></section>'+
  '<details class="section-card mp-tool" id="mpInvestigationDetails"><summary>2 — إعداد ونسخ تقرير التحقيق العسكري</summary><p class="muted">اختر المخالفة والرتبة أولًا. يتكوّن تقرير التحقيق بالتنسيق القديم، ويمكن نسخه أو إحالته للمجلس.</p>'+
  '<form id="investigationForm"><div class="grid two"><label>رقم ملف التحقيق<input name="reportNumber" required maxlength="100" value="INV-'+asDate()+'"></label><label>اسم المحقق الكامل<input name="investigator" required maxlength="80" value="'+esc(ctx.gameName||'')+'" placeholder="الاسم والكنية"></label><label>اسم العسكري المتهم الكامل<input name="accused" required maxlength="80" placeholder="مثال: مجاهد ال عباد"></label><label>Discord ID للمتهم<input name="discord" required inputmode="numeric" pattern="[0-9]{15,22}" maxlength="22" placeholder="المعرّف الرقمي"></label></div><button class="btn primary" type="submit">تجهيز التقرير</button></form><pre id="investigationPreview" class="mp-preview" hidden></pre><div class="row"><button class="btn ghost" id="copyInvestigation" type="button" hidden>نسخ تقرير التحقيق</button><button class="btn ghost" id="useInvestigation" type="button" hidden>إحالته إلى مجلس القضاء</button></div></details>'+
  (canModify?'<details class="section-card mp-tool" id="mpReferralDetails"><summary>3 — إرسال قضية إلى مجلس القضاء</summary><form id="caseForm"><label>الموضوع<input name="subject" maxlength="200" required></label><label>تفاصيل القضية<textarea name="details" required maxlength="12000"></textarea></label><button type="submit" class="btn primary">إرسال القضية</button></form></details>':'')+
  (canModify?'<details class="section-card mp-tool" id="mpRulesDetails"><summary>إدارة العقوبات والتعديلات</summary><p class="muted">لا تتغير اللوائح القديمة، ويُسجّل كل تعديل في سجل القيادة.</p><form id="policeAdminForm"><label>المخالفة<select name="rule">'+all.map(v=>'<option value="'+esc(v.key)+'">'+esc(v.id||'ثابت')+' — '+esc(v.text)+'</option>').join('')+'</select></label><label>الرتبة<select name="rank">'+ranks.map(r=>'<option value="'+esc(r)+'">'+esc(r)+'</option>').join('')+'</select></label><label>العقوبة<textarea name="penalty" maxlength="500" required></textarea></label><div class="row"><button class="btn primary" name="action" value="save" type="submit">حفظ التعديل</button><button class="btn ghost" name="action" value="reset" type="submit">استعادة الأصل</button></div></form></details>':'')+
  (canLead?'<details class="section-card mp-tool" id="mpLeadershipDetails"><summary>رئاسة الشرطة العسكرية وتوزيع الرولين</summary><div id="mpLeadershipBody"></div></details>':'');
  let kind='standard',tier='all',selected=all[0],investigationText='';
  const visible=()=>{
   const raw=kind==='standard'?rules.standardViolations:rules.fixedViolations,q=norm($('#violationSearch').value);
   return raw.filter(v=>(kind!=='standard'||tier==='all'||v.tier===tier)&&norm([v.id,v.text,v.tierName].join(' ')).includes(q));
  };
  const updatePenalty=()=>{
   if(!selected){$('#policeResult').textContent='لم تُحدّد مخالفة بعد.';return}
   $('#policeResult').innerHTML='<small>العقوبة المقترحة للبند '+esc(selected.id||'ثابت')+'</small><strong>'+esc(penaltyFor(selected,$('#policeForm').elements.rank.value))+'</strong>';
  };
  const choose=key=>{
   selected=all.find(v=>v.key===key)||null;
   const choice=$('#policeForm').elements.violation;
   if(selected)choice.value=String(all.indexOf(selected));
   $('#policeViolationList').querySelectorAll('[data-rule]').forEach(b=>{
    const on=b.dataset.rule===key;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));
   });
   updatePenalty();
  };
  const paint=()=>{
   const matches=visible();if(!matches.some(v=>v.key===selected?.key))selected=matches[0]||null;
   const showing=matches.slice(0,45);
   $('#violationCount').textContent=matches.length+' نتيجة'+(matches.length>45?' · أول 45':'');
   $('#policeViolationList').innerHTML=showing.map(v=>
    '<button type="button" class="mp-violation '+(selected?.key===v.key?'active':'')+'" data-rule="'+esc(v.key)+'" aria-pressed="'+(selected?.key===v.key)+'"><span>'+esc(v.text)+'</span><small>'+(kind==='standard'?'بند '+esc(v.id)+' · '+esc(v.tierName):'مخالفة ثابتة')+'</small></button>').join('')||'<div class="empty">لا توجد مخالفة مطابقة للبحث.</div>';
   $('#policeForm').elements.violation.innerHTML=showing.map(v=>'<option value="'+all.indexOf(v)+'">'+esc(v.id||'ثابت')+' — '+esc(v.text)+'</option>').join('');
   if(selected)$('#policeForm').elements.violation.value=String(all.indexOf(selected));
   $('#policeViolationList').querySelectorAll('[data-rule]').forEach(b=>b.onclick=()=>choose(b.dataset.rule));
   updatePenalty();
  };
  $('#violationSearch').oninput=paint;
  $('#policeForm').elements.rank.onchange=updatePenalty;
  $('#policeForm').elements.violation.onchange=e=>choose(all[Number(e.target.value)]?.key);
  $('#policeForm').onsubmit=e=>{e.preventDefault();updatePenalty()};
  $('#mpTierFilters').querySelectorAll('[data-tier]').forEach(b=>b.onclick=()=>{
   tier=b.dataset.tier;$('#mpTierFilters').querySelectorAll('button').forEach(el=>{
    const on=el===b;el.classList.toggle('active',on);el.setAttribute('aria-pressed',String(on));
   });paint();
  });
  $('#page').querySelectorAll('[data-mp-kind]').forEach(b=>b.onclick=()=>{
   kind=b.dataset.mpKind;tier='all';$('#violationSearch').value='';
   $('#mpTierFilters').hidden=kind==='fixed';
   $('#page').querySelectorAll('[data-mp-kind]').forEach(el=>{const on=el===b;el.classList.toggle('active',on);el.setAttribute('aria-pressed',String(on));});
   $('#mpTierFilters').querySelectorAll('[data-tier]').forEach(el=>{const on=el.dataset.tier==='all';el.classList.toggle('active',on);el.setAttribute('aria-pressed',String(on));});
   selected=null;paint();
  });
  paint();
  $('#investigationForm').onsubmit=e=>{
   e.preventDefault();if(!selected)return notify('اختر مخالفة أولًا',true);
   const f=new FormData(e.target),investigator=String(f.get('investigator')||'').trim(),accused=String(f.get('accused')||'').trim();
   if(!nameOk(investigator)||!nameOk(accused))return notify('يجب كتابة الاسم والكنية للمحقق والمتهم (كلمتان على الأقل).',true);
   const rank=$('#policeForm').elements.rank.value;
   investigationText=window.ASF_WORKFLOW.buildInvestigation({
    reportNumber:f.get('reportNumber'),investigator,accused:accused+' <@'+f.get('discord')+'>',
    violationText:selected.text,classification:selected.tier?'بند ('+selected.id+') — '+selected.tierName:'قوانين مخالفات ثابتة',
    penalty:penaltyFor(selected,rank)
   });
   $('#investigationPreview').hidden=false;$('#investigationPreview').textContent=investigationText;
   $('#copyInvestigation').hidden=false;$('#useInvestigation').hidden=!canModify;
  };
  $('#copyInvestigation').onclick=async()=>{
   try{await navigator.clipboard.writeText(investigationText);notify('تم نسخ التقرير')}catch{notify('تعذر النسخ التلقائي. يمكنك نسخ النص من المعاينة.',true)}
  };
  $('#useInvestigation').onclick=()=>{
   const section=$('#mpReferralDetails'),form=$('#caseForm');if(!section||!form)return;
   section.open=true;form.elements.subject.value='ملف تحقيق '+$('#investigationForm').elements.reportNumber.value;
   form.elements.details.value=investigationText;section.scrollIntoView({behavior:'smooth',block:'start'});
  };
  if(canModify){
   const form=$('#policeAdminForm'),sync=()=>{
    const v=all.find(v=>v.key===form.elements.rule.value);
    form.elements.penalty.value=penaltyFor(v,form.elements.rank.value);
   };
   form.elements.rule.onchange=sync;form.elements.rank.onchange=sync;sync();
   form.onsubmit=async e=>{
    e.preventDefault();const action=e.submitter?.value||'save',f=new FormData(form);
    const {error:err}=await db.rpc('asf_set_police_override',{
     p_key:f.get('rule'),p_rank:f.get('rank'),p_penalty:action==='reset'?'':String(f.get('penalty')||'').trim()
    });
    if(err){notify(err.message,true);return}
    notify(action==='reset'?'تمت استعادة العقوبة الأصلية':'تم حفظ العقوبة');await render();
   };
   $('#caseForm').onsubmit=async e=>{
    e.preventDefault();const f=new FormData(e.target);
    const {error:err}=await db.from('asf_court_cases').insert({submitted_by:R().user.id,subject:String(f.get('subject')).trim(),details:String(f.get('details')).trim()});
    if(err){notify(err.message,true);return}notify('تم إرسال القضية للمجلس');e.target.reset();
   };
  }
  if(canLead){
   $('#mpLeadershipDetails').addEventListener('toggle',()=>{if($('#mpLeadershipDetails')?.open&&!$('#mpLeadershipBody').dataset.loaded){$('#mpLeadershipBody').dataset.loaded='true';leadership();}});
  }
 }
 return {render,leadership};
}
window.ASF_POLICE_UI={create,nameOk,norm};
})();