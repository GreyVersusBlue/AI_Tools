// roster.test.mjs — _shared/roster.js: the wire shape it must not change, the
// identity layer, and the fuzzy matcher's refusals. Plain Node, no browser.
//
//   node Tools/roster/test/roster.test.mjs
//
// roster.js is a classic browser script ending in `})(window)`, so it cannot be
// imported. It is evaluated in a `vm` context alongside the REAL _shared/store.js
// — the two are loaded together in that order on a real page and roster.js hard-
// depends on Store, so testing them apart would test a configuration that never
// ships.
//
// The assertion this file exists for is the first one: `np_rosters` and
// `crh_students_v1` must stay bare on disk. 28 tool pages read np_rosters with a
// plain JSON.parse; the day roster.js writes `{v:1,data:{...}}` there, every one
// of them shows a teacher an empty roster list and nothing says why. A browser
// suite cannot catch that as cheaply as reading the string back out here.
//
// mountRosterPicker is covered here only as an option MODEL, against a fake
// <select> — which options get built, in what order, with what counts, and
// whether the control refreshes and unsubscribes. That earned its place by
// finding a real bug on the way in (the "type names manually" sentinel was a
// NUL byte). Real DOM behaviour — that a change event fires, that the browser
// honours `disabled` — belongs to 006's Tools/class-roster-hub/test/ suites,
// which drive the actual page.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { SITE } from '../../board-check/harness.mjs';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const STORE_SRC = fs.readFileSync(path.join(SITE, '_shared', 'store.js'), 'utf8');
const ROSTER_SRC = fs.readFileSync(path.join(SITE, '_shared', 'roster.js'), 'utf8');

function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    get length() { return map.size; },
    key(i) { return [...map.keys()][i] ?? null; },
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
    __map: map,
  };
}

/* One pair per test. `noStore` skips store.js so the missing-dependency path is
   reachable — that is a real deployment mistake (a page that adds roster.js and
   forgets store.js) and it must not be silent. */
function make({ seed = {}, noStore = false } = {}) {
  const storage = fakeStorage(seed);
  const handlers = {};
  const errors = [];
  const win = {
    localStorage: storage,
    navigator: {},
    console: { error(...a) { errors.push(a.join(' ')); } },
    addEventListener(type, fn) { (handlers[type] ||= []).push(fn); },
    dispatchEvent(e) { (handlers[e.type] || []).forEach(fn => fn(e)); return true; },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    document: { body: { appendChild() {} }, createElement: () => ({ style: { cssText: '' }, setAttribute() {}, textContent: '' }) },
    Promise, JSON, Object, Array, Error, Math, Date, String, Number, Boolean, RegExp, isNaN,
  };
  win.window = win;
  const ctx = vm.createContext(win);
  if (!noStore) vm.runInContext(STORE_SRC, ctx, { filename: '_shared/store.js' });
  vm.runInContext(ROSTER_SRC, ctx, { filename: '_shared/roster.js' });
  return { Roster: win.Roster, Store: win.Store, storage, win, errors, handlers };
}

/* Enough of a <select> for the picker's model: children, value, disabled, and
   a change listener. Deliberately not jsdom — the assertions below are about
   which options roster.js builds, not about how a browser renders them. */
function fakeSelect() {
  const el = {
    __children: [],
    value: '',
    disabled: false,
    __handlers: {},
    set textContent(v) { if (v === '') el.__children.length = 0; },
    get textContent() { return el.__children.map(c => c.textContent).join(''); },
    appendChild(c) { el.__children.push(c); return c; },
    addEventListener(t, fn) { (el.__handlers[t] ||= []).push(fn); },
    removeEventListener(t, fn) { el.__handlers[t] = (el.__handlers[t] || []).filter(f => f !== fn); },
    __labels: () => el.__children.map(c => c.textContent),
    __values: () => el.__children.map(c => c.value),
    __change() { (el.__handlers.change || []).forEach(fn => fn()); },
  };
  return el;
}

const ROSTERS = 'np_rosters';
const RECORDS = 'crh_students_v1';

console.log('Roster — the shared roster service (Path 3 P1)');

