// question-bank.test.mjs — pure-logic tests for _shared/question-bank.js
// (Path 12 P1): the schema, validation, ids, the migration from 030's old
// bank key, 030's view of the bank held to the store it replaced, and the
// file formats read back through the real ExportKit and the vendored SheetJS.
//
//   node Tools/question-bank/test/question-bank.test.mjs   (or: npm run test:question-bank)
//
// question-bank.js is a classic script that publishes window.QuestionBank and
// hard-depends on _shared/store.js, so both run here in a vm context with a
// fake localStorage, as roster.test.mjs runs roster.js. The old-against-new
// half needs the store 030 had before v265: _rgb-bank-store-v264.js is that
// file, word for word, and is loaded only here. Banks are built by that old
// store's own saveEntry(), so what the migration reads is what 030 really
// wrote. The random banks take a seeded generator. Every name and question in
// this file is made up. The browser half is 030's smoke-bank-file.mjs.
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, '..', '..', '..');
const src = f => fs.readFileSync(path.join(site, f), 'utf8');
const STORE_SRC = src('_shared/store.js');
const QB_SRC = src('_shared/question-bank.js');
const EXPORT_SRC = src('_shared/export.js');
const OLD_SRC = fs.readFileSync(path.join(here, '_rgb-bank-store-v264.js'), 'utf8');
const NEW_SRC = src('Tools/review-game-board/rgb-bank-store.js');

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
// Values made inside a vm context have that realm's prototypes; a JSON pass
// brings both sides into this one before they are compared.
const plain = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const eq = (a, b, label) => ok(isDeepStrictEqual(plain(a), plain(b)), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    writes: [],
    get length() { return map.size; },
    key: i => [...map.keys()][i] ?? null,
    getItem: k => (map.has(k) ? map.get(k) : null),
    // store.js's write probe is not a write of anything; it is left out.
    setItem(k, v) { if (k !== '__gvb_store_probe__') this.writes.push(k); map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
    dump: () => Object.fromEntries(map),
  };
}

/* A page: store.js, then whatever `scripts` names, over `storage`. Two pages
   over one storage are two tabs, or an old page and a new one. */
function page(storage, scripts, { noStore = false } = {}) {
  const handlers = {};
  const win = {
    localStorage: storage, navigator: {}, console: { error() {} },
    addEventListener(type, fn) { (handlers[type] ||= []).push(fn); },
    dispatchEvent(e) { (handlers[e.type] || []).forEach(fn => fn(e)); return true; },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    document: { body: { appendChild() {} }, createElement: () => ({ style: { cssText: '' }, setAttribute() {}, textContent: '' }) },
    Blob, setTimeout, clearTimeout,
  };
  win.window = win;
  const ctx = vm.createContext(win);
  if (!noStore) vm.runInContext(STORE_SRC, ctx, { filename: '_shared/store.js' });
  for (const s of scripts) vm.runInContext(s, ctx);
  return win;
}
const oldPage = storage => page(storage, [OLD_SRC]).ReviewBankStore;
const newPage = storage => page(storage, [QB_SRC, NEW_SRC]);

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const QB = page(fakeStorage(), [QB_SRC]).QuestionBank;
const OLD_KEY = 'gvb-review-board-bank:entries', KEY = 'gvb-question-bank';

// ---- the schema ----------------------------------------------------------------
console.log('QuestionBank — schema, validation and ids');
eq([QB.KEY, QB.LEGACY_KEY, QB.VERSION], [KEY, OLD_KEY, 1], 'the key, the old key and the version are the documented ones');
eq(QB.normalize({ id: ' a1 ', prompt: '  7 × 8?  ', answer: ' 56 ', unit: ' Unit 2 ', standard: ' 6.NS.1 ', difficulty: 'hard', tags: 'facts, Facts; times ,', points: '200', createdAt: '2026-01-05T10:00:00.000Z' }),
  { id: 'a1', prompt: '7 × 8?', answer: '56', unit: 'Unit 2', standard: '6.NS.1', difficulty: 'Hard', tags: ['facts', 'times'], points: 200, createdAt: '2026-01-05T10:00:00.000Z' },
  'normalize trims text, cases the difficulty, splits and de-duplicates tags and reads points as a number');
