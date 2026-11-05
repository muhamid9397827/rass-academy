// Phone/tablet interaction and layout tests. Uses fake members and no live writes.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {portalMock,academyState}=require('./completion-fixtures.cjs');
const reason='سبب طلب التفعيل مع تفاصيل طويلة لاختبار التفاف النص وظهور الإجراءات بوضوح. '.repeat(5);
const ledger={is_test:false,receipt:'ACD-00000001',trainee_name:'اسم متدرب طويل لاختبار الشاشة الصغيرة',trainee_rank:'ملازم أول',discord_id:'99999999999999999999',course_title:'دورة الشخصية العسكرية',score:9,total:10,percentage:90,passed:true,received_at:new Date().toISOString(),legacy_status:'unconfirmed'};
let sdk=portalMock.replace("military_code:'ASF-QA001'",'activation_reason:'+JSON.stringify(reason)+",military_code:'ASF-QA001'")
 .replace('asf_police_overrides:[]','asf_police_overrides:[],asf_academy_results:'+JSON.stringify([ledger]))
 .replace('asf_change_requests:[]','asf_change_requests:'+JSON.stringify([{id:'qa-change',user_id:'11111111-2222-4333-8444-555555555572',new_game_name:'اسم تجريبي طويل لتعديل العضوية',new_discord_id:'99999999999999999999',state:'pending'}]));
sdk=sdk.replace("if(name==='asf_is_commander')return {data:true,error:null};",
 "if(name==='asf_management_directory')return {data:[{...state.member,activation_reason:'صلاحية اختبار',training_head:false,recruitment_head:false,police_head:false,court_head:false,training_trainer:true,recruitment_trainer:false,police_staff:false,court_staff:false}],error:null};\n   if(name==='asf_is_commander')return {data:true,error:null};");
