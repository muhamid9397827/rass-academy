// Derive the server's marking keys from the existing, unchanged course banks.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const sandbox = { window: {} };
for (const file of ['js/courses.js', ...['individual-qualification', 'operations', 'military-character', 'air-wing', 'zone-officer', 'swat'].map(id => `js/banks/${id}.js`)]) {
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { timeout: 1000 });
}
const catalog = Object.fromEntries(Object.values(sandbox.window.COURSES)
  .filter(c => c.sector === 'facilities_security' && c.hasQuiz)
  .map(c => [c.id, {
    title: c.title, applicant: !!c.applicantCourse,
    count: c.questionsPerQuiz || 10, passing: c.passingPercentage || 70,
    questions: Object.fromEntries(c.questions.map(q => [q.id, { answer: q.answerIndex, options: q.options.length }]))
  }]));
const target = path.join(__dirname, 'supabase/functions/asf-academy-results/catalog.json');
const output = JSON.stringify(catalog, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8') !== output) throw Error('Regenerate the academy marking catalog');
} else {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output);
}
console.log('Academy marking catalog: ' + Object.keys(catalog).length + ' courses');
