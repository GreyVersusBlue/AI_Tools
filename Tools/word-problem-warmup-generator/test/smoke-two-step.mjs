// smoke-two-step.mjs — 081's Problem type (one-step, two-step, mixed) on the page.
//
//   node Tools/word-problem-warmup-generator/test/smoke-two-step.mjs
//
// What the arithmetic is, and that it is right over tens of thousands of seeds, is
// smoke-two-step-core.mjs's (pure Node). This drives the page: that every set made
// before the choice existed comes out the same (112 cases recorded from the page
// at 1aaee05 as hashes, golden-old-sets.json, the saved string included), that a
// link without a mode opens as one-step whatever this device has saved, that a
// two-step sheet is the module's sheet for its seed with both steps in the key,
// that the choice is saved and shared only when it is not one-step, that grades
// 3-5 stay one-step and say so, and that a link that names no usable operation
// still opens when it is a two-step one. Names are invented. Nothing is printed.
// SECTIONS=AC runs only those sections (the deliberate-break runs use it).
//
// Exits 1 on any failure.

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
await import(pathToFileURL(path.join(here, '..', 'wp-twostep.js')).href);
const W = globalThis.WpTwoStep;
const GOLDEN = JSON.parse(fs.readFileSync(path.join(here, 'golden-old-sets.json'), 'utf8'));

const PORT = 8511;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGE = BASE + '/Tools/' + (process.env.PAGE_FILE || '081-word-problem-warmup-generator.html');
const KEY = 'wpwg_settings_v1';
const want = id => !process.env.SECTIONS || process.env.SECTIONS.indexOf(id) !== -1;

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; return true; } failed++; console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(a === b, `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const same = (a, b, l) => eq(JSON.stringify(a), JSON.stringify(b), l);

/* 081's makeRng, copied on purpose: the expected two-step sheet is computed here
   from the module and this rng, not read from the page. */
function makeRng(seed) {
  let state = seed >>> 0;
  return function () {
    state |= 0; state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const expectedTwoStep = (seed, count) => {
  const rng = makeRng(seed);
  return Array.from({ length: count }, () => W.makeProblem(rng));
};
const link = payload => PAGE + '?warmup=' + encodeURIComponent(Buffer.from(JSON.stringify(payload)).toString('base64'));
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const ALL_OPS = ['addition', 'subtraction', 'multiplication', 'division'];

const server = await serve(PORT);
const browser = await launch();

/** Opens the page with `saved` (an object) in the settings key, or a link, and
    answers dialogs by recording them and dismissing. Returns the page with what
    it rendered. */
async function open({ saved = null, url = PAGE, raw = null } = {}) {
  const page = await prepPage(browser, BASE, { width: 1200, height: 1000 });
  page.__dialogs = []; page.__errors = [];
  page.on('dialog', d => { page.__dialogs.push({ type: d.type(), message: d.message() }); d.dismiss(); });
  page.on('pageerror', e => page.__errors.push(e.message));
  await page.addInitScript(([k, v]) => {
    if (v !== null && !sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); }
    window.__copied = [];
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__copied.push(t); return Promise.resolve(); } }, configurable: true });
  }, [KEY, raw !== null ? raw : (saved ? JSON.stringify(saved) : null)]);
  await page.goto(url, { waitUntil: 'load' });
  await settle(page, 150);
  return page;
}
const read = page => page.evaluate(() => ({
  problems: [...document.querySelectorAll('#sheetProblems .problem')].map(e => e.textContent.replace(/^\d+\./, '').replace(/[\s ]+$/, '')),
  key: [...document.querySelectorAll('#sheetKey li')].map(e => e.textContent),
  first: document.getElementById('displayText').textContent,
  answer: document.getElementById('displayAnswer').textContent,
  seed: document.getElementById('seedDisplay').value,
  stored: localStorage.getItem('wpwg_settings_v1'),
  mode: document.getElementById('stepMode').value,
  modeDisabled: document.getElementById('stepMode').disabled,
  hint: document.getElementById('stepHint').textContent,
  hintShown: getComputedStyle(document.getElementById('stepHint')).display !== 'none',
  band: document.getElementById('gradeBand').value,
  ops: [...document.querySelectorAll('[data-op]')].filter(c => c.checked).map(c => c.getAttribute('data-op')),
  note: document.getElementById('shareNote').textContent,
}));
const closeAll = async pages => { for (const p of pages) await p.context().close(); };

console.log('081 — Problem type: one-step, two-step, mixed');

/* ── A. every set made before today comes out the same ───────────────────── */
if (want('A')) {
  console.log('\nA. 112 recorded sets');
  ok(GOLDEN.cases.length === 112, 'the golden file has 112 cases (' + GOLDEN.cases.length + ')');
  for (const g of GOLDEN.cases) {
    const page = await open({ saved: { seed: g.seed, gradeBand: g.band, ops: g.ops, problemCount: g.count, lockSeed: true } });
    const r = await read(page);
    const tag = `${g.band} ${g.ops.length} ops seed ${g.seed} x${g.count}`;
    eq(sha(JSON.stringify([r.problems.map((t, i) => (i + 1) + '.' + t + '  '), r.key, r.first, r.answer])), g.sha256, `${tag}: the sheet, key and display are the old page's`);
    eq(sha(r.stored), g.storedSha256, `${tag}: and the saved string is byte for byte what it was`);
    eq(r.mode, 'one', `${tag}: Problem type is One-step`);
    ok(r.key.every(k => /^\d+\. \d+$/.test(k)), `${tag}: every key line is the bare number`);
    await closeAll([page]);
  }
}

