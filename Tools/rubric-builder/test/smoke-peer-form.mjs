// smoke-peer-form.mjs — the rubric builder's peer feedback print format.
//
//   node Tools/rubric-builder/test/smoke-peer-form.mjs
//
// A student reviewing a partner's draft cannot award 4/4 for "organization" in
// any way that means something, and asking them to try teaches them to grade
// instead of to read. The peer format is the rubric with the points taken out:
// the criteria, the wording of whichever level the teacher picked as the
// target so the reviewer knows what to look for, and two ruled lines each.
//
// So the assertion that matters most is a negative one — no points, no level
// columns, no totals anywhere on the sheet — and it is checked against a
// rubric whose levels carry real point values.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8191;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/003-rubric-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1500, height: 1100 });
await page.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });

console.log('Rubric Builder — peer feedback print format');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 500);

/* ── load a template so there are real criteria and real points ────────── */
const templates = await page.$$eval('#templatePicker option', els => els.map(e => e.value).filter(Boolean));
ok(templates.length > 0, 'the tool ships templates to test against');
await page.selectOption("#templatePicker", templates[0]);
await page.click('#loadTemplateBtn');
await settle(page, 400);

const critCount = await page.$$eval('#criteriaList .crit-block, #criteriaList > *', e => e.length);
ok(critCount > 0, `the template loaded ${critCount} criteria`);

// Confirm the standard grid really does carry points, so "no points" below
// means something.
const standardText = await page.textContent('#previewArea');
ok(/\d/.test(standardText), 'the standard grid shows numbers (points/levels)');

/* ── switch to the peer format ─────────────────────────────────────────── */
await page.selectOption('#printFormat', 'peer');
await settle(page, 400);

ok(/peer feedback/i.test(await page.textContent('#previewNote')), 'the preview note names the format');
ok(await page.isVisible('#singlePointWrap'), 'the target-level picker appears for this format too');
ok(/what to look for/i.test(await page.textContent('#singlePointLevelLabel')),
   'and its label is reworded for a reviewer: ' + await page.textContent('#singlePointLevelLabel'));

const peer = await page.evaluate(() => {
  const area = document.getElementById('previewArea');
  return {
    text: area.textContent,
    rows: area.querySelectorAll('.peer-table tbody tr').length,
    rules: area.querySelectorAll('.peer-rule').length,
    worksWell: area.querySelectorAll('.peer-line .peer-tag').length,
    headers: Array.from(area.querySelectorAll('.peer-table thead th')).map(th => th.textContent.trim()),
    overall: !!area.querySelector('.peer-overall-box'),
    nameline: Array.from(area.querySelectorAll('.sheet-nameline span')).map(s => s.textContent.trim()),
  };
});

eq(peer.rows, critCount, 'one row per criterion');
eq(peer.rules, critCount * 2, 'two ruled lines per criterion — one for what works, one for what to try');
eq(peer.headers.length, 2, 'two columns only: what to look at, and the feedback');
ok(peer.text.includes('Works well:') && peer.text.includes('One thing to try:'), 'both prompts are labelled');
ok(peer.overall, 'there is an overall comment box at the end');
ok(peer.nameline.includes('Writer') && peer.nameline.includes('Reviewer'),
   'peer review needs both names, not just one: ' + JSON.stringify(peer.nameline));

/* ── the negative assertion: no scoring anywhere ───────────────────────── */
const scoring = await page.evaluate(() => {
  const area = document.getElementById('previewArea');
  // Scoped to the table and the comment block, not the sheet title: the
  // teacher's own rubric name ("4-Point Standard…") is their words, and
  // rewriting it would be the tool editing the title behind their back.
  const sheet = area.querySelector('.peer-table').textContent +
    area.querySelector('.peer-overall').textContent;
  return {
    pts: /\bpts?\b|\bpoints?\b/i.test(sheet),
    // Every level label from the rubric, and whether any of them appears as a
    // column header on the peer sheet.
    levelHeaders: Array.from(area.querySelectorAll('.peer-table thead th')).map(t => t.textContent.trim()),
    digitsInHeaders: Array.from(area.querySelectorAll('.peer-table thead th'))
      .some(t => /\d/.test(t.textContent)),
    totalRow: /total/i.test(area.textContent),
  };
});
eq(scoring.pts, false, 'the word "points"/"pts" appears nowhere in the form itself');
eq(scoring.digitsInHeaders, false, 'no numbers in the column headers');
eq(scoring.totalRow, false, 'no totals row');

/* ── the target level really drives the "what to look for" text ────────── */
const levelOptions = await page.$$eval('#singlePointLevel option', els => els.map(e => e.value));
if (levelOptions.length > 1) {
  const firstText = await page.$eval('#previewArea .peer-look-for', e => e.textContent.trim());
  await page.selectOption('#singlePointLevel', levelOptions[levelOptions.length - 1]);
  await settle(page, 350);
  const secondText = await page.$eval('#previewArea .peer-look-for', e => e.textContent.trim());
  ok(firstText !== secondText, 'changing the target level changes what the reviewer is told to look for');
} else {
  ok(true, '(only one level in this template — target-level switch not exercised)');
}

/* ── printing: portrait for this format, landscape for the others ──────── */
await page.click('#printBtn');
await settle(page, 300);
const printed = await page.evaluate(() => ({
  count: window.__printed || 0,
  page: document.getElementById('printPageStyle').textContent,
  bodyClass: document.body.className,
  areaHasPeer: !!document.querySelector('#printArea .peer-table'),
}));
ok(printed.count > 0, 'the print dialog was asked for');
ok(/portrait/.test(printed.page), 'the peer form overrides @page to portrait: ' + printed.page);
ok(/print-portrait/.test(printed.bodyClass), 'and marks the body while printing');
ok(printed.areaHasPeer, 'the print area holds the peer sheet');

// afterprint puts it back — Playwright does not fire it for a stubbed print,
// so fire it the way the browser would.
await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
await settle(page, 150);
const afterPrint = await page.evaluate(() => ({
  page: document.getElementById('printPageStyle').textContent,
  bodyClass: document.body.className,
}));
eq(afterPrint.page, '', 'the portrait override is cleared afterwards');
ok(!/print-portrait/.test(afterPrint.bodyClass), 'and so is the body class');

await page.selectOption('#printFormat', 'standard');
await settle(page, 300);
await page.click('#printBtn');
await settle(page, 300);
eq(await page.evaluate(() => document.getElementById('printPageStyle').textContent), '',
   'the standard grid still prints landscape, with no override');
ok(await page.evaluate(() => !!document.querySelector('#printArea .rubric-table:not(.peer-table)')),
   'and the other formats are untouched');

/* ── an empty rubric says so rather than printing a blank grid ──────────── */
const fresh = await prepPage(browser, BASE, { width: 1200, height: 900 });
await fresh.addInitScript(() => { window.print = () => {}; });
await fresh.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(fresh, 500);
await fresh.selectOption('#printFormat', 'peer');
await settle(fresh, 350);
ok(/No criteria yet/.test(await fresh.textContent('#previewArea')),
   'a rubric with no criteria says so on the peer sheet too');

/* ── no console noise, nothing left the site ───────────────────────────── */
for (const [name, p] of [['main', page], ['fresh', fresh]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
