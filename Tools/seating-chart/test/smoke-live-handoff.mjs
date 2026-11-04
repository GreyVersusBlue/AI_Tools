// smoke-live-handoff.mjs — a point (008) and a hall pass (001) from 005's live mode
// (Path 14 P5, Devon's P5-route answer of 2026-11-03).
//
//   node Tools/seating-chart/test/smoke-live-handoff.mjs
//
// A tap still marks absent unless the teacher picks otherwise on the "Tap marks" switch
// beside the chart (P5-menu kept: no menu opens on a tap), and the switch is back on
// Absent every time live mode starts. A point is written into 008's storage, a pass into
// 001's; a second pass for a student already out is refused; Undo (the bar's button and
// Ctrl+Z) takes each back through 005's own undo stack; data of a shape 005 does not know
// is left untouched; and 008 and 001, opened afterwards, show what was written.
/* global addNames, autoAssign -- 005's inline-script functions, called inside page.evaluate() */
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8682;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/005-Seating%20Chart%20Generator.html';

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; return true; } failed++; console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
console.log('Seating Chart Generator — live mode: a point and a hall pass');

await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 500);
await page.fill('#nameInput', 'Avery Stone\nBlake Rivers\nCasey Lund');
await page.evaluate(() => addNames());
await page.click('button[onclick="makeGrid()"]');
await page.evaluate(() => autoAssign());
await settle(page, 1300);
const secName = await page.evaluate(() => { const st = JSON.parse(localStorage.getItem('seating-chart-v1')); return (st.sections.find(x => x.id === st.active) || st.sections[0]).name; });

// 008 holds this class from before points existed (names only); 001 has nothing yet.
await page.evaluate(n => localStorage.setItem('behavior-points-tracker-sections',
  JSON.stringify({ current: n, sets: { [n]: { name: n, namesText: 'Avery Stone\nBlake Rivers\nCasey Lund' } } })), secName);

const seatOf = name => page.locator('#deskLayer .desk', { hasText: name });
const read = key => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), key);
const points = () => read('behavior-points-tracker-sections');
const passes = () => read('hall-pass-log-sections');
const status = () => page.textContent('#liveStatus');
const mode = () => page.evaluate(() => document.querySelector('input[name="liveTapMode"]:checked').value);
const chartNow = async () => { await settle(page, 1300); return page.evaluate(() => localStorage.getItem('seating-chart-v1')); };
const chartBefore = await chartNow();

ok(await page.locator('#liveBar').isHidden(), 'the tap switch is hidden until live mode starts');
await page.click('#liveBtn');
await settle(page, 300);
ok(await page.locator('#floorWrap #liveBar').isVisible(), 'on stage, the tap switch is shown inside the stage');
eq(await mode(), 'absent', 'and a tap marks Absent to begin with');

// keyboard: the switch is a radio group, reached and moved without a mouse
await page.focus('input[name="liveTapMode"][value="absent"]');
await page.keyboard.press('ArrowRight');
eq(await mode(), 'point', 'an arrow key moves the switch to A point');
ok(/one point in Behavior & Points/.test(await status()), 'and the status says what a tap now does');

await seatOf('Avery').locator('.seat').click();
let bp = await points();
eq(bp.sets[secName].points, { 'Avery Stone': 1 }, "a tap gives Avery one point in 008's class for this section");
eq([bp.sets[secName].log[0].tagLabel, bp.sets[secName].log[0].cat], ['Manual', 'other'], "in 008's default category, as its +1 does");
ok(/\+1 point for Avery Stone \(category Other\) in Behavior & Points/.test(await status()), 'and the status says so');
ok(!(await seatOf('Avery').evaluate(n => n.classList.contains('absent'))), 'the tap did not mark Avery absent');
eq(await read('crh_flags_v1'), null, 'and wrote no flag');

