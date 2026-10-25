// smoke-ics-table.mjs — 032's pasted-table import (Path 9 P4, the rest). The reader is held
// by table.test.mjs; this holds the page.
//
//   node Tools/school-calendar/test/smoke-ics-table.mjs   (or: npm run test:school-calendar-table-page)
//
// What is held. "Paste a Date Table…" opens the paste box (aria-expanded, the focus in the
// box) and closes it again. A district table pasted and read shows every date that would
// change — the rows planIcsImport(readTable(...)) gives for the stored calendar, read with the
// stored school year — and the lines it could not read, each with its line number and why;
// nothing is stored until "Add these days", which stores exactly the plan, closes the box,
// empties it and puts the notice bar's Undo up, and Undo writes the old bytes back. The same
// table read again says nothing would change and offers no Add. Text with no readable line
// is refused in words and stores nothing. Opening the paste box takes an .ics preview away,
// and an .ics preview takes the paste preview away. axe finds nothing serious in the box or its
// preview. Then the deliberate breaks: the page is altered on the wire, and each must fail.
//
// The clock is pinned (the seed's third school day, 10:00 local). Run it in a second zone too
// (TZ=UTC; CI runs in UTC). Nothing here describes a real class. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import { seedCalendar2026 } from '../scv-seed.js';
import { isTeachableDay } from '../scv-pacing.js';
import { readTable, planIcsImport } from '../scv-ics.js';

const PORT = 8550;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/032-School%20Calendar%20Visualizer.html';
const KEY = 'scv_calendar_v1';
const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

let passed = 0, failed = 0;
const fails = [];
let quiet = false;
let breakFails = 0;
const ok = (cond, label) => {
  if (quiet) { if (!cond) breakFails++; return !!cond; }
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const SEED = seedCalendar2026();
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10);
}
const SCHOOL = [];
for (let d = SEED.meta.start; d <= SEED.meta.end; d = addDays(d, 1)) if (isTeachableDay(d, SEED.days, SEED.dayTypes)) SCHOOL.push(d);
const NOW = new Date(SCHOOL[2] + 'T10:00:00');

const TABLE = [
  'Date\tEvent',
  'Mon., Sept. 7\tLabor Day - Schools Closed',
  'Oct 12 - 13\tFall Break',
  '10/21/2026\t1/2 Day - Conferences',
  'Sept 7 Labor Day   Oct 12 Columbus Day',
  'March 15, 2027      Teacher Workday, No Students',
].join('\n');

const server = await serve(PORT);
const browser = await launch();

async function freshPage(pageEdit) {
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  await page.clock.setFixedTime(NOW);
  page.__errs = [];
  page.on('pageerror', (e) => page.__errs.push(String(e)));
  page.on('dialog', (d) => d.accept());
  if (pageEdit) {
    await page.route('**/032-School*', async (route) => {
      const res = await route.fetch();
      route.fulfill({ response: res, body: pageEdit(await res.text()), headers: { ...res.headers(), 'content-type': 'text/html' } });
    });
  }
  await page.goto(BASE + '/index.html');
  return page;
}
const putRaw = (page, s) => page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, s]);
const raw = (page) => page.evaluate((k) => localStorage.getItem(k), KEY);
const open = async (page) => { await page.goto(URL_PAGE, { waitUntil: 'networkidle' }); await settle(page, 400); };
const paste = async (page, text) => { await page.fill('#pasteText', text); await page.click('#pasteRead'); await settle(page, 300); };

