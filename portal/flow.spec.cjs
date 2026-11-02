// Browser end-to-end contract smoke with an isolated fake Supabase client.
// No credentials and no production database writes.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const mockSupabase=String.raw`
(() => {
 const userId='11111111-2222-4333-8444-555555555571';
 const state={
  user:{id:userId,email:'qa-author@example.invalid'},
  profile:{user_id:userId,game_name:'QA Commander',discord_id:'123456789012345678',rank:'نقيب',
   military_code:'ASF-QA001',status:'approved',court_enabled:true,created_at:new Date().toISOString()},
  reports:[],pdfs:new Map(),reviews:new Map(),audit:[],notifications:[],uploads:[],
  member:{user_id:'11111111-2222-4333-8444-555555555572',game_name:'QA Member',
   discord_id:'123456789012345679',rank:'جندي',military_code:'ASF-QA002',status:'approved',court_enabled:false}
 };
 class Q {
  constructor(table){this.table=table;this.filters=[];this.kind='select';this.limitN=1000;}
  select(){this.kind='select';return this;}
  order(){return this;}
  limit(n){this.limitN=n;return this;}
  eq(k,v){this.filters.push(x=>x[k]===v);return this;}
  is(k,v){this.filters.push(x=>v===null?x[k]===null:x[k]===v);return this;}
  not(k,op,v){this.filters.push(x=>v===null?x[k]!==null:x[k]!==v);return this;}
  in(k,v){this.filters.push(x=>v.includes(x[k]));return this;}
  async maybeSingle(){const r=await this.done();return {...r,data:r.data?.[0]??null};}
  async single(){const r=await this.done();return {...r,data:r.data?.[0]??null};}
  then(ok,bad){return this.done().then(ok,bad);}
  async done(){
   let rows={
    asf_profiles:[state.profile,state.member],asf_delegations:[],asf_reports:state.reports,
    asf_drafts:[],asf_notifications:state.notifications,asf_reviews:[...state.reviews.values()],
    asf_audit:state.audit,asf_change_requests:[],asf_court_cases:[],asf_court_decisions:[],
    asf_court_warnings:[],asf_police_overrides:[]
   }[this.table]||[];
   return {data:rows.filter(x=>this.filters.every(f=>f(x))).slice(0,this.limitN),error:null};
  }
 }
 const client={
  auth:{getUser:async()=>({data:{user:state.user},error:null}),
    onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
    signOut:async()=>({error:null}),signUp:async()=>({data:{session:null},error:null}),
    signInWithPassword:async()=>({data:{},error:null})},
  from:t=>new Q(t),
  channel:()=>({on(){return this},subscribe(){return this}}),
  removeChannel(){},
  rpc:async (name,args={})=>{
   if(name==='asf_is_commander')return {data:true,error:null};
   if(name==='asf_submit_report'){
    const num=state.reports.length+1,id='22222222-2222-4222-8222-22222222222'+num;
    const r={id,report_number:num,author_id:userId,kind:args.p_kind,mode:args.p_mode,title:args.p_title,
      body:args.p_body,sender_name:state.profile.game_name,sender_rank:state.profile.rank,
      sender_code:state.profile.military_code,pdf_path:args.p_pdf_path,original_report_id:args.p_original_report_id,
      deleted_at:null,pdf_ready_at:null,submitted_at:new Date().toISOString()};
    state.reports.push(r);
    return {data:{id,report_number:num,submitted_at:r.submitted_at},error:null};
   }
   if(name==='asf_mark_pdf_ready'){
    const r=state.reports.find(r=>r.id===args.p_report);
    if(!r || !state.pdfs.has(r.pdf_path))return {data:false,error:null};
    r.pdf_ready_at=new Date().toISOString();return {data:true,error:null};
   }
   if(name==='asf_review_report'){
    state.reviews.set(args.report,{report_id:args.report,state:args.new_state,note:args.new_note});
    return {data:null,error:null};
   }
   if(name==='asf_trash_report'){
    const r=state.reports.find(x=>x.id===args.report);
    r.deleted_at=args.restore?null:new Date().toISOString();return {data:null,error:null};
   }
   return {data:null,error:null};
  },
  storage:{from:()=>({
   upload:async(path,blob)=>{
    if(!(blob instanceof Blob)||blob.size<1500)return {error:{message:'PDF blob too small'}};
    state.pdfs.set(path,blob);state.uploads.push({path,size:blob.size,type:blob.type});
    return {data:{path},error:null};
   },
   download:async(path)=>state.pdfs.has(path)?{data:state.pdfs.get(path),error:null}:{data:null,error:{message:'missing'}}
  })}
 };
 window.__asfTest={state};
 window.supabase={createClient(){return client}};
})();
`;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});
 const errs=[];page.on('pageerror',e=>errs.push(e.message));
 page.on('dialog',d=>d.accept());
 await page.route('**/supabase.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:mockSupabase}));
 await page.goto('http://127.0.0.1:8000/portal/',{waitUntil:'domcontentloaded'});
 await page.locator('#workspace').waitFor({state:'visible',timeout:12000});
 assert.equal(await page.locator('#sessionLabel').textContent(),'QA Commander');
 await page.locator('[data-page="compose"]').click();
 await page.locator('#reportMode').selectOption('free');
 await page.locator('#reportForm input[name="title"]').fill('تقرير فحص متكامل');
 await page.locator('#reportForm textarea[name="text"]').fill('اختبار حفظ تقرير PDF عربي');
 await page.locator('#reportForm button[type="submit"]').click();
 await page.locator('#reportCards [data-action="detail"]').waitFor({state:'visible',timeout:30000});
 const qa=await page.evaluate(()=>({n:window.__asfTest.state.reports.length,pdf:window.__asfTest.state.uploads[0],
     complete:!!window.__asfTest.state.reports[0]?.pdf_ready_at}));
 assert.equal(qa.n,1,'one report stored');
 assert.ok(qa.pdf?.size>1500,'PDF uploaded');
 assert.ok(qa.complete,'PDF finalized after upload');
 await page.locator('#reportCards [data-action="detail"]').click();
 await page.locator('#reviewForm').waitFor({state:'visible'});
 await page.locator('#reviewForm select[name="state"]').selectOption('reviewed');
 await page.locator('#reviewForm textarea[name="note"]').fill('مراجعة ناجحة');
 await page.locator('#reviewForm button').click();
 await page.waitForFunction(()=>window.__asfTest.state.reviews.size===1);
 await page.locator('[data-action="back"]').click();
 await page.locator('#reportCards [data-action="trash"]').click();
 await page.getByText('لا توجد تقارير بعد').waitFor({state:'visible'});
 await page.locator('[data-page="trash"]').click();
 await page.locator('#reportCards [data-action="trash"]').click();
 await page.getByText('لا توجد تقارير بعد').waitFor({state:'visible'});
 const state=await page.evaluate(()=>({restored:window.__asfTest.state.reports[0].deleted_at===null,
  reviewed:window.__asfTest.state.reviews.size===1}));
 assert.deepEqual(state,{restored:true,reviewed:true});
 await page.locator('[data-page="delegations"]').click();
 assert.ok((await page.locator('#grantsForm').textContent()).includes('الاطلاع على التقارير'));
 await page.locator('[data-page="audit"]').click();
 assert.equal(await page.locator('#auditSearch').isVisible(),true);
 await page.setViewportSize({width:390,height:844});
 const overflow=await page.evaluate(()=>({body:document.documentElement.scrollWidth,viewport:innerWidth}));
 assert.ok(overflow.body<=overflow.viewport+2,'mobile layout horizontal overflow '+JSON.stringify(overflow));
 assert.deepEqual(errs,[],'uncaught frontend errors');
 await browser.close();
 console.log('PASS: signed-in UI, report/PDF upload & finalization, review, trash/restore, delegation, audit and mobile');
})().catch(err=>{console.error(err);process.exit(1)});
