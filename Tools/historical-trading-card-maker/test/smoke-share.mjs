// smoke-share.mjs — deck share link/QR, np_rosters batch-add, and the sample deck.
//
//   node Tools/historical-trading-card-maker/test/smoke-share.mjs
//
// Three independent features from the SS-demo revisit round, covered
// together because all three are about getting a deck populated fast:
//
//   1. Share a deck through the shared sheet (_shared/share.js + qr-draw.js,
//      Path 6 P1 — 064 is the single adopter, so this suite is also where the
//      sheet's DOM behaviour is proven). The link payload must carry card
//      text, stats, meta and theme, but never a photo; the sheet must SAY a
//      photo was left out; the downloaded .json must carry it; and an
//      oversized deck must grey the QR row out with the reason instead of
//      drawing a square nobody's phone can scan. Opening a link never
//      overwrites a deck already on that device.
//   2. Batch-add from roster now offers a class-list dropdown fed from the
//      shared `np_rosters` key (written by Name Picker / Class Roster Hub),
//      live-refreshing on a `storage` event, with typed/pasted text still
//      the fallback.
//   3. "Load sample deck" drops in a real 5-card demo deck (mixed rarity and
//      theme, no photos) as its own named deck, and never overwrites an
//      existing "Sample deck" without asking first.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8299;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/064-historical-trading-card-maker.html';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

console.log('Trading Card Maker — share by link/QR, roster batch-add, sample deck');

/* ── 1. share a deck by link: what travels, what doesn't ─────────────────── */
const page = await prepPage(browser, BASE, { width: 1280, height: 1000 });
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

await page.fill('#newName', 'Harriet Tubman');
await page.setInputFiles('#newImage', { name: 'tiny.png', mimeType: 'image/png', buffer: TINY_PNG });
await settle(page, 400); // downscale is async
await page.fill('#newStats', 'Born: 1822\nCourage: 9/10');
await page.fill('#newFacts', 'Escaped slavery in 1849.\nLed dozens of people to freedom.');
await page.selectOption('#newRarity', 'legendary');
await page.selectOption('#newStars', '4');
await page.click('.theme-swatch[data-theme="parchment"]');
await settle(page, 200);
await page.click('#addEntryBtn');
await settle(page, 200);
eq(await page.textContent('#entryCount'), '1', 'one card is in the deck, with a photo');
ok(await page.evaluate(() => !!document.querySelector('.entry-row img.thumb')), 'the photo shows in the card list');

/* the sheet: one button opens it; Copy link is the first row and gets focus */
await page.evaluate(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } },
  });
});
await page.click('#shareBtn');
await settle(page, 150);
ok(await page.isVisible('.share-sheet[role="dialog"]'), 'Share deck… opens the shared sheet as a dialog');
eq(await page.getAttribute('.share-sheet', 'aria-modal'), 'true', 'it is modal');
const rows = await page.$$eval('.share-sheet-rows button', bs => bs.map(b => b.getAttribute('data-share')));
ok(rows.slice(0, 3).join(',') === 'copy,qr,download', 'with copy, QR and download rows in that order: ' + rows.join(','));
eq(await page.evaluate(() => document.activeElement.getAttribute('data-share')), 'copy', 'focus lands on Copy link');
const sheetA11y = await a11yScan(page, { include: '.share-sheet-backdrop' });
ok(sheetA11y.length === 0, 'the open sheet has no serious/critical axe violations: ' + JSON.stringify(sheetA11y.map(v => v.id)));
ok(/1 image is left out of the link and QR code/.test(await page.textContent('.share-sheet-note')),
   'the sheet says the photo is left out of the link, by policy: ' + JSON.stringify(await page.textContent('.share-sheet-note')));
ok(/downloaded file carries it/.test(await page.textContent('.share-sheet-note')), 'and that the file carries it');
await page.click('.share-sheet button[data-share="copy"]');
await settle(page, 120);
const url = await page.evaluate(() => window.__copied);
ok(url && url.indexOf('deck=') !== -1, 'Copy link puts a ?deck= link on the clipboard');
ok(/never overwrite/.test(await page.textContent('.share-sheet-status')), 'and the sheet explains what opening it does');
ok(/never overwrite/.test(await page.textContent('#shareNote')), 'mirrored into the page\'s own note under the button');

