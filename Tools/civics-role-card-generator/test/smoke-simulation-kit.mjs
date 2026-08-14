// smoke-simulation-kit.mjs — the full simulation kit and named saved simulations.
//
//   node Tools/civics-role-card-generator/test/smoke-simulation-kit.mjs
//
// The tool used to print role cards and case-file packets. It now prints the
// whole class period: an agenda with time boxes and teacher cues, the cards,
// the case files, a ballot slip for every student who votes, a scoring
// rubric, and a half-page reflection per student. Each piece is individually
// toggleable at print time, and all five built-in templates ship the kit
// pre-filled. Simulations are also saved by name now, migrating the old flat
// `crcg_roles_v1` blob in as the first one.
//
// What this suite holds down:
//
//   The pieces print in the order a teacher runs the period — agenda, cards,
//   case files, ballots, rubric, reflections — each starting on a fresh page,
//   all inside #printArea, and never a wasted blank leading page.
//
//   Ballot slips are counted from the roles' copies: the Mock Trial's 12
//   jurors get 12 verdict slips, and changing the juror count changes the
//   slip count with it. The UN Security Council template lands on exactly 15
//   vote cards, which is the size of the real Council.
//
//   Reflection sheets carry the assigned student's name and role, one per
//   printed card, the same way the case-file packets do.
//
//   A print toggle only ever subtracts: unticking ballots drops the slips and
//   leaves everything else alone.
//
//   Multi-save: the legacy `crcg_roles_v1` document migrates in as "My
//   simulation" and prints exactly what it used to (an old role set has no
//   kit, and an empty kit piece prints nothing). Two named simulations keep
//   their own roles, and the last one open reopens on reload.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8152;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/050-civics-role-card-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

/** One click of Print builds the whole kit into #printArea, so a single pass
 *  reads every piece back plus the order they came out in. */
async function printed(page) {
  await page.evaluate(() => { window.print = function () {}; });
  await page.click('#printBtn');
  await settle(page);
  return page.evaluate(() => ({
    order: Array.from(document.querySelectorAll('#printArea > *')).map(n => n.className),
    agendaRows: Array.from(document.querySelectorAll('#printArea .agenda-table tbody tr')).map(tr =>
      Array.from(tr.children).map(td => td.textContent.trim())),
    cards: Array.from(document.querySelectorAll('#printArea .role-print-card')).map(c => ({
      role: c.querySelector('h3').textContent,
      name: c.querySelector('.assigned') ? c.querySelector('.assigned').textContent : null,
    })),
    packets: document.querySelectorAll('#printArea .role-packet').length,
    slips: Array.from(document.querySelectorAll('#printArea .ballot-slip')).map(s => ({
      head: s.querySelector('.slip-head').textContent,
      name: s.querySelector('.slip-name').textContent,
      opts: Array.from(s.querySelectorAll('.slip-opt')).map(o => o.textContent),
    })),
    rubricRows: Array.from(document.querySelectorAll('#printArea .rubric-table tbody tr')).map(tr =>
      tr.querySelector('b').textContent),
    rubricCols: Array.from(document.querySelectorAll('#printArea .rubric-table thead th')).map(th => th.textContent),
    reflections: Array.from(document.querySelectorAll('#printArea .reflect-sheet')).map(s => ({
      who: s.querySelector('.reflect-who').textContent,
      role: s.querySelector('.reflect-role').textContent,
      qs: Array.from(s.querySelectorAll('.reflect-q')).map(q => q.textContent),
    })),
  }));
}

const readDoc = page => page.evaluate(() =>
  JSON.parse(localStorage.getItem('crcg:data:' + localStorage.getItem('crcg:current'))));
const simList = page => page.evaluate(() => JSON.parse(localStorage.getItem('crcg:list') || '[]'));

console.log('Civics Role Card Generator — full simulation kit and named saves');

/* ── 1. the default Mock Trial prints the whole period, in order ─────────── */
const page = await prepPage(browser, BASE, { width: 1280, height: 1200 });
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page);

const first = await printed(page);
ok(first.order[0].indexOf('kit-agenda') !== -1, 'the agenda page prints first');
eq(first.order.filter(c => c === 'role-packet').length, 9, 'nine case-file packets, one per copy of the four roles that have one');
const sectionOrder = first.order.filter(c => c.indexOf('kit-section') !== -1);
eq(sectionOrder.join(' | '),
   'kit-section kit-agenda | kit-section | kit-section kit-ballots | kit-section kit-rubric | kit-section kit-reflections',
   'sections come out in the order the period runs: agenda, cards, ballots, rubric, reflections');
// The cards section sits between the agenda and the packets, so the packets
// are physically behind the card grid in the stack.
ok(first.order.indexOf('role-packet') > first.order.indexOf('kit-section'),
   'the case-file packets print after the card grid');

