// smoke-frame.mjs — 031's cover page, header, footer and page numbers in a real merged .docx.
//   node Tools/docx-merger/test/smoke-frame.mjs     (port 8629)
//
// Held here: with nothing asked for, the merged file is what it was (no extra parts, the
// last file's own section kept byte for byte); a cover comes first, before the contents
// page; a header/footer/number is a real part wired through the relationships, the content
// types and the section; the last file's stale header reference is replaced only when a
// frame is asked for; text typed with markup or control characters yields a file that still
// parses; choices survive a reload and an options record from before this feature; 360 px
// and axe.
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8629;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/031-docx-merger.html';

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; return true; } failed++; console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1400 });

const STALE_SECT = '<w:sectPr><w:headerReference w:type="default" r:id="rId9"/><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/><w:docGrid w:linePitch="360"/></w:sectPr>';

async function loadFixtures() {
  const files = await page.evaluate(async (STALE) => {
    const DOC = body => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}</w:body></w:document>`;
    const CT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
    const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
    const para = t => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`;
    const out = [];
    for (const [name, text, sect] of [['A-intro.docx', 'Intro', ''], ['B-unit.docx', 'Unit One', ''], ['C-appendix.docx', 'Appendix', STALE]]) {
      const zip = new JSZip();
      zip.file('[Content_Types].xml', CT); zip.file('_rels/.rels', RELS);
      zip.file('word/document.xml', DOC(para(text) + sect));
      const blob = await zip.generateAsync({ type: 'blob' });
      out.push({ name, buf: Array.from(new Uint8Array(await blob.arrayBuffer())) });
    }
    return out;
  }, STALE_SECT);
  await page.setInputFiles('input[type=file]', files.map(f => ({ name: f.name, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(f.buf) })));
  await settle(page, 700);
}

/** Merge and read every part of the result. */
async function merge() {
  await page.evaluate(() => { document.getElementById('downloadArea').style.display = 'none'; });
  await page.click('#btnMerge');
  await page.waitForFunction(() => getComputedStyle(document.getElementById('downloadArea')).display !== 'none', null, { timeout: 20000 }).catch(() => {});
  await settle(page, 300);
  return page.evaluate(async () => {
    const href = document.getElementById('downloadLink').getAttribute('href');
    if (!href) return null;
    const zip = await JSZip.loadAsync(await (await fetch(href)).arrayBuffer());
    const parts = {}, bad = [];
    for (const name of Object.keys(zip.files)) {
      if (!/\.(xml|rels)$/.test(name)) continue;
      parts[name] = await zip.file(name).async('string');
      const d = new DOMParser().parseFromString(parts[name], 'application/xml');
      if (d.getElementsByTagName('parsererror').length) bad.push(name);
    }
    return { parts, bad };
  });
}
const setText = async (id, v) => { await page.fill('#' + id, v); };

console.log('Word Doc Merger — cover, header, footer');
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);
await loadFixtures();
eq(await page.locator('#fileList li.file-row').count(), 3, 'three files loaded');

/* 1. nothing asked for: the merged file is unchanged */
ok(await page.isDisabled('#covTitle') && await page.isDisabled('#covDate'), 'the cover fields are off until the cover is');
let r = await merge();
ok(r && r.bad.length === 0, 'the plain merge parses');
ok(!Object.keys(r.parts).some(n => /aplp-/.test(n)), 'no header or footer part is added');
ok(!/aplp|header\+xml|footer\+xml/.test(r.parts['[Content_Types].xml']), 'and no content type for one');
ok(r.parts['word/document.xml'].includes('<w:headerReference w:type="default" r:id="rId9"/>') && !r.parts['word/document.xml'].includes('titlePg'),
   "the last file's own section is kept exactly as before (including its reference), no titlePg");
ok(!/October|Merged Document/.test(r.parts['word/document.xml'].split('<w:t')[1] || ''), 'no cover text');

