// smoke-flow.mjs — the conference sign-up pages, driven in a real browser in demo
// mode (the same rules from core.js, kept in localStorage).
//
//   node conference-signup/test/smoke-flow.mjs
//
// Two pages in one browser context share the demo's storage, so they stand in for
// two families; a second page gets its own holder id so the server sees two
// strangers. Covers: the teacher search and times dropdown, the ten-minute hold
// showing to another family, the bag and checkout, the ticket PDF, then the staff
// desk: PIN, a team-style double booking, the Excel export, and the open/closed
// switch.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serve, launch, prepPage, settle, a11yScan } from '../../Tools/board-check/harness.mjs';

const PORT = 8529;
const BASE = `http://127.0.0.1:${PORT}`;
const FAMILY = BASE + '/conference-signup/index.html';
const STAFF = BASE + '/conference-signup/admin.html';
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'conf-'));

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const A = await prepPage(browser, BASE, { width: 420, height: 900, mobile: true });
const context = A.context();
// The deployed pages point config.js at the live Worker (#363). This suite is the demo-mode
// flow, so every page in the context gets the empty address, and nothing here reaches the network.
const demoConfig = route => route.fulfill({ contentType: 'text/javascript', body: "window.CONF_API = '';" });
await context.route(/\/config\.js(\?.*)?$/, demoConfig);
await A.route(/\/config\.js(\?.*)?$/, demoConfig); // prepPage's own page route comes before a context one

console.log('Conference book bag — family and staff flow (demo mode)');

/* ── family A ───────────────────────────────────────────────────────────── */
await A.goto(FAMILY, { waitUntil: 'networkidle' });
await settle(A, 300);
ok(await A.locator('#demo').isVisible(), 'demo mode is announced');
ok(await A.locator('#q').isDisabled(), 'the teacher search waits until a child is named');

await A.fill('#student', 'Azul Pina');
await A.fill('#parent', 'Maria Pina');
ok(await A.locator('#q').isEnabled(), 'naming a child opens the search');

await A.fill('#q', 'alm');
eq(await A.locator('#results li[role=option]').first().innerText().then((t) => t.split('\n')[0]), 'Ms. Almer', 'typing "alm" suggests Ms. Almer first');
eq(await A.getAttribute('#q', 'aria-expanded'), 'true', 'the suggestion list is announced as open');
await A.keyboard.press('Enter');
eq(await A.inputValue('#q'), 'Ms. Almer', 'Enter picks the highlighted teacher');
const opts = await A.locator('#time option').allInnerTexts();
eq(opts.length, 12, 'all twelve times are offered for a fresh teacher');
eq(opts[0], '4:00 PM', 'the first time is 4:00 PM');
await A.selectOption('#time', '4:00');
await A.click('#reserve');
await A.waitForSelector('#bagList li');
eq(await A.innerText('#count'), '1', 'the bag counts one conference');
ok(/held for (9:5\d|10:00)/.test(await A.innerText('#bagList .left')), 'the bag shows a ten-minute countdown');
eq(await A.locator('#student').getAttribute('readonly'), '', 'the child is locked while the bag has something in it');

/* a subject search finds teachers, and a time the child already has is not offered again */
await A.fill('#q', 'math');
ok((await A.locator('#results li[role=option]').count()) >= 4, 'searching by subject lists the math teachers');
await A.fill('#q', 'barrett');
await A.keyboard.press('Enter');
const barrett = await A.locator('#time option').allInnerTexts();
ok(/4:00 PM \(you have another conference then\)/.test(barrett[0]), 'a time the child already has is shown but not offered');
eq(await A.locator('#time option').first().isDisabled(), true, '…and it cannot be chosen');
await A.selectOption('#time', '4:30');
await A.click('#reserve');
await A.waitForFunction(() => document.getElementById('count').textContent === '2');

