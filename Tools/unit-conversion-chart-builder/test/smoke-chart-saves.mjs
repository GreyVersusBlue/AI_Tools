// smoke-chart-saves.mjs — 078's reordering, named saved charts and the share
// link that now has saves to look after.
//
//   node Tools/unit-conversion-chart-builder/test/smoke-chart-saves.mjs     (port 8508)
//
// Four things are pinned. (A) A chart saved before any of this loads and prints
// the sheet it always did: golden-old-sheets.json was recorded from the page at
// 4a13d48, before the change, from six fixtures, and the sheet HTML, the column
// style, the title and the preview's lines are compared with it. (B) Groups and
// lines move by buttons a keyboard reaches, the move is said in a live region,
// focus stays on the moved item, and the printed sheet follows. (C) Charts are
// saved by name in the key the tool already used, in Store's envelope at
// version 2, and the last one cannot be deleted. (D) The share link carries the
// open chart only, and an arriving one asks before it replaces or adds. Text
// typed or received reaches the page as text: every markup case uses
// <img onerror> and asserts nothing ran. Names are made up. Exits 1 on failure.
//
// PAGE_FILE=<path under Tools/> points the suite at a mutated copy of the
// page; the breaks-on-purpose runs use it.

import fs from 'node:fs';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8508;
const BASE = `http://127.0.0.1:${PORT}`;
/* SECTIONS=BC runs only those sections: the breaks-on-purpose runs use it to stay quick. */
const want = id => !process.env.SECTIONS || process.env.SECTIONS.indexOf(id) !== -1;
const PAGE = BASE + '/Tools/' + (process.env.PAGE_FILE || '078-unit-conversion-chart-builder.html');
const KEY = 'ucb_chart_v1';
const GOLDEN = JSON.parse(fs.readFileSync(new URL('./golden-old-sheets.json', import.meta.url), 'utf8'));

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const has = (text, re, label) => ok(re.test(text || ''), `${label} (got ${JSON.stringify(text)})`);

console.log('Unit Conversion Reference Chart Builder — order, saved charts, share');

const server = await serve(PORT);
const browser = await launch();

/** A page. `seed` is written to the chart key once, before the page's script;
    `answers` queue the answer to each dialog in turn (a prompt takes a string
    or null to cancel, a confirm takes true or false). */
async function open(seed, { url = PAGE, answers = [] } = {}) {
  const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
  page.__answers = answers.slice();
  page.__dialogs = [];
  page.on('dialog', async d => {
    page.__dialogs.push({ type: d.type(), message: d.message() });
    const a = page.__answers.length ? page.__answers.shift() : (d.type() === 'prompt' ? null : false);
    if (d.type() === 'prompt') { if (a === null) await d.dismiss(); else await d.accept(String(a)); }
    else { if (a) await d.accept(); else await d.dismiss(); }
  });
  await page.addInitScript(([k, v]) => {
    window.__pwned = 0;
    if (v !== null && localStorage.getItem(k) === null) localStorage.setItem(k, v);
  }, [KEY, seed === undefined ? null : (typeof seed === 'string' ? seed : JSON.stringify(seed))]);
  await page.goto(url, { waitUntil: 'networkidle' });
  await settle(page, 250);
  return page;
}
const raw = page => page.evaluate(k => localStorage.getItem(k), KEY);
const stored = async page => { const r = await raw(page); return r ? JSON.parse(r) : null; };
const docOf = async page => (await stored(page)).data;
const chartNames = page => page.$$eval('#chartSelect option', os => os.map(o => o.textContent));
const chosen = page => page.$eval('#chartSelect', s => s.selectedOptions[0] && s.selectedOptions[0].textContent);
const groupsOf = (page, sel = '#chartGroups .group') => page.$$eval(sel, gs => gs.map(g => ({
  h: g.querySelector('h3').textContent,
  lines: Array.from(g.querySelectorAll('.item-text')).map(e => e.textContent),
})));
const groupNames = async page => (await groupsOf(page)).map(g => g.h);
const linesOf = async (page, name) => ((await groupsOf(page)).find(g => g.h === name) || { lines: null }).lines;
const printed = async page => {
  await page.evaluate(() => { window.print = () => {}; });
  await page.click('#printBtn');
  return groupsOf(page, '#printGroups .group');
};
const msg = page => page.textContent('#moveMsg');
/** What has focus: the move button's kind, target, direction and group. */
const focused = page => page.evaluate(() => {
  const a = document.activeElement;
  if (!a || !a.getAttribute) return null;
  return { tag: a.tagName, group: a.getAttribute('data-move-group'), line: a.getAttribute('data-move-line'),
    dir: a.getAttribute('data-dir'), inGroup: a.getAttribute('data-in-group'), off: a.getAttribute('aria-disabled') };
});
const focusMove = (page, kind, id, dir, inGroup) => page.evaluate(([kind, id, dir, inGroup]) => {
  const b = Array.from(document.querySelectorAll('[data-move-' + kind + ']')).find(x =>
    x.getAttribute('data-move-' + kind) === id && x.getAttribute('data-dir') === dir &&
    (kind === 'group' || x.getAttribute('data-in-group') === inGroup));
  b.focus();
  return document.activeElement === b;
}, [kind, id, dir, inGroup]);
const shareLink = async page => {
  await page.click('#shareBtn');
  await settle(page, 250);
  const link = await page.evaluate(() => {
    let captured = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: { writeText: t => { captured = t; return Promise.resolve(); } } });
    document.querySelector('.share-sheet button[data-share="copy"]').click();
    return new Promise(r => setTimeout(() => { window.Share.close(); r(captured); }, 60));
  });
  return link;
};
const payloadOf = (page, link) => page.evaluate(u =>
  window.StateLink.decodeState(new URL(u).searchParams.get('chart')), link);

