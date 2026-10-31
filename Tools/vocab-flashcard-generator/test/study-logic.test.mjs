// study-logic.test.mjs — pure-logic checks for vfg-study.js (Path 19 P4): the Frayer
// page, the fill-in-the-blank sheet, the spaced-repetition schedule and the word wall
// system's units. No browser, no clock, no zone: dates are read as UTC days.
//
//   node Tools/vocab-flashcard-generator/test/study-logic.test.mjs
//
// Exits 1 on any failure. Every word here is invented.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const shim = {};
for (const f of ['vfg-printables.js', 'vfg-study.js']) new Function('global', fs.readFileSync(path.join(dir, '..', f), 'utf8'))(shim);
const S = shim.VfgStudy;

let failures = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { failures++; console.error('FAIL: ' + msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); }

const items = [
  { term: 'cat', definition: 'a small pet', example: 'The cat sat on the mat.', partOfSpeech: 'noun', pronunciation: '' },
  { term: 'Dog', definition: 'a loyal pet', example: 'A dog barked; the dog ran.', partOfSpeech: 'noun', pronunciation: '' },
  { term: 'run', definition: 'move fast', example: 'We run every day', partOfSpeech: 'verb', pronunciation: '' },
  { term: 'café', definition: 'a small restaurant', example: 'Meet me at the café, please.', partOfSpeech: 'noun', pronunciation: '' },
  { term: 'cat', definition: 'dup', example: 'Category is not a cat word', partOfSpeech: '', pronunciation: '' },
  { term: 'bird', definition: 'it flies', example: '', partOfSpeech: '', pronunciation: '' },
  { term: 'fish', definition: 'it swims', example: 'Fishing is fun.', partOfSpeech: '', pronunciation: '' }
];

/* ---- Frayer ---- */
const fb = S.frayer(items, {});
ok(fb.ok && fb.sheets.length === 7, 'frayer makes one sheet per word');
ok(fb.sheets.every(s => s.definition === '' && s.examples === ''), 'blank frayer is blank');
eq(fb.pages.length, 7, 'one per page by default');
const fk = S.frayer(items, { fill: 'known', perPage: 2 });
eq(fk.pages.length, 4, 'two per page: 7 words are 4 pages');
eq(fk.sheets[0].definition, 'a small pet', 'known fill puts the definition in');
eq(fk.sheets[0].examples, 'The cat sat on the mat.', 'known fill puts the example in');
ok(S.frayer([], {}).ok === false && S.frayer(null, {}).ok === false, 'frayer of nothing is refused');
ok(S.frayer([{ term: '  ' }], {}).ok === false, 'a blank term is not a word');
eq(S.frayer(items, { perPage: 9 }).perPage, 1, 'perPage other than 2 is 1');

/* ---- blankOut ---- */
eq(S.blankOut('The cat sat.', 'cat'), { before: 'The ', answer: 'cat', after: ' sat.' }, 'blankOut finds the word');
eq(S.blankOut('The Cat sat.', 'cat').answer, 'Cat', 'case-insensitive, answer keeps the sentence\'s case');
eq(S.blankOut('Category only', 'cat'), null, 'cat is not found inside category');
eq(S.blankOut('The bobcat sat', 'cat'), null, 'cat is not found at the end of bobcat');
eq(S.blankOut('Meet at the café, please.', 'café').after, ', please.', 'an accented word is found and punctuation stays');
eq(S.blankOut('Un cafe', 'café'), null, 'no accent-folding: café is not cafe');
eq(S.blankOut('a (b+c) d', '(b+c)').answer, '(b+c)', 'regex characters in a term are literal');
eq(S.blankOut('', 'x'), null, 'empty sentence');
eq(S.blankOut('x', ''), null, 'empty term');
eq(S.blankOut('dog dog', 'dog').after, ' dog', 'only the first occurrence is blanked');
eq(S.blankOut('El niño', 'niño').before, 'El ', 'ñ is a letter');
eq(S.blankOut('ñandú', 'andú'), null, 'a letter before the term blocks it');

/* ---- cloze ---- */
const cz = S.cloze(items, {});
ok(cz.ok, 'cloze works');
eq(cz.rows.map(r => r.term), ['cat', 'Dog', 'run', 'café', 'cat'], 'rows follow the list');
ok(cz.rows.length === 5, 'five sentences hold their word (the second cat is a whole word in "Category is not a cat word")');
eq(cz.skipped.map(s => s.term), ['bird', 'fish'], 'bird (no example) and fish (Fishing) are skipped');
eq(cz.skipped.map(s => s.why), ['no example', 'example does not contain the word'], 'each skip says why');
eq(cz.bank.slice().sort(), cz.rows.map(r => r.answer).sort(), 'the bank is the answers');
eq(S.cloze(items, {}).bank, cz.bank, 'same list, same bank order');
eq(S.cloze(items, { bank: false }).bank, [], 'no bank when asked');
ok(S.cloze([items[0]], {}).ok === false && S.cloze([items[0]], {}).have === 1, 'one sentence is too few');
ok(S.cloze(items.filter(i => !i.example), {}).ok === false, 'no sentences is refused and says what was skipped');

