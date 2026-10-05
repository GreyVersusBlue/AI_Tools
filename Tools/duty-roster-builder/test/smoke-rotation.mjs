// smoke-rotation.mjs — Duty Roster Builder's multi-week rotation.
//
//   node Tools/duty-roster-builder/test/smoke-rotation.mjs
//
// Week 1 is the grid the tool has always had; weeks 2 and up are derived from
// it by moving everyone down one duty (the last duty wraps to the first) and
// stay derived until the teacher edits a cell in that week. This suite pins
// that rule, what an edit in week 1 or a later week does to the weeks after
// it, that a roster saved before weeks existed loads as week 1 untouched, that
// a link carries the new fields, and that a month prints one table per week.
//
// Names are made up. Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8485;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/058-duty-roster-builder.html';
const KEY = 'drb_roster_v1';

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 900 });

/* A roster saved before weeks existed: no `weeks`, no `weekOverrides`. */
const LEGACY = {
  staff: ['Ada Quill', 'Bram Sorrel', 'Cleo Marsh'],
  duties: [{ id: 'dH', name: 'Hallway' }, { id: 'dC', name: 'Cafeteria' }, { id: 'dB', name: 'Bus loop' }],
  assignments: {
    'dH|Monday': 'Ada Quill', 'dC|Monday': 'Bram Sorrel', 'dB|Monday': 'Cleo Marsh',
    'dH|Tuesday': 'Bram Sorrel', 'dC|Tuesday': '', 'dB|Tuesday': 'Ada Quill',
  },
  staffSkip: { 'Cleo Marsh': true },
};

const boot = async (saved) => {
  await page.goto(BASE + '/index.html');
  await page.evaluate(([k, v]) => { localStorage.clear(); if (v) localStorage.setItem(k, JSON.stringify(v)); }, [KEY, saved]);
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page);
};
const showWeek = async (n) => { await page.selectOption('#weekPicker', String(n)); await settle(page, 50); };
const cell = (duty, day) => page.$eval(`#gridTable select[data-duty="${duty}"][data-day="${day}"]`, el => el.value);
const column = async (day) => [await cell('dH', day), await cell('dC', day), await cell('dB', day)];
const setCell = async (duty, day, v) => { await page.selectOption(`#gridTable select[data-duty="${duty}"][data-day="${day}"]`, v); await settle(page, 50); };
const saved = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
const edited = () => page.$$eval('#gridTable td.is-edited', els => els.length);

console.log('Duty Roster Builder — multi-week rotation');

/* ── 1. a roster saved before weeks existed ────────────────────────────── */
await boot(LEGACY);
eq(await column('Monday'), ['Ada Quill', 'Bram Sorrel', 'Cleo Marsh'], 'a saved roster loads as week 1: Monday intact');
eq(await column('Tuesday'), ['Bram Sorrel', '', 'Ada Quill'], 'and Tuesday, with its empty cell');
eq(await page.$eval('#weekPicker', el => el.options.length), 4, 'four weeks in the rotation by default');
eq(await page.$eval('#weekPicker', el => el.value), '1', 'week 1 is the one shown');
eq(await page.$$eval('#staffListWrap input[data-skip]:checked', els => els.length), 1, 'the skip flag survives');
eq((await saved()).assignments, LEGACY.assignments, 'nothing in the saved grid changed by loading');

/* ── 2. the rotation rule ──────────────────────────────────────────────── */
await showWeek(2);
eq(await column('Monday'), ['Cleo Marsh', 'Ada Quill', 'Bram Sorrel'], 'week 2 moves everyone down one duty and the last duty wraps to the first');
eq(await column('Tuesday'), ['Ada Quill', 'Bram Sorrel', ''], 'and an empty cell moves with the rest');
await showWeek(3);
eq(await column('Monday'), ['Bram Sorrel', 'Cleo Marsh', 'Ada Quill'], 'week 3 is week 2 moved down once more');
await showWeek(4);
eq(await column('Monday'), ['Ada Quill', 'Bram Sorrel', 'Cleo Marsh'], 'and week 4 of three duties is back to week 1');
eq(await edited(), 0, 'nothing is marked edited while every week is derived');
ok((await page.textContent('#weekNote')).includes('follows week 3'), 'the note says which week this one follows');
eq(await page.$eval('#resetWeekBtn', el => el.hidden), true, 'no reset button while nothing is edited');
ok((await page.$eval('#gridTable select', el => el.getAttribute('aria-label'))).includes('week 4'), 'each select names its week to a screen reader');

