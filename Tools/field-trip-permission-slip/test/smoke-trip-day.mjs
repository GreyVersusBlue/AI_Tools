// smoke-trip-day.mjs — 043's trip-day view (BACKLOG rank 143): a read-only, large-type page state
// for the day of the trip, on a phone or on the board through Stage.
//
//   node Tools/field-trip-permission-slip/test/smoke-trip-day.mjs      (port 8687)
//
// Held here:
//   - the view shows the trip, the day schedule (a leading time in its own column; the leave and
//     return times when there is none), every chaperone's group and the unassigned students, each
//     student as first name and last initial only, a "no slip" mark from the collection tracker,
//     and the trip leader's and chaperones' numbers as tel: links (a chaperone with none says so)
//   - the three tick boxes a student (left school, arrived, back) count per group, survive closing
//     and opening the view, and are gone after a reload: nothing is written to localStorage or
//     sessionStorage, and the trip's stored record is byte-for-byte what it was
//   - at 360 px nothing scrolls sideways and the names are at least 16 px; a tick box's target is
//     at least 44 px tall
//   - Full screen puts the view on stage (Stage.mount) and takes it off again; Close hides it and
//     gives focus back to the button that opened it; Escape closes it
//   - a hostile student or chaperone name is text, never an element
//   - an empty trip says what to add instead of showing nothing
//   - axe finds nothing serious with the view open, and print media hides it (print-area.css,
//     which takes everything but #printArea off the page)
//   - each mutant below (the page's own text rewritten on the way in) makes its scenario fail
//
// Made-up names only. Not tried on a real phone or projector. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, prepPage, settle, a11yScan, SITE } from '../../board-check/harness.mjs';

const PORT = 8687;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '043-field-trip-permission-slip.html';
const SRC = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');

let passed = 0, failed = 0;
const fails = [];
const errors = [];

const NAMES = ['Aiden Smith', 'Bella Cruz', 'Carlos Diaz', 'Dara Evans', 'Madonna'];
const trip = over => Object.assign({
  name: 'Museum Trip', mode: 'batch', studentName: '', batchNames: NAMES.join('\n'), blankCount: 5,
  collected: { 'Aiden Smith': { returned: true, payment: 'paid' }, 'Bella Cruz': { returned: true, payment: '' } },
  chaperones: [{ name: 'Mr. Lee', phone: '(555) 555-0100' }, { name: 'Ms. Park', phone: '' }],
  chaperoneAssignments: { 'Aiden Smith': 'Mr. Lee', 'Bella Cruz': 'Mr. Lee', 'Carlos Diaz': 'Ms. Park' },
  schoolTeacher: 'East Middle', destination: 'City Museum', tripStartDate: '2026-10-20', tripEndDate: '',
  departureTime: '08:30', returnTime: '14:15', purpose: 'Tour the history wing.', cost: '$12', whatToBring: 'Lunch.',
  chaperoneName: 'Ms. Moore', chaperonePhone: '555-0123', emergencyInstructions: 'Call the office first.', dueDate: '2026-10-15',
  schedule: '8:30 Leave school\n10:00 - Planetarium show\nBoard the bus',
  secondLang: '', langLayout: 'facing', translations: { purpose: '', whatToBring: '', emergencyInstructions: '' },
}, over);

const server = await serve(PORT);
const browser = await launch();

