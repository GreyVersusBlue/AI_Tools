// smoke-assess.mjs — 027's discussion assessment on the running page (BACKLOG rank 135).
//
//   node Tools/novel-study-circles-manager/test/smoke-assess.mjs   (npm run test:nsc-assess, port 8658)
//
// Each meeting in Meeting History has a Discussion assessment table: a box per student for Participated, Prepared and
// Advanced the conversation, tapped round blank, yes, some, not yet. The Discussion Record card adds them up across the
// book and prints. Held here: the boxes are blank for a project saved before and the meetings in storage are not touched
// until a box is; a tap changes the box in place (text, colour state, accessible name, the row's points), saves, and
// updates the record; the cycle comes back to blank and takes the field off the meeting again; marks survive a reload;
// the record's numbers are the arithmetic's own for what was tapped; Print opens the record as the only sheet; Delete
// meeting takes its marks with it and Undo brings them back; a student named like markup, and a stored list full of junk,
// are text and are ignored; no console error; axe finds nothing serious; no sideways scroll at 360 px. print() is stubbed;
// nothing was printed on paper. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8658;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/027-novel-study-circles-manager.html';
const STORE = 'novel-study-circles', CUR = 'novel-study-circles-current';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

const meeting = (id, date, names, extra = {}) => ({
  id, date, together: true, wholeClassCheckpoint: 'Ch. ' + id, vocab: [],
  groups: [{ id: 'g1', label: 'Group 1', checkpoint: 'Ch. ' + id, assignment: names.map((n, i) => ({ name: n, role: i ? null : 'Discussion Director' })) }], ...extra
});
const project = (meetings, names = ['Ann Lee', 'Ben Cho', 'Cy Dunn']) => ({
  name: 'Novel', students: names.join('\n'), bookTitle: 'The Giver', mode: 'count', splitValue: 1,
  groups: [{ id: 'g1', label: 'Group 1', members: names }],
  roles: [{ name: 'Discussion Director', prompts: '' }], together: true, history: {}, meetings, schedule: null
});

async function open(proj, size = { width: 1200, height: 1000 }) {
  const page = await prepPage(browser, BASE, size);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.errors = errors;
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; window.confirm = () => true; });
  await page.addInitScript(([store, cur, p]) => {
    if (p && !localStorage.getItem(store)) { localStorage.setItem(store, JSON.stringify({ [p.name]: p })); localStorage.setItem(cur, p.name); }
  }, [STORE, CUR, proj]);
  await page.goto(URL_PAGE, { waitUntil: 'load' });
  await settle(page, 500);
  return page;
}
const saved = page => page.evaluate(([s, c]) => JSON.parse(localStorage.getItem(s))[localStorage.getItem(c)], [STORE, CUR]);
const boxes = (page, mid) => page.evaluate(m => [...document.querySelectorAll(`.assess-btn[data-assess-m="${m}"]`)].map(b => b.getAttribute('data-level')), mid);
const tap = async (page, mid, si, key, times = 1) => {
  for (let i = 0; i < times; i++) await page.click(`.assess-btn[data-assess-m="${mid}"][data-assess-s="${si}"][data-assess-c="${key}"]`);
};

console.log('027 — discussion assessment');

const M2 = meeting('m2', '2026-10-08', ['Ann Lee', 'Ben Cho', 'Cy Dunn']);
const M1 = meeting('m1', '2026-10-01', ['Ann Lee', 'Ben Cho', 'Cy Dunn']);
let page = await open(project([M2, M1]));   // newest first
const before = JSON.stringify((await saved(page)).meetings);

// the table is there, blank
eq(await page.evaluate(() => document.querySelectorAll('#meetingHistory .assess-table').length), 2, 'each meeting has its assessment table');
eq(await page.evaluate(() => document.querySelectorAll('#meetingHistory details')[1].querySelectorAll('.assess-btn').length), 9, 'three students by three criteria is nine boxes');
eq(await boxes(page, 'm2'), Array(9).fill(null), 'every box starts blank');
eq(await page.textContent('#assessRecord'), 'No discussion marked yet.', 'and the record says nothing is marked');
eq(JSON.stringify((await saved(page)).meetings), before, 'the stored meetings are untouched by looking');
eq(await page.getAttribute('.assess-btn[data-assess-m="m2"][data-assess-s="0"][data-assess-c="participated"]', 'aria-label'), 'Ann Lee, participated: not marked. Press to change.', 'a box says whose, which, and where it stands');

