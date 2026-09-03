// smoke-seating-panel.mjs — the Command Center's read-only seating chart panel.
//
//   node Tools/command-center/test/smoke-seating-panel.mjs
//
// The panel's whole claim is "the chart for the period you are standing in
// front of, without touching anything". Two halves of that can rot silently:
// the read of another tool's storage key (`seating-chart-v1`, owned by
// 005-Seating Chart Generator — a shape this page does not control and must
// never write), and the choice of *which* section to draw, which depends on
// the wall clock and on names a teacher typed in two different tools.
//
// So this seeds a real chart, pins the bell schedule around the actual current
// time, and reads what came out of the SVG.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8188;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/010-command-center-dashboard.html';

const SETTINGS_KEY = 'gvb-command-center:settings';
const SEATING_KEY = 'seating-chart-v1';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });

/* The page's clock is pinned to 10:00 today. The bell-schedule fixture below is
   built as HH:MM offsets around "now", and HH:MM cannot express a period that
   crosses midnight: run this suite after 23:20 local and Period 2's end wraps
   to 00:xx, sorts before its start, and no period is current. That is exactly
   what happened in pass 5 of the first five-pass measurement (suite 45 of 121
   landed at 23:28 UTC) and it reproduces on demand with TZ=UTC at 23:41.
   Pinning the page's Date (timers keep running) makes "now" a real mid-morning
   moment on every run, which is the case the panel exists for anyway. */
const NOW = new Date(); NOW.setHours(10, 0, 0, 0);
await page.clock.setFixedTime(NOW);

console.log('Command Center — seating chart panel');

/* Two sections, because picking the right one is most of the feature. The
   desks are laid out in two rows of three in the generator's own coordinate
   space; one is turned 90 degrees, one student is flagged, and one is on the
   roster but not in a seat. */
const desk = (id, x, y, rot) => ({ id, x, y, rot: rot || 0, locked: false });
const CHART = {
  active: 's-academic',
  mirror: false,
  numbered: false,
  sections: [
    {
      id: 's-academic', name: 'Academic',
      students: [
        { id: 'a1', name: 'Nadia Okonjo', note: '', flag: false },
        { id: 'a2', name: 'Beckett Hale', note: '', flag: true },
        { id: 'a3', name: 'Priya Raghunathan-Whitfield', note: '', flag: false },
        { id: 'a4', name: 'Tomas Vergara', note: '', flag: false },
        { id: 'a5', name: 'Solenne Adeyemi', note: '', flag: false },
      ],
      apart: [], together: [],
      desks: [desk('d1', 200, 200), desk('d2', 340, 200), desk('d3', 480, 200, 90),
              desk('d4', 200, 320), desk('d5', 340, 320)],
      assign: { d1: 'a1', d2: 'a2', d3: 'a3', d5: 'a4' },
      layouts: [],
    },
    {
      id: 's-honors', name: 'Honors GT',
      students: [{ id: 'h1', name: 'Wren Castellanos', note: '', flag: false }],
      apart: [], together: [],
      desks: [desk('e1', 200, 200), desk('e2', 340, 200)],
      assign: { e1: 'h1' },
      layouts: [],
    },
  ],
};

/* The bell schedule is built around the page's (pinned) "now", so "the period
   you are standing in front of" is a real answer and not a fixture that goes
   stale at 3pm. Period 2 is now; period 1 is behind us. */
const seed = async (extraSettings = {}) => {
  await page.evaluate(([chart, settingsKey, seatingKey, extra]) => {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const at = offsetMin => {
      const d = new Date(now.getTime() + offsetMin * 60000);
      return pad(d.getHours()) + ':' + pad(d.getMinutes());
    };
    localStorage.setItem(seatingKey, JSON.stringify(chart));
    localStorage.setItem(settingsKey, JSON.stringify(Object.assign({
      periods: [
        { id: 'p1', label: 'Period 1', start: at(-90), end: at(-45), roster: '' },
        { id: 'p2', label: 'Period 2', start: at(-5), end: at(40), roster: 'Honors GT' },
        { id: 'p3', label: 'Period 3', start: at(45), end: at(90), roster: 'Academic' },
      ],
    }, extra)));
  }, [CHART, SETTINGS_KEY, SEATING_KEY, extraSettings]);
};

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);
await seed();
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 500);

/* ── the panel is there, and arrives switched on ───────────────────────── */
const panel = '[data-panel="seating"]';
ok(await page.isVisible(panel), 'the seating panel is on the board without being switched on by hand');
ok((await page.textContent(panel + ' .card-title')).includes('Seating Chart'), 'and is titled');
ok(await page.isVisible(panel + ' a[href*="Seating%20Chart"]'), 'with a way through to the real tool');

/* ── it draws the chart for the period we are actually in ──────────────── */
/* Period 2 is running and maps to the roster "Honors GT"; the chart has a
   section of that name, so that is the one on screen — not the chart's own
   `active` section, which is Academic. */
const body = () => page.textContent(panel + ' .panel-body');
/* A name is drawn as two <text> elements — given name over surname — so the
   panel's textContent runs them together. Read the labels as a list instead. */
