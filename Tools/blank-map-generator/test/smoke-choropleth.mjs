// smoke-choropleth.mjs — shading a built-in base map from pasted data.
//
//   node Tools/blank-map-generator/test/smoke-choropleth.mjs
//
// Two halves. The first runs bmg-choropleth.js directly against the real
// vendored GeoJSON in ../data/ — parsing, the alias table, quantile classes
// and the ramps' grayscale safety are pure functions and deserve to be
// checked without a browser in the way. The second drives the actual UI in
// headless Chromium and looks at the pixels that came out.
//
// What the pixel checks are really for: a choropleth is only true if the ink
// on the paper matches the numbers. So the suite reads the rendered raster
// back and asserts that a big-population state comes out *darker* than a
// small one, and that re-shading with different data changes that same
// state's pixel. A legend that says one thing while the map shows another is
// the failure mode worth spending a test on.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import {
  parseDataRows, matchRegions, buildChoropleth, quantileBreaks,
  rampLuminances, RAMPS, RAMP_LUMINANCE_STEP, EXAMPLE_US_POPULATION,
} from '../bmg-choropleth.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8171;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/046-blank-map-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const namesIn = file =>
  JSON.parse(fs.readFileSync(path.join(HERE, '..', 'data', file), 'utf8'))
    .features.map(f => f.properties.name);

console.log('Blank Map Generator — choropleth from pasted data');

/* ══ part 1: the module, against the real map data ═══════════════════════ */

const US_NAMES = namesIn('us-states-10m.json');
const WORLD_NAMES = namesIn('world-countries-110m.json');

/* ── parsing tolerates what a spreadsheet actually pastes ──────────────── */
const parsed = parseDataRows(
  'State\tPopulation\n' +
  'Maryland\t6,200,000\n' +
  'Virginia; 8700000\n' +
  '\n' +
  'Delaware, 1,000,000\n' +
  'Congo, Dem. Rep., 95000000\n' +
  'a line with no number\n'
);
eq(parsed.rows.length, 4, 'four data rows read from mixed tabs, semicolons and commas');
eq(parsed.headerSkipped, 'State\tPopulation', 'the header row is recognised and skipped, not counted as data');
eq(parsed.rows[0].value, 6200000, 'thousands separators are read as one number');
eq(parsed.rows[3].name, 'Congo, Dem. Rep.', 'a name containing the delimiter survives intact');
eq(parsed.unreadable.length, 1, 'a line with no number is reported, not silently dropped');

/* ── the alias table covers the usual traps ────────────────────────────── */
const aliasTest = matchRegions(
  [['United States', 1], ['UK', 2], ['DRC', 3], ['Burma', 4], ['Ivory Coast', 5], ['Czech Republic', 6], ['Atlantis', 7]]
    .map(([name, value]) => ({ name, value })),
  WORLD_NAMES
);
eq(aliasTest.values.get('United States of America'), 1, 'United States matches the map\'s "United States of America"');
eq(aliasTest.values.get('United Kingdom'), 2, 'UK matches');
eq(aliasTest.values.get('Dem. Rep. Congo'), 3, 'DRC matches');
eq(aliasTest.values.get('Myanmar'), 4, 'Burma matches Myanmar');
eq(aliasTest.values.get("Côte d'Ivoire"), 5, 'Ivory Coast matches, accents and all');
eq(aliasTest.values.get('Czechia'), 6, 'Czech Republic matches Czechia');
eq(aliasTest.unmatched.join(), 'Atlantis', 'and a name that matches nothing comes back by name');

const abbrev = matchRegions([{ name: 'md', value: 1 }, { name: 'D.C.', value: 2 }, { name: 'Washington DC', value: 3 }], US_NAMES);
eq(abbrev.values.get('Maryland'), 1, 'a lowercase postal abbreviation matches its state');
eq(abbrev.values.get('District of Columbia'), 3, 'D.C. and Washington DC both reach the District of Columbia');
ok(!abbrev.values.has('Washington'), 'and "Washington DC" does not land on Washington state');

/* ── classification ────────────────────────────────────────────────────── */
const breaks = quantileBreaks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
eq(breaks.length, 5, 'five quantile classes over ten values');
ok(breaks.every((b, i) => i === 0 || b > breaks[i - 1]), 'with strictly ascending upper bounds');
eq(breaks[breaks.length - 1], 10, 'the top class ends at the largest value');
eq(quantileBreaks([7, 7, 7, 7], 5).length, 1, 'four identical values collapse to one band, not five empty ones');

/* ── the ramps really are grayscale-safe ───────────────────────────────── */
RAMPS.forEach(r => {
  const lum = rampLuminances(r.key);
  const steps = lum.slice(1).map((v, i) => lum[i] - v);
  ok(steps.every(s => s >= RAMP_LUMINANCE_STEP),
     `${r.key} gets darker at every step by at least ${RAMP_LUMINANCE_STEP} luminance, so a b&w copier keeps the ranking (steps ${steps.map(s => s.toFixed(3)).join(', ')})`);
});

