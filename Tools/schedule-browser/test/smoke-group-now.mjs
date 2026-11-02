// smoke-group-now.mjs — "Where is class X right now?" on 034's By Student Group view.
//
//   node Tools/schedule-browser/test/smoke-group-now.mjs
//
// Backlog rank 139. The published file holds classes (6-1), never students, so the
// answer is a class's block, room and teacher, read from the device clock and the bell
// times. Under test, with the clock pinned and every expected answer worked out from
// PUBLISHED_DATA here, not from the page's own helpers:
//   1. inside a block: the block, its time, the room and the teacher(s) teaching it;
//   2. the A / B chips change the answer when the days differ;
//   3. between blocks the card says so and names no room;
//   4. a class with no published room still renders;
//   5. no student name or id can reach the card (the data has none to read).
// Exits 1 on any failure.

/* global brSetMode, brChoose, brSetGrpDay, BR_BELL, PUBLISHED_DATA -- page globals read inside page.evaluate() */
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8669;
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; } else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(a === b, `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1000, height: 900 });
await page.goto(BASE + '/Tools/034-schedule-browser.html', { waitUntil: 'networkidle' });
await settle(page, 500);
console.log('Schedule Browser — where is this class right now');

const at = (h, m) => page.clock.setFixedTime(new Date(2026, 10, 2, h, m, 0));
const showGroup = (sec) => page.evaluate((s) => { brSetMode('group'); brChoose(s); }, sec);
const card = () => page.evaluate(() => {
  const h = [...document.querySelectorAll('#br-view h3')].find(x => /right now/.test(x.textContent));
  if (!h) return null;
  let t = '', n = h.nextElementSibling;
  while (n && n.tagName !== 'H3') { t += ' ' + n.textContent; n = n.nextElementSibling; }
  return { head: h.textContent, text: t.replace(/\s+/g, ' ').trim(), links: [...(h.parentElement.querySelectorAll('.factline .lnk'))].map(b => b.textContent) };
});
const data = await page.evaluate(() => JSON.parse(JSON.stringify(PUBLISHED_DATA)));
const secs = Object.keys(data.groupRooms);
const sec = secs[0];

/* 1. inside a block (second block, A day) */
await at(10, 30); await showGroup(sec);
let c = await card();
ok(c && c.head.includes(sec), 'the card names the class');
const room = data.groupRooms[sec].A[1];
const who = Object.keys(data.teachers).filter(n => data.teachers[n].A[1] === sec);
ok(c && c.text.includes('Room ' + room), `A day, 10:30: room ${room}`);
ok(c && c.text.includes(data.modLabel + ' 2'), 'block 2 is named');
ok(c && c.text.includes(data.bell.A[1]), 'the block time is shown');
ok(who.length > 0, 'the sample class has a teacher in that block');
eq(c && c.links.join('|'), who.join('|'), 'the teachers of that block, as links');

/* 2. B day differs when the bell differs */
await page.evaluate(() => { BR_BELL.B = ['8:30–9:00', '9:00–10:00', '10:00–11:00', '11:00–12:00']; });
await page.evaluate(() => brSetGrpDay('B'));
c = await card();
const roomB = data.groupRooms[sec].B[2];
ok(c && c.text.includes('on B day'), 'B chip: the card says B day');
ok(c && c.text.includes(data.modLabel + ' 3'), 'B day, 10:30 falls in the third (changed) block');
ok(c && c.text.includes('Room ' + roomB), `B day room ${roomB}`);

/* 3. between blocks / after school */
await at(7, 0); await showGroup(sec);
c = await card();
ok(c && /between blocks|school is out/.test(c.text), 'before school: says so');
ok(c && !/Room /.test(c.text), 'before school: no room is named');
await at(16, 0); await showGroup(sec);
c = await card();
ok(c && !/Room /.test(c.text), 'after school: no room is named');

/* 4. a class with no listed room in that block */
const related = secs.find(s => /[A-Za-z]{4,}/.test(data.groupRooms[s].A[3] || ''));
await page.evaluate(() => brSetGrpDay('A'));
await at(14, 0);
if (related) {
  await showGroup(related);
  c = await card();
  ok(c && c.text.includes(data.groupRooms[related].A[3]) && !c.text.includes('Room ' + data.groupRooms[related].A[3]), 'a non-room entry (Related Arts) is shown as given, without "Room"');
} else { ok(false, 'sample data has a non-room entry to test'); 
}
/* 5. nothing but class names, rooms, teachers */
await showGroup(sec);
const html = await page.evaluate(() => document.getElementById('br-view').innerHTML);
ok(!/student(?!s? group)/i.test((await card() || {}).text || ''), 'the card says nothing about individual students');
ok(html.length > 0, 'the view rendered');

await browser.close(); server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