await page.click('#liveBar label:has(input[value="pass"])');
eq(await mode(), 'pass', 'A hall pass can be picked');
await seatOf('Blake').locator('.seat').click();
let hp = await passes();
eq(hp && hp.sets[secName].outNow.map(o => [o.name, o.destLabel]), [['Blake Rivers', 'Restroom']], "with no 001 data, a section is made and Blake is out to 001's first default");
ok(/Blake Rivers signed out to Restroom/.test(await status()), 'and the status says so');
await seatOf('Blake').locator('.seat').click();
ok(/Blake Rivers already has a pass out/.test(await status()), 'a second pass for Blake is refused politely');
eq((await passes()).sets[secName].outNow.length, 1, 'and nothing more is written');

await page.click('#liveUndoBtn');
ok(/Took back the hall pass for Blake Rivers/.test(await status()), 'Undo takes the pass back');
eq((await passes()).sets[secName].outNow, [], "and 001's section has nobody out");
await page.locator('#deskLayer .seat').first().focus();
await page.keyboard.press('Control+z');
ok(/Took back the point for Avery Stone/.test(await status()), 'Ctrl+Z takes the point back next');
bp = await points();
eq([bp.sets[secName].points['Avery Stone'], bp.sets[secName].log.length], [0, 0], "and 008's class is back to nothing");
eq(await chartNow(), chartBefore, 'no tap and no undo changed the chart');

// what 008 and 001 will show: one point for Avery, one pass for Blake
await page.click('#liveBar label:has(input[value="point"])');
await seatOf('Avery').locator('.seat').click();
await page.click('#liveBar label:has(input[value="pass"])');
await seatOf('Blake').locator('.seat').click();

await page.click('#liveBtn');
await settle(page, 300);
ok(await page.locator('#liveBar').isHidden(), 'leaving live mode hides the switch');
await page.click('#liveBtn');
await settle(page, 300);
eq(await mode(), 'absent', 'and it is back on Absent when live mode starts again');
await seatOf('Casey').locator('.seat').click();
ok(await seatOf('Casey').evaluate(n => n.classList.contains('absent')), 'so a tap marks absent again');

// data of a shape this page does not know is refused and left as it was
const newer = JSON.stringify({ version: 9, sets: {} });
const savedPass = await page.evaluate(() => localStorage.getItem('hall-pass-log-sections'));
await page.evaluate(v => localStorage.setItem('hall-pass-log-sections', v), newer);
await page.click('#liveBar label:has(input[value="pass"])');
await seatOf('Avery').locator('.seat').click();
ok(/newer version/.test(await status()), "a 001 store with a version 005 does not know: refused, and it says why");
eq(await page.evaluate(() => localStorage.getItem('hall-pass-log-sections')), newer, 'and the store is untouched');
await page.evaluate(v => localStorage.setItem('hall-pass-log-sections', v), savedPass);
await page.click('#liveBtn');
await settle(page, 300);
ok(!page.__errs.length, 'no page errors on 005' + (page.__errs.length ? ': ' + page.__errs.join(' | ') : ''));

// 008 and 001 read it back
const p8 = await page.context().newPage();
await p8.goto(BASE + '/Tools/008-behavior-points-tracker.html', { waitUntil: 'load' });
await settle(p8, 600);
const card = p8.locator('#studentGrid .student-card[data-name="Avery Stone"]');
ok(await card.count() === 1, '008 opens on the class and shows Avery');
ok(/(^|\D)\+?1(\D|$)/.test(await card.textContent()), "with Avery's one point (" + (await card.textContent()).trim().replace(/\s+/g, ' ') + ')');
ok(/Avery Stone/.test(await p8.textContent('#activityFeed')), "and the point in 008's own activity feed, where its undo is");
ok(await p8.locator('#activityFeed [data-undo-id]').count() === 1, "with 008's own Undo beside it, as soon as the page opens");

const p1 = await page.context().newPage();
await p1.goto(BASE + '/Tools/001-hall-pass-log.html', { waitUntil: 'load' });
await settle(p1, 600);
ok(/Blake Rivers/.test(await p1.textContent('#liveBoard')), "001 opens on the section and shows Blake out");
ok(/Restroom/.test(await p1.textContent('#liveBoard')), 'to the Restroom');

console.log(`\n${passed} passed, ${failed} failed`);
await browser.close();
server.close?.();
process.exit(failed ? 1 : 0);
