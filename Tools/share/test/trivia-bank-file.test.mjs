// trivia-bank-file.test.mjs — 053's long list goes to 030's bank as a FILE.
// Plain Node, no browser.
//
//   node Tools/share/test/trivia-bank-file.test.mjs   (or: npm run test:trivia-bank-file)
//
// 053 -> 030 is the one handoff with a bound: a link past 7,500 characters is
// refused (handoffs.js, `maxLink`). Devon, 2026-10-07: past the bound, offer
// "the file" instead. The claim is that the file open() hands back is one
// 030's "Share the bank" import already reads and only ADDS from, so this
// suite runs the page's real path on it in a vm: _shared/handoffs.js (with
// state-link.js, tool-registry.js and 053's ctcg-bank.js) makes the file;
// _shared/question-bank.js parses it and 030's rgb-bank-editor.js plans the
// import exactly as 030's importBankQuestions() does; importQuestions() is
// the Add button. What it checks:
//
//   1. a list that fits still goes by link and offers no file;
//   2. a list past the bound offers a file, named, in the envelope
//      QuestionBank.toJSON() writes (same keys, format and version), with
//      the link's questions word for word and the sender in `sharedFrom`;
//   3. 030 reads it, plans to add every question it does not have and skip
//      the one it does, adds them on Add, and a second import adds nothing.
//
// Section 4 breaks handoffs.js on purpose five ways and checks each break is
// caught, so a pass here means something.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, '..', '..', '..');
const src = f => fs.readFileSync(path.join(site, f), 'utf8');
const HANDOFFS_SRC = src('_shared/handoffs.js');

const plain = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function fakeStorage() {
  const map = new Map();
  return {
    get length() { return map.size; },
    key: i => [...map.keys()][i] ?? null,
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
  };
}

/* One browser: 053's scripts and 030's, over one storage. */
function make(handoffsSrc) {
  const handlers = {};
  const opened = [];
  const win = {
    location: { href: 'https://aspermylessonplan.com/Tools/053-cultural-trivia-card-generator.html' },
    history: { replaceState() {} },
    open(url) { opened.push(url); return {}; },
    __opened: opened,
    localStorage: fakeStorage(), navigator: {}, console: { error() {}, warn() {}, log() {} },
    addEventListener(type, fn) { (handlers[type] ||= []).push(fn); },
    dispatchEvent(e) { (handlers[e.type] || []).forEach(fn => fn(e)); return true; },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    document: { body: { appendChild() {} }, createElement: () => ({ style: { cssText: '' }, setAttribute() {}, textContent: '' }) },
    URL, encodeURIComponent, decodeURIComponent, btoa, atob, TextEncoder, TextDecoder, Blob, setTimeout, clearTimeout,
  };
  win.window = win;
  const ctx = vm.createContext(win);
  vm.runInContext(src('_shared/state-link.js'), ctx, { filename: 'state-link.js' });
  vm.runInContext(src('_shared/tool-registry.js'), ctx, { filename: 'tool-registry.js' });
  vm.runInContext(handoffsSrc, ctx, { filename: 'handoffs.js' });
  vm.runInContext(src('_shared/store.js'), ctx, { filename: 'store.js' });
  vm.runInContext(src('_shared/question-bank.js'), ctx, { filename: 'question-bank.js' });
  vm.runInContext(src('Tools/cultural-trivia-card-generator/ctcg-bank.js'), ctx, { filename: 'ctcg-bank.js' });
  vm.runInContext(src('Tools/review-game-board/rgb-bank-editor.js'), ctx, { filename: 'rgb-bank-editor.js' });
  return win;
}

const CATS = ['hispanic', 'francophone', 'global', 'constructor'];
const listOf = n => ({ questions: Array.from({ length: n }, (_, i) => ({
  id: 'c-' + i, category: CATS[i % CATS.length],
  q: i === 7 ? '</script><img src=x onerror=alert(1)> “Quoted”, ñ and 😀 — question ' + (i + 1) + '?' : 'Made-up question number ' + (i + 1) + '?',
  a: 'Answer ' + (i + 1),
})).concat([{ category: 'global', q: '', a: 'no question' }, { category: 'global', q: 'no answer', a: '  ' }, null]) });

