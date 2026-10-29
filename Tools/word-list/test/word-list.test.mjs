// word-list.test.mjs — pure-logic tests for _shared/word-list.js (Path 19 P1): the word record, the
// text format held to 040's VocabLayout.parseWordList, the table and file readers, the merge, the
// storage and the migration from 040's own keys (fixtures of the old format).
//
//   node Tools/word-list/test/word-list.test.mjs      (or: npm run test:word-list)
//
// word-list.js is a classic script publishing window.WordList. It runs here in a vm context over a
// fake localStorage, beside store.js, paste-table.js and export.js. The suite then runs itself against
// deliberately broken copies of the module and requires each to fail (break-on-purpose). The word-pair
// reader is held to 039's own parseVocab, which this file CUTS OUT OF 039'S PAGE BY TEXT (a rename of
// that function in the page fails the suite on purpose: it is the other half of the parity). Every word is
// invented. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, '..', '..', '..');
const read = f => fs.readFileSync(path.join(site, f), 'utf8');
const SRC = read('_shared/word-list.js');
const LEGACY_KEY = 'gvb-vocab-flashcards:list', LEGACY_DATA = 'gvb-vocab-flashcards:data:';

function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    writes: [],
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem(k, v) { if (k !== '__gvb_store_probe__') this.writes.push(k); map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
    dump: () => Object.fromEntries(map),
  };
}

function page(storage, src = SRC, { noStore = false } = {}) {
  const win = {
    localStorage: storage, navigator: {}, console: { error() {} },
    addEventListener() {}, dispatchEvent() { return true; },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    document: { body: { appendChild() {} }, createElement: () => ({ style: { cssText: '' }, setAttribute() {}, textContent: '' }) },
    Blob, setTimeout, clearTimeout,
  };
  win.window = win;
  const ctx = vm.createContext(win);
  if (!noStore) vm.runInContext(read('_shared/store.js'), ctx);
  vm.runInContext(read('_shared/paste-table.js'), ctx);
  vm.runInContext(read('_shared/export.js'), ctx);
  vm.runInContext(read('Tools/vocab-flashcard-generator/vfg-layout.js'), ctx);
  vm.runInContext(src, ctx);
  return win;
}

const PAGE_039 = read('Tools/039-vocab-conjugation-drill.html');
const parseVocab039 = (() => {
  const m = PAGE_039.match(/function parseVocab\(text\) \{[\s\S]*?\n {2}\}\n/);
  if (!m) { console.log('  FAIL parseVocab was not found in 039; the pair-reader parity cannot be held'); process.exit(1); }
  return vm.runInNewContext('(' + m[0].replace(/^function parseVocab/, 'function') + ')');
})();
const plain = v => JSON.parse(JSON.stringify(v));
const sorted = v => Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])])) : v;
const stable = v => JSON.stringify(sorted(plain(v)));

