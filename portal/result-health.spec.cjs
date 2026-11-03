// Read-only production checks. No results, reports, users or emails are created.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const box={window:{}};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'config.js'),'utf8'),box);
 const cfg=box.window.ASF_CONFIG;
 const response=await fetch(cfg.supabaseUrl+'/functions/v1/asf-academy-results',{method:'OPTIONS',headers:{Origin:'https://muhamid9397827.github.io','Access-Control-Request-Method':'POST'},signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,204,'receipt service preflight');
 assert.equal(response.headers.get('access-control-allow-origin'),'https://muhamid9397827.github.io');
 const ledger=await fetch(cfg.supabaseUrl+'/rest/v1/asf_academy_results?select=receipt&limit=1',{headers:{apikey:cfg.supabaseAnonKey},signal:AbortSignal.timeout(15000)});
 assert.ok([401,403].includes(ledger.status),'private result ledger must reject public reads');
 console.log('PASS: production receipt service reachable and result ledger private');
})().catch(e=>{console.error(e.message);process.exit(1)});
