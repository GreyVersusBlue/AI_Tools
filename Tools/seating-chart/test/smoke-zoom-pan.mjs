// smoke-zoom-pan.mjs — zooming and panning the classroom floor.
//
//   node Tools/seating-chart/test/smoke-zoom-pan.mjs
//
// The floor was fit-to-window or 100%, nothing between, and the only way to
// reach a corner of a 1280x900 room on a laptop was the browser's own
// scrollbars. This suite covers the two gestures that replaced that:
//
//   1. Scroll over the floor zooms, anchored on the pointer — the point under
//      the cursor stays under the cursor, which is the whole difference
//      between zooming and the room jumping somewhere else. The level is
//      clamped and saved, so a chart comes back at the zoom it was left at.
//   2. Dragging any empty part of the floor pans. It must not do that when the
//      drag started on a desk: picking a desk up and moving it is the tool's
//      oldest gesture and outranks panning everywhere they overlap.
//
// Also that "Actual size" still works, since it now shares one scale with the
// wheel instead of owning it.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8152;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/005-Seating%20Chart%20Generator.html';

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
const page = await prepPage(browser, BASE, { width: 1280, height: 900 });

console.log('Seating Chart Generator — zoom and pan the floor');

await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 500);
await page.click('button[onclick="makeGrid()"]');
await settle(page, 300);

const fscale = () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fscale')));
/* The autosave coalesces bursts on a 1s timer that every change restarts, and
   a wheel gesture is nothing but a burst of changes — so anything that reads
   localStorage has to wait past it, not just past the render. */
const flushed = async () => { await settle(page, 1300); };
const savedZoom = async () => {
  await flushed();
  return page.evaluate(() => {
    const raw = localStorage.getItem('seating-chart-v1');
    return raw ? JSON.parse(raw).zoom : undefined;
  });
};
const scrollPos = () => page.evaluate(() => {
  const s = document.getElementById('stage');
  return { left: Math.round(s.scrollLeft), top: Math.round(s.scrollTop) };
});
/** Where a given room coordinate currently sits on screen. */
const screenOf = (rx, ry) => page.evaluate(([x, y]) => {
  const r = document.getElementById('floor').getBoundingClientRect();
  const k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fscale'));
  return { x: r.left + x * k, y: r.top + y * k };
}, [rx, ry]);

