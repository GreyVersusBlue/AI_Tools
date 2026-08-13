// smoke-transfer.mjs — the device-to-device transfer feature: pairing
// (backup-restore/br-pair.js), chunking/reassembly (backup-restore/br-transfer.js),
// and the receiving device's reuse of the file-based restore pipeline.
//
//   node Tools/backup-restore/test/smoke-transfer.mjs
//
// Two things are checked here that smoke-restore-diff.mjs (the existing
// suite) does not touch:
//
//   1. A REAL two-peer WebRTC data channel, opened between two Playwright
//      pages loading this tool in the same headless browser, carrying the
//      exact backup file this page's own "Download backup" button produces
//      — chunked and reassembled by br-transfer.js — and landing on the
//      other side byte-for-byte identical. Both pages call into
//      window.BRPair / window.BRTransfer directly rather than driving the
//      QR-scanning UI, because a headless browser has no camera to scan a
//      code with; that half (webrtc-pair.js's offer/answer text is what
//      gets encoded into and decoded out of the QR) is unchanged from what
//      Tools/classroom-timer/mirror.html already exercises live, and is not
//      re-tested here.
//   2. The reassembled text, once it lands, is fed into the SAME restore
//      path a picked file uses (#fileInput, not a second "apply a transfer"
//      code path) — so this also confirms there is exactly one restore
//      implementation, and that transferred data restores correctly.
//
// Also covers br-transfer.js's chunk/reassemble protocol directly (no
// WebRTC needed) — empty payload, an exact chunk-size boundary, a payload
// that spans a UTF-16 surrogate pair right at a chunk boundary, and the
// receiver's error paths (data before a header, a corrupt header).
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8161;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/009-backup-restore.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

console.log('Backup & Restore — device-to-device transfer');

/* ── 1. br-transfer.js's chunk/reassemble protocol, in isolation ────────── */
{
  const page = await prepPage(browser, BASE, { width: 1000, height: 800 });
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 200);

  const results = await page.evaluate(() => {
    function roundTrip(text, chunkChars) {
      const chunks = window.BRTransfer.chunkPayload(text, chunkChars);
      let out = null, err = null, progressCalls = 0;
      const receiver = window.BRTransfer.createReceiver({
        onProgress: () => { progressCalls++; },
        onComplete: (t) => { out = t; },
        onError: (e) => { err = e.message; },
      });
      receiver.handleMessage('M' + JSON.stringify({ size: text.length, chunks: chunks.length }));
      chunks.forEach((c) => receiver.handleMessage('D' + c));
      return { out, err, progressCalls, chunkCount: chunks.length };
    }

    const out = {};

    // Empty payload still chunks to one empty chunk and reassembles to ''.
    out.empty = roundTrip('');

    // Exactly on a chunk-size boundary (2x the default chunk size).
    const boundaryText = 'x'.repeat(window.BRTransfer.CHUNK_CHARS * 2);
    out.boundary = roundTrip(boundaryText, undefined);
    out.boundaryMatches = out.boundary.out === boundaryText;

    // A UTF-16 surrogate pair (an emoji) split across a chunk boundary by
    // forcing a tiny chunk size that lands mid-pair.
    const withEmoji = 'ab🎒cd'; // 'a','b','\uD83C','\uDF92','c','d' — 6 UTF-16 code units
    out.surrogateSplit = roundTrip(withEmoji, 3); // splits inside the surrogate pair
    out.surrogateMatches = out.surrogateSplit.out === withEmoji;

    // Data before any header: a protocol error, not a silent drop.
    let dataFirstErr = null;
    window.BRTransfer.createReceiver({ onError: (e) => { dataFirstErr = e.message; } }).handleMessage('Dhello');
    out.dataBeforeHeader = dataFirstErr;

    // A corrupt header: also a protocol error.
    let badHeaderErr = null;
    window.BRTransfer.createReceiver({ onError: (e) => { badHeaderErr = e.message; } }).handleMessage('Mnot json');
    out.badHeader = badHeaderErr;

    return out;
  });

  eq(results.empty.out, '', 'an empty payload round-trips to an empty string');
  eq(results.empty.chunkCount, 1, 'an empty payload is still exactly one (empty) chunk');
  ok(results.boundaryMatches, 'a payload landing exactly on a chunk-size boundary round-trips exactly');
  ok(results.surrogateMatches, 'a UTF-16 surrogate pair split across a chunk boundary still reassembles exactly');
  ok(!!results.dataBeforeHeader, 'a data chunk arriving before any header is reported as an error, not silently dropped');
  ok(!!results.badHeader, 'a corrupt header is reported as an error');

  await page.close();
}

