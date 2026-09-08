// smoke-send-to.mjs — Path 6 P4 in a real browser: the share sheet's
// "Send to…" row, 052 Cognates & False Friends -> 040 Vocabulary Flashcards.
//
//   node Tools/share/test/smoke-send-to.mjs      (or: npm run test:send-to)
//
// handoffs.test.mjs proves the table, the transform and the link in Node.
// This suite proves the two halves a page adds: the ROW — it exists in 052's
// sheet, it is absent from a page that has not loaded handoffs.js, and it
// opens the receiver in a new tab — and the ARRIVAL: 040 opens that link,
// saves the list under its own name without touching what it had, and
// renders the cognates as cards, which is the only reason to send them.
//
// Per section:
//   1. 052 with a saved list: the sheet has a data-share="send:…" row after
//      the four it always has; clicking it calls window.open with 040's page
//      and 040's parameter; the note under the toolbar says so; a blocked
//      pop-up is reported as an error.
//   2. 040 opens the captured link on a device that already has a list: the
//      arrival is filed under a new name, the existing list is untouched, and
//      the preview shows the cognates as flashcards — with a false friend's
//      trap on the definition side.
//   3. axe on 052's open sheet with the extra row (light and dark, since the
//      row is new chrome in a dialog the site-wide sweep never opens).
//   4. a page that loads share.js without handoffs.js has no Send row — the
//      row is opt-in per page, not a site-wide surprise.
//   5. no console errors and nothing left the site.
//
// Exits 1 on any failure. Every name here is invented.

import { SITE, serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import fs from 'fs';
import path from 'path';

const PORT = 8416;
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const SENDER = '052-cognates-false-friends-builder.html';
const RECEIVER = '040-vocab-flashcard-generator.html';

/* ── 0. static: 052 loads the registry and the table after share.js ─────── */
console.log('Send to… — 052 → 040');
{
  const html = fs.readFileSync(path.join(SITE, 'Tools', SENDER), 'utf8');
  const at = ['_shared/share.js', '_shared/tool-registry.js', '_shared/handoffs.js'].map(s => html.indexOf(`src="../${s}"`));
  ok(at.every(i => i !== -1), '052 loads share.js, tool-registry.js and handoffs.js: ' + JSON.stringify(at));
  ok(at[0] < at[1] && at[1] < at[2], 'in that order');
}

const server = await serve(PORT);
const browser = await launch();
const pages = [];

const LIST = {
  lang: 'Portuguese',
  cognates: [{ id: 'c1', target: 'animal', english: 'animal' }, { id: 'c2', target: 'hospital', english: 'hospital' }],
  falseFriends: [{ id: 'f1', target: 'puxar', looksLike: 'push', actual: 'to pull' }],
};

/* ── 1. the row, on the sender ──────────────────────────────────────────── */
const sender = await prepPage(browser, BASE, { width: 1400, height: 1000 });
pages.push(['052', sender]);
await sender.addInitScript(v => { localStorage.setItem('cffb_list_v1', v); }, JSON.stringify(LIST));
await sender.goto(BASE + '/Tools/' + SENDER, { waitUntil: 'load' });
await settle(sender, 600);

await sender.click('#shareBtn');
await settle(sender, 250);
const rows = await sender.$$eval('.share-sheet-rows button', bs => bs.map(b => b.getAttribute('data-share')));
ok(rows.includes('send:vocab-flashcard-generator'), 'the sheet has a Send to Vocabulary Flashcards row: ' + JSON.stringify(rows));
ok(rows.indexOf('send:vocab-flashcard-generator') > rows.indexOf('download'), 'after the rows the sheet always has');
eq(await sender.textContent('.share-sheet button[data-share="send:vocab-flashcard-generator"] span'),
  'Send to Vocabulary Flashcards', 'with the entry\'s label');

const sent = await sender.evaluate(() => {
  const opened = [];
  window.open = (url, target, features) => { opened.push({ url, target, features }); return {}; };
  document.querySelector('.share-sheet button[data-share="send:vocab-flashcard-generator"]').click();
  return { opened, status: document.querySelector('.share-sheet-status').textContent };
});
eq(sent.opened.length, 1, 'clicking it opens exactly one tab');
const url = sent.opened[0] && sent.opened[0].url;
ok(url && url.indexOf(BASE + '/Tools/' + RECEIVER + '?deck=') === 0, 'at 040\'s page with 040\'s parameter: ' + JSON.stringify(url));
eq(sent.opened[0] && sent.opened[0].features, 'noopener', 'as a noopener tab');
ok(/new tab/.test(sent.status), 'and the sheet says so: ' + JSON.stringify(sent.status));
ok(/new tab/.test(await sender.textContent('#shareNote')), 'as does the note under the toolbar');
const payload = await sender.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('deck')), url);
eq(payload.name, 'Portuguese cognates & false friends', 'the payload is a named word list');
ok(payload.words.split('\n').length === 3 && payload.words.indexOf('puxar: to pull (not “push”)') !== -1,
  'with one line per pair and the false friend\'s trap: ' + JSON.stringify(payload.words));

