// smoke-sub-packet.mjs — the Seating Chart Generator's whole-day sub packet.
//
//   node Tools/seating-chart/test/smoke-sub-packet.mjs
//
// The single-section "Sub export" already put one period's chart, its notes and
// its seating-rule conflicts on one page. A teacher who is out for the day has
// six periods and was doing that six times. This builds the whole day as one
// packet: a contents page, then one sub-export page per section, in order.
//
// What the suite is really guarding is the pair of "for the substitute" rules
// that apply only in this mode and are easy to lose: names and photos forced on
// regardless of the teacher's persisted privacy toggles, and the per-student
// notes every other print mode deliberately withholds. The last section proves
// the ordinary "Print all sections" still does neither.
//
// State is seeded through the tool's own storage key rather than clicked in —
// the click paths have their own coverage in drive-seating.mjs next door, and a
// hand-built fixture lets the keep-apart conflict be guaranteed rather than
// left to the auto-assigner's dice. Printing is driven the way drive-seating
// does it: window.print() stubbed, beforeprint/afterprint dispatched by hand,
// print media emulated, so the real button and the real preparation path run.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8161;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/005-Seating%20Chart%20Generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

/* Two periods. Desks are placed by hand 110px apart — inside ROOM.neighbor
   (142) — so the two students in Period 1's keep-apart pair are provably
   adjacent and the packet has a real conflict to report. */
function section(id, name, names, noteFor) {
  const students = names.map((n, i) => ({
    id: id + '-s' + i, name: n, note: (noteFor && noteFor.name === n) ? noteFor.note : '', flag: false, photo: '',
  }));
  const desks = names.map((_, i) => ({
    id: id + '-d' + i, x: 120 + (i % 2) * 110, y: 120 + Math.floor(i / 2) * 110, rot: 0, locked: false,
  }));
  const assign = {};
  desks.forEach((d, i) => { assign[d.id] = students[i].id; });
  return {
    id, name, students, desks, assign, layouts: [],
    apart: id === 'p1' ? [[students[0].id, students[1].id]] : [],
    together: [],
  };
}

const FIXTURE = {
  __v: 1,
  active: 'p1',
  theme: 'light', zoom: 'fit', lastFirst: false, numbered: false, mirror: false,
  // The teacher's own print preferences are deliberately the opposite of what a
  // substitute needs. The packet has to override them.
  printNames: false, printPhotos: false, printViolations: true,
  sections: [
    section('p1', 'Period 1 — Geology',
      ['Ada Lovelace', 'Marco Polo', 'Nellie Bly', 'Zheng He'],
      { name: 'Marco Polo', note: 'Leaves at 9:40 for speech.' }),
    section('p2', 'Period 2 — Physics',
      ['Grace Hopper', 'Alan Turing', 'Ida B Wells'],
      { name: 'Ida B Wells', note: 'Sits near the door — 504 plan.' }),
  ],
};

const packetPages = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('#printAllWrap .print-page')).map(p => ({
    title: p.querySelector('.print-head h2') ? p.querySelector('.print-head h2').textContent : '',
    meta: p.querySelector('.print-head p') ? p.querySelector('.print-head p').textContent : '',
    text: p.textContent,
    names: Array.from(p.querySelectorAll('.desk .seat > span:last-child')).map(n => n.textContent).filter(Boolean),
    hasNotes: !!p.querySelector('.print-notes'),
    hasViolations: !!p.querySelector('.print-violations'),
    hasContents: !!p.querySelector('.print-contents'),
  })));

async function runPrint(fn) {
  await page.evaluate(f => { window.print = () => {}; window[f](); }, fn);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await settle(page, 200);
}
async function endPrint() {
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.emulateMedia({ media: 'screen' });
  await settle(page, 200);
}

console.log('Seating Chart Generator — whole-day sub packet');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);
await page.evaluate(f => localStorage.setItem('seating-chart-v1', JSON.stringify(f)), FIXTURE);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 500);