/* ── 2. each piece carries the content the template shipped ──────────────── */
eq(first.agendaRows.length, 7, 'six agenda phases plus a total row');
eq(first.agendaRows[0][2], 'Set up the courtroom', 'the first phase name printed');
ok(/Jury along one wall/.test(first.agendaRows[0][4]), 'the phase carries its one-line teacher cue');
eq(first.agendaRows[6][3], '55 min', 'the agenda totals its time boxes');
eq(first.cards.length, 21, '21 role cards: 1 judge, 2+2 attorneys, 4 witnesses, 12 jurors');
eq(first.slips.length, 12, 'twelve verdict slips, one per juror, counted from that role\'s copies');
ok(first.slips.every(s => s.head === 'Juror Verdict Slip'), 'every slip is the mock trial\'s verdict slip');
eq(first.slips[0].opts.join(' / '), 'The search was allowed / The search was not allowed', 'the slip carries the template\'s two choices');
ok(/Name: _/.test(first.slips[0].name), 'a verdict slip prints a blank name line — the jury vote is secret');
eq(first.rubricRows.length, 4, 'four rubric criteria');
eq(first.rubricRows[0], 'Prepared evidence', 'the first criterion printed');
eq(first.rubricCols.join(' | '), 'Criterion | 4 Strong | 3 Solid | 2 Developing | 1 Beginning', 'the rubric prints its four level columns');
eq(first.reflections.length, 21, 'one reflection sheet per printed card');
eq(first.reflections[0].qs.length, 3, 'three reflection questions on the sheet');
ok(/Role: Judge/.test(first.reflections[0].role), 'the reflection sheet names the role it belongs to');

/* ── 3. every kit section starts on a fresh page, and none is wasted ─────── */
const breaks = await page.evaluate(() => {
  const val = el => getComputedStyle(el).breakBefore || getComputedStyle(el).pageBreakBefore;
  const secs = Array.from(document.querySelectorAll('#printArea .kit-section'));
  return { firstSection: val(secs[0]), lastSection: val(secs[secs.length - 1]) };
});
eq(breaks.firstSection, 'auto', 'the first thing printed never forces a blank page ahead of itself');
ok(breaks.lastSection === 'always' || breaks.lastSection === 'page',
   'a later kit section starts on its own page (got ' + JSON.stringify(breaks.lastSection) + ')');

/* ── 4. a print toggle only ever subtracts ───────────────────────────────── */
await page.uncheck('#ptBallots');
await settle(page);
const noBallots = await printed(page);
eq(noBallots.slips.length, 0, 'unticking Ballots drops the slips');
eq(noBallots.cards.length, 21, 'and leaves the cards alone');
eq(noBallots.reflections.length, 21, 'and leaves the reflections alone');
await page.check('#ptBallots');
await settle(page);

/* ── 5. slip count follows the roles' copies ─────────────────────────────── */
const jurorId = await page.evaluate(() => {
  const doc = JSON.parse(localStorage.getItem('crcg:data:' + localStorage.getItem('crcg:current')));
  return doc.roles.find(r => r.role === 'Juror').id;
});
await page.fill(`input[data-field="copies"][data-role="${jurorId}"]`, '6');
await settle(page);
eq((await printed(page)).slips.length, 6, 'dropping the jury to 6 prints 6 slips');
await page.fill(`input[data-field="copies"][data-role="${jurorId}"]`, '12');
await settle(page);

/* ── 6. reflection sheets carry the assigned student's name ──────────────── */
await page.evaluate(names => {
  localStorage.setItem('np_rosters', JSON.stringify({ Class: names }));
}, Array.from({ length: 21 }, (_, i) => `Student ${String(i + 1).padStart(2, '0')}`));
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
await page.selectOption('#rosterSelect', 'Class');
await page.click('#assignBtn');
await settle(page);

const assigned = await printed(page);
eq(assigned.reflections.length, 21, 'still one reflection per card after assigning');
eq(assigned.reflections.map(r => r.who).join(','), assigned.cards.map(c => c.name).join(','),
   'each reflection sheet names the same student as the matching card, in the same order');
ok(/Name: _/.test(assigned.slips[0].name),
   'verdict slips still print blank name lines even with students assigned — that switch is off for a secret vote');

/* ── 7. a recorded vote prints the student's name on the card ────────────── */
await page.check('#kitWrap input[data-kit="ballot.names"]');
await settle(page);
const recorded = await printed(page);
ok(/Student /.test(recorded.slips[0].name),
   'ticking "print each student\'s name" puts the name on the slip (got ' + JSON.stringify(recorded.slips[0].name) + ')');

/* ── 8. the two new templates ────────────────────────────────────────────── */
const tmpl = await prepPage(browser, BASE, { width: 1280, height: 1200 });
tmpl.on('dialog', d => d.accept());
await tmpl.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(tmpl);

