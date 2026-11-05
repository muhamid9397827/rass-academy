// Real vendored SDK, isolated HTTP fixtures. No production credentials or writes.
let activePage;
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base='http://127.0.0.1:8000/portal/',ref='sxtbgnjbrcsmgsdhkbno',uid='11111111-2222-4333-8444-555555555571';
const member={id:uid,aud:'authenticated',role:'authenticated',email:'qa@example.invalid',email_confirmed_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[],created_at:'2026-01-01T00:00:00Z'};
const profile={user_id:uid,game_name:'اختبار جلسة حقيقية',discord_id:'999000000000000001',rank:'جندي',status:'approved',military_code:'QA-SESSION',court_enabled:false};
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const jwt=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:uid,role:'authenticated',aud:'authenticated',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,session_id:'11111111-2222-4333-8444-555555555572'})+'.qa_signature';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const ctx=await browser.newContext({viewport:{width:390,height:844}});const errors=[];let mode='ok',tokens=0;
 await ctx.route('https://'+ref+'.supabase.co/**',async route=>{
  const req=route.request(),u=new URL(req.url());let body={},status=200;
  if(u.pathname==='/auth/v1/token'){
   tokens++;
   if(mode==='invalid'){status=400;body={code:'invalid_credentials',msg:'Invalid login credentials'};}
   else if(mode==='offline')return route.abort('internetdisconnected');
   else body={access_token:jwt,token_type:'bearer',expires_in:3600,refresh_token:'qa-refresh-token',user:member};
  }else if(u.pathname==='/auth/v1/user')body=member;
  else if(u.pathname==='/auth/v1/logout'){status=204;body=null;}
  else if(u.pathname==='/rest/v1/rpc/asf_is_commander')body=true;
  else if(u.pathname==='/rest/v1/asf_profiles')body=[profile];
  else if(mode==='section-error'&&u.pathname==='/rest/v1/asf_reports'){status=503;body={message:'QA temporary section failure',code:'QA_FAILURE'};}
  else body=[];
  await route.fulfill({status,contentType:'application/json',body:body===null?'':JSON.stringify(body),headers:{'Access-Control-Allow-Origin':'*'}});
 });
 await ctx.routeWebSocket('wss://'+ref+'.supabase.co/**',ws=>ws.close());
 const holder=await ctx.newPage();await holder.goto(base+'config.js');
 await holder.evaluate(ref=>{window.lockReady=false;navigator.locks.request('lock:sb-'+ref+'-auth-token',async()=>{window.lockReady=true;await new Promise(r=>window.releaseOldLock=r);});},ref);
 await holder.waitForFunction(()=>window.lockReady);
 // Control: the previous SDK reproduces the user's permanently disabled button.
 const oldResponse=await fetch('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/dist/umd/supabase.min.js',{signal:AbortSignal.timeout(15000)});assert.equal(oldResponse.ok,true);const oldBundle=await oldResponse.text();
 const probe=await ctx.newPage();await probe.route('**/vendor/supabase-2.118.0/supabase.min.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:oldBundle}));
 // Legacy control intentionally uses its original shared storage key.
 await probe.route('**/auth-client.js*',r=>r.fulfill({status:200,contentType:'application/javascript',body:
  "window.ASF_AUTH={createClient:()=>window.supabase.createClient(window.ASF_CONFIG.supabaseUrl,window.ASF_CONFIG.supabaseAnonKey),deadline:fn=>fn(),cancel:()=>{},resetSessionScope:()=>{}};"}));
 await probe.goto(base);await probe.locator('#showLogin').click();await probe.locator('#email').fill('qa@example.invalid');await probe.locator('#password').fill('TestPass2026!');await probe.locator('#authSubmit').click();await probe.waitForTimeout(700);assert.equal(await probe.locator('#authSubmit').isDisabled(),true,'previous SDK waits indefinitely behind the held lock');assert.equal(tokens,1,'legacy password request succeeded, but loading the session is still blocked');assert.match(await probe.locator('#authStatus').innerText(),/جارٍ (التحقق من بيانات الدخول|تحميل بيانات الحساب)/);await probe.close();
 await holder.evaluate(ref=>localStorage.removeItem('sb-'+ref+'-auth-token'),ref);tokens=0;
 const page=activePage=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 // A lock held by an old tab must not stall the current SDK's initialization or sign-in.
 await page.goto(base+'?login=1');await page.locator('#authScreen').waitFor({state:'visible'});
 await page.locator('#email').fill('qa@example.invalid');await page.locator('#password').fill('TestPass2026!');await page.locator('#authSubmit').click();
 await page.locator('#workspace').waitFor({state:'visible',timeout:12000});await page.waitForFunction(()=>!document.querySelector('#authSubmit').disabled,{},{timeout:12000});assert.equal(tokens,1);assert.equal(await page.locator('#authSubmit').isDisabled(),false);
 fs.mkdirSync('/tmp/asf-mobile',{recursive:true});await page.screenshot({path:'/tmp/asf-mobile/login-fixed-390.png',fullPage:true});
 assert.ok(await holder.evaluate(async()=>{const state=await navigator.locks.query();return state.held.some(l=>l.name.includes('auth-token'));}),'old lock remains held, without blocking new SDK');
 // Persisted session survives a mobile reload while the old tab's lock still exists.
 await page.reload();await page.locator('#workspace').waitFor({state:'visible',timeout:12000});assert.equal(tokens,1);
 const second=await ctx.newPage();await second.goto(base);await second.locator('#workspace').waitFor({state:'visible',timeout:12000});assert.equal(tokens,1,'new tab reuses the existing session without password sign-in');
 mode='section-error';await page.locator('[data-mobile-page="reports"]').click();await page.getByText('تعذر تحميل القسم:',{exact:false}).waitFor();assert.match(await page.locator('#page').innerText(),/QA temporary section failure/);
 mode='ok';await page.locator('#signOut').click();await page.locator('#welcome').waitFor({state:'visible'});assert.equal(await page.locator('#page').textContent(),'');
 await second.locator('#welcome').waitFor({state:'visible',timeout:12000});assert.equal(await second.locator('#workspace').isVisible(),false,'logout propagates to other tabs');await second.close();
 // Existing accounts may have a 6-character password allowed by Supabase.
 // An HTML minlength=8 on the *login* field silently swallowed the click.
 await page.locator('#showLogin').click();
 await page.locator('#email').fill('qa@example.invalid');
 await page.locator('#password').fill('abc123');
 assert.equal(await page.locator('#password').evaluate(e=>e.minLength),0);
 const shortBefore=tokens;
 await page.locator('#authSubmit').click();
 await page.locator('#workspace').waitFor({state:'visible',timeout:12000});
 assert.equal(tokens,shortBefore+1,'short existing password must reach Auth API');
 await page.locator('#signOut').click();await page.locator('#welcome').waitFor({state:'visible'});
 await page.locator('#showRegister').click();
 assert.equal(await page.locator('#password').evaluate(e=>e.minLength),8,'new account password still requires eight chars');
 await page.locator('#authToggle').click();
 assert.equal(await page.locator('#password').evaluate(e=>e.minLength),0,'return to sign-in removes signup constraint');
 mode='invalid';await page.locator('#email').fill('qa@example.invalid');await page.locator('#password').fill('WrongPass2026!');await page.locator('#authSubmit').click();await page.locator('#authStatus.error').waitFor();assert.match(await page.locator('#authStatus').innerText(),/كلمة المرور غير صحيحة/);assert.equal(await page.locator('#authSubmit').isDisabled(),false);
 mode='offline';await page.locator('#authSubmit').click();await page.locator('#authStatus.error').waitFor();await page.waitForFunction(()=>!document.querySelector('#authSubmit').disabled);assert.equal(await page.locator('#workspace').isVisible(),false);
 await page.screenshot({path:'/tmp/asf-mobile/login-offline-390.png',fullPage:true});
 mode='ok';await page.locator('#email').fill('qa@example.invalid');await page.locator('#password').fill('TestPass2026!');await page.locator('#authSubmit').click();await page.locator('#workspace').waitFor({state:'visible',timeout:12000});
 const expiry=await ctx.newPage();await expiry.goto(base);await expiry.locator('#workspace').waitFor({state:'visible',timeout:12000});
 await expiry.clock.install();await expiry.clock.setSystemTime(Date.now()+22*86400000);await expiry.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expiry.locator('#welcome').waitFor({state:'visible',timeout:12000});await page.locator('#welcome').waitFor({state:'visible',timeout:12000});await expiry.close();
 await holder.evaluate(()=>window.releaseOldLock());assert.deepEqual(errors,[]);await ctx.close();await browser.close();
 console.log('PASS real SDK: mobile sign-in and session reload under held legacy Web Lock, password errors, network failure, section error boundary and cleared logout data');
})().catch(async e=>{if(activePage){console.error('UI state:',await activePage.locator('#authStatus').innerText().catch(()=>''));fs.mkdirSync('/tmp/asf-mobile',{recursive:true});await activePage.screenshot({path:'/tmp/asf-mobile/login-failure-390.png',fullPage:true}).catch(()=>{});}console.error(e);process.exit(1)});