eq(Object.keys(QB.normalize({})), ['id', 'prompt', 'answer', 'unit', 'standard', 'difficulty', 'tags', 'points', 'createdAt'], 'a blank question has every required field, and no choices or media');
eq(QB.normalize(null), QB.normalize({}), 'something that is not a record is a blank question');
eq(QB.normalize({ question: 'Old name', answer: 'a' }).prompt, 'Old name', "030's old `question` is read as `prompt`");
ok(!('question' in QB.normalize({ question: 'Old name', answer: 'a' })), 'and is not kept beside it');
eq(QB.normalize({ prompt: 'p', answer: 'a', choices: [' a ', '', 'b', 'A'] }).choices, ['a', 'b'], 'choices lose blanks and repeats');
ok(!('choices' in QB.normalize({ prompt: 'p', answer: 'a', choices: [] })), 'an empty list of choices is left off');
const media = { kind: 'image', ref: 'idb:rgb/abc', alt: 'A map', nested: [1, { two: 2 }] };
eq(QB.normalize({ prompt: 'p', answer: 'a', media }).media, media, 'media is carried exactly as given');
eq(QB.normalize({ prompt: 'p', answer: 'a', media: 'data:image/png;base64,AAAA' }).media, 'data:image/png;base64,AAAA', 'whatever it is');
eq(QB.normalize({ prompt: 'p', answer: 'a', hint: 'think', weight: 3 }).hint, 'think', 'a field this version does not know is kept');
eq(QB.normalize({ prompt: 'p', answer: 'a', difficulty: 'Impossible' }).difficulty, '', 'an unknown difficulty is blank');
eq([QB.normalize({ points: 'lots' }).points, QB.normalize({ points: Infinity }).points, QB.normalize({ points: '1,000' }).points, QB.normalize({ points: -50 }).points], [0, 0, 1000, -50], 'points that are not a number are 0');
eq(QB.normalize({ prompt: 7, answer: true }).prompt + '/' + QB.normalize({ prompt: 7, answer: true }).answer, '7/TRUE', 'a number or a boolean handed in as text is its text');
{
  const hostile = JSON.parse('{"prompt":"p","answer":"a","__proto__":{"polluted":1},"constructor":"x"}');
  const n = QB.normalize(hostile);
  ok(n.polluted === undefined && ({}).polluted === undefined && typeof n.constructor === 'function', 'a field named __proto__ or constructor changes nothing');
}
eq([QB.validate({ prompt: 'p', answer: 'a' }), QB.validate({ prompt: ' ', answer: 'a' }), QB.validate({ prompt: 'p' }), QB.validate(null)],
  [[], ['no question'], ['no answer'], ['no question', 'no answer']], 'validate names a missing question and a missing answer');
ok(/^q-[0-9a-z]+-[0-9a-z]+$/.test(QB.makeId()), 'an id is q-<time>-<random>');
eq(QB.makeId(36 * 36, () => 0.5), 'q-100-i', 'made from the clock and the generator it is given');
{
  const ids = new Set();
  for (let i = 0; i < 5000; i++) ids.add(QB.makeId());
  eq(ids.size, 5000, '5,000 ids made in one tick are all different');
  // A generator that always answers the same still cannot make two alike.
  let list = [];
  for (let i = 0; i < 5; i++) list = QB.upsert(list, { prompt: 'p' + i, answer: 'a' }, { nowMs: 1, random: () => 0.25 }).questions;
  eq(new Set(list.map(q => q.id)).size, 5, 'and a stuck generator still gives five different ids');
}

// ---- upsert, remove, filter, distinct ------------------------------------------
console.log('QuestionBank — the list');
{
  const t = { now: '2026-02-01T00:00:00.000Z' };
  let list = [];
  let r = QB.upsert(list, { prompt: 'First', answer: '1', unit: 'U1', tags: ['a'] }, t); list = r.questions;
  const firstId = r.question.id;
  r = QB.upsert(list, { prompt: 'Second', answer: '2', unit: 'U2', difficulty: 'Easy', media, choices: ['2', '3'], hint: 'h' }, t); list = r.questions;
  const secondId = r.question.id;
  r = QB.upsert(list, { prompt: 'Third', answer: '3', unit: 'U1', standard: 'S', tags: ['b', 'a'] }, t); list = r.questions;
  eq(list.map(q => q.prompt), ['First', 'Second', 'Third'], 'new questions go on the end');
  eq(list[0].createdAt, t.now, 'and are stamped when made');
  const frozen = JSON.stringify(list);
  r = QB.upsert(list, { id: secondId, prompt: 'Second, edited', answer: '2', unit: 'U2', points: 300 }, { now: '2026-03-01T00:00:00.000Z' });
  eq(JSON.stringify(list), frozen, 'upsert does not change the list it is given');
  eq(r.questions.map(q => q.id), [firstId, secondId, list[2].id], 'an edit keeps the question where it was');
  eq([r.question.prompt, r.question.points, r.question.media, r.question.choices, r.question.hint, r.question.difficulty, r.question.createdAt, r.question.updatedAt],
    ['Second, edited', 300, media, ['2', '3'], 'h', 'Easy', t.now, '2026-03-01T00:00:00.000Z'],
    'and keeps the fields the edit did not name: media, choices, an unknown field, the day it was made');
  eq(QB.upsert(list, { id: secondId, choices: [] }, t).question.choices, undefined, 'an edit can take the choices away');
  eq(QB.upsert(list, { id: 'from-elsewhere', prompt: 'x', answer: 'y' }, t).question.id, 'from-elsewhere', 'a question arriving with an id the bank has not seen keeps it');
  eq(QB.remove(list, firstId).map(q => q.prompt), ['Second', 'Third'], 'remove takes one out');
  eq(QB.remove(list, 'nobody').length, 3, 'and nothing for an id that is not there');
  eq(QB.filter(list, { unit: 'U1' }).map(q => q.prompt), ['First', 'Third'], 'filter by unit');
  eq(QB.filter(list, { unit: 'U1', standard: 'S' }).map(q => q.prompt), ['Third'], 'filters are ANDed');
  eq(QB.filter(list, { difficulty: 'Easy' }).map(q => q.prompt), ['Second'], 'filter by difficulty');
  eq(QB.filter(list, { tag: 'a' }).map(q => q.prompt), ['First', 'Third'], 'filter by tag');
  eq(QB.filter(list, { query: ' SECOND ' }).map(q => q.prompt), ['Second'], 'the query is case-blind and trimmed');
  eq(QB.filter(list, {}).length, 3, 'no filter is everything');
  eq([QB.distinct(list, 'unit'), QB.distinct(list, 'tags'), QB.distinct(list, 'standard')], [['U1', 'U2'], ['a', 'b'], ['S']], 'distinct lists the values in use, sorted, tags one by one');
}

