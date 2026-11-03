// Shared by login and the confirmation callback. Authorization stays on the server.
(() => {
 'use strict';
 const scopes=new WeakMap();
 class AuthTimeoutError extends Error {
  constructor(){super('تأخر الاتصال بخدمة الدخول. أعد فتح صفحة الدخول وحاول مجددًا.');this.name='AuthTimeoutError';}
 }
 function boundedFetch(scope,fetcher=window.fetch.bind(window),timeoutMs=15000){
  return async(input,options={})=>{
   const controller=new AbortController();
   const upstream=options.signal||(typeof Request!=='undefined'&&input instanceof Request?input.signal:null);
   const signals=[scope,upstream].filter(Boolean),listeners=[];
   for(const signal of signals){
    const forward=()=>controller.abort(signal.reason);
    if(signal.aborted)forward();else{signal.addEventListener('abort',forward,{once:true});listeners.push([signal,forward]);}
   }
   const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
   const api=/\/auth\/v1(?:\/|$)|\/rest\/v1(?:\/|$)/.test(url);
   const timer=setTimeout(()=>controller.abort(new AuthTimeoutError()),api?timeoutMs:60000);
   try{
    controller.signal.throwIfAborted();
    const response=await fetcher(input,{...options,signal:controller.signal});
    // Include the JSON response body in the timeout, not only its HTTP headers.
    const body=await response.arrayBuffer();
    return new Response([204,205,304].includes(response.status)?null:body,{status:response.status,statusText:response.statusText,headers:response.headers});
   }finally{clearTimeout(timer);for(const [signal,listener] of listeners)signal.removeEventListener('abort',listener);}
  };
 }
 function createClient(){
  const cfg=window.ASF_CONFIG,scope=new AbortController();
  const client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{global:{fetch:boundedFetch(scope.signal)}});
  scopes.set(client,scope);return client;
 }
 function cancel(client){
  scopes.get(client)?.abort(new AuthTimeoutError());
  // Do not wait for an unhealthy client during recovery.
  try{Promise.resolve(client?.auth?.stopAutoRefresh?.()).catch(()=>{});}catch{}
 }
 async function deadline(task,onTimeout=()=>{},milliseconds=25000){
  let timer;
  try{return await Promise.race([Promise.resolve().then(task),new Promise((_,reject)=>{timer=setTimeout(()=>{try{onTimeout();}finally{reject(new AuthTimeoutError());}},milliseconds);})]);}
  finally{clearTimeout(timer);}
 }
 window.ASF_AUTH=Object.freeze({createClient,cancel,deadline,boundedFetch,AuthTimeoutError});
})();