/* ── 3. an edit in week 1 reaches the weeks after it ───────────────────── */
await showWeek(1);
await setCell('dH', 'Monday', 'Bram Sorrel');
await showWeek(2);
eq(await cell('dC', 'Monday'), 'Bram Sorrel', 'an edit in week 1 carries into week 2');
await showWeek(3);
eq(await cell('dB', 'Monday'), 'Bram Sorrel', 'and on into week 3');
await showWeek(1);
await setCell('dH', 'Monday', 'Ada Quill');

/* ── 4. an edit in a later week stays, and carries forward ─────────────── */
await showWeek(2);
await setCell('dC', 'Monday', 'Cleo Marsh');
eq(await cell('dC', 'Monday'), 'Cleo Marsh', 'a hand edit in week 2 is what week 2 shows');
eq(await edited(), 1, 'it is marked as edited');
ok((await page.textContent('#gridTable td.is-edited')).includes('edited by hand'), 'in words, not by colour alone');
ok((await page.$eval('#gridTable td.is-edited select', el => el.getAttribute('aria-label'))).includes('edited by hand'), 'and to a screen reader');
ok((await page.textContent('#weekNote')).includes('1 cell was edited by hand'), 'the note counts it');
eq(await page.$eval('#resetWeekBtn', el => el.hidden), false, 'a reset button appears');
await showWeek(1);
eq(await column('Monday'), ['Ada Quill', 'Bram Sorrel', 'Cleo Marsh'], 'week 1 is not touched by an edit after it');
await showWeek(3);
/* Week 2 Monday is now [Cleo, Cleo, Bram]; week 3 moves that down one. */
eq(await column('Monday'), ['Bram Sorrel', 'Cleo Marsh', 'Cleo Marsh'], 'a week 2 edit carries into week 3 by the rotation');
eq(await edited(), 0, 'and week 3 is not marked edited');
await showWeek(1);
await setCell('dB', 'Monday', 'Bram Sorrel');
await showWeek(2);
eq(await column('Monday'), ['Bram Sorrel', 'Cleo Marsh', 'Bram Sorrel'], 'a later change in week 1 leaves the cell edited in week 2 as it was set and moves the rest');
eq(await edited(), 1, 'and it is still the one marked edited');
await showWeek(1);
await setCell('dB', 'Monday', 'Cleo Marsh');

/* ── 5. an edit that equals the rotation is not an edit ────────────────── */
await showWeek(3);
await setCell('dH', 'Monday', 'Cleo Marsh');
eq(await edited(), 1, 'week 3: a different name is an edit');
await setCell('dH', 'Monday', 'Bram Sorrel');
eq(await edited(), 0, 'putting back what the rotation gives makes the cell follow it again');

/* ── 6. reset a week to the rotation ───────────────────────────────────── */
await showWeek(2);
await page.click('#resetWeekBtn');
await settle(page, 50);
eq(await column('Monday'), ['Cleo Marsh', 'Ada Quill', 'Bram Sorrel'], 'Reset this week puts week 2 back on the rotation');
eq(await edited(), 0, 'and nothing is marked');
eq(Object.keys((await saved()).weekOverrides).length, 0, 'and nothing is left saved');

/* ── 7. counts follow the week shown ───────────────────────────────────── */
const counts = () => page.$$eval('#staffListWrap .staff-count', els => els.map(e => e.textContent));
eq((await counts())[0], '2 duties in week 2', 'the staff list counts the week shown');

/* ── 8. printing ───────────────────────────────────────────────────────── */
await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
await showWeek(2);
await setCell('dC', 'Monday', 'Cleo Marsh');
await page.click('#printMonthBtn');
eq(await page.evaluate(() => window.__printed), 1, 'Print the month prints');
eq(await page.$$eval('#printGrid .print-week', els => els.map(e => e.querySelector('h2').textContent)), ['Week 1', 'Week 2', 'Week 3', 'Week 4'], 'one headed table per week');
const monday = await page.$$eval('#printGrid table', els => els.map(t => [1, 2, 3].map(r => t.rows[r].cells[1].textContent)));
eq(monday[0], ['Ada Quill', 'Bram Sorrel', 'Cleo Marsh'], 'week 1 prints week 1');
eq(monday[1], ['Cleo Marsh', 'Cleo Marsh', 'Bram Sorrel'], 'week 2 prints its hand edit');
eq(monday[2], ['Bram Sorrel', 'Cleo Marsh', 'Cleo Marsh'], 'week 3 prints what it shows');
eq(monday[3], ['Cleo Marsh', 'Bram Sorrel', 'Cleo Marsh'], 'week 4 follows week 3');
ok((await page.textContent('#printSub')).includes('Weeks 1 to 4'), 'the sheet says which weeks it holds');
await page.click('#printBtn');
eq(await page.$$eval('#printGrid .print-week h2', els => els.map(e => e.textContent)), ['Week 2'], 'Print this week prints only the week shown');