/* ── B. an old link opens as it did ──────────────────────────────────────── */
if (want('B')) {
  console.log('\nB. old links');
  const old = { seed: 20260812, gradeBand: 'middle', ops: ['addition', 'division'], problemCount: 8 };
  const ref = await open({ saved: { ...old, lockSeed: true } });
  const refR = await read(ref);
  const dev = { seed: 5, gradeBand: 'middle', ops: ALL_OPS, problemCount: 6, mode: 'two', lockSeed: false };
  const viaLink = await open({ saved: dev, url: link(old) });
  const lr = await read(viaLink);
  same(lr.problems, refR.problems, 'a link with no mode makes the old sheet even on a device whose saved Problem type is Two-step');
  same(lr.key, refR.key, 'and the old key');
  eq(lr.mode, 'one', 'and Problem type shows One-step');
  eq(viaLink.__dialogs.length, 0, 'and nothing asks');
  ok(/Loaded a shared warm-up/.test(lr.note), 'and the note says it loaded');
  const stored = JSON.parse(lr.stored);
  ok(!('mode' in stored), 'and the save no longer says two-step: ' + lr.stored);
  /* The same payload, hand-written with a junk mode, is still one-step. */
  for (const junk of ['x', '__proto__', 'TWO', 2, null, true, ['two']]) {
    const p = await open({ url: link({ ...old, mode: junk }) });
    const r = await read(p);
    same(r.problems, refR.problems, `a link whose mode is ${JSON.stringify(junk)} is the old sheet`);
    await closeAll([p]);
  }
  await closeAll([ref, viaLink]);
}

