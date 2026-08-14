// smoke-hittest.mjs — click-to-shade: turning a point on a built-in base map
// into the country or state under it, and shading it.
//
//   node Tools/blank-map-generator/test/smoke-hittest.mjs
//
// Two halves, same shape as smoke-choropleth.mjs. The first runs
// bmg-hittest.js against the real vendored GeoJSON with no browser in the
// way: hit testing is pure geometry and deserves to be checked as such. The
// second drives the actual UI, clicks the map where Texas is, and looks at
// what came out the other end.
//
// The cases that earn their place here are the ones that a naive
// point-in-polygon gets wrong, all of which are real countries a teacher will
// click on a Tuesday:
//
//   - **Holes.** Lesotho is a country-shaped hole in South Africa. A test
//     that only checks "is the point inside the outer ring" says South
//     Africa, and shades the wrong country.
//   - **Multi-polygons.** Alaska is 137 separate rings once the Aleutians and
//     the Alexander Archipelago are counted. A click on Unalaska is a click
//     on Alaska.
//   - **The antimeridian.** Natural Earth clamps a ring that straddles 180°
//     to ±180, and bmg-vector.js draws such a ring twice — once shifted 360°
//     — so that the half belonging at the far edge of the map appears there.
//     Fiji and the Chukotka tip of Russia are drawn on both edges, so they
//     have to be *clickable* on both edges, or the hit test disagrees with
//     the picture.
//   - **Antarctica**, which is only a filled shape at all because the
//     renderer closes its ring through the pole.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import { buildRegionIndex, hitTestRegion, pointInRings, compactRings, largestRing } from '../bmg-hittest.js';
import { findPreset, pixelSizeFor } from '../bmg-vector.js';
import { regionGroupCaption } from '../bmg-legend.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8246;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/046-blank-map-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const loadData = file => JSON.parse(fs.readFileSync(path.join(HERE, '..', 'data', file), 'utf8'));

console.log('Blank Map Generator — click to shade');

/* ══ part 1: the geometry, against the real map data ═════════════════════ */

/** A preset's projected region index plus the lat/lon → pixel conversion that goes with it. */
function mapUnder(presetKey, file) {
  const preset = findPreset(presetKey);
  const { width, height } = pixelSizeFor(preset.bounds);
  const geojson = loadData(file);
  const entries = buildRegionIndex(geojson, preset.bounds, width, height);
  const b = preset.bounds;
  const toPixel = (lat, lon) => ({
    x: ((lon - b.west) / (b.east - b.west)) * width,
    y: ((b.north - lat) / (b.north - b.south)) * height,
  });
  const nameAt = (lat, lon) => {
    const { x, y } = toPixel(lat, lon);
    const hit = hitTestRegion(entries, x, y);
    return hit ? hit.name : null;
  };
  return { preset, width, height, geojson, entries, toPixel, nameAt };
}

const usa48 = mapUnder('usa-48', 'us-states-10m.json');
const usa50 = mapUnder('usa-50', 'us-states-10m.json');
const world = mapUnder('world', 'world-countries-110m.json');

/* ── the index covers every named region the map can draw ──────────────── */
const namedFeatures = world.geojson.features.filter(f => f.properties && f.properties.name).length;
eq(world.entries.length, namedFeatures, 'every named country on the world map is in the index');
ok(world.entries.every(e => e.rings.length && e.bbox), 'each index entry has rings and a bounding box to reject cheaply against');

/* ── the ordinary case: click a state, get that state ──────────────────── */
eq(usa48.nameAt(31.0, -99.5), 'Texas', 'a point in central Texas hits Texas');
eq(usa48.nameAt(39.2, -76.8), 'Maryland', 'a point near Baltimore hits Maryland');
eq(usa48.nameAt(36.5, -119.5), 'California', "a point in California's central valley hits California");
eq(usa48.nameAt(46.4, -87.5), 'Michigan', "Michigan's Upper Peninsula is still Michigan, not a separate shape");