// ---- the migration --------------------------------------------------------------
console.log('QuestionBank — the migration from 030\'s old key');
const SAMPLE = [
  { question: 'What is the capital of Peru?', answer: 'Lima', points: 100, unit: 'Unit 1', standard: '6.G.1', difficulty: 'Easy' },
  { question: 'Who wrote "The Giver"?', answer: 'Lois Lowry', points: 200, unit: 'Unit 1', standard: 'RL.7.2', difficulty: 'Medium' },
  { question: 'Solve: 3x + 4 = 19', answer: 'x = 5', points: 300, unit: 'Unit 2', standard: '7.EE.B.4', difficulty: 'Hard' },
  { question: '¿Cómo se dice "library"?', answer: 'la biblioteca', points: 100, unit: 'Unidad 3', standard: '', difficulty: '' },
  { question: 'Line one\nline two, with a comma', answer: '=SUM(A1:A9)', points: 0, unit: '', standard: '', difficulty: 'Easy' },
  { question: '🧪 Which is a base? “NaOH” or HCl', answer: 'NaOH', points: 500, unit: 'Unit 10', standard: 'MS-PS1-2', difficulty: 'Hard' },
];
/** A storage holding a bank the OLD store wrote, one saveEntry() at a time. */
function oldBank(entries) {
  const storage = fakeStorage();
  const old = oldPage(storage);
  entries.forEach(e => old.saveEntry(e));
  storage.writes.length = 0;
  return storage;
}
{
  const storage = oldBank(SAMPLE);
  const before = storage.getItem(OLD_KEY);
  const oldView = oldPage(storage).listEntries();
  eq(oldView.length, 6, 'the old store holds the six sample entries');
  const win = newPage(storage);
  const bank = win.QuestionBank.load();
  eq(bank.questions.map(q => q.id), oldView.map(e => e.id), 'every old entry is in the shared bank, with its id, in its order');
  eq(bank.questions.map(win.QuestionBank.toLegacy), oldView, 'and reads back, field for field, as the entry it was');
  eq(storage.getItem(OLD_KEY), before, 'the old key is left byte for byte as it was');
  const stored = JSON.parse(storage.getItem(KEY));
  eq([stored.v, stored.data.schema, stored.data.questions.length, stored.data.legacy[OLD_KEY]], [1, 1, 6, oldView.map(e => e.id)],
    'the new key is a Store envelope at version 1 that records the ids it took');
  eq(storage.writes, [KEY], 'the migration is one write, to the new key');
  win.QuestionBank.load(); newPage(storage).QuestionBank.list();
  eq(storage.writes, [KEY], 'loading again, in this page or a fresh one, writes nothing');

  // An older 030 page is still open on the old key.
  const stale = oldPage(storage);
  eq(stale.listEntries(), oldView, 'an older page still reads its bank, whole');
  const added = stale.saveEntry({ question: 'Added on the old page', answer: 'late', points: 100, unit: 'Unit 9' });
  stale.deleteEntry(oldView[1].id);
  const after = win.QuestionBank.list();
  eq(after.length, 7, 'what the old page adds arrives on the next load');
  eq(after[6].id + '|' + after[6].prompt, added.id + '|Added on the old page', 'at the end, with its id');
  ok(after.some(q => q.id === oldView[1].id), 'what the old page deletes stays in the shared bank');
  win.QuestionBank.deleteQuestion(oldView[0].id);
  win.QuestionBank.deleteQuestion(added.id);
  eq(newPage(storage).QuestionBank.list().map(q => q.id), [oldView[1].id, oldView[2].id, oldView[3].id, oldView[4].id, oldView[5].id],
    'a question deleted here does not come back from the old key');
  ok(oldPage(storage).listEntries().some(e => e.id === oldView[0].id), 'and the old key still has it');

  // A 009 backup made before v265 holds only the old key.
  const backup = { [OLD_KEY]: before };
  const replaced = fakeStorage(backup);
  eq(newPage(replaced).ReviewBankStore.listEntries(), oldView, 'a backup from before v265, restored over an empty browser, comes back whole');
  storage.setItem(OLD_KEY, before);       // the same backup merged over this browser
  eq(newPage(storage).QuestionBank.list().map(q => q.id), [oldView[1].id, oldView[2].id, oldView[3].id, oldView[4].id, oldView[5].id],
    'merged over a browser that has the shared bank, it brings back nothing that was deleted since');
}
{
  // adopt() by itself, and old lists 030 never wrote.
  const bank = { schema: 1, questions: [], legacy: {} };
  ok(QB.adopt(bank, [{ id: 'bank-1', question: 'q', answer: 'a', points: 5 }]) === true, 'adopt says when it took something');
  ok(QB.adopt(bank, [{ id: 'bank-1', question: 'q', answer: 'a', points: 5 }]) === false, 'and when it did not');
  const odd = { schema: 1, questions: [], legacy: {} };
  QB.adopt(odd, [null, 'text', 7, [], { id: 'd', question: 'one', answer: 'a' }, { id: 'd', question: 'two', answer: 'b' }, { question: 'no id', answer: 'c' }, { question: 'no id either', answer: 'd' }, { id: '__proto__', question: 'proto', answer: 'e' }]);
  eq(odd.questions.map(q => q.id + ':' + q.prompt), ['d:one', 'd~2:two', 'bank-legacy:no id', 'bank-legacy~2:no id either', '__proto__:proto'],
    'entries that are not records are passed over; a repeated or missing id is kept under a made one, not dropped');
  ok(({}).prompt === undefined, 'and an id of __proto__ pollutes nothing');
  const again = JSON.stringify(odd);
  QB.adopt(odd, [{ id: 'd', question: 'one', answer: 'a' }, { id: 'd', question: 'two', answer: 'b' }, { question: 'no id', answer: 'c' }]);
  eq(JSON.stringify(odd), again, 'a second pass over the same odd list adds nothing');
}
for (const [label, raw] of [['not JSON', '{oops'], ['a string', '"hello"'], ['a number', '42'], ['null', 'null'], ['an object', '{"a":1}'], ['an empty list', '[]']]) {
  const storage = fakeStorage({ [OLD_KEY]: raw });
  let list = null, threw = '';
  try { list = newPage(storage).ReviewBankStore.listEntries(); } catch (e) { threw = String(e); }
  eq([threw, list], ['', []], `an old key holding ${label} is an empty bank, not a crash`);
  eq(storage.getItem(OLD_KEY), raw, 'and is left as it is');
}

