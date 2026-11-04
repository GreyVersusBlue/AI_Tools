// smoke-live.mjs — live mode on 005 (Path 14 P5 increment 3).
//
//   node Tools/seating-chart/test/smoke-live.mjs
//
// Live mode is opt-in: the page is unchanged until "Live mode" is pressed. On stage a tap on a seat
// marks that student absent today through _shared/student-flags.js (crh_flags_v1, by the roster id
// Class Roster Hub minted), a second tap marks them present, a student on no saved roster is absent
// for the live session only and writes nothing, and no tap edits the chart. Leaving live mode puts
// the editing page back. On stage a room mark does not move (AI-63, L1), and two students with one
// name in a period are marked for the live session only, one seat at a time (AI-63, L2).
/* global addNames, autoAssign -- 005's inline-script functions, called inside page.evaluate() */
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8567;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/005-Seating%20Chart%20Generator.html';

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; return true; } failed++; console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
console.log('Seating Chart Generator — live mode');

await page.addInitScript(() => {
  if (localStorage.getItem('crh_students_v1')) return;
  localStorage.setItem('crh_students_v1', JSON.stringify({ version: 1, rosters: { 'Period 3': { meta: {},
    students: [{ id: 'sa', name: 'Avery Stone' }, { id: 'sb', name: 'Blake Rivers' }], orphans: [] } } }));
});
await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 500);
await page.fill('#nameInput', 'Avery Stone\nBlake Rivers\nCasey Lund');
await page.evaluate(() => addNames());
await page.click('button[onclick="makeGrid()"]');
await page.evaluate(() => autoAssign());
await settle(page, 400);

const seatOf = name => page.locator('#deskLayer .desk', { hasText: name });
const flags = () => page.evaluate(() => JSON.parse(localStorage.getItem('crh_flags_v1') || 'null'));
const assign = async () => { await settle(page, 1300); return page.evaluate(() => { const st = JSON.parse(localStorage.getItem('seating-chart-v1')); return JSON.stringify((st.sections.find(x => x.id === st.active) || st.sections[0]).assign); }); };
const today = await page.evaluate(() => StudentFlags.dayKey());
const before = await assign();

// not live: a tap does what it always did, and the page has no live styling
ok(await page.locator('#liveBtn').isVisible(), 'the toolbar has a Live mode button');
ok(!(await page.evaluate(() => document.body.classList.contains('live'))), 'the page is not live at rest');
await seatOf('Avery').locator('.seat').click();
eq(await flags(), null, 'a tap before live mode marks nobody absent');

await page.click('#liveBtn');
await settle(page, 300);
ok(await page.evaluate(() => document.body.classList.contains('live')), 'Live mode puts the page on stage');
ok(await page.locator('#floorWrap.is-fullscreen').count() === 1, 'the floor is the stage');
ok(!(await seatOf('Avery').locator('.desk-ctrls').isVisible()), 'the desk controls are hidden on stage');
eq(await seatOf('Avery').locator('.seat').getAttribute('draggable'), null, 'and a seat does not drag');

await seatOf('Avery').locator('.seat').click();
eq((await flags()).flags.sa, { absent: today }, "a tap writes Avery's absence for today under the roster id");
ok(await seatOf('Avery').evaluate(n => n.classList.contains('absent')), 'the seat shows absent');
ok(/absent/.test(await seatOf('Avery').locator('.seat').getAttribute('aria-label')), 'and says so to a screen reader');
ok(/Avery Stone marked absent today/.test(await page.textContent('#status')), 'and the status line says what happened');
ok(!(await seatOf('Blake').evaluate(n => n.classList.contains('absent'))), 'nobody else is absent');

await seatOf('Casey').locator('.seat').click();
ok(await seatOf('Casey').evaluate(n => n.classList.contains('absent')), 'a student on no saved roster shows absent too');
ok(/live session only/.test(await page.textContent('#status')), 'and the tap says it lasts for this session only');
eq(Object.keys((await flags()).flags), ['sa'], 'and writes nothing to the flags');

await seatOf('Avery').locator('.seat').click();
eq((await flags()).flags, {}, 'a second tap marks Avery present again');
await seatOf('Avery').locator('.seat').click();
eq(await assign(), before, 'no tap edits the chart');

