// smoke-packet-split.mjs — one saved template, printed as a pre-lab and a post-lab packet.
//
//   node Tools/lab-report-template-builder/test/smoke-packet-split.mjs
//
// What this suite holds down:
//
//   The split. Objective, hypothesis, materials and procedure go in the pre-lab
//   packet and data, observations and conclusion in the post-lab one, until the
//   teacher moves a section; a moved section prints in its new packet only, and
//   the choice is saved with the template and survives a reload.
//
//   The whole report is still one packet, whatever the split says, and it is
//   the markup the page printed before the split existed (golden-whole-report.html,
//   recorded from the old page).
//
//   A template saved before the split loads with the defaults and is not
//   rewritten by being opened; junk in a saved `split` falls back to the default.
//
//   Each packet carries its own title, tag and name line; "both" is two packets
//   with the second on a new page (read off Chromium's PDF page count and the
//   computed break); a packet left with no sections says so and cannot be printed.
//
//   The choice rides a share link, and a link without one gets the defaults.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import { LEGACY, seed } from './_fixture.mjs';

const PORT = 8491;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/065-lab-report-template-builder.html';
const GOLDEN = fs.readFileSync(new URL('./golden-whole-report.html', import.meta.url), 'utf8');

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 950 });
await page.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });

const SEC = ['objective', 'hypothesis', 'materials', 'procedure', 'data', 'observations', 'conclusion'];
const splitSelects = () => page.evaluate((keys) =>
  Object.fromEntries(keys.map(k => [k, document.getElementById('split_' + k).value])), SEC);
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('lrt_data_v1:Density Lab')));
const headings = (html) => page.evaluate((h) => {
  const d = document.createElement('div'); d.innerHTML = h;
  return Array.from(d.querySelectorAll('h3')).map(e => e.textContent).join(',');
}, html);
async function preview(which) {
  await page.click('#previewBtn');
  await page.selectOption('#previewWhich', which);
  const html = await page.innerHTML('#previewBody');
  const text = await page.innerText('#previewBody');
  await page.click('#closePreviewBtn');
  return { html, text };
}
async function printed(selector) {
  const before = await page.evaluate(() => window.__printed);
  await page.click(selector);
  const n = await page.evaluate(() => window.__printed);
  return { count: n - before, html: await page.innerHTML('#printArea') };
}
async function reopen() { await page.reload({ waitUntil: 'networkidle' }); await settle(page); }
async function pdfPages(which) {
  await page.click({ pre: '#printPreBtn', post: '#printPostBtn', both: '#printBothBtn', all: '#printBtn' }[which]);
  const buf = await page.pdf({ format: 'Letter', printBackground: true });
  return (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
}

console.log('Lab Report Template Builder — pre-lab and post-lab packets');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });

/* ── 1. a template saved before the split ────────────────────────────────── */
await seed(page);
const legacyJson = await page.evaluate(() => localStorage.getItem('lrt_data_v1:Density Lab'));
await reopen();
eq(JSON.stringify(await splitSelects()),
   JSON.stringify({ objective: 'pre', hypothesis: 'pre', materials: 'pre', procedure: 'pre', data: 'post', observations: 'post', conclusion: 'post' }),
   'an old template opens with the default split');
eq(await page.evaluate(() => localStorage.getItem('lrt_data_v1:Density Lab')), legacyJson,
   'and opening it does not rewrite what was saved');
eq(await page.textContent('#splitSummary'), 'Pre-lab packet: 4 sections. Post-lab packet: 3 sections.', 'the summary counts each packet');

/* ── 2. the whole report is the old packet, byte for byte ────────────────── */
const whole = await preview('all');
ok(whole.html === GOLDEN, 'the whole report is the markup the page printed before the split');
eq(await headings(whole.html), 'Objective,Hypothesis,Materials,Procedure,Data,Observations,Conclusion', 'one packet, every section, in order');
ok(!whole.html.includes('lab-packet') && !whole.html.includes('packet-tag'), 'and it carries no packet wrapper or tag');

