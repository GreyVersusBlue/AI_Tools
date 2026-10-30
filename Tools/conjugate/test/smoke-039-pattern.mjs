// smoke-039-pattern.mjs — Path 19 P3 step 3: 039 Vocab & Conjugation Drill conjugates from the engine.
//
//   node Tools/conjugate/test/smoke-039-pattern.mjs        (port 8617)
//
// Held here:
//   1. an entry has a language and a tense select beside its free-text tense label (P19-6: the label
//      stays and stays editable); "Fill from pattern" writes the six rows through personSlots, so a set
//      whose rows were cut to five lands each form in the right row;
//   2. a cell the pattern did not make carries a tag with a title that says which rule (irr / stem /
//      spell / edit), and the irregular box is set when a cell is irregular;
//   3. every generated table says it is unreviewed, on the page and on the answer key, and the blank
//      student sheet carries nothing of it;
//   4. a cell the teacher edits afterwards is kept (entry.verb, and on the word when the infinitive is a
//      word of the set's list), survives a reload and a Fill, is in the share link, and a correction
//      stays with its own set (P19-5);
//   5. the quiz marks typed answers by the engine: ñ and ç are letters (wrong), a missing accent is
//      close, a missing pronoun is close, "u" for "ü" is accepted and the ü form is shown beside it
//      (P19-8), two accepted forms (paie / paye) both count;
//   6. an unknown verb is conjugated as regular and marked unchecked (P19-7);
//   7. nothing the page did before moved: a set with no language shows no tags and quizzes as before;
//   8. the editor and the quiz are clean under axe;
//   9. German and Italian (increment 3): the preset picks the language, a separable verb and an essere
//      verb fill their rows, and the quiz calls ss for ß close.
// Every word is a verb anyone can look up. NO LANGUAGE TEACHER HAS READ ANY FORM HERE. Exits 1 on failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8617;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_039 = BASE + '/Tools/039-vocab-conjugation-drill.html';
const HUB = 'gvb-word-lists';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const PERSONS6 = ['yo', 'tú', 'él / ella / usted', 'nosotros', 'vosotros', 'ellos / ellas / ustedes'];
const set = (name, extra = {}) => JSON.stringify({ name, mode: 'conjugation', vocabText: 'tener: to have\nhablar: to speak', persons: PERSONS6, conjugations: [], ...extra });
const SEED = {
  'gvb-vocab-conj:list': JSON.stringify(['Pattern set', 'Five rows', 'Plain set']),
  'gvb-vocab-conj:data:Pattern set': set('Pattern set', { langPreset: 'spanish' }),
  'gvb-vocab-conj:data:Five rows': set('Five rows', { persons: ['yo', 'tú', 'él', 'nosotros', 'ellos'], personSlots: [0, 1, 2, 3, 5] }),
  'gvb-vocab-conj:data:Plain set': set('Plain set', { conjugations: [{ id: 'c1', infinitive: 'hablar', tense: 'Present', irregular: false, forms: ['hablo', 'hablas', 'habla', 'hablamos', 'habláis', 'hablan'] }] }),
  'gvb-vocab-conj:current': 'Pattern set',
};

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1300, height: 1100 });
page.on('dialog', d => d.accept());
await page.addInitScript(({ storage }) => {
  if (!sessionStorage.getItem('__seeded')) {
    sessionStorage.setItem('__seeded', '1');
    for (const k of Object.keys(storage)) localStorage.setItem(k, storage[k]);
  }
}, { storage: SEED });
await page.goto(URL_039, { waitUntil: 'networkidle' });
await settle(page, 300);
const stored = (name) => page.evaluate(n => JSON.parse(localStorage.getItem('gvb-vocab-conj:data:' + n)), name);
const hub = () => page.evaluate(k => { const v = localStorage.getItem(k); return v ? JSON.parse(v).data : null; }, HUB);
const forms = () => page.$$eval('.conj-entry:first-of-type .forms-grid input', els => els.map(e => e.value));
const tags = () => page.$$eval('.conj-entry:first-of-type .rule-tag', els => els.map(e => [e.textContent, e.title, getComputedStyle(e).display === 'none']));
const status = () => page.$eval('.conj-entry:first-of-type .pattern-status', e => e.textContent);