/* ── family B (a stranger to the server) ────────────────────────────────── */
const B = await context.newPage();
await B.addInitScript(() => {
  const real = Storage.prototype.getItem;
  Storage.prototype.getItem = function (k) { return k === 'conf-token' ? 'second-family-0000000001' : real.call(this, k); };
});
await B.goto(FAMILY, { waitUntil: 'networkidle' });
await B.fill('#student', 'Jasmeet Kaur');
await B.fill('#q', 'almer');
await B.keyboard.press('Enter');
const bTimes = await B.locator('#time option').allInnerTexts();
eq(bTimes[0], '4:00 PM (held by another family)', "family B sees A's hold, without a name");
eq(await B.locator('#time option').first().isDisabled(), true, 'and cannot take it');
ok(!(await B.content()).includes('Azul'), "B's page never contains A's child's name");
eq(await B.locator('#bagList li').count(), 0, "B's bag is empty: holds belong to the browser that made them");

/* ── A checks out ───────────────────────────────────────────────────────── */
await A.click('#checkout');
await A.waitForSelector('#done:not([hidden])');
const code = await A.locator('#done .code').innerText();
ok(/^[A-Z2-9]{6}$/.test(code), `a confirmation code came back (${code})`);
eq(await A.locator('#done .ticket').count(), 2, 'one ticket per conference');
const first = await A.locator('#done .ticket').first().innerText();
ok(/4:00\s*PM/.test(first) && /Ms\. Almer/.test(first), 'tickets are in time order, with the teacher');

const [dl] = await Promise.all([A.waitForEvent('download', { timeout: 20000 }), A.click('#dl')]);
const pdf = path.join(OUT, dl.suggestedFilename());
await dl.saveAs(pdf);
ok(fs.readFileSync(pdf).subarray(0, 5).toString() === '%PDF-', 'the ticket downloads as a PDF');
ok(/Conference tickets - Azul Pina\.pdf/.test(dl.suggestedFilename()), `named for the child (${dl.suggestedFilename()})`);

/* after checkout, B sees 4:00 as gone entirely */
await B.reload({ waitUntil: 'networkidle' });
await B.fill('#student', 'Jasmeet Kaur');
await B.fill('#q', 'almer');
await B.keyboard.press('Enter');
ok(!(await B.locator('#time option').allInnerTexts()).some((t) => t.startsWith('4:00')), 'a booked time disappears from other families');
await B.close();

/* "book for another child" comes back clean, and remembers the booking */
await A.click('#another');
eq(await A.inputValue('#student'), '', 'the next child starts blank');
eq(await A.inputValue('#parent'), 'Maria Pina', 'the parent name is kept');
ok((await A.locator('#earlier').innerText()).includes(code), 'the earlier booking can be found again on this device');

/* ── staff ──────────────────────────────────────────────────────────────── */
const S = await context.newPage();
S.on('pageerror', (e) => A.__errs.push('staff page: ' + e));
S.on('console', (m) => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) A.__errs.push('staff console: ' + m.text()); });
await S.setViewportSize({ width: 1400, height: 900 });
await S.goto(STAFF, { waitUntil: 'networkidle' });
await S.fill('#pin', '0000');
await S.click('#pinForm button[type=submit]');
await S.waitForFunction(() => /not right/.test(document.getElementById('pinStatus').textContent));
ok(await S.locator('#desk').isHidden(), 'a wrong PIN keeps the desk locked');
await S.fill('#pin', '1234');
await S.click('#pinForm button[type=submit]');
await S.waitForSelector('#desk:not([hidden])');
eq(await S.locator('#matrix tbody tr').count(), 12, 'the schedule has twelve time rows');
eq(await S.locator('#matrix thead th').count(), 33, 'and a column per teacher (32) plus the time column');
eq(await S.locator('#matrix td.s-booked').count(), 2, "A's two conferences show as booked");
ok((await S.locator('#matrix td.s-booked button').first().innerText()) === 'Azul Pina', 'the booked cell shows the student');