const labels = () => page.$$eval(panel + ' .seat-map text', els => els.map(e => e.textContent));
ok((await body()).includes('Honors GT'), 'the period’s own class is the one drawn, not the chart’s last-open section');
ok((await labels()).includes('Castellanos'), 'with that section’s student on a desk');
eq(await page.$$eval(panel + ' .seat-map rect', r => r.length), 2, 'one rect per desk in that section');
ok(!(await labels()).includes('Okonjo'), 'and nobody from the other section leaks in');

/* ── the picker overrides it, and the override is remembered per period ── */
await page.selectOption(panel + ' #seatingPick', 's-academic');
await settle(page, 250);
eq(await page.$$eval(panel + ' .seat-map rect', r => r.length), 5, 'choosing the other section redraws it');
ok((await labels()).includes('Beckett'), 'with its students');

await page.reload({ waitUntil: 'networkidle' });
await settle(page, 500);
eq(await page.inputValue(panel + ' #seatingPick'), 's-academic',
   'the choice survives a reload — a teacher sets it once per period, not once per glance');
const stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), SETTINGS_KEY);
eq(stored.seatingByPeriod && stored.seatingByPeriod.p2, 's-academic',
   'and is filed against the period it was made in, so 3rd period is free to be a different class');

/* ── what the drawing actually says ────────────────────────────────────── */
const svg = await page.$eval(panel + ' .seat-map', el => el.outerHTML);
ok(/FRONT OF ROOM/.test(await page.textContent(panel)), 'the room is oriented, the way the generator orients it');
ok(/stroke-dasharray/.test(svg), 'the empty desk is drawn dashed rather than left out');
ok((svg.match(/stroke-width="3\.5"/g) || []).length === 1, 'exactly one desk is marked out — the flagged student’s');
ok(/rotate\(90 /.test(svg), 'a desk turned in the generator is turned here too');
ok((await page.textContent(panel)).includes('4 of 5 seats filled'), 'the seat count is stated');
ok((await page.textContent(panel)).includes('Not seated: Solenne Adeyemi'),
   'and a student on the roster with no desk is named rather than silently missing');

/* ── a name too long for a desk is squeezed, not spilled ───────────────── */
const fitted = await page.$$eval(panel + ' .seat-map text', els =>
  els.map(e => [e.textContent, e.getAttribute('textLength')]));
const long = fitted.filter(t => t[0] === 'Raghunathan-Whitfield');
const short = fitted.filter(t => t[0] === 'Hale');
eq(long.length, 1, 'the double-barrelled surname is on the chart');
ok(long[0] && long[0][1] !== null, 'and is given a textLength so it stays inside its desk');
ok(short[0] && short[0][1] === null, 'while a name that already fits is left at its natural width');

/* ── mirrored charts reflect the room, not the writing ─────────────────── */
const before = await page.$$eval(panel + ' .seat-map rect', els => els.map(e => Number(e.getAttribute('x'))));
await page.evaluate(([chart, key]) => {
  localStorage.setItem(key, JSON.stringify(Object.assign({}, chart, { mirror: true })));
}, [CHART, SEATING_KEY]);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 500);
const after = await page.$$eval(panel + ' .seat-map rect', els => els.map(e => Number(e.getAttribute('x'))));
ok(before.join() !== after.join(), 'the student’s-eye view moves the desks');
eq(Math.min(...before) + Math.max(...before), Math.min(...after) + Math.max(...after),
   'by reflecting them across the room rather than shifting them');
ok((await labels()).includes('Beckett'),
   'and the names stay readable rather than coming out backwards');

/* ── the two ways there is nothing to draw ─────────────────────────────── */
await page.evaluate(([key, chart]) => {
  const empty = JSON.parse(JSON.stringify(chart));
  empty.sections[0].desks = [];
  empty.sections.splice(1, 1);
  localStorage.setItem(key, JSON.stringify(empty));
}, [SEATING_KEY, CHART]);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 500);
ok(/no desks placed yet/.test(await body()), 'a section with a roster but no desks says so');

await page.evaluate(k => localStorage.removeItem(k), SEATING_KEY);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 500);
ok(/No seating chart saved yet/.test(await body()), 'and no chart at all points at the tool that makes one');

/* Junk in the key is somebody else's bad write, and must not take the page
   down with it — the panel is one of nine on a board a teacher is relying on. */
await page.evaluate(k => localStorage.setItem(k, '{"sections":'), SEATING_KEY);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 500);
ok(await page.isVisible(panel), 'an unparseable chart leaves the panel standing');
ok(/No seating chart saved yet/.test(await body()), 'reading as "nothing saved"');

/* ── it is read-only ───────────────────────────────────────────────────── */
eq(await page.evaluate(k => localStorage.getItem(k), SEATING_KEY), '{"sections":',
   'and this page never writes the other tool’s key, not even to repair it');

/* ── projector mode ────────────────────────────────────────────────────── */
await page.evaluate(([chart, key]) => localStorage.setItem(key, JSON.stringify(chart)), [CHART, SEATING_KEY]);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 500);
await page.click('#projectorBtn');
await settle(page, 300);
ok(await page.isVisible(panel + ' .seat-map'), 'the map survives into projector mode');
ok(!(await page.isVisible(panel + ' #seatingPick')), 'with the picker out of the room’s way');

/* ── no console noise, nothing left the site ───────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
