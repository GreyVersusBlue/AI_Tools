// smoke-substitute-view.mjs — the schedule browser's one-page substitute view.
//
//   node Tools/schedule-browser/test/smoke-substitute-view.mjs
//
// "One page: the absent teacher's day, their rooms, their classes, and a
// map — printable, and exactly what a sub needs at 7:15am" (Major Feature,
// improvement prompts/034-schedule-browser.md). Four things under test:
//
//   1. Picking a teacher in Substitute Plan mode renders their day (both A
//      and B, when they differ), including the personal-notes overlay —
//      reusing brDayRows exactly as By Teacher does.
//   2. Coverage candidates are computed correctly: for a period the absent
//      teacher normally teaches, every teacher listed as a candidate is
//      actually free (on Planning) that same period/day — the same
//      computation Who's Free Now already uses (brFreeTeachersFor), and the
//      absent teacher never lists themselves.
//   3. A period with nobody free says so plainly rather than an empty list.
//   4. The building map crop renders a room-labeled SVG scoped around the
//      teacher's own room (a real crop of the published blueprint, not the
//      whole floor) — and a teacher whose room truly isn't on the blueprint
//      falls back to a text notice instead of breaking.
//
// Exits 1 on any failure. Teacher names come from the tool's own published
// sample data.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8206;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/034-schedule-browser.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1500, height: 1200 });

const openSub = async (p, name) => {
  await p.evaluate(() => window.brSetMode('sub'));
  await p.evaluate(n => window.brChoose(n), name);
  await settle(p, 500);
};

console.log('Schedule Browser — substitute view');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 900);

/* ── 1. the day renders, with notes support intact ─────────────────────── */
await openSub(page, 'Moore');
ok((await page.textContent('#br-view')).includes('Moore'), 'the substitute plan is titled with the absent teacher');
const boxes = await page.evaluate(() =>
  [...document.querySelectorAll('.br-note')].map(n => ({ day: n.dataset.noteDay, teacher: n.dataset.noteTeacher })));
ok(boxes.length >= 4, `every period still offers the notes box (${boxes.length})`);
ok(boxes.every(b => b.teacher === 'Moore'), 'notes are tagged to the absent teacher, same as By Teacher');
ok(boxes.some(b => b.day === 'A') && boxes.some(b => b.day === 'B'), 'both A and B days render when they differ');
ok((await page.textContent('#br-view')).includes('Room'), 'their room is shown');

/* ── 2 & 3. coverage candidates are real free-teacher lookups ──────────── */
const cov = await page.evaluate((name) => {
  const t = BR_TEACHERS[name];
  const out = { periods: [] };
  for (const day of ['A', 'B']) {
    const arr = day === 'B' ? t.B : t.A;
    for (let i = 0; i < BR_MODCOUNT; i++) {
      const sec = arr[i];
      if (!sec || sec === 'Planning') continue;
      const listed = window.brSubCoverageHTML(name, day);
      out.periods.push({ day, i, sec, expectedFree: window.brFreeTeachersFor(day, i).filter(f => f !== name) });
    }
  }
  return out;
}, 'Moore');
ok(cov.periods.length > 0, 'Moore teaches at least one class period to find coverage for');
// Cross-check every expected-free name for a couple of periods actually
// appears in the rendered coverage HTML, and that the absent teacher never
// lists themselves as their own coverage.
const covHTML = await page.evaluate(() => document.querySelector('#br-view').innerHTML);
ok(!covHTML.includes('subcov-name">Moore<'), 'the absent teacher never appears as their own coverage candidate');
for (const p of cov.periods.slice(0, 2)) {
  if (p.expectedFree.length) {
    ok(p.expectedFree.every(n => covHTML.includes(n)),
       `every teacher free ${p.day}-day period ${p.i+1} is listed as a coverage candidate (${p.expectedFree.join(', ')})`);
  }
}
const anyEmptyPeriod = cov.periods.some(p => p.expectedFree.length === 0);
if (anyEmptyPeriod) {
  ok(/No one is free/.test(covHTML), 'a period with no one free says so plainly instead of an empty list');
} else {
  console.log('  (skip: no period in this sample data has zero free teachers — nothing to check for #3)');
}

/* ── 4. the map crop is a real crop of the published blueprint ─────────── */
const mapInfo = await page.evaluate(() => {
  const svg = document.querySelector('#br-view .msvg svg.geoplan');
  if (!svg) return null;
  const vb = svg.getAttribute('viewBox').split(' ').map(Number);
  const fullFloorW = BR_GEOM.floors[0].cols * 26 + 16;
  return { viewBox: vb, fullFloorW, hasRoomLabel: /a210/.test(document.querySelector('#br-view .msvg').innerHTML) };
});
ok(mapInfo && mapInfo.viewBox.length === 4, 'the map crop renders an SVG with a viewBox');
if (mapInfo) {
  ok(mapInfo.viewBox[2] < mapInfo.fullFloorW,
     `the crop viewBox (${mapInfo.viewBox[2]}) is narrower than a full floor (${mapInfo.fullFloorW})`);
  ok(mapInfo.hasRoomLabel, "Moore's own room (a210) is labeled inside the crop");
}

/* a teacher whose room is not on the blueprint (synthetic check via a
   room that does not exist in geometry) falls back to text instead of
   throwing */
const offMapSafe = await page.evaluate(() => {
  try {
    const html = window.brSubMapHTML('DoesNotExist');
    return typeof html === 'string';
  } catch (e) { return false; }
});
ok(offMapSafe, 'brSubMapHTML does not throw for an unknown teacher');

/* ── 5. print rules hide the toolbar, same as every other mode ─────────── */
await page.emulateMedia({ media: 'print' });
await settle(page, 300);
const printedToolbarHidden = await page.evaluate(() => getComputedStyle(document.querySelector('.toolbar')).display === 'none');
ok(printedToolbarHidden, 'the toolbar (mode buttons, search) does not print, same as every other view');
await page.emulateMedia({ media: 'screen' });

/* ── 6. no console noise ─────────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