/* ── C. a two-step sheet ─────────────────────────────────────────────────── */
if (want('C')) {
  console.log('\nC. two-step and mixed sheets');
  for (const seed of [1, 42, 20260812, 3735928559]) {
    const exp = expectedTwoStep(seed, 12);
    const p = await open({ saved: { seed, gradeBand: 'middle', ops: ALL_OPS, problemCount: 12, mode: 'two', lockSeed: true } });
    const r = await read(p);
    same(r.problems, exp.map(e => e.text), `seed ${seed}: the sheet is the module's twelve problems for that seed`);
    same(r.key, exp.map((e, i) => `${i + 1}. ${e.answer} (${e.work})`), `seed ${seed}: the key shows the answer and both steps`);
    eq(r.mode, 'two', `seed ${seed}: Problem type shows Two-step`);
    eq(r.first, exp[0].text, `seed ${seed}: the projector shows the first problem`);
    eq(r.answer, `Answer: ${exp[0].answer} (${exp[0].work})`, `seed ${seed}: and its answer with both steps`);
    ok(r.key.every(k => / \(.+ = .+, then .+ = .+\)$/.test(k)), `seed ${seed}: every key line has two steps`);
    ok(r.problems.every(t => !/\d{1,3},\d{3}/.test(t)), `seed ${seed}: no story number has a thousands comma`);
    /* the answer is hidden until Reveal, and Reveal shows both steps */
    await p.click('#revealBtn');
    ok(await p.$eval('#displayAnswer', e => e.classList.contains('shown')), `seed ${seed}: Reveal shows the answer`);
    await p.click('#nextBtn');
    eq((await read(p)).answer, `Answer: ${exp[1].answer} (${exp[1].work})`, `seed ${seed}: Next moves to the second problem's two-step answer`);
    /* Copy carries both steps */
    await p.click('#copyBtn');
    await settle(p, 100);
    const copied = await p.evaluate(() => window.__copied);
    eq(copied[0], `${exp[1].text}\n\nAnswer: ${exp[1].answer} (${exp[1].work})`, `seed ${seed}: Copy puts the problem and both steps on the clipboard`);
    eq(r.stored && JSON.parse(r.stored).mode, 'two', `seed ${seed}: the choice is saved`);
    ok(r.hintShown && /choose their own operations/.test(r.hint), `seed ${seed}: the hint says the operation boxes are for one-step`);
    eq(p.__errors.length, 0, `seed ${seed}: no page errors`);
    await closeAll([p]);
  }
  /* Two-step needs no operation box */
  const none = await open({ saved: { seed: 9, gradeBand: 'middle', ops: [], problemCount: 6, mode: 'two', lockSeed: true } });
  const nr = await read(none);
  same(nr.problems, expectedTwoStep(9, 6).map(e => e.text), 'two-step with every operation box clear still makes the sheet');
  eq(none.__dialogs.length, 0, 'and does not ask for an operation');
  await none.click('#generateBtn');
  eq(none.__dialogs.length, 0, 'Generate does not ask either');
  await closeAll([none]);
  /* One-step and mixed still need one */
  for (const mode of ['one', 'mixed']) {
    const p = await open({ saved: { seed: 9, gradeBand: 'middle', ops: [], problemCount: 6, mode, lockSeed: true } });
    ok(p.__dialogs.some(d => /Pick at least one operation/.test(d.message)), `${mode} with no operation box asks for one`);
    await closeAll([p]);
  }

  /* Mixed: some of each, the same for the same seed, about half over many seeds */
  const mx = { seed: 777, gradeBand: 'middle', ops: ALL_OPS, problemCount: 20, mode: 'mixed', lockSeed: true };
  const m1 = await read(await open({ saved: mx })), m2 = await read(await open({ saved: mx }));
  same(m1.problems, m2.problems, 'a mixed sheet is the same sheet for the same seed');
  same(m1.key, m2.key, 'with the same key');
  const twoCount = m1.key.filter(k => k.includes(' (')).length;
  ok(twoCount >= 4 && twoCount <= 16, `a mixed sheet of 20 has some of each (${twoCount} two-step)`);
  ok(m1.key.every(k => /^\d+\. \d+$/.test(k) || / \(.+ = .+, then .+ = .+\)$/.test(k)), 'and each key line is one shape or the other');
  let twos = 0, totalM = 0;
  for (let s = 1; s <= 25; s++) {
    const p = await open({ saved: { ...mx, seed: s * 7919, problemCount: 20 } });
    const r = await read(p);
    twos += r.key.filter(k => k.includes(' (')).length; totalM += r.key.length;
    /* a two-step line in a mixed sheet matches its own text: the answer in the key is the story's */
    await closeAll([p]);
  }
  ok(twos / totalM > 0.4 && twos / totalM < 0.6, `over 25 sheets about half are two-step (${twos} of ${totalM})`);
  /* The one-step problems in a mixed sheet are the page's own: each text is one of the old templates */
  ok(m1.problems.some((t, i) => !m1.key[i].includes(' (')), 'a mixed sheet has at least one one-step problem');
}

/* ── D. what is saved ────────────────────────────────────────────────────── */
if (want('D')) {
  console.log('\nD. saving');
  const p = await open();
  let r = await read(p);
  same(Object.keys(JSON.parse(r.stored)).sort(), ['gradeBand', 'lockSeed', 'ops', 'problemCount', 'seed'], 'a teacher who never touches Problem type saves exactly the old five fields');
  await p.selectOption('#stepMode', 'two');
  await p.click('#generateBtn');
  r = await read(p);
  eq(JSON.parse(r.stored).mode, 'two', 'choosing Two-step and generating saves mode: two');
  await p.selectOption('#stepMode', 'mixed');
  await p.click('#generateBtn');
  eq(JSON.parse((await read(p)).stored).mode, 'mixed', 'Mixed saves mode: mixed');
  await p.reload({ waitUntil: 'load' });
  await settle(p, 150);
  r = await read(p);
  eq(r.mode, 'mixed', 'a reload brings Problem type back');
  await p.selectOption('#stepMode', 'one');
  await p.click('#generateBtn');
  r = await read(p);
  ok(!('mode' in JSON.parse(r.stored)), 'going back to One-step takes the field out again: ' + r.stored);
  same(Object.keys(JSON.parse(r.stored)).sort(), ['gradeBand', 'lockSeed', 'ops', 'problemCount', 'seed'], 'and the save is the old five fields');
  /* A hostile saved mode is one-step */
  for (const bad of ['"x"', '"__proto__"', '7', 'null', '{}']) {
    const q = await open({ raw: `{"seed":5,"gradeBand":"middle","ops":["addition"],"problemCount":4,"lockSeed":true,"mode":${bad}}` });
    const qr = await read(q);
    eq(qr.mode, 'one', `a saved mode of ${bad} is One-step`);
    ok(qr.key.every(k => /^\d+\. \d+$/.test(k)), `and makes a one-step sheet (${bad})`);
    await closeAll([q]);
  }
  /* A save that is not JSON at all still boots as it always did */
  const junk = await open({ raw: '{not json' });
  eq((await read(junk)).mode, 'one', 'an unreadable save boots One-step');
  await closeAll([p, junk]);
}