/* ── 3. the two packets ───────────────────────────────────────────────────── */
const pre = await preview('pre');
const post = await preview('post');
eq(await headings(pre.html), 'Objective,Hypothesis,Materials,Procedure', 'the pre-lab packet holds the planning sections');
eq(await headings(post.html), 'Data,Observations,Conclusion', 'the post-lab packet holds data, observations and conclusion');
ok(pre.text.includes('Density of Three Samples') && post.text.includes('Density of Three Samples'), 'each packet carries the lab title');
ok(/pre-lab packet/i.test(pre.text) && !/post-lab packet/i.test(pre.text), 'the pre-lab packet is tagged as such');
ok(/post-lab packet/i.test(post.text) && !/pre-lab packet/i.test(post.text), 'the post-lab packet is tagged as such');
ok(/Name: _+\s+Date: _+\s+Period/.test(pre.text) && /Name: _+\s+Date: _+\s+Period/.test(post.text), 'each packet has its own name line');
ok(!pre.html.includes('data-table') && post.html.includes('data-table'), 'the data table is in the post-lab packet only');
ok(pre.html.includes('Graduated cylinder &lt;b&gt;250 mL&lt;/b&gt;') && !pre.html.includes('<b>'), 'a material typed with markup is text in the packet');
eq(post.html.includes('<th class="num">Mass<span class="ch-meta">number · g</span></th>'), true, 'the typed column header survives into the packet');
eq(post.html.split('<tr>').length - 1, 5, 'the saved row count (4 plus the header row) is kept');

/* ── 4. moving a section ─────────────────────────────────────────────────── */
await page.selectOption('#split_data', 'pre');
await page.selectOption('#split_materials', 'post');
eq(await page.textContent('#splitSummary'), 'Pre-lab packet: 4 sections. Post-lab packet: 3 sections.', 'the summary follows a swap');
eq(await headings((await preview('pre')).html), 'Objective,Hypothesis,Procedure,Data', 'a moved section prints in its new packet, in report order');
eq(await headings((await preview('post')).html), 'Materials,Observations,Conclusion', 'and no longer in the old one');
ok((await preview('all')).html === GOLDEN, 'the whole report does not change when the split does');
const s1 = await saved();
eq(s1.split && s1.split.data + '/' + s1.split.materials, 'pre/post', 'the choice is saved with the template');
eq(s1.split && Object.keys(s1.split).length, 7, 'with all seven sections named');
await reopen();
eq((await splitSelects()).data + '/' + (await splitSelects()).materials, 'pre/post', 'and is still there after a reload');

/* ── 5. printing ──────────────────────────────────────────────────────────── */
const pPre = await printed('#printPreBtn');
eq(pPre.count, 1, 'Print pre-lab prints once');
eq(await headings(pPre.html), 'Objective,Hypothesis,Procedure,Data', 'what it prints is the pre-lab packet');
const pPost = await printed('#printPostBtn');
eq(await headings(pPost.html), 'Materials,Observations,Conclusion', 'Print post-lab prints the post-lab packet');
const pBoth = await printed('#printBothBtn');
eq((pBoth.html.match(/class="lab-packet"/g) || []).length, 2, 'Print both prints two packets');
ok(pBoth.html.indexOf('Pre-lab packet') < pBoth.html.indexOf('Post-lab packet'), 'pre-lab first');
const pAll = await printed('#printBtn');
ok(pAll.html === GOLDEN, 'Print whole report prints the one packet as before');
await page.click('#previewBtn');
await page.selectOption('#previewWhich', 'post');
const viaPreview = await printed('#previewPrintBtn');
ok(/Post-lab packet/.test(viaPreview.html) && !/Pre-lab packet/.test(viaPreview.html), 'the preview prints the packet it is showing');
await page.click('#closePreviewBtn');

/* ── 6. paper: where the pages break ─────────────────────────────────────── */
await printed('#printBothBtn');
await page.emulateMedia({ media: 'print' });
const breaks = await page.evaluate(() => {
  const ps = document.querySelectorAll('#printArea .lab-packet');
  return { second: getComputedStyle(ps[1]).breakBefore, first: getComputedStyle(ps[0]).breakBefore,
    rule: getComputedStyle(ps[1]).borderTopWidth,
    h3: getComputedStyle(document.querySelector('#printArea h3')).breakAfter,
    tr: getComputedStyle(document.querySelector('#printArea tbody tr')).breakInside };
});
eq(breaks.second, 'page', 'the second packet starts a new page');
ok(breaks.first !== 'page', 'the first does not');
eq(breaks.rule, '0px', 'and the on-screen divider is gone on paper');
eq(breaks.h3, 'avoid', 'a section heading is not left alone at the foot of a page');
eq(breaks.tr, 'avoid', 'a data row is not split across pages');
await page.emulateMedia({ media: null });
const nPre = await pdfPages('pre'), nPost = await pdfPages('post'), nBoth = await pdfPages('both');
eq(nPre, 1, 'the pre-lab packet is one sheet'); eq(nPost, 1, 'the post-lab packet is one sheet');
eq(nBoth, 2, 'both packets are two sheets, one each');

