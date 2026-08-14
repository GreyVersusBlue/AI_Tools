// smoke-map-print.mjs — Timeline Builder's map + timeline print, places, and
// share links. The tool's first automated suite.
//
//   node Tools/timeline-builder/test/smoke-map-print.mjs
//
// Three things are worth a machine's attention here, and all three are easy to
// break silently:
//
//   1. A place can be set, and a place with usable coordinates is the ONLY
//      thing that puts an event on the map. An event without one has to stay
//      on the timeline rather than quietly disappearing from both.
//   2. The printed page's pins really correspond to the placed events — the
//      right count, the right numbers, and inside the map box rather than
//      off the edge of it. The extent is auto-fitted, so an off-by-one in
//      that math parks every pin in a corner and still "renders fine".
//   3. A share link round-trips a timeline WITHOUT its photos (they are
//      base64 and would blow the URL) and arrives as a new saved timeline
//      rather than replacing what was already open.
//
// The map is rendered from the Natural Earth GeoJSON vendored for the Blank
// Map Generator, so the suite also asserts what that implies: nothing offsite
// is requested. The harness blocks and records offsite traffic for us.
//
// window.print is stubbed before any print click: headless Chromium's print()
// is a documented no-op that never fires afterprint, so the assertions look at
// the built DOM (which is the part this tool owns) rather than at paper.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8187;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/015-timeline-builder.html';

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

console.log('Timeline Builder — places, map + timeline print, share link');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

// Stub printing everywhere it could be reached, before anything clicks Print.
await page.evaluate(() => {
  window.__printCalls = 0;
  window.print = () => { window.__printCalls++; };
});

const currentTimeline = () => page.evaluate(() => {
  const name = localStorage.getItem('gvb-timeline:current');
  const raw = localStorage.getItem('gvb-timeline:data:' + name);
  return raw ? JSON.parse(raw) : null;
});

/* ── 1. a place can be set on an event, from the gazetteer ─────────────── */

// A gazetteer pick fills the coordinates in, which is the whole point of
// shipping one — a teacher should never have to look up a latitude.
await page.fill('#evTitle', 'Declaration of Independence');
await page.fill('#evYearStart', '1776');
await page.fill('#evPlace', 'Philadelphia, Pennsylvania');
await page.dispatchEvent('#evPlace', 'change');
await settle(page, 100);
const autoLat = await page.inputValue('#evLat');
const autoLon = await page.inputValue('#evLon');
ok(Math.abs(parseFloat(autoLat) - 39.95) < 0.2, 'picking a gazetteer place fills in its latitude: ' + autoLat);
ok(Math.abs(parseFloat(autoLon) - -75.17) < 0.2, 'and its longitude: ' + autoLon);
await page.click('#saveEventBtn');
await settle(page, 200);

// A place the gazetteer has never heard of, with hand-typed coordinates.
await page.fill('#evTitle', 'Siege of Yorktown');
await page.fill('#evYearStart', '1781');
await page.fill('#evPlace', 'Yorktown battlefield');
await page.fill('#evLat', '37.24');
await page.fill('#evLon', '-76.51');
await page.click('#saveEventBtn');
await settle(page, 200);

// An event with no place at all — it must stay on the timeline and stay off
// the map. This is the documented behaviour, so it gets an assertion.
await page.fill('#evTitle', 'Treaty of Paris');
await page.fill('#evYearStart', '1783');
await page.click('#saveEventBtn');
await settle(page, 300);

const saved = await currentTimeline();
eq(saved.events.length, 3, 'three events saved');
const placed = saved.events.filter(e => e.place && typeof e.place.lat === 'number');
eq(placed.length, 2, 'exactly two of them carry usable coordinates');
eq(saved.events.find(e => e.title === 'Treaty of Paris').place, null, 'the unplaced event stores no place');
eq(saved.events.find(e => e.title === 'Siege of Yorktown').place.name, 'Yorktown battlefield',
  'a place the gazetteer does not know is kept verbatim');

