// smoke-share.mjs — the Vocabulary Flashcard generator's share-a-word-list link.
//
//   node Tools/vocab-flashcard-generator/test/smoke-share.mjs
//
// Exporting a .json file already worked, but a file has to be attached,
// downloaded, found again and imported. A link is one step; a QR is zero for
// the colleague standing next to you with a phone.
//
// What travels is the deck: the list name, the raw word text, and the card
// settings that decide how it prints — "the same deck" means the 3x5 fold-over
// cards the sender set up, not just the words. What must NOT travel is the
// rest of this browser: the sender's other saved lists stay home, and the
// receiving side saves the arrival under a uniqued name rather than
// overwriting a list already there. Those two are the assertions that matter.
//
// Exits 1 on any failure. Every word here is invented or public-domain.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8171;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/040-vocab-flashcard-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

// A non-ASCII term is in here on purpose: state-link.js base64-encodes through
// btoa(), which is Latin1-only without the unescape/encodeURIComponent dance.
const WORDS = [
  'Photosynthesis: process plants use to make food | Plants use photosynthesis to grow',
  'Mitosis: cell division',
  'Écosystème: a community of living things and their surroundings',
].join('\n');

const server = await serve(PORT);
const browser = await launch();

console.log('Vocabulary Flashcards — share a word list by link or QR');

/* ── sender: build a deck with non-default card settings ───────────────── */
const page = await prepPage(browser, BASE, { width: 1280, height: 950 });
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

await page.fill('#listName', 'Unit 4 Vocabulary');
await page.fill('#wordInput', WORDS);
await page.dispatchEvent('#wordInput', 'input');
await page.selectOption('#cardSizePreset', '3x5');
await page.selectOption('#flashLayout', 'fold');
await page.selectOption('#sortOrder', 'az');
await settle(page, 300);

/* ── the toolbar the share buttons live in has to survive a return visit ──
   It was only ever revealed by newList(), so a teacher who came back to a
   saved list lost the switcher, Export, Import and both share buttons — the
   multi-list feature was effectively invisible past a first session. */
eq(await page.isVisible('#toolbar'), true, 'the toolbar is there on a first run');
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 500);
eq(await page.isVisible('#toolbar'), true, 'and still there after a reload onto a saved list');
eq(await page.isVisible('#shareLinkBtn'), true, 'so the share buttons are reachable on a return visit');
eq(await page.inputValue('#listName'), 'Unit 4 Vocabulary', 'with the saved list actually loaded');

/** The URL the Copy link button would put on the clipboard. */
const shareLink = () => page.evaluate(() => {
  let captured = null;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (t) => { captured = t; return Promise.resolve(); } },
  });
  document.getElementById('shareLinkBtn').click();
  return new Promise(r => setTimeout(() => r(captured), 60));
});

const link = await shareLink();
ok(typeof link === 'string' && link.includes('deck='), 'Copy link produces a ?deck= URL');
ok(/Link copied/.test(await page.textContent('#shareNote')), 'and says so');

/* ── the QR code ───────────────────────────────────────────────────────── */
await page.click('#shareQrBtn');
await settle(page, 200);
const qr = await page.evaluate(() => ({
  open: !document.getElementById('shareOverlay').hidden,
  w: document.getElementById('shareCanvas').width,
  note: document.getElementById('shareNote').textContent,
}));
if (qr.open) {
  ok(qr.w > 100, `a QR was drawn (${qr.w}px)`);
  await page.keyboard.press('Escape');
  await settle(page, 150);
  eq(await page.evaluate(() => document.getElementById('shareOverlay').hidden), true, 'Escape closes the QR overlay');
} else {
  // A long list with example sentences can outrun what a QR can hold. Saying so
  // is the correct behavior; an unscannable square is not.
  ok(/too long to fit in a QR/.test(qr.note), 'an over-long list is refused by name');
}

