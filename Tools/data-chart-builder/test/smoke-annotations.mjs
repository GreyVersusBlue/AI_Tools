// smoke-annotations.mjs — 038's annotations on bar and line charts, on the real page (BACKLOG row 76).
//   node Tools/data-chart-builder/test/smoke-annotations.mjs     (port 8631)
//
// Held here: the card shows for bar and line (and scatter), not for pie or box, and says what a
// place is on each ("category number"); notes are drawn on the chart and named in its <desc>;
// Remove and the 12-note limit work; a bar chart's notes and a scatter's are two lists that never
// read each other's numbers; the notes travel in a share link and a link from before has none,
// a note whose text is markup draws as text; the PNG/SVG downloads carry them; 360 px and axe.
import { serve, launch, prepPage, settle, a11yScan, downloadText } from '../../board-check/harness.mjs';

const PORT = 8631;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/038-data-chart-builder.html';

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; return true; } failed++; console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });
const DATA = 'Day\tReps\nMon\t3\nTue\t8\nWed\t5\nThu\t9\nFri\t4\n';

const setType = async (t) => {
  await page.evaluate((v) => { const r = document.querySelector(`input[name="chart-type"][value="${v}"]`); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }, t);
  await settle(page, 400);
};
const svg = () => page.evaluate(() => {
  const s = document.querySelector('#chart-stage svg');
  return s ? { html: s.outerHTML, desc: s.querySelector(':scope > desc').textContent } : null;
});
const cardDisplay = () => page.evaluate(() => getComputedStyle(document.getElementById('notes-card')).display);
const listItems = () => page.evaluate(() => Array.from(document.querySelectorAll('#notes-list li span')).map(e => e.textContent));
const label = (k) => page.textContent('#note-' + k + '-label');
const add = async (type, vals, text) => {
  await page.selectOption('#note-type', type);
  for (const k of ['a', 'b', 'c', 'd']) if (await page.isVisible('#note-' + k)) await page.fill('#note-' + k, vals[k] === undefined ? '' : String(vals[k]));
  await page.fill('#note-text', text || '');
  await page.click('#note-add');
  await settle(page, 400);
};
async function setup(type) {
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 300);
  await page.fill('#data-input', DATA);
  await page.dispatchEvent('#data-input', 'input');
  await settle(page, 600);
  await setType(type);
}

console.log('Data Chart Builder — annotations on bar and line charts');
await setup('bar');

/* 1. where the card shows, and what it says */
eq(await cardDisplay(), 'block', 'the card shows for a bar chart');
ok(/category number/.test(await page.textContent('#notes-hint')), 'and says places are category numbers: ' + (await page.textContent('#notes-hint')).slice(0, 80));
eq([await label('a'), await label('b')], ['From category number (1 = first row)', 'To category number'], 'the band fields are labelled with categories');
await page.selectOption('#note-type', 'arrow');
eq([await label('a'), await label('b'), await label('c'), await label('d')], ['Tail: category number', 'Tail: value', 'Head: category number', 'Head: value'], 'the arrow fields too');
await setType('pie');
eq(await cardDisplay(), 'none', 'the card hides for a pie chart');
await setType('box');
eq(await cardDisplay(), 'none', 'and for a box plot');
await setType('line');
eq(await cardDisplay(), 'block', 'and shows for a line chart');
await setType('bar');

/* 2. notes are drawn and described */
await add('region', { a: 2, b: 3 }, 'Practice days');
let s = await svg();
ok(/fill="url\(#cs-nr\)"/.test(s.html) && s.html.includes('>Practice days<'), 'a band is drawn, hatched, with its label');
ok(/Shaded region across category 2 \(Tue\) to category 3 \(Wed\): Practice days\./.test(s.desc), 'and named in the description: ' + s.desc);
ok(/Added\. 1 note on the chart\./.test(await page.textContent('#notes-msg')), 'the form says what happened');
eq(await page.inputValue('#note-a'), '', 'and clears its fields');
await add('arrow', { a: 5, b: 9, c: 4, d: 9 }, 'Peak');
await add('callout', { a: 2, b: 8 }, 'Best set');
s = await svg();
ok(/r="7"/.test(s.html) && /<polygon points=/.test(s.html), 'an arrow and a callout are drawn');
ok(/Arrow from category 5 \(Fri\), 9 to category 4 \(Thu\), 9: Peak\./.test(s.desc) && /Callout at category 2 \(Tue\), 8: Best set\./.test(s.desc), 'and both are in the description');
eq((await listItems()).length, 3, 'three notes are listed');
ok((await listItems()).some(t => /Shaded region, x 2 to 3/.test(t)), 'the list names them: ' + JSON.stringify(await listItems()));

