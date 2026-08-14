// smoke-source-library.mjs — the source library.
//
//   node Tools/dbq-source-packet-builder/test/smoke-source-library.mjs
//
// A teacher who cites the same document every year should upload and caption
// it once. The library saves individual sources — text or image, with their
// citation, crop, print width and questions — outside of any packet.
//
// "Outside of any packet" is the whole design, and it is what this suite is
// mostly about, because it is the part that would be invisible until the day
// it bites:
//
//   1. Deleting a packet must not delete the library. If the library lived
//      inside a packet document, it would, and nobody would find out until a
//      year of saved sources went with a packet nobody needed any more.
//   2. Removing a source from the library must not touch a packet built from
//      it. The packet has its own copy, by design.
//   3. Adding from the library gives the packet a *copy* with fresh ids —
//      editing the packet's copy must not silently rewrite the library
//      entry, and the same source added twice must not collide with itself.
//   4. Saving a source that came from the library updates that entry instead
//      of making a second one, which is what makes the library stay usable
//      after a year of small corrections. Matching is by a stored id, not by
//      title: two different letters from 1776 can share a title.
//   5. An empty source is refused, with a reason.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8219;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/056-dbq-source-packet-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });

console.log('DBQ / Source Packet Builder — source library');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page);

const bank = () => page.evaluate(() => JSON.parse(localStorage.getItem('dbq:bank') || '[]'));
const packet = () => page.evaluate(() => {
  const name = localStorage.getItem('dbq:current');
  return JSON.parse(localStorage.getItem('dbq:data:' + name) || 'null');
});

/* The tool boots on the worked example packet, so there are real sources to
   save. Work with the first one. */
const firstSourceId = await page.evaluate(() => document.querySelector('#sourcesWrap .source-block').getAttribute('data-src-id'));
ok(!!firstSourceId, 'the example packet has a source to work with');

/* ── 1. saving a source puts it in the library ───────────────────────────── */
eq((await bank()).length, 0, 'the library starts empty');
await page.click(`[data-to-bank="${firstSourceId}"]`);
await settle(page, 200);

let entries = await bank();
eq(entries.length, 1, 'saving adds one library entry');
ok(entries[0].bankId && entries[0].source, 'the entry has an id and a source');
ok(entries[0].source.title.length > 0 || entries[0].source.text.length > 0, 'and carries the source content');
ok(entries[0].source.questions.length > 0, 'including its source-specific questions');
ok(/Saved/.test(await page.textContent('#bankNote')), 'the note confirms the save');
ok(!(await page.isHidden('#bankPanel')), 'and the library panel opens so the teacher can see it landed');

/* The packet's source now remembers the library entry, which is what turns
   the button into an update rather than a second copy. */
let pk = await packet();
eq(pk.sources[0].bankId, entries[0].bankId, "the packet's source records which library entry it is");
eq(await page.textContent(`[data-to-bank="${firstSourceId}"]`), 'Update in library',
   'and the button now offers to update it');

/* ── 2. saving again updates rather than duplicating ─────────────────────── */
await page.fill(`[data-field="title"][data-src="${firstSourceId}"]`, 'Testimony before the committee (corrected)');
await settle(page, 200);
await page.click(`[data-to-bank="${firstSourceId}"]`);
await settle(page, 200);
entries = await bank();
eq(entries.length, 1, 'saving a library source again updates it instead of adding a second copy');
eq(entries[0].source.title, 'Testimony before the committee (corrected)', 'and the correction is what is stored');
ok(/Updated/.test(await page.textContent('#bankNote')), 'the note says updated, not saved');

/* Two different sources with the SAME title must still be two entries —
   matching is by id, not by name. */
const secondSourceId = await page.evaluate(() => {
  const blocks = document.querySelectorAll('#sourcesWrap .source-block');
  return blocks[1].getAttribute('data-src-id');
});
await page.fill(`[data-field="title"][data-src="${secondSourceId}"]`, 'Testimony before the committee (corrected)');
await settle(page, 200);
await page.click(`[data-to-bank="${secondSourceId}"]`);
await settle(page, 200);
eq((await bank()).length, 2, 'a different source with an identical title is a separate library entry');

