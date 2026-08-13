// smoke-clue-audio.mjs — audio inside a clue on the Review Game Board.
//
//   node Tools/review-game-board/test/smoke-clue-audio.mjs
//
// Companion to smoke-clue-image.mjs, covering the audio half of the same
// backlog item (images shipped 2026-08-11; audio was explicitly deferred to
// "its own round" — see improvement prompts/030-review-game-board.md).
//
// What's worth holding still:
//   1. a clip attaches via BOTH capture paths — MediaRecorder (a live
//      recording) and a plain file upload (a primary-source clip a teacher
//      already has) — and lands in IndexedDB (rgb-audio-db.js), not inline
//      on the clue like an image;
//   2. it plays back on the projected clue, hidden behind a Daily Double's
//      wager panel exactly like an image is;
//   3. "duplicate a board" (edit an existing board, save under a new name)
//      gives the new board an INDEPENDENTLY OWNED copy of the clip — editing
//      or deleting either board's audio afterward must never affect the
//      other, and deleting a board deletes only its own clips;
//   4. JSON export embeds the clip inline (so it survives on another
//      device) and import decodes it back into a freshly stored local clip.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8174;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/030-review-game-board.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch({
  // A fake microphone so MediaRecorder has something to capture headless —
  // Playwright's usual sandboxed context has no real audio input device.
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const page = await prepPage(browser, BASE, { width: 1400, height: 1000, permissions: ['microphone'] });
page.on('dialog', d => d.accept()); // confirm()s from Delete board / Reset game

console.log('Review Game Board — audio inside a clue');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);
await page.waitForFunction(() => !!window.RGBAudioDB, null, { timeout: 5000 });

/* ── build a tiny, genuinely valid WAV clip in the page ─────────────────── */
const wavDataUrl = await page.evaluate(() => new Promise((resolve) => {
  function makeWavBlob(seconds, sampleRate) {
    const numSamples = Math.floor(seconds * sampleRate);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    const writeString = (offset, s) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };
    writeString(0, 'RIFF'); view.setUint32(4, 36 + numSamples * 2, true); writeString(8, 'WAVE');
    writeString(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    writeString(36, 'data'); view.setUint32(40, numSamples * 2, true);
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      view.setInt16(44 + i * 2, Math.sin(2 * Math.PI * 440 * t) * 32767 * 0.5, true);
    }
    return new Blob([buffer], { type: 'audio/wav' });
  }
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.readAsDataURL(makeWavBlob(0.6, 8000));
}));
const wavB64 = wavDataUrl.split(',')[1];
ok(wavB64.length > 1000, 'the test clip is non-trivially sized');

async function uploadClipInto(rowHandle, b64) {
  await rowHandle.$eval('.clue-audio-cell input[type="file"]', (input, data) => {
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'clip.wav', { type: 'audio/wav' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, b64);
}

/* ── a one-category board, one clue with an uploaded clip ──────────────── */
await page.fill('#boardName', 'Pronunciation Review');
await page.fill('.cat-name-input', 'Vocabulary');
const rows = () => page.$$('#categoriesEditor .clue-row');
let clueRows = await rows();
await clueRows[0].$eval('.clue-points', el => { el.value = '100'; });
await clueRows[0].$eval('.clue-question', el => { el.value = 'Pronounce this word.'; });
await clueRows[0].$eval('.clue-answer', el => { el.value = 'Bonjour'; });

await uploadClipInto(clueRows[0], wavB64);
await page.waitForFunction(
  () => !!document.querySelector('#categoriesEditor .clue-row').__clueAudioId, null, { timeout: 10000 });

const clipId1 = await page.evaluate(() => document.querySelector('#categoriesEditor .clue-row').__clueAudioId);
ok(typeof clipId1 === 'string' && clipId1.length > 0, 'uploading a clip sets an audio id on the row');

const clipRecord1 = await page.evaluate(
  id => window.RGBAudioDB.getClip(id).then(r => r && { size: r.blob.size, mime: r.mime }), clipId1);
ok(clipRecord1 && clipRecord1.size > 1000, `the clip landed in IndexedDB (${clipRecord1 && clipRecord1.size} bytes)`);
eq(clipRecord1.mime, 'audio/wav', 'with the uploaded mime type preserved');
ok(/KB|saved/.test(await page.textContent('#categoriesEditor .clue-audio-size')), 'the editor shows the clip is stored');
ok(await page.isVisible('#categoriesEditor .clue-row .clue-audio-cell button:has-text("Remove")'),
   'and a Remove control appears once a clip is attached');

// A second, audio-free clue so the "no audio" path is exercised too.
await page.click('#categoriesEditor .cat-actions button.secondary');
clueRows = await rows();
await clueRows[1].$eval('.clue-points', el => { el.value = '200'; });
await clueRows[1].$eval('.clue-question', el => { el.value = 'A text-only clue.'; });
await clueRows[1].$eval('.clue-answer', el => { el.value = 'No audio here'; });

await page.click('#buildFromManualBtn');
await settle(page, 400);

/* ── the saved board carries only the id, not the blob ──────────────────── */
const saved1 = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('gvb-review-board:data:Pronunciation Review')));
eq(saved1.categories[0].clues[0].audioId, clipId1, 'the audio id is saved with the board');
eq(saved1.categories[0].clues[1].audioId, undefined, 'a clue with no clip carries no audioId field');
ok(JSON.stringify(saved1).indexOf('RIFF') === -1, 'the audio bytes themselves are NOT inlined into localStorage');

