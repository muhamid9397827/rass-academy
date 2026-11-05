// Browser regression: a never-resolving sign-in must not leave the form disabled.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {portalMock}=require('./completion-fixtures.cjs');
let mock=portalMock;
assert.ok(mock.includes("user:{id:userId,email:'qa-author@example.invalid'}"));
mock=mock.replace("user:{id:userId,email:'qa-author@example.invalid'}","user:null");
assert.ok(mock.includes("signInWithPassword:async()=>({data:{},error:null})"));
mock=mock.replace("signInWithPassword:async()=>({data:{},error:null})","signInWithPassword:()=>new Promise(()=>{})");
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install();
  await page.route('**/supabase.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:mock}));
  await page.goto('http://127.0.0.1:8000/portal/?login=1',{waitUntil:'domcontentloaded'});
  await page.locator('#authScreen').waitFor({state:'visible'});
  await page.locator('#email').fill('synthetic@example.invalid');
  await page.locator('#password').fill('not-a-real-password');
  await page.locator('#authSubmit').click();
  assert.equal(await page.locator('#authSubmit').isDisabled(),true);
  await page.clock.fastForward(34000);
  await page.waitForFunction(()=>!document.querySelector('#authSubmit').disabled,{timeout:5000});
  assert.equal(await page.locator('#authFresh').isVisible(),true,'clean reconnect is offered');
  assert.match(await page.locator('#authStatus').textContent(),/تأخر|الجلسة القديمة/);
  assert.equal(await page.locator('#authForm').getAttribute('aria-busy'),null);
  assert.deepEqual(errors,[],'no browser script errors');
  console.log('PASS: stalled login recovers the button and offers a fresh session');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
