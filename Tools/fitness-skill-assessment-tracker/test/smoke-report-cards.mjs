// smoke-report-cards.mjs — one page per student for the fitness tracker.
//
//   node Tools/fitness-skill-assessment-tracker/test/smoke-report-cards.mjs
//
// A report card is a page a teacher hands to a family. What can go wrong is
// not that it fails to print; it is that it prints well and says too much:
//
//   - Another child's name or score on it. The class average is a count of
//     scores, never a list of them, so there is no min, no max and no rank.
//   - An "average" of one score, which is that child's own number handed back
//     as if it were the class's.
//   - A blank event, a child with no results, a class of one or of forty: the
//     page still has to read sensibly, and the last card must not be followed
//     by a blank sheet.
//
// And it must add nothing to what the tool saves, so a save from before the
// feature loads and prints exactly as it did. Chromium's own PDF counts the
// pages. Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8487;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/060-fitness-skill-assessment-tracker.html';
const STORE_KEY = 'fsat_tracker_v1';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (process.env.LABELS) console.log((cond ? '  PASS ' : '  FAIL ') + label);
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const same = (a, b, label) => eq(JSON.stringify(a), JSON.stringify(b), label);
const pdfPages = buf => (buf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) || []).length;

const server = await serve(PORT);
const browser = await launch();

/** Open the page with a saved state already in storage (once: a reload keeps what the page wrote). */
async function open(saved) {
  const page = await prepPage(browser, BASE, { width: 1300, height: 1000 });
  if (saved) {
    await page.addInitScript(([k, v]) => {
      if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); }
    }, [STORE_KEY, JSON.stringify(saved)]);
  }
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 300);
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  return page;
}

/** What is on the cards, page by page. */
const cards = page => page.$$eval('#printArea .rc-page', pages => pages.map(p => ({
  name: p.querySelector('.rc-student').textContent,
  text: p.textContent,
  rows: Array.from(p.querySelectorAll('tbody tr')).map(tr => Array.from(tr.children).map(td => td.textContent)),
  note: (p.querySelector('.rc-note') || {}).textContent || '',
  headings: Array.from(p.querySelectorAll('th')).map(th => th.textContent),
})));

const EV = { mile: 'em', push: 'ep', sit: 'es', retest: 'er' };
const events = [
  { id: EV.mile, name: 'Mile Run — Fall', type: 'time' },
  { id: EV.push, name: 'Push-ups — Fall', type: 'count' },
  { id: EV.sit, name: 'Sit-ups', type: 'count' },
  { id: EV.retest, name: 'Mile Run — Spring Retest', type: 'time' },
];
const ROSTER = ['Odalys Brandt', 'Tobias Fenwick', 'Ilse Marchetti', 'Kwame Adjei-Nolan', 'Rhiannon Voss'];
/* Every score is different from every other and from every average below, so a
   score found on the wrong card cannot be a coincidence. Nobody has a Sit-ups
   result; only Odalys has the Spring Retest; Kwame has nothing at all. */
const results = {
  'Odalys Brandt|em': '9:58', 'Tobias Fenwick|em': '11:23', 'Ilse Marchetti|em': '13:47',
  'Odalys Brandt|ep': '23', 'Tobias Fenwick|ep': '41', 'Rhiannon Voss|ep': '17',
  'Odalys Brandt|er': '9:31',
};
/* Kwame has one cell with only spaces in it: typed and cleared, which is not a result. */
const OLD_SAVE = { roster: ROSTER, events, results: { ...results, 'Kwame Adjei-Nolan|es': '  ' } };
const SCORES = ['9:58', '11:23', '13:47', '23', '41', '17', '9:31'];
const own = {
  'Odalys Brandt': ['9:58', '23', '9:31'], 'Tobias Fenwick': ['11:23', '41'],
  'Ilse Marchetti': ['13:47'], 'Rhiannon Voss': ['17'], 'Kwame Adjei-Nolan': [],
};

console.log('Fitness Tracker — report cards');

/* ── 1. nothing to print yet ───────────────────────────────────────────── */
{
  const page = await open(null);
  eq(await page.isDisabled('#printCardBtn'), true, 'with no roster, the one-student button is off');
  eq(await page.isDisabled('#printAllCardsBtn'), true, 'and so is print-every-card');
  eq(await page.isDisabled('#cardStudent'), true, 'and the picker');
  ok(/Save a roster/.test(await page.textContent('#cardNote')), 'and a line says what to do first');
  await page.context().close();
}