// the cycle, in place
const first = '.assess-btn[data-assess-m="m2"][data-assess-s="0"][data-assess-c="participated"]';
await page.click(first);
eq([await page.textContent(first), await page.getAttribute(first, 'data-level')], ['✓', '2'], 'one tap is yes');
eq(await page.getAttribute(first, 'aria-label'), 'Ann Lee, participated: Yes. Press to change.', 'and the name says so');
eq((await saved(page)).meetings[0].assess, [{ name: 'Ann Lee', participated: 2 }], 'and it is saved at once, on that meeting only');
eq((await saved(page)).meetings[1].assess, undefined, 'the other meeting has no field');
await page.click(first);
eq([await page.textContent(first), await page.getAttribute(first, 'data-level')], ['~', '1'], 'two taps is some');
await page.click(first);
eq([await page.textContent(first), await page.getAttribute(first, 'data-level')], ['✗', '0'], 'three is not yet');
eq((await saved(page)).meetings[0].assess, [{ name: 'Ann Lee', participated: 0 }], 'a not-yet is saved as 0');
await page.click(first);
eq([await page.textContent(first), await page.getAttribute(first, 'data-level')], ['·', null], 'four is blank again');
eq('assess' in (await saved(page)).meetings[0], false, 'and the field is gone from the meeting');
eq(JSON.stringify((await saved(page)).meetings), before, 'the stored meetings are byte for byte what they were');
ok(await page.evaluate(() => document.querySelector('#meetingHistory details').open), 'the open meeting stayed open through the taps');

// real marks: Ann yes/yes/some in m2, some/-/- in m1; Ben not yet/yes in m2
await tap(page, 'm2', 0, 'participated', 1); await tap(page, 'm2', 0, 'prepared', 1); await tap(page, 'm2', 0, 'advanced', 2);
await tap(page, 'm2', 1, 'participated', 3); await tap(page, 'm2', 1, 'prepared', 1);
await page.evaluate(() => document.querySelectorAll('#meetingHistory details')[1].open = true);
await tap(page, 'm1', 0, 'participated', 2);
eq(await boxes(page, 'm2'), ['2', '2', '1', '0', '2', null, null, null, null], 'm2: the nine boxes show what was tapped');
eq(await page.evaluate(() => [...document.querySelectorAll('#meetingHistory details')[0].querySelectorAll('[data-assess-total]')].map(t => t.textContent)), ['5 / 6', '2 / 4', ''], 'the row points are over the boxes marked (Ann 5 of 6, Ben 2 of 4, Cy none)');
const st = await saved(page);
eq(st.meetings[0].assess, [{ name: 'Ann Lee', participated: 2, prepared: 2, advanced: 1 }, { name: 'Ben Cho', participated: 0, prepared: 2 }], 'm2 is stored as the rows tapped');
eq(st.meetings[1].assess, [{ name: 'Ann Lee', participated: 1 }], 'm1 is stored as its one row');

// the record
const rec = await page.evaluate(() => [...document.querySelectorAll('#assessRecord tbody tr')].map(r => [...r.children].map(c => c.textContent.replace(/\s+/g, ' ').trim())));
eq(rec, [
  ['Ann Lee', '1 yes, 1 some of 2', '1 yes of 1', '1 some of 1', '6 / 8'],
  ['Ben Cho', '1 not yet of 1', '1 yes of 1', '—', '2 / 4']
], 'the record adds the two meetings up, with unmarked boxes not counted as zeros');
ok((await page.textContent('#assessRecord')).includes('2 meetings assessed'), 'and says how many meetings were assessed');
// a later tap moves the record without a reload
await tap(page, 'm1', 1, 'advanced', 1);
eq(await page.evaluate(() => document.querySelectorAll('#assessRecord tbody tr').length), 2, 'a tap redraws the record at once (Ben already there)');
await tap(page, 'm1', 2, 'prepared', 2);
eq(await page.evaluate(() => [...document.querySelectorAll('#assessRecord tbody tr td:first-child')].map(c => c.textContent)), ['Ann Lee', 'Ben Cho', 'Cy Dunn'], 'a student first marked in a later tap joins it, alphabetically');