/* ── water is water, and says so instead of guessing ───────────────────── */
eq(usa48.nameAt(26.0, -90.0), null, 'a point in the Gulf of Mexico hits nothing at all');
eq(world.nameAt(0, -140), null, 'and neither does the middle of the Pacific');

/* ── multi-polygon: one region, many separate shapes ───────────────────── */
const alaska = usa50.entries.find(e => e.name === 'Alaska');
ok(alaska.rings.length > 50, `Alaska is a genuine multi-polygon in this data (${alaska.rings.length} rings)`);
eq(usa50.nameAt(64.0, -152.0), 'Alaska', 'the Alaskan mainland hits Alaska');
eq(usa50.nameAt(53.87, -166.53), 'Alaska', 'and so does Unalaska, 1,200 km out along the Aleutians');
eq(usa50.nameAt(57.4, -153.4), 'Alaska', 'and Kodiak Island');
eq(usa50.nameAt(19.6, -155.5), 'Hawaii', "Hawaii's Big Island hits Hawaii");
eq(usa50.nameAt(21.45, -158.0), 'Hawaii', 'and so does Oahu, a separate island in the same state');

/* ── holes: a country inside another country ───────────────────────────── */
const southAfrica = world.entries.find(e => e.name === 'South Africa');
const lesothoPoint = world.toPixel(-29.6, 28.25);
eq(pointInRings(southAfrica.rings, lesothoPoint.x, lesothoPoint.y), false,
   "Lesotho's location counts as OUTSIDE South Africa — the enclave is a real hole, not painted over");
eq(world.nameAt(-29.6, 28.25), 'Lesotho', 'and clicking there gets Lesotho');
eq(world.nameAt(-28.5, 24.5), 'South Africa', 'while a point in South Africa proper still gets South Africa');

/* ── the antimeridian: drawn on both edges, so clickable on both ───────── */
eq(world.nameAt(-16.6, 179.0), 'Fiji', 'Fiji is clickable at 179°E, on the right-hand edge of the world map');
eq(world.nameAt(-16.2, -179.9), 'Fiji', 'and at 179.9°W, on the left-hand edge — the same ring, drawn shifted 360°');
eq(world.nameAt(65.5, -173.0), 'Russia', "Russia's Chukotka tip is clickable east of the antimeridian too");
eq(world.nameAt(55.7, 37.6), 'Russia', 'and Moscow is, unsurprisingly, also Russia');

/* ── Antarctica only exists as a shape because the ring closes at the pole ── */
eq(world.nameAt(-89, -90), 'Antarctica', 'a point almost at the South Pole hits Antarctica, thanks to the polar closure');
eq(world.nameAt(-85, 0), 'Antarctica', 'as does one on the far side of it');

/* ── a few more countries, because a hit test is only useful if it's right ── */
eq(world.nameAt(42.8, 12.5), 'Italy', 'Italy');
eq(world.nameAt(-7.3, 110.0), 'Indonesia', 'Java is Indonesia');
eq(world.nameAt(35.2, 24.9), 'Greece', 'Crete is Greece');
eq(world.nameAt(-2.0, 23.0), 'Dem. Rep. Congo', "and the map's own spelling comes back, ready for the legend");

/* ── what gets stored is trimmed, not mangled ──────────────────────────── */
const maryland = usa48.entries.find(e => e.name === 'Maryland');
const compact = compactRings(maryland.rings);
ok(compact.length >= 1, `Maryland keeps at least its main outline after compacting (${maryland.rings.length} rings in, ${compact.length} out)`);
ok(compact.every(ring => ring.every(p => Number.isInteger(p.x) && Number.isInteger(p.y))),
   'every stored coordinate is a whole raster pixel — sub-pixel precision is bytes spent on nothing visible');
const compactPoints = compact.reduce((n, r) => n + r.length, 0);
const rawPoints = maryland.rings.reduce((n, r) => n + r.length, 0);
ok(compactPoints <= rawPoints, `and compacting never adds points (${rawPoints} to ${compactPoints})`);
const stillCovers = pointInRings(compact, ...Object.values(usa48.toPixel(39.2, -76.8)));
ok(stillCovers, 'the compacted outline still covers the point that was clicked to make it');

