// smoke-pe-stations.mjs — the Tournament Bracket & Station Rotation tool's
// saved-unit guard.
//
//   node Tools/pe-tournament-stations/test/smoke-pe-stations.mjs
//
// The bug this pins down: `newProject(name)` built a fresh unit and saved it
// straight into `store.projects[name]` with no existence check, so typing a
// name that was already in use destroyed that saved unit — its stations,
// groups and bracket — with no confirmation and nothing to undo it with. The
// name field had the same hole from the other direction: renaming a unit onto
// another unit's name deleted the old key and wrote over the other one.
//
// Both are asserted here by doing the destructive thing and proving the saved
// unit is still on disk afterwards.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8155;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/021-pe-tournament-stations.html';
const KEY = 'pe-tournament-stations';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 900 });

/** Answers the next prompt with `value` and every confirm with `confirmWith`. */
async function stubDialogs(value, confirmWith = true) {
  await page.evaluate(([v, c]) => {
    window.prompt = () => v;
    window.confirm = () => c;
  }, [value, confirmWith]);
}

const savedNames = () => page.evaluate(k => {
  const raw = localStorage.getItem(k);
  return raw ? Object.keys(JSON.parse(raw).projects).sort() : [];
}, KEY);

const stationCount = (name) => page.evaluate(([k, n]) => {
  const raw = localStorage.getItem(k);
  if (!raw) return -1;
  const p = JSON.parse(raw).projects[n];
  return p ? p.stations.length : -1;
}, [KEY, name]);

console.log('Tournament Bracket & Station Rotation — saved-unit overwrite guard');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page);

/* The tool boots with an empty store, which creates a starter unit called
   "New Unit". It stays in every listing below — that it is never disturbed is
   part of what these assertions are checking. */

/* ── 1. build a unit worth losing ──────────────────────────────────────── */
await stubDialogs('Volleyball');
await page.click('#newProjectBtn');
await settle(page);
await page.evaluate(() => {
  document.getElementById('rosterText').value = 'Ada\nBrooklyn\nCamila\nDeclan\nElena\nFinn';
  document.getElementById('rosterText').dispatchEvent(new Event('input', { bubbles: true }));
});
await settle(page);
const beforeStations = await stationCount('Volleyball');
ok(beforeStations > 0, `the "Volleyball" unit is saved with ${beforeStations} stations`);

/* ── 2. New unit with a colliding name must not eat it ─────────────────── */
await stubDialogs('Volleyball', true);          // same name, accept the suffix
await page.click('#newProjectBtn');
await settle(page);
eq((await savedNames()).join(','), 'New Unit,Volleyball,Volleyball (2)', 'the colliding new unit is suffixed, not merged');
eq(await stationCount('Volleyball'), beforeStations, 'the original unit still has its stations');
ok(/untouched/.test(await page.textContent('#msg')), 'the tool says what it did instead of doing it silently');
ok((await page.$$('#projectSwitch option[value="Volleyball (2)"]')).length === 1,
   'the new unit appears in its own switcher straight away');

/* ── 3. declining the suffix leaves everything exactly as it was ────────── */
await stubDialogs('Volleyball', false);         // same name, refuse the suffix
await page.click('#newProjectBtn');
await settle(page);
eq((await savedNames()).join(','), 'New Unit,Volleyball,Volleyball (2)', 'cancelling creates nothing');
eq(await stationCount('Volleyball'), beforeStations, 'and destroys nothing');

/* ── 4. renaming onto a taken name is suffixed too ──────────────────────── */
await page.selectOption('#projectSwitch', 'Volleyball (2)');
await settle(page);
await page.fill('#projectName', 'Volleyball');
await page.dispatchEvent('#projectName', 'change');
await settle(page);
eq((await savedNames()).join(','), 'New Unit,Volleyball,Volleyball (2)', 'the rename does not overwrite the unit that owns the name');
eq(await stationCount('Volleyball'), beforeStations, 'the unit that owned the name is untouched');
eq(await page.inputValue('#projectName'), 'Volleyball (2)', 'the name field snaps back to the name actually in use');
ok(/kept the name/.test(await page.textContent('#msg')), 'and the tool explains why the rename did not take');

/* ── 5. an ordinary rename to a free name still just works ─────────────── */
await page.fill('#projectName', 'Badminton');
await page.dispatchEvent('#projectName', 'change');
await settle(page);
eq((await savedNames()).join(','), 'Badminton,New Unit,Volleyball', 'a non-colliding rename is unchanged behaviour');

/* ── 6. no console noise ────────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