/* A chart from before saves: the one bare object the page used to write. */
const LEGACY = {
  selected: { time: true, length_metric: true },
  hidden: {},
  custom: { 'Sports Day': [{ id: 'a1', text: '1 lap = 400 m' }, { id: 'b2', text: '1 relay = 4 laps' }] },
  columns: 3,
};
const TIME_LINES = ['1 minute = 60 seconds', '1 hour = 60 minutes', '1 day = 24 hours', '1 week = 7 days', '1 year = 365 days', '1 year ≈ 52 weeks'];

/* ═══ A. a chart from before prints the sheet it always did ═══════════════ */
if (want('A')) {
console.log('\nA. old saves, old sheets');
for (const [name, fx] of Object.entries(GOLDEN.fixtures)) {
  const want = GOLDEN.sheets[name];
  const page = await open(fx && !fx.clickPreset ? fx : undefined);
  if (fx && fx.clickPreset) await page.click('#' + fx.clickPreset);
  await page.evaluate(() => { window.print = () => {}; });
  await page.click('#printBtn');
  const got = await page.evaluate(() => ({
    html: document.getElementById('printGroups').innerHTML,
    cols: document.getElementById('printGroups').style.gridTemplateColumns,
    title: document.getElementById('printTitle').textContent,
    preview: Array.from(document.querySelectorAll('#chartGroups .group')).map(g => [g.querySelector('h3').textContent,
      Array.from(g.querySelectorAll('.item-text')).map(e => e.innerHTML)]),
    colSel: document.getElementById('colCount').value,
  }));
  ok(got.html === want.html, `${name}: the printed sheet is the old sheet, byte for byte`);
  eq(got.cols, want.cols, `${name}: with the old column style`);
  eq(got.title, want.title, `${name}: and the old title`);
  eq(got.preview, want.preview, `${name}: the preview lists the same lines in the same order`);
  eq(got.colSel, want.colSel, `${name}: and the column count shows as it did`);
  await page.close();
}
{
  const page = await open(LEGACY);
  eq(await raw(page), JSON.stringify(LEGACY), 'a chart saved before saves is not rewritten by opening the page');
  eq(await chartNames(page), ['My chart'], 'it comes back as the one saved chart, "My chart"');
  eq(await groupNames(page), ['Length (Metric)', 'Time', 'Sports Day'], 'with its groups in the order they always had');
  await page.check('[data-tpl="weight_metric"]');
  const d = await docOf(page);
  eq((await stored(page)).v, 2, 'the first edit writes Store\'s envelope at version 2');
  eq(d.list.length, 1, 'with that one chart in the list');
  eq(d.list[0].custom['Sports Day'].map(c => c.text), ['1 lap = 400 m', '1 relay = 4 laps'], 'its custom lines intact');
  eq(d.list[0].columns, 3, 'and its column count');
  eq(d.list[0].selected, { time: true, length_metric: true, weight_metric: true }, 'and the new tick beside the old ones');
  ok(d.list[0].groupOrder === undefined && d.list[0].lineOrder === undefined, 'no order is written until something moves');
  await page.close();
}
{
  /* the version-0 rule that survives: an empty tick list gets the starter sets, once */
  const page = await open({ selected: {}, custom: { 'Lab': [{ id: 'z', text: '1 beaker = 250 mL' }] }, hidden: {}, columns: 2 });
  eq((await groupNames(page)).slice(0, 4), ['Length (Customary)', 'Length (Metric)', 'Weight / Mass (Customary)', 'Temperature'],
    'a version-0 chart with no ticks is seeded with the four starter sets, as before');
  await page.close();
}
}

