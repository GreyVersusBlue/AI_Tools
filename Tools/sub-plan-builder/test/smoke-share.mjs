// smoke-share.mjs — the Sub Plan Builder's share-by-link.
//
//   node Tools/sub-plan-builder/test/smoke-share.mjs
//
// A finished sub plan almost always has to reach somebody else — the front
// office, the department chair, whoever is covering first period — and the only
// ways out of the tool were a .docx download and a text blob to paste. Both
// mean an attachment. _shared/state-link.js puts the plan inside the URL, so a
// link opens it on another machine with no server and no file.
//
// The assertion that matters most is the last one: the Student Notes box must
// never be in the link. That box is documented on the page as never being
// stored anywhere, and a link is storage — it lands in a chat log, an email, a
// browser history. The saved history already draws that line; the link has to
// draw the same one.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8163;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/044-Sub%20Plan%20Builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1200, height: 1000 });

const SECRET = 'Period 3 — Jane D. has extended time on all written work per her 504.';

/** The URL the copy button would put on the clipboard. Read through the page's
 *  own StateLink rather than the clipboard, which headless Chromium will not
 *  hand back without a permission grant. */
const shareLink = () => page.evaluate(() => {
  let captured = null;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (t) => { captured = t; return Promise.resolve(); } },
  });
  document.getElementById('btnCopyPlanLink').click();
  return new Promise(r => setTimeout(() => r(captured), 50));
});

console.log('Sub Plan Builder — share a plan by link or QR');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* ── fill in a two-day plan, plus the box that must not travel ─────────── */
await page.fill('#teacherName', 'D. Moore');
await page.fill('#roomNumber', '214');
await page.fill('#planDate', '2026-09-14');
await page.fill('#numDays', '2');
await page.dispatchEvent('#numDays', 'input');
await settle(page, 250);
await page.fill('#lessonTitle', 'Fall of Rome — video');
await page.fill('#overviewText', 'Play the video, then the written response.');
await page.fill('#scheduleText', '**First 10 min:** attendance and the do-now on the board.');
await page.fill('#materialsNote', 'Worksheets are stapled on my desk.');
await page.fill('#studentNotes', SECRET);
await settle(page, 300);

// Second day out gets its own content, so the link has to carry both.
const tabs = await page.$$('#dayTabs button[data-day]');
ok(tabs.length === 2, `a two-day absence shows two day tabs (got ${tabs.length})`);
await tabs[1].click();
await settle(page, 250);
await page.fill('#lessonTitle', 'Fall of Rome — written response');
await page.fill('#overviewText', 'Collect the response sheets at the end of the period.');
await settle(page, 300);

/* ── 1. the link is built, and decodes to the whole plan ───────────────── */
const url = await shareLink();
ok(url && url.indexOf('plan=') !== -1, 'the copy button produces a ?plan= link');
ok(/Link copied/.test(await page.textContent('#shareNote')), 'and says so');

const payload = await page.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('plan')), url);
eq(payload.v, 1, 'the payload is versioned');
eq(payload.standing.teacherName, 'D. Moore', 'standing details travel — a plan without them is not actionable');
eq(payload.standing.roomNumber, '214', 'including the room number');
eq(Object.keys(payload.days).length, 2, 'both days out are in the link');
eq(payload.days['2026-09-14'].lessonTitle, 'Fall of Rome — video', 'the first day keeps its lesson title');
ok(/written response/.test(payload.days['2026-09-15'].lessonTitle), 'and the second day its own');
ok(/First 10 min/.test(payload.days['2026-09-14'].scheduleText), 'the schedule text travels with its markdown intact');

/* ── 2. the Student Notes box is not in the link. At all. ──────────────── */
ok(!/504/.test(url), 'the student note is nowhere in the URL');
ok(JSON.stringify(payload).indexOf('504') === -1, 'nor anywhere in the decoded payload');
ok(JSON.stringify(payload).indexOf('Jane D') === -1, 'not even the name');
eq(await page.inputValue('#studentNotes'), SECRET, 'while still sitting in the box on this page');