/* 3. refusals */
await add('callout', { a: 2, b: 8 }, '');
ok(/needs both numbers and some text/.test(await page.textContent('#notes-msg')), 'a callout without text is refused');
await add('region', { a: 1, b: 2, c: 3 }, '');
ok(/both Y values|both/.test(await page.textContent('#notes-msg')), 'half a band is refused');
eq((await listItems()).length, 3, 'refusals add nothing');
await add('callout', { a: 99, b: 5 }, 'off the chart');
s = await svg();
ok(/1 note outside the plot is not drawn\./.test(s.desc) && !s.html.includes('>off the chart<'), 'a note beyond the last category is counted, not drawn');

/* 4. remove */
await page.evaluate(() => document.querySelector('#notes-list li button').click());
await settle(page, 400);
ok(!(await svg()).html.includes('Practice days') && (await listItems()).length === 3, 'Remove takes the first note off the chart and the list');

/* 5. bar and line share one list; scatter has its own */
await setType('line');
eq((await listItems()).length, 3, 'the same notes follow a switch to a line chart');
s = await svg();
ok(/r="7"/.test(s.html) && s.desc.includes('Callout at category 2 (Tue), 8'), 'and are drawn on it');
await setType('scatter');
eq(await listItems(), [], 'a scatter does not read the category notes as its own');
{ const sv = await svg(); ok(!sv || !/r="7"/.test(sv.html), 'and draws none of them'); }
ok(/in its own numbers/.test(await page.textContent('#notes-hint')), 'and its hint is the scatter one');
eq(await label('a'), 'X of the point', 'with X and Y labels (the form was last on a callout)');
await setType('bar');
eq((await listItems()).length, 3, 'switching back finds the category notes where they were');

/* 6. 12 notes */
for (let i = 0; i < 9; i++) await add('callout', { a: 1 + (i % 5), b: 1 + i }, 'n' + i);
eq((await listItems()).length, 12, 'twelve notes');
await add('callout', { a: 1, b: 1 }, 'thirteen');
ok(/12 notes/.test(await page.textContent('#notes-msg')), 'a thirteenth is refused with the limit');

/* 7. share link round trip, with hostile text */
const open = async (st) => {
  await page.goto(URL_PAGE + '?chart=' + encodeURIComponent(await page.evaluate(x => StateLink.encodeState(x), st)), { waitUntil: 'networkidle' });
  await settle(page, 700);
};
const base = { data: DATA, hasHeaders: true, chartType: 'bar', categoryCol: 0, valueCols: [1] };
await open({ ...base, catNotes: [{ type: 'callout', x: 3, y: 5, text: '<img src=x onerror=window.__pwned=1>' }, { type: 'region', x1: 4, x2: 5, text: 'Fri' }, { type: 'bogus' }, { type: 'callout', x: 'a', y: 1, text: 'x' }] });
eq((await listItems()).length, 2, 'a link opens with its valid category notes only');
ok(await page.evaluate(() => !window.__pwned && !document.querySelector('#chart-stage img, #notes-list img') && document.querySelector('#chart-stage svg').textContent.includes('<img src=x')), 'a note whose text is markup draws as text');
await open(base);
eq((await listItems()).length, 0, 'a link from before this feature has no notes');
/* the state the Share button would encode carries them */
await setup('bar');
await add('callout', { a: 2, b: 8 }, 'Best set');
const st = await page.evaluate(() => { let got = null; const orig = StateLink.buildShareUrl; StateLink.buildShareUrl = function (param, value) { got = value; return orig.apply(this, arguments); }; document.getElementById('shareBtn').click(); return new Promise(r => setTimeout(() => { StateLink.buildShareUrl = orig; r(got); }, 600)); });
ok(st && Array.isArray(st.catNotes) && st.catNotes.length === 1 && st.catNotes[0].text === 'Best set' && !('notes' in st && st.notes && st.notes.length), 'the Share button writes the category notes under catNotes: ' + JSON.stringify(st && { n: st.catNotes, s: st.notes }));

/* 8. the downloaded SVG carries the notes */
await setup('bar');
await add('callout', { a: 2, b: 8 }, 'Best set');
const file = await downloadText(page, '#btn-svg', { what: 'the SVG' });
ok(file.includes('r="7"') && file.includes('>Best set<') && file.includes('Callout at category 2 (Tue), 8: Best set.'), 'the downloaded SVG has the callout and its description');

/* 9. 360 px, axe, errors */
await page.setViewportSize({ width: 360, height: 900 });
await settle(page, 300);
ok(await page.evaluate(() => document.documentElement.scrollWidth <= 360), 'no sideways scroll at 360 px: ' + await page.evaluate(() => document.documentElement.scrollWidth));
for (const theme of ['light', 'dark']) {
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await settle(page, 600);
  const v = await a11yScan(page, { impact: 'serious', include: '#notes-card' });
  eq(v.map(x => x.id + ' ' + JSON.stringify(x.nodes)), [], `axe is clean on the annotation card in ${theme}`);
}
ok(page.__errs.length === 0, 'no console errors: ' + JSON.stringify(page.__errs));

await browser.close();
server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
