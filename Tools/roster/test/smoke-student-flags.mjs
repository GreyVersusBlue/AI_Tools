// smoke-student-flags.mjs — the flags on the shared student record (Path 3 P5)
// in a browser: set and cleared in Class Roster Hub (006), honoured by the
// Name Picker (007).
//
//   node Tools/roster/test/smoke-student-flags.mjs   (or: npm run test:student-flags-smoke)
//
// What it holds:
//   - 006 on load drops a flag from an earlier day and the flag of a student on
//     no roster, and keeps the rest;
//   - each row's Absent and No call toggles write crh_flags_v1 by the student's
//     id at once (no Save), keep focus, say so in aria-pressed, survive a
//     reload, and leave np_rosters, crh_students_v1 and the CSV export without
//     a trace of them; the bar counts them; "Clear all flags" empties the key;
//   - 007 leaves an absent-today student off the board, keeps a do-not-cold-
//     call student on it dimmed and labelled, counts both, names both in a
//     notice, never picks either in a run of real picks, shows the Stats row's
//     absence as Class Roster Hub's and locked; a flag pressed in 006 in
//     another tab reaches 007 without a reload; names on no saved roster get
//     no flags;
//   - both pages' flag controls are clean under axe.
// The clock is pinned (15:00 local on 2026-10-21) so "today" is a literal.
// Every name here is made up. Exits 1 on any failure.

import { serve, launch, prepPage, settle, downloadText, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8537;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_006 = BASE + '/Tools/006-class-roster-hub.html';
const URL_007 = BASE + '/Tools/007-Name%20Picker.html';
const NOW = new Date(2026, 9, 21, 15, 0, 0);
const TODAY = '2026-10-21', YESTERDAY = '2026-10-20';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const NAMES = ['Avery Stone', 'Blake Rivers', 'Casey Lund', 'Drew Hale'];
const IDS = ['s-avery', 's-blake', 's-casey', 's-drew'];
const SEED = {
  np_rosters: JSON.stringify({ 'Period 3': NAMES }),
  crh_students_v1: JSON.stringify({ version: 1, rosters: { 'Period 3': {
    meta: { period: '3' }, students: NAMES.map((n, i) => ({ id: IDS[i], name: n, preferred: '', say: '' })), orphans: [] } } }),
};

const getKey = (page, k) => page.evaluate(k => localStorage.getItem(k), k);
const flags = async page => JSON.parse((await getKey(page, 'crh_flags_v1')) || 'null');
const pressed = (page, flag, i) => page.$eval(`#stuList button[data-flag="${flag}"][data-i="${i}"]`, b => b.getAttribute('aria-pressed'));

async function seed(page, url, data) {
  await page.goto(url);
  await page.evaluate(data => {
    localStorage.clear();
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
  }, data);
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 400);
}