/* ── an empty list has nothing to share ────────────────────────────────── */
await page.fill('#wordInput', '');
await page.dispatchEvent('#wordInput', 'input');
await settle(page, 200);
await page.click('#shareLinkBtn');
await settle(page, 150);
ok(/Add some words first/.test(await page.textContent('#shareNote')), 'an empty list refuses to share');

/* ── receiver: a separate context, so nothing is shared but the URL ────── */
const other = await prepPage(browser, BASE, { width: 1280, height: 950 });
// A list already saved there, to prove the arrival doesn't land on top of it.
// Seed once only — this runs on every navigation, and the "opening the link
// twice" check below depends on the second load seeing the first one's result.
await other.addInitScript(() => {
  if (localStorage.getItem('gvb-vocab-flashcards:list')) return;
  localStorage.setItem('gvb-vocab-flashcards:list', JSON.stringify(['My Own List']));
  localStorage.setItem('gvb-vocab-flashcards:data:My Own List', JSON.stringify({
    name: 'My Own List', words: 'Sovereignty: supreme authority', mode: 'flashcards',
    flashCols: 2, flashRows: 4, cardSizePreset: 'grid', flashLayout: 'duplex',
    wallPerPage: 2, wallShowDef: true, sortOrder: 'none', shuffle: false, showGuides: true,
  }));
  localStorage.setItem('gvb-vocab-flashcards:current', 'My Own List');
});
await other.goto(link, { waitUntil: 'networkidle' });
await settle(other, 400);

eq(await other.inputValue('#listName'), 'Unit 4 Vocabulary (shared)', 'arrives as a new "(shared)" list');
const got = await other.inputValue('#wordInput');
ok(got.includes('Photosynthesis'), 'the word list travelled');
ok(got.includes('Écosystème'), 'a non-ASCII term survived the base64 round trip');
eq(await other.inputValue('#cardSizePreset'), '3x5', 'card stock size travelled');
eq(await other.inputValue('#flashLayout'), 'fold', 'printing layout travelled');
eq(await other.inputValue('#sortOrder'), 'az', 'sort order travelled');
ok(/shared link/.test(await other.textContent('#shareNote')), 'a banner says where this came from');
ok(!other.url().includes('deck='), 'the ?deck= param is consumed, so a refresh cannot re-import');
ok(await other.$$eval('#previewArea .flash-card, #previewArea .fold-card', e => e.length) > 0,
   'the shared deck renders a preview');

const keys = await other.evaluate(() =>
  Object.keys(localStorage).filter(k => k.startsWith('gvb-vocab-flashcards:data:')).sort());
eq(keys.length, 2, 'the receiver still has their own list: ' + JSON.stringify(keys));
ok(keys.includes('gvb-vocab-flashcards:data:My Own List'), 'and it was not overwritten');
const mine = await other.evaluate(() =>
  JSON.parse(localStorage.getItem('gvb-vocab-flashcards:data:My Own List')).words);
ok(mine.includes('Sovereignty'), 'the pre-existing list is byte-for-byte untouched');

/* ── opening the same link twice makes a copy, never a clobber ─────────── */
await other.goto(link, { waitUntil: 'networkidle' });
await settle(other, 400);
eq((await other.evaluate(() =>
  Object.keys(localStorage).filter(k => k.startsWith('gvb-vocab-flashcards:data:')).length)), 3,
  'a second open adds a second copy rather than overwriting the first');

/* ── a mangled link says so instead of opening blank ───────────────────── */
const broken = await prepPage(browser, BASE, { width: 1280, height: 950 });
await broken.goto(URL_PAGE + '?deck=not-base64!!!', { waitUntil: 'networkidle' });
await settle(broken, 300);
ok(/could not be read/.test(await broken.textContent('#shareNote')), 'a mangled link is reported by name');
ok(await broken.isVisible('#wordInput'), 'and the tool still boots');

/* ── no console noise, nothing left the site ───────────────────────────── */
for (const [name, p] of [['sender', page], ['receiver', other], ['broken-link', broken]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
