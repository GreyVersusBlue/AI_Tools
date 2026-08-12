// smoke-bilingual.mjs — the second-language permission slip.
//
//   node Tools/field-trip-permission-slip/test/smoke-bilingual.mjs
//
// A permission slip only works if the person signing it can read it. The slip
// now prints in a second language alongside the English one — the fixed
// furniture (headings, the permission sentence, the signature lines) ships
// translated, and the three prose fields the teacher typed are theirs to
// translate. What this suite holds down:
//
//   A blank translation falls back to the English text rather than printing a
//   gap. A half-finished translation still yields a slip a family can sign,
//   and the tool says which fields are still in English rather than letting
//   that be discovered on paper.
//
//   The student's name, the dates and the signature lines are on BOTH slips.
//   A translated slip with no signature block is decoration, not a form.
//
//   Batch printing pairs every student, and the two layouts differ in the way
//   they claim to: facing page is two separate slips, side by side is one
//   two-column pair.
//
//   English-only is untouched, and a trip saved before this existed still
//   prints exactly one slip.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8143;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/043-field-trip-permission-slip.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1050 });

/** Every slip in the live preview, as { lang, title, text }. */
const previewSlips = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('#previewArea .slip')).map(s => ({
    lang: s.getAttribute('data-slip-lang'),
    title: s.querySelector('.slip-title').textContent,
    text: s.textContent.replace(/\s+/g, ' '),
    sigLines: Array.from(s.querySelectorAll('.sig-line')).map(l => l.textContent),
  })));

/** Every slip that would actually print. */
async function printedSlips() {
  await page.evaluate(() => { window.print = function () {}; });
  await page.click('#printBtn');
  await settle(page);
  return page.evaluate(() => ({
    slips: Array.from(document.querySelectorAll('#printArea .slip')).map(s => ({
      lang: s.getAttribute('data-slip-lang'),
      student: s.querySelector('.slip-student-line') ? s.querySelector('.slip-student-line').textContent : null,
    })),
    pairs: document.querySelectorAll('#printArea .slip-pair').length,
  }));
}

console.log('Field Trip Permission Slip — bilingual printing');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await page.fill('#tripName', 'Planetarium');
await page.fill('#destination', 'Riverside Science Center');
await page.fill('#purpose', 'Students will tour the planetarium and complete a physics workshop.');
await page.fill('#whatToBring', 'Sack lunch, water bottle, closed-toe shoes.');
await page.fill('#emergencyInstructions', 'The school will call the numbers on file.');
await page.fill('#studentName', 'Ava Reyes');
await settle(page, 300);

/* ── 1. English only, unchanged ──────────────────────────────────────────── */
eq((await previewSlips()).length, 1, 'with no second language, one slip previews');
ok(!(await page.isVisible('#langOptions')), 'and the translation fields stay out of the way');

/* ── 2. picking a language adds a translated twin ────────────────────────── */
await page.selectOption('#secondLang', 'es');
await settle(page, 300);
ok(await page.isVisible('#langOptions'), 'the translation fields appear');
const pair = await previewSlips();
eq(pair.length, 2, 'two slips preview');
eq(pair.map(s => s.lang).join(','), 'en,es', 'English first, then the second language');
eq(pair[0].title, 'Field Trip Permission Slip', 'the English slip keeps its title');
eq(pair[1].title, 'Autorización para Excursión Escolar', 'and the Spanish slip is titled in Spanish');

/* ── 3. the translated slip is a form, not a decoration ──────────────────── */
ok(pair[1].text.includes('Ava Reyes'), 'the student is named on the Spanish slip');
eq(pair[1].sigLines.length, 4, 'it carries all four signature lines');
ok(pair[1].sigLines[0].includes('Firma'), 'in Spanish: ' + JSON.stringify(pair[1].sigLines[0]));
ok(/Doy permiso a/.test(pair[1].text), 'and the permission sentence is translated');
ok(/Riverside Science Center/.test(pair[1].text), 'proper nouns carry across untranslated');

/* ── 4. untranslated prose falls back to English, and is reported ────────── */
ok(pair[1].text.includes('Students will tour the planetarium'),
   'an untranslated purpose prints its English text rather than a gap');
const hint = await page.textContent('#untranslatedHint');
ok(/Still in English/.test(hint) && /Purpose/.test(hint) && /What to bring/.test(hint),
   'and the tool names what is still in English: ' + JSON.stringify(hint));

await page.fill('#purposeAlt', 'Los estudiantes visitarán el planetario.');
await settle(page, 300);
const half = await previewSlips();
ok(half[1].text.includes('Los estudiantes visitarán el planetario'), 'a filled translation is used');
ok(half[0].text.includes('Students will tour the planetarium'), 'and the English slip is unaffected');
ok(!/Purpose/.test(await page.textContent('#untranslatedHint')), 'the hint drops the field once it is translated');

await page.fill('#whatToBringAlt', 'Almuerzo, botella de agua, zapatos cerrados.');
await page.fill('#emergencyInstructionsAlt', 'La escuela llamará a los números registrados.');
await settle(page, 300);
ok(/Every field you filled in has a translation/.test(await page.textContent('#untranslatedHint')),
   'and says so when nothing is left');

