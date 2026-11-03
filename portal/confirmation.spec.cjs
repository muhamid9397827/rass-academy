// Confirmation landing verifies a real Supabase user state, never only a URL marker.
// The test uses mocked Auth; it does not create or alter real users.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const mock="(() => {\n const scenario=new URLSearchParams(location.search).get('scenario')||'success';\n window.__confirmedQA={calls:0};\n window.supabase={createClient:()=>({auth:{getUser:async()=>{\n  window.__confirmedQA.calls++;\n  if(scenario==='missing')return {data:{user:null},error:{message:'Auth session missing'}};\n  if(scenario==='unconfirmed')return {data:{user:{id:'qa',email_confirmed_at:null}},error:null};\n  return {data:{user:{id:'qa',email_confirmed_at:'2026-11-03T10:30:00Z'}},error:null};\n }}})};\n})();";
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1360,height:850}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/supabase.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:mock}));
 const base='http://127.0.0.1:8000/portal/confirmed.html';
 await page.goto(base+'?scenario=success&type=signup#access_token=test-only&refresh_token=test-only&type=signup',{waitUntil:'domcontentloaded'});
 await page.locator('#confirmation-success').waitFor({state:'visible'});
 assert.equal(await page.getByText('تم تأكيد بريدك الإلكتروني').count(),1);
 assert.equal(await page.locator('#confirmation-error').isVisible(),false);
 assert.equal(await page.evaluate(()=>location.hash),'','token-bearing hash cleared');
 assert.equal(await page.evaluate(()=>new URLSearchParams(location.search).has('type')),false,'confirmation type marker cleared');
 for(const width of [1360,768,390,360]){
  await page.setViewportSize({width,height:850});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert.ok(overflow<=2,'horizontal overflow at '+width+': '+overflow);
 }
 assert.equal(await page.locator('.confirmation-button-primary').getAttribute('href'),'index.html?login=1');
 await page.goto(base+'?scenario=unconfirmed&type=signup',{waitUntil:'domcontentloaded'});
 await page.locator('#confirmation-error').waitFor({state:'visible'});
 assert.equal(await page.locator('#confirmation-success').isVisible(),false,'unconfirmed user may not see success');
 await page.goto(base+'?scenario=missing&type=signup',{waitUntil:'domcontentloaded'});
 await page.locator('#confirmation-error').waitFor({state:'visible'});
 assert.equal(await page.locator('#confirmation-success').isVisible(),false,'missing session may not see success');
 await page.goto(base+'?scenario=success&error=access_denied',{waitUntil:'domcontentloaded'});
 await page.locator('#confirmation-error').waitFor({state:'visible'});
 assert.equal(await page.evaluate(()=>window.__confirmedQA?.calls),undefined,'explicit auth error prevents success validation');
 assert.equal(await page.evaluate(()=>new URLSearchParams(location.search).has('error')),false,'error query cleaned');
 assert.deepEqual(errors,[],'no uncaught JavaScript errors');
 await browser.close();
 console.log('PASS: genuine verified confirmation landing, expired/missing errors, URL scrubbing and responsive layout');
})().catch(err=>{console.error(err);process.exit(1)});
