// question-bank-sets.test.mjs — pure-logic tests for the NAMED SETS of
// _shared/question-bank.js (Path 12 P2, v300; Devon, 2026-10-07: "B", an
// ordered list saved with the bank): the stored shape and its schema, ids,
// repeats and order, what a deleted or edited question does to a set, the
// bank file, an import that adds and never overwrites, an older page (the
// v299 module, read from git) against a bank with sets, and the chooser.
//
//   node Tools/question-bank/test/question-bank-sets.test.mjs   (or: npm run test:question-bank-sets)
//
// Then it BREAKS the module on purpose, one change at a time (BREAKS below),
// runs every assertion again over each broken copy, and fails if any break
// is not caught. Every name and question in this file is made up. Exits 1 on
// any failure.

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
const CTCG_SRC = src('Tools/cultural-trivia-card-generator/ctcg-bank.js');
const KEY = 'gvb-question-bank';

/* The module as v299 shipped it, the last one without sets, word for word
   (git show 5abf29e:_shared/question-bank.js): an older page left open in a
   tab, or a service worker not yet updated. Loaded only here. */
const OLD_SRC = fs.readFileSync(path.join(here, '_question-bank-v299.js'), 'utf8');

const plain = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    writes: [],
    get length() { return map.size; },
    key: i => [...map.keys()][i] ?? null,
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem(k, v) { if (k !== '__gvb_store_probe__') this.writes.push(k); map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
  };
}

function page(storage, scripts) {
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
  vm.runInContext(STORE_SRC, ctx, { filename: '_shared/store.js' });
  for (const s of scripts) vm.runInContext(s, ctx);
  return win;
}

const T = { now: '2026-10-21T12:00:00.000Z' };
const stored = storage => JSON.parse(storage.getItem(KEY));

