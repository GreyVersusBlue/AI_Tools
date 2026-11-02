// smoke-packet.mjs — 043's trip packet: parent letter, emergency contact sheet, name tags and
// day schedule (BACKLOG rank 143), each built from the trip's own details and chaperone groups.
//
//   node Tools/field-trip-permission-slip/test/smoke-packet.mjs      (port 8666)
//
// Held here:
//   - the letter says what the trip is, when, the times, cost, what to bring, the due date and
//     whom to ask, leaves out every line whose field is empty, and is one page
//   - the emergency sheet lists the trip leader and each chaperone with the number of students
//     in the group, four write-in lines, and holds nothing about a student's health or a parent
//   - a tag is first name and last initial only (a one-word name stays), the group's chaperone
//     and the trip leader's phone; eight to a page; no class list says so on a page with no tag
//   - a schedule line that starts with a time puts it in its own column; with no schedule the
//     sheet is the leave and return times; with neither it says what to do
//   - the schedule is saved with the trip and comes back after a reload
//   - a hostile name, destination, chaperone or schedule line is text, never an element
//   - each of the eight buttons builds its own sheet (print() is stubbed and counted)
//
// Made-up names only. Nothing here has been checked on paper. Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8666;
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

const NAMES = ['Aiden Smith', 'Bella Cruz', 'Carlos Diaz', 'Dara Evans', 'Eli Ford', 'Fay Gray', 'Gus Hill', 'Hana Ito', 'Madonna'];
const trip = over => Object.assign({
  name: 'Museum Trip', mode: 'batch', studentName: '', batchNames: NAMES.join('\n'), blankCount: 5, collected: {},
  chaperones: [{ name: 'Mr. Lee', phone: '555-0100' }, { name: 'Ms. Park', phone: '' }],
  chaperoneAssignments: { 'Aiden Smith': 'Mr. Lee', 'Bella Cruz': 'Mr. Lee', 'Carlos Diaz': 'Ms. Park' },
  schoolTeacher: 'East Middle', destination: 'City Museum', tripStartDate: '2026-10-20', tripEndDate: '',
  departureTime: '08:30', returnTime: '14:15', purpose: 'Tour the history wing.', cost: '$12', whatToBring: 'Lunch and a water bottle.',
  chaperoneName: 'Ms. Moore', chaperonePhone: '555-0123', emergencyInstructions: 'The school calls the numbers on file.', dueDate: '2026-10-15',
  schedule: '8:30 Leave school\n10:00 - Planetarium show\n12 pm: Lunch\nBoard the bus',
  secondLang: '', langLayout: 'facing', translations: { purpose: '', whatToBring: '', emergencyInstructions: '' },
}, over);

async function open(browser, state) {
  const page = await prepPage(browser, BASE, { width: 1100, height: 900 });
  await page.addInitScript(() => { window.__prints = 0; window.print = () => { window.__prints++; }; });
  await page.addInitScript(saved => {
    if (localStorage.getItem('gvb-field-trip:list')) return;     // a reload keeps what the page saved
    localStorage.setItem('gvb-field-trip:list', JSON.stringify(['Museum Trip']));
    localStorage.setItem('gvb-field-trip:current', 'Museum Trip');
    localStorage.setItem('gvb-field-trip:data:Museum Trip', saved);
  }, JSON.stringify(state));
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 300);
  return page;
}
const press = async (page, id) => { await page.click('#' + id); await settle(page, 100); };
const area = page => page.evaluate(() => {
  const a = document.getElementById('printArea');
  return { text: a.textContent.replace(/\s+/g, ' ').trim(), html: a.innerHTML, bad: a.querySelectorAll('script, img, [onerror]').length };
});

