// smoke-grid-types.mjs — the newer sheets of the graph paper tool, in the real page.
//
//   node Tools/graph-paper-generator/test/smoke-grid-types.mjs      (port 8517)
//
// smoke-grid-types-core.mjs checks the geometry of every sheet with no browser. This one checks
// what only the page can: that the controls reach the renderer (the preview is exactly the
// renderer's own output for the same options), that a preset saved before these sheets opens
// and previews as it did (golden-old-render.json, recorded from the page before the change),
// that the new settings are saved and come back after a reload, that the sheet-type buttons work
// from the keyboard, and that every new sheet prints on one Letter page, portrait and landscape,
// with nothing past the paper and no line thinner than the tool's thinnest.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const sha = (s) => createHash('sha256').update(s).digest('hex');

console.log('Graph Paper — the newer sheets in the page');

const here = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(path.join(here, 'golden-old-render.json'), 'utf8'));
const PORT = 8517, BASE = `http://127.0.0.1:${PORT}`;
const server = await serve(PORT);
const browser = await launch();
const URL = `${BASE}/Tools/012-graph-paper-generator.html`;

// Counts the pages of a PDF the way the 020 suite does: every /Type /Page object.
function pdfPages(buf) {
  const s = buf.toString('latin1'), re = /(\d+) 0 obj\s*([\s\S]*?)endobj/g;
  let m, pages = 0;
  while ((m = re.exec(s))) if (/\/Type\s*\/Page[^s]/.test(m[2])) pages++;
  return pages;
}

const NEW_KEYS = ['nlKind', 'nlIntMin', 'nlIntMax', 'nlDecMin', 'nlDecMax', 'nlDecStep', 'nlFracMin', 'nlFracMax', 'nlFracDen',
  'nlFracStyle', 'nlFracReduce', 'nlOpenTicks', 'nlDlTopStep', 'nlDlBottomStep', 'nlDlIntervals', 'nlDlTopName', 'nlDlBottomName',
  'nlDlBottom', 'nlVtMin', 'nlVtMax', 'nlVtInterval', 'polarRays', 'polarRing', 'polarLabels', 'logKind', 'logDecades',
  'logStartExp', 'logXDivisions', 'logXDecades', 'logXStartExp', 'hexTop', 'sbFrames', 'sbAspect', 'sbCaption', 'msGap', 'msGrand'];

/* ── 1. a preset saved before today ────────────────────────────────────── */
console.log('1. presets saved before the new sheets');
for (const [name, g] of Object.entries(golden.page)) {
  const page = await prepPage(browser, BASE, { width: 1300, height: 1100 });
  await page.addInitScript(([s]) => {
    if (localStorage.getItem('gvb-graph-paper:list')) return;
    localStorage.setItem('gvb-graph-paper:list', JSON.stringify([s.name]));
    localStorage.setItem('gvb-graph-paper:data:' + s.name, JSON.stringify(s));
    localStorage.setItem('gvb-graph-paper:current', s.name);
  }, [g.preset]);
  await page.goto(URL, { waitUntil: 'networkidle' });
  await settle(page, 300);
  const html = await page.$eval('#previewArea', e => e.innerHTML);
  eq(sha(html), g.sha, `${name}: the preview is byte for byte what the old page drew`);
  const stored = await page.evaluate(() => localStorage.getItem('gvb-graph-paper:data:Golden'));
  const parsed = JSON.parse(stored);
  const extra = Object.keys(parsed).filter(k => !(k in g.preset));
  eq(extra.sort(), [...NEW_KEYS].sort(), `${name}: the only keys the page adds to the saved preset are the new ones`);
  NEW_KEYS.forEach(k => delete parsed[k]);
  eq(sha(JSON.stringify(parsed)), g.storedSha, `${name}: and with them taken away the saved preset is byte for byte the old one`);
  eq(page.__errs.length, 0, `${name}: no page errors ${JSON.stringify(page.__errs.slice(0, 2))}`);
  await page.context().close();
}

