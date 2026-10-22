// smoke-flag-adopters.mjs — the flags on the shared student record (Path 3 P5)
// honoured by the tools after 007: 002 Group / Team Generator and 022 Lab
// Group & Role Randomizer leave an absent-today student out of their groups,
// and 010 Command Center's Quick Call shows today's flags and picks neither.
//
//   node Tools/roster/test/smoke-flag-adopters.mjs   (or: npm run test:flag-adopters)
//
// What it holds, on a roster of six with one student absent today, one not to
// be cold called and one marked absent YESTERDAY (which must count for nothing):
//   - 002: the absent box shows the hub's absence checked, locked and named;
//     a note says who is left out and where to change it; five real Make Groups
//     never place the absent student and always place the no-call one; the
//     absence is never written into the config's own absentNames (which a share
//     link carries); a flag cleared in another tab reaches the page with no
//     reload; a name on no roster is not matched;
//   - 022: the note before a shuffle; the shuffle leaves the student out and says
//     so; a student marked absent in another tab after the shuffle shows in the
//     groups as absent, locked, with the role handed on, and is not written into
//     the saved state.absent;
//   - 010: the Quick Call list marks the absent student absent (locked) and the
//     no-call one labelled; the count and a note name both; twelve real picks
//     land on neither; the note is not shown on the projector; a change in
//     another tab arrives with no reload;
//   - each new piece is clean under axe.
// The clock is pinned (15:00 local on 2026-10-21) so "today" is a literal.
// Every name here is made up. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8538;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_002 = BASE + '/Tools/002-group-team-generator.html';
const URL_022 = BASE + '/Tools/022-lab-group-role-randomizer.html';
const URL_010 = BASE + '/Tools/010-command-center-dashboard.html';
const NOW = new Date(2026, 9, 21, 15, 0, 0);
const TODAY = '2026-10-21', YESTERDAY = '2026-10-20';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const NAMES = ['Avery Stone', 'Blake Rivers', 'Casey Lund', 'Drew Hale', 'Emery Fox', 'Finley Moss'];
const IDS = ['s-avery', 's-blake', 's-casey', 's-drew', 's-emery', 's-finley'];
const FLAGS = { version: 1, flags: { 's-avery': { absent: TODAY }, 's-blake': { noCall: true }, 's-casey': { absent: YESTERDAY } } };
const SEED = {
  np_rosters: JSON.stringify({ 'Period 3': NAMES }),
  crh_students_v1: JSON.stringify({ version: 1, rosters: { 'Period 3': {
    meta: { period: '3' }, students: NAMES.map((n, i) => ({ id: IDS[i], name: n, preferred: '', say: '' })), orphans: [] } } }),
  crh_flags_v1: JSON.stringify(FLAGS),
};

async function seed(page, url, data) {
  await page.goto(url);
  await page.evaluate(data => {
    localStorage.clear();
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
  }, data);
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 400);
}

/** Every stored value except the roster's own keys, as one string. */
const ownValues = page => page.evaluate(() => Object.keys(localStorage)
  .filter(k => !/^(np_rosters|crh_students_v1|crh_flags_v1)$/.test(k))
  .map(k => localStorage.getItem(k)).join('\n'));

const axe = async (page, include, label) => {
  for (const theme of ['light', 'dark']) {
    await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
    const v = await a11yScan(page, { include });
    ok(v.length === 0, `${label} is clean under axe (${theme})` + (v.length ? ': ' + v.map(x => x.id + ' ' + x.nodes.slice(0, 2).join(',')).join('; ') : ''));
  }
  await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
};

