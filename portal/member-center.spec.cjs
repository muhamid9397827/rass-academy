// UI integration for the unified four-department leadership center.
// Fake data only: no production accounts, Auth updates, or database writes.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.goto('http://127.0.0.1:8000/portal/config.js',{waitUntil:'domcontentloaded'});
  await page.setContent('<link rel="stylesheet" href="http://127.0.0.1:8000/portal/styles.css"><link rel="stylesheet" href="http://127.0.0.1:8000/portal/member-center.css"><meta charset="utf-8"><main id="page"></main>');
  await page.addScriptTag({url:'http://127.0.0.1:8000/portal/member-center.js'});
  await page.evaluate(()=>{
   const a='11111111-2222-4333-8444-555555555591',b='11111111-2222-4333-8444-555555555592';
   const fake=[
    {user_id:a,game_name:'متدرب اختبار',rank:'جندي',military_code:null,discord_id:'123456789012345678',activation_reason:'أريد الدخول للموقع للقيام بالمهام.',status:'pending',created_at:'2026-11-05T01:00:00Z'},
    {user_id:b,game_name:'مدرب اختبار',rank:'عريف',military_code:'ASF-000002',discord_id:'123456789012345679',activation_reason:'العمل في كلية التدريب والقبول.',status:'approved',created_at:'2026-11-05T02:00:00Z'}
   ];
   const keys=['training_head','recruitment_head','police_head','court_head','training_trainer','recruitment_trainer','police_staff','court_staff'];
   for(const p of fake)for(const key of keys)p[key]=false;
   const changes=[];
   window.__memberQA={fake,changes,ctx:{
    commander:true,trainingHead:true,recruitmentHead:true,policeHead:true,courtHead:true,canManageMembers:true,canApprove:true
   }};
   const db={
    rpc:async(name,args={})=>{
     changes.push([name,args]);
     if(name==='asf_management_directory')return {data:fake.map(p=>({...p})),error:null};
     const p=fake.find(p=>p.user_id===(args.p_user||args.target));
     if(name==='asf_admin_action'){
      p.status={approve:'approved',reject:'rejected',suspend:'suspended'}[args.op]||p.status;
      if(args.op==='approve')p.military_code='ASF-000001';
      if(args.op==='suspend'||args.op==='reject')for(const key of keys)p[key]=false;
     }else if(name==='asf_management_set_staff'){
      p[({training:'training_trainer',recruitment:'recruitment_trainer',police:'police_staff',court:'court_staff'})[args.p_section]]=args.p_enable;
     }else if(name==='asf_management_set_head')p[args.p_section+'_head']=args.p_enable;
     return {data:null,error:null};
    },
    functions:{invoke:async()=>({data:{ok:true},error:null})}
   };
   window.__memberQA.center=window.ASF_MEMBER_CENTER.create({
    db,getContext:()=>window.__memberQA.ctx,notify:(message,error)=>{window.__memberQA.last={message,error}}
   });
  });
  await page.evaluate(()=>window.__memberQA.center.render());
  await page.locator('button[data-ac-action="approve"]').click();
  await page.getByText('متدرب اختبار').waitFor();
  assert.equal(await page.locator('.ac-approved').count(),2,'newly approved member shows updated status immediately');
  assert.equal(await page.locator('#acFilter').inputValue(),'approved','filter moves to activated group');
  await page.locator('button[data-ac-staff="training"]').first().click();
  assert.ok((await page.locator('[data-ac-staff="training"].on').count())>=1,'role becomes enabled');
  await page.locator('button[data-ac-staff="court"]').first().click();
  assert.ok((await page.locator('[data-ac-staff="court"].on').count())>=1,'judicial staff role can be assigned by commander');
  await page.locator('button[data-ac-action="suspend"]').first().click();
  assert.equal(await page.locator('#acFilter').inputValue(),'suspended');
  assert.equal(await page.locator('.ac-suspended').count(),1,'deactivated member visible with correct state');
  assert.ok((await page.evaluate(()=>window.__memberQA.changes)).some(([name,args])=>name==='asf_admin_action'&&args.op==='suspend'));
  await page.evaluate(()=>window.__memberQA.center.renderHeads());
  await page.locator('[data-head-section="police"]').first().click();
  await page.locator('[data-head-section="police"].on').first().waitFor();
  await page.locator('[data-head-section="court"]').first().click();
  await page.locator('[data-head-section="court"].on').first().waitFor();
  await page.evaluate(()=>{window.__memberQA.ctx={commander:false,policeHead:true,courtHead:false,trainingHead:false,recruitmentHead:false,canManageMembers:true,canApprove:true}});
  await page.evaluate(()=>window.__memberQA.center.render());
  await page.locator('#acFilter').selectOption('approved');
  assert.ok(await page.locator('[data-ac-staff="police"]').count()>0);
  assert.equal(await page.locator('[data-ac-staff="court"]').count(),0,'police head cannot assign judiciary role');
  assert.equal(await page.locator('[data-ac-staff="training"]').count(),0,'police head cannot assign trainers');
  await page.evaluate(()=>{window.__memberQA.ctx={
   commander:false,policeHead:false,courtHead:true,trainingHead:false,recruitmentHead:false,
   canManageMembers:true,canApprove:true
  }});
  await page.evaluate(()=>window.__memberQA.center.render());
  await page.locator('#acFilter').selectOption('approved');
  assert.equal(await page.locator('[data-ac-staff]').count(),0,
   'judicial leader can manage cases and warnings, not give personnel roles');
  await page.evaluate(()=>{window.__memberQA.ctx={
   commander:false,policeHead:false,courtHead:false,trainingHead:true,recruitmentHead:false,
   canManageMembers:true,canApprove:true
  }});
  await page.evaluate(()=>window.__memberQA.center.render());
  await page.locator('#acFilter').selectOption('approved');
  assert.ok(await page.locator('[data-ac-staff="training"]').count()>0);
  assert.equal(await page.locator('[data-ac-staff="police"]').count(),0,
   'training head can only assign training trainers');
  await page.evaluate(()=>window.__memberQA.center.renderHeads());
  assert.match(await page.locator('#page').textContent(),/القائد فقط/);
  for(const width of [320,390,768]){
   await page.setViewportSize({width,height:840});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   assert.ok(overflow<=2,'responsive width '+width+' has overflow '+overflow);
  }
  assert.deepEqual(errors,[],'no unhandled browser exceptions');
  console.log('PASS: unified member status transitions, scoped staff, commander-only heads, 320px mobile');
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
