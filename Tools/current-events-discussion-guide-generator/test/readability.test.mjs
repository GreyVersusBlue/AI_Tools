// readability.test.mjs — the reading-level estimate.
//
//   node Tools/current-events-discussion-guide-generator/test/readability.test.mjs
//
// The estimate exists so a teacher can tell, before building a whole guide
// around an article, roughly whether it fits their class. That makes two
// things worth a machine's attention, and they pull in opposite directions:
//
//   1. It has to actually discriminate. A simple text and a dense one must
//      not land on the same band, or the number is decoration.
//   2. It has to refuse to answer when it can't. Flesch–Kincaid on two
//      sentences is noise, and a confident wrong grade level is worse for a
//      teacher than a blank — so short samples report no estimate at all.
//
// Also asserted: the band is always a range rather than a single grade (the
// method is not precise enough to name one), the grade is clamped so one
// run-on sentence can't return "grade 25", and the syllable heuristic is
// right on ordinary words.
//
// cedg-readability.js is a browser-style IIFE attaching to `global`; loading
// it with the Function constructor is the pattern the repo's other pure
// suites use.
//
// Exits 1 on any failure. All sample text here is written for the test.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const globalShim = {};
new Function('global', fs.readFileSync(path.join(dir, '..', 'cedg-readability.js'), 'utf8'))(globalShim);
const R = globalShim.CedgReadability;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const group = (name) => console.log('\n' + name);

/* A plain news story, short sentences, common words. */
const SIMPLE = `
The city put in new bike lanes on Main Street. The work took three weeks.
Cars now have one lane in each way. Some drivers say the road is too slow.
Riders say the street feels safe. The city will count bikes for a month.
A report will come out in the fall. The mayor said the plan may change.
Shop owners on the block are split. One baker likes the new racks out front.
A hardware store owner wants the old parking back. The council will vote again
in June. Until then the lanes will stay. Students who ride to school say the
trip is easier now. Buses keep their own lane on the east end of the street.
`;

/* Same event, dense institutional prose: long sentences, long words. */
const DENSE = `
Municipal authorities implemented a comprehensive reconfiguration of the
Main Street corridor, incorporating protected bicycle infrastructure alongside
substantial modifications to existing vehicular capacity allocations, a
process which required approximately three weeks of continuous construction
activity and necessitated temporary interruptions to established circulation
patterns throughout the surrounding commercial district. Preliminary
observations submitted by transportation department personnel indicate
measurable reductions in average vehicular velocity, although comprehensive
evaluation of the intervention's effectiveness remains contingent upon
completion of a longitudinal monitoring exercise scheduled for publication in
the autumn, at which point the municipal council will reconsider the
allocation decisions underlying the reconfiguration.
`;

/* ===================================================================== */
group('it discriminates between a simple and a dense article');

const simple = R.analyze(SIMPLE);
const dense = R.analyze(DENSE);

ok(simple.enough, 'the simple sample is long enough to estimate');
ok(dense.enough, 'the dense sample is long enough to estimate');
ok(dense.grade > simple.grade + 3,
   `the dense article scores materially harder (${dense.grade} vs ${simple.grade})`);
ok(dense.band !== simple.band, `and lands in a different band (${dense.band} vs ${simple.band})`);
ok(dense.avgWordsPerSentence > simple.avgWordsPerSentence, 'its sentences are longer');
ok(dense.longWordPct > simple.longWordPct, 'and it uses more long words');
ok(simple.grade <= 8, `the plain story reads at or below grade 8 (${simple.grade})`);

group('it refuses to answer on a sample too small to characterise');

const tiny = R.analyze('The council met. It voted.');
eq(tiny.enough, false, 'a two-sentence sample reports no estimate');
ok(tiny.words > 0, 'but still counts its words');
ok(R.summaryLine('The council met. It voted.').includes('too short'),
   'and the editor line says so in words rather than showing a number');
eq(R.summaryLine(''), '', 'empty text produces no line at all');
ok(R.summaryLine(SIMPLE).includes('words'), 'a real article gets a full line');
ok(/grades|college/.test(R.summaryLine(SIMPLE)), 'which includes the band');

group('the numbers stay in a range a teacher can use');

// One enormous run-on sentence: the raw formula returns a grade in the 20s
// for this, which tells a teacher nothing.
const runOn = 'The ' + Array.from({ length: 220 }, () => 'extraordinarily complicated legislative').join(' ') + ' proposal.';
const runOnResult = R.analyze(runOn);
ok(runOnResult.grade <= 16, `an absurd run-on is clamped to the top of the scale (${runOnResult.grade})`);
ok(runOnResult.grade >= 12, 'while still reporting as hard as the scale goes');
ok(R.analyze('Go. Run. Sit. Stop. Hop. Nap. Eat. Play. Rest. Walk. Read. Draw. Sing. Jump. Skip. Talk. Look. Wave. Ride. Swim.').grade >= 1,
   'and a floor of grade 1 holds for text no formula rates below it');

['around grades 3–5', 'around grades 5–7', 'around grades 7–9', 'around grades 9–11', 'around grades 11–12', 'college level']
  .forEach((band, i) => {
    ok(band.includes('–') || band === 'college level', `band ${i} is a range, not one grade: ${band}`);
  });

group('the pieces underneath');

eq(R.syllables('cat'), 1, 'one-syllable word');
eq(R.syllables('paper'), 2, 'two-syllable word');
eq(R.syllables('article'), 3, 'three-syllable word');
eq(R.syllables('legislature'), 4, 'four-syllable word');
eq(R.syllables('make'), 1, 'a silent final e is not counted');
eq(R.syllables(''), 0, 'an empty string has no syllables');
eq(R.syllables('!?'), 0, 'punctuation alone has no syllables');

eq(R.splitWords('The council met on Tuesday.').length, 5, 'words are counted without their punctuation');
eq(R.splitWords("it's a well-known plan").length, 4, "apostrophes and hyphens don't split a word");
eq(R.splitSentences('One. Two! Three? ').length, 3, 'sentences split on . ! and ?');
eq(R.splitSentences('No terminal punctuation here').length, 1, 'a run of text with no full stop is one sentence');
eq(R.analyze('').words, 0, 'empty text analyses as empty');
eq(R.analyze('').enough, false, 'and is never "enough"');

/* ===================================================================== */
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('\nFailures:\n  ' + fails.join('\n  ')); process.exit(1); }
