// smoke-relief.mjs — the shaded-relief layer under the World base map (Path 21 P4).
//
//   node Tools/blank-map-generator/test/smoke-relief.mjs
//
// Two halves. The first holds the Blender render's ledger entry to the page:
// the relief is stretched over the World preset's raster, so its bounds and
// its aspect must be that preset's exactly, or every mountain lands in the
// wrong place. The second drives the page: the toggle is off by default, has
// an accessible name, is only offered on the World map, and is disabled
// (and not drawn) while the map is shaded by data. It reads pixels back to
// check that the relief darkens land and leaves the sea alone.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle, SITE } from '../../board-check/harness.mjs';
import { BASE_MAP_PRESETS, findPreset, baseMapId, sameBaseMap, hasRelief } from '../bmg-vector.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8459;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/046-blank-map-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Blank Map Generator — shaded relief');

/* ══ part 1: the render matches the preset it sits under ═════════════════ */

const world = findPreset('world');
const ledger = JSON.parse(fs.readFileSync(path.join(SITE, 'Tools', 'blender-art', 'renders.json'), 'utf8'));
const entry = ledger.entries.find(e => e.path === 'Tools/blank-map-generator/art/' + world.relief);
ok(!!entry, 'the World preset\'s relief file has a ledger entry');
if (entry) {
  eq(JSON.stringify(entry.bounds), JSON.stringify(world.bounds), 'the render\'s bounds are the World preset\'s, verbatim');
  eq(entry.projection, 'equirectangular', 'and its projection is the page\'s plate carrée');
  const lonSpan = world.bounds.east - world.bounds.west, latSpan = world.bounds.north - world.bounds.south;
  ok(Math.abs(entry.width / entry.height - lonSpan / latSpan) < 0.005,
     `its aspect is the preset's (${(entry.width / entry.height).toFixed(4)} vs ${(lonSpan / latSpan).toFixed(4)})`);
  eq(entry.width, 2048, 'it is 2048 px wide');
  ok(entry.bytes <= 409600, `it is within the row's 400 KB (${entry.bytes} B)`);
  ok(entry.underText && entry.underText.token === '--ink' && entry.underText.region.join() === [0, 0, entry.width, entry.height].join(),
     'its under-text region is the whole image, against --ink');
}
ok(fs.existsSync(path.join(HERE, '..', 'art', world.relief)), 'the file is in the tree');
eq(BASE_MAP_PRESETS.filter(hasRelief).map(p => p.key).join(), 'world', 'only the World preset offers relief');

const plain = baseMapId(world, 'land', true, '');
const lifted = baseMapId(world, 'land', true, '', true);
eq(lifted, plain + '+relief', 'relief gets its own cache id');
ok(sameBaseMap(plain, lifted), 'but it is the same base map, so switching it keeps the labels');
eq(baseMapId(world, 'land', true, 'abc', true), baseMapId(world, 'land', true, 'abc'), 'a shaded map never carries +relief');
eq(baseMapId(findPreset('usa-48'), 'land', true, '', true), baseMapId(findPreset('usa-48'), 'land', true, ''), 'nor does a preset with no relief render');

/* ══ part 2: the tool itself ═════════════════════════════════════════════ */

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1500, height: 1000 });

const mapId = () => page.evaluate(() => {
  const raw = Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]).find(([k]) => /bmg_workspace/.test(k));
  if (!raw) return null;
  const w = JSON.parse(raw[1]);
  const p = w.projects.find(x => x.id === w.activeId);
  return (p && p.data.mapId) || null;
});
const waitForMapId = (test, not = null) => page.waitForFunction(({ test, not }) => {
  const raw = Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]).find(([k]) => /bmg_workspace/.test(k));
  if (!raw) return false;
  const w = JSON.parse(raw[1]);
  const p = w.projects.find(x => x.id === w.activeId);
  const id = (p && p.data.mapId) || '';
  return !!id && id !== not && new RegExp(test).test(id);
}, { test, not }, { timeout: 90000 });