/* ── projected: the clip plays with the clue ────────────────────────────── */
await page.evaluate(() => { // keep the Daily Double off the clue under test for this pass
  const st = JSON.parse(localStorage.getItem('gvb-review-board:data:Pronunciation Review'));
  st.dailyDoubleEnabled = false;
  st.categories[0].clues.forEach(c => { c.dailyDouble = false; });
  localStorage.setItem('gvb-review-board:data:Pronunciation Review', JSON.stringify(st));
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
await page.click('#boardCols .cell');
await settle(page, 400);
ok(await page.isVisible('#overlayAudio'), 'the clue audio control is projected with the question');
const overlaySrc = await page.$eval('#overlayAudio', e => e.getAttribute('src') || '');
ok(overlaySrc.startsWith('blob:'), 'backed by a real blob: URL, fetched from IndexedDB: ' + overlaySrc);
const duration = await page.evaluate(() => new Promise((resolve) => {
  const el = document.getElementById('overlayAudio');
  if (el.readyState >= 1) return resolve(el.duration);
  el.addEventListener('loadedmetadata', () => resolve(el.duration), { once: true });
  setTimeout(() => resolve(el.duration), 2000);
}));
ok(duration > 0.3 && duration < 2, `and it decodes as real, ~0.6s audio (got ${duration}s)`);
await page.keyboard.press('Escape');
await settle(page, 200);

// The second clue has no clip — the control must not linger from the first.
const cells = await page.$$('#boardCols .cell');
await cells[1].click();
await settle(page, 300);
ok(!(await page.isVisible('#overlayAudio')), 'a clue with no clip shows no audio control');
await page.keyboard.press('Escape');
await settle(page, 200);

/* ── Daily Double: hidden until the wager is in, same as the image ─────── */
await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem('gvb-review-board:data:Pronunciation Review'));
  st.dailyDoubleEnabled = true;
  st.categories[0].clues[0].dailyDouble = true;
  st.categories[0].clues.forEach(c => { c.used = false; });
  localStorage.setItem('gvb-review-board:data:Pronunciation Review', JSON.stringify(st));
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
await page.click('#boardCols .cell');
await settle(page, 300);
ok(await page.isVisible('#wagerPanel'), 'the Daily Double wager panel opened on the clip clue');
ok(!(await page.isVisible('#overlayAudio')), 'a Daily Double keeps the clip hidden behind the wager panel');
await page.click('#wagerStartBtn');
await settle(page, 400);
ok(await page.isVisible('#overlayAudio'), 'and reveals it once the wager is placed');
await page.keyboard.press('Escape');
await settle(page, 200);

/* ── recording via MediaRecorder, not just upload ───────────────────────── */
await page.click('#editBoardBtn');
await settle(page, 300);
clueRows = await rows();
const recordBtn = await clueRows[1].$('.clue-audio-cell button');
ok(!!recordBtn && (await recordBtn.textContent()).includes('Record'), 'the second (audio-free) row exposes a Record button');
await recordBtn.click();
await settle(page, 1200); // let the fake mic produce >1s of audio
await clueRows[1].$eval('.clue-audio-cell button.recording', btn => btn.click()); // "⏹ Stop"
await page.waitForFunction(
  () => !!document.querySelectorAll('#categoriesEditor .clue-row')[1].__clueAudioId, null, { timeout: 10000 });
const recordedId = await page.evaluate(() => document.querySelectorAll('#categoriesEditor .clue-row')[1].__clueAudioId);
const recordedInfo = await page.evaluate(
  id => window.RGBAudioDB.getClip(id).then(r => r && r.blob.size), recordedId);
ok(recordedInfo > 0, `a live MediaRecorder recording also lands in IndexedDB (${recordedInfo} bytes)`);
await page.click('#buildFromManualBtn'); // same name — in-place edit
await settle(page, 500);

/* ── "duplicate a board": edit, rename, save — independent copies ──────── */
await page.click('#editBoardBtn');
await settle(page, 300);
await page.fill('#boardName', 'Pronunciation Review (Copy)');
await page.click('#buildFromManualBtn');
await settle(page, 600);

const original = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('gvb-review-board:data:Pronunciation Review')));
const copy = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('gvb-review-board:data:Pronunciation Review (Copy)')));
const origId = original.categories[0].clues[0].audioId;
const copyId = copy.categories[0].clues[0].audioId;
ok(!!origId && !!copyId, 'both boards still carry an audio id on the first clue');
ok(origId !== copyId, `saving under a new name gives the copy an INDEPENDENT clip id (orig ${origId}, copy ${copyId})`);
const bothPlayable = await page.evaluate(async ([a, b]) => {
  const ra = await window.RGBAudioDB.getClip(a);
  const rb = await window.RGBAudioDB.getClip(b);
  return !!ra && !!rb && ra.blob.size === rb.blob.size;
}, [origId, copyId]);
ok(bothPlayable, 'and both clips independently exist in IndexedDB with equal content');

