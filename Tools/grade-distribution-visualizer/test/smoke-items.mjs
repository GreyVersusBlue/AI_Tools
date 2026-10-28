// smoke-items.mjs — 037's per-question item analysis (Path 16 P3 step 1) on the running page.
//
//   node Tools/grade-distribution-visualizer/test/smoke-items.mjs   (npm run test:gd-items-smoke)
//
// Pastes a per-question table and checks that: the missed-questions chart is drawn with role="img", a
// <title> and a <desc> that carries the data; the ranked table puts the lowest percent correct first and
// the reteach line moves the tiers; a polite status line says what is on screen; the note under the box
// names a cell it left out; no student name is on screen or in the chart; the pasted table and the line
// are saved on the assignment's own record (no new key) and come back after a reload; the Download SVG
// file is the same chart; an assignment with no per-question scores is unchanged; and axe finds nothing
// serious or critical with the section on screen. Port 8578. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan, downloadText } from '../../board-check/harness.mjs';

const PORT = 8578;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/037-grade-distribution-visualizer.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const TABLE = ['Name\tQ1\tQ2\tQ3\tQ4',
  'Points possible\t4\t2\t1\t1',
  'Zelda Quimby\t4\t0\t1\t1',
  'Bo Baker\t3\t0\t0\t1',
  'Cy Chen\t4\t1\t1\t0',
  'Di Diaz\t2\tx\t1\t1'].join('\n');

const server = await serve(PORT);
const browser = await launch();
console.log('Grade Distribution — item analysis');

const page = await prepPage(browser, BASE, { width: 1300, height: 1100 });
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);
await page.fill('#listName', 'Unit 4 Test');
await page.dispatchEvent('#listName', 'change');

// 0. nothing pasted: no item section, the old empty note stays
ok((await page.textContent('#outputBody')).includes('Paste some scores'), 'no scores and no items: the old empty note');
eq(await page.locator('.items-chart').count(), 0, 'no missed-questions chart yet');

await page.fill('#itemInput', TABLE);
await page.dispatchEvent('#itemInput', 'input');
await settle(page, 400);

// 1. the chart
eq(await page.locator('.items-chart svg[role="img"]').count(), 1, 'the chart is one role=img svg');
const meta = await page.$eval('.items-chart svg', s => ({ t: s.querySelector('title').textContent, d: s.querySelector('desc').textContent, lab: s.getAttribute('aria-labelledby') }));
ok(/Unit 4 Test/.test(meta.t) && /missed/.test(meta.t), 'title names the assignment and what is drawn: ' + meta.t);
ok(/Q1/.test(meta.d) && /Q4/.test(meta.d) && /Percent missed/.test(meta.d), 'desc carries the categories and the series: ' + meta.d);
eq(await page.$$eval('.items-chart svg rect[fill="#2171b5"]', r => r.length), 4, 'four bars, one per question');
const top = await page.$eval('.items-chart svg', s => Math.max(...Array.from(s.querySelectorAll('text[text-anchor="end"][font-size="10"]')).map(t => parseFloat(t.textContent))));
eq(top, 100, 'the vertical axis tops out at 100, not 200');

// 2. the ranked table: Q2 (1 of 3 attempts at 2 points: 0,0,1 over 2) is the worst
const rows = await page.$$eval('.items-table tbody tr', trs => trs.map(t => Array.from(t.cells).map(c => c.textContent)));
eq(rows[0][1], 'Q2', 'the lowest percent correct is first');
eq(rows[0][2], '16.7%', 'its percent correct, from the stated 2 points possible and the 3 readable scores');
eq(rows[0][4], 'Reteach', 'and it is a reteach question');
eq(rows.length, 4, 'one row per question');
const q1 = rows.find(r => r[1] === 'Q1');
eq(q1[2], '81.3%', 'Q1: 13 of 16 points');
eq(q1[4], 'Secure', 'at 81% with the line at 70 it is secure');
eq(rows.find(r => r[1] === 'Q4')[4], 'Watch', 'Q4 at 75% with the line at 70 is watch');

