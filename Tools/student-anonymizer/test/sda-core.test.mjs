// sda-core.test.mjs — pure-logic tests for Tools/student-anonymizer/sda-core.js (091 Student Data
// Anonymizer): codes, name parsing, column roles, who is one person, matching against a key
// (ID, name, conflicts, decisions), the anonymized copy (columns, order, kept details), the leak
// check, the key file round trip and putting names back. Then deliberate breaks of the module
// (MUTANTS): each must turn at least one check red, or the suite fails.
//
//   node Tools/student-anonymizer/test/sda-core.test.mjs   (or: npm run test:anonymizer-core)
//
// Every name and ID here is made up. The real exports these shapes come from are not in the repo
// (the repo is public); HISTORY.md, AI-73, says what was checked against them and how.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, '..', 'sda-core.js'), 'utf8');

function load(src) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.window.SdaCore;
}
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const S = v => (v === '' || v == null ? null : (typeof v === 'number' ? { t: 'n', v } : { t: 's', v: String(v) }));
const sheetRows = rows => rows.map(r => r.map(S));
const txt = c => (c == null ? '' : String(c.v));

function run(C) {
  let passed = 0, failed = 0;
  const fails = [];
  const ok = (cond, label) => { if (cond) passed++; else { failed++; fails.push(label); } };
  const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
  const throws = (fn, re, label) => { try { fn(); ok(false, label + ' (did not throw)'); } catch (e) { ok(re.test(e.message), `${label} (threw "${e.message}")`); } };

  // ---- codes
  const rng = seeded(7), taken = {};
  const codes = [];
  for (let i = 0; i < 3000; i++) codes.push(C.newCode(rng, taken));
  ok(codes.every(c => /^[A-Z2-9]{2}-[A-Z2-9]{2}$/.test(c)), 'every code is XX-XX');
  ok(codes.every(c => !/[IO01]/.test(c)), 'no code uses I, O, 0 or 1');
  eq(new Set(codes).size, 3000, 'no code repeats');
  eq(C.ALPHABET.length, 32, 'the alphabet has 32 characters');
  const used = new Set(codes.join('').replace(/-/g, ''));
  eq(used.size, 32, 'all 32 characters turn up over 3000 codes');
  ok(C.isCode(' ab-cd '.toUpperCase().trim()) && !C.isCode('AB-C0') && !C.isCode('ABCD'), 'isCode');

  // ---- names
  const p = C.parseName('Brogden, Kevin Kareem, III');
  eq([p.last, p.first, p.given], ['brogden', 'kevin', 'kevin kareem'], 'a comma before the suffix');
  const q = C.parseName('Armolt, Matthew Richard Jr   ');
  eq([q.last, q.first, q.given], ['armolt', 'matthew', 'matthew richard'], 'Jr and trailing spaces');
  const r = C.parseName('Velázquez-Maldonado, Brittany');
  eq([r.last, r.first], ['velazquez maldonado', 'brittany'], 'accents and hyphens fold');
  const s = C.parseName('Gabriella Ajayi');
  eq([s.last, s.first], ['ajayi', 'gabriella'], 'First Last with no comma');
  eq(C.nameFromParts('Ajayi', 'Gabriella', 'O'), 'Ajayi, Gabriella O', 'name from parts');
  eq(C.cleanId('940352471.0'), '940352471', 'a number read as 940352471.0');
  eq(C.cleanId(' 00123 '), '00123', 'leading zeros stay');

  // ---- roles
  const roles = h => C.guessRole(h);
  eq(['STUDENT_ID', 'Student ID', 'State ID', 'LASID', 'Student Number'].map(roles), ['id', 'id', 'id', 'id', 'id'], 'ID headings');
  eq(['STUDENT_NAME', 'Student Name', 'Name', 'Last Name', 'First Name', 'Middle Name', 'Preferred Name'].map(roles),
    ['name', 'name', 'name', 'last', 'first', 'middle', 'nick'], 'name headings');
  eq(['GRADE', 'Grade Level', 'DOB', 'Gender', 'ELL', 'IEP', 'FARMS', 'Parent Email', 'Homeroom'].map(roles),
    ['attr', 'attr', 'attr', 'attr', 'attr', 'attr', 'attr', 'attr', 'attr'], 'student-detail headings');
  eq(['Teacher', 'Homeroom Teacher', 'Course', 'SCHOOL', 'SCHED_BUILDING', 'Period'].map(roles),
    ['context', 'context', 'context', 'context', 'context', 'context'], 'context headings (a teacher is never a student detail)');
  eq(['Letter Grade', 'Final Grade', 'Test Score %', 'ABS_MP1', 'PE/PP', ''].map(roles), ['data', 'data', 'data', 'data', 'data', 'data'], 'data headings');

  const ebas = C.makeSheet('Item Scores', sheetRows([
    ['', '', '78.0%', '', ' 1-1'],
    ['Student ID', 'Student Name', 'Test Score %', 'PE/PP', '91.9%'],
    ['90001', 'Doe, Jane', '100.0%', ' 8/8', 1]
  ]));
  eq(ebas.headerRow, 1, 'the heading row under a class-average row');
  eq(ebas.cols.map(c => c.role), ['id', 'name', 'data', 'data', 'data'], 'its roles');
  const none = C.makeSheet('Notes', sheetRows([['Unit 1 notes'], ['Nothing about students']]));
  eq(none.headerRow, -1, 'a sheet with no student heading');
  C.setHeaderRow(none, 1);
  eq(none.headerRow, 1, 'setHeaderRow moves it');

  // ---- people
  const attendance = { name: 'att.xlsx', layout: {}, sheets: [C.makeSheet('Att', sheetRows([
    ['SCHOOL', 'STUDENT_ID', 'STUDENT_NAME', 'GRADE', 'ABS_YTD'],
    ['East', '90001', 'Doe, Jane Marie', '07', 3],
    ['East', '90002', 'Roe, Rick', '08', 0],
    ['East', '90003', 'Twin, Brittany', '07', 1],
    ['East', '90004', 'Twin, Britney', '07', 2],
    ['East', '90005', 'Brogden, Kevin Kareem III', '07', 0]
  ]))] };
  const bbcard = { name: 'bb.xlsx', layout: {}, sheets: [C.makeSheet('BB', sheetRows([
    ['Student Name', 'Scale Score'],
    ['Doe, Jane', 754],
    ['Twin, Britney', 760],
    ['Twin, Brittany', 761],
    ['Brogden, Kevin', 740],
    ['Newkid, Nora', 700]
  ]))] };
  const pdfLike = { name: 'tac.pdf', layout: {}, sheets: [C.makeSheet('Assignments', sheetRows([
    ['Student Name', 'Teacher', 'Assignment', 'Score'],
    ['Brogden, Kevin Kareem, III', 'Moore, Devon', 'Quiz', 5],
    ['Brogden, Kevin Kareem, III', 'Moore, Devon', 'Notes', 4],
    ['Doe, Jane Marie', 'Moore, Devon', 'Quiz', 3]
  ]))] };
  const list = C.people([attendance, bbcard, pdfLike]);
  eq(list.length, 6, 'five students with IDs and one new name');
  const who = n => list.find(x => x.names.some(m => m.written === n));
  ok(who('Doe, Jane') === who('Doe, Jane Marie'), 'Doe, Jane on the BBCard is Doe, Jane Marie');
  ok(who('Twin, Brittany') !== who('Twin, Britney'), 'Brittany and Britney stay two students');
  ok(who('Brogden, Kevin') === who('Brogden, Kevin Kareem III') && who('Brogden, Kevin Kareem, III') === who('Brogden, Kevin'), 'three spellings of Brogden are one');
  eq(who('Brogden, Kevin').rows.length, 4, 'a PDF student with two rows is one person');
  const dupSheet = { name: 'x.csv', layout: {}, sheets: [C.makeSheet('x', sheetRows([['Student Name', 'Score'], ['Lee, Sam', 1], ['Lee, Sam Q', 2]]))] };
  eq(C.people([dupSheet]).length, 2, 'two rows of one sheet never join on last and first name alone');

  // ---- assign without a key
  const sc = {};
  const a1 = C.assign(list, [], { rng: seeded(1), today: '2026-11-13', sessionCodes: sc });
  eq(a1.entries.length, 6, 'one key entry each');
  eq(a1.conflicts.length, 0, 'no conflicts without a key');
  const brog = a1.entries.find(e => e.id === '90005');
  eq(brog.written, 'Brogden, Kevin Kareem III', 'a new entry keeps the fullest spelling');
  ok(brog.spellings.includes('Brogden, Kevin') && brog.spellings.includes('Brogden, Kevin Kareem, III'), 'and the other spellings');
  eq([brog.last, brog.first, brog.added], ['Brogden', 'Kevin Kareem III', '2026-11-13'], 'its last and first name, and the date');
  const shortFirst = { name: 'ebas.xlsx', layout: {}, sheets: [C.makeSheet('I', sheetRows([['Student ID', 'Student Name'], ['90005', 'Brogden, Kevin']]))] };
  const ls = C.people([shortFirst, attendance]);
  const as = C.assign(ls, [], { rng: seeded(2) });
  eq(as.entries.find(e => e.id === '90005').written, 'Brogden, Kevin Kareem III', 'the fullest spelling wins even when the short one is seen first');
  const list2 = C.people([attendance, bbcard, pdfLike]);
  const a2 = C.assign(list2, [], { rng: seeded(99), today: '2026-11-13', sessionCodes: sc });
  eq(a2.entries.map(e => e.code), a1.entries.map(e => e.code), 'the same session keeps each new student\'s code on a re-run');

  // ---- assign against a key
  const key = [
    { code: 'AA-AA', id: '90001', ids: [], last: 'Doe', first: 'Jane Marie', written: 'Doe, Jane Marie', spellings: [], source: 'old', added: '2026-10-01' },
    { code: 'BB-BB', id: '', ids: [], last: 'Newkid', first: 'Nora', written: 'Newkid, Nora', spellings: [], source: 'old', added: '2026-10-01' },
    { code: 'CC-CC', id: '77777', ids: [], last: 'Roe', first: 'Rick', written: 'Roe, Rick', spellings: [], source: 'old', added: '2026-10-01' },
    { code: 'DD-DD', id: '', ids: [], last: 'Twin', first: 'Brittany Ann', written: 'Twin, Brittany Ann', spellings: [], source: 'old', added: '' },
    { code: 'EE-EE', id: '', ids: [], last: 'Twin', first: 'Brittany Lou', written: 'Twin, Brittany Lou', spellings: [], source: 'old', added: '' }
  ];
  const l3 = C.people([attendance, bbcard, pdfLike]);
  const a3 = C.assign(l3, key, { rng: seeded(3), today: '2026-11-14' });
  const how = n => a3.assigned.find(x => x.person.names.some(m => m.written === n));
  eq([how('Doe, Jane').how, how('Doe, Jane').code], ['id', 'AA-AA'], 'by ID');
  eq([how('Newkid, Nora').how, how('Newkid, Nora').code], ['name', 'BB-BB'], 'by name, when the key has no ID');
  eq(how('Roe, Rick').how, 'new', 'a name whose key entry holds another ID gets a new code until the teacher decides');
  eq(how('Twin, Brittany').how, 'new', 'two key entries the name could be: a new code until the teacher decides');
  eq(a3.conflicts.map(c => c.reason).sort(), ['other-id', 'several'], 'both are conflicts, with their reasons');
  eq(how('Twin, Britney').how, 'new', 'Britney is not Brittany');
  const nora = a3.entries.find(e => e.code === 'BB-BB');
  eq(nora.added, '2026-10-01', 'a loaded entry keeps its date');
  const doe = a3.entries.find(e => e.code === 'AA-AA');
  ok(doe.spellings.includes('Doe, Jane'), 'a loaded entry learns a new spelling');
  eq(a3.entries.length, 5 + 4, 'the saved key is the old one plus the new students');
  const roeIdx = a3.conflicts.find(c => c.reason === 'other-id').index;
  const a4 = C.assign(C.people([attendance, bbcard, pdfLike]), key, { rng: seeded(3), decisions: { [roeIdx]: 'CC-CC' } });
  const roe = a4.assigned.find(x => x.person.ids.includes('90002'));
  eq([roe.how, roe.code], ['chosen', 'CC-CC'], 'a decision puts the student on the chosen code');
  ok(a4.entries.find(e => e.code === 'CC-CC').ids.includes('90002'), 'and the key keeps the second ID');
  const exact = C.match({ ids: [], names: [C.parseName('Twin, Brittany Lou')] }, C.indexKey(key));
  eq([exact.kind, exact.entry && exact.entry.code], ['name', 'EE-EE'], 'the whole given name picks one of two');

  // ---- anonymize
  const out = C.anonymize(attendance, 0, l3, {});
  const head = out.sheets[0].rows[0].map(txt);
  eq(head, ['SCHOOL', 'Student Code', 'ABS_YTD'], 'ID and name become one code column; GRADE is dropped by default');
  const codesOut = out.sheets[0].rows.slice(1).map(row => txt(row[1]));
  eq(codesOut, codesOut.slice().sort(), 'student rows are sorted by code');
  eq(codesOut.length, 5, 'every student row is there');
  const kept = C.anonymize(attendance, 0, l3, { '0:3': true });
  eq(kept.sheets[0].rows[0].map(txt), ['SCHOOL', 'Student Code', 'GRADE', 'ABS_YTD'], 'a ticked detail is kept');
  const doeRow = kept.sheets[0].rows.find(row => txt(row[1]) === 'AA-AA');
  eq(doeRow.map(txt), ['East', 'AA-AA', '07', '3'], 'its row keeps its values and their types');
  eq(doeRow[3].t, 'n', 'a number stays a number');
  const eb = { name: 'e.xlsx', layout: {}, sheets: [C.makeSheet('Items', sheetRows([
    ['', '', 'Class 78%'], ['Student ID', 'Student Name', 'Score'], ['90002', 'Roe, Rick', 5], ['90001', 'Doe, Jane', 4], ['', '', 'Average 4.5']
  ]))] };
  const le = C.people([eb]);
  C.assign(le, [], { rng: seeded(5) });
  const eo = C.anonymize(eb, 0, le, {}).sheets[0].rows;
  eq([txt(eo[0][1]), txt(eo[1][0]), txt(eo[4][1])], ['Class 78%', 'Student Code', 'Average 4.5'], 'rows above the heading stay on top, a footer stays last');

  // ---- leaks
  eq(C.leaks(Object.assign(out, { name: 'att - anonymized' }), l3).length, 0, 'the anonymized copy is clean');
  const leaky = { name: 'x', layout: {}, sheets: [C.makeSheet('S', sheetRows([['Student ID', 'Comment'], ['90001', 'Jane Doe was absent'], ['90002', 'see 90003']]))] };
  const ll = C.people([leaky]);
  C.assign(ll, [], { rng: seeded(6) });
  const lout = C.anonymize(leaky, 0, ll, {});
  const found = C.leaks(lout, ll.concat(C.people([attendance])));
  eq(found.map(f => f.what), ['a student name', 'a student ID'], 'a name in a comment and an ID inside text are both caught');
  eq(C.leaks({ name: 'Doe, Jane Marie - anonymized', sheets: [] }, l3).map(f => f.where), ['the file name'], 'a name in the file name is caught');

  // ---- the key file
  const rows = C.keyRows(a3.entries);
  eq(rows[0], C.KEY_COLUMNS, 'the key\'s headings');
  const back = C.readKey([{ name: 'Key', rows: rows.map(rw => rw.map(S)) }]);
  eq(back.map(e => [e.code, e.id, e.written, e.spellings.join('|')]).sort(), a3.entries.map(e => [e.code, e.id, e.written, e.spellings.join('|')]).sort(), 'a key reads back as it was saved');
  throws(() => C.readKey([{ name: 'S', rows: sheetRows([['Name'], ['x']]) }]), /not a key/, 'a file with no Code column');
  throws(() => C.readKey([{ name: 'S', rows: sheetRows([['Code'], ['AA-AA'], ['AA-AA']]) }]), /twice/, 'a code twice');
  throws(() => C.readKey([{ name: 'S', rows: sheetRows([['Code', 'Student ID'], ['A0-AA', '1']]) }]), /not a code/, 'a code with a 0');

  // ---- reverse
  const anonDoc = { name: 'att - anonymized.xlsx', sheets: kept.sheets };
  const rev = C.reverse(anonDoc, a3.entries.concat([]));
  eq(rev.doc.sheets[0].rows[0].map(txt).slice(0, 4), ['SCHOOL', 'Student ID', 'Student Name', 'Student Code'], 'names go in front of the code');
  const revDoe = rev.doc.sheets[0].rows.find(row => txt(row[3]) === 'AA-AA');
  eq([txt(revDoe[1]), txt(revDoe[2])], ['90001', 'Doe, Jane Marie'], 'the right student comes back');
  eq(rev.restored, 5, 'every row is restored');
  const partial = C.reverse(anonDoc, a3.entries.filter(e => e.code !== 'AA-AA'));
  eq(partial.unknown, ['AA-AA'], 'a code the key lacks is listed, not dropped');
  const headless = { name: 'h.csv', sheets: [{ name: 'h', rows: sheetRows([['x', 'AA-AA'], ['y', 'BB-BB'], ['z', 'CC-CC'], ['w', 'DD-DD']]) }] };
  eq(C.findCodeColumn(headless.sheets[0].rows), { headerRow: -1, col: 1 }, 'a code column with no heading is found by its values');

  return { passed, failed, fails };
}