await page.click('#liveBtn');
await settle(page, 300);
ok(!(await page.evaluate(() => document.body.classList.contains('live'))), 'leaving live mode takes the page off stage');
ok(!(await seatOf('Casey').evaluate(n => n.classList.contains('absent'))), "a session-only absence goes with the live session");
eq((await flags()).flags.sa, { absent: today }, "Avery's roster absence stays (Class Roster Hub and Name Picker read it)");
eq(await seatOf('Avery').locator('.seat').getAttribute('draggable'), 'true', 'seats drag again');

// AI-63 (review L1): on stage a room mark is not an edit target: no drag, no grip, no keys, nothing saved
await page.fill('#newRoomName', 'Room 12');
await page.click('button[onclick="makeRoom()"]');
await settle(page, 300);
await page.selectOption('#markKind', 'door');
await page.click('button[onclick="addMark()"]');
await settle(page, 300);
const markLoc = page.locator('#deskLayer .room-mark');
ok(await markLoc.evaluate(n => n.classList.contains('movable')), 'off stage the mark can be moved');
const rooms = async () => { await settle(page, 1300); return page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('seating-chart-v1')).rooms)); };
const roomsBefore = await rooms();
await page.click('#liveBtn');
await settle(page, 300);
eq(await page.locator('#deskLayer .room-mark.movable').count(), 0, 'on stage the mark is not movable');
eq(await page.locator('#deskLayer .room-mark .mark-grip').count(), 0, 'and has no resize grip');
eq(await markLoc.getAttribute('tabindex'), null, 'and is not a stop for the keys');
const mb = await markLoc.boundingBox();
await page.mouse.move(mb.x + mb.width / 2, mb.y + mb.height / 2);
await page.mouse.down();
await page.mouse.move(mb.x + mb.width / 2 + 120, mb.y + mb.height / 2 + 80, { steps: 6 });
await page.mouse.up();
await page.mouse.move(mb.x + mb.width - 3, mb.y + mb.height - 3);
await page.mouse.down();
await page.mouse.move(mb.x + mb.width + 90, mb.y + mb.height + 90, { steps: 6 });
await page.mouse.up();
await markLoc.evaluate(n => n.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true })));
eq(await rooms(), roomsBefore, 'a drag, a pull on the corner or R on stage changes no room');
await page.click('#liveBtn');
await settle(page, 300);
ok(await markLoc.evaluate(n => n.classList.contains('movable')), 'off stage again the mark can be moved');

// AI-63 (review L2): two students with one name in a period never share one roster absence
// addNames() refuses a repeat, but a rename or an older saved chart can hold one: put it in the saved chart
await settle(page, 1300);
await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem('seating-chart-v1')); const s = st.sections.find(x => x.id === st.active) || st.sections[0];
  s.students.push({ id: 'dupblake', name: 'Blake Rivers', note: '', flag: false, photo: '' });
  localStorage.setItem('seating-chart-v1', JSON.stringify(st));
});
await page.reload({ waitUntil: 'load' });
await settle(page, 500);
await page.evaluate(() => autoAssign());
await settle(page, 400);
const blakes = page.locator('#deskLayer .desk', { hasText: 'Blake Rivers' });
eq(await blakes.count(), 2, 'the period has two Blake Rivers');
await page.click('#liveBtn');
await settle(page, 300);
await blakes.nth(0).locator('.seat').click();
const marked = await page.evaluate(() => [...document.querySelectorAll('#deskLayer .desk')].filter(d => /Blake Rivers/.test(d.textContent)).map(d => d.classList.contains('absent')));
eq(marked.filter(Boolean).length, 1, 'a tap on one Blake marks only that one absent: ' + JSON.stringify(marked));
ok(!('sb' in ((await flags()) || { flags: {} }).flags), "and writes no roster absence a name could put on the other");
ok(/live session only/.test(await page.textContent('#status')) && /same name/.test(await page.textContent('#status')), 'and says why it lasts for this session only: ' + await page.textContent('#status'));
await page.click('#liveBtn');
await settle(page, 300);

console.log(`\n${passed} passed, ${failed} failed`);
await browser.close();
server.close?.();
process.exit(failed ? 1 : 0);
