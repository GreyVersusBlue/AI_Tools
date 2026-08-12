// smoke-equipment-mode.mjs — grouping by the equipment actually in the room.
//
//   node Tools/lab-group-role-randomizer/test/smoke-equipment-mode.mjs
//
// "Groups of four" is a preference. "Seven microscopes" is a fact, and it is
// the one that decides how many groups can run at once. The tool had modes for
// a group count and a group size; it now has a third where the teacher lists
// what is on the bench and the *scarcest* item sets the number of groups —
// which neither of the other modes can express, because it depends on more
// than one number. What this suite holds down:
//
//   The scarcest item wins. Seven microscopes and five hot plates is a
//   five-group lab, and the readout names the item that bound it, so the
//   teacher can see why they got five and not seven.
//
//   The count reaches the actual shuffle, not just the readout.
//
//   Spare equipment and a shortage of students are both reported rather than
//   silently absorbed.
//
//   Building stations from the equipment list asks before replacing stations
//   that are already there.
//
//   The other two modes are untouched, and a roster saved before this mode
//   existed still opens.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8122;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/022-lab-group-role-randomizer.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1050 });

const CLASS = Array.from({ length: 28 }, (_, i) => `Student ${String(i + 1).padStart(2, '0')}`);

const readout = () => page.textContent('#equipReadout');

/* The mode radios are display:none — the toggle-group styles their labels
   instead — so the labels are what a teacher (and this suite) clicks. */
const pickMode = (p, mode) => p.click(`label[for="mode-${mode}"]`);
/* One <li> per student inside each group card. (Counting `.member` too would
   double-count: that class also lands on the "Team Member" role label.) */
const groupSizes = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('#resultsArea .group-card')).map(
    g => g.querySelectorAll('ul > li').length));

/** Add one equipment row and fill it in. */
async function addEquipment(item, count) {
  await page.click('#addEquipBtn');
  await settle(page);
  const idx = await page.evaluate(() => document.querySelectorAll('#equipList .equip-row').length - 1);
  await page.fill(`#equipList .equip-row:nth-child(${idx + 1}) .equip-item`, item);
  await page.fill(`#equipList .equip-row:nth-child(${idx + 1}) .equip-count`, String(count));
  await settle(page);
}

console.log('Lab Group & Role Randomizer — group size from equipment count');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await page.fill('#namesInput', CLASS.join('\n'));
await settle(page, 300);

/* ── 1. the mode swaps the number box for an equipment list ──────────────── */
ok(await page.isVisible('#splitNumberWrap'), 'the number box is shown in the default mode');
ok(!(await page.isVisible('#equipWrap')), 'and the equipment list is not');
await pickMode(page, 'equip');
await settle(page);
ok(!(await page.isVisible('#splitNumberWrap')), 'switching to equipment hides the number box');
ok(await page.isVisible('#equipWrap'), 'and shows the equipment list');
ok(/Add an item and how many you have/.test(await readout()),
   'with nothing listed, the readout says what to do: ' + JSON.stringify(await readout()));

/* ── 2. one item sets the group count ────────────────────────────────────── */
await addEquipment('microscope', 7);
const oneItem = await readout();
ok(/7 microscope is the limit/.test(oneItem), 'seven microscopes reads as the limit: ' + JSON.stringify(oneItem));
ok(/7 groups of 4 from 28 students/.test(oneItem), 'and the group size falls out of the roster');

/* ── 3. the scarcest item wins, and is named ─────────────────────────────── */
await addEquipment('hot plate', 5);
const twoItems = await readout();
ok(/5 hot plate is the limit/.test(twoItems), 'the scarcer item takes over: ' + JSON.stringify(twoItems));
ok(/5 groups of 5–6 from 28 students/.test(twoItems), 'with the uneven split shown as a range');
ok(/Spare: 2 microscope/.test(twoItems), 'and the now-spare microscopes are counted');

/* ── 4. the count reaches the real shuffle ───────────────────────────────── */
await page.click('#shuffleBtn');
await settle(page, 400);
const sizes = await groupSizes();
eq(sizes.length, 5, 'the shuffle really produced five groups');
eq(sizes.reduce((a, b) => a + b, 0), 28, 'with every student placed');
ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `and the groups are even: ${JSON.stringify(sizes)}`);