async function newPage(state, { mutation, width = 360, height = 740 } = {}) {
  const page = await prepPage(browser, BASE, { width, height });
  page.on('pageerror', e => errors.push(String(e)));
  if (mutation) {
    const body = SRC.replace(mutation[0], () => mutation[1]);
    await page.route('**/Tools/' + FILE, route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }));
  }
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
const openView = async page => { await page.click('#tripDayBtn'); await settle(page, 150); };
const view = page => page.evaluate(() => {
  const v = document.getElementById('tripDay');
  const groups = Array.from(v.querySelectorAll('.td-group')).map(g => ({
    head: g.querySelector('h4').textContent,
    counts: g.querySelector('.td-counts').textContent,
    names: Array.from(g.querySelectorAll('.td-name')).map(n => n.firstChild.textContent),
    out: Array.from(g.querySelectorAll('.td-name')).filter(n => n.querySelector('.td-out')).map(n => n.firstChild.textContent),
  }));
  return {
    hidden: v.hidden,
    text: v.textContent.replace(/\s+/g, ' ').trim(),
    sched: Array.from(v.querySelectorAll('.td-sched li')).map(li => Array.from(li.children).map(c => c.textContent)),
    tels: Array.from(v.querySelectorAll('.td-phones a')).map(a => a.getAttribute('href')),
    groups,
    bad: v.querySelectorAll('img, script, [onerror]').length,
  };
});
const storage = page => page.evaluate(() => {
  const o = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o['L:' + k] = localStorage.getItem(k); }
  for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); o['S:' + k] = sessionStorage.getItem(k); }
  return JSON.stringify(o, Object.keys(o).sort());
});
const tick = (page, student, col) => page.evaluate(([s, c]) => {
  const box = Array.from(document.querySelectorAll('#tripDay .td-row input')).find(b => b.getAttribute('aria-label') === s + ': ' + c);
  box.click();
}, [student, col]);
const ticked = (page, student, col) => page.evaluate(([s, c]) => {
  const box = Array.from(document.querySelectorAll('#tripDay .td-row input')).find(b => b.getAttribute('aria-label') === s + ': ' + c);
  return box ? box.checked : null;
}, [student, col]);

