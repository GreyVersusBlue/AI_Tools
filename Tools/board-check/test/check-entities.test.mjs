// check-entities.test.mjs — what `check:entities` reports, and what it leaves alone.
//
//   node Tools/board-check/test/check-entities.test.mjs   (or: npm run test:check-entities)
//
// The guard had a blind spot with a shipped bug behind it (#208): 055's sentences
// sat in a `BUILTIN[]` array with `&rsquo;` inside, were read back through
// `item.broken`, and reached `textContent` — counted among the "sink not visible
// statically" and passed. These fixtures pin the two rules that closed it
// (an escaper's argument; array data read back as text through a variable chain)
// and the cases that must stay quiet. Pure Node, no browser.

import { scan } from '../check-entities.mjs';

let passed = 0, failed = 0;
const check = (label, code, wantFindings, wantUnknown) => {
  const r = scan(code, 'fixture');
  const okF = r.findings.length === wantFindings;
  const okU = wantUnknown === undefined || r.unknown === wantUnknown;
  if (okF && okU) passed++;
  else { failed++; console.log(`  FAIL ${label}: findings ${r.findings.length} (want ${wantFindings}), unknown ${r.unknown}${wantUnknown === undefined ? '' : ` (want ${wantUnknown})`}`); }
};

// 055's real shape, before the fix: array rows -> function returns -> filter -> local -> textContent.
const REAL_055 = `
var BUILTIN = [
  ['their going to the movies', 'They&rsquo;re going to the movies.', 'homophones'],
];
function allSentences() { return BUILTIN.concat(custom); }
function filteredSentences() { return allSentences().filter(function (x) { return x; }); }
function renderDisplay() {
  var all = filteredSentences();
  var item = all[order[idx]];
  els.displayFixed.textContent = item.fixed;
}`;
check('055 as it shipped (array -> fn -> local -> textContent)', REAL_055, 1);

// The same data written through innerHTML is correct HTML, not a bug.
check('same data to innerHTML stays quiet', REAL_055.replace('els.displayFixed.textContent = item.fixed', 'els.displayFixed.innerHTML = item.fixed'), 0, 1);

// Data that never reaches a text sink stays "unknown", exactly as before.
check('array never written as text', `var ROWS = ['a &mdash; b'];\nfunction f() { return ROWS; }`, 0, 1);

// A count read off the carrier is not the data.
check('.length of a carrier is not the entity', `var ROWS = ['a &mdash; b'];\nvar order = ROWS.slice();\nel.textContent = order.length;`, 0, 1);

// A string that merely sits next to a carrier name is not a read.
check('a name inside a string is masked', `var ROWS = ['a &mdash; b'];\nvar all = ROWS;\nel.textContent = 'all.x';`, 0, 1);

// An entity handed to an escaper can only render as text, wherever the result goes.
check("escapeHtml('&mdash;') flagged with no dataflow", `h = '<td>' + escapeHtml('&mdash;') + '</td>';`, 1);
check('escapeAttr too', `x = escapeAttr('a &rarr; b');`, 1);
check('an escaper given a variable is not flagged', `x = escapeHtml(v) + '&mdash;';`, 0);

// Direct cases the guard always had.
check('literal straight to textContent', `el.textContent = 'a &mdash; b';`, 1);
check('literal to innerHTML', `el.innerHTML = 'a &mdash; b';`, 0);
check('an escaping table value', `var M = { '&': '&amp;' };`, 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
