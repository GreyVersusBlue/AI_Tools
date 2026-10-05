// smoke-tree-view.mjs — the tree view of the key, on screen and on paper.
//
//   node Tools/dichotomous-key-builder/test/smoke-tree-view.mjs
//
// The numbered couplets are the key. The tree is a second picture of the same
// state.steps (no second model), so what this suite holds down is that the
// picture and the key cannot disagree, and that the picture prints:
//
//   Shape. Small, deep, wide and lopsided keys draw every couplet once, with
//   the right nesting, in the order the numbered key states them.
//
//   The three odd cases. A step nothing leads to is not drawn and is named; a
//   result reached from two couplets is two nodes that each name the other; a
//   step reached twice, a loop back up and a dead end are pointers and a
//   marked leaf, never a second copy and never an endless drawing.
//
//   Reading it without seeing it. The structure is a real nested list (the
//   level is announced by the list, not drawn), the summary states what the
//   numbered list cannot (couplets reached, longest route), every result
//   names its route, and the sideways-scrolling box can be reached by Tab.
//
//   Paper. "Print tree overview" and the opt-in checkbox put the tree on a page
//   of its own after the worksheet; each of the four shapes comes out as
//   exactly one sheet of Chromium PDF; with the box unticked the printed
//   output has no tree page, which is the old output.
//
//   Nothing else moves. A saved key from before this view loads byte-for-byte
//   unchanged, and drawing the tree never writes to storage.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8484;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/057-dichotomous-key-builder.html';
const SHOTS = process.env.DKB_SHOTS || '';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/* ── fixtures: every name is made up ─────────────────────────────────────── */
const C = (text, leadsTo = '', result = '', examples = '') => ({ text, leadsTo, result, examples });
const key = (title, steps) => ({ title, steps: steps.map(([id, a, b]) => ({ id, a, b })) });

const small = key('Small key', [
  ['s1', C('Has wings', 's2'), C('No wings', '', 'Crawler', 'Beetle')],
  ['s2', C('Has a beak', '', 'Flier', 'Finch'), C('No beak', '', 'Insect', 'Bee')]
]);
// deep: a chain, one couplet drops out to a result at every level
const deepSteps = [];
for (let i = 1; i <= 10; i++) {
  deepSteps.push(['d' + i, C('Trait ' + i + ' present', i < 10 ? 'd' + (i + 1) : '', i < 10 ? '' : 'Deep result', ''), C('Trait ' + i + ' absent', '', 'Result ' + i, 'Sample ' + i)]);
}
const deep = key('Deep key', deepSteps);
// wide: a balanced tree, 16 results
const wideSteps = [];
for (let n = 1; n <= 15; n++) {
  const l = 2 * n, r = 2 * n + 1;
  wideSteps.push(['w' + n, l <= 15 ? C('Left of ' + n, 'w' + l) : C('Left of ' + n, '', 'Wide ' + (n * 2 - 15 + 15), 'Item ' + l),
                          r <= 15 ? C('Right of ' + n, 'w' + r) : C('Right of ' + n, '', 'Wide ' + (n * 2 + 1), 'Item ' + r)]);
}
const wide = key('Wide key', wideSteps);
// lopsided: one long arm and one single leaf at the top
const lopsided = key('Lopsided key', [
  ['l1', C('Leaf only', '', 'Quick answer', 'One'), C('Anything else', 'l2')],
  ['l2', C('Tall', 'l3'), C('Short', '', 'Short thing', 'Two')],
  ['l3', C('Thin', 'l4'), C('Thick', '', 'Thick thing', 'Three')],
  ['l4', C('Green', '', 'Long answer A', 'Four'), C('Not green', '', 'Long answer B', 'Five')]
]);
// an unreachable step (nothing leads to u3), and a result reached twice
const odd = key('Odd key', [
  ['u1', C('Round', 'u2'), C('Square', '', 'Block', 'Cube')],
  ['u2', C('Smooth', '', 'Block', 'Brick'), C('Rough', '', 'Stone', 'Pebble')],
  ['u3', C('Orphan one', '', 'Nowhere', ''), C('Orphan two', '', 'Nowhere else', '')]
]);
// a step reached by two couplets, a loop back to step 1, and a dead end
const tangled = key('Tangled key', [
  ['t1', C('Red', 't2'), C('Blue', 't2')],
  ['t2', C('Big', 't1'), C('Small', 't3')],
  ['t3', C('Soft', '', '', ''), C('Hard', 'gone')]
]);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 1000 });
await page.addInitScript(() => { window.__prints = 0; window.print = () => { window.__prints++; }; });