/* ── the example data is real and complete ─────────────────────────────── */
const example = buildChoropleth({ text: EXAMPLE_US_POPULATION, regionNames: US_NAMES, classes: 5 });
eq(example.rowCount, 50, 'the example data is all 50 states');
eq(example.matchedCount, 50, 'and every one of them matches the map');
eq(example.unmatched.length, 0, 'with nothing left over');
eq(example.legendRows.length, 5, 'five legend rows come back');
ok(example.legendRows.every(r => /\d/.test(r.label)), 'each captioned with its numeric range: ' + JSON.stringify(example.legendRows.map(r => r.label)));
ok(example.fills['California'] !== example.fills['Wyoming'], 'the biggest and smallest states are not the same colour');

/* the same data must always produce the same cache key, and different data must not */
const again = buildChoropleth({ text: EXAMPLE_US_POPULATION, regionNames: US_NAMES, classes: 5 });
eq(again.key, example.key, 'the same data and settings hash to the same cache key');
const fewer = buildChoropleth({ text: EXAMPLE_US_POPULATION, regionNames: US_NAMES, classes: 4 });
ok(fewer.key !== example.key, 'changing the band count changes the key, so the two renders cannot share a cache record');

/* ══ part 2: the tool itself ═════════════════════════════════════════════ */

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1500, height: 1000 });

const workspace = () => page.evaluate(() => {
  const raw = Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])
    .find(([k]) => /bmg_workspace/.test(k));
  return raw ? JSON.parse(raw[1]) : null;
});
const activeProject = async () => {
  const w = await workspace();
  return w ? (w.projects.find(p => p.id === w.activeId) || null) : null;
};
const mapId = async () => { const p = await activeProject(); return p ? p.data.mapId : null; };

/**
 * Waits until the active project's map id is a shaded one (`want: 'choro'`)
 * or a plain one, optionally requiring it to have changed from `not`.
 * Rendering a 4000px raster takes a moment, so every UI step that redraws the
 * map waits on the saved id rather than on a fixed sleep.
 */
const waitForMapId = (want, not = null) => page.waitForFunction(({ want, not }) => {
  const raw = Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]).find(([k]) => /bmg_workspace/.test(k));
  if (!raw) return false;
  const w = JSON.parse(raw[1]);
  const p = w.projects.find(x => x.id === w.activeId);
  const id = (p && p.data.mapId) || '';
  if (!id || id === not) return false;
  return want === 'choro' ? id.includes(':choro:') : !id.includes(':choro:');
}, { want, not }, { timeout: 90000 });

/**
 * Samples the rendered base raster at a lat/lon, straight out of the <img>
 * the viewer is showing. The built-in maps are plate carrée over the preset's
 * own bounds (bmg-vector.js), so the projection is two divisions — no need to
 * reach into the page's modules for it.
 */
const samplePixel = (lat, lon, bounds) => page.evaluate(({ lat, lon, bounds }) => {
  const img = document.getElementById('mapImg');
  const w = img.naturalWidth, h = img.naturalHeight;
  const x = Math.round(((lon - bounds.west) / (bounds.east - bounds.west)) * w);
  const y = Math.round(((bounds.north - lat) / (bounds.north - bounds.south)) * h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0);
  const d = c.getContext('2d').getImageData(x, y, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], lum: 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2] };
}, { lat, lon, bounds });

const USA48 = { north: 50, south: 24, west: -125, east: -66.5 };
const CALIFORNIA = [36.5, -119.5];
const WYOMING = [43.0, -107.5];

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 900);
const offsiteBefore = page.__blocked.length;

/* ── the paste box is offered, and the example fills it ────────────────── */
eq(await page.isVisible('#choroPanel'), false, 'the shading panel starts out of the way');
await page.click('#btnChoroToggle');
await settle(page, 200);
eq(await page.isVisible('#choroPanel'), true, 'the "Shade by data" button opens it');

await page.click('#btnChoroExample');
await settle(page, 700);
const pastedRows = (await page.inputValue('#choroInput')).trim().split('\n').length;
eq(pastedRows, 51, 'the example loads 50 states plus a header row');
eq(await page.inputValue('#baseMapSelect'), 'usa-48', 'and points the picker at a map that can actually show them');
const report = await page.textContent('#choroReport');
ok(/50 of 50 rows matched/.test(report), 'the report says 50 of 50 matched: ' + JSON.stringify(report));

/* ── shading the map ───────────────────────────────────────────────────── */
await page.click('#btnChoroApply');
await waitForMapId('choro');
await settle(page, 900);

const shadedId = await mapId();
ok(/^vector:usa-48:/.test(shadedId) && /:choro:/.test(shadedId),
   'the shaded map gets its own cache id with a :choro: suffix: ' + JSON.stringify(shadedId));

const ca = await samplePixel(...CALIFORNIA, USA48);
const wy = await samplePixel(...WYOMING, USA48);
ok(ca.lum < wy.lum - 20,
   `California (39M people) is rendered darker than Wyoming (0.6M): luminance ${ca.lum.toFixed(0)} vs ${wy.lum.toFixed(0)}`);
ok(!(ca.r === wy.r && ca.g === wy.g && ca.b === wy.b),
   'the two states are genuinely different pixels, not the same fill');

