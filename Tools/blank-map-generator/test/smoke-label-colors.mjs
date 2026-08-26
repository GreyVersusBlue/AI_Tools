// smoke-label-colors.mjs — the Label Sets panel opening, and giving each new
// label its own colour so it earns its own row in the key.
//
//   node Tools/blank-map-generator/test/smoke-label-colors.mjs
//
// Two things, both about the same corner of the tool:
//
//   1. The Label Sets panel opens whenever it is asked to. It used to be
//      guarded on the map being calibrated, and an uncalibrated map got the
//      *calibrate* panel instead with nothing said about why — so a teacher
//      who uploaded their own map and pressed "Label Sets…" watched nothing
//      happen. The panel opens either way now; the buttons that genuinely
//      need coordinates are disabled, with a message saying what to do.
//      (The batch-coordinate panel had the identical guard and is checked
//      the same way.)
//   2. "Colour each new label" (on by default) walks the label palette one
//      placement at a time, and bmg-legend.js gives each colour in use its
//      own captioned row — so colour-coding a map builds its own key. With
//      the toggle off, labels place in the default ink and add no rows,
//      which is also what every project saved before this existed looks
//      like.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8251;
const BASE = `http://127.0.0.1:${PORT}`;
const MAP_PAGE = BASE + '/Tools/046-blank-map-generator.html';

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

console.log('Blank Map Generator — label colours and the Label Sets panel');

await page.goto(MAP_PAGE, { waitUntil: 'networkidle' });
await settle(page, 600);
// 046 searches Wikimedia Commons for map images on load — pre-existing and
// baselined the same way by the tool's other suites. Nothing below adds to it.
const offsiteBefore = page.__blocked.length;

/* A built-in vector base map arrives calibrated and needs no network, which
   is the only way to get a real image on screen in an offline test. */
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

const shown = id => page.evaluate(i => !document.getElementById(i).hidden, id);
const disabled = id => page.evaluate(i => !!document.getElementById(i).disabled, id);

/* ── 1. the panel opens on an UNCALIBRATED map ───────────────────────────── */
// Clearing the calibration is how an uploaded or Commons map starts life:
// a real image on screen with no idea where on earth it is.
await page.click('#btnCalibrate');
await settle(page, 200);
await page.click('#btnClearCalibration');
await settle(page, 300);
eq(await page.evaluate(() => {
  const raw = Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]).find(([k]) => /bmg_workspace/.test(k));
  const w = JSON.parse(raw[1]);
  return w.projects.find(x => x.id === w.activeId).data.calibration;
}, null), null, 'the map is now uncalibrated, like an upload');