async function scenario(label, pageEdit) {
  const p = await freshPage(pageEdit);
  await putRaw(p, JSON.stringify(SEED));
  await open(p);
  const before = await raw(p);

  /* ── the box ── */
  ok(await p.isHidden('#pastePanel'), `${label}: the paste box starts closed`);
  await p.click('#btnPasteTable');
  ok(await p.isVisible('#pastePanel') && (await p.getAttribute('#btnPasteTable', 'aria-expanded')) === 'true', `${label}: "Paste a Date Table…" opens it, aria-expanded true`);
  eq(await p.evaluate(() => document.activeElement && document.activeElement.id), 'pasteText', `${label}: the focus goes into the box`);
  eq(await p.evaluate(() => { const t = document.getElementById('pasteText'); return t.labels.length && t.labels[0].textContent; }), 'Date table', `${label}: the box has a label`);

  /* ── a district table ── */
  await paste(p, TABLE);
  const plan = planIcsImport(JSON.parse(before), readTable(TABLE, { start: SEED.meta.start, end: SEED.meta.end }));
  ok(plan.rows.length >= 4, `${label}: (the table changes ${plan.rows.length} dates: Labor Day's note, the two Fall Break days, the half day, the workday)`);
  eq(await p.$$eval('#pastePreview #icsTable tbody tr', (trs) => trs.length), plan.rows.length, `${label}: the preview lists every date that would change`);
  eq(await p.textContent('#pastePreview h3'), 'Add the pasted table\'s dates', `${label}: the preview says it is the pasted table`);
  ok((await p.textContent('#icsSummary')).includes('the table\'s name goes into the note'), `${label}: and says the name goes into the note`);
  const skips = await p.$$eval('#pastePreview details li', (li) => li.map((x) => x.textContent));
  eq(await p.textContent('#pastePreview details summary'), '2 lines are not imported', `${label}: the lines it could not read are counted as lines`);
  ok(skips.length === 2 && skips[0].startsWith('Line 1 (“Date Event”)') && skips[1].startsWith('Line 5 ') && skips[1].includes('more than one date'), `${label}: each with its line number and why (${skips.join(' | ')})`);
  eq(await raw(p), before, `${label}: nothing is stored while the preview is open`);
  const v1 = await a11yScan(p, { include: ['#pastePanel'] });
  eq(v1.map((x) => x.id), [], `${label}: the paste box and its preview have no serious or critical axe finding`);
  await p.click('#icsApply');
  await settle(p, 300);
  const after = JSON.parse(await raw(p));
  eq(after.days, plan.cal.days, `${label}: "Add these days" stores exactly the plan`);
  eq(after.days['2026-10-13'].types, ['holiday'], `${label}: Fall Break's second day is a closure`);
  eq(after.days['2026-10-21'].types.includes('halfday'), true, `${label}: "1/2 Day" is a half day`);
  ok(await p.isHidden('#pastePanel') && (await p.inputValue('#pasteText')) === '' && (await p.getAttribute('#btnPasteTable', 'aria-expanded')) === 'false', `${label}: the box closes and is emptied`);
  ok(!(await p.isHidden('#planNotice')) && (await p.textContent('#planNoticeText')).includes('pasted table') && !(await p.isHidden('#planUndo')), `${label}: the notice bar names the pasted table and offers Undo`);

  /* ── again: nothing changes ── */
  await p.click('#btnPasteTable');
  await paste(p, TABLE);
  eq(await p.textContent('#icsSummary'), 'Nothing would change: every date in this table already says what it says.', `${label}: the same table again changes nothing`);
  eq(await p.$('#icsApply'), null, `${label}: ...and offers no Add`);
  await p.click('#icsCancel');
  eq(await p.$('#pastePreview #icsBox'), null, `${label}: Close takes the preview away and leaves the box`);
  ok(await p.isVisible('#pastePanel'), `${label}: (the box is still open)`);
  await p.click('#pasteClose');
  await settle(p, 100);
  await p.click('#planUndo');
  await settle(p, 300);
  eq(await raw(p), before, `${label}: Undo writes the old bytes back`);

  /* ── refused ── */
  await p.click('#btnPasteTable');
  await paste(p, 'TBA');
  eq(await p.textContent('#pastePreview [role="alert"]'), 'That line could not be read: it has no date this page can read. Nothing was imported.', `${label}: text with no readable line is refused in words`);
  eq(await raw(p), before, `${label}: ...and nothing is stored`);

  /* ── one preview at a time ── */
  await p.setInputFiles('#fileImportIcs', { name: 'x.ics', mimeType: 'text/calendar', buffer: Buffer.from('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n', 'utf8') });
  await settle(p, 300);
  ok(await p.$('#icsPreview #icsBox') && !(await p.$('#pastePreview #icsBox')), `${label}: an .ics preview takes the paste preview away`);
  await p.click('#btnPasteTable');   // closes the box
  await p.click('#btnPasteTable');   // and opens it again
  eq(await p.$('#icsPreview #icsBox'), null, `${label}: opening the paste box takes the .ics preview away`);

  eq(p.__errs, [], `${label}: the page threw nothing`);
  return p;
}

console.log(`School Calendar Visualizer: pasted-table import (Path 9 P4; TZ=${ZONE})`);
const page = await scenario('page');
await page.context().close();

/* ═══ deliberate breaks: each altered page must fail the scenario ═══ */
const BREAKS = [
  ['the paste stores before Add', (s) => s.replace('  const plan = planIcsImport(cal, result);\n', '  const plan = planIcsImport(cal, result);\n  if (pasted) store.set(plan.cal);\n')],
  ['no Undo after a paste', (s) => s.replace('save("Adding the pasted table", `Added', 'save(null, null && `Added')],
  ['the school year not handed in', (s) => s.replace('{ start: (cal.meta || {}).start, end: (cal.meta || {}).end }', '{}')],
  ['skipped lines called events', (s) => s.replace('const noun = pasted ? "line" : "event";', 'const noun = "event";')],
  ['the box left open after Add', (s) => s.replace('        showPastePanel(false);\n        document.getElementById("pasteText").value = "";\n', '')],
];
let caught = 0;
for (const [name, edit] of BREAKS) {
  quiet = true; breakFails = 0;
  let r = null;
  try { r = await scenario(name, edit); } catch (e) { breakFails++; }
  quiet = false;
  if (r) await r.context().close().catch(() => {});
  if (breakFails) caught++; else { failed++; fails.push('break not caught: ' + name); console.log('  FAIL break not caught: ' + name); }
}

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed; ${caught}/${BREAKS.length} deliberate breaks caught`);
if (failed) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