/** Mean luminance of a 9×9 block of the raster the viewer shows, at a lat/lon on the World preset. */
const sample = (lat, lon) => page.evaluate(({ lat, lon, b }) => {
  const img = document.getElementById('mapImg');
  const w = img.naturalWidth, h = img.naturalHeight;
  const x = Math.round(((lon - b.west) / (b.east - b.west)) * w);
  const y = Math.round(((b.north - lat) / (b.north - b.south)) * h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0);
  const d = c.getContext('2d').getImageData(x - 4, y - 4, 9, 9).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  return sum / (d.length / 4);
}, { lat, lon, b: world.bounds });

const TIBET = [31, 88], HIMALAYA = [28, 86.9], PACIFIC = [-20, -140], KANSAS = [38.5, -98.5];

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 900);
const offsiteBefore = page.__blocked.length;

/* ── the toggle: named, off, World only ────────────────────────────────── */
const box = page.getByRole('checkbox', { name: 'Shaded relief' });
eq(await box.count(), 1, 'the toggle has the accessible name "Shaded relief"');
eq(await box.isChecked(), false, 'it is off by default');
await page.selectOption('#baseMapSelect', 'usa-48');
eq(await box.isDisabled(), true, 'it is disabled on a preset with no relief render');
ok(/only drawn on the World/.test(await page.getAttribute('#baseMapReliefLabel', 'title')), 'and its title says why');
await page.selectOption('#baseMapSelect', 'world');
eq(await box.isDisabled(), false, 'it is offered on the World map');

/* ── World without, then with ──────────────────────────────────────────── */
await page.selectOption('#baseMapStyleSelect', 'outline');
await page.click('#btnBaseMap');
await waitForMapId('^vector:world:.*:outline\\+borders$');
await settle(page, 600);
const flat = { tibet: await sample(...TIBET), hima: await sample(...HIMALAYA), sea: await sample(...PACIFIC), plains: await sample(...KANSAS) };
const plainId = await mapId();

await box.check();
await page.click('#btnBaseMap');
await waitForMapId('\\+relief$', plainId);
await settle(page, 600);
const reliefId = await mapId();
eq(reliefId, plainId + '+relief', 'the relief map is cached under its own id');
const lit = { tibet: await sample(...TIBET), hima: await sample(...HIMALAYA), sea: await sample(...PACIFIC), plains: await sample(...KANSAS) };
ok(lit.hima < flat.hima - 3, `the Himalaya are shaded (luminance ${flat.hima.toFixed(1)} then ${lit.hima.toFixed(1)})`);
ok(Math.abs(lit.sea - flat.sea) < 0.5, `the sea is untouched (${flat.sea.toFixed(1)} then ${lit.sea.toFixed(1)})`);
ok(lit.plains > lit.hima, `flat Kansas stays lighter than the Himalaya (${lit.plains.toFixed(1)} vs ${lit.hima.toFixed(1)})`);
// --ink is #1f2430 (relative luminance 0.017); 4.5:1 against it needs 0.25,
// which is about 137 on this 8-bit scale. The ledger checks the file; this
// checks the composite on the page, on the darkest place there is.
ok(Math.min(lit.tibet, lit.hima) > 137, `the darkest relief still sits well above label-ink contrast (${Math.min(lit.tibet, lit.hima).toFixed(1)})`);

/* ── data shading turns it off ─────────────────────────────────────────── */
await page.click('#btnChoroToggle');
await settle(page, 200);
await page.fill('#choroInput', 'China, 1400\nIndia, 1380\nBrazil, 212\nCanada, 38\nAustralia, 25');
await settle(page, 500);
await page.click('#btnChoroApply');
await waitForMapId(':choro:', reliefId);
await settle(page, 600);
const choroId = await mapId();
ok(!/\+relief/.test(choroId), 'a map shaded by data is drawn without relief: ' + JSON.stringify(choroId));
eq(await box.isDisabled(), true, 'and the toggle is disabled while the shading is on');
ok(/shaded by data/.test(await page.getAttribute('#baseMapReliefLabel', 'title')), 'with the reason in its title');
await page.click('#btnChoroClear');
await waitForMapId('\\+relief$', choroId);
await settle(page, 400);
eq(await box.isDisabled(), false, 'removing the shading offers it again');
eq(await mapId(), reliefId, 'and the still-ticked relief comes back');

eq(page.__blocked.length, offsiteBefore,
   'drawing the relief made no offsite request: ' + JSON.stringify(page.__blocked.slice(offsiteBefore, offsiteBefore + 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