/* ── 1. fill ─────────────────────────────────────────────────────────── */
console.log('039 — fill from pattern');
ok(await page.evaluate(() => typeof Conjugate === 'object' && Conjugate.languages().map(l => l.id).join() === 'es,de,it,la,fr'), 'the engine and all five packs are loaded, in Devon\'s order');
await page.click('#addConjBtn'); await settle(page, 100);
eq(await page.$eval('.conj-entry .pattern-row select', s => s.value), 'es', 'a new entry takes the language of the set\'s preset');
ok(await page.isDisabled('.conj-entry .pattern-row button'), 'Fill is disabled until there is an infinitive and a tense');
await page.fill('.conj-entry input[placeholder^="Infinitive"]', 'tener');
await page.selectOption('.conj-entry .pattern-row select:nth-of-type(2)', 'present');
eq(await page.inputValue('.conj-entry input[placeholder^="Tense"]'), 'Present', 'choosing a tense names a blank label (the label stays editable)');
await page.fill('.conj-entry input[placeholder^="Tense"]', 'Presente (mine)');
ok(!(await page.isDisabled('.conj-entry .pattern-row button')), 'Fill is ready');
await page.click('.conj-entry .pattern-row button'); await settle(page, 150);
eq(await forms(), ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'], 'Fill writes the six rows');
eq(await page.inputValue('.conj-entry input[placeholder^="Tense"]'), 'Presente (mine)', 'a label the teacher typed is not replaced');
eq(await page.isChecked('.conj-entry .irregular-toggle input'), true, 'the irregular box is set when a cell is irregular');

/* ── 2. tags ─────────────────────────────────────────────────────────── */
console.log('039 — the rule behind a cell is marked');
const t1 = await tags();
eq(t1.map(t => t[0]), ['irr', 'stem', 'stem', '', '', 'stem'], 'tengo is irregular, tienes tiene tienen are the boot, the rest are regular');
ok(/Irregular form \(tener\)/.test(t1[0][1]) && /Stem change \(e>ie\)/.test(t1[1][1]), 'a tag\'s title says which rule');
ok(t1[3][2] && t1[4][2], 'a regular cell has no tag');

/* ── 3. unreviewed ───────────────────────────────────────────────────── */
console.log('039 — unreviewed, said everywhere a generated table shows');
ok(/Unreviewed: no language teacher has read this table yet/.test(await status()), 'the entry says it is unreviewed');
await page.click('.mode-tab[data-mode="conjugation"]').catch(() => {});
await settle(page, 100);
const keyHtml = await page.evaluate(() => { const b = [...document.querySelectorAll('#sheetNav button')].find(x => /key/i.test(x.textContent)); if (b) b.click(); return document.getElementById('previewArea').innerHTML; });
ok(/not yet checked by a language teacher/.test(keyHtml), 'the answer key says so');
const blankHtml = await page.evaluate(() => { const b = [...document.querySelectorAll('#sheetNav button')].find(x => /blank/i.test(x.textContent)); if (b) b.click(); return document.getElementById('previewArea').innerHTML; });
ok(!/language teacher/.test(blankHtml), 'the blank student sheet carries nothing of it');

/* ── 4. the teacher's cell ───────────────────────────────────────────── */
console.log('039 — a cell the teacher corrects is kept, for this set only');
await page.fill('.conj-entry:first-of-type .forms-grid .form-field:nth-child(1) input', 'tengo!');
await settle(page, 100);
let st = await stored('Pattern set');
eq(st.conjugations[0].verb.forms.present[0], 'tengo!', 'the edit is a cell of entry.verb');
eq((await tags())[0][0], 'edit', 'and the cell is tagged as the teacher\'s');
let h = await hub();
eq(h.lists.find(l => l.name === 'Pattern set').words.find(w => w.term === 'tener').verb.forms.present[0], 'tengo!', 'tener is a word of the set\'s list, so the correction is on the word too');
await page.fill('.conj-entry:first-of-type .forms-grid .form-field:nth-child(2) input', 'tienes?');
await settle(page, 100);
h = await hub();
const wl = h && h.lists.find(l => l.name === 'Pattern set');
eq(wl && wl.words.find(w => w.term === 'tener').verb.forms.present[1], 'tienes?', 'once tener is a word of the list, the correction is on the word');
eq(wl && wl.lang, 'es', 'and the list has its language');
await page.click('.conj-entry:first-of-type .pattern-row button'); await settle(page, 150);
eq((await forms()).slice(0, 2), ['tengo!', 'tienes?'], 'Fill again keeps the teacher\'s cells');
await page.reload({ waitUntil: 'networkidle' }); await settle(page, 300);
eq((await forms()).slice(0, 3), ['tengo!', 'tienes?', 'tiene'], 'and they survive a reload');
await page.fill('.conj-entry:first-of-type .forms-grid .form-field:nth-child(1) input', 'tengo');
await settle(page, 100);
st = await stored('Pattern set');
ok(!(st.conjugations[0].verb && st.conjugations[0].verb.forms && st.conjugations[0].verb.forms.present && st.conjugations[0].verb.forms.present[0]), 'typing the pattern\'s own form back drops the correction');
await page.fill('.conj-entry:first-of-type .forms-grid .form-field:nth-child(1) input', 'tengo!');
await settle(page, 100);
const payload = await page.evaluate(() => JSON.parse(localStorage.getItem('gvb-vocab-conj:data:Pattern set')));
eq(payload.conjugations[0].verb.forms.present[0], 'tengo!', 'the correction is part of the set, so it is part of what Share and Export carry');
await page.selectOption('#setSwitch', 'Plain set'); await settle(page, 150);
ok(!(await page.$('.conj-entry .rule-tag:not([style*="display: none"])')), 'the same verb in another set has no correction');

/* ── personSlots ─────────────────────────────────────────────────────── */
console.log('039 — a set with five rows');
await page.selectOption('#setSwitch', 'Five rows'); await settle(page, 150);
await page.click('#addConjBtn'); await settle(page, 100);
await page.fill('.conj-entry input[placeholder^="Infinitive"]', 'hablar');
await page.selectOption('.conj-entry .pattern-row select:nth-of-type(2)', 'present');
await page.click('.conj-entry .pattern-row button'); await settle(page, 150);
eq(await page.$$eval('.conj-entry .forms-grid input', els => els.map(e => e.value)), ['hablo', 'hablas', 'habla', 'hablamos', 'hablan'], 'the form for each remaining person lands in its own row (vosotros is cut, ellos stays ellos)');
await page.click('#personPresets button[data-preset="spanish"]'); await settle(page, 150);
eq((await stored('Five rows')).personSlots, [0, 1, 2, 3, 4, 5], 'a preset resets the slots');

/* ── 6. unknown verb, French, elision ────────────────────────────────── */
console.log('039 — an unknown verb, French');
await page.selectOption('#setSwitch', 'Pattern set'); await settle(page, 150);
await page.click('#personPresets button[data-preset="french"]'); await settle(page, 150);
await page.click('#addConjBtn'); await settle(page, 100);
const second = '.conj-entry:nth-of-type(2)';
await page.selectOption(second + ' .pattern-row select:nth-of-type(1)', 'fr');
await page.fill(second + ' input[placeholder^="Infinitive"]', 'blanchir');
await page.selectOption(second + ' .pattern-row select:nth-of-type(2)', 'present');
await page.click(second + ' .pattern-row button'); await settle(page, 150);
eq(await page.$$eval(second + ' .forms-grid input', els => els.map(e => e.value)), ['blanchis', 'blanchis', 'blanchit', 'blanchissons', 'blanchissez', 'blanchissent'], 'an unknown -ir verb is conjugated as finir');
ok(/not on the pattern list/.test(await page.$eval(second + ' .pattern-status', e => e.textContent)), 'and marked unchecked (P19-7)');
await page.fill(second + ' input[placeholder^="Infinitive"]', 'payer');
await page.selectOption(second + ' .pattern-row select:nth-of-type(2)', 'present');
await page.click(second + ' .pattern-row button'); await settle(page, 150);
eq((await page.$$eval(second + ' .forms-grid input', els => els.map(e => e.value)))[0], 'paie / paye', 'payer gives both (P19-4)');

/* ── 6b. German and Italian ──────────────────────────────────────────── */
console.log('039 — German and Italian');
await page.click('#personPresets button[data-preset="german"]'); await settle(page, 150);
await page.selectOption('#langPresetSelect', 'german'); await settle(page, 100);
await page.click('#addConjBtn'); await settle(page, 100);
const third = '.conj-entry:nth-of-type(3)';
eq(await page.$eval(third + ' .pattern-row select', s => s.value), 'de', 'the German language setting gives a new entry German');
await page.fill(third + ' input[placeholder^="Infinitive"]', 'aufmachen');
await page.selectOption(third + ' .pattern-row select:nth-of-type(2)', 'present');
await page.click(third + ' .pattern-row button'); await settle(page, 150);
eq(await page.$$eval(third + ' .forms-grid input', els => els.map(e => e.value)), ['mache auf', 'machst auf', 'macht auf', 'machen auf', 'macht auf', 'machen auf'], 'a separable verb puts its prefix last');
ok(/Unreviewed/.test(await page.$eval(third + ' .pattern-status', e => e.textContent)), 'and says unreviewed');
await page.fill(third + ' input[placeholder^="Infinitive"]', 'fahren');
await page.selectOption(third + ' .pattern-row select:nth-of-type(2)', 'present');
await page.click(third + ' .pattern-row button'); await settle(page, 150);
eq(await page.$$eval(third + ' .forms-grid input', els => els.map(e => e.value)), ['fahre', 'fährst', 'fährt', 'fahren', 'fahrt', 'fahren'], 'a strong verb changes its vowel at du and er');
await page.click('#personPresets button[data-preset="italian"]'); await settle(page, 150);
await page.selectOption('#langPresetSelect', 'italian'); await settle(page, 100);
await page.click('#addConjBtn'); await settle(page, 100);
const fourth = '.conj-entry:nth-of-type(4)';
eq(await page.$eval(fourth + ' .pattern-row select', s => s.value), 'it', 'the Italian language setting gives a new entry Italian');
await page.fill(fourth + ' input[placeholder^="Infinitive"]', 'andare');
await page.selectOption(fourth + ' .pattern-row select:nth-of-type(2)', 'passato-prossimo');
await page.click(fourth + ' .pattern-row button'); await settle(page, 150);
eq(await page.$$eval(fourth + ' .forms-grid input', els => els.map(e => e.value)), ['sono andato', 'sei andato', 'è andato', 'siamo andati', 'siete andati', 'sono andati'], 'an essere verb prints the masculine, plural for noi, voi, loro');
ok(await page.$$eval(fourth + ' .rule-tag', els => els.some(e => e.textContent === 'agr' && getComputedStyle(e).display !== 'none')), 'and tags the agreement');
await page.fill(fourth + ' input[placeholder^="Infinitive"]', 'finire');
await page.selectOption(fourth + ' .pattern-row select:nth-of-type(2)', 'present');
await page.click(fourth + ' .pattern-row button'); await settle(page, 150);
eq((await page.$$eval(fourth + ' .forms-grid input', els => els.map(e => e.value)))[0], 'finisco', 'finire takes -isc-');

/* ── 5. the quiz ─────────────────────────────────────────────────────── */
console.log('039 — the quiz marks by the engine');
await page.selectOption('#setSwitch', 'Plain set'); await settle(page, 150);
await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem('gvb-vocab-conj:data:Plain set'));
  st.conjugations = [{ id: 'c1', infinitive: 'cuidar', tense: 'Present', lang: 'es', tenseId: 'present', irregular: false, forms: ['cuido', 'cuidas', 'cuida', 'pingüino', 'año', 'cuidan'] }];
  localStorage.setItem('gvb-vocab-conj:data:Plain set', JSON.stringify(st));
});
await page.reload({ waitUntil: 'networkidle' }); await settle(page, 300);
await page.selectOption('#setSwitch', 'Plain set'); await settle(page, 150);
const quizBtn = await page.evaluateHandle(() => [...document.querySelectorAll('#sheetNav button')].find(b => /quiz/i.test(b.textContent)));
await quizBtn.asElement().click(); await settle(page, 150);
const answers = ['cuído', 'cuida', 'yo cuida', 'pinguino', 'ano', ''];
const inputs = await page.$$('.quiz-input');
for (let i = 0; i < inputs.length; i++) await inputs[i].fill(answers[i]);
await page.click('#quizCheckBtn'); await settle(page, 150);
const marks = await page.$$eval('.quiz-row', rows => rows.map(r => [r.className.replace('quiz-row', '').trim(), r.querySelector('.quiz-mark').textContent.trim()]));
eq(marks.map(m => m[0]), ['close', 'incorrect', 'close', 'correct', 'incorrect', 'incorrect'], 'close, wrong, close, accepted, wrong, blank');
ok(/check your accent/.test(marks[0][1]), 'a wrong accent is close, and the form is shown');
ok(/cuida/.test(marks[2][1]) && /pronoun/.test(marks[2][1]), 'a pronoun that was not asked for is close and says so');
ok(/ü/.test(marks[3][1]) && /pingüino/.test(marks[3][1]), 'u for ü is accepted with the ü form beside it (P19-8)');
ok(/año/.test(marks[4][1]), 'ñ is a letter, not an accent: ano is wrong, and año is shown');
ok(/Score: 1 \/ 6/.test(await page.$eval('.quiz-progress', e => e.textContent)), 'only the accepted answer scores');
await a11yScan(page, { impact: 'serious' }).then(r => ok(!r || (Array.isArray(r) ? r.length === 0 : !r.violations || r.violations.length === 0), 'the quiz is clean under axe')).catch(e => ok(false, 'axe: ' + e.message));

