// Academy landing and training flow checks. No production account or result writes.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1360,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8000/portal/academy.html',{waitUntil:'domcontentloaded'});
 const landing=page.locator('#sector-view');await landing.waitFor({state:'visible'});
 assert.equal(await page.locator('#entry-view').isVisible(),false,'start on academy landing');
 const landingCopy=await page.locator('body').textContent();
 for(const phrase of ['تغيير القطاع','عرض القطاعات','الأفواج الأمنية','الأمن العام','القطاعات المتاحة'])
  assert.equal(landingCopy.includes(phrase),false,'obsolete phrase remains: '+phrase);
 assert.equal(await page.locator('#start-facilities-training').isVisible(),true);
 assert.equal(await page.locator('.asf-training-feature').count(),3);
 assert.match(await page.locator('#sector-subtitle').textContent(),/دورات|دراسة/);
 for(const width of [1360,768,390,360]){
  await page.setViewportSize({width,height:860});
  const measures=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth}));
  assert.ok(measures.overflow<=2,'academy horizontal overflow at '+width+': '+measures.overflow);
 }
 await page.locator('#start-facilities-training').click();
 await page.locator('#entry-view').waitFor({state:'visible'});
 const options=await page.locator('#course-select option').allTextContents();
 assert.ok(options.length>=5,'actual academy courses loaded');
 assert.ok(options.some(o=>o.includes('العمليات')),'operations course retained');
 assert.ok(options.every(o=>!o.includes('الأفواج')&&!o.includes('الأمن العام')),'old courses filtered');
 await page.reload({waitUntil:'domcontentloaded'});
 await landing.waitFor({state:'visible'});
 assert.equal(await page.locator('#entry-view').isVisible(),false,'landing remains first visit state');
 assert.deepEqual(errors,[],'uncaught JavaScript error');
 await browser.close();
 console.log('PASS: academy landing, no sectors, working courses, reload, and mobile layout');
})().catch(e=>{console.error(e);process.exit(1)});
