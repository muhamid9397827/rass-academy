// Isolated browser fixtures; never imported by production HTML.
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, 'flow.spec.cjs'), 'utf8');
let portalMock = source.match(/const mockSupabase=String.raw`([\s\S]*?)\n`;/)[1];
const warnings = [
  { id:'warning-active',player_name:'إنذار نشط تجريبي',player_rank:'جندي',player_code:'QA-1',offense:'مخالفة تجريبية',punishment:'إنذار',warning_level:'شفهي',duration_days:7,recorded_at:new Date().toISOString(),cancelled_at:null },
  { id:'warning-expired',player_name:'إنذار منتهي تجريبي',player_rank:'جندي',player_code:'QA-2',offense:'مخالفة تجريبية',punishment:'إنذار',warning_level:'شفهي',duration_days:1,recorded_at:'2020-01-01T10:00:00Z',cancelled_at:null },
  { id:'warning-cancelled',player_name:'إنذار ملغي تجريبي',player_rank:'جندي',player_code:'QA-3',offense:'مخالفة تجريبية',punishment:'إنذار',warning_level:'شفهي',duration_days:7,recorded_at:new Date().toISOString(),cancelled_at:new Date().toISOString(),cancellation_reason:'اختبار الإلغاء' }
];
portalMock = portalMock.replace('asf_court_warnings:[]', 'asf_court_warnings:' + JSON.stringify(warnings))
  .replace('order(){return this;}', 'order(){return this;} range(){return this;} ilike(){return this;}');
const academyState = {
  schemaVersion:2,sessionId:'SESSION-browser-qa-20261103',sector:'facilities_security',stage:'result',courseId:'operations',
  trainee:{name:'اختبار واجهة',rank:'جندي',discord:'99999999999999999999'},
  questionIds:Array.from({length:10},(_,i)=>'operations-q'+String(i+1).padStart(2,'0')),
  answers:Object.fromEntries(Array.from({length:10},(_,i)=>['operations-q'+String(i+1).padStart(2,'0'),0])),
  result:{receipt:'LOCAL-QA',score:10,total:10,percentage:100,passed:true,passingPercentage:70,assignedRank:'',timedOut:false,completedAt:Date.now(),visibilityCount:0,localSaved:true}
};
module.exports={portalMock,academyState};
