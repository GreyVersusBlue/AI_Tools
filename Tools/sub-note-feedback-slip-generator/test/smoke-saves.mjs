// smoke-saves.mjs — 076's named saved slips: each holds its own prompts, copy
// count, class or period and "call me" box, in the key the tool has always used.
//
//   node Tools/sub-note-feedback-slip-generator/test/smoke-saves.mjs        (port 8507)
//
// Controls follow 063, 071 and 073 (a chooser, + New, Duplicate, Rename, Delete
// behind a confirm; Delete never removes the last one). What matters most:
//   - the single slip a teacher already has loads, previews, prints and shares
//     exactly as before, and the saved string is not rewritten by loading it
//     (golden-old-slips.json, recorded from the page before this change)
//   - slips never leak into each other
//   - a page from before saved slips, reading the top level of the key, still
//     finds the slip that was open
//   - a share link carries the open slip only, and an old link opens as it did
// Every assertion reads the page or the disk. Names are made up. Exits 1 on
// any failure.

import fs from 'node:fs';
import { serve, launch, prepPage, settle, downloadText } from '../../board-check/harness.mjs';
import { FIXTURES, GOLDEN_FILE } from './_golden-fixtures.mjs';

const PORT = 8507;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGE = BASE + '/Tools/076-sub-note-feedback-slip-generator.html';
const KEY = 'snfs_slip_v1';

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Sub Note / Feedback Slip Generator — saved slips');

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
  await page.addInitScript(() => { window.print = () => {}; });
  if (seed !== undefined && seed !== null) {
    const raw = typeof seed === 'string' ? seed : JSON.stringify(seed);
    await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, [KEY, raw]);
  }
  await page.goto(url, { waitUntil: 'networkidle' });
  await settle(page, 250);
  return page;
}
const raw = page => page.evaluate(k => localStorage.getItem(k), KEY);
const doc = async page => { const r = await raw(page); return r ? JSON.parse(r) : null; };
const names = page => page.$$eval('#setSelect option', os => os.map(o => o.textContent));
const selected = page => page.$eval('#setSelect', s => s.selectedOptions[0] && s.selectedOptions[0].textContent);
const promptTexts = page => page.$$eval('[data-prompt]', els => els.map(e => e.value));
const fields = page => page.evaluate(() => ({
  copyCount: document.getElementById('copyCount').value,
  classPeriod: document.getElementById('classPeriod').value,
  urgency: document.getElementById('urgencyToggle').checked,
}));
const msg = page => page.$eval('#setMsg', e => e.textContent);
const enabled = (page, id) => page.$eval('#' + id, e => !e.disabled);
const clean = async (page, tag) => {
  eq(page.__errs.length, 0, `${tag}: no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  eq(page.__blocked.length, 0, `${tag}: nothing left the site`);
  await page.context().close();
};
async function say(page, answers, id) {
  page.__answers.push(...answers);
  await page.click('#' + id);
  await settle(page, 120);
}
async function setField(page, sel, value) {
  await page.fill(sel, value);
  await settle(page, 60);
}
async function sheet(page) {
  await page.click('#printBtn');
  await settle(page, 120);
  return page.$eval('#printArea', e => e.innerHTML);
}
/* Prompt ids and the export time are made on the day; the golden and the page
   agree on everything else. */
const norm = text => {
  const o = JSON.parse(text);
  if (o.aplp) delete o.aplp.exported;
  if (o.state && o.state.prompts) o.state.prompts.forEach(p => { if (/^p[a-z0-9]{8,}$/.test(p.id)) p.id = 'ID'; });
  return JSON.stringify(o);
};
async function shared(page) {
  await page.click('#shareBtn');
  await settle(page, 200);
  const text = await downloadText(page, '.share-sheet button[data-share="download"]');
  await page.keyboard.press('Escape');
  return text;
}

const P = (...texts) => texts.map((text, i) => ({ id: 'q' + i, text }));
const LEGACY = { copyCount: 3, prompts: P('Which table was loudest?', 'Did the quiz finish?'), classPeriod: '4th Period', urgencyBox: false };

/* ── 1. The golden: what the one-slip page did, byte for byte ─────────── */
{
  const golden = JSON.parse(fs.readFileSync(GOLDEN_FILE, 'utf8'));
  eq(Object.keys(golden), FIXTURES.map(f => f.name), '1: the golden has every fixture');
  for (const f of FIXTURES) {
    const g = golden[f.name];
    const seed = f.saved ? JSON.stringify(f.saved) : null;
    const page = await open(seed);
    const tag = '1 (' + f.name + ')';
    eq(await page.evaluate(() => ({
      copyCount: document.getElementById('copyCount').value, classPeriod: document.getElementById('classPeriod').value,
      urgency: document.getElementById('urgencyToggle').checked,
      prompts: [...document.querySelectorAll('[data-prompt]')].map(e => e.value) })), g.ui, `${tag}: the fields and prompts load as before`);
    eq((await raw(page)) === seed, g.diskAfterLoad, `${tag}: loading leaves the saved string byte for byte as it was`);
    eq(await page.$$eval('.prompt-row', rows => rows.length), g.ui.prompts.length, `${tag}: one row per prompt`);
    eq(await sheet(page), g.sheet, `${tag}: the printed sheet is the same HTML as before`);
    eq(norm(await shared(page)), norm(g.share), `${tag}: the share payload is the one the old page made`);
    await clean(page, tag);
  }
}

/* ── 2. An untouched page stores nothing and is a usable tool ─────────── */
{
  const page = await open();
  eq(await names(page), ['My slip'], '2: one slip is shown, as the draft');
  eq(await raw(page), null, '2: an untouched page wrote nothing');
  eq((await promptTexts(page)).length, 4, '2: the four default prompts show');
  ok(!(await enabled(page, 'deleteSetBtn')), '2: Delete is off while there is only one slip');
  for (const id of ['newSetBtn', 'dupSetBtn', 'renameSetBtn', 'setSelect', 'starterSelect'])
    ok(await enabled(page, id), `2: ${id} is available`);
  eq(await page.$eval('label[for=setSelect]', e => e.textContent), 'Saved slip', '2: the chooser has a label');
  eq(await page.$eval('label[for=starterSelect]', e => e.textContent), 'Start a new slip from', '2: and the starter list has one');
  eq(await page.$eval('#setMsg', e => [e.getAttribute('role'), e.getAttribute('aria-live')]), ['status', 'polite'], '2: messages are announced');
  eq(await page.$$eval('#starterSelect option', os => os.map(o => o.textContent)), ['General', 'Lab day', 'Testing day', 'One empty prompt'], '2: four starters');
  await setField(page, '#classPeriod', '2nd');
  const d = await doc(page);
  eq(d && d.v, 2, '2: the first edit writes a version-2 document');
  eq(d && d.sets.length, 1, '2: with one saved slip');
  eq(d && d.sets[0].name, 'My slip', '2: called My slip');
  eq(d && d.sets[0].classPeriod, '2nd', '2: holding the class period typed');
  eq(d && d.currentId, d && d.sets[0].id, '2: and it is the current one');
  eq(await names(page), ['My slip'], '2: the chooser shows it');
  ok(!(await enabled(page, 'deleteSetBtn')), '2: Delete stays off with one saved slip');
  await clean(page, '2');
}

/* ── 3. The slip a teacher already has becomes the first one ──────────── */
{
  const page = await open(LEGACY);
  eq(await names(page), ['My slip'], '3: a pre-saves slip is one named slip');
  eq(await promptTexts(page), ['Which table was loudest?', 'Did the quiz finish?'], '3: its prompts show');
  eq(await fields(page), { copyCount: '3', classPeriod: '4th Period', urgency: false }, '3: and its settings');
  eq(await raw(page), JSON.stringify(LEGACY), '3: loading rewrote nothing on disk');
  await page.fill('[data-prompt]', 'Which row was loudest?');
  const d = await doc(page);
  eq(d.v, 2, '3: the first edit upgrades the document');
  eq([d.sets[0].copyCount, d.sets[0].classPeriod, d.sets[0].urgencyBox, d.sets[0].prompts.map(p => p.text)],
    [3, '4th Period', false, ['Which row was loudest?', 'Did the quiz finish?']], '3: everything kept, the edit added');
  eq(d.sets[0].prompts.map(p => p.id), ['q0', 'q1'], '3: prompt ids kept');
  await clean(page, '3');
}

/* ── 4. The top level of the key stays readable to an older page ──────── */
{
  const page = await open(LEGACY);
  // what the one-slip page did on load, run on the disk text
  const oldPageReads = () => page.evaluate(k => {
    const saved = JSON.parse(localStorage.getItem(k) || 'null');
    return saved && Array.isArray(saved.prompts) && saved.prompts.length
      ? { copyCount: saved.copyCount, classPeriod: saved.classPeriod, urgencyBox: saved.urgencyBox, prompts: saved.prompts.map(p => p.text) } : null;
  }, KEY);
  await page.fill('[data-prompt]', 'Edited first');
  eq(await oldPageReads(), { copyCount: 3, classPeriod: '4th Period', urgencyBox: false, prompts: ['Edited first', 'Did the quiz finish?'] },
    '4: an older page reading the key finds the open slip');
  await page.selectOption('#starterSelect', 'lab');
  await say(page, ['Lab day'], 'newSetBtn');
  eq((await oldPageReads()).prompts.length, 4, '4: after + New the top level is the new open slip');
  await page.selectOption('#setSelect', { label: 'My slip' }); await settle(page, 120);
  eq((await oldPageReads()).prompts, ['Edited first', 'Did the quiz finish?'], '4: and follows a switch back');
  eq((await oldPageReads()).classPeriod, '4th Period', '4: with its class period');
  await setField(page, '#copyCount', '7');
  eq((await oldPageReads()).copyCount, 7, '4: and an edit is mirrored to the top level');
  await clean(page, '4');
}

/* ── 5. + New: starters are chosen, never created unasked ─────────────── */
{
  const page = await open(LEGACY);
  eq((await doc(page)), JSON.parse(JSON.stringify(LEGACY)), '5: before any action there is only the one slip (nothing created unasked)');
  const starters = {
    general: { name: 'General', all: ['What worked well today?', 'What didn’t go as planned?', 'Any names or notes I should know for tomorrow?', 'Anything else the teacher should know?'] },
    lab: { name: 'Lab day', all: ['Did every group finish the lab, and where did groups get stuck?', 'Were there any safety concerns or spills?', 'Was all equipment returned and the stations cleaned up?', 'Any names or notes I should know for tomorrow?'] },
    testing: { name: 'Testing day', all: ['Did everyone finish the test in the time given?', 'Did anyone need an accommodation, a break or a different seat?', 'Any concerns about how the test went?', 'Any names or notes I should know for tomorrow?'] },
    blank: { name: 'One empty prompt', all: [''] },
  };
  for (const id of Object.keys(starters)) {
    await page.selectOption('#starterSelect', id);
    const before = (await names(page)).length;
    await say(page, [''], 'newSetBtn');
    const dlg = page.__dialogs[page.__dialogs.length - 1];
    eq([dlg.type, dlg.message, dlg.def], ['prompt', 'Name for the new slip:', id === 'blank' ? 'New slip' : starters[id].name], `5: ${id}: the name prompt offers a default`);
    eq((await names(page)).length, before + 1, `5: ${id}: one slip is added`);
    eq((await selected(page)), id === 'blank' ? 'New slip' : starters[id].name, `5: ${id}: a blank name takes the default`);
    eq(await promptTexts(page), starters[id].all, `5: ${id}: the starter's prompts, word for word`);
    eq(await fields(page), { copyCount: '2', classPeriod: '', urgency: true }, `5: ${id}: with default settings, not the previous slip's`);
    ok((await msg(page)).includes('Started'), `5: ${id}: and says so: ${await msg(page)}`);
  }
  const d = await doc(page);
  eq(d.sets.map(s => s.name), ['My slip', 'General', 'Lab day', 'Testing day', 'New slip'], '5: five slips, in the order made');
  eq(d.sets[0].prompts.map(p => p.text), ['Which table was loudest?', 'Did the quiz finish?'], '5: the first slip is untouched by the others');
  eq(new Set(d.sets.flatMap(s => s.prompts.map(p => p.id))).size, 2 + 4 + 4 + 4 + 1, '5: no prompt id is shared between slips');
  // a cancelled name makes nothing
  const n = d.sets.length;
  await say(page, [null], 'newSetBtn');
  eq((await doc(page)).sets.length, n, '5: cancelling the name prompt adds nothing');
  // a typed name is trimmed and kept as text
  await page.selectOption('#starterSelect', 'testing');
  await say(page, ['  <b>Quiz</b> day  '], 'newSetBtn');
  eq(await selected(page), '<b>Quiz</b> day', '5: a name with markup is shown as text, trimmed');
  eq(await page.$$eval('#setSelect b', b => b.length), 0, '5: and builds no element');
  await clean(page, '5');
}