/* ═══ B. reordering ════════════════════════════════════════════════════════ */
if (want('B')) {
console.log('\nB. reordering');
{
  const page = await open(LEGACY);
  const labels = await page.$$eval('[data-move-group]', bs => bs.map(b => b.getAttribute('aria-label')));
  eq(labels, ['Move group “Length (Metric)” up', 'Move group “Length (Metric)” down',
    'Move group “Time” up', 'Move group “Time” down',
    'Move group “Sports Day” up', 'Move group “Sports Day” down'],
    'every group has an up and a down button that names it');
  const lineLabel = await page.$eval('[data-move-line="t:time:5"][data-dir="up"]', b => b.getAttribute('aria-label'));
  eq(lineLabel, 'Move line “1 year ≈ 52 weeks” up', 'a line\'s button names it in plain text, entity decoded');
  const tag = await page.$eval('[data-move-group]', b => b.tagName);
  eq(tag, 'BUTTON', 'the controls are real buttons, not a drag target');
  eq(await page.$eval('[data-move-group="Length (Metric)"][data-dir="up"]', b => b.getAttribute('aria-disabled')), 'true',
    'the first group\'s Up is aria-disabled');
  eq(await page.$eval('[data-move-group="Sports Day"][data-dir="down"]', b => b.getAttribute('aria-disabled')), 'true',
    'the last group\'s Down is aria-disabled');
  eq(await page.$eval('[data-move-group="Time"][data-dir="up"]', b => b.getAttribute('aria-disabled')), null,
    'a middle group\'s Up is not');

  /* keyboard: focus the button, press Enter */
  ok(await focusMove(page, 'group', 'Length (Metric)', 'down'), 'the Down button of the first group takes focus');
  await page.keyboard.press('Enter');
  eq(await groupNames(page), ['Time', 'Length (Metric)', 'Sports Day'], 'Enter on Down moves the group down one');
  has(await msg(page), /^Moved group “Length \(Metric\)” down\. It is now group 2 of 3\.$/, 'the move is announced with its new position');
  eq(await page.getAttribute('#moveMsg', 'role'), 'status', 'in a status region');
  eq(await page.getAttribute('#moveMsg', 'aria-live'), 'polite', 'that is polite');
  let f = await focused(page);
  eq([f.tag, f.group, f.dir], ['BUTTON', 'Length (Metric)', 'down'], 'focus stays on the moved group\'s Down button');
  await page.keyboard.press('Space');
  eq(await groupNames(page), ['Time', 'Sports Day', 'Length (Metric)'], 'Space moves it again');
  has(await msg(page), /It is now group 3 of 3\./, 'the second announcement counts from the new place');
  f = await focused(page);
  eq([f.group, f.dir, f.off], ['Length (Metric)', 'down', 'true'], 'at the end the focused button is aria-disabled, still focused');
  await page.keyboard.press('Enter');
  eq(await groupNames(page), ['Time', 'Sports Day', 'Length (Metric)'], 'pressing it at the end changes nothing');
  has(await msg(page), /^Group “Length \(Metric\)” is already last\.$/, 'and says why');
  f = await focused(page);
  eq([f.group, f.dir], ['Length (Metric)', 'down'], 'focus is still on it');

  ok(await focusMove(page, 'group', 'Length (Metric)', 'up'), 'the Up button of the last group takes focus');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  eq(await groupNames(page), ['Length (Metric)', 'Time', 'Sports Day'], 'two presses of Up put it back first');
  has(await msg(page), /It is now group 1 of 3\./, 'announced as group 1 of 3');
  await page.keyboard.press('Enter');
  has(await msg(page), /already first\./, 'Up at the top says it is already first');

  /* lines */
  ok(await focusMove(page, 'line', 't:time:2', 'up', 'Time'), 'a line\'s Up button takes focus');
  await page.keyboard.press('Enter');
  eq((await linesOf(page, 'Time')).slice(0, 3), [TIME_LINES[0], TIME_LINES[2], TIME_LINES[1]], 'Enter moves a line up inside its group');
  has(await msg(page), /^Moved line “1 day = 24 hours” up\. It is now line 2 of 6 in “Time”\.$/, 'announced with the line, its place and its group');
  f = await focused(page);
  eq([f.line, f.dir, f.inGroup], ['t:time:2', 'up', 'Time'], 'focus stays on the moved line\'s Up button');
  await page.keyboard.press('Enter');
  eq((await linesOf(page, 'Time'))[0], TIME_LINES[2], 'a second press makes it first');
  eq(await groupNames(page), ['Length (Metric)', 'Time', 'Sports Day'], 'a line move leaves the group order alone');
  eq(await linesOf(page, 'Length (Metric)'), ['1 centimeter = 10 millimeters', '1 meter = 100 centimeters', '1 meter = 1,000 millimeters', '1 kilometer = 1,000 meters'],
    'and every other group\'s lines');
  ok(await focusMove(page, 'line', 'c:a1', 'down', 'Sports Day'), 'a custom line\'s Down button takes focus');
  await page.keyboard.press('Enter');
  eq(await linesOf(page, 'Sports Day'), ['1 relay = 4 laps', '1 lap = 400 m'], 'a custom line moves too');

  const want = [{ h: 'Length (Metric)', lines: await linesOf(page, 'Length (Metric)') },
    { h: 'Time', lines: [TIME_LINES[2], TIME_LINES[0], TIME_LINES[1], TIME_LINES[3], TIME_LINES[4], TIME_LINES[5]] },
    { h: 'Sports Day', lines: ['1 relay = 4 laps', '1 lap = 400 m'] }];
  eq(await groupsOf(page), want, 'the whole chart is in the order it was left in');
  eq(await printed(page), want, 'the printed sheet follows the same order');

  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 250);
  eq(await groupsOf(page), want, 'a reload keeps the order');
  const d = await docOf(page);
  eq(d.list[0].groupOrder, ['Length (Metric)', 'Time', 'Sports Day'], 'it is stored with the chart as groupOrder');
  eq(d.list[0].lineOrder['Sports Day'], ['c:b2', 'c:a1'], 'and the lines as lineOrder, by id');
  await page.close();
}
{
  /* order and the other edits */
  const page = await open({ v: 2, data: { currentId: 'x', list: [{ id: 'x', name: 'Sixth grade', columns: 2,
    selected: { time: true, length_metric: true }, hidden: { time: { 3: true } }, custom: {},
    groupOrder: ['Time', 'Length (Metric)'], lineOrder: { Time: ['t:time:5', 't:time:0'] } }] } });
  eq(await groupNames(page), ['Time', 'Length (Metric)'], 'a saved group order is the order shown');
  eq(await linesOf(page, 'Time'), [TIME_LINES[5], TIME_LINES[0], TIME_LINES[1], TIME_LINES[2], TIME_LINES[4]],
    'a saved line order puts the listed lines first and the rest in their own order, a hidden line staying hidden');
  await page.click('[data-move-line="t:time:1"][data-dir="up"]');
  eq((await linesOf(page, 'Time')).slice(0, 3), [TIME_LINES[5], TIME_LINES[1], TIME_LINES[0]], 'a move with a line hidden counts only what shows');
  await page.uncheck('[data-tpl="length_metric"]');
  eq(await groupNames(page), ['Time'], 'unticking a set takes its group off the chart');
  await page.check('[data-tpl="length_metric"]');
  eq(await groupNames(page), ['Time', 'Length (Metric)'], 'ticking it again puts the group back where the teacher had it');
  await page.uncheck('[data-tpl="time"]');
  await page.check('[data-tpl="time"]');
  eq((await linesOf(page, 'Time')).slice(0, 3), [TIME_LINES[5], TIME_LINES[1], TIME_LINES[0]], 'and a set\'s line order survives being unticked');
  await page.fill('#customGroup', 'Time');
  await page.fill('#customLine', '1 decade = 10 years');
  await page.click('#addCustomBtn');
  const t = await linesOf(page, 'Time');
  eq(t[t.length - 1], '1 decade = 10 years', 'a custom line added to a built-in group joins the end of it');
  eq(await groupNames(page), ['Time', 'Length (Metric)'], 'in the same group');
  await page.close();
}
{
  /* ids the order names that no longer exist, and group names that are awkward */
  const nasty = 'He said "hi" | there & <b>bold</b>';
  const page = await open({ v: 2, data: { currentId: 'x', list: [{ id: 'x', name: 'Odd', columns: 2,
    selected: { time: true }, hidden: {}, custom: { [nasty]: [{ id: 'q1', text: 'a' }, { id: 'q2', text: 'b' }] },
    groupOrder: ['Gone group', nasty, 'Time'], lineOrder: { Time: ['t:time:99', 'c:nope', 't:time:2'], 'Gone group': ['x'] } }] } });
  eq(await groupNames(page), [nasty, 'Time'], 'a group the order names that is not there is skipped');
  eq((await linesOf(page, 'Time'))[0], TIME_LINES[2], 'so is a line id that is not there');
  ok(await focusMove(page, 'group', nasty, 'down'), 'a group named with quotes, a bar, an ampersand and a tag has working buttons');
  await page.keyboard.press('Enter');
  eq(await groupNames(page), ['Time', nasty], 'and moves');
  eq(await page.$$eval('#chartGroups b', e => e.length), 0, 'its name made no element');
  ok(await focusMove(page, 'line', 'c:q1', 'down', nasty), 'a line in that group moves');
  await page.keyboard.press('Enter');
  eq(await linesOf(page, nasty), ['b', 'a'], 'by id');
  await page.click('[data-del-custom="q2"]');
  eq(await linesOf(page, nasty), ['a'], 'and a custom line deletes by id, whatever its group is called');
  await page.close();
}
}

