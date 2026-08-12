// smoke-feedback-slip.mjs — the sub binder's feedback slip page.
//
//   node Tools/sub-binder-generator/test/smoke-feedback-slip.mjs
//
// Every other page in the bundle is the teacher talking to the substitute.
// This is the one page going the other way, and it decides whether tomorrow
// starts with information or with a guess.
//
// Three decisions under test:
//
//   1. It is always available. Every other section here greys out when its
//      source tool has nothing saved; a blank feedback form is still a
//      feedback form, so this one never does.
//   2. The prompts come from 076 Sub Note / Feedback Slip Generator when that
//      tool has been used, so a teacher who has already worded their own
//      questions does not word them twice — and fall back to the same four
//      defaults when it hasn't.
//   3. In a multi-day bundle it prints once PER DAY, unlike the other shared
//      sections. Three days of a sub's observations on one sheet is three
//      days blurred together, and it is likely to be a different sub anyway.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8202;
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
const page = await prepPage(browser, BASE, { width: 1300, height: 1000 });

const printedPages = (p) => p.evaluate(() =>
  [...document.querySelectorAll('#printArea .page')].map(pg => ({
    title: (pg.querySelector('h2') || {}).textContent || '',
    sub: (pg.querySelector('.p-sub') || {}).textContent || '',
    questions: [...pg.querySelectorAll('.fb-q')].map(q => q.textContent),
    lines: pg.querySelectorAll('.fb-line').length,
  })));

console.log('Sub Binder — sub feedback slip page');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 700);
await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });

/* ── 1. it is offered even with nothing saved anywhere ─────────────────── */
const checklist = await page.evaluate(() =>
  [...document.querySelectorAll('#sectionChecklist .checkbox-row')].map(row => ({
    text: row.textContent.replace(/\s+/g, ' ').trim(),
    checked: row.querySelector('input').checked,
    disabled: row.querySelector('input').disabled,
  })));
const fbRow = checklist.find(r => /Sub feedback slip/.test(r.text));
ok(!!fbRow, 'the feedback slip is a section in the checklist');
eq(fbRow.checked, true, 'included by default');
eq(fbRow.disabled, false, 'and never greyed out — unlike every other section, it needs nothing saved to be worth printing');
ok(/standard prompts/i.test(fbRow.text), 'saying which prompts it will use: ' + fbRow.text);

/* ── 2. the printed page is a form ─────────────────────────────────────── */
await page.click('#printBtn');
await settle(page, 400);
eq(await page.evaluate(() => window.__printed), 1, 'printing works');

let pages = await printedPages(page);
const fbPage = pages.find(pg => /Sub Feedback/.test(pg.title));
ok(!!fbPage, 'the bundle contains a feedback page: ' + JSON.stringify(pages.map(p => p.title)));
eq(pages[pages.length - 1].title, fbPage.title,
   'and it is last — it is the page they fill in, so it should be on top when the packet goes back down');
eq(fbPage.questions.length, 5, 'four prompts plus the "who helped" question');
ok(/worked well/i.test(fbPage.questions[0]), 'starting with what worked: ' + fbPage.questions[0]);
ok(/helpful/i.test(fbPage.questions[4]), 'and ending by asking who to thank: ' + fbPage.questions[4]);
ok(fbPage.lines >= 14, `with real ruled space to write in (${fbPage.lines} lines)`);

const head = await page.evaluate(() =>
  [...document.querySelectorAll('#printArea .fb-label')].map(l => l.textContent));
eq(JSON.stringify(head), JSON.stringify(['Substitute', 'Periods covered']),
   'and a header for the two things a teacher always ends up asking afterwards');

/* ── 3. unchecking it removes the page, and the choice sticks ──────────── */
await page.evaluate(() => {
  const row = [...document.querySelectorAll('#sectionChecklist .checkbox-row')]
    .find(r => /Sub feedback slip/.test(r.textContent));
  const cb = row.querySelector('input');
  cb.checked = false;
  cb.dispatchEvent(new Event('change', { bubbles: true }));
});
await settle(page, 300);
await page.click('#printBtn');
await settle(page, 400);
ok(!(await printedPages(page)).some(pg => /Sub Feedback/.test(pg.title)), 'unchecking it drops the page');

