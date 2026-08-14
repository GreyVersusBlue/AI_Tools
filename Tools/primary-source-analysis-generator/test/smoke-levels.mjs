// smoke-levels.mjs — differentiation levels, the source library, and callouts.
//
//   node Tools/primary-source-analysis-generator/test/smoke-levels.mjs
//
// This tool is the reference implementation of the site-wide three-level
// switch (Academic / Honors / Honors GT), so the things this suite holds down
// are the things other tools copy:
//
//   Honors is the untouched baseline — at the default level the printed
//   worksheet carries no starters, no level tag, no "go further" prompt and
//   no synthesis block, exactly as it printed before this round.
//
//   Academic adds scaffolding around the SAME questions: multi-part questions
//   split into lettered steps, a sentence starter derived from each question,
//   and hard words from the teacher's own source glossed in plain language.
//
//   Honors GT adds extension: an open-ended prompt per step, a closing
//   synthesis question, and less pre-lined answer space.
//
//   "Print all three levels" produces three class sets in one flow, each
//   tagged with its level top and bottom so the piles can be sorted, and it
//   works for the answer key as well as the student worksheet.
//
//   The share link carries the level, and a round-1-format link that predates
//   the field still imports and lands on the Honors baseline.
//
//   The source library round-trips a tagged source into a fresh worksheet,
//   and annotation callouts mark the source text and print their questions.
//
// Exits 1 on any failure. All source text here is written for this test —
// not a reproduction of any copyrighted or verbatim historical document.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8131;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/028-primary-source-analysis-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
// Arrays cross the page boundary as fresh objects, so === never holds.
const eqList = (a, b, label) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

console.log('Primary Source Analysis — differentiation levels, source library, callouts');

const page = await prepPage(browser, BASE, { width: 1360, height: 1100 });
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);
await page.evaluate(() => { window.print = function () {}; });

// A source paragraph written for this test. It deliberately contains words
// that the built-in plain-language glossary knows (boycott, tariff, petition)
// so the Academic "Words to know" box has something real to gloss.
const SOURCE_TEXT = [
  'We the merchants of this town have agreed together to refuse the new tariff.',
  'Our boycott of British goods will hold until the tax is repealed.',
  'We have sent a petition to Parliament stating our grievance plainly.',
  'We ask every household to stand with us until an answer arrives.'
].join('\n');

await page.fill('#sourceTitle', 'Merchants’ agreement (test source)');
await page.fill('#sourceText', SOURCE_TEXT);
await settle(page, 150);

/* Print the blank worksheet (or key) and report what the print DOM holds. */
async function printed(mode = 'blank') {
  await page.click(mode === 'key' ? '#printKeyBtn' : '#printBlankBtn');
  await settle(page, 150);
  return page.evaluate(() => {
    const root = document.getElementById('printArea');
    const firstStep = root.querySelector('.step-block');
    return {
      sheets: root.querySelectorAll('.sheet').length,
      levelTags: Array.from(root.querySelectorAll('.level-tag')).map(e => e.textContent.trim()),
      levelFooters: Array.from(root.querySelectorAll('.level-footer')).map(e => e.textContent.trim()),
      levelNotes: Array.from(root.querySelectorAll('.level-note')).map(e => e.textContent.trim()),
      starterLines: root.querySelectorAll('.starter-line').length,
      qParts: Array.from(root.querySelectorAll('.q-part')).map(e => e.textContent.trim()),
      gtOpen: Array.from(root.querySelectorAll('.step-q.gt-open')).map(e => e.textContent.trim()),
      synthesis: root.querySelectorAll('.synthesis-block').length,
      wordsBox: root.querySelectorAll('.words-box').length,
      wordsItems: Array.from(root.querySelectorAll('.words-box li')).map(e => e.textContent.trim()),
      calloutMarks: Array.from(root.querySelectorAll('.callout-mark')).map(e => e.textContent.trim()),
      calloutItems: Array.from(root.querySelectorAll('.callout-item')).map(e => e.textContent.trim()),
      firstStepLines: firstStep ? firstStep.querySelectorAll('.answer-line').length : -1,
      stepQs: Array.from(root.querySelectorAll('.step-q')).map(e => e.textContent.trim()),
      text: root.textContent
    };
  });
}

/* ── 1. Honors is the baseline: none of the new markup appears ─────────── */
eq(await page.inputValue('#levelSelect'), 'honors', 'the level selector defaults to Honors');