/* ── 3. opening the link elsewhere rebuilds the plan ───────────────────── */
/* The parameter is stripped from the address bar the moment it is read, so a
   refresh — or a bookmark made after opening — cannot re-import the same plan
   over whatever the receiving teacher has done since. */
const consumed = await prepPage(browser, BASE, { width: 1200, height: 1000 });
await consumed.goto(url, { waitUntil: 'networkidle' });
await settle(consumed, 400);
eq(new URL(consumed.url()).searchParams.get('plan'), null, 'the link parameter is consumed on open');

const arrival = await prepPage(browser, BASE, { width: 1200, height: 1000 });
await arrival.addInitScript(() => { window.confirm = () => true; });
await arrival.goto(url, { waitUntil: 'networkidle' });
await settle(arrival, 600);
eq(await arrival.inputValue('#teacherName'), 'D. Moore', 'the receiving browser gets the standing details');
eq(await arrival.inputValue('#roomNumber'), '214', 'including the room');
eq(await arrival.inputValue('#planDate'), '2026-09-14', 'and the dates');
eq(await arrival.inputValue('#numDays'), '2', 'and how many days out');
eq(await arrival.inputValue('#lessonTitle'), 'Fall of Rome — video', 'and the first day it lands on');
eq(await arrival.inputValue('#studentNotes'), '', 'and an empty Student Notes box, because that never travelled');
ok(/Opened a shared plan/.test(await arrival.textContent('#shareNote')), 'with a note saying where it came from');

const arrivalTabs = await arrival.$$('#dayTabs button[data-day]');
eq(arrivalTabs.length, 2, 'both days out arrive');
await arrivalTabs[1].click();
await settle(arrival, 250);
ok(/written response/.test(await arrival.inputValue('#lessonTitle')), 'and the second day has its own content');

/* ── 4. declining leaves the receiving browser alone ───────────────────── */
const declined = await prepPage(browser, BASE, { width: 1200, height: 1000 });
await declined.addInitScript(() => { window.confirm = () => false; });
await declined.goto(url, { waitUntil: 'networkidle' });
await settle(declined, 500);
eq(await declined.inputValue('#roomNumber'), '', 'declining the confirm changes nothing on the page');
ok(/not opened/.test(await declined.textContent('#shareNote')), 'and says so plainly');

/* ── 5. a mangled link fails loudly, not silently ──────────────────────── */
const broken = await prepPage(browser, BASE, { width: 1200, height: 1000 });
await broken.goto(URL_PAGE + '?plan=this-is-not-base64-%%%', { waitUntil: 'networkidle' });
await settle(broken, 400);
ok(/could not be read/.test(await broken.textContent('#shareNote')), 'a truncated or mangled link says so');

/* ── 6. the QR path ────────────────────────────────────────────────────── */
await page.click('#btnPlanQr');
await settle(page, 400);
const qr = await page.evaluate(() => {
  const c = document.getElementById('qrCanvas');
  const overlayOpen = !document.getElementById('qrOverlay').hidden;
  return { overlayOpen, w: c.width, h: c.height, note: document.getElementById('shareNote').textContent };
});
console.log(`  link is ${(url.length / 1024).toFixed(1)} KB; QR ${qr.overlayOpen ? 'drawn' : 'refused as too long'}`);
if (qr.overlayOpen) {
  ok(qr.w > 100 && qr.w === qr.h, `a square QR was drawn (${qr.w}x${qr.h})`);
  await page.click('#qrCloseBtn');
  await settle(page, 200);
  eq(await page.evaluate(() => document.getElementById('qrOverlay').hidden), true, 'and closes again');
} else {
  // A long plan is legitimately past what a QR can hold; the tool has to say
  // so rather than draw an unscannable square.
  ok(/too long to fit in a QR/.test(qr.note), 'an over-long plan is refused by name, pointing at the link instead');
}

/* A QR holds far less than a URL bar does, and a plan with several days of
   detailed notes runs past what any scanner will read. The failure has to be
   named — an unscannable grey square is worse than a refusal. */
await page.fill('#overviewText', 'Detailed instructions. '.repeat(220));
await settle(page, 300);
await page.click('#btnPlanQr');
await settle(page, 400);
ok(/too long to fit in a QR/.test(await page.textContent('#shareNote')),
   'an over-long plan is refused by name, pointing at the copy-link button instead');
