// smoke-share.mjs — DBQ / Source Packet Builder: named packets + share a
// packet by link (backlog rank 23).
//
//   node Tools/dbq-source-packet-builder/test/smoke-share.mjs
//
// This round replaced the tool's single dbq_packet_v1 blob with a triple-key
// list of named packets (same convention as the Historical Trading Card
// Maker's htcm-store.js) so a shared link has somewhere to land that isn't
// "overwrite the teacher's only packet." What's under test:
//
//   1. a pre-existing dbq_packet_v1 save migrates in as the first named
//      packet, and the legacy key is kept as a backup
//   2. a share link/QR carries the packet's text sources, citations, and
//      questions, but never an image source's pixel data
//   3. the share sheet names exactly which sources kept their images on this
//      device, so the "identical packet" promise stays honest
//   4. opening a shared link always saves as a NEW packet under a uniqued
//      name, even when the name collides with one already on the receiving
//      device — it never overwrites
//
// Exits 1 on any failure. Every name/quote here is invented for the test.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8214;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/056-dbq-source-packet-builder.html';

// A 1x1 transparent PNG, same fixture used by the trading-card-maker suite.
const PX_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

console.log('DBQ / Source Packet Builder — named packets + share a packet by link');

/* ── 1. migration: a pre-existing dbq_packet_v1 blob becomes the first
   named packet, and the legacy key stays behind as a backup ──────────── */
const migrated = await prepPage(browser, BASE, { width: 1300, height: 1000 });
await migrated.goto(URL_PAGE, { waitUntil: 'networkidle' });
await migrated.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('dbq_packet_v1', JSON.stringify({
    title: 'Legacy DBQ: Causes of World War I',
    context: 'A pre-existing single-packet save from before named packets shipped.',
    essayPrompt: '',
    sharedQuestions: [{ id: 'sq1', text: 'Shared legacy question' }],
    sources: [{
      id: 's1', title: 'Legacy Source', type: 'text', text: 'Legacy source text.',
      image: null, citation: 'Legacy citation, 1914.', questions: [{ id: 'q1', text: 'Legacy question' }]
    }]
  }));
});
await migrated.reload({ waitUntil: 'networkidle' });
await settle(migrated, 400);

eq(await migrated.inputValue('#packetTitle'), 'Legacy DBQ: Causes of World War I',
   'the migrated packet opens with its old title intact');
const migratedNames = await migrated.evaluate(() => Array.from(document.querySelectorAll('#packetSwitch option')).map(o => o.textContent));
ok(migratedNames.indexOf('Legacy DBQ: Causes of World War I') !== -1,
   `the legacy packet is now a named saved packet (${JSON.stringify(migratedNames)})`);
ok(await migrated.evaluate(() => !!localStorage.getItem('dbq_packet_v1')),
   'the old dbq_packet_v1 key is kept in place as a one-release backup, not deleted');
ok(await migrated.evaluate(() => Array.isArray(JSON.parse(localStorage.getItem('dbq:list') || 'null'))),
   'the new triple-key store (dbq:list) is populated');

/* ── 2. build a known packet: edit the example's title/citation, add an
   image source, then share it ──────────────────────────────────────────── */
const page = await prepPage(browser, BASE, { width: 1300, height: 1000 });
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

// A brand-new install opens on the worked example, not a blank shell.
eq(await page.inputValue('#packetTitle'), 'Child Labor in the Industrial Revolution',
   'a fresh install opens on the worked example packet');

await page.fill('#packetTitle', 'Child Labor in the Industrial Revolution (edited)');
await page.dispatchEvent('#packetTitle', 'input');
await page.fill('#sourcesWrap .source-block:nth-child(1) [data-field="citation"]', 'Edited citation for testing, 1833.');
await page.dispatchEvent('#sourcesWrap .source-block:nth-child(1) [data-field="citation"]', 'input');
await settle(page, 200);

// add a fourth source and make it an image source with a real upload
await page.click('#addSourceBtn');
await settle(page, 200);
await page.fill('#sourcesWrap .source-block:last-child [data-field="title"]', 'Photograph of a Mill');
await page.dispatchEvent('#sourcesWrap .source-block:last-child [data-field="title"]', 'input');
await page.selectOption('#sourcesWrap .source-block:last-child select[data-field="type"]', 'image');
await settle(page, 200);
await page.setInputFiles('#sourcesWrap .source-block:last-child input[type="file"]', {
  name: 'evidence.png', mimeType: 'image/png', buffer: Buffer.from(PX_PNG, 'base64')
});
await settle(page, 500); // FileReader + natural-size probe are both async

const beforeSourceCount = await page.evaluate(() => document.querySelectorAll('#sourcesWrap .source-block').length);
eq(beforeSourceCount, 4, 'the packet now has 4 sources, the 4th with an uploaded image');

