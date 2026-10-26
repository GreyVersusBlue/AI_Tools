// smoke-evacuation.mjs — evacuation route planner / door cards for the
// School Layout Visualizer.
//
//   node Tools/schedule-visualizer/test/smoke-evacuation.mjs
//
// In `npm test` (suites.json) and `npm run test:schedule-visualizer`.
//
// Reuses the schedule suite's Northwind fixture. Marks one hallway tile on
// its ground-floor corridor as an exterior exit, then checks:
//   - collectExitPoints() finds it, with its label and assembly point
//   - computeEvacuationRouteForRoom() finds a real astar() path from a room
//     on the same floor to that exit
//   - buildEvacuationSteps() turns the path into readable turn-by-turn text
//     ending in "Exit at <label>"
//   - a room with NO reachable exit (nothing marked on its floor, no
//     staircase teleport to one that is) correctly comes back null instead
//     of throwing
//   - Path 11 P4: the "Evacuation Cards" button opens the print kit's preview
//     of one card per room on both floors (first and second way out, the
//     step-free way out, assembly points as typed, a map of a floor not on
//     screen), the preview's page count matches Chromium's PDF, the school's
//     plan from Settings prints as text, and with no exit marked the sheet
//     says so; zero console errors and zero offsite requests
//   - Path 11 P4 increments 2 and 3: "Lockdown Maps" previews one page per
//     floor with a picture of each floor, the building's note from Settings
//     and a room's note from its panel, as text, and nothing of its own;
//     "Door Signs" previews two signs to a page, every teacher or the one
//     chosen; each preview's page count matches Chromium's PDF
//
// Exits 1 on any failure.

/* global applyFullProject, roomRegistry, AppState, getPathfindingGraph -- page globals read inside page.evaluate() */
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import { fixtureProject } from './fixture-northwind.mjs';

const PORT = 8155;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/035-schedule-visualizer.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 900 });

await page.context().addInitScript(() => {
  try { localStorage.setItem('stviz_onboarded', '1'); } catch (e) { /* storage blocked */ }
});

console.log('School Layout Visualizer — evacuation route planner');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* ── 1. load the fixture, mark one hallway tile as an exterior exit ─────── */
await page.evaluate(project => { applyFullProject(project); }, fixtureProject());
await settle(page, 300);
const roomsNow = await page.evaluate(() => roomRegistry.length);
ok(roomsNow >= 10, `the fixture loaded (${roomsNow} rooms)`);

// Northwind's floor_0 corridor is hallway tiles at row 4, cols 1-14
// (staircases sit at col 0 and col 15) — see fixture-northwind.mjs.
await page.evaluate(() => {
  const floor = AppState.blueprint.floors.find(f => f.id === 'floor_0');
  const tile = floor.gridData[4][3];
  tile.isExit = true;
  tile.exitLabel = 'Door A';
  tile.assemblyPoint = 'Front lawn near flagpole';
});

/* ── 2. collectExitPoints() finds it ─────────────────────────────────────── */
const exits = await page.evaluate(() => window.collectExitPoints());
eq(exits.length, 1, 'exactly one marked exit is on the graph');
eq(exits[0]?.label, 'Door A', 'the exit carries its door label');
eq(exits[0]?.assemblyPoint, 'Front lawn near flagpole', 'the exit carries its assembly point');

/* ── 3. a same-floor room routes to it via astar() ───────────────────────── */
const route101 = await page.evaluate(() => {
  const graph = getPathfindingGraph();
  const exits = window.collectExitPoints();
  const roomKey = graph.roomToKey.get('101');
  const result = window.computeEvacuationRouteForRoom(roomKey, exits, graph);
  const steps = result ? window.buildEvacuationSteps(result.path, result.exit, graph) : null;
  return { hasResult: !!result, pathLen: result ? result.path.length : 0,
           crossesFloor: result ? result.crossesFloor : null, steps };
});
ok(route101.hasResult, 'room 101 finds a route to the marked exit');
ok(route101.pathLen > 1, `the route has real cells (${route101.pathLen})`);
eq(route101.crossesFloor, false, 'the route stays on floor 1 (an exit is marked there)');
ok(Array.isArray(route101.steps) && route101.steps.length > 0, 'buildEvacuationSteps() returns turn-by-turn text');
ok(route101.steps && /Exit at Door A\.$/.test(route101.steps[route101.steps.length - 1]),
   `the last step names the door (${JSON.stringify(route101.steps && route101.steps.slice(-1))})`);