// 3. the line moves the tiers
await page.fill('#itemLine', '80');
await page.dispatchEvent('#itemLine', 'input');
await settle(page, 300);
const rows80 = await page.$$eval('.items-table tbody tr', trs => trs.map(t => Array.from(t.cells).map(c => c.textContent)));
eq(rows80.find(r => r[1] === 'Q4')[4], 'Reteach', 'raise the line to 80 and Q4 becomes reteach');
eq(rows80.find(r => r[1] === 'Q1')[4], 'Watch', 'and Q1 becomes watch');

// 4. the note names the cell it left out
const note = await page.textContent('#itemNote');
ok(/4 question\(s\), 4 student\(s\) read, points possible taken from your row/.test(note), 'note counts what it read: ' + note);
ok(/1 cell\(s\) left out: Q2 on line 6 “x” \(not a number\)/.test(note), 'and names the cell: ' + note);

// 5. no name anywhere
const everything = await page.evaluate(() => document.getElementById('outputBody').innerHTML + document.getElementById('itemNote').textContent);
ok(!/Zelda|Quimby|Baker|Chen|Diaz/.test(everything), 'no student name is shown or drawn');

// 6. announcement
const ann = await page.textContent('#itemsAnnounce');
ok(/Missed-questions chart updated/.test(ann) && /Q2/.test(ann), 'a polite status line says what is on screen: ' + ann);
eq(await page.getAttribute('#itemsAnnounce', 'aria-live'), 'polite', 'and it is polite');

// 7. stored on the assignment's record, no new key
const stored = await page.evaluate(() => {
  const keys = Object.keys(localStorage).filter(k => k.indexOf('gvb-grade-distribution') === 0);
  const rec = JSON.parse(localStorage.getItem('gvb-grade-distribution:data:Unit 4 Test'));
  return { keys, items: rec.items, line: rec.itemLine };
});
eq(stored.keys.sort().join('|'), ['gvb-grade-distribution:current', 'gvb-grade-distribution:data:Unit 4 Test', 'gvb-grade-distribution:list'].join('|'), 'no new storage key');
eq(stored.items[0].text, TABLE, 'the pasted table is on the record');
eq(stored.line, 80, 'and so is the line');
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
eq(await page.inputValue('#itemLine'), '80', 'the line comes back after a reload');
eq(await page.locator('.items-table tbody tr').count(), 4, 'and so does the table');

// 8. the downloaded SVG is the chart
const svgText = await downloadText(page, '[data-dl="items-svg"]', { what: 'the missed-questions SVG' });
ok(/<title[^>]*>[^<]*Unit 4 Test/.test(svgText) && /<desc/.test(svgText), 'the downloaded SVG carries its title and desc');

// 9. scores and items together: both sections, the old charts untouched
await page.fill('#scoreInput', ['92', '88', '76', '64'].join('\n'));
await page.dispatchEvent('#scoreInput', 'input');
await settle(page, 400);
const body = await page.textContent('#outputBody');
ok(body.includes('Letter-grade breakdown') && body.includes('Questions the class missed'), 'scores and items sit on one page');

// 10. only unreadable pasted: a plain sentence, no chart
await page.fill('#itemInput', 'Name\tQ1\nAda\tx\nBo\ty');
await page.dispatchEvent('#itemInput', 'input');
await settle(page, 300);
ok(/No question columns with scores/.test(await page.textContent('#itemNote')), 'a paste with no readable scores says so');
eq(await page.locator('.items-chart').count(), 0, 'and draws nothing');

// 10b. an easy test: the axis is still a percent, 0 to 100, so two tests read alike
await page.fill('#itemInput', 'Name,Q1,Q2\nAda,1,1\nBo,1,1\nCy,1,1\nDi,0,1');
await page.dispatchEvent('#itemInput', 'input');
await settle(page, 300);
const topEasy = await page.$eval('.items-chart svg', s => Math.max(...Array.from(s.querySelectorAll('text[text-anchor="end"][font-size="10"]')).map(t => parseFloat(t.textContent))));
eq(topEasy, 100, 'with only 25% missed the axis still tops out at 100');

