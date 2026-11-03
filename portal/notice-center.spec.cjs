const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.goto('http://127.0.0.1:8000/portal/',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
   const fakeRows=[
    {id:'00000000-0000-0000-0000-000000000001',category:'registration',message:'طلب عضوية جديد',created_at:'2026-11-03T10:00:00Z',read_at:null},
    {id:'00000000-0000-0000-0000-000000000002',category:'access_decision',message:'تم قبول طلب تصريح',created_at:'2026-11-03T11:00:00Z',read_at:'2026-11-03T12:00:00Z'}
   ];
   const db={from:()=>{
    return {select:(_cols,opts)=>{
      if(opts?.head)return {is:async()=>({count:1,error:null})};
      return {order:()=>({limit:async()=>({data:fakeRows,error:null})})};
    }};
   }};
   const ui=window.ASF_NOTICE_CENTER.create({db,getUser:()=>({id:'test-member'}),go:()=>{},notify:()=>{}});
   await ui.render();await ui.refreshBadge();
   const state={rows:document.querySelectorAll('.notice-entry').length,badge:document.querySelector('#notificationCount').textContent,tabCount:document.querySelectorAll('.notice-filter').length,text:document.querySelector('#noticeList').textContent};
   document.querySelector('[data-tab="unread"]').click();
   state.unreadRows=document.querySelectorAll('.notice-entry').length;
   return state;
  });
  assert.equal(result.rows,2);assert.equal(result.unreadRows,1);assert.equal(result.badge,'1');assert.equal(result.tabCount,6);
  assert.match(result.text,/تم قبول طلب تصريح/);
  await page.setViewportSize({width:320,height:750});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=2),'notice inbox must fit narrow phones');
  console.log('PASS: RLS-backed notification inbox, exact badge, filtering and narrow mobile rendering');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