eq(compactRings([[{ x: 1.4, y: 1.4 }, { x: 1.4, y: 1.4 }, { x: 9.6, y: 1.2 }, { x: 5, y: 9 }]])[0].length, 3,
   'points that round onto each other are dropped rather than stored twice');
eq(compactRings([[{ x: 0, y: 0 }, { x: 0.2, y: 0.2 }, { x: 0.1, y: 0 }]]).length, 0,
   'a ring that rounds away to less than a triangle is dropped, not stored as a degenerate shape');

const biggest = largestRing(alaska.rings);
ok(alaska.rings.every(r => r.length <= biggest.length), "largestRing finds Alaska's mainland, the fallback outline for anything that can draw only one");

/* ── the key writes its own caption from the names ─────────────────────── */
eq(regionGroupCaption(['Texas']), 'Texas', 'one shaded state captions its key row with its own name');
eq(regionGroupCaption(['Texas', 'Louisiana']), 'Texas and Louisiana', 'two read as a pair');
eq(regionGroupCaption(['Texas', 'Louisiana', 'Alabama']), 'Texas, Louisiana and Alabama', 'three read as a list');
eq(regionGroupCaption(['Texas', 'Louisiana', 'Alabama', 'Georgia', 'Florida']), 'Texas, Louisiana, Alabama and 2 more',
   'and a long list is summarised rather than running off the key');
eq(regionGroupCaption([]), '', 'a hand-drawn region has no name, so it generates no caption and keeps its old prompt');

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
const regions = async () => ((await activeProject()) || { data: { regions: [] } }).data.regions;
const shadedNames = async () => (await regions()).filter(r => r.name).map(r => `${r.name}:${r.color}`).sort();

const USA48 = findPreset('usa-48').bounds;

/**
 * Clicks the map at a real latitude/longitude.
 *
 * The screen position is read off the <img> element's own box rather than
 * from the viewer's internals: the built-in maps are plate carrée over the
 * preset's bounds, so a lat/lon is a fraction of the image, and the image's
 * bounding rect already carries whatever pan and zoom is in force. That makes
 * this an honest end-to-end check — if the tool's own pan/zoom maths and the
 * hit test disagree, this is where it shows.
 */
/** The viewer sits well below the fold on a page this tall; a real mouse click has to be able to reach it. */
const showViewer = async () => {
  await page.evaluate(() => document.getElementById('viewport').scrollIntoView({ block: 'center' }));
  await settle(page, 250);
};

async function clickLatLon(lat, lon, opts = {}) {
  await showViewer();
  const pt = await page.evaluate(({ lat, lon, b }) => {
    const img = document.getElementById('mapImg');
    const r = img.getBoundingClientRect();
    return {
      x: r.left + ((lon - b.west) / (b.east - b.west)) * r.width,
      y: r.top + ((b.north - lat) / (b.north - b.south)) * r.height,
    };
  }, { lat, lon, b: USA48 });
  if (opts.right) {
    await page.mouse.click(pt.x, pt.y, { button: 'right' });
  } else if (opts.ctrl) {
    await page.keyboard.down('Control');
    await page.mouse.click(pt.x, pt.y);
    await page.keyboard.up('Control');
  } else {
    await page.mouse.click(pt.x, pt.y);
  }
  await settle(page, 160);
}

const waitForBaseMap = () => page.waitForFunction(() => {
  const raw = Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]).find(([k]) => /bmg_workspace/.test(k));
  if (!raw) return false;
  const w = JSON.parse(raw[1]);
  const p = w.projects.find(x => x.id === w.activeId);
  return !!(p && /^vector:usa-48:/.test(p.data.mapId || ''));
}, null, { timeout: 90000 });

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 900);
const offsiteBefore = page.__blocked.length;

/* ── the button is honest about when it can work ───────────────────────── */
eq(await page.isDisabled('#btnShadeClick'), true, 'with no map loaded, Click to Shade is disabled rather than silently doing nothing');