/* ── the legend wrote itself ───────────────────────────────────────────── */
const legendRows = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#legendPanel .legend-row'))
    .filter(r => /^choro:/.test(r.dataset.legendKey || ''))
    .map(r => r.querySelector('input').placeholder));
eq(legendRows.length, 5, 'the key gained one row per class');
ok(legendRows.every(l => /\d/.test(l)), 'each showing its own numeric range: ' + JSON.stringify(legendRows));
eq(await page.isVisible('#legendPanel'), true, 'and the key is on screen');

/* ── re-shading with different data changes the same state's pixel ─────── */
await page.fill('#choroInput', 'California, 1\nTexas, 2\nWyoming, 900\nMontana, 800\nMaine, 700\nOhio, 3\nUtah, 600\nIdaho, 500\nNevada, 400\nOregon, 4');
await settle(page, 500);
await page.click('#btnChoroApply');
await waitForMapId('choro', shadedId);
await settle(page, 900);
const flippedId = await mapId();

const caFlipped = await samplePixel(...CALIFORNIA, USA48);
const wyFlipped = await samplePixel(...WYOMING, USA48);
ok(caFlipped.lum > ca.lum + 20,
   `California lightens when its value drops to the bottom band: ${ca.lum.toFixed(0)} then ${caFlipped.lum.toFixed(0)}`);
ok(wyFlipped.lum < wy.lum - 20,
   `and Wyoming darkens when its value tops the table: ${wy.lum.toFixed(0)} then ${wyFlipped.lum.toFixed(0)}`);

/* ── unmatched rows are named, never silently dropped ──────────────────── */
await page.fill('#choroInput', 'Maryland, 6200000\nVirginia, 8700000\nAtlantis, 100\nWestmarch, 200');
await settle(page, 600);
const badReport = await page.textContent('#choroReport');
ok(/Atlantis/.test(badReport) && /Westmarch/.test(badReport),
   'both unmatched names are printed in full: ' + JSON.stringify(badReport));
ok(/2 of 4 rows matched/.test(badReport), 'with an honest matched count');

/* ── labels placed on a map survive re-shading it ──────────────────────── */
await page.fill('#choroInput', EXAMPLE_US_POPULATION);
await settle(page, 500);
await page.click('#btnChoroApply');
await waitForMapId('choro', flippedId);
await settle(page, 900);

await page.click('#btnLabelSets');
await settle(page, 250);
await page.selectOption('#labelSetSelect', 'us-states');
await settle(page, 150);
await page.click('#btnPlaceLabelSet');
await settle(page, 1500);
const labelsBefore = (await activeProject()).data.labels.length;
ok(labelsBefore > 20, `state labels placed on the shaded map (${labelsBefore})`);
const labelledId = await mapId();

await page.selectOption('#choroClassSelect', '4');
await settle(page, 500);
await page.click('#btnChoroApply');
await waitForMapId('choro', labelledId);
await settle(page, 900);
const labelsAfter = (await activeProject()).data.labels.length;
eq(labelsAfter, labelsBefore, 're-shading the same base map keeps every label the teacher had already placed');

/* ── removing the shading goes back to a clean base map ────────────────── */
await page.click('#btnChoroClear');
await waitForMapId('plain');
await settle(page, 900);
const plainId = await mapId();
ok(/^vector:usa-48:/.test(plainId) && !/:choro:/.test(plainId),
   'removing the shading returns to the plain base map record: ' + JSON.stringify(plainId));
const caPlain = await samplePixel(...CALIFORNIA, USA48);
ok(caPlain.lum > 200, `and California is unshaded again (luminance ${caPlain.lum.toFixed(0)})`);
eq((await activeProject()).data.labels.length, labelsBefore, 'labels survive un-shading too');

/* ── it all comes back after a reload ──────────────────────────────────── */
await page.click('#btnChoroApply');
await waitForMapId('choro');
await settle(page, 900);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 1600);

const reloaded = await activeProject();
ok(/:choro:/.test(reloaded.data.mapId), 'the shaded map is what reopens after a reload');
eq(reloaded.data.choropleth.enabled, true, 'the shading setting persisted');
ok(reloaded.data.choropleth.text.includes('California'), 'and so did the pasted data, ready to edit');
eq(reloaded.data.choropleth.legendRows.length, 4, 'the key comes back with its class rows');
const reloadedLegend = await page.evaluate(() =>
  document.querySelectorAll('#legendPanel .legend-row[data-legend-key^="choro:"]').length);
eq(reloadedLegend, 4, 'and renders them without re-reading the map data');
const caReloaded = await samplePixel(...CALIFORNIA, USA48);
ok(caReloaded.lum < 160, `the reloaded map is still shaded (California luminance ${caReloaded.lum.toFixed(0)})`);

/* ── nothing left the browser, nothing broke ───────────────────────────── */
eq(page.__blocked.length, offsiteBefore,
   'shading a map made no offsite request at all: ' + JSON.stringify(page.__blocked.slice(offsiteBefore, offsiteBefore + 4)));
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