// Deleting the COPY must not touch the ORIGINAL's clip.
await page.evaluate(() => { ReviewBoardStore.setCurrentName('Pronunciation Review (Copy)'); });
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
await page.click('#deleteBoardBtn');
await settle(page, 500);
const copyClipAfterDelete = await page.evaluate(id => window.RGBAudioDB.getClip(id), copyId);
const origClipAfterDelete = await page.evaluate(id => window.RGBAudioDB.getClip(id), origId);
eq(copyClipAfterDelete, null, "deleting the copy's board deletes its own clip");
ok(!!origClipAfterDelete, "and leaves the ORIGINAL board's clip completely untouched");

/* ── JSON export/import round trip ──────────────────────────────────────── */
await page.evaluate(() => { ReviewBoardStore.setCurrentName('Pronunciation Review'); });
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);

const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.click('#exportBoardBtn'),
]);
const exportedPath = await download.path();
const fs = await import('node:fs');
const exportedJson = JSON.parse(fs.readFileSync(exportedPath, 'utf8'));
const exportedClue = exportedJson.categories[0].clues[0];
ok(typeof exportedClue.audio === 'string' && exportedClue.audio.startsWith('data:audio/'),
   'the export embeds the clip inline as a data: URL, like an image');
eq(exportedClue.audioId, undefined, 'and drops the (locally-meaningful-only) audioId field');

await page.$eval('#importBoardFile', (input, text) => {
  const dt = new DataTransfer();
  dt.items.add(new File([text], 'board.json', { type: 'application/json' }));
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}, JSON.stringify(exportedJson));
await settle(page, 800);

const imported = await page.evaluate(() => {
  const names = JSON.parse(localStorage.getItem('gvb-review-board:list'));
  const last = names[names.length - 1];
  return JSON.parse(localStorage.getItem('gvb-review-board:data:' + last));
});
const importedId = imported.categories[0].clues[0].audioId;
ok(typeof importedId === 'string' && importedId.length > 0, 'the import decodes the clip into a fresh local IndexedDB id');
ok(importedId !== origId, 'distinct from the id on the board that was exported (a fresh, independent copy)');
const importedPlayable = await page.evaluate(
  id => window.RGBAudioDB.getClip(id).then(r => r && r.blob.size > 1000), importedId);
ok(importedPlayable, 'and the decoded clip is actually there, non-trivially sized');

/* ── no console noise, nothing left the site ────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