// The place survives a reload, like everything else in a saved timeline.
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
await page.evaluate(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
const reloaded = await currentTimeline();
eq(reloaded.events.filter(e => e.place && typeof e.place.lat === 'number').length, 2,
  'places survive a reload');

/* ── 2. the map + timeline print builds pins matching the placed events ── */

const blockedBefore = page.__blocked.length;
await page.click('#mapPrintToggleBtn');
await settle(page, 150);
ok(/2 of 3 event/.test(await page.textContent('#mapPinCount')),
  'the panel says how many events will be pinned: ' + (await page.textContent('#mapPinCount')));

await page.click('#btnMapPrintGo');
// The base map is a real vector render; give it room on a slow machine.
await page.waitForFunction(() => window.__printCalls > 0, null, { timeout: 60000 });
await settle(page, 300);

const printed = await page.evaluate(() => {
  // #mapPrintPages is display:none on screen (it only exists for @media
  // print), so offsetWidth is 0 here — read the box's own declared size
  // instead, which is what the pin coordinates were computed against.
  const box = document.querySelector('#mapPrintPages .mapBox');
  const boxRect = box ? { w: parseFloat(box.style.width), h: parseFloat(box.style.height) } : null;
  return {
    pages: document.querySelectorAll('#mapPrintPages .mapPage').length,
    mapImages: document.querySelectorAll('#mapPrintPages .mapBox img').length,
    mapSrcIsData: (document.querySelector('#mapPrintPages .mapBox img') || {}).src?.startsWith('data:image/png') || false,
    boxRect,
    pins: Array.from(document.querySelectorAll('#mapPrintPages .mapPin')).map(p => ({
      text: p.textContent,
      left: parseFloat(p.style.left),
      top: parseFloat(p.style.top),
    })),
    keyItems: Array.from(document.querySelectorAll('#mapPrintPages .mapKeyItem')).map(k => k.textContent.trim()),
    stripBadges: Array.from(document.querySelectorAll('#mapPrintPages .mapStrip .pin-num')).map(b => b.textContent),
    stripMarkers: document.querySelectorAll('#mapPrintPages .mapStrip .marker').length,
    bodyClass: document.body.className,
  };
});

eq(printed.pages, 1, 'one landscape page is built');
eq(printed.mapImages, 1, 'with one base map image on it');
ok(printed.mapSrcIsData, 'the map is a locally rendered PNG data URL, not a fetched image');
eq(printed.pins.length, 2, 'one pin per placed event, and none for the unplaced one');
eq(printed.pins.map(p => p.text).sort().join('|'), '1|2', 'pins are numbered 1 and 2 chronologically');

// Auto-fit has to actually put the pins on the map. A broken extent still
// renders a map and still renders pins — just all of them off in a corner.
const inside = printed.pins.every(p =>
  p.left > 0 && p.left < printed.boxRect.w && p.top > 0 && p.top < printed.boxRect.h);
ok(inside, 'every pin lands inside the map box: ' + JSON.stringify(printed.pins) +
  ' in ' + JSON.stringify(printed.boxRect));
// Philadelphia (39.95N, 75.17W) is north of AND east of Yorktown (37.24N,
// 76.51W) — a longitude nearer zero is further east even though both are
// negative. So pin 1 belongs above and to the RIGHT of pin 2. Between them
// these two assertions catch a flipped sign on either axis, which is the way
// a projection usually goes wrong while still looking like a map.
const pin1 = printed.pins.find(p => p.text === '1');
const pin2 = printed.pins.find(p => p.text === '2');
ok(pin1.top < pin2.top, 'Philadelphia (1) is drawn north of Yorktown (2)');
ok(pin1.left > pin2.left, 'and east of it');

eq(printed.keyItems.length, 2, 'the key names both pinned places');
ok(printed.keyItems.some(k => /Philadelphia/.test(k)), 'including Philadelphia: ' + JSON.stringify(printed.keyItems));

// The numbers on the timeline strip are what tie "when" back to "where".
eq(printed.stripBadges.sort().join('|'), '1|2', 'the timeline strip carries the same two numbers');
eq(printed.stripMarkers, 3, 'and still shows all three events, including the unplaced one');
ok(/map-printing/.test(printed.bodyClass), 'the page is in map-print mode');

eq(page.__blocked.length - blockedBefore, 0,
  'nothing offsite was requested to draw the map: ' + JSON.stringify(page.__blocked.slice(-3)));

// afterprint teardown can't be observed in headless Chromium (print() is a
// no-op that never fires it), so drive the listener directly and check it
// leaves the page ready for a plain Print afterwards.
const afterTeardown = await page.evaluate(() => {
  window.dispatchEvent(new Event('afterprint'));
  return {
    bodyClass: document.body.className,
    mapPages: document.getElementById('mapPrintPages').innerHTML.length,
    pageStyle: !!document.getElementById('tiledPageSizeStyle'),
  };
});
ok(!/map-printing/.test(afterTeardown.bodyClass), 'afterprint clears map-print mode');
eq(afterTeardown.mapPages, 0, 'and empties the built page');
eq(afterTeardown.pageStyle, false, 'and removes the landscape @page rule');

/* ── 3. the built-in example loads with its places prefilled ───────────── */

page.once('dialog', d => d.accept()); // the "you have work open" confirm
await page.click('#loadExampleBtn');
await settle(page, 500);
const example = await currentTimeline();
ok(example.events.length >= 8 && example.events.length <= 12,
  'the example is 8-12 events: ' + example.events.length);
const examplePlaced = example.events.filter(e => e.place && typeof e.place.lat === 'number');
ok(examplePlaced.length >= 8, 'most of them carry a place: ' + examplePlaced.length);
ok(example.events.some(e => e.yearEnd != null), 'and at least one is a range event');
ok(example.eras.length > 0, 'the example includes an era band');

/* ── 3b. the whole-world extent is a different code path, so drive it ─── */

// Auto-fit picks a regional US map for this data; "Whole world" has to fall
// back to the world bounds AND the world dataset, and still land its pins.
// (Printing closes the panel behind itself, so reopen it first.)
await page.click('#mapPrintToggleBtn');
await settle(page, 150);
await page.selectOption('#mapExtent', 'world');
await page.evaluate(() => { window.__printCalls = 0; });
await page.click('#btnMapPrintGo');
await page.waitForFunction(() => window.__printCalls > 0, null, { timeout: 60000 });
await settle(page, 300);
const world = await page.evaluate(() => {
  const box = document.querySelector('#mapPrintPages .mapBox');
  return {
    w: parseFloat(box.style.width), h: parseFloat(box.style.height),
    dots: Array.from(document.querySelectorAll('#mapPrintPages .mapDot')).map(d => ({
      left: parseFloat(d.style.left), top: parseFloat(d.style.top),
    })),
  };
});
// Fewer dots than on the fitted map, and that is correct rather than a bug:
// clustering measures pixels, so at world scale places a few hundred miles
// apart really are the same point and share one pin. What must not happen is
// them vanishing, or all collapsing into one.
ok(world.dots.length >= 3 && world.dots.length <= examplePlaced.length,
  'the world map merges nearby places without losing them: ' + world.dots.length +
  ' pins for ' + examplePlaced.length + ' placed events');
ok(world.dots.every(d => d.left > 0 && d.left < world.w && d.top > 0 && d.top < world.h),
  'and all of them land on the map');
// North America sits in the left half of a whole-world plate carrée, and
// north of the equator — a sanity check that the world bounds aren't inverted.
ok(world.dots.every(d => d.left < world.w / 2), 'the US pins are in the western half of the world map');
ok(world.dots.every(d => d.top < world.h / 2), 'and in the northern half');
await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));

