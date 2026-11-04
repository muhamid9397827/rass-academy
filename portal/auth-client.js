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
 // A stale localStorage session and/or a zombie Web Lock from an older tab
 // must not prevent the portal from reaching Supabase Auth at all. Each tab
 // maintains its own sessionStorage-backed token and storage/lock namespace.
 // The tab id persists across reloads, but is not shared via localStorage.
 const TAB_KEY='asf-portal-auth-tab-v3';
 const STORAGE_PREFIX='asf-portal-auth-v3-';
 let activeStorageKey=null;
 function storageScope(){
  try{
   const store=window.sessionStorage;
   const probe=TAB_KEY+'-probe';store.setItem(probe,'1');store.removeItem(probe);
   let tab=store.getItem(TAB_KEY);
   if(!/^[a-zA-Z0-9_-]{12,80}$/.test(tab||'')){
    tab=(window.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9_-]/g,'-');
    store.setItem(TAB_KEY,tab);
   }
   return {storage:store,key:STORAGE_PREFIX+tab,persist:true};
  }catch{
   // Storage may be blocked in privacy modes. In-memory Auth still allows
   // login in this tab; it just will not persist after a page reload.
   return {storage:undefined,key:STORAGE_PREFIX+'memory-'+Math.random().toString(36).slice(2),persist:false};
  }
 }
 function createClient(){
  const cfg=window.ASF_CONFIG,scope=new AbortController(),session=storageScope();
  activeStorageKey=session.key;
  const client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{
   global:{fetch:boundedFetch(scope.signal)},
   auth:{storageKey:session.key,storage:session.storage,persistSession:session.persist,
    autoRefreshToken:true,detectSessionInUrl:true}
  });
  scopes.set(client,scope);return client;
 }
 function resetSessionScope(){
  try{
   if(activeStorageKey)window.sessionStorage.removeItem(activeStorageKey);
   window.sessionStorage.removeItem(TAB_KEY);
  }catch{}
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
 window.ASF_AUTH=Object.freeze({createClient,cancel,deadline,boundedFetch,resetSessionScope,AuthTimeoutError});
})();