/* ── 2. the sheet-type buttons, from the keyboard ──────────────────────── */
console.log('2. the sheet-type buttons');
const page = await prepPage(browser, BASE, { width: 1300, height: 1500 });
await page.goto(URL, { waitUntil: 'networkidle' });
await settle(page, 300);
{
  const tabs = await page.$$eval('.mode-tab', els => els.map(e => ({ mode: e.dataset.mode, role: e.getAttribute('role'), tab: e.tabIndex, pressed: e.getAttribute('aria-pressed') })));
  eq(tabs.map(t => t.mode), ['graph', 'numberline', 'plane', 'worksheet', 'isometric', 'polar', 'log', 'storyboard', 'music', 'cornell', 'handwriting', 'calibration'], 'twelve sheet types, with polar, log, storyboard and music among them');
  ok(tabs.every(t => t.role === 'button' && t.tab === 0), 'each is a button a keyboard can reach');
  eq(tabs.filter(t => t.pressed === 'true').map(t => t.mode), ['graph'], 'exactly one is pressed, and it is graph paper');
  await page.focus('.mode-tab[data-mode="polar"]');
  await page.keyboard.press('Enter');
  await settle(page, 200);
  eq(await page.$eval('#panel-polar', e => e.classList.contains('active')), true, 'Enter on Polar opens its panel');
  eq(await page.$$eval('.mode-tab[aria-pressed="true"]', e => e.map(x => x.dataset.mode)), ['polar'], 'and it alone is pressed');
  await page.focus('.mode-tab[data-mode="log"]');
  await page.keyboard.press('Space');
  await settle(page, 200);
  eq(await page.$eval('#panel-log', e => e.classList.contains('active')), true, 'Space on Log / semi-log opens its panel');
  ok(!(await page.$eval('#panel-polar', e => e.classList.contains('active'))), 'and closes the one before');
}

/* ── helpers to drive the page ─────────────────────────────────────────── */
const preview = () => page.$eval('#previewArea', e => e.innerHTML);
async function set(id, value) {
  const tag = await page.$eval('#' + id, e => e.tagName + ':' + (e.type || ''));
  if (tag === 'SELECT:select-one') await page.selectOption('#' + id, String(value));
  else if (tag === 'INPUT:checkbox') { if ((await page.isChecked('#' + id)) !== value) await page.click('#' + id); }
  else await page.fill('#' + id, String(value));
  await settle(page, 80);
}
// What the renderer itself draws for the same options, called in the page.
// Parsed and re-serialised the way the preview's own innerHTML is, so the two compare.
const expected = (fn, opts) => page.evaluate(([f, o]) => {
  const d = document.createElement('div');
  d.innerHTML = window.GraphPaperRender[f](o).svg;
  return d.innerHTML;
}, [fn, opts]);
const visible = (id) => page.$eval('#' + id, e => getComputedStyle(e).display !== 'none');

/* ── 3. polar ──────────────────────────────────────────────────────────── */
console.log('3. polar paper');
await page.click('.mode-tab[data-mode="polar"]');
await set('polarRays', 24); await set('polarRing', '0.3937'); await set('polarLabels', true);
eq(await preview(), await expected('renderPolarPaper', { orientation: 'portrait', rays: 24, ringStep: 0.3937, labels: true, faded: false, header: null }), 'polar: the preview is the renderer\'s sheet for 24 rays at 1 cm');
const polarSvg = await preview();
eq((polarSvg.match(/<circle /g) || []).length, 9, 'polar: nine 1 cm circles fit a portrait page');
await set('polarLabels', false);
eq(await preview(), await expected('renderPolarPaper', { orientation: 'portrait', rays: 24, ringStep: 0.3937, labels: false, faded: false, header: null }), 'polar: turning labels off reaches the sheet');
ok(!/°/.test(await preview()), 'polar: and no degree label is left');
await set('polarRays', 12); await set('polarRing', '1'); await set('polarLabels', true);
await set('headerOn', true); await set('headerTitle', 'Unit circle'); await set('faded', true);
eq(await preview(), await expected('renderPolarPaper', { orientation: 'portrait', rays: 12, ringStep: 1, labels: true, faded: true, header: { title: 'Unit circle', showName: false, showDate: false } }), 'polar: the header and the lighter-lines option reach it too');
await set('headerOn', false); await set('faded', false);