const seeded = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('seating-chart-v1'));
  return { sections: s.sections.length, printNames: s.printNames };
});
eq(seeded.sections, 2, 'the day has two sections');
eq(seeded.printNames, false, 'and the teacher has names switched off for normal prints');
ok(await page.$('button[onclick="printSubExportAll()"]'), 'the whole-day packet has a button of its own');

/* ── build the packet ──────────────────────────────────────────────────── */
await runPrint('printSubExportAll');
await page.emulateMedia({ media: 'print' });
const pages = await packetPages();

eq(pages.length, 3, 'a contents page plus one page per section');

/* ── 1. the contents page ──────────────────────────────────────────────── */
ok(pages[0].hasContents, 'the first page is the contents page');
ok(/whole day/i.test(pages[0].title), 'titled as the whole day: ' + JSON.stringify(pages[0].title));
ok(/Period 1 — Geology/.test(pages[0].text), 'it lists the first section');
ok(/Period 2 — Physics/.test(pages[0].text), 'and the second');
ok(/1 note/.test(pages[0].text), 'it flags which sections carry a note to read first');
ok(/rule conflict/.test(pages[0].text), 'and which carry a broken seating rule');
ok(/2 sections/.test(pages[0].meta), 'the header counts the sections: ' + JSON.stringify(pages[0].meta));
ok(/7 seated/.test(pages[0].meta), 'and the students across the whole day');

/* ── 2. every section gets its own page, in order ──────────────────────── */
eq(pages[1].title, 'Period 1 — Geology', "section pages follow the tool's own order");
eq(pages[2].title, 'Period 2 — Physics', 'including the second');

/* ── 3. names are forced on, against the teacher's saved preference ─────── */
ok(pages[1].names.includes('Ada Lovelace'), 'the packet prints names anyway — a sub cannot use a blank chart');
ok(pages[2].names.includes('Grace Hopper'), 'in every section');

/* ── 4. notes appear, and only where they belong ───────────────────────── */
ok(pages[1].hasNotes, 'the first section page carries its notes block');
ok(/Leaves at 9:40/.test(pages[1].text), 'with the note itself');
ok(/504 plan/.test(pages[2].text), 'and the second section carries its own');
ok(!/Leaves at 9:40/.test(pages[2].text), 'notes do not leak between sections');
ok(pages[1].hasViolations, 'a broken keep-apart rule is reported on the page it belongs to');
ok(!pages[2].hasViolations, 'and a section with no rules reports nothing');
ok(/For the substitute/.test(pages[1].text), 'each section page is flagged as the sub copy');

/* ── 5. "Print all sections" is unchanged — no notes, no cover ──────────── */
await endPrint();
await runPrint('printAllSections');
await page.emulateMedia({ media: 'print' });
const plain = await packetPages();
eq(plain.length, 2, 'the ordinary print-all is still one page per section, with no cover');
ok(!plain.some(p => p.hasNotes), 'and never prints student notes');
ok(!plain.some(p => /Leaves at 9:40/.test(p.text)), 'not even in passing');
eq(plain[0].names.length, 0, 'it still respects the names-off preference');
await endPrint();

/* ── 6. nothing is left behind on screen ───────────────────────────────── */
eq(await page.evaluate(() => document.getElementById('printAllWrap').innerHTML.trim().length), 0,
   'the packet is torn down after printing');
eq(await page.evaluate(() => document.body.classList.contains('printing-sub')), false,
   'and the sub-mode body class with it');
eq(await page.evaluate(() => document.body.classList.contains('printing-all')), false,
   'and the print-all one');

/* ── 7. one section is not a packet ────────────────────────────────────── */
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('seating-chart-v1'));
  s.sections = [s.sections[0]];
  s.active = s.sections[0].id;
  localStorage.setItem('seating-chart-v1', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
await runPrint('printSubExportAll');
await page.emulateMedia({ media: 'print' });
eq(await page.evaluate(() => document.querySelectorAll('#printAllWrap .print-page').length), 0,
   'with a single section it falls back to the plain one-page sub export');
ok(await page.evaluate(() => /For the substitute/.test(document.getElementById('printExtra').textContent)),
   'which still carries the sub flag and notes');
await endPrint();

/* ── 8. no console noise ───────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