async function load(k, theme) {
  await page.goto(URL_PAGE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([k, theme]) => {
    localStorage.setItem('dkb_key_v1', JSON.stringify(k));
    if (theme) localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme, textScale: 100, dyslexic: false }));
    else localStorage.removeItem('gvb-a11y-prefs');
  }, [k, theme]);
  await page.reload({ waitUntil: 'networkidle' });
}
// every node in the on-screen tree, in document order
const nodes = () => page.evaluate(() => Array.from(document.querySelectorAll('#treeWrap .tn')).map(n => ({
  cls: n.className.replace('tn', '').trim(),
  label: (n.querySelector('.cn') || {}).textContent || '',
  depth: (function () { let c = 0, e = n; while (e && e.id !== 'treeWrap') { if (e.tagName === 'UL') c++; e = e.parentElement; } return c - 1; })(),
  text: n.textContent.replace(/\s+/g, ' ').trim()
})));
const labels = async () => (await nodes()).filter(n => n.label).map(n => n.label);
const summary = () => page.textContent('#treeSummary');
const notes = () => page.evaluate(() => Array.from(document.querySelectorAll('#treeNotes li')).map(l => l.textContent));
// the numbered key's own order of couplets: 1a,1b,2a,2b…
const stepLabels = k => k.steps.flatMap((s, i) => [(i + 1) + 'a', (i + 1) + 'b']);
const sorted = a => a.slice().sort();

console.log('Dichotomous Key Builder — tree view');

/* ── 1. the starter key: shape, nesting, routes ──────────────────────────── */
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
const starter = await nodes();
eq(starter.map(n => n.label), ['', '1a.', '2a.', '2b.', '1b.'], 'the starter key draws its start box and four couplets, branch by branch (1a, what lies under it, then 1b)');
eq(starter.map(n => n.depth), [0, 1, 2, 2, 1], '1a and 1b are one level in, 2a and 2b a level under 1a');
ok(/Result: Invertebrate/.test(starter[4].text) && /Route: 1b$/.test(starter[4].text), 'a result says what it is and the route that reaches it: ' + JSON.stringify(starter[4].text));
ok(/Result: Mammal/.test(starter[2].text) && /Route: 1a › 2a$/.test(starter[2].text), 'a deeper result writes its whole route: ' + JSON.stringify(starter[2].text));
eq(await summary(), '4 couplets in 2 of 2 steps reach 3 results; the longest route is 2 couplets.', 'the summary states what the list does not: couplets reached, results, longest route');
eq(await notes(), [], 'a sound key has no notes');
eq(await page.evaluate(() => document.querySelector('#treeWrap .tn.start').textContent), 'Start', 'an untitled key names the root "Start"');
await page.fill('#keyTitle', 'Pond life');
eq(await page.evaluate(() => document.querySelector('#treeWrap .tn.start').textContent), 'Pond life', 'typing a title renames the root box');

