// Isolated role-based UX smoke checks. All accounts, results and payments are mocked.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {portalMock}=require('./completion-fixtures.cjs');
const injected="\nconst scenario=new URLSearchParams(location.search).get('role')||'trainer-recruitment';\nconst qaRoles=scenario==='head-training'?[{user_id:'11111111-2222-4333-8444-555555555571',department:'training',role:'head'}]:\n scenario==='trainer-training'?[{user_id:'11111111-2222-4333-8444-555555555571',department:'training',role:'trainer'}]:\n scenario==='trainer-recruitment'?[{user_id:'11111111-2222-4333-8444-555555555571',department:'recruitment',role:'trainer'}]:\n scenario==='head-recruitment'?[{user_id:'11111111-2222-4333-8444-555555555571',department:'recruitment',role:'head'}]:\n scenario==='member-training'?[{user_id:'11111111-2222-4333-8444-555555555571',department:'training',role:'member'}]:[];\nconst qaResult={id:'77777777-2222-4333-8444-555555555580',receipt:'ACD-00000111',\n course_id:'operations',trainee_name:'متدرب التدريب',trainee_rank:'جندي',\n discord_id:'123456789012345678',course_title:'دورة العمليات',score:9,total:10,percentage:90,\n passed:true,is_test:false,received_at:new Date().toISOString(),legacy_status:'unconfirmed',delivered_at:null};\nconst rewards=scenario==='head-recruitment'?[{id:'88888888-2222-4333-8444-555555555582',subject_id:'77777777-2222-4333-8444-555555555581',department:'recruitment',\n subject_label:'مجند تمت الموافقة عليه',actor_id:'11111111-2222-4333-8444-555555555572',\n actor_name:'مدرب القبول',amount:150000,earned_at:new Date().toISOString(),paid_at:null}]:[];\nconst actions=[];";
const beforeClass="if(scenario==='trainer-recruitment') {state.member.status='pending';state.member.activation_reason='سبب طلب تفعيل تجريبي مكتمل للموافقة.';}";
const extraRpcs="\nif(name==='asf_department_set_role'){\n actions.push({name,args});\n if(args.p_enable)qaRoles.push({user_id:args.p_user,department:args.p_department,role:args.p_role});\n return {data:null,error:null};\n}\nif(name==='asf_recruitment_accept'){\n actions.push({name,args});state.member.status='approved';\n rewards.push({id:'88888888-2222-4333-8444-555555555580',department:'recruitment',\n subject_label:state.member.game_name,actor_id:userId,actor_name:state.profile.game_name,\n amount:150000,earned_at:new Date().toISOString(),paid_at:null});\n return {data:'ASF-TEST',error:null};\n}\nif(name==='asf_confirm_academy_delivery'){\n actions.push({name,args});qaResult.delivered_at=new Date().toISOString();\n qaResult.delivered_by_name=state.profile.game_name;\n rewards.push({id:'88888888-2222-4333-8444-555555555581',department:'training',\n  subject_id:qaResult.id,subject_label:'متدرب التدريب - دورة العمليات',actor_id:userId,\n  actor_name:state.profile.game_name,amount:150000,earned_at:new Date().toISOString(),paid_at:null});\n return {data:{already_delivered:false,delivered_by_name:state.profile.game_name},error:null};\n}\nif(name==='asf_department_mark_paid'){\n actions.push({name,args});const reward=rewards.find(x=>x.id===args.p_reward);\n reward.paid_at=new Date().toISOString();return {data:{paid_at:reward.paid_at},error:null};\n}";
let sdk=portalMock
 .replace(" const userId="," "+injected+"\n const userId=")
 .replace(" class Q {",beforeClass+"\n class Q {")
 .replace('asf_profiles:[state.profile,state.member]',
  'asf_profiles:[state.profile,state.member],asf_department_roles:qaRoles,asf_department_rewards:rewards,asf_academy_results:[qaResult],asf_responsibilities:[]')
 .replace("if(name==='asf_is_commander')return {data:true,error:null};",
  "if(name==='asf_is_commander')return {data:scenario==='commander',error:null};\n"+extraRpcs)
 .replace('window.__asfTest={state};','window.__asfTest={state,qaRoles,actions,rewards};');
