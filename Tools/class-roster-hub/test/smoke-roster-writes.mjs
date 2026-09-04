// smoke-roster-writes.mjs — every path in Class Roster Hub that PUTS A ROSTER
// ON DISK, driven through the real page.
//
//   node Tools/class-roster-hub/test/smoke-roster-writes.mjs
//
// Written for Path 3 P1, when 006's twelve `saveAll(all)` call sites became
// calls into _shared/roster.js. Those sites had no suite at all: the two
// existing roster-hub suites cover export and the share-target, both of which
// only READ np_rosters. The port introduced a real bug on the way through —
// "Move to another roster" mutated two rosters and relied on one saveAll to
// persist both, so replacing that one call dropped the destination silently —
// and nothing here or in CI would have caught it. Hence this file.
//
// Every assertion reads localStorage back out after driving a real control,
// and checks the BARE wire shape, because 28 other pages parse np_rosters
// directly and a wrapper around it is invisible until one of them opens.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8407;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/006-class-roster-hub.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

/** The rosters exactly as another tool's plain JSON.parse would see them. */
const rostersOnDisk = page => page.evaluate(() => {
  const raw = localStorage.getItem('np_rosters');
  return raw === null ? null : JSON.parse(raw);
});

/** A page with a roster already open, so the toolbar controls are live. */
async function openWith(seedRosters, name) {
  const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
  await page.addInitScript(seed => {
    localStorage.setItem('np_rosters', JSON.stringify(seed));
  }, seedRosters);
  await page.goto(URL_PAGE, { waitUntil: 'domcontentloaded' });
  await settle(page, 400);
  if (name) {
    await page.selectOption('#rosterSwitch', name);
    await settle(page, 250);
  }
  return page;
}

console.log('Class Roster Hub — the roster write paths');

/* ── 1. Save writes a bare np_rosters the other 28 tools can read ──────── */
{
  const page = await openWith({});
  await page.click('#tabText');
  await page.fill('#namesInput', 'Ada Lovelace\nGrace Hopper\nNellie Bly');
  await page.fill('#rosterName', 'Period 3');
  await page.click('#saveBtn');
  await settle(page, 300);

  const disk = await rostersOnDisk(page);
  eq(disk, { 'Period 3': ['Ada Lovelace', 'Grace Hopper', 'Nellie Bly'] },
    '1: Save writes the roster as a bare {name: string[]}');

  const wrapped = await page.evaluate(() => {
    const o = JSON.parse(localStorage.getItem('np_rosters'));
    return Object.prototype.hasOwnProperty.call(o, 'v') || Object.prototype.hasOwnProperty.call(o, 'data');
  });
  ok(!wrapped, '1: ...with no {v, data} envelope around it');

  const sidecar = await page.evaluate(() => JSON.parse(localStorage.getItem('crh_students_v1')));
  ok(sidecar && sidecar.version === 1 && sidecar.rosters['Period 3'].students.length === 3,
    '1: the sidecar keeps its own shape and gains a record per student');
  ok(sidecar.rosters['Period 3'].students.every(s => s.id), '1: ...each with a minted id');

  eq(page.__errs, [], '1: the page loaded and saved with no console errors');
  eq(page.__blocked, [], '1: and made no offsite request');
  await page.close();
}

/* ── 2. Rename moves the roster in one write, never leaving two ────────── */
{
  const page = await openWith({ 'Period 3': ['Ada Lovelace'], 'Period 5': ['Nellie Bly'] }, 'Period 3');
  await page.fill('#rosterName', 'Period 3 — Earth Science');
  await page.click('#renameBtn');
  await settle(page, 300);

  const disk = await rostersOnDisk(page);
  eq(Object.keys(disk).sort(), ['Period 3 — Earth Science', 'Period 5'],
    '2: the old name is gone and the new one is there — not both, not neither');
  eq(disk['Period 3 — Earth Science'], ['Ada Lovelace'], '2: the names came with it');
  eq(disk['Period 5'], ['Nellie Bly'], '2: the untouched roster is untouched');
  await page.close();
}

