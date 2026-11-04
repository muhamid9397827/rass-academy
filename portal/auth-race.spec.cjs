// Regression for the Supabase session initialization / onAuthStateChange Web Lock race.
// All sessions are synthetic; this test never authenticates a real account.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {portalMock}=require('./completion-fixtures.cjs');
let mock=portalMock;
function edit(a,b){assert.ok(mock.includes(a),'fixture anchor missing '+a);mock=mock.replace(a,b);}
edit(' const state={', ' window.__asfTrace=[];\n const state={');
edit('getUser:async()=>({data:{user:state.user},error:null})',`getUser:async()=>{
   window.__asfTrace.push('getUser:start');
   await new Promise(resolve=>setTimeout(resolve,35));
   window.__asfTrace.push('getUser:done');
   return {data:{user:state.user},error:null};
  }`);
edit('onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})',`onAuthStateChange:()=>{
    window.__asfTrace.push('subscribe');
    if(!window.__asfTrace.includes('getUser:done'))throw Error('auth listener attached during initialization');
    return {data:{subscription:{unsubscribe(){}}}};
   }`);
edit("signInWithPassword:async()=>({data:{},error:null})","signInWithPassword:async()=>({data:{session:{access_token:'test-only-session'}},error:null})");
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/supabase.min.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:mock}));
  const base='http://127.0.0.1:8000/portal/';
  for(let i=0;i<3;i++){
   await page.goto(base+(i?'?reauth='+i:''),{waitUntil:'domcontentloaded'});
   await page.locator('#workspace').waitFor({state:'visible',timeout:12000});
   const trace=await page.evaluate(()=>window.__asfTrace.slice());
   assert.deepEqual(trace.slice(0,3),['getUser:start','getUser:done','subscribe'],'listener attaches after getUser initialization');
  }
  await page.locator('#signOut').click();
  await page.locator('#welcome').waitFor({state:'visible'});
  await page.locator('#showLogin').click();
  await page.locator('#email').fill('qa@example.invalid');
  await page.locator('#password').fill('Testing2026!word');
  await page.locator('#authSubmit').click();
  await page.locator('#workspace').waitFor({state:'visible',timeout:12000});
  await page.waitForFunction(()=>!document.querySelector('#authSubmit').disabled);
  assert.equal(await page.locator('#authSubmit').isDisabled(),false,'login button must always unlock');
  assert.deepEqual(errors,[],'browser JavaScript errors');
  await browser.close();
  console.log('PASS: session initialization before listener, three reloads, password login and button recovery');
 }catch(e){await browser.close();throw e;}
})().catch(e=>{console.error(e);process.exit(1)});