await tmpl.selectOption('#templateSelect', 'un_security_council');
await tmpl.click('#loadTemplateBtn');
await settle(tmpl);
const un = await printed(tmpl);
eq(un.cards.length, 19, 'the Security Council template seats 19');
eq(un.slips.length, 15, 'exactly 15 vote cards — the size of the real Council (5 permanent + 10 elected)');
eq(un.slips[0].opts.join(' / '), 'Yes / No / Abstain', 'a Council vote card offers yes, no, abstain');
ok(/Name: _/.test(un.slips[0].name),
   'with nobody assigned the vote card still prints a name line to fill in by hand');
eq(un.agendaRows.length, 7, 'six Security Council agenda phases plus a total');
ok(un.rubricRows.indexOf('Represents the seat, not the self') !== -1,
   'the Council rubric scores arguing the delegation\'s position, not the student\'s own');

await tmpl.selectOption('#templateSelect', 'constitutional_convention');
await tmpl.click('#loadTemplateBtn');
await settle(tmpl);
const cc = await printed(tmpl);
eq(cc.cards.length, 24, 'the Constitutional Convention template seats 24');
eq(cc.slips.length, 22, '22 vote cards: every delegate votes, the presiding officer and secretary do not');
eq(cc.slips[0].opts.join(' / '), 'Aye / Nay / Abstain', 'the Convention votes aye, nay, abstain');
ok(cc.packets >= 5, 'every Convention role ships a private case file');

/* ── 9. the legacy flat document migrates in as the first named save ─────── */
const legacy = await prepPage(browser, BASE, { width: 1280, height: 1200 });
await legacy.goto(URL_PAGE, { waitUntil: 'networkidle' });
await legacy.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('crcg_roles_v1', JSON.stringify({
    roles: [
      { id: 'r1', role: 'Town Mayor', position: 'Runs the meeting', copies: 2, students: [],
        caseFile: 'The town budget is short by $4,000.', points: [{ id: 'p1', text: 'Open the session' }] },
      { id: 'r2', role: 'Council Member', position: 'Votes on proposals', copies: 3, students: [],
        caseFile: '', points: [{ id: 'p2', text: 'Raise questions' }] },
    ],
  }));
});
await legacy.reload({ waitUntil: 'networkidle' });
await settle(legacy);

eq((await simList(legacy)).join(','), 'My simulation', 'the old flat document arrives as the simulation "My simulation"');
const migratedDoc = await readDoc(legacy);
eq(migratedDoc.roles.length, 2, 'both old roles came across');
eq(migratedDoc.roles[0].caseFile, 'The town budget is short by $4,000.', 'and their case-file text with them');
eq(await legacy.evaluate(() => localStorage.getItem('crcg_roles_v1') !== null), true,
   'the legacy key is left in place as a one-release backup');

const oldPrint = await printed(legacy);
eq(oldPrint.cards.length, 5, 'a migrated role set still prints its cards');
eq(oldPrint.packets, 2, 'and its case-file packets');
eq(oldPrint.slips.length, 0, 'and no ballots — it has no kit, and an empty kit piece prints nothing');
eq(oldPrint.agendaRows.length, 0, 'and no agenda page');
eq(oldPrint.reflections.length, 0, 'and no reflection sheets, so it prints exactly what it always did');

/* ── 10. two named simulations, each with its own roles ──────────────────── */
const multi = await prepPage(browser, BASE, { width: 1280, height: 1200 });
multi.on('dialog', d => d.accept('Debate Day'));
await multi.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(multi);

await multi.selectOption('#templateSelect', 'debate');
await multi.click('#newSimBtn');
await settle(multi);
eq((await simList(multi)).join(','), 'My simulation,Debate Day', 'the new simulation sits beside the first, it does not replace it');
eq(await multi.evaluate(() => document.getElementById('simSelect').value), 'Debate Day', 'and it is the one now open');
eq((await readDoc(multi)).roles.length, 4, 'the new simulation holds the four debate roles');

await multi.selectOption('#simSelect', 'My simulation');
await settle(multi);
eq((await readDoc(multi)).roles.length, 5, 'switching back brings the mock trial\'s five roles with it');
await multi.selectOption('#simSelect', 'Debate Day');
await settle(multi);
await multi.reload({ waitUntil: 'networkidle' });
await settle(multi);
eq(await multi.evaluate(() => document.getElementById('simSelect').value), 'Debate Day', 'the last simulation open is the one that reopens');
eq((await printed(multi)).slips.length, 3, 'the debate template scores with 3 judge slips');

/* ── 11. no console noise anywhere in the run ────────────────────────────── */
for (const [label, p] of [['main', page], ['templates', tmpl], ['legacy', legacy], ['multi-save', multi]]) {
  eq(p.__errs.length, 0, `no page/console errors on the ${label} page: ` + JSON.stringify(p.__errs));
  eq(p.__blocked.length, 0, `nothing left the site from the ${label} page: ` + JSON.stringify(p.__blocked));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