/* ── 4. a share link round-trips the timeline, minus photos ────────────── */

// Give an event a photo so the exclusion is actually exercised rather than
// vacuously true.
await page.evaluate(() => {
  const name = localStorage.getItem('gvb-timeline:current');
  const key = 'gvb-timeline:data:' + name;
  const st = JSON.parse(localStorage.getItem(key));
  st.events[0].photo = 'data:image/png;base64,' + 'A'.repeat(4000);
  localStorage.setItem(key, JSON.stringify(st));
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);

const link = await page.evaluate(() => {
  // Read the link through the same path the button uses, without depending on
  // clipboard permissions in a headless context.
  const btn = document.getElementById('shareLinkBtn');
  let captured = null;
  const realClipboard = navigator.clipboard;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: t => { captured = t; return Promise.resolve(); } },
  });
  btn.click();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: realClipboard });
  return captured;
});
ok(!!link && link.includes('timeline='), 'Copy link produces a ?timeline= URL');
ok(link.length < 12000, 'and the photo is not in it (link is ' + link.length + ' chars)');

const noteAfterCopy = await page.textContent('#shareNote');
ok(/photo/i.test(noteAfterCopy), 'with a visible note that photos stay on this device: ' + noteAfterCopy);

const namesBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('gvb-timeline:list') || '[]'));
await page.goto(link, { waitUntil: 'networkidle' });
await settle(page, 500);
const namesAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('gvb-timeline:list') || '[]'));
eq(namesAfter.length, namesBefore.length + 1, 'opening the link adds a new timeline rather than replacing one');
ok(namesBefore.every(n => namesAfter.includes(n)), 'every timeline that was already saved is still there');