/* ── 4. floor 2 has no marked exit of its own — routes via the staircase ── */
const route201 = await page.evaluate(() => {
  const graph = getPathfindingGraph();
  const exits = window.collectExitPoints();
  const roomKey = graph.roomToKey.get('201');
  const result = window.computeEvacuationRouteForRoom(roomKey, exits, graph);
  return { hasResult: !!result, crossesFloor: result ? result.crossesFloor : null };
});
ok(route201.hasResult, 'room 201 (floor 2, no exit on its own floor) still finds a route');
eq(route201.crossesFloor, true, 'that route crosses floors via the staircase teleport to reach the exit');

/* ── 5. no marked exit at all → null, not a throw ────────────────────────── */
const noExitResult = await page.evaluate(() => {
  const graph = getPathfindingGraph();
  const roomKey = graph.roomToKey.get('101');
  return window.computeEvacuationRouteForRoom(roomKey, [], graph);
});
eq(noExitResult, null, 'zero marked exits comes back null instead of throwing');

/* ── 6. Path 11 P4: the evacuation cards, through the print kit's preview ── */
// A second door at the corridor's east end, with no assembly point typed.
await page.evaluate(() => {
  const tile = AppState.blueprint.floors.find(f => f.id === 'floor_0').gridData[4][14];
  tile.isExit = true; tile.exitLabel = 'Door B'; tile.assemblyPoint = '';
});
const beforeErrs = page.__errs.length;
await page.click('#tab-blueprint');
await settle(page, 200);
const activeBefore = await page.evaluate(() => AppState.blueprint.activeFloorIdx);
await page.click('#btn-print-evacuation-cards');
await page.waitForSelector('dialog[open]', { timeout: 5000 });
await settle(page, 800);
const cards = await page.evaluate(() => {
  const sheet = document.getElementById('sf-print-sheet');
  const one = room => {
    const c = sheet.querySelector(`.ev-card[data-room="${room}"]`);
    if (!c) return null;
    const img = c.querySelector('.ev-map img');
    return { text: c.textContent, heads: [...c.querySelectorAll('.ev-h2')].map(h => h.textContent),
      img: img ? img.src.slice(0, 22) : null, alt: img ? img.alt : null, lines: c.querySelectorAll('.ev-step-free .ev-line').length };
  };
  const bp = AppState.blueprint;
  return {
    count: sheet.querySelectorAll('.ev-card').length,
    order: [...sheet.querySelectorAll('.ev-card')].map(c => c.dataset.room),
    c101: one('101'), c201: one('201'),
    printing: document.body.classList.contains('sf-printing'),
    pageRule: !!document.getElementById('pk-page-style'),
    mirror: bp.gridData === bp.floors[bp.activeFloorIdx].gridData && bp.gridRows === bp.floors[bp.activeFloorIdx].gridRows,
    active: bp.activeFloorIdx,
  };
});
eq(cards.count, 11, 'one card per room on both floors (Northwind has 11 rooms)');
eq(cards.order.slice(-2).join(), '201,202', 'floor 1\'s cards come first, then floor 2\'s');
ok(cards.printing && cards.pageRule, 'while the preview is open the sheet is asked for and the page rule is set');
ok(cards.c101 && cards.c101.heads[0] === 'First way out: Door A' && cards.c101.heads[1] === 'Second way out: Door B',
  `room 101: first way out Door A, second Door B (${JSON.stringify(cards.c101 && cards.c101.heads)})`);
ok(/Assembly point: Front lawn near flagpole/.test(cards.c101.text) && /Assembly point: not entered/.test(cards.c101.text),
  "the school's assembly point is printed, and a blank one says so");
