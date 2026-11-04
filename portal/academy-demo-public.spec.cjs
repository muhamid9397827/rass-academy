// Standalone filming demo opens without Auth and makes no Supabase calls.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[],remote=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',req=>{if(req.url().includes('supabase.co'))remote.push(req.url())});
  const response=await page.goto('http://127.0.0.1:8000/portal/academy-demo.html?demo=1');
  assert.equal(response.status(),200);
  await page.locator('[data-demo-row]').first().waitFor({state:'visible',timeout:9000});
  assert.equal(await page.locator('[data-demo-row]').count(),3);
  assert.equal(await page.locator('#authForm').count(),0,'standalone demo must not require a login');
  assert.match(await page.locator('main').innerText(),/مجاهد ال عباد/);
  for(const course of ['دورة العمليات','اختبار تأهيل الأفراد','دورة السوات']){
   assert.ok((await page.locator('main').innerText()).includes(course));
  }
  assert.equal(remote.length,0,'simulation does not connect to production Supabase');
  await page.locator('#academyDemoActor').fill('المدرب خالد التجريبي');
  await page.locator('#academyDemoAuthority').fill('رئاسة كلية التدريب التجريبية');
  await page.locator('[data-demo-deliver="01"]').click();
  await page.locator('[data-demo-pay="01"]').click();
  const resultText=await page.locator('[data-demo-row="01"]').innerText();
  assert.match(resultText,/تم تسليم الرول من قبل: المدرب خالد التجريبي/);
  assert.match(resultText,/تم إعطاء مكافأة 150,000 من قبل: رئاسة كلية التدريب التجريبية/);
  assert.match(resultText,/تم إعطاء المكافأة بالمحاكاة/);
  await page.reload();
  await page.locator('[data-demo-row]').first().waitFor({state:'visible',timeout:9000});
  assert.match(await page.locator('[data-demo-row="01"]').innerText(),/محاكاة تسليم الرول/);
  assert.deepEqual(errors,[]);
  console.log('PASS: public standalone demo opens without login, 3 visible passes, local-only delivery/pay, resets on reload');
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