/* ── 2. a save from before the feature loads and prints unchanged ──────── */
{
  const page = await open(OLD_SAVE);
  const before = await page.evaluate(k => localStorage.getItem(k), STORE_KEY);
  same(await page.$$eval('#cardStudent option', o => o.map(x => x.value)), ROSTER, 'the picker lists the saved roster in its order');
  eq(await page.$eval('#printAllCardsBtn', b => b.textContent), 'Print every report card (5)', 'print-all says how many pages it will make');
  eq(await page.isEnabled('#printCardBtn'), true, 'the buttons are on');

  /* ── 3. one student ─────────────────────────────────────────────────── */
  await page.selectOption('#cardStudent', 'Tobias Fenwick');
  await page.click('#printCardBtn');
  eq(await page.evaluate(() => window.__printed), 1, 'Print this student\'s report card opens the print dialog once');
  let c = await cards(page);
  eq(c.length, 1, 'one page');
  eq(c[0].name, 'Tobias Fenwick', 'for the student chosen');
  same(c[0].headings, ['Event', 'Result', 'Class average'], 'headed Event, Result, Class average');
  same(await page.$$eval('#printArea .rc-page th', th => th.map(h => h.getAttribute('scope'))), ['col', 'col', 'col'], 'every heading is a column header a screen reader can tie a cell to');
  same(c[0].rows.map(r => r[0]), events.map(e => e.name), 'every event is on it, in the order the events are listed, each with its date as the event names it');
  same(c[0].rows.map(r => r[1]), ['11:23', '41', 'No result', 'No result'], 'his result beside each; a blank says so rather than leaving a hole');
  same(c[0].rows.map(r => r[2]), ['11:42.7 (3 students)', '27.0 (3 students)', 'No results yet', 'Not enough results to compare yet'],
       'the class average beside each: a time as a time, a count to one place, an empty event as none, and a single score not passed off as an average');
  eq(c[0].note, '', 'he has results, so no "nothing recorded" line');
  ok(/Tobias Fenwick sent to the print dialog|Report card for Tobias Fenwick/.test(await page.textContent('#cardNote')), 'the status line says what was sent: ' + await page.textContent('#cardNote'));

  /* the one student with nothing */
  await page.selectOption('#cardStudent', 'Kwame Adjei-Nolan');
  await page.click('#printCardBtn');
  c = await cards(page);
  same(c[0].rows.map(r => r[1]), ['No result', 'No result', 'No result', 'No result'], 'a student with no scores still gets a page, every event "No result"');
  same(c[0].rows.map(r => r[2]), ['11:42.7 (3 students)', '27.0 (3 students)', 'No results yet', 'Not enough results to compare yet'], 'with the class average still beside it');
  ok(/No results have been recorded/.test(c[0].note), 'and a line saying so');

  /* the one student alone on an event */
  await page.selectOption('#cardStudent', 'Odalys Brandt');
  await page.click('#printCardBtn');
  c = await cards(page);
  same(c[0].rows.map(r => r[1]), ['9:58', '23', 'No result', '9:31'], 'the student who is the only one on the Spring Retest has her time');
  eq(c[0].rows[3][2], 'Not enough results to compare yet', 'but the "average" of one score is not printed back at her as the class\'s');

  /* ── 4. everyone ─────────────────────────────────────────────────────── */
  await page.click('#printAllCardsBtn');
  c = await cards(page);
  same(c.map(x => x.name), ROSTER, 'print-all makes one page per student, in roster order');
  for (const card of c) {
    const others = ROSTER.filter(n => n !== card.name);
    ok(!others.some(n => card.text.includes(n)), `${card.name}'s page names nobody else`);
    const cells = card.rows.flatMap(r => r.slice(1, 2));
    const foreign = SCORES.filter(s => !own[card.name].includes(s));
    ok(!cells.some(t => foreign.includes(t)), `${card.name}'s Result column holds only ${card.name}'s scores`);
    ok(!foreign.some(s => new RegExp('(^|[^\\d:.])' + s.replace(/\./g, '\\.') + '([^\\d:.]|$)').test(card.text.replace(/\(\d+ students\)/g, ''))),
       `${card.name}'s page has no other student's score anywhere in its text`);
    ok(!/fastest|slowest|highest|lowest|best|rank|min|max|range|–/i.test(card.text), `${card.name}'s page offers no range, best or rank`);
  }
  eq(await page.evaluate(() => window.__printed), 4, 'each of the four print clicks (three single cards, then all) printed once');

  /* ── 5. the picker's choice survives the grid re-rendering; print-all follows the sort ── */
  await page.selectOption('#cardStudent', 'Ilse Marchetti');
  await page.click(`#resultsTable th[data-sort-by="${EV.push}"]`);
  await settle(page, 200);
  eq(await page.inputValue('#cardStudent'), 'Ilse Marchetti', 'sorting the grid does not reset the chosen student');
  same(await page.$$eval('#cardStudent option', o => o.map(x => x.value)),
       ['Tobias Fenwick', 'Odalys Brandt', 'Rhiannon Voss', 'Ilse Marchetti', 'Kwame Adjei-Nolan'],
       'the picker follows the order on screen (most push-ups first, then those with none)');
  await page.click('#printAllCardsBtn');
  same((await cards(page)).map(x => x.name), ['Tobias Fenwick', 'Odalys Brandt', 'Rhiannon Voss', 'Ilse Marchetti', 'Kwame Adjei-Nolan'],
       'print-all follows the order on screen, as the class table does');

  /* ── 6. keyboard ───────────────────────────────────────────────────── */
  await page.focus('#cardStudent');
  await page.keyboard.press('ArrowUp');
  await settle(page, 100);
  const picked = await page.inputValue('#cardStudent');
  ok(picked !== 'Ilse Marchetti', 'the picker moves with the arrow keys: now ' + picked);
  await page.focus('#printCardBtn');
  const before1 = await page.evaluate(() => window.__printed);
  await page.keyboard.press('Enter');
  eq(await page.evaluate(() => window.__printed), before1 + 1, 'Enter on the button prints');
  eq((await cards(page))[0].name, picked, 'that student');
  await page.focus('#printAllCardsBtn');
  await page.keyboard.press('Space');
  eq((await cards(page)).length, 5, 'Space on print-all prints every card');
  eq(await page.textContent('#cardNote'), '5 report cards sent to the print dialog.', 'the status line counts what was sent');
  eq(await page.getAttribute('#cardNote', 'aria-live'), 'polite', 'the status line is announced politely');
  eq(await page.getAttribute('#cardNote', 'role'), 'status', 'and is a status');
  eq(await page.$eval('label[for="cardStudent"]', l => l.textContent.trim()), 'Student', 'the picker has its label');

  /* ── 7. print media: the card on paper, the screen UI off it ───────── */
  await page.selectOption('#cardStudent', 'Odalys Brandt');
  await page.click('#printCardBtn');
  await page.emulateMedia({ media: 'print' });
  const paper = await page.evaluate(() => {
    const vis = el => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden'; };
    const sec = document.querySelector('#printArea .rc-page');
    return {
      card: vis(sec), controls: vis(document.getElementById('printCardBtn')), pick: vis(document.getElementById('cardStudent')),
      ink: getComputedStyle(sec).color, bg: getComputedStyle(document.body).backgroundColor,
    };
  });
  ok(paper.card, 'in print, the report card is shown');
  ok(!paper.controls && !paper.pick, 'and the picker and buttons are not on the paper');
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
  eq(pdfPages(pdf), 1, 'Chromium prints one student as one page');
  await page.click('#printAllCardsBtn', { force: true }).catch(() => {});
  await page.emulateMedia({ media: null });
  await page.click('#printAllCardsBtn');
  await page.emulateMedia({ media: 'print' });
  eq(pdfPages(await page.pdf({ preferCSSPageSize: true, printBackground: false })), 5, 'five students print as five pages, with no blank sheet after the last');
  await page.emulateMedia({ media: null });

  /* ── 8. nothing new is saved ───────────────────────────────────────── */
  eq(await page.evaluate(k => localStorage.getItem(k), STORE_KEY), before, 'after all that, the saved state is byte-for-byte what was loaded: no new field');
  await page.fill(`input[data-student="Ilse Marchetti"][data-event="${EV.push}"]`, '19');
  await settle(page, 200);
  same(Object.keys(await page.evaluate(k => JSON.parse(localStorage.getItem(k)), STORE_KEY)), ['roster', 'events', 'results'], 'and editing a result afterwards saves the same three fields and no more');
  eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
  eq(page.__blocked.length, 0, 'nothing tried to leave the site');
  await page.context().close();
}