// ---- old against new: 030's view of the bank ------------------------------------
console.log('QuestionBank — 030 reads what it read before');
const WORDS = ['fraction', 'Lima', 'volcano', 'verb', 'treaty', 'cell', 'ratio', 'β-decay', 'naïve', '"quoted"', "it's", '<b>bold</b>', '=1+1', '-5', '+7', '@home', '007', '1/2', '  spaced  ', 'línea\nnueva', '🧪', 'ＦＵＬＬ', 'x'.repeat(300)];
const UNITS = ['', 'Unit 1', 'Unit 2', 'unit 2', 'Unit 10', 'Ünit', ' Unit 1 '];
const STANDARDS = ['', '6.G.1', '7.EE.B.4', 'RL.7.2', 'MS-PS1-2'];
const DIFFS = ['', 'Easy', 'Medium', 'Hard', 'easy', 'Impossible', null, undefined];
const POINTS = [0, 100, 200, 300, 400, 500, -100, 12.5, '250', '', null, undefined, 'lots', NaN];
function randomEntries(rand, n) {
  const pick = a => a[Math.floor(rand() * a.length)];
  const out = [];
  for (let i = 0; i < n; i++) {
    const e = { question: pick(WORDS) + ' ' + pick(WORDS) + ' #' + i, answer: pick(WORDS), points: pick(POINTS), unit: pick(UNITS), standard: pick(STANDARDS), difficulty: pick(DIFFS) };
    if (rand() < 0.1) delete e.unit;
    if (rand() < 0.05) e.answer = '';
    if (rand() < 0.05) e.question = 42;
    out.push(e);
  }
  return out;
}
const FILTERS = [{}, { unit: 'Unit 1' }, { unit: 'Unit 2', difficulty: 'Hard' }, { standard: '6.G.1' }, { difficulty: 'Easy' }, { query: 'LIMA' }, { query: '  verb ' }, { unit: 'Unit 10', standard: 'MS-PS1-2', difficulty: 'Medium', query: 'cell' }, { unit: 'nowhere' }, { query: '=1+1' }];
{
  const rand = rng(20261006);
  let banks = 0, entries = 0, mismatches = 0;
  for (let b = 0; b < 300; b++) {
    const n = b < 3 ? [0, 1, 2][b] : 1 + Math.floor(rand() * 60);
    const storage = oldBank(randomEntries(rand, n));
    // The old store deletes a few before the new page ever loads.
    const oldA = oldPage(storage);
    oldA.listEntries().forEach(e => { if (rand() < 0.1) oldA.deleteEntry(e.id); });
    const old = oldPage(storage), neu = newPage(storage).ReviewBankStore;
    const same = (a, c) => { if (!isDeepStrictEqual(plain(a), plain(c))) mismatches++; };
    same(neu.listEntries(), old.listEntries());
    same(neu.distinctValues('unit'), old.distinctValues('unit'));
    same(neu.distinctValues('standard'), old.distinctValues('standard'));
    FILTERS.forEach(f => same(neu.filterEntries(f), old.filterEntries(f)));
    same(neu.DIFFICULTIES, old.DIFFICULTIES);
    banks++; entries += old.listEntries().length;
  }
  eq(mismatches, 0, `over ${banks} random banks (${entries} entries) the list, both dropdowns and ten filters are what the old store gave`);
  console.log(`  (measured: ${banks} random banks, ${entries} entries)`);
}
{
  // The same clicks on an old page and a new one, each over its own copy of
  // one bank: add, delete, add again. Ids and stamps of entries made after
  // the split differ by construction, so they are compared without them.
  const rand = rng(77);
  let diff = 0;
  for (let b = 0; b < 60; b++) {
    const seedEntries = randomEntries(rand, 12);
    const sOld = oldBank(seedEntries);
    const sNew = fakeStorage({ [OLD_KEY]: sOld.getItem(OLD_KEY) });
    const old = oldPage(sOld), neu = newPage(sNew).ReviewBankStore;
    const lateIds = new Set();
    for (let step = 0; step < 15; step++) {
      if (rand() < 0.6) {
        const e = randomEntries(rand, 1)[0];
        const a = old.saveEntry(e), c = neu.saveEntry(e);
        lateIds.add(a.id); lateIds.add(c.id);
        if (!isDeepStrictEqual(plain({ ...a, id: '', createdAt: '' }), plain({ ...c, id: '', createdAt: '' }))) diff++;
      } else {
        const at = Math.floor(rand() * old.listEntries().length);
        const a = old.listEntries()[at], c = neu.listEntries()[at];
        if (a) { old.deleteEntry(a.id); neu.deleteEntry(c.id); }
      }
      const strip = list => list.map(e => (lateIds.has(e.id) ? { ...e, id: '', createdAt: '' } : e));
      if (!isDeepStrictEqual(plain(strip(old.listEntries())), plain(strip(neu.listEntries())))) diff++;
    }
  }
  eq(diff, 0, 'and 900 adds and deletes on an old page and a new one leave the same bank, in the same order');
}
{
  // What 030's Add button hands over, and what it gets back.
  const storage = fakeStorage();
  const win = newPage(storage);
  const e = win.ReviewBankStore.saveEntry({ question: '  Capital of France?  ', answer: ' Paris ', points: 100, unit: 'Unit 1', standard: '6.G.1', difficulty: 'Easy' });
  eq(Object.keys(e), ['id', 'question', 'answer', 'points', 'unit', 'standard', 'difficulty', 'createdAt'], "saveEntry answers in the page's eight fields");
  eq([e.question, e.answer, /^q-/.test(e.id), !isNaN(Date.parse(e.createdAt))], ['Capital of France?', 'Paris', true, true], 'trimmed, with a new id and a stamp');
  ok(storage.getItem(OLD_KEY) === null, 'a new bank never writes the old key');
  // A question another tool gave choices, tags and media; 030 edits its text.
  win.QuestionBank.saveQuestion({ id: e.id, choices: ['Paris', 'Lyon'], tags: ['capitals'], media, hint: 'north' });
  win.ReviewBankStore.saveEntry({ id: e.id, question: 'Capital of France (edited)?', answer: 'Paris', points: 200, unit: 'Unit 1', standard: '6.G.1', difficulty: 'Easy', createdAt: e.createdAt });
  const q = win.QuestionBank.list()[0];
  eq([q.prompt, q.points, q.choices, q.tags, q.media, q.hint, q.createdAt], ['Capital of France (edited)?', 200, ['Paris', 'Lyon'], ['capitals'], media, 'north', e.createdAt],
    "a save from 030 keeps the fields 030 does not show");
  win.ReviewBankStore.deleteEntry(e.id);
  eq(win.ReviewBankStore.listEntries(), [], 'and its delete deletes');
}