console.log('039 — the quiz in German');
await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem('gvb-vocab-conj:data:Plain set'));
  st.conjugations = [{ id: 'c1', infinitive: 'wissen', tense: 'Präsens', lang: 'de', tenseId: 'present', irregular: false, forms: ['weiß', 'weißt', 'weiß', 'wissen', 'wisst', 'wissen'] }];
  localStorage.setItem('gvb-vocab-conj:data:Plain set', JSON.stringify(st));
});
await page.reload({ waitUntil: 'networkidle' }); await settle(page, 300);
await page.selectOption('#setSwitch', 'Plain set'); await settle(page, 150);
const quizBtn2 = await page.evaluateHandle(() => [...document.querySelectorAll('#sheetNav button')].find(b => /quiz/i.test(b.textContent)));
await quizBtn2.asElement().click(); await settle(page, 150);
const answersDe = ['weiss', 'weisst', 'ich weiß', 'wissen', 'wißt', ''];
const inputsDe = await page.$$('.quiz-input');
for (let i = 0; i < inputsDe.length; i++) await inputsDe[i].fill(answersDe[i]);
await page.click('#quizCheckBtn'); await settle(page, 150);
const marksDe = await page.$$eval('.quiz-row', rows => rows.map(r => [r.className.replace('quiz-row', '').trim(), r.querySelector('.quiz-mark').textContent.trim()]));
eq(marksDe.map(m => m[0]), ['close', 'close', 'close', 'correct', 'incorrect', 'incorrect'], 'ss for ß is close, a missing pronoun is close, ß for ss is wrong');
ok(/ß/.test(marksDe[0][1]) && /weiß/.test(marksDe[0][1]), 'and the ß form is shown');