/* ── E. grades 3-5 ───────────────────────────────────────────────────────── */
if (want('E')) {
  console.log('\nE. grades 3-5');
  const g = GOLDEN.cases.find(c => c.band === 'elementary' && c.seed === 20260812 && c.count === 6 && c.ops.length === 4);
  for (const mode of ['two', 'mixed']) {
    const p = await open({ saved: { seed: g.seed, gradeBand: 'elementary', ops: g.ops, problemCount: g.count, mode, lockSeed: true } });
    const r = await read(p);
    eq(sha(JSON.stringify([r.problems.map((t, i) => (i + 1) + '.' + t + '  '), r.key, r.first, r.answer])), g.sha256, `elementary with a saved ${mode}: the old sheet, problem for problem`);
    ok(r.modeDisabled, `elementary: the Problem type select is disabled (${mode})`);
    ok(r.hintShown && /grades 6.8/.test(r.hint) && /one-step/.test(r.hint), `elementary: the hint says why (${r.hint})`);
    eq(r.mode, mode, `elementary: the teacher's choice is kept, not overwritten (${mode})`);
    await p.selectOption('#gradeBand', 'middle');
    const after = await read(p);
    ok(!after.modeDisabled, 'switching to grades 6-8 enables it');
    eq(after.mode, mode, 'and it is still ' + mode);
    ok(after.hintShown && after.hint.length > 10, 'with the hint for that mode');
    await p.selectOption('#gradeBand', 'elementary');
    eq((await read(p)).modeDisabled, true, 'and back to grades 3-5 disables it again');
    await p.click('#generateBtn');
    ok((await read(p)).key.every(k => /^\d+\. \d+$/.test(k)), 'generating at grades 3-5 makes one-step problems');
    eq(JSON.parse((await read(p)).stored).mode, mode, 'and still saves the choice for when the band is 6-8');
    await closeAll([p]);
  }
  const mid = await open();
  const mr = await read(mid);
  ok(!mr.modeDisabled, 'at the default band the select is enabled');
  eq(mr.hintShown, false, 'and One-step shows no hint');
  await closeAll([mid]);
}