await page.selectOption('#baseMapSelect', 'usa-48');
await page.click('#btnBaseMap');
await waitForBaseMap();
await settle(page, 900);
eq(await page.isDisabled('#btnShadeClick'), false, 'a built-in base map enables it');

/* ── one click shades one state ────────────────────────────────────────── */
await page.click('#btnShadeClick');
await settle(page, 1200); // the region index is projected on entering the mode
eq(await page.evaluate(() => document.getElementById('btnShadeClick').classList.contains('active')), true,
   'the mode turns on');
eq(await page.isVisible('#btnClearShade'), true, 'and offers a way to clear everything it shades');

await clickLatLon(31.0, -99.5);
eq((await shadedNames()).join(), 'Texas:red', 'clicking central Texas shades Texas, in the first palette colour');
const texas = (await regions()).find(r => r.name === 'Texas');
ok(Array.isArray(texas.points) && texas.points.length > 3, 'the shaded region carries a real outline, not a placeholder');
eq(texas.pattern, 'solid', 'and an ordinary solid fill, so the grayscale-safe print substitution still applies to it');

/* ── the key names it without being asked ──────────────────────────────── */
const regionRowPlaceholders = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('#legendPanel .legend-row'))
    .filter(r => !/^choro:/.test(r.dataset.legendKey || ''))
    .map(r => r.querySelector('input') && r.querySelector('input').placeholder)
    .filter(Boolean));
eq((await regionRowPlaceholders()).join(), 'Texas', 'the key gains a row that already says "Texas"');

/* ── a second state in the same colour joins the same key row ──────────── */
await clickLatLon(35.5, -97.5); // Oklahoma
eq((await shadedNames()).join(), 'Oklahoma:red,Texas:red', 'a second click shades Oklahoma, also red');
eq((await regionRowPlaceholders()).join(), 'Texas and Oklahoma',
   'and they share one key row, which now names both — one colour is one idea');

/* ── clicking again cycles the colour, which splits the key ────────────── */
await clickLatLon(31.0, -99.5);
eq((await shadedNames()).join(), 'Oklahoma:red,Texas:blue', 'clicking Texas again moves it to the next colour');
const twoRows = await regionRowPlaceholders();
eq(twoRows.length, 2, 'so the key now has two rows');
ok(twoRows.includes('Texas') && twoRows.includes('Oklahoma'), 'one per colour, each naming what is in it: ' + JSON.stringify(twoRows));

/* ── Ctrl-click and right-click both clear ─────────────────────────────── */
await clickLatLon(31.0, -99.5, { ctrl: true });
eq((await shadedNames()).join(), 'Oklahoma:red', 'Ctrl-clicking a shaded state clears it');
await clickLatLon(35.5, -97.5, { right: true });
eq((await shadedNames()).join(), '', 'and right-clicking clears the other, without leaving a phantom re-shade behind');

/* ── undo and redo cover it like every other edit ──────────────────────── */
await page.keyboard.press('Control+z');
await settle(page, 250);
eq((await shadedNames()).join(), 'Oklahoma:red', 'Ctrl+Z puts the last cleared state back');
await page.keyboard.press('Control+y');
await settle(page, 250);
eq((await shadedNames()).join(), '', 'and Ctrl+Y clears it again');

/* ── water is reported, not guessed at ─────────────────────────────────── */
await clickLatLon(26.0, -90.0); // Gulf of Mexico
eq((await shadedNames()).join(), '', 'clicking the Gulf of Mexico shades nothing');
const oceanMsg = await page.textContent('#toolMsg');
ok(/water|outside/i.test(oceanMsg), 'and says why rather than failing silently: ' + JSON.stringify(oceanMsg));