/* Every claim, against one handoffs.js. Returns the failures, as sentences;
   `log` prints each result as it goes. */
function check(handoffsSrc, log) {
  const fails = [];
  let passed = 0;
  const ok = (cond, label) => {
    if (cond) { passed++; if (log) console.log('  ok   ' + label); return true; }
    fails.push(label); if (log) console.log('  FAIL ' + label); return false;
  };
  const eq = (a, b, label) => {
    const same = isDeepStrictEqual(plain(a), plain(b));
    return ok(same, same ? label : `${label} (got ${JSON.stringify(a).slice(0, 300)}, want ${JSON.stringify(b).slice(0, 300)})`);
  };
  try {
    const win = make(handoffsSrc);
    const H = win.Handoffs, QB = win.QuestionBank, Ed = win.ReviewBankEditor;
    const entry = H.all.find(h => h.from === 'cultural-trivia-card-generator' && h.to === 'review-game-board');

    /* 1. a list that fits */
    if (log) console.log('1. a list that fits still goes by link');
    const fits = H.open(entry, listOf(40));
    eq([fits.ok, win.__opened.length, fits.file === undefined || fits.file === null], [true, 1, true], 'forty questions open one tab and offer no file');

    /* 2. a list past the bound */
    if (log) console.log('2. a list past the bound offers a bank file');
    const state = listOf(150);
    const over = H.open(entry, state);
    eq([over.ok, over.tooLong, win.__opened.length], [false, true, 1], 'a hundred and fifty open no tab');
    ok(/^Your 150 questions make a link of [\d,]+ characters, and a link longer than about 7,500 may not open\. Nothing was sent\. Save them as a bank file instead/.test(over.message),
      'the refusal says so and points to the file: ' + JSON.stringify(over.message));
    ok(!/not built yet/.test(over.message), 'and no longer says a longer list is not built');
    const file = over.file || {};
    eq([file.name, file.mime, file.label], ['custom-trivia-question-bank.json', 'application/json', 'Save a bank file instead'], 'the file is named, typed JSON and labelled for its button');
    ok(/Question Bank/.test(file.saved || '') && /Share the bank/.test(file.saved || ''), 'its saved sentence says where on 030 to import it: ' + JSON.stringify(file.saved));
    let data = null;
    try { data = JSON.parse(file.text); } catch (e) { /* data stays null */ }
    ok(data !== null, 'its text is JSON');
    data = data || {};
    const ref = JSON.parse(QB.toJSON([], { title: 'x' }));
    eq(Object.keys(data), Object.keys(ref), 'with the keys of QuestionBank.toJSON()\'s envelope, in its order');
    eq([data.format, data.version], [ref.format, ref.version], 'its format and version');
    eq(data.title, 'Custom trivia', 'titled as the link names the list');
    ok(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(data.exported || ''), 'and dated: ' + JSON.stringify(data.exported));
    const linkQs = H.url(entry, state, { base: win.location.href }).payload.questions;
    eq(linkQs.length, 150, 'the link\'s own payload has the 150 (blanks dropped)');
    eq((data.questions || []).map(q => ({ prompt: q.prompt, answer: q.answer, unit: q.unit })), linkQs, 'the file holds the link\'s questions word for word, units included');
    ok((data.questions || []).every(q => q.sharedFrom === 'cultural-trivia-card-generator'), 'each with the sender in sharedFrom, as fromLink() sets it');
    ok((data.questions || []).every(q => !('id' in q)), 'and no id: 053\'s ids are local to one browser');

    /* 3. 030 reads it */
    if (log) console.log('3. 030\'s import reads it and only adds');
    QB.saveQuestion({ prompt: '  made-up QUESTION number 3? ', answer: 'answer 3' });
    const parsed = QB.parse(file.text);
    eq([parsed.error, parsed.questions.length], ['', 150], 'QuestionBank.parse() reads all 150');
    const cleaned = QB.cleanMedia(parsed.questions, parsed.rows);
    eq([cleaned.images.length, cleaned.left.length, cleaned.questions.length], [0, 0, 150], 'cleanMedia() has no picture to take off');
    const plan = Ed.importPlan(QB.list(), { questions: cleaned.questions, rows: parsed.rows, error: '' });
    eq([plan.total, plan.added, plan.updated, plan.there, plan.refused], [150, 149, 0, 1, 0], '030\'s preview: 149 to add, the one already in the bank skipped, none refused');
    const res = QB.importQuestions(cleaned.questions);
    eq([res.ok, res.added, res.updated], [true, 149, 0], 'Add stores the 149');
    const bank = QB.list();
    eq(bank.length, 150, 'and the bank has 150');
    const byPrompt = Object.fromEntries(bank.map(q => [q.prompt, q]));
    ok(bank.every(q => /^q-/.test(q.id)), 'each with an id of the bank\'s');
    eq([byPrompt['Made-up question number 1?'].unit, byPrompt['Made-up question number 2?'].unit, byPrompt['Made-up question number 3?'], byPrompt['Made-up question number 4?'].unit],
      ['Hispanic World', 'Francophone World', undefined, ''], 'the category is the unit; the skipped one was not added twice; an unknown category has none');
    const odd = linkQs[7].prompt;
    eq(byPrompt[odd] && byPrompt[odd].answer, 'Answer 8', 'markup, quotes and emoji come through as the text they were');
    eq(byPrompt['Made-up question number 1?'].sharedFrom, 'cultural-trivia-card-generator', 'sharedFrom is kept in the bank');
    const again = QB.importQuestions(QB.parse(file.text).questions);
    eq([again.added, again.updated, QB.list().length], [0, 0, 150], 'the same file imported twice adds nothing');
    const plan2 = Ed.importPlan(QB.list(), QB.parse(file.text));
    eq([plan2.added, plan2.updated, plan2.there], [0, 0, 150], 'and 030\'s preview says so before Add');
  } catch (e) {
    ok(false, 'threw: ' + (e && e.stack || e));
  }
  return { fails, passed };
}