/** Every assertion, over the module source `qb`. Returns the failures. */
function run(qb, { quiet = false } = {}) {
  const fails = [];
  let passed = 0;
  const ok = (cond, label) => { if (cond) passed++; else { fails.push(label); if (!quiet) console.log('  FAIL ' + label); } };
  const eq = (a, b, label) => ok(isDeepStrictEqual(plain(a), plain(b)), `${label} (got ${JSON.stringify(plain(a))}, want ${JSON.stringify(b)})`);
  const guard = (label, fn) => { try { fn(); } catch (e) { ok(false, `${label}: threw ${e && e.message}`); } };
  const fresh = (storage = fakeStorage(), extra = []) => page(storage, [qb, ...extra]).QuestionBank;

  if (!quiet) console.log('Named sets: the pure half');
  guard('pure', () => {
    const Q = fresh();
    ok(/^set-[0-9a-z]+-[0-9a-z]+$/.test(Q.makeSetId()), 'a set id is set-<time>-<random>');
    eq(Q.normalizeSet({ name: '  Unit 3\nreview ', items: ['a', 'b', 'a', '', 7, null, ' c '] }),
      { id: '', name: 'Unit 3 review', items: ['a', 'b', 'a', 'c'], createdAt: '' },
      'a set: the name on one line, trimmed; items in order with a repeat kept; a blank or non-text item dropped');
    eq([Q.normalizeSet(null), Q.normalizeSet({ name: '  ', items: ['a'] }), Q.normalizeSet([1])], [null, null, null], 'no name, or not a record, is no set');
    eq(Q.normalizeSet({ name: 'x'.repeat(500), items: Array.from({ length: 1500 }, (_, i) => 'q' + i) }).name.length, 120, 'a name is cut at SET_LIMIT.name');
    eq(Q.normalizeSet({ name: 'big', items: Array.from({ length: 1500 }, (_, i) => 'q' + i) }).items.length, 1000, 'and a set at SET_LIMIT.items');
    eq(Q.normalizeSet({ name: 'p', items: ['__proto__', 'constructor', 'ok'] }).items, ['ok'], 'an item that names a prototype field is dropped');
    const twins = Q.normalizeSets([{ id: 's1', name: 'A', items: [] }, { id: 's1', name: 'B', items: [] }, { name: 'C' }, 'junk']);
    eq([twins.length, twins[0].id, twins[1].id !== 's1' && /^set-/.test(twins[1].id), /^set-/.test(twins[2].id)], [3, 's1', true, true], 'two sets never share an id: a repeat or a missing one is given its own');

    const a = Q.upsertSet([], { name: 'Review', items: ['q1', 'q2'] }, T);
    eq([a.sets.length, /^set-/.test(a.set.id), a.set.createdAt, a.set.updatedAt], [1, true, T.now, undefined], 'a new set is added with an id and a date');
    const b = Q.upsertSet(a.sets, { id: a.set.id, name: 'Review, renamed', items: ['q2', 'q1', 'q2'] }, { now: 'LATER' });
    eq([b.sets.length, b.set.id, b.set.name, b.set.items, b.set.createdAt, b.set.updatedAt], [1, a.set.id, 'Review, renamed', ['q2', 'q1', 'q2'], T.now, 'LATER'],
      'saving by id renames and reorders it in place, first date kept');
    eq(a.sets[0].name, 'Review', 'and the list handed in is not changed');
    eq(Q.upsertSet(a.sets, { name: ' ' }).set, null, 'a set with no name is refused');
    eq(/^set-/.test(Q.upsertSet([], { id: 'named:x', name: 'n' }).set.id), true, "a chooser's 'named:' id is never stored as a set id");

    const r = Q.removeFromSets([{ id: 's', name: 'S', items: ['q1', 'q2', 'q1'], createdAt: 'x' }, { id: 't', name: 'T', items: ['q3'], createdAt: 'x' }], 'q1', { now: 'NOW' });
    eq(r.map(s => [s.id, s.items, s.updatedAt]), [['s', ['q2'], 'NOW'], ['t', ['q3'], undefined]], 'a question taken out of sets: every time it is there, and only the sets it was in are stamped');

    const bank = [{ id: 'q1', prompt: 'One?', answer: '1' }, { id: 'q2', prompt: 'Two?', answer: '2' }];
    const res = Q.resolveSet({ items: ['q2', 'q1', 'gone', 'q2'] }, bank);
    eq([res.questions.map(q => q.id), res.missing], [['q2', 'q1', 'q2'], 1], 'a set reads back in its order, a repeat repeated, and an item found nowhere counted missing');
    res.questions[0].prompt = 'changed';
    eq(bank[1].prompt, 'Two?', 'what it hands out is a copy');
  });

  if (!quiet) console.log('Named sets: stored with the bank');
  guard('storage', () => {
    const storage = fakeStorage();
    const Q = fresh(storage);
    const q1 = Q.saveQuestion({ prompt: 'Capital of Peru?', answer: 'Lima' }, T).question;
    const q2 = Q.saveQuestion({ prompt: '3 x 4?', answer: '12' }, T).question;
    eq(Object.keys(stored(storage).data), ['schema', 'questions', 'legacy'], 'a bank with no set is stored exactly as before: no `sets`');
    eq(stored(storage).data.schema, 1, 'at schema 1');
    const made = Q.saveSet({ name: 'Unit 3 review', items: [q2.id, q1.id, q2.id] }, T);
    eq([made.ok, stored(storage).data.schema, stored(storage).data.sets.map(s => s.items)], [true, 2, [[q2.id, q1.id, q2.id]]], 'a set is stored with the bank, in order with its repeat, and the schema is 2');
    eq(stored(storage).v, 1, "Store's envelope stays at version 1");
    eq(Q.namedSets().map(s => s.name), ['Unit 3 review'], 'namedSets() lists it');
    eq(Q.namedSetQuestions(made.set.id).questions.map(q => q.answer), ['12', 'Lima', '12'], 'and reads its questions');
    eq(Q.saveSet({ name: '' }).ok, false, 'saveSet() refuses a set with no name');
    eq(Q.saveQuestion({ id: q1.id, answer: 'Lima, Peru' }, T).ok, true, 'a question in a set is edited');
    eq(Q.namedSetQuestions(made.set.id).questions.map(q => q.answer), ['12', 'Lima, Peru', '12'], 'and the set shows the edit: it holds ids, not words');
    Q.deleteQuestion(q2.id);
    eq(Q.findNamedSet(made.set.id).items, [q1.id], 'deleting a question takes it out of every set, every time it was there');
    eq(Q.list().length, 1, 'and the bank');
    const other = Q.saveSet({ name: 'Second', items: [q1.id] }, T).set;
    eq(Q.deleteSet(made.set.id).ok, true, 'a set is deleted');
    eq([Q.namedSets().map(s => s.id), Q.list().length], [[other.id], 1], 'and only that set: its questions stay in the bank');
    Q.deleteSet(other.id);
    eq([Object.keys(stored(storage).data), stored(storage).data.schema], [['schema', 'questions', 'legacy'], 1], 'with the last set gone, the bank is back to the old shape at schema 1');
    eq(Q.namedSetQuestions('nope'), { questions: [], missing: 0 }, 'no such set reads as empty');
  });

  guard('peek', () => {
    const storage = fakeStorage({ [KEY]: JSON.stringify({ v: 1, data: { schema: 2, questions: [{ id: 'q1', prompt: 'P?', answer: 'A' }], legacy: {}, sets: [{ id: 's1', name: 'S', items: ['q1', 'q1'], createdAt: 'x' }] } }) });
    const before = storage.getItem(KEY);
    const Q = fresh(storage);
    eq([Q.namedSets({ peek: true }).length, Q.namedSetQuestions('s1', { peek: true }).questions.length, Q.questionsOf('named:s1', { peek: true }).length], [1, 2, 2], 'a page that only reads sees the sets with peek');
    eq([storage.writes, storage.getItem(KEY) === before], [[], true], 'and writes nothing');
    const newer = fakeStorage({ [KEY]: JSON.stringify({ v: 1, data: { schema: 3, questions: [{ id: 'q1', prompt: 'P?', answer: 'A' }], legacy: {}, sets: [{ id: 's1', name: 'S', items: ['q1'] }] } }) });
    const Qn = fresh(newer);
    eq([Qn.saveSet({ name: 'x', items: [] }).newer, Qn.deleteSet('s1').newer, newer.writes], [true, true, []], 'a newer page\'s bank: a set is never saved or deleted into it');
  });

  if (!quiet) console.log('Named sets: an older page (v299) against a bank with sets');
  guard('old page', () => {
    const storage = fakeStorage();
    const Q = fresh(storage);
    const q1 = Q.saveQuestion({ prompt: 'Old page?', answer: 'Yes' }, T).question;
    Q.saveSet({ name: 'Kept', items: [q1.id] }, T);
    const before = storage.getItem(KEY);
    const old = page(storage, [OLD_SRC]).QuestionBank;
    eq(old.list().map(q => q.prompt), ['Old page?'], 'a v299 page reads the questions of a bank with sets');
    eq([old.saveQuestion({ prompt: 'x', answer: 'y' }).newer, old.deleteQuestion(q1.id).newer, old.importQuestions([{ prompt: 'a', answer: 'b' }]).ok],
      [true, true, false], 'and refuses every write to it, saying it is newer');
    eq(storage.getItem(KEY), before, 'so the sets are still there, byte for byte');
    // and the other way: a bank the old page wrote is read here as it was
    const s2 = fakeStorage();
    const old2 = page(s2, [OLD_SRC]).QuestionBank;
    old2.saveQuestion({ prompt: 'Made old?', answer: 'Y' }, T);
    const Q2 = fresh(s2);
    eq([Q2.list().map(q => q.prompt), Q2.namedSets()], [['Made old?'], []], 'a bank an older page wrote reads here with no sets');
    eq(Q2.saveSet({ name: 'First', items: [Q2.list()[0].id] }).ok, true, 'and takes its first set');
    // the old page imports the questions of a new file and leaves the sets
    const file = Q2.toJSON(Q2.list(), { title: 'x', exported: 'E', sets: Q2.namedSets() });
    const parsedOld = old.parse(file);
    eq([parsedOld.error, parsedOld.questions.length], ['', 1], 'an older page still reads a new bank file\'s questions');
  });

  if (!quiet) console.log('Named sets: the bank file, and an import that adds');
  guard('files', () => {
    const storage = fakeStorage();
    const Q = fresh(storage);
    const a = Q.saveQuestion({ prompt: 'Alpha?', answer: 'A' }, T).question;
    const b = Q.saveQuestion({ prompt: 'Beta?', answer: 'B' }, T).question;
    const set = Q.saveSet({ name: 'Mixed', items: [b.id, a.id, b.id] }, T).set;
    const noSets = JSON.parse(Q.toJSON(Q.list(), { title: 't', exported: 'E' }));
    eq([Object.keys(noSets), noSets.version], [['format', 'version', 'title', 'exported', 'questions'], 1], 'a file with no sets is the file it always was');
    const text = Q.toJSON(Q.list(), { title: 't', exported: 'E', sets: Q.namedSets() });
    const file = JSON.parse(text);
    eq([file.version, file.sets.map(s => [s.id, s.name, s.items])], [1, [[set.id, 'Mixed', [b.id, a.id, b.id]]]], 'a file with sets keeps version 1 and carries them beside the questions');
    const parsed = Q.parse(text);
    eq(parsed.sets.map(s => s.items), [[b.id, a.id, b.id]], 'parse() gives the sets back');
    eq([Q.parse('[{"prompt":"p","answer":"a"}]').sets, Q.parse('Question,Answer\nq,a').sets, Q.parse(JSON.stringify({ format: 'aplp-question-bank', version: 1, questions: [] })).sets], [[], [], []],
      'an old file, a bare list and a CSV have no sets');
    eq(Q.parse(JSON.stringify({ version: 1, questions: [], sets: 'lots' })).sets, [], 'and `sets` that is not a list is none');

    // the same file into the same bank: nothing changes
    const same = Q.importQuestions(parsed.questions, { sets: parsed.sets });
    eq([same.added, same.updated, same.sets.added, same.sets.same, Q.namedSets().length], [0, 0, 0, 1, 1], 'the same file twice adds no set: it is `same`');

    // into another browser's bank: the ids travel, and the set reads the same
    const s2 = fakeStorage();
    const Q2 = fresh(s2);
    const c = Q2.saveQuestion({ prompt: 'Beta?', answer: 'B' }, T).question;          // same words, own id
    Q2.saveSet({ name: 'Mixed', items: [c.id] }, T);                                   // a set of that name already
    const res = Q2.importQuestions(parsed.questions, { sets: parsed.sets });
    eq([res.added, res.skipped], [1, 1], 'Alpha is added, Beta skipped as already there');
    eq(res.ids[b.id], c.id, "merge()'s map sends the file's Beta to the question already here");
    eq([res.sets.added, res.sets.names], [1, ['Mixed (2)']], 'the file\'s set is added beside the one of the same name, never over it');
    const got = Q2.namedSets();
    eq(got.map(s => s.name), ['Mixed', 'Mixed (2)'], 'both are there');
    eq(Q2.namedSetQuestions(got[1].id).questions.map(q => q.prompt), ['Beta?', 'Alpha?', 'Beta?'], 'and the new one reads as it did in the other browser');
    eq(got[0].items, [c.id], 'the set that was here is unchanged');
    const again = Q2.importQuestions(parsed.questions, { sets: parsed.sets });
    eq([again.sets.added, again.sets.same, Q2.namedSets().length], [0, 1, 2], 'and importing it again adds nothing');

    // a set id already here with other items: added, not overwritten
    const s3 = fakeStorage();
    const Q3 = fresh(s3);
    Q3.importQuestions(parsed.questions, { sets: parsed.sets });
    const mine = Q3.namedSets()[0];
    Q3.saveSet({ id: mine.id, name: 'Mixed', items: [mine.items[0]] });
    const r3 = Q3.importQuestions(parsed.questions, { sets: parsed.sets });
    eq([r3.sets.added, Q3.namedSets().map(s => s.items.length)], [1, [1, 3]], 'a file set whose id is here with other items is added as a new set; the one here keeps its change');
    eq(new Set(stored(s3).data.sets.map(s => s.id)).size, 2, 'stored with an id of its own');

    // an item the file cannot back is dropped and counted; a seed item travels
    const s4 = fakeStorage();
    const Q4 = fresh(s4);
    const r4 = Q4.importQuestions([{ id: 'x1', prompt: 'Kept?', answer: 'K' }, { id: 'x2', prompt: '', answer: 'no prompt' }],
      { sets: [{ id: 'f', name: 'From file', items: ['x1', 'x2', 'nowhere', 'seed:053:1'] }] });
    eq([r4.added, r4.invalid.length, r4.sets.added, r4.sets.dropped], [1, 1, 1, 2], 'an invalid row and an unknown id are dropped from the incoming set and counted');
    eq(Q4.namedSets()[0].items, ['x1', 'seed:053:1'], 'a seed id is kept as it is');
    // a file with only sets the bank already has, and nothing to add, writes nothing
    const w = s4.writes.length;
    Q4.importQuestions([{ id: 'x1', prompt: 'Kept?', answer: 'K' }], { sets: [{ id: 'f', name: 'From file', items: ['x1', 'seed:053:1'] }] });
    eq(s4.writes.length, w, 'an import that changes nothing writes nothing');
  });

  if (!quiet) console.log('Named sets: seeds, and the chooser');
  guard('chooser', () => {
    const storage = fakeStorage();
    const win = page(storage, [qb, CTCG_SRC]);
    const Q = win.QuestionBank;
    const mine = Q.saveQuestion({ prompt: 'Mine?', answer: 'Yes' }, T).question;
    const seed = Q.setQuestions('053')[0];
    const set = Q.saveSet({ name: 'Warm-up', items: [seed.id, mine.id] }, T).set;
    eq(Q.namedSetQuestions(set.id).questions.map(q => q.id), [seed.id, mine.id], 'a set may point at a built-in question, with nothing copied');
    eq(Q.list().length, 1, 'the bank still has the one question');
    eq(Q.sources().map(s => s.id), ['', '053'], 'sources() is unchanged without { named: true }, so 040 and 020 list what they did');
    const named = Q.sources({ named: true });
    eq(named.map(s => [s.id, s.count, s.readOnly, !!s.named]), [['', 1, false, false], ['named:' + set.id, 2, false, true], ['053', 30, true, false]],
      'with it, each named set comes after the bank and before the built-in sets');
    eq(Q.sourceLabel(named[1]), 'Warm-up (named set, 2 questions)', 'and is labelled as a named set');
    eq(Q.questionsOf('named:' + set.id).map(q => q.prompt), [seed.prompt, 'Mine?'], 'questionsOf() reads a named set');
    eq([Q.isNamedSource('named:x'), Q.isNamedSource('053'), Q.isNamedSource(''), Q.isNamedSource(null)], [true, false, false, false], "a named set's source id is told apart from a seed set's");
    const bare = page(fakeStorage(), [qb]).QuestionBank;
    eq(bare.namedSetQuestions('x').missing, 0, 'no such set on a page with no seeds');
    const lone = fakeStorage({ [KEY]: storage.getItem(KEY) });
    eq(page(lone, [qb]).QuestionBank.namedSetQuestions(set.id).missing, 1, 'on a page that has not loaded the seed set, that item is counted missing');
    eq(JSON.parse(lone.getItem(KEY)).data.sets[0].items, [seed.id, mine.id], 'and is kept, not dropped');
  });

  return { passed, fails };
}