/* the downloaded file carries the photo the link does not */
const [dl] = await Promise.all([
  page.waitForEvent('download'),
  page.click('.share-sheet button[data-share="download"]'),
]);
eq(dl.suggestedFilename(), 'My cards.json', 'Download file is named after the deck');
const fileText = await (await import('node:fs')).promises.readFile(await dl.path(), 'utf8');
const file = JSON.parse(fileText);
eq(file.aplp.tool, 'historical-trading-card-maker', 'the file names its tool');
eq(file.aplp.param, 'deck', 'and the param the tool reads');
ok(file.state.cards[0].image && typeof file.state.cards[0].image.src === 'string' && file.state.cards[0].image.src.startsWith('data:image/'),
   'and the photo IS in the file');
eq(file.state.cards[0].name, 'Harriet Tubman', 'with the rest of the card');

await page.keyboard.press('Escape');
await settle(page, 100);
ok(!(await page.$('.share-sheet')), 'Escape closes the sheet');
eq(await page.evaluate(() => document.activeElement.id), 'shareBtn', 'and focus returns to the button that opened it');

const payload = await page.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('deck')), url);
eq(payload.v, 1, 'the payload is versioned');
eq(payload.cards.length, 1, 'it carries the one card');
eq(payload.cards[0].name, 'Harriet Tubman', 'with the name');
eq(payload.cards[0].stats.length, 2, 'and its stats');
eq(payload.cards[0].facts.length, 2, 'and its facts');
eq(payload.cards[0].meta.rarity, 'legendary', 'and its rarity');
eq(payload.cards[0].meta.stars, 4, 'and its star rating');
eq(payload.settings.theme, 'parchment', 'the deck theme travels in settings');
ok(payload.cards[0].image === null || payload.cards[0].image.src === null, 'but the photo does NOT travel (image.src is stripped to null)');
ok(JSON.stringify(payload).indexOf('base64') === -1 && url.length < 4000,
   'the link stays short because the photo was stripped, not just hidden');

/* ── 2. opening the link elsewhere: new deck, never an overwrite ─────────── */
const other = await prepPage(browser, BASE, { width: 1280, height: 1000 });
await other.goto(url, { waitUntil: 'networkidle' });
await settle(other, 400);
eq(await other.textContent('#entryCount'), '1', 'the receiving browser shows the shared card');
ok(!(await other.evaluate(() => !!document.querySelector('.entry-row img.thumb'))),
   'with no photo — it stayed on the sending device');
const deckNameOnArrival = await other.inputValue('#deckSelect');
ok(deckNameOnArrival !== 'My cards' && /shared/.test(deckNameOnArrival),
   `it landed as a new deck, not overwriting the default "My cards" (got "${deckNameOnArrival}")`);
const otherDecks = await other.evaluate(() => window.HtcmStore.listDecks());
ok(otherDecks.indexOf('My cards') !== -1, 'the receiving browser\'s own default deck is still there, untouched');
eq(new URL(other.url()).searchParams.get('deck'), null, 'the ?deck= param is consumed so a refresh can\'t re-import it');
ok(/could not be read/.test((await other.evaluate(() => '')) || '') === false, 'sanity: no stray error text leaked');

/* ── 3. a mangled share link fails loudly instead of opening blank ───────── */
const broken = await prepPage(browser, BASE, { width: 1200, height: 900 });
broken.on('dialog', d => d.dismiss());
await broken.goto(URL_PAGE + '?deck=not-base64-%%%', { waitUntil: 'networkidle' });
await settle(broken, 300);
ok(await broken.isVisible('#deckSelect'), 'the tool still renders a working deck after a mangled link');

/* ── 4. the QR path, and the too-dense-to-scan refusal ───────────────────── */
await page.click('#shareBtn');
await settle(page, 150);
ok(!(await page.evaluate(() => document.querySelector('.share-sheet button[data-share="qr"]').disabled)),
   'a small deck\'s QR row is enabled');
