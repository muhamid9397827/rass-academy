// Public landing regression: academy-first design, no internal departments before login.
// No production data writes; local HTTP server serves checked-out branch.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8000/portal/',{waitUntil:'domcontentloaded'});
 const landing=page.locator('#welcome');
 assert.equal(await landing.isVisible(),true,'public landing visible');
 assert.equal(await landing.locator('h1').count(),1,'one principal heading');
 assert.match(await landing.locator('h1').textContent(),/التأهيل/);
 assert.equal(await landing.locator('#openAcademy').count(),1,'one main academy action');
 assert.equal(await landing.locator('#showLogin').count(),1,'login available');
 assert.equal(await landing.locator('#showRegister').count(),1,'registration available');
 assert.equal(await landing.locator('.landing-program-card').count(),3,'public training tracks');
 assert.equal(await landing.locator('.dashboard-card').count(),0,'no internal cards on public page');
 const publicText=await landing.textContent();
 for(const forbidden of ['التقارير','مجلس القضاء','الشرطة العسكرية']){
  assert.equal(publicText.includes(forbidden),false,'internal department exposed on public page: '+forbidden);
 }
 const popup=page.waitForEvent('popup');
 await page.locator('#openAcademy').click();
 const academy=await popup;await academy.waitForLoadState('domcontentloaded');
 assert.ok(academy.url().endsWith('/portal/academy.html'),'academy opens correctly');
 await academy.close();
 await page.locator('#showLogin').click();
 assert.equal(await page.locator('#authScreen').isVisible(),true);
 await page.locator('#authBack').click();
 assert.equal(await landing.isVisible(),true,'back to landing works');
 await page.locator('#showRegister').click();
 assert.equal(await page.locator('#registerFields').isVisible(),true);
 await page.locator('#authBack').click();
 await page.screenshot({path:'/tmp/asf-new-landing-desktop.png',fullPage:true});
 for(const width of [390,360,768]){
  await page.setViewportSize({width,height:844});
  const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,hasButton:!!document.querySelector('#openAcademy')}));
  assert.ok(state.overflow<=2,'horizontal overflow at '+width+'px: '+state.overflow);
  assert.equal(state.hasButton,true);
 }
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'/tmp/asf-new-landing-mobile.png',fullPage:true});
 const criticalErrors=errors.filter(e=>!e.includes('Failed to fetch'));
 assert.deepEqual(criticalErrors,[],'browser uncaught errors');
 await browser.close();
 console.log('PASS: public academy landing, no internal cards, navigation, registration and 360/390/768px');
})().catch(e=>{console.error(e);process.exit(1)});