let failed = 0;
const real = check(HANDOFFS_SRC, true);
failed += real.fails.length;

/* 4. break it on purpose */
console.log('4. each break of handoffs.js is caught');
const BREAKS = [
  ['the format renamed', "format: 'aplp-question-bank'", "format: 'aplp-question-bnk'"],
  ['a newer version written', "format: 'aplp-question-bank', version: 1", "format: 'aplp-question-bank', version: 2"],
  ['the answer left out', 'return { prompt: q.prompt, answer: q.answer, unit: q.unit, sharedFrom: payload.from };', 'return { prompt: q.prompt, unit: q.unit, sharedFrom: payload.from };'],
  ['sharedFrom left out', 'return { prompt: q.prompt, answer: q.answer, unit: q.unit, sharedFrom: payload.from };', 'return { prompt: q.prompt, answer: q.answer, unit: q.unit };'],
  ['no file offered', "file: typeof entry.file === 'function' ? entry.file(built.payload) : null", 'file: null'],
];
for (const [name, from, to] of BREAKS) {
  const n = HANDOFFS_SRC.split(from).length - 1;
  if (n !== 1) { failed++; console.log(`  FAIL the break "${name}" no longer applies (found ${n} times): rewrite it`); continue; }
  const r = check(HANDOFFS_SRC.replace(from, to), false);
  if (r.fails.length) console.log(`  ok   ${name}: caught (${r.fails[0].slice(0, 90)})`);
  else { failed++; console.log(`  FAIL ${name}: not caught`); }
}

console.log(`\n${real.passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
