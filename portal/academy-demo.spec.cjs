// The video-only simulation must never appear in the production portal.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const script=fs.readFileSync(__dirname+'/app.js','utf8');
assert.doesNotMatch(html,/academy-demo\\.js|academy-demo\\.html|demo=1/);
assert.doesNotMatch(script,/ASF_ACADEMY_DEMO|academyDemoPanel/);
console.log('PASS: filming simulation is no longer mounted or linked in the live portal');