const SCENARIOS = {
  async contents(page) {
    const out = [];
    await openView(page);
    const v = await view(page);
    out.push(['the view opens', !v.hidden]);
    out.push(['it names the trip, the place and the day', ['Museum Trip', 'City Museum', 'October 20, 2026', 'leave 8:30 AM', 'back 2:15 PM'].every(t => v.text.includes(t))]);
    out.push(['the schedule has a time column: ' + JSON.stringify(v.sched),
      JSON.stringify(v.sched) === JSON.stringify([['8:30', 'Leave school'], ['10:00', 'Planetarium show'], ['', 'Board the bus']])]);
    out.push(['the groups are Mr. Lee, Ms. Park and the unassigned: ' + JSON.stringify(v.groups.map(g => g.head)),
      JSON.stringify(v.groups.map(g => g.head)) === JSON.stringify(['Mr. Lee', 'Ms. Park', 'No chaperone yet'])]);
    out.push(['students are first name and last initial: ' + JSON.stringify(v.groups.map(g => g.names)),
      JSON.stringify(v.groups.map(g => g.names)) === JSON.stringify([['Aiden S.', 'Bella C.'], ['Carlos D.'], ['Dara E.', 'Madonna']])]);
    out.push(['no surname is on the screen', !['Smith', 'Cruz', 'Diaz', 'Evans'].some(t => v.text.includes(t))]);
    out.push(['an outstanding slip is marked: ' + JSON.stringify(v.groups.map(g => g.out)),
      JSON.stringify(v.groups.map(g => g.out)) === JSON.stringify([[], ['Carlos D.'], ['Dara E.', 'Madonna']])]);
    out.push(['the leader and Mr. Lee are tel: links: ' + JSON.stringify(v.tels), JSON.stringify(v.tels) === JSON.stringify(['tel:5550123', 'tel:5555550100'])]);
    out.push(['a chaperone with no number says so', /Ms\. Park\s*no number/.test(v.text)]);
    out.push(['the emergency instructions are there', v.text.includes('Call the office first.')]);
    out.push(['counts start at nothing ticked', v.groups[0].counts === 'Left school 0 of 2 · Arrived 0 of 2 · Back 0 of 2']);
    const lay = await page.evaluate(() => {
      const v = document.getElementById('tripDay');
      const name = v.querySelector('.td-name');
      const lab = v.querySelector('.td-row label');
      return { sw: v.scrollWidth, cw: v.clientWidth, font: parseFloat(getComputedStyle(name).fontSize), target: lab.getBoundingClientRect().height };
    });
    out.push([`nothing scrolls sideways at 360 px (${lay.sw} > ${lay.cw})`, lay.sw <= lay.cw]);
    out.push([`names are large (${lay.font}px)`, lay.font >= 16]);
    out.push([`a tick box is a 44 px target (${lay.target})`, lay.target >= 44]);
    return out;
  },

  async ticks(page) {
    const out = [];
    const before = await storage(page);
    await openView(page);
    await tick(page, 'Aiden S.', 'Left school');
    await tick(page, 'Bella C.', 'Left school');
    await tick(page, 'Carlos D.', 'Arrived');
    let v = await view(page);
    out.push(['ticks count in their group: ' + v.groups[0].counts, v.groups[0].counts === 'Left school 2 of 2 · Arrived 0 of 2 · Back 0 of 2']);
    out.push(['and only in their group: ' + v.groups[1].counts, v.groups[1].counts === 'Left school 0 of 1 · Arrived 1 of 1 · Back 0 of 1']);
    await page.click('#tdCloseBtn'); await settle(page, 100);
    await openView(page);
    out.push(['a tick survives closing the view', await ticked(page, 'Aiden S.', 'Left school') === true]);
    out.push(['and so does a count', (await view(page)).groups[0].counts.startsWith('Left school 2 of 2')]);
    out.push(['nothing was written to storage', await storage(page) === before]);
    await page.reload({ waitUntil: 'load' }); await settle(page, 300);
    await openView(page);
    out.push(['a reload clears the ticks', await ticked(page, 'Aiden S.', 'Left school') === false]);
    out.push(['storage is still what it was after the reload', await storage(page) === before]);
    return out;
  },

  async stage(page) {
    const out = [];
    await openView(page);
    out.push(['Close has focus when the view opens', await page.evaluate(() => document.activeElement.id) === 'tdCloseBtn']);
    await page.click('#tdStageBtn'); await settle(page, 300);
    out.push(['Full screen puts the view on stage', await page.evaluate(() => document.getElementById('tripDay').classList.contains('is-fullscreen'))]);
    out.push(['the button says how to leave', (await page.textContent('#tdStageBtn')).trim() === 'Exit full screen']);
    await page.click('#tdStageBtn'); await settle(page, 300);
    out.push(['and takes it off again, the view still open', await page.evaluate(() => {
      const v = document.getElementById('tripDay'); return !v.classList.contains('is-fullscreen') && !v.hidden;
    })]);
    await page.click('#tdCloseBtn'); await settle(page, 100);
    out.push(['Close hides the view', await page.evaluate(() => document.getElementById('tripDay').hidden)]);
    out.push(['and focus goes back to the button', await page.evaluate(() => document.activeElement.id) === 'tripDayBtn']);
    await openView(page);
    await page.keyboard.press('Escape'); await settle(page, 100);
    out.push(['Escape closes the view', await page.evaluate(() => document.getElementById('tripDay').hidden)]);
    await openView(page);
    await page.emulateMedia({ media: 'print' });
    out.push(['print media hides the view', await page.evaluate(() => getComputedStyle(document.getElementById('tripDay')).display) === 'none']);
    await page.emulateMedia({ media: 'screen' });
    return out;
  },

  async hostile(page) {
    const out = [];
    await page.evaluate(() => { window.__x = 0; });
    await openView(page);
    const v = await view(page);
    out.push(['a hostile name is no element', v.bad === 0]);
    out.push(['and ran nothing', await page.evaluate(() => window.__x) === 0]);
    out.push(['the hostile chaperone is shown as text', v.text.includes('<img src=x onerror=window.__x=1>')]);
    return out;
  },

  async empty(page) {
    const out = [];
    await openView(page);
    const v = await view(page);
    out.push(['an empty trip asks for a schedule', v.text.includes('No schedule yet')]);
    out.push(['and for adults', v.text.includes('No trip leader or chaperones added yet.')]);
    out.push(['and for students', v.text.includes('No students yet')]);
    return out;
  },
};