const server = await serve(PORT);
const browser = await launch();
try {
  const page = await open(browser, trip());
  try {
    console.log('1. the parent letter');
    await press(page, 'printLetterBtn');
    let s = await area(page);
    for (const part of ['Museum Trip', 'City Museum', 'October 20, 2026', '8:30 AM', '2:15 PM', 'The cost is $12.', 'Please send with your child: Lunch and a water bottle.',
      'return it by October 15, 2026', 'Tour the history wing.', 'The school calls the numbers on file.', 'contact Ms. Moore at 555-0123', 'East Middle'])
      ok(s.text.includes(part), `the letter says "${part}"`);
    eq(pdfPageCount(await page.pdf({ format: 'Letter', preferCSSPageSize: true, printBackground: true })), 1, 'the letter is one page');
    eq(await page.evaluate(() => window.__prints), 1, 'Print calls print() once');

    console.log('2. the emergency sheet');
    await press(page, 'printEmergencyBtn');
    s = await area(page);
    const rows = await page.$$eval('#printArea .em-print tbody tr', trs => trs.map(r => [...r.cells].map(c => c.textContent.trim()).join('|')));
    ok(rows.includes('Ms. Moore (trip leader)|555-0123|'), 'the trip leader is a row with the phone');
    ok(rows.includes('Mr. Lee|555-0100|2'), 'a chaperone row has the phone and a true student count');
    ok(rows.includes('Ms. Park||1'), 'a chaperone with no phone and one student');
    for (const l of ['School office', 'Venue contact', 'Bus company / driver', 'Nearest hospital or urgent care']) ok(rows.some(r => r.startsWith(l + '|')), `a write-in line for "${l}"`);
    ok(s.text.includes('The school calls the numbers on file.'), 'the emergency instructions are on it');
    ok(!/\b(allerg|medic|diagnos|asthma|epipen|dietary)/i.test(s.text), 'nothing on it is about a student\'s health');
    ok(!/Aiden|Bella|Carlos/.test(s.text), 'and no student is named');
    eq(pdfPageCount(await page.pdf({ format: 'Letter', preferCSSPageSize: true, printBackground: true })), 1, 'the sheet is one page');

    console.log('3. name tags');
    await press(page, 'printTagsBtn');
    const tags = await page.$$eval('#printArea .trip-tag', els => els.map(e => [...e.children].map(c => c.textContent).join(' / ')));
    eq(tags.length, 9, 'a tag for each student');
    eq(tags[0], 'Aiden S. / Museum Trip / Group: Mr. Lee / Trip leader: Ms. Moore 555-0123', 'first name and last initial, trip, group and the leader');
    eq(tags[3], 'Dara E. / Museum Trip / Trip leader: Ms. Moore 555-0123', 'an unassigned student has no group line');
    eq(tags[8].split(' / ')[0], 'Madonna', 'a one-word name stays as typed');
    ok(!(await area(page)).text.includes('Smith'), 'no full surname is printed');
    eq(pdfPageCount(await page.pdf({ format: 'Letter', preferCSSPageSize: true, printBackground: true })), 2, 'nine tags are two pages (eight to a page)');
    eq(await page.locator('#printArea .em-print').count(), 0, 'the tags replace the emergency sheet');

    console.log('4. the day schedule');
    await press(page, 'printScheduleBtn');
    const sched = await page.$$eval('#printArea .sched-print tbody tr', trs => trs.map(r => [...r.cells].map(c => c.textContent).join('|')));
    eq(sched.join(' ; '), '8:30|Leave school ; 10:00|Planetarium show ; 12 pm|Lunch ; |Board the bus', 'a leading time is its own column; "10:00 - ", "12 pm: " and a plain line are read');
    await page.fill('#schedule', '');
    await press(page, 'printScheduleBtn');
    eq((await page.$$eval('#printArea .sched-print tbody tr', trs => trs.map(r => [...r.cells].map(c => c.textContent).join('|')))).join(' ; '),
      '8:30 AM|Leave school ; 2:15 PM|Back at school', 'with no schedule it is the leave and return times');
    await page.fill('#schedule', '9:15 Show\nLunch');
    await settle(page, 100);
    await page.reload({ waitUntil: 'load' });
    await settle(page, 300);
    eq(await page.inputValue('#schedule'), '9:15 Show\nLunch', 'the schedule is saved with the trip and comes back after a reload');
  } finally { await page.context().close(); }

  console.log('5. the empty cases');
  const bare = await open(browser, trip({ name: 'Bare', chaperoneName: '', chaperonePhone: '', purpose: '', cost: '', whatToBring: '', emergencyInstructions: '',
    dueDate: '', departureTime: '', returnTime: '', schedule: '', batchNames: '', chaperones: [], chaperoneAssignments: {}, destination: '', tripStartDate: '' }));
  try {
    await press(bare, 'printLetterBtn');
    const s = await area(bare);
    ok(!/cost|Please send|leave school|contact|questions|permission slip comes/i.test(s.text.replace('A permission slip comes with this letter. Please sign it and return it.', '')), 'a letter with nothing filled in skips the cost, the list, the times and the contact');
    ok(/Dear families/.test(s.text), 'and still reads as a letter');
    await press(bare, 'printScheduleBtn');
    ok(/No schedule yet/.test((await area(bare)).text), 'a schedule with nothing says what to do');
    await press(bare, 'printEmergencyBtn');
    ok(/No trip leader or chaperones added yet/.test((await area(bare)).text), 'an emergency sheet with no adults says so');
    await press(bare, 'printTagsBtn');
    const none = await area(bare);
    ok(/add the class list/.test(none.text), 'name tags with no class list say to add one');
    eq(await bare.locator('#printArea .trip-tag').count(), 0, 'and print no tag');
    eq(await bare.evaluate(() => window.__prints), 4, 'print() was called for the four sheets');
  } finally { await bare.context().close(); }

  console.log('6. hostile text');
  const evil = '<img src=x onerror=alert(1)>';
  const hostile = await open(browser, trip({ name: evil, destination: evil, schoolTeacher: evil, chaperoneName: evil, purpose: evil, cost: evil,
    batchNames: evil + '\nBella Cruz', chaperones: [{ name: '<script>1</script>', phone: '"><b>' }], chaperoneAssignments: { [evil]: '<script>1</script>' }, schedule: evil + '\n9:00 ' + evil }));
  try {
    for (const id of ['printLetterBtn', 'printEmergencyBtn', 'printScheduleBtn', 'printTagsBtn']) {
      await press(hostile, id);
      const s = await area(hostile);
      eq(s.bad, 0, `${id}: nothing hostile becomes an element`);
    }
    ok((await area(hostile)).text.includes('Trip leader: ' + evil), 'and the tag shows it as typed');
  } finally { await hostile.context().close(); }

  console.log('7. each button builds its own sheet');
  const all = await open(browser, trip());
  try {
    const want = { LetterBtn: '.letter-print', EmergencyBtn: '.em-print', ScheduleBtn: '.sched-print', TagsBtn: '.trip-tag' };
    for (const [b, sel] of Object.entries(want)) {
      await press(all, 'preview' + b);
      ok(await all.locator('dialog.pk-preview[data-pk-pages]').first().isVisible().catch(() => false), `Preview ${b} opens the preview`);
      ok(await all.locator('#printArea ' + sel).count() > 0, `and builds ${sel}`);
      await all.keyboard.press('Escape');
      await all.locator('dialog.pk-preview').waitFor({ state: 'hidden' }).catch(() => {});
      await settle(all, 100);
    }
  } finally { await all.context().close(); }
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