/* ── 4. log and semi-log ───────────────────────────────────────────────── */
console.log('4. log and semi-log paper');
await page.click('.mode-tab[data-mode="log"]');
eq([await visible('logSemiFields'), await visible('logLogFields')], [true, false], 'log: semi-log shows the even-division field and not the x decades');
await set('logDecades', 4); await set('logStartExp', -1); await set('logXDivisions', '20');
eq(await preview(), await expected('renderLogPaper', { orientation: 'portrait', kind: 'semilog', decades: 4, startExp: -1, xDecades: 3, xStartExp: 0, xDivisions: 20, faded: false, header: null }), 'log: semi-log, 4 decades from 0.1, 20 divisions');
eq(await page.$$eval('#previewArea text[text-anchor="end"]', t => t.map(x => x.textContent)), ['0.1', '1', '10', '100', '1000'], 'log: the y decades read 0.1 to 1000');
await set('logKind', 'loglog');
eq([await visible('logSemiFields'), await visible('logLogFields')], [false, true], 'log: log-log swaps in the x decades');
await set('logXDecades', 2); await set('logXStartExp', 1);
eq(await preview(), await expected('renderLogPaper', { orientation: 'portrait', kind: 'loglog', decades: 4, startExp: -1, xDecades: 2, xStartExp: 1, xDivisions: 20, faded: false, header: null }), 'log: log-log, x over 2 decades from 10');
eq(await page.$$eval('#previewArea text[text-anchor="middle"]', t => t.map(x => x.textContent)), ['10', '100', '1000'], 'log: the x decades read 10, 100, 1000');
await set('logDecades', 99);
eq(await page.$eval('#logDecades', e => e.value), '99', 'log: the field shows what was typed');
eq(await page.evaluate(() => JSON.parse(localStorage.getItem('gvb-graph-paper:data:My Settings')).logDecades), 6, 'log: and the saved setting is held to 6');
await set('logDecades', 3);

/* ── 4b. hexagonal paper, engineering squares, storyboard, music staff ── */
console.log('4b. hexagonal, engineering, storyboard and music');
await page.click('.mode-tab[data-mode="graph"]');
eq(await visible('hexFields'), false, 'hex: the hexagon field is hidden for square paper');
await set('gridStyle', 'hex');
eq([await visible('hexFields'), await visible('exactCountLine'), await visible('boldCenterLine'), await visible('labelAxesLine')], [true, false, false, false], 'hex: its orientation shows, and the square-only options step aside');
eq(await preview(), await expected('renderHexPaper', { orientation: 'portrait', cellSize: 0.25, hexTop: 'pointy', faded: false, header: null }), 'hex: pointy-top hexagons of side 1/4 inch');
await set('hexTop', 'flat'); await set('gridSizePreset', '0.5');
eq(await preview(), await expected('renderHexPaper', { orientation: 'portrait', cellSize: 0.5, hexTop: 'flat', faded: false, header: null }), 'hex: flat-top, side 1/2 inch');
await set('gridSizePreset', 'custom'); await set('gridSizeCustom', 3);
eq(await preview(), await expected('renderHexPaper', { orientation: 'portrait', cellSize: 1 / 3, hexTop: 'flat', faded: false, header: null }), 'hex: a custom 3 per inch is a side of a third of an inch');
await set('gridStyle', 'square');
eq(await visible('hexFields'), false, 'hex: back to square paper hides it again');
await set('gridSizePreset', '0.2');
eq(await preview(), await expected('renderGraphPaper', { orientation: 'portrait', style: 'square', mode: 'fill', cellSize: 0.2, cols: 10, rows: 10, boldCenter: false, labelAxes: false, labelInterval: 5, faded: false, header: null }), 'engineering: five squares to the inch is a fifth of an inch');
eq(await page.$eval('#gridSizePreset', e => e.value), '0.2', 'engineering: and the select says so');
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
eq(await page.$eval('#gridSizePreset', e => e.value), '0.2', 'engineering: after a reload the select still says 5 per inch');
eq(await preview(), await expected('renderGraphPaper', { orientation: 'portrait', style: 'square', mode: 'fill', cellSize: 0.2, cols: 10, rows: 10, boldCenter: false, labelAxes: false, labelInterval: 5, faded: false, header: null }), 'engineering: after a reload the paper is still a fifth of an inch');
await set('gridSizePreset', '0.25'); await set('gridStyle', 'hex');
await page.click('.mode-tab[data-mode="storyboard"]');
await set('sbFrames', 8); await set('sbAspect', '4:3'); await set('sbCaption', 3);
eq(await preview(), await expected('renderStoryboard', { orientation: 'portrait', frames: 8, aspect: '4:3', captionLines: 3, faded: false, header: null }), 'storyboard: eight 4:3 frames with three caption lines');
await page.click('.mode-tab[data-mode="music"]');
await set('msGap', '0.16'); await set('msGrand', true);
eq(await preview(), await expected('renderMusicStaves', { orientation: 'portrait', lineGap: 0.16, grand: true, faded: false, header: null }), 'music: a large grand staff');
await set('msGrand', false); await set('msGap', '0.1');
eq(await preview(), await expected('renderMusicStaves', { orientation: 'portrait', lineGap: 0.1, grand: false, faded: false, header: null }), 'music: small single staves');
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
eq(await page.evaluate(() => [document.getElementById('hexTop').value, document.getElementById('sbFrames').value, document.getElementById('sbAspect').value, document.getElementById('msGap').value, document.getElementById('msGrand').checked, document.getElementById('gridStyle').value]), ['flat', '8', '4:3', '0.1', false, 'hex'], 'all of it is saved and comes back after a reload');
await page.click('.mode-tab[data-mode="graph"]');
eq(await visible('hexFields'), true, 'and a reload into hexagonal paper shows its field');
await set('gridStyle', 'square');

