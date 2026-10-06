// smoke-roster-sheets.mjs — 070 prints one named half sheet per student from a saved roster.
//
//   node Tools/peer-feedback-checklist-generator/test/smoke-roster-sheets.mjs
//
// BACKLOG rank 107. The checklist used to print only blanks, to write a name on
// by hand. "Print one per student" reads a class from the shared roster
// (`Roster.listRosters`, `getRoster`, `mountRosterPicker`; np_rosters, read-only) when the
// button is pressed and prints the author's name on each half sheet.
//
// What this pins:
//   - with no roster saved the page says so, the class button is off and "Print checklists" still prints blanks
//   - one sheet per student, two to a page, the cut line under the upper one of each pair
//   - the ORDER: cut the pile along the line and put the lower stack under the upper
//     one and the students are in roster order (classes of 1, 2, 3, 7, 8, 40)
//   - the optional reviewer: the next name on the list, the last reviewing the first,
//     nobody to review a class of one
//   - Chromium's PDF has ceil(n / 2) pages for each class
//   - names are read at print time: change the roster after load and the next print has the new one
//   - nothing of a name is saved by this tool: its own key is byte for byte what it was, and no new key appears
//   - a name is text, never markup; two students with the same name each get a sheet
//   - an old saved checklist loads and prints blanks as before
//
// print() is stubbed. Nothing here has been checked against a printer. Every name is made up.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8497;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '070-peer-feedback-checklist-generator.html';
const KEY = 'pfc_checklist_v1';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const pdfPageCount = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

const klass = n => Array.from({ length: n }, (_, i) => `Student ${String(i + 1).padStart(2, '0')} Testname`);
const checklist = { assignmentName: 'Draft 1', copyCount: 3, ratingStyle: 'check',
  categories: [{ id: 'c1', name: 'Ideas', items: [{ id: 'i1', text: 'A clear claim' }, { id: 'i2', text: 'Some evidence' }] }] };

async function open(browser, { rosters, state } = {}) {
  const page = await prepPage(browser, BASE, { width: 1100, height: 900 });
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
  await page.addInitScript(([key, saved, ros]) => {
    if (saved) localStorage.setItem(key, saved);
    if (ros) localStorage.setItem('np_rosters', ros);
  }, [KEY, JSON.stringify(state || checklist), rosters ? JSON.stringify(rosters) : null]);
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 300);
  return page;
}

const sheets = page => page.evaluate(() => [...document.getElementById('printArea').children].map(s => ({
  author: (s.querySelector('.names').textContent.match(/^Author: (.*?)   Reviewer: /) || [])[1],
  reviewer: (s.querySelector('.names').textContent.match(/   Reviewer: (.*)$/) || [])[1],
  cut: s.classList.contains('pk-cut'),
  blank: s.classList.contains('pk-sheet-blank'),
  title: s.querySelector('h3').textContent,
})));
const isRule = t => /^_+$/.test(t || '');

// The pile after cutting along the line and putting the lower stack under the upper one.
const stacked = list => [...list.filter((_, i) => i % 2 === 0), ...list.filter((_, i) => i % 2 === 1)];

console.log('070 — one named half sheet per student, from a saved roster');

const server = await serve(PORT);
const browser = await launch();

