// smoke-projector.mjs — the Gallery Walk's projector rotation display.
//
//   node Tools/gallery-walk-qr/test/smoke-projector.mjs
//
// The rotation timer already worked; it was in the wrong place. The teacher
// running a gallery walk is across the room and the students are the ones who
// need to know when to move and where to go next, and both of those lived in a
// 2.6rem clock on the laptop.
//
// Two things are under test. First, that the projector is a *view* and not a
// second implementation: it must show the same clock as the panel behind it,
// and its buttons must drive the panel's own timer rather than a copy that can
// drift. Second, the placement arithmetic — where each group is standing right
// now — which is derived from the same staggered-start order the printed route
// cards use, and which is wrong in a way nobody notices until a class of
// twenty-eight walks to the wrong wall.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8194;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/017-gallery-walk-qr.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const same = (a, b, label) => eq(JSON.stringify(a), JSON.stringify(b), label);

const STATIONS = ['Dioramas', 'Timelines', 'Posters', 'Models'];
const WALKERS = ['Ada Lovelace', 'Marco Polo', 'Nellie Bly', 'Zheng He', 'Grace Hopper', 'Ida B Wells'];

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1500, height: 950 });

console.log('Gallery Walk — projector rotation display');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await page.evaluate(w => localStorage.setItem('np_rosters', JSON.stringify({ 'Period 3': w })), WALKERS);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);

/* ── build a four-station walk with six walkers ────────────────────────── */
for (let i = 0; i < STATIONS.length; i++) {
  while ((await page.$$('#entriesBody tr')).length <= i) { await page.click('#addRowBtn'); await settle(page, 80); }
  const row = (await page.$$('#entriesBody tr'))[i];
  await row.$eval('.f-name', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, STATIONS[i]);
  await row.$eval('.f-value', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); },
    'https://example.org/' + STATIONS[i].toLowerCase());
}
await settle(page, 500);
await page.fill('#timerRotations', '4');
await page.dispatchEvent('#timerRotations', 'change');
await settle(page, 200);

/* ── 1. it opens, and closes the way a projected thing has to ──────────── */
ok(!(await page.isVisible('#projectorView')), 'the projector is out of the way until asked for');
await page.click('#projectorBtn');
await settle(page, 250);
ok(await page.isVisible('#projectorView'), 'the button opens it');
eq(await page.getAttribute('#projectorView', 'aria-hidden'), 'false', 'and it is exposed to assistive tech when open');

/* ── 2. it is a view of the panel, not a second timer ──────────────────── */
const panelClock = () => page.textContent('#timerClock');
const boardClock = () => page.textContent('#pjClock');
eq(await boardClock(), await panelClock(), 'the board shows the panel’s clock');
eq(await page.textContent('#pjRound'), await page.textContent('#timerRound'), 'and the panel’s round label');

await page.click('#pjStart');
await settle(page, 400);
ok(await page.isVisible('#pjPause'), 'Start on the board starts the run');
ok(!(await page.isVisible('#timerStartBtn')), 'and the panel behind it agrees it is running');
eq(await boardClock(), await panelClock(), 'the two clocks stay in step while it runs');

await page.click('#pjPause');
await settle(page, 300);
ok(await page.isVisible('#pjResume'), 'Pause is honoured');
ok(await page.isVisible('#timerResumeBtn'), 'by the same timer, not a copy of it');
const held = await boardClock();
await settle(page, 700);
eq(await boardClock(), held, 'and a paused clock does not keep counting on the board');
await page.click('#pjResume');
await settle(page, 300);

/* ── 3. where everybody is standing right now ──────────────────────────── */
/* Nobody is placed until there are names to place — the tool has to say that
   rather than showing four empty boxes and letting a teacher assume it is
   broken. */
ok(/Load names/.test(await page.textContent('#pjBody')), 'with no walking order, it says what is missing');

await page.click('#pjExit');
await settle(page, 200);
await page.selectOption('#walkRosterSelect', 'Period 3');
await page.click('#walkRosterLoadBtn');
await settle(page, 300);
await page.click('#projectorBtn');
await settle(page, 300);

