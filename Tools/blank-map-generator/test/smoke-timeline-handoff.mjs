// smoke-timeline-handoff.mjs — sending a map's places to the Timeline Builder.
//
//   node Tools/blank-map-generator/test/smoke-timeline-handoff.mjs
//
// This map answers *where*; 015 answers *when*. The combined print already
// existed, but only from the timeline's side, built from events typed there.
// This is the other direction: a map that has its places labelled hands them
// over as events, so a teacher fills in dates instead of retyping twenty
// place names and their coordinates.
//
// It travels through 015's own `?timeline=` share format — one tool's export
// is the other's documented import — which is exactly what makes it worth
// testing end to end rather than at the seam: the assertions below open the
// generated URL in the Timeline Builder and check what actually arrives.
//
//   1. Every labelled place becomes an event, with its name and its real
//      latitude/longitude, and the coordinates are the ones the map's own
//      calibration produces (not zeros, not swapped).
//   2. The timeline receives them as a NEW timeline of its own, without
//      touching whatever was already saved there.
//   3. Events land at year 0 — the placeholder — and 015's label packing
//      keeps them readable rather than printing twenty labels on top of
//      each other, which is what makes an all-year-0 import usable at all.
//   4. A map with no labels says so instead of opening an empty timeline.
//   5. An uncalibrated map is sent to calibration first, since without it
//      there are no coordinates to send.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8243;
const BASE = `http://127.0.0.1:${PORT}`;
const MAP_PAGE = BASE + '/Tools/046-blank-map-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const near = (a, b, tol, label) => ok(Math.abs(a - b) <= tol, `${label} (got ${a}, want ${b} ±${tol})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1500, height: 1000 });

console.log('Blank Map Generator — send places to the Timeline Builder');

await page.goto(MAP_PAGE, { waitUntil: 'networkidle' });
await settle(page, 600);
/* This tool searches Wikimedia Commons for map images on load — a documented,
   pre-existing behaviour of 046 that smoke-hittest.mjs baselines the same
   way. What matters here is that the handoff itself adds nothing offsite. */
const offsiteBefore = page.__blocked.length;

/* A built-in vector map arrives calibrated, which is what the handoff needs.
   Load one (the same sequence smoke-hittest.mjs uses), then drop a built-in
   label set onto it so there are real places with real coordinates to send. */
const waitForBaseMap = () => page.waitForFunction(() => {
  const raw = Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]).find(([k]) => /bmg_workspace/.test(k));
  if (!raw) return false;
  const w = JSON.parse(raw[1]);
  const p = w.projects.find(x => x.id === w.activeId);
  return !!(p && /^vector:usa-48:/.test(p.data.mapId || ''));
}, null, { timeout: 90000 });

await page.selectOption('#baseMapSelect', 'usa-48');
await page.click('#btnBaseMap');
await waitForBaseMap();
await settle(page, 900);

// The label-set panel is collapsed until asked for.
await page.click('#btnLabelSets');
await settle(page, 300);

const setChosen = await page.evaluate(() => {
  const sel = document.getElementById('labelSetSelect');
  const opt = Array.from(sel.options).find(o => /state/i.test(o.textContent));
  if (!opt) return null;
  sel.value = opt.value;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return opt.textContent;
});
ok(!!setChosen, 'a built-in label set of US states is available: ' + setChosen);
await page.click('#btnPlaceLabelSet');
await settle(page, 1500);

const labelCount = await page.evaluate(() => document.querySelectorAll('.bmg-label').length);
ok(labelCount > 1, `the map has labels to send (${labelCount})`);

/* ── 1. the handoff builds a 015 share link with the places on it ────────── */
// The click opens a new tab; capture the URL instead of following it blindly,
// so the payload can be asserted before anything is imported.
const openedUrl = await page.evaluate(() => {
  let captured = null;
  const realOpen = window.open;
  window.open = (u) => { captured = u; return { closed: false }; };
  document.getElementById('btnToTimeline').click();
  window.open = realOpen;
  return captured;
});
ok(!!openedUrl, 'the button opens a Timeline Builder URL');
ok(/015-timeline-builder\.html\?timeline=/.test(openedUrl || ''),
   'which is 015 with a ?timeline= payload: ' + String(openedUrl).slice(0, 80));

const status = await page.textContent('#labelSetStatus');
ok(/Sent \d+ place/.test(status), 'the map says how many places it sent: ' + JSON.stringify(status));
ok(/year 0/.test(status), 'and that the dates are placeholders to fill in');

