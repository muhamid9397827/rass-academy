// Post-filming admin workflows. Browser uses local Supabase mock only.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {portalMock}=require('./completion-fixtures.cjs');
const app=fs.readFileSync(__dirname+'/app.js','utf8');
const index=fs.readFileSync(__dirname+'/index.html','utf8');
assert.ok(!index.includes('academy-demo.js'),'temporary demo must be removed');
assert.ok(!app.includes('ASF_ACADEMY_DEMO'),'temporary filming UI must be removed');
for(const phrase of ['asf_report_receipt','استلام التقرير','مركز عمليات القيادة','قيد مراجعة القبول والتجنيد'])assert.ok(app.includes(phrase),phrase);
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:860}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/supabase.min.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:portalMock}));
  await page.goto('http://127.0.0.1:8000/portal/?view=dashboard');
  await page.locator('#workspace').waitFor({state:'visible',timeout:15000});
  await page.locator('#operationsCenter').waitFor({state:'visible',timeout:10000});
  await page.waitForFunction(()=>document.querySelector('#operationsCenter')?.textContent.includes('طلبات العضوية'));
  assert.match(await page.locator('#operationsCenter').innerText(),/تصاريح بانتظار القرار/);
  await page.evaluate(()=>document.querySelector('[data-page="recruitment-center"]').click());
  await page.locator('#departmentQualifications').waitFor({state:'visible',timeout:10000});
  assert.match(await page.locator('#departmentQualifications').innerText(),/اختبار تأهيل الأفراد/);
  await page.evaluate(()=>document.querySelector('[data-page="court"]').click());
  await page.locator('#serviceRewardsPanel').waitFor({state:'visible',timeout:10000});
  assert.match(await page.locator('#serviceRewardsPanel').innerText(),/مكافآت جهود مجلس القضاء/);
  assert.deepEqual(errors,[],'console page errors');
  console.log('PASS: filming mode removed; commander operations, recruiter review and court bonuses render');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
