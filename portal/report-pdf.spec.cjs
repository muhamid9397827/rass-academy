// Real report renderer and real html2pdf raster/PDF output; synthetic data only.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(__dirname+'/app.js','utf8');
const functions=source.slice(source.indexOf('function renderPaper('),source.indexOf('async function renderServiceRewards('));
const constants=source.split('\n').filter(l=>/^const (esc|KINDS|date|code)=/.test(l)).join('\n');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 fs.mkdirSync('/tmp/asf-pdf',{recursive:true});
 try{
  for(const width of [320,1280]){
   const page=await browser.newPage({viewport:{width,height:900}});
   await page.goto('http://127.0.0.1:8000/portal/');
   await page.waitForFunction(()=>typeof window.html2pdf==='function');
   await page.addScriptTag({content:constants+'\n'+functions+'\nwindow.pdfQA={buildPdf,renderPaper};'});
   for(const sample of ['free','structured','long']){
    const mode=sample==='structured'?'structured':'free';
    const report={mode,kind:'presidencies',report_number:999,submitted_at:'2026-11-05T12:00:00Z',sender_name:'اختبار تقرير',sender_rank:'نقيب',sender_code:'QA-PDF',title:'التحقق من محتوى التقرير',body:mode==='free'?{text:'هذا نص التقرير الكامل الذي كتبه المرسل.\nتمت متابعة الأعمال اليومية وتسجيل الملاحظات بدقة.\nBODY-FREE-CONTENT'}:{achievements:'تم إنجاز المهمات المطلوبة. BODY-ACHIEVEMENTS',progress:'تقدم العمل حسب الخطة. BODY-PROGRESS',needs:'نحتاج متابعة الطلبات. BODY-NEEDS',notes:'ملاحظات إضافية مهمة. BODY-NOTES'}};
    if(sample==='long')report.body.text=('فقرة طويلة للتأكد من ظهور جميع أجزاء التقرير عبر الصفحات. BODY-LONG-CONTENT\n').repeat(65);
    const result=await page.evaluate(async report=>{
     const original=window.html2pdf;let worker;
     window.html2pdf=(...args)=>(worker=original(...args));
     try{
      const paper=window.pdfQA.renderPaper(report);document.body.append(paper);
      const origin=paper.getBoundingClientRect();
      const areas=[...paper.querySelectorAll('.paper-body')].map(el=>{const r=el.getBoundingClientRect();return {x:r.left-origin.left,y:r.top-origin.top,width:r.width,height:r.height}});
      paper.remove();
      const blob=await window.pdfQA.buildPdf(report),canvas=await worker.get('canvas');
      const factor=canvas.width/714,ctx=canvas.getContext('2d');
      const pageHeight=Math.floor(canvas.width*277/190);
      for(let boundary=pageHeight;boundary<canvas.height;boundary+=pageHeight){
       const edge=ctx.getImageData(0,boundary-1,canvas.width,2).data;
       if([...edge].some((value,i)=>i%4!==3&&value<230))throw Error('PDF page break intersects report text');
      }
      const ink=areas.map(a=>{
       const pixels=ctx.getImageData(Math.max(0,Math.round(a.x*factor)),Math.max(0,Math.round(a.y*factor)),Math.floor(a.width*factor),Math.max(1,Math.floor(a.height*factor))).data;
       let dark=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<150&&pixels[i+1]<150&&pixels[i+2]<150)dark++;
       return dark;
      });
      return {ink,bytes:Array.from(new Uint8Array(await blob.arrayBuffer())),height:canvas.height};
     }finally{window.html2pdf=original;}
    },report);
    assert.ok(result.ink.every(n=>n>100),'body text must render as visible ink: '+mode+' '+width+' '+JSON.stringify(result.ink));
    assert.ok(result.bytes.length>5000,'actual PDF has report content');
    fs.writeFileSync('/tmp/asf-pdf/report-'+sample+'-'+width+'.pdf',Buffer.from(result.bytes));
   }
   await page.close();
  }
  console.log('PASS: real free/structured PDF body ink at 320 and 1280px; PDF artifacts saved');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