// ---- what is stored: odd and newer payloads -------------------------------------
console.log('QuestionBank — the stored bank');
for (const [label, raw] of [['not JSON', '{oops'], ['a bare list', '[{"id":"a","prompt":"p","answer":"a"}]'], ['an envelope of a string', '{"v":1,"data":"x"}'], ['an envelope with no list', '{"v":1,"data":{"schema":1,"questions":"many"}}']]) {
  const storage = fakeStorage({ [KEY]: raw });
  let list = null, threw = '';
  try { list = newPage(storage).QuestionBank.list(); } catch (e) { threw = String(e); }
  eq([threw, list], ['', []], `a new key holding ${label} reads as an empty bank, not a crash`);
  eq(storage.getItem(KEY), raw, 'and a read alone does not overwrite it');
}
{
  const stored = { v: 1, data: { schema: 1, questions: [{ id: 'a', prompt: 'p', answer: 'x' }, null, 'junk', { id: 'a', prompt: 'twin', answer: 'y' }, { prompt: 'no id', answer: 'z' }], legacy: { [OLD_KEY]: ['gone'] } } };
  const storage = fakeStorage({ [KEY]: JSON.stringify(stored), [OLD_KEY]: JSON.stringify([{ id: 'gone', question: 'deleted long ago', answer: 'x' }]) });
  eq(newPage(storage).QuestionBank.list().map(q => q.id + ':' + q.prompt), ['a:p', 'q-noid-4:no id'], 'stored junk is passed over, and an id in `legacy` is not taken again');
}
{
  const future = JSON.stringify({ v: 2, data: { schema: 2, questions: [{ id: 'f1', prompt: 'From a newer page', answer: 'a', rubric: { rows: 3 } }], legacy: {}, somethingNew: true } });
  const storage = fakeStorage({ [KEY]: future, [OLD_KEY]: JSON.stringify([{ id: 'bank-old', question: 'old', answer: 'a' }]) });
  const win = newPage(storage);
  eq(win.QuestionBank.list().map(q => q.prompt), ['From a newer page'], "a newer page's bank is read");
  const res = win.QuestionBank.saveQuestion({ prompt: 'p', answer: 'a' });
  eq([res.ok, res.newer], [false, true], 'and a save into it is refused, saying why');
  eq([win.QuestionBank.deleteQuestion('f1').ok, win.QuestionBank.importQuestions([{ prompt: 'x', answer: 'y' }]).ok], [false, false], 'as are a delete and an import');
  eq(storage.getItem(KEY), future, 'so the newer bank is byte for byte what it was');
}
{
  let threw = '';
  try { page(fakeStorage(), [QB_SRC], { noStore: true }).QuestionBank.list(); } catch (e) { threw = e.message; }
  ok(/store\.js must be loaded first/.test(threw), 'with no store.js on the page, storage says so');
  const storage = fakeStorage();
  const win = newPage(storage);
  const heard = [];
  const off = win.QuestionBank.onChange(list => heard.push(list.length));
  win.QuestionBank.saveQuestion({ prompt: 'p', answer: 'a' });
  win.QuestionBank.saveQuestion({ prompt: 'p2', answer: 'a' });
  off();
  win.QuestionBank.saveQuestion({ prompt: 'p3', answer: 'a' });
  eq(heard, [1, 2], 'onChange hears each write in its own tab, until it is unsubscribed');
}

