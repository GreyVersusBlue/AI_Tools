// smoke-add-verb.mjs — Path 19 P3 increment 2: the "Add a verb" box on 079 and its starters from the engine.
//
//   node Tools/verb-conjugation-poster-generator/test/smoke-add-verb.mjs        (port 8618)
//
// Held here:
//   1. a verb typed into the box becomes an ordinary panel with the engine's six forms (a regular
//      -ar verb, an irregular verb in French, a reflexive, a second tense), named with its English
//      meaning when one is typed, and prints through the poster like any other panel;
//   2. a verb the pattern list does not carry is accepted, conjugated as a regular verb and marked
//      unchecked (P19-7): on the status line, on the panel in the editor, and not on the paper;
//   3. a word the pattern cannot read as a verb adds nothing and says why; an empty box says what to type;
//   4. every verb added says it is unreviewed (no language teacher has read the forms);
//   5. a form the teacher edits afterwards is kept; the panel and its mark survive a reload;
//   6. a blank poster takes the language's person labels, a poster with forms keeps its own and says so;
//   7. the box is clean under axe and the run is free of console errors.
// Words are verbs anyone can look up. NO LANGUAGE TEACHER HAS READ ANY FORM HERE. Exits 1 on failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8618;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/079-verb-conjugation-poster-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 950 });
page.on('dialog', d => d.accept());
await page.goto(URL_PAGE);
await settle(page);

const panels = () => page.evaluate(() => Array.from(document.querySelectorAll('#panelsWrap .panel-block')).map(b => ({
  name: b.querySelector('[data-panel-name]').value,
  forms: Array.from(b.querySelectorAll('[data-idx]')).map(i => i.value),
  note: (b.querySelector('.panel-unchecked') || {}).textContent || '',
})));
const status = () => page.textContent('#addVerbStatus');
async function add(lang, tense, inf, gloss = '') {
  await page.selectOption('#addVerbLang', lang);
  await page.selectOption('#addVerbTense', tense);
  await page.fill('#addVerbInf', inf);
  await page.fill('#addVerbGloss', gloss);
  await page.click('#addVerbBtn');
}
const printed = async () => {
  await page.evaluate(() => { window.print = function () {}; });
  await page.click('#printBtn');
  await settle(page);
  return page.evaluate(() => document.getElementById('printArea').innerText);
};

// -- 6 first: a blank poster takes the language's persons
await page.selectOption('#templateSelect', 'blank');
await page.click('#loadTemplateBtn');
await settle(page);
await add('fr', 'present', 'aller', 'to go');
eq((await panels()).slice(1), [{ name: 'aller (to go)', forms: ['vais', 'vas', 'va', 'allons', 'allez', 'vont'], note: '' }], 'aller: the engine\'s irregular present, named with its meaning');
eq(await page.$$eval('#personsWrap input', is => is.map(i => i.value)), ['je', 'tu', 'il / elle / on', 'nous', 'vous', 'ils / elles'], 'a blank poster takes French person labels');
ok(/unreviewed/i.test(await status()), 'the status line says unreviewed');
ok(!/unchecked/.test(await status()), 'aller is on the pattern list: not marked unchecked');
eq(await page.inputValue('#addVerbInf'), '', 'the box clears after an add');

// -- 1: more verbs
await page.selectOption('#templateSelect', 'es_present');
await page.click('#loadTemplateBtn');
await settle(page);
const before = (await panels()).length;
await add('es', 'present', 'bailar', 'to dance');
await add('es', 'preterite', 'tener', 'to have');
await add('es', 'present', 'lavarse', 'to wash oneself');
const ps = await panels();
eq(ps.length, before + 3, 'three panels added');
eq(ps[before].forms, ['bailo', 'bailas', 'baila', 'bailamos', 'bailáis', 'bailan'], 'bailar, present');
eq(ps[before + 1].forms, ['tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvisteis', 'tuvieron'], 'tener, preterite');
eq(ps[before + 2].forms, ['me lavo', 'te lavas', 'se lava', 'nos lavamos', 'os laváis', 'se lavan'], 'lavarse, a reflexive');
ok(/vosotros/.test(await page.$eval('#personsWrap', e => Array.from(e.querySelectorAll('input')).map(i => i.value).join(' '))), 'vosotros is shown (P19-1)');
const sheet = await printed();
ok(/bailo/.test(sheet) && /bailar \(to dance\)/.test(sheet), 'the new panel prints');
ok(!/unchecked|unreviewed/i.test(sheet), 'nothing about checking is printed on the paper');

