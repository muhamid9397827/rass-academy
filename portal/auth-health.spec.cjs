// Read-only health check against live Supabase Auth using the PUBLIC project key.
// Never creates accounts or reports, and never prints credentials.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
(async()=>{
 const source=fs.readFileSync(require('node:path').join(__dirname,'config.js'),'utf8');
 const sandbox={window:{}};
 vm.runInNewContext(source,sandbox,{timeout:1000});
 const cfg=sandbox.window.ASF_CONFIG;
 assert.ok(cfg?.supabaseUrl?.startsWith('https://')&&cfg?.supabaseAnonKey,'missing public project configuration');
 const url=new URL('/auth/v1/settings',cfg.supabaseUrl);
 const response=await fetch(url,{headers:{apikey:cfg.supabaseAnonKey},signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,200,'Supabase Auth public settings endpoint must be reachable');
 const settings=await response.json();
 assert.equal(settings.external?.email,true,'Email/password authentication provider is not enabled');
 assert.notEqual(settings.disable_signup,true,'Supabase Auth public signup is disabled');
 console.log('PASS: live Auth available, email/password enabled, signups permitted');
})().catch(err=>{console.error('ASF live Auth readiness failed:',err.message);process.exit(1)});