// ---- merge and the files --------------------------------------------------------
console.log('QuestionBank — import and export');
const T = { now: '2026-04-01T00:00:00.000Z' };
function bankOf(entries) {
  let list = [];
  entries.forEach((e, i) => { list = QB.upsert(list, { ...e, id: e.id || 'id-' + i, createdAt: '2026-01-0' + (1 + i % 9) + 'T00:00:00.000Z' }, T).questions; });
  return list;
}
const TRICKY = bankOf([
  { prompt: 'Plain question?', answer: 'Plain answer', points: 100, unit: 'Unit 1', standard: '6.G.1', difficulty: 'Easy', tags: ['review', 'map skills'] },
  { prompt: 'A comma, a "quote" and\na line break', answer: 'semi;colon\ttab', points: 200, unit: 'Unit, with comma', difficulty: 'Medium' },
  { prompt: '=HYPERLINK("http://example.invalid","click")', answer: '=1+1', points: 300, tags: ['+plus', '-minus', '@at'] },
  { prompt: '+1 for effort?', answer: '-5', points: 0 },
  { prompt: '@mention', answer: '007', points: 50, standard: '1.2' },
  { prompt: 'Half?', answer: '1/2', choices: ['1/2', '2/4 | or so', '0.5'], points: 100 },
  { prompt: 'Which year?', answer: '1776', choices: ['1492', '1776', '1812'], difficulty: 'Hard', points: 400 },
  { prompt: "'=apostrophe first", answer: "'quoted'", points: 100 },
  { prompt: '¿Dónde está 東京? 🗼', answer: 'Japón', unit: 'Unidad 3', points: 100, media, hint: 'Asia' },
  { prompt: '   Spaces kept   inside', answer: 'TRUE', points: 12.5 },
]);
{
  // JSON: everything, exactly.
  const file = QB.toJSON(TRICKY, { title: 'Grade 7 review', exported: '2026-04-02T00:00:00.000Z' });
  const head = JSON.parse(file);
  eq([head.format, head.version, head.title, head.questions.length], ['aplp-question-bank', 1, 'Grade 7 review', 10], 'the JSON file names its format and version');
  const back = QB.parse(file);
  eq([back.error, back.questions.length], ['', 10], 'and parses back');
  const fresh = QB.merge([], back.questions, T);
  eq([fresh.added, fresh.updated, fresh.skipped, fresh.invalid], [10, 0, 0, []], 'into an empty bank it adds all ten');
  eq(fresh.questions, TRICKY, 'and the bank is the one exported, field for field: ids, media, choices, tags, the unknown field, the order');
  const twice = QB.merge(fresh.questions, back.questions, T);
  eq([twice.added, twice.updated, twice.same, twice.skipped], [0, 0, 10, 0], 'importing the same file again changes nothing');
  eq(twice.questions, TRICKY, 'not one field');
  eq(QB.parse('\uFEFF' + file).questions.length, 10, 'a byte order mark in front of the JSON is ignored');
  eq(QB.parse(JSON.stringify({ format: 'aplp-question-bank', version: 2, questions: [{ prompt: 'p', answer: 'a' }] })).error.slice(0, 44), 'That bank was saved by a newer version of th', 'a file from a newer version is refused in words');
  eq([QB.parse('{broken').error, QB.parse('{"a":1}').error], ['That file is not readable JSON.', 'That file has no list of questions in it.'], 'as are broken JSON and JSON with no questions');
  // 030's old key, pasted into a file, is a bank too.
  const oldFile = oldBank(SAMPLE).getItem(OLD_KEY);
  const fromOld = QB.merge([], QB.parse(oldFile).questions, T);
  eq([fromOld.added, fromOld.questions.map(q => q.prompt)], [6, SAMPLE.map(e => e.question)], "a file of 030's old entries imports as questions");
}
{
  // Merge rules.
  const base = bankOf([{ id: 'k1', prompt: 'Capital of Peru?', answer: 'Lima', unit: 'Unit 1', points: 100, media, tags: ['geo'], choices: ['Lima', 'Quito'] }, { id: 'k2', prompt: 'Two?', answer: '2', points: 100 }]);
  const frozen = JSON.stringify(base);
  const res = QB.merge(base, [
    { id: 'k1', prompt: 'Capital of Peru?', answer: 'Lima', unit: 'Unit 5' },                // same id: an update that names four fields
    { prompt: '  capital of  PERU? ', answer: 'lima' },                                       // no id, same words: skipped
    { prompt: 'Brand new?', answer: 'Yes' },                                                  // no id, new words: added
    { prompt: 'Brand new?', answer: 'Yes' },                                                  // twice in one file: once
    { id: 'k9', prompt: 'With a foreign id', answer: 'ok' },                                  // unseen id: added, id kept
    { prompt: '', answer: 'orphan' }, { prompt: 'No answer' }, null,                          // refused
  ], T);
  eq(JSON.stringify(base), frozen, 'merge does not change the list it is given');
  eq([res.added, res.updated, res.same, res.skipped, res.invalid], [2, 1, 0, 2, [{ row: 6, errors: ['no question'] }, { row: 7, errors: ['no answer'] }, { row: 8, errors: ['no question', 'no answer'] }]],
    'same id updates, same words are skipped, the rest are added, and a row with no question or answer is refused by its number');
  eq(res.questions.map(q => q.id.replace(/^q-.*/, 'q-new')), ['k1', 'k2', 'q-new', 'k9'], 'updates stay in place, additions follow in file order, a foreign id is kept');
  const k1 = res.questions[0];
  eq([k1.unit, k1.points, k1.media, k1.tags, k1.choices, k1.createdAt, k1.updatedAt], ['Unit 5', 100, media, ['geo'], ['Lima', 'Quito'], base[0].createdAt, T.now],
    'an update changes what the file names and keeps what it does not: points, media, tags, choices, the day it was made');
  eq(QB.merge(base, [{ id: 'k1', prompt: 'Capital of Peru?', answer: 'Lima', choices: [], tags: [] }], T).questions[0].choices, undefined, 'a file that names empty choices takes them away');
  eq(QB.merge(base, 'not a list', T).questions.length, 2, 'something that is not a list merges nothing');
}
{
  // Rows: through the real ExportKit.toCsv and back.
  const g = page(fakeStorage(), [EXPORT_SRC, QB_SRC]);
  const rows = g.QuestionBank.toRows(TRICKY);
  eq(rows[0], ['Question', 'Answer', 'Points', 'Unit', 'Standard', 'Difficulty', 'Tags', 'Choices', 'ID (leave as it is)'], 'the sheet has nine named columns');
  eq([rows.length, typeof rows[1][2], rows.slice(1).every(r => r.every((c, i) => i === 2 || typeof c === 'string'))], [11, 'number', true], 'one row a question; points is a number and every other cell is text');
  const csv = g.ExportKit.toCsv(rows);
  ok(csv.includes("'=HYPERLINK") && csv.includes("'=1+1") && csv.includes("'+1 for effort?") && csv.includes("'-5") && csv.includes("'@mention"), 'in the CSV, ExportKit guards every cell a spreadsheet would run as a formula');
  ok(!/(^|,|\n)[=+\-@]/.test(csv.replace(/^\uFEFF/, '').replace(/"(?:[^"]|"")*"/g, m => (/^"[=+\-@]/.test(m) ? m.slice(1) : 'x'))), 'and no cell at all starts with = + - or @');
  const parsed = g.QuestionBank.parse(csv);
  eq([parsed.error, parsed.questions.length, parsed.rows], ['', 10, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]], 'the CSV parses back to ten questions, each with its sheet row');
  const merged = g.QuestionBank.merge([], parsed.questions, T);
  const carried = q => ({ id: q.id, prompt: q.prompt, answer: q.answer, points: q.points, unit: q.unit, standard: q.standard, difficulty: q.difficulty, tags: q.tags, choices: q.choices });
  eq(merged.questions.map(carried), TRICKY.map(carried), 'and every column comes back as it went: the guard off again, 007 and 1/2 and 1776 still text, commas, quotes, line breaks, the bar in a choice');
  eq(merged.questions.map(q => typeof q.answer), TRICKY.map(() => 'string'), 'every answer is text');
  const over = g.QuestionBank.merge(TRICKY, parsed.questions, T);
  eq([over.added, over.updated, over.same, over.questions[8].media, over.questions[8].hint], [0, 0, 10, media, 'Asia'], 'imported over the bank it came from, the sheet changes nothing and the media it cannot carry stays');
  // Semicolons, tabs, a header in another order and case, extra columns, blank lines, a title line.
  const hand = 'Grade 7 review;;\r\nANSWER;notes;Question ;Level;points\r\nLima;x;Capital of Peru?;hard;1,000\r\n;;;;\r\n"semi;colon";;"Says ""hi""";;\r\n;;No answer here;;\r\n';
  const h = g.QuestionBank.parse(hand);
  eq([h.error, h.questions, h.rows], ['', [{ answer: 'Lima', prompt: 'Capital of Peru?', difficulty: 'hard', points: '1,000' }, { answer: 'semi;colon', prompt: 'Says "hi"', difficulty: '', points: '' }, { answer: '', prompt: 'No answer here', difficulty: '', points: '' }], [3, 5, 6]],
    'a hand-made sheet: semicolons, a title line, columns in another order and case, an unknown column, a blank row');
  const hm = g.QuestionBank.merge([], h.questions, T);
  eq([hm.added, hm.invalid, hm.questions[0].difficulty, hm.questions[0].points], [2, [{ row: 3, errors: ['no answer'] }], 'Hard', 1000], 'merges with the bad row named and the difficulty and points read');
  eq(g.QuestionBank.parse('Term\tDefinition\nphotosynthesis\thow a plant makes food\n').questions, [{ prompt: 'photosynthesis', answer: 'how a plant makes food' }], 'tabs, and "term" and "definition" as the two headers');
  eq(g.QuestionBank.parse('name,age\nA,12\n').error, 'No header row with a "Question" and an "Answer" column was found.', 'a sheet with no question and answer header is refused in words');
  eq(g.QuestionBank.parse('').error, 'No header row with a "Question" and an "Answer" column was found.', 'as is an empty file');
  eq(g.QuestionBank.fromRows([['Question', 'Answer', 'Points'], [42, true, 7], [new Date(Date.UTC(2026, 0, 5)), 1.5, null]]).questions,
    [{ prompt: '42', answer: 'TRUE', points: '7' }, { prompt: '2026-01-05', answer: '1.5', points: '' }], 'cells that arrive as numbers, booleans or dates are read as their text');
  eq(g.QuestionBank.parseCsv('\uFEFFQuestion,Answer\r\n')[0], ['Question', 'Answer'], 'parseCsv drops a byte order mark by itself');
  eq(g.QuestionBank.parseCsv('a,b\r\n"1\n2",""""\r\n\r\nlast'), [['a', 'b'], ['1\n2', '"'], [''], ['last']], 'parseCsv reads quoted line breaks, doubled quotes, an empty line and a last line with no break');
}
{
  // XLSX: through ExportKit.toXlsx on the vendored SheetJS, and read back as a page reads it.
  const g = page(fakeStorage(), [src('_shared/vendor/xlsx/xlsx.full.min.js'), EXPORT_SRC, QB_SRC]);
  const blob = g.ExportKit.toXlsx({ name: 'Questions', rows: g.QuestionBank.toRows(TRICKY) });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const wb = g.XLSX.read(vm.runInContext('(b) => new Uint8Array(b)', g)(bytes), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const cells = Object.keys(ws).filter(k => k[0] !== '!');
  eq(cells.filter(k => ws[k].f).length, 0, 'the workbook has no formula cell');
  eq([ws.A4.t, ws.A4.v, ws.B4.v, ws.B6.t, ws.B6.v, ws.B7.t, ws.B7.v, ws.B8.t, ws.C2.t], ['s', '=HYPERLINK("http://example.invalid","click")', '=1+1', 's', '007', 's', '1/2', 's', 'n'],
    'a formula, 007, 1/2 and 1776 are string cells as typed; points is a number cell');
  const rows = g.XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  const merged = g.QuestionBank.merge([], g.QuestionBank.fromRows(rows).questions, T);
  const carried = q => ({ id: q.id, prompt: q.prompt, answer: q.answer, points: q.points, unit: q.unit, standard: q.standard, difficulty: q.difficulty, tags: q.tags, choices: q.choices });
  eq(merged.questions.map(carried), TRICKY.map(carried), 'read back the way 030 reads a workbook, every column is what was exported');
  // A sheet a colleague typed numbers into: 7 and 1776 as number cells.
  const typed = g.XLSX.utils.aoa_to_sheet([['Question', 'Answer', 'Points'], ['Lucky number?', 7, 100], ['Year?', 1776, 200], ['Half?', 0.5, 300]]);
  const tq = g.QuestionBank.fromRows(g.XLSX.utils.sheet_to_json(typed, { header: 1, raw: false, defval: '' })).questions;
  eq(tq.map(q => q.answer), ['7', '1776', '0.5'], 'a number typed into an answer cell arrives as its text');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