/* ── a many-ringed state draws as one evenodd path, so its holes stay holes ── */
await clickLatLon(39.2, -76.8); // Maryland — four rings in this data
eq((await shadedNames()).join(), 'Maryland:red', 'Maryland shades');
const mdShape = await page.evaluate(() => {
  const path = document.querySelector('#regionSvg path');
  if (!path) return null;
  const box = path.getBBox();
  return { rule: path.getAttribute('fill-rule'), w: box.width, h: box.height, x: box.x, y: box.y };
});
ok(mdShape, 'a multi-ring region renders as an SVG path rather than a single polygon');
eq(mdShape.rule, 'evenodd', 'filled evenodd, so an enclosed ring punches a hole instead of being painted over');
const mdExpected = await page.evaluate(({ b }) => {
  const img = document.getElementById('mapImg');
  const w = img.naturalWidth, h = img.naturalHeight;
  return {
    x: ((-76.8 - b.west) / (b.east - b.west)) * w,
    y: ((b.north - 39.2) / (b.north - b.south)) * h,
  };
}, { b: USA48 });
ok(mdExpected.x >= mdShape.x && mdExpected.x <= mdShape.x + mdShape.w
   && mdExpected.y >= mdShape.y && mdExpected.y <= mdShape.y + mdShape.h,
   'and the drawn shape really sits where the click was, in the map\'s own pixel space');

/* ── the hover readout names what is under the pointer ─────────────────── */
await showViewer();
await page.evaluate(({ b }) => {
  const img = document.getElementById('mapImg');
  const r = img.getBoundingClientRect();
  const x = r.left + ((-99.5 - b.west) / (b.east - b.west)) * r.width;
  const y = r.top + ((b.north - 31.0) / (b.north - b.south)) * r.height;
  document.getElementById('viewport').dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
}, { b: USA48 });
await settle(page, 350);
const hint = await page.textContent('#placeHint');
ok(/Texas/.test(hint), 'hovering over Texas says so, which doubles as a "what is this called" check: ' + JSON.stringify(hint));

/* ── it composes with the data choropleth instead of fighting it ───────── */
await page.click('#btnChoroToggle');
await settle(page, 250);
await page.click('#btnChoroExample');
await settle(page, 800);
await page.click('#btnChoroApply');
await page.waitForFunction(() => {
  const raw = Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]).find(([k]) => /bmg_workspace/.test(k));
  const w = JSON.parse(raw[1]);
  const p = w.projects.find(x => x.id === w.activeId);
  return /:choro:/.test((p && p.data.mapId) || '');
}, null, { timeout: 90000 });
await settle(page, 1000);
eq((await shadedNames()).join(), 'Maryland:red',
   'shading the map from data leaves the hand-clicked shading exactly where it was — they are different layers, not rivals');
const bothProject = await activeProject();
ok(/:choro:/.test(bothProject.data.mapId) && bothProject.data.choropleth.legendRows.length > 0,
   'and the data shading is applied at the same time, with its own class rows in the key');

/* ── everything comes back after a reload ──────────────────────────────── */
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 1800);
eq((await shadedNames()).join(), 'Maryland:red', 'the click-shading is still there after a reload');
const redrawn = await page.evaluate(() => document.querySelectorAll('#regionSvg path, #regionSvg polygon').length);
ok(redrawn >= 1, 'and it is drawn again, out of the saved project rather than re-read from the map data');
const reloadedPlaceholders = await regionRowPlaceholders();
ok(reloadedPlaceholders.includes('Maryland'), 'with its key row still naming it: ' + JSON.stringify(reloadedPlaceholders));

/* ── clearing removes only what was click-shaded ───────────────────────── */
await page.click('#btnShadeClick');
await settle(page, 1200);
await clickLatLon(31.0, -99.5);
eq((await shadedNames()).length, 2, 'two states shaded, ready to clear');
await page.click('#btnClearShade');
await settle(page, 300);
eq((await shadedNames()).join(), '', 'Clear click-shading removes them in one go');
await page.keyboard.press('Control+z');
await settle(page, 300);
eq((await shadedNames()).length, 2, 'and that clear is a single undoable edit, not two');

/* ── nothing left the browser, nothing broke ───────────────────────────── */
eq(page.__blocked.length, offsiteBefore,
   'click-to-shade made no offsite request at all: ' + JSON.stringify(page.__blocked.slice(offsiteBefore, offsiteBefore + 4)));
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
