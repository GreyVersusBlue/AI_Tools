// smoke-seating-board.mjs — the Behavior & Points Tracker's seating-chart
// board layout, driven in a real page.
//
//   node Tools/behavior-points-tracker/test/smoke-seating-board.mjs
//
// Tools/behavior-points-tracker/test/smoke-seating-layout.mjs already covers
// the pure matching/layout math under plain Node; this suite covers the part
// that can only be seen in a browser: switching the "Layout" control actually
// repositions real tap targets, tapping one still awards points through the
// same delegated click handler the sorted grid uses, and — the part that
// matters most — a missing or corrupt `seating-chart-v1` never breaks the
// board, it just falls back to the layout this tool has always had.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8300;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/008-behavior-points-tracker.html';
const SEATING_KEY = 'seating-chart-v1';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

console.log('Behavior & Points Tracker — seating-chart board layout');

/* Two rows of two desks; one student on the roster has no desk at all, and
   one desk's student is not on this section's roster — both halves of the
   "a student isn't in it" fallback. */
const desk = (id, x, y, rot) => ({ id, x, y, rot: rot || 0, locked: false });
const CHART = {
  active: 's1',
  mirror: false,
  sections: [
    {
      id: 's1', name: 'Period 3 — Earth Science',
      students: [
        { id: 'c1', name: 'Aiden Whitfield' },
        { id: 'c2', name: 'Brooklyn Bell' },
        { id: 'c3', name: 'Someone Not On This Roster' },
      ],
      apart: [], together: [],
      desks: [desk('d1', 200, 200), desk('d2', 340, 200), desk('d3', 200, 320)],
      assign: { d1: 'c1', d2: 'c2', d3: 'c3' },
      layouts: [],
    },
    {
      id: 's2', name: 'Period 5 — Honors GT',
      students: [{ id: 'h1', name: 'Yusuf Yilmaz' }],
      apart: [], together: [],
      desks: [desk('e1', 200, 200)],
      assign: { e1: 'h1' },
      layouts: [],
    },
  ],
};

const seedChart = (chart) => page.evaluate(([key, c]) => {
  if (c === null) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(c));
}, [SEATING_KEY, chart]);

const seatCards = () => page.$$eval('.seat-room .student-card.seat-card', els =>
  els.map(el => ({ name: el.dataset.name, style: el.getAttribute('style') })));
const gridCardNames = () => page.$$eval('#studentGrid > .student-card:not(.seat-card)', els => els.map(el => el.dataset.name));
const section = () => page.evaluate(() => {
  const store = JSON.parse(localStorage.getItem('behavior-points-tracker-sections'));
  return store.sets[store.current];
});

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

/* Build a roster directly (no Name Picker roster involved yet) so the chart's
   own section-name match — not the rosterName shortcut — is what's under
   test first. */
await page.fill('#setName', 'Period 3 — Earth Science');
await page.evaluate(() => document.getElementById('setName').dispatchEvent(new Event('change')));
await page.fill('#namesInput', ['Aiden Whitfield', 'Brooklyn Bell', 'Casey Nguyen'].join('\n'));
await settle(page, 200);

/* ── 1. no chart saved yet: the board is the ordinary sorted grid, and ────
   switching Layout to "Seating chart" changes nothing about the tap targets
   themselves — it just explains why. ─────────────────────────────────────── */
await page.selectOption('#layoutMode', 'seating');
await settle(page, 200);
eq((await seatCards()).length, 0, 'with no chart saved, no seat cards are drawn');
eq((await gridCardNames()).sort(), ['Aiden Whitfield', 'Brooklyn Bell', 'Casey Nguyen'], 'the ordinary sorted cards are still there instead');
ok(await page.isVisible('#seatingNote'), 'a note explains why, rather than a blank board');
ok(/No seating chart saved yet/.test(await page.textContent('#seatingNote')), 'and says there is no chart yet, specifically');
eq(page.__errs.length, 0, 'no console/page errors from a missing chart: ' + JSON.stringify(page.__errs.slice(0, 4)));

/* ── 2. a corrupt chart behaves exactly the same way — never a throw ─────── */
await page.evaluate((key) => localStorage.setItem(key, '{not json at all'), SEATING_KEY);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
await page.fill('#namesInput', ['Aiden Whitfield', 'Brooklyn Bell', 'Casey Nguyen'].join('\n'));
await page.selectOption('#layoutMode', 'seating');
await settle(page, 200);
eq((await seatCards()).length, 0, 'a hand-corrupted chart also falls back rather than breaking the page');
eq(page.__errs.length, 0, 'still no console/page errors: ' + JSON.stringify(page.__errs.slice(0, 4)));

/* ── 3. a real chart: matched students land on the room, on the layout ──── */
await seedChart(CHART);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
await page.selectOption('#layoutMode', 'seating');
await settle(page, 300);

const seated = await seatCards();
eq(seated.length, 2, 'two roster names match a desk in this chart section');
ok(seated.some(s => s.name === 'Aiden Whitfield'), 'Aiden is one of them');
ok(seated.some(s => s.name === 'Brooklyn Bell'), 'Brooklyn is the other');
ok(seated.every(s => /left:[\d.]+%/.test(s.style) && /top:[\d.]+%/.test(s.style)), 'each seated card is positioned with a left/top percentage, not left to the grid');

const unseated = await gridCardNames();
eq(unseated, ['Casey Nguyen'], 'the roster name this chart section has never heard of comes back as an ordinary tappable card below the room, not dropped');
ok(/Not on the seating chart yet/.test(await page.textContent('#studentGrid')), 'and is labeled as such');
ok(!(await page.textContent('#studentGrid')).includes('Someone Not On This Roster'),
   'the chart\'s own student who isn\'t on this roster never appears on the board at all');

/* ── 4. tapping a seated card still awards points — same delegated handler,
   just a different position on screen. ──────────────────────────────────── */
await page.click('.seat-room .student-card[data-name="Aiden Whitfield"]');
await settle(page, 300);
let st = await section();
eq(st.points['Aiden Whitfield'], 1, 'tapping a card inside the seating room awards a point exactly like the grid does');
eq(st.boardLayout, 'seating', 'the chosen layout is remembered on the section');

/* ── 5. a second chart section: the picker appears, and switching redraws ── */
ok(await page.isVisible('#seatingSectionPick'), 'with more than one chart section saved, a picker to choose between them appears');
await page.selectOption('#seatingSectionPick', 's2');
await settle(page, 200);
eq(st = await section(), st, st); // no-op, keep eslint-free var usage clear below
st = await section();
eq(st.seatingSectionId, 's2', 'picking a different chart section is remembered on the tracker section');
const afterSwitch = await seatCards();
eq(afterSwitch.length, 0, 'switching to a chart section with none of this roster on it: nobody seated');
ok(/No seats matched/.test(await page.textContent('#seatingNote')), 'and the note explains a mismatch rather than a missing chart');

/* ── 6. switching back to Sorted list restores the plain grid untouched ──── */
await page.selectOption('#layoutMode', 'sorted');
await settle(page, 200);
eq((await seatCards()).length, 0, 'no seat cards once switched back to the sorted layout');
eq((await gridCardNames()).sort(), ['Aiden Whitfield', 'Brooklyn Bell', 'Casey Nguyen'], 'every student is back in the ordinary grid');
ok(!(await page.isVisible('#seatingNote')), 'and the seating note is hidden again');
ok(!(await page.isVisible('#seatingSectionPick')), 'along with the chart picker');

/* ── 7. no console noise across the whole run ────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