ok(/The first way out has no stairs or steps\./.test(cards.c101.text), 'room 101: the first way out is the step-free one');
eq(cards.c101.img, 'data:image/png;base64,', "room 101's card has its map");
ok(/^Plan of Floor 1 with the way out from room 101$/.test(cards.c101.alt || ''), `the map is described (${cards.c101.alt})`);
ok(cards.c201 && /Take the stairs to Floor 1\./.test(cards.c201.text) && /This route leaves Floor 2/.test(cards.c201.text),
  'room 201 goes down the stairs, and says its map shows only Floor 2');
eq(cards.c201.img, 'data:image/png;base64,', "room 201's card has a map of Floor 2, which is not the floor on screen");
ok(/No step-free way out of this room/.test(cards.c201.text) && /never use an elevator/.test(cards.c201.text),
  'room 201: no step-free way out, said plainly');
ok(/Plan for anyone who cannot use stairs or steps:/.test(cards.c201.text) && cards.c201.lines === 3,
  `with no plan entered, three blank lines under the heading (${cards.c201.lines})`);
ok(cards.mirror && cards.active === activeBefore, 'drawing the other floor put the editor\'s floor back');

// The preview's page count is Chromium's own. Its Print button closes it and
// prints (print() stubbed), which leaves the page as a print dialog finds it;
// the PDF is that print, and afterprint gives the page back.
// (Closed and settled first: a dialog's close event is async, and its onClose
// would otherwise take the print state away from the preview opened next.)
await page.keyboard.press('Escape');
await settle(page, 200);
await page.evaluate(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
await page.click('#btn-print-evacuation-cards');
await page.waitForSelector('dialog.pk-preview[data-pk-pages]', { timeout: 15000 });
const previewPages = Number(await page.getAttribute('dialog.pk-preview', 'data-pk-pages'));
await page.click('.pk-preview-print');
await page.waitForFunction(() => window.__printCalls > 0, null, { timeout: 15000 }).catch(() => {});
await settle(page, 200);
await page.emulateMedia({ media: null });
const pdfPages = (pdf => (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length)((await page.pdf({ preferCSSPageSize: true })).toString('latin1'));
ok(previewPages >= 11, `the preview lays out at least a page a card (${previewPages})`);
eq(pdfPages, previewPages, "the preview's page count is Chromium's PDF page count");
eq(await page.evaluate(() => window.__printCalls), 1, "the preview's Print prints once");
await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
await settle(page, 200);
const closed = await page.evaluate(() => ({ dialog: !!document.querySelector('dialog[open]'),
  printing: document.body.classList.contains('sf-printing'), pageRule: !!document.getElementById('pk-page-style') }));
ok(!closed.dialog && !closed.printing && !closed.pageRule, 'after printing the print state is gone');

/* ── 7. the school's plan, in its own words, never as markup ─────────────── */
await page.click('#tab-settings');
await settle(page, 200);
await page.fill('#setting-evac-no-step-free', '  Wait at the west landing with a buddy <b>now</b>  ');
await page.click('#btn-save-settings');
await settle(page, 200);
const plan = await page.evaluate(() => {
  window.SVSafety.buildEvacuationCards();
  const c = document.querySelector('#sf-print-sheet .ev-card[data-room="201"]');
  const p = c.querySelector('.ev-plan');
  return { saved: AppState.settings.evacNoStepFreePlan, text: p && p.textContent, bold: !!c.querySelector('b'), lines: c.querySelectorAll('.ev-step-free .ev-line').length,
    on101: !!document.querySelector('#sf-print-sheet .ev-card[data-room="101"] .ev-plan') };
});
eq(plan.saved, 'Wait at the west landing with a buddy <b>now</b>', 'Settings saves the plan, trimmed');
ok(plan.text === plan.saved && !plan.bold && plan.lines === 0, 'the card prints it as text, with no blank lines');
ok(!plan.on101, 'a room with a step-free way out does not get the plan');
await page.fill('#setting-evac-no-step-free', '   ');
await page.click('#btn-save-settings');
await settle(page, 200);
ok(await page.evaluate(() => !('evacNoStepFreePlan' in AppState.settings)), 'a blank plan removes the key');

/* ── 8. nothing marked: one page that says so ────────────────────────────── */
const none = await page.evaluate(() => {
  for (const f of AppState.blueprint.floors) for (const row of f.gridData) for (const t of row) if (t && t.isExit) t.isExit = false;
  const data = window.SVSafety.buildEvacuationCards();
  return { exits: data.exitCount, text: document.getElementById('sf-print-sheet').textContent };
});
ok(none.exits === 0 && /No exterior exit is marked on the blueprint/.test(none.text), 'with no exit marked the sheet says so and guesses nothing');

/* ── 9. Path 11 P4 increment 2: lockdown maps ─────────────────────────────── */
// Preview, then its Print (print() stubbed), then Chromium's PDF of that print.
async function previewAndPdf(button) {
  await page.evaluate(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
  await page.click(button);
  await page.waitForSelector('dialog.pk-preview[data-pk-pages]', { timeout: 15000 });
  const previewPages = Number(await page.getAttribute('dialog.pk-preview', 'data-pk-pages'));
  await page.click('.pk-preview-print');
  await page.waitForFunction(() => window.__printCalls > 0, null, { timeout: 15000 }).catch(() => {});
  await settle(page, 200);
  await page.emulateMedia({ media: null });
  const pdfPages = (pdf => (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length)((await page.pdf({ preferCSSPageSize: true })).toString('latin1'));
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await settle(page, 200);
  return { previewPages, pdfPages };
}
// A note typed in room 101's panel, and the building's in Settings, as a teacher would.
await page.click('#tab-blueprint');
await settle(page, 200);
const at101 = await page.evaluate(() => roomRegistry.find(r => r.roomNumber === '101').cellCoordinates);
await page.evaluate(({ col, row }) => { window.switchActiveFloor && window.switchActiveFloor(0); window.selectCell(col, row); }, at101);
await settle(page, 200);
await page.fill('#rp-lockdown-note', '  Blinds down <i>first</i>  ');
await page.click('#rp-btn-save-room');
await settle(page, 200);
eq(await page.evaluate(({ col, row }) => AppState.blueprint.floors[0].gridData[row][col].lockdownNote, at101),
  'Blinds down <i>first</i>', 'Save Room keeps the room\'s lockdown note, trimmed');
const lk1 = await page.evaluate(() => {
  window.SVSafety.buildLockdownMaps();
  const sheet = document.getElementById('sf-print-sheet');
  const pages = [...sheet.querySelectorAll('.lk-page')];
  return {
    floors: pages.map(p => p.querySelector('.lk-floor').textContent),
    imgs: pages.map(p => (p.querySelector('.lk-map img') || {}).src || '').map(s => s.slice(0, 22)),
    dt: [...sheet.querySelectorAll('.lk-room-notes dt')].map(d => d.textContent),
    dd: [...sheet.querySelectorAll('.lk-room-notes dd')].map(d => d.textContent),
    italic: !!sheet.querySelector('.lk-page i'),
    lines: pages[0] ? pages[0].querySelectorAll('.lk-note .ev-line').length : -1,
    text: sheet.textContent,
  };
});
eq(lk1.floors.join(), 'Floor 1,Floor 2', 'one lockdown map per floor, in order');
ok(lk1.imgs.every(s => s === 'data:image/png;base64,'), 'each floor\'s map is a picture of that floor, the one not on screen too');
ok(lk1.dt.join() === 'Room 101' && lk1.dd[0] === 'Blinds down <i>first</i>' && !lk1.italic, 'the room\'s note prints beside its number, as text');
eq(lk1.lines, 3, 'with no building note, three blank lines under its heading');
ok(/No room on this floor has a note\./.test(lk1.text), 'a floor with no room notes says so');
ok(!/shelter|hide|safe (?:corner|area)|lock the door/i.test(lk1.text), 'the map names no shelter area, hiding place or lock of its own');
await page.click('#tab-settings');
await settle(page, 200);
await page.fill('#setting-lockdown-note', '  Follow the binder in each room.  ');
await page.click('#btn-save-settings');
await settle(page, 200);
await page.click('#tab-blueprint');
await settle(page, 200);
const lkPages = await previewAndPdf('#btn-print-lockdown-maps');
const lk2 = await page.evaluate(() => ({ saved: AppState.settings.lockdownNote,
  notes: [...document.querySelectorAll('#sf-print-sheet .lk-note .ev-plan')].map(p => p.textContent) }));
eq(lk2.saved, 'Follow the binder in each room.', 'Settings saves the building\'s note, trimmed');
ok(lk2.notes.length === 2 && lk2.notes.every(n => n === lk2.saved), 'every floor\'s map prints the building\'s note');
eq(lkPages.pdfPages, lkPages.previewPages, `the lockdown maps' preview count is Chromium's PDF count (${lkPages.previewPages})`);
ok(lkPages.previewPages >= 2, 'at least a page a floor');
ok(await page.evaluate(() => !document.body.classList.contains('sf-printing') && !document.querySelector('dialog[open]')), 'after printing the maps the print state is gone');

/* ── 10. Path 11 P4 increment 3: door signs ────────────────────────────────── */
const ds = await page.evaluate(() => {
  const data = window.SVModel.doorSigns({ blueprint: AppState.blueprint, groups: AppState.schedules.groups, settings: AppState.settings });
  const select = document.getElementById('door-sign-teacher');
  window.SVSafety.fillDoorSignTeachers(select);
  return { teachers: data.teachers.map(t => t.teacher), signs: data.signCount, untaught: data.untaught,
    options: [...select.options].map(o => o.value) };
});
ok(ds.signs >= 2 && ds.teachers.length >= 2, `the fixture gives door signs for several teachers (${ds.signs} signs, ${ds.teachers.length} teachers)`);
eq(ds.options.slice(1).join('|'), ds.teachers.join('|'), 'the "Door signs for" list names every teacher with a room');
const dsAll = await previewAndPdf('#btn-print-door-signs');
const dsSheet = await page.evaluate(() => {
  const sheet = document.getElementById('sf-print-sheet');
  const heads = [...sheet.querySelectorAll('.ds-sign:first-child .ds-table thead th')].map(h => h.textContent);
  const timed = AppState.settings.bellSchedule && Array.isArray(AppState.settings.bellSchedule.A) && AppState.settings.bellSchedule.A.some(e => e && e.start && e.end);
  return { heads, timed, signs: sheet.querySelectorAll('.ds-sign').length, grids: sheet.querySelectorAll('.pk-cards.pk-page').length,
    first: sheet.querySelector('.ds-sign') && sheet.querySelector('.ds-sign').textContent };
});
eq(dsSheet.signs, ds.signs, 'every teacher\'s signs are on the sheet');
ok(dsSheet.heads.includes('Time') === !!dsSheet.timed, `a Time column only when bell times are set (${dsSheet.heads.join('|')})`);
eq(dsSheet.grids, Math.ceil(ds.signs / 2), 'two signs to a page, through the print kit\'s card grid');
eq(dsAll.pdfPages, dsAll.previewPages, `the door signs' preview count is Chromium's PDF count (${dsAll.previewPages})`);
eq(dsAll.previewPages, dsSheet.grids, 'and that is a page per two signs');
ok(!/evacuat|lockdown|exit|assembly/i.test(dsSheet.first || ''), 'a door sign has no safety wording');
const one = ds.teachers[0];
await page.selectOption('#door-sign-teacher', one);
const dsOne = await page.evaluate(() => {
  const data = window.SVSafety.buildDoorSigns(document.getElementById('door-sign-teacher').value);
  return { teachers: [...document.querySelectorAll('#sf-print-sheet .ds-teacher')].map(t => t.textContent), want: data.teachers[0].signs.length };
});
ok(dsOne.teachers.length === dsOne.want && dsOne.teachers.every(t => t === one), `choosing ${one} prints only their signs (${dsOne.teachers.length})`);

eq(page.__errs.length, beforeErrs, 'no page/console errors while building the cards: ' +
   JSON.stringify(page.__errs.slice(beforeErrs, beforeErrs + 4)));
ok(await page.evaluate(() => !!document.getElementById('bp-canvas')), 'the blueprint canvas is still intact after printing cards');

eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
