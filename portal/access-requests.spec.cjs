// Permission request UI contract. Supabase is mocked; no production users or data touched.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const sdk=String.raw\`
(() => {
 const isCommander=new URLSearchParams(location.search).get('role')==='commander';
 const member='11111111-2222-4333-8444-555555555572';
 const leader='11111111-2222-4333-8444-555555555571';
 const currentId=isCommander?leader:member;
 const people=[
  {user_id:leader,game_name:'قائد الاختبار',rank:'لواء',military_code:'ASF-0001',status:'approved',court_enabled:true},
  {user_id:member,game_name:'عضو الاختبار',rank:'رقيب',military_code:'ASF-0002',status:'approved',court_enabled:false}
 ];
 const state={requests:isCommander?[{id:'11111111-2222-4333-8444-555555555581',user_id:member,permission:'court.manage',reason:'أحتاج صلاحية مجلس القضاء للمراجعة.',status:'pending',created_at:new Date().toISOString(),decision_note:''}]:[],
  submitted:[],reviewed:[],granted:[]};
 window.__accessQA=state;
 class Query {
  constructor(table){this.table=table;this.f=[]}
  select(){return this}
  eq(key,value){this.f.push([key,value]);return this}
  is(){return this} order(){return this} limit(){return this}
  async maybeSingle(){return {data:people.find(p=>p.user_id===currentId),error:null}}
  then(ok,bad){let data=this.table==='asf_profiles'?people:this.table==='asf_access_requests'?state.requests:[];data=data.filter(row=>this.f.every(([k,v])=>row[k]===v));if(this.table==='asf_access_requests'&&!isCommander)data=data.filter(r=>r.user_id===member);return Promise.resolve({data,error:null}).then(ok,bad)}
 }
 const client={
  auth:{getUser:async()=>({data:{user:{id:currentId,email:'qa@example.invalid'}},error:null}),onAuthStateChange:()=>({})},
  from:table=>new Query(table),
  rpc:async (name,args)=>{
   if(name==='asf_is_commander')return {data:isCommander,error:null};
   if(name==='asf_request_access'){
    state.submitted.push(args);
    state.requests.unshift({id:'11111111-2222-4333-8444-555555555591',user_id:member,permission:args.p_permission,reason:args.p_reason,status:'pending',created_at:new Date().toISOString()});
    return {data:'11111111-2222-4333-8444-555555555591',error:null};
   }
   if(name==='asf_review_access_request'){
    state.reviewed.push(args);
    const req=state.requests.find(r=>r.id===args.p_request);
    if(req) {req.status=args.p_allow?'approved':'rejected';req.reviewed_at=new Date().toISOString();req.decision_note=args.p_note;}
    if(args.p_allow)state.granted.push(req?.permission);
    return {data:null,error:null};
   }
   return {data:null,error:null}
  },
  channel:()=>({on(){return this},subscribe(){return this}}),
  removeChannel(){}
 };
 window.supabase={createClient:()=>client};
})();
\`;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/supabase.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:sdk}));
 const base='http://127.0.0.1:8000/portal/';
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.locator('#workspace').waitFor({state:'visible'});
 await page.locator('[data-section="court"]').click();
 assert.equal(await page.locator('#restrictedModal').isVisible(),true,'restricted court modal');
 await page.locator('#requestRestrictedAccess').click();
 await page.locator('#accessRequestForm').waitFor({state:'visible'});
 assert.equal(await page.locator('#accessPermission').inputValue(),'court.manage','court preselected');
 await page.locator('#accessRequestForm textarea[name="reason"]').fill('أحتاج تصريح المجلس لمراجعة القضايا داخل القطاع.');
 await page.locator('#sendAccessRequest').click();
 await page.getByText('قيد المراجعة').waitFor({state:'visible'});
 const submission=await page.evaluate(()=>window.__accessQA.submitted);
 assert.equal(submission.length,1);assert.equal(submission[0].p_permission,'court.manage');
 assert.equal(await page.locator('[data-page="access-queue"]').isVisible(),false,'ordinary member cannot see commander queue');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 assert.ok(overflow<=2,'mobile access form overflow '+overflow);
 await page.goto(base+'?role=commander',{waitUntil:'domcontentloaded'});
 await page.locator('#workspace').waitFor({state:'visible'});
 await page.locator('[data-page="access-queue"]').click();
 await page.locator('.access-decision-form').waitFor({state:'visible'});
 await page.locator('.access-decision-form input[name="note"]').fill('تم اعتماد التصريح بعد مراجعة السبب.');
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('.access-decision-form button[value="approve"]').click();
 await page.getByText('موافق عليه').waitFor({state:'visible'});
 const decision=await page.evaluate(()=>({reviews:window.__accessQA.reviewed,grants:window.__accessQA.granted}));
 assert.equal(decision.reviews.length,1);assert.equal(decision.reviews[0].p_allow,true);
 assert.equal(decision.grants[0],'court.manage','approved grant delegated through server call');
 assert.deepEqual(errors,[],'no uncaught frontend errors');
 await browser.close();
 console.log('PASS access requests: locked court modal, member request/history, commander approval, responsive');
})().catch(e=>{console.error(e);process.exit(1)});