/* ── 2. small, deep, wide, lopsided: every couplet once, in the key's order ─ */
for (const [name, k, results, longest] of [['small', small, 3, 2], ['deep', deep, 11, 10], ['wide', wide, 16, 4], ['lopsided', lopsided, 5, 4]]) {
  await load(k);
  const got = await labels();
  eq(sorted(got.map(l => l.replace('.', ''))), sorted(stepLabels(k)), `${name}: every couplet of the numbered key is drawn exactly once`);
  const all = await nodes();
  eq(all.filter(n => n.cls.includes('result')).length, results, `${name}: ${results} results drawn`);
  eq(await summary(), `${stepLabels(k).length} couplets in ${k.steps.length} of ${k.steps.length} steps reach ${results} results; the longest route is ${longest} couplets.`, `${name}: the summary counts match the key`);
  const lastLeaf = all.filter(n => n.cls.includes('result')).map(n => n.text.match(/Route: (.*)$/)[1].split(' › ').length);
  eq(Math.max(...lastLeaf), longest, `${name}: the longest written route is ${longest} couplets`);
}
await load(deep);
{
  const d = await nodes();
  eq(Math.max(...d.map(n => n.depth)), 10, 'deep: ten steps are ten levels under the start');
}
await load(lopsided);
{
  const d = await nodes();
  const quick = d.find(n => n.label === '1a.');
  const arm = d.find(n => n.label === '4b.');
  eq([quick.depth, arm.depth], [1, 4], 'lopsided: the one-couplet answer sits at level 1 and the long arm reaches level 4');
}

/* ── 3. the odd cases ────────────────────────────────────────────────────── */
await load(odd);
{
  const d = await nodes();
  ok(!d.some(n => /Orphan/.test(n.text)), 'unreachable: the orphan step is not drawn');
  eq(d.filter(n => n.label).length, 4, 'unreachable: only the four reachable couplets are drawn');
  eq(await notes(), ['Not drawn, because nothing leads to it: step 3.'], 'unreachable: the step is named under the tree');
  eq(await summary(), '4 couplets in 2 of 3 steps reach 3 results; the longest route is 2 couplets.', 'unreachable: the summary counts only what the tree reaches');
  const blocks = d.filter(n => /Result: Block/.test(n.text));
  eq(blocks.length, 2, 'a result reached twice is drawn at both couplets');
  ok(blocks.every(b => /Also reached at (1b|2a)/.test(b.text)) && blocks[0].text.includes('2a') && blocks[1].text.includes('1b'),
     'and each names the other couplet: ' + JSON.stringify(blocks.map(b => b.text)));
  ok(!d.find(n => /Result: Stone/.test(n.text)).text.includes('Also'), 'a result reached once says nothing of the kind');
}
await load(tangled);
{
  const d = await nodes();
  const labelsDrawn = d.filter(n => n.label).map(n => n.label);
  eq(labelsDrawn, ['1a.', '2a.', '2b.', '3a.', '3b.', '1b.'], 'tangled: a step reached twice is drawn once (under the first couplet to reach it), then 1b points at it');
  const by = l => d.find(n => n.label === l);
  ok(by('1b.').cls.includes('ref') && /Continues at step 2, drawn under 1a/.test(by('1b.').text), 'tangled: the second way in is a pointer that says where the step is drawn: ' + JSON.stringify(by('1b.').text));
  ok(by('2a.').cls.includes('ref') && /Loops back to step 1/.test(by('2a.').text), 'tangled: a loop back up is a pointer, not an endless tree: ' + JSON.stringify(by('2a.').text));
  ok(by('3a.').cls.includes('bad') && /Dead end/.test(by('3a.').text), 'tangled: a couplet with no step and no result is a marked dead end');
  ok(by('3b.').cls.includes('bad') && /Dead end/.test(by('3b.').text), 'tangled: a couplet leading to a deleted step is a dead end too');
  eq(await notes(), ['Dead ends at 3a, 3b.', 'Loop at 2a.'], 'tangled: the notes list the dead ends and the loop');
}

/* ── 4. the tree follows edits and says nothing the key doesn't ──────────── */
await load(small);
await page.selectOption('#stepsWrap .step-block:nth-of-type(1) .choice-row[data-choice="a"] select[data-field="leadsTo"]', '');
await settle(page);
{
  const d = await nodes();
  eq(d.filter(n => n.label).map(n => n.label), ['1a.', '1b.'], 'turning 1a into a final answer takes step 2 off the tree');
  eq(await notes(), ['Not drawn, because nothing leads to it: step 2.', 'Dead end at 1a.'], '…and it names the step now cut off and the dead end');
}
await page.click('#addStepBtn');
await settle(page);
eq((await summary()).replace(/ reach.*/, ''), '2 couplets in 1 of 3 steps', 'a step added but not linked is counted as not reached');
await page.click('#stepsWrap .step-block:nth-of-type(2) [data-del-step]');
await settle(page);
eq((await summary()).replace(/ reach.*/, ''), '2 couplets in 1 of 2 steps', 'removing a step changes the tree at once');