/* ── 5. the hint tracks presence, not freshness — a known limit ──────────── */
await page.fill('#purpose', 'Students will tour the planetarium and stay for the 1pm show.');
await settle(page, 300);
ok(/Every field you filled in has a translation/.test(await page.textContent('#untranslatedHint')),
   'rewording the English keeps the old translation and is NOT flagged — the hint knows whether a ' +
   'translation exists, not whether it still matches. Recorded as a limitation, asserted so a future ' +
   'round changing it has to change this line deliberately.');
ok((await previewSlips())[1].text.includes('Los estudiantes visitarán el planetario'),
   'the now-stale translation is what prints');
/* clearing the English side is the other direction: nothing to translate */
await page.fill('#purpose', '');
await settle(page, 300);
ok(/Every field you filled in has a translation/.test(await page.textContent('#untranslatedHint')),
   'an empty English field is not counted as untranslated');
await page.fill('#purpose', 'Students will tour the planetarium and complete a physics workshop.');
await settle(page, 300);

/* ── 6. the two layouts differ in the way they claim to ──────────────────── */
const facing = await printedSlips();
eq(facing.slips.length, 2, 'facing page prints two slips');
eq(facing.pairs, 0, 'as separate pages, not a column pair');

await page.selectOption('#langLayout', 'column');
await settle(page, 300);
const columns = await printedSlips();
eq(columns.slips.length, 2, 'side by side still prints both slips');
eq(columns.pairs, 1, 'but wrapped in one two-column pair');

/* ── 7. batch printing pairs every student ───────────────────────────────── */
await page.click('.mode-tab[data-mode="batch"]');
await settle(page);
await page.fill('#batchNames', 'Ava Reyes\nBen Okafor\nCara Lin');
await settle(page, 300);
const batch = await printedSlips();
eq(batch.slips.length, 6, 'three students, six slips');
eq(batch.pairs, 3, 'in three two-column pairs');
eq(batch.slips.map(s => s.lang).join(','), 'en,es,en,es,en,es', 'alternating English and Spanish');
eq(batch.slips.filter(s => s.student === 'Ava Reyes').length, 2, 'each student is named on both of their slips');

/* ── 8. turning the language back off returns to one slip ────────────────── */
await page.selectOption('#secondLang', '');
await settle(page, 300);
const backToEnglish = await printedSlips();
eq(backToEnglish.slips.length, 3, 'three students, three slips again');
ok(backToEnglish.slips.every(s => s.lang === 'en'), 'all English');

/* ── 9. the choice and the translations survive a reload ─────────────────── */
await page.selectOption('#secondLang', 'fr');
await settle(page, 300);
await page.fill('#purposeAlt', 'Les élèves visiteront le planétarium.');
await settle(page, 300);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
eq(await page.inputValue('#secondLang'), 'fr', 'the language is remembered');
eq(await page.inputValue('#purposeAlt'), 'Les élèves visiteront le planétarium.', 'and so is the translation');
ok((await previewSlips())[1].title === 'Autorisation de sortie scolaire', 'the French slip previews');

/* per-language translations share one set of fields — worth knowing */
ok((await previewSlips())[1].text.includes('Les élèves visiteront'),
   'the stored translation is used for whichever language is selected');

/* ── 10. a trip saved before any of this ────────────────────────────────── */
const old = await prepPage(browser, BASE, { width: 1400, height: 1050 });
await old.goto(URL_PAGE, { waitUntil: 'networkidle' });
await old.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('gvb-field-trip:list', JSON.stringify(['Museum Trip']));
  localStorage.setItem('gvb-field-trip:current', 'Museum Trip');
  localStorage.setItem('gvb-field-trip:data:Museum Trip', JSON.stringify({
    name: 'Museum Trip', mode: 'single', studentName: 'Jonah P.', batchNames: '', blankCount: 5,
    collected: {}, chaperones: [], chaperoneAssignments: {},
    schoolTeacher: 'East Middle', destination: 'City Museum', tripStartDate: '', tripEndDate: '',
    departureTime: '', returnTime: '', purpose: 'Tour the local history wing.', cost: '',
    whatToBring: 'Lunch.', chaperoneName: '', chaperonePhone: '', emergencyInstructions: '', dueDate: '',
  }));
});
await old.reload({ waitUntil: 'networkidle' });
await settle(old, 400);
eq(await old.inputValue('#secondLang'), '', 'a trip saved before this opens as English only');
ok(!(await old.isVisible('#langOptions')), 'with the translation fields hidden');
eq(await old.evaluate(() => document.querySelectorAll('#previewArea .slip').length), 1,
   'and previews exactly the one slip it always did');
eq(await old.inputValue('#purpose'), 'Tour the local history wing.', 'its own content is intact');
await old.selectOption('#secondLang', 'pt');
await settle(old, 300);
eq(await old.evaluate(() => document.querySelectorAll('#previewArea .slip')[1].querySelector('.slip-title').textContent),
   'Autorização para Excursão Escolar', 'and it can take a second language from there');

/* ── 11. no console noise anywhere in the run ───────────────────────────── */
for (const [label, p] of [['main', page], ['legacy', old]]) {
  eq(p.__errs.length, 0, `no page/console errors on the ${label} page: ` + JSON.stringify(p.__errs));
  eq(p.__blocked.length, 0, `nothing left the site from the ${label} page: ` + JSON.stringify(p.__blocked));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