const honors = await printed('blank');
eq(honors.sheets, 1, 'a single-level print produces one sheet');
eq(honors.starterLines, 0, 'Honors prints no sentence starters');
eq(honors.qParts.length, 0, 'Honors does not chunk questions into lettered parts');
eq(honors.gtOpen.length, 0, 'Honors prints no "go further" prompts');
eq(honors.synthesis, 0, 'Honors prints no synthesis block');
eq(honors.wordsBox, 0, 'Honors prints no auto-glossary box');
eq(honors.levelTags.length, 0, 'a plain Honors worksheet carries no level tag — byte-for-byte what it always printed');
eq(honors.levelFooters.length, 0, 'and no level footer either');
const honorsLines = honors.firstStepLines;
ok(honorsLines >= 4, `Honors keeps the full ruled answer space (${honorsLines} lines)`);

/* ── 2. Academic: same questions, chunked, with starters and a gloss ───── */
await page.selectOption('#levelSelect', 'academic');
await settle(page, 150);
const academic = await printed('blank');

eqList(academic.levelTags, ['Academic'], 'an Academic print is tagged with its level');
eq(academic.levelFooters.length, 1, 'and carries a level footer at the end of the set');
ok(academic.starterLines > 0, `Academic prints sentence starters (${academic.starterLines} lines)`);
ok(academic.qParts.length > 0, `Academic chunks questions into lettered parts (${academic.qParts.length} parts)`);
ok(academic.qParts[0].startsWith('a.'), 'the first part is lettered a.');
ok(academic.qParts.some(p => p.startsWith('b.')), 'and there is at least a second lettered part');

// The default OPTIC "Overview" step is an instruction sentence followed by a
// question — exactly the multi-part prompt the spec asks to be chunked.
ok(academic.qParts.some(p => /Look at the entire image/.test(p)), 'the instruction half of a multi-part prompt gets its own step');
ok(academic.qParts.some(p => /What is the overall scene or setting\?$/.test(p)), 'and the question half gets its own step');

// The starter is built out of the question's own words, not a canned phrase.
ok(/The overall scene or setting is/.test(academic.text),
  'the starter is derived from the question itself ("The overall scene or setting is ___")');
ok(/I can tell because/.test(academic.text), 'and gives a because-stem for the evidence half');

// Only the "What is the <noun phrase>?" shape is safe to reassemble into a
// declarative stem. Reassembling "What does it reveal about…?" produced
// "It reveal about…" — broken grammar on a printed student worksheet.
ok(!/It reveal about/.test(academic.text), 'a question that cannot be reassembled grammatically falls back to a generic stem');
ok(!/\bIt (?:reveal|want|suggest)\b/.test(academic.text), 'no starter prints an ungrammatical verb form');

// An imperative task is something a student answers, so it gets a starter too.
ok(academic.qParts.some(p => /^b\. Identify two or three/.test(p)), 'an imperative task is its own lettered part');
ok(/One is/.test(academic.text) && /Another is/.test(academic.text),
  'and gets a list-shaped starter rather than being left bare');
ok(academic.qParts.some(p => /Now zoom in\.$/.test(p)), 'a bare instruction still gets its own part');

// Academic never drops or lowers a question.
const honorsQuestionText = honors.stepQs.join(' ');
ok(/overall scene or setting/.test(honorsQuestionText) && academic.qParts.some(p => /overall scene or setting/.test(p)),
  'no question is removed at Academic — the same prompts are present, just chunked');

eq(academic.wordsBox, 1, 'Academic glosses hard words from the teacher’s own source');
ok(academic.wordsItems.some(w => /boycott/i.test(w)), 'the gloss picks up "boycott" from the source text');
ok(academic.wordsItems.some(w => /tariff/i.test(w)), 'and "tariff"');
ok(academic.wordsItems.every(w => /—|-/.test(w)), 'every glossed word carries a plain-language definition');
ok(academic.wordsItems.some(w => /^repeal —/.test(w)) && !academic.wordsItems.some(w => /^repealed/.test(w)),
  'an inflected match ("repealed") is glossed under its dictionary headword');
ok(academic.wordsItems.some(w => /^Parliament —/.test(w)), 'but a proper noun keeps the capital the source used');
ok(!/rewrote|simplified version of the source/i.test(academic.text),
  'the source text itself is never rewritten — scaffolds frame it, they do not replace it');