/* ── the share link itself, out of the shared sheet (_shared/share.js) ──── */
await page.click('#shareBtn');
await settle(page, 200);
ok(await page.isVisible('.share-sheet[role="dialog"]'), 'Share packet… opens the shared sheet as a dialog');

/* ── the sheet names exactly which sources kept their images ────────────
   The generic half of this — "1 image is left out of the link and QR code;
   the downloaded file carries it" — is share.js's own sentence and holds for
   every adopter. The naming half is this tool's `note` callback, and it is
   what keeps the "identical packet" promise honest. */
const sheetNote = await page.textContent('.share-sheet-note');
ok(/Photograph of a Mill/.test(sheetNote), `the sheet names the image source by title (got: ${JSON.stringify(sheetNote)})`);
ok(/Source D/.test(sheetNote), 'and by its letter');
ok(/re-upload/i.test(sheetNote), 'and says what to do about it');
ok(/left out of the link and QR code/.test(sheetNote), 'and share.js says the images do not ride the link at all');
ok(/downloaded file carries/.test(sheetNote), 'while the downloaded file does carry them — the route that did not exist before');

const url = await page.evaluate(() => {
  let captured = null;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (t) => { captured = t; return Promise.resolve(); } },
  });
  document.querySelector('.share-sheet button[data-share="copy"]').click();
  return new Promise(r => setTimeout(() => r(captured), 60));
});
ok(url && url.indexOf('packet=') !== -1, 'Copy link produces a ?packet= link');
await page.keyboard.press('Escape');
await settle(page, 150);

const payload = await page.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('packet')), url);
eq(payload.v, 1, 'the payload is versioned');
eq(payload.title, 'Child Labor in the Industrial Revolution (edited)', 'the edited title travels');
eq(payload.sources.length, 4, 'all 4 sources travel');
eq(payload.sources[0].citation, 'Edited citation for testing, 1833.', 'an edited source-level field (citation) travels');
ok(payload.sources[0].text.indexOf('cotton mills') !== -1, 'source text travels intact');
eq(payload.sharedQuestions.length, 2, 'the shared guiding questions travel');
ok(payload.sources[0].questions[0].text.length > 0, 'a source-specific question travels');
eq(payload.sources[3].image, null, 'the 4th (image) source travels WITHOUT its pixel data — share.js strips every data: image out of the link by policy, leaving null');
ok(typeof payload.sources[3].widthPct === 'number', 'but its width-percent metadata still travels');

/* ── the note under the button records what the sheet last did ─────────── */
ok(/Link copied/.test(await page.textContent('#shareNote')), 'the note under the button says the link was copied');

/* ── 3. an incoming link never overwrites — it saves under a uniqued name,
   even when the receiving device already has a packet under that name.
   (Packet NAME, the multi-save slot, is separate from packet TITLE, the
   printed heading — the sender above only edited the title, so the sender's
   packet is still saved under its original auto-example name, and a fresh
   receiving device boots its OWN local packet under that very same default
   name, which sets up a real collision with no manual seeding needed.) ──── */
const other = await prepPage(browser, BASE, { width: 1300, height: 1000 });
await other.goto(URL_PAGE, { waitUntil: 'networkidle' }); // boots its OWN local packet
await settle(other, 400);
eq(await other.inputValue('#packetName'), 'Child Labor in the Industrial Revolution (example)',
   'the receiving device boots its own local packet under the same default example name the sender started with');
eq(await other.inputValue('#packetTitle'), 'Child Labor in the Industrial Revolution',
   'with the original (un-edited) title — this device never saw the sender’s edit');

await other.goto(url, { waitUntil: 'networkidle' });
await settle(other, 500);

ok(/Opened from a shared link/.test(await other.textContent('#shareNote')), 'the receiving device says the packet arrived from a link');
const importedName = await other.inputValue('#packetName');
eq(importedName, 'Child Labor in the Industrial Revolution (example) (2)',
   `a name collision on the receiving device is not overwritten silently — it is saved under a uniqued name (got "${importedName}")`);
eq(await other.inputValue('#packetTitle'), 'Child Labor in the Industrial Revolution (edited)',
   'and the imported content is the shared (edited) packet, title included');
const preservedLocal = await other.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('dbq:data:Child Labor in the Industrial Revolution (example)'));
  return d && d.title;
});
eq(preservedLocal, 'Child Labor in the Industrial Revolution',
   'the receiving device’s own pre-existing packet under that name is untouched, not overwritten');

const otherUrl = new URL(other.url());
eq(otherUrl.searchParams.get('packet'), null, 'the ?packet= parameter is consumed on open, so a refresh cannot re-import it twice');

/* ── 4. no console noise anywhere ───────────────────────────────────────── */
for (const [name, p] of [['migration', migrated], ['sender', page], ['receiver', other]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
