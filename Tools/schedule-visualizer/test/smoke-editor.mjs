// smoke-editor.mjs — the School Layout Visualizer's blueprint editor, driven
// through its own controls since it moved to sv-editor.js (Path 11 P2
// increment 10, v324).
//
//   node Tools/schedule-visualizer/test/smoke-editor.mjs
//
// From an empty blueprint, with real mouse events on the canvas, it: paints a
// hallway by dragging, places two staircases and a classroom, pairs the two
// staircases through the right panel's "Pair with" button, undoes the pairing
// and redoes it with the toolbar buttons, and reloads the page to see that the
// autosave kept every tile and the pair. It also checks that the module put
// the editor's old global surface back on window (the markup's handlers and
// the other modules call drawTile, renderCanvas and friends by bare name), and
// that the page made no console error and no offsite request.
//
// Exits 1 on any failure.

/* global AppState, renderCanvas, drawTile, getEffectiveCellSize -- page globals read inside page.evaluate() */
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8552;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/035-schedule-visualizer.html';

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

console.log('School Layout Visualizer — blueprint editor (sv-editor.js)');
try {
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 400);

  const surface = await page.evaluate(() => ({
    ns: typeof window.SVEditor === 'object',
    fns: ['renderCanvas', 'drawTile', 'applyTool', 'undoBlueprint', 'completePairing', 'printEvacuationDoorCards']
      .filter(n => typeof window[n] !== 'function'),
    ctx: typeof renderCanvas === 'function' && typeof drawTile === 'function',
  }));
  ok(surface.ns, 'the module script set window.SVEditor');
  eq(surface.fns.join(', '), '', 'the editor functions the page calls by bare name are on window');
  ok(surface.ctx, 'a classic-script caller sees renderCanvas and drawTile');

  const empty = await page.evaluate(() => AppState.blueprint.floors[0].gridData.flat().filter(Boolean).length);
  eq(empty, 0, 'a fresh page starts with an empty floor');

  // A cell's centre in page pixels, read off the canvas as it is laid out now.
  const canvas = page.locator('#bp-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const cellAt = async (col, row) => {
    const box = await canvas.boundingBox();
    const { cs, z } = await page.evaluate(() => ({ cs: getEffectiveCellSize(), z: AppState.ui.zoom }));
    return { x: box.x + (col + 0.5) * cs * z, y: box.y + (row + 0.5) * cs * z };
  };
  const clickCell = async (col, row) => { const p = await cellAt(col, row); await page.mouse.click(p.x, p.y); await settle(page, 80); };
  const tile = (col, row) => page.evaluate(([c, r]) => {
    const t = AppState.blueprint.floors[0].gridData[r]?.[c];
    return t ? t.type : null;
  }, [col, row]);

  /* ── 1. paint a hallway by dragging ─────────────────────────────────────── */
  await page.click('#tool-hallway');
  const a = await cellAt(1, 3), b = await cellAt(6, 3);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let c = 1; c <= 6; c++) { const p = await cellAt(c, 3); await page.mouse.move(p.x, p.y, { steps: 2 }); }
  await page.mouse.move(b.x, b.y);
  await page.mouse.up();
  await settle(page, 100);
  const hall = [];
  for (let c = 1; c <= 6; c++) hall.push(await tile(c, 3));
  eq(hall.join(','), 'hallway,hallway,hallway,hallway,hallway,hallway', 'a drag paints six hallway tiles');

  /* ── 2. two staircases and a classroom ──────────────────────────────────── */
  await page.click('#tool-staircase');
  await clickCell(0, 3);
  await clickCell(7, 3);
  eq(`${await tile(0, 3)},${await tile(7, 3)}`, 'staircase,staircase', 'two staircases at either end');
  await page.click('#tool-classroom');
  await clickCell(3, 2);
  eq(await tile(3, 2), 'classroom', 'a classroom above the hallway');

  /* ── 3. pair the staircases through the right panel ─────────────────────── */
  await page.click('#tool-select');
  await clickCell(0, 3);
  ok(await page.locator('#rp-btn-pair-with').isVisible(), 'selecting a staircase shows "Pair with"');
  await page.click('#rp-btn-pair-with');
  ok(await page.evaluate(() => AppState.ui.isPairingMode === true), 'pairing mode is on');
  await clickCell(7, 3);
  const pairs = () => page.evaluate(() => (AppState.blueprint.crossFloorPairs || []).length);
  eq(await pairs(), 1, 'clicking the second staircase makes one pair');
  ok(await page.evaluate(() => AppState.ui.isPairingMode === false), 'pairing mode is off again');

  /* ── 4. undo and redo the pairing ───────────────────────────────────────── */
  await page.click('#btn-undo');
  await settle(page, 100);
  eq(await pairs(), 0, 'Undo takes the pair away');
  eq(`${await tile(0, 3)},${await tile(7, 3)},${await tile(3, 2)}`, 'staircase,staircase,classroom', 'Undo leaves the tiles');
  await page.click('#btn-redo');
  await settle(page, 100);
  eq(await pairs(), 1, 'Redo puts the pair back');

  /* ── 5. the autosave keeps it across a reload ───────────────────────────── */
  await page.waitForFunction(() => {
    try { const s = JSON.parse(localStorage.getItem('stviz_blueprint') || 'null'); return !!s && (s.crossFloorPairs || []).length === 1; } catch (e) { return false; }
  }, null, { timeout: 8000 }).catch(() => {});
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 400);
  const back = [];
  for (let c = 0; c <= 7; c++) back.push(await tile(c, 3));
  eq(back.join(','), 'staircase,hallway,hallway,hallway,hallway,hallway,hallway,staircase', 'after a reload the row is all there');
  eq(await tile(3, 2), 'classroom', 'after a reload the classroom is there');
  eq(await pairs(), 1, 'after a reload the pair is there');

  eq((page.__errs || []).join(' | '), '', 'no page or console errors');
} catch (e) {
  ok(false, 'the suite ran to the end: ' + (e && e.message));
} finally {
  await browser.close();
  server.close();
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