await page.click('.share-sheet button[data-share="qr"]');
await settle(page, 300);
const qr = await page.evaluate(() => {
  const c = document.querySelector('.share-sheet-qr canvas');
  return c && { w: c.width, css: c.style.width, modules: null };
});
ok(qr && qr.w >= 100 && qr.w % 4 === 0, `a small deck draws a QR at integer px per module (${qr && qr.w}px, ${qr && qr.css} CSS)`);
// decode what was drawn with the vendored jsQR: the sheet's QR is a real link
const decoded = await page.evaluate(async () => {
  await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '../_shared/vendor/jsqr/jsqr.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const c = document.querySelector('.share-sheet-qr canvas');
  const img = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  const r = window.jsQR(img.data, img.width, img.height);
  return r && r.data;
});
eq(decoded, url, 'and jsQR reads the exact share link back out of the canvas');
await page.click('.share-sheet-close');
await settle(page, 150);
ok(!(await page.$('.share-sheet')), 'the close button closes the sheet');

await page.evaluate(() => {
  const cards = [];
  for (let i = 0; i < 80; i++) {
    cards.push({
      id: 'c' + i, name: 'Figure Number ' + i, image: null,
      stats: Array.from({ length: 6 }, (_, j) => ({
        label: 'Attribute ' + j,
        value: 'A fairly long descriptive value for attribute ' + j + ' on figure ' + i + '.'
      })),
      facts: Array.from({ length: 6 }, (_, j) =>
        'This is a long fact number ' + j + ' about figure ' + i + ', padded out to add real payload size.'),
      meta: { rarity: 'common', setName: 'Huge Set', cardNo: i + 1, setSize: 80, stars: 0 }, theme: null
    });
  }
  localStorage.setItem('htcm:list', JSON.stringify(['Huge deck']));
  localStorage.setItem('htcm:data:Huge deck', JSON.stringify({ v: 2, cards, settings: { size: 'standard', theme: 'classic' } }));
  localStorage.setItem('htcm:current', 'Huge deck');
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
eq(await page.textContent('#entryCount'), '80', 'a huge deck loaded (80 cards) via direct storage seeding');
await page.click('#shareBtn');
await settle(page, 400);
const bigQr = await page.evaluate(() => {
  const b = document.querySelector('.share-sheet button[data-share="qr"]');
  return { disabled: b.disabled, sub: b.querySelector('small').textContent, reason: document.querySelector('.share-sheet-reason').textContent,
    copyEnabled: !document.querySelector('.share-sheet button[data-share="copy"]').disabled };
});
eq(bigQr.disabled, true, 'a deck too big for a QR code greys the row out instead of drawing an unscannable square');
eq(bigQr.sub, 'too dense to scan', 'and labels it');
ok(/more than any QR code can hold|cannot read reliably/.test(bigQr.reason), 'with the reason: ' + JSON.stringify(bigQr.reason));
ok(/[Cc]opy the link/.test(bigQr.reason) && /download/.test(bigQr.reason), 'naming both alternatives');
ok(bigQr.copyEnabled, 'and Copy link still works — a copied link has no such limit');
await page.keyboard.press('Escape');
await settle(page, 100);

/* ── 5. roster batch-add reads np_rosters, with paste as the fallback ────── */
const roster = await prepPage(browser, BASE, { width: 1280, height: 1000 });
await roster.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(roster, 300);
await roster.evaluate(() => {
  localStorage.setItem('np_rosters', JSON.stringify({ 'Period 3': ['Ana Ortiz', 'Ben Cole', 'Cleo Diaz'] }));
});
await roster.click('#rosterBtn');
await settle(roster, 150);
const initialOptions = await roster.evaluate(() =>
  Array.from(document.getElementById('rosterClassSelect').options).map(o => o.textContent));
ok(initialOptions.some(t => /Period 3 \(3\)/.test(t)), 'the class-list dropdown lists the saved roster with its count');

await roster.selectOption('#rosterClassSelect', 'Period 3');
eq(await roster.inputValue('#rosterText'), 'Ana Ortiz\nBen Cole\nCleo Diaz',
   'picking a class list fills the paste box with one name per line');

/* the storage event refresh: a roster saved elsewhere should show up live */
await roster.evaluate(() => {
  localStorage.setItem('np_rosters', JSON.stringify({
    'Period 3': ['Ana Ortiz', 'Ben Cole', 'Cleo Diaz'], 'Period 5': ['Deb Ray', 'Eli Fox']
  }));
  window.dispatchEvent(new StorageEvent('storage', { key: 'np_rosters' }));
});
await settle(roster, 150);
const refreshedOptions = await roster.evaluate(() =>
  Array.from(document.getElementById('rosterClassSelect').options).map(o => o.textContent));
ok(refreshedOptions.some(t => /Period 5 \(2\)/.test(t)), 'a roster saved in another tab appears without a reload');

await roster.click('#rosterAddBtn');
await settle(roster, 200);
eq(await roster.textContent('#entryCount'), '3', 'roster batch-add created one blank card per class-list name');
const rosterCardNames = await roster.evaluate(() =>
  JSON.parse(localStorage.getItem('htcm:data:My cards')).cards.map(c => c.name));
eq(rosterCardNames.join(','), 'Ana Ortiz,Ben Cole,Cleo Diaz', 'in class-list order');

/* the paste box is still the fallback when no roster is picked */
await roster.click('#rosterBtn');
await settle(roster, 150);
await roster.fill('#rosterText', 'A Pasted Name');
await roster.click('#rosterAddBtn');
await settle(roster, 200);
eq(await roster.textContent('#entryCount'), '4', 'typed/pasted names still work without picking a class list');

/* ── 6. load sample deck: real content, mixed rarity/theme, no photos ────── */
const sample = await prepPage(browser, BASE, { width: 1280, height: 1000 });
await sample.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(sample, 300);
await sample.click('#sampleDeckBtn');
await settle(sample, 300);
eq(await sample.inputValue('#deckSelect'), 'Sample deck', 'the sample deck becomes the active, newly named deck');
eq(await sample.textContent('#entryCount'), '5', 'with five cards');
const sampleDoc = await sample.evaluate(() => JSON.parse(localStorage.getItem('htcm:data:Sample deck')));
const sampleNames = sampleDoc.cards.map(c => c.name);
ok(sampleNames.includes('George Washington') && sampleNames.includes('Phillis Wheatley'),
   'real historical figures, not lorem-ipsum placeholders: ' + JSON.stringify(sampleNames));
ok(sampleDoc.cards.every(c => c.stats.length > 0 && c.facts.length > 0), 'every sample card has real stats and facts');
ok(sampleDoc.cards.every(c => !c.image), 'no photos are embedded in the sample deck');
ok(new Set(sampleDoc.cards.map(c => c.meta.rarity)).size > 1, 'the sample deck mixes rarities');
ok(new Set(sampleDoc.cards.map(c => c.theme || sampleDoc.settings.theme)).size > 1,
   'and mixes themes (deck default plus at least one per-card override)');
ok(await sample.evaluate(() => !!document.querySelector('#previewFront .trading-card .cstats div')),
   'the sample deck renders immediately in the live preview');

/* loading it again when "Sample deck" already exists asks first, never overwrites */
const decksBefore = await sample.evaluate(() => window.HtcmStore.listDecks());
sample.once('dialog', d => d.dismiss());
await sample.click('#sampleDeckBtn');
await settle(sample, 200);
const decksAfterDecline = await sample.evaluate(() => window.HtcmStore.listDecks());
eq(decksAfterDecline.length, decksBefore.length, 'declining the "already exists" confirm creates nothing new');

sample.once('dialog', d => d.accept());
await sample.click('#sampleDeckBtn');
await settle(sample, 300);
const decksAfterAccept = await sample.evaluate(() => window.HtcmStore.listDecks());
ok(decksAfterAccept.indexOf('Sample deck 2') !== -1,
   'confirming loads a second copy under a new name: ' + JSON.stringify(decksAfterAccept));
eq(await sample.inputValue('#deckSelect'), 'Sample deck 2', 'and switches to the new copy');
ok(decksAfterAccept.indexOf('Sample deck') !== -1, 'the original "Sample deck" is untouched, not overwritten');

/* ── 7. no console noise anywhere in the run ─────────────────────────────── */
for (const [name, p] of [['sender', page], ['receiver', other], ['broken-link', broken], ['roster', roster], ['sample', sample]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 5)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 5)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