const stageBox = await page.evaluate(() => {
  const r = document.getElementById('stage').getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
const midX = Math.round(stageBox.x + stageBox.w / 2);
const midY = Math.round(stageBox.y + stageBox.h / 2);

/* ── 1. it starts fitted, as before ──────────────────────────────────────── */
const fitted = await fscale();
ok(fitted > 0 && fitted <= 1, `the floor opens fitted to the window (${fitted})`);
eq(await savedZoom(), 'fit', 'and "fit" is what is saved');

/* ── 2. scrolling over the floor zooms ───────────────────────────────────── */
// Pick a room point under the pointer and check it stays there — the property
// that separates a real zoom from a scale change that throws the view away.
const anchorRoom = await page.evaluate(([cx, cy]) => {
  const r = document.getElementById('floor').getBoundingClientRect();
  const k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fscale'));
  return { x: (cx - r.left) / k, y: (cy - r.top) / k };
}, [midX, midY]);

await page.mouse.move(midX, midY);
await page.mouse.wheel(0, -400);
await settle(page, 250);

const zoomedIn = await fscale();
ok(zoomedIn > fitted + 0.05, `scrolling up zooms in (${fitted} -> ${zoomedIn})`);
ok(typeof (await savedZoom()) === 'number', 'and the level is saved as a number, not a mode');

const anchorNow = await screenOf(anchorRoom.x, anchorRoom.y);
near(anchorNow.x, midX, 2, 'the room point under the cursor stayed under the cursor (x)');
near(anchorNow.y, midY, 2, 'the room point under the cursor stayed under the cursor (y)');

await page.mouse.wheel(0, 400);
await settle(page, 250);
near(await fscale(), fitted, 0.02, 'and scrolling back down returns to where it started');

/* ── 3. the level is clamped at both ends ────────────────────────────────── */
for (let i = 0; i < 12; i++) await page.mouse.wheel(0, -400);
await settle(page, 300);
const maxed = await fscale();
ok(maxed <= 3.0001, `zooming in stops at 300% (${maxed})`);
ok(maxed > 2, 'but does get there');

for (let i = 0; i < 30; i++) await page.mouse.wheel(0, 400);
await settle(page, 300);
const minned = await fscale();
ok(minned >= 0.2499, `zooming out stops at 25% (${minned})`);

/* ── 4. the page itself never scrolls out from under the gesture ─────────── */
eq(await page.evaluate(() => Math.round(window.scrollY)), 0,
   'the window did not scroll while the wheel was zooming the floor');

/* ── 5. dragging empty floor pans ────────────────────────────────────────── */
// Zoom in far enough that there is somewhere to pan to.
for (let i = 0; i < 10; i++) await page.mouse.wheel(0, -400);
await settle(page, 300);
const before = await scrollPos();

// A patch of floor with no desk on it: the room is 1280x900 and makeGrid()
// leaves the bottom empty, so aim low.
const emptySpot = await page.evaluate(() => {
  const r = document.getElementById('floor').getBoundingClientRect();
  const k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fscale'));
  const stage = document.getElementById('stage').getBoundingClientRect();
  // walk candidate points inside the visible stage until one is not a desk
  for (let x = stage.left + 30; x < stage.right - 30; x += 25) {
    for (let y = stage.top + 30; y < stage.bottom - 30; y += 25) {
      const el = document.elementFromPoint(x, y);
      if (el && !el.closest('.desk') && (el.closest('#stage') || el.id === 'stage')) {
        return { x: Math.round(x), y: Math.round(y), room: { x: (x - r.left) / k, y: (y - r.top) / k } };
      }
    }
  }
  return null;
});
ok(!!emptySpot, 'found a patch of empty floor to drag');

await page.mouse.move(emptySpot.x, emptySpot.y);
await page.mouse.down();
await page.mouse.move(emptySpot.x - 120, emptySpot.y - 90, { steps: 8 });
await page.mouse.up();
await settle(page, 250);

const after = await scrollPos();
near(after.left - before.left, 120, 6, 'dragging the floor left scrolled the view right by the same amount');
near(after.top - before.top, 90, 6, 'and dragging it up scrolled the view down by the same amount');

const deskCount = await page.evaluate(() => document.querySelectorAll('.desk').length);
ok(deskCount > 0, `the desks are all still there (${deskCount})`);

/* ── 6. dragging a DESK still moves the desk, not the view ───────────────── */
await page.evaluate(() => { window.__zoomTest = { done: false }; });
await flushed();
// Zoomed in and panned, most desks are off-screen — pick one whose middle is
// actually under the stage, or the "drag" lands on nothing.
const target = await page.evaluate(() => {
  const stage = document.getElementById('stage').getBoundingClientRect();
  for (const node of document.querySelectorAll('.desk')) {
    const r = node.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx > stage.left + 40 && cx < stage.right - 90 && cy > stage.top + 40 && cy < stage.bottom - 70) {
      return { id: node.dataset.id, x: Math.round(cx), y: Math.round(cy) };
    }
  }
  return null;
});
ok(!!target, 'found a desk on screen to drag');
const deskBefore = await page.evaluate(id => {
  const raw = JSON.parse(localStorage.getItem('seating-chart-v1'));
  const s = raw.sections.find(x => x.id === raw.active);
  const d = s.desks.find(x => x.id === id);
  return { id, x: d.x, y: d.y };
}, target.id);
const deskPoint = { x: target.x, y: target.y };

const scrollBeforeDeskDrag = await scrollPos();
await page.mouse.move(deskPoint.x, deskPoint.y);
await page.mouse.down();
await page.mouse.move(deskPoint.x + 60, deskPoint.y + 40, { steps: 8 });
await page.mouse.up();
await flushed();

const scrollAfterDeskDrag = await scrollPos();
eq(scrollAfterDeskDrag.left, scrollBeforeDeskDrag.left, 'dragging a desk did not pan the view sideways');
eq(scrollAfterDeskDrag.top, scrollBeforeDeskDrag.top, 'nor up and down');
const deskAfter = await page.evaluate(id => {
  const raw = JSON.parse(localStorage.getItem('seating-chart-v1'));
  const s = raw.sections.find(x => x.id === raw.active);
  const d = s.desks.find(x => x.id === id);
  return { x: d.x, y: d.y };
}, deskBefore.id);
ok(deskAfter.x !== deskBefore.x || deskAfter.y !== deskBefore.y,
   `the desk itself moved (${deskBefore.x},${deskBefore.y} -> ${deskAfter.x},${deskAfter.y})`);

/* ── 7. the zoom level survives a reload ─────────────────────────────────── */
const keptScale = await fscale();
await flushed();
await page.reload({ waitUntil: 'load' });
await settle(page, 600);
near(await fscale(), keptScale, 0.01, 'the chart comes back at the zoom it was left at');

/* ── 8. the named modes still work ───────────────────────────────────────── */
await page.click('#zoomBtn');
await settle(page, 250);
eq(await savedZoom(), 'full', '"Actual size" still switches to 100%');
eq(await fscale(), 1, 'and the floor is drawn 1:1');
await page.click('#zoomBtn');
await settle(page, 250);
eq(await savedZoom(), 'fit', 'and the button switches back to fit-to-window');
near(await fscale(), fitted, 0.02, 'at the same scale it opened with');

/* ── 9. no console noise ─────────────────────────────────────────────────── */
const errs = page.__errs.filter(e => !/favicon/.test(e));
eq(errs.length, 0, 'no page/console errors: ' + JSON.stringify(errs));
eq(page.__blocked.length, 0, 'nothing went offsite: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
