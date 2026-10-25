// smoke-checks.mjs — the School Layout Visualizer's schedule checks on the
// page (Path 11 P5 increment 1, v329), driven through 035's own controls.
//
//   node Tools/schedule-visualizer/test/smoke-checks.mjs
//
// Loads the invented Northwind school. Its schedule is clean: the banner says
// "No problems or warnings" and its Notes fold holds the teachers with no
// group on a day. Then: 6-1 typed into 106 in Block A through the bulk editor
// marks both cells red with the sentence as their title while typing, and
// after Apply the banner counts one problem, 6-1's card is red, and Show
// flashes the card; Accept with a note takes it out of the count and into the
// Accepted fold, through a reload and through a project export and import,
// and Undo puts it back; a capacity typed in the room panel is saved on the
// tile and gives over-capacity, with the room panel's "This room" line; the
// Publish button warns with the count and publishes nothing when cancelled;
// and the what-if lab's Constraint Checks panel says Resolved for a scenario
// that moves 6-1 back. No console error, no offsite request.
//
// Exits 1 on any failure.

/* global applyFullProject, serializeFullProject, AppState, switchTab, selectCell, roomRegistry, wiSetOverride, wiRenderAll, publishWarning -- page globals read inside page.evaluate() */
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import { fixtureProject } from './fixture-northwind.mjs';

const PORT = 8554;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/035-schedule-visualizer.html';
const DOUBLE = 'Room 106 has two groups in Block A on A days: 6-1 and 7-1. One of them needs another room or another block.';

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
const label = () => page.textContent('#sch-conflict-label');
const openList = async () => {
  if (!(await page.evaluate(() => document.getElementById('sch-conflict-table-wrap').classList.contains('open')))) {
    await page.click('#sch-conflict-banner-header');
  }
};