/* A word the teacher already glossed themselves is not repeated by the tool. */
await page.fill('#vocabSupport', 'boycott: refusing to buy something as a protest');
await settle(page, 150);
const academicWithVocab = await printed('blank');
ok(!academicWithVocab.wordsItems.some(w => /^boycott/i.test(w)),
  'a word the teacher already defined is left out of the auto-gloss instead of duplicated');
await page.fill('#vocabSupport', '');
await settle(page, 120);

/* ── 3. Honors GT: extension prompts, synthesis, less ruled space ──────── */
await page.selectOption('#levelSelect', 'honorsgt');
await settle(page, 150);
const gt = await printed('blank');

eqList(gt.levelTags, ['Honors GT'], 'an Honors GT print is tagged with its level');
eq(gt.starterLines, 0, 'Honors GT prints no sentence starters');
eq(gt.qParts.length, 0, 'and does not chunk questions');
ok(gt.gtOpen.length >= 5, `every OPTIC step gets an open-ended extension prompt (${gt.gtOpen.length})`);
ok(gt.gtOpen.every(t => /^Go further:/.test(t)), 'each extension is labelled "Go further:"');
ok(gt.gtOpen.some(t => /deliberately left out/.test(t)), 'the extension is written for that specific step, not a generic filler');
eq(gt.synthesis, 1, 'Honors GT closes with a synthesis block');
ok(/So what\? Why does this source matter beyond its moment\?/.test(gt.text), 'carrying the spec’s synthesis question verbatim');
ok(gt.firstStepLines < honorsLines,
  `Honors GT leaves less pre-lined space than Honors (${gt.firstStepLines} vs ${honorsLines})`);

/* ── 4. the answer key notes the expected depth for the level in force ─── */
for (const [level, name, needle] of [
  ['academic', 'Academic', /uses the sentence starter/],
  ['honors', 'Honors', /every part of the question in full sentences/],
  ['honorsgt', 'Honors GT', /weighs perspective and reliability/]
]) {
  await page.selectOption('#levelSelect', level);
  await settle(page, 120);
  const key = await printed('key');
  eq(key.levelNotes.length, 1, `the ${name} answer key carries one expected-depth note`);
  ok(key.levelNotes[0].startsWith(name), `the ${name} key note names its level`);
  ok(needle.test(key.levelNotes[0]), `and describes what a complete ${name} answer looks like`);
}

/* the GT key prints the teacher's synthesis note */
await page.selectOption('#levelSelect', 'honorsgt');
await settle(page, 120);
await page.evaluate(() => {
  const ta = document.querySelector('#notesEditor [data-note-block="synthesis"] textarea');
  ta.value = 'Look for a link to a present-day protest or boycott, argued with evidence.';
  ta.dispatchEvent(new Event('input', { bubbles: true }));
});
await settle(page, 150);
const gtKey = await printed('key');
ok(/present-day protest or boycott/.test(gtKey.text), 'the synthesis teacher note prints on the Honors GT key');

/* ── 5. print all three levels: three tagged class sets in one flow ────── */
await page.check('#printAllLevels');
await settle(page, 200);
const allBlank = await printed('blank');
eq(allBlank.sheets, 3, 'printing all three levels produces three sets');
eqList(allBlank.levelTags, ['Academic', 'Honors', 'Honors GT'], 'each set is tagged with its level, in order');
eq(allBlank.levelFooters.length, 3, 'and each set is footer-tagged so the piles can be sorted');
ok(allBlank.levelFooters.every(f => /student worksheet/.test(f)), 'the footers say which side of the set they are');
ok(allBlank.starterLines > 0 && allBlank.gtOpen.length > 0 && allBlank.synthesis === 1,
  'the three sets really differ: starters in one, extension prompts and synthesis in another');
eq(await page.evaluate(() => document.querySelectorAll('#printArea .level-sheet-break').length), 2,
  'the second and third sets start on a fresh page');

const allKey = await printed('key');
eq(allKey.sheets, 3, 'print-all-three works for the answer key too');
eqList(allKey.levelTags, ['Academic', 'Honors', 'Honors GT'], 'with the same three level tags');
eq(allKey.levelNotes.length, 3, 'and one expected-depth note per level');
await page.uncheck('#printAllLevels');
await settle(page, 150);

/* ── 5b. the levels work in corroboration mode too, not just single-source ─ */
await page.evaluate(() => { window.confirm = () => true; });
await page.click('#loadExampleBtn');
await settle(page, 300);
eq(await page.isChecked('#corroborationEnabled'), true, 'the two-source example is loaded for the corroboration check');