/* 2. a cover alone */
await page.check('#optCover');
ok(!(await page.isDisabled('#covTitle')), 'ticking the cover enables its fields');
await setText('covTitle', 'Fractions & Ratios <Unit 3>');
await setText('covSubtitle', 'Math 7, Period 2');
await setText('covTeacher', 'Pat Example');
await page.fill('#covDate', '2026-10-12');
await page.check('#optToc');
r = await merge();
let doc = r.parts['word/document.xml'];
const iCover = doc.indexOf('Fractions &amp; Ratios &lt;Unit 3&gt;'), iToc = doc.indexOf('TOC'), iIntro = doc.indexOf('>Intro<');
ok(iCover > 0 && iToc > iCover && iIntro > iToc, 'cover, then contents, then the first file');
ok(doc.includes('Math 7, Period 2') && doc.includes('Pat Example') && doc.includes('October 12, 2026'), 'class, teacher and long date are on it');
ok(doc.indexOf('w:type="page"') > iCover && doc.indexOf('w:type="page"') < iToc, 'a page break closes the cover before the contents page');
ok(!Object.keys(r.parts).some(n => /aplp-/.test(n)), 'a cover alone adds no header or footer part');
ok(doc.includes('<w:headerReference w:type="default" r:id="rId9"/>'), 'and still leaves the last file\'s section alone');
await page.uncheck('#optToc');
/* blank title falls back to the file name */
await setText('covTitle', '');
await setText('outName', 'Unit 3 Packet');
r = await merge();
ok(r.parts['word/document.xml'].includes('>Unit 3 Packet<'), 'a blank cover title uses the output file name');