/* ---- schedule ---- */
const w = n => Array.from({ length: n }, (_, i) => ({ term: 'w' + (i + 1) }));
const s12 = S.schedule(w(12), { perDay: 5, steps: [1, 3] });
ok(s12.ok && !s12.dated, 'undated schedule');
eq(s12.days.map(d => d.learn.length), [5, 5, 2, 0, 0, 0], '12 words at 5 a day: 5,5,2 then three review-only days');
eq(s12.days.length, 3 + 3, 'it ends on the last review day (learn day 3 + step 3)');
eq(s12.days[1].review.map(r => r.term + '@' + r.step), ['w1@1', 'w2@1', 'w3@1', 'w4@1', 'w5@1'], 'day 2 reviews day 1 at step 1');
eq(s12.days[3].review.map(r => r.term + '@' + r.step), ['w11@1', 'w12@1', 'w1@3', 'w2@3', 'w3@3', 'w4@3', 'w5@3'], 'day 4: day 3 at step 1, day 1 at step 3');
eq(s12.days[5].review.map(r => r.term), ['w11', 'w12'], 'the last day reviews the last batch at the longest step');
const seen = {};
s12.days.forEach(d => d.review.forEach(r => { seen[r.term] = (seen[r.term] || 0) + 1; }));
ok(Object.keys(seen).length === 12 && Object.values(seen).every(n => n === 2), 'every word is reviewed once per step');
const learnt = s12.days.flatMap(d => d.learn);
eq(learnt, w(12).map(x => x.term), 'every word is learned exactly once, in list order');
eq(S.schedule(w(3), {}).steps, [1, 3, 7, 14], 'default steps');
eq(S.schedule(w(3), { steps: [7, 1, 1, 0, -2, 'x', 3.9] }).steps, [1, 3, 7], 'steps are cleaned, sorted, de-duplicated');
eq(S.schedule(w(3), { steps: [] }).steps, [1, 3, 7, 14], 'no usable step falls back to the default');
eq(S.schedule(w(3), { perDay: 0 }).perDay, 5, 'perDay 0 falls back');
eq(S.schedule(w(3), { perDay: 99 }).perDay, 20, 'perDay capped at 20');
ok(S.schedule([], {}).ok === false, 'an empty list has no schedule');
const long = S.schedule(w(200), { perDay: 1, maxDays: 30 });
ok(long.days.length === 30 && long.truncated, 'a long list is cut at maxDays and says so');
/* dates: 2026-10-30 is a Friday */
eq(S.parseDate('2026-10-30'), S.parseDate('2026-10-30'), 'parseDate is stable');
eq(S.fmtDate(S.parseDate('2026-10-30')), '2026-10-30', 'date round trip');
eq(S.parseDate('2026-02-30'), null, 'an impossible date is refused');
eq(S.parseDate('30/10/2026'), null, 'a non-ISO date is refused');
const dated = S.schedule(w(10), { perDay: 5, steps: [1], start: '2026-10-30' });
ok(dated.dated, 'dated');
eq(dated.days.map(d => d.date), ['2026-10-30', '2026-11-02', '2026-11-03'], 'Friday, then Monday and Tuesday: weekends are skipped');
const sat = S.schedule(w(5), { perDay: 5, steps: [1], start: '2026-10-31' });
eq(sat.days[0].date, '2026-11-02', 'a Saturday start rolls to Monday');
eq(S.schedule(w(5), { start: 'garbage' }).dated, false, 'a bad date means numbered days only');
/* The plan does not read the clock or zone */
const t0 = JSON.stringify(S.schedule(w(9), { start: '2026-03-06', steps: [1, 3] }));
process.env.TZ = 'Pacific/Kiritimati';
eq(JSON.stringify(S.schedule(w(9), { start: '2026-03-06', steps: [1, 3] })), t0, 'same plan in any zone');
eq(S.schedule(w(9), { start: '2026-03-06', steps: [1, 3] }).days.map(d => d.date)[2], '2026-03-10', 'a spring-forward week keeps the days');

/* ---- units ---- */
eq(S.unitOf(['noun', 'unit:Unit 3']), 'Unit 3', 'unit tag read');
eq(S.unitOf(['Unit:Forces', 'unit:Other']), 'Forces', 'prefix is case-insensitive, first wins');
eq(S.unitOf(['unit:', 'unit:  ']), '', 'an empty unit tag is no unit');
eq(S.unitOf(null), '', 'null tags');
eq(S.withUnit(['noun', 'unit:A'], 'B'), ['noun', 'unit:B'], 'unit replaced, other tags stay');
eq(S.withUnit(['noun', 'unit:A', 'unit:Z'], ''), ['noun'], 'empty unit removes every unit tag');
eq(S.withUnit([], '  Unit  2; x,y '), ['unit:Unit 2 x y'], 'a unit loses ; and , (they split tags) and extra spaces');
eq(S.withUnit(undefined, 'q'), ['unit:q'], 'undefined tags');
const unitMap = { cat: 'Pets', dog: 'Pets', run: 'Moves', 'café': 'Places' };
const ws = S.wallSystem(items.slice(0, 4), t => unitMap[t.toLowerCase()] || '', ['Moves']);
eq(ws.units.map(u => u.unit), ['Pets', 'Places'], 'units in first-seen order, retired apart');
eq(ws.retired.map(u => u.unit), ['Moves'], 'a retired unit is listed on its own');
eq(ws.index.map(r => r.term + '|' + r.unit + '|' + r.card), ['café|Places|1', 'cat|Pets|1', 'Dog|Pets|2'], 'index is alphabetical, skips retired words, gives the card number');
const nou = S.wallSystem(items.slice(0, 2), () => '', []);
eq(nou.units.map(u => u.unit), ['No unit'], 'words with no unit are one unit');
ok(S.wallSystem([], () => '', []).ok === false, 'nothing to wall');
eq(S.wallSystem(items.slice(0, 2), () => 'A', ['A']).index, [], 'all retired: no index');

if (failures) { console.error(failures + ' of ' + checks + ' checks failed'); process.exit(1); }
console.log('study-logic: ' + checks + ' checks passed');
