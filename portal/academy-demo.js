// Read-only client-side filming sandbox; does not read or write actual exam results.
(() => {
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));
 const SEED=[
  {id:'01',receipt:'DEMO-OPS-01',course:'دورة العمليات',rank:'جندي أول',discord:'98375026481936520741',score:9,total:10,assigned:''},
  {id:'02',receipt:'DEMO-QUAL-02',course:'اختبار تأهيل الأفراد',rank:'متقدم جديد',discord:'97638190425716382054',score:18,total:20,assigned:'جندي'},
  {id:'03',receipt:'DEMO-SWAT-03',course:'دورة السوات',rank:'رئيس رقباء',discord:'96417283051628497320',score:10,total:10,assigned:''}
 ];
 function mount(host){
  const records=SEED.map(v=>({...v,delivered:false,paid:false,deliveredBy:'',deliveredAt:'',paidBy:'',paidAt:''}));
  let deliveryActor='المدرب أحمد العتيبي (تجريبي)';
  let rewardAuthority='رئاسة كلية التدريب';
  const stamp=value=>value?new Date(value).toLocaleString('ar-SA',{dateStyle:'medium',timeStyle:'short'}):'';
  const auto=new URLSearchParams(location.search).get('demo')==='1';
  let showing=auto;
  const render=()=>{
   host.innerHTML='<div class="row between"><div><h3>🎬 نتائج تجريبية للتصوير</h3><p class="muted">ثلاثة نماذج ناجحة باسم مجاهد ال عباد. هذه معاينة محلية فقط؛ لا تُضاف للسجل الحقيقي ولا تنشئ رتباً أو مكافآت فعلية.</p></div><button type="button" class="btn ghost" id="academyDemoToggle">'+(showing?'إخفاء التجربة':'عرض 3 نتائج تجريبية')+'</button></div>'+
   (showing?'<div class="notice" style="margin:12px 0"><strong>وضع تصوير تجريبي — ليس نجاحاً رسمياً.</strong> كل الأزرار أدناه محاكاة فقط.</div>'+
   '<div class="row" style="display:flex;gap:14px;flex-wrap:wrap;align-items:end;margin:12px 0">'+
   '<label style="flex:1 1 250px">اسم المسؤول الذي سلّم الرول<input id="academyDemoActor" type="text" maxlength="70" value="'+esc(deliveryActor)+'" placeholder="الاسم الكامل للمسؤول"></label>'+
   '<label style="flex:1 1 250px">الرئاسة التي أعطت المكافأة<input id="academyDemoAuthority" type="text" maxlength="70" value="'+esc(rewardAuthority)+'" placeholder="اسم الرئاسة أو الجهة"></label>'+
   '</div><div class="table-scroll"><table><thead><tr><th>الإيصال</th><th>المتدرّب</th><th>الدورة والرتبة</th><th>النتيجة</th><th>تسليم الرول</th><th>مكافأة المدرب</th></tr></thead><tbody>'+
   records.map(r=>'<tr data-demo-row="'+esc(r.id)+'"><td>'+esc(r.receipt)+'<br><small>تجريبي</small></td><td><strong>مجاهد ال عباد</strong><br><code dir="ltr">'+esc(r.discord)+'</code><br><button class="btn ghost small" type="button" data-demo-copy="'+esc(r.id)+'">نسخ ID</button></td><td>'+esc(r.course)+'<br>'+esc(r.rank)+(r.assigned?'<br>الرتبة المقترحة: '+esc(r.assigned):'')+'</td><td><strong>'+r.score+' / '+r.total+' — '+Math.round(r.score/r.total*100)+'%</strong><br>✓ ناجح (تجريبي)</td><td>'+(r.delivered?'<strong>✓ تم تسليم الرول بالمحاكاة</strong><br><small>تم تسليم الرول من قبل: '+esc(r.deliveredBy)+'</small><br><small>'+esc(stamp(r.deliveredAt))+'</small>':'<button class="btn primary small" type="button" data-demo-deliver="'+esc(r.id)+'">محاكاة تسليم الرول</button>')+'</td><td>'+(r.paid?'<strong>✓ تم إعطاء المكافأة بالمحاكاة</strong><br><small>تم إعطاء مكافأة 150,000 من قبل: '+esc(r.paidBy)+'</small><br><small>'+esc(stamp(r.paidAt))+'</small>':r.delivered?'<strong>150,000 — استحقاق تجريبي</strong><br><button class="btn primary small" type="button" data-demo-pay="'+esc(r.id)+'">محاكاة إعطاء المكافأة</button>':'بانتظار محاكاة التسليم')+'</td></tr>').join('')+
   '</tbody></table></div><p class="muted">النتائج والقرارات التجريبية تختفي عند تحديث الصفحة، ولا تؤثر على بيانات المتدربين الحقيقيين.</p><div class="row"><button id="academyDemoReset" type="button" class="btn ghost small">إعادة المحاكاة من البداية</button><span id="academyDemoFeedback" role="status" aria-live="polite"></span></div>':'');
   host.querySelector('#academyDemoToggle').onclick=()=>{showing=!showing;render()};
   if(!showing)return;
   host.querySelector('#academyDemoActor').oninput=e=>{deliveryActor=e.target.value;};
   host.querySelector('#academyDemoAuthority').oninput=e=>{rewardAuthority=e.target.value;};
   host.querySelectorAll('[data-demo-deliver]').forEach(button=>button.onclick=()=>{
    const r=records.find(r=>r.id===button.dataset.demoDeliver);if(!r||r.delivered)return;
    r.delivered=true;r.deliveredBy=deliveryActor.trim()||'مسؤول الدورات (تجريبي)';r.deliveredAt=new Date().toISOString();
    render();const target=host.querySelector('#academyDemoFeedback');if(target)target.textContent='تم تسليم رول '+r.course+' بالمحاكاة من قبل '+r.deliveredBy+'، مع استحقاق افتراضي 150,000 للمدرب.';
   });
   host.querySelectorAll('[data-demo-pay]').forEach(button=>button.onclick=()=>{
    const r=records.find(r=>r.id===button.dataset.demoPay);if(!r||!r.delivered||r.paid)return;
    r.paid=true;r.paidBy=rewardAuthority.trim()||'رئاسة كلية التدريب (تجريبي)';r.paidAt=new Date().toISOString();
    render();const target=host.querySelector('#academyDemoFeedback');if(target)target.textContent='تم إعطاء المكافأة بالمحاكاة من قبل '+r.paidBy+'، دون حفظ أي معاملة مالية.';
   });
   host.querySelectorAll('[data-demo-copy]').forEach(button=>button.onclick=async()=>{
    const r=records.find(r=>r.id===button.dataset.demoCopy);if(!r)return;
    try{await navigator.clipboard.writeText(r.discord);const target=host.querySelector('#academyDemoFeedback');if(target)target.textContent='تم نسخ Discord ID التجريبي.';}
    catch{window.prompt('انسخ المعرّف التجريبي:',r.discord)}
   });
   host.querySelector('#academyDemoReset').onclick=()=>{records.forEach(r=>{r.delivered=false;r.paid=false;r.deliveredBy='';r.deliveredAt='';r.paidBy='';r.paidAt='';});render()};
  };
  render();
 }
 window.ASF_ACADEMY_DEMO=Object.freeze({mount});
})();