/* ── 3. New and Duplicate each add exactly one roster ──────────────────── */
{
  const page = await openWith({ 'Period 3': ['Ada Lovelace', 'Grace Hopper'] }, 'Period 3');
  page.on('dialog', d => d.accept('Period 9'));
  await page.click('#newRosterBtn');
  await settle(page, 300);
  eq(Object.keys(await rostersOnDisk(page)).sort(), ['Period 3', 'Period 9'],
    '3: New Roster adds an empty roster and keeps the existing one');
  await page.close();

  const dup = await openWith({ 'Period 3': ['Ada Lovelace', 'Grace Hopper'] }, 'Period 3');
  await dup.click('#duplicateRosterBtn');
  await settle(dup, 300);
  const disk = await rostersOnDisk(dup);
  eq(Object.keys(disk).sort(), ['Period 3', 'Period 3 (copy)'], '3: Duplicate names the copy');
  eq(disk['Period 3 (copy)'], ['Ada Lovelace', 'Grace Hopper'], '3: ...with the same names');
  await dup.close();
}

/* ── 4. Move to another roster writes BOTH ends ────────────────────────── */
{
  // The regression this file was written for. Moving mutates two rosters; the
  // destination write and the source write are now two separate calls, and it
  // is entirely possible to make one of them and not the other.
  const page = await openWith(
    { 'Period 3': ['Ada Lovelace', 'Grace Hopper', 'Nellie Bly'], 'Period 5': ['Marie Curie'] },
    'Period 3');

  // tick Grace, whose row is second
  await page.evaluate(() => {
    const boxes = document.querySelectorAll('#stuList input[type="checkbox"]');
    boxes[1].click();
  });
  await settle(page, 150);
  await page.selectOption('#moveTarget', 'Period 5');
  await page.click('#moveBtn');
  await settle(page, 400);

  const disk = await rostersOnDisk(page);
  eq(disk['Period 5'], ['Marie Curie', 'Grace Hopper'], '4: the DESTINATION roster gained the student');
  eq(disk['Period 3'], ['Ada Lovelace', 'Nellie Bly'], '4: the SOURCE roster lost her');

  const sidecar = await page.evaluate(() => JSON.parse(localStorage.getItem('crh_students_v1')));
  ok(sidecar.rosters['Period 5'].students.some(s => s.name === 'Grace Hopper'),
    '4: her record travelled to the destination sidecar too');
  await page.close();
}

/* ── 5. Delete removes one roster and leaves the rest ──────────────────── */
{
  const page = await openWith({ 'Period 3': ['Ada Lovelace'], 'Period 5': ['Nellie Bly'] }, 'Period 3');
  await page.click('#deleteRosterBtn');
  await settle(page, 250);
  await page.click('#confirmOkBtn');
  await settle(page, 350);
  eq(Object.keys(await rostersOnDisk(page)), ['Period 5'], '5: only the named roster is deleted');
  await page.close();
}

/* ── 6. Year rollover empties every roster and keeps every name ────────── */
{
  const page = await openWith(
    { 'Period 3': ['Ada Lovelace', 'Grace Hopper'], 'Period 5': ['Nellie Bly'] }, 'Period 3');
  page.on('dialog', d => d.accept('2027-28'));
  await page.click('#rolloverBtn');
  await settle(page, 250);
  await page.click('#confirmOkBtn');
  await settle(page, 450);

  const disk = await rostersOnDisk(page);
  eq(Object.keys(disk).sort(), ['Period 3', 'Period 5'], '6: every roster name survives the rollover');
  eq(disk['Period 3'], [], '6: ...and every one is emptied');
  eq(disk['Period 5'], [], '6: ...all of them, not just the open one');

  const archive = await page.evaluate(() => JSON.parse(localStorage.getItem('crh_archive_v1')));
  ok(archive && archive.years.length === 1, '6: last year is filed in the archive');
  ok(archive.years[0].rosters.some(r => r.names.includes('Ada Lovelace')),
    '6: ...with the students who were on it');
  await page.close();
}

/* ── 7. A roster written by another tool is read, not clobbered ────────── */
{
  // A Name-Picker-era roster: bare, unversioned, no sidecar. Opening 006 must
  // not rewrite or drop it.
  const page = await openWith({ 'Old Roster': ['Someone Longstanding'] });
  eq(await rostersOnDisk(page), { 'Old Roster': ['Someone Longstanding'] },
    '7: merely opening the page leaves another tool\'s roster exactly as it was');

  await page.selectOption('#rosterSwitch', 'Old Roster');
  await settle(page, 300);
  const shown = await page.evaluate(() =>
    [...document.querySelectorAll('#stuList input[type="text"]')].map(i => i.value).filter(Boolean));
  ok(shown.includes('Someone Longstanding'), '7: ...and it opens');
  await page.close();
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('\nFailures:'); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