const server = await serve(PORT);
const browser = await launch();
try {
  /* One context for all three pages and the "other tab" that stands in for
     Class Roster Hub, so a write there raises a storage event here. */
  const first = await prepPage(browser, BASE, { width: 1280, height: 950 });
  await first.clock.setFixedTime(NOW);
  const ctx = first.context();
  const other = await ctx.newPage();
  await other.goto(BASE + '/manifest.json');
  const setFlags = doc => other.evaluate(d => localStorage.setItem('crh_flags_v1', JSON.stringify(d)), doc);

  /* ── 002 ─────────────────────────────────────────────────────────── */
  console.log('002 Group / Team Generator');
  const g = first;
  await seed(g, URL_002, SEED);
  await g.selectOption('#roster-select', 'Period 3');
  await g.click('#load-roster-btn');
  await settle(g, 300);
  const boxes = () => g.$$eval('#absent-list .absent-item', ls => ls.map(l => {
    const i = l.querySelector('input');
    return { name: i.dataset.absent, checked: i.checked, disabled: i.disabled, text: l.textContent.trim() };
  }));
  let bx = await boxes();
  const av = bx.find(b => b.name === 'Avery Stone');
  ok(av && av.checked && av.disabled && /\(Roster Hub\)/.test(av.text), '1: the hub\'s absence shows checked, locked and named (' + JSON.stringify(av) + ')');
  ok(bx.filter(b => b.name !== 'Avery Stone').every(b => !b.checked && !b.disabled),
    '1: no other box is touched (no-call changes no group; yesterday\'s absence is over)');
  let note = await g.$eval('#hub-flag-note', el => ({ hidden: el.hidden, text: el.textContent }));
  ok(!note.hidden && /Avery Stone/.test(note.text) && !/Blake|Casey/.test(note.text) && /Class Roster Hub/.test(note.text),
    '1: the note names who is left out and where to change it (' + note.text + ')');
  eq((await g.textContent('#name-count')).trim(), '6 names · 1 absent today', '1: the count says so');

  const placed = [];
  for (let i = 0; i < 5; i++) {
    await g.click(i === 0 ? '#generate-btn' : '#regenerate-btn');
    await settle(g, 200);
    placed.push(await g.textContent('#results'));
  }
  ok(placed.every(t => !/Avery Stone/.test(t)), '2: five real groupings never place the absent student');
  ok(placed.every(t => ['Blake Rivers', 'Casey Lund', 'Drew Hale', 'Emery Fox', 'Finley Moss'].every(n => t.includes(n))),
    '2: and always place the other five, the no-call student and yesterday\'s absentee among them');
  ok(!/"absentNames":\[[^\]]*Avery/.test(await ownValues(g)), '2: the absence is not written into the config\'s absentNames');

  await setFlags({ version: 1, flags: { 's-blake': { noCall: true } } });
  await settle(g, 400);
  bx = await boxes();
  ok(bx.every(b => !b.checked && !b.disabled), '3: clearing the absence in another tab frees the box, no reload');
  ok(await g.$eval('#hub-flag-note', el => el.hidden), '3: and the note goes');
  eq((await g.textContent('#name-count')).trim(), '6 names', '3: and the count');

  await setFlags(FLAGS);
  await settle(g, 400);
  await axe(g, '#absent-wrap', '4: the absent list and its note');

  await g.fill('#names-input', 'Avery Ston\nBlake Rivers\nZed Quill');
  await settle(g, 200);
  bx = await boxes();
  ok(bx.every(b => !b.checked && !b.disabled), '5: a name on no roster is not matched to a flagged student');
  ok(await g.$eval('#hub-flag-note', el => el.hidden), '5: and no note');
  eq(g.__errs, [], '002 raised no page or console error');

  /* ── 022 ─────────────────────────────────────────────────────────── */
  console.log('022 Lab Group & Role Randomizer');
  const l = await ctx.newPage();
  const lErrs = [];
  l.on('pageerror', e => lErrs.push(String(e)));
  await l.route('**/*', r => (r.request().url().startsWith(BASE) || /^(data|blob|about):/.test(r.request().url()) ? r.continue() : r.abort()));
  await l.goto(URL_022, { waitUntil: 'networkidle' });
  await settle(l, 400);
  await l.selectOption('#rosterHubSelect', 'Period 3');
  await l.click('#rosterHubLoadBtn');
  await settle(l, 300);
  note = await l.$eval('#hub-flag-note', el => ({ hidden: el.hidden, text: el.textContent }));
  ok(!note.hidden && /Avery Stone/.test(note.text) && !/Blake|Casey/.test(note.text), '6: the note names the absent student before a shuffle (' + note.text + ')');
  ok(/1 absent today/.test(await l.textContent('#name-count')), '6: the count says so');

  await l.click('#shuffleBtn');
  await settle(l, 300);
  const res = await l.textContent('#resultsArea');
  ok(!/Avery Stone/.test(res) && ['Blake Rivers', 'Casey Lund', 'Drew Hale', 'Emery Fox', 'Finley Moss'].every(n => res.includes(n)),
    '7: the shuffle leaves the absent student out and groups the other five');
  ok(/Left out 1 student marked absent today in Class Roster Hub: Avery Stone/.test(await l.textContent('#warnArea')), '7: and says so');

  await setFlags({ version: 1, flags: { 's-avery': { absent: TODAY }, 's-drew': { absent: TODAY } } });
  await settle(l, 400);
  const drew = await l.$eval('#resultsArea input[data-absent-name="Drew Hale"]', i => {
    const li = i.closest('li');
    return { checked: i.checked, disabled: i.disabled, row: li.className, role: li.querySelector('.role').textContent };
  });
  ok(drew.checked && drew.disabled && /absent-row/.test(drew.row) && drew.role === 'Absent (Roster Hub)',
    '8: a student marked absent after the shuffle shows absent and locked, no reload (' + JSON.stringify(drew) + ')');
  const handed = await l.$$eval('#resultsArea .group-card', cs => {
    const c = cs.find(x => x.querySelector('input[data-absent-name="Drew Hale"]'));
    return [...c.querySelectorAll('li')].filter(li => !li.classList.contains('absent-row')).map(li => li.querySelector('.role').textContent);
  });
  ok(handed.some(r => / \+ /.test(r)) || handed.length === 0, '8: the role is handed to a groupmate (' + handed.join(' | ') + ')');
  ok(!/"absent":\[[^\]]*Drew/.test(await ownValues(l)), '8: the absence is not written into the saved state.absent');
  await axe(l, '#resultsArea .groups-grid', '9: the groups with a hub absence');
  eq(lErrs, [], '022 raised no page error');

  /* ── 010 ─────────────────────────────────────────────────────────── */
  console.log('010 Command Center');
  const c = await ctx.newPage();
  const cErrs = [];
  c.on('pageerror', e => cErrs.push(String(e)));
  await c.route('**/*', r => (r.request().url().startsWith(BASE) || /^(data|blob|about):/.test(r.request().url()) ? r.continue() : r.abort()));
  await c.goto(URL_010, { waitUntil: 'networkidle' });
  await c.evaluate(f => {
    localStorage.setItem('gvb-command-center:settings', JSON.stringify({ rosterName: 'Period 3' }));
    localStorage.setItem('crh_flags_v1', JSON.stringify(f));
  }, FLAGS);
  await c.reload({ waitUntil: 'networkidle' });
  await settle(c, 500);
  const rows = () => c.$$eval('#rosterList li', ls => ls.map(li => {
    const i = li.querySelector('input');
    return { name: i.dataset.name, checked: i.checked, disabled: i.disabled, cls: li.className, text: li.textContent };
  }));
  let rs = await rows();
  const ra = rs.find(r => r.name === 'Avery Stone'), rb = rs.find(r => r.name === 'Blake Rivers');
  ok(ra && ra.checked && ra.disabled && /excluded/.test(ra.cls) && /absent \(Roster Hub\)/.test(ra.text), '10: the absent student is listed absent and locked');
  ok(rb && !rb.checked && !rb.disabled && /nocall/.test(rb.cls) && /no cold call/.test(rb.text), '10: the no-call student is listed and labelled');
  ok(rs.filter(r => !/Avery|Blake/.test(r.name)).every(r => !r.checked && !/absent|cold/.test(r.text)), '10: nobody else is marked, yesterday\'s absentee included');
  const count = await c.textContent('#rosterCount');
  ok(/1 absent today/.test(count) && /1 not cold called/.test(count), '10: the count says both (' + count + ')');
  note = await c.$eval('#rosterFlagNote', el => ({ hidden: el.hidden, text: el.textContent }));
  ok(!note.hidden && /absent today: Avery Stone/.test(note.text) && /not cold called: Blake Rivers/.test(note.text), '10: the note names both (' + note.text + ')');

  const picks = [];
  for (let i = 0; i < 12; i++) { await c.click('#pickBtn'); picks.push((await c.textContent('#pickedName')).trim()); }
  ok(picks.every(p => ['Casey Lund', 'Drew Hale', 'Emery Fox', 'Finley Moss'].includes(p)), '11: twelve real picks land on neither (' + picks.join(', ') + ')');
  const remote = [];
  for (let i = 0; i < 8; i++) {
    await c.evaluate(() => window.__ccApplyRemoteCommand({ cmd: 'next_student' }));
    remote.push((await c.textContent('#pickedName')).trim());
  }
  ok(remote.every(p => !/Avery|Blake/.test(p)), '11: nor do eight picks from the phone remote (' + remote.join(', ') + ')');

  await c.evaluate(() => document.body.classList.add('projector'));
  ok(await c.$eval('#rosterFlagNote', el => getComputedStyle(el).display === 'none'), '12: the note is not shown on the projector');
  await c.evaluate(() => document.body.classList.remove('projector'));

  await axe(c, '#rosterList, #rosterFlagNote, #rosterCount', '13: the Quick Call list, count and note');

  await setFlags({ version: 1, flags: {} });
  await settle(c, 400);
  rs = await rows();
  ok(rs.every(r => !r.disabled && !/absent \(|cold call/.test(r.text)), '14: clearing the flags in another tab reaches the list, no reload');
  ok(await c.$eval('#rosterFlagNote', el => el.hidden), '14: and the note goes');
  eq(cErrs, [], '010 raised no page error');
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('Failures:\n  ' + fails.join('\n  ')); process.exit(1); }
