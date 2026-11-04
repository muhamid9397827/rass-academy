// Isolated per-tab Supabase Auth storage; no real credentials or external calls.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/auth-client.js','utf8');
function makeStore(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),data};}
function load(store,uuid){
 const fakeWindow={fetch,sessionStorage:store,crypto:{randomUUID:()=>uuid},
  ASF_CONFIG:{supabaseUrl:'https://example.invalid',supabaseAnonKey:'publishable-test'},
  supabase:{createClient:(u,k,opts)=>({opts,auth:{stopAutoRefresh(){}}})}};
 vm.runInNewContext(source,{window:fakeWindow,WeakMap,Error,Promise,AbortController,Request,Response,URL,DOMException,setTimeout,clearTimeout,Math,Date});
 return fakeWindow.ASF_AUTH;
}
const oldStore=makeStore();
const api1=load(oldStore,'qa-tab-one-20261104'),client1=api1.createClient();
assert.equal(client1.opts.auth.persistSession,true);
assert.equal(client1.opts.auth.storage,oldStore);
assert.equal(client1.opts.auth.storageKey,'asf-portal-auth-v3-qa-tab-one-20261104');
oldStore.setItem(client1.opts.auth.storageKey,'stored-token-fixture');
assert.equal(load(oldStore,'new-uuid-is-ignored').createClient().opts.auth.storageKey,client1.opts.auth.storageKey,'reload retains its tab session');
const tab2=makeStore(),client2=load(tab2,'qa-tab-two-20261104').createClient();
assert.notEqual(client1.opts.auth.storageKey,client2.opts.auth.storageKey,'separate tabs do not share their auth namespace');
assert.equal(tab2.getItem(client1.opts.auth.storageKey),null,'second tab has no first tab token');
api1.resetSessionScope();
assert.equal(oldStore.getItem(client1.opts.auth.storageKey),null,'clean reconnect removes just the current token');
assert.equal(oldStore.getItem('asf-portal-auth-tab-v3'),null,'clean reconnect rotates tab identity');
console.log('PASS: per-tab isolated storage, reload persistence, independent tabs and clean reconnect');