/* ── 3. adding from the library copies into the packet ───────────────────── */
const targetBankId = (await bank())[0].bankId;
const sourcesBefore = (await packet()).sources.length;
await page.click(`[data-bank-add="${targetBankId}"]`);
await settle(page, 250);
pk = await packet();
eq(pk.sources.length, sourcesBefore + 1, 'adding from the library appends a source to the packet');

const added = pk.sources[pk.sources.length - 1];
const original = pk.sources[0];
eq(added.bankId, targetBankId, 'the added source knows which library entry it came from');
ok(added.id !== original.id, 'but it is a distinct source in the packet, with its own id');
ok(added.questions.every(q => original.questions.every(oq => oq.id !== q.id)),
   'and its questions have their own ids too, so editing one does not edit the other');
eq(added.title, original.title, 'the content itself matches what was saved');

/* Editing the packet's copy must not reach back into the library. */
await page.fill(`[data-field="title"][data-src="${added.id}"]`, 'Local edit, packet only');
await settle(page, 250);
entries = await bank();
eq(entries[0].source.title, 'Testimony before the committee (corrected)',
   'editing the packet copy leaves the library entry alone');

/* ── 4. removing from the library leaves packets alone ───────────────────── */
page.once('dialog', d => d.accept());
await page.click(`[data-bank-del="${targetBankId}"]`);
await settle(page, 250);
eq((await bank()).length, 1, 'removing a library entry removes exactly one');
pk = await packet();
ok(pk.sources.some(s => s.title === 'Local edit, packet only'),
   'and the packet built from it keeps its own copy of the source');

/* ── 5. deleting a packet does not delete the library ────────────────────── */
const bankBeforeDelete = (await bank()).length;
page.once('dialog', d => d.accept());
await page.click('#deletePacketBtn');
await settle(page, 400);
eq((await bank()).length, bankBeforeDelete,
   'deleting a whole packet leaves the source library intact — the reason it is stored separately');

/* ── 6. an empty source is refused with a reason ─────────────────────────── */
await page.click('#addSourceBtn');
await settle(page, 200);
const emptyId = await page.evaluate(() => {
  const blocks = document.querySelectorAll('#sourcesWrap .source-block');
  return blocks[blocks.length - 1].getAttribute('data-src-id');
});
const bankBeforeEmpty = (await bank()).length;
await page.click(`[data-to-bank="${emptyId}"]`);
await settle(page, 200);
eq((await bank()).length, bankBeforeEmpty, 'an empty source is not saved to the library');
ok(/still empty/.test(await page.textContent('#bankNote')), 'and the note says why');

/* ── 7. the search filters the library ───────────────────────────────────── */
await page.fill(`[data-field="title"][data-src="${emptyId}"]`, 'Mine inspector report, 1842');
await page.fill(`[data-field="citation"][data-src="${emptyId}"]`, 'Parliamentary Papers');
await settle(page, 250);
await page.click(`[data-to-bank="${emptyId}"]`);
await settle(page, 250);
await page.fill('#bankFilter', 'mine inspector');
await settle(page, 200);
eq(await page.evaluate(() => document.querySelectorAll('#bankWrap .bank-row').length), 1,
   'the search narrows the library to one match');
await page.fill('#bankFilter', 'parliamentary');
await settle(page, 200);
eq(await page.evaluate(() => document.querySelectorAll('#bankWrap .bank-row').length), 1,
   'and searches citations as well as titles');
await page.fill('#bankFilter', 'zzzz-no-such-source');
await settle(page, 200);
ok((await page.textContent('#bankWrap')).includes('No saved source matches'),
   'a search with no hits says so rather than showing an empty box');
await page.fill('#bankFilter', '');
await settle(page, 200);

/* ── 8. the library survives a reload ────────────────────────────────────── */
const beforeReload = (await bank()).length;
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
eq((await bank()).length, beforeReload, 'the library survives a reload');
await page.click('#toggleBankBtn');
await settle(page, 200);
eq(await page.evaluate(() => document.querySelectorAll('#bankWrap .bank-row').length), beforeReload,
   'and lists every saved source when reopened');

/* ── 9. no console noise anywhere in the run ─────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