eq(await page.evaluate(() => document.getElementById('qrOverlay').hidden), true,
   'and no unscannable square is shown');
ok((await shareLink()).length > 4000, 'while the link itself still works at that size');

/* ── 7. richer .docx output: per-period tables, header/footer with page
   numbers, and an embedded seating-chart image ─────────────────────────
   A separate page/fixture, so it doesn't disturb the share-link state above
   (in particular the deliberately-huge overviewText from the QR-size test).
   The .docx is inspected two ways: structurally (every new XML part is
   present, every r:id used in document.xml resolves to a relationship
   actually defined in document.xml.rels, and every part parses as XML with
   zero errors) and, further down (outside Node, see the improvement-prompt
   Status entry for this round), by round-tripping a real generated file
   through headless LibreOffice — this suite alone cannot drive that, but a
   subtly-broken part list or a dangling r:id is exactly what this section
   catches before it ever reaches a real Word-compatible viewer. */
const docxPage = await prepPage(browser, BASE, { width: 1200, height: 1000 });
await docxPage.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(docxPage, 400);

await docxPage.fill('#teacherName', 'D. Moore');
await docxPage.fill('#roomNumber', '214');
await docxPage.fill('#planDate', '2026-09-14');
await docxPage.fill('#numDays', '2');
await docxPage.dispatchEvent('#numDays', 'input');
await settle(docxPage, 250);
await docxPage.fill('#lessonTitle', 'Fall of Rome — video');
await docxPage.fill('#overviewText', 'Play the video, then the written response.');
await docxPage.fill('#scheduleText', '**First 10 min:** attendance and the do-now on the board.');
await docxPage.fill('#sharedPeriodNotes', 'Start with story #7\nBe kind, **bold** emphasis test');
await docxPage.fill('#materialsNote', 'Worksheets are stapled on my desk.');
await settle(docxPage, 300);

// A real (if tiny) PNG built in-page, the same way the docx-merger suite
// builds its .docx fixtures — no binary checked into the repo.
const fakeImage = await docxPage.evaluate(async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 300;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2e4c6d'; ctx.fillRect(0, 0, 400, 300);
  ctx.fillStyle = '#fff'; ctx.fillRect(40, 40, 320, 220);
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
});
await docxPage.setInputFiles('#seatingChartFile', {
  name: 'seating.png', mimeType: 'image/png', buffer: Buffer.from(fakeImage),
});
await settle(docxPage, 400);
ok(/Attached/.test(await docxPage.textContent('#seatingChartStatus')), 'attaching an image updates the status line');

async function generateAndInspect() {
  await docxPage.click('#btnGenerate');
  await docxPage.waitForSelector('#downloadArea[style*="block"]', { timeout: 20000 }).catch(() => {});
  await settle(docxPage, 800);
  return docxPage.evaluate(async () => {
    const href = document.getElementById('downloadLink').getAttribute('href');
    if (!href) return null;
    const buf = await (await fetch(href)).arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files);
    const readXml = async (name) => zip.files[name] ? await zip.files[name].async('string') : null;
    const [docXml, relsXml, ctXml, headerXml, footerXml] = await Promise.all(
      ['word/document.xml', 'word/_rels/document.xml.rels', '[Content_Types].xml', 'word/header1.xml', 'word/footer1.xml'].map(readXml));
    const parser = new DOMParser();
    const parseOk = (xml) => !!xml && !parser.parseFromString(xml, 'application/xml').querySelector('parsererror');
    const usedRelIds = docXml ? Array.from(docXml.matchAll(/r:(?:id|embed)="([^"]+)"/g)).map(m => m[1]) : [];
    const definedRelIds = relsXml ? Array.from(relsXml.matchAll(/Id="([^"]+)"/g)).map(m => m[1]) : [];
    const extentMatch = docXml ? docXml.match(/<wp:extent cx="(\d+)" cy="(\d+)"\/>/) : null;
    return {
      names,
      hasHeaderPart: names.includes('word/header1.xml'),
      hasFooterPart: names.includes('word/footer1.xml'),
      hasImagePart: names.includes('word/media/image1.png'),
      docParses: parseOk(docXml), relsParses: parseOk(relsXml), ctParses: parseOk(ctXml),
      headerParses: parseOk(headerXml), footerParses: parseOk(footerXml),
      hasTable: /<w:tbl>/.test(docXml || ''),
      tableCount: ((docXml || '').match(/<w:tbl>/g) || []).length,
      hasHeaderRef: /<w:headerReference/.test(docXml || ''),
      hasFooterRef: /<w:footerReference/.test(docXml || ''),
      footerHasPageField: /PAGE/.test(footerXml || ''),
      footerHasNumPagesField: /NUMPAGES/.test(footerXml || ''),
      ctHasHeaderOverride: /header1\.xml/.test(ctXml || ''),
      ctHasFooterOverride: /footer1\.xml/.test(ctXml || ''),
      ctHasPngDefault: /Extension="png"/.test(ctXml || ''),
      relsHasImage: /relationships\/image/.test(relsXml || ''),
      usedRelIds, definedRelIds,
      extentWithinContentWidth: extentMatch ? Number(extentMatch[1]) > 0 && Number(extentMatch[1]) <= 5943600 : null,
    };
  });
}