/* ── 9. a class of one ─────────────────────────────────────────────────── */
{
  const page = await open({ roster: ['Solo Learner'], events: events.slice(0, 2), results: { 'Solo Learner|em': '10:15', 'Solo Learner|ep': '12' } });
  eq(await page.$eval('#printAllCardsBtn', b => b.textContent), 'Print every report card', 'with one student the button carries no count');
  await page.click('#printAllCardsBtn');
  const c = await cards(page);
  eq(c.length, 1, 'one card');
  same(c[0].rows, [['Mile Run — Fall', '10:15', 'Not enough results to compare yet'], ['Push-ups — Fall', '12', 'Not enough results to compare yet']],
       'her own scores, and no class average passed off from a class of one');
  eq(pdfPages(await (async () => { await page.emulateMedia({ media: 'print' }); return page.pdf({ preferCSSPageSize: true }); })()), 1, 'one page on paper');
  await page.context().close();
}

/* ── 10. a class of forty ──────────────────────────────────────────────── */
{
  const names = Array.from({ length: 40 }, (_, i) => `Sample Student ${String(i + 1).padStart(2, '0')}`);
  const r = {};
  names.forEach((n, i) => { r[`${n}|ep`] = String(10 + i); if (i % 3) r[`${n}|em`] = `${8 + (i % 7)}:${String(10 + i).padStart(2, '0')}`; });
  const page = await open({ roster: names, events: events.slice(0, 3), results: r });
  eq(await page.$eval('#printAllCardsBtn', b => b.textContent), 'Print every report card (40)', 'the button counts forty');
  await page.click('#printAllCardsBtn');
  const c = await cards(page);
  eq(c.length, 40, 'forty cards');
  let leaks = 0;
  for (const card of c) if (names.filter(n => n !== card.name).some(n => card.text.includes(n))) leaks++;
  eq(leaks, 0, 'and none of them names another student');
  eq(c[39].rows[1][1], '49', 'the last card has the last student\'s own push-ups');
  eq(c[39].rows[1][2], '29.5 (40 students)', 'and the average of all forty (10 to 49)');
  await page.emulateMedia({ media: 'print' });
  eq(pdfPages(await page.pdf({ preferCSSPageSize: true })), 40, 'Chromium prints forty pages, one each, no blank sheet at the end');
  eq(await page.evaluate(() => Array.from(document.querySelectorAll('#printArea .rc-page')).map(p => getComputedStyle(p).breakBefore).filter(b => b === 'page').length), 39,
     'a page break before every card but the first');
  await page.context().close();
}