await page.reload({ waitUntil: 'networkidle' });
await settle(page, 700);
eq(await page.evaluate(() => {
  const row = [...document.querySelectorAll('#sectionChecklist .checkbox-row')]
    .find(r => /Sub feedback slip/.test(r.textContent));
  return row.querySelector('input').checked;
}), false, 'and the choice survives a reload like every other section');

/* ── 4. it picks up the prompts the teacher already wrote in tool 076 ──── */
const shared = await prepPage(browser, BASE, { width: 1300, height: 1000 });
await shared.goto(URL_PAGE, { waitUntil: 'networkidle' });
await shared.evaluate(() => {
  localStorage.setItem('snfs_slip_v1', JSON.stringify({
    copyCount: 2, classPeriod: '',
    prompts: [
      { id: 'p1', text: 'Did the lab groups stay on task?' },
      { id: 'p2', text: 'Which period needed the most redirecting?' },
      { id: 'p3', text: '   ' },
    ],
  }));
});
await shared.reload({ waitUntil: 'networkidle' });
await settle(shared, 700);
await shared.evaluate(() => { window.print = () => {}; });

const sharedRow = await shared.evaluate(() =>
  [...document.querySelectorAll('#sectionChecklist .checkbox-row')]
    .find(r => /Sub feedback slip/.test(r.textContent)).textContent.replace(/\s+/g, ' '));
ok(/2 saved prompts/.test(sharedRow), 'the checklist says it is using the saved prompts: ' + sharedRow);

await shared.click('#printBtn');
await settle(shared, 400);
const sharedPage = (await printedPages(shared)).find(pg => /Sub Feedback/.test(pg.title));
ok(/lab groups/.test(sharedPage.questions[0]), 'the teacher’s own wording is what prints: ' + sharedPage.questions[0]);
eq(sharedPage.questions.length, 3, 'a blank prompt in the saved set is dropped rather than printing an empty question');
ok(!/worked well/i.test(sharedPage.questions.join(' ')), 'and the defaults are not appended on top of them');

/* a corrupt saved payload falls back rather than blowing up */
const broken = await prepPage(browser, BASE, { width: 1200, height: 900 });
await broken.goto(URL_PAGE, { waitUntil: 'networkidle' });
await broken.evaluate(() => localStorage.setItem('snfs_slip_v1', '{not json'));
await broken.reload({ waitUntil: 'networkidle' });
await settle(broken, 700);
await broken.evaluate(() => { window.print = () => {}; });
await broken.click('#printBtn');
await settle(broken, 400);
const brokenPage = (await printedPages(broken)).find(pg => /Sub Feedback/.test(pg.title));
ok(brokenPage && /worked well/i.test(brokenPage.questions[0]),
   'an unreadable saved payload falls back to the standard prompts instead of printing nothing');

/* ── 5. multi-day: one slip per day ────────────────────────────────────── */
const multi = await prepPage(browser, BASE, { width: 1300, height: 1000 });
await multi.goto(URL_PAGE, { waitUntil: 'networkidle' });
await multi.evaluate(() => {
  localStorage.setItem('subPlanBuilder.lastAbsence.v1', JSON.stringify({
    dates: ['2026-05-04', '2026-05-05', '2026-05-06'],
  }));
});
await multi.reload({ waitUntil: 'networkidle' });
await settle(multi, 700);
await multi.evaluate(() => { window.print = () => {}; });

if (await multi.isVisible('#printAllDaysBtn')) {
  await multi.click('#printAllDaysBtn');
  await settle(multi, 500);
  const all = await printedPages(multi);
  const slips = all.filter(pg => /Sub Feedback/.test(pg.title));
  eq(slips.length, 3, 'a three-day absence gets three feedback slips, not one shared sheet');
  ok(/Day 1 of 3/.test(slips[0].sub), 'each labelled with its day: ' + slips[0].sub);
  ok(/Day 3 of 3/.test(slips[2].sub), 'through to the last');
  const others = all.filter(pg => /Emergency|Standing/.test(pg.title));
  ok(others.every(pg => /every day/.test(pg.sub)) || others.length === 0,
     'while the genuinely shared sections still print once for the whole absence');
} else {
  ok(false, 'the multi-day button should be available with a three-day absence saved');
}

/* ── 6. no console noise ───────────────────────────────────────────────── */
for (const [name, p] of [['main', page], ['shared', shared], ['broken', broken], ['multi', multi]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