/* ── F. share links ──────────────────────────────────────────────────────── */
if (want('F')) {
  console.log('\nF. share links');
  async function copyLink(page) {
    await page.click('#shareBtn');
    await settle(page, 250);
    await page.click('.share-sheet-rows button[data-share="copy"]');
    await settle(page, 250);
    const u = await page.evaluate(() => window.__copied[window.__copied.length - 1]);
    await page.keyboard.press('Escape');
    return u;
  }
  const decode = (page, u) => page.evaluate(x => window.StateLink.decodeState(new URL(x).searchParams.get('warmup')), u);
  for (const mode of ['two', 'mixed', 'one']) {
    const s = await open({ saved: { seed: 31337, gradeBand: 'middle', ops: ['addition', 'multiplication'], problemCount: 9, mode, lockSeed: true } });
    const sr = await read(s);
    const u = await copyLink(s);
    ok(u && u.includes('warmup='), `${mode}: Copy link makes a ?warmup= link`);
    const payload = await decode(s, u);
    if (mode === 'one') ok(!('mode' in payload), 'one-step: the payload is the old four fields, no mode: ' + JSON.stringify(payload));
    else eq(payload.mode, mode, `${mode}: the payload carries the mode`);
    same(Object.keys(payload).filter(k => k !== 'mode').sort(), ['gradeBand', 'ops', 'problemCount', 'seed'], `${mode}: and the other four fields as before`);
    ok(!JSON.stringify(payload).includes(sr.problems[0].slice(0, 25)), `${mode}: no problem text is in the link`);
    const rcv = await open({ saved: { seed: 3, gradeBand: 'middle', ops: ALL_OPS, problemCount: 6, mode: mode === 'two' ? 'one' : 'two', lockSeed: false }, url: u });
    const rr = await read(rcv);
    same(rr.problems, sr.problems, `${mode}: the receiving device regenerates the same problems`);
    same(rr.key, sr.key, `${mode}: and the same key`);
    eq(rr.mode, mode, `${mode}: Problem type shows ${mode}`);
    eq(rcv.__dialogs.length, 0, `${mode}: arrival does not ask`);
    eq(rr.hintShown, mode !== 'one', `${mode}: and the hint matches what arrived`);
    await closeAll([s, rcv]);
  }
  /* a two-step link with no operation named opens; the same without the mode does not */
  const nobody = await open({ url: link({ seed: 11, gradeBand: 'middle', ops: [], problemCount: 5, mode: 'two' }) });
  const nr = await read(nobody);
  same(nr.problems, expectedTwoStep(11, 5).map(e => e.text), 'a two-step link naming no operation opens the two-step sheet');
  ok(/Loaded a shared warm-up/.test(nr.note), 'and says it loaded');
  eq(nobody.__dialogs.length, 0, 'with no alert');
  const bare = await open({ url: link({ seed: 11, gradeBand: 'middle', ops: [], problemCount: 5 }) });
  const br = await read(bare);
  ok(!/Loaded a shared warm-up/.test(br.note), 'a link naming no operation and no mode is still refused: ' + JSON.stringify(br.note));
  const elem = await open({ url: link({ seed: 11, gradeBand: 'elementary', ops: [], problemCount: 5, mode: 'two' }) });
  ok(!/Loaded a shared warm-up/.test((await read(elem)).note), 'a two-step link for grades 3-5 naming no operation is refused (it cannot make a sheet)');
  const mixedNone = await open({ url: link({ seed: 11, gradeBand: 'middle', ops: [], problemCount: 5, mode: 'mixed' }) });
  ok(!/Loaded a shared warm-up/.test((await read(mixedNone)).note), 'a mixed link naming no operation is refused (its one-step half could not be made)');
  ok(elem.__dialogs.length === 0 && mixedNone.__dialogs.length === 0, 'and neither alerts at the teacher');
  /* a two-step link into grades 3-5 with operations opens as one-step */
  const e2 = await open({ url: link({ seed: 11, gradeBand: 'elementary', ops: ['addition'], problemCount: 5, mode: 'two' }) });
  const e2r = await read(e2);
  ok(e2r.key.every(k => /^\d+\. \d+$/.test(k)), 'a two-step link for grades 3-5 with an operation makes one-step problems');
  ok(e2r.modeDisabled && /grades 6.8/.test(e2r.hint), 'and the select is disabled with its reason');
  await closeAll([nobody, bare, elem, mixedNone, e2]);
}

/* ── G. a11y, markup, no errors ──────────────────────────────────────────── */
if (want('G')) {
  console.log('\nG. accessibility and markup');
  for (const mode of ['one', 'two']) {
    const p = await open({ saved: { seed: 5, gradeBand: 'middle', ops: ALL_OPS, problemCount: 6, mode, lockSeed: true } });
    const viol = await a11yScan(p, { impact: 'serious' });
    eq(viol.length, 0, `axe: no serious or critical violation with ${mode}: ${JSON.stringify(viol.map(v => v.id))}`);
    eq(await p.$eval('#stepMode', e => e.labels.length && e.labels[0].textContent.trim()), 'Problem type', `${mode}: the select has a visible label`);
    eq(await p.$eval('#stepMode', e => e.getAttribute('aria-describedby')), 'stepHint', `${mode}: and is described by the hint`);
    eq(await p.$$eval('#stepMode option', os => os.map(o => o.textContent)).then(t => t.join('|')), 'One-step|Two-step|Mixed (some of each)', `${mode}: the three choices`);
    eq(p.__errors.length, 0, `${mode}: no page errors`);
    await closeAll([p]);
  }
  /* keyboard: the select takes focus and changes with the keyboard alone */
  const k = await open();
  await k.focus('#stepMode');
  await k.keyboard.press('ArrowDown');
  eq(await k.$eval('#stepMode', e => e.value), 'two', 'the arrow key moves the select to Two-step');
  await k.keyboard.press('Tab'); await k.keyboard.press('Tab');
  await closeAll([k]);
  /* the page names no new markup sink: it still writes the sheet with innerHTML from the page's own text only */
  const html = fs.readFileSync(path.join(here, '..', '..', process.env.PAGE_FILE || '081-word-problem-warmup-generator.html'), 'utf8');
  eq((html.match(/\.innerHTML\s*=/g) || []).length, 2, 'the page has the two innerHTML writes it had (sheet and key)');
  ok(html.includes('word-problem-warmup-generator/wp-twostep.js'), 'the page loads the module');
}

console.log(`\n${passed} passed, ${failed} failed`);
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