/* ── 5. number-line kinds ──────────────────────────────────────────────── */
console.log('5. number-line kinds');
await page.click('.mode-tab[data-mode="numberline"]');
const FIELDS = { integer: 'nlIntFields', decimal: 'nlDecFields', fraction: 'nlFracFields', open: 'nlOpenFields', double: 'nlDoubleFields', vertical: 'nlVerticalFields' };
async function shown() {
  const out = {};
  for (const id of [...Object.values(FIELDS), 'nlUniformFields', 'nlIndependentLine', 'nlLabelEveryWrap']) out[id] = await visible(id);
  return out;
}
{
  const s = await shown();
  eq(Object.entries(s).filter(([, v]) => v).map(([k]) => k), ['nlUniformFields', 'nlIndependentLine', 'nlLabelEveryWrap'], 'standard: the old fields and no new ones');
}
const base = { orientation: 'portrait', copies: 1, labelEvery: 1, faded: false, header: null };
const cases = [
  ['integer', async () => { await set('nlIntMin', -4); await set('nlIntMax', 6); }, 'renderDecimalLine', { min: -4, max: 6, step: 'ones' }],
  ['decimal', async () => { await set('nlDecMin', 0.2); await set('nlDecMax', 0.9); await set('nlDecStep', 'hundredths'); }, 'renderDecimalLine', { min: 0.2, max: 0.9, step: 'hundredths' }],
  ['fraction', async () => { await set('nlFracMin', -1); await set('nlFracMax', 2); await set('nlFracDen', 6); await set('nlFracStyle', 'improper'); await set('nlFracReduce', false); }, 'renderFractionLine', { min: -1, max: 2, denominator: 6, labelStyle: 'improper', reduce: false }],
  ['open', async () => { await set('nlOpenTicks', 7); }, 'renderOpenLine', { ticks: 7 }],
  ['double', async () => { await set('nlDlTopStep', 2.5); await set('nlDlBottomStep', 10); await set('nlDlIntervals', 8); await set('nlDlTopName', 'cups'); await set('nlDlBottomName', 'servings'); await set('nlDlBottom', 'example'); }, 'renderDoubleLine', { topStep: 2.5, bottomStep: 10, intervals: 8, topName: 'cups', bottomName: 'servings', bottom: 'example' }],
  ['vertical', async () => { await set('nlVtMin', -20); await set('nlVtMax', 40); await set('nlVtInterval', 5); }, 'renderVerticalLine', { min: -20, max: 40, interval: 5 }],
];
for (const [kind, drive, fn, opts] of cases) {
  await set('nlKind', kind);
  const s = await shown();
  const wantVisible = [FIELDS[kind], 'nlLabelEveryWrap'].filter(id => !(id === 'nlLabelEveryWrap' && (kind === 'open' || kind === 'double')));
  eq(Object.entries(s).filter(([, v]) => v).map(([k]) => k).sort(), wantVisible.sort(), `${kind}: only its own fields show` + (kind === 'open' || kind === 'double' ? ', and no label-every' : ''));
  await drive();
  eq(await preview(), await expected(fn, { ...base, ...opts }), `${kind}: the preview is the renderer's sheet for what was typed`);
  await set('nlCopies', 2);
  const copies = kind === 'double' ? 2 : 2;
  eq(await preview(), await expected(fn, { ...base, ...opts, copies }), `${kind}: two copies reach the sheet`);
  await set('nlCopies', 1);
}
// the standard line, with its range rows, is still reachable and unchanged
await set('nlKind', 'standard');
eq(await preview(), await expected('renderNumberLine', { orientation: 'portrait', min: 0, max: 20, interval: 1, labelEvery: 1, copies: 1, faded: false, header: null }), 'standard: back to the original line, byte for byte');
await set('nlIndependent', true);
ok(await visible('nlRowsContainer'), 'standard: its own copy-by-copy rows still open');
await set('nlKind', 'fraction');
ok(!(await visible('nlRowsContainer')) && !(await visible('nlIndependentLine')), 'fraction: the standard rows and their checkbox step aside');
await set('nlKind', 'standard');
ok(await visible('nlRowsContainer'), 'and come back with the standard line');
await set('nlIndependent', false);