/** Station number -> the names standing there, read off the board. */
const board = () => page.$$eval('.pj-station', els => els.map(el => ({
  station: el.querySelector('.pj-st-num').textContent.trim(),
  name: el.querySelector('.pj-st-name').textContent.trim(),
  who: Array.from(el.querySelectorAll('.pj-who')).map(w => w.innerHTML.split('<br>')).flat(),
})));

const first = await board();
eq(first.length, 4, 'one card per station');
same(first.map(s => s.station), ['Station 1', 'Station 2', 'Station 3', 'Station 4'], 'numbered the way the route cards number them');
same(first.map(s => s.name), STATIONS, 'and named');
/* Six walkers over four stations on a staggered start: walker i begins at
   station (i mod 4) + 1, so 1 and 2 get a second body and 3 and 4 get one. */
same(first.map(s => s.who.length), [2, 2, 1, 1], 'the staggered start fans them out instead of queueing everyone at Station 1');
same(first[0].who, ['Ada Lovelace', 'Grace Hopper'], 'listed alphabetically, so a student finds their own name once');

/* ── 4. rotating moves everybody forward one station ───────────────────── */
await page.click('#pjRotate');
await settle(page, 300);
const second = await board();
eq(await page.textContent('#pjRound'), 'Rotation 2 of 4', 'the round advances');
same(second[1].who, first[0].who, 'everyone at Station 1 is now at Station 2');
same(second[0].who, first[3].who, 'and the far end wraps round to the front');
ok(await page.isVisible('#pjBanner'), 'a rotation is announced on the board, not only in the speaker');
ok(/ROTATE/.test(await page.textContent('#pjBanner')), 'in a word readable from the back of the room');

/* The announcement clears itself — a banner still up two minutes later is
   worse than none, because the room stops believing it. */
await settle(page, 2800);
ok(!(await page.isVisible('#pjBanner')), 'and it clears itself a few seconds later');

/* ── 5. the end of the walk ────────────────────────────────────────────── */
/* One rotation has already been called; three more spends the four the timer
   was set to. The stop index holds at the last one rather than running off the
   end of the route, so the room can still see where it finished. */
for (let i = 0; i < 3; i++) { await page.click('#pjRotate'); await settle(page, 200); }
await settle(page, 300);
eq(await page.evaluate(() => document.getElementById('pjRotate').disabled), true,
   'once the last rotation is called, there is nowhere left to send anybody');
ok(/complete/i.test(await page.textContent('#pjRound')), 'and the board says the walk is over');
const last = await board();
eq(last.length, 4, 'the final placement stays on screen rather than emptying out');
eq(last.reduce((n, s) => n + s.who.length, 0), WALKERS.length, 'with everybody still accounted for');

/* ── 6. Escape gets you back to the editor ─────────────────────────────── */
await page.keyboard.press('Escape');
await settle(page, 250);
ok(!(await page.isVisible('#projectorView')), 'Escape closes it — the way out has to work without hunting for a button');
eq(await page.evaluate(() => document.activeElement && document.activeElement.id), 'projectorBtn',
   'and focus comes back to where it left from');

/* ── 7. it is a screen thing and must never reach paper ────────────────── */
await page.click('#projectorBtn');
await settle(page, 200);
await page.emulateMedia({ media: 'print' });
eq(await page.evaluate(() => getComputedStyle(document.getElementById('projectorView')).display), 'none',
   'the projector is hidden when printing — it sits outside .wrap, so the print rule that hides everything else misses it');
await page.emulateMedia({ media: 'screen' });
await settle(page, 200);

/* ── 8. no stations yet ────────────────────────────────────────────────── */
await page.click('#pjExit');
for (const i of [3, 2, 1, 0]) {
  const btn = await page.$(`[data-remove="${i}"]`);
  if (btn) { await btn.click(); await settle(page, 120); }
}
await settle(page, 300);
await page.click('#projectorBtn');
await settle(page, 250);
ok(/Add some stations/.test(await page.textContent('#pjBody')),
   'an empty gallery says so instead of projecting a blank wall');

/* ── 9. no console noise, nothing left the site ────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
