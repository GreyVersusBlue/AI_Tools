// smoke-per-file-options.mjs — per-document page-break and heading choices.
//
//   node Tools/docx-merger/test/smoke-per-file-options.mjs
//
// "Start each file on a new page" and "add the file name as a heading" were
// one answer for the whole merge. A real packet is not uniform: a cover page
// wants no heading, a two-page appendix should not start its own sheet. Each
// file in the list can now answer both for itself, with the global switches
// as the default. What this suite holds down:
//
//   "Use the default" is a real third state, not a copy of the current
//   global. Flipping a global switch has to move every file that hasn't been
//   given its own answer, and leave alone every file that has — otherwise
//   setting thirty files and then changing your mind about the global is a
//   thirty-file undo.
//
//   The choices reach the merged .docx: the right number of page breaks and
//   headings, in the right places, in a real Word file.
//
//   Overrides survive the resume-your-last-list path, and a list saved before
//   this feature reads back as "everything follows the globals".
//
//   No console errors, ever — the site's standing bar for every tool.
//
// The .docx fixtures are built in-page with the tool's own vendored JSZip, so
// the suite needs no binary checked into the repo.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8131;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/031-docx-merger.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1050 });

console.log('Word Doc Merger — per-document merge options');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/** Build three minimal .docx files with the page's own JSZip and hand them to
 *  the file input, so the tool takes the same path a real drop does. */
