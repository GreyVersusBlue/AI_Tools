// smoke-share.mjs — sharing a vocabulary list by link or QR.
//
//   node Tools/vocab-flashcard-generator/test/smoke-share.mjs
//
// Export/Import already moved a list between machines, but only as a file:
// save it, find it, attach it, and hope the other teacher opens it on the
// machine they teach from. A link skips all of that, and the QR makes it
// something you can hold up at a department meeting.
//
// The design decision under test is what a received list DOES. It is saved as
// a new named list on the receiving machine — the same thing Import list does
// with a file — rather than replacing whatever that teacher had open. A deck
// that silently overwrote a colleague's current list would be worse than no
// share feature at all.
//
// Exits 1 on any failure. Every word here is ordinary vocabulary.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8192;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/040-vocab-flashcard-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const WORDS = [
  'Photosynthesis: process plants use to make food | Plants use photosynthesis to grow',
  'Mitosis: cell division that makes two identical cells',
  'Osmosis: water moving across a membrane',
].join('\n');

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

/** The URL the Copy link button would put on the clipboard. */
const shareLink = (p) => p.evaluate(() => {
  let captured = null;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (t) => { captured = t; return Promise.resolve(); } },
  });
  document.getElementById('shareLinkBtn').click();
  return new Promise(r => setTimeout(() => r(captured), 60));
});

console.log('Vocabulary Flashcard & Word Wall Generator — share a list by link or QR');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* ── 0. the share controls are reachable on a return visit ─────────────── */
eq(await page.isVisible('#shareLinkBtn'), true, 'the share controls are in the toolbar');
await page.fill('#listName', 'Unit 4 Cells');
await page.dispatchEvent('#listName', 'change');
await page.fill('#wordInput', WORDS);
await settle(page, 300);
await page.selectOption('#flashLayout', 'fold');
await page.selectOption('#sortOrder', 'az');
await settle(page, 300);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
eq(await page.isVisible('#toolbar'), true,
   'and still there after a reload — the toolbar used to be reachable only on a first run');

/* ── 1. sharing with nothing to share says so ──────────────────────────── */
const blank = await prepPage(browser, BASE, { width: 1200, height: 900 });
await blank.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(blank, 400);
await blank.click('#shareLinkBtn');
await settle(blank, 150);
ok(/Add some words first/.test(await blank.textContent('#shareNote')), 'an empty list is refused by name');

/* ── 2. the link carries the words and the layout ──────────────────────── */
const url = await shareLink(page);
ok(url && url.indexOf('list=') !== -1, 'Copy link produces a ?list= link');
ok(/Link copied/.test(await page.textContent('#shareNote')), 'and says so');

const payload = await page.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('list')), url);
eq(payload.v, 1, 'the payload is versioned');
eq(payload.name, 'Unit 4 Cells', 'it carries the list name');
ok(/Photosynthesis/.test(payload.words) && /Osmosis/.test(payload.words), 'and every word');
eq(payload.flashLayout, 'fold', 'plus the print layout that was chosen');
eq(payload.sortOrder, 'az', 'and the sort order — a shared deck arrives ready to print, not ready to reconfigure');

/* ── 3. opening it elsewhere gives the same deck, saved as its own list ── */
const other = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await other.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(other, 400);
await other.fill('#listName', 'My Own Words');
await other.dispatchEvent('#listName', 'change');
await other.fill('#wordInput', 'Sovereignty: supreme authority over a territory');
await settle(other, 400);

await other.goto(url, { waitUntil: 'networkidle' });
await settle(other, 500);

eq(await other.inputValue('#listName'), 'Unit 4 Cells (shared)', 'the shared list opens under its own name');
ok(/Photosynthesis/.test(await other.inputValue('#wordInput')), 'with the sender\'s words');
eq(await other.inputValue('#flashLayout'), 'fold', 'and the sender\'s layout');
ok(/shared link/.test(await other.textContent('#sharedBanner')), 'flagged as having arrived from a link');

const names = await other.evaluate(() => window.VocabStore.listSets());
ok(names.includes('My Own Words'), 'the receiving teacher\'s own list survived: ' + JSON.stringify(names));
ok(names.includes('Unit 4 Cells (shared)'), 'and the shared one sits beside it: ' + JSON.stringify(names));
eq(await other.evaluate(() => window.VocabStore.loadSet('My Own Words').words),
   'Sovereignty: supreme authority over a territory', 'with its words untouched');

eq(new URL(other.url()).searchParams.get('list'), null,
   'the parameter is consumed on open, so a refresh cannot import a second copy');
await other.reload({ waitUntil: 'networkidle' });
await settle(other, 400);
eq((await other.evaluate(() => window.VocabStore.listSets())).length, names.length,
   'and a refresh really does not duplicate it');

/* a second arrival of the same link does not overwrite the first */
await other.goto(url, { waitUntil: 'networkidle' });
await settle(other, 500);
eq(await other.inputValue('#listName'), 'Unit 4 Cells (shared) 2', 'a second copy is numbered rather than clobbering the first');

/* ── 4. a mangled link fails loudly and changes nothing ────────────────── */
const broken = await prepPage(browser, BASE, { width: 1200, height: 900 });
await broken.goto(URL_PAGE + '?list=not-base64-%25%25%25', { waitUntil: 'networkidle' });
await settle(broken, 400);
ok(/could not be read/.test(await broken.textContent('#shareNote')), 'a mangled link says so rather than opening blank');
eq(await broken.isVisible('#sharedBanner'), false, 'and does not claim a list arrived');

/* ── 5. the QR path ────────────────────────────────────────────────────── */
await page.click('#shareQrBtn');
await settle(page, 400);
const qr = await page.evaluate(() => ({
  open: !document.getElementById('shareOverlay').hidden,
  w: document.getElementById('shareCanvas').width,
  note: document.getElementById('shareNote').textContent,
}));
eq(qr.open, true, 'a three-word list fits in a QR and the overlay opens');
ok(qr.w > 100, `a QR was drawn (${qr.w}px)`);
await page.keyboard.press('Escape');
await settle(page, 200);
eq(await page.evaluate(() => document.getElementById('shareOverlay').hidden), true, 'Escape closes it');

/* a list too long for a QR is refused by name, not drawn unreadably */
const long = await prepPage(browser, BASE, { width: 1200, height: 900 });
await long.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(long, 400);
await long.fill('#wordInput', Array.from({ length: 200 },
  (_, i) => `Term${i}: a definition long enough to push this list past what a QR code can hold | with an example sentence too`).join('\n'));
await settle(long, 600);
await long.click('#shareQrBtn');
await settle(long, 400);
eq(await long.evaluate(() => document.getElementById('shareOverlay').hidden), true, 'the overlay stays shut for an over-long list');
ok(/too long to fit in a QR/.test(await long.textContent('#shareNote')), 'and the reason is stated with a size');
ok(/Copy link/.test(await long.textContent('#shareNote')), 'pointing at the option that does work');

/* ── 6. no console noise ───────────────────────────────────────────────── */
for (const [name, p] of [['sender', page], ['receiver', other], ['broken-link', broken], ['long', long], ['blank', blank]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
