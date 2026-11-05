// Commander dashboard regression with synthetic rows only.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/portal/qa-operations',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><main id="page"></main>'}));
  await page.goto('http://127.0.0.1:8000/portal/qa-operations');
  await page.addStyleTag({url:'http://127.0.0.1:8000/portal/styles.css'});
  await page.addScriptTag({url:'http://127.0.0.1:8000/portal/operations-center.js'});
  await page.evaluate(async()=>{
   const members=[
    {user_id:'member-training',game_name:'مدرب العمليات',rank:'عريف',military_code:'ASF-100',status:'approved',training_trainer:true,training_head:false,recruitment_trainer:false,recruitment_head:false,police_staff:false,police_head:false,court_staff:false,court_head:false},
    {user_id:'member-court',game_name:'قاضي معلق',rank:'ملازم',military_code:'ASF-101',status:'pending',training_trainer:false,training_head:false,recruitment_trainer:false,recruitment_head:false,police_staff:false,police_head:false,court_staff:true,court_head:false}
   ];
   const tables={
    asf_operations_tasks:[{id:'task-1',title:'مهمة مفتوحة',description:'',created_by:'leader',created_by_name:'القائد',assigned_to:'member-training',assigned_to_name:'مدرب العمليات',priority:'normal',status:'in_progress',reference_code:'OPS-1',created_at:new Date().toISOString(),updated_at:new Date().toISOString()}],
    asf_operations_task_events:[],asf_reports:[],asf_report_receipts:[],
    asf_academy_results:[{id:'result-1',passed:true}],asf_reviews:[{report_id:'report-1',state:'new'}],
    asf_service_rewards:[{id:'reward-1',paid_at:null}],asf_department_rewards:[],
    asf_audit:[{action:'section_staff',target_id:'member-training',created_at:new Date().toISOString()}],
    asf_profiles:members
   };
   class Q{
    constructor(name){this.rows=[...(tables[name]||[])];this.wantCount=false;}
    select(_columns,options={}){this.wantCount=options.count==='exact';return this}
    order(){return this} limit(n){this.rows=this.rows.slice(0,n);return this}
    eq(key,value){this.rows=this.rows.filter(row=>row[key]===value);return this}
    is(key,value){this.rows=this.rows.filter(row=>row[key]===value);return this}
    in(key,values){this.rows=this.rows.filter(row=>values.includes(row[key]));return this}
    async maybeSingle(){return {data:this.rows[0]||null,error:null}}
    then(resolve,reject){return Promise.resolve({data:this.wantCount?null:this.rows,error:null,count:this.wantCount?this.rows.length:null}).then(resolve,reject)}
   }
   const db={
    from:name=>new Q(name),auth:{getUser:async()=>({data:{user:{id:'leader'}},error:null})},
    rpc:async name=>name==='asf_management_directory'?{data:members,error:null}:{data:null,error:null}
   };
   window.__operations=window.ASF_OPERATIONS.create({db,getContext:()=>({user:{id:'leader'},profile:{status:'approved'},commander:true}),notify:()=>{}});
   await window.__operations.render();
  });
  await page.locator('#operationsLeadershipStats').getByText('طلبات تفعيل معلقة').waitFor();
  assert.match(await page.locator('#operationsLeadershipStats').textContent(),/أعضاء معتمدون/);
  assert.match(await page.locator('#operationsRecentAudit').textContent(),/section_staff/);
  assert.equal(await page.locator('#operationsPeopleResults tbody tr').count(),2);
  await page.locator('#operationsPeopleSection').selectOption('training');
  assert.equal(await page.locator('#operationsPeopleResults tbody tr').count(),1);
  assert.match(await page.locator('#operationsPeopleResults').textContent(),/مدرب العمليات/);
  await page.locator('#operationsPeopleStatus').selectOption('pending');
  assert.match(await page.locator('#operationsPeopleResults').textContent(),/لا توجد نتائج مطابقة/);
  await page.locator('#operationsPeopleSection').selectOption('court');
  assert.match(await page.locator('#operationsPeopleResults').textContent(),/قاضي معلق/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=2,'commander dashboard fits 390px');
  assert.deepEqual(errors,[]);
  console.log('PASS: commander KPIs, recent audit and member filters remain private and responsive');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