/* ═══ C. text is text ══════════════════════════════════════════════════════ */
if (want('C')) {
console.log('\nC. typed and received text is inert');
{
  const page = await open();
  const evilG = '<img src=x onerror="window.__pwned=1">Group';
  const evilL = '<img src=x onerror=window.__pwned=2> 1 x = 2 y';
  await page.fill('#customGroup', evilG);
  await page.fill('#customLine', evilL);
  await page.click('#addCustomBtn');
  await settle(page, 200);
  eq(await page.$$eval('#chartGroups img', e => e.length), 0, 'a group name and a line holding <img onerror> make no image in the preview');
  eq(await page.evaluate(() => window.__pwned), 0, 'and nothing ran');
  eq((await linesOf(page, evilG)), [evilL], 'they show as the text typed');
  const g = await printed(page);
  eq(await page.$$eval('#printGroups img', e => e.length), 0, 'and none in the printed sheet');
  eq(g.find(x => x.h === evilG).lines, [evilL], 'which prints the text');
  await settle(page, 200);
  eq(await page.evaluate(() => window.__pwned), 0, 'still nothing ran');
  const lbl = await page.$$eval('[data-del-custom]', bs => bs.map(b => b.getAttribute('aria-label')));
  has(lbl[0], /^Remove line “<img src=x onerror=window\.__pwned=2> 1 x = 2 y”$/, 'the remove button names the line as plain text');
  await page.close();
}
{
  /* a link from someone else carrying markup in a chart name, a group, a line and the order */
  const evil = '<img src=x onerror="window.__pwned=3">';
  const payload = { name: evil + 'Chart', selected: { time: true }, hidden: {},
    custom: { [evil]: [{ id: 'k1', text: evil }, { id: 'k2', text: 'plain' }] }, columns: 2,
    groupOrder: [evil, 'Time'], lineOrder: { [evil]: ['c:k2', 'c:k1'] } };
  const page = await open();
  const url = await page.evaluate(([base, p]) => base + '?chart=' + encodeURIComponent(window.StateLink.encodeState(p)), [PAGE, payload]);
  await page.close();
  const arrived = await open(undefined, { url });
  await settle(arrived, 300);
  eq(await arrived.evaluate(() => window.__pwned), 0, 'a link whose name, group, line and order are <img onerror> runs nothing');
  eq(await arrived.$$eval('#chartGroups img, #chartSelect img, #shareNote img', e => e.length), 0, 'and makes no image anywhere on the page');
  eq(await groupNames(arrived), [evil, 'Time'], 'the group arrives as text, first, as the order says');
  eq(await linesOf(arrived, evil), ['plain', evil], 'and the lines in the sent order, the custom ids rewritten locally');
  eq(await chosen(arrived), evil + 'Chart', 'the chart name arrives as text');
  const printedSheet = await printed(arrived);
  eq(await arrived.$$eval('#printGroups img', e => e.length), 0, 'and prints as text');
  eq(printedSheet[0].h, evil, 'the printed group is the same text');
  await arrived.close();
}
{
  const page = await open(undefined, { answers: ['<b>x</b> Chart'] });
  await page.click('#renameChartBtn');
  eq(await chosen(page), '<b>x</b> Chart', 'a chart name with markup shows as the characters typed');
  eq(await page.$$eval('#chartSelect b', e => e.length), 0, 'and makes no element');
  await page.close();
}
{
  const page = await open();
  await page.fill('#customGroup', '__proto__');
  await page.fill('#customLine', 'x');
  await page.click('#addCustomBtn');
  await settle(page, 150);
  eq(page.__dialogs.length, 1, 'a group called __proto__ is refused with a message');
  eq(await groupNames(page), ['Length (Customary)', 'Length (Metric)', 'Weight / Mass (Customary)', 'Temperature'], 'and nothing is added');
  await page.close();
}
}

