// smoke-step-free.mjs — the School Layout Visualizer's step-free routes and
// report (Path 11 P3 increment 1, v325) and its route sheets, Settings'
// elevator wait and the canvas glyphs (increment 2, v326), driven through
// 035's own controls.
//
//   node Tools/schedule-visualizer/test/smoke-step-free.mjs
//
// Loads the invented Northwind school (two floors joined by one staircase
// pair at column 0) and marks one exit on floor 1. Then: the staircase panel
// says what the pair is and writes it to the pair, with undo; with the pair
// as stairs, Visualize's "Step-free routes" switch turns group 7-1's move up
// to room 201 into the plain error and back; the Blueprint sidebar's
// "Step-free Report" opens the print kit's preview of a sheet listing floor
// 2's rooms as stairs only and 7-1's move, and closing it takes the print
// state away; marked as an elevator, every room is step-free, and out of
// service, floor 2 is reached by no route at all; the evacuation door cards'
// graph never has the elevator in it; and in print media the sheet is the
// only thing on paper. Increment 2: Settings' elevator wait reaches the
// step-free graph and a blank field puts the default back; the Schedules
// tab's "Needs step-free routes" writes the flag and takes it off; the route
// sheets give a flagged group's move up to 201 by the elevator, say plainly
// when only stairs would do, and start each group on a new page; and the
// staircase tile's picture changes with what the pair is and comes back.
// Increment 3: "A step here" on a hallway tile and "Step at this door" on a
// room's door cut step-free routes (and only those), the door with undo.
// No console error, no offsite request.
//
// Exits 1 on any failure.

/* global applyFullProject, AppState, selectCell, renderCanvas -- page globals read inside page.evaluate() */
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import { fixtureProject } from './fixture-northwind.mjs';

const PORT = 8553;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/035-schedule-visualizer.html';
const NONE = 'No step-free route between these rooms';

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; console.log('  ok   ' + label); return true; }
  failed++; console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 900 });
await page.context().addInitScript(() => {
  try { localStorage.setItem('stviz_onboarded', '1'); } catch (e) { /* storage blocked */ }
});