console.log('School Layout Visualizer — schedule checks');
try {
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 400);
  ok(await page.evaluate(() => typeof window.SVCheck === 'object' && typeof window.SVChecksView === 'object'), 'the page has SVCheck and SVChecksView');
  await page.evaluate(project => { applyFullProject(project); switchTab('schedules'); }, fixtureProject());
  await settle(page, 300);

  /* ── 1. Northwind is clean, with notes ─────────────────────────────────── */
  ok(await page.isVisible('#sch-conflict-banner'), 'the checks banner shows');
  eq(await label(), 'No problems or warnings on A days', 'its line on a clean schedule');
  await openList();
  eq(await page.getAttribute('#sch-conflict-banner-header', 'aria-expanded'), 'true', 'the header says it is open');
  const notes = await page.$$eval('.chk-notes .chk-row', rs => rs.map(r => r.dataset.kind));
  ok(notes.length >= 2 && notes.every(k => k === 'teacher-idle' || k === 'room-no-teacher'), 'the Notes fold holds teacher-idle and room-no-teacher: ' + notes.join());

  /* ── 2. a double-booking typed in the bulk editor ─────────────────────── */
  const ids = await page.evaluate(() => Object.fromEntries(AppState.schedules.groups.map(g => [g.name, g.id])));
  await page.click('#btn-bulk-editor');
  await settle(page, 200);
  const cell = `input[data-check-cell="${ids['6-1']}|A|0"]`;
  await page.fill(cell, '106');
  await settle(page, 100);
  ok(await page.evaluate(sel => document.querySelector(sel).classList.contains('chk-cell-error'), cell), 'the typed cell is marked as an error at once');
  eq(await page.getAttribute(cell, 'title'), DOUBLE, 'and its title is the sentence');
  ok(await page.evaluate(id => document.querySelector(`input[data-check-cell="${id}|A|0"]`).classList.contains('chk-cell-error'), ids['7-1']), "7-1's cell is marked too");
  await page.click('#be-btn-apply');
  await settle(page, 300);
  eq(await label(), '1 problem on A days', 'after Apply the banner counts one problem');
  ok(await page.evaluate(() => document.getElementById('sch-conflict-banner').classList.contains('chk-has-error')), 'and is red');
  await openList();
  const row = page.locator('#sch-check-list > .chk-list .chk-row[data-kind="room-double"]');
  eq(await row.locator('.chk-text').textContent(), DOUBLE, 'the row says it in words');
  ok(await page.evaluate(id => document.querySelector(`.group-card[data-group-id="${id}"]`).classList.contains('has-error'), ids['6-1']), "6-1's card is red");
  await row.locator('button', { hasText: 'Show' }).click();
  await settle(page, 100);
  ok(await page.evaluate(id => document.querySelector(`.group-card[data-group-id="${id}"]`).classList.contains('check-flash'), ids['6-1']), 'Show flashes the card');

  /* ── 3. Accept, through a reload and a project round trip ─────────────── */
  await row.locator('button', { hasText: 'Accept' }).click();
  await page.evaluate(() => { for (const d of document.querySelectorAll('.chk-fold')) d.open = true; });
  const axe = await a11yScan(page, { include: '#sch-conflict-banner' });
  eq(axe.map(v => v.id + ' ' + v.nodes.join(',')).join('; '), '', 'the open banner, its folds and the accept form have no serious axe finding');
  await page.fill('.chk-accept-input', 'Shared lab this block');
  await page.click('.chk-accept-form button');
  await settle(page, 200);
  eq(await label(), 'No problems or warnings on A days', 'an accepted finding is not counted');
  await openList();
  ok(await page.isVisible('.chk-accepted') && (await page.textContent('.chk-accepted')).includes('Shared lab this block'), 'it is in the Accepted fold with its note');
  const stored = await page.evaluate(() => localStorage.getItem('stviz_checks'));
  const parsed = JSON.parse(stored);
  ok(parsed.v === 1 && Object.keys(parsed.acks).length === 1 && /^\d{4}-\d{2}-\d{2}$/.test(Object.values(parsed.acks)[0].on), 'stviz_checks holds one ack with a date');
  ok(!/"severity"|"where"|"groups"/.test(stored), 'no finding is stored, only the ack');
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 400);
  await page.evaluate(() => switchTab('schedules'));
  await settle(page, 200);
  eq(await label(), 'No problems or warnings on A days', 'still accepted after a reload');
  const project = await page.evaluate(() => serializeFullProject({ portable: true }));
  ok(project.checks && Object.keys(project.checks.acks).length === 1, 'the project file carries the ack');
  await page.evaluate(() => { localStorage.removeItem('stviz_checks'); window.SVChecksView.loadChecks(); window.renderGroupList(); });
  eq(await label(), '1 problem on A days', 'without the ack it counts again');
  await page.evaluate(p => { applyFullProject(p); }, project);
  await settle(page, 200);
  eq(await label(), 'No problems or warnings on A days', 'importing the project brings the ack back');
  await openList();
  await page.locator('.chk-accepted summary').click();
  await page.locator('.chk-accepted button', { hasText: 'Undo' }).click();
  await settle(page, 200);
  eq(await label(), '1 problem on A days', 'Undo counts it again');
  eq(await page.evaluate(() => localStorage.getItem('stviz_checks')), null, 'and the key is gone with no ack left');

  /* ── 4. capacity in the room panel ───────────────────────────────────── */
  const at = await page.evaluate(() => roomRegistry.find(r => r.roomNumber === '106'));
  await page.evaluate(({ c, r, f }) => {
    switchTab('blueprint');
    const i = AppState.blueprint.floors.findIndex(x => x.id === f);
    if (typeof window.switchFloor === 'function') window.switchFloor(i);
    selectCell(c, r);
  }, { c: at.cellCoordinates.col, r: at.cellCoordinates.row, f: at.floorId });
  await settle(page, 200);
  ok(await page.isVisible('#rp-capacity'), 'the room panel has a Capacity field');
  ok((await page.textContent('#rp-room-checks')).includes(DOUBLE), "the room panel's This room list names the double-booking");
  await page.fill('#rp-capacity', '40');
  await page.click('#rp-btn-save-room');
  await settle(page, 200);
  eq(await page.evaluate(() => roomRegistry.find(r => r.roomNumber === '106').capacity), 40, 'Save Room writes capacity onto the room');
  const over = await page.evaluate(() => window.runChecks(AppState.schedules.groups).findings.filter(f => f.kind === 'over-capacity').map(f => window.SVCheck.sentence(f, { labels: window.getAllModLabels() })));
  eq(over.join(' / '), 'Room 106 holds 46 in Block A on A days (6-1 with 24 and 7-1 with 22) and seats 40.', 'and gives over-capacity');
  await page.fill('#rp-capacity', '');
  await page.click('#rp-btn-save-room');
  await settle(page, 150);
  ok(await page.evaluate(() => !('capacity' in roomRegistry.find(r => r.roomNumber === '106'))), 'a blank Capacity removes it');

  /* ── 5. Publish warns ────────────────────────────────────────────────── */
  let dialog = null, downloads = 0;
  page.on('download', () => { downloads++; });
  page.once('dialog', d => { dialog = d.message(); d.dismiss(); });
  await page.evaluate(() => window.publishChecked());
  await settle(page, 300);
  ok(dialog && dialog.startsWith('This schedule has 1 problem the published browser will hide: a room with two groups shows one of them'), 'Publish warns with the count: ' + dialog);
  eq(downloads, 0, 'and Cancel publishes nothing');
  ok(await page.evaluate(() => document.getElementById('sch-conflict-table-wrap').classList.contains('open')), 'Cancel opens the list');

  /* ── 6. the what-if lab ──────────────────────────────────────────────── */
  Object.assign(ids, await page.evaluate(() => Object.fromEntries(AppState.schedules.groups.map(g => [g.name, g.id]))));   // the import made new ids
  await page.evaluate(id => { switchTab('whatif'); AppState.whatif.day = 'A'; wiSetOverride(id, 0, '101'); wiRenderAll(); }, ids['6-1']);
  await settle(page, 400);
  const lab = await page.textContent('#wi-conflicts');
  ok(lab.includes('Resolved') && lab.includes(DOUBLE), 'the lab says the scenario resolves the double-booking: ' + lab.slice(0, 160));

  /* ── 7. the walking checks, with a bell ─────────────────────────────── */
  const walking = await page.evaluate(() => {
    const before = window.runChecks(AppState.schedules.groups, { travel: true }).findings.filter(f => f.kind === 'passing-too-short').length;
    AppState.settings.bellSchedule = { A: [{ start: '08:30', end: '09:58' }, { start: '10:00', end: '11:28' }, { start: '11:30', end: '13:28' }, { start: '13:30', end: '15:00' }], B: null };
    AppState.settings.checks = { passingMarginSec: 100 };
    const r = window.runChecks(AppState.schedules.groups, { travel: true });
    const f = r.findings.filter(x => x.kind === 'passing-too-short');
    delete AppState.settings.checks;
    return { before, n: f.length, first: f[0] ? window.SVCheck.sentence(f[0], { labels: r.labels }) : '' };
  });
  ok(walking.before === 0 && walking.n > 0 && /^\S+ has .+ of walking between Blocks [A-D] and [A-D] on A days \(.+\) in a 2-minute passing time, less 1 minute 40 seconds of margin\.$/.test(walking.first),
    'with a bell the banner run measures each move on the blueprint (passing-too-short, margin 100 s): ' + walking.n + ', ' + walking.first);

  /* ── 8. back to clean: Publish says nothing ──────────────────────────── */
  await page.evaluate(id => { const g = AppState.schedules.groups.find(x => x.id === id); g.modsA[0] = '101'; g.mods = g.modsA; }, ids['6-1']);
  eq(await page.evaluate(() => publishWarning()), '', 'with no problem Publish has nothing to say');

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
