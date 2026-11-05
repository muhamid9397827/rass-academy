// Shared browser sessions: persistence, migration, bounded lifetime and logout.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/auth-client.js','utf8');
function makeStore(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),data};}
let now=1700000000000;
class Clock extends Date{static now(){return now}}
function load(shared,tab=makeStore()){
 const w={fetch,localStorage:shared,sessionStorage:tab,atob:s=>Buffer.from(s,'base64').toString(),
  ASF_CONFIG:{supabaseUrl:'https://example.invalid',supabaseAnonKey:'publishable-test'},
  supabase:{createClient:(u,k,opts)=>({opts,auth:{stopAutoRefresh(){}}})}};
 vm.runInNewContext(source,{window:w,WeakMap,Error,Promise,AbortController,Request,Response,URL,DOMException,setTimeout,clearTimeout,Math,Date:Clock});
 return w.ASF_AUTH;
}
const raw=id=>JSON.stringify({access_token:'header.'+Buffer.from(JSON.stringify({session_id:id})).toString('base64url')+'.sig',refresh_token:'test-refresh',user:{id:'qa-member'}});
const shared=makeStore(),api=load(shared),one=api.createClient(),key=one.opts.auth.storageKey;
assert.equal(key,'asf-portal-auth-v4-example');assert.equal(one.opts.auth.persistSession,true);
one.opts.auth.storage.setItem(key,raw('session-one'));
const two=load(shared).createClient();
assert.equal(two.opts.auth.storageKey,key);assert.equal(two.opts.auth.storage.getItem(key),raw('session-one'),'new tab shares login');
now+=20*86400000;
assert.ok(load(shared).createClient().opts.auth.storage.getItem(key),'browser restart retains session before 21 days');
two.opts.auth.storage.setItem(key,raw('session-one'));
now+=2*86400000;
assert.equal(two.opts.auth.storage.getItem(key),null,'refresh cannot extend the original 21-day window');
one.opts.auth.storage.setItem(key,raw('session-two'));
assert.ok(two.opts.auth.storage.getItem(key),'fresh sign-in starts a new window');
api.resetSessionScope();assert.equal(two.opts.auth.storage.getItem(key),null,'logout clears shared session');
const legacy=makeStore(),next=makeStore();legacy.setItem('asf-portal-auth-tab-v3','legacy-tab');legacy.setItem('asf-portal-auth-v3-legacy-tab',raw('old-session'));
const migrated=load(next,legacy).createClient();assert.equal(migrated.opts.auth.storage.getItem(key),raw('old-session'));assert.equal(legacy.getItem('asf-portal-auth-v3-legacy-tab'),null);
const loggedOut=load(next,legacy);loggedOut.createClient();loggedOut.resetSessionScope();legacy.setItem('asf-portal-auth-tab-v3','stale-tab');legacy.setItem('asf-portal-auth-v3-stale-tab',raw('stale-session'));
assert.equal(load(next,legacy).createClient().opts.auth.storage.getItem(key),null,'stale tabs cannot resurrect a signed-out session');
const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
assert.equal(load(blocked,blocked).createClient().opts.auth.persistSession,false,'memory fallback when all storage is blocked');
console.log('PASS: shared tabs, restart persistence, absolute 21-day lifetime, refresh, logout and legacy migration');