const main = run(QB_SRC);
console.log(`\n${main.passed} passed, ${main.fails.length} failed`);

/* Each break is one change to the module; each must make at least one
   assertion above fail. The text replaced must be in the module once, so a
   break that no longer applies fails here too, and is mended, not dropped. */
const BREAKS = [
  ['write drops the sets', "if (sets.length) data.sets = sets;", ''],
  ['the schema stays 1 with sets', "schema: sets.length ? SCHEMA : VERSION", 'schema: VERSION'],
  ['the schema is 2 with no set', "schema: sets.length ? SCHEMA : VERSION", 'schema: SCHEMA'],
  ['read ignores the sets', "bank.sets = normalizeSets(data.sets);", ''],
  ['a stored 2 is read as newer', "data.schema > SCHEMA) bank.schema", 'data.schema > VERSION) bank.schema'],
  ['a delete leaves its id in sets', "bank.sets = removeFromSets(bank.sets, id);", ''],
  ['a delete takes only the first', "copy.items = set.items.filter(function (x) { return x !== id; });", 'copy.items = set.items.slice(); copy.items.splice(copy.items.indexOf(id), 1);'],
  ['repeats are dropped', "if (id && !UNSAFE[id] && items.length < SET_LIMIT.items) items.push(id);", 'if (id && !UNSAFE[id] && items.length < SET_LIMIT.items && items.indexOf(id) === -1) items.push(id);'],
  ['no item limit', "items.length < SET_LIMIT.items) items.push", 'true) items.push'],
  ['rename loses the first date', "n.createdAt = out[at].createdAt || n.createdAt || stamp(opts);", 'n.createdAt = stamp(opts);'],
  ['a file overwrites a set with its id', "return sameItems(x.items, items) && (x.id === set.id || fold(x.name) === fold(set.name));", 'return x.id === set.id || (sameItems(x.items, items) && fold(x.name) === fold(set.name));'],
  ['a taken name is not changed', "while (taken(name))", 'while (false && taken(name))'],
  ['ids are not mapped', "var to = own(ids, id) ? ids[id] : id;", 'var to = id;'],
  ['an unknown item is kept', "if (isSeedId(to) || own(have, '$' + to)) items.push(to); else res.dropped++;", 'items.push(to);'],
  ['a skipped row maps to nothing', "if (own(byContent, contentKey(q))) { took(byContent[contentKey(q)]); res.skipped++; return; }", 'if (own(byContent, contentKey(q))) { res.skipped++; return; }'],
  ['an import never merges sets', "if (opts && Array.isArray(opts.sets) && opts.sets.length) {", 'if (false) {'],
  ['an added set is not written', "if (res.added || res.updated || res.sets.added) {", 'if (res.added || res.updated) {'],
  ['a file carries no sets', "if (named.length) file.sets = named;", ''],
  ['a file always carries sets', "if (named.length) file.sets = named;", 'file.sets = named;'],
  ['parse gives no sets', "sets: isRecord(data) ? normalizeSets(data.sets) : [] };", 'sets: [] };'],
  ['a missing item is not counted', "if (q) res.questions.push(JSON.parse(JSON.stringify(q))); else res.missing++;", 'if (q) res.questions.push(JSON.parse(JSON.stringify(q)));'],
  ['a missing seed is dropped', "if (id && !UNSAFE[id] && items.length", 'if (id && !UNSAFE[id] && id.indexOf("seed:") !== 0 && items.length'],
  ['resolve hands out the stored question', "if (q) res.questions.push(JSON.parse(JSON.stringify(q)));", 'if (q) res.questions.push(q);'],
  ['sources always lists named sets', "var named = opts && opts.named ?", 'var named = true ?'],
  ['named sets after the seeds', ".concat(named)\n      .concat(sets().map(", ".concat(sets().map("],
  ['a named set labelled as the bank', "if (src.named) return text(src.title) + ' (named set, ' + count + ')';", ''],
  ['questionsOf ignores named sets', "if (isNamedSource(source)) return", 'if (false) return'],
  ['peek writes', "var bank = opts && opts.peek ? read() : load(), set = null;", 'var bank = load(), set = null; if (opts && opts.peek) write(bank);'],
  ['a set saved into a newer bank', "if (bank.schema > VERSION) return { ok: false, newer: true", 'if (false) return { ok: false, newer: true'],
  ['a nameless set is stored', "if (!done.set) return { ok: false, noName: true, set: null };", 'if (!done.set) return { ok: true, set: null };'],
  ['deleteSet deletes them all', "bank.sets = bank.sets.filter(function (s) { return s.id !== id; });", 'bank.sets = [];'],
  ['two sets share an id', "if (!set.id || indexOfId(out, set.id) !== -1) set.id = freshSetId(out, opts);", 'if (!set.id) set.id = freshSetId(out, opts);'],
  ['an imported set takes a new id', "var keepId = set.id && indexOfId(out, set.id) === -1 ? set.id : '';", "var keepId = '';"],
  ['an imported set takes an id already here', "var keepId = set.id && indexOfId(out, set.id) === -1 ? set.id : '';", 'var keepId = set.id;'],
  ['a named: id is stored', "n.id = n.id && n.id.indexOf(NAMED_PREFIX) !== 0 ? n.id : freshSetId(out, opts);", 'n.id = n.id || freshSetId(out, opts);'],
];
let unapplied = 0, missed = 0;
for (const [label, from, to] of BREAKS) {
  const n = QB_SRC.split(from).length - 1;
  if (n !== 1) { unapplied++; console.log(`  BREAK NOT APPLIED (${n} matches): ${label}`); continue; }
  let r;
  try { r = run(QB_SRC.replace(from, to), { quiet: true }); } catch (e) { r = { fails: ['threw'] }; }
  if (!r.fails.length) { missed++; console.log(`  BREAK NOT CAUGHT: ${label}`); }
}
console.log(`${BREAKS.length} deliberate breaks: ${BREAKS.length - unapplied - missed} caught, ${missed} missed, ${unapplied} not applied`);
process.exit(main.fails.length || missed || unapplied ? 1 : 0);