await page.selectOption('#levelSelect', 'academic');
await settle(page, 200);
const corroAcademic = await printed('blank');
eq(await page.evaluate(() => document.querySelectorAll('#printArea .dual-answer-row').length > 0), true,
  'Academic keeps corroboration mode’s dual answer areas');
eq(await page.evaluate(() => document.querySelectorAll('#printArea .comparison-block').length), 1,
  'and the closing comparison block');
ok(corroAcademic.starterLines > 0, 'while still printing sentence starters on a two-source worksheet');
ok(/Where do the two sources agree\?/.test(corroAcademic.text) && corroAcademic.text.includes('I think'),
  'the comparison questions get starters at Academic as well');

await page.selectOption('#levelSelect', 'honorsgt');
await settle(page, 200);
const corroGt = await printed('key');
eq(corroGt.synthesis, 1, 'Honors GT adds its synthesis block to a corroboration answer key');
eq(corroGt.levelNotes.length, 1, 'which still carries the expected-depth note');
ok(corroGt.gtOpen.length >= 4, 'and a "go further" prompt on every framework step');

await page.check('#printAllLevels');
await settle(page, 250);
const corroAll = await printed('blank');
eq(corroAll.sheets, 3, 'print-all-three works on a two-source worksheet');
eqList(corroAll.levelTags, ['Academic', 'Honors', 'Honors GT'], 'with all three sets tagged');
eq(await page.evaluate(() => document.querySelectorAll('#printArea .comparison-block').length), 3,
  'and each set carrying its own comparison block');
await page.uncheck('#printAllLevels');
await page.selectOption('#levelSelect', 'honors');
await page.uncheck('#corroborationEnabled');
// Put the test's own source back — the example replaced it wholesale.
await page.fill('#sourceTitle', 'Merchants’ agreement (test source)');
await page.fill('#sourceText', SOURCE_TEXT);
await settle(page, 200);

/* ── 6. annotation callouts mark the source and print their questions ──── */
await page.check('#calloutsEnabled');
await settle(page, 150);
await page.click('#addCalloutBtn');
await settle(page, 120);
await page.evaluate(() => {
  const excerpts = document.querySelectorAll('#calloutList .callout-excerpt-input');
  const questions = document.querySelectorAll('#calloutList .callout-question-input');
  function setVal(el, v) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
  setVal(excerpts[0], 'refuse the new tariff');
  setVal(questions[0], 'Why refuse the tariff instead of simply complaining about it?');
  setVal(excerpts[1], 'sent a petition to Parliament');
});
await page.check('#lineNumbers');
await settle(page, 200);

await page.selectOption('#levelSelect', 'honors');
await settle(page, 120);
const withCallouts = await printed('blank');
eqList(withCallouts.calloutMarks, ['1', '2'], 'both excerpts get a numbered marker inside the source text');
eq(withCallouts.calloutItems.length, 2, 'and both print as numbered callout items');
ok(/Why refuse the tariff/.test(withCallouts.calloutItems[0]), 'the teacher’s own callout question prints');
ok(/Look closely at this line/.test(withCallouts.calloutItems[1]), 'a callout left without a question falls back to a real default');
ok(/line 1/.test(withCallouts.calloutItems[0]) && /line 3/.test(withCallouts.calloutItems[1]),
  'with line numbers on, each callout says which line to look at');

await page.uncheck('#calloutsEnabled');
await page.uncheck('#lineNumbers');
await settle(page, 150);
const noCallouts = await printed('blank');
eq(noCallouts.calloutMarks.length, 0, 'turning callouts off removes the markers again');
eq(noCallouts.calloutItems.length, 0, 'and the callout box');

/* ── 7. the source library round-trips a tagged source ─────────────────── */
await page.fill('#libraryTags', 'Unit 3, Revolution, 1770s');
await page.click('#saveSourceALibBtn');
await settle(page, 200);

const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('gvb-primary-source:library') || '[]'));
eq(stored.length, 1, 'saving Source A writes one entry to the library');
eqList(stored[0].tags, ['Unit 3', 'Revolution', '1770s'], 'the free-text tags are parsed and stored');
ok(stored[0].text.includes('boycott of British goods'), 'the saved entry carries the source text');
eq(await page.evaluate(() => document.querySelectorAll('#libraryList .lib-entry').length), 1,
  'and the library panel lists it');