fs.mkdirSync('/tmp/asf-mobile',{recursive:true});
const base='http://127.0.0.1:8000/portal/';
async function fits(page,label){
 const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(geometry.scroll<=geometry.width+2,label+' overflow: '+JSON.stringify(geometry));
}
async function section(page,name){
 await page.locator('#mobileMenuToggle').click();
 await page.locator('#portalSidebar [data-page="'+name+'"]').click();
 await page.locator('#page .empty').filter({hasText:'جارٍ تحميل البيانات...'}).waitFor({state:'hidden'});
 assert.equal(await page.locator('#mobileMenuToggle').getAttribute('aria-expanded'),'false','navigation closes drawer');
 await page.locator('#portalSidebar').waitFor({state:'hidden'});
 assert.equal(await page.locator('#portalSidebar').evaluate(el=>el.inert),true,'closed drawer cannot capture keyboard focus');
 assert.doesNotMatch(await page.locator('#page').innerText(),/تعذر تحميل القسم/);
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const errors=[];
 for(const width of [320,390,430,768]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/supabase.min.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:sdk}));
  await page.goto(base);await page.locator('#workspace').waitFor({state:'visible'});
  assert.equal(await page.locator('#mobileBottomNav').isVisible(),true);
  await fits(page,'dashboard '+width);
  if(width===390)await page.screenshot({path:'/tmp/asf-mobile/dashboard-390.png',fullPage:true,animations:'disabled'});
  await page.locator('#mobileMore').click();
  assert.equal(await page.locator('#mobileMenuToggle').getAttribute('aria-expanded'),'true');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#mobileMenuToggle').getAttribute('aria-expanded'),'false');
  await page.locator('#mobileMenuToggle').click();
  await page.locator('#mobileMenuBackdrop').click({position:{x:5,y:100},force:true});
  assert.equal(await page.locator('#mobileMenuToggle').getAttribute('aria-expanded'),'false');
  for(const name of ['members','changes','delegations','audit','compose','police','court','academy','access','account','reports','trash','inbox']){
   await section(page,name);await fits(page,name+' '+width);
   if(name==='members'&&width<=430){
    await page.locator('.ac-hero h2').waitFor({state:'visible'});
    await page.locator('.ac-member').waitFor({state:'visible'});
    assert.match(await page.locator('.ac-content').innerText(),/QA Member/);
    if(width===390)await page.screenshot({path:'/tmp/asf-mobile/members-390.png',fullPage:true,animations:'disabled'});
   }
  }
  await page.locator('[data-mobile-page="compose"]').click();
  await page.locator('#reportForm').waitFor({state:'visible'});
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  await page.locator('[data-mobile-page="dashboard"]').click();
  assert.ok(await page.evaluate(()=>scrollY)<5,'changing mobile sections starts at the heading');
  const hit=await page.locator('#mobileBottomNav button').evaluateAll(nodes=>nodes.every(el=>el.getBoundingClientRect().height>=44));
  assert.ok(hit,'quick navigation has finger-sized controls');
  await page.setViewportSize({width:1280,height:900});
  assert.equal(await page.locator('#portalSidebar').isVisible(),true,'desktop sidebar restored');
  await page.waitForFunction(()=>!document.querySelector('#portalSidebar').inert);
  assert.equal(await page.locator('#portalSidebar').evaluate(el=>el.inert),false);
  assert.equal(await page.locator('#mobileBottomNav').isVisible(),false,'phone chrome absent on desktop');
  await context.close();
 }
 for(const width of [320,390,768]){
  const page=await browser.newPage({viewport:{width,height:844}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('#welcome').waitFor({state:'visible'});await fits(page,'public '+width);
  await page.locator('#showLogin').click();await page.locator('#authToggle').click();
  await fits(page,'signup '+width);
  assert.ok(Number.parseFloat(await page.locator('#email').evaluate(el=>getComputedStyle(el).fontSize))>=16,'no iOS input zoom');
  if(width===390)await page.screenshot({path:'/tmp/asf-mobile/signup-390.png',fullPage:true,animations:'disabled'});
  await page.goto(base+'academy.html');await page.locator('#start-facilities-training').click();await fits(page,'academy entry '+width);
  await page.locator('#trainee-name').fill('متدرّب تجريبي');await page.locator('#trainee-discord').fill('99999999999999999999');await page.locator('#trainee-rank').selectOption('جندي');await page.locator('#course-select').selectOption('operations');await page.locator('label[for="simulation-consent"]').click();assert.equal(await page.locator('#simulation-consent').isChecked(),true);await page.locator('#entry-submit-button').click();
  await page.locator('#study-view').waitFor({state:'visible'});await fits(page,'study '+width);await page.close();
  const quiz=await browser.newPage({viewport:{width,height:844}});quiz.on('pageerror',e=>errors.push(e.message));
  const state={...academyState,stage:'quiz',result:null,optionOrders:Object.fromEntries(academyState.questionIds.map(id=>[id,[0,1,2]])),answers:{},visibilityCount:0,studyStartedAt:Date.now()-600000,studyEndsAt:Date.now()-1000,quizStartedAt:Date.now(),quizEndsAt:Date.now()+600000,createdAt:Date.now(),updatedAt:Date.now()};
  await quiz.addInitScript(s=>localStorage.setItem('asf-portal-academy-v1:active-session',JSON.stringify(s)),state);
  await quiz.goto(base+'academy.html');await quiz.locator('#start-facilities-training').click();await quiz.locator('#resume-button').click();await quiz.locator('#quiz-view').waitFor({state:'visible'});await fits(quiz,'quiz '+width);
  if(width===390)await quiz.screenshot({path:'/tmp/asf-mobile/quiz-390.png',fullPage:true,animations:'disabled'});await quiz.close();
  const result=await browser.newPage({viewport:{width,height:844}});
  await result.addInitScript(s=>localStorage.setItem('asf-portal-academy-v1:last-result',JSON.stringify(s)),academyState);
  await result.goto(base+'academy.html');await result.locator('#start-facilities-training').click();await result.locator('#resume-button').click();await result.locator('#result-view').waitFor({state:'visible'});await fits(result,'result '+width);
  if(width===390)await result.screenshot({path:'/tmp/asf-mobile/result-390.png',fullPage:true,animations:'disabled'});await result.close();
 }
 assert.deepEqual(errors,[],'no unhandled JavaScript errors');
 await browser.close();console.log('PASS mobile: 320/390/430/768, 13 workspace sections, drawers, touch controls, tables, signup, study, quiz and result; desktop preserved');
})().catch(e=>{console.error(e);process.exit(1)});
