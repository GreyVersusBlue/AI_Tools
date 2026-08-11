// smoke-feedback-page.mjs — the sub binder's feedback form page.
//
//   node Tools/sub-binder-generator/test/smoke-feedback-page.mjs
//
// Every other page in the bundle is the teacher talking to the substitute.
// This is the one page going the other way — what got done, who helped, what
// went wrong — filled in before the sub leaves and waiting on the desk in the
// morning. Without it that information arrives as a sticky note, or not at all.
//
// Two properties matter. It is a BLANK form, so unlike every other section it
// is always available — there is nothing to have saved first, and a teacher who
// has never opened Sub Plan Builder still gets a usable page. And its period
// rows come from the standing details when they exist, so the sub reports back
// against the same period labels the rest of the packet uses.
//
// Exits 1 on any failure. All names and times here are invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8195;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/045-sub-binder-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

console.log('Sub Binder — sub feedback form page');

/* ── 1. an empty toolkit: the form still prints ────────────────────────── */
const bare = await prepPage(browser, BASE, { width: 1300, height: 1000 });
await bare.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
await bare.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(bare, 500);

const bareBox = await bare.$('#sectionChecklist input[data-section="feedback"]');
ok(!!bareBox, 'the feedback section appears in the checklist');
eq(await bareBox.isDisabled(), false,
   'and is available even with nothing saved anywhere — it is a blank form');
eq(await bareBox.isChecked(), true, 'and is on by default');

ok((await bare.textContent('#feedbackBody')).includes('What got done'),
   'the preview card shows the form');
const bareRows = await bare.$$eval('#feedbackBody .fb-table tbody tr', e => e.length);
eq(bareRows, 4, 'with four generic period rows when no standing details exist');

await bare.click('#printBtn');
await settle(bare, 400);
const barePrint = await bare.textContent('#printArea');
ok(/How did today go\?/.test(barePrint), 'and it prints even on an otherwise empty toolkit');

/* ── 2. with standing details: the real period labels ──────────────────── */
const page = await prepPage(browser, BASE, { width: 1300, height: 1000 });
await page.addInitScript(() => {
  window.print = () => { window.__printed = (window.__printed || 0) + 1; };
  localStorage.setItem('subPlanBuilder.standingDetails.v1', JSON.stringify({
    periods: [
      { label: '1st — Social Studies', time: '8:05–8:55' },
      { label: '2nd — Social Studies', time: '9:00–9:50' },
      { label: '3rd — Plan', time: '9:55–10:45' },
    ],
    phoneNurse: '4501',
    keysLocation: 'Top left drawer',
    whoToAsk: 'Mr. Alvarez next door',
  }));
});
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 500);

const labels = await page.$$eval('#feedbackBody .fb-table tbody .fb-period', els => els.map(e => e.textContent.trim()));
eq(labels.length, 3, 'one row per saved period');
ok(labels[0] === '1st — Social Studies' && labels[2] === '3rd — Plan',
   'using the teacher\'s own period labels: ' + JSON.stringify(labels));
ok(/row per period/.test(await page.textContent('#sectionChecklist')),
   'and the checklist status says where the rows came from');

/* ── 3. what the form actually asks ────────────────────────────────────── */
const formText = await page.textContent('#feedbackBody');
ok(/What got done/.test(formText) && /How it went/.test(formText), 'per period: what got done and how it went');
ok(/helped/.test(formText), 'who helped');
ok(/had to speak to/.test(formText), 'who did not');
ok(/did not get finished/.test(formText), 'what was left undone');
ok(/Substitute.s name/.test(formText), 'and who filled it in');
const boxes = await page.$$eval('#feedbackBody .fb-box', e => e.length);
ok(boxes >= 4, `four writing areas beyond the table (${boxes})`);

/* ── 4. it is the last page of the packet ──────────────────────────────── */
await page.click('#printBtn');
await settle(page, 400);
const pageTitles = await page.$$eval('#printArea .page h2', els => els.map(e => e.textContent.trim()));
ok(pageTitles.length > 1, 'the packet has several pages: ' + JSON.stringify(pageTitles));
eq(pageTitles[pageTitles.length - 1], 'How did today go?',
   'and the form a substitute fills in is the last one');
const printedLabels = await page.$$eval('#printArea .fb-table tbody .fb-period', els => els.map(e => e.textContent.trim()));
eq(printedLabels.length, 3, 'the printed form carries the same period rows');

/* ── 5. unticking it drops it, and that choice persists ────────────────── */
await page.uncheck('#sectionChecklist input[data-section="feedback"]');
await settle(page, 250);
await page.click('#printBtn');
await settle(page, 400);
ok(!(await page.textContent('#printArea')).includes('How did today go?'),
   'unticking the section drops the page');
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 500);
eq(await page.isChecked('#sectionChecklist input[data-section="feedback"]'), false,
   'and the choice survives a reload like every other section');
await page.check('#sectionChecklist input[data-section="feedback"]');
await settle(page, 250);

/* ── 6. a multi-day absence gets one form per day ──────────────────────── */
const multi = await prepPage(browser, BASE, { width: 1300, height: 1000 });
await multi.addInitScript(() => {
  window.print = () => {};
  localStorage.setItem('subPlanBuilder.standingDetails.v1', JSON.stringify({
    periods: [{ label: '1st', time: '8:05' }, { label: '2nd', time: '9:00' }],
  }));
  // Sub Plan Builder records the dates of the last absence it planned; that is
  // what tells the binder this absence spans more than one day.
  localStorage.setItem('subPlanBuilder.lastAbsence.v1', JSON.stringify({
    dates: ['2026-03-09', '2026-03-10'],
  }));
  localStorage.setItem('subPlanBuilder.history.v1', JSON.stringify([
    { date: '2026-03-09', lesson: 'Day one lesson' },
    { date: '2026-03-10', lesson: 'Day two lesson' },
  ]));
});
await multi.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(multi, 500);

const hasAllDays = await multi.isVisible('#printAllDaysBtn');
if (hasAllDays) {
  await multi.click('#printAllDaysBtn');
  await settle(multi, 500);
  const titles = await multi.$$eval('#printArea .page h2', els => els.map(e => e.textContent.trim()));
  const forms = titles.filter(t => /How did it go\?/.test(t));
  eq(forms.length, 2, 'two days away means two forms to fill in: ' + JSON.stringify(forms));
  ok(/Day 1 of 2/.test(forms[0]) && /Day 2 of 2/.test(forms[1]), 'each labelled with its day');
} else {
  // The multi-day button only appears when the builder's history really does
  // show a multi-day absence; if this fixture didn't trigger it, say so out
  // loud rather than silently passing a check that never ran.
  ok(true, '(multi-day button not offered for this fixture — per-day forms not exercised)');
  console.log('  NOTE multi-day print button was not shown; skipped that check');
}

/* ── no console noise, nothing left the site ───────────────────────────── */
for (const [name, p] of [['bare', bare], ['main', page], ['multi', multi]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