/* ── 5. more equipment than students is called out ───────────────────────── */
await page.fill('#namesInput', CLASS.slice(0, 3).join('\n'));
await settle(page, 300);
const tiny = await readout();
ok(/more hot plate than students/.test(tiny), 'a tiny class against plenty of gear is flagged: ' + JSON.stringify(tiny));
await page.click('#shuffleBtn');
await settle(page, 400);
eq((await groupSizes()).length, 3, 'and the shuffle makes one group per student rather than empty benches');
await page.fill('#namesInput', CLASS.join('\n'));
await settle(page, 300);

/* ── 6. removing the scarce item hands the limit back ────────────────────── */
await page.click('#equipList .equip-row:nth-child(2) .x');
await settle(page);
ok(/7 microscope is the limit/.test(await readout()), 'deleting the hot plates puts the microscopes back in charge');

/* ── 7. stations built from the equipment, with a confirm ────────────────── */
await page.click('#addStationBtn');
await settle(page);
page.once('dialog', d => d.dismiss());
await page.click('#equipToStationsBtn');
await settle(page);
eq(await page.evaluate(() => document.querySelectorAll('#stationList .station-row').length), 1,
   'declining the confirm leaves the existing station alone');

page.once('dialog', d => d.accept());
await page.click('#equipToStationsBtn');
await settle(page);
const stations = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#stationList .station-row')).map(r => [
    r.querySelector('.station-name').value, r.querySelector('.station-equip').value]));
eq(stations.length, 7, 'accepting builds one station per group');
eq(stations[0].join(' / '), 'Station 1 / microscope', 'each carrying the equipment list');

/* ── 8. it all survives a reload ─────────────────────────────────────────── */
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
ok(await page.isChecked('#mode-equip'), 'the mode is remembered');
eq(await page.evaluate(() => document.querySelectorAll('#equipList .equip-row').length), 1, 'the equipment list comes back');
ok(/7 microscope is the limit/.test(await readout()), 'and still reads the same limit');

/* ── 9. the other modes are untouched ────────────────────────────────────── */
await pickMode(page, 'count');
await settle(page);
ok(await page.isVisible('#splitNumberWrap'), 'the number box is back');
await page.fill('#splitValue', '4');
await page.click('#shuffleBtn');
await settle(page, 400);
eq((await groupSizes()).length, 4, 'a plain group count still means that many groups');
await pickMode(page, 'size');
await settle(page);
await page.fill('#splitValue', '7');
await page.click('#shuffleBtn');
await settle(page, 400);
eq((await groupSizes()).length, 4, 'and students-per-group still divides the class by that size');

/* ── 10. a roster saved before equipment mode existed ───────────────────── */
const old = await prepPage(browser, BASE, { width: 1400, height: 1050 });
await old.goto(URL_PAGE, { waitUntil: 'networkidle' });
await old.evaluate(names => {
  localStorage.clear();
  localStorage.setItem('lgrr_rosters', JSON.stringify({
    'Period 3': {
      name: 'Period 3', students: names.join('\n'),
      roles: [{ name: 'Recorder', description: '' }],
      stations: [], mode: 'count', splitValue: 4, history: {},
      lastGroups: null, checkoutLog: [], keepApart: [], absent: [],
    },
  }));
}, CLASS.slice(0, 12));
await old.reload({ waitUntil: 'networkidle' });
await settle(old, 400);
ok(await old.isChecked('#mode-count'), 'an old roster opens in the mode it was saved in');
eq(await old.evaluate(() => document.querySelectorAll('#equipList .equip-row').length), 0,
   'with an empty equipment list rather than a broken one');
await pickMode(old, 'equip');
await settle(old);
ok(/Add an item and how many you have/.test(await old.textContent('#equipReadout')),
   'and the new mode is usable from there');

/* ── 11. no console noise anywhere in the run ───────────────────────────── */
for (const [label, p] of [['main', page], ['legacy', old]]) {
  eq(p.__errs.length, 0, `no page/console errors on the ${label} page: ` + JSON.stringify(p.__errs));
  eq(p.__blocked.length, 0, `nothing left the site from the ${label} page: ` + JSON.stringify(p.__blocked));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
