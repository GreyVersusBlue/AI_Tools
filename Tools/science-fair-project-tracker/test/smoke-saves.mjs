// smoke-saves.mjs — 073's named saved trackers: each holds a whole cohort
// (students, milestones, ticks, notes) in the tracker key's Store envelope at
// version 2.
//
//   node Tools/science-fair-project-tracker/test/smoke-saves.mjs        (port 8500)
//
// Controls follow 063's (a chooser, + New, Duplicate, Rename, Delete behind a
// confirm). What matters most: the tracker a teacher already has comes back as
// the first save with nothing lost, cohorts never leak into each other, and
// Delete of the last one leaves a usable tool. Every assertion reads the page
// or the disk. Names are made up. Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8500;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGE = BASE + '/Tools/073-science-fair-project-tracker.html';
const KEY = 'sfpt_tracker_v1';

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Science Fair Project Tracker — saved trackers');

const server = await serve(PORT);
const browser = await launch();

async function open(seed, url = PAGE) {
  const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
  page.__answers = [];
  page.__dialogs = [];
  page.on('dialog', async d => {
    page.__dialogs.push({ type: d.type(), message: d.message(), def: d.defaultValue() });
    const a = page.__answers.length ? page.__answers.shift() : null;
    if (d.type() === 'prompt') { if (a === null) await d.dismiss(); else await d.accept(String(a)); }
    else { if (a) await d.accept(); else await d.dismiss(); }
  });
  if (seed !== undefined) await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, [KEY, JSON.stringify(seed)]);
  await page.goto(url, { waitUntil: 'networkidle' });
  await settle(page, 250);
  return page;
}
const doc = page => page.evaluate(k => { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; }, KEY);
const names = page => page.$$eval('#trackerSelect option', os => os.map(o => o.textContent));
const selected = page => page.$eval('#trackerSelect', s => s.selectedOptions[0] && s.selectedOptions[0].textContent);
const roster = page => page.$eval('#rosterInput', e => e.value);
const msNames = page => page.$$eval('[data-mname]', els => els.map(e => e.value));
const msg = page => page.$eval('#trackerMsg', e => e.textContent);
const enabled = (page, id) => page.$eval('#' + id, e => !e.disabled);
const ticks = page => page.$$eval('#progressTable input[type=checkbox]:checked', els => els.map(e => e.getAttribute('data-student') + '|' + e.getAttribute('data-milestone')));
const clean = async (page, tag) => {
  eq(page.__errs.length, 0, `${tag}: no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  eq(page.__blocked.length, 0, `${tag}: nothing left the site`);
  await page.context().close();
};
async function setRoster(page, text) {
  await page.fill('#rosterInput', text);
  await page.click('#saveRosterBtn');
  await settle(page, 80);
}
async function say(page, answers, id) {
  page.__answers.push(...answers);
  await page.click('#' + id);
  await settle(page, 120);
}

const LEGACY = {
  roster: ['Ada Quill', 'Bram Finch'],
  milestones: [{ id: 'm1', name: 'Question', due: '2026-10-01' }, { id: 'm2', name: 'Board', due: '' }],
  done: { 'Ada Quill|m1': true },
  notes: { 'Bram Finch|m1': 'needs a variable' },
};

/* ── 1. An untouched page stores nothing and is a usable empty tool ───── */
{
  const page = await open();
  eq(await names(page), ['No saved trackers yet — edit below to start one'], '1: the chooser says nothing is saved');
  eq(await doc(page), null, '1: an untouched page wrote nothing');
  ok(!(await enabled(page, 'trackerSelect')), '1: the chooser is disabled with no saves');
  for (const id of ['dupTrackerBtn', 'renameTrackerBtn', 'deleteTrackerBtn'])
    ok(!(await enabled(page, id)), `1: ${id} is disabled with nothing to act on`);
  ok(await enabled(page, 'newTrackerBtn'), '1: + New is available');
  eq((await msNames(page)).length, 6, '1: the six default milestones show');
  eq(await page.$eval('label[for=trackerSelect]', e => e.textContent), 'Saved tracker', '1: the chooser has a label');
  await setRoster(page, 'Cy Marsh\nDot Lane');
  const d = await doc(page);
  eq(d && d.v, 2, '1: the first edit writes a version-2 envelope');
  eq(d && d.data.list.length, 1, '1: and one saved tracker');
  eq(d && d.data.list[0].name, 'My tracker', '1: called My tracker');
  eq(d && d.data.list[0].roster, ['Cy Marsh', 'Dot Lane'], '1: holding the roster typed');
  eq(await names(page), ['My tracker'], '1: the chooser shows it');
  ok(await enabled(page, 'deleteTrackerBtn'), '1: Delete is enabled once there is a save');
  await clean(page, '1');
}

/* ── 2. The tracker a teacher already has becomes the first save ──────── */
{
  const page = await open(LEGACY);
  eq(await names(page), ['My tracker'], '2: a pre-saves tracker is one named tracker');
  eq(await roster(page), 'Ada Quill\nBram Finch', '2: its students show');
  eq(await msNames(page), ['Question', 'Board'], '2: and its milestones');
  eq(await ticks(page), ['Ada Quill|m1'], '2: and its ticks');
  ok((await page.$eval('#progressTable', e => e.textContent)).includes('Ada Quill'), '2: the grid shows it');
  ok(await page.$eval('[data-note-student="Bram Finch"][data-note-milestone="m1"]', e => e.classList.contains('has-note')), '2: and its note');
  ok(await page.$eval('td.overdue', e => !!e), '2: the overdue cell still shows');
  eq((await doc(page)).v, undefined, '2: loading rewrote nothing on disk (still the old object)');
  await page.check('input[data-student="Bram Finch"][data-milestone="m2"]');
  const d = await doc(page);
  eq(d.v, 2, '2: the first edit upgrades the envelope');
  const t = d.data.list[0];
  eq([t.roster, t.milestones.map(m => m.id), t.notes], [LEGACY.roster, ['m1', 'm2'], LEGACY.notes], '2: roster, milestones and notes all kept');
  eq(t.done, { 'Ada Quill|m1': true, 'Bram Finch|m2': true }, '2: ticks kept and the new one added');
  await clean(page, '2');
}

/* ── 3. New, switch: cohorts stay apart ──────────────────────────────── */
{
  const page = await open(LEGACY);
  await say(page, ['Period 3'], 'newTrackerBtn');
  eq(await names(page), ['My tracker', 'Period 3'], '3: + New adds a named tracker');
  eq(await selected(page), 'Period 3', '3: and opens it');
  eq(await roster(page), '', '3: with an empty roster');
  eq((await msNames(page)).length, 6, '3: and the default milestones');
  eq(await ticks(page), [], '3: and no ticks');
  eq(await msg(page), 'Started “Period 3”, empty.', '3: it says so');
  await setRoster(page, 'Eve Hart\nFay Dunn');
  await page.fill('[data-mname]', 'Hypothesis');
  await page.check('input[data-student="Eve Hart"]');
  const eveTicks = await ticks(page);
  eq(eveTicks.length, 1, '3: one tick in the new tracker');
  await page.selectOption('#trackerSelect', { label: 'My tracker' });
  await settle(page, 100);
  eq(await roster(page), 'Ada Quill\nBram Finch', '3: switching back restores the first roster');
  eq(await msNames(page), ['Question', 'Board'], '3: and its milestones');
  eq(await ticks(page), ['Ada Quill|m1'], '3: and only its ticks');
  eq(await msg(page), 'Opened “My tracker”.', '3: switching says so');
  const d = await doc(page);
  eq(d.data.list.map(t => t.roster.length), [2, 2], '3: both cohorts are on disk');
  eq(d.data.list[1].milestones[0].name, 'Hypothesis', '3: the second kept its own milestone edit');
  eq(d.data.currentId, d.data.list[0].id, '3: the current pick is saved');
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 200);
  eq(await selected(page), 'My tracker', '3: a reload reopens the last tracker');
  await page.click('#progressTable input[data-student="Bram Finch"][data-milestone="m1"]');
  await page.selectOption('#trackerSelect', { label: 'Period 3' });
  await settle(page, 100);
  eq(await ticks(page), eveTicks, '3: a tick in one tracker never reaches the other');
  await say(page, [null], 'newTrackerBtn');
  eq(await names(page), ['My tracker', 'Period 3'], '3: cancelling the name prompt adds nothing');
  await clean(page, '3');
}

/* ── 4. Duplicate, Rename ───────────────────────────────────────────── */
{
  const page = await open(LEGACY);
  await say(page, [null], 'dupTrackerBtn');
  eq(await names(page), ['My tracker'], '4: cancelling Duplicate adds nothing');
  await say(page, ['  '], 'dupTrackerBtn');
  eq(await names(page), ['My tracker', 'My tracker (copy)'], '4: a blank name falls back to “(copy)”');
  eq(page.__dialogs.at(-1).def, 'My tracker (copy)', '4: the prompt offered that name');
  eq(await roster(page), 'Ada Quill\nBram Finch', '4: the copy has the students');
  eq(await ticks(page), ['Ada Quill|m1'], '4: and the ticks');
  await page.check('input[data-student="Bram Finch"][data-milestone="m2"]');
  await page.selectOption('#trackerSelect', { label: 'My tracker' });
  await settle(page, 100);
  eq(await ticks(page), ['Ada Quill|m1'], '4: editing the copy leaves the original alone');
  const d = await doc(page);
  eq(d.data.list[1].notes, LEGACY.notes, '4: the copy kept the notes');
  ok(d.data.list[0].id !== d.data.list[1].id, '4: with an id of its own');
  await say(page, ['Period 5 fair'], 'renameTrackerBtn');
  eq(await names(page), ['Period 5 fair', 'My tracker (copy)'], '4: Rename renames the open one');
  eq(await msg(page), 'Renamed to “Period 5 fair”.', '4: and says so');
  await say(page, ['   '], 'renameTrackerBtn');
  eq(await selected(page), 'Period 5 fair', '4: a blank rename keeps the name');
  await say(page, [null], 'renameTrackerBtn');
  eq(await selected(page), 'Period 5 fair', '4: cancelling Rename keeps the name');
  eq((await doc(page)).data.list[0].name, 'Period 5 fair', '4: the rename is on disk');
  await clean(page, '4');
}

/* ── 5. Delete asks, removes one, and the last leaves a usable tool ──── */
{
  const page = await open(LEGACY);
  await say(page, ['Second'], 'newTrackerBtn');
  await setRoster(page, 'Gus Hale');
  await say(page, [false], 'deleteTrackerBtn');
  eq(await names(page), ['My tracker', 'Second'], '5: declining the confirm deletes nothing');
  const q = page.__dialogs.at(-1);
  eq(q.type, 'confirm', '5: Delete asks first');
  ok(q.message.includes('Second') && /students/.test(q.message), `5: naming the tracker and what goes with it: ${q.message}`);
  await say(page, [true], 'deleteTrackerBtn');
  eq(await names(page), ['My tracker'], '5: confirming removes it');
  eq(await selected(page), 'My tracker', '5: and opens a neighbour');
  eq(await roster(page), 'Ada Quill\nBram Finch', '5: with that neighbour\'s students');
  eq((await doc(page)).data.list.length, 1, '5: on disk too');
  await say(page, [true], 'deleteTrackerBtn');
  eq(await names(page), ['No saved trackers yet — edit below to start one'], '5: deleting the last one leaves the empty state');
  ok(!(await enabled(page, 'deleteTrackerBtn')), '5: with Delete disabled');
  eq((await msNames(page)).length, 6, '5: and a usable tracker with default milestones');
  eq(await roster(page), '', '5: and no students');
  ok((await msg(page)).includes('Nothing is saved now'), '5: it says nothing is saved');
  await setRoster(page, 'Hal Reed');
  eq(await names(page), ['My tracker'], '5: editing again starts a new first tracker');
  eq((await doc(page)).data.list[0].roster, ['Hal Reed'], '5: with only the new work');
  await clean(page, '5');
}

/* ── 5b. Delete opens the previous tracker, or the next when it was first ─ */
{
  const mk = (id, name) => ({ id, name, roster: [name + ' Kid'], milestones: [{ id: 'a', name: 'Only', due: '' }], done: {}, notes: {} });
  const page = await open({ v: 2, data: { list: [mk('t1', 'One'), mk('t2', 'Two'), mk('t3', 'Three')], currentId: 't2' } });
  await say(page, [true], 'deleteTrackerBtn');
  eq(await selected(page), 'One', '5b: deleting a middle tracker opens the one before it');
  await say(page, [true], 'deleteTrackerBtn');
  eq(await selected(page), 'Three', '5b: deleting the first opens the next');
  await clean(page, '5b');
}

/* ── 6. Print is per tracker, and carries its name ──────────────────── */
{
  const page = await open(LEGACY);
  await page.evaluate(() => { window.print = () => {}; });
  await say(page, ['Period 2'], 'newTrackerBtn');
  await setRoster(page, 'Ike Moss');
  await page.click('#printBtn');
  let html = await page.$eval('#printArea', e => e.innerHTML);
  ok(html.includes('Period 2'), '6: the report names its tracker');
  ok(html.includes('Ike Moss') && !html.includes('Ada Quill'), '6: and holds only that cohort');
  await page.selectOption('#trackerSelect', { label: 'My tracker' });
  await settle(page, 100);
  await page.click('#printBtn');
  html = await page.$eval('#printArea', e => e.innerHTML);
  ok(html.includes('Ada Quill') && html.includes('needs a variable') && !html.includes('Ike Moss'), '6: switching changes what prints');
  ok(html.includes('My tracker'), '6: and the name');
  await clean(page, '6');
  const fresh = await open();
  await fresh.evaluate(() => { window.print = () => {}; });
  await setRoster(fresh, 'Jo Pike');
  await fresh.click('#printBtn');
  ok(!(await fresh.$eval('#printArea', e => e.innerHTML)).includes('undefined'), '6: a first tracker prints cleanly');
  await clean(fresh, '6b');
}

/* ── 7. Share carries the open tracker's milestones, into the open one ── */
const shareLink = async page => {
  await page.click('#shareBtn');
  await settle(page, 250);
  return page.evaluate(() => {
    let captured = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: { writeText: t => { captured = t; return Promise.resolve(); } },
    });
    document.querySelector('.share-sheet button[data-share="copy"]').click();
    return new Promise(r => setTimeout(() => { window.Share.close(); r(captured); }, 60));
  });
};
{
  const page = await open(LEGACY);
  await say(page, ['Other cohort'], 'newTrackerBtn');
  await setRoster(page, 'Kit Vale');
  await page.fill('[data-mname]', 'Unique Milestone');
  const link = await shareLink(page);
  const payload = await page.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('milestones')), link);
  eq(payload.milestones[0].name, 'Unique Milestone', '7: the link carries the OPEN tracker\'s milestones');
  ok(!JSON.stringify(payload).includes('Ada Quill') && !JSON.stringify(payload).includes('Kit Vale'), '7: and no student name from any tracker');
  ok(!('list' in payload) && !('roster' in payload), '7: and no other tracker');
  await clean(page, '7');

  // Arrive on a device with two trackers: lands in the open one, asks first.
  const two = { v: 2, data: { list: [
    { id: 't1', name: 'Alpha', roster: ['Pia Dell'], milestones: [{ id: 'q', name: 'Old', due: '' }], done: { 'Pia Dell|q': true }, notes: {} },
    { id: 't2', name: 'Beta', roster: ['Rex Dale'], milestones: [{ id: 'r', name: 'Beta Only', due: '' }], done: {}, notes: {} }], currentId: 't1' } };
  const enc = await (async () => { const pg = await open(); const e = await pg.evaluate(() => window.StateLink.encodeState({ milestones: [{ id: 'z', name: 'Old', due: '2026-12-01' }, { id: 'y', name: 'Fresh', due: '' }] })); await pg.context().close(); return e; })();
  const arrive = PAGE + '?milestones=' + encodeURIComponent(enc);
  const declined = await open(two, arrive);
  eq(declined.__dialogs.length, 1, '7: an arriving link on saved work asks');
  ok(declined.__dialogs[0].message.includes('Alpha'), '7: naming the tracker it would change: ' + declined.__dialogs[0].message);
  eq(await msNames(declined), ['Old'], '7: declining keeps the open tracker as it was');
  eq((await doc(declined)).data.list[1].milestones.map(m => m.name), ['Beta Only'], '7: and the other untouched');
  await clean(declined, '7b');
  const acceptPage = await prepPage(browser, BASE, { width: 1200, height: 900 });
  acceptPage.on('dialog', d => d.accept());
  await acceptPage.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, [KEY, JSON.stringify(two)]);
  await acceptPage.goto(arrive, { waitUntil: 'networkidle' });
  await settle(acceptPage, 250);
  eq(await msNames(acceptPage), ['Old', 'Fresh'], '7: accepting replaces the open tracker\'s milestones');
  eq(await ticks(acceptPage), ['Pia Dell|q'], '7: keeping the tick on the milestone that matched by name');
  const d = await doc(acceptPage);
  eq(d.data.list[0].milestones.map(m => m.id).slice(0, 1), ['q'], '7: the matching milestone kept its local id');
  eq(d.data.list[1].milestones.map(m => m.name), ['Beta Only'], '7: the other tracker is untouched');
  eq(d.data.list[0].roster, ['Pia Dell'], '7: students stay');
  await clean(acceptPage, '7c');
  const fresh = await open(undefined, arrive);
  eq(await msNames(fresh), ['Old', 'Fresh'], '7: on an empty device the link opens a tracker without asking');
  eq(fresh.__dialogs.length, 0, '7: with no dialog');
  eq(await names(fresh), ['My tracker'], '7: saved as the first tracker');
  await clean(fresh, '7d');
}

/* ── 8. Several saved trackers, an unreadable doc, a duplicated id ───── */
{
  const mk = (id, name, who) => ({ id, name, roster: [who], milestones: [{ id: 'a', name: 'Only', due: '' }], done: {}, notes: {} });
  const page = await open({ v: 2, data: { list: [mk('t1', 'Alpha', 'Lu Wynn'), mk('t2', 'Beta', 'Mo Ash'), mk('t1', 'Dup', 'Ned Cole')], currentId: 't2' } });
  eq(await names(page), ['Alpha', 'Beta'], '8: a repeated id is dropped');
  eq(await selected(page), 'Beta', '8: the saved current pick opens');
  eq(await roster(page), 'Mo Ash', '8: with its students');
  await clean(page, '8');
  const bad = await open({ v: 2, data: { nope: true } });
  eq(await names(bad), ['No saved trackers yet — edit below to start one'], '8: an unreadable doc opens the empty tool');
  eq((await doc(bad)).data.nope, true, '8: and is left on disk until a write');
  await clean(bad, '8b');
  const noCur = await open({ v: 2, data: { list: [mk('t9', 'Zed', 'Ola Reid')], currentId: 'gone' } });
  eq(await selected(noCur), 'Zed', '8: a dangling current pick falls back to the first');
  await clean(noCur, '8c');
}

await browser.close();
server.close && server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