await page.click('#btnLabelSets');
await settle(page, 250);
eq(await shown('labelSetPanel'), true, 'pressing "Label Sets…" on an uncalibrated map opens the Label Sets panel');
eq(await shown('calibratePanel'), false, 'and does not silently swap it for the calibrate panel');
eq(await disabled('btnPlaceLabelSet'), true, '"Place these labels" is disabled, since there are no coordinates to place against');
const offMsg = await page.textContent('#labelSetStatus');
ok(/coordinates aren't set/i.test(offMsg), 'and the panel says why: ' + JSON.stringify(offMsg));
ok(await page.evaluate(() => document.getElementById('labelSetSelect').options.length > 0),
   'the built-in sets are still listed, so a teacher can browse/edit/export them uncalibrated');

/* The batch-coordinate panel carried the identical guard. */
await page.click('#btnBatchPlace');
await settle(page, 250);
eq(await shown('batchPanel'), true, '"Batch Place Markers…" opens its panel on an uncalibrated map too');
eq(await disabled('btnBatchPlaceGo'), true, 'with "Place All" disabled until the coordinates are set');
await page.click('#btnBatchPlaceClose');

/* ── 2. setting the coordinates switches the panel on, live ──────────────── */
await page.click('#btnCalibrate');
await settle(page, 200);
await page.evaluate(() => {
  document.getElementById('calNorth').value = '50';
  document.getElementById('calSouth').value = '24';
  document.getElementById('calWest').value = '-125';
  document.getElementById('calEast').value = '-66';
});
await page.click('#btnApplyCalibration');
await settle(page, 300);
eq(await disabled('btnPlaceLabelSet'), false, 'applying coordinates enables "Place these labels" without reopening the panel');
eq(await page.textContent('#labelSetStatus'), '', 'and clears the explanation');
await page.click('#btnLabelSetClose');
await settle(page, 200);
eq(await shown('labelSetPanel'), false, 'Close closes it');
await page.click('#btnLabelSets');
await settle(page, 200);
eq(await shown('labelSetPanel'), true, 'and the button reopens it — the toggle still toggles');
await page.click('#btnLabelSetClose');

/* ── 3. each new label takes the next colour ─────────────────────────────── */
eq(await page.isChecked('#labelAutoColorCheck'), true, '"Color each new label" is on by default');

/** Places one label by the ordinary click-then-type route the toolbar drives.
    "+ Add Label" is a mode toggle that stays on after a placement, so only
    press it when the mode isn't already armed — pressing it again would turn
    label placement off and the map click would do nothing. */
async function placeLabel(text, x, y) {
  const armed = await page.evaluate(() => document.getElementById('btnAddLabel').classList.contains('active'));
  if (!armed) await page.click('#btnAddLabel');
  await page.mouse.click(x, y);
  await settle(page, 200);
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  await settle(page, 250);
}

const box = await page.evaluate(() => {
  const r = document.getElementById('viewport').getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
await placeLabel('Rockies', box.x + box.w * 0.32, box.y + box.h * 0.38);
await placeLabel('Mississippi', box.x + box.w * 0.55, box.y + box.h * 0.55);
await placeLabel('Appalachians', box.x + box.w * 0.72, box.y + box.h * 0.42);

const labels = () => page.evaluate(() => {
  const raw = Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]).find(([k]) => /bmg_workspace/.test(k));
  const w = JSON.parse(raw[1]);
  return w.projects.find(x => x.id === w.activeId).data.labels.map(l => ({ text: l.text, color: l.color }));
});

const three = await labels();
eq(three.length, 3, 'three labels placed');
ok(three.every(l => !!l.color), 'every one of them took a colour: ' + JSON.stringify(three.map(l => l.color)));
eq(new Set(three.map(l => l.color)).size, 3, 'and no two share one, so no two mean the same thing in the key');

/* ── 4. the key grows a row per label colour ─────────────────────────────── */
const labelRows = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('#legendPanel .legend-row'))
    .map(r => r.dataset.legendKey).filter(k => /^label:/.test(k)));

eq(await shown('legendPanel'), true, 'the key is showing');
eq((await labelRows()).length, 3, 'with one row per label colour');
const placeholders = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#legendPanel .legend-row'))
    .filter(r => /^label:/.test(r.dataset.legendKey))
    .map(r => r.querySelector('input').placeholder));
ok(placeholders.some(p => /Rockies|Mississippi|Appalachians/.test(p)),
   'and each uncaptioned row suggests what is in it: ' + JSON.stringify(placeholders));

// A caption typed into a label row survives a reload, like every other row's.
await page.evaluate(() => {
  const row = Array.from(document.querySelectorAll('#legendPanel .legend-row'))
    .find(r => /^label:/.test(r.dataset.legendKey));
  const input = row.querySelector('input');
  input.value = 'Landforms';
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
await settle(page, 300);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 1200);
const kept = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#legendPanel .legend-row'))
    .filter(r => /^label:/.test(r.dataset.legendKey))
    .map(r => r.querySelector('input').value));
ok(kept.includes('Landforms'), 'a caption typed on a label row comes back after a reload: ' + JSON.stringify(kept));
eq((await labelRows()).length, 3, 'and the rows themselves come back too');

/* ── 5. the toggle actually turns it off ─────────────────────────────────── */
await page.uncheck('#labelAutoColorCheck');
await settle(page, 200);
const box2 = await page.evaluate(() => {
  const r = document.getElementById('viewport').getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
await placeLabel('Great Lakes', box2.x + box2.w * 0.6, box2.y + box2.h * 0.28);

const four = await labels();
eq(four.length, 4, 'a fourth label placed with the toggle off');
const last = four.find(l => l.text === 'Great Lakes');
eq(last ? last.color : 'missing', null, 'which took no colour — the default ink, as before this existed');
eq((await labelRows()).length, 3, 'so the key gained no fourth row');

/* ── 6. no console noise, nothing offsite ────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length - offsiteBefore, 0,
   'nothing here went offsite: ' + JSON.stringify(page.__blocked.slice(offsiteBefore)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