/* ═══ D. saved charts ══════════════════════════════════════════════════════ */
if (want('D')) {
console.log('\nD. named saved charts');
{
  const page = await open(LEGACY, { answers: ['Grade 5 metric'] });
  eq(await page.getAttribute('#chartSelect', 'id'), 'chartSelect', 'the page has a chooser');
  eq(await page.isDisabled('#deleteChartBtn'), true, 'Delete is off while there is only one chart');
  await page.click('#deleteChartBtn', { force: true }).catch(() => {});
  eq(await raw(page), JSON.stringify(LEGACY), 'pressing it anyway writes nothing and removes nothing');
  eq(page.__dialogs.length, 0, 'and asks nothing');

  await page.click('#newChartBtn');
  eq(page.__dialogs[0].type, 'prompt', '+ New asks for a name');
  eq(await chartNames(page), ['My chart', 'Grade 5 metric'], 'the new chart is listed after the old one');
  eq(await chosen(page), 'Grade 5 metric', 'and opened');
  eq(await groupNames(page), [], 'it starts empty');
  eq(await page.isVisible('#noGroupsMsg'), true, 'with the message that says to tick a set');
  has(await page.textContent('#chartMsg'), /Started “Grade 5 metric”, empty/, 'and says so');
  eq(await page.getAttribute('#chartMsg', 'role'), 'status', 'in a status region');
  await page.check('[data-tpl="length_metric"]');
  await page.selectOption('#colCount', '1');
  await page.fill('#customGroup', 'Mine');
  await page.fill('#customLine', 'only here');
  await page.click('#addCustomBtn');
  await page.click('[data-move-line="t:length_metric:3"][data-dir="up"]');

  await page.selectOption('#chartSelect', { label: 'My chart' });
  eq(await groupNames(page), ['Length (Metric)', 'Time', 'Sports Day'], 'switching back shows the first chart as it was');
  eq(await page.inputValue('#colCount'), '3', 'with its own column count');
  eq(await linesOf(page, 'Length (Metric)'), ['1 centimeter = 10 millimeters', '1 meter = 100 centimeters', '1 meter = 1,000 millimeters', '1 kilometer = 1,000 meters'],
    'and none of the new chart\'s reordering');
  ok(!(await groupNames(page)).includes('Mine'), 'nor its custom group');
  has(await page.textContent('#chartMsg'), /Opened “My chart”/, 'switching is said');
  const d1 = await docOf(page);
  eq(d1.list[0].custom['Sports Day'].length, 2, 'the first chart\'s lines are untouched in storage');
  eq(d1.list[0].groupOrder, undefined, 'and it has no order the other chart\'s moves wrote');
  eq(d1.list[1].lineOrder['Length (Metric)'].slice(0, 3), ['t:length_metric:0', 't:length_metric:1', 't:length_metric:3'], 'the new chart holds its own line order');
  eq(d1.list[1].columns, 1, 'and column count');

  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 250);
  eq(await chosen(page), 'My chart', 'a reload opens the chart that was open');
  await page.selectOption('#chartSelect', { label: 'Grade 5 metric' });
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 250);
  eq(await chosen(page), 'Grade 5 metric', 'and the other one when that was last');
  const sheet = await printed(page);
  eq(sheet.map(g => g.h), ['Length (Metric)', 'Mine'], 'each chart prints its own sheet');
  eq(sheet[0].lines.slice(0, 3), ['1 centimeter = 10 millimeters', '1 meter = 100 centimeters', '1 kilometer = 1,000 meters'], 'in its own order');
  eq(await page.$eval('#printGroups', e => e.style.gridTemplateColumns), 'repeat(1, 1fr)', 'and its own columns');
  await page.close();
}
{
  const page = await open(LEGACY, { answers: ['Copy of mine', 'Renamed one', null, false, true] });
  await page.click('[data-move-group="Time"][data-dir="up"]');
  await page.click('#dupChartBtn');
  eq(page.__dialogs[0].message, 'Name for the duplicate:', 'Duplicate asks for a name');
  eq(await chartNames(page), ['My chart', 'Copy of mine'], 'and lists the copy');
  eq(await groupNames(page), ['Time', 'Length (Metric)', 'Sports Day'], 'the copy has the order the original had');
  await page.click('[data-del-custom="a1"]').catch(() => {});
  const copyDoc = await docOf(page);
  const cp = copyDoc.list[1], og = copyDoc.list[0];
  ok(cp.id !== og.id, 'the copy has an id of its own');
  eq(og.custom['Sports Day'].length, 2, 'the original keeps both custom lines');
  await page.click('[data-move-group="Sports Day"][data-dir="up"]');
  const afterMove = await docOf(page);
  eq(afterMove.list[0].groupOrder, ['Time', 'Length (Metric)', 'Sports Day'], 'a move in the copy does not move the original');
  eq(afterMove.list[1].groupOrder, ['Time', 'Sports Day', 'Length (Metric)'], 'it moves the copy');

  await page.click('#renameChartBtn');
  eq(await chartNames(page), ['My chart', 'Renamed one'], 'Rename changes the chart\'s name in the list');
  has(await page.textContent('#chartMsg'), /Renamed to “Renamed one”/, 'and says so');
  await page.click('#renameChartBtn');
  eq(await chartNames(page), ['My chart', 'Renamed one'], 'cancelling a rename keeps the name');
  eq((await docOf(page)).list[1].name, 'Renamed one', 'in storage too');

  eq(await page.isDisabled('#deleteChartBtn'), false, 'Delete is on with two charts');
  const before = page.__dialogs.length;
  await page.click('#deleteChartBtn');
  const q = page.__dialogs[before];
  eq(q.type, 'confirm', 'Delete asks first');
  has(q.message, /Delete “Renamed one”/, 'naming the chart');
  eq(await chartNames(page), ['My chart', 'Renamed one'], 'and Cancel deletes nothing');
  await page.click('#deleteChartBtn');
  eq(await chartNames(page), ['My chart'], 'OK deletes it');
  eq(await chosen(page), 'My chart', 'and the other chart opens');
  eq((await docOf(page)).list.length, 1, 'storage agrees');
  eq(await page.isDisabled('#deleteChartBtn'), true, 'with one left Delete is off again, so the last chart cannot be removed');
  eq(await groupNames(page), ['Time', 'Length (Metric)', 'Sports Day'], 'and that chart is as it was left');
  has(await page.textContent('#chartMsg'), /Deleted “Renamed one”/, 'the delete is said');
  await page.close();
}
}