// -- 6b: a poster with forms keeps its persons and says so
await add('fr', 'present', 'danser');
ok(/person column still reads as before/.test(await status()), 'a French verb on a Spanish poster says the person column is unchanged');

// -- 2: an unknown verb is accepted, unchecked
const n0 = (await panels()).length;
await add('es', 'present', 'googlear', 'to google');
const ps2 = await panels();
eq(ps2.length, n0 + 1, 'an unlisted verb is accepted');
eq(ps2[n0].forms, ['googleo', 'googleas', 'googlea', 'googleamos', 'googleáis', 'googlean'], 'googlear is conjugated as a regular verb');
ok(/unchecked/.test(await status()), 'the status line says unchecked');
ok(/Unchecked/.test(ps2[n0].note), 'the panel in the editor carries the mark');
eq(ps2.filter(p => p.note).length, 1, 'only that panel carries it');
ok(!/unchecked/i.test(await printed()), 'the mark is not printed');

// -- 5: edit, reload
await page.fill(`#panelsWrap .panel-block:nth-of-type(${n0 + 1}) [data-idx="0"]`, 'googleo!');
await page.reload();
await settle(page);
const ps3 = await panels();
eq(ps3[n0].forms[0], 'googleo!', 'an edited form is kept across a reload');
ok(/Unchecked/.test(ps3[n0].note), 'and so is the mark');

// -- German and Italian (increment 3)
const nGi = (await panels()).length;
await add('de', 'perfect', 'aufmachen', 'to open');
await add('it', 'passato-prossimo', 'andare', 'to go');
await add('it', 'present', 'cercare');
await add('la', 'perfect', 'regere');
await add('de', 'present', 'basteln');
const psGi = await panels();
eq(psGi.slice(nGi).map(p => p.forms), [
  ['habe aufgemacht', 'hast aufgemacht', 'hat aufgemacht', 'haben aufgemacht', 'habt aufgemacht', 'haben aufgemacht'],
  ['sono andato', 'sei andato', 'è andato', 'siamo andati', 'siete andati', 'sono andati'],
  ['cerco', 'cerchi', 'cerca', 'cerchiamo', 'cercate', 'cercano'],
  ['rēxī', 'rēxistī', 'rēxit', 'rēximus', 'rēxistis', 'rēxērunt'],
  ['bastle', 'bastelst', 'bastelt', 'basteln', 'bastelt', 'basteln']
], 'German, Italian and Latin panels come from the engine');
eq(psGi.slice(nGi).map(p => p.note !== ''), [false, false, false, false, true], 'only the unlisted German verb is marked unchecked');
ok(/unchecked/.test(await status()), 'and the status line says so');
await add('de', 'present', 'ich wasche');
ok(/does not look like a German infinitive/.test(await status()), 'a phrase typed as a German infinitive is refused with the reason');
eq((await panels()).length, nGi + 5, 'and adds no panel');
// a reflexive German verb is a verb now (Path 19 P3, reflexives): the pronoun follows the verb
await add('de', 'present', 'sich waschen');
eq((await panels()).slice(nGi + 5).map(p => p.forms), [['wasche mich', 'wäschst dich', 'wäscht sich', 'waschen uns', 'wascht euch', 'waschen sich']], 'a reflexive German verb is added with its pronouns');

// -- 3: refusals
const n1 = (await panels()).length;
await add('es', 'present', 'xyz');
eq((await panels()).length, n1, 'a non-verb adds nothing');
ok(/does not look like a Spanish infinitive/.test(await status()), 'and says why');
await add('es', 'present', '   ');
eq((await panels()).length, n1, 'an empty box adds nothing');
ok(/Type an infinitive/.test(await status()), 'and says what to type');

// -- Enter in the box adds
await page.fill('#addVerbInf', 'cantar');
await page.press('#addVerbInf', 'Enter');
eq((await panels()).length, n1 + 1, 'Enter in the infinitive box adds the verb');

// -- 7
const scan = await a11yScan(page, { impact: 'serious' });
eq(scan.length ? scan : [], [], 'axe finds nothing serious');
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing left the site');

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