try {
  // ---- no roster saved ------------------------------------------------------
  {
    const page = await open(browser);
    eq(await page.evaluate(() => document.getElementById('rosterSelect').options[0].textContent), 'No saved rosters yet', 'no roster: the picker says none is saved');
    ok(/No class roster is saved on this device/.test(await page.textContent('#rosterNote')), 'no roster: the note says so');
    ok(/still prints blank/.test(await page.textContent('#rosterNote')), 'no roster: the note says blanks still print');
    eq(await page.isDisabled('#printClassBtn'), true, 'no roster: the class button is off');
    eq(await page.getAttribute('#rosterNote', 'aria-live'), 'polite', 'no roster: the note is a live region');
    eq(await page.evaluate(() => (document.querySelector('label[for=rosterSelect]') || {}).textContent), 'Class roster', 'the picker has a label');
    await page.click('#printBtn');
    const s = await sheets(page);
    eq(s.length, 3, 'no roster: Print checklists still prints the three blank copies');
    ok(s.every(x => x.blank && isRule(x.author) && isRule(x.reviewer)), 'no roster: each blank sheet has author and reviewer rules');
    eq(s.map(x => x.cut), [true, false, true], 'no roster: blank sheets keep their cut lines');
    eq(await page.evaluate(() => window.__printCalls), 1, 'no roster: blanks called print() once');
    await page.context().close();
  }

  // ---- a class of each size -------------------------------------------------
  for (const n of [1, 2, 3, 7, 8, 40]) {
    const names = klass(n);
    const page = await open(browser, { rosters: { 'Period 1': names } });
    const what = `class of ${n}`;
    eq(await page.isDisabled('#printClassBtn'), true, `${what}: off until a class is chosen`);
    ok(/Choose a class/.test(await page.textContent('#rosterNote')), `${what}: the note asks for a class`);
    await page.selectOption('#rosterSelect', 'Period 1');
    eq(await page.isDisabled('#printClassBtn'), false, `${what}: on once a class is chosen`);
    eq((await page.textContent('#rosterNote')).trim(), `${n} ${n === 1 ? 'student' : 'students'} — ${Math.ceil(n / 2)} ${Math.ceil(n / 2) === 1 ? 'page' : 'pages'}.`, `${what}: the note counts students and pages`);
    await page.click('#printClassBtn');
    const s = await sheets(page);
    eq(await page.evaluate(() => window.__printCalls), 1, `${what}: it called print()`);
    eq(s.length, n, `${what}: one sheet per student`);
    ok(s.every(x => !x.blank), `${what}: no sheet is a blank`);
    eq(s.map(x => x.author), s.map(x => x.author).filter(Boolean), `${what}: every sheet has a name`);
    eq(stacked(s.map(x => x.author)), names, `${what}: cut and stacked, the sheets are in roster order`);
    eq([...new Set(s.map(x => x.author))].length, n, `${what}: nobody is printed twice`);
    eq(s.map(x => x.cut).join(), s.map((_, i) => i % 2 === 0).join(), `${what}: the cut line is under the upper sheet of each pair`);
    ok(s.every(x => isRule(x.reviewer)), `${what}: with the option off the reviewer is a rule to write on`);
    eq(s[0].title, 'Draft 1', `${what}: the title is the assignment`);
    if (n === 1) {
      await page.fill('#assignmentName', '');
      await page.click('#printClassBtn');
      eq((await sheets(page))[0].title, 'Peer Feedback Checklist', `${what}: with no assignment title the sheet has the default one`);
    }
    if (n === 1 || n === 7 || n === 40) {
      const pdf = pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false }));
      eq(pdf, Math.ceil(n / 2), `${what}: Chromium prints ${Math.ceil(n / 2)} page(s)`);
    }
    if (n === 3) eq(s.map(x => x.author), [names[0], names[2], names[1]], 'class of 3: page 1 is 1 over 3, page 2 is 2 alone');
    await page.context().close();
  }

  // ---- the reviewer ---------------------------------------------------------
  for (const n of [1, 2, 5]) {
    const names = klass(n);
    const page = await open(browser, { rosters: { A: names } });
    await page.selectOption('#rosterSelect', 'A');
    await page.check('#withReviewer');
    await page.click('#printClassBtn');
    const s = await sheets(page);
    const byAuthor = new Map(s.map(x => [x.author, x.reviewer]));
    if (n === 1) ok(isRule(byAuthor.get(names[0])), 'class of 1: nobody to review, so the reviewer is a rule');
    else names.forEach((name, i) => eq(byAuthor.get(name), names[(i + 1) % n], `class of ${n}: ${name} is reviewed by the next name, cyclically`));
    ok(s.every(x => x.reviewer !== x.author || n === 1), `class of ${n}: nobody reviews themselves`);
    eq(stacked(s.map(x => x.author)), names, `class of ${n}: still in roster order once cut`);
    await page.uncheck('#withReviewer');
    await page.click('#printClassBtn');
    ok((await sheets(page)).every(x => isRule(x.reviewer)), `class of ${n}: unticked, the reviewer is a rule again`);
    await page.context().close();
  }

  // ---- read at print time, and not kept ---------------------------------------
  {
    const page = await open(browser, { rosters: { 'Period 1': klass(4), 'Period 2': ['Zed Pretend', 'Yan Invented', 'Xia Madeup'] } });
    eq(await page.evaluate(() => [...document.getElementById('rosterSelect').options].map(o => o.value)), ['', 'Period 1', 'Period 2'], 'two rosters are offered in order');
    ok(/Period 2 \(3\)/.test(await page.evaluate(() => document.getElementById('rosterSelect').options[2].textContent)), 'the picker shows the size of each roster');
    const before = await page.evaluate(k => localStorage.getItem(k), KEY);
    const keysBefore = await page.evaluate(() => Object.keys(localStorage).sort());
    await page.selectOption('#rosterSelect', 'Period 2');
    await page.click('#printClassBtn');
    eq(stacked((await sheets(page)).map(x => x.author)), ['Zed Pretend', 'Yan Invented', 'Xia Madeup'], 'a second class prints its own names');
    // The roster changes after the page loaded; the next print has the new names.
    await page.evaluate(() => Roster.setRoster('Period 2', ['Wim Fictional', 'Val Notreal']));
    await settle(page, 200);
    ok(/2 students/.test(await page.textContent('#rosterNote')), 'a roster saved elsewhere updates the count');
    await page.click('#printClassBtn');
    eq(stacked((await sheets(page)).map(x => x.author)), ['Wim Fictional', 'Val Notreal'], 'names are read when the button is pressed');
    // Emptying the chosen roster turns the button off.
    await page.evaluate(() => Roster.setRoster('Period 2', []));
    await settle(page, 200);
    eq(await page.isDisabled('#printClassBtn'), true, 'an emptied roster turns the button off');
    ok(/no names/.test(await page.textContent('#rosterNote')), 'an emptied roster says it has no names');
    // And the roster is deleted: the picker falls back.
    await page.evaluate(() => { Roster.removeRoster('Period 2'); Roster.removeRoster('Period 1'); });
    await settle(page, 200);
    ok(/No class roster is saved/.test(await page.textContent('#rosterNote')), 'deleting every roster brings the no-roster note back');
    eq(await page.evaluate(k => localStorage.getItem(k), KEY), before, 'this tool\'s own key is byte for byte what it was');
    const after = await page.evaluate(() => Object.keys(localStorage).sort());
    eq(after.filter(k => !keysBefore.includes(k)), [], 'no new storage key appeared');
    const dump = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).filter(([k]) => k !== 'np_rosters' && !k.startsWith('crh_'))));
    ok(!/Student 0|Zed Pretend|Wim Fictional/.test(dump), 'no student name is stored outside the roster');
    await page.context().close();
  }

  // ---- text, not markup; same name twice ---------------------------------------
  {
    const evil = ['<b>Bold</b> Name', '<img src=x onerror=window.__pwn=1>', 'Sam Same', 'Sam Same'];
    const page = await open(browser, { rosters: { Odd: evil } });
    await page.selectOption('#rosterSelect', 'Odd');
    await page.check('#withReviewer');
    await page.click('#printClassBtn');
    const s = await sheets(page);
    eq(s.length, 4, 'two students with the same name each get a sheet');
    eq(stacked(s.map(x => x.author)), evil, 'a name with markup in it prints as the characters typed');
    eq(await page.evaluate(() => document.querySelectorAll('#printArea .names > *').length), 0, 'a name makes no element');
    eq(await page.evaluate(() => window.__pwn || 0), 0, 'a name runs no script');
    await page.context().close();
  }

  // ---- no category left, and an old save -------------------------------------
  {
    // A first visit loads a template, so the category goes by hand.
    const page = await open(browser, { rosters: { A: klass(3) } });
    await page.selectOption('#rosterSelect', 'A');
    while (await page.locator('[data-del-cat]').count()) await page.locator('[data-del-cat]').first().click();
    let dialog = '';
    page.on('dialog', d => { dialog = d.message(); d.dismiss(); });
    await page.click('#printClassBtn');
    eq(await page.evaluate(() => window.__printCalls), 0, 'no category: nothing is printed');
    ok(/Load a template or add a category/.test(dialog), 'no category: it says so');
    await page.context().close();
  }
  {
    // A save from before this feature: no field of this feature in it.
    const old = { assignmentName: 'Old', copyCount: 2, categories: [{ id: 'a', name: 'X', items: [{ id: 'b', text: 'y' }] }] };
    const page = await open(browser, { state: old });
    await page.click('#printBtn');
    const s = await sheets(page);
    eq(s.map(x => x.title), ['Old', 'Old'], 'an old save prints its two blank copies');
    eq(await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY), old, 'an old save is not rewritten by loading or printing');
    await page.context().close();
  }

  // ---- the printed paper -------------------------------------------------------
  {
    const page = await open(browser, { rosters: { A: klass(5) } });
    await page.selectOption('#rosterSelect', 'A');
    await page.check('#withReviewer');
    await page.click('#printClassBtn');
    await page.emulateMedia({ media: 'print' });
    await settle(page, 150);
    const m = await page.evaluate(() => {
      const area = document.getElementById('printArea');
      const outside = [...document.body.querySelectorAll('*')].filter(x => !area.contains(x) && !x.contains(area) && x.getClientRects().length);
      return { outside: outside.length, names: getComputedStyle(area.querySelector('.names')).color, text: area.querySelector('.names').textContent };
    });
    eq(m.outside, 0, 'on paper only the sheet has a box');
    eq(m.names, 'rgb(0, 0, 0)', 'a name prints black');
    ok(/Author: Student 01 Testname/.test(m.text), 'the first sheet reads Author: <name>');
    eq(page.__errs.length, 0, 'no page or console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
    eq(page.__blocked.length, 0, 'nothing tried to leave the site');
    await page.context().close();
  }
} catch (e) {
  ok(false, 'suite crashed: ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | '));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