/* ── 1. THE WIRE SHAPE. Both keys stay bare on disk. ───────────────────── */
{
  const { Roster, storage } = make();
  Roster.setRoster('Period 3', ['Ada Lovelace', 'Grace Hopper']);

  const disk = storage.getItem(ROSTERS);
  eq(JSON.parse(disk), { 'Period 3': ['Ada Lovelace', 'Grace Hopper'] },
    '1: np_rosters is a bare {name: string[]} on disk');
  ok(!/^\{"v":/.test(disk), '1: np_rosters carries no {v,data} envelope');

  // and the 28 raw readers' idiom still works
  const asAToolWouldRead = JSON.parse(storage.getItem(ROSTERS) || '{}');
  eq(Object.keys(asAToolWouldRead), ['Period 3'], '1: a plain JSON.parse reader still sees the roster');
  eq(asAToolWouldRead['Period 3'].length, 2, '1: ...and its names are an array');

  Roster.syncRecords('Period 3', ['Ada Lovelace', 'Grace Hopper']);
  const rec = JSON.parse(storage.getItem(RECORDS));
  ok(rec.version === 1 && rec.rosters && rec.rosters['Period 3'],
    '1: crh_students_v1 keeps its {version:1, rosters:{...}} shape');
  ok(rec.v === undefined && rec.data === undefined, '1: ...with no envelope either');
}

/* ── 2. Reading what is already on disk, written by somebody else ──────── */
{
  // The Name-Picker-era payload: bare, unversioned, never seen by store.js.
  const { Roster } = make({ seed: { [ROSTERS]: '{"Period 5":["Nellie Bly"]}' } });
  eq(Roster.listRosters(), ['Period 5'], '2: a legacy bare payload is read, not refused');
  eq(Roster.getRoster('Period 5'), ['Nellie Bly'], '2: ...and its names come back');
}

/* ── 3. A bad roster loses itself and nothing else (np-store.js's rule) ── */
{
  const { Roster } = make({
    seed: { [ROSTERS]: '{"Good":["Ada"],"Broken":42,"AlsoGood":["Grace"],"Mixed":["Ok",7,"Fine"]}' },
  });
  eq(Roster.listRosters(), ['AlsoGood', 'Good', 'Mixed'], '3: the non-array roster is dropped, the rest survive');
  eq(Roster.getRoster('Mixed'), ['Ok', 'Fine'], '3: a non-string name inside a roster is dropped, not fatal');
  eq(Roster.getRoster('Broken'), [], '3: the dropped roster reads as empty rather than throwing');
}

/* ── 4. Unparsable storage is empty, never an exception ────────────────── */
{
  const { Roster } = make({ seed: { [ROSTERS]: '{not json' } });
  eq(Roster.listRosters(), [], '4: a truncated payload reads as no rosters');
  eq(Roster.getStudents('anything'), [], '4: getStudents survives it too');
}

/* ── 5. getRoster hands back a copy, not the live array ────────────────── */
{
  const { Roster } = make();
  Roster.setRoster('P1', ['A', 'B']);
  const first = Roster.getRoster('P1');
  first.push('C');
  first.sort();
  eq(Roster.getRoster('P1'), ['A', 'B'], '5: mutating the result does not touch storage');
}

/* ── 6. setRoster is a read-modify-write of the whole object ───────────── */
{
  const { Roster, storage } = make({ seed: { [ROSTERS]: '{"Kept":["Someone"]}' } });
  Roster.setRoster('New', ['Ada']);
  eq(Object.keys(JSON.parse(storage.getItem(ROSTERS))).sort(), ['Kept', 'New'],
    '6: another writer\'s roster survives our write');
  Roster.removeRoster('Kept');
  eq(Object.keys(JSON.parse(storage.getItem(ROSTERS))), ['New'], '6: removeRoster removes only its own');
  ok(Roster.removeRoster('never-existed').ok, '6: removing a roster that is not there is not a failure');
}

/* ── 6b. renameRoster and replaceAll ───────────────────────────────────── */
{
  const { Roster, storage } = make({ seed: { [ROSTERS]: '{"Old":["Ada"],"Other":["Grace"]}' } });
  ok(Roster.renameRoster('Old', 'New').ok, '6b: a rename succeeds');
  eq(Object.keys(JSON.parse(storage.getItem(ROSTERS))).sort(), ['New', 'Other'],
    '6b: the roster is never present under both names — one write, not two');
  eq(Roster.getRoster('New'), ['Ada'], '6b: the names come with it');
  ok(!Roster.renameRoster('Nope', 'X').ok, '6b: renaming a roster that is not there fails');
  ok(!Roster.renameRoster('New', '  ').ok, '6b: renaming to a blank name fails');
  eq(Roster.listRosters(), ['New', 'Other'], '6b: ...and neither failure changed anything');

  Roster.replaceAll({ New: [], Other: [] });
  eq(Roster.listRosters(), ['New', 'Other'], '6b: replaceAll keeps the names it is given');
  eq(Roster.getRoster('New'), [], '6b: ...and empties them (the year rollover)');
  Roster.replaceAll({ Only: ['Ada'], Bad: 7 });
  eq(Roster.listRosters(), ['Only'], '6b: replaceAll drops what is not a roster and forgets the rest');
}

/* ── 7. setRoster applies the same ceilings 006 and 007 enforce ────────── */
{
  const { Roster } = make();
  Roster.setRoster('P', ['Ada', 'ada', 'ADA  ', 'Grace']);
  eq(Roster.getRoster('P'), ['Ada', 'Grace'], '7: duplicates collapse case-insensitively, first spelling wins');
  Roster.setRoster('P2', ['x'.repeat(200)]);
  eq(Roster.getRoster('P2')[0].length, Roster.MAX_NAME, '7: an over-long name is truncated, not dropped');
  ok(!Roster.setRoster('   ', ['Ada']).ok, '7: a blank roster name is refused');
}

/* ── 7b. The roster ceiling refuses rather than writing a roster that vanishes */
{
  const full = {};
  for (let i = 0; i < 60; i++) full['R' + String(i).padStart(2, '0')] = ['Ada'];
  const { Roster } = make({ seed: { [ROSTERS]: JSON.stringify(full) } });
  eq(Roster.listRosters().length, 60, '7b: sixty rosters is the cap');

  const res = Roster.setRoster('One Too Many', ['Grace']);
  ok(!res.ok, '7b: a 61st is refused...');
  ok(/60 rosters/.test(String(res.error)), '7b: ...and says why');
  eq(Roster.getRoster('One Too Many'), [], '7b: ...and really was not written');

  // Replacing must still work at the cap — 006 saves the open roster constantly.
  ok(Roster.setRoster('R00', ['Ada', 'Grace']).ok, '7b: replacing an existing roster is allowed at the cap');
  eq(Roster.getRoster('R00'), ['Ada', 'Grace'], '7b: ...and lands');
}

/* ── 8. The identity join, and that reading never mints into storage ───── */
{
  const { Roster, storage } = make({
    seed: {
      [ROSTERS]: '{"Period 3":["Ada Lovelace","Grace Hopper"]}',
      [RECORDS]: JSON.stringify({
        version: 1,
        rosters: { 'Period 3': { meta: { period: '3' }, students: [{ id: 's-ada', name: 'Ada Lovelace', preferred: 'Addie', say: 'AY-duh' }], orphans: [] } },
      }),
    },
  });
  const list = Roster.getStudents('Period 3');
  eq(list.length, 2, '8: every name on the roster comes back');
  eq(list[0], { id: 's-ada', name: 'Ada Lovelace', preferred: 'Addie', say: 'AY-duh' },
    '8: the sidecar detail is joined onto the name');
  eq(list[1].id, null, '8: a name the sidecar has never seen has NO id, rather than a minted one');
  eq(list[1].preferred, '', '8: ...and no invented detail');

  const before = storage.getItem(RECORDS);
  Roster.getStudents('Period 3');
  eq(storage.getItem(RECORDS), before, '8: getStudents is read-only — it writes no minted ids');
}

/* ── 9. An id survives the name-order rewrite that creates duplicate kids ─ */
{
  const { Roster } = make({ seed: { [ROSTERS]: '{"P":["Smith, John"]}' } });
  const id = Roster.syncRecords('P', ['Smith, John']).students[0].id;
  const after = Roster.syncRecords('P', ['John Smith']);
  eq(after.students[0].id, id, '9: "Smith, John" retyped as "John Smith" keeps its id');
  eq(after.students[0].name, 'John Smith', '9: ...and takes the new spelling');
  eq(after.orphans.length, 0, '9: ...without parking an orphan');
}

/* ── 10. A departed student's detail parks in orphans and comes back ───── */
{
  const { Roster } = make();
  Roster.syncRecords('P', ['Ada Lovelace', 'Grace Hopper']);
  let db = Roster._readRecords();
  db.rosters.P.students[0].preferred = 'Addie';
  Roster._writeRecords(db);
  const idAda = db.rosters.P.students[0].id;

  const gone = Roster.syncRecords('P', ['Grace Hopper']);
  eq(gone.students.length, 1, '10: the departed student leaves the roster');
  eq(gone.orphans.map(o => o.preferred), ['Addie'], '10: ...but her detail parks in orphans');

  const back = Roster.syncRecords('P', ['Grace Hopper', 'Ada Lovelace']);
  const ada = back.students.filter(s => s.name === 'Ada Lovelace')[0];
  eq(ada.id, idAda, '10: re-adding her restores the same id');
  eq(ada.preferred, 'Addie', '10: ...and her preferred name');
}

/* ── 11. A plain student is not parked — orphans are for detail only ───── */
{
  const { Roster } = make();
  Roster.syncRecords('P', ['Ada Lovelace', 'Grace Hopper']);
  const gone = Roster.syncRecords('P', ['Grace Hopper']);
  eq(gone.orphans, [], '11: a student with no preferred name or pronunciation parks nothing');
}

/* ── 12. reconcile is pure ──────────────────────────────────────────────── */
{
  const { Roster, storage } = make();
  const before = storage.getItem(RECORDS);
  const out = Roster.reconcile(['Ada'], [], []);
  eq(out.students[0].name, 'Ada', '12: reconcile returns a record');
  eq(storage.getItem(RECORDS), before, '12: ...and writes nothing');
}

/* ── 13. resolve: roster-scoped first, then a fallback, and by id ──────── */
{
  const { Roster } = make({ seed: { [ROSTERS]: '{"A Period 1":["Sam Jones"],"B Period 2":["Sam Reed"]}' } });
  Roster.syncRecords('A Period 1', ['Sam Jones']);
  Roster.syncRecords('B Period 2', ['Sam Reed']);

  eq(Roster.resolve('Sam Reed').roster, 'B Period 2', '13: a name resolves to the roster that has it');
  eq(Roster.resolve('sam   JONES').name, 'Sam Jones', '13: matching is case- and whitespace-insensitive');
  eq(Roster.resolve('Sam Jones', 'B Period 2').roster, 'A Period 1',
    '13: a hint that does not have the name falls back to the roster that does');

  const id = Roster.getStudents('B Period 2')[0].id;
  eq(Roster.resolve(id).name, 'Sam Reed', '13: resolve also takes a stable id');
  eq(Roster.resolve('Nobody At All'), null, '13: an unknown name is null, not a guess');
  eq(Roster.resolve(''), null, '13: an empty needle is null');
}

/* ── 14. resolve prefers the hinted roster when both have the name ─────── */
{
  const { Roster } = make({ seed: { [ROSTERS]: '{"A":["Sam Lee"],"B":["Sam Lee"]}' } });
  eq(Roster.resolve('Sam Lee', 'B').roster, 'B', '14: the hinted roster wins a genuine collision');
  eq(Roster.resolve('Sam Lee').roster, 'A', '14: with no hint, the first roster alphabetically answers');
}

/* ── 15. matchName: the hits ────────────────────────────────────────────── */
{
  const { Roster } = make();
  const students = [
    { id: '1', name: 'Aiden Smith', preferred: 'AJ', say: '' },
    { id: '2', name: 'Grace Hopper', preferred: '', say: '' },
    { id: '3', name: 'Yusuf Nguyen', preferred: '', say: '' },
  ];
  eq(Roster.matchName('Aiden Smith', students).id, '1', '15: an exact name matches');
  eq(Roster.matchName('  aiden   SMITH ', students).id, '1', '15: ...normalized');
  eq(Roster.matchName('AJ', students).id, '1', '15: a preferred name matches');
  eq(Roster.matchName('Grace', students).id, '2', '15: a first name matches when it is unique');
  eq(Roster.matchName('Smith, Aiden', students).id, '1', '15: a token-order swap matches');
  eq(Roster.matchName('Aidan Smith', students).id, '1', '15: one misspelling inside budget matches');
  eq(Roster.matchName('Yusuf Nguyan', students).id, '3', '15: ...and so does Nguyen/Nguyan');
}

/* ── 16. matchName: the refusals, which are the point ──────────────────── */
{
  const { Roster } = make();
  const twoJordans = [
    { id: '1', name: 'Jordan Reed', preferred: '', say: '' },
    { id: '2', name: 'Jordan Blake', preferred: '', say: '' },
  ];
  eq(Roster.matchName('Jordan', twoJordans), null, '16: an ambiguous first name refuses rather than guesses');

  const short = [{ id: '1', name: 'Sam', preferred: '', say: '' }];
  eq(Roster.matchName('Pam', short), null, '16: a 3-letter name buys no edits — Sam/Pam refuses');
  eq(Roster.matchName('Sam', short).id, '1', '16: ...but the right spelling still lands');

  const near = [
    { id: '1', name: 'Marco', preferred: '', say: '' },
    { id: '2', name: 'Marcy', preferred: '', say: '' },
  ];
  eq(Roster.matchName('Marca', near), null, '16: a tie at the best distance refuses');

  eq(Roster.matchName('Anyone', []), null, '16: an empty roster is null');
  eq(Roster.matchName('', twoJordans), null, '16: an empty utterance is null');
  eq(Roster.matchName('Zebediah Farnsworth', twoJordans), null, '16: nothing close is null');
}

/* ── 17. The edit-distance bound stops early and stays correct ─────────── */
{
  const { Roster } = make();
  eq(Roster._editDistance('kitten', 'sitting', 5), 3, '17: a known distance is right');
  eq(Roster._editDistance('abc', 'abc', 2), 0, '17: identical strings are 0');
  ok(Roster._editDistance('a', 'abcdefgh', 2) > 2, '17: a length gap past the budget bails out');
  ok(Roster._editDistance('abcdef', 'uvwxyz', 2) > 2, '17: an all-different string exceeds the budget');
}

/* ── 18. Delimited text — the fixtures a gradebook export actually makes ─ */
{
  const { Roster } = make();
  const csv = Roster.parseDelimited('Student ID,Last,First\n1001,"Smith, Jr.",John\n1002,Bly,Nellie');
  eq(csv.cols, 3, '18: a CSV finds its columns');
  eq(csv.rows[1], ['1001', 'Smith, Jr.', 'John'], '18: a quoted cell keeps its comma');

  const tsv = Roster.parseDelimited('Name\tPeriod\nAda Lovelace\t3');
  eq(tsv.rows[1], ['Ada Lovelace', '3'], '18: tabs win over commas when both are present');

  const ragged = Roster.parseDelimited('a,b,c\nd,e');
  eq(ragged.rows[1], ['d', 'e', ''], '18: a short row is padded to the widest');

  eq(Roster.parseDelimited(''), { rows: [], cols: 0 }, '18: empty text is empty, not a crash');
  eq(Roster.parseDelimited('  \n\n  '), { rows: [], cols: 0 }, '18: whitespace-only text too');

  const escaped = Roster.parseDelimited('a,"he said ""hi""",c');
  eq(escaped.rows[0][1], 'he said "hi"', '18: a doubled quote unescapes');
}

/* ── 19. Header detection and column guessing ──────────────────────────── */
{
  const { Roster } = make();
  ok(Roster.looksLikeHeader(['Student Name', 'Period', 'Email']), '19: a real header is recognised');
  ok(!Roster.looksLikeHeader(['Ada Lovelace', 'Grace Hopper', 'Nellie Bly']), '19: a row of names is not');

  const t = Roster.parseDelimited('ID,Last,First\n1001,Lovelace,Ada');
  eq(Roster.guessColumn(t.rows, true, ['last', 'last name']), 1, '19: the last-name column is found by header');
  eq(Roster.guessColumn(t.rows, true, ['nickname']), -1, '19: a column that is not there is -1');
  eq(Roster.guessColumn(t.rows, false, ['last']), -1, '19: with no header row, nothing is guessed');

  const noHeader = Roster.parseDelimited('1001,Ada Lovelace,3\n1002,Grace Hopper,3');
  eq(Roster.widestTextColumn(noHeader), 1, '19: with no header, the wordiest column is the names');
}

/* ── 20. flipLastFirst, including the shapes that are not a swap ───────── */
{
  const { Roster } = make();
  eq(Roster.flipLastFirst('Smith, John'), 'John Smith', '20: the ordinary case');
  eq(Roster.flipLastFirst('John Smith'), 'John Smith', '20: no comma, left alone');
  eq(Roster.flipLastFirst('Smith,'), 'Smith', '20: a trailing comma is not a swap');
  eq(Roster.flipLastFirst(', John'), 'John', '20: a leading comma is not either');
  eq(Roster.flipLastFirst('  van der Berg ,  Ada '), 'Ada van der Berg', '20: multi-word surnames survive');
  eq(Roster.flipLastFirst(''), '', '20: empty in, empty out');
}

/* ── 21. normKey / tokenKey ─────────────────────────────────────────────── */
{
  const { Roster } = make();
  eq(Roster.normKey('  Ada   LOVELACE '), 'ada lovelace', '21: normKey collapses and lowercases');
  eq(Roster.normKey(null), '', '21: normKey tolerates null');
  eq(Roster.tokenKey('Smith, John'), Roster.tokenKey('John Smith'), '21: tokenKey sees through the swap');
  ok(Roster.tokenKey('John Smith') !== Roster.tokenKey('John Smyth'), '21: ...but not through a misspelling');
}

/* ── 22. onChange fires in the writing tab, which is the whole point ───── */
{
  const { Roster } = make();
  const seen = [];
  const off = Roster.onChange(names => seen.push(names));
  Roster.setRoster('Period 3', ['Ada']);
  eq(seen, [['Period 3']], '22: a write in this tab notifies this tab');
  off();
  Roster.setRoster('Period 4', ['Grace']);
  eq(seen.length, 1, '22: unsubscribing stops it');
}

/* ── 23. The picker's option model ──────────────────────────────────────
   Not the real DOM — 006's browser suites drive that — but enough of a <select>
   to assert what the six copy-pasted variants each got differently. This block
   is here because writing it found a real bug: the "type names manually"
   sentinel was a NUL byte, which no assertion above would ever have touched. */
{
  const { Roster } = make({ seed: { [ROSTERS]: '{"Period 3":["Ada","Grace"],"Period 5":["Nellie"]}' } });
  const sel = fakeSelect();
  const picker = Roster.mountRosterPicker(sel, { includeManualOption: true, disableWhenEmpty: true });

  eq(sel.__labels(), ['Load a saved roster…', 'Period 3 (2)', 'Period 5 (1)', 'Type names manually'],
    '23: the placeholder, each roster with its count, then the manual entry');
  ok(!sel.disabled, '23: a populated control is enabled');

  sel.value = 'Period 3';
  eq(picker.getSelected(), 'Period 3', '23: getSelected reports the roster');
  eq(picker.getNames(), ['Ada', 'Grace'], '23: getNames reads it back without a second parse by the caller');

  const manual = sel.__values()[3];
  ok(manual && !/ /.test(manual), '23: the manual sentinel is not a NUL byte');
  sel.value = manual;
  eq(picker.getSelected(), null, '23: the manual entry selects no roster');
  eq(picker.getNames(), [], '23: ...and yields no names');

  picker.destroy();
}

/* ── 24. The picker refreshes itself when another tab writes ───────────── */
{
  const { Roster } = make();
  const sel = fakeSelect();
  const picker = Roster.mountRosterPicker(sel, { emptyLabel: 'No saved rosters yet', disableWhenEmpty: true });
  eq(sel.__labels(), ['No saved rosters yet'], '24: an empty control says so rather than looking broken');
  ok(sel.disabled, '24: ...and disables itself (016\'s behaviour, now everyone\'s)');

  Roster.setRoster('Period 1', ['Ada']);
  eq(sel.__labels(), ['Load a saved roster…', 'Period 1 (1)'], '24: a write refreshes the picker with no reload');
  ok(!sel.disabled, '24: ...and re-enables it');

  picker.destroy();
  Roster.setRoster('Period 2', ['Grace']);
  eq(sel.__labels().length, 2, '24: destroy() unsubscribes');
}

/* ── 25. A corrupt roster does not blank the whole control ─────────────── */
{
  // The live defect in 017, 022, 033, 043 and 084: `rosters[n].length` with no
  // Array.isArray guard, inside a try whose catch replaces every option with
  // "No saved rosters found". One bad entry hides every good one.
  const { Roster } = make({ seed: { [ROSTERS]: '{"Good":["Ada"],"Broken":42}' } });
  const sel = fakeSelect();
  Roster.mountRosterPicker(sel, {});
  eq(sel.__labels(), ['Load a saved roster…', 'Good (1)'], '25: the good roster still lists');
}

/* ── 26. Without store.js, the failure is loud ─────────────────────────── */
{
  const { Roster, errors } = make({ noStore: true, seed: { [ROSTERS]: '{"P":["Ada"]}' } });
  eq(Roster.listRosters(), [], '26: with no Store, reads are empty rather than a second storage path');
  ok(/store\.js/.test(errors.join(' ')), '26: ...and it says so in the console');
  ok(!Roster.setRoster('P', ['Ada']).ok, '26: a write reports failure rather than pretending');
  eq(errors.length, 1, '26: it complains once, not on every call');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('\nFailures:'); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
