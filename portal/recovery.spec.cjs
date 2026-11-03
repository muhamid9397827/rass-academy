// Regression: password reset redirect and new-password screen.
// Uses mocked Supabase Auth only; no real tokens, emails, or database changes.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const sdk = `
(() => {
 const state = { reset:null, updated:null, signedOut:0 };
 window.__recoveryQA=state;
 window.supabase = {createClient:()=>({
  auth: {
   getUser:async()=>({data:{user:location.hash.includes('type=recovery') && !location.hash.includes('invalid')?
      {id:'11111111-2222-4333-8444-555555555571'}:null},error:null}),
   onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
   resetPasswordForEmail:async(email,options)=>{state.reset={email,redirectTo:options.redirectTo};return {data:{},error:null}},
   updateUser:async(data)=>{state.updated={password:data.password};return {data:{user:{}},error:null}},
   signOut:async()=>{state.signedOut++;return {error:null}}
  }
 })}
})();
`;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:900,height:780}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/supabase.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:sdk}));
 const base='http://127.0.0.1:8000/portal/';
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.locator('#showLogin').click();
 await page.locator('#email').fill('qa@example.invalid');
 await page.locator('#forgotPassword').click();
 await page.waitForFunction(()=>!!window.__recoveryQA.reset);
 const reset=await page.evaluate(()=>window.__recoveryQA.reset);
 assert.equal(reset.email,'qa@example.invalid');
 assert.equal(reset.redirectTo,'https://muhamid9397827.github.io/rass-academy/portal/','reset must never redirect to localhost');
 await page.goto(base+'#access_token=mock&refresh_token=mock&type=recovery',{waitUntil:'domcontentloaded'});
 await page.locator('#recoveryScreen').waitFor({state:'visible'});
 assert.equal(await page.locator('#welcome').isVisible(),false);
 assert.equal(await page.locator('#workspace').isVisible(),false);
 await page.locator('#recoveryPassword').fill('ExamplePassword2026!');
 await page.locator('#recoveryPasswordConfirm').fill('NotMatching2026!');
 await page.locator('#recoverySubmit').click();
 await page.getByText('كلمتا المرور غير متطابقتين.').waitFor({state:'visible'});
 assert.equal(await page.evaluate(()=>window.__recoveryQA.updated),null,'invalid confirmation must not update password');
 await page.locator('#recoveryPasswordConfirm').fill('ExamplePassword2026!');
 await page.locator('#recoverySubmit').click();
 await page.locator('#authScreen').waitFor({state:'visible'});
 const result=await page.evaluate(()=>({updated:window.__recoveryQA.updated,signedOut:window.__recoveryQA.signedOut,hash:location.hash}));
 assert.equal(result.updated.password,'ExamplePassword2026!');
 assert.equal(result.signedOut,1);
 assert.equal(result.hash,'','sensitive recovery URL fragment must be removed');
 await page.goto(base+'#access_token=invalid&type=recovery',{waitUntil:'domcontentloaded'});
 await page.locator('#recoveryScreen').waitFor({state:'visible'});
 assert.equal(await page.locator('#recoveryForm').isVisible(),false,'expired/invalid session must not offer submission');
 assert.deepEqual(errors,[],'no unhandled browser errors');
 await browser.close();
 console.log('PASS: production redirect, reset form, confirmation validation, recovery session and URL fragment clearing');
})().catch(e=>{console.error(e);process.exit(1)});