assert.match(sdk,/asf_recruitment_accept/,'the SDK mock must include recruitment RPC');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.accept());
 await page.route('**/supabase.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:sdk}));
 const base='http://127.0.0.1:8000/portal/';
 async function visit(role){
  await page.goto(base+'?role='+role,{waitUntil:'domcontentloaded'});
  await page.locator('#workspace').waitFor({state:'visible',timeout:20000});
 }
 await visit('member-training');
 assert.equal(await page.locator('#trainingCenterNav').evaluate(el=>el.hidden),false);
 assert.equal(await page.locator('#recruitmentCenterNav').evaluate(el=>el.hidden),true);
 await page.locator('#mobileMenuToggle').click();
 await page.locator('#trainingCenterNav').click();
 assert.equal(await page.locator('#departmentWork').count(),0,'member cannot access instructor work');
 assert.equal(await page.locator('#academyResultsRows').count(),0,'member cannot view trainees');
 await visit('trainer-recruitment');
 assert.equal(await page.locator('#trainingCenterNav').evaluate(el=>el.hidden),true);
 await page.locator('#mobileMenuToggle').click();
 await page.locator('#recruitmentCenterNav').click();
 await page.locator('#departmentApplicants').waitFor({state:'visible'});
 assert.equal(await page.locator('#departmentRolesPanel').count(),0);
 await page.locator('[data-recruit]').click();
 await page.locator('#departmentRewards .dept-record').waitFor({state:'visible'});
 assert.match(await page.locator('#departmentRewards').innerText(),/150,000/);
 assert.equal((await page.evaluate(()=>window.__asfTest.actions))[0].name,'asf_recruitment_accept');
 await visit('head-training');
 await page.locator('#mobileMenuToggle').click();await page.locator('#trainingCenterNav').click();
 await page.locator('#departmentRoleForm').waitFor({state:'visible'});
 assert.deepEqual(await page.locator('#departmentRoleForm select[name="role"] option').allTextContents(),['مدرب القسم']);
 await page.locator('#departmentRoleForm select[name="user"]').selectOption('11111111-2222-4333-8444-555555555572');
 await page.locator('#departmentRoleForm button[value="true"]').click();
 assert.equal((await page.evaluate(()=>window.__asfTest.actions)).some(x=>x.name==='asf_department_set_role'&&x.args.p_role==='trainer'),true);
 await visit('trainer-training');
 await page.locator('#mobileMenuToggle').click();await page.locator('#trainingCenterNav').click();
 await page.locator('[data-deliver-result]').waitFor({state:'visible'});
 await page.locator('[data-deliver-result]').click();
 await page.locator('#departmentRewards .dept-record').waitFor({state:'visible'});
 assert.match(await page.locator('#academyResultsRows').innerText(),/مكافأة المدرب/);
 assert.match(await page.locator('#departmentRewards').innerText(),/بانتظار المكافأة/);
 await visit('head-recruitment');
 await page.locator('#mobileMenuToggle').click();await page.locator('#recruitmentCenterNav').click();
 await page.locator('[data-reward-paid]').waitFor({state:'visible'});
 await page.locator('[data-reward-paid]').click();
 await page.getByText('✓ تم صرف المكافأة').waitFor({state:'visible'});
 await visit('commander');await page.locator('#mobileMenuToggle').click();
 await page.locator('#departmentAdminNav').click();
 await page.locator('#departmentRoleForm').waitFor({state:'visible'});
 assert.equal(await page.locator('#departmentRoleForm select[name="role"] option').count(),3);
 await page.locator('#departmentAdminSelect').selectOption('recruitment');
 await page.locator('#departmentRoleForm').waitFor({state:'visible'});
 assert.deepEqual(errors,[]);
 await browser.close();
 console.log('PASS: roles, restricted department menus, training and recruitment workflows, supervisor payout and mobile');
})().catch(e=>{console.error(e);process.exit(1)});