/* ── 11. awkward names and events are text, not markup ─────────────────── */
{
  const odd = '<b>Zed</b> & "Q"';
  const page = await open({ roster: [odd, 'Plain Pat'], events: [{ id: 'x1', name: '<i>Hop</i>', type: 'count' }, { id: 'x2', name: '', type: 'count' }], results: { [odd + '|x1']: '<u>5</u>', 'Plain Pat|x1': '7' } });
  await page.selectOption('#cardStudent', odd);
  await page.click('#printCardBtn');
  const c = await cards(page);
  eq(c[0].name, odd, 'a name with markup in it prints as that text');
  eq(c[0].rows[0][0], '<i>Hop</i>', 'so does an event name');
  eq(c[0].rows[0][1], '<u>5</u>', 'and a typed result');
  eq(c[0].rows[1][0], '(unnamed event)', 'an event with no name has one');
  eq(await page.locator('#printArea b, #printArea i, #printArea u').count(), 0, 'no element was made from any of it');
  await page.context().close();
}

/* ── 12. no events at all ──────────────────────────────────────────────── */
{
  const page = await open({ roster: ['Lone Name'], events: [], results: {} });
  /* load() puts the three standard events back when there are none, so remove them in the page. */
  while (await page.locator('[data-del-event]').count()) await page.locator('[data-del-event]').first().click();
  await settle(page, 200);
  eq(await page.locator('#eventsWrap .event-row').count(), 0, 'every event deleted');
  await page.click('#printCardBtn');
  const c = await cards(page);
  eq(c.length, 1, 'the card still prints');
  ok(/no test events yet/i.test(c[0].note) && c[0].rows.length === 0, 'and says there are no test events yet instead of an empty table');
  await page.context().close();
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