/* The month on paper: print media, US Letter at 96 dpi, margins of half an inch. */
await page.emulateMedia({ media: 'print' });
await page.setViewportSize({ width: 720, height: 960 });
await page.evaluate(() => document.getElementById('printMonthBtn').click());
await settle(page, 100);
const paper = await page.evaluate(() => {
  const area = document.getElementById('printArea');
  const rects = [...area.querySelectorAll('.print-week')].map(e => e.getBoundingClientRect());
  return {
    shown: getComputedStyle(area).display,
    overflowX: area.scrollWidth > area.clientWidth + 1,
    smallest: Math.min(...[...area.querySelectorAll('td, th')].map(e => parseFloat(getComputedStyle(e).fontSize))),
    avoidBreak: [...area.querySelectorAll('.print-week')].every(e => getComputedStyle(e).breakInside === 'avoid'),
    tops: rects.map(r => Math.round(r.top)),
  };
});
eq(paper.shown, 'block', 'the sheet is the only thing shown in print');
eq(paper.overflowX, false, 'a month fits the page width');
ok(paper.smallest >= 12, `table text is at least 12px in print (smallest ${paper.smallest}px)`);
eq(paper.avoidBreak, true, 'a week never splits across pages');
ok(paper.tops.every((t, i) => i === 0 || t > paper.tops[i - 1]), 'the weeks follow one another down the page');
await page.emulateMedia({ media: 'screen' });
await page.setViewportSize({ width: 1280, height: 900 });

/* ── 9. the number of weeks ────────────────────────────────────────────── */
await page.selectOption('#weeksCount', '2');
await settle(page, 50);
eq(await page.$eval('#weekPicker', el => el.options.length), 2, 'two weeks in the rotation: two to pick from');
await page.click('#printMonthBtn');
eq(await page.$$eval('#printGrid .print-week', els => els.length), 2, 'and two printed');
eq((await saved()).weeks, 2, 'the count is saved');
await page.selectOption('#weeksCount', '1');
await page.click('#printMonthBtn');
ok((await page.textContent('#printSub')).startsWith('Week 1 ·'), 'a one-week rotation prints as week 1');
await page.selectOption('#weeksCount', '4');

/* ── 10. clear ─────────────────────────────────────────────────────────── */
await showWeek(2);
await page.evaluate(() => { window.confirm = () => true; });
await page.click('#clearGridBtn');
await settle(page, 50);
eq(await edited(), 0, 'Clear grid takes the hand edits with it');
eq(await column('Monday'), ['', '', ''], 'and empties every week');

/* ── 11. a link carries weeks and edits, and an old link still loads ───── */
const mk = (payload) => page.evaluate(([p, base]) => base + '?duties=' + encodeURIComponent(window.StateLink.encodeState(p)), [payload, URL_PAGE]);
const withEdits = Object.assign({}, LEGACY, { weeks: 3, weekOverrides: { 2: { 'dC|Monday': 'Cleo Marsh', 'gone|Monday': 'Ada Quill', 'dB|Monday': 'Nobody Here' } } });
await boot(null);
await page.goto(await mk(withEdits), { waitUntil: 'networkidle' });
await settle(page);
let got = await saved();
eq(got.weeks, 3, 'a link carries the number of weeks');
eq(got.weekOverrides, { 2: { 'dC|Monday': 'Cleo Marsh' } }, 'and a hand edit, dropping one for a duty or a person that did not travel');
await showWeek(2);
eq(await cell('dC', 'Monday'), 'Cleo Marsh', 'which shows as an edit in the receiving week');
await boot(null);
await page.goto(await mk(LEGACY), { waitUntil: 'networkidle' });
await settle(page);
got = await saved();
/* An empty cell and an absent one are the same thing, and an arrival has always left the empty ones out. */
const filled = Object.fromEntries(Object.entries(LEGACY.assignments).filter(([, v]) => v));
eq(got.assignments, filled, 'a link made before weeks existed arrives with its week 1');
eq(got.weeks, 4, 'and the default number of weeks');

/* ── console ───────────────────────────────────────────────────────────── */
eq(page.__errs, [], 'no page errors, failed requests or console errors');
eq(page.__blocked, [], 'no offsite requests');

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