const blocked = await sender.evaluate(() => {
  window.open = () => null;
  document.querySelector('.share-sheet button[data-share="send:vocab-flashcard-generator"]').click();
  const s = document.querySelector('.share-sheet-status');
  return { text: s.textContent, error: s.classList.contains('error') };
});
ok(/pop-ups/.test(blocked.text) && blocked.error, 'a blocked pop-up is reported as an error with what to do: ' + JSON.stringify(blocked.text));

/* ── 3. axe on the open sheet, light and dark ───────────────────────────── */
const light = await a11yScan(sender, { impact: 'serious', include: '.share-sheet' });
eq(light.length, 0, 'no serious/critical axe violations on the open sheet with the Send row (light): ' + JSON.stringify(light.map(v => v.id)));
await sender.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); });
await settle(sender, 200);
const dark = await a11yScan(sender, { impact: 'serious', include: '.share-sheet' });
eq(dark.length, 0, 'and in dark: ' + JSON.stringify(dark.map(v => v.id)));
await sender.keyboard.press('Escape');
await settle(sender, 200);

/* ── 2. the arrival, on a device that already has a list ────────────────── */
console.log('\n040 — the arrival');
const receiver = await prepPage(browser, BASE, { width: 1400, height: 1000 });
pages.push(['040', receiver]);
await receiver.goto(BASE + '/Tools/' + RECEIVER, { waitUntil: 'load' });
await settle(receiver, 600);
const before = await receiver.evaluate(() => JSON.parse(localStorage.getItem('gvb-vocab-flashcards:list') || '[]'));
await receiver.goto(url, { waitUntil: 'load' });
await settle(receiver, 900);
const after = await receiver.evaluate(() => JSON.parse(localStorage.getItem('gvb-vocab-flashcards:list') || '[]'));
eq(after.length, before.length + 1, `040 files the arrival as one new list (had ${before.length}): ` + JSON.stringify(after));
const newName = after.find(n => before.indexOf(n) === -1);
ok(newName && newName.indexOf('Portuguese cognates & false friends') === 0, 'under the name the sender gave it: ' + JSON.stringify(newName));
ok(/saved here as/.test(await receiver.textContent('#shareNote')), '040 says what it did: ' + JSON.stringify(await receiver.textContent('#shareNote')));
eq(await receiver.inputValue('#wordInput'), payload.words, 'the word list on screen is exactly what was sent');
eq(new URL(receiver.url()).searchParams.get('deck'), null, 'the parameter is consumed on open');
const preview = await receiver.textContent('#previewArea');
ok(preview && preview.indexOf('animal') !== -1 && preview.indexOf('hospital') !== -1, 'and the preview shows the cognates as cards');
const words = await receiver.inputValue('#wordInput');
ok(words.indexOf('not “push”') !== -1, 'the false friend\'s trap arrived on the definition side');

/* ── 4. no handoffs.js, no row ──────────────────────────────────────────── */
console.log('\n054 — a page that has not opted in');
const other = await prepPage(browser, BASE, { width: 1400, height: 1000 });
pages.push(['054', other]);
await other.goto(BASE + '/Tools/054-current-events-discussion-guide-generator.html', { waitUntil: 'load' });
await settle(other, 600);
eq(await other.evaluate(() => typeof window.Handoffs), 'undefined', '054 has not loaded handoffs.js');
await other.click('#shareBtn');
await settle(other, 250);
const otherRows = await other.$$eval('.share-sheet-rows button', bs => bs.map(b => b.getAttribute('data-share')));
ok(!otherRows.some(r => r.indexOf('send:') === 0), 'and its sheet has no Send row: ' + JSON.stringify(otherRows));
await other.keyboard.press('Escape');

/* ── 5. no console noise, nowhere ───────────────────────────────────────── */
console.log('');
for (const [name, p] of pages) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
