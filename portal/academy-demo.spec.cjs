// Video demo must not write results, deliver real roles or pay real rewards.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {portalMock}=require('./completion-fixtures.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/supabase.min.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:portalMock}));
  await page.goto('http://127.0.0.1:8000/portal/?view=academy-results&demo=1');
  await page.locator('#academyDemoPanel [data-demo-row]').first().waitFor({state:'visible'});
  assert.equal(await page.locator('#academyDemoPanel [data-demo-row]').count(),3);
  const text=await page.locator('#academyDemoPanel').innerText();
  for(const t of ['مجاهد ال عباد','دورة العمليات','اختبار تأهيل الأفراد','دورة السوات','98375026481936520741','97638190425716382054','96417283051628497320'])assert.ok(text.includes(t),t);
  await page.locator('[data-demo-deliver="01"]').click();
  await page.locator('[data-demo-pay="01"]').click();
  assert.match(await page.locator('[data-demo-row="01"]').innerText(),/تم التأشير بالمحاكاة/);
  await page.reload();
  await page.locator('#academyDemoPanel [data-demo-row]').first().waitFor({state:'visible'});
  assert.match(await page.locator('[data-demo-row="01"]').innerText(),/محاكاة تسليم الرول/);
  assert.deepEqual(errors,[]);
  console.log('PASS: 3 Arabic video demo successes, independent copy IDs, simulated delivery/reward and no persistence');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
