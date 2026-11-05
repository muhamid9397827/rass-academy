// Permission and usability smoke for the compact police workspace.
// Every account and role is mocked; no live users or privileges are changed.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {portalMock}=require('./completion-fixtures.cjs');
const injected=[
 " const role=new URLSearchParams(location.search).get('policeRole')||'commander';",
 " const operations=[];",
 " const policeDirectory=[{user_id:'11111111-2222-4333-8444-555555555572',game_name:'عضو الاختبار',rank:'جندي',military_code:'ASF-QA002',police_role:false,court_role:false,police_head:false}];",
 " window.__policeOps=operations;"
].join('\n');
const sdk=portalMock
 .replace(" const userId='11111111-2222-4333-8444-555555555571';"," const userId='11111111-2222-4333-8444-555555555571';\n"+injected)
 .replace(' class Q {'," state.profile.court_enabled=role==='commander';\n class Q {")
 .replace('asf_profiles:[state.profile,state.member],asf_delegations:[]',
  "asf_profiles:[state.profile,state.member],asf_police_heads:role==='head'?[{user_id:userId}]:[],asf_delegations:role==='officer'?[{user_id:userId,permission:'police.manage',report_kind:null}]:[]")
 .replace("if(name==='asf_is_commander')return {data:true,error:null};",
  "if(name==='asf_is_commander')return {data:role==='commander',error:null};"+
  "if(name==='asf_can_manage_members')return {data:role==='head'||role==='commander',error:null};"+
  "if(name==='asf_management_directory')return {data:[{...state.member,training_head:false,recruitment_head:false,police_head:false,court_head:false,training_trainer:false,recruitment_trainer:false,police_staff:false,court_staff:false}],error:null};"+
  "if(name==='asf_management_set_staff'||name==='asf_management_set_head'){operations.push({name,args});return {data:null,error:null};}"+"if(name==='asf_police_directory')return {data:policeDirectory,error:null};"+
  "if(name==='asf_police_set_role'||name==='asf_police_set_head'){operations.push({name,args});return {data:null,error:null};}");
assert.match(sdk,/asf_police_set_role/,'must include police leadership mock');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.accept());
 await page.route('**/supabase.min.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:sdk}));
 const base='http://127.0.0.1:8000/portal/';
 async function visit(role){
  await page.goto(base+'?policeRole='+role,{waitUntil:'domcontentloaded'});
  await page.locator('#workspace').waitFor({state:'visible',timeout:20000});
 }
 await visit('member');
 assert.equal(await page.locator('#policeNav').evaluate(el=>!el.hidden),false,'police hidden for ordinary member');
 assert.equal(await page.locator('#courtNav').evaluate(el=>!el.hidden),false,'court hidden for ordinary member');
 assert.equal(await page.locator('[data-section="police"]').count(),0,'no locked police card');
 assert.equal(await page.locator('[data-section="court"]').count(),0,'no locked court card');
 assert.equal(await page.locator('#accessDashboardShortcut').isVisible(),true,'single access request entry');
 await visit('officer');
 assert.equal(await page.locator('#policeNav').evaluate(el=>!el.hidden),true,'police officer has section');
 assert.equal(await page.locator('#courtNav').evaluate(el=>!el.hidden),false,'police does not imply court');
 await page.locator('#mobileMenuToggle').click();
 await page.locator('#policeNav').click();
 await page.locator('#violationSearch').fill('كشف هويه البحث الجنائي');
 assert.ok(await page.locator('#policeViolationList .mp-violation').count()>=1,'legacy Arabic violation searchable');
 assert.match(await page.locator('#violationCount').textContent(),/نتيجة/);
 await page.locator('#violationSearch').fill('');
 await page.locator('#mpTierFilters [data-tier="t5"]').click();
 assert.match(await page.locator('#policeResult').textContent(),/كسر رتبة/,'grade 5 retains original rank break');
 await page.locator('#policeForm input[name="repeat"]').check();
 assert.match(await page.locator('#policeResult').textContent(),/مضاعفة/,'repeat offense penalty doubles');
 await page.locator('#policeForm input[name="repeat"]').uncheck();
 assert.equal(await page.locator('#mpLeadershipDetails').count(),0,'officer cannot assign roles');
 assert.equal(await page.evaluate(()=>window.ASF_POLICE_UI.nameOk('مجاهد')),false);
 assert.equal(await page.evaluate(()=>window.ASF_POLICE_UI.nameOk('مجاهد ال عباد')),true);
 assert.equal(await page.evaluate(()=>window.ASF_POLICE_UI.nameOk('123 456')),false);
 await visit('head');
 assert.equal(await page.locator('#policeNav').evaluate(el=>!el.hidden),true,'police chief has access');
 await page.locator('#mobileMenuToggle').click();
 await page.locator('#policeNav').click();
 assert.equal(await page.locator('#mpLeadershipDetails').count(),0,'all staff toggles moved out of police tools');
 await page.locator('#mobileMenuToggle').click();
 await page.locator('[data-page="members"]').click();
 await page.locator('[data-ac-staff="police"]').waitFor({state:'visible'});
 assert.equal(await page.locator('[data-ac-staff="court"]').count(),0,'police chief cannot distribute court roles');
 await page.locator('[data-ac-staff="police"]').click();
 await page.waitForFunction(()=>window.__policeOps.some(x=>x.name==='asf_management_set_staff'));
 const actions=await page.evaluate(()=>window.__policeOps);
 assert.ok(actions.some(x=>x.name==='asf_management_set_staff'&&x.args.p_section==='police'&&x.args.p_enable===true));
 await visit('commander');
 await page.locator('#mobileMenuToggle').click();
 await page.locator('#departmentAdminNav').click();
 await page.locator('#acHeadSearch').waitFor({state:'visible'});
 assert.equal(await page.locator('[data-head-section]').count(),4,'commander controls four presidencies');
 await page.locator('#mobileMenuToggle').click();
 await page.locator('#policeNav').click();
 await page.locator('#mpInvestigationDetails summary').click();
 await page.locator('#investigationForm input[name="accused"]').fill('عسكري تجريبي');
 await page.locator('#investigationForm input[name="discord"]').fill('99999999999999999999');
 await page.locator('#investigationForm button[type="submit"]').click();
 assert.match(await page.locator('#investigationPreview').textContent(),/الحكم المقترح/);
 await page.locator('#useInvestigation').click();
 assert.equal(await page.locator('#mpReferralDetails').evaluate(el=>el.open),true);
 await page.locator('#mobileMenuToggle').click();
 await page.locator('#courtNav').click();
 assert.equal(await page.locator('#warningLookupForm').count(),1,'court search by full name and ID present');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 assert.ok(overflow<=2,'390px overflow '+overflow);
 assert.deepEqual(errors,[]);
 await browser.close();
 console.log('PASS: hidden restricted sections, legacy police search, chief roles, full names and mobile');
})().catch(err=>{console.error(err);process.exit(1)});