eqList(await page.evaluate(() => Array.from(document.querySelectorAll('#libraryList .lib-tag')).map(e => e.textContent)),
  ['Unit 3', 'Revolution', '1770s'], 'showing its tags');

// filter by tag
const filterOptions = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#libraryFilter option')).map(o => o.value));
ok(filterOptions.includes('Revolution'), 'every tag becomes a filter option');
await page.selectOption('#libraryFilter', 'Revolution');
await settle(page, 150);
eq(await page.evaluate(() => document.querySelectorAll('#libraryList .lib-entry').length), 1,
  'filtering by a tag the source carries still shows it');
await page.selectOption('#libraryFilter', '');
await settle(page, 120);

// a brand new worksheet starts empty, then pulls the source back out of the library
await page.evaluate(() => { window.prompt = () => 'Library round trip'; });
await page.click('#newSheetBtn');
await settle(page, 250);
eq(await page.inputValue('#sourceText'), '', 'a new worksheet starts with an empty source');
eq(await page.evaluate(() => document.querySelectorAll('#libraryList .lib-entry').length), 1,
  'the library survives the worksheet switch — it is not per-worksheet data');

await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('#libraryList button'));
  buttons.find(b => b.textContent === 'Use as Source A').click();
});
await settle(page, 250);
ok((await page.inputValue('#sourceText')).includes('boycott of British goods'),
  'pulling a library source into a worksheet fills the source text');
ok((await page.inputValue('#sourceTitle')).includes('Merchants'), 'and the title');
eq(await page.inputValue('#sheetName'), 'Library round trip', 'without disturbing the worksheet it was pulled into');

/* ── 8. the share link carries the level, old links still work ─────────── */
await page.selectOption('#levelSelect', 'honorsgt');
await settle(page, 150);
const link = await page.evaluate(() => {
  let captured = null;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (t) => { captured = t; return Promise.resolve(); } }
  });
  document.getElementById('shareLinkBtn').click();
  return new Promise(r => setTimeout(() => r(captured), 60));
});
ok(typeof link === 'string' && link.includes('worksheet='), 'Copy link produces a ?worksheet= URL');

const receiver = await prepPage(browser, BASE, { width: 1360, height: 1100 });
await receiver.goto(link, { waitUntil: 'networkidle' });
await settle(receiver, 300);
eq(await receiver.inputValue('#levelSelect'), 'honorsgt', 'the level travels through the share link');
await receiver.evaluate(() => { window.print = function () {}; });
await receiver.click('#printBlankBtn');
await settle(receiver, 150);
eq(await receiver.evaluate(() => document.querySelectorAll('#printArea .synthesis-block').length), 1,
  'so the received copy prints the Honors GT synthesis block');

/* A round-1-format link: the payload predates the level field entirely.
   Tool 056 also builds 028-format links, so this must never start failing. */
const legacyLink = await receiver.evaluate(() => {
  const payload = {
    v: 1,
    name: 'Round one link',
    sourceTitle: 'An older shared worksheet',
    sourceType: 'speech',
    sourceDescription: 'A worksheet shared before the level field existed.',
    sourceText: 'The old link carries no level at all.',
    framework: 'soapstone',
    notes: { speaker: 'A note from the older format.' },
    answerLines: 4
  };
  return StateLink.buildShareUrl('worksheet', payload);
});
const legacy = await prepPage(browser, BASE, { width: 1360, height: 1100 });
await legacy.goto(legacyLink, { waitUntil: 'networkidle' });
await settle(legacy, 300);
eq(await legacy.inputValue('#sourceTitle'), 'An older shared worksheet', 'a round-1-format link still imports');
eq(await legacy.inputValue('#levelSelect'), 'honors', 'and lands on the Honors baseline it was written at');

/* An unrecognized level is normalized rather than rejected — the import
   validator has rotted twice before by being strict about a new field. */
const oddLink = await legacy.evaluate(() => StateLink.buildShareUrl('worksheet', {
  v: 1, name: 'Odd level', framework: 'optic', notes: {}, level: 'Honors GT'
}));
const odd = await prepPage(browser, BASE, { width: 1360, height: 1100 });
await odd.goto(oddLink, { waitUntil: 'networkidle' });
await settle(odd, 300);
eq(await odd.inputValue('#levelSelect'), 'honorsgt', 'a level written as its display name normalizes instead of being dropped');

/* ── 9. no console noise, nothing left the site ────────────────────────── */
for (const [name, p] of [['editor', page], ['receiver', receiver], ['legacy', legacy], ['odd', odd]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