/* ── 5. a screen reader and the keyboard ─────────────────────────────────── */
await load(small);
{
  const a = await page.evaluate(() => {
    const root = document.querySelector('#treeWrap ul.tv');
    const lists = root.querySelectorAll('ul').length;
    const items = root.querySelectorAll('li').length;
    return {
      rootLabel: root.getAttribute('aria-label'),
      lists: lists + 1, items,
      roles: Array.from(root.querySelectorAll('ul,li')).every(e => e.getAttribute('role') === 'list' || e.getAttribute('role') === 'listitem'),
      region: document.getElementById('treeWrap').getAttribute('aria-label'),
      tab: document.getElementById('treeWrap').tabIndex,
      summaryText: document.getElementById('treeSummary').textContent.length > 20,
      details: document.querySelector('details.tree-card > summary').textContent,
      imgs: document.querySelectorAll('#treeWrap svg, #treeWrap canvas, #treeWrap [aria-hidden]').length
    };
  });
  eq(a.rootLabel, 'Key tree', 'the tree is a labelled list');
  eq([a.lists, a.items], [3, 5], 'its structure is nested lists: one per branching, one item per box');
  ok(a.roles, 'every list and item states its role, so list-style:none does not drop the structure in Safari');
  eq(a.imgs, 0, 'nothing in the tree is a picture or hidden from assistive tech');
  eq(a.tab, 0, 'the sideways-scrolling box takes a tab stop, so a keyboard user can scroll a wide tree');
  eq(a.details, 'Tree view', 'the card is a native disclosure');
  await page.focus('#treeWrap');
  await page.keyboard.press('Tab');
  eq(await page.evaluate(() => document.activeElement.id), 'printTreeBtn', 'Tab leaves the scroll box for the print button');
  await page.keyboard.press('Enter');
  await settle(page);
  eq(await page.evaluate(() => window.__prints), 1, 'Enter on the print button prints');
  const s = await a11yScan(page, { impact: 'moderate', include: '#treeCard' });
  eq(s.map(v => v.id), [], 'axe finds nothing at moderate or worse in the tree card');
}
await load(wide, 'dark');
{
  eq(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'dark', 'the dark theme is on for the next check');
  const s = await a11yScan(page, { impact: 'moderate', include: '#treeCard' });
  eq(s.map(v => v.id), [], 'axe finds nothing in dark on a wide key either (colour contrast on the node tints included)');
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('#treeWrap .tn.result')).backgroundColor);
  ok(bg !== 'rgb(228, 245, 234)', 'the result tint is the dark one, not the light literal: ' + bg);
}

/* ── 6. printing: opt-in, own page, after the worksheet ──────────────────── */
await load(small);
const printed = () => page.evaluate(() => {
  const pa = document.getElementById('printArea');
  return {
    tree: !!pa.querySelector('#treePage'),
    pages: Array.from(pa.children).map(c => c.id === 'treePage' ? 'tree' : (c.className || c.tagName)),
    couplets: pa.querySelectorAll('.key-couplet').length,
    printedLabels: Array.from(pa.querySelectorAll('#treePage .cn')).map(e => e.textContent),
    heading: (pa.querySelector('#treePage h1') || {}).textContent || ''
  };
});
await page.click('#printBtn');
{
  const p = await printed();
  eq(p.tree, false, 'with the box unticked the worksheet prints with no tree page (the old output)');
  eq(p.couplets, 4, 'and its four numbered couplets are as before');
}
await page.check('#includeTree');
await page.click('#printBtn');
{
  const p = await printed();
  eq(p.tree, true, 'ticking the box puts a tree page in the print');
  eq(p.pages.map(x => x.replace('sheet-page tree-page', 'tree')), ['sheet-page', 'tree', 'DIV'], 'the order is worksheet, then tree, then the answer key');
  eq(p.couplets, 4, 'the numbered key is still on the first page');
  eq(p.printedLabels, await labels(), 'the printed tree is the same couplets as the screen tree, in the same order');
  eq(p.heading, 'Small key — the key at a glance', 'the page is headed with the key title');
}
await page.uncheck('#includeSpecimens');
await page.click('#printBtn');
eq((await printed()).pages.map(x => x.replace('sheet-page tree-page', 'tree')), ['sheet-page', 'tree'], 'without specimens the tree follows the reference key directly');
await page.click('#printTreeBtn');
{
  const p = await printed();
  eq(p.pages, ['tree'], '"Print tree overview" prints the tree page alone');
  eq(p.couplets, 0, 'with no numbered key beside it');
  eq(await page.evaluate(() => document.getElementById('printArea').getAttribute('style')), null, 'and leaves #printArea as it found it after measuring');
}
await page.check('#includeSpecimens');
await page.uncheck('#includeTree');