const STATES = {
  contents: trip(), ticks: trip(), stage: trip(),
  hostile: trip({
    batchNames: 'Ana <b>Bold</b>\nAiden Smith',
    chaperones: [{ name: '<img src=x onerror=window.__x=1>', phone: '555' }],
    chaperoneAssignments: { 'Aiden Smith': '<img src=x onerror=window.__x=1>' },
  }),
  empty: trip({ batchNames: '', chaperones: [], chaperoneAssignments: {}, chaperoneName: '', chaperonePhone: '', schedule: '', departureTime: '', returnTime: '', emergencyInstructions: '' }),
};

const MUTANTS = [
  ['contents', "var nm = tdEl('div', 'td-name', tagName(s));", "var nm = tdEl('div', 'td-name', s);"],
  ['contents', "      a.href = 'tel:' + tdTel(phone);\n", ''],
  ['contents', "    if (cg.unassigned.length) groups.appendChild(tdGroup('No chaperone yet', '', cg.unassigned));\n", ''],
  ['contents', "if (!collectedRecord(s).returned) nm.appendChild", "if (false) nm.appendChild"],
  ['contents', 'grid-template-columns: 1fr repeat(3, 3.2rem);', 'grid-template-columns: 1fr repeat(3, 9rem);'],
  ['contents', '.trip-day .td-row label { display: flex; justify-content: center; align-items: center; min-height: 44px;', '.trip-day .td-row label { display: flex; justify-content: center; align-items: center;'],
  ['ticks', "          counts.textContent = tdCountsText(students);\n", ''],
  ['ticks', '    renderTripDay();\n    tripDayEl.hidden = false;', '    tripDayTicks = {};\n    renderTripDay();\n    tripDayEl.hidden = false;'],
  ['ticks', '          tdTicksFor(s)[p[0]] = cb.checked;', "          tdTicksFor(s)[p[0]] = cb.checked; localStorage.setItem('gvb-field-trip:ticks', JSON.stringify(tripDayTicks));"],
  ['stage', '    if (tdReturnFocus && tdReturnFocus.focus) tdReturnFocus.focus();', ''],
  ['stage', "  var tripDayStage = window.Stage ? Stage.mount(", "  var tripDayStage = false ? Stage.mount("],
  ['hostile', "    box.appendChild(tdEl('h4', '', heading));", "    var h4 = tdEl('h4'); h4.innerHTML = heading; box.appendChild(h4);"],
  ['empty', "      body.appendChild(tdEl('p', 'td-note', 'No schedule yet: type one stop to a line in the Trip packet card.'));", ''],
];

const record = (label, good) => {
  if (good) { passed++; return; }
  failed++; fails.push(label); console.log('  FAIL ' + label);
};

try {
  console.log('Field Trip Permission Slip — trip-day view');
  for (const [name, fn] of Object.entries(SCENARIOS)) {
    console.log('- ' + name);
    const page = await newPage(STATES[name]);
    let res;
    try { res = await fn(page); } catch (e) { res = [['ran without throwing: ' + e.message.split('\n')[0], false]]; }
    for (const [label, good] of res) record(name + ': ' + label, good);
    await page.context().close();
  }

  console.log('- axe with the view open, light and dark');
  for (const theme of ['light', 'dark']) {
    const page = await newPage(STATES.contents, { width: 1100, height: 900 });
    if (theme === 'dark') { await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await settle(page, 100); }
    await openView(page);
    const v = await a11yScan(page, { include: '#tripDay' });
    record(`axe (${theme}): ${JSON.stringify(v.map(x => x.id))}`, v.length === 0);
    await page.context().close();
  }

  console.log('- mutants');
  for (const [name, find, repl] of MUTANTS) {
    const count = SRC.split(find).length - 1;
    if (count !== 1) { record(`mutant text for ${name} occurs ${count} times: ${find.slice(0, 60)}`, false); continue; }
    const page = await newPage(STATES[name], { mutation: [find, repl] });
    let res;
    try { res = await SCENARIOS[name](page); } catch (e) { res = [['threw', false]]; }
    record(`${name} does not notice: ${find.trim().slice(0, 70)}`, res.some(([, good]) => !good));
    await page.context().close();
  }
} finally {
  await browser.close();
  server.close();
}

const real = errors.filter(e => !/onerror|__x/.test(e));
record('no page errors: ' + real.slice(0, 3).join(' | '), real.length === 0);
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