/* ═══ E. the share link ════════════════════════════════════════════════════ */
if (want('E')) {
console.log('\nE. share, with saves');
{
  const docSeed = { v: 2, data: { currentId: 'b', list: [
    { id: 'a', name: 'Everything', columns: 2, selected: { weight_cross: true }, hidden: {},
      custom: { 'Secret Group': [{ id: 's1', text: 'a line from the other chart' }] } },
    { id: 'b', name: 'Field day', columns: 3, selected: { time: true }, hidden: { time: { 5: true } },
      custom: { 'Sports Day': [{ id: 'p', text: '1 lap = 400 m' }, { id: 'q', text: '1 relay = 4 laps' }] },
      groupOrder: ['Sports Day', 'Time'], lineOrder: { 'Sports Day': ['c:q', 'c:p'] } }] } };
  const page = await open(docSeed);
  const link = await shareLink(page);
  ok(link && link.indexOf('chart=') !== -1, 'Copy link makes a ?chart= link');
  const p = await payloadOf(page, link);
  eq(p.name, 'Field day', 'the payload carries the open chart\'s name');
  eq([p.selected.time, p.hidden.time['5'], p.columns], [true, true, 3], 'its ticks, removed lines and columns');
  eq(p.groupOrder, ['Sports Day', 'Time'], 'its group order');
  eq(p.lineOrder['Sports Day'], ['c:q', 'c:p'], 'and its line order');
  eq([p.list, p.currentId, p.v], [undefined, undefined, undefined], 'it carries no list of saves and no pointer into one');
  ok(JSON.stringify(p).indexOf('Secret Group') === -1 && JSON.stringify(p).indexOf('other chart') === -1 && JSON.stringify(p).indexOf('weight_cross') === -1,
    'and nothing of the other saved chart, anywhere in it');
  ok(JSON.stringify(p).indexOf('1 minute = 60 seconds') === -1, 'nor any built-in conversion text');
  await page.selectOption('#chartSelect', { label: 'Everything' });
  const p2 = await payloadOf(page, await shareLink(page));
  eq(p2.name, 'Everything', 'after switching, the link is the chart then open');
  ok(JSON.stringify(p2).indexOf('Sports Day') === -1, 'and has none of the first');
  await page.close();

  /* a fresh device opens it */
  const fresh = await open(undefined, { url: link });
  eq(await groupNames(fresh), ['Sports Day', 'Time'], 'a fresh device shows the chart in its sent order');
  eq(await linesOf(fresh, 'Sports Day'), ['1 relay = 4 laps', '1 lap = 400 m'], 'with its lines in order');
  eq(fresh.__dialogs.length, 0, 'and asks nothing, since nothing is being replaced');
  has(await fresh.textContent('#shareNote'), /Loaded a shared chart/, 'it says so');
  eq(await chartNames(fresh), ['Field day'], 'the one saved chart takes the name sent');
  eq((await linesOf(fresh, 'Time')).length, 5, 'and the removed line is removed');
  eq(await fresh.evaluate(() => location.search), '', 'the parameter is consumed');
  await fresh.close();

  /* a device with work: decline, then add */
  const mine = await open(LEGACY, { url: link, answers: [false] });
  eq(mine.__dialogs.length, 1, 'a device with a chart of its own is asked once');
  has(mine.__dialogs[0].message, /^Replace the chart “My chart” saved here with the shared one \(1 unit set and 2 custom lines\)\?/, 'the question names the chart it would replace and what is coming');
  has(mine.__dialogs[0].message, /add the shared chart as a new saved chart/, 'and says the other way is open');
  has(await mine.textContent('#shareNote'), /^Kept the chart “My chart” already on this device\./, 'declining is said');
  eq(await groupNames(mine), ['Length (Metric)', 'Time', 'Sports Day'], 'the chart on the device is untouched');
  eq(await raw(mine), JSON.stringify(LEGACY), 'and nothing was written');
  eq(await mine.isVisible('#addSharedBtn'), true, 'an Add button offers the shared chart as a new save');
  await mine.click('#addSharedBtn');
  eq(await chartNames(mine), ['My chart', 'Field day'], 'Add puts it beside the chart that was there');
  eq(await chosen(mine), 'Field day', 'and opens it');
  eq(await groupNames(mine), ['Sports Day', 'Time'], 'in its sent order');
  const dd = await docOf(mine);
  eq(dd.list[0].custom['Sports Day'].map(c => c.id), ['a1', 'b2'], 'the chart that was there is untouched');
  eq(dd.list[0].selected, { time: true, length_metric: true }, 'its ticks too');
  eq(mine.__dialogs.length, 1, 'Add asks nothing more');
  eq(await mine.isVisible('#addSharedBtn'), false, 'and the button goes away');
  has(await mine.textContent('#shareNote'), /^Added “Field day” as a new saved chart/, 'and says what it did');
  await mine.reload({ waitUntil: 'networkidle' });
  await settle(mine, 250);
  eq(mine.__dialogs.length, 1, 'a reload asks nothing');
  eq(await chartNames(mine), ['My chart', 'Field day'], 'and adds nothing a second time');
  await mine.close();

  /* decline and just leave: a reload is the end of it */
  const left = await open(LEGACY, { url: link, answers: [false] });
  await left.goto(PAGE, { waitUntil: 'networkidle' });
  eq(await left.isVisible('#addSharedBtn'), false, 'leaving the page after declining leaves no Add button');
  eq(await raw(left), JSON.stringify(LEGACY), 'and still nothing written');
  await left.close();

  /* accept: replaces the open chart in place, only that one */
  const two = { v: 2, data: { currentId: 'a', list: [
    { id: 'a', name: 'Mine', columns: 1, selected: { length_metric: true }, hidden: {}, custom: { Own: [{ id: 'o', text: 'own line' }] }, groupOrder: ['Own'] },
    { id: 'b', name: 'Other', columns: 2, selected: { time: true }, hidden: {}, custom: { Kept: [{ id: 'k', text: 'kept line' }] } }] } };
  const acc = await open(two, { url: link, answers: [true] });
  eq(acc.__dialogs.length, 1, 'one question');
  has(await acc.textContent('#shareNote'), /^Loaded a shared chart/, 'accepting loads it');
  eq(await chartNames(acc), ['Mine', 'Other'], 'no chart is added or removed');
  eq(await groupNames(acc), ['Sports Day', 'Time'], 'the open chart is now the shared one');
  const ad = await docOf(acc);
  eq(ad.list[0].name, 'Mine', 'it keeps the name it had');
  eq(ad.list[0].columns, 3, 'and takes the sent columns');
  const o = ad.list[1], w = two.data.list[1];
  eq([o.id, o.name, o.columns, o.selected, o.hidden, o.custom, o.groupOrder, o.lineOrder],
    [w.id, w.name, w.columns, w.selected, w.hidden, w.custom, undefined, undefined], 'the other saved chart is not touched at all');
  await acc.close();

  /* a chart whose only work is a moved group is work, not a starter */
  const moved = { v: 2, data: { currentId: 'm', list: [{ id: 'm', name: 'Only moved', columns: 2,
    selected: { length_customary: true, length_metric: true, weight_customary: true, temperature: true },
    hidden: {}, custom: {}, groupOrder: ['Temperature', 'Length (Customary)'] }] } };
  const ord = await open(moved, { url: link, answers: [false] });
  eq(ord.__dialogs.length, 1, 'a chart whose only edit is a moved group is asked before it is replaced');
  eq((await groupNames(ord))[0], 'Temperature', 'and stays as it was when declined');
  await ord.close();

  /* a chart with no order sent: the old order is not kept */
  const plain = await open(two, { url: link.replace(/chart=[^&]*/, 'chart=' + encodeURIComponent(await (async () => {
    const pg = await open(); const s = await pg.evaluate(() => window.StateLink.encodeState({ selected: { time: true }, hidden: {}, custom: {}, columns: 2 })); await pg.close(); return s; })())),
    answers: [true] });
  eq(await groupNames(plain), ['Time'], 'a shared chart with no order replaces the old order, not keeps it');
  eq((await docOf(plain)).list[0].groupOrder, undefined, 'in storage too');
  await plain.close();
}
{
  /* a link whose payload is not a chart */
  const page = await open(LEGACY);
  const bad = await page.evaluate(base => base + '?chart=' + encodeURIComponent(window.StateLink.encodeState({ nope: 1 })), PAGE);
  await page.goto(bad, { waitUntil: 'networkidle' });
  await settle(page, 250);
  eq(await groupNames(page), ['Length (Metric)', 'Time', 'Sports Day'], 'a link that is not a chart changes nothing');
  eq(await page.isVisible('#shareNote'), true, 'and says so');
  await page.close();
}
{
  /* a chart too large for a link */
  const many = [];
  for (let i = 0; i < 260; i++) many.push({ id: 'm' + i, text: `Line number ${i}: 1 unit of this equals 25.4 of that, said at length` });
  const page = await open({ selected: { time: true }, hidden: {}, custom: { Big: many }, columns: 2 });
  await page.click('#shareBtn');
  await settle(page, 300);
  const qrText = await page.textContent('.share-sheet button[data-share="qr"]');
  has(qrText, /too dense to scan/, 'a chart too big for a QR code says so in the share sheet');
  eq(await page.isVisible('.share-sheet button[data-share="download"]'), true, 'and the file download is still there');
  await page.evaluate(() => window.Share.close());
  const link = await shareLink(page);
  const back = await payloadOf(page, link);
  eq(back.custom.Big.length, 260, 'the link itself still carries every line');
  await page.close();
}
}

/* ═══ F. the rest of the page still works ═════════════════════════════════ */
if (want('F')) {
console.log('\nF. presets, columns, removing a line');
{
  const page = await open();
  await page.click('#presetElemBtn');
  eq((await groupNames(page)).length, 7, 'the elementary preset ticks seven sets');
  await page.click('#presetMiddleBtn');
  eq((await groupNames(page)).length, 11, 'the middle school preset ticks all eleven');
  await page.click('[data-hide-line="time|0"]');
  eq((await linesOf(page, 'Time')).length, 5, 'removing a built-in line takes it off the chart');
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 250);
  eq((await linesOf(page, 'Time')).length, 5, 'and it stays removed after a reload');
  await page.selectOption('#colCount', '2');
  eq((await docOf(page)).list[0].columns, 2, 'the column count is saved with the chart');
  await page.close();
}
}

await browser.close();
server.close && server.close();
console.log(`\n${failed ? 'FAILED' : 'ok'} — ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
