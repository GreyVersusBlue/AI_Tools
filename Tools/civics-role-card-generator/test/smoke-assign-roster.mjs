// smoke-assign-roster.mjs — assigning a saved class list to the role cards.
//
//   node Tools/civics-role-card-generator/test/smoke-assign-roster.mjs
//
// The tool printed a stack of identical cards per role and left the teacher to
// write names on them. It now reads `np_rosters` — the class list Name Picker
// and Class Roster Hub already save — and prints each card with its student's
// name on it. What this suite holds down:
//
//   Every student gets exactly one card, and no card gets two students. The
//   copies of a role are no longer interchangeable, so the print path builds
//   them one at a time; the failure mode is one name repeated across a role's
//   whole stack.
//
//   The class is bigger than the simulation. The mock trial template is 21
//   cards and a class is 28, so the tool grows the role that already has the
//   most copies — the jury, the audience, whichever role was built to scale —
//   rather than ending up with eight judges.
//
//   Nothing is silently dropped. Turn the growth off and the leftover students
//   are counted out loud instead of vanishing.
//
//   A role set saved before this existed still prints its blank name lines.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8150;
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
const page = await prepPage(browser, BASE, { width: 1280, height: 1000 });

const CLASS = Array.from({ length: 28 }, (_, i) => `Student ${String(i + 1).padStart(2, '0')}`);

/** Every printed card as { role, name }, name null when it printed a blank line. */
async function printedCards() {
  await page.evaluate(() => { window.print = function () {}; });
  await page.click('#printBtn');
  await settle(page);
  return page.evaluate(() => Array.from(document.querySelectorAll('#printArea .role-print-card')).map(c => ({
    role: c.querySelector('h3').textContent,
    name: c.querySelector('.assigned') ? c.querySelector('.assigned').textContent : null,
  })));
}

/* Read from the builder rather than from storage: the starter template only
   reaches localStorage once something is edited or assigned. */
const copiesByRole = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('#rolesWrap .role-block')).map(b =>
    `${b.querySelector('[data-field="role"]').value}:${b.querySelector('[data-field="copies"]').value}`));

console.log('Civics Role Card Generator — assign students from a roster');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });

/* ── 1. no rosters saved yet says so, rather than offering an empty list ─── */
ok(await page.isDisabled('#assignBtn'), 'with no class lists saved, Assign is not offered');
ok(/Name Picker/.test(await page.textContent('#assignSummary')),
   'and the tool says where a class list comes from');

/* ── 2. a saved roster shows up ──────────────────────────────────────────── */
await page.evaluate(names => {
  localStorage.setItem('np_rosters', JSON.stringify({ '3rd Period': names, 'Homeroom': names.slice(0, 4) }));
}, CLASS);
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
const options = await page.evaluate(() =>
  Array.from(document.getElementById('rosterSelect').options).map(o => o.textContent));
ok(options.some(o => /3rd Period \(28\)/.test(o)) && options.some(o => /Homeroom \(4\)/.test(o)),
   'saved class lists are listed with their sizes: ' + JSON.stringify(options));

/* ── 3. assigning 28 students to a 21-card mock trial ────────────────────── */
const before = await copiesByRole();
eq(before.join(','), 'Judge:1,Prosecution / Plaintiff Attorney:2,Defense Attorney:2,Witness:4,Juror:12',
   'the mock trial template ships one judge and a dozen jurors, not one of each');

await page.selectOption('#rosterSelect', '3rd Period');
await page.click('#assignBtn');
await settle(page);

const cards = await printedCards();
eq(cards.length, 28, 'one card per student');
const named = cards.filter(c => c.name).map(c => c.name);
eq(named.length, 28, 'every card carries a name');
eq(new Set(named).size, 28, 'no student is on two cards');
eq(named.slice().sort().join(',') === CLASS.slice().sort().join(','), true, 'and every student in the class got one');

