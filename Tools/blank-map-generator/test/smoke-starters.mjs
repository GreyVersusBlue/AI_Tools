// smoke-starters.mjs — the Blank Map Generator's starter projects.
//
//   node Tools/blank-map-generator/test/smoke-starters.mjs
//
// A first run opened to an empty canvas and a list of things to configure,
// which is a poor use of the five minutes a teacher gives a tool during a prep
// period (P15). These are three complete maps assembled from parts that
// already ship offline: a built-in vector base map plus a built-in label set.
//
// Two properties matter and both are easy to get wrong:
//
//   1. Nothing is fetched. The whole point of these being built from the
//      vendored vector data is that they work on a blocked school network and
//      offline. The harness blocks offsite requests and the suite asserts none
//      was attempted.
//   2. A sample is a real project, not a picture. It opens as its own new
//      project (so a first click cannot overwrite work already there), its
//      labels are real label objects that can be dragged and deleted, and the
//      map is calibrated so coordinates still work.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8169;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/046-blank-map-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1500, height: 1000 });

const workspace = () => page.evaluate(() => {
  const raw = Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])
    .find(([k]) => /bmg_workspace|bmg_/.test(k) && /projects/.test(localStorage.getItem(k) || ''));
  return raw ? JSON.parse(raw[1]) : null;
});

const activeProject = async () => {
  const w = await workspace();
  if (!w) return null;
  return w.projects.find(p => p.id === w.activeId) || null;
};

/** Waits for the starter build to report back, however it ends. */
const waitForStarter = () => page.waitForFunction(
  () => /Opened|Couldn/.test(document.getElementById('starterStatus').textContent),
  null, { timeout: 60000 });

console.log('Blank Map Generator — starter projects');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 800);

/* ── 1. a first run is offered something to open ───────────────────────── */
eq(await page.isVisible('#starterCard'), true, 'a first run is offered starter projects');
const starters = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#starterRow [data-starter]')).map(b => b.textContent.trim()));
eq(starters.length, 3, 'three of them');
ok(starters.some(s => /Europe/.test(s)), 'a Europe map: ' + JSON.stringify(starters));
ok(starters.some(s => /United States/.test(s)), 'a United States map');
ok(starters.some(s => /World/.test(s)), 'a world physical map');

const before = await workspace();
const projectsBefore = before ? before.projects.length : 0;
/* The tool runs a Wikimedia search of its own on boot (the Search card's
   default query), which is nothing to do with the samples. Only requests made
   from here on are the samples' responsibility. */
const offsiteBeforeBuild = page.__blocked.length;

/* ── 2. building one produces a real, complete project ─────────────────── */
await page.click('#starterRow [data-starter="0"]');
await waitForStarter();
await settle(page, 600);

const status = await page.textContent('#starterStatus');
ok(/Opened/.test(status), 'the Europe sample built: ' + JSON.stringify(status));

const after = await workspace();
eq(after.projects.length, projectsBefore + 1, 'it opened as its own new project rather than overwriting one');
const proj = await activeProject();
ok(/Europe/.test(proj.name), 'named after the sample: ' + JSON.stringify(proj.name));
ok(proj.data.mapId && /^vector:/.test(proj.data.mapId),
   'built on a vendored vector base map, not a downloaded one: ' + JSON.stringify(proj.data.mapId));
ok(proj.data.calibration, 'the map is calibrated, so coordinates and the grid still work');
ok(proj.data.labels.length > 20, `every country is labelled (${proj.data.labels.length} labels)`);
ok(proj.data.labels.every(l => typeof l.x === 'number' && typeof l.y === 'number'),
   'and they are real placed labels, not a baked-in picture');

/* the labels are on screen and editable */
const onScreen = await page.evaluate(() => document.querySelectorAll('.bmg-label').length);
ok(onScreen > 20, `the labels render on the map (${onScreen} nodes)`);

/* ── 3. nothing was fetched from off-site ──────────────────────────────── */
eq(page.__blocked.length, offsiteBeforeBuild,
   'building the sample made no offsite request at all — the whole point of the vendored vector data: ' +
   JSON.stringify(page.__blocked.slice(offsiteBeforeBuild, offsiteBeforeBuild + 4)));

/* ── 4. a second sample is a second project, not a replacement ─────────── */
await page.click('#starterRow [data-starter="1"]');
await waitForStarter();
await settle(page, 600);
const after2 = await workspace();
eq(after2.projects.length, projectsBefore + 2, 'the second sample is another new project');
const proj2 = await activeProject();
ok(/United States/.test(proj2.name), 'the US sample is now active');
ok(proj2.data.labels.length >= 45, `with the state labels placed (${proj2.data.labels.length})`);
const kept = after2.projects.find(p => /Europe/.test(p.name));
ok(kept && kept.data.labels.length > 20, 'and the Europe project is still there, intact');

/* ── 5. clicking the same sample twice does not collide on the name ────── */
await page.click('#starterRow [data-starter="1"]');
await waitForStarter();
await settle(page, 600);
const names = (await workspace()).projects.map(p => p.name);
const usNames = names.filter(n => /United States/.test(n));
eq(usNames.length, 2, 'a second copy is a second project');
ok(usNames[0] !== usNames[1], 'with a distinct name: ' + JSON.stringify(usNames));

/* ── 6. a sample survives a reload, like any other project ─────────────── */
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 1200);
const reloaded = await activeProject();
ok(reloaded && reloaded.data.labels.length >= 45, 'the sample reopens with its labels after a reload');

/* ── 7. no console noise ───────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