/* ── 6. + New on an untouched page keeps the draft ────────────────────── */
{
  const page = await open();
  await say(page, ['Second'], 'newSetBtn');
  const d = await doc(page);
  eq(d.sets.map(s => s.name), ['My slip', 'Second'], '6: the untouched draft is filed as My slip before the new one');
  eq(d.sets[0].prompts.length, 4, '6: with its four default prompts');
  eq(d.currentId, d.sets[1].id, '6: and the new one is open');
  await clean(page, '6');
}

/* ── 7. Slips hold their own everything ───────────────────────────────── */
{
  const page = await open(LEGACY);
  await page.selectOption('#starterSelect', 'lab');
  await say(page, ['Lab day'], 'newSetBtn');
  await setField(page, '#classPeriod', '6th');
  await setField(page, '#copyCount', '9');
  await page.uncheck('#urgencyToggle');
  await page.fill('[data-prompt] >> nth=0', 'Lab: who finished?');
  await page.click('#addPromptBtn');
  await page.fill('[data-prompt] >> nth=4', 'Lab: any spills?');
  await settle(page, 80);
  const lab = { f: await fields(page), p: await promptTexts(page) };
  eq(lab.f, { copyCount: '9', classPeriod: '6th', urgency: false }, '7: the lab slip holds what was set');
  await page.selectOption('#setSelect', { label: 'My slip' });
  await settle(page, 120);
  eq(await fields(page), { copyCount: '3', classPeriod: '4th Period', urgency: false }, '7: switching back shows the first slip\'s settings');
  eq(await promptTexts(page), ['Which table was loudest?', 'Did the quiz finish?'], '7: and its prompts');
  eq(await selected(page), 'My slip', '7: the chooser follows');
  ok((await msg(page)).includes('Opened'), '7: switching says what opened: ' + await msg(page));
  await page.check('#urgencyToggle');
  await page.click('[data-del]');   // delete the first prompt of My slip
  await settle(page, 80);
  await page.selectOption('#setSelect', { label: 'Lab day' });
  await settle(page, 120);
  eq({ f: await fields(page), p: await promptTexts(page) }, lab, '7: the lab slip is exactly as left, whatever My slip did');
  // each slip prints its own
  const html = await sheet(page);
  ok(html.includes('Lab: who finished?') && html.includes('6th') && !html.includes('loudest'), '7: print uses the open slip only');
  eq((html.match(/class="pk-half/g) || []).length, 9, '7: and its own copy count');
  eq((html.match(/slip-urgency/g) || []).length, 0, '7: and its own call-me setting');
  await clean(page, '7');
}

/* ── 8. The open slip is remembered ───────────────────────────────────── */
{
  const page = await open(LEGACY);
  await say(page, ['Testing day'], 'newSetBtn');
  await setField(page, '#classPeriod', 'Gym');
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 250);
  eq(await selected(page), 'Testing day', '8: a reload opens the slip that was open');
  eq((await fields(page)).classPeriod, 'Gym', '8: with its settings');
  eq((await names(page)), ['My slip', 'Testing day'], '8: and both are listed');
  await page.selectOption('#setSelect', { label: 'My slip' }); await settle(page, 80);
  await page.reload({ waitUntil: 'networkidle' }); await settle(page, 250);
  eq(await selected(page), 'My slip', '8: and the other after switching');
  await clean(page, '8');
}

/* ── 9. Duplicate ─────────────────────────────────────────────────────── */
{
  const page = await open(LEGACY);
  await say(page, [null], 'dupSetBtn');
  eq((await names(page)).length, 1, '9: cancelling Duplicate adds nothing');
  await say(page, [''], 'dupSetBtn');
  const dlg = page.__dialogs[page.__dialogs.length - 1];
  eq([dlg.type, dlg.message, dlg.def], ['prompt', 'Name for the duplicate:', 'My slip (copy)'], '9: the prompt offers a name');
  eq(await names(page), ['My slip', 'My slip (copy)'], '9: a blank name takes the default');
  eq(await promptTexts(page), ['Which table was loudest?', 'Did the quiz finish?'], '9: the copy has the same prompts');
  eq(await fields(page), { copyCount: '3', classPeriod: '4th Period', urgency: false }, '9: and the same settings');
  const before = await doc(page);
  const ids = before.sets.flatMap(s => s.prompts.map(p => p.id));
  eq(new Set(ids).size, 4, '9: prompt ids are new in the copy');
  await page.fill('[data-prompt] >> nth=0', 'Copy only');
  await setField(page, '#classPeriod', 'Copy period');
  await page.selectOption('#setSelect', { label: 'My slip' }); await settle(page, 80);
  eq(await promptTexts(page), ['Which table was loudest?', 'Did the quiz finish?'], '9: editing the copy leaves the original alone');
  eq((await fields(page)).classPeriod, '4th Period', '9: its settings too');
  await clean(page, '9');
}

/* ── 10. Rename ───────────────────────────────────────────────────────── */
{
  const page = await open(LEGACY);
  await say(page, ['Friday sub'], 'renameSetBtn');
  eq([page.__dialogs[0].message, page.__dialogs[0].def], ['Rename this slip:', 'My slip'], '10: the prompt shows the current name');
  eq(await names(page), ['Friday sub'], '10: renamed in the chooser');
  eq((await doc(page)).sets[0].name, 'Friday sub', '10: and on disk');
  ok((await msg(page)).includes('Friday sub'), '10: and said');
  await say(page, ['   '], 'renameSetBtn');
  eq(await names(page), ['Friday sub'], '10: a blank name keeps the old one');
  await say(page, [null], 'renameSetBtn');
  eq(await names(page), ['Friday sub'], '10: cancelling keeps it');
  eq((await doc(page)).sets[0].prompts.length, 2, '10: renaming touches nothing else');
  await clean(page, '10');
  const draft = await open();
  await say(draft, ['Kept'], 'renameSetBtn');
  eq([(await doc(draft)).sets.length, (await doc(draft)).sets[0].name], [1, 'Kept'], '10: renaming the untouched draft files it under the new name');
  await clean(draft, '10 draft');
}

/* ── 11. Delete: asks first, never removes the last one ───────────────── */
{
  const page = await open(LEGACY);
  await say(page, ['Second'], 'newSetBtn');
  await say(page, ['Third'], 'newSetBtn');
  eq(await names(page), ['My slip', 'Second', 'Third'], '11: three slips');
  ok(await enabled(page, 'deleteSetBtn'), '11: Delete is on with several');
  await say(page, [false], 'deleteSetBtn');
  const dlg = page.__dialogs[page.__dialogs.length - 1];
  eq([dlg.type, dlg.message], ['confirm', 'Delete \u201cThird\u201d, with its prompts and settings? This cannot be undone.'], '11: it asks first, naming the slip');
  eq((await names(page)).length, 3, '11: declining deletes nothing');
  await say(page, [true], 'deleteSetBtn');
  eq(await names(page), ['My slip', 'Second'], '11: accepting deletes the open slip');
  eq(await selected(page), 'Second', '11: and opens the one before it, not the first');
  eq((await doc(page)).sets.map(s => s.name), ['My slip', 'Second'], '11: on disk too');
  eq((await doc(page)).currentId, (await doc(page)).sets[1].id, '11: the current slip on disk is the open one');
  eq((await promptTexts(page)).length, 4, '11: with its own prompts showing');
  await page.selectOption('#setSelect', { label: 'My slip' }); await settle(page, 80);
  await say(page, [true], 'deleteSetBtn');
  eq((await names(page)), ['Second'], '11: deleting the first leaves the rest');
  eq(await selected(page), 'Second', '11: and opens what is left');
  eq((await doc(page)).currentId, (await doc(page)).sets[0].id, '11: on disk too');
  ok(!(await enabled(page, 'deleteSetBtn')), '11: with one left Delete is off');
  const keep = await raw(page);
  await page.evaluate(() => document.getElementById('deleteSetBtn').click());
  await settle(page, 120);
  eq([await raw(page), await names(page)], [keep, ['Second']], '11: and a click on the disabled button removes nothing');
  eq(page.__dialogs.filter(d => d.type === 'confirm').length, 3, '11: and asks nothing');
  eq((await promptTexts(page)).length, 4, '11: the last slip is still a usable tool');
  await clean(page, '11');
}

/* ── 12. Share: the open slip only, and old links still open ──────────── */
{
  const page = await open(LEGACY);
  await say(page, ['Lab day'], 'newSetBtn');
  await setField(page, '#classPeriod', 'Lab 1');
  const payload = JSON.parse(await shared(page));
  eq(Object.keys(payload.state), ['copyCount', 'prompts', 'classPeriod', 'urgencyBox'], '12: the link carries the old four fields');
  eq(Object.keys(payload.state.prompts[0]), ['id', 'text'], '12: and a prompt is {id, text}');
  const text = JSON.stringify(payload);
  ok(!text.includes('Which table') && !text.includes('"sets"') && !text.includes('"name"') && !text.includes('currentId'),
    '12: nothing of another slip, no name, no list');
  eq(payload.state.classPeriod, 'Lab 1', '12: it is the open slip');
  await clean(page, '12');

  // a link made by the old page opens as it did, onto the open slip
  const OLD_LINK = { copyCount: 6, classPeriod: 'Team 6 — Blue Hall', urgencyBox: false,
    prompts: [{ id: 'p1', text: 'Which group needed the most redirection?' }, { id: 'p2', text: 'Did the lab clean-up get done?' }] };
  // fresh device
  const fresh = await open(undefined, await linkFor(OLD_LINK));
  eq(await promptTexts(fresh), OLD_LINK.prompts.map(p => p.text), '12: an old link opens on an untouched device');
  eq(await fields(fresh), { copyCount: '6', classPeriod: 'Team 6 — Blue Hall', urgency: false }, '12: with its settings');
  eq(await names(fresh), ['My slip'], '12: as one slip');
  eq(fresh.__dialogs.length, 0, '12: asking nothing, since nothing is replaced');
  ok(/Loaded a shared/.test(await fresh.textContent('#shareNote')), '12: and says so');
  eq((await doc(fresh)).sets[0].prompts.length, 2, '12: stored as the first slip');
  await clean(fresh, '12 fresh');

  // one saved slip: the old wording of the question
  const one = await open(LEGACY, await linkFor(OLD_LINK));
  eq(one.__dialogs.map(d => d.message), ['Replace the slip saved here with the shared one (2 prompts)?'], '12: with one slip the question is the old one');
  eq(await promptTexts(one), ['Which table was loudest?', 'Did the quiz finish?'], '12: declining keeps it');
  ok(/Kept the/.test(await one.textContent('#shareNote')), '12: and says so');
  await clean(one, '12 one declined');

  // several slips: the question names the open one, accepting touches only it
  const many = { v: 2, currentId: 'b', copyCount: 2, classPeriod: 'B', urgencyBox: true, prompts: P('B?'),
    sets: [{ id: 'a', name: 'General', copyCount: 2, classPeriod: 'A', urgencyBox: true, prompts: P('A1?', 'A2?') },
           { id: 'b', name: 'Testing day', copyCount: 2, classPeriod: 'B', urgencyBox: true, prompts: P('B?') }] };
  const acc = await prepPage(browser, BASE, { width: 1200, height: 900 });
  const msgs = [];
  acc.on('dialog', async d => { msgs.push(d.message()); await d.accept(); });
  await acc.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, [KEY, JSON.stringify(many)]);
  await acc.goto(await linkFor(OLD_LINK), { waitUntil: 'networkidle' });
  await settle(acc, 300);
  eq(msgs, ['Replace the slip saved here (“Testing day”) with the shared one (2 prompts)?'], '12: with several the question names the open slip');
  const d = await doc(acc);
  eq(d.sets.map(s => s.name), ['General', 'Testing day'], '12: accepting keeps both slips and the open name');
  eq(d.sets[1].prompts.map(p => p.text), OLD_LINK.prompts.map(p => p.text), '12: the open slip has the shared prompts');
  eq(d.sets[1].copyCount, 6, '12: and copy count');
  eq(d.sets[0].prompts.map(p => p.text), ['A1?', 'A2?'], '12: the other slip is untouched');
  eq(d.prompts.map(p => p.text), OLD_LINK.prompts.map(p => p.text), '12: and the mirror follows');
  eq(new URL(acc.url()).searchParams.get('slip'), null, '12: the parameter is consumed');
  await acc.context().close();
}

/* ── 13. Backup and restore carry every slip ──────────────────────────── */
{
  const page = await open(LEGACY);
  await say(page, ['Lab day'], 'newSetBtn');
  await say(page, ['Testing day'], 'newSetBtn');
  const r = await raw(page);
  ok(['My slip', 'Lab day', 'Testing day'].every(n => r.includes('"name":"' + n + '"')), '13: one key holds every slip, so a backup of that key carries all');
  eq(await page.evaluate(() => Object.keys(localStorage).filter(k => /snfs|slip/i.test(k))), [KEY], '13: and no other key was made');
  await page.context().close();
  // restore: the same string put back on a clean device opens the same slips
  const back = await open(r);
  eq(await names(back), ['My slip', 'Lab day', 'Testing day'], '13: a restored key lists them all');
  eq(await selected(back), 'Testing day', '13: with the open one open');
  eq(await raw(back), r, '13: and loading rewrote nothing');
  await clean(back, '13');
  const reg = fs.readFileSync(new URL('../../../_shared/tool-registry.js', import.meta.url), 'utf8');
  ok(/slug: 'sub-note-feedback-slip'[\s\S]{0,300}\{ k: 'snfs_slip_v1' \}/.test(reg), '13: the registry still names the one key');
}

/* ── 14. Damaged saves do not take the tool down ──────────────────────── */
{
  const cases = [
    ['not JSON', 'not json {'],
    ['an array', '[1,2]'],
    ['v2 with no sets', JSON.stringify({ v: 2, sets: [], currentId: 'x', prompts: P('Top level?') })],
    ['v2 with an unknown current id', JSON.stringify({ v: 2, currentId: 'zzz', sets: [{ id: 'a', name: 'A', copyCount: 2, classPeriod: '', urgencyBox: true, prompts: P('A?') }, { id: 'b', name: 'B', prompts: P('B?') }] })],
    ['v2 with a repeated id and a nameless slip', JSON.stringify({ v: 2, currentId: 'a', sets: [{ id: 'a', prompts: P('A?') }, { id: 'a', name: 'dup', prompts: P('X?') }, null, { name: 'noid' }] })],
  ];
  const want = [
    [['My slip'], 4], [['My slip'], 4], [['My slip'], 4], [['A', 'B'], 1], [['My slip'], 1],
  ];
  for (let i = 0; i < cases.length; i++) {
    const page = await open(cases[i][1]);
    const tag = '14 (' + cases[i][0] + ')';
    eq([await names(page), (await promptTexts(page)).length], want[i], `${tag}: opens a usable slip`);
    await page.fill('#classPeriod', 'ok');
    eq((await fields(page)).classPeriod, 'ok', `${tag}: and takes an edit`);
    await clean(page, tag);
  }
  const bad = { v: 2, currentId: 'b', sets: [{ id: 'a', name: 'A', copyCount: 'x', prompts: P('A?') }, { id: 'b', name: 'B', copyCount: 500, urgencyBox: 'yes', prompts: P('B?') }] };
  const other = await open(JSON.stringify({ ...bad, currentId: 'a' }));
  eq((await fields(other)).copyCount, '2', '14: a slip whose stored count is not a number reads as two copies');
  await clean(other, '14 count');
  const page = await open(JSON.stringify(bad));
  eq(await fields(page), { copyCount: '500', classPeriod: '', urgency: true }, '14: a stored count and a non-boolean box read as the old page read them');
  eq((await sheet(page)).match(/class="pk-half/g).length, 20, '14: and print still clamps to 20');
  await clean(page, '14 counts');
}

/* ── 15. Keyboard and screen reader ───────────────────────────────────── */
{
  const page = await open(LEGACY);
  await page.focus('#setSelect');
  await page.keyboard.press('Tab');
  eq(await page.evaluate(() => document.activeElement.id), 'newSetBtn', '15: Tab from the chooser reaches + New');
  for (const id of ['dupSetBtn', 'renameSetBtn']) {
    await page.keyboard.press('Tab');
    eq(await page.evaluate(() => document.activeElement.id), id, `15: then ${id}`);
  }
  await say(page, ['Second'], 'newSetBtn');
  await page.focus('#setSelect');
  await page.keyboard.press('ArrowUp');
  await settle(page, 150);
  eq(await selected(page), 'My slip', '15: the arrow keys switch slips');
  eq(await page.evaluate(() => document.activeElement.id), 'setSelect', '15: focus stays on the chooser');
  const labels = await page.$$eval('#setSelect option', os => os.map(o => o.textContent));
  eq(labels, ['My slip', 'Second'], '15: options read as the names');
  eq(await page.$eval('#deleteSetBtn', b => b.textContent), 'Delete', '15: Delete is a button with a name');
  await clean(page, '15');
}

/* ── 16. The preview and print still go through the kit's one call ────── */
{
  const page = await open(LEGACY);
  await page.selectOption('#starterSelect', 'lab');
  await say(page, ['Lab day'], 'newSetBtn');
  await page.click('#previewBtn');
  await settle(page, 400);
  ok(await page.evaluate(() => !!document.querySelector('dialog[open], [role=dialog]')), '16: Preview pages opens the preview on the open slip');
  ok((await page.$eval('#printArea', e => e.innerHTML)).includes('Did every group finish the lab'), '16: showing the open slip\'s sheet');
  await clean(page, '16');
}

console.log(`\n${passed} passed, ${failed} failed`);
await browser.close();
server.close();
process.exit(failed ? 1 : 0);

/* A link is made by the site's own encoder, run in a page. */
async function linkFor(state) {
  const page = await prepPage(browser, BASE, { width: 1000, height: 800 });
  await page.goto(PAGE, { waitUntil: 'load' });
  const url = await page.evaluate(s => window.StateLink.buildShareUrl('slip', s, { base: location.href.split('?')[0] }), state);
  await page.context().close();
  return url;
}
