// Brand and legacy "About" migration regression for the public portal.
// Uses only a local static HTTP server; does not write production data.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 const base='http://127.0.0.1:8000/portal/';
 const logoPath='assets/facilities-security-logo.webp';
 const logoResp=await page.request.get(base+logoPath);
 assert.equal(logoResp.status(),200,'approved logo served');
 const bytes=await logoResp.body();
 assert.equal(bytes.subarray(0,4).toString(),'RIFF','image is a real WebP file');
 assert.equal(bytes.subarray(8,12).toString(),'WEBP','image has WebP signature');
 await page.goto(base,{waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('.topbar .brand-logo').count(),1,'landing header has logo');
 assert.equal(await page.locator('.topbar .brand-logo').evaluate(e=>e.complete&&e.naturalWidth>0),true,'logo renders');
 assert.equal(await page.locator('.landing-about-link').count(),1,'visible landing About link');
 const logoSize=await page.locator('.topbar .brand-logo').boundingBox();
 assert.ok(logoSize.width<=52 && logoSize.height<=52,'logo is compact for header');
 await page.locator('.landing-about-link').click();
 await page.waitForURL('**/portal/about.html');
 assert.match(await page.title(),/معلومات عنا/);
 assert.equal(await page.locator('h1').count(),1);
 assert.match(await page.locator('body').innerText(),/مجاهد ال عباد/,'legacy development credit remains');
 assert.match(await page.locator('body').innerText(),/إدارة محافظة الرس/,'legacy provenance preserved');
 assert.match(await page.locator('body').innerText(),/الخصوصية والمسؤولية/);
 assert.equal(await page.locator('.about-hero-logo').evaluate(e=>e.complete&&e.naturalWidth>0),true);
 for(const width of [320,360,390,430,768]){
  await page.setViewportSize({width,height:820});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(overflow<=2,'about page overflow at '+width+': '+overflow);
 }
 await page.goto(base+'academy.html',{waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('.site-header .brand-logo').count(),1,'academy header has logo');
 assert.equal(await page.locator('.site-header .brand-logo').evaluate(e=>e.complete&&e.naturalWidth>0),true,'academy logo renders');
 assert.equal(await page.locator('.academy-about-link').count(),1,'academy has About link');
 await browser.close();
 console.log('PASS: logo, About text, academy link, WebP asset and mobile widths 320–768');
})().catch(e=>{console.error(e);process.exit(1)});