/* ── 2. a real two-peer WebRTC data channel carrying a real backup ──────── */
{
  const pageA = await prepPage(browser, BASE, { width: 1000, height: 800 }); // "old laptop" — sends
  const pageB = await prepPage(browser, BASE, { width: 1000, height: 800 }); // "new laptop" — receives

  await pageA.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await pageB.goto(URL_PAGE, { waitUntil: 'networkidle' });

  /* Seed page A with the same fixture smoke-restore-diff.mjs uses, so this
     is a real multi-record roster, not a synthetic string. */
  const ON_DISK_A = {
    'Period 1 — Geology': ['Ada Lovelace', 'Marco Polo'],
    'Period 3 — Earth Science': ['Nellie Bly'],
  };
  await pageA.evaluate((disk) => { localStorage.setItem('np_rosters', JSON.stringify(disk)); }, ON_DISK_A);
  await pageA.reload({ waitUntil: 'networkidle' });
  await settle(pageA, 300);

  /* The exact bytes buildEnvelope()/"Download backup" would produce — pulled
     via a real download rather than reimplemented, so this test is checking
     the same object the transfer feature reuses, not a stand-in for it. */
  const [download] = await Promise.all([
    pageA.waitForEvent('download'),
    pageA.click('#downloadBtn'),
  ]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  const envelopeText = Buffer.concat(chunks).toString('utf8');
  const envelopeParsed = JSON.parse(envelopeText);
  ok(envelopeParsed.format === 'aspermylessonplan-backup', 'the captured file really is this page\'s own backup envelope');
  ok(envelopeText.length > 0, 'the envelope is non-empty: ' + envelopeText.length + ' chars');

  /* Real pairing: both pages call the same window.BRPair the "Send"/"Receive"
     buttons call, skipping only the QR-scan step (no camera headlessly). */
  const offerPayload = await pageA.evaluate(async () => {
    const h = await window.BRPair.startHost('backup');
    window.__host = h;
    return h.offerPayload;
  });
  const answerPayload = await pageB.evaluate(async (offer) => {
    const j = await window.BRPair.startJoin(offer);
    window.__join = j;
    return j.answerPayload;
  }, offerPayload);
  await pageA.evaluate(async (answer) => { await window.__host.applyAnswer(answer); }, answerPayload);

  await pageA.waitForFunction(() => window.__host.channel && window.__host.channel.readyState === 'open', { timeout: 15000 });
  await pageB.waitForFunction(() => window.__join.channel && window.__join.channel.readyState === 'open', { timeout: 15000 });
  ok(true, 'a real RTCDataChannel opens between two peers using this page\'s own pairing wrapper');

  /* Receive it exactly the way the "Receive from a device" flow's onComplete
     handler would — but capture the text instead of restoring immediately,
     so this test can check the transfer byte-for-byte before also checking
     the restore. */
  await pageB.evaluate(() => {
    window.__received = null;
    window.__receivedError = null;
    window.__receiver = window.BRTransfer.createReceiver({
      onComplete: (text) => { window.__received = text; },
      onError: (err) => { window.__receivedError = err.message; },
    });
    window.__join.onMessage((raw) => window.__receiver.handleMessage(raw));
  });

  await pageA.evaluate(async (text) => {
    await window.BRTransfer.sendPayload(window.__host.channel, text);
  }, envelopeText);

  await pageB.waitForFunction(() => window.__received !== null || window.__receivedError !== null, { timeout: 20000 });
  const xfer = await pageB.evaluate(() => ({ received: window.__received, error: window.__receivedError }));
  eq(xfer.error, null, 'no protocol error during the real transfer');
  eq(xfer.received, envelopeText, 'the exact backup file bytes arrive on the other device over the real data channel');

  /* ── the receiving device now runs it through the ordinary restore path ── */
  await pageB.setInputFiles('#fileInput', {
    name: 'received-over-webrtc.json',
    mimeType: 'application/json',
    buffer: Buffer.from(xfer.received),
  });
  await settle(pageB, 400);
  ok(await pageB.isVisible('#previewList'), 'the transferred bytes open the same restore preview a picked file would');

  // A key that doesn't exist on this machine at all lands as one whole-key
  // "added" item (recordDiff's existing behaviour — nothing to diff a new
  // key's records against), not broken into its two individual rosters.
  const previewText = await pageB.textContent('#previewSummary');
  ok(/1 saved item/.test(previewText) && /1 added/.test(previewText),
     'np_rosters shows as one new item on a blank machine: ' + JSON.stringify(previewText));

  await pageB.click('#restoreBtn');
  await settle(pageB, 500);
  const restored = await pageB.evaluate(() => JSON.parse(localStorage.getItem('np_rosters')));
  eq(Object.keys(restored).sort().join('|'), 'Period 1 — Geology|Period 3 — Earth Science',
     'restoring what arrived over WebRTC lands the same rosters that were on the sending device');
  eq(restored['Period 1 — Geology'].join(','), 'Ada Lovelace,Marco Polo', 'record contents survive the transfer intact');

  eq(pageA.__errs.length, 0, 'no console/page errors on the sending device: ' + JSON.stringify(pageA.__errs.slice(0, 4)));
  eq(pageB.__errs.length, 0, 'no console/page errors on the receiving device: ' + JSON.stringify(pageB.__errs.slice(0, 4)));
  eq(pageA.__blocked.length, 0, 'nothing tried to leave the site (sender): ' + JSON.stringify(pageA.__blocked.slice(0, 4)));
  eq(pageB.__blocked.length, 0, 'nothing tried to leave the site (receiver): ' + JSON.stringify(pageB.__blocked.slice(0, 4)));

  await pageA.close();
  await pageB.close();
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