/* ── 7. the old page ─────────────────────────────────────────────────── */
console.log('039 — a set with no language is as it was');
await page.reload({ waitUntil: 'networkidle' }); await settle(page, 300);
await page.selectOption('#setSwitch', 'Plain set'); await settle(page, 150);
const plainHtml = await page.evaluate(() => { const b = [...document.querySelectorAll('.mode-tab')].find(x => x.dataset.mode === 'conjugation'); b.click(); return document.getElementById('conjList').innerHTML; });
ok(plainHtml.includes('pattern-row'), 'the select row is there for every entry');
await a11yScan(page, { impact: 'serious' }).then(r => ok(!r || (Array.isArray(r) ? r.length === 0 : !r.violations || r.violations.length === 0), 'the editor is clean under axe')).catch(e => ok(false, 'axe: ' + e.message));

/* ── 8. tenses beyond the six are offered ─────────────────────────────── */
console.log('039 — the tense menu offers the extra tenses, after the six');
await page.click('#addConjBtn'); await settle(page, 100);
const last = '.conj-entry:last-of-type';
await page.selectOption(last + ' .pattern-row select:nth-of-type(1)', 'es'); await settle(page, 100);
const tenseOpts = await page.$$eval(last + ' .pattern-row select:nth-of-type(2) option', os => os.map(o => o.value));
eq(tenseOpts, ['', 'present', 'preterite', 'imperfect', 'future', 'conditional', 'subjunctive', 'present-perfect', 'imperfect-subjunctive', 'command'], 'Spanish: the six, then the present perfect, the -ra subjunctive and the command');
await page.fill(last + ' input[placeholder^="Infinitive"]', 'hablar');
await page.selectOption(last + ' .pattern-row select:nth-of-type(2)', 'command');
await page.click(last + ' .pattern-row button'); await settle(page, 150);
const cmd = await page.$$eval(last + ' .forms-grid input', els => els.map(e => e.value));
eq(cmd.slice(0, 6), ['', 'habla', 'hable', 'hablemos', 'hablad', 'hablen'], 'Fill writes a command, with the first person singular row left empty');
eq(await page.inputValue(last + ' input[placeholder^="Tense"]'), 'Command (affirmative)', 'and names the tense label');
await page.selectOption(last + ' .pattern-row select:nth-of-type(1)', 'de'); await settle(page, 100);
ok((await page.$$eval(last + ' .pattern-row select:nth-of-type(2) option', os => os.map(o => o.value))).includes('imperative'), 'German offers the imperative');

await browser.close(); server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