/* 3. footer with page numbers, header, clear first page */
await setText('frmHeader', 'Unit 3 <Packet> & more\u0007');
await setText('frmFooter', 'Room 12');
await page.selectOption('#frmNumbers', 'pageOf');
await page.selectOption('#frmAlign', 'right');
r = await merge();
ok(r.bad.length === 0, 'every part parses with markup and a control character typed into the header: ' + JSON.stringify(r.bad));
doc = r.parts['word/document.xml'];
const hdr = r.parts['word/aplp-header.xml'], ftr = r.parts['word/aplp-footer.xml'];
ok(hdr && hdr.includes('Unit 3 &lt;Packet&gt; &amp; more') && !hdr.includes('\u0007'), 'the header is escaped text with the control character gone');
ok(ftr && ftr.includes('Room 12') && ftr.includes('PAGE') && ftr.includes('NUMPAGES') && ftr.includes('w:val="right"'), 'the footer has the text, PAGE and NUMPAGES, right-aligned');
const rels = r.parts['word/_rels/document.xml.rels'];
const hRel = /Id="(rId\d+)"[^>]*Type="[^"]*\/header"[^>]*Target="aplp-header.xml"|Type="[^"]*\/header"[^>]*Target="aplp-header.xml"[^>]*Id="(rId\d+)"|Id="(rId\d+)"[^>]*Target="aplp-header.xml"/.exec(rels);
const fRel = /Id="(rId\d+)"[^>]*Target="aplp-footer.xml"/.exec(rels);
ok(hRel && fRel, 'both parts have a relationship');
const hId = hRel && (hRel[1] || hRel[2] || hRel[3]), fId = fRel && fRel[1];
ok(hId !== fId && !(rels.match(/Id="(rId\d+)"/g) || []).some((v, i, a) => a.indexOf(v) !== i), 'relationship ids are all different');
ok(doc.includes(`w:headerReference w:type="default" r:id="${hId}"`) && doc.includes(`w:footerReference w:type="default" r:id="${fId}"`), 'the section points at them');
ok(!doc.includes('r:id="rId9"'), "the last file's stale header reference is gone once a frame is asked for");
ok(doc.indexOf('headerReference') < doc.indexOf('footerReference') && doc.indexOf('footerReference') < doc.indexOf('w:pgSz'), 'references come first in the section, before the page size');
ok(doc.includes('w:orient="landscape"'), "and the last file's page setup is still the document's");
ok(doc.includes('<w:titlePg') && doc.indexOf('<w:titlePg') < doc.indexOf('<w:docGrid'), 'the first page is clear, titlePg sitting before docGrid');
const ct = r.parts['[Content_Types].xml'];
ok(ct.includes('PartName="/word/aplp-header.xml"') && ct.includes('wordprocessingml.header+xml') && ct.includes('PartName="/word/aplp-footer.xml"') && ct.includes('wordprocessingml.footer+xml'), 'both parts have content types');

/* 4. clear-first off, header only, footer only */
await page.uncheck('#frmClearFirst');
r = await merge();
ok(!r.parts['word/document.xml'].includes('titlePg'), 'unticking "leave the first page clear" drops titlePg');
await setText('frmFooter', ''); await page.selectOption('#frmNumbers', 'none');
r = await merge();
ok(r.parts['word/aplp-header.xml'] && !r.parts['word/aplp-footer.xml'] && !r.parts['word/document.xml'].includes('footerReference'), 'a header alone adds no footer');
await setText('frmHeader', ''); await page.selectOption('#frmNumbers', 'plain');
r = await merge();
ok(!r.parts['word/aplp-header.xml'] && r.parts['word/aplp-footer.xml'] && r.parts['word/aplp-footer.xml'].includes('PAGE') && !r.parts['word/aplp-footer.xml'].includes('Page '), 'a bare number is a footer with just the field');
eq(r.bad, [], 'all parts parse');

/* 5. persistence */
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
eq([await page.isChecked('#optCover'), await page.inputValue('#covTeacher'), await page.inputValue('#covDate'), await page.inputValue('#frmNumbers'), await page.inputValue('#frmAlign'), await page.isChecked('#frmClearFirst')],
  [true, 'Pat Example', '2026-10-12', 'plain', 'right', false], 'every choice comes back after a reload');
await page.evaluate(() => localStorage.setItem('docx-merger-options', JSON.stringify({ pageBreak: true, heading: false, toc: false, styleMode: 'normalize' })));
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
eq([await page.isChecked('#optCover'), await page.inputValue('#frmNumbers'), await page.inputValue('#frmHeader'), await page.isChecked('#frmClearFirst'), await page.isChecked('#optHeading')],
  [false, 'none', '', true, false], 'options saved before this feature load with no frame and their own values kept');
await page.evaluate(() => localStorage.setItem('docx-merger-options', JSON.stringify({ frame: { cover: { on: true, date: 'garbage' }, numbers: 'roman', align: 9, header: 5 } })));
await page.reload({ waitUntil: 'networkidle' });
eq([await page.inputValue('#covDate'), await page.inputValue('#frmNumbers'), await page.inputValue('#frmAlign')], ['', 'none', 'center'], 'a hand-edited record is cleaned on load');

/* 6. 360 px, axe, console */
await page.setViewportSize({ width: 360, height: 900 });
await loadFixtures();
await settle(page, 300);
ok(await page.evaluate(() => document.documentElement.scrollWidth <= 360), 'no sideways scroll at 360 px: ' + await page.evaluate(() => document.documentElement.scrollWidth + ' ' + Array.from(document.querySelectorAll('body *')).filter(e => e.getBoundingClientRect().right > 361 && !Array.from(e.children).some(c => c.getBoundingClientRect().right > 361)).slice(0, 5).map(e => e.tagName + '#' + e.id + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right) + ' ' + e.textContent.slice(0, 30)).join(' | ')));
for (const theme of ['light', 'dark']) {
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await settle(page, 600); // colours transition; a scan mid-fade reads the blend
  const v = await a11yScan(page, { impact: 'serious', include: '#frameSet' });
  eq(v.map(x => x.id + ' ' + JSON.stringify(x.nodes)), [], `axe is clean on the frame options in ${theme}`);
}
ok(page.__errs.length === 0, 'no console errors: ' + JSON.stringify(page.__errs));

await browser.close();
server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