function suite(label, src) {
  let passed = 0; const fails = [];
  const ok = (c, l) => { if (c) passed++; else fails.push(l); };
  const eq = (a, b, l) => ok(stable(a) === stable(b), l + (stable(a) === stable(b) ? '' : ` (got ${stable(a)})`));
  const mk = (seed) => { const st = fakeStorage(seed); const w = page(st, src); return { st, w, WL: w.WordList }; };
  const { WL, w: win } = mk();
  win.__parseVocab039 = parseVocab039;
  const T = (term, o = {}) => ({ term, definition: '', partOfSpeech: '', example: '', pronunciation: '', gender: '', tags: [], ...o });

  // ---- the word ----
  eq([WL.KEY, WL.SCHEMA], ['gvb-word-lists', 1], 'the key and schema are the documented ones');
  eq(WL.normalizeWord({ term: ' casa ', definition: ' house ', tags: 'a, A; b', gender: ' f ', audio: 'x' }),
    { term: 'casa', definition: 'house', partOfSpeech: '', example: '', pronunciation: '', gender: 'f', tags: ['a', 'b'], audio: 'x', id: '' },
    'normalize trims, splits and de-duplicates tags and keeps a field it does not know');
  ok(WL.normalizeWord({ term: '  ' }) === null && WL.normalizeWord(null) === null, 'no term, no word');
  const cw = WL.cleanWords([{ term: 'a', id: 'w2' }, { term: 'b' }, { term: 'c', id: 'w2' }, { term: '' }]);
  eq(cw.map(x => x.id), ['w2', 'w3', 'w4'], 'ids are kept, a repeated id and a missing one get the next free ones');

  // ---- 040's text format held to VocabLayout.parseWordList ----
  const corpus = [
    'casa: house', 'casa: house | Mi casa es grande | KAH-sah | noun', 'casa:', ': nothing', 'a:b:c', 'x: y | | | verb',
    'casa\thouse\tex\tpron\tnoun', 'casa\t', '\tonly def', 'casa\thouse\te\tp\tn\tEXTRA', 'uno, one', '"a, b", c, d, e, f, g',
    'no delimiter here', '   ', '', 'tab: and\tcolon', '  spaced  :  out  ', 'é: ü | ñ', 'quote"s: "x"',
  ];
  for (const line of corpus) {
    eq(WL.fromText(line), win.VocabLayout.parseWordList(line), 'fromText equals parseWordList on ' + JSON.stringify(line));
  }
  const bigText = corpus.join('\r\n') + '\n\n' + corpus.join('\n');
  eq(WL.fromText(bigText), win.VocabLayout.parseWordList(bigText), 'fromText equals parseWordList on a whole mixed paste, CRLF and LF');
  let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const alphabet = ['a', 'b', ' ', ':', '|', ',', '\t', '"', 'é', 'z'];
  let same = true;
  for (let i = 0; i < 400; i++) {
    let line = ''; const n = Math.floor(rnd() * 14);
    for (let j = 0; j < n; j++) line += alphabet[Math.floor(rnd() * alphabet.length)];
    if (JSON.stringify(WL.fromText(line)) !== JSON.stringify(plain(win.VocabLayout.parseWordList(line)))) { same = false; break; }
  }
  ok(same, 'fromText equals parseWordList on 400 seeded random lines');

  // ---- 039's word pairs held to its own parseVocab ----
  const pairCorpus = ['casa: house', 'casa:', ': nothing', 'a:b:c', 'bare word', '  spaced  :  out  ', 'é: ü', '', '   ', 'x:y\nz', 'one: 1\n\ntwo: 2\r\nthree'];
  for (const text of pairCorpus) {
    eq(WL.fromPairs(text).map(x => ({ word: x.term, translation: x.definition })), win.__parseVocab039(text), 'fromPairs equals 039\'s parseVocab on ' + JSON.stringify(text));
  }
  let samePairs = true;
  for (let i = 0; i < 300; i++) {
    let text = ''; const n = Math.floor(rnd() * 16);
    for (let j = 0; j < n; j++) text += ['a', ' ', ':', '\n', 'é', '|'][Math.floor(rnd() * 6)];
    if (JSON.stringify(WL.fromPairs(text).map(x => ({ word: x.term, translation: x.definition }))) !== JSON.stringify(win.__parseVocab039(text))) { samePairs = false; break; }
  }
  ok(samePairs, 'fromPairs equals parseVocab on 300 seeded random texts');
  eq(WL.toPairs([T('casa', { definition: 'house' }), T('solo'), T('a:b', { definition: 'x' })]), 'casa: house\nsolo', 'toPairs writes term: definition, a bare term alone, and leaves out a term 039 could not read back');
  eq(WL.fromPairs(WL.toPairs([T('a', { definition: 'b' }), T('c'), T('d', { definition: 'e' })])).length, 3, 'toPairs then fromPairs keeps every term it could write');

  // ---- toText round-trips ----
  const rt = [
    T('casa', { definition: 'house' }), T('perro', { definition: 'dog', example: 'El perro ladra', pronunciation: 'PEH-rroh', partOfSpeech: 'noun' }),
    T('a:b', { definition: 'colon in the term' }), T('x', { definition: 'a | b' }), T('solo'), T('tab\tbed', { definition: 'one\ttwo' }),
  ];
  const back = WL.fromText(WL.toText(rt));
  eq(back.map(x => x.term), ['casa', 'perro', 'a:b', 'x', 'solo', 'tab bed'], 'toText then fromText keeps every term, tabs flattened');
  eq(back[3].definition, 'a | b', 'a pipe in a definition survives through the tab form');
  eq(back[1], { term: 'perro', definition: 'dog', example: 'El perro ladra', pronunciation: 'PEH-rroh', partOfSpeech: 'noun' }, 'all five fields survive');

  // ---- reconcile: the textarea edit keeps what the text cannot hold ----
  const before = WL.cleanWords([T('casa', { definition: 'house', gender: 'f', tags: ['u1'], audio: 'a1' }), T('perro', { definition: 'dog', gender: 'm' })]);
  const after = WL.reconcile(before, WL.fromText('perro: hound\nnuevo: new\ncasa: home'));
  eq(after.map(x => [x.term, x.definition, x.gender, x.id]), [['perro', 'hound', 'm', 'w2'], ['nuevo', 'new', '', 'w3'], ['casa', 'home', 'f', 'w1']],
    'an edit keeps id, gender and tags by term, moves with the order and gives a new word the next id');
  eq(after[2].audio, 'a1', 'a field the module does not know survives an edit');
  eq(WL.reconcile(WL.cleanWords([T('a', { gender: 'm' }), T('a', { gender: 'f' })]), WL.fromText('a: 1\na: 2')).map(x => x.gender), ['m', 'f'], 'a repeated term matches its own copies in order');

  // ---- mergeWords ----
  const mg = WL.mergeWords(WL.cleanWords([T('casa', { definition: 'house' }), T('gato')]), [T('casa', { definition: 'OTHER', example: 'Mi casa' }), T('GATO', { definition: 'cat' }), T('luz', { definition: 'light' })]);
  eq(mg.words.map(x => [x.term, x.definition, x.example]), [['casa', 'house', 'Mi casa'], ['gato', 'cat', ''], ['luz', 'light', '']], 'merge never changes a filled field, fills an empty one and appends a new term');
  eq([mg.added, mg.filled], [1, 2], 'merge counts what it added and filled');

  // ---- the table ----
  const tbl = WL.parseTable('Term\tMeaning\tPOS\tExample\tPron\tGender\tTags\ncasa\thouse\tnoun\tMi casa\tKAH\tf\tu1; u2\n\t\t\tstray\n');
  ok(tbl.headerSkipped, 'a header row is recognised by its names');
  eq(tbl.words.map(x => [x.term, x.partOfSpeech, x.gender, x.tags]), [['casa', 'noun', 'f', ['u1', 'u2']]], 'columns are named by the header');
  eq(tbl.unreadable.map(x => x.line), [3], 'a line with cells and no term is reported with its line number');
  const noHead = WL.parseTable('casa,house\nperro,dog,El perro');
  ok(!noHead.headerSkipped, 'no header: a first row of words is not taken for one');
  eq(noHead.words.map(x => [x.term, x.definition, x.partOfSpeech, x.example]), [['casa', 'house', '', ''], ['perro', 'dog', '', 'El perro']], 'without a header the columns are 040\'s order: term, definition, example...');
  ok(WL.parseTable('word,translation\nrun,correr').headerSkipped, 'word and translation are header names too');
  ok(!WL.parseTable('word, thing\nfoo,bar').headerSkipped, 'a header needs two known column names');

  // ---- CSV out and back ----
  const csv = WL.toCsv([T('-ing', { definition: 'suffix', tags: ['x', 'y'] }), T('a,b', { definition: 'comma "q"' })]);
  ok(csv.startsWith('﻿term,definition,example,pronunciation,partOfSpeech,gender,tags'), 'the CSV has the header and the byte order mark');
  eq(WL.parseTable(csv).words.map(x => x.term), ['-ing', 'a,b'], 'a CSV that keeps its byte order mark reads the same (trim takes it off the first cell)');
  const csvBack = WL.parseTable(csv.slice(1));
  eq(csvBack.words.map(x => [x.term, x.definition, x.tags]), [['-ing', 'suffix', ['x', 'y']], ['a,b', 'comma "q"', []]], 'CSV out and back: the formula apostrophe comes off, quotes and commas survive');
  ok(WL.templateCsv().includes('la biblioteca') && WL.parseTable(WL.templateCsv().slice(1)).words.length === 2, 'the template downloads two example rows that read back');

  // ---- JSON ----
  const lists = [{ name: 'Unit 1', words: [T('casa', { audio: 'k' })] }, { name: 'Unit 2', words: [T('luz')] }];
  const js = WL.fromJSON(WL.toJSON(lists));
  eq(js.lists.map(l => [l.name, l.words.map(x => x.term)]), [['Unit 1', ['casa']], ['Unit 2', ['luz']]], 'JSON out and back keeps the lists');
  eq(js.lists[0].words[0].audio, 'k', 'JSON keeps a field the module does not know');
  ok(WL.fromJSON('nope').problems.length === 1 && WL.fromJSON('{"app":"other"}').lists.length === 0, 'something that is not a word-lists file is refused in words');
  ok(WL.fromJSON('{"app":"word-lists","v":1,"lists":[{"words":[]},{"name":"ok","words":[{"term":"x"}]}]}').problems.length === 1, 'a list without a name is skipped and said');

  // ---- storage ----
  const a = mk();
  eq(a.WL.names(), [], 'a fresh page has no lists');
  a.WL.put('Unit 1', [T('casa')], 1000);
  a.WL.put('Unit 2', [T('luz')], 2000);
  eq(a.WL.names(), ['Unit 1', 'Unit 2'], 'put makes lists in order');
  eq(a.WL.get('Unit 1').words.map(x => x.id), ['w1'], 'a stored word has an id');
  const b = page(a.st, src).WordList;
  eq(b.names(), ['Unit 1', 'Unit 2'], 'a second page over the same storage sees them');
  a.WL.putText('Unit 1', 'casa: home\nnuevo: new', 3000);
  eq(a.WL.get('Unit 1').words.map(x => [x.id, x.term, x.definition]), [['w1', 'casa', 'home'], ['w2', 'nuevo', 'new']], 'putText keeps the id by term');
  ok(a.WL.rename('Unit 2', 'Unit Two') && !a.WL.rename('Unit 1', 'Unit Two') && !a.WL.rename('zzz', 'q'), 'rename works, and refuses a name that is taken or a list that is not there');
  a.WL.setCurrent('Unit Two');
  ok(b.load().current === 'Unit Two', 'the current list is stored');
  ok(a.WL.remove('Unit Two') && a.WL.load().current === '' && !a.WL.remove('Unit Two'), 'remove deletes, clears current and says false the second time');
  ok(a.st.dump()['gvb-word-lists'].startsWith('{"v":1,"data":'), 'the key holds a Store envelope');
  const torn = mk({ 'gvb-word-lists': 'not json at all' });
  eq(torn.WL.names(), [], 'an unreadable value reads as no lists');
  ok(torn.st.dump()['gvb-word-lists'] === 'not json at all', 'and is left on disk until the next save');
  const odd = mk({ 'gvb-word-lists': JSON.stringify({ v: 1, data: { lists: [{ name: 'A', words: [{ term: 'x' }], extra: 1 }, { name: 'A' }, { words: [] }], current: 'gone' } }) });
  eq(odd.WL.load().lists.map(l => l.name), ['A'], 'a repeated or unnamed list is dropped on read');
  ok(odd.WL.load().current === '' && odd.WL.load().lists[0].extra === 1 && odd.WL.load().lists[0].id === 'l1', 'a dangling current is cleared, a list field it does not know stays, a list gets an id');

  // ---- the migration from 040's keys ----
  const legacyBlob = (words, extra = {}) => JSON.stringify({ name: 'x', words, mode: 'wordwall', flashCols: 3, ...extra });
  const old = {
    [LEGACY_KEY]: JSON.stringify(['Spanish 1', 'Bio unit', 'Empty', 'Broken', 'Missing']),
    [LEGACY_DATA + 'Spanish 1']: legacyBlob('casa: house | Mi casa | KAH-sah | noun\nperro\tdog\nbad line\nluz, light'),
    [LEGACY_DATA + 'Bio unit']: legacyBlob('cell: unit of life\r\nmitosis: division'),
    [LEGACY_DATA + 'Empty']: legacyBlob(''),
    [LEGACY_DATA + 'Broken']: '{not json',
    'gvb-vocab-flashcards:current': 'Bio unit',
  };
  const m = mk(old);
  eq(m.WL.importLegacy(m.st, 5000), { moved: 3, merged: 0 }, 'three readable sets move; a broken one and a missing one are skipped');
  eq(m.WL.names(), ['Spanish 1', 'Bio unit', 'Empty'], 'the lists come over in 040\'s order, under 040\'s names');
  eq(m.WL.get('Spanish 1').words.map(x => [x.term, x.definition, x.example, x.pronunciation, x.partOfSpeech]),
    plain(win.VocabLayout.parseWordList(JSON.parse(old[LEGACY_DATA + 'Spanish 1']).words)).map(x => [x.term, x.definition, x.example, x.pronunciation, x.partOfSpeech]),
    'a migrated list is what 040 parsed from the same text');
  eq(m.WL.get('Bio unit').words.map(x => x.term), ['cell', 'mitosis'], 'CRLF text migrates');
  ok(m.st.writes.every(k => k === 'gvb-word-lists'), 'the migration writes only the hub key: 040\'s keys are untouched');
  eq(m.WL.importLegacy(m.st, 6000), { moved: 0, merged: 0 }, 'a second call adds nothing');
  m.WL.remove('Bio unit');
  m.WL.importLegacy(m.st, 7000);
  ok(!m.WL.names().includes('Bio unit'), 'a list the teacher deleted does not come back');
  const m2 = mk({ ...old, 'gvb-word-lists': JSON.stringify({ v: 1, data: { lists: [{ name: 'Spanish 1', words: [{ term: 'casa', definition: 'MINE', gender: 'f' }] }], legacy: [] } }) });
  eq(m2.WL.importLegacy(m2.st, 8000).merged, 1, 'a set whose name a list already has is merged into it');
  eq(m2.WL.get('Spanish 1').words.map(x => [x.term, x.definition, x.gender]), [['casa', 'MINE', 'f'], ['perro', 'dog', ''], ['luz', 'light', '']], 'the merge keeps the hub\'s own words and fills, never overwrites');


  // ---- 039's write-through and its migration ----
  const q = mk();
  q.WL.put('Unit 4', [T('casa', { definition: 'house', example: 'Mi casa', gender: 'f', tags: ['u4'] }), T('perro', { definition: 'dog' })], 1);
  q.WL.putPairs('Unit 4', 'perro: hound\nnueva: new\ncasa: home', 2);
  eq(q.WL.get('Unit 4').words.map(x => [x.term, x.definition, x.example, x.gender, x.tags]),
    [['perro', 'hound', '', '', []], ['nueva', 'new', '', '', []], ['casa', 'home', 'Mi casa', 'f', ['u4']]], 'putPairs changes term and definition only: an example, gender and tags stay with their term');
  ok(q.WL.putPairs('No such', '  \n') === null && !q.WL.names().includes('No such'), 'a blank text makes no list');
  ok(q.WL.putPairs('Made', 'a: b') && q.WL.names().includes('Made'), 'a text with words makes the list');
  const drillBlob = (vocabText, extra = {}) => JSON.stringify({ name: 'x', mode: 'vocab', vocabText, persons: [], conjugations: [], ...extra });
  const oldDrill = {
    'gvb-vocab-conj:list': JSON.stringify(['Drill A', 'Drill B', 'Conj only', 'Broken', 'Unit 4']),
    'gvb-vocab-conj:data:Drill A': drillBlob('hablar: to speak\ncomer\nbad:'),
    'gvb-vocab-conj:data:Drill B': drillBlob('uno: one'),
    'gvb-vocab-conj:data:Conj only': drillBlob('', { mode: 'conjugation' }),
    'gvb-vocab-conj:data:Broken': '{nope',
    'gvb-vocab-conj:data:Unit 4': drillBlob('casa: DRILL\nluz: light'),
    'gvb-vocab-conj:current': 'Drill A',
  };
  const dm = mk(oldDrill);
  dm.WL.put('Unit 4', [T('casa', { definition: 'house' })], 1);
  const writesBefore = dm.st.writes.length;
  eq(dm.WL.importLegacyDrill(dm.st, 9000), { moved: 2, merged: 1 }, 'two drill sets move, one joins a list of its name; one with no vocabulary and one broken are skipped');
  eq(dm.WL.get('Drill A').words.map(x => [x.term, x.definition]), [['hablar', 'to speak'], ['comer', ''], ['bad', '']], 'a drill set reads as 039 reads it: a bare word is kept');
  eq(dm.WL.get('Unit 4').words.map(x => [x.term, x.definition]), [['casa', 'house'], ['luz', 'light']], 'a drill set joining a list fills it and changes nothing it has');
  ok(dm.st.writes.slice(writesBefore).every(k => k === 'gvb-word-lists'), '039\'s keys are only read');
  eq(dm.WL.importLegacyDrill(dm.st, 9500), { moved: 0, merged: 0 }, 'a second call adds nothing');
  dm.WL.remove('Drill B'); dm.WL.importLegacyDrill(dm.st, 9600);
  ok(!dm.WL.names().includes('Drill B'), 'a list deleted after the move does not come back');
  eq(dm.WL.load().legacyDrill, ['Drill A', 'Drill B', 'Conj only', 'Unit 4'], 'the drill names are recorded apart from 040\'s');
  eq(mk({ ...oldDrill, ...old }).WL.importLegacy(undefined, 1).moved, 3, 'the two migrations do not disturb each other (040 first)');

  // ---- an import is planned before it is stored ----
  const p = mk(); p.WL.put('Unit 1', [T('casa', { definition: 'house' })], 1);
  const plan = p.WL.importPlan([{ name: 'Unit 1', words: [T('casa', { example: 'e' }), T('luz')] }, { name: 'New', words: [T('x')] }]);
  eq(plan, [{ name: 'Unit 1', kind: 'merge', add: 1, fill: 1 }, { name: 'New', kind: 'new', add: 1, fill: 0 }], 'the plan says merge or new, and how many words each way');
  ok(p.st.writes.filter(k => k === 'gvb-word-lists').length === 1, 'planning writes nothing');
  p.WL.applyImport([{ name: 'Unit 1', words: [T('luz')] }, { name: 'New', words: [T('x')] }], 2);
  eq(p.WL.names(), ['Unit 1', 'New'], 'applying stores the planned lists');

  // ---- needs ----
  const bare = page(fakeStorage(), src, { noStore: true }).WordList;
  let threw = false; try { bare.names(); } catch (e) { threw = /store\.js/.test(e.message); }
  ok(threw, 'storage without store.js says what it needs');

  return { label, passed, fails };
}