/* ── 7. a packet with nothing in it ──────────────────────────────────────── */
for (const k of SEC) await page.selectOption('#split_' + k, 'pre');
eq(await page.textContent('#splitSummary'), 'Pre-lab packet: 7 sections. Post-lab packet: 0 sections.', 'all seven can go in one packet');
eq(await page.isDisabled('#printPostBtn'), true, 'an empty packet cannot be printed');
eq(await page.isDisabled('#printPreBtn'), false, 'the other still can');
ok(/No sections are in this packet/.test((await preview('post')).text), 'its preview says so');
eq((await printed('#printBothBtn')).html.match(/class="lab-packet"/g).length, 1, 'both prints only the packet that has something in it');
eq(await headings((await printed('#printPreBtn')).html), 'Objective,Hypothesis,Materials,Procedure,Data,Observations,Conclusion', 'a packet holding everything is the report');
ok((await preview('all')).html === GOLDEN, 'and the whole report is still the whole report');
await page.click('#previewBtn');
ok(await page.isEnabled('#previewPrintBtn'), 'the preview can always print');
await page.click('#closePreviewBtn');

/* ── 8. junk in a saved split ────────────────────────────────────────────── */
await seed(page, { ...LEGACY, split: { data: 'maybe', objective: 'post', materials: 5, nonsense: 'pre' } });
await reopen();
const junk = await splitSelects();
eq(junk.objective + '/' + junk.data + '/' + junk.materials, 'post/post/pre', 'a good value is kept, a bad one falls back to the default');
eq(await headings((await preview('pre')).html), 'Hypothesis,Materials,Procedure', 'and the packets follow');

/* ── 9. sharing ──────────────────────────────────────────────────────────── */
const link = (extra) => page.evaluate((x) => {
  const t = { name: 'Shared Lab', title: 'Shared', objective: 'o', hypothesisPrompt: 'h', materials: [{ text: 'm' }], procedure: [{ text: 'p' }],
    columns: [{ text: 'c', type: 'number', units: 'u' }], dataRows: 3, observationsPrompt: 'obs', conclusion: [{ text: 'q' }] };
  return window.Share.buildLink({ param: 'template', getState: () => Object.assign(t, x) }).url;
}, extra);
const withSplit = await link({ split: { data: 'pre', conclusion: 'pre', objective: 'post', hypothesis: 'bogus' } });
const without = await link({});
await page.goto(withSplit, { waitUntil: 'networkidle' }); await settle(page);
const got = await splitSelects();
eq(got.data + '/' + got.conclusion + '/' + got.objective + '/' + got.hypothesis, 'pre/pre/post/pre', 'a shared template brings its split, with bad values defaulted');
const sharedSaved = await page.evaluate(() => JSON.parse(localStorage.getItem('lrt_data_v1:Shared Lab')));
eq(Object.keys(sharedSaved.split || {}).length, 7, 'and saves it whole');
await page.goto(without, { waitUntil: 'networkidle' }); await settle(page);
const gotDefault = await splitSelects();
eq(gotDefault.materials + '/' + gotDefault.data, 'pre/post', 'a link from before the split gets the defaults');
const sharedOld = await page.evaluate(() => JSON.parse(localStorage.getItem('lrt_data_v1:Shared Lab (2)')));
ok(sharedOld && !('split' in sharedOld), 'and no split field is made up for it');

/* ── 10. starter and new template ────────────────────────────────────────── */
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await seed(page, { ...LEGACY, split: { data: 'pre' } });
await reopen();
await page.once('dialog', d => d.accept('Fresh Lab'));
await page.click('#newTemplateBtn'); await settle(page);
eq((await splitSelects()).data, 'post', 'a new template starts with the default split');

/* ── 11. keyboard and labels ─────────────────────────────────────────────── */
await seed(page); await reopen();
await page.focus('#split_data');
await page.keyboard.press('ArrowUp'); await settle(page, 100);
eq(await page.inputValue('#split_data'), 'pre', 'a section moves packets from the keyboard');
for (const [k, label] of [['objective', 'Objective'], ['data', 'Data table'], ['conclusion', 'Conclusion']]) {
  eq(await page.getByLabel(label, { exact: true }).evaluate(e => e.id), 'split_' + k, `"${label}" is the accessible name of its select`);
}
eq(await page.getAttribute('#splitSummary', 'aria-live'), 'polite', 'a change in the count is announced');
const axe = await a11yScan(page);
eq(axe.length, 0, 'no serious accessibility violation with the card showing: ' + JSON.stringify(axe));

/* ── 12. no console noise ────────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
