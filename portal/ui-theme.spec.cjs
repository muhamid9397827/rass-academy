// Browser contract for the signed-in dashboard's restricted section treatment.
// Uses an isolated fake Supabase client; never reads or writes production data.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');

const mockSupabase=String.raw`(() => {
 const profile={user_id:'u1',game_name:'مستخدم تجريبي',rank:'رقيب',military_code:'ASF-QA003',status:'approved',court_enabled:false};
 class Query {
  constructor(table){this.table=table}
  select(){return this} eq(){return this} is(){return this} limit(){return this} order(){return this}
  async maybeSingle(){return {data:profile,error:null}}
  then(ok,bad){const rows=this.table==='asf_profiles'?[profile]:[];return Promise.resolve({data:rows,error:null}).then(ok,bad)}
 }
 const client={
  auth:{getUser:async()=>({data:{user:{id:'u1',email:'qa@example.invalid'}},error:null}),onAuthStateChange:()=>({})},
  from:table=>new Query(table),rpc:async name=>({data:name==='asf_is_commander'?false:null,error:null}),channel:()=>({on(){return this},subscribe(){return this}}),removeChannel(){}
 };
 window.supabase={createClient(){return client}};
})();`;

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.route('**/supabase.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:mockSupabase}));
 await page.goto('http://127.0.0.1:8000/portal/',{waitUntil:'domcontentloaded'});
 await page.locator('#workspace').waitFor({state:'visible'});
 assert.equal(await page.locator('.dashboard-card').count(),4,'all four portal sections stay visible');
 assert.equal(await page.locator('.dashboard-card.is-restricted').count(),2,'court and police are separately restricted');
 assert.match(await page.locator('[data-section="court"].is-restricted').textContent(),/لا تملك صلاحية الدخول/);
 await page.locator('[data-section="court"].is-restricted').click();
 assert.equal(await page.locator('#restrictedModal').isVisible(),true,'restriction modal opens');
 assert.match(await page.locator('#restrictedMessage').textContent(),/تصريح/);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 assert.ok(overflow<=2,'mobile dashboard has no horizontal overflow');
 await browser.close();
 console.log('PASS: restricted overlay, lock messaging, modal and mobile dashboard');
})().catch(error=>{console.error(error);process.exit(1)});
