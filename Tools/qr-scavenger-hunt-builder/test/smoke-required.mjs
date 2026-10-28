// smoke-required.mjs — 018's free-order required set (Path 18 P3, v389).
//
//   node Tools/qr-scavenger-hunt-builder/test/smoke-required.mjs      (or: npm run test:scavenger-hunt-required)
//
// A hunt may star some stations as required (`required`, a list of station ids; Stations.progress()
// reads it). Cases: a hunt with no star behaves as it always did (every station counts, "n / total",
// the leaderboard's finish); starring a row writes ids on disk and shows the star pressed; the
// leaderboard counts required stations ("1 / 2") with a bonus note for the rest, ranks by required
// reached, and a team is Finished when it has every starred station and not before; Live Run's
// "next up" skips a bonus station; the route card marks bonus stops; un-starring the last one deletes
// the field; moving a row keeps its star (ids, not positions); a reload keeps it. No console errors.
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import * as F from '../../stations/test/_fixtures.mjs';

const PORT = 8571;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/018-qr-scavenger-hunt-builder.html';
const KEY = 'qr-scavenger-hunt-sets';
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
page.on('dialog', d => d.accept());

const seed = (hunt) => page.evaluate(([k, h]) => {
  localStorage.setItem(k, JSON.stringify({ current: h.name, sets: { [h.name]: h } }));
}, [KEY, hunt]);
const saved = () => page.evaluate((k) => { const o = JSON.parse(localStorage.getItem(k)); return o.sets[o.current]; }, KEY);
const open = async () => { await page.goto(URL_PAGE, { waitUntil: 'load' }); await settle(page, 400); };
const board = async () => page.locator('#leaderboard-body tr').evaluateAll(rs => rs.map(r => Array.from(r.cells).map(c => c.textContent.trim())));
const runTab = async () => { await page.locator('#tab-run').click(); await settle(page, 200); };
const buildTab = async () => { await page.locator('#tab-build').click(); await settle(page, 200); };
const star = async (n) => { await page.locator(`[data-required-toggle="${n}"]`).click(); await settle(page, 200); };

console.log('018 — no star: as it always was');
await page.goto(URL_PAGE, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await seed(F.H2()); await open();
eq(await page.locator('[data-required-toggle][aria-pressed="true"]').count(), 0, 'no row starts starred');
ok(!('required' in (await saved())), 'nothing written to disk');
await runTab();
let rows = await board();
eq(rows.map(r => r[1] + ' ' + r[2]), ['Team 1 2 / 3', 'Team 2 1 / 3', 'Team 3 0 / 3'], 'leaderboard counts every station');
eq(rows.map(r => r[5]), ['In progress', 'In progress', 'Not started'], 'and nobody is finished');

console.log('018 — starring stations 2 and 3');
await buildTab();
await star(1); await star(2);
eq(await page.locator('[data-required-toggle][aria-pressed="true"]').count(), 2, 'two rows show pressed');
const d1 = await saved();
eq(d1.required, [d1.stations[1].id, d1.stations[2].id], 'required holds their ids');
await runTab();
rows = await board();
eq(rows.map(r => r[1] + ' ' + r[2]), ['Team 1 1 / 2 (+1 bonus)', 'Team 2 1 / 2', 'Team 3 0 / 2'], 'leaderboard counts required stations, the rest as bonus');
ok(/Next up: Station 3/.test(await page.locator('#team-progress-list .tp-status').nth(0).textContent()), 'Team 1 is sent to the one required station it lacks');
ok(/Next up: Station 2/.test(await page.locator('#team-progress-list .tp-status').nth(1).textContent()), 'Team 2 (reached 3 first) is sent to 2: order is free');

console.log('018 — finishing needs the required ones, not the bonus one');
await page.locator('#team-progress-list .station-btn[data-team="1"][data-station="1"]').click();
await settle(page, 200);
rows = await board();
eq(rows[0].slice(1, 3), ['Team 2', '2 / 2'], 'Team 2 now has both starred stations');
eq(rows[0][5], 'Finished', 'and is Finished without station 1');
ok(rows.slice(1).every(r => r[5] !== 'Finished'), 'the others are not');
ok(/All required stations complete/.test(await page.locator('#team-progress-list .tp-status').nth(1).textContent()), 'Live Run says so');

console.log('018 — the route card marks the bonus stop');
await page.evaluate(() => { window.print = () => {}; });
await page.locator('#print-routes-btn').click();
await settle(page, 300);
const route = await page.locator('#print-routes-grid .p-card').first().locator('li').allTextContents();
eq(route.filter(t => /\(bonus\)/.test(t)).length, 1, 'one stop on the route card is a bonus');
ok(/Igneous \(bonus\)/.test(route.join('|')), 'it is the unstarred one');

console.log('018 — a move keeps the star on the station; a reload keeps it');
await buildTab();
await page.locator('tr[data-idx="1"] [data-move="-1"]').click();
await settle(page, 200);
let d2 = await saved();
eq(d2.required.slice().sort(), d1.required.slice().sort(), 'the ids are the same after a move');
eq(await page.locator('tr[data-idx="0"] [data-required-toggle]').getAttribute('aria-pressed'), 'true', 'the star moved with its row');
await open();
eq((await saved()).required.slice().sort(), d1.required.slice().sort(), 'still starred after a reload');

console.log('018 — un-starring the last one removes the field');
await star(0); await star(2);
d2 = await saved();
ok(!('required' in d2), 'required is gone once none is starred');

ok(page.__errs.length === 0, 'no console errors' + (page.__errs.length ? ': ' + page.__errs.join(' | ') : ''));
await browser.close(); server.close();
console.log(`scavenger hunt required set: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