/* ── 4. the growth lands on the role built to scale ──────────────────────── */
const grownRole = (await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('crcg_roles_v1'));
  return s.roles.slice().sort((a, b) => b.copies - a.copies)[0];
}));
eq(grownRole.role, 'Juror', 'the extra cards went to the jury, not to the bench');
eq(grownRole.copies, 19, 'the jury absorbed the seven extra slots');
eq((await copiesByRole()).filter(c => c.startsWith('Judge')).join(''), 'Judge:1', 'there is still exactly one judge');
ok(/Raised "Juror" from 12 to 19/.test(await page.textContent('#assignSummary')),
   'and the tool says what it did: ' + JSON.stringify(await page.textContent('#assignSummary')));

/* ── 5. copies of one role carry different students ─────────────────────── */
const jurors = cards.filter(c => c.role === 'Juror').map(c => c.name);
eq(jurors.length, 19, 'all 19 juror cards printed');
eq(new Set(jurors).size, 19, 'each juror card names a different student');

/* ── 6. with growth off, leftovers are counted, not dropped ──────────────── */
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('crcg_roles_v1'));
  s.roles.forEach(r => { r.copies = 2; r.students = []; });
  localStorage.setItem('crcg_roles_v1', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
await page.uncheck('#growCopies');
await page.selectOption('#rosterSelect', '3rd Period');
await page.click('#assignBtn');
await settle(page);
const summary = await page.textContent('#assignSummary');
ok(/28 students across 10 cards/.test(summary), 'the shortfall is stated: ' + JSON.stringify(summary));
ok(/18 students have no card/.test(summary), 'and the students without a card are counted');
eq((await printedCards()).filter(c => c.name).length, 10, 'only the ten cards that exist carry names');

/* ── 7. a shortfall the other way prints blank name lines ───────────────── */
await page.selectOption('#rosterSelect', 'Homeroom');
await page.click('#assignBtn');
await settle(page);
const mixed = await printedCards();
eq(mixed.filter(c => c.name).length, 4, 'four students, four named cards');
eq(mixed.filter(c => !c.name).length, 6, 'and the remaining cards keep the blank name line');

/* ── 8. Clear names puts every card back to blank ────────────────────────── */
await page.click('#clearAssignBtn');
await settle(page);
eq((await printedCards()).filter(c => c.name).length, 0, 'Clear names empties every card');

/* ── 9. shuffling changes the order, not the set ─────────────────────────── */
await page.check('#growCopies');
await page.check('#shuffleAssign');
await page.selectOption('#rosterSelect', '3rd Period');
await page.click('#assignBtn');
await settle(page);
const shuffledNames = (await printedCards()).filter(c => c.name).map(c => c.name);
eq(shuffledNames.length, 28, 'everyone still has a card after a shuffle');
eq(shuffledNames.slice().sort().join(','), CLASS.slice().sort().join(','), 'and it is still the same class');

/* ── 10. a role set saved before assignment existed ─────────────────────── */
const old = await prepPage(browser, BASE, { width: 1280, height: 1000 });
await old.goto(URL_PAGE, { waitUntil: 'networkidle' });
await old.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('crcg_roles_v1', JSON.stringify({
    roles: [{ id: 'r1', role: 'Mayor', position: 'Runs the council meeting', copies: 3,
      points: [{ id: 'p1', text: 'Open the session' }] }]
  }));
});
await old.reload({ waitUntil: 'networkidle' });
await settle(old);
await old.evaluate(() => { window.print = function () {}; });
await old.click('#printBtn');
await settle(old);
const legacy = await old.evaluate(() => Array.from(document.querySelectorAll('#printArea .role-print-card')).map(c => ({
  role: c.querySelector('h3').textContent,
  blank: !!c.querySelector('.nameline'),
})));
eq(legacy.length, 3, 'an old role set still prints its three copies');
ok(legacy.every(c => c.role === 'Mayor' && c.blank), 'each with the blank name line it printed before');

/* ── 11. no console noise anywhere in the run ───────────────────────────── */
for (const [label, p] of [['main', page], ['legacy', old]]) {
  eq(p.__errs.length, 0, `no page/console errors on the ${label} page: ` + JSON.stringify(p.__errs));
  eq(p.__blocked.length, 0, `nothing left the site from the ${label} page: ` + JSON.stringify(p.__blocked));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