const real = run(load(SRC));
real.fails.forEach(f => console.log('  FAIL ' + f));
console.log(`sda-core: ${real.passed} passed, ${real.failed} failed`);

// Each break must be caught.
const MUTANTS = [
  ['alphabet keeps 0 and O', "var ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';", "var ALPHABET = 'ABCDEFGHJKLMNOPQRSTUVWXYZ0234567';"],
  ['codes may repeat', 'if (!taken[s]) { taken[s] = true; return s; }', 'taken[s] = true; return s;'],
  ['suffix kept', "var SUFFIXES = { jr: 1, sr: 1, ii: 1, iii: 1, iv: 1, v: 1 };", 'var SUFFIXES = {};'],
  ['GRADE kept as data', '/^(grade|gr|grd|grade level|grade lvl|gradelevel|grade lev)$/,', '/^$/,'],
  ['teacher read as a student detail', "var CONTEXT_RES = [/\\bteacher\\b/, ", "var CONTEXT_RES = ["],
  ['same-sheet rows join on short name', ".filter(function (q) { return !q.sheets[here]; })", ''],
  ['other-ID name match accepted', "if (person.ids.length && eIds.length) return { kind: 'conflict', candidates: [e], reason: 'other-id' };", ''],
  ['ambiguous name takes the first', "if (cands.length > 1) return { kind: 'conflict', candidates: cands, reason: 'several' };", ''],
  ['unticked details kept', "if (c.role === 'attr' && !keep[si + ':' + c.index]) return;", ''],
  ['rows not sorted', 'students.sort(function (a, b) { return a.code < b.code ? -1 : a.code > b.code ? 1 : a.order - b.order; });', ''],
  ['leak check ignores names', "for (var i = 0; i < names.length; i++) if (f.indexOf(' ' + names[i] + ' ') >= 0)", 'for (var i = 0; i < 0; i++) if (true)'],
  ['session codes ignored', 'var code = keepCode && !idx.taken[keepCode] ? keepCode : newCode(rng, idx.taken);', 'var code = newCode(rng, idx.taken);'],
  ['fullest spelling not preferred', "if (parseName(w).given.split(' ').length > parseName(best).given.split(' ').length) best = w;", ''],
  ['unknown codes dropped', "else if (isCode(code) && unknown.indexOf(code) < 0) unknown.push(code);", '']
];
let mutantFails = 0;
for (const [label, from, to] of MUTANTS) {
  if (!SRC.includes(from)) { console.log(`  MUTANT "${label}": its text is not in sda-core.js any more`); mutantFails++; continue; }
  let caught;
  try { caught = run(load(SRC.replace(from, to))).failed > 0; } catch (e) { caught = true; }
  if (!caught) { console.log(`  MUTANT "${label}" was not caught`); mutantFails++; }
}
console.log(`mutants: ${MUTANTS.length - mutantFails} of ${MUTANTS.length} caught`);
process.exit(real.failed || mutantFails ? 1 : 0);
