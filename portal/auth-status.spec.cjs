// Synthetic browser regression: non-approved accounts never enter private views.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {portalMock}=require('./completion-fixtures.cjs');

function fixture(status){
 let mock=portalMock.replace(
  "military_code:'ASF-QA001',status:'approved'",
  "military_code:'ASF-QA001',status:'"+status+"'"
 );
 mock=mock.replace(
  "if(name==='asf_is_commander')return {data:true,error:null};",
  "if(name==='asf_is_commander')return {data:false,error:null};"
 );
 return mock;
}

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const expected={pending:'يجب استكمال سبب طلب التفعيل',rejected:'تم رفض الطلب',suspended:'الحساب موقوف حاليًا'};
  for(const [status,message] of Object.entries(expected)){
   const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/supabase.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:fixture(status)}));
   await page.goto('http://127.0.0.1:8000/portal/',{waitUntil:'domcontentloaded'});
   await page.locator('#pendingScreen').waitFor({state:'visible',timeout:12000});
   assert.match(await page.locator('#pendingText').textContent(),new RegExp(message));
   assert.equal(await page.locator('#workspace').isVisible(),false,status+' account must not see private workspace');
   assert.equal(await page.locator('#page').textContent(),'','private section content must stay empty');
   assert.equal(await page.locator('#pendingReasonSection').isVisible(),status==='pending');
   assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log('PASS: pending, rejected and suspended accounts remain outside private views');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