const real = suite('real', SRC);
real.fails.forEach(f => console.log('  FAIL ' + f));
console.log(`WordList: ${real.passed} passed, ${real.fails.length} failed`);
let bad = real.fails.length;

// ---- break on purpose: each broken copy must fail somewhere ----
const mutants = [
  ['fromText drops the pipe fields', s => s.replace("parts = line.slice(idx + 1).split('|');", "parts = [line.slice(idx + 1)];")],
  ['fromText checks colon before tab', s => s.replace("if (line.indexOf('\\t') !== -1) {\n        parts = line.split('\\t');", "if (line.indexOf('\\t') !== -1 && line.indexOf(':') === -1) {\n        parts = line.split('\\t');")],
  ['reconcile forgets the match', s => s.replace("pool[i].term === p.term", "false")],
  ['mergeWords overwrites', s => s.replace("if (!hit[f] && w[f])", "if (w[f])")],
  ['importLegacy forgets the names', s => s.replace("s.legacy.push(name);", "")],
  ['importLegacy writes the old key', s => s.replace("if (moved || merged) save(s);", "if (moved || merged) { ls.setItem(LEGACY_LIST, '[]'); save(s); }")],
  ['the CSV apostrophe stays', s => s.replace("function unguard(s) { return /^'[=+\\-@]/.test(s) ? s.slice(1) : s; }", "function unguard(s) { return s; }")],
  ['a header needs one name', s => s.replace("hits >= 2", "hits >= 1")],
  ['put keeps duplicates of ids', s => s.replace("if (seen[w.id]) w.id = '';", "")],
  ['putPairs blanks the example', s => s.replace("reconcile(l ? l.words : [], pairs, ['term', 'definition'])", "reconcile(l ? l.words : [], pairs)")],
  ['importLegacyDrill forgets its names', s => s.replace("s.legacyDrill.push(name); touched = true;", "touched = true;")],
  ['fromPairs drops a bare word', s => s.replace("out.push({ term: trimmed, definition: '' }); return;", "return;")],
  ['a dangling current is kept', s => s.replace("if (s.current && !seenName[s.current]) s.current = '';", "")],
  ['toText never uses the tab form', s => s.replace("if (t.indexOf(':') !== -1 ||", "if (false &&")],
  ['unknown fields are dropped', s => s.replace("for (k in w) if (Object.prototype.hasOwnProperty.call(w, k)) out[k] = w[k];", "")],
];
for (const [name, fn] of mutants) {
  const broken = fn(SRC);
  if (broken === SRC) { console.log('  FAIL mutant did not change the source: ' + name); bad++; continue; }
  let failed;
  try { failed = suite(name, broken).fails.length > 0; } catch (e) { failed = true; }
  if (failed) console.log('  ok   broken copy fails: ' + name);
  else { console.log('  FAIL broken copy passed: ' + name); bad++; }
}
process.exit(bad ? 1 : 0);