const server = await serve(PORT);
const browser = await launch();
try {
  /* ── 006 ─────────────────────────────────────────────────────────── */
  console.log('Class Roster Hub — setting and clearing flags');
  const hub = await prepPage(browser, BASE, { width: 1280, height: 950 });
  await hub.clock.setFixedTime(NOW);

  // 1. pruning on load
  await seed(hub, URL_006, { ...SEED, crh_flags_v1: JSON.stringify({ version: 1, flags: {
    's-avery': { absent: YESTERDAY }, 's-casey': { noCall: true, absent: YESTERDAY }, 's-gone': { noCall: true } } }) });
  eq(await flags(hub), { version: 1, flags: { 's-casey': { noCall: true } } },
    '1: load drops yesterday\'s absences and a student on no roster, keeps the rest');
  eq(await pressed(hub, 'noCall', 2), 'true', '1: the kept flag shows pressed');
  ok(/1 not to be cold called/.test(await hub.textContent('#flagSummary')), '1: the bar counts it');
  ok(!(await hub.$eval('#clearFlagsBtn', b => b.hidden)), '1: Clear all flags is offered');

  // 2. pressing toggles
  await hub.click('#stuList button[data-flag="absent"][data-i="0"]');
  await settle(hub, 150);
  await hub.click('#stuList button[data-flag="noCall"][data-i="1"]');
  await settle(hub, 150);
  eq(await flags(hub), { version: 1, flags: { 's-casey': { noCall: true }, 's-avery': { absent: TODAY }, 's-blake': { noCall: true } } },
    '2: each press is stored at once, by id, absent as today\'s date');
  eq(await hub.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-flag') + ':' + document.activeElement.getAttribute('data-i')),
    'noCall:1', '2: focus stays on the button pressed');
  eq([await pressed(hub, 'absent', 0), await pressed(hub, 'noCall', 1), await pressed(hub, 'absent', 1)], ['true', 'true', 'false'],
    '2: aria-pressed says which are set');
  ok(await hub.$eval('#stuList .stu-row[data-i="0"]', r => r.classList.contains('flagged')), '2: a flagged row is marked');
  const bar = await hub.textContent('#flagSummary');
  ok(/1 absent today/.test(bar) && /2 not to be cold called/.test(bar), '2: the bar counts this class (' + bar.trim() + ')');
  ok(/never in a share link or an export/.test(bar), '2: the bar says flags stay on this computer');

  // 3. survives a reload; never in the roster keys or the export
  await hub.reload({ waitUntil: 'networkidle' });
  await settle(hub, 400);
  eq([await pressed(hub, 'absent', 0), await pressed(hub, 'noCall', 1)], ['true', 'true'], '3: flags survive a reload');
  ok(!/absent|noCall|flag/i.test(await getKey(hub, 'crh_students_v1')), '3: crh_students_v1 holds no flag');
  ok(!/absent|noCall|flag/i.test(await getKey(hub, 'np_rosters')), '3: np_rosters holds no flag');
  const csv = await downloadText(hub, '#exportCsvBtn', { what: '006\'s CSV export' });
  ok(/Avery Stone/.test(csv) && !/absent|cold|no call|flag/i.test(csv), '3: the CSV export carries the names and no flag');

  // 4. axe on the list with flags pressed, light and dark
  for (const theme of ['light', 'dark']) {
    await hub.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
    const v = await a11yScan(hub, { include: '#listPane' });
    ok(v.length === 0, `4: the flag controls are clean under axe (${theme})` + (v.length ? ': ' + v.map(x => x.id + ' ' + x.nodes.slice(0, 2).join(',')).join('; ') : ''));
  }
  await hub.evaluate(() => document.documentElement.removeAttribute('data-theme'));

  /* ── 007 ─────────────────────────────────────────────────────────── */
  console.log('Name Picker — honouring the flags');
  /* Same context as 006, so the two share storage and a press in one tab
     raises a storage event in the other; the clock is the context's. */
  const picker = await hub.context().newPage();
  const pickerErrs = [];
  picker.on('pageerror', e => pickerErrs.push(String(e)));
  await picker.route('**/*', r => (r.request().url().startsWith(BASE) || /^(data|blob|about):/.test(r.request().url()) ? r.continue() : r.abort()));
  // Avery absent today, Blake not to be cold called; Casey's noCall cleared for this part.
  await hub.click('#stuList button[data-flag="noCall"][data-i="2"]');
  await settle(hub, 150);
  await picker.goto(URL_007, { waitUntil: 'networkidle' });
  await picker.evaluate(n => localStorage.setItem('np_current', JSON.stringify(n)), NAMES);
  await picker.reload({ waitUntil: 'networkidle' });
  await settle(picker, 600);

  const cards = () => picker.$$eval('.name-card', cs => cs.map(c => ({ text: c.textContent, nocall: c.classList.contains('nocall-card') })));
  let cs = await cards();
  eq(cs.map(c => c.text).sort(), ['Blake Riversno cold call', 'Casey Lund', 'Drew Hale'], '5: the absent student is off the board, the other labelled');
  ok(cs.find(c => c.text.startsWith('Blake')).nocall, '5: the do-not-cold-call card is dimmed');
  eq((await picker.textContent('#countDisplay')).trim(), '2 active (1 absent, 1 not cold called) / 4 total', '5: the count says why');
  const note = await picker.$eval('#rosterFlagNotice', el => ({ hidden: el.hidden, text: el.textContent }));
  ok(!note.hidden && /absent today: Avery Stone/.test(note.text) && /not cold called: Blake Rivers/.test(note.text) && /Class Roster Hub/.test(note.text),
    '5: the Names tab names both and where to change them (' + note.text + ')');

  // 6. real picks never land on either
  await picker.click('#settingsBtn'); await settle(picker, 250);
  await picker.click('button[data-tab="options"]'); await settle(picker, 150);
  await picker.uncheck('#fairRotation');
  for (const id of ['#soundToggle', '#confettiToggle', '#dramaticPause', '#rarityEnabled']) await picker.uncheck(id);
  await picker.check('#calmMode');
  await picker.evaluate(() => { const sp = document.getElementById('speed'); sp.value = '40'; sp.dispatchEvent(new Event('input', { bubbles: true })); });
  await picker.click('#closePanel'); await settle(picker, 300);
  const won = [];
  for (let i = 0; i < 12; i++) {
    await picker.click('#pickBtn');
    await picker.waitForSelector('#modalDone', { timeout: 20000 });
    won.push(await picker.evaluate(() => { const w = document.querySelector('.name-card.winner'); return w ? w.textContent.trim() : null; }));
    await picker.click('#modalDone');
    await picker.waitForFunction(() => !document.getElementById('pickBtn').disabled, null, { timeout: 20000 });
  }
  ok(won.every(n => n === 'Casey Lund' || n === 'Drew Hale'), '6: twelve real picks land only on the two unflagged students (' + won.join(', ') + ')');

  // 7. the Stats tab
  await picker.click('#settingsBtn'); await settle(picker, 250);
  await picker.click('button[data-tab="stats"]'); await settle(picker, 200);
  const rows = await picker.$$eval('#statsList .stats-item', rs => rs.map(r => ({ text: r.textContent, box: r.querySelector('input[data-absent-name]') && { name: r.querySelector('input').dataset.absentName, checked: r.querySelector('input').checked, disabled: r.querySelector('input').disabled } })));
  const avery = rows.find(r => r.box && r.box.name === 'Avery Stone');
  const blake = rows.find(r => r.box && r.box.name === 'Blake Rivers');
  ok(avery && avery.box.checked && avery.box.disabled && /Absent \(Roster Hub\)/.test(avery.text), '7: the hub\'s absence shows checked, locked and named on the Stats tab');
  ok(blake && !blake.box.checked && /NO CALL/.test(blake.text), '7: the do-not-cold-call student has a NO CALL badge');
  const v7 = await a11yScan(picker, { include: '#statsList' });
  ok(v7.length === 0, '7: the Stats rows are clean under axe' + (v7.length ? ': ' + v7.map(x => x.id + ' ' + x.nodes.join(',')).join('; ') : ''));
  await picker.click('button[data-tab="names"]'); await settle(picker, 150);
  const v7b = await a11yScan(picker, { include: '#rosterFlagNotice' });
  ok(v7b.length === 0, '7: the notice is clean under axe' + (v7b.length ? ': ' + v7b.map(x => x.id).join(', ') : ''));
  await picker.click('#closePanel'); await settle(picker, 300);

  // 8. a press in 006, in another tab, reaches 007 without a reload
  await hub.click('#stuList button[data-flag="noCall"][data-i="1"]');
  await hub.click('#stuList button[data-flag="absent"][data-i="0"]');
  await settle(picker, 600);
  cs = await cards();
  eq(cs.map(c => c.text).sort(), ['Avery Stone', 'Blake Rivers', 'Casey Lund', 'Drew Hale'], '8: clearing both in 006 puts both back on 007\'s board, no reload');
  ok(cs.every(c => !c.nocall), '8: and no card is dimmed');
  ok(await picker.$eval('#rosterFlagNotice', el => el.hidden), '8: the notice goes');

  // 9. Clear all flags
  await hub.click('#stuList button[data-flag="noCall"][data-i="3"]');
  await settle(hub, 150);
  hub.once('dialog', d => d.accept());
  await hub.click('#clearFlagsBtn');
  await settle(hub, 300);
  eq(await flags(hub), { version: 1, flags: {} }, '9: Clear all flags empties the key');
  ok(await hub.$eval('#clearFlagsBtn', b => b.hidden), '9: and the button goes');

  // 10. names on no saved roster get no flags
  await picker.evaluate(() => localStorage.setItem('crh_flags_v1', JSON.stringify({ version: 1, flags: { 's-blake': { noCall: true } } })));
  await picker.evaluate(() => localStorage.setItem('np_current', JSON.stringify(['Blake River', 'Elliot Park'])));
  await picker.reload({ waitUntil: 'networkidle' });
  await settle(picker, 600);
  cs = await cards();
  ok(cs.length === 2 && cs.every(c => !c.nocall), '10: a name that is on no roster is not matched to a flagged student');

  eq(hub.__errs, [], '006 raised no page or console error');
  eq(pickerErrs, [], '007 raised no page error');
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('Failures:\n  ' + fails.join('\n  ')); process.exit(1); }