/* team-style conference: refused for families, offered to staff */
await S.click('#matrix button[data-tid="t03"][data-time="4:00"]'); // Ms. Cavey, 4:00
await S.fill('#fStudent', 'azul pina');
await S.click('#cellBody button[type=submit]');
await S.waitForFunction(() => /team conference/.test(document.getElementById('cellBody').textContent));
ok(/already meets Ms\. Almer at 4:00 PM/.test(await S.locator('#cellBody').innerText()), 'staff are told who the child is already with');
await S.click('text=Yes, book as a team conference');
await S.waitForFunction(() => !document.getElementById('cell').open);
eq(await S.locator('#matrix td.s-team').count(), 2, 'both halves of the team conference are marked');

/* block, then a family cannot see that time */
await S.click('#tab-setup');
await S.selectOption('#bTeacher', 't02'); // Mr. Barrett
await S.selectOption('#bFrom', '6:00');
await S.click('#blockForm button[data-on="1"]');
await S.waitForFunction(() => /Blocked 4 times/.test(document.getElementById('blockStatus').textContent));
await S.click('#tab-grid');
eq(await S.locator('#matrix td.s-blocked').count(), 4, 'four blocked cells on the grid');

/* the export */
const [xl] = await Promise.all([S.waitForEvent('download', { timeout: 20000 }), S.click('#exportBtn')]);
const xlsxPath = path.join(OUT, xl.suggestedFilename());
await xl.saveAs(xlsxPath);
ok(/\.xlsx$/.test(xlsxPath), `an .xlsx came out (${xl.suggestedFilename()})`);
const bytes = Array.from(fs.readFileSync(xlsxPath));
const sheets = await S.evaluate((b) => {
  const wb = window.XLSX.read(new Uint8Array(b), { type: 'array' });
  const out = {};
  for (const n of wb.SheetNames) out[n] = window.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' });
  return out;
}, bytes);
eq(Object.keys(sheets).join('|'), 'Conference Matrix|Meetings', 'two sheets: the matrix and the flat list');
const m = sheets['Conference Matrix'];
eq(m[2][0], 'Time (PM)', 'the matrix header row matches the old sheet');
eq(m[2][1], 'Ms. Almer', 'teachers run across the top');
eq(m[3][1], 'Science', 'with subject');
eq(m[4][2], '8th', 'and grade rows');
eq(m[5][0] + '/' + m[5][1], '4:00/Azul Pina', 'the student sits in the teacher/time cell');
eq(m[5][3], 'Azul Pina', 'the team conference shows under the second teacher too');
eq(m[13][0] + '/' + m[13][2], '6:00/Block', 'a blocked cell reads Block (Barrett, 6:00)');
const list = sheets['Meetings'];
eq(list.length, 4, 'the list has a header and three meetings (two parent, one staff)');
ok(list.slice(1).some((r) => r[7] === 'Staff') && list.slice(1).some((r) => r[7] === 'Parent'), 'it says who made each booking');

/* closing the sign-up closes the family page */
await S.click('#openBtn');
await S.waitForFunction(() => document.getElementById('openBtn').getAttribute('aria-pressed') === 'false');
await A.reload({ waitUntil: 'networkidle' });
ok(await A.locator('#closed').isVisible(), 'a closed event says so to families');
ok(await A.locator('#q').isDisabled(), 'and the search stays shut');

/* accessibility, both pages */
await A.fill('#student', 'Test Child');
const axeA = await a11yScan(A, { impact: 'serious' });
ok(axeA.length === 0, 'no serious accessibility violations on the family page: ' + JSON.stringify(axeA));
const axeS = await a11yScan(S, { impact: 'serious' });
ok(axeS.length === 0, 'no serious accessibility violations on the staff desk: ' + JSON.stringify(axeS));

ok(A.__errs.length === 0, 'no page, console or network errors: ' + JSON.stringify(A.__errs.slice(0, 3)));
ok(A.__blocked.length === 0, 'nothing asked for another site: ' + JSON.stringify(A.__blocked));

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