async function loadFixtures() {
  const files = await page.evaluate(async () => {
    const DOC = body => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
    const CT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
    const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
    const para = t => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`;
    const out = [];
    for (const [name, text] of [['A-cover.docx', 'Cover'], ['B-unit.docx', 'Unit One'], ['C-appendix.docx', 'Appendix']]) {
      const zip = new JSZip();
      zip.file('[Content_Types].xml', CT);
      zip.file('_rels/.rels', RELS);
      zip.file('word/document.xml', DOC(para(text)));
      const blob = await zip.generateAsync({ type: 'blob' });
      out.push({ name, buf: Array.from(new Uint8Array(await blob.arrayBuffer())) });
    }
    return out;
  });
  await page.setInputFiles('input[type=file]', files.map(f => ({
    name: f.name,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: Buffer.from(f.buf),
  })));
  await settle(page, 700);
}

await loadFixtures();
eq(await page.evaluate(() => document.querySelectorAll('#fileList li.file-row').length), 3, 'three files loaded');

const optValues = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('#fileList li.file-row')).map(li => ({
    name: li.querySelector('.fname').textContent,
    pageBreak: li.querySelector('[data-opt="pageBreak"]').value,
    heading: li.querySelector('[data-opt="heading"]').value,
    defaults: Array.from(li.querySelectorAll('[data-opt]')).map(s => s.options[0].textContent),
  })));

/* ── 1. every file starts on "use the default" ───────────────────────────── */
const start = await optValues();
ok(start.every(f => f.pageBreak === '' && f.heading === ''), 'every file starts following the global switches');
ok(start.every(f => f.defaults.every(d => d === 'Default (on)')),
   'and the default option names the current global: ' + JSON.stringify(start[0].defaults));
eq(await page.textContent('#overrideLine'), '', 'nothing is flagged as overriding');

/* ── 2. the default label tracks the global switch ───────────────────────── */
await page.uncheck('#optPageBreak');
await settle(page, 300);
const afterGlobal = await optValues();
ok(afterGlobal.every(f => f.defaults[0] === 'Default (off)'),
   'turning the global off is reflected in every file\'s default option');
ok(afterGlobal.every(f => f.pageBreak === ''), 'and no file has been given an answer of its own');
await page.check('#optPageBreak');
await settle(page, 300);

/* ── 3. an override sticks, and survives the global moving ───────────────── */
await page.selectOption('#fileList li.file-row:nth-child(3) [data-opt="pageBreak"]', 'off');
await page.selectOption('#fileList li.file-row:nth-child(1) [data-opt="heading"]', 'off');
await settle(page, 300);
eq(await page.textContent('#overrideLine'),
   '2 files below have their own answers for these two and will ignore the switches above.',
   'the tool says how many files ignore the switches');

await page.selectOption('#fileList li.file-row:nth-child(1) [data-opt="heading"]', '');
await settle(page, 300);
eq(await page.textContent('#overrideLine'),
   '1 file below has its own answer for these two and will ignore the switches above.',
   'and counts down as overrides are put back to the default');
await page.selectOption('#fileList li.file-row:nth-child(1) [data-opt="heading"]', 'off');
await settle(page, 300);

await page.uncheck('#optPageBreak');
await settle(page, 300);
await page.check('#optPageBreak');
await settle(page, 300);
const kept = await optValues();
eq(kept[2].pageBreak, 'off', 'the overridden file kept its own answer across a global flip');
eq(kept[1].pageBreak, '', 'and the others are still on the default');
eq(kept[0].heading, 'off', 'the heading override held too');

/* ── 4. the choices reach the merged document ────────────────────────────── */
/* Cover: no heading. Unit: default (heading + break). Appendix: no break. */
async function mergeAndCount() {
  await page.click('#btnMerge');
  await page.waitForSelector('#downloadArea[style*="block"], #downloadArea:not([style*="none"])', { timeout: 20000 }).catch(() => {});
  await settle(page, 1200);
  return page.evaluate(async () => {
    const href = document.getElementById('downloadLink').getAttribute('href');
    if (!href) return null;
    const buf = await (await fetch(href)).arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file('word/document.xml').async('string');
    return {
      breaks: (xml.match(/w:type="page"/g) || []).length,
      headings: (xml.match(/w:val="Heading2"/g) || []).length,
      text: (xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')),
    };
  });
}
const merged = await mergeAndCount();
ok(merged, 'the merge produced a downloadable document');
eq(merged.breaks, 1, 'one page break: Unit takes the default, Appendix was told not to');
eq(merged.headings, 2, 'two headings: Unit and Appendix, but not the Cover that was told no');
ok(merged.text.includes('Cover') && merged.text.includes('Unit One') && merged.text.includes('Appendix'),
   'and every file\'s body text is in there: ' + JSON.stringify(merged.text));
ok(!merged.text.includes('A-cover'), 'the file told to skip its heading really has none');

/* ── 5. turning every file off produces a plain concatenation ────────────── */
for (const n of [1, 2, 3]) {
  await page.selectOption(`#fileList li.file-row:nth-child(${n}) [data-opt="pageBreak"]`, 'off');
  await page.selectOption(`#fileList li.file-row:nth-child(${n}) [data-opt="heading"]`, 'off');
}
await settle(page, 300);
const plain = await mergeAndCount();
eq(plain.breaks, 0, 'no page breaks anywhere');
eq(plain.headings, 0, 'and no headings');
eq(plain.text.filter(t => ['Cover', 'Unit One', 'Appendix'].includes(t)).length, 3, 'all three files still merged');

/* ── 6. overrides come back with the remembered list ─────────────────────── */
const stored = await page.evaluate(() => {
  const key = Object.keys(localStorage).find(k => /list/i.test(k));
  return JSON.parse(localStorage.getItem(key) || '[]');
});
ok(stored.length === 3 && stored.every(e => e.pageBreak === false && e.headingOn === false),
   'the overrides are saved with the remembered file list: ' + JSON.stringify(stored));

await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
await loadFixtures();
const restored = await optValues();
ok(restored.every(f => f.pageBreak === 'off' && f.heading === 'off'),
   're-adding the same files restores their overrides: ' + JSON.stringify(restored.map(f => f.pageBreak)));

/* ── 7. a list saved before per-file options existed ─────────────────────── */
await page.evaluate(() => {
  const key = Object.keys(localStorage).find(k => /list/i.test(k));
  localStorage.setItem(key, JSON.stringify([
    { name: 'A-cover.docx', heading: 'Front Matter' },
    { name: 'B-unit.docx', heading: '' },
    { name: 'C-appendix.docx', heading: '' },
  ]));
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
await loadFixtures();
const legacy = await optValues();
ok(legacy.every(f => f.pageBreak === '' && f.heading === ''),
   'an old remembered list reads back as "everything follows the globals"');
eq(await page.evaluate(() => document.querySelector('#fileList [data-heading-input]').value), 'Front Matter',
   'and its remembered heading text still comes back');

/* ── 8. no console noise anywhere in the run ─────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
