// smoke-packet.mjs — the conference print packet in the parent/guardian contact log.
//
//   node Tools/parent-contact-log/test/smoke-packet.mjs        (port 8494)
//
// One student's whole history, oldest first, with a summary line (how many,
// first and last date, by method) and a ruled area for notes taken at the
// conference. What this suite holds down:
//
//   The packet says whose it is on EVERY sheet it runs onto (read off
//   Chromium's PDF, one text layer per page) for a student with 1, 15 and 80
//   contacts, and the notes area follows the last row.
//
//   It carries one student only. Two students whose names are substrings of
//   each other ("Ann Lee", "Ann Leeds") each get a packet with nothing of the
//   other's name, outcome text or dates anywhere in it, on screen or on paper.
//
//   Nothing new is stored: the saved keys are byte for byte what they were,
//   and a log saved before reasons existed loads and prints unchanged.
//   The old "print" list for a student is still there and still works.
//
// Exits 1 on any failure. Every name here is invented.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8494;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/068-parent-contact-log.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'pcl-packet-'));

const METHODS = ['Phone call', 'Email', 'Note home', 'In person', 'Text message'];
const REASONS = ['Attendance', 'Grades / missing work', 'Behavior', 'Positive news', 'Academic support'];
/* n contacts, one a day from 2026-01-01 (days 1..28 then rolled into later months
   by Date arithmetic), ids in a scrambled order so the sort cannot lean on them. */
function makeEntries(student, n, tag, startDay = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(2026, 0, 1 + startDay + i));
    out.push({
      id: 'z' + tag + String(n - i).padStart(3, '0'),
      student, date: d.toISOString().slice(0, 10),
      method: METHODS[i % METHODS.length], reason: REASONS[i % REASONS.length],
      initials: 'DM', outcome: `${tag} item ${String(i + 1).padStart(3, '0')} about the reading folder`
    });
  }
  return out;
}

const ROSTER = ['Ann Lee', 'Ann Leeds', 'Quill Marlow', 'Rue Tennant', 'Sage Holloway', 'Una Vickery'];
const ENTRIES = [
  ...makeEntries('Ann Lee', 3, 'LEEONLY'),
  ...makeEntries('Ann Leeds', 4, 'LEEDSONLY', 10),
  ...makeEntries('Quill Marlow', 1, 'ONE'),
  ...makeEntries('Rue Tennant', 15, 'FIFTEEN'),
  ...makeEntries('Sage Holloway', 80, 'EIGHTY'),
  { id: 'legacy1', student: 'Una Vickery', date: '2026-03-02', method: 'Phone call', initials: 'DM', outcome: 'Called about missing homework — spoke with mom.' },
];

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1300, height: 1000 });
await page.addInitScript(([roster, entries]) => {
  window.__printed = 0; window.print = () => { window.__printed++; };
  if (!localStorage.getItem('pcl_roster_v1')) {
    localStorage.setItem('pcl_roster_v1', JSON.stringify(roster));
    localStorage.setItem('pcl_entries_v1', JSON.stringify(entries));
  }
}, [ROSTER, ENTRIES]);

console.log('Parent Contact Log — conference packet');
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

const stored = () => page.evaluate(() => Object.keys(localStorage).sort().map(k => k + '=' + localStorage.getItem(k)).join('\n'));
const before = await stored();

async function packet(name) {
  const n0 = await page.evaluate(() => window.__printed);
  await page.click(`[data-packet-student="${name}"]`);
  const n1 = await page.evaluate(() => window.__printed);
  return n1 - n0;
}
async function sheets(file) {
  const buf = await page.pdf({ format: 'Letter', printBackground: true });
  const f = path.join(SCRATCH, file + '.pdf');
  fs.writeFileSync(f, buf);
  const text = execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' });
  return text.split('\f').filter(t => t.trim());
}
const area = () => page.evaluate(() => document.getElementById('printArea').textContent);
const bodyRows = () => page.$$eval('#printTable tbody tr', trs => trs.map(tr => Array.from(tr.children).map(td => td.textContent)));

