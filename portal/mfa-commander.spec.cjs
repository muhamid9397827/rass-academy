// Commander MFA UI regression; mocked Supabase MFA calls, no real enrollment or credentials.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {portalMock}=require('./completion-fixtures.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/supabase.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:portalMock}));
 await page.goto('http://127.0.0.1:8000/portal/');
 await page.locator('#workspace').waitFor({state:'visible'});
 await page.evaluate(()=>{
  document.querySelector('#workspace').hidden=true;document.querySelector('#mfaScreen').hidden=false;
  window.QA={verified:false,calls:[],pass:0};
  const mfa={
   listFactors:async()=>({data:{totp:window.QA.verified?[{id:'factor-test',status:'verified'}]:[]},error:null}),
   enroll:async()=>({data:{id:'factor-test',totp:{qr_code:'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg"></svg>',secret:'TEST-NEVER-REAL'}},error:null}),
   challenge:async({factorId})=>(window.QA.calls.push('challenge:'+factorId),{data:{id:'challenge-test'},error:null}),
   verify:async({factorId,challengeId,code})=>{
    window.QA.calls.push('verify:'+factorId+':'+challengeId);
    if(code==='123456'){window.QA.verified=true;return {data:{},error:null};}
    return {error:{message:'invalid'}};
   },
   getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:window.QA.verified?'aal2':'aal1'},error:null})
  };
  window.qaMfa=window.ASF_COMMANDER_MFA.create({db:{auth:{mfa}},onVerified:()=>{window.QA.pass++},onCancel:()=>{}});
 });
 await page.evaluate(()=>window.qaMfa.enter());
 await page.locator('#mfaStart').waitFor({state:'visible'});
 await page.locator('#mfaStart').click();
 await page.locator('#mfaQr').waitFor({state:'visible'});
 assert.match(await page.locator('#mfaSecret').textContent(),/TEST-NEVER-REAL/);
 await page.locator('#mfaCode').fill('000000');
 await page.locator('#mfaVerifySubmit').click();
 await page.locator('#mfaStatus.error').waitFor();
 assert.equal(await page.evaluate(()=>window.QA.pass),0,'invalid code never unlocks commander');
 await page.locator('#mfaCode').fill('123456');
 await page.locator('#mfaVerifySubmit').click();
 await page.waitForFunction(()=>window.QA.pass===1);
 await page.evaluate(()=>window.qaMfa.enter());
 await page.locator('#mfaStart').waitFor({state:'hidden'});
 await page.locator('#mfaVerify').waitFor({state:'visible'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'MFA screen fits phone');
 assert.deepEqual(errors,[]);
 await browser.close();
 console.log('PASS: commander enrollment, invalid TOTP denial, verified upgrade, subsequent MFA challenge and mobile width');
})().catch(e=>{console.error(e);process.exit(1)});