/* ── 6. saved and restored ─────────────────────────────────────────────── */
console.log('6. saved settings');
await set('nlKind', 'fraction');
await set('nlFracDen', 8); await set('nlFracMin', 0); await set('nlFracMax', 3); await set('nlFracStyle', 'mixed'); await set('nlFracReduce', true);
const before = await preview();
const savedBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('gvb-graph-paper:data:My Settings')));
eq([savedBefore.nlKind, savedBefore.nlFracDen, savedBefore.nlFracMax, savedBefore.nlFracStyle, savedBefore.nlFracReduce, savedBefore.mode], ['fraction', 8, 3, 'mixed', true, 'numberline'], 'the new settings are saved in the preset');
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
eq(await preview(), before, 'after a reload the same sheet is back');
eq(await page.evaluate(() => [document.getElementById('nlKind').value, document.getElementById('nlFracDen').value, document.getElementById('nlFracReduce').checked]), ['fraction', '8', true], 'and the form shows what was saved');
ok(await visible('nlFracFields'), 'with the fraction fields open');
await page.click('.mode-tab[data-mode="polar"]');
await set('polarRays', 16);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
eq(await page.$eval('#polarRays', e => e.value), '16', 'the polar setting survives a reload too');
eq(await page.$eval('.mode-tab[aria-pressed="true"]', e => e.dataset.mode), 'polar', 'and so does the sheet type');
// a second preset starts clean, and the first keeps its own
await page.evaluate(() => { window.prompt = () => 'Second'; });
await page.click('#newPresetBtn');
await settle(page, 200);
eq(await page.$eval('#polarRays', e => e.value), '12', 'a new preset has the default 12 rays');
eq(await page.$eval('#nlKind', e => e.value), 'standard', 'and the standard number line');
await page.selectOption('#presetSwitch', 'My Settings');
await settle(page, 200);
eq(await page.$eval('#polarRays', e => e.value), '16', 'switching back finds the first preset as it was left');

/* ── 7. print: every new sheet on one Letter page ──────────────────────── */
console.log('7. printing');
await page.evaluate(() => { window.prompt = () => 'Print check'; });
await page.click('#newPresetBtn');
await settle(page, 200);
const SHEETS = [
  ['polar 12', 'polar', async () => { await set('polarRays', 12); await set('polarRing', '0.25'); }],
  ['polar 24 labels off', 'polar', async () => { await set('polarRays', 24); await set('polarRing', '0.5'); await set('polarLabels', false); }],
  ['semi-log 6 decades', 'log', async () => { await set('logKind', 'semilog'); await set('logDecades', 6); }],
  ['log-log 6 x 6', 'log', async () => { await set('logKind', 'loglog'); await set('logDecades', 6); await set('logXDecades', 6); }],
  ['integers', 'numberline', async () => { await set('nlKind', 'integer'); await set('nlCopies', 10); }],
  ['decimals hundredths', 'numberline', async () => { await set('nlKind', 'decimal'); await set('nlDecStep', 'hundredths'); await set('nlCopies', 10); }],
  ['fractions sixteenths', 'numberline', async () => { await set('nlKind', 'fraction'); await set('nlFracDen', 16); await set('nlFracMax', 3); await set('nlCopies', 10); }],
  ['open', 'numberline', async () => { await set('nlKind', 'open'); await set('nlOpenTicks', 60); await set('nlCopies', 10); }],
  ['double x4', 'numberline', async () => { await set('nlKind', 'double'); await set('nlDlTopName', 'abcdefghijklmn'); await set('nlDlBottomName', 'abcdefghijklmn'); await set('nlCopies', 4); }],
  ['thermometers x6', 'numberline', async () => { await set('nlKind', 'vertical'); await set('nlCopies', 6); }],
  ['hexagons pointy', 'graph', async () => { await set('gridStyle', 'hex'); await set('hexTop', 'pointy'); await set('gridSizePreset', '0.25'); }],
  ['hexagons flat', 'graph', async () => { await set('gridStyle', 'hex'); await set('hexTop', 'flat'); await set('gridSizePreset', '0.3937'); }],
  ['storyboard 12 cinema', 'storyboard', async () => { await set('sbFrames', 12); await set('sbAspect', '2.35:1'); await set('sbCaption', 4); }],
  ['storyboard 2 square', 'storyboard', async () => { await set('sbFrames', 2); await set('sbAspect', '1:1'); await set('sbCaption', 0); }],
  ['music grand', 'music', async () => { await set('msGap', '0.16'); await set('msGrand', true); }],
  ['music small single', 'music', async () => { await set('msGap', '0.1'); await set('msGrand', false); }],
];
// The sheets that were there before print on one page too: the hidden editor used to run on for a blank second one.
const OLD_SHEETS = ['graph', 'numberline', 'plane', 'worksheet', 'isometric', 'cornell', 'handwriting', 'calibration']
  .map(mode => [`${mode} (before)`, mode, async () => {
    if (mode === 'graph') { await set('gridStyle', 'square'); await set('gridSizePreset', '0.25'); }
    if (mode === 'numberline') { await set('nlKind', 'standard'); await set('nlCopies', 1); }
  }, false]);