/* ── 1. the controls ─────────────────────────────────────────────────────── */
const links = await page.$$eval('[data-packet-student]', as => as.map(a => ({ n: a.dataset.packetStudent, label: a.getAttribute('aria-label'), text: a.textContent })));
eq(links.length, ROSTER.length, 'every student in the list has a packet link');
ok(links.every(l => l.text === 'packet' && l.label === 'Conference packet for ' + l.n), 'each link says which student it is for, to a screen reader');
eq(await page.$$eval('[data-print-student]', a => a.length), ROSTER.length, 'the old "print" list link is still beside it');

/* ── 2. one student, 1 / 15 / 80 contacts ────────────────────────────────── */
async function checkPacket(name, tag, n, expectPages) {
  eq(await packet(name), 1, `${name}: the packet button prints once`);
  const rows = await bodyRows();
  eq(rows.length, n, `${name}: one row per contact (${n})`);
  const dates = rows.map(r => r[0]);
  const asISO = dates.map(d => d.slice(6) + '-' + d.slice(0, 2) + '-' + d.slice(3, 5));
  ok(asISO.every((d, i) => i === 0 || asISO[i - 1] <= d), `${name}: oldest first`);
  eq(rows[0][3], `${tag} item 001 about the reading folder`, `${name}: the first row is the oldest contact`);
  eq(rows[n - 1][3], `${tag} item ${String(n).padStart(3, '0')} about the reading folder`, `${name}: the last row is the newest`);
  eq(JSON.stringify(rows[0].map(c => c.length > 0)), '[true,true,true,true,true]', `${name}: date, method, reason, outcome and initials are all there`);
  ok(rows.every(r => /^\d\d\/\d\d\/\d{4}$/.test(r[0])), `${name}: the date cell holds a date and nothing else (no name in the rows)`);
  eq(await page.textContent('#printTitle'), `${name} — Conference packet`, `${name}: the heading on the first sheet`);
  const head = await page.$$eval('#printTable thead th', ths => ths.map(t => t.textContent));
  eq(head.slice(1).join('|'), 'Date|Method|Reason|Outcome|By', `${name}: the column headings`);
  const summary = await page.textContent('#printSummary');
  ok(summary.startsWith(`${n} contact${n === 1 ? '' : 's'} · first `) && summary.includes(' · last ') && summary.includes('by method: '),
     `${name}: the summary line (${summary})`);
  eq(await page.$$eval('#printNotes .note-line', l => l.length), 14, `${name}: a ruled note area of 14 lines`);
  const pages = await sheets(tag);
  if (expectPages) ok(pages.length >= expectPages, `${name}: runs onto ${pages.length} sheets (want at least ${expectPages})`);
  else ok(pages.length >= 1, `${name}: prints`);
  ok(pages.every(p => p.includes(name)), `${name}: the name is on every one of the ${pages.length} sheets`);
  ok(pages.every(p => /conference/i.test(p)), `${name}: every sheet is headed as the conference's`);
  ok(pages[pages.length - 1].includes('Conference notes'), `${name}: the notes area comes after the last contact`);
  const allText = pages.join('\n');
  eq((allText.match(new RegExp(`${tag} item \\d+`, 'g')) || []).length, n, `${name}: every contact is on paper exactly once`);
  return { pages, summary };
}
const one = await checkPacket('Quill Marlow', 'ONE', 1, 0);
eq(one.pages.length, 1, 'a student with one contact gets one sheet');
const fifteen = await checkPacket('Rue Tennant', 'FIFTEEN', 15, 0);
const eighty = await checkPacket('Sage Holloway', 'EIGHTY', 80, 3);
ok(fifteen.pages.length >= 1 && fifteen.pages.length < eighty.pages.length, `15 contacts take fewer sheets than 80 (${fifteen.pages.length} vs ${eighty.pages.length})`);
ok(eighty.summary.includes('Phone call 16') && eighty.summary.includes('Email 16'), 'the summary counts by method: ' + eighty.summary);
ok(eighty.summary.includes('first 01/01/2026') && eighty.summary.includes('last 03/21/2026'), 'and gives the first and last date');

