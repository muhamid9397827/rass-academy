// Verify the genuine course and recruitment UI in isolation with fake results only.
// Source functions come from app.js; no live Supabase project or accounts are used.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
const sql=fs.readFileSync(path.join(__dirname,'supabase/migrations/20261105030000_unified_members_leadership.sql'),'utf8');
function extract(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a!==-1&&b>a,'source functions still exist: '+start);
 return source.slice(a,b);
}
assert.match(sql,/Preliminary acceptance required before final hiring/);
assert.match(sql,/Review the training result before delivery/);
assert.match(sql,/r\.department='police' and \(public\.asf_is_police_head\(\) or public\.asf_is_court_head\(\)\)/);
assert.match(sql,/when public\.asf_is_court_head\(\) then 'رئاسة مجلس القضاء العسكري'/);
assert.equal((sql.match(/p_section is null or p_section not in/g)||[]).length,2,'both privileged role RPCs validate null sections');
assert.match(sql,/p_role is null or p_role not in/);
assert.match(sql,/p_action is null or p_action not in/);
const functions=extract('function mountQualificationResults(){','function mountAcademyResults(){')+
 '\n'+extract('function mountAcademyResults(){','function cardReport(')+
 '\nwindow.__resultFlows={mountQualificationResults,mountAcademyResults};';

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.route('**/portal/qa-blank',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><title>Test</title>'}));
  await page.goto('http://127.0.0.1:8000/portal/qa-blank',{waitUntil:'domcontentloaded'});
  assert.equal(await page.evaluate(()=>document.characterSet),'UTF-8','browser test must decode Arabic strings as UTF-8');
  await page.setContent('<main id="page"><div id="qualificationResultPanel"></div><div id="academyResultPanel"></div></main>');
  await page.evaluate(()=>{
   const now='2026-11-05T03:00:00Z';
   window.__access='trainer';
   window.__fixtures={
    qualification:[
     {id:'11111111-2222-4333-8444-555555555501',receipt:'ACD-501',course_id:'individual-qualification',
      trainee_name:'متقدم اختبار',discord_id:'123456789012345678',score:85,total:100,percentage:85,passed:true,
      assigned_rank:'جندي',is_test:false,received_at:now,qualification_reviewed_at:null,qualification_reviewed_by_name:null,
      qualification_preliminary_at:null,qualification_preliminary_by_name:null,
      qualification_hired_at:null,qualification_hired_by_name:null},
     {id:'11111111-2222-4333-8444-555555555502',receipt:'ACD-502',course_id:'individual-qualification',
      trainee_name:'متقدم راسب',discord_id:'123456789012345679',score:45,total:100,percentage:45,passed:false,
      assigned_rank:null,is_test:false,received_at:now,qualification_reviewed_at:null,
      qualification_preliminary_at:null,qualification_hired_at:null}
    ],
    training:[{id:'11111111-2222-4333-8444-555555555503',receipt:'ACD-503',course_id:'operations',
      trainee_name:'متدرب ناجح',trainee_rank:'جندي',discord_id:'123456789012345680',course_title:'العمليات',
      score:90,total:100,percentage:90,passed:true,is_test:false,received_at:now,legacy_status:'confirmed',
      training_reviewed_at:null,training_reviewed_by_name:null,
      delivered_at:null,delivered_by_name:null,delivered_by_code:null}]
   };
   window.__calls=[];
   window.$=selector=>document.querySelector(selector);
   window.esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   window.badge=value=>'<span class="badge">'+window.esc(value)+'</span>';
   window.date=value=>value?String(value).slice(0,10):'—';
   window.toast=message=>{window.__toast=message};
   window.user={id:'11111111-2222-4333-8444-555555555599'};
   window.commander=false;
   window.hasDeptRole=(section,role)=>window.__access==='head'||
      window.__access==='trainer'&&role==='trainer'&&['training','recruitment'].includes(section);
   window.deptUI={rewardPanel:async()=>{}};
   window.db={
    from(table){
     const conditions=[];
     const q={
      select(){return q},eq(k,v){conditions.push([k,'eq',v]);return q},
      neq(k,v){conditions.push([k,'neq',v]);return q},
      is(k,v){conditions.push([k,'is',v]);return q},
      not(k,operator,v){conditions.push([k,'not',v]);return q},
      ilike(){return q},order(){return q},
      limit(){return Promise.resolve({data:[],error:null})},
      range(a,b){
       let rows=table==='asf_academy_results'?
        [...window.__fixtures.qualification,...window.__fixtures.training]:[];
       for(const [key,op,val] of conditions)rows=rows.filter(row=>op==='eq'?row[key]===val:
        op==='neq'?row[key]!==val:op==='is'?(val===false?row[key]===false:row[key]==null):
        row[key]!=null);
       return Promise.resolve({data:rows.slice(a,b+1).map(row=>({...row})),count:rows.length,error:null});
      }
     };
     return q;
    },
    async rpc(name,args){
     window.__calls.push([name,args]);
     const all=[...window.__fixtures.qualification,...window.__fixtures.training],
      item=all.find(x=>x.id===(args.p_result||args.p_reward));
     if(name==='asf_recruitment_qualification_action'){
      if(args.p_action==='hire'&&(!item.qualification_preliminary_at||window.__access!=='head'))
       return {error:{message:'Head and preliminary acceptance required'}};
      const prefix=args.p_action==='review'?'qualification_reviewed':
       args.p_action==='preliminary'?'qualification_preliminary':'qualification_hired';
      item[prefix+'_at']=now;item[prefix+'_by_name']='مسؤول اختبار';
      return {data:{already:false},error:null};
     }
     if(name==='asf_training_review_result'){
      item.training_reviewed_at=now;item.training_reviewed_by_name='مدرب اختبار';
      return {data:{already:false},error:null};
     }
     if(name==='asf_confirm_academy_delivery'){
      if(!item.training_reviewed_at)return {error:{message:'Review required'}};
      item.delivered_at=now;item.delivered_by_name='مدرب اختبار';
      return {data:{already_delivered:false,delivered_by_name:'مدرب اختبار'},error:null};
     }
     return {data:{},error:null};
    }
   };
  });
  await page.addScriptTag({content:functions});
  await page.evaluate(()=>window.__resultFlows.mountQualificationResults());
  await page.locator('[data-qualification-action="review"]').first().waitFor();
  assert.equal(await page.locator('[data-qualification-action="hire"]').count(),0);
  await page.locator('[data-qualification-action="review"]').first().click();
  await page.locator('[data-qualification-action="preliminary"]').waitFor();
  await page.locator('[data-qualification-action="preliminary"]').click();
  await page.getByText('قرار الرئاسة فقط').waitFor();
  assert.equal(await page.locator('[data-qualification-action="hire"]').count(),0,'trainer cannot hire');
  await page.evaluate(()=>{window.__access='head';window.__resultFlows.mountQualificationResults()});
  await page.locator('[data-qualification-action="hire"]').waitFor();
  await page.locator('[data-qualification-action="hire"]').click();
  await page.getByText(/تم توظيفه بواسطة/).waitFor();
  assert.equal(await page.locator('[data-qualification-action="hire"]').count(),0,'final decision is idempotent in UI');
  await page.evaluate(()=>{window.__access='trainer';window.__resultFlows.mountAcademyResults()});
  await page.locator('[data-review-result]').waitFor();
  assert.equal(await page.locator('[data-deliver-result]').count(),0,'delivery cannot happen before review');
  await page.locator('[data-review-result]').click();
  await page.locator('[data-deliver-result]').waitFor();
  await page.locator('[data-deliver-result]').click();
  await page.getByText(/تم تسليم الرول/).waitFor();
  assert.ok((await page.evaluate(()=>window.__calls)).some(([n,a])=>n==='asf_confirm_academy_delivery'&&!!a.p_result));
  assert.deepEqual(errors,[],'no page errors in course or recruitment workflow');
  console.log('PASS: course review before delivery; recruit review -> preliminary -> head-only final hire');
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exit(1)});