/* ── 7. one sheet each: Chromium's own PDF ───────────────────────────────── */
const pdfPages = async () => {
  const buf = await page.pdf({ format: 'Letter', printBackground: true });
  return (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
};
for (const [name, k] of [['small', small], ['deep', deep], ['wide', wide], ['lopsided', lopsided], ['odd', odd], ['tangled', tangled]]) {
  await load(k);
  await page.click('#printTreeBtn');
  const zoom = await page.evaluate(() => document.querySelector('#printArea .tree-fit').style.zoom);
  eq(await pdfPages(), 1, `${name}: "Print tree overview" is exactly one page of PDF (zoom ${zoom})`);
  if (SHOTS) {
    await page.emulateMedia({ media: 'print' });
    await page.screenshot({ path: `${SHOTS}/${name}-print.png`, fullPage: true });
    await page.emulateMedia({ media: null });
    await page.locator('#treeCard').screenshot({ path: `${SHOTS}/${name}-screen.png` });
  }
}
await load(deep);
await page.click('#printTreeBtn');
ok(parseFloat(await page.evaluate(() => document.querySelector('#printArea .tree-fit').style.zoom)) < 1, 'a deep key is shrunk to fit');
await load(small);
await page.click('#printTreeBtn');
eq(await page.evaluate(() => document.querySelector('#printArea .tree-fit').style.zoom), '1', 'a small key is not shrunk');
{
  // worksheet + tree + answer key in one job: three sheets for the starter key with specimens
  await page.check('#includeTree');
  await page.click('#printBtn');
  eq(await pdfPages(), 3, 'worksheet, tree and answer key are three pages of PDF');
  await page.uncheck('#includeTree');
  await page.click('#printBtn');
  eq(await pdfPages(), 2, 'and without the tree it is the old two');
}

/* ── 8. saved state is untouched ─────────────────────────────────────────── */
{
  const legacy = JSON.stringify({ title: 'Saved before the tree', steps: [
    { id: 'old1', a: { text: 'Cold', leadsTo: 'old2', result: '', examples: '' }, b: { text: 'Warm', leadsTo: '', result: 'Mammal', examples: 'Cat' } },
    { id: 'old2', a: { text: 'Scaly', leadsTo: '', result: 'Reptile', examples: 'Gecko' }, b: { text: 'Smooth', leadsTo: '', result: 'Amphibian', examples: 'Frog' } }] });
  await page.goto(URL_PAGE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(s => localStorage.setItem('dkb_key_v1', s), legacy);
  await page.reload({ waitUntil: 'networkidle' });
  eq(await page.evaluate(() => localStorage.getItem('dkb_key_v1')), legacy, 'a key saved before the tree loads and draws without a byte of its saved form changing');
  eq(await labels(), ['1a.', '2a.', '2b.', '1b.'], 'and it draws');
  eq(await page.inputValue('#keyTitle'), 'Saved before the tree', 'with its title');
  await page.click('#printTreeBtn');
  await page.check('#includeTree');
  await page.click('#printBtn');
  eq(await page.evaluate(() => localStorage.getItem('dkb_key_v1')), legacy, 'printing the tree does not write to storage either');
}

/* ── 9. no console noise ─────────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
