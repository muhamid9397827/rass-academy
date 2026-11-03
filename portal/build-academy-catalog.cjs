// CI guard: public question banks may contain questions and choices, never marking keys.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),sandbox={window:{}};
const ids=['individual-qualification','operations','military-character','air-wing','zone-officer','swat'];
vm.runInNewContext(fs.readFileSync(path.join(root,'js/courses.js'),'utf8'),sandbox,{timeout:1000});
let total=0;
for(const id of ids){
 const src=fs.readFileSync(path.join(root,'js/banks',id+'.js'),'utf8');
 assert(!/(?:["']?answerIndex["']?)\s*:/.test(src),'Public marking answer detected in '+id);
 vm.runInNewContext(src,sandbox,{timeout:1000});
 const c=Object.values(sandbox.window.COURSES).find(x=>x.id===id);
 assert(c&&c.questions.length>=(c.questionsPerQuiz||10),'Missing questions in '+id);
 assert(c.questions.every(q=>q.id&&q.text&&Array.isArray(q.options)&&q.options.length>1),'Broken question in '+id);
 total+=c.questions.length;
}
assert(!fs.existsSync(path.join(__dirname,'supabase/functions/asf-academy-results/catalog.json')),'Private marking catalog must never be publicly committed');
console.log('PASS: '+ids.length+' intact public banks with '+total+' questions and no exposed marking keys');