console.log('School Layout Visualizer — step-free routes and report');
try {
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 400);
  ok(await page.evaluate(() => typeof window.SVAccess === 'object' && typeof window.PrintKit === 'object'), 'the page has SVAccess and the print kit');

  await page.evaluate(project => { applyFullProject(project); }, fixtureProject());
  await settle(page, 300);
  await page.evaluate(() => {
    const t = AppState.blueprint.floors.find(f => f.id === 'floor_0').gridData[4][3];
    t.isExit = true; t.exitLabel = 'Door A';
    window.invalidatePathfindingGraph();
  });

  /* ── 1. the staircase panel says what the pair is ───────────────────────── */
  await page.evaluate(() => selectCell(0, 4));
  await settle(page, 150);
  ok(await page.isVisible('#rp-pair-access'), 'a paired staircase shows "What this pair is"');
  eq(await page.inputValue('#rp-pair-access'), 'stairs', 'an unmarked pair reads as stairs');
  ok(!(await page.isVisible('#rp-pair-out-of-service')), 'stairs have no out-of-service box');
  await page.selectOption('#rp-pair-access', 'elevator');
  await settle(page, 100);
  eq(await page.evaluate(() => AppState.blueprint.crossFloorPairs[0].access), 'elevator', 'choosing Elevator writes access to the pair');
  ok(await page.isVisible('#rp-pair-out-of-service'), 'an elevator has an out-of-service box');
  await page.check('#rp-pair-out-of-service');
  await settle(page, 100);
  eq(await page.evaluate(() => AppState.blueprint.crossFloorPairs[0].outOfService), true, 'ticking it writes outOfService');
  await page.click('#btn-undo');
  await settle(page, 150);
  eq(await page.evaluate(() => AppState.blueprint.crossFloorPairs[0].outOfService), undefined, 'Undo takes the out-of-service mark back off');
  await page.click('#btn-undo');
  await settle(page, 150);
  eq(await page.evaluate(() => AppState.blueprint.crossFloorPairs[0].access), undefined, 'a second Undo makes it stairs again');

  /* ── 2. Visualize's "Step-free routes" switch ───────────────────────────── */
  await page.click('#tab-visualize');
  await settle(page, 200);
  const move = () => page.evaluate(() => (window.findGroupDayPath('7-1', 'A') || [])[2]);
  const before = await move();
  ok(before && !before.error && before.toRoom === '201', '7-1 walks up to 201 by the stairs with the switch off');
  await page.locator('label.viz-switch:has(#viz-opt-step-free)').click();
  await settle(page, 150);
  eq(await page.evaluate(() => AppState.viz.stepFree), true, 'the switch sets the step-free flag');
  const after = await move();
  ok(after && after.error === NONE && after.path === null, `with it on the move is "${NONE}", with no path drawn`);
  const congestionCells = await page.evaluate(() => [...window.computeCongestionMap(['7-1'], 'A').keys()].filter(k => k.startsWith('floor_1')).length);
  eq(congestionCells, 0, 'congestion counts no floor-2 corridor for a move that cannot be made');
  await page.locator('label.viz-switch:has(#viz-opt-step-free)').click();
  await settle(page, 150);
  ok(!(await move()).error, 'switched off, the stairs route is back');

  /* ── 3. the report, through the print kit's preview ─────────────────────── */
  await page.click('#tab-blueprint');
  await settle(page, 200);
  await page.click('#btn-step-free-report');
  await page.waitForSelector('dialog[open]', { timeout: 5000 });
  await settle(page, 600);
  const sheet = await page.evaluate(() => ({
    text: document.getElementById('sf-print-sheet').textContent,
    printing: document.body.classList.contains('sf-printing'),
    pageRule: !!document.getElementById('pk-page-style'),
    rows: [...document.querySelectorAll('#sf-print-sheet table')].map(t => t.rows.length),
  }));
  ok(sheet.printing && sheet.pageRule, 'while the preview is open the sheet is asked for and the page rule is set');
  ok(/can be reached from an exit only by stairs/.test(sheet.text), 'the summary says some rooms are stairs-only');
  ok(/201Floor 2/.test(sheet.text) && /202Floor 2/.test(sheet.text), 'floor 2\'s rooms are listed as unreachable without stairs');
  ok(/7-1A107 \(.*\)201 \(.*\)/.test(sheet.text) || /7-1A108 \(.*\)201 \(.*\)/.test(sheet.text), "7-1's move up to 201 is listed");
  ok(/AStairsFloor 1 and Floor 2/.test(sheet.text), 'the pair is listed as stairs joining the two floors');
  await page.keyboard.press('Escape');
  await settle(page, 200);
  const closed = await page.evaluate(() => ({
    dialog: !!document.querySelector('dialog[open]'),
    printing: document.body.classList.contains('sf-printing'),
    pageRule: !!document.getElementById('pk-page-style'),
  }));
  ok(!closed.dialog && !closed.printing && !closed.pageRule, 'closing the preview takes the print state away (the Blueprint sheet is untouched)');
  // On paper: until v327 the sheet sat inside an unclosed hidden <button>, so
  // the preview (which copies it into a frame) looked right and every print was
  // one blank page. The preview's Print (print() stubbed) leaves the page as a
  // print dialog finds it; the PDF is that print.
  await page.evaluate(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
  await page.click('#btn-step-free-report');
  await page.waitForSelector('dialog.pk-preview[data-pk-pages]', { timeout: 15000 });
  const reportPages = Number(await page.getAttribute('dialog.pk-preview', 'data-pk-pages'));
  await page.click('.pk-preview-print');
  await page.waitForFunction(() => window.__printCalls > 0, null, { timeout: 15000 }).catch(() => {});
  await page.emulateMedia({ media: null });
  const pdfText = (await page.pdf({ preferCSSPageSize: true })).toString('latin1');
  const reportPdf = (pdfText.match(/\/Type\s*\/Page[^s]/g) || []).length;
  ok(reportPages >= 1 && reportPdf === reportPages, `the report prints the pages the preview shows (${reportPdf} PDF, ${reportPages} preview)`);
  ok(await page.evaluate(() => document.getElementById('sf-print-sheet').parentElement === document.body), 'the sheet is a direct child of <body>');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await settle(page, 150);

  /* ── 4. marked as an elevator, then out of service ──────────────────────── */
  await page.evaluate(() => selectCell(0, 4));
  await settle(page, 100);
  await page.selectOption('#rp-pair-access', 'elevator');
  await settle(page, 100);
  let rep = await page.evaluate(() => window.SVAccess.buildStepFreeSheet());
  ok(rep.counts.stairsOnly === 0 && rep.counts.stepFree === rep.rooms.length && rep.moves.length === 0,
    `with an elevator every room is step-free (${JSON.stringify(rep.counts)})`);
  ok(/Every room reached from an exit can be reached without stairs/.test(await page.textContent('#sf-print-sheet')), 'and the sheet says so');
  const lifts = await page.evaluate(() => [window.getPathfindingGraph().portalCount, window.getEvacuationGraph().portalCount]);
  ok(lifts[0] === 1 && lifts[1] === 0, `the door cards' graph leaves the elevator out (an elevator is not used in a fire): ${JSON.stringify(lifts)}`);
  await page.check('#rp-pair-out-of-service');
  await settle(page, 100);
  rep = await page.evaluate(() => window.SVAccess.buildStepFreeSheet());
  ok(rep.counts.unreachable >= 2 && rep.connectors[0].outOfService,
    `with the only connection out of service floor 2 is reached by no route at all (${JSON.stringify(rep.counts)})`);
  ok(/or an elevator out of service/.test(await page.textContent('#sf-print-sheet')), 'and the sheet says the elevator may be why');
  ok(/Out of service: elevator A\./.test(await page.textContent('#sf-print-sheet')), 'the sheet names the elevator that is out');

  /* ── 5. on paper the sheet prints alone ─────────────────────────────────── */
  await page.evaluate(() => document.body.classList.add('sf-printing'));
  await page.emulateMedia({ media: 'print' });
  const paper = await page.evaluate(() => ({
    sheet: getComputedStyle(document.getElementById('sf-print-sheet')).display,
    app: getComputedStyle(document.getElementById('app-visualizer')).display,
  }));
  eq(paper.sheet, 'block', 'in print media the sheet is shown');
  eq(paper.app, 'none', 'and the app is not');
  await page.evaluate(() => document.body.classList.remove('sf-printing'));
  eq(await page.evaluate(() => getComputedStyle(document.getElementById('sf-print-sheet')).display), 'none',
    'without sf-printing, Ctrl+P does not print the report');
  await page.emulateMedia({ media: 'screen' });


  /* ── 6. increment 2: Settings' elevator wait ────────────────────────────── */
  await page.evaluate(() => selectCell(0, 4));
  await settle(page, 100);
  await page.uncheck('#rp-pair-out-of-service');
  await settle(page, 100);
  const liftCost = () => page.evaluate(() => {
    const g = window.getStepFreeGraph();
    for (const edges of g.adjacency.values()) for (const e of edges) if (e.teleport) return e.cost;
    return null;
  });
  eq(await liftCost(), 10, 'an elevator costs the default wait, 10');
  await page.click('#tab-settings');
  await settle(page, 200);
  eq(await page.inputValue('#setting-elevator-wait'), '10', 'Settings shows the default elevator wait');
  await page.fill('#setting-elevator-wait', '4');
  await page.click('#btn-save-settings');
  await settle(page, 150);
  eq(await page.evaluate(() => AppState.settings.elevatorWait), 4, 'saving writes elevatorWait');
  eq(await liftCost(), 4, 'and the step-free graph charges it');
  await page.fill('#setting-elevator-wait', '');
  await page.click('#btn-save-settings');
  await settle(page, 150);
  ok(await page.evaluate(() => !('elevatorWait' in AppState.settings)), 'a blank wait removes the key');
  eq(await page.inputValue('#setting-elevator-wait'), '10', 'and the field shows the default again');
  eq(await liftCost(), 10, 'and the graph is back to 10');

  /* ── 7. increment 2: the group's flag, on the Schedules tab ─────────────── */
  await page.click('#tab-schedules');
  await settle(page, 200);
  const gid = await page.evaluate(() => AppState.schedules.groups.find(g => g.name === '7-1').id);
  await page.click(`.group-card-btn.edit[data-group-id="${gid}"]`);
  await settle(page, 150);
  ok(!(await page.isChecked('#sch-input-step-free')), 'an unmarked group opens with the box clear');
  await page.check('#sch-input-step-free');
  await page.click('#sch-btn-save');
  await settle(page, 150);
  eq(await page.evaluate(id => AppState.schedules.groups.find(g => g.id === id).stepFree, gid), true, 'saving writes stepFree: true on the group');
  ok(await page.isVisible(`.group-card[data-group-id="${gid}"] .group-card-step-free`), 'its card says Step-free');
  await page.uncheck('#sch-input-step-free');
  await page.click('#sch-btn-save');
  await settle(page, 150);
  ok(await page.evaluate(id => !('stepFree' in AppState.schedules.groups.find(g => g.id === id)), gid), 'clearing it and saving takes the key off');
  await page.check('#sch-input-step-free');
  await page.click('#sch-btn-save');
  await settle(page, 150);

  /* ── 8. increment 2: the route sheets ───────────────────────────────────── */
  await page.click('#tab-blueprint');
  await settle(page, 200);
  await page.click('#btn-step-free-routes');
  await page.waitForSelector('dialog[open]', { timeout: 5000 });
  await settle(page, 600);
  let text = await page.textContent('#sf-print-sheet');
  ok(/Step-free routes: 7-1/.test(text), 'the sheet is headed with the flagged group');
  ok(/Take the elevator to Floor 2\./.test(text) && /Arrive at room 201\./.test(text) && !/Take the stairs/.test(text),
    'its move up to 201 goes by the elevator, never the stairs');
  ok(await page.evaluate(() => document.body.classList.contains('sf-printing')), 'the sheet is asked for while the preview is open');
  await page.keyboard.press('Escape');
  await settle(page, 200);
  ok(await page.evaluate(() => !document.body.classList.contains('sf-printing') && !document.getElementById('pk-page-style')), 'closing it takes the print state away');
  await page.evaluate(() => selectCell(0, 4));
  await settle(page, 100);
  await page.selectOption('#rp-pair-access', 'stairs');
  await settle(page, 100);
  await page.evaluate(() => { AppState.schedules.groups.find(g => g.name === '6-1').stepFree = true; });
  const sheets = await page.evaluate(() => window.SVAccess.buildRouteSheets());
  text = await page.textContent('#sf-print-sheet');
  ok(sheets.length === 2 && /No step-free route between these rooms\. Every route between them has stairs or a step\./.test(text),
    'as stairs, the move to 201 has no step-free route, said plainly');
  await page.emulateMedia({ media: 'print' });
  const brk = await page.evaluate(() => [...document.querySelectorAll('#sf-print-sheet .sf-route-group')].map(g => getComputedStyle(g).breakBefore));
  await page.emulateMedia({ media: 'screen' });
  eq(JSON.stringify(brk), '["auto","page"]', 'two flagged groups, the second on a new page');
  await page.evaluate(() => { for (const g of AppState.schedules.groups) delete g.stepFree; });
  await page.evaluate(() => window.SVAccess.buildRouteSheets());
  ok(/No group is marked as needing step-free routes/.test(await page.textContent('#sf-print-sheet')), 'with no group marked, the sheet says how to mark one');

  /* ── 9. increment 2: the staircase tile's picture ───────────────────────── */
  const shot = () => page.evaluate(() => { renderCanvas(); return document.getElementById('bp-canvas').toDataURL(); });
  const asStairs = await shot();
  await page.selectOption('#rp-pair-access', 'elevator');
  await settle(page, 100);
  const asLift = await shot();
  await page.check('#rp-pair-out-of-service');
  await settle(page, 100);
  const asOut = await shot();
  await page.selectOption('#rp-pair-access', 'ramp');
  await settle(page, 100);
  const asRamp = await shot();
  await page.selectOption('#rp-pair-access', 'stairs');
  await settle(page, 100);
  const again = await shot();
  ok(new Set([asStairs, asLift, asOut, asRamp]).size === 4, 'stairs, elevator, elevator out of service and ramp each draw a different tile');
  ok(again === asStairs, 'and stairs again draws exactly what it drew before');


  /* ── 10. increment 3: a step in a corridor, a step at a door ────────────── */
  const sfErr = (a, b) => page.evaluate(([x, y]) => window.SVGraph.resolveRoomPath(window.getStepFreeGraph(), x, y, AppState.blueprint.crossFloorPairs).error || null, [a, b]);
  const plainErr = (a, b) => page.evaluate(([x, y]) => window.SVGraph.resolveRoomPath(window.getPathfindingGraph(), x, y, AppState.blueprint.crossFloorPairs).error || null, [a, b]);
  eq(await sfErr('106', '108'), null, '106 to 108 is step-free along the corridor');
  await page.evaluate(() => selectCell(5, 4));
  await settle(page, 150);
  ok(await page.isVisible('#rp-hallway-step'), 'a hallway tile has "A step here"');
  await page.check('#rp-hallway-step');
  await page.click('#rp-btn-save-corridor');
  await settle(page, 150);
  eq(await page.evaluate(() => AppState.blueprint.floors[0].gridData[4][5].step), true, 'Apply writes step: true on the tile');
  eq(await sfErr('106', '108'), NONE, 'the step cuts the corridor for step-free routes');
  eq(await plainErr('106', '108'), null, 'and only for them');
  const stepShot = await shot();
  await page.evaluate(() => selectCell(5, 4));
  await settle(page, 100);
  await page.uncheck('#rp-hallway-step');
  await page.click('#rp-btn-save-corridor');
  await settle(page, 150);
  ok(await page.evaluate(() => !('step' in AppState.blueprint.floors[0].gridData[4][5])), 'clearing it and Apply take the key off');
  eq(await sfErr('106', '108'), null, 'and the corridor is step-free again');
  ok(stepShot !== await shot(), 'the tile shows the step while it is marked');

  await page.evaluate(() => { AppState.blueprint.floors[0].gridData[5][5].doors = [{ col: 5, row: 5, side: 'top' }]; window.invalidatePathfindingGraph(); });
  await page.evaluate(() => selectCell(5, 5));
  await settle(page, 150);
  const doorBox = page.locator('#rp-door-list .rp-door-step input');
  eq(await doorBox.count(), 1, 'the room\'s door has "Step at this door"');
  await doorBox.check();
  await settle(page, 150);
  eq(await page.evaluate(() => AppState.blueprint.floors[0].gridData[5][5].doors[0].stepFree), false, 'ticking it writes stepFree: false on the door');
  eq(await sfErr('106', '107'), NONE, 'and 107 has no step-free route in');
  eq(await plainErr('106', '107'), null, 'while the ordinary route still uses the door');
  await page.click('#btn-undo');
  await settle(page, 150);
  ok(await page.evaluate(() => !('stepFree' in AppState.blueprint.floors[0].gridData[5][5].doors[0])), 'Undo takes the step off the door');
  eq(await sfErr('106', '107'), null, 'and 107 is step-free again');

  eq(page.__errs.length, 0, 'no page or console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
  eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));
} catch (e) {
  failed++;
  console.log('  FAIL threw: ' + (e && e.stack || e));
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
