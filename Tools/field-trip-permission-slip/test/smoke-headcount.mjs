// smoke-headcount.mjs — 043's trip-day headcount checklist.
//
//   node Tools/field-trip-permission-slip/test/smoke-headcount.mjs
//
// The chaperone groups again, one page per group, a row per student with a box
// for leaving school, arriving and coming back, a "Slip" column read from the
// collection tracker, and a line for the count. Held here:
//
//   - one page per chaperone who has students, plus one for anyone with no
//     chaperone; a chaperone with nobody has no page
//   - every student is on exactly one page, and the page's student count is true
//   - the slip column says Yes only for a student whose slip is marked returned
//   - three tick boxes per student, and nothing on the sheet that is a point or a grade
//   - a hostile name, destination or chaperone is text, never markup
//   - the page count in Chromium's PDF is one per group (no blank last page)
//
// print() is stubbed. Made-up names only. Nothing here has been checked on paper.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8663;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '043-field-trip-permission-slip.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const pdfPageCount = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

const NAMES = ['Aiden Smith', 'Bella Cruz', 'Carlos Diaz', 'Dara Evans', 'Eli Ford'];
const trip = over => Object.assign({
  name: 'Museum Trip', mode: 'batch', studentName: '', batchNames: NAMES.join('\n'), blankCount: 5,
  collected: { 'Aiden Smith': { returned: true, payment: 'paid' }, 'Dara Evans': { returned: true, payment: 'paid' } },
  chaperones: [{ name: 'Mr. Lee', phone: '555-0100' }, { name: 'Ms. Park', phone: '' }, { name: 'Mx. Idle', phone: '555-0199' }],
  chaperoneAssignments: { 'Aiden Smith': 'Mr. Lee', 'Bella Cruz': 'Mr. Lee', 'Carlos Diaz': 'Ms. Park' },
  schoolTeacher: 'East Middle', destination: 'City Museum', tripStartDate: '2026-10-20', tripEndDate: '',
  departureTime: '08:30', returnTime: '14:15', purpose: 'Tour.', cost: '', whatToBring: 'Lunch.',
  chaperoneName: '', chaperonePhone: '', emergencyInstructions: '', dueDate: '2026-10-15',
  secondLang: '', langLayout: 'facing', translations: { purpose: '', whatToBring: '', emergencyInstructions: '' },
}, over);

async function open(browser, state) {
  const page = await prepPage(browser, BASE, { width: 1100, height: 900 });
  await page.addInitScript(() => { window.print = () => {}; });
  await page.addInitScript(saved => {
    localStorage.setItem('gvb-field-trip:list', JSON.stringify(['Museum Trip']));
    localStorage.setItem('gvb-field-trip:current', 'Museum Trip');
    localStorage.setItem('gvb-field-trip:data:Museum Trip', saved);
  }, JSON.stringify(state));
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 300);
  return page;
}

const sheet = page => page.evaluate(() => {
  const area = document.getElementById('printArea');
  const groups = [...area.querySelectorAll('.hc-group')].map(g => ({
    who: g.querySelector('.hc-who').textContent,
    rows: [...g.querySelectorAll('tbody tr:not(.hc-count)')].map(r => ({
      name: r.cells[0].textContent, slip: r.cells[1].textContent, out: r.cells[1].classList.contains('hc-out'),
      boxes: r.querySelectorAll('td.hc-box').length,
    })),
    heads: [...g.querySelectorAll('thead th')].map(x => x.textContent).join('|'),
    countRow: !!g.querySelector('tr.hc-count'),
  }));
  return { groups, text: area.textContent, scripts: area.querySelectorAll('script, img, [onerror]').length,
    header: [...area.querySelectorAll('.pk-header > span')].map(x => x.textContent) };
});

const server = await serve(PORT);
const browser = await launch();
try {
  const page = await open(browser, trip());
  try {
    await page.click('#printHeadcountBtn');
    await settle(page, 100);
    const s = await sheet(page);
    eq(s.groups.length, 3, 'a page for each chaperone with students (Mr. Lee, Ms. Park) and one for the unassigned; Mx. Idle has none');
    eq(s.groups.map(g => g.who.split(' · ')[0]).join('|'), 'Mr. Lee|Ms. Park|No chaperone yet', 'in the order the chaperones were added, unassigned last');
    eq(s.groups[0].who, 'Mr. Lee · 555-0100 · 2 students', 'the chaperone line has the phone and a true count');
    eq(s.groups[1].who, 'Ms. Park · 1 student', 'a group of one says student, and no phone leaves no dot');
    const all = s.groups.flatMap(g => g.rows.map(r => r.name)).sort();
    eq(all.join(), [...NAMES].sort().join(), 'every student is on exactly one page');
    eq(s.groups.every(g => g.rows.every(r => r.boxes === 3)), true, 'three tick boxes in each row');
    eq(s.groups[0].heads, 'Student|Slip|Left school|Arrived|Back', 'the columns');
    eq(s.groups.every(g => g.countRow), true, 'a count line on every page');
    const byName = Object.fromEntries(s.groups.flatMap(g => g.rows).map(r => [r.name, r]));
    eq(byName['Aiden Smith'].slip, 'Yes', 'a returned slip says Yes');
    eq(byName['Bella Cruz'].slip + byName['Bella Cruz'].out, 'Notrue', 'a slip still out says No and is marked');
    eq(byName['Dara Evans'].slip, 'Yes', 'the unassigned page reads the tracker too');
    ok(!/\b(points?|score|grade)\b/i.test(s.text), 'nothing on the sheet is a point or a grade');
    eq(s.header.join('|'), 'City Museum|East Middle|October 20, 2026', "the kit's header: where, whose class, when");
    const pdf = await page.pdf({ format: 'Letter', printBackground: true, preferCSSPageSize: true });
    eq(pdfPageCount(pdf), 3, "Chromium's PDF is one page per group, no blank last page");
  } finally { await page.context().close(); }

  const evil = '<img src=x onerror=alert(1)>';
  const hostile = await open(browser, trip({
    destination: evil, name: 'Museum Trip', batchNames: evil + '\nBella Cruz',
    chaperones: [{ name: '<script>1</script>', phone: '"><b>' }], chaperoneAssignments: { [evil]: '<script>1</script>' },
  }));
  try {
    await hostile.click('#printHeadcountBtn');
    await settle(hostile, 100);
    const s = await sheet(hostile);
    eq(s.scripts, 0, 'a hostile name, destination, chaperone and phone is text, never an element');
    ok(s.text.includes(evil), 'and the text is there as typed');
  } finally { await hostile.context().close(); }

  const none = await open(browser, trip({ batchNames: '', collected: {}, chaperoneAssignments: {} }));
  try {
    await none.click('#printHeadcountBtn');
    await settle(none, 100);
    const s = await sheet(none);
    eq(s.groups.length, 0, 'no students: no page of empty tables');
    ok(/No students yet/.test(s.text), 'and the sheet says why');
  } finally { await none.context().close(); }

  const only = await open(browser, trip({ chaperones: [], chaperoneAssignments: {} }));
  try {
    await only.click('#printHeadcountBtn');
    await settle(only, 100);
    const s = await sheet(only);
    eq(s.groups.length, 1, 'no chaperones: one page for everyone');
    eq(s.groups[0].rows.length, 5, 'with all five students on it');
    await only.click('#printChaperoneBtn');
    await settle(only, 100);
    eq(await only.locator('#printArea .hc-group').count(), 0, 'the chaperone sheet replaces the checklist, it does not add to it');
  } finally { await only.context().close(); }
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