for (const orientation of ['portrait', 'landscape']) {
  await page.click('.mode-tab[data-mode="graph"]');
  await set('orientation', orientation);
  await set('headerOn', true); await set('headerTitle', 'Name & Date'); await set('headerShowName', true); await set('headerShowDate', true);
  for (const [label, mode, drive, isNew = true] of [...OLD_SHEETS, ...SHEETS]) {
    await page.click(`.mode-tab[data-mode="${mode}"]`);
    await drive();
    const tag = `${label}, ${orientation}`;
    const dims = orientation === 'portrait' ? [816, 1056] : [1056, 816];
    await page.setViewportSize({ width: dims[0], height: dims[1] });
    await page.emulateMedia({ media: 'print' });
    await settle(page, 80);
    const m = await page.evaluate(() => {
      const svg = document.querySelector('#previewArea svg'), r = svg.getBoundingClientRect();
      const strokes = [...svg.querySelectorAll('[stroke-width]')].map(e => parseFloat(e.getAttribute('stroke-width')));
      const vis = [...document.querySelectorAll('.editor, .toolbar, .app-header')].map(e => getComputedStyle(e).visibility);
      return {
        w: svg.getAttribute('width'), h: svg.getAttribute('height'), right: r.right, bottom: r.bottom, left: r.left, top: r.top,
        scrollW: document.documentElement.scrollWidth, minStroke: Math.min(...strokes), ink: svg.querySelectorAll('line, circle, path, rect').length, vis,
      };
    });
    eq([m.w, m.h], orientation === 'portrait' ? ['8.5in', '11in'] : ['11in', '8.5in'], `${tag}: the sheet is drawn in real inches`);
    ok(m.left >= -0.5 && m.top >= -0.5 && m.right <= dims[0] + 0.5 && m.bottom <= dims[1] + 0.5 && m.scrollW <= dims[0], `${tag}: it fits the paper edge to edge (${Math.round(m.right)} x ${Math.round(m.bottom)} px of ${dims[0]} x ${dims[1]})`);
    if (isNew) ok(m.minStroke >= 0.008 - 1e-9, `${tag}: no line thinner than 0.008in (${m.minStroke})`);
    ok(m.ink >= 3, `${tag}: there is something to print`);
    ok(m.vis.every(v => v === 'hidden'), `${tag}: the editor, toolbar and title stay off the paper`);
    const pdf = await page.pdf({ format: 'Letter', landscape: orientation === 'landscape', printBackground: false, preferCSSPageSize: false });
    eq(pdfPages(pdf), 1, `${tag}: one page, no spill onto a second`);
    await page.emulateMedia({ media: 'screen' });
    await page.setViewportSize({ width: 1300, height: 1500 });
  }
}

/* ── 8. every new panel has labels and names a screen reader can use ──── */
console.log('8. accessibility of the new panels');
await page.setViewportSize({ width: 1300, height: 1500 });
for (const [label, mode, drive] of SHEETS) {
  await page.click(`.mode-tab[data-mode="${mode}"]`);
  await drive();
  const found = await a11yScan(page);
  eq(found.map(v => `${v.id}: ${v.nodes.join(' | ')}`), [], `${label}: axe finds nothing serious or critical`);
}

eq(page.__errs.length, 0, 'no page or console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.slice(0, 40).forEach(f => console.log('  - ' + f)); process.exit(1); }