// 10c. the printed reteach list, through the print kit
await page.fill('#itemInput', TABLE);
await page.dispatchEvent('#itemInput', 'input');
await settle(page, 300);
await page.evaluate(() => { window.__prints = 0; window.print = () => { window.__prints++; }; });
const pdfPages = async () => {
  await page.emulateMedia({ media: 'print' });
  const buf = await page.pdf({ preferCSSPageSize: true });
  await page.emulateMedia({ media: 'screen' });
  return (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
};
ok(await page.locator('[data-act="reteach-preview"]').count() === 1 && await page.locator('[data-act="reteach-print"]').count() === 1, 'a Preview and a Print button for the reteach list');
await page.click('[data-act="reteach-preview"]');
await page.waitForSelector('dialog.pk-preview[open]', { timeout: 10000 });
await page.waitForFunction(() => /Page 1 of \d+/.test(document.querySelector('.pk-preview-status').textContent), null, { timeout: 10000 });
eq(await page.evaluate(() => window.__prints), 0, 'opening the preview prints nothing');
const pv = await page.evaluate(() => {
  const d = document.querySelector('.pk-preview-frame').contentDocument;
  return { rows: Array.from(d.querySelectorAll('.rt-table tbody tr')).map(r => r.cells[1].textContent + ':' + r.cells[4].textContent),
    text: d.body.textContent, status: document.querySelector('.pk-preview-status').textContent, wrapShown: !!d.querySelector('.wrap') };
});
eq(pv.rows.join(), 'Q2:Reteach,Q3:Reteach,Q4:Reteach,Q1:Watch', 'the sheet ranks lowest percent correct first, ties in question order, with the tier written out (the line is 80 here)');
ok(!/Zelda|Quimby|Baker|Chen|Diaz/.test(pv.text), 'no student name on the sheet');
ok(/Unit 4 Test/.test(pv.text) && /Reteach priority list/.test(pv.text), 'the sheet names the assignment');
ok(!pv.wrapShown, 'the page itself is not in the preview');
eq(pv.status, 'Page 1 of 1', 'four questions are one page');
await page.click('.pk-preview-print');
eq(await page.evaluate(() => window.__prints), 1, 'the preview\u2019s Print button prints once');
ok(await page.evaluate(() => document.body.classList.contains('printing-reteach')), 'with the reteach list in place of the page');
eq(await pdfPages(), 1, 'and Chromium\u2019s PDF of it is one page');
await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
ok(await page.evaluate(() => !document.body.classList.contains('printing-reteach') && !document.getElementById('pk-page-style')), 'after printing the page is back and the kit\u2019s page rule is gone');
// the ordinary Print button still prints the panel, not the list
await page.click('#printBtn');
ok(await page.evaluate(() => !document.body.classList.contains('printing-reteach')), 'the Print button prints the output panel as before');
// a long list: the preview and Chromium agree on the page count
const wide = ['Name'].concat(Array.from({ length: 70 }, (_, i) => 'Q' + (i + 1))).join('\t') + '\n' +
  ['Ada'].concat(Array.from({ length: 70 }, (_, i) => String(i % 2))).join('\t') + '\n' +
  ['Bo'].concat(Array.from({ length: 70 }, (_, i) => String((i + 1) % 2))).join('\t');
await page.fill('#itemInput', wide);
await page.dispatchEvent('#itemInput', 'input');
await settle(page, 400);
await page.click('[data-act="reteach-preview"]');
await page.waitForSelector('dialog.pk-preview[open]', { timeout: 10000 });
await page.waitForFunction(() => /Page 1 of \d+/.test(document.querySelector('.pk-preview-status').textContent), null, { timeout: 10000 });
const longPages = Number((await page.textContent('.pk-preview-status')).match(/of (\d+)/)[1]);
ok(longPages > 1, 'seventy questions run to more than one page: ' + longPages);
await page.click('.pk-preview-print');
eq(await pdfPages(), longPages, 'the preview\u2019s page count is Chromium\u2019s PDF page count');
await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
await page.fill('#itemInput', TABLE);
await page.dispatchEvent('#itemInput', 'input');
await settle(page, 300);

// 10d. section against section
await page.fill('#itemLabel', '3rd period');
await page.dispatchEvent('#itemLabel', 'input');
eq(await page.locator('.items-chart').count(), 1, 'one section: one chart, no comparison');
ok(!(await page.textContent('#outputBody')).includes('Section against section'), 'and no comparison heading');
await page.click('#addSectionBtn');
eq(await page.locator('.item-section').count(), 1, 'Add another section adds a box');
eq(await page.locator('.item-text').getAttribute('id') !== null, true, 'with its own id');
await page.fill('.item-label', '6th period');
await page.fill('.item-text', ['Name\tQ1\tQ2\tQ3\tQ4', 'Points possible\t4\t2\t1\t1', 'Ed\t1\t0\t1\t1', 'Fi\t0\t0\t1\t0', 'Gu\t1\t0\t0\t1'].join('\n'));
await page.dispatchEvent('.item-text', 'input');
await settle(page, 400);
ok((await page.textContent('#outputBody')).includes('Section against section'), 'two sections: the comparison appears');
eq(await page.locator('.items-chart svg').count(), 3, 'a missed chart per section and the comparison chart');
const secRows = await page.$$eval('.items-table:last-of-type tbody tr', trs => trs.map(t => Array.from(t.cells).map(c => c.textContent)));
eq(secRows[0].join('|'), 'Q1|81.3%|16.7%|64.6 (large gap)', 'Q1: 81.3% in 3rd, 16.7% in 6th, a 64.6-point gap flagged');
const cmpSvg = await page.$$eval('.items-chart svg', s => s[2].querySelector('title').textContent + '||' + (s[2].querySelector('pattern') ? 'hatched' : 'plain'));
ok(/percent correct by section/.test(cmpSvg) && /hatched/.test(cmpSvg), 'the comparison chart is titled and hatched for grayscale: ' + cmpSvg);
const sNote = await page.textContent('#itemNote');
ok(/3rd period: 4 question\(s\)/.test(sNote) && /6th period: 4 question\(s\)/.test(sNote), 'the note speaks for each section: ' + sNote);
const stored2 = await page.evaluate(() => JSON.parse(localStorage.getItem('gvb-grade-distribution:data:Unit 4 Test')).items.map(i => i.label));
eq(stored2.join(), '3rd period,6th period', 'both sections are on the record');
await page.click('[data-act="reteach-preview"]');
await page.waitForSelector('dialog.pk-preview[open]', { timeout: 10000 });
await page.waitForFunction(() => /Page 1 of \d+/.test(document.querySelector('.pk-preview-status').textContent), null, { timeout: 10000 });
const twoSheets = await page.evaluate(() => document.querySelector('.pk-preview-frame').contentDocument.querySelectorAll('.rt-table').length);
eq(twoSheets, 2, 'the reteach list has a table per section');
eq(Number((await page.textContent('.pk-preview-status')).match(/of (\d+)/)[1]), 2, 'each section starts a page');
await page.click('.pk-preview-close');
await page.click('.item-remove');
eq(await page.locator('.item-section').count(), 0, 'Remove takes the section away');
ok(!(await page.textContent('#outputBody')).includes('Section against section'), 'and the comparison with it');
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
eq(await page.inputValue('#itemLabel'), '3rd period', 'the section name comes back after a reload');

// 11. axe
await page.fill('#itemInput', TABLE);
await page.dispatchEvent('#itemInput', 'input');
await settle(page, 400);
await page.click('#addSectionBtn');
await page.fill('.item-text', TABLE);
await page.dispatchEvent('.item-text', 'input');
await settle(page, 400);
const scan = await a11yScan(page, { impact: 'serious' });
ok(!scan.length, 'axe: no serious or critical violation with the section on screen: ' + JSON.stringify(scan));

// 12. trend: small multiples of the compared assignments, one scale
await page.fill('#scoreInput', ['92', '88', '76', '64', '95', '91'].join('\n'));
await page.dispatchEvent('#scoreInput', 'input');
page.once('dialog', d => d.accept('Unit 5 Test'));
await page.click('#newListBtn');
await settle(page, 300);
await page.fill('#scoreInput', ['0', '40', '55', '62', '70', '71', '72', '75', '78', '80', '85'].join('\n'));
await page.dispatchEvent('#scoreInput', 'input');
await settle(page, 300);
await page.check('#compareChecks input[value="Unit 4 Test"]');
await settle(page, 400);
const sm = await page.$$eval('.sm-cell svg', svgs => svgs.map(v => ({
  title: v.querySelector('title').textContent,
  cats: v.querySelectorAll('text[text-anchor="end"][transform]').length,
  top: Math.max(...Array.from(v.querySelectorAll('text[text-anchor="end"][font-size="10"]')).map(t => parseFloat(t.textContent))) })));
eq(sm.length, 2, 'two panels: this assignment and the one compared');
ok(/^Unit 5 Test: mean .*n = 11$/.test(sm[0].title) && /^Unit 4 Test: mean .*n = 6$/.test(sm[1].title), 'each panel names its assignment, mean and n, current first: ' + JSON.stringify(sm.map(x => x.title)));
eq(sm[0].top, sm[1].top, 'both panels share one count axis');
eq(sm[0].cats, sm[1].cats, 'and one list of score buckets (the zero bucket is on both)');
const heading = await page.textContent('#compareWrap');
ok(/Score distributions side by side/.test(heading), 'with its heading');
// 13. the plain-language page
const brief = await page.$$eval('.brief-h', h => h.map(x => x.textContent));
ok(brief.includes('How the class did') && brief.includes('Compared with Unit 4 Test') && brief.includes('About these numbers'), 'the page has its paragraphs, compared assignment included: ' + brief.join(' | '));
const briefText = await page.textContent('#outputBody');
ok(/On Unit 5 Test, 11 scores were read/.test(briefText) && /The mean is 21\.8 points lower than on Unit 4 Test/.test(briefText), 'sentences quote the page\u2019s own numbers');
await page.uncheck('#compareChecks input[value="Unit 4 Test"]');
await settle(page, 300);
ok(!(await page.$$eval('.brief-h', h => h.map(x => x.textContent))).includes('Compared with Unit 4 Test'), 'unchecking the comparison takes its paragraph out');
await page.evaluate(() => { window.__prints = 0; window.print = () => { window.__prints++; }; });
await page.click('[data-act="brief-preview"]');
await page.waitForSelector('dialog.pk-preview[open]', { timeout: 10000 });
await page.waitForFunction(() => /Page 1 of \d+/.test(document.querySelector('.pk-preview-status').textContent), null, { timeout: 10000 });
const bp = await page.evaluate(() => { const d = document.querySelector('.pk-preview-frame').contentDocument; return { h1: d.querySelector('h1').textContent, hs: d.querySelectorAll('.brief-sh').length, status: document.querySelector('.pk-preview-status').textContent }; });
eq(bp.h1, 'What this says', 'the preview shows the page');
ok(bp.hs >= 2, 'with its paragraphs: ' + bp.hs);
eq(bp.status, 'Page 1 of 1', 'on one page');
await page.click('.pk-preview-print');
eq(await page.evaluate(() => window.__prints), 1, 'Print… prints once');
await page.emulateMedia({ media: 'print' });
const bpdf = await page.pdf({ preferCSSPageSize: true });
await page.emulateMedia({ media: 'screen' });
eq((bpdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length, 1, 'and Chromium\u2019s PDF is one page');
await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
const scanSm = await a11yScan(page, { impact: 'serious' });
ok(!scanSm.length, 'axe: no serious violation with the small multiples on screen: ' + JSON.stringify(scanSm));

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