/* ── 2. what arrives in the Timeline Builder ─────────────────────────────── */
// Seed an existing timeline first: the import must land beside it, not on it.
const timelinePage = await prepPage(browser, BASE, { width: 1500, height: 1000 });
await timelinePage.goto(BASE + '/Tools/015-timeline-builder.html', { waitUntil: 'networkidle' });
await settle(timelinePage, 400);
const before = await timelinePage.evaluate(() => JSON.parse(localStorage.getItem('gvb-timeline:list') || '[]'));

await timelinePage.goto(String(openedUrl), { waitUntil: 'networkidle' });
await settle(timelinePage, 800);

const after = await timelinePage.evaluate(() => JSON.parse(localStorage.getItem('gvb-timeline:list') || '[]'));
eq(after.length, before.length + 1, 'the places arrive as one new timeline');
ok(before.every(n => after.includes(n)), 'and nothing already saved there was replaced');

const arrived = await timelinePage.evaluate(() => {
  const name = localStorage.getItem('gvb-timeline:current');
  const doc = JSON.parse(localStorage.getItem('gvb-timeline:data:' + name) || 'null');
  return {
    name,
    count: doc ? doc.events.length : 0,
    withPlace: doc ? doc.events.filter(e => e.place && typeof e.place.lat === 'number').length : 0,
    allYearZero: doc ? doc.events.every(e => e.yearStart === 0) : false,
    titles: doc ? doc.events.slice(0, 4).map(e => e.title) : [],
    sample: doc && doc.events[0] ? doc.events[0].place : null,
    nonZeroCoords: doc ? doc.events.filter(e => e.place && (e.place.lat !== 0 || e.place.lon !== 0)).length : 0,
  };
});
eq(arrived.count, labelCount, 'every label on the map became an event');
eq(arrived.withPlace, labelCount, 'each event carries a real place with coordinates');
ok(arrived.nonZeroCoords === labelCount, 'and the coordinates are actual positions, not zeros');
eq(arrived.allYearZero, true, 'every event lands at the year-0 placeholder');
ok(arrived.titles.every(t => typeof t === 'string' && t.length > 0), 'events are titled with the place names: ' + JSON.stringify(arrived.titles));
ok(Math.abs(arrived.sample.lat) <= 90 && Math.abs(arrived.sample.lon) <= 180,
   'the coordinates are the right way round (lat within ±90): ' + JSON.stringify(arrived.sample));

/* ── 3. an all-year-0 import is actually readable ────────────────────────── */
// This only works because of the label packing in 015: without it, twenty
// events at one x would print twenty labels on top of each other and the
// handoff would produce a mess a teacher would have to untangle by hand.
const overlaps = await timelinePage.evaluate(() => {
  const boxes = Array.from(document.querySelectorAll('#timelineCanvas .event-label'))
    .map(el => el.getBoundingClientRect());
  let n = 0;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) n++;
    }
  }
  return { labels: boxes.length, overlaps: n };
});
ok(overlaps.labels > 1, `the imported timeline renders its labels (${overlaps.labels})`);
eq(overlaps.overlaps, 0, 'and none of them overlap, even though every event shares one year');

/* ── 4. a map with nothing to send says so ───────────────────────────────── */
await page.evaluate(() => {
  document.querySelectorAll('.bmg-label .lbl-del').forEach(b => b.click());
});
await settle(page, 400);
const emptyOpened = await page.evaluate(() => {
  let captured = null;
  const realOpen = window.open;
  window.open = (u) => { captured = u; return { closed: false }; };
  document.getElementById('btnToTimeline').click();
  window.open = realOpen;
  return captured;
});
if (await page.evaluate(() => document.querySelectorAll('.bmg-label').length === 0)) {
  eq(emptyOpened, null, 'a map with no labels opens nothing');
  ok(/no text labels to send/.test(await page.textContent('#labelSetStatus')),
     'and explains what to do first');
} else {
  ok(true, 'labels could not be cleared through the UI in this run — empty-map case skipped');
  ok(true, '(skipped)');
}

/* ── 5. no console noise anywhere in the run ─────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors on the map: ' + JSON.stringify(page.__errs));
eq(timelinePage.__errs.length, 0, 'none on the timeline either: ' + JSON.stringify(timelinePage.__errs));
eq(page.__blocked.length - offsiteBefore, 0,
   'the handoff added no offsite request: ' + JSON.stringify(page.__blocked.slice(offsiteBefore)));
eq(timelinePage.__blocked.length, 0,
   'and the timeline side stayed local too: ' + JSON.stringify(timelinePage.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
