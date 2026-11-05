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
 // The vendored SDK coordinates refreshes across tabs without the legacy Web Lock.
 // Keep one project-scoped session, with a 21-day browser reauthentication window.
 const SESSION_MAX_AGE=21*24*60*60*1000;
 const TAB_KEY='asf-portal-auth-tab-v3',OLD_PREFIX='asf-portal-auth-v3-';
 let activeSession=null;
 function sessionIdentity(raw){
  try{
   const value=JSON.parse(raw),part=value.access_token?.split('.')[1];
   if(part&&window.atob){
    const claims=JSON.parse(window.atob(part.replace(/-/g,'+').replace(/_/g,'/')));
    if(claims.session_id)return claims.session_id;
   }
   return value.user?.id||null;
  }catch{return null;}
 }
 function storageScope(){
  const project=new URL(window.ASF_CONFIG.supabaseUrl).hostname.split('.')[0];
  const key='asf-portal-auth-v4-'+project,metaKey=key+'-lifetime',logoutKey=key+'-signed-out';
  for(const name of ['localStorage','sessionStorage']){
   try{
    const store=window[name],probe=key+'-probe';store.setItem(probe,'1');store.removeItem(probe);
    const metadata=()=>{try{return JSON.parse(store.getItem(metaKey)||'null')}catch{return null}};
    const expired=()=>{const m=metadata();return !!m&&(!Number.isFinite(m.startedAt)||Date.now()-m.startedAt>=SESSION_MAX_AGE)};
    const clear=()=>{store.removeItem(key);store.removeItem(metaKey);store.setItem(logoutKey,String(Date.now()));};
    const storage={
     getItem(k){
      if(k===key&&expired()){clear();return null;}
      return store.getItem(k);
     },
     setItem(k,value){
      if(k===key){
       const id=sessionIdentity(value),m=metadata();
       if(!m||m.sessionId!==id)store.setItem(metaKey,JSON.stringify({sessionId:id,startedAt:Date.now()}));
      }
      store.setItem(k,value);
     },
     removeItem(k){if(k===key)clear();else store.removeItem(k);}
    };
    // Migrate this tab's current v3 login once. Never revive a v3 token after logout.
    if(!store.getItem(key)&&!store.getItem(logoutKey)){
     const old=window.sessionStorage,tab=old?.getItem(TAB_KEY),oldKey=OLD_PREFIX+tab;
     const raw=tab&&old.getItem(oldKey);
     if(raw&&sessionIdentity(raw)){storage.setItem(key,raw);old.removeItem(oldKey);old.removeItem(TAB_KEY);}
    }
    return {key,storage,persist:true,expired,clear};
   }catch{}
  }
  return {key:key+'-memory',storage:undefined,persist:false,expired:()=>false,clear:()=>{}};
 }
 function createClient(){
  const cfg=window.ASF_CONFIG,scope=new AbortController(),session=storageScope();
  activeSession=session;
  const client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{
   global:{fetch:boundedFetch(scope.signal)},
   auth:{storageKey:session.key,storage:session.storage,persistSession:session.persist,
    autoRefreshToken:true,detectSessionInUrl:true}
  });
  scopes.set(client,scope);
  // Clear expired or remotely signed-out views even in an already-open tab.
  if(window.addEventListener&&window.setInterval){
   let closing=false;
   const closeLocal=()=>{
    if(closing||scope.signal.aborted)return;closing=true;session.clear();
    Promise.resolve(client.auth.signOut({scope:'local'})).catch(()=>{}).finally(()=>{closing=false});
   };
   const check=()=>{if(session.expired())closeLocal();};
   const storageChanged=e=>{if(e.key===session.key&&e.newValue===null)closeLocal();else if(e.key===session.key+'-lifetime')check();};
   const timer=window.setInterval(check,60000);
   window.addEventListener('focus',check);window.addEventListener('storage',storageChanged);
   scope.signal.addEventListener('abort',()=>{window.clearInterval(timer);window.removeEventListener('focus',check);window.removeEventListener('storage',storageChanged);},{once:true});
  }
  return client;
 }
 function resetSessionScope(){
  try{activeSession?.clear();}catch{}
  try{const old=window.sessionStorage,tab=old.getItem(TAB_KEY);if(tab)old.removeItem(OLD_PREFIX+tab);old.removeItem(TAB_KEY);}catch{}
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
 window.ASF_AUTH=Object.freeze({createClient,cancel,deadline,boundedFetch,resetSessionScope,SESSION_MAX_AGE,AuthTimeoutError});
})();