const arrived = await currentTimeline();
eq(arrived.events.length, example.events.length, 'every event made the trip');
eq(arrived.events.filter(e => e.photo).length, 0, 'and none of them arrived with a photo');
eq(arrived.events.filter(e => e.place && typeof e.place.lat === 'number').length, examplePlaced.length,
  'while every place made the trip');
ok(/photo/i.test(await page.textContent('#shareNote')), 'the arrival note explains where the photos went');
ok(!(await page.url()).includes('timeline='), 'the link param is consumed so a refresh cannot re-import it');

/* ── 5. the two print paths that already existed still work ────────────── */

// The map print shares the injected landscape @page rule and the
// "hide everything except my container" print CSS with the tiled wall print,
// and sits alongside the plain single-page Print. A new third print mode that
// leaves either of the other two broken is the obvious way this change could
// go wrong, so both get driven here after a map print has already run.
await page.evaluate(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });

await page.click('#printBtn');
await settle(page, 200);
const plain = await page.evaluate(() => ({
  calls: window.__printCalls,
  printAreaLen: document.getElementById('printArea').innerHTML.length,
  bodyClass: document.body.className,
}));
eq(plain.calls, 1, 'the plain Print button still prints');
ok(plain.printAreaLen > 200, 'and still fills #printArea');
ok(!/map-printing|tiled-printing/.test(plain.bodyClass),
  'without leaving the page in a special print mode: ' + JSON.stringify(plain.bodyClass));

await page.click('#tiledPrintToggleBtn');
await settle(page, 150);
await page.click('#btnTiledPrintGo');
await page.waitForFunction(() => window.__printCalls > 1, null, { timeout: 30000 });
await settle(page, 300);
const tiled = await page.evaluate(() => ({
  pages: document.querySelectorAll('#tiledPrintPages .tiledPage').length,
  bodyClass: document.body.className,
}));
ok(tiled.pages >= 3, 'the tiled wall print still builds its pages: ' + tiled.pages);
ok(/tiled-printing/.test(tiled.bodyClass), 'and enters tiled-print mode');
await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));

/* ── 6. no console noise anywhere in all of that ───────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
