// Real vendored Supabase SDK regression: recover a near-expiry stored session
// before subscribing to Auth events. All responses are local HTTP mocks.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const ref='sxtbgnjbrcsmgsdhkbno',base='http://127.0.0.1:8000/portal/';
const uid='11111111-2222-4333-8444-555555555571';
const member={id:uid,aud:'authenticated',role:'authenticated',email:'qa-expiry@example.invalid',
 email_confirmed_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[],created_at:'2026-01-01T00:00:00Z'};
const profile={user_id:uid,game_name:'عضو تجريبي',discord_id:'999000000000000001',rank:'جندي',status:'approved',military_code:'QA-EXPIRY',court_enabled:false};
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const token=ttl=>enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:uid,role:'authenticated',aud:'authenticated',aal:'aal1',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+ttl,session_id:'11111111-2222-4333-8444-555555555572'})+'.fake-test-signature';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 let refreshes=0,users=0;
 await ctx.route('https://'+ref+'.supabase.co/**',async route=>{
  const u=new URL(route.request().url());let body=[],status=200;
  if(u.pathname==='/auth/v1/token'&&u.searchParams.get('grant_type')==='refresh_token'){
   refreshes++;body={access_token:token(3600),token_type:'bearer',expires_in:3600,refresh_token:'fresh-qa-refresh',user:member};
  }else if(u.pathname==='/auth/v1/user'){users++;body=member;}
  else if(u.pathname==='/rest/v1/rpc/asf_commander_mfa_required'||u.pathname==='/rest/v1/rpc/asf_is_commander')body=false;
  else if(u.pathname==='/rest/v1/asf_profiles')body=[profile];
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Access-Control-Allow-Origin':'*'}});
 });
 await ctx.routeWebSocket('wss://'+ref+'.supabase.co/**',ws=>ws.close());
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base+'config.js');
  await page.evaluate(({ref,token,user})=>{
   const value={access_token:token,token_type:'bearer',expires_in:30,expires_at:Math.floor(Date.now()/1000)+30,refresh_token:'old-qa-refresh',user};
   localStorage.setItem('sb-'+ref+'-auth-token',JSON.stringify(value));
  },{ref,token:token(30),user:member});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#workspace').waitFor({state:'visible',timeout:14000});
  assert.equal(await page.locator('#sessionLabel').textContent(),profile.game_name);
  assert.ok(refreshes>=1,'SDK refreshes near-expiry stored session');
  assert.ok(users>=1,'SDK revalidates user over Auth API');
  assert.deepEqual(errors,[],'no browser initialization errors');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#workspace').waitFor({state:'visible',timeout:14000});
  assert.deepEqual(errors,[]);
  console.log('PASS: near-expiry Auth session refresh, deferred subscription, reload and private app view');
 }finally{await ctx.close();await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
