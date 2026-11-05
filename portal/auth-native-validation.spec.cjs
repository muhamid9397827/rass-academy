// Native form validation must never silently swallow a login click.
// Synthetic Supabase only; no production credentials or data are touched.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {portalMock}=require('./completion-fixtures.cjs');
let mock=portalMock;
const beforeSignIn="signInWithPassword:async()=>({data:{},error:null})";
const beforeSignup="signUp:async()=>({data:{session:null},error:null})";
assert.ok(mock.includes(beforeSignIn)&&mock.includes(beforeSignup),'mock auth anchors exist');
mock=mock.replace(beforeSignIn,
 "signInWithPassword:async()=>{window.__signinCount=(window.__signinCount||0)+1;return {data:{session:{access_token:'test-login-only'}},error:null}}");
mock=mock.replace(beforeSignup,
 "signUp:async()=>{window.__signupCount=(window.__signupCount||0)+1;return {data:{session:null},error:null}}");
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/supabase.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:mock}));
  const url='http://127.0.0.1:8000/portal/';
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('#workspace').waitFor({state:'visible',timeout:12000});
  const getAssets=()=>page.evaluate(()=>{
   const rev=window.ASF_PAGE_ASSET_REV;
   const urls=[...document.querySelectorAll('script[src]')].map(s=>new URL(s.src))
    .filter(u=>u.origin===location.origin&&!u.pathname.includes('/vendor/')&&u.pathname.endsWith('.js'));
   return {rev, count:urls.length, versions:urls.map(u=>u.searchParams.get('v'))};
  });
  const assets=await getAssets();
  assert.ok(assets.count>=12,'all first-party JS files are revisioned: '+JSON.stringify(assets));
  assert.ok(assets.versions.every(v=>v===assets.rev),'all first-party JS use the current page revision');
  await page.waitForTimeout(25);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#workspace').waitFor({state:'visible'});
  assert.notEqual((await getAssets()).rev,assets.rev,'reload changes the asset version, avoiding cached code after deployments');

  await page.locator('#signOut').click();
  await page.locator('#welcome').waitFor({state:'visible'});
  await page.locator('#showLogin').click();
  await page.locator('#email').fill('not-an-email');
  await page.locator('#password').fill('testing');
  await page.locator('#authSubmit').click();
  await page.getByText('صيغة البريد الإلكتروني غير صحيحة.').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.__signinCount||0),0,'invalid email cannot reach auth API');
  assert.equal(await page.locator('#authSubmit').isDisabled(),false);

  await page.locator('#email').fill('synthetic@example.invalid');
  await page.locator('#password').fill('');
  await page.locator('#authSubmit').click();
  await page.getByText('أدخل كلمة المرور للمتابعة.').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.__signinCount||0),0,'empty password cannot reach auth API');

  // Regression: an invalid Discord ID left in a hidden signup field must not
  // block email/password login through native HTML pattern validation.
  await page.locator('#authToggle').click();
  await page.locator('#discordId').fill('invalid-discord-id');
  assert.equal(await page.locator('#discordId').evaluate(e=>e.disabled),false,'signup enables Discord input');
  await page.locator('#authToggle').click();
  assert.equal(await page.locator('#discordId').evaluate(e=>e.disabled),true,'login disables hidden signup fields');
  assert.equal(await page.locator('#gameName').evaluate(e=>e.disabled),true,'login disables hidden game name');
  assert.equal(await page.locator('#rank').evaluate(e=>e.disabled),true,'login disables hidden rank');
  assert.equal(await page.locator('#activationReason').evaluate(e=>e.disabled),true,'login disables hidden activation reason');
  await page.locator('#password').fill('abc123');
  assert.equal(await page.locator('#authForm').evaluate(e=>e.checkValidity()),true,
   'hidden invalid Discord pattern must never block login');
  assert.equal(await page.locator('#password').evaluate(e=>e.minLength),0,'existing passwords have no new signup minimum');
  await page.locator('#authSubmit').click();
  await page.locator('#workspace').waitFor({state:'visible',timeout:12000});
  assert.equal(await page.evaluate(()=>window.__signinCount||0),1,'six-character existing password reaches auth API');
  await page.locator('#signOut').click();
  await page.locator('#welcome').waitFor({state:'visible'});

  await page.locator('#showRegister').click();
  assert.equal(await page.locator('#discordId').evaluate(e=>e.disabled),false,'signup re-enables Discord validation');
  assert.equal(await page.locator('#activationReason').evaluate(e=>e.disabled),false,'signup re-enables activation reason');
  assert.equal(await page.locator('#password').evaluate(e=>e.minLength),8,'new signup still enforces eight characters');
  await page.locator('#email').fill('synthetic@example.invalid');
  await page.locator('#password').fill('abc123');
  await page.locator('#gameName').fill('متدرب اختبار');
  await page.locator('#discordId').fill('123456789012345678');
  await page.locator('#activationReason').fill('أحتاج تفعيل العضوية لأداء المهام الإدارية في البوابة.');
  await page.locator('#authSubmit').click();
  await page.getByText('يجب أن تتكون كلمة مرور الحساب الجديد من 8 أحرف على الأقل.').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.__signupCount||0),0,'invalid signup cannot reach auth API');
  assert.deepEqual(errors,[],'no browser JavaScript errors');
  console.log('PASS: native validation messages, six-character legacy login, signup guard and automatic JS cache-busting');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