const withImage = await generateAndInspect();
ok(withImage, 'the .docx generated with an image attached is downloadable');
ok(withImage.docParses && withImage.relsParses && withImage.ctParses && withImage.headerParses && withImage.footerParses,
   'every part — document, rels, content types, header, footer — parses as XML with no error');
ok(withImage.hasHeaderPart && withImage.hasFooterPart, 'header1.xml and footer1.xml are real parts in the zip');
ok(withImage.hasImagePart, 'the attached seating chart is embedded as word/media/image1.png');
ok(withImage.hasTable, 'period-specific details render as a real <w:tbl>, not a bullet list');
eq(withImage.tableCount, 2, 'one table per day out (2 days out in this fixture)');
ok(withImage.hasHeaderRef && withImage.hasFooterRef, 'the section wires up the header and footer via sectPr references');
ok(withImage.footerHasPageField && withImage.footerHasNumPagesField, 'the footer carries a live PAGE/NUMPAGES field, not a hard-coded number');
ok(withImage.ctHasHeaderOverride && withImage.ctHasFooterOverride, '[Content_Types].xml declares the header/footer parts');
ok(withImage.ctHasPngDefault && withImage.relsHasImage, '[Content_Types].xml and document.xml.rels both know about the embedded png');
ok(withImage.extentWithinContentWidth, 'the embedded image is sized to fit inside the page content width, not overflowing it');
{
  const unresolved = withImage.usedRelIds.filter(id => !withImage.definedRelIds.includes(id));
  eq(unresolved.length, 0, 'every r:id/r:embed referenced in document.xml resolves to a relationship actually defined in document.xml.rels: ' + JSON.stringify(unresolved));
}

/* Removing the image must leave no dangling reference behind — no orphaned
   media part, no image relationship, no png content-type entry — since a
   relationship or content-type override with nothing to back it is exactly
   the kind of thing that opens with a repair prompt in a real Word client. */
await docxPage.click('#seatingChartRemoveBtn');
await settle(docxPage, 200);
eq(await docxPage.textContent('#seatingChartStatus'), 'No image attached.', 'removing the image resets the status line');
const withoutImage = await generateAndInspect();
ok(withoutImage, 'the .docx still generates once the image is removed');
ok(!withoutImage.hasImagePart && !withoutImage.relsHasImage && !withoutImage.ctHasPngDefault,
   'and carries no image part, no image relationship, and no png content-type entry');
ok(withoutImage.hasHeaderRef && withoutImage.hasFooterRef && withoutImage.hasTable,
   'while the header/footer/table — which do not depend on an image — are unaffected');
{
  const unresolved = withoutImage.usedRelIds.filter(id => !withoutImage.definedRelIds.includes(id));
  eq(unresolved.length, 0, 'and every remaining r:id still resolves: ' + JSON.stringify(unresolved));
}

/* ── 8. no console noise ───────────────────────────────────────────────── */
for (const [name, p] of [['builder', page], ['arrival', arrival], ['declined', declined], ['broken', broken], ['docx', docxPage]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
