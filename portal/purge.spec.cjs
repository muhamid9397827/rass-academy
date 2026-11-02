// Isolated test of the deployed purge handler. No live database or Storage writes.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'supabase/functions/asf-purge/index.ts'),'utf8')
  .replace(/^import\s+\{createClient\}[^\n]+\n/m,'');
 let handler,removed=[],deleted=[],rpcCalls=0;
 let valid=true,storageFail=false,databaseFail=false;
 const expired=[
  {id:'report-1',pdf_path:'folder/report-1.pdf'},
  {id:'report-2',pdf_path:'folder/report-2.pdf'}
 ];
 const db={
  rpc:async(name)=>{rpcCalls++;assert.equal(name,'asf_validate_purge_token');return {data:valid,error:null}},
  from:(table)=>{
   assert.equal(table,'asf_reports');
   return {
    select(){return this},
    lt(){return this},
    limit:async()=>({data:expired,error:null}),
    delete(){return this},
    eq(k,id){assert.equal(k,'id');deleted.push(id);return Promise.resolve({error:databaseFail?{message:'db failed'}:null})}
   };
  },
  storage:{from:(bucket)=>{assert.equal(bucket,'asf-reports');return{
   remove:async(keys)=>{removed.push(keys[0]);return {error:storageFail?{message:'storage failed'}:null}}
  }}}
 };
 const ctx={
  Deno:{serve:fn=>{handler=fn},env:{get:k=>({SUPABASE_URL:'https://test.example',SUPABASE_SERVICE_ROLE_KEY:'service-secret'}[k]||'')}},
  createClient:()=>db,
  Response,Date
 };
 vm.runInNewContext(source,ctx,{timeout:1000});
 assert.equal(typeof handler,'function');
 let response=await handler(new Request('https://example.test',{method:'GET'}));
 assert.equal(response.status,405);
 response=await handler(new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer bad'}}));
 valid=false;response=await handler(new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer bad'}}));
 assert.equal(response.status,401);
 assert.equal(removed.length,0);
 valid=true;storageFail=true;
 response=await handler(new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer verified'}}));
 assert.equal(response.status,200);
 assert.equal(JSON.parse(await response.text()).removed,0);
 assert.equal(deleted.length,0,'must not delete DB row when Storage deletion fails');
 storageFail=false;databaseFail=true;removed=[];
 response=await handler(new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer verified'}}));
 assert.equal(JSON.parse(await response.text()).removed,0);
 assert.equal(deleted.length,2);
 databaseFail=false;deleted=[];removed=[];
 response=await handler(new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer verified'}}));
 assert.equal(response.status,200);
 assert.equal(JSON.parse(await response.text()).removed,2);
 assert.deepEqual(removed,['folder/report-1.pdf','folder/report-2.pdf']);
 assert.deepEqual(deleted,['report-1','report-2']);
 assert.ok(rpcCalls>=4);
 console.log('PASS: purge denies unauthorized calls; deletes DB only after Storage success; retries DB failures');
})().catch(err=>{console.error(err);process.exit(1)});