// survives a reload
await page.reload({ waitUntil: 'load' }); await settle(page, 500);
eq(await boxes(page, 'm2'), ['2', '2', '1', '0', '2', null, null, null, null], 'the boxes come back after a reload');
eq(await page.evaluate(() => document.querySelectorAll('#assessRecord tbody tr').length), 3, 'and so does the record');

// print
await page.click('#printAssessBtn');
await settle(page, 150);
eq(await page.evaluate(() => [window.__printCalls, [...document.querySelectorAll('.print-only.active')].map(x => x.id), document.getElementById('printAssessTitle').textContent]), [1, ['printAssessArea'], 'Novel — Discussion Record'], 'Print discussion record prints that sheet alone');
await page.emulateMedia({ media: 'print' });
eq(await page.evaluate(() => [getComputedStyle(document.getElementById('printAssessArea')).display, [...document.querySelectorAll('.wrap > *:not(.print-only)')].every(e => getComputedStyle(e).display === 'none')]), ['block', true], 'in print media the sheet is shown and the page behind it is not');
ok((await page.textContent('#printAssessBody')).includes('Ann Lee'), 'and it holds the record');
await page.emulateMedia({ media: null });

// delete a meeting takes its marks, undo returns them
await page.evaluate(() => { document.querySelectorAll('#meetingHistory details')[1].open = true; });
await page.click('[data-del-meeting="m1"]');
await settle(page, 200);
eq(await page.evaluate(() => [...document.querySelectorAll('#assessRecord tbody tr td:first-child')].map(c => c.textContent)), ['Ann Lee', 'Ben Cho'], 'deleting m1 takes its marks out of the record');
await page.click('#undoBtn');
await settle(page, 300);
eq(await page.evaluate(() => document.querySelectorAll('#assessRecord tbody tr').length), 3, 'Undo brings m1 and its marks back');
eq((await saved(page)).meetings[1].assess.length, 3, 'and its three rows are in storage again');
eq(page.errors, [], 'no console error');
await page.close();

// hostile names and a junk stored list
const evil = '<img src=x onerror=window.__pwned=1>';
const junk = meeting('mj', '2026-10-15', ['Ann Lee', evil], { assess: [null, 4, { name: 7 }, { name: evil, participated: 2 }, { name: 'Ann Lee', participated: 'x', prepared: 9 }, { name: '__proto__', prepared: 1 }] });
page = await open(project([junk], ['Ann Lee', evil]));
ok(await page.evaluate(() => !window.__pwned && !document.querySelector('#meetingHistory img, #assessRecord img')), 'a student named like markup is text in the table and the record');
eq(await boxes(page, 'mj'), [null, null, null, '2', null, null], 'the junk rows are ignored and the one good row shows (the hostile name\'s Participated box, one of six)');
ok((await page.textContent('#assessRecord')).includes(evil), 'the hostile name is shown as typed');
eq(page.errors, [], 'no console error with junk stored');
await page.close();

// a project from before: no field anywhere
page = await open(project([M1]));
eq(await boxes(page, 'm1'), Array(9).fill(null), 'a project saved before opens with every box blank');
const scan = await a11yScan(page, { impact: 'serious' });
ok(!scan.length, 'axe: no serious violation with the table showing: ' + JSON.stringify(scan.map(v => [v.id, v.nodes])));
await tap(page, 'm1', 0, 'participated', 1);
const scan2 = await a11yScan(page, { impact: 'serious' });
ok(!scan2.length, 'axe: and none with a record: ' + JSON.stringify(scan2.map(v => [v.id, v.nodes])));
await page.close();

const phone = await open(project([M2, M1]), { width: 360, height: 800 });
await tap(phone, 'm2', 0, 'participated', 1);
eq(await phone.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'no sideways scroll at 360 px');
await phone.close();

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
