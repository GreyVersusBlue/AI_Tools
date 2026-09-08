// smoke-share.mjs — Vocabulary & Conjugation Drill Generator: the shared
// share sheet, and the two ways a set comes back in.
//
//   node Tools/vocab-conjugation-drill/test/smoke-share.mjs
//
// 039 had no test folder at all until Path 6 P2 rewrote its share code, and
// it was the only page in that batch with nothing watching it. What is under
// test is exactly what the adoption changed:
//
//   1. one button opens _shared/share.js's sheet, with the copy / QR /
//      download rows, in place of the tool's own Copy link + QR buttons and
//      its own 264 px canvas
//   2. the link it copies still carries the whole set, and opening it on
//      another device saves a COPY under a uniqued name rather than landing
//      on top of a set already there
//   3. the file the sheet's own Download row writes — which is wrapped in
//      the { aplp, state } envelope, not the bare set "Export set" writes —
//      opens again in this tool's own Import set button. That route did not
//      work before Share.unwrap() existed, and it is the one a teacher is
//      most likely to try.
//
// Exits 1 on any failure. Every word here is invented or public-domain.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8232;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/039-vocab-conjugation-drill.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

// Non-ASCII on purpose: state-link.js base64-encodes through btoa(), which is
// Latin1-only without the unescape/encodeURIComponent dance around it.
const WORDS = ['la mesa: the table', 'el libro: the book', 'la niñez: childhood'].join('\n');

const server = await serve(PORT);
const browser = await launch();

console.log('Vocabulary & Conjugation Drill — the shared share sheet');

/* ── sender ─────────────────────────────────────────────────────────────── */
const page = await prepPage(browser, BASE, { width: 1280, height: 950 });
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

await page.fill('#setName', 'Unit 3 Spanish');
await page.fill('#vocabInput', WORDS);
await page.dispatchEvent('#vocabInput', 'input');
await settle(page, 300);

/* ── 1. the sheet ───────────────────────────────────────────────────────── */
await page.click('#shareBtn');
await settle(page, 250);
ok(await page.isVisible('.share-sheet[role="dialog"]'), 'Share set… opens the shared sheet as a dialog');
eq(await page.getAttribute('.share-sheet', 'aria-modal'), 'true', 'it is modal');
const rows = await page.$$eval('.share-sheet-rows button', bs => bs.map(b => b.getAttribute('data-share')));
ok(rows.includes('copy') && rows.includes('qr') && rows.includes('download'),
   'with copy, QR and download rows: ' + JSON.stringify(rows));
ok(!(await page.$('#shareOverlay')), 'and the tool\'s own QR overlay is gone from the page entirely');

/* ── 2. the link ────────────────────────────────────────────────────────── */
const link = await page.evaluate(() => {
  let captured = null;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (t) => { captured = t; return Promise.resolve(); } },
  });
  document.querySelector('.share-sheet button[data-share="copy"]').click();
  return new Promise(r => setTimeout(() => r(captured), 80));
});
ok(typeof link === 'string' && link.includes('set='), 'Copy link produces a ?set= URL');
ok(/Link copied/.test(await page.textContent('#shareNote')), 'and the note under the button says so');

// The QR row is the measured budget in qr-draw.js, not the encoder's own
// limit: either it draws, or it is greyed out with a reason. What must never
// happen is the old behaviour — a 177-module square at 264 px.
const qr = await page.evaluate(() => {
  const b = document.querySelector('.share-sheet button[data-share="qr"]');
  return { disabled: b.disabled, reason: (document.querySelector('.share-sheet-reason') || {}).textContent || '' };
});
if (!qr.disabled) {
  await page.click('.share-sheet button[data-share="qr"]');
  await settle(page, 200);
  const w = await page.evaluate(() => document.querySelector('.share-sheet-qr canvas').width);
  ok(w > 100, `a QR was drawn (${w}px)`);
} else {
  ok(qr.reason.length > 0, 'or the row is greyed out with a reason: ' + JSON.stringify(qr.reason));
}
await page.keyboard.press('Escape');
await settle(page, 150);
ok(!(await page.$('.share-sheet')), 'Escape closes the sheet');
eq(await page.evaluate(() => document.activeElement.id), 'shareBtn', 'and focus returns to the button that opened it');

