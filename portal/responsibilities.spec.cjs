const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {portalMock}=require('./completion-fixtures.cjs');
const result={id:'course-result-1',receipt:'ACD-00000015',course_id:'operations',is_test:false,trainee_name:'متدرّب ناجح',trainee_rank:'جندي',discord_id:'999000000000000099',course_title:'دورة العمليات',score:9,total:10,percentage:90,passed:true,received_at:new Date().toISOString(),legacy_status:'unconfirmed',training_reviewed_at:new Date().toISOString(),training_reviewed_by_name:'مدرب اختبار',delivered_at:null,delivered_by_name:null};
let sdk=portalMock.replace(" const userId=",' const role=new URLSearchParams(location.search).get("role")||"commander";const courseRows='+JSON.stringify([result])+'; const extra={user_id:"11111111-2222-4333-8444-555555555573",game_name:"مسؤول ثان",rank:"رقيب",status:"approved",military_code:"QA-3"};\n const userId=')
 .replace('reports:[],pdfs:', 'decisions:[],batches:[],reports:[],pdfs:')
 .replace("rank:'جندي',military_code:'ASF-QA002',status:'approved'", "rank:'جندي',activation_reason:'سبب كاف لاعتماد الحساب',military_code:'ASF-QA002',status:role==='admissions'?'pending':'approved'")
 .replace('asf_notifications:state.notifications', 'asf_notifications:role==="courses"?[{id:"course-notice",category:"account_change",event_kind:"academy_pass",message:"هناك اختبار دورة ناجح",created_at:new Date().toISOString()}]:[]')
 .replace('asf_profiles:[state.profile,state.member]','asf_profiles:[state.profile,state.member,extra],asf_responsibilities:role==="admissions"?[{user_id:userId,permission:"users.approve"}]:role==="courses"?[{user_id:userId,permission:"academy.manage"}]:[],asf_academy_results:courseRows')
 .replace("if(name==='asf_is_commander')return {data:true,error:null};",`if(name==='asf_management_directory')return {data:[{...state.member,training_head:false,recruitment_head:false,police_head:false,court_head:false,training_trainer:false,recruitment_trainer:false,police_staff:false,court_staff:false}],error:null};
 if(name==='asf_is_commander')return {data:role==='commander',error:null};
 if(name==='asf_admin_action'){state.decisions.push(args);state.member.status='approved';return {data:'ASF-NEW',error:null};}
 if(name==='asf_set_delegations'){state.batches.push(args);return {data:null,error:null};}
 if(name==='asf_confirm_academy_delivery'){const r=courseRows[0];const already=!!r.delivered_at;if(!already){r.delivered_at=new Date().toISOString();r.delivered_by_name='مسؤول الدورة التجريبي';r.delivered_by_code='QA-LEAD';}return {data:{already_delivered:already,...r},error:null};}`);
(async()=>{
 require('node:fs').mkdirSync('/tmp/asf-mobile',{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/supabase.min.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:sdk}));
 const base='http://127.0.0.1:8000/portal/';
 await page.goto(base+'?role=admissions');await page.locator('#workspace').waitFor({state:'visible'});
 await page.locator('#mobileMenuToggle').click();await page.locator('[data-page="members"]').click();
 await page.locator('[data-ac-action="approve"]').click();
 await page.waitForFunction(()=>window.__asfTest.state.decisions.length>0);
 assert.equal((await page.evaluate(()=>window.__asfTest.state.decisions))[0].op,'approve');
 assert.equal(await page.locator('[data-ac-action="suspend"]').count(),0,'delegated admissions cannot suspend');
 assert.equal(await page.locator('#academyReviewNav').isVisible(),false);
 await page.goto(base+'?role=courses');await page.locator('#dashboardNotices summary').click();await page.locator('[data-open-notice="academy-results"]').click();await page.locator('[data-deliver-result]').waitFor();
 assert.match(await page.locator('#courseGoogleSheet').getAttribute('href'),/1PC5iXwHWyFT4kd7qa6oa_JL1-r3F_anv3fPniF8rfdM/);
 await page.locator('.course-notice-flow summary').click();
 assert.match(await page.locator('.course-notice-flow').innerText(),/الإضافة اليدوية إلى Google لا تولّد إشعارًا/);
 await page.locator('.course-notice-flow summary').click();
 page.once('dialog',d=>d.accept());await page.locator('[data-deliver-result]').click();
 await page.getByText('✓ تم تسليم الرول (توثيق يدوي)',{exact:true}).waitFor();
 assert.match(await page.locator('#academyResultsRows').innerText(),/مسؤول الدورة التجريبي/);
 assert.equal(await page.locator('[data-deliver-result]').count(),0,'confirmed result is not editable');
 await page.screenshot({path:'/tmp/asf-mobile/course-delivery-390.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 await page.goto(base+'?role=ordinary');await page.locator('#workspace').waitFor({state:'visible'});
 assert.equal(await page.locator('#academyReviewNav').isVisible(),false);
 await page.locator('[data-mobile-page="compose"]').click();
 assert.equal(await page.locator('#secretReportGuidance').isVisible(),false);
 await page.locator('#reportKind').selectOption('secret');
 assert.equal(await page.locator('#secretReportGuidance').isVisible(),true);
 assert.match(await page.locator('#secretReportGuidance').innerText(),/جميع الرتب/);
 assert.match(await page.locator('#secretReportGuidance u').innerText(),/إلا القائد نفسه/);
 assert.match(await page.locator('#secretReportGuidance').innerText(),/500 ألف و5 ملايين/);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/tmp/asf-mobile/secret-guidance-390.png',fullPage:true});
 await page.locator('#reportKind').selectOption('personnel');assert.equal(await page.locator('#secretReportGuidance').isVisible(),false);
 await page.goto(base);await page.locator('#workspace').waitFor({state:'visible'});
 await page.locator('#mobileMenuToggle').click();await page.locator('[data-page="delegations"]').click();
 await page.locator('input[name="users"]').nth(0).check();await page.locator('input[name="users"]').nth(1).check();
 await page.locator('input[name="features"][value="reports.read"]').check();await page.locator('input[name="features"][value="users.approve"]').check();
 await page.screenshot({path:'/tmp/asf-mobile/permissions-390.png',fullPage:true});
 await page.locator('#grantsForm button[value="true"]').click();
 await page.waitForFunction(()=>window.__asfTest.state.batches.length>0);
 const batches=await page.evaluate(()=>window.__asfTest.state.batches);assert.equal(batches.length,1);assert.equal(batches[0].p_users.length,2);assert.deepEqual(batches[0].p_features,['reports.read','users.approve']);
 assert.equal(await page.locator('input[name="features"][value*="secret"]').count(),0);
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: delegated admissions without rank powers, course delivery identity, ordinary-member exclusion, mobile layout and multi-person independent permissions');
})().catch(e=>{console.error(e);process.exit(1)});
