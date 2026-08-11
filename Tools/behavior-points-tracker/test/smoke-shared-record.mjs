// smoke-shared-record.mjs — the Behavior & Points Tracker's adoption of the
// shared per-student record.
//
//   node Tools/behavior-points-tracker/test/smoke-shared-record.mjs
//
// Two things come out of Class Roster Hub's crh_students_v1 sidecar and this
// suite covers both:
//
//   preferred name — a points board is projected and read out loud, so a card
//   that says "Aiden" when the class knows him as AJ is the same failure the
//   Name Picker already fixed.
//
//   the stable id — every per-student thing this tool stores (points, goals,
//   today's log, every archived day) is keyed by the name string, so renaming
//   a student used to orphan the lot: they came back on the board with 0 and
//   their history belonged to a name that no longer existed. That is the case
//   the second half of this suite sets up and then checks record by record.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8160;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/008-behavior-points-tracker.html';

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

const ROSTER = 'Period 3 — Earth Science';

const seedSidecar = (students) => page.evaluate(([roster, list]) => {
  localStorage.setItem('np_rosters', JSON.stringify({ [roster]: list.map(s => s.name) }));
  localStorage.setItem('crh_students_v1', JSON.stringify({
    version: 1,
    rosters: { [roster]: { meta: { period: '3' }, students: list, orphans: [] } },
  }));
}, [ROSTER, students]);

const cards = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('#studentGrid .student-card')).map(c => ({
    name: c.dataset.name,
    big: c.querySelector('.s-name') ? c.querySelector('.s-name').textContent : '',
    subs: Array.from(c.querySelectorAll('.s-sub')).map(s => s.textContent),
    points: c.querySelector('.s-points') ? c.querySelector('.s-points').textContent : '',
  })));

const section = () => page.evaluate(() => {
  const store = JSON.parse(localStorage.getItem('behavior-points-tracker-sections'));
  return store.sets[store.current];
});

console.log('Behavior & Points Tracker — the shared student record');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

await seedSidecar([
  { id: 'stu-a', name: 'Aiden Whitfield', preferred: 'AJ', say: '' },
  { id: 'stu-b', name: 'Brooklyn Bell', preferred: '', say: '' },
  { id: 'stu-c', name: 'Yusuf Yilmaz', preferred: '', say: 'yoo-SOOF' },
]);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);

/* ── load the roster and award some points ─────────────────────────────── */
await page.selectOption('#rosterSelect', ROSTER);
await page.click('#loadRosterBtn');
await settle(page, 400);

const loaded = await cards();
eq(loaded.length, 3, 'three students land on the board');

/* ── 1. the preferred name is what a projected card shows ──────────────── */
const aj = loaded.find(c => c.name === 'Aiden Whitfield');
eq(aj.big, 'AJ', 'the card shows the name the class actually uses');
ok(aj.subs.includes('Aiden Whitfield'), 'with the roster name underneath so it ties back to the gradebook');
const bb = loaded.find(c => c.name === 'Brooklyn Bell');
eq(bb.big, 'Brooklyn Bell', 'a student with no preferred name is unchanged');
eq(bb.subs.length, 0, 'and gets no subtitle');

/* ── 2. the tool still keys everything by the roster name ──────────────── */
await page.click('.student-card[data-name="Aiden Whitfield"]');
await page.click('.student-card[data-name="Aiden Whitfield"]');
await page.click('.student-card[data-name="Brooklyn Bell"]');
await settle(page, 300);
let st = await section();
eq(st.points['Aiden Whitfield'], 2, 'two points land on the roster name, not the preferred one');
eq(st.points['Brooklyn Bell'], 1, 'and one on the other student');
eq(st.rosterName, ROSTER, 'the section remembers which saved roster it follows');
ok(st.idNames['stu-a'] === 'Aiden Whitfield', 'the stable id is recorded against the name it was seen under');

/* archive the day so there is history to lose, then award again */
page.once('dialog', d => d.accept());
await page.click('#archiveBtn');
await settle(page, 400);
await page.click('.student-card[data-name="Aiden Whitfield"]');
await settle(page, 300);
st = await section();
eq(st.history.length, 1, 'a day is archived');
ok(st.history[0].rows.some(r => r.name === 'Aiden Whitfield'), 'and the archived day names the student');

/* ── 3. rename the student in Class Roster Hub, reopen the tracker ─────── */
await seedSidecar([
  { id: 'stu-a', name: 'Whitfield, Aiden J', preferred: 'AJ', say: '' },  // same id, new name
  { id: 'stu-b', name: 'Brooklyn Bell', preferred: '', say: '' },
  { id: 'stu-c', name: 'Yusuf Yilmaz', preferred: '', say: 'yoo-SOOF' },
]);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
await page.selectOption('#rosterSelect', ROSTER);
await page.click('#loadRosterBtn');
await settle(page, 500);

st = await section();
eq(st.points['Whitfield, Aiden J'], 1, "today's points followed the rename");
eq(st.points['Aiden Whitfield'], undefined, 'and are not left behind under the old name');
ok(st.history[0].rows.some(r => r.name === 'Whitfield, Aiden J'), 'the archived day followed too');
ok(!st.history[0].rows.some(r => r.name === 'Aiden Whitfield'), 'with nothing orphaned there either');
ok(st.log.every(ev => ev.name !== 'Aiden Whitfield'), "today's log followed as well");
eq(st.idNames['stu-a'], 'Whitfield, Aiden J', 'the id now points at the new name');
ok(/renamed in Class Roster Hub/.test(await page.textContent('#msg')), 'the tool says what it did rather than doing it silently');

const renamed = await cards();
eq(renamed.find(c => c.name === 'Whitfield, Aiden J').big, 'AJ', 'the card still shows the preferred name');
eq(st.points['Brooklyn Bell'], undefined, 'the student who was not renamed kept a clean slate after the archive');

/* ── 4. a teacher with no Class Roster Hub sidecar sees no change ───────── */
await page.evaluate(() => localStorage.removeItem('crh_students_v1'));
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
const bare = await cards();
eq(bare.find(c => c.name === 'Whitfield, Aiden J').big, 'Whitfield, Aiden J',
   'with no sidecar the roster name is the card name, exactly as before this feature');
eq((await section()).points['Whitfield, Aiden J'], 1, 'and nothing was moved or lost');

/* ── 5. no console noise ───────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