/* ── 3. nothing of another student ───────────────────────────────────────── */
await packet('Ann Lee');
let text = await area();
ok(text.includes('Ann Lee') && !text.includes('Ann Leeds'), '"Ann Lee": the packet names her and not "Ann Leeds"');
ok(!text.includes('LEEDSONLY'), 'and carries none of Ann Leeds\'s outcome text');
eq((await bodyRows()).length, 3, 'and only her 3 contacts');
let paper = (await sheets('annlee')).join('\n');
ok(!paper.includes('Leeds') && !paper.includes('LEEDSONLY'), '"Ann Lee": nothing of Ann Leeds on paper');
for (const other of ['Quill', 'Rue', 'Sage', 'Una']) ok(!paper.includes(other), `"Ann Lee": no ${other} on paper`);
await packet('Ann Leeds');
text = await area();
eq((await bodyRows()).length, 4, '"Ann Leeds": her 4 contacts');
ok(text.includes('Ann Leeds') && !text.includes('LEEONLY'), '"Ann Leeds": none of Ann Lee\'s outcome text');
paper = (await sheets('annleeds')).join('\n');
ok(!paper.includes('LEEONLY') && !/Ann Lee(?!ds)/.test(paper), '"Ann Leeds": the name "Ann Lee" is not on paper by itself');
const summ = await page.textContent('#printSummary');
ok(summ.startsWith('4 contacts · first 01/11/2026 · last 01/14/2026'), 'her summary is hers, not a combined one: ' + summ);

/* ── 4. old data, and a student with no contacts ─────────────────────────── */
await packet('Una Vickery');
const una = await bodyRows();
eq(una.length, 1, 'an entry saved before reasons existed prints');
eq(una[0][2], '—', 'with an em dash for the reason, not an invented one');
await page.evaluate(() => {
  const r = JSON.parse(localStorage.getItem('pcl_roster_v1')); r.push('Vale Okafor');
  localStorage.setItem('pcl_roster_v1', JSON.stringify(r));
});
const beforeEmpty = await stored();
await page.reload({ waitUntil: 'networkidle' }); await settle(page, 200);
await packet('Vale Okafor');
eq((await bodyRows()).length, 0, 'a student with no contacts: no rows');
eq(await page.textContent('#printSummary'), 'No contacts logged yet.', 'and says so');
eq(await page.$$eval('#printNotes .note-line', l => l.length), 14, 'but still gets the blank notes area');

/* ── 5. the old list print, and the whole-log print, are unchanged ──────── */
await page.click('[data-print-student="Quill Marlow"]');
eq(await page.evaluate(() => document.getElementById('printTitle').textContent), 'Quill Marlow — Contact History', 'the old per-student list keeps its title');
eq(await page.evaluate(() => document.getElementById('printSummary').hidden && document.getElementById('printNotes').hidden), true,
   'and does not carry the packet summary or note area');
eq(await page.$$eval('#printTable thead th', t => t.length), 6, 'and its six-column table');
await page.click('#printAllBtn');
ok((await area()).includes('Ann Leeds') , 'the whole-log print still lists everyone');

/* ── 6. nothing new stored ───────────────────────────────────────────────── */
await page.evaluate(() => { const r = JSON.parse(localStorage.getItem('pcl_roster_v1')); r.pop(); localStorage.setItem('pcl_roster_v1', JSON.stringify(r)); });
eq(await stored(), before, 'after every packet the saved keys are byte for byte what they were');
ok(beforeEmpty !== before, '(the added roster name was a real change that this check had to undo)');

/* ── 7. the roster list for a keyboard and a screen reader ───────────────── */
await page.focus('[data-packet-student="Rue Tennant"]');
await page.keyboard.press('Enter');
eq((await bodyRows()).length, 15, 'Enter on a focused packet link prints that student\'s packet');
const axe = await a11yScan(page, { impact: 'serious' });
eq(axe.length, 0, 'axe finds no serious violation with the roster list and packet links showing: ' + JSON.stringify(axe.map(v => v.id)));

await browser.close();
server.close?.();
fs.rmSync(SCRATCH, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