/* ── the receiver: a separate context, so nothing but the URL is shared ─── */
const other = await prepPage(browser, BASE, { width: 1280, height: 950 });
// A set already saved there under the SAME name, so the arrival has a real
// collision to avoid rather than an empty browser to land in.
await other.addInitScript(() => {
  if (localStorage.getItem('gvb-vocab-conj:list')) return;
  localStorage.setItem('gvb-vocab-conj:list', JSON.stringify(['Unit 3 Spanish']));
  localStorage.setItem('gvb-vocab-conj:data:Unit 3 Spanish', JSON.stringify({
    name: 'Unit 3 Spanish', mode: 'vocab', vocabText: 'mine: not the sender\'s',
    persons: [], conjugations: [],
  }));
  localStorage.setItem('gvb-vocab-conj:current', 'Unit 3 Spanish');
});
await other.goto(link, { waitUntil: 'networkidle' });
await settle(other, 400);

eq(await other.inputValue('#setName'), 'Unit 3 Spanish (shared)', 'the arrival is saved under a uniqued name');
ok((await other.inputValue('#vocabInput')).includes('la niñez'),
   'with the sender\'s words, non-ASCII intact');
const kept = await other.evaluate(() =>
  JSON.parse(localStorage.getItem('gvb-vocab-conj:data:Unit 3 Spanish') || 'null'));
ok(kept && /not the sender/.test(kept.vocabText), 'and the set already saved under that name is untouched');
eq(new URL(other.url()).searchParams.get('set'), null,
   'the ?set= parameter is consumed on open, so a refresh cannot import it twice');

/* ── an unreadable link says one thing, and does not survive a refresh ──── */
const broken = await prepPage(browser, BASE, { width: 1100, height: 800 });
await broken.goto(URL_PAGE + '?set=not-a-real-payload', { waitUntil: 'networkidle' });
await settle(broken, 300);
ok(/cut short/.test(await broken.textContent('#shareNote')),
   'a truncated link gets share.js\'s one standard sentence: ' + JSON.stringify(await broken.textContent('#shareNote')));
eq(new URL(broken.url()).searchParams.get('set'), null,
   'and it is cleared anyway, so a refresh does not repeat the failure');

/* ── 3. the sheet's own download opens again in Import set ──────────────
   The envelope is { aplp: {...}, state: {...} }; before Share.unwrap() the
   tool's importer JSON.parse'd it, looked for `name`/`mode`/`persons` at the
   top level, found the envelope's keys instead and refused the file it had
   just written itself. */
const envelope = await page.evaluate(() => JSON.stringify({
  aplp: { v: 1, tool: 'vocab-conjugation-drill', param: 'set', exported: new Date().toISOString() },
  state: {
    v: 1, name: 'Downloaded Set', mode: 'vocab', vocabText: 'el puente: the bridge',
    persons: ['yo'], conjugations: [],
  },
}));
const receiver = await prepPage(browser, BASE, { width: 1280, height: 950 });
await receiver.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(receiver, 400);
await receiver.setInputFiles('#importSetFile', {
  name: 'Downloaded Set.json', mimeType: 'application/json', buffer: Buffer.from(envelope, 'utf8'),
});
await settle(receiver, 400);
eq(await receiver.inputValue('#setName'), 'Downloaded Set',
   'a .json written by the share sheet opens in Import set');
ok((await receiver.inputValue('#vocabInput')).includes('el puente'), 'with its words');
ok(/Opened that file/.test(await receiver.textContent('#shareNote')), 'and the tool says so');

// A file that is not this tool's is refused by name, in the note rather than
// in an alert() nobody can read back.
await receiver.setInputFiles('#importSetFile', {
  name: 'not-ours.json', mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify({ words: 'this is 040\'s shape' }), 'utf8'),
});
await settle(receiver, 400);
ok(/not a drill set/.test(await receiver.textContent('#shareNote')),
   'another tool\'s export is refused by name: ' + JSON.stringify(await receiver.textContent('#shareNote')));
eq(await receiver.inputValue('#setName'), 'Downloaded Set', 'and nothing on screen changed');

/* ── no console noise anywhere ──────────────────────────────────────────── */
for (const [name, p] of [['sender', page], ['receiver', other], ['broken link', broken], ['file import', receiver]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